/* Canto Buddy — shared game client core
 * Loaded by the four new games as /game-core.js, AFTER /game-sound.js.
 *
 * Provides one small, shared toolkit so each game does not copy the same
 * language detection, i18n lookup, API caller, toast, sound-button wiring and
 * device-id helper that UNO and Sudoku each hand-rolled. Everything hangs off
 * window.CBGame.
 *
 * It is intentionally dependency-free and standalone — a game page never loads
 * app.js, so nothing here may reach back into the SPA.
 */
window.CBGame = (function () {
  'use strict';

  var LANGS = ['en', 'fil', 'zh', 'id'];
  var LANG = (function () {
    var s = (localStorage.getItem('cb_lang') || '').toLowerCase();
    if (LANGS.indexOf(s) >= 0) return s;
    var n = (navigator.language || 'en').toLowerCase();
    if (n.indexOf('zh') === 0) return 'zh';
    if (n.indexOf('id') === 0) return 'id';
    if (n.indexOf('tl') === 0 || n.indexOf('fil') === 0) return 'fil';
    return 'en';
  })();

  /** t(dict, key, vars) — look up a key in the caller's own STR, falling back to
   *  its en block, then to the key itself so a missing string is never blank. */
  function t(dict, key, vars) {
    var d = dict[LANG] || dict.en;
    var s = d[key];
    if (s === undefined) s = dict.en[key];
    if (s === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach(function (k) { s = ('' + s).split('{' + k + '}').join('' + vars[k]); });
    }
    return s;
  }

  /** BASE — the game's own API prefix (/games/<name>/), keeping the trailing
   *  slash even when the URL is a shared code like /games/bingo/ABCD. */
  function base() {
    var p = location.pathname;
    if (!p.endsWith('/')) {
      var seg = p.split('/').pop();
      p = /^[A-Z0-9]{4}$/.test(seg) ? p.slice(0, -seg.length) : p + '/';
    }
    return p;
  }

  var toastEl = null, toastTimer = null;
  function toast(msg, kind) {
    if (!toastEl) toastEl = document.getElementById('toast');
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.className = 'toast on' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'toast'; }, 2300);
  }

  /** api(path, body) — POST JSON to the game's own API. Throws the raw error
   *  code on failure so the caller can translate it. */
  async function api(path, body) {
    var res = await fetch(base() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    var data = {};
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok) throw new Error(data && data.error ? data.error : 'net');
    return data;
  }

  /** Wire the sound (🔊) and music (🎵) toggle buttons if present. */
  function wireSound() {
    var sb = document.getElementById('soundBtn');
    if (sb) {
      var paint = function () {
        var on = CBSound.isOn();
        sb.classList.toggle('off', !on);
        sb.textContent = on ? '🔊' : '🔇';
      };
      sb.onclick = function () { CBSound.toggle(); if (CBSound.isOn()) CBSound.click(); paint(); };
      paint();
    }
    var mb = document.getElementById('musicBtn');
    if (mb) {
      var paintM = function () {
        var on = CBSound.musicIsOn();
        mb.classList.toggle('is-on', !!on);
        mb.textContent = on ? '🎵' : '🎶';
      };
      mb.onclick = function () { CBSound.toggleMusic(); paintM(); };
      paintM();
    }
  }

  function deviceId() { return localStorage.getItem('cb_device') || ''; }

  function avatarFor(name) {
    var pool = ['🦊', '🐼', '🐯', '🐸', '🐧', '🦄', '🐙', '🐨', '🐰', '🦁', '🐳', '🐝'];
    var h = 0; for (var i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return pool[h % pool.length];
  }

  return {
    LANG: LANG, LANGS: LANGS, t: t, base: base, api: api, toast: toast,
    wireSound: wireSound, deviceId: deviceId, avatarFor: avatarFor,
    AVATARS: ['🦊', '🐼', '🐯', '🐸', '🐧', '🦄', '🐙', '🐨', '🐰', '🦁', '🐳', '🐝'],
  };
})();
