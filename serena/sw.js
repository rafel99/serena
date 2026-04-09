const CACHE = ‘serena-v2’;
const ASSETS = [’./index.html’, ‘./manifest.json’];

self.addEventListener(‘install’, e => {
e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})));
self.skipWaiting();
});

self.addEventListener(‘activate’, e => {
e.waitUntil(caches.keys().then(keys =>
Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
));
self.clients.claim();
});

self.addEventListener(‘fetch’, e => {
if (e.request.url.includes(‘api.anthropic.com’)) return;
e.respondWith(
caches.match(e.request).then(cached => {
if (cached) return cached;
return fetch(e.request).then(res => {
if (e.request.method === ‘GET’ && res.status === 200) {
caches.open(CACHE).then(c => c.put(e.request, res.clone()));
}
return res;
}).catch(() => e.request.mode === ‘navigate’ ? caches.match(’./index.html’) : undefined);
})
);
});

// ── NOTIFICATION MESSAGES ──────────────────────────────
const MORNING_MSGS = [
{ title: ‘Buenos días 🌅’, body: ‘Un nuevo día, una nueva oportunidad. ¿Cómo amaneciste hoy?’ },
{ title: ‘Serena te saluda 🌙’, body: ‘Antes de empezar el día, respira. Estoy aquí si me necesitas.’ },
{ title: ‘Empieza bien el día ✨’, body: ‘Registra cómo te sientes esta mañana. Un minuto puede marcar la diferencia.’ },
{ title: ‘¡Hola! 🌸’, body: ‘Tu mensaje de hoy está listo. Tómate un momento para ti.’ },
];
const MIDDAY_MSGS = [
{ title: ‘Check-in del mediodía 🌤️’, body: ‘¿Cómo vas? A veces un momento de pausa lo cambia todo.’ },
{ title: ‘Pausa de bienestar ☀️’, body: ‘Respira profundo. ¿Necesitas desahogarte o calmarte un momento?’ },
{ title: ‘A mitad del día 💬’, body: ‘¿Cómo está tu energía? Cuéntame, estoy aquí.’ },
{ title: ‘Un momento para ti 🌿’, body: ‘El día puede ser intenso. ¿Qué tal un ejercicio rápido de 2 minutos?’ },
];
const NIGHT_MSGS = [
{ title: ‘Reflexión nocturna 🌙’, body: ‘¿Cómo fue tu día? Escríbelo o simplemente desahógate.’ },
{ title: ‘Antes de dormir 🌟’, body: ‘Registra tu estado de ánimo de hoy. Mañana lo verás en tu calendario.’ },
{ title: ‘Buenas noches ✨’, body: ‘El día terminó. ¿Qué quieres soltar antes de descansar?’ },
{ title: ‘Tu espacio seguro 💜’, body: ‘Estoy aquí para escucharte antes de que cierres los ojos.’ },
];

function getRandom(arr) {
return arr[Math.floor(Math.random() * arr.length)];
}

// Handle scheduled notification alarms
self.addEventListener(‘periodicsync’, e => {
if (e.tag === ‘serena-morning’) e.waitUntil(showNotification(‘morning’));
if (e.tag === ‘serena-midday’) e.waitUntil(showNotification(‘midday’));
if (e.tag === ‘serena-night’) e.waitUntil(showNotification(‘night’));
});

// Message from client to trigger notification
self.addEventListener(‘message’, e => {
if (e.data && e.data.type === ‘SCHEDULE_NOTIFICATION’) {
const { slot } = e.data;
showNotification(slot);
}
if (e.data && e.data.type === ‘TEST_NOTIFICATION’) {
showNotification(‘morning’);
}
});

async function showNotification(slot) {
const msg = slot === ‘morning’ ? getRandom(MORNING_MSGS)
: slot === ‘midday’ ? getRandom(MIDDAY_MSGS)
: getRandom(NIGHT_MSGS);

return self.registration.showNotification(msg.title, {
body: msg.body,
icon: ‘./icon-192.png’,
badge: ‘./icon-192.png’,
tag: ‘serena-’ + slot,
renotify: true,
vibrate: [200, 100, 200],
data: { url: ‘./’ },
actions: [
{ action: ‘open’, title: ‘💬 Abrir Serena’ },
{ action: ‘dismiss’, title: ‘Ahora no’ }
]
});
}

self.addEventListener(‘notificationclick’, e => {
e.notification.close();
if (e.action === ‘dismiss’) return;
e.waitUntil(
clients.matchAll({ type: ‘window’ }).then(list => {
for (const c of list) {
if (c.url.includes(‘serena’) && ‘focus’ in c) return c.focus();
}
return clients.openWindow(’./’);
})
);
});
