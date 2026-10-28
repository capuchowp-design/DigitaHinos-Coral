// DigitaHinos Coral – Service Worker
// O app inteiro é local (sem CDN): depois da primeira visita funciona 100% offline,
// inclusive os 480 hinos (baixados em segundo plano) e as vozes de coro.
// Mude a versão abaixo a CADA publicação nova para forçar a atualização do cache.
const CACHE_NAME = 'dhcoral-v1';

const PRECACHE_URLS = [
  './', './index.html', './style.css', './config.js', './pwa.js', './audio.js', './io.js', './import.js', './pdf.js',
  './demos.js', './app.js', './home.js', './manifest.json', './privacidade.html', './icon.svg', './hinos/index.json',
  './icon-72x72.png', './icon-96x96.png', './icon-128x128.png', './icon-144x144.png', './icon-152x152.png',
  './icon-192x192.png', './icon-384x384.png', './icon-512x512.png', './icon-maskable-192x192.png',
  './icon-maskable-512x512.png', './apple-touch-icon.png', './favicon-32x32.png',
  './coral-voices.bin' // amostras de coro (122 MP3 empacotados)
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// A página pede para baixar todos os hinos para uso offline (em lotes, sem travar nada).
self.addEventListener('message', (event) => {
  const d = event.data || {};
  if (d.type !== 'cache-hinos' || !Array.isArray(d.urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (let i = 0; i < d.urls.length; i += 12) {
      await Promise.all(d.urls.slice(i, i + 12).map(async (u) => {
        try { if (!(await cache.match(u))) await cache.add(u); } catch (e) { /* tenta de novo na próxima abertura */ }
      }));
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Hinos (arquivos que quase nunca mudam): cache primeiro, rede como reserva.
  if (/\/hinos\/[^/]+\.mxl$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((r) => {
        if (r && r.ok) { const c = r.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(request, c)); }
        return r;
      }))
    );
    return;
  }
  // Demais arquivos: rede primeiro (sempre a versão mais nova online), cache como reserva offline.
  event.respondWith(
    fetch(request)
      .then((r) => {
        if (r && r.ok) { const c = r.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(request, c)); }
        return r;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((cached) =>
        cached || (request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
