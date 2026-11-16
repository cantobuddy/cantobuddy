'use strict';
/* /en/games — identity bridge + weekly elder leaderboard.
 *
 * The elder browser owns en_device (en_dev_<hex>). Game rooms only accept
 * dev_<hex>, so we derive one by dropping "en_", use it as cb_device for the
 * game pages, and register it with /api/en/game-identity. That registration is
 * the ONLY thing that puts a game_result on the /en elder board; helper results
 * keep their own ids and never appear here.
 */
(function () {
  function get(key) { try { return localStorage.getItem(key) || ''; } catch (e) { return ''; } }
  function set(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }

  function enDeviceId() {
    var id = get('en_device');
    if (!/^en_dev_[a-f0-9]{16,64}$/.test(id)) {
      var b = new Uint8Array(18);
      if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b);
      else for (var i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
      id = 'en_dev_' + Array.prototype.map.call(b, function (x) {
        return ('0' + x.toString(16)).slice(-2);
      }).join('');
      set('en_device', id);
    }
    return id;
  }

  // dev_<hex> is the SAME device, just in the shape game-records validates.
  function gamePublicId() { return enDeviceId().replace(/^en_/, ''); }

  function nickname() {
    var member = null;
    try { member = JSON.parse(get('cb_member') || 'null'); } catch (e) {}
    if (member && member.role === 'elder' && String(member.nickname || '').trim()) {
      return String(member.nickname).trim().slice(0, 24);
    }
    return String(get('cb_player_name') || '').trim().slice(0, 24) || '長者';
  }

  function prepare(name) {
    var id = gamePublicId();
    var n = String(name || nickname() || '長者').trim().slice(0, 24) || '長者';
    // Every game page reads these two keys. Set them BEFORE the link navigates.
    set('cb_device', id);
    set('cb_player_name', n);
    return { id: id, name: n };
  }

  function register(id, name) {
    var body = JSON.stringify({ public_id: id, nickname: name });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/en/game-identity', new Blob([body], { type: 'application/json' }));
        return;
      }
    } catch (e) {}
    fetch('/api/en/game-identity', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true,
    }).catch(function () {});
  }

  function row(rank, name, score, me) {
    var li = document.createElement('li');
    li.className = 'lb-row' + (me ? ' lb-me' : '');
    var r = document.createElement('span'); r.className = 'lb-rank'; r.textContent = '#' + rank;
    var n = document.createElement('span'); n.className = 'lb-name'; n.textContent = name;
    var s = document.createElement('span'); s.className = 'lb-score'; s.textContent = score;
    li.appendChild(r); li.appendChild(n); li.appendChild(s);
    return li;
  }

  function loadBoard(id) {
    var list = document.getElementById('en-glb-list');
    var mine = document.getElementById('en-glb-mine');
    var week = document.getElementById('en-glb-week');
    if (!list || !mine || !week) return;
    fetch('/api/en/games/leaderboard?public_id=' + encodeURIComponent(id), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        week.textContent = '(' + d.week + ')';
        list.innerHTML = '';
        if (!d.rows || !d.rows.length) {
          var empty = document.createElement('li');
          empty.className = 'lb-empty';
          empty.textContent = '本星期尚未有長者上榜，玩一局就係第一位。';
          list.appendChild(empty);
        } else {
          d.rows.forEach(function (p) {
            list.appendChild(row(p.rank, p.name, p.wins + ' 勝 · ' + p.played + ' 局', p.publicId === id));
          });
        }
        if (d.me) {
          mine.textContent = '你：第 ' + d.me.rank + ' 名 · ' + d.me.wins + ' 勝 / ' + d.me.played + ' 局';
          mine.className = 'lb-row lb-me';
        } else {
          mine.textContent = '你本星期尚未上榜 · 本星期已有 ' + d.players + ' 位長者玩過';
          mine.className = 'lb-empty';
        }
      })
      .catch(function () {
        mine.textContent = '排行榜暫時讀取唔到，但遊戲照樣可以玩。';
        mine.className = 'lb-empty';
      });
  }

  var input = document.getElementById('en-games-name-input');
  var save = document.getElementById('en-games-name-save');
  var initial = prepare();
  if (input && initial.name !== '長者') input.value = initial.name;
  register(initial.id, initial.name);
  loadBoard(initial.id);

  if (save && input) {
    save.addEventListener('click', function () {
      var p = prepare(input.value.trim() || '長者');
      input.value = p.name;
      register(p.id, p.name);
      loadBoard(p.id);
      save.textContent = '已儲存';
      setTimeout(function () { save.textContent = '儲存'; }, 1400);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); save.click(); }
    });
  }

  // Set the game identity on EVERY card tap, in case the name was just edited.
  Array.prototype.forEach.call(document.querySelectorAll('[data-game]'), function (a) {
    a.addEventListener('click', function () {
      var p = prepare(input ? input.value.trim() : '');
      register(p.id, p.name);
    });
  });
})();
