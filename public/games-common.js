/* Canto Buddy — shared games helper
 * Loaded by every game as /games-common.js (before the game's own scripts).
 *
 * Provides, on window.CB:
 *   CB.name     — ONE player name shared across ALL games. Auto-fills #nameInput
 *                 in every game and keeps the shared value in sync as you type.
 *   CB.scores   — per-player score history in localStorage.
 *   CB.gameId() — derives the current game id from the URL path (/games/<id>/...).
 *
 * Scoring model (per the product brief):
 *   The SCORE is the TIME it took to finish the game, in seconds.
 *   LOWER IS BETTER. The "highest score" is therefore the LEAST time.
 *   The history panel shows each player's BEST (fastest) time and their
 *   LAST 5 times.
 */
(function () {
  'use strict';
  var CB = window.CB || (window.CB = {});

  /* ---------------- shared player name ---------------- */
  var NAME_KEY = 'cb_player_name';
  CB.name = {
    KEY: NAME_KEY,
    get: function () {
      try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; }
    },
    set: function (v) {
      try { localStorage.setItem(NAME_KEY, String(v == null ? '' : v).trim().slice(0, 12)); } catch (e) {}
    },
    attach: function (input) {
      if (!input) return;
      var saved = this.get();
      if (saved && !input.value) {
        input.value = saved;                       // pre-fill from any other game
      } else if (input.value && input.value.trim()) {
        this.set(input.value.trim());              // propagate this game's name out
      }
      var self = this;
      var sync = function () { self.set(input.value); };
      input.addEventListener('input', sync);
      input.addEventListener('change', sync);
    }
  };

  /* ---------------- score history (time-based) ---------------- */
  var SCORE_KEY = 'cb_scores_v1';
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(SCORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveStore(s) {
    try { localStorage.setItem(SCORE_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function gameId() {
    var p = location.pathname.split('/');
    if (p[1] === 'games' && p[2]) return p[2];     // /games/bigtwo/ABCD -> "bigtwo"
    return 'game';
  }
  CB.gameId = gameId;

  // De-dupe guard for a single game end that the game re-renders several times.
  // Two REAL games can never finish within 60s of each other, so a repeat of the
  // exact same (game+name+time+outcome) inside that window is the same end.
  var lastKey = '', lastTs = 0;

  CB.scores = {
    KEY: SCORE_KEY,
    record: function (gid, name, seconds, meta) {
      name = String(name == null ? '' : name).trim();
      if (!name) return;                            // cannot attribute without a name
      seconds = Number(seconds);
      if (!isFinite(seconds) || seconds <= 0) return; // no valid finish time -> skip
      var key = gid + '|' + name + '|' + Math.round(seconds) + '|' +
        (meta && meta.won ? 1 : 0) + '|' + (meta && meta.tie ? 1 : 0);
      var now = Date.now();
      if (key === lastKey && (now - lastTs) < 60000) return;
      lastKey = key; lastTs = now;

      var store = loadStore();
      store[gid] = store[gid] || {};
      var list = store[gid][name] = store[gid][name] || [];
      list.push({ score: seconds, ts: now, meta: meta || {} });
      if (list.length > 50) store[gid][name] = list.slice(-50);
      saveStore(store);
      this.refresh(gid, name);
    },
    summary: function (gid, name) {
      name = String(name == null ? '' : name).trim();
      if (!name) return { best: null, latest: [], played: 0 };
      var list = (loadStore()[gid] || {})[name] || [];
      // LOWER is better: the best time is the MINIMUM.
      var best = null;
      list.forEach(function (e) { if (best === null || e.score < best) best = e.score; });
      return { best: best, latest: list.slice(-5).reverse(), played: list.length };
    },
    refresh: function (gid, name) {
      var el = document.getElementById('cbScoreHistory');
      if (el) this.renderInto(el, gid, name);
    },
    renderInto: function (el, gid, name) {
      if (!el) return;
      name = String(name == null ? '' : name).trim();
      if (!name) { el.innerHTML = ''; el.classList.add('hidden'); return; }
      var s = this.summary(gid, name);
      if (!s.played) {
        el.innerHTML = '<div class="cb-sh-title">' + esc(name) + "'s history</div>" +
          '<div class="cb-sh-empty">No games yet — play one!</div>';
        el.classList.remove('hidden');
        return;
      }
      // LOWER is better, so "Best" = the FASTEST (least) time.
      var html = '<div class="cb-sh-title">' + esc(name) + "'s history</div>";
      html += row('Best time', '<b>' + fmtTime(s.best) + '</b> <span class="cb-sh-note">(lower is better)</span>');
      html += '<div class="cb-sh-row"><span class="cb-sh-k">Last 5</span>' +
        '<span class="cb-sh-v cb-sh-nums">' +
        s.latest.map(function (e) { return '<i class="cb-num">' + fmtTime(e.score) + '</i>'; }).join('') +
        '</span></div>';
      el.innerHTML = html;
      el.classList.remove('hidden');
    }
  };
  function row(k, v) {
    return '<div class="cb-sh-row"><span class="cb-sh-k">' + k + '</span><span class="cb-sh-v">' + v + '</span></div>';
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  // seconds -> "M:SS"
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  /* ---------------- auto-run once the DOM is ready ---------------- */
  function init() {
    var gid = gameId();
    var input = document.getElementById('nameInput');
    if (input) CB.name.attach(input);
    CB.scores.refresh(gid, CB.name.get());
    if (input) {
      var re = function () { CB.scores.refresh(gid, CB.name.get()); };
      input.addEventListener('input', re);
      input.addEventListener('change', re);
    }
    // Catch any name the game's own boot code fills in just after parse.
    setTimeout(function () { CB.scores.refresh(gid, CB.name.get()); }, 0);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  /* ---------------- styles ---------------- */
  if (!document.getElementById('cbScoreStyle')) {
    var st = document.createElement('style');
    st.id = 'cbScoreStyle';
    st.textContent =
      '.cb-score-history{margin:10px 0 14px;padding:12px 14px;border:1px solid #e3e8ef;border-radius:14px;' +
      'background:#fff;font-size:13px;line-height:1.5;box-shadow:0 1px 2px rgba(18,33,47,.04)}' +
      '.cb-score-history.hidden{display:none}' +
      '.cb-sh-title{font-weight:700;font-size:13px;margin-bottom:6px;color:#12212f}' +
      '.cb-sh-row{display:flex;align-items:center;gap:8px;margin:3px 0}' +
      '.cb-sh-k{color:#6b7785;min-width:48px}' +
      '.cb-sh-v{font-weight:600;color:#12212f}' +
      '.cb-sh-empty{color:#6b7785;font-style:italic}' +
      '.cb-sh-note{color:#6b7785;font-weight:400;font-size:11px}' +
      '.cb-sh-nums{display:flex;gap:6px;flex-wrap:wrap}' +
      '.cb-num{font-style:normal;min-width:34px;padding:2px 6px;border-radius:7px;' +
      'background:#eef3f8;color:#1f3a5f;text-align:center;font-weight:700}';
    (document.head || document.documentElement).appendChild(st);
  }
})();
