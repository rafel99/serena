const CACHE = 'serena-v3';
const ASSETS = ['./index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Nunca cachear llamadas a la API
  if (e.request.url.includes('/api/')) return;
  if (e.request.url.includes('api.anthropic.com')) return;

  e.respondWith(
    fetch(e.request).then(res => {
      if (e.request.method === 'GET' && res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() =>
      caches.match(e.request).then(cached =>
        cached || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)
      )
    )
  );
});

// â”€â”€ NOTIFICATION MESSAGES â”€â”€
const MORNING_MSGS = [
  { title: 'Buenos dÃ­as ðŸŒ…', body: 'Un nuevo dÃ­a, una nueva oportunidad. Â¿CÃ³mo amaneciste hoy?' },
  { title: 'Serena te saluda ðŸŒ™', body: 'Antes de empezar el dÃ­a, respira. Estoy aquÃ­ si me necesitas.' },
  { title: 'Empieza bien el dÃ­a âœ¨', body: 'Registra cÃ³mo te sientes esta maÃ±ana. Un minuto puede marcar la diferencia.' },
  { title: 'Â¡Hola! ðŸŒ¸', body: 'Tu mensaje de hoy estÃ¡ listo. TÃ³mate un momento para ti.' },
];
const MIDDAY_MSGS = [
  { title: 'Check-in del mediodÃ­a ðŸŒ¤ï¸', body: 'Â¿CÃ³mo vas? A veces un momento de pausa lo cambia todo.' },
  { title: 'Pausa de bienestar â˜€ï¸', body: 'Respira profundo. Â¿Necesitas desahogarte o calmarte un momento?' },
  { title: 'A mitad del dÃ­a ðŸ’¬', body: 'Â¿CÃ³mo estÃ¡ tu energÃ­a? CuÃ©ntame, estoy aquÃ­.' },
  { title: 'Un momento para ti ðŸŒ¿', body: 'El dÃ­a puede ser intenso. Â¿QuÃ© tal un ejercicio rÃ¡pido de 2 minutos?' },
];
const NIGHT_MSGS = [
  { title: 'ReflexiÃ³n nocturna ðŸŒ™', body: 'Â¿CÃ³mo fue tu dÃ­a? EscrÃ­belo o simplemente desahÃ³gate.' },
  { title: 'Antes de dormir ðŸŒŸ', body: 'Registra tu estado de Ã¡nimo de hoy. MaÃ±ana lo verÃ¡s en tu calendario.' },
  { title: 'Buenas noches âœ¨', body: 'El dÃ­a terminÃ³. Â¿QuÃ© quieres soltar antes de descansar?' },
  { title: 'Tu espacio seguro ðŸ’œ', body: 'Estoy aquÃ­ para escucharte antes de que cierres los ojos.' },
];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

self.addEventListener('periodicsync', e => {
  if (e.tag === 'serena-morning') e.waitUntil(showNotification('morning'));
  if (e.tag === 'serena-midday') e.waitUntil(showNotification('midday'));
  if (e.tag === 'serena-night') e.waitUntil(showNotification('night'));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_NOTIFICATION') {
    showNotification(e.data.slot);
  }
  if (e.data && e.data.type === 'TEST_NOTIFICATION') {
    showNotification('morning');
  }
});

async function showNotification(slot) {
  const msg = slot === 'morning' ? getRandom(MORNING_MSGS)
    : slot === 'midday' ? getRandom(MIDDAY_MSGS)
    : getRandom(NIGHT_MSGS);

  return self.registration.showNotification(msg.title, {
    body: msg.body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'serena-' + slot,
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: './' },
    actions: [
      { action: 'open', title: 'ðŸ’¬ Abrir Serena' },
      { action: 'dismiss', title: 'Ahora no' }
    ]
  });
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const c of list) {
        if (c.url.includes('serena') && 'focus' in c) return c.focus();
      }
      return clients.openWindow('./');
    })
  );
});
