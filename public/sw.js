// Service worker minimo: richiesto da Chrome/Android per il prompt di installazione PWA.
// Strategia network-first sulle navigazioni, con fallback alla shell in cache se offline.
const CACHE = 'pushgo-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('/', copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match('/'))
  );
});
