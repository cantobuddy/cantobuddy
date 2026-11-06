/* =============================================================================
   CantoBuddy — the ONE funnel client (W1.1)

   Loaded by BOTH surfaces:
     - the learner SPA (public/index.html)
     - every server-rendered page (seo.js `page()`)

   That is the whole point. Before this, the app had GA4 events and the static
   pages had a page-view beacon, with different names and no shared language or
   source tag. One file means one vocabulary, one dedupe rule and one identity
   across both halves of the site.

   PRIVACY: the device token never leaves this file except in the request body,
   and the server does not store it. Reports are counts by day, step, language
   and source. There is no per-person event history.

   COUNTING RULE: each step is recorded AT MOST ONCE PER DEVICE PER HONG KONG
   DAY, using a localStorage key shared by both surfaces (same origin). So a
   reader who lands on a search page and then opens the app is ONE landing, not
   two, and the funnel is a count of devices rather than a count of requests.
   `open_app_click` is the exception: each tap is counted, because it is a
   conversion numerator, not a funnel step.

   Everything is wrapped. No localStorage (private mode / in-app browser), no
   crypto, no sendBeacon, no gtag — the page still works. Counting must never
   cost a reader the page.
   ============================================================================= */
(function (global) {
  'use strict';

  var STEPS = [
    'landing_view',
    'first_word_view',
    'first_audio_play',
    'first_quiz_answer',
    'day1_return'
  ];
  var AUX = ['open_app_click'];
  var ALLOWED = STEPS.concat(AUX);

  var DEVICE_KEY = 'cb_device';
  var REF_KEY = 'cb_ref';
  var FIRST_DAY_KEY = 'cb_fx_first_day';
  var D1_SENT_KEY = 'cb_fx_d1_sent';
  var HKT_OFFSET_MS = 8 * 60 * 60 * 1000;

  global.CB_FUNNEL_STEPS = STEPS.slice();
  global.CB_FUNNEL_EVENTS = ALLOWED.slice();

  function get(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { global.localStorage.setItem(k, v); } catch (e) { /* no storage */ } }

  /** Hong Kong calendar date. The reports bucket by HK day, not UTC. */
  function hktDay(ms) {
    return new Date((ms === undefined ? Date.now() : ms) + HKT_OFFSET_MS)
      .toISOString().slice(0, 10);
  }

  function deviceId() {
    var id = get(DEVICE_KEY);
    if (id && /^[A-Za-z0-9_-]{8,64}$/.test(id)) return id;
    try {
      var b = new Uint8Array(18);
      global.crypto.getRandomValues(b);
      id = 'dev_' + Array.prototype.map.call(b, function (x) {
        return ('0' + x.toString(16)).slice(-2);
      }).join('');
      set(DEVICE_KEY, id);
    } catch (e) {
      // No crypto and no storage: send no token. The server will ignore the
      // event, which is better than inventing a guessable identity.
      return '';
    }
    return id;
  }

  /** UI language, in the same four codes the server stores. */
  function lang(opts) {
    if (opts && opts.lang) return opts.lang;
    try {
      if (typeof global.currentLang === 'function') {
        var l = String(global.currentLang() || '').toLowerCase();
        if (l) return l;
      }
    } catch (e) { /* SPA global absent on static pages */ }
    var saved = get('cb_lang');
    if (saved) return saved;
    var html = String(global.document && global.document.documentElement.lang || '').toLowerCase();
    if (html) return html;
    return 'en';
  }

  function source(opts) {
    if (opts && opts.source) return opts.source;
    var saved = get(REF_KEY);
    if (saved) return saved;
    try {
      var p = new URLSearchParams(global.location.search);
      return p.get('utm_source') || p.get('ref') || '';
    } catch (e) { return ''; }
  }

  function send(payload) {
    var body = JSON.stringify(payload);
    try {
      if (global.navigator && global.navigator.sendBeacon) {
        global.navigator.sendBeacon('/api/funnel',
          new Blob([body], { type: 'application/json' }));
        return;
      }
    } catch (e) { /* fall through to fetch */ }
    try {
      global.fetch('/api/funnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      });
    } catch (e) { /* no analytics, no problem */ }
  }

  /**
   * Record one event. Returns true when it was actually sent.
   * `opts.unique === false` disables the per-day dedupe (used for CTA clicks).
   */
  function funnel(event, opts) {
    if (ALLOWED.indexOf(event) === -1) return false;
    opts = opts || {};
    var day = hktDay();
    var key = 'cb_fx_' + event + '_' + day;
    if (opts.unique !== false) {
      if (get(key)) return false;
      set(key, '1');
    }
    var l = lang(opts);
    var s = source(opts);
    var pid = deviceId();
    if (!pid) return false;

    send({
      event: event,
      public_id: pid,
      lang: l,
      source: s,
      // Never stored. Used only by GA4 so a hub family can be compared.
      page: opts.page || (global.location && global.location.pathname) || ''
    });

    // GA4 event names are EXACTLY the funnel step names. The inline GA4 stub
    // defines gtag before this file runs, so a slow gtag/js loader only delays
    // delivery to the dataLayer — it does not lose the event.
    try {
      if (typeof global.gtag === 'function') {
        global.gtag('event', event, {
          funnel_lang: l,
          funnel_source: s,
          funnel_page: opts.page || (global.location && global.location.pathname) || ''
        });
      }
    } catch (e) { /* analytics must never break a tap */ }
    return true;
  }

  /** Landing + day-1 return, once per boot. Safe to call on every page. */
  function boot() {
    var day = hktDay();
    var first = get(FIRST_DAY_KEY);
    if (!first) { set(FIRST_DAY_KEY, day); first = day; }
    funnel('landing_view');

    // A day-1 return is specifically "came back the NEXT day". A device that
    // reappears after a week is a return, but not a day-1 return; recording it
    // as one would flatter the number. One marker makes it fire exactly once.
    if (first < day && !get(D1_SENT_KEY)) {
      var diff = (Date.parse(day + 'T00:00:00Z') - Date.parse(first + 'T00:00:00Z')) / 86400000;
      if (diff === 1) {
        funnel('day1_return');
        set(D1_SENT_KEY, day);
      }
    }
  }

  // Static pages need this before a deferred script has executed, and the SPA
  // may call cbFunnel during boot. Queue anything that arrived early.
  var q = global.__cbFunnelQ || [];
  global.__cbFunnelQ = [];
  for (var i = 0; i < q.length; i++) {
    try { funnel.apply(null, q[i]); } catch (e) { /* malformed queued call */ }
  }

  global.cbFunnel = funnel;
  global.cbFunnelBoot = boot;

  /**
   * "Open app" taps on the server-rendered pages. Delegated so it works for
   * every CTA without editing 159 page bodies. Counted per tap, not per device.
   */
  function onCtaClick(e) {
    var t = e && e.target;
    var a = t && t.closest ? t.closest('a[data-funnel-cta], a.cta') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    // Only links that actually lead INTO the app count as a conversion.
    if (!/^\/(?:[?#]|$)/.test(href) && href.indexOf('/en') !== 0) return;
    funnel('open_app_click', { unique: false, page: global.location.pathname });
  }

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', function () {
        // `a.cta` is also a class inside the SPA. Only the server-rendered
        // documents carry this marker, so an in-app button can never be
        // misread as an "opened the app from a search page" conversion.
        if (global.document.body && global.document.body.dataset.seoPage === '1') {
          global.document.addEventListener('click', onCtaClick, true);
        }
        boot();
      });
    } else {
      if (global.document.body && global.document.body.dataset.seoPage === '1') {
        global.document.addEventListener('click', onCtaClick, true);
      }
      boot();
    }
  }
})(window);
