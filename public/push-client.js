/* =============================================================================
   CantoBuddy — Push opt-in client
   Self-contained: works on both the SPA (index.html, which also loads app.js)
   and the server-rendered SEO landing pages (seo.js), which have no app.js.
   Loaded with `defer`, so the DOM is ready when it runs.

   What it does
   ------------
   1. Registers /sw.js (idempotent — the SPA may have done it already).
   2. Asks /api/push/config whether push is enabled server-side and for the
      VAPID public key.
   3. If there is no subscription yet and the user has not dismissed the invite,
      shows a small opt-in banner. Accepting it asks for permission, subscribes,
      and POSTs the subscription to /api/push/subscribe.
   4. If a subscription already exists, it silently "pings" /api/push/ping so the
      reminder job knows the device is still alive, and offers a "turn off" link.
   5. No library, no build step. Pure browser APIs.
   ============================================================================= */
(function () {
  'use strict';

  var DISMISS_KEY = 'cb_push_dismissed';
  var VAPID_KEY = 'cb_push_vapid'; // which VAPID public key this device subscribed with
  var DISMISS_DAYS = 30;

  // Inline i18n so SEO pages (no app.js) can localise the banner. Language is
  // read from <html lang> ("en" | "fil" | "zh" | "id").
  var T = {
    en: {
      title: 'Get gentle reminders',
      body: 'Turn on notifications and we will remind you to practise a little each day, and tell you when a new story arrives. No spam — off any time.',
      allow: 'Turn on',
      later: 'Not now',
      on: '🔔 Notifications are on',
      turnoff: 'Turn off',
      thanks: 'Thanks — we will keep you posted!',
      deniedTitle: 'Notifications are blocked',
      deniedBody: 'Your browser is blocking notifications. Turn them on in your browser site settings if you want reminders.',
      error: 'We could not turn on notifications just now. Please try again later.'
    },
    fil: {
      title: 'Makakuha ng banayad na paalala',
      body: 'I-on ang mga notification at paalalahanan ka naming mag-practice araw-araw, at sasabihin namin kung may bagong kwento. Walang spam — pwedeng off anumang oras.',
      allow: 'I-on',
      later: 'Sa ibang pagkakataon',
      on: '🔔 Naka-on ang mga notification',
      turnoff: 'I-off',
      thanks: 'Salamat — susubaybayan ka namin!',
      deniedTitle: 'Hinaharang ang mga notification',
      deniedBody: 'Hinaharang ng iyong browser ang mga notification. I-on ito sa settings ng site ng browser kung gusto mo ng paalala.',
      error: 'Hindi namin na-turn on ang mga notification ngayon. Subukan muli sa ibang pagkakataon.'
    },
    zh: {
      title: '开启温和的提醒',
      body: '开启通知后，我们会每天提醒你稍作练习，并在新故事上线时通知你。绝不打扰——你可以随时关闭。',
      allow: '开启',
      later: '暂不需要',
      on: '🔔 通知已开启',
      turnoff: '关闭',
      thanks: '谢谢——我们会与你保持联系！',
      deniedTitle: '通知已被阻止',
      deniedBody: '你的浏览器阻止了通知。如果你想要提醒，请在浏览器的网站设置中开启。',
      error: '我们暂时无法开启通知。请稍后再试。'
    },
    id: {
      title: 'Dapatkan pengingat lembut',
      body: 'Aktifkan notifikasi dan kami akan mengingatkan Anda berlatih setiap hari, serta memberi tahu bila ada cerita baru. Tanpa spam — bisa dimatikan kapan saja.',
      allow: 'Aktifkan',
      later: 'Nanti saja',
      on: '🔔 Notifikasi aktif',
      turnoff: 'Matikan',
      thanks: 'Terima kasih — kami akan memberi kabar!',
      deniedTitle: 'Notifikasi diblokir',
      deniedBody: 'Peramban Anda memblokir notifikasi. Nyalakan di pengaturan situs peramban jika Anda ingin pengingat.',
      error: 'Kami tidak dapat mengaktifkan notifikasi sekarang. Coba lagi nanti.'
    }
  };

  function lang() {
    var l = (document.documentElement.getAttribute('lang') || 'en').toLowerCase().split('-')[0];
    return T[l] ? l : 'en';
  }
  function t(key) { return (T[lang()] || T.en)[key]; }

  function supported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function dismissExpired() {
    try {
      var raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return false;
      var ts = parseInt(raw, 10);
      if (isNaN(ts)) return false;
      return (Date.now() - ts) < DISMISS_DAYS * 86400000;
    } catch (e) { return false; }
  }
  function markDismissed() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
  }

  // ---- engagement gate ------------------------------------------------------
  // The invite used to fire 2.5s after load on a first visit, before she had
  // heard a single word. Two asks followed in sequence (this sheet, then the
  // browser's own permission dialog) with no value shown in between — and on
  // Android Chrome a block cannot be re-asked from the page, so asking too
  // early costs the channel permanently.
  //
  // It now waits for either a played word (app.js sets cb_engaged in
  // markEngaged() and dispatches cb:engaged) or a second visit, whichever
  // comes first. A learner who only browses still gets asked eventually.
  var ENGAGED_KEY = 'cb_engaged';
  var VISIT_KEY = 'cb_visits';

  function engaged() {
    try { return localStorage.getItem(ENGAGED_KEY) === '1'; } catch (e) { return false; }
  }
  function bumpVisits() {
    try {
      var n = (parseInt(localStorage.getItem(VISIT_KEY), 10) || 0) + 1;
      localStorage.setItem(VISIT_KEY, String(n));
      return n;
    } catch (e) { return 1; }
  }

  function whenEngaged(fn) {
    if (engaged() || bumpVisits() >= 2) { fn(); return; }
    var done = false;
    function fire() {
      if (done) return;
      done = true;
      fn();
    }
    // Same page load: app.js fires this the moment she plays a word.
    window.addEventListener('cb:engaged', fire, { once: true });
    // Another tab finishing the job while this one waits.
    window.addEventListener('storage', function (e) {
      if (e.key === ENGAGED_KEY) fire();
    }, { once: true });
  }

  function getRegistration() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.getRegistration('/')
      .then(function (reg) {
        if (reg) return reg;
        // The SPA registers it on load; on an SEO page we register here.
        return navigator.serviceWorker.register('/sw.js').catch(function () { return null; });
      })
      .catch(function () { return null; });
  }

  function getCurrentSub(reg) {
    if (!reg || !reg.pushManager) return Promise.resolve(null);
    return reg.pushManager.getSubscription().catch(function () { return null; });
  }

  function urlBase64ToUint8Array(str) {
    var padding = '='.repeat((4 - (str.length % 4)) % 4);
    var base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function postJSON(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true
    });
  }

  // SEO landing pages have no .bottom-nav; the SPA does. Used to scope the
  // subscription source and to lift the banner above the SPA's bottom nav.
  function isSpa() { return !!document.querySelector('.bottom-nav'); }
  function source() { return isSpa() ? 'spa' : 'seo'; }

  // The device identity the rest of the app already uses (DEVICE_KEY in
  // app.js). Sending it here is what lets the server tie a push endpoint to a
  // learner, so a reminder can carry her streak instead of a generic sentence.
  // SEO pages never create one — a null id is fine; the link is repaired by the
  // ping on her first load of the SPA.
  function deviceId() {
    try { return localStorage.getItem('cb_device') || null; } catch (e) { return null; }
  }

  // Everything the server needs to address a reminder to this device rather
  // than to "a user": who she is, and the language she is reading.
  function pushIdentity() {
    return { publicId: deviceId(), lang: lang() };
  }

  // ---- banner UI -----------------------------------------------------------
  function bannerEl() { return document.getElementById('cb-push-banner'); }
  function pillEl() { return document.getElementById('cb-push-pill'); }

  var INVITE_CSS = [
    'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:99999',
    'background:#fff', 'border-top:1px solid #e3e8ee',
    'box-shadow:0 -6px 24px rgba(29,39,51,.12)',
    'padding:14px 16px calc(14px + env(safe-area-inset-bottom))',
    'font:15px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif',
    'color:#1d2733', 'display:flex', 'gap:12px', 'align-items:center',
    'flex-wrap:wrap', 'box-sizing:border-box'
  ].join(';');

  function showInvite() {
    if (bannerEl() || dismissExpired()) return;
    if (Notification.permission === 'denied') return;

    var b = document.createElement('div');
    b.id = 'cb-push-banner';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', t('title'));
    b.style.cssText = INVITE_CSS + (isSpa() ? ';bottom:64px' : '');

    var text = document.createElement('div');
    text.style.cssText = 'flex:1 1 240px;min-width:220px';
    var h = document.createElement('div');
    h.textContent = t('title');
    h.style.cssText = 'font-weight:700;font-size:15px;margin-bottom:2px';
    var p = document.createElement('div');
    p.textContent = t('body');
    p.style.cssText = 'font-size:13px;color:#5b6b7c';
    text.appendChild(h); text.appendChild(p);

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex:none';

    var allow = document.createElement('button');
    allow.textContent = t('allow');
    allow.style.cssText = 'background:#e63946;color:#fff;border:0;border-radius:999px;' +
      'padding:9px 16px;font-weight:600;font-size:14px;cursor:pointer';
    allow.addEventListener('click', function () { onAllow(); });

    var later = document.createElement('button');
    later.textContent = t('later');
    later.style.cssText = 'background:#fff;color:#5b6b7c;border:1px solid #d7dee6;' +
      'border-radius:999px;padding:9px 14px;font-size:14px;cursor:pointer';
    later.addEventListener('click', function () { markDismissed(); removeBanner(); });

    actions.appendChild(allow);
    actions.appendChild(later);
    b.appendChild(text);
    b.appendChild(actions);
    document.body.appendChild(b);
  }

  function removeBanner() {
    var b = bannerEl();
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }

  function showToast(msg) {
    var el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);' +
      'background:#1d2733;color:#fff;padding:10px 18px;border-radius:999px;' +
      'font:14px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;' +
      'z-index:100000;box-shadow:0 6px 20px rgba(0,0,0,.2)';
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2600);
  }

  function onAllow() {
    if (!('Notification' in window)) { showDenied(); return; }
    var req = Notification.requestPermission();
    var done = function (perm) {
      if (perm === 'granted') {
        doSubscribe();
      } else {
        showDenied();
      }
    };
    if (req && typeof req.then === 'function') req.then(done);
    else done(Notification.permission);
  }

  function showDenied() {
    removeBanner();
    var existing = document.querySelector('#cb-push-banner');
    var b = document.createElement('div');
    b.id = 'cb-push-banner';
    b.style.cssText = INVITE_CSS + (isSpa() ? ';bottom:64px' : '');
    var text = document.createElement('div');
    text.style.cssText = 'flex:1 1 240px';
    var h = document.createElement('div'); h.textContent = t('deniedTitle');
    h.style.cssText = 'font-weight:700;font-size:14px';
    var p = document.createElement('div'); p.textContent = t('deniedBody');
    p.style.cssText = 'font-size:12.5px;color:#5b6b7c';
    text.appendChild(h); text.appendChild(p);
    var ok = document.createElement('button');
    ok.textContent = 'OK';
    ok.style.cssText = 'background:#fff;color:#5b6b7c;border:1px solid #d7dee6;' +
      'border-radius:999px;padding:8px 16px;font-size:14px;cursor:pointer;flex:none';
    ok.addEventListener('click', function () { removeBanner(); });
    b.appendChild(text); b.appendChild(ok);
    document.body.appendChild(b);
  }

  function doSubscribe() {
    getRegistration().then(function (reg) {
      if (!reg || !reg.pushManager) { showDenied(); return; }
      return fetch('/api/push/config').then(function (r) { return r.json(); }).then(function (cfg) {
        if (!cfg || !cfg.enabled || !cfg.publicKey) { removeBanner(); return; }
        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(cfg.publicKey)
        }).then(function (sub) {
          // PushSubscription.toJSON() returns endpoint + base64url keys directly.
          return postJSON('/api/push/subscribe', Object.assign({
            subscription: sub.toJSON(),
            source: source()
          }, pushIdentity()))
            .then(function () { return sub; });
        }).then(function (sub) {
          // Remember which VAPID key this subscription belongs to, so a later
          // key rotation can be detected and fixed on the next load.
          try { localStorage.setItem(VAPID_KEY, cfg.publicKey); } catch (e) {}
          removeBanner();
          showToast(t('thanks'));
          ping(sub.endpoint);
        }).catch(function () {
          removeBanner();
          showToast(t('error'));
        });
      });
    }).catch(function () { removeBanner(); showToast(t('error')); });
  }

  // ---- "on" pill (subscription exists) --------------------------------------
  var PILL_SEEN_KEY = 'cb_push_on_seen';
  function pillSeen() {
    try { return sessionStorage.getItem(PILL_SEEN_KEY) === '1'; } catch (e) { return false; }
  }
  function markPillSeen() {
    try { sessionStorage.setItem(PILL_SEEN_KEY, '1'); } catch (e) {}
  }

  function showPill() {
    if (pillEl() || pillSeen()) return;
    var p = document.createElement('div');
    p.id = 'cb-push-pill';
    p.style.cssText = 'position:fixed;right:12px;' + (isSpa() ? 'bottom:74px' : 'bottom:12px') +
      ';z-index:99998;background:#fff;border:1px solid #e3e8ee;border-radius:999px;' +
      'box-shadow:0 4px 16px rgba(29,39,51,.14);padding:6px 8px 6px 12px;display:flex;' +
      'align-items:center;gap:8px;font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;' +
      'color:#1d2733;max-width:90vw';
    var label = document.createElement('span');
    label.textContent = t('on');
    var off = document.createElement('button');
    off.textContent = t('turnoff');
    off.style.cssText = 'background:#f4f7f9;color:#5b6b7c;border:0;border-radius:999px;' +
      'padding:5px 10px;font-size:12px;cursor:pointer';
    off.addEventListener('click', function () { unsubscribe(); });
    var close = document.createElement('button');
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Dismiss');
    close.style.cssText = 'background:transparent;border:0;color:#9aa7b4;cursor:pointer;font-size:13px;padding:2px 4px';
    close.addEventListener('click', function () { if (p.parentNode) p.parentNode.removeChild(p); markPillSeen(); });
    p.appendChild(label); p.appendChild(off); p.appendChild(close);
    document.body.appendChild(p);
    // Auto-hide after a while so it is not permanent chrome.
    setTimeout(function () { if (p.parentNode) { p.parentNode.removeChild(p); markPillSeen(); } }, 12000);
  }

  function unsubscribe() {
    getRegistration().then(function (reg) {
      if (!reg || !reg.pushManager) return;
      reg.pushManager.getSubscription().then(function (sub) {
        if (!sub) { removePill(); return; }
        var endpoint = sub.endpoint;
        postJSON('/api/push/unsubscribe', { endpoint: endpoint }).catch(function () {});
        sub.unsubscribe().then(function () { removePill(); showToast('🔕'); }).catch(function () { removePill(); });
      });
    });
  }
  function removePill() {
    var p = pillEl();
    if (p && p.parentNode) p.parentNode.removeChild(p);
  }

  // ---- ping (keep last_active_at fresh) -------------------------------------
  // Also carries the device id and language, so a subscription that predates
  // the reminder ladder gets linked to its learner on the next page load.
  function ping(endpoint) {
    if (!endpoint) return;
    postJSON('/api/push/ping', Object.assign({ endpoint: endpoint }, pushIdentity()))
      .catch(function () {});
  }

  // ---- boot -----------------------------------------------------------------
  function boot() {
    if (!supported()) return;
    fetch('/api/push/config')
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        if (!cfg || !cfg.enabled || !cfg.publicKey) return;
        return getRegistration().then(function (reg) {
          return getCurrentSub(reg).then(function (sub) {
            if (sub) {
              // If the server's VAPID key changed since this device subscribed,
              // the old subscription will be rejected (403) on every send. Drop
              // it and re-subscribe with the current key.
              var stored = null;
              try { stored = localStorage.getItem(VAPID_KEY); } catch (e) {}
              if (stored && stored !== cfg.publicKey) {
                try { localStorage.setItem(VAPID_KEY, cfg.publicKey); } catch (e) {}
                return sub.unsubscribe().then(function () {
                  if (Notification.permission === 'granted') doSubscribe();
                  else showInvite();
                });
              }
              // Already subscribed: refresh active timestamp and offer "turn off".
              ping(sub.endpoint);
              showPill();
              return;
            }
            // Not subscribed: maybe show the invite — but only once she has
            // actually used the app. See the engagement gate above.
            if (Notification.permission === 'default') {
              whenEngaged(function () {
                // Short beat so it does not land mid-transition.
                setTimeout(showInvite, 1200);
              });
            }
          });
        });
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
