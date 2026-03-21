// SheetSync Service Worker
const CACHE_NAME = 'sheetsync-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Simple pass-through to satisfy PWA installability requirements
  // and prevent stale cache issues with code chunks.
  event.respondWith(fetch(event.request));
});