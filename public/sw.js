
// Minimal non-intrusive service worker to prevent over-caching of build chunks
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let the browser handle standard requests to avoid stale build manifest issues
  return;
});
