/* =============================================================================
   CantoBuddy Service Worker
   Caches the app shell so the app opens offline, and keeps API responses
   network-first so vocabulary stays fresh but still works without a connection.
   ============================================================================= */

const CACHE = 'cantobuddy-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/i18n.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ---- Install: pre-cache the app shell ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ---- Activate: drop old caches ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ---- Fetch strategy ----
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle our own origin; let fonts and other CDNs hit the network
  if (url.origin !== self.location.origin) return;

  // Admin pages must always be fresh (they are used to edit content)
  if (url.pathname.startsWith('/admin')) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // API: network first, fall back to the last cached response when offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // App shell: cache first, then network, falling back to index.html
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => caches.match('/index.html'))
    )
  );
});
