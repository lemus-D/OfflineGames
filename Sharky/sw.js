/* Sharky service worker — precache, versioned cache name. */
const CACHE = 'sharky-v2';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/main.js',
  './src/core/rng.js',
  './src/core/input.js',
  './src/core/save.js',
  './src/core/audio.js',
  './src/game/content.js',
  './src/game/creature.js',
  './src/game/world.js',
  './src/game/play.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        if (res.ok && req.url.startsWith(self.location.origin)) {
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
