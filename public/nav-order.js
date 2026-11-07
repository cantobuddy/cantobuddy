/* ============================================================================
   CantoBuddy — operator-controlled navigation order.

   Loaded by BOTH index.html (the learner SPA) and tools.html (the standalone
   Daily Tools page). Deliberately a small classic script with NO dependencies:
   /tools must keep working when app.js cannot boot, and this file must not
   change that. It builds nothing — it only reorders and hides the real
   elements already present in the markup.

   THE HTML IS THE FALLBACK. If this file 404s, JavaScript is off, the device is
   offline, or /api/navigation fails, the authored order in the HTML stands and
   every control still works. That is why the markup carries the correct default
   order (Learn English last, Home first, Tools last), and why the API is an
   override rather than the source of truth.

   HIDING uses a `data-nav-hidden` attribute with a `display:none !important`
   rule in styles.css, NOT the standard `hidden` attribute. app.js owns
   #install-btn's `hidden` flag (syncInstallEntry decides, per device, whether
   installing is even possible) and clears it on boot and on a language change.
   A separate attribute keeps the two decisions independent: an admin-hidden
   Install stays hidden, while a shown Install is still gated by the device.

   REORDERING moves the existing nodes with appendChild, so inline onclick
   handlers, data-i18n keys, aria state and listeners all travel with them.
   Nothing is cloned or rebuilt, so applyTranslations() in app.js can run before
   or after this script without either undoing the other.
   ========================================================================== */
(function () {
  'use strict';

  var GROUPS = [
    { selector: '#header-extra', key: 'more' },
    { selector: '.bottom-nav', key: 'bottom' },
  ];

  function applyGroup(host, rows, key) {
    // Only tagged children take part. Anything else in the container (a future
    // badge, a wrapper) is left exactly where it is.
    var byId = Object.create(null);
    var tagged = [];
    for (var i = 0; i < host.children.length; i++) {
      var el = host.children[i];
      var id = el.getAttribute('data-nav-id');
      if (!id) continue;
      byId[id] = el;
      tagged.push(el);
    }
    if (!tagged.length) return;

    var desired = [];        // ids, in the operator's order
    var visible = Object.create(null);
    // Home is pinned by db.js on the way out. Re-assert it here too: an old
    // config cached by the service worker must not be able to hide the one tab
    // that is the way back from everywhere.
    var pinned = key === 'bottom' ? 'home' : null;
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      if (!row || typeof row.id !== 'string') continue;
      desired.push(row.id);
      visible[row.id] = row.id === pinned ? true : row.enabled !== false;
    }
    if (pinned && byId[pinned]) {
      var at = desired.indexOf(pinned);
      if (at > 0) desired.splice(at, 1);
      if (at !== 0) desired.unshift(pinned);
    }

    // Desired node order: the configured ids first (filtered to nodes that
    // actually exist in THIS document), then any tagged node the response did
    // not mention. /tools has no More sheet at all, and a config saved before a
    // new tab shipped must not delete that tab.
    var ordered = [];
    for (var j = 0; j < desired.length; j++) {
      var node = byId[desired[j]];
      if (node && ordered.indexOf(node) === -1) ordered.push(node);
    }
    for (var k = 0; k < tagged.length; k++) {
      if (ordered.indexOf(tagged[k]) === -1) ordered.push(tagged[k]);
    }

    // Visibility. `visible[id]` is undefined for an id the server has never
    // heard of — leave that one shown rather than hiding a new control.
    for (var v = 0; v < tagged.length; v++) {
      if (visible[tagged[v].getAttribute('data-nav-id')] === false) {
        tagged[v].setAttribute('data-nav-hidden', '1');
      } else {
        tagged[v].removeAttribute('data-nav-hidden');
      }
    }

    // Only touch the DOM order when it actually differs. Re-appending every
    // child on each load would needlessly move the focused button and force a
    // reflow on a bar that is on screen from every view.
    var current = tagged.map(function (el) { return el.getAttribute('data-nav-id'); });
    var wanted = ordered.map(function (el) { return el.getAttribute('data-nav-id'); });
    if (current.join(',') !== wanted.join(',')) {
      for (var n = 0; n < ordered.length; n++) host.appendChild(ordered[n]);
    }
  }

  function apply(cfg) {
    if (!cfg || typeof cfg !== 'object') return;
    for (var g = 0; g < GROUPS.length; g++) {
      var group = GROUPS[g];
      if (!Array.isArray(cfg[group.key])) continue;   // one group may be absent
      var host = document.querySelector(group.selector);
      if (host) applyGroup(host, cfg[group.key], group.key);
    }
  }

  function boot() {
    if (!window.fetch) return;                        // keep the HTML fallback
    fetch('/api/navigation', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) { if (cfg) apply(cfg); })
      .catch(function () { /* offline — the authored order is already right */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
