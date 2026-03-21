// public/sw.js
const CACHE_NAME = 'sheetsync-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch strategy to prevent 404 chunk errors
  // Modern Next.js handles its own chunk mapping; over-caching in SW causes mismatches
  event.respondWith(fetch(event.request));
});
