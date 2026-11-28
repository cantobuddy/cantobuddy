/* CantoBuddy — Member module (shared by the Learn Cantonese and Learn English
 * shells). Self-contained: it injects its own styles and its own tiny i18n so it
 * works identically inside public/index.html and public/en.html.
 *
 * What it does:
 *  1. On first landing (no prior answer on this device) it pops an onboarding
 *     card asking nickname, role (helper / elder / employer / guest / prefer
 *     not to say), email (optional) and password (optional); "Skip" keeps the
 *     default "helper" role.
 *  2. A header avatar button opens the member sheet: edit the profile, see game
 *     history, and view / edit the stories you submitted.
 *  3. A "login later" screen lets a member who gave email + password re-link a
 *     device to their member record.
 *
 * Privacy: nickname + role are saved to the device's server learner row so they
 * persist; email + password are sent to the server only when provided (password
 * is hashed there and never returned). Nothing here forces an account — skipping
 * leaves you a normal visitor.
 */
(function () {
  'use strict';

  // TEMPORARY — AdSense site review, 2026-11-28. Do not pop an onboarding card
  // at a first-time visitor on either landing page (/ or /en): a full-screen
  // overlay is exactly what a policy crawler flags. The header avatar button
  // and window.CBMember.openOnboarding() still open the card on demand, and all
  // save / skip / role-routing logic is untouched. To restore automatic
  // onboarding, set this to true again (and bump the APP_SHELL cache version).
  // The test harness opts in with window.CB_ENABLE_ONBOARDING = true so the
  // routing suite keeps exercising the real popup.
  var AUTO_ONBOARDING_ENABLED = typeof window !== 'undefined' && window.CB_ENABLE_ONBOARDING === true;

  var STORE_KEY = 'cb_member';
  var MEMBER_ROLES = ['helper', 'elder', 'employer', 'guest', 'undisclosed'];
  var GAME_NAMES = {
    uno: 'UNO', bigtwo: '鋤大D (Big Two)', sudoku: 'Sudoku',
    memory: 'Memory', quiz: 'Quiz', bingo: 'Bingo',
  };

  // --- tiny i18n -----------------------------------------------------------
  var L = {
    zh: {
      member: '會員', onboard: '歡迎嚟到 CantoBuddy', onboardSub: '講少少關於你，等我可以一步步幫你。',
      nickname: '稱呼', nicknamePh: '你想我點叫你？', role: '你是？',
      roleHelper: '外傭 / 家務助理', roleElder: '長者', roleEmployer: '僱主',
      roleGuest: '訪客', roleUndisclosed: '不想透露',
      email: '電郵（可不填）', emailPh: 'example@email.com',
      password: '密碼（可不填）', passwordPh: '想日後登入就填',
      skip: '略過', save: '儲存', close: '關閉',
      profile: '我的資料', games: '遊戲記錄', myStories: '我講嘅故事',
      noStories: '你仲未講過故事。', statusPending: '審查中', statusPublished: '已刊登', statusRejected: '未獲刊登',
      reviewerNote: '編輯話：', edit: '修改', saveStory: '儲存故事',
      login: '會員登入', loginSub: '用你嘅電郵同密碼，喺呢部機重睇你嘅會員資料。',
      loginEmail: '電郵', loginPassword: '密碼', loginBtn: '登入', loginFail: '電郵或密碼唔啱。',
      gamePlayed: '玩過', gameWon: '贏咗', winRate: '勝率',
      changePw: '改密碼', newPw: '新密碼（可不填）', saved: '已儲存！',
      storyTitle: '標題', storyBody: '你嘅故事', storyTopic: '話題', storyLang: '語言',
      signName: '署名（剔呢個就顯示你個名）', signYes: '用我嘅稱呼署名', needTitle: '請填標題。', needBody: '請寫啲嘢。',
      welcome: '你好', roleHelperLbl: '外傭', roleElderLbl: '長者', roleEmployerLbl: '僱主',
      roleGuestLbl: '訪客', roleUndisclosedLbl: '不想透露',
    },
    en: {
      member: 'Member', onboard: 'Welcome to CantoBuddy', onboardSub: 'Tell me a little about you so I can help step by step.',
      nickname: 'Nickname', nicknamePh: 'What should I call you?', role: 'You are a…',
      roleHelper: 'Helper / domestic worker', roleElder: 'Elder', roleEmployer: 'Employer',
      roleGuest: 'Guest / visitor', roleUndisclosed: 'Prefer not to say',
      email: 'Email (optional)', emailPh: 'example@email.com',
      password: 'Password (optional)', passwordPh: 'Fill in if you want to sign in later',
      skip: 'Skip', save: 'Save', close: 'Close',
      profile: 'My profile', games: 'Game history', myStories: 'My stories',
      noStories: 'You have not shared a story yet.', statusPending: 'In review', statusPublished: 'Published', statusRejected: 'Not published',
      reviewerNote: 'Editor note: ', edit: 'Edit', saveStory: 'Save story',
      login: 'Member sign-in', loginSub: 'Use your email and password to see your member info on this device.',
      loginEmail: 'Email', loginPassword: 'Password', loginBtn: 'Sign in', loginFail: 'Email or password is wrong.',
      gamePlayed: 'Played', gameWon: 'Won', winRate: 'Win rate',
      changePw: 'Change password', newPw: 'New password (optional)', saved: 'Saved!',
      storyTitle: 'Title', storyBody: 'Your story', storyTopic: 'Topic', storyLang: 'Language',
      signName: 'Sign with your name (tick to show it)', signYes: 'Sign with my nickname', needTitle: 'Please add a title.', needBody: 'Please write something.',
      welcome: 'Hello', roleHelperLbl: 'Helper', roleElderLbl: 'Elder', roleEmployerLbl: 'Employer',
      roleGuestLbl: 'Guest', roleUndisclosedLbl: 'Other',
    },
    fil: {
      member: 'Kasapi', onboard: 'Maligayang pagdating sa CantoBuddy', onboardSub: 'Sabihin mo nang kaunti tungkol sa iyo para matulungan kita.',
      nickname: 'Palayaw', nicknamePh: 'Ano ang itatawag ko sa iyo?', role: 'Ikaw ay…',
      roleHelper: 'Katulong / domestic worker', roleElder: 'Matanda', roleEmployer: 'Amo',
      roleGuest: 'Bisita / guest', roleUndisclosed: 'Ayaw sabihin',
      email: 'Email (optionaal)', emailPh: 'example@email.com',
      password: 'Password (optionaal)', passwordPh: 'Lagyan kung gusto mong mag-sign in',
      skip: 'Laktaw', save: 'I-save', close: 'Isara',
      profile: 'Profile ko', games: 'Larong nilalaro', myStories: 'Mga kuwento ko',
      noStories: 'Wala ka pang kwento.', statusPending: 'Tine-test', statusPublished: 'Na-publish', statusRejected: 'Hindi na-publish',
      reviewerNote: 'Note ng editor: ', edit: 'I-edit', saveStory: 'I-save ang kwento',
      login: 'Login ng kasapi', loginSub: 'Gamitin ang email at password para makita ang info mo dito.',
      loginEmail: 'Email', loginPassword: 'Password', loginBtn: 'Mag-login', loginFail: 'Mali ang email o password.',
      gamePlayed: 'Nilalaro', gameWon: 'Nanalo', winRate: 'Win rate',
      changePw: 'Baguhin password', newPw: 'Bagong password (optionaal)', saved: 'Na-save!',
      storyTitle: 'Pamagat', storyBody: 'Kuwento mo', storyTopic: 'Paksa', storyLang: 'Wika',
      signName: 'Pirmahan ng pangalan (tick para ipakita)', signYes: 'Pirmahan ng palayaw ko', needTitle: 'Lagyan ng pamagat.', needBody: 'Magsulat naman.',
      welcome: 'Hello', roleHelperLbl: 'Katulong', roleElderLbl: 'Matanda', roleEmployerLbl: 'Amo',
      roleGuestLbl: 'Bisita', roleUndisclosedLbl: 'Ayaw sabihin',
    },
    id: {
      member: 'Anggota', onboard: 'Selamat datang di CantoBuddy', onboardSub: 'Ceritakan sedikit tentangmu agar saya bisa membantu.',
      nickname: 'Nama panggilan', nicknamePh: 'Panggilan apa yang kamu suka?', role: 'Kamu adalah…',
      roleHelper: 'Pembantu / pekerja rumah', roleElder: 'Lansia', roleEmployer: 'Majikan',
      roleGuest: 'Tamu / pengunjung', roleUndisclosed: 'Tidak ingin menyebut',
      email: 'Email (opsional)', emailPh: 'example@email.com',
      password: 'Kata sandi (opsional)', passwordPh: 'Isi jika ingin masuk nanti',
      skip: 'Lewati', save: 'Simpan', close: 'Tutup',
      profile: 'Profil saya', games: 'Riwayat permainan', myStories: 'Cerita saya',
      noStories: 'Kamu belum bercerita.', statusPending: 'Sedang ditinjau', statusPublished: 'Diterbitkan', statusRejected: 'Tidak diterbitkan',
      reviewerNote: 'Catatan editor: ', edit: 'Edit', saveStory: 'Simpan cerita',
      login: 'Masuk anggota', loginSub: 'Gunakan email dan kata sandi untuk melihat info anggota di perangkat ini.',
      loginEmail: 'Email', loginPassword: 'Kata sandi', loginBtn: 'Masuk', loginFail: 'Email atau kata sandi salah.',
      gamePlayed: 'Dimainkan', gameWon: 'Menang', winRate: 'Persentase menang',
      changePw: 'Ubah kata sandi', newPw: 'Kata sandi baru (opsional)', saved: 'Tersimpan!',
      storyTitle: 'Judul', storyBody: 'Ceritamu', storyTopic: 'Topik', storyLang: 'Bahasa',
      signName: 'Tanda tangan dengan nama (centang untuk tampilkan)', signYes: 'Tanda tangan dengan panggilanku', needTitle: 'Mohon isi judul.', needBody: 'Mohon tulis sesuatu.',
      welcome: 'Halo', roleHelperLbl: 'Pembantu', roleElderLbl: 'Lansia', roleEmployerLbl: 'Majikan',
      roleGuestLbl: 'Tamu', roleUndisclosedLbl: 'Lainnya',
    },
  };

  function lang() {
    // The onboarding popup speaks the LEARNER's language, not the language taught:
    //   - the main site's learners are Filipino/Indonesian helpers who do not read
    //     Chinese, so the popup is in English;
    //   - the /en site's learners are Cantonese-speaking elders who do not read
    //     English, so the whole /en shell (and this popup) is in Chinese.
    if (location && location.pathname && location.pathname.indexOf('/en') === 0) return 'zh';
    return 'en';
  }
  function T(k) { return (L[lang()] || L.en)[k] || (L.en[k] || k); }

  // --- storage --------------------------------------------------------------
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function save(p) { try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) {} }

  // Cross-site "already seen" flag. localStorage is scoped per origin, which is
  // enough for cantobuddy.com and cantobuddy.com/en (same origin, different path),
  // but a first-party cookie lets the same device skip the popup even if the two
  // shells are ever served from different subdomains. We set it on every onboard
  // action and treat it as an extra suppression signal in boot().
  var SEEN_COOKIE = 'cb_member_seen';
  function seenCookieDomain() {
    var host = (location && location.hostname) || '';
    if (!host || host === 'localhost' || host === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return '';
    var parts = host.split('.');
    if (parts.length < 2) return '';
    return parts.slice(-2).join('.');
  }
  function setSeenCookie() {
    try {
      var d = seenCookieDomain();
      var max = 60 * 60 * 24 * 365 * 2;
      document.cookie = SEEN_COOKIE + '=1; path=/; max-age=' + max + (d ? '; domain=' + d : '') + '; SameSite=Lax';
    } catch (e) {}
  }
  function hasSeenCookie() {
    try { return new RegExp('(?:^|; )' + SEEN_COOKIE + '=1(?:;|$)').test(document.cookie); }
    catch (e) { return false; }
  }

  // The name at the top-right of the Learn-Cantonese header is the legacy
  // "learner name" (localStorage cb_learner, rendered by app.js updateLearnerBadge).
  // Keep it in sync with the member nickname so there is ONE visible name and a
  // name already on screen counts as onboarded.
  function legacyName() {
    try { return String(localStorage.getItem('cb_learner') || '').trim(); }
    catch (e) { return ''; }
  }
  function syncLegacyName(name) {
    name = String(name || '').trim();
    if (!name) return;
    try { localStorage.setItem('cb_learner', name); } catch (e) {}
    // app.js declares `const STATE` (a global lexical binding, NOT window.STATE)
    // and renders the badge from STATE.learner. To guarantee the badge updates
    // whether or not app.js is present, set STATE when available AND write the
    // DOM directly as a fallback (en.html has no app.js / learner-badge).
    try { if (typeof STATE !== 'undefined' && STATE) STATE.learner = name; } catch (e) {}
    if (typeof window.updateLearnerBadge === 'function') window.updateLearnerBadge();
    var badge = document.getElementById('learner-badge');
    if (badge) badge.textContent = '👤 ' + name;
  }

  // --- helpers --------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function apiGet(u) { return window.apiGet ? window.apiGet(u) : fetch(u).then(function (r) { return r.json(); }); }
  function apiPost(u, b) {
    if (window.apiPost) return window.apiPost(u, b);
    return fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(function (r) { return r.json(); });
  }
  // Profile + story edits are PATCH on the server. Send the correct method; the
  // server also keeps a POST alias for old cache-first bundles still out there.
  function apiPatch(u, b) {
    return fetch(u, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(function (r) { return r.json(); });
  }
  function deviceId() {
    try { return (window.STATE && STATE.deviceId) || localStorage.getItem('cb_device') || ''; }
    catch (e) { return ''; }
  }

  // After onboarding, send each learner to the site built for her role. A helper
  // belongs on the Cantonese site at /; an elder belongs on the English site at
  // /en. "Skip" chooses the default helper role, so it follows the same route.
  // A guest or someone who prefers not to say is not an elder either, so they
  // land on / as well. Employer is deliberately left where it is: no operator
  // request to move it. The profile is already saved (and the overlay closed)
  // before this runs.
  function atRoleHome(path, target) {
    path = String(path || '/');
    return target === '/'
      ? (path === '/' || path === '/index.html')
      : (path === '/en' || path === '/en/' || path === '/en/index.html');
  }
  function goToRoleHome(role) {
    var target = (role === 'helper' || role === 'guest' || role === 'undisclosed') ? '/' : role === 'elder' ? '/en' : '';
    if (!target) return;
    var loc = (window && window.location) || location;
    if (!loc || typeof loc.assign !== 'function') return;
    if (atRoleHome(loc.pathname, target)) return;
    loc.assign(target);
    // A cache-first shell can swallow the first navigation while the worker
    // swaps versions. If we are still not on the role's home a beat later,
    // force it by assigning href too. Same destination, never a different page.
    setTimeout(function () {
      try {
        var here = (window && window.location) || loc;
        if (!atRoleHome(here.pathname, target)) here.href = target;
      } catch (e) {}
    }, 450);
  }

  // --- overlay / modal scaffolding -----------------------------------------
  var overlay = null, box = null, lastFocus = null;
  function ensureStyles() {
    if (document.getElementById('cbm-style')) return;
    var s = document.createElement('style');
    s.id = 'cbm-style';
    s.textContent = [
      '.cbm-overlay{position:fixed;inset:0;background:rgba(20,20,40,.55);display:flex;align-items:center;justify-content:center;z-index:9000;padding:16px;}',
      '.cbm-box{background:#fff;border-radius:18px;max-width:440px;width:100%;max-height:90vh;overflow:auto;padding:22px 20px 18px;box-shadow:0 18px 50px rgba(26,26,46,.3);font-family:inherit;color:#222;}',
      '.cbm-box h2{margin:0 0 4px;font-size:1.25rem;}',
      '.cbm-sub{margin:0 0 16px;color:#666;font-size:.92rem;}',
      '.cbm-field{margin:0 0 14px;}',
      '.cbm-field label{display:block;font-weight:600;margin-bottom:5px;font-size:.9rem;}',
      '.cbm-field input,.cbm-field select,.cbm-field textarea{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #d8d8e4;border-radius:10px;font-size:1rem;font-family:inherit;}',
      '.cbm-field textarea{min-height:120px;resize:vertical;}',
      '.cbm-roles{display:flex;gap:8px;flex-wrap:wrap;}',
      '.cbm-role{flex:1 1 30%;border:1px solid #d8d8e4;border-radius:12px;padding:10px 8px;text-align:center;cursor:pointer;background:#f7f7fb;font-size:.85rem;}',
      '.cbm-role.sel{background:var(--red,#d6453d);color:#fff;border-color:var(--red,#d6453d);}',
      '.cbm-actions{display:flex;gap:10px;margin-top:8px;}',
      '.cbm-btn{flex:1;padding:12px;border-radius:12px;border:none;font-size:1rem;font-weight:600;cursor:pointer;}',
      '.cbm-btn.primary{background:var(--red,#d6453d);color:#fff;}',
      '.cbm-btn.ghost{background:#eef0f6;color:#333;}',
      '.cbm-tabs{display:flex;gap:6px;margin:0 0 14px;flex-wrap:wrap;}',
      '.cbm-tab{padding:8px 12px;border-radius:10px;background:#eef0f6;cursor:pointer;font-size:.9rem;border:none;}',
      '.cbm-tab.sel{background:var(--red,#d6453d);color:#fff;}',
      '.cbm-card{border:1px solid #ececf3;border-radius:12px;padding:12px;margin:0 0 10px;}',
      '.cbm-badge{display:inline-block;font-size:.75rem;padding:2px 8px;border-radius:999px;margin-left:6px;}',
      '.cbm-badge.pending{background:#fff3d6;color:#8a6d00;}',
      '.cbm-badge.published{background:#dcf5e3;color:#1c7a3e;}',
      '.cbm-badge.rejected{background:#ffe0e0;color:#a83030;}',
      '.cbm-note{font-size:.85rem;color:#a83030;margin-top:6px;}',
      '.cbm-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f5;font-size:.95rem;}',
      '.cbm-msg{color:#1c7a3e;font-size:.9rem;margin-top:8px;min-height:1em;}',
      '.cbm-err{color:#a83030;font-size:.9rem;margin-top:8px;min-height:1em;}',
      '.cbm-x{float:right;cursor:pointer;border:none;background:none;outline:none;font-size:1.4rem;line-height:1;color:#888;}',
    ].join('\n');
    document.head.appendChild(s);
  }
  function openOverlay(innerHtml) {
    ensureStyles();
    lastFocus = document.activeElement;
    overlay = document.createElement('div');
    overlay.className = 'cbm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    box = document.createElement('div');
    box.className = 'cbm-box';
    box.innerHTML = innerHtml;
    overlay.appendChild(box);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });
    document.body.appendChild(overlay);
    var x = box.querySelector('.cbm-x');
    if (x) x.addEventListener('click', closeOverlay);
    // Focus the first real field, never the close X — focusing X draws a browser
    // focus ring ("border") around it on load, which the operator does not want.
    var f = box.querySelector('input:not([type=hidden]),select,textarea') ||
            box.querySelector('.cbm-tab') || box.querySelector('button:not(.cbm-x)');
    if (f) f.focus();
  }
  function closeOverlay() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = box = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function setMsg(sel, msg, isErr) {
    var el = box && box.querySelector(sel);
    if (el) { el.textContent = msg || ''; el.className = isErr ? 'cbm-err' : 'cbm-msg'; }
  }

  // --- onboarding -----------------------------------------------------------
  function showOnboarding() {
    var p = load();
    var role = p.role || 'helper';
    openOverlay(
      '<button class="cbm-x" aria-label="close">×</button>' +
      '<h2>' + esc(T('onboard')) + '</h2>' +
      '<p class="cbm-sub">' + esc(T('onboardSub')) + '</p>' +
      '<div class="cbm-field"><label>' + esc(T('nickname')) + '</label>' +
        '<input id="cbm-nick" maxlength="80" placeholder="' + esc(T('nicknamePh')) + '" value="' + esc(p.nickname || '') + '"></div>' +
      '<div class="cbm-field"><label>' + esc(T('role')) + '</label>' +
        '<div class="cbm-roles" id="cbm-roles">' +
          roleChip('helper') + roleChip('elder') + roleChip('employer') +
          roleChip('guest') + roleChip('undisclosed') +
        '</div></div>' +
      '<div class="cbm-field"><label>' + esc(T('email')) + '</label>' +
        '<input id="cbm-email" type="email" maxlength="200" autocomplete="off" spellcheck="false" placeholder="' + esc(T('emailPh')) + '" value=""></div>' +
      '<div class="cbm-field"><label>' + esc(T('password')) + '</label>' +
        '<input id="cbm-pw" type="password" maxlength="200" autocomplete="new-password" placeholder="' + esc(T('passwordPh')) + '"></div>' +
      '<div class="cbm-actions">' +
        '<button class="cbm-btn ghost" id="cbm-skip">' + esc(T('skip')) + '</button>' +
        '<button class="cbm-btn primary" id="cbm-save">' + esc(T('save')) + '</button>' +
      '</div>' +
      '<div class="cbm-msg" id="cbm-msg"></div>'
    );
    // Password managers can inject saved credentials into an email+password pair
    // even with autocomplete="off". Wipe any such autofill on a couple of ticks —
    // but never a field the user is actively typing in.
    [0, 150, 400].forEach(function (delay) {
      setTimeout(function () {
        ['#cbm-email', '#cbm-pw'].forEach(function (sel) {
          var el = box && box.querySelector(sel);
          if (el && el.value && document.activeElement !== el) el.value = '';
        });
      }, delay);
    });
    function roleChip(r) {
      return '<div class="cbm-role' + (r === role ? ' sel' : '') + '" data-role="' + r + '">' + esc(T('role' + r.charAt(0).toUpperCase() + r.slice(1))) + '</div>';
    }
    var chosen = role;
    box.querySelectorAll('.cbm-role').forEach(function (el) {
      el.addEventListener('click', function () {
        chosen = el.getAttribute('data-role');
        box.querySelectorAll('.cbm-role').forEach(function (x) { x.classList.remove('sel'); });
        el.classList.add('sel');
      });
    });
    box.querySelector('#cbm-skip').addEventListener('click', function () {
      var pp = load(); pp.onboarded = true; pp.role = 'helper';
      // Keep a name already shown at the top-right (legacy cb_learner) as the
      // member's name rather than losing it when Skip is tapped.
      pp.nickname = pp.nickname || legacyName(); save(pp);
      if (pp.nickname) syncLegacyName(pp.nickname);
      setSeenCookie();
      closeOverlay();
      maybeAddAvatar();
      goToRoleHome('helper');
    });
    box.querySelector('#cbm-save').addEventListener('click', function () {
      var nick = box.querySelector('#cbm-nick').value.trim();
      var email = box.querySelector('#cbm-email').value.trim();
      var pw = box.querySelector('#cbm-pw').value;
      var body = { public_id: deviceId(), display_name: nick, role: chosen, email: email };
      if (pw) body.password = pw;
      apiPatch('/api/learners/me', body).then(function (r) {
        if (r && r.ok) {
          var pp = load();
          pp.onboarded = true; pp.nickname = nick; pp.role = chosen; pp.email = email; pp.hasPassword = !!pw || !!pp.hasPassword;
          save(pp);
          syncLegacyName(nick);
          setSeenCookie();
          closeOverlay();
          maybeAddAvatar();
          goToRoleHome(chosen);
        } else {
          setMsg('#cbm-msg', (r && r.error) || 'Could not save.', true);
        }
      }).catch(function () { setMsg('#cbm-msg', 'Network error. Please try again.', true); });
    });
  }

  // --- member sheet ---------------------------------------------------------
  function showMember() {
    var p = load();
    openOverlay(
      '<button class="cbm-x" aria-label="close">×</button>' +
      '<h2>' + esc(T('member')) + (p.nickname ? ' — ' + esc(p.nickname) : '') + '</h2>' +
      '<div class="cbm-tabs">' +
        '<button class="cbm-tab sel" data-tab="profile">' + esc(T('profile')) + '</button>' +
        '<button class="cbm-tab" data-tab="games">' + esc(T('games')) + '</button>' +
        '<button class="cbm-tab" data-tab="stories">' + esc(T('myStories')) + '</button>' +
        '<button class="cbm-tab" data-tab="login">' + esc(T('login')) + '</button>' +
      '</div>' +
      '<div id="cbm-panel"></div>'
    );
    box.querySelectorAll('.cbm-tab').forEach(function (el) {
      el.addEventListener('click', function () {
        box.querySelectorAll('.cbm-tab').forEach(function (x) { x.classList.remove('sel'); });
        el.classList.add('sel');
        renderPanel(el.getAttribute('data-tab'));
      });
    });
    renderPanel('profile');
  }
  function renderPanel(tab) {
    var host = box.querySelector('#cbm-panel');
    if (tab === 'profile') renderProfile(host);
    else if (tab === 'games') renderGames(host);
    else if (tab === 'stories') renderStories(host);
    else if (tab === 'login') renderLogin(host);
  }
  function renderProfile(host) {
    var p = load();
    // Only trust a stored email if it is actually an email. An old autofill bug
    // saved the bare string "admin" here — never show that as if it were real.
    var savedEmail = (p.email && String(p.email).indexOf('@') > 0) ? p.email : '';
    host.innerHTML =
      '<div class="cbm-field"><label>' + esc(T('nickname')) + '</label>' +
        '<input id="cbm-p-nick" maxlength="80" value="' + esc(p.nickname || '') + '"></div>' +
      '<div class="cbm-field"><label>' + esc(T('role')) + '</label>' +
        '<div class="cbm-roles" id="cbm-p-roles">' +
          roleChip('helper', p.role) + roleChip('elder', p.role) + roleChip('employer', p.role) +
          roleChip('guest', p.role) + roleChip('undisclosed', p.role) +
        '</div></div>' +
      '<div class="cbm-field"><label>' + esc(T('email')) + '</label>' +
        '<input id="cbm-p-email" type="email" maxlength="200" autocomplete="off" spellcheck="false" value="' + esc(savedEmail) + '"></div>' +
      '<div class="cbm-field"><label>' + esc(T('newPw')) + '</label>' +
        '<input id="cbm-p-pw" type="password" maxlength="200" autocomplete="new-password" placeholder=""></div>' +
      '<div class="cbm-actions"><button class="cbm-btn primary" id="cbm-p-save">' + esc(T('save')) + '</button></div>' +
      '<div class="cbm-msg" id="cbm-p-msg"></div>';
    // Password managers still inject saved credentials into an email+password
    // pair despite autocomplete="off". Wipe any autofill on a few ticks, but never
    // a field the user is actively typing in, and keep a legit saved email.
    [0, 150, 400].forEach(function (delay) {
      setTimeout(function () {
        var em = host.querySelector('#cbm-p-email');
        if (em && document.activeElement !== em && em.value !== savedEmail) em.value = savedEmail;
        var pw = host.querySelector('#cbm-p-pw');
        if (pw && document.activeElement !== pw && pw.value) pw.value = '';
      }, delay);
    });
    function roleChip(r, sel) {
      return '<div class="cbm-role' + (r === sel ? ' sel' : '') + '" data-role="' + r + '">' + esc(T('role' + r.charAt(0).toUpperCase() + r.slice(1))) + '</div>';
    }
    var chosen = p.role || 'helper';
    host.querySelectorAll('.cbm-role').forEach(function (el) {
      el.addEventListener('click', function () {
        chosen = el.getAttribute('data-role');
        host.querySelectorAll('.cbm-role').forEach(function (x) { x.classList.remove('sel'); });
        el.classList.add('sel');
      });
    });
    host.querySelector('#cbm-p-save').addEventListener('click', function () {
      var nick = host.querySelector('#cbm-p-nick').value.trim();
      var email = host.querySelector('#cbm-p-email').value.trim();
      var pw = host.querySelector('#cbm-p-pw').value;
      var body = { public_id: deviceId(), display_name: nick, role: chosen, email: email };
      if (pw) body.password = pw;
      apiPatch('/api/learners/me', body).then(function (r) {
        if (r && r.ok) {
          var pp = load(); pp.onboarded = true; pp.nickname = nick; pp.role = chosen; pp.email = email; pp.hasPassword = !!pw || !!pp.hasPassword; save(pp);
          syncLegacyName(nick);
          setSeenCookie();
          // Operator rule: a role save is final. Close the sheet and land on the
          // site for that role — no lingering "Saved!" panel to tap again.
          closeOverlay();
          maybeAddAvatar();
          goToRoleHome(chosen);
        } else setMsg('#cbm-p-msg', (r && r.error) || 'Could not save.', true);
      }).catch(function () { setMsg('#cbm-p-msg', 'Network error.', true); });
    });
  }
  function renderGames(host) {
    host.innerHTML = '<div class="cbm-msg" id="cbm-g-msg">' + esc(T('games')) + '…</div>';
    apiGet('/api/games/record?public_id=' + encodeURIComponent(deviceId())).then(function (r) {
      var games = (r && r.games) || {};
      var html = '';
      Object.keys(games).forEach(function (k) {
        var g = games[k]; if (!g) return;
        var name = GAME_NAMES[k] || k;
        var rate = g.played ? Math.round((g.wins / g.played) * 100) : 0;
        html += '<div class="cbm-row"><span>' + esc(name) + '</span><span>' +
          esc(T('gamePlayed')) + ' ' + g.played + ' · ' + esc(T('gameWon')) + ' ' + g.wins + ' · ' + esc(T('winRate')) + ' ' + rate + '%</span></div>';
      });
      if (!html) html = '<p class="cbm-sub">' + esc(T('noStories')) + '</p>';
      host.innerHTML = html;
    }).catch(function () { host.innerHTML = '<p class="cbm-err">Could not load game history.</p>'; });
  }
  function renderStories(host) {
    host.innerHTML = '<div class="cbm-msg">' + esc(T('myStories')) + '…</div>';
    apiGet('/api/stories/mine?public_id=' + encodeURIComponent(deviceId())).then(function (r) {
      var list = (r && r.stories) || [];
      if (!list.length) { host.innerHTML = '<p class="cbm-sub">' + esc(T('noStories')) + '</p>'; return; }
      var html = '';
      list.forEach(function (s) {
        var badge = '<span class="cbm-badge ' + esc(s.status) + '">' + esc(T('status' + s.status.charAt(0).toUpperCase() + s.status.slice(1))) + '</span>';
        html += '<div class="cbm-card"><strong>' + esc(s.title) + '</strong>' + badge +
          (s.status === 'rejected' && s.reviewer_note ? '<div class="cbm-note">' + esc(T('reviewerNote')) + esc(s.reviewer_note) + '</div>' : '') +
          '<div class="cbm-actions" style="margin-top:8px"><button class="cbm-btn ghost" data-edit="' + esc(s.slug) + '">' + esc(T('edit')) + '</button></div></div>';
      });
      host.innerHTML = html;
      host.querySelectorAll('[data-edit]').forEach(function (b) {
        b.addEventListener('click', function () { editStory(b.getAttribute('data-edit'), host); });
      });
    }).catch(function () { host.innerHTML = '<p class="cbm-err">Could not load your stories.</p>'; });
  }
  function editStory(slug, host) {
    apiGet('/api/stories/mine?public_id=' + encodeURIComponent(deviceId())).then(function (r) {
      var s = ((r && r.stories) || []).filter(function (x) { return x.slug === slug; })[0];
      if (!s) { host.innerHTML = '<p class="cbm-err">Story not found.</p>'; return; }
      openOverlay(
        '<button class="cbm-x" aria-label="close">×</button>' +
        '<h2>' + esc(T('edit')) + '</h2>' +
        '<div class="cbm-field"><label>' + esc(T('storyTitle')) + '</label>' +
          '<input id="cbm-s-title" maxlength="120" value="' + esc(s.title) + '"></div>' +
        '<div class="cbm-field"><label>' + esc(T('storyBody')) + '</label>' +
          '<textarea id="cbm-s-body">' + esc(s.body) + '</textarea></div>' +
        '<div class="cbm-field"><label>' + esc(T('storyLang')) + '</label>' +
          '<select id="cbm-s-lang"><option value="en">English</option><option value="fil">Filipino</option><option value="zh">中文</option><option value="id">Bahasa</option></select></div>' +
        '<div class="cbm-field"><label>' + esc(T('storyTopic')) + '</label>' +
          '<input id="cbm-s-topic" maxlength="40" value="' + esc(s.topic) + '"></div>' +
        '<div class="cbm-field"><label><input type="checkbox" id="cbm-s-sign"' + (s.display_name ? ' checked' : '') + '> ' + esc(T('signYes')) + '</label></div>' +
        '<div class="cbm-actions"><button class="cbm-btn ghost" id="cbm-s-cancel">' + esc(T('close')) + '</button>' +
          '<button class="cbm-btn primary" id="cbm-s-save">' + esc(T('saveStory')) + '</button></div>' +
        '<div class="cbm-msg" id="cbm-s-msg"></div>'
      );
      box.querySelector('#cbm-s-lang').value = s.lang || 'en';
      box.querySelector('#cbm-s-cancel').addEventListener('click', closeOverlay);
      box.querySelector('#cbm-s-save').addEventListener('click', function () {
        var body = {
          public_id: deviceId(),
          title: box.querySelector('#cbm-s-title').value.trim(),
          body: box.querySelector('#cbm-s-body').value.trim(),
          lang: box.querySelector('#cbm-s-lang').value,
          topic: box.querySelector('#cbm-s-topic').value.trim(),
          sign: box.querySelector('#cbm-s-sign').checked,
          display_name: load().nickname || '',
        };
        if (!body.title) return setMsg('#cbm-s-msg', T('needTitle'), true);
        if (!body.body) return setMsg('#cbm-s-msg', T('needBody'), true);
        apiPatch('/api/stories/' + encodeURIComponent(slug), body).then(function (r) {
          if (r && r.ok) { closeOverlay(); renderStories(host); }
          else setMsg('#cbm-s-msg', (r && r.error) || 'Could not save.', true);
        }).catch(function () { setMsg('#cbm-s-msg', 'Network error.', true); });
      });
    });
  }
  function renderLogin(host) {
    host.innerHTML =
      '<p class="cbm-sub">' + esc(T('loginSub')) + '</p>' +
      '<div class="cbm-field"><label>' + esc(T('loginEmail')) + '</label><input id="cbm-l-email" type="email" maxlength="200"></div>' +
      '<div class="cbm-field"><label>' + esc(T('loginPassword')) + '</label><input id="cbm-l-pw" type="password" maxlength="200"></div>' +
      '<div class="cbm-actions"><button class="cbm-btn primary" id="cbm-l-go">' + esc(T('loginBtn')) + '</button></div>' +
      '<div class="cbm-err" id="cbm-l-msg"></div>';
    host.querySelector('#cbm-l-go').addEventListener('click', function () {
      var email = host.querySelector('#cbm-l-email').value.trim();
      var pw = host.querySelector('#cbm-l-pw').value;
      apiPost('/api/learners/login', { email: email, password: pw }).then(function (r) {
        if (r && r.ok && r.public_id) {
          try { localStorage.setItem('cb_device', r.public_id); } catch (e) {}
          closeOverlay();
          location.reload();
        } else {
          setMsg('#cbm-l-msg', (r && r.error) || T('loginFail'), true);
        }
      }).catch(function () { setMsg('#cbm-l-msg', T('loginFail'), true); });
    });
  }

  // --- header avatar button -------------------------------------------------
  function maybeAddAvatar() {
    if (document.getElementById('cbm-open')) return;
    var p = load();
    var btn = document.createElement('button');
    btn.id = 'cbm-open';
    btn.className = 'site-btn';
    btn.type = 'button';
    btn.title = T('member');
    btn.setAttribute('aria-label', T('member'));
    btn.textContent = p.nickname ? p.nickname.charAt(0).toUpperCase() : '👤';
    btn.style.cssText = 'width:38px;height:38px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:700;flex:0 0 auto;';
    btn.addEventListener('click', showMember);
    var target = document.querySelector('.en-header-right') || document.querySelector('.header-right') ||
                 document.querySelector('.en-header-extra') || document.querySelector('.header-extra');
    if (target) target.appendChild(btn);
  }

  // --- boot -----------------------------------------------------------------
  function boot() {
    var p = load();
    var topName = legacyName();
    // A name already showing at the top-right (the legacy cb_learner "learner
    // badge", e.g. "Jen") means this device has already named itself. Adopt it as
    // the member's name so there is ONE name everywhere, no duplicate avatar, and
    // no onboarding popup on the next visit.
    if (topName && !p.nickname) {
      p.nickname = topName; p.onboarded = true; save(p);
    }
    maybeAddAvatar();
    // A returning visitor who already finished onboarding (name stored locally OR
    // the cross-site "seen" cookie — set when they onboarded on the other
    // CantoBuddy shell) should never see the popup again. Seed the cookie here so
    // an existing local profile also suppresses the popup on the other site.
    if (p.onboarded || p.nickname) setSeenCookie();
    // Only show onboarding for a device that has neither finished onboarding,
    // stored a name, nor carries the cross-site "seen" cookie — and only while
    // automatic onboarding is enabled (temporarily off for the AdSense review).
    if (AUTO_ONBOARDING_ENABLED && deviceId() && !p.onboarded && !p.nickname && !hasSeenCookie()) {
      showOnboarding();
    }
  }
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function () {
    // wait a tick for the app (STATE.deviceId) to be ready
    var tries = 0;
    (function wait() {
      if (deviceId() || tries > 40) return boot();
      tries++; setTimeout(wait, 100);
    })();
  });

  window.CBMember = { open: showMember, openOnboarding: showOnboarding };
})();
