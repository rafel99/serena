// /api/chat — proxy seguro hacia la API de Anthropic para Serena.
// Protecciones: origen permitido, validación de entrada, límite por IP y respuestas amables.

const ALLOWED_ORIGINS = [
  'https://serena-virid.vercel.app',
];
const MODEL = 'claude-sonnet-4-5';
const MAX_TOKENS = 1000;

// Límites de entrada
const MAX_MESSAGES = 20;            // últimos N mensajes del historial
const MAX_CONTENT_CHARS = 2000;     // por mensaje
const MAX_SYSTEM_CHARS = 4000;
const SYSTEM_PREFIX = 'Eres Serena, una asistente de apoyo emocional';

// Límite por IP (en memoria; se reinicia cuando Vercel recicla la instancia, así que es
// una barrera básica. Para algo más estricto, activa un Rate Limit en Vercel Firewall).
const PER_MINUTE = 8;
const PER_DAY = 150;
const hits = new Map(); // ip -> { minute: [ts], day: [ts] }

const DEFAULT_SYSTEM = `${SYSTEM_PREFIX}, cálida, empática y presente. Responde siempre en español, escucha primero, valida las emociones, usa un tono cercano y respuestas cortas. No diagnostiques ni des consejos médicos. Si hay riesgo de autolesión, expresa preocupación y sugiere buscar ayuda inmediata y una línea de crisis.`;

function friendly(res, status, text) {
  // Mismo formato que la API, para que el chat muestre el mensaje como respuesta de Serena.
  return res.status(status).json({ content: [{ type: 'text', text }] });
}

function getIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip) || { minute: [], day: [] };
  rec.minute = rec.minute.filter((t) => now - t < 60 * 1000);
  rec.day = rec.day.filter((t) => now - t < 24 * 60 * 60 * 1000);
  if (rec.minute.length >= PER_MINUTE) { hits.set(ip, rec); return 'minute'; }
  if (rec.day.length >= PER_DAY) { hits.set(ip, rec); return 'day'; }
  rec.minute.push(now);
  rec.day.push(now);
  hits.set(ip, rec);
  // Limpieza ocasional para que el mapa no crezca sin control
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.day.length || now - v.day[v.day.length - 1] > 24 * 60 * 60 * 1000) hits.delete(k);
    }
  }
  return null;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const originOk = !origin || ALLOWED_ORIGINS.includes(origin);

  if (origin && originOk) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(originOk ? 200 : 403).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!originOk) return res.status(403).json({ error: 'Forbidden' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server not configured' });

  // Límite por IP
  const limited = rateLimited(getIp(req));
  if (limited === 'minute') {
    return friendly(res, 429, 'Vamos con calma 🌿 Estás escribiendo muy rápido. Respira y vuelve a intentarlo en un minuto.');
  }
  if (limited === 'day') {
    return friendly(res, 429, 'Hoy hemos conversado mucho 💜 Por ahora llegamos al límite de mensajes del día. Puedes volver mañana, y si necesitas ayuda ahora, usa el botón "Ayuda".');
  }

  try {
    const body = req.body || {};

    // Validar mensajes
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return res.status(400).json({ error: 'Invalid messages' });
    }
    const messages = body.messages
      .slice(-MAX_MESSAGES)
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT_CHARS) }));
    if (messages.length === 0 || messages[0].role !== 'user') {
      // La API exige que empiece con "user"
      while (messages.length && messages[0].role !== 'user') messages.shift();
    }
    if (messages.length === 0) return res.status(400).json({ error: 'Invalid messages' });

    // Validar system: solo se acepta el prompt de Serena; cualquier otra cosa se ignora
    let system = DEFAULT_SYSTEM;
    if (
      typeof body.system === 'string' &&
      body.system.length <= MAX_SYSTEM_CHARS &&
      body.system.startsWith(SYSTEM_PREFIX)
    ) {
      system = body.system;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system, messages }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Anthropic error:', response.status, JSON.stringify(data).slice(0, 300));
      return friendly(res, 502, 'Ups, tuve un problema para responderte ahora. Intenta de nuevo en un momento 🙏');
    }
    return res.status(200).json(data);
  } catch (error) {
    console.error('API error:', error);
    return friendly(res, 500, 'Ups, hubo un problema de conexión. Intenta de nuevo 🙏');
  }
}
