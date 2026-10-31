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
      meta = meta || {};
      // A level (e.g. sudoku easy/medium/hard/expert, checkers easy/normal) lets
      // the history break down "best / last 5" PER DIFFICULTY, not just overall.
      var lvl = meta.level != null ? String(meta.level) : '';
      var key = gid + '|' + name + '|' + Math.round(seconds) + '|' +
        (meta.won ? 1 : 0) + '|' + (meta.tie ? 1 : 0) + '|' + lvl;
      var now = Date.now();
      if (key === lastKey && (now - lastTs) < 60000) return;
      lastKey = key; lastTs = now;

      var store = loadStore();
      store[gid] = store[gid] || {};
      var list = store[gid][name] = store[gid][name] || [];
      // Capture level at the top level (not only inside meta) so the "by level"
      // view can group without re-parsing meta on every render.
      list.push({
        score: seconds, ts: now, meta: meta,
        level: lvl || null,
        levelLabel: meta.levelLabel != null ? String(meta.levelLabel) : null
      });
      if (list.length > 50) store[gid][name] = list.slice(-50);
      saveStore(store);
      this.refresh(gid, name);
    },
    summary: function (gid, name) {
      name = String(name == null ? '' : name).trim();
      if (!name) return { best: null, latest: [], played: 0, levels: [] };
      var list = (loadStore()[gid] || {})[name] || [];
      // LOWER is better: the best time is the MINIMUM.
      var best = null;
      list.forEach(function (e) { if (best === null || e.score < best) best = e.score; });
      // Group by level for the "by level" breakdown. Entries with no level
      // (group games that have no difficulty) stay in the overall numbers only.
      var groups = {};
      list.forEach(function (e) {
        if (!e.level) return;
        (groups[e.level] = groups[e.level] || []).push(e);
      });
    function top3(arr) {
      return arr.slice().sort(function (a, b) { return a.score - b.score; }).slice(0, 3);
    }
    var levels = Object.keys(groups).map(function (k) {
      var g = groups[k], b = null;
      g.forEach(function (e) { if (b === null || e.score < b) b = e.score; });
      return { key: k, label: (g[0] && g[0].levelLabel) || k, best: b, played: g.length, top: top3(g) };
    });
    return { best: best, latest: list.slice(-5).reverse(), played: list.length, levels: levels, top: top3(list) };
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
        el.innerHTML = '<div class="cb-sh-title">' + esc(name) + "'s best times</div>" +
          '<div class="cb-sh-empty">No games yet — play one!</div>';
        el.classList.remove('hidden');
        return;
      }
      // One compact table: Level · Best time · Top 3 fastest finishes.
      var rows = (s.levels && s.levels.length) ? s.levels : [{ label: 'All', best: s.best, top: s.top }];
      var html = '<div class="cb-sh-title">' + esc(name) + "'s best times</div>";
      html += '<table class="cb-sh-table"><thead><tr>' +
        '<th>Level</th><th>Best</th><th>Top 3</th></tr></thead><tbody>';
      rows.forEach(function (lv) {
        var top = (lv.top || []).slice(0, 3).map(function (e) {
          return '<i class="cb-num">' + fmtTime(e.score) + '</i>';
        }).join('');
        if (!top) top = '<span class="cb-sh-note">—</span>';
        html += '<tr><td>' + esc(lv.label) + '</td><td><b>' + fmtTime(lv.best) + '</b></td>' +
          '<td class="cb-sh-nums">' + top + '</td></tr>';
      });
      html += '</tbody></table>';
      el.innerHTML = html;
      el.classList.remove('hidden');
    }
  };
  function row(k, v) {
    return '<div class="cb-sh-row"><span class="cb-sh-k">' + k + '</span><span class="cb-sh-v">' + v + '</span></div>';
  }
  function last5(list) {
    if (!list || !list.length) return '';
    return '<div class="cb-sh-row"><span class="cb-sh-k">Last 5</span>' +
      '<span class="cb-sh-v cb-sh-nums">' +
      list.map(function (e) { return '<i class="cb-num">' + fmtTime(e.score) + '</i>'; }).join('') +
      '</span></div>';
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

  /* ---------------- topbar: Messages sheet + Back to lobby ----------------
   * The top-right of every game ends with the same two icon-only buttons:
   *   [data-cb="feed"]  — speech bubble, opens the Messages sheet
   *   [data-cb="leave"] — arrow-out, returns to the games lobby
   * They are wired here rather than copied into four page scripts, so the
   * behaviour and the four-language labels cannot drift apart. A game only has
   * to put the two <button>s in its markup and call CB.topbar.mount(labels).
   */
  var WA_GLYPH =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
    '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Z" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<path d="M8.6 7.6c.3-.1.6 0 .8.3l.8 1.3c.1.3.1.6-.1.8l-.5.5c-.2.2-.2.4-.1.6.5.9 1.3 1.7 2.2 2.2.2.1.4.1.6-.1l.5-.5c.2-.2.5-.3.8-.1l1.3.8c.3.2.4.5.3.8-.3 1-1.3 1.7-2.4 1.6-2.8-.3-5.2-2.7-5.5-5.5-.1-1.1.6-2.1 1.6-2.4Z" fill="currentColor"/>' +
    '</svg>';

  // Latest labels, kept at module scope so re-mounting after a language switch
  // re-renders the already-built sheet instead of freezing the old wording.
  var tb = { labels: {}, name: '', gid: gameId() };

  // Addressed by data attribute, not id: some games already own an element
  // called #leaveBtn (Bingo's in-room Leave), and a duplicate id would silently
  // steal that button's click handler.
  function tbBtn(role) {
    return document.querySelector('[data-cb="' + role + '"]');
  }

  function msgRender() {
    var L = tb.labels;
    var titleEl = document.getElementById('msgTitle');
    var body = document.getElementById('msgBody');
    if (!body) return;
    if (titleEl) titleEl.textContent = L.messages || 'Messages';
    body.innerHTML = '';

    if (L.lede) {
      var p = document.createElement('p');
      p.className = 'lede';
      p.textContent = L.lede;
      body.appendChild(p);
    }

    // The Level / Best / Top-3 table is the same one the menu screen shows —
    // reused here so a player can check their best times mid-game.
    var name = String(tb.name || '').trim();
    if (!name) {
      var em = document.createElement('p');
      em.className = 'muted';
      em.textContent = L.empty || 'No games yet — play one!';
      body.appendChild(em);
    } else {
      var box = document.createElement('div');
      box.className = 'cb-score-history';
      body.appendChild(box);
      CB.scores.renderInto(box, tb.gid, name);
    }

    if (L.invite) {
      var url = location.origin + '/games/' + tb.gid + '/';
      var txt = String(L.inviteText || '{url}')
        .split('{url}').join(url)
        .split('{game}').join(tb.gameName || '');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cb-wa-btn';
      b.innerHTML = WA_GLYPH + '<span></span>';
      b.querySelector('span').textContent = L.invite;
      b.onclick = function () {
        window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
      };
      body.appendChild(b);
    }
  }

  CB.topbar = {
    /* opts = { labels:{messages,lede,empty,invite,inviteText,backLobby},
     *          gameName, name }
     * Safe to call more than once: markup and listeners are built on the first
     * call, later calls only refresh the labels and the player name. */
    mount: function (opts) {
      opts = opts || {};
      tb.labels = opts.labels || {};
      tb.gameName = opts.gameName || '';
      tb.name = opts.name != null ? opts.name : CB.name.get();
      tb.gid = gameId();
      var L = tb.labels;

      var put = function (role, text) {
        var b = tbBtn(role);
        if (!b || !text) return;
        b.setAttribute('aria-label', text);
        b.setAttribute('title', text);
      };
      put('feed', L.messages);
      put('leave', L.backLobby);

      var sheet = document.getElementById('msgSheet');
      if (!sheet) {
        sheet = document.createElement('div');
        sheet.className = 'sheet hidden';
        sheet.id = 'msgSheet';
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-modal', 'true');
        sheet.setAttribute('aria-labelledby', 'msgTitle');
        sheet.innerHTML =
          '<div class="sheet-card">' +
            '<div class="sheet-head">' +
              '<h2 id="msgTitle"></h2>' +
              '<button class="sheet-x" id="msgClose" type="button" aria-label="Close">&#10005;</button>' +
            '</div>' +
            '<div class="sheet-body" id="msgBody"></div>' +
          '</div>';
        document.body.appendChild(sheet);

        var openSheet = function (on) {
          if (on) { msgRender(); sheet.classList.remove('hidden'); }
          else sheet.classList.add('hidden');
        };
        var close = document.getElementById('msgClose');
        if (close) close.onclick = function () { openSheet(false); };
        sheet.onclick = function (e) { if (e.target === sheet) openSheet(false); };
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && !sheet.classList.contains('hidden')) openSheet(false);
        });
        var feed = tbBtn('feed');
        if (feed) feed.onclick = function (e) { e.preventDefault(); openSheet(true); };
      }

      var leave = tbBtn('leave');
      if (leave) {
        leave.onclick = function () {
          // No confirm: the lobby is one tap away anyway and every finished
          // round is already stored by CB.scores.
          location.href = '/?view=games';
        };
      }
    }
  };

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
      'background:#eef3f8;color:#1f3a5f;text-align:center;font-weight:700}' +
      '.cb-sh-sub{font-weight:700;font-size:12px;margin:8px 0 2px;color:#12212f}' +
      '.cb-sh-level{margin:2px 0 8px;padding-left:8px;border-left:2px solid #eef3f8}' +
      '.cb-sh-lvl-head{font-size:12px;font-weight:700;color:#33506f;margin:2px 0 1px}' +
      '.cb-sh-table{width:100%;border-collapse:collapse;margin-top:6px;font-size:13px}' +
      '.cb-sh-table th{text-align:left;color:#6b7785;font-weight:700;font-size:11px;letter-spacing:.04em;padding:6px 8px;border-bottom:2px solid #eef3f8}' +
      '.cb-sh-table td{padding:7px 8px;border-bottom:1px solid #f1f4f8;vertical-align:middle}' +
      '.cb-sh-table td b{font-size:14px}' +
      '.cb-sh-table tr:last-child td{border-bottom:0}';
    (document.head || document.documentElement).appendChild(st);
  }
})();
