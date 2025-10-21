const CACHE = 'pdfa-cache-v2';
self.addEventListener('install', e => {
  const base = self.registration.scope; // π.χ. https://username.github.io/repo/
  const ASSETS = [
    base,
    base + 'assets/gs.js',
    base + 'assets/gs.wasm',
    base + 'assets/sRGB.icc'
  ];
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE && caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.href.startsWith(self.registration.scope)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    })));
  }
});
