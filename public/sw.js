/* =============================================================================
   CantoBuddy Service Worker
   Caches the app shell so the app opens offline, and keeps API responses
   network-first so vocabulary stays fresh but still works without a connection.
   ============================================================================= */

// Bump this whenever index.html / app.js / i18n.js / styles.css / the icons
// change. The app shell is cached cache-first, so without a version bump
// installed PWAs would keep serving the previous build from cache.
//
// v145 — 2026-11-07. This release EDITS index.html, styles.css and tools.html
// (the pinned Daily Tools banner, the second iOS date-input fix, Learn English
// moved last, and data-nav-id on every More-sheet icon and bottom tab) AND ADDS
// /nav-order.js, the client that applies the operator's navigation order. All
// of those are served cache-first, so without a version bump an installed PWA
// would keep the old header and the old six-tab bar forever — including on
// /tools, where the bar is the only way back into the app.
// v144 was the previous local bump for the banner/date work; it was never
// deployed. v143 was the last live cache. Bump again on every later edit to
// any APP_SHELL file.
//
// v146 — 2026-11-07. The Discover menu lost its Outings tab (Culture / News /
// Living) and the admin Banners page gained the two fixed slides, so index.html,
// admin.html and admin.js changed. /admin is network-first and NOT in APP_SHELL,
// so only the index.html edit forced the bump.
//
// v147 — this release (2026-11-07). The Discover menu is restored to FIVE tabs
// in operator order — Culture, Outings, Living, News, Stories — AND the order /
// visibility of those tabs is now admin-controlled (new /api/discover-channels +
// the admin Discover tab). That touches index.html (the tab row), app.js
// (applyDiscoverOrder + renderHomeDiscoverPromo), styles.css (the hide rule) and
// admin.html / admin.js (the admin tab). All four app-shell files changed, so the
// bump is required; /admin stays network-first and needs none of its own.
//
// v148/v149 — 2026-11-07. Sunday Tournament: the home card + per-game banners
// (app.js, index.html, games-common.js and three game index.html pages all
// changed), plus the db/server endpoints for the weekend leaderboard.
//
// v150 — 2026-11-08. Daily Word Challenge: a new home card in app.js and a new
// #daily-challenge section in index.html. Both are cache-first APP_SHELL files,
// so the bump is required. The per-device API is no-store and network-first, so
// it needs no cache entry of its own.
//
// v151 — this release (2026-11-09). Trust signals and the long-form shelf:
// index.html (explicit grouped footer links) and styles.css (footer rules) both
// changed, so the cache-first APP_SHELL must be bumped. /articles is a NEW
// server-rendered document added to SEO_NETWORK_FIRST below; without that, a
// returning visitor would be served the app shell instead of the article index.
//
// v153 — this release (2026-11-10). Community Forums (Phase A): index.html gained a
// new #view-forums section, app.js renders the forum SPA, and styles.css gained the
// .forum-* rules, so the cache-first APP_SHELL must be bumped. /forums is a NEW
// server-rendered document (crawlable topic/thread listing) added to SEO_NETWORK_FIRST
// so a returning visitor sees the live forums page, not a stale cached shell.
// v152 — "Today in Hong Kong": index.html gained a new #today-in-hk home card and
// app.js renders it, so the cache-first APP_SHELL must be bumped. /today is a NEW
// server-rendered document (live HKO + 1823 data) added to SEO_NETWORK_FIRST.
// v153 — Community Forums (Phase 0 + Phase A): /forums SSR page, bottom-nav and
// footer link, pre-moderation plus the shared reports/moderation_blocks tables.
// v154 — footer de-duplication (2026-11-09): removed the five repeated policy
// links (Privacy / Terms / About / Contact / Disclaimer) from the "Browse Cantonese
// vocabulary" group; they now live only in "CantoBuddy information & policies".
// App-shell bump so installed copies stop showing the duplicated footer.
// v155 — Sunday Showdown visibility gate (2026-11-10): renderSundayShowdown() in
// app.js now hides the home card on every HKT day except Sunday (live) and Monday
// (results). app.js is an APP_SHELL file, so the cache-first shell must be bumped.
// v156 — /en Phase 1 elder companion (2026-11-10). en.html / en-app.js /
// en-i18n.js are NOT APP_SHELL files — EN_TRACK serves them network-first — so
// the deploy guard does not require this bump. We still take it: the network-
// first branch keeps an offline fallback in this same cache, and every installed
// PWA that already visited /en has one. Without a new cache name an offline
// elder could open the OLD help screen with the OLD (or missing) hotlines, which
// is the one stale asset that must never survive a release.
// v157 — /en elder accessibility + dead official links (2026-11-10):
//   * app.js (APP_SHELL) now falls back to the LIVE HKO current-weather page and
//     the LIVE 1823 iCal page. Both previous fallbacks returned 404, so an
//     installed PWA with the old cache would keep sending elders to a dead link.
//   * /en weather is shown in the Observatory's own 繁/簡 wording, tap-to-speak
//     never falls back to a Mandarin voice, and official links are language-
//     matched. Those are network-first EN_TRACK assets, but an offline elder
//     still has a cached copy in this cache — so the bump is mandatory here.
// v158 — /en official-link deep links (2026-11-11): the 公眾假期 card now opens
// a concrete YEAR GovHK holiday table (not the multi-year index) and the 社會
// 福利署 card opens 安老服務 (not the department homepage). Both URLs live in
// the /api/en/elder/* payloads, which are network-first but keep a cached
// offline fallback HERE. Without a new cache name an offline elder would keep
// the previous release's link set on the help screen.
// v159 — /en elder home (2026-11-11): (1) the holiday year is pinned to the
// verified 2027 GovHK calendar the elder asked for, not the current HKT year;
// (2) a new 玩吓遊戲 games section sits ABOVE 揀一類嚟學詞, so en.html,
// en-app.js and en-i18n.js all change. Those are network-first EN_TRACK assets
// with an offline fallback in this cache, and the /api/en/elder/* payloads are
// cached here too — without a new cache name an installed PWA would keep the
// OLD 2026 holiday link and the OLD home screen with no games at all.
// v160 — /en home now has four rotating elder banners (遊戲 / 生活小常識 /
// 姐姐心聲 / 搵幫手) that deep-link into the games section, the Today tabs and
// the Help view. en.html, en-app.js and en-i18n.js change again, and the new
// banner copy is part of the offline EN_TRACK fallback, so the cache name must
// move on or an installed PWA would keep the static pre-banner home screen.
// v161 — the four banners no longer jump to separate views; they all stay on the
// single /en home page and scroll to their own section (games / tips / helper
// voice / help), and the SOS button moved to the BOTTOM of the home page. en.html,
// en-app.js and en-i18n.js change again, so the cache name moves once more.
// v162 — 2026-11-13/14: the /en elder track gained the daily Good Morning card,
// the family one-tap setup guide, the gentle streak calendar and a 3s carousel.
// That release did NOT bump CACHE, which was a mistake: EN_TRACK is network-first
// BUT keeps its offline fallback in this very cache, so an installed PWA that
// missed the network could still be served the pre-card /en document.
// v163 — 2026-11-14: Home now shows the FULL Good Morning card (listen + send)
// instead of a teaser that only linked to Today. en.html and en-app.js change,
// so bump again: every returning / installed elder gets the new Home, and any
// stale offline /en copy held under v162 is dropped on activate.
// v164 — 2026-11-15: the /en home hero MERGES into the four promo slides into one
// left-to-right sliding deck that mirrors the Cantonese homepage, AND the four
// /en promos become admin-configurable (enable / order / speed) via
// /api/admin/en-banners. en.html, en-app.js, admin.html and admin.js all change,
// so bump again: an installed elder PWA must drop the old cross-fade hero and pick
// up the new transform-based deck plus the operator-set banner order/speed.
// v166 — 2026-11-15: the /en home banners ALL gain real photographs (hero + four
// promos, mirroring the Cantonese homepage) and a new "長者故事" (Elder Voices)
// section plus an in-app article reader is added for the four Chinese-only comfort
// articles (channel 'elders'). en.html and en-app.js change again, so bump: an
// installed elder PWA must drop the old emoji-only deck and pick up the photo-backed
// banners and the new article reader.
const CACHE = 'cantobuddy-v166';

// Which paths are server-rendered SEO documents rather than app-shell assets.
// Kept as one matcher so it can be asserted against `LANG_PREFIX` in seo.js —
// see the comment at its use site for what drifted when this was a `||` chain.
// `articles` is the English-only long-form shelf index. It is a server-rendered
// document (like /living), not an app route, so it must never fall through to
// the cache-first app shell — a returning visitor would see the SPA instead of
// the article list, which is exactly the blank-screen shape an AdSense review
// rejects. The publisher pages are in the same matcher for the same reason: a
// privacy policy or contact page must never be served from a stale cache, and
// /articles joins them because a withdrawn or corrected article index has to
// reach a returning reader on its next visit, not after the next cache bump.
const SEO_NETWORK_FIRST = /^\/(learn|words|level|guide|discover|forums|articles|today|stories|privacy|about|contact|terms|disclaimer|for-employers|places|living|fil|zh|id)(\/|$)/;

/* /places is BOTH a server-rendered document family AND the folder that holds
   the 34 outing photographs and credits.js. A .jpg there is an asset, not a
   page: the network-first branch below deliberately does not cache, so letting
   a photo fall into it would quietly break offline outings after this deploy.
   Extensionless paths are documents; paths with a file extension stay on the
   app-shell cache-first branch. */
const PLACE_ASSET = /^\/places\/[^/]+\.[a-z0-9]+$/i;

/* The English track: /en and the three files it is built from.
   Same reasoning as the SEO families above, and the same failure it caused.
   /en is not in APP_SHELL, so it used to fall through to the cache-first branch
   and get cached on first visit. That is fine until en.html or en-app.js
   changes — which the deploy guard does not watch, because they are not shell
   files — and then every returning visitor keeps the old page. It matters here
   in a way it does not for a static shell: /en now carries the page-view
   beacon, so a pinned old copy means those visitors are never counted and the
   operator's traffic report under-reports for exactly the people who come back.
   Network first, cache as the offline fallback. */
/* /en-manifest.json is the dedicated manifest for the elder English track (id
   "/en", start_url "/en") so an Android "Add to Home Screen" from /en opens this
   track, not the Cantonese app. It is network-first here for the same offline-
   fallback reason as en.html/en-app.js, and stays inside this same CACHE bucket. */
const EN_TRACK = /^\/en(\.html|\/|$)|^\/en-[a-z0-9-]+\.(js|css)$|^\/en-manifest\.json$/i;

const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/i18n.js',
  // Daily Tools. Pre-cached on purpose: these four utilities are local-only
  // (recipe lookup, holiday/leave calendar, contract countdown, emergency
  // numbers) and keep all their data in localStorage, so a helper with no
  // data allowance must still be able to open them. They are also in the
  // cache-first branch below, which is why an edit REQUIRES a CACHE bump —
  // otherwise an installed PWA pins the old emergency numbers forever, and
  // a stale hotline is worse than no hotline. Network-first was rejected for
  // the same reason /games was: it would break offline entirely.
  '/tools',
  '/tools.css',
  '/tools.js',
  // W1.1 — the ONE funnel client. Both index.html and every server-rendered
  // page load this, and app.js calls it during boot. A stale copy here would
  // leave returning visitors on the OLD event names while the server has the
  // new allow-list — a silent hole in the baseline. Bump CACHE with it.
  '/funnel-client.js',
  // Operator-controlled navigation order. Loaded by index.html AND tools.html;
  // a stale copy would pin the old tab/header order on one page but not the
  // other, so the two would disagree until the PWA was reinstalled. Cache-first
  // like the rest of the shell: /api/navigation is already network-first with an
  // offline fallback, so the CONFIG stays fresh independently of this file.
  '/nav-order.js',
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
  if ((SEO_NETWORK_FIRST.test(url.pathname) && !PLACE_ASSET.test(url.pathname)) ||
      EN_TRACK.test(url.pathname) ||
      url.pathname === '/sitemap.xml' || url.pathname === '/robots.txt') {
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
