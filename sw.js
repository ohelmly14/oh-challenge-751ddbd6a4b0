/* Network-first cache for offline Home Screen use.
   HTML and other files are always fetched from the network when it is
   available, so a new index.html shows up on the next visit.
   This worker never reads or writes localStorage. */
const CACHE = 'challenge-v1';
const PRECACHE = [
  './index.html',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './favicon.ico',
  './favicon-32.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(PRECACHE.map(url => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  const isDocument = req.mode === 'navigate'
    || (req.headers.get('accept') || '').includes('text/html');

  event.respondWith((async () => {
    try {
      // Revalidate HTML so a published index.html is never stuck behind this cache.
      // Navigation requests reject a RequestInit override, so rebuild those.
      const res = await fetch(isDocument
        ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin', redirect: 'follow' })
        : req);
      if (res && res.ok && !res.redirected) {
        const cache = await caches.open(CACHE);
        await cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const page = await caches.match('./index.html');
        if (page) return page;
      }
      throw err;
    }
  })());
});
