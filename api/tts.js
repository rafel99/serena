export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'ELEVENLABS_API_KEY not configured',
      fallback: true,
    });
  }

  try {
    const { text, voice_id } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required', fallback: true });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id || 'imFXYz8XIletRKLZZQaA'}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error('ElevenLabs error:', response.status, errorBody);

      // 402 = sin créditos, 401 = API key inválida, 429 = rate limit
      const messages = {
        402: 'Créditos de voz agotados',
        401: 'API key de voz inválida',
        429: 'Demasiadas solicitudes de voz',
      };

      return res.status(response.status).json({
        error: messages[response.status] || `Error de voz (${response.status})`,
        code: response.status,
        fallback: true, // señal para que el frontend use Web Speech API
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('TTS error:', error);
    return res.status(500).json({
      error: 'Error interno del servidor de voz',
      fallback: true,
    });
  }
}
