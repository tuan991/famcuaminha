/* FCMA Service Worker — cache shell, offline-first for local assets */
const CACHE = 'FCMA-v0.1.1';
const ASSETS = ['./', './index.html', './app.js', './tools.js', './manifest.webmanifest', './donate-qr.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Only handle same-origin GET
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      // cache successful GET of same-origin
      if (resp.ok) { const clone = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, clone)); }
      return resp;
    }).catch(() => cached))
  );
});
