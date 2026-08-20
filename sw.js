const CACHE_NAME = 'qaime-v1';
const ASSETS = [
  '/qaime/',
  '/qaime/index.html',
  '/qaime/manifest.json'
];

// Quraşdırılma zamanı əsas faylları keşə yığır
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Aktivləşəndə köhnə keşləri təmizləyir
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Sorğuları idarə edir (404 xətasının qarşısını alan əsas hissə)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/qaime/index.html');
        }
      });
    })
  );
});