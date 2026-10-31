/* =============================================================================
   CantoBuddy Service Worker
   Caches the app shell so the app opens offline, and keeps API responses
   network-first so vocabulary stays fresh but still works without a connection.
   ============================================================================= */

// Bump this whenever index.html / app.js / i18n.js / styles.css / the icons
// change. The app shell is cached cache-first, so without a version bump
// installed PWAs would keep serving the previous build from cache.
const CACHE = 'cantobuddy-v119';

// Which paths are server-rendered SEO documents rather than app-shell assets.
// Kept as one matcher so it can be asserted against `LANG_PREFIX` in seo.js —
// see the comment at its use site for what drifted when this was a `||` chain.
const SEO_NETWORK_FIRST = /^\/(learn|words|level|guide|discover|stories|privacy|for-employers|fil|zh|id)(\/|$)/;

const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/i18n.js',
  // Outings: the place data and the photograph credits. Both are local and
  // small, and a place page that cannot credit its photographer offline is a
  // licence problem, not a cosmetic one.
  '/places.js',
  '/places/credits.js',
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
      // An OLD service worker — one from before /portal and /admin were made
      // network-first — ran those pages through the app-shell branch below and
      // CACHED them, under this same cache name. Deleting the old cache *names*
      // is not enough on its own, so purge any stray copy explicitly.
      //
      // This is not hypothetical: a deleted operator notice came back on the
      // operator's own phone minutes after the deploy (2026-10-17), served from
      // a cached portal.html. These pages show live account data and must never
      // be served from cache, so removing them here is correctness, not tidiness.
      .then(() => purgeOperatorPages())
      .then(() => self.clients.claim())
  );
});

/**
 * Delete every cached response for the operator pages from the live cache.
 *
 * The prefixes are deliberately broad — nothing else on this origin starts with
 * them, and a near-miss leaves the stale page in place, which is the bug.
 */
function purgeOperatorPages() {
  return caches.open(CACHE).then((cache) =>
    cache.keys().then((reqs) => {
      const stale = reqs.filter((r) => {
        const p = new URL(r.url).pathname;
        return p.startsWith('/portal') || p.startsWith('/admin') || p.startsWith('/reset');
      });
      return Promise.all(stale.map((r) => cache.delete(r)));
    })
  );
}

// ---- Fetch strategy ----
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle our own origin; let fonts and other CDNs hit the network
  if (url.origin !== self.location.origin) return;

  // Admin and employer-portal pages must always be fresh — they show live
  // account and progress data, never a cached shell.
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/portal')) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // The games. A game is its own page with its own live state, and its client is
  // redeployed with the app — so a cached copy is not a fast copy, it is a dead
  // connection to a table that no longer exists. Network only, never cached, and
  // deliberately NOT in APP_SHELL (pre-caching it would ship the old game to
  // every learner on the next deploy).
  if (url.pathname.startsWith('/games/')) {
    event.respondWith(fetch(req));
    return;
  }

  // Server-rendered SEO content pages (see seo.js). These are real documents
  // built from live vocabulary, not app-shell assets, so they take the same
  // network-first path as the admin and portal pages. Cache-first would pin
  // whatever a learner happened to visit first and keep serving it after the
  // operator edited the word.
  //
  // THE ROUTE LIST HERE MUST COVER EVERY FAMILY IN `ROUTE_FAMILIES` (seo.js).
  // This was a hand-written `||` chain and it drifted exactly the way hand-
  // written lists do: `/fil` was added when the Filipino tree shipped, and
  // `/zh` and `/id` were not added when theirs did — so the Chinese and
  // Indonesian trees, and every `/guide/...` page including the pillar, fell
  // through to the cache-first branch below. An edited word kept serving the
  // old copy to anyone who already had the service worker, and because a
  // content-only deploy does not change an app-shell file, nothing bumped the
  // cache to clear it.
  //
  // `stories` was added the same way it would have been missed: the route
  // shipped in seo.js and this line was read, not run. It matters more here
  // than for a word page, because a story can be TAKEN DOWN — cache-first would
  // keep serving a withdrawn story to anyone who had already opened it.
  //
  // `tools/seo-pillar-test.js` now derives the required families from
  // `ROUTE_FAMILIES` and asserts this matcher covers them all, so a new
  // family cannot ship without this line.
  if (SEO_NETWORK_FIRST.test(url.pathname) || url.pathname === '/sitemap.xml' || url.pathname === '/robots.txt') {
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

// ---- Push: show the notification the server sent ----
// The server sends an RFC 8291 /aes128gcm payload (see push.js). The browser
// decrypts it automatically before calling us; `event.data` is already the
// plaintext JSON we posted. Always guard for a null payload so a malformed or
// empty push does not throw and kill the event.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    // Not JSON — fall back to treating it as a plain-text body.
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'CantoBuddy';
  const options = {
    body: payload.body || '',
    tag: payload.tag || undefined,
    // `data.url` is where the learner lands when they tap. Defaults to the
    // learner home so a tap always opens something real.
    data: { url: payload.url || '/' },
    // A small badge helps on Android lock screens; the icon is the PWA icon.
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // Group related notifications (e.g. practice reminders) under one tag so a
    // learner is not spammed with ten stacked cards.
    renotify: payload.tag ? true : false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ---- Notification click: open or focus the destination ----
self.addEventListener('notificationclick', (event) => {
  event.preventDefault();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a tab to the right place is already open, just focus it.
        for (const client of clientList) {
          if ('focus' in client) {
            // Prefer an exact-URL match; otherwise reuse the first window.
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // No suitable window — open a new one.
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ---- Subscription expired server-side: let the app re-subscribe ----
// When a push service drops our subscription (e.g. Chrome rotates keys), the
// browser fires this. The service worker cannot re-subscribe on its own because
// the VAPID application-server key only lives in the app (fetched from
// /api/push/config). The app's push-client already re-subscribes on every load,
// so we just acknowledge the event. We keep a handler so the event does not
// surface as an unhandled rejection in the SW.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(Promise.resolve());
});
