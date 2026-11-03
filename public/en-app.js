'use strict';
/**
 * CantoBuddy — English Track learner app (public/en-app.js).
 *
 * Self-contained SPA for the /en entry point. Reuses the *look* of the Cantonese
 * app (same brand, same card style) but is a separate file so the Cantonese SPA
 * (public/app.js) is never touched. Talks to the isolated /api/en/* endpoints.
 *
 * Audience: an elderly Cantonese-speaking person. UI is in 繁/簡/Fil/Indo
 * (default 繁). Every word/phrase has TWO audio buttons — English (en voice) and
 * 粵語 (zh-HK voice) — both browser TTS, so no audio files are needed.
 */

// ---- State -----------------------------------------------------------------
// `var` (not `const`) so inline onclick handlers can reach window.STATE reliably.
var STATE = {
  deviceId: null,
  categories: [],
  words: [],        // type 'word' only
  scenarios: [],
  progress: {},      // vocab_id -> { seen, correct }
  currentCat: null,
  quiz: null,
};

const $ = (id) => document.getElementById(id);
const escapeHtml = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// ---- Device identity (same pattern as the Cantonese app: no account) --------
function loadDeviceId() {
  let id = safeGet('en_device');
  if (!id) {
    const b = new Uint8Array(18);
    crypto.getRandomValues(b);
    id = 'en_dev_' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    safeSet('en_device', id);
  }
  return id;
}

// ---- API -------------------------------------------------------------------
async function apiGet(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('GET ' + url + ' failed: ' + r.status);
  return r.json();
}
async function apiPost(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('POST ' + url + ' failed: ' + r.status);
  return r.json();
}
async function apiDelete(url, body) {
  const opts = { method: 'DELETE' };
  if (body) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error('DELETE ' + url + ' failed: ' + r.status);
  return r.json().catch(() => ({}));
}

// ---- TTS (English + Cantonese) ---------------------------------------------
let _voices = [];
// localStorage can throw in private-mode / blocked-storage browsers; never let
// that blank the whole page, so wrap every access.
function safeGet(key) { try { return (typeof localStorage !== 'undefined') ? localStorage.getItem(key) : ''; } catch (e) { return ''; } }
function safeSet(key, val) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, val); } catch (e) {} }
let _selEn = safeGet('en_voice_en') || '';
let _selYue = safeGet('en_voice_yue') || '';

function loadVoices() {
  if ('speechSynthesis' in window) {
    _voices = window.speechSynthesis.getVoices() || [];
    populateVoiceSelects();
  }
}
if ('speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// Prefer natural-sounding voices over robotic/default ones.
function scoreVoice(v, lang) {
  let s = 0;
  const name = (v.name || '').toLowerCase();
  const l = (v.lang || '').toLowerCase();
  if (lang === 'en') {
    if (/en[-_](us|gb)/.test(l)) s += 3;
    else if (l.startsWith('en')) s += 1;
    if (/samantha|aria|zira|google|microsoft|neural|premium|female|natural|enhanced/i.test(name)) s += 3;
    if (/espeak|robot|default|compact|espeakng/i.test(name)) s -= 3;
  } else {
    if (/zh[-_]hk|yue/.test(l)) s += 3;
    else if (l.startsWith('zh')) s += 1;
    if (/google|microsoft|neural|premium|female|natural|ting|sinji|mei|ya|hong|kong/i.test(name)) s += 3;
    if (/espeak|robot|default|compact|espeakng/i.test(name)) s -= 3;
  }
  return s;
}
function pickVoice(lang) {
  const pool = lang === 'en'
    ? _voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
    : _voices.filter((v) => /zh[-_]HK|yue/i.test(v.lang) || v.lang.toLowerCase().startsWith('zh'));
  if (!pool.length) return null;
  pool.sort((a, b) => scoreVoice(b, lang) - scoreVoice(a, lang));
  return pool[0];
}
function speak(text, lang) {
  if (!('speechSynthesis' in window)) { alert(enT('noAudio')); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const selName = lang === 'en' ? _selEn : _selYue;
  let v = selName ? _voices.find((x) => x.name === selName) || null : null;
  if (!v) v = pickVoice(lang);
  if (v) u.voice = v;
  u.lang = lang === 'en' ? 'en-US' : 'zh-HK';
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

// ---- Voice chooser (top menu) ----------------------------------------------
function fillVoiceSelect(sel, voices, selected) {
  sel.innerHTML = '';
  if (!voices.length) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = '(呢部機無語音 / no voice)';
    sel.appendChild(o);
    return;
  }
  voices.forEach((v) => {
    const o = document.createElement('option');
    o.value = v.name;
    o.textContent = v.name + ' (' + v.lang + ')';
    if (v.name === selected) o.selected = true;
    sel.appendChild(o);
  });
}
function populateVoiceSelects() {
  const enSel = $('en-voice-en');
  const yueSel = $('en-voice-yue');
  if (!enSel || !yueSel) return;
  const enVoices = _voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const yueVoices = _voices.filter((v) => /zh[-_]HK|yue/i.test(v.lang) || v.lang.toLowerCase().startsWith('zh'));
  fillVoiceSelect(enSel, enVoices, _selEn);
  fillVoiceSelect(yueSel, yueVoices, _selYue);
}
function toggleEnVoicePanel(e) {
  if (e) e.stopPropagation();
  // The voice button lives inside the ⋯ sheet on a phone. Leaving the sheet
  // open behind the panel would stack two popovers on a 375px screen.
  closeEnHeaderMore();
  const p = $('en-voice-panel');
  if (p) p.classList.toggle('en-hidden');
}
function setEnVoice(lang, name) {
  if (lang === 'en') { _selEn = name; safeSet('en_voice_en', name); }
  else { _selYue = name; safeSet('en_voice_yue', name); }
  // preview the chosen voice immediately
  speak(lang === 'en' ? 'Hello, good morning.' : '你好，早晨。', lang);
}
// Close the panel when tapping outside it.
document.addEventListener('click', (e) => {
  const p = $('en-voice-panel');
  if (!p || p.classList.contains('en-hidden')) return;
  const btn = $('en-voice-btn');
  if (p.contains(e.target) || (btn && btn.contains(e.target))) return;
  p.classList.add('en-hidden');
});

// ---- Phone header sheet (⋯) ------------------------------------------------
// Below 600px the language pills, the voice picker, the install button and the
// 粵語版 link all live in this sheet — the same arrangement the Cantonese site
// uses. On a wide screen every function here is a no-op: the button is
// display:none and the controls are already inline in the header bar.
function toggleEnHeaderMore(e) {
  if (e) e.stopPropagation();
  const extra = $('en-header-extra');
  const btn = $('en-more-btn');
  if (!extra) return;
  const open = extra.classList.toggle('open');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  // Only one popover at a time — two stacked on a phone is a trap.
  if (open) {
    const p = $('en-voice-panel');
    if (p) p.classList.add('en-hidden');
  }
}

function closeEnHeaderMore() {
  const extra = $('en-header-extra');
  const btn = $('en-more-btn');
  if (!extra || !extra.classList.contains('open')) return;
  extra.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (e) => {
  const extra = $('en-header-extra');
  if (!extra || !extra.classList.contains('open')) return;
  const btn = $('en-more-btn');
  if (extra.contains(e.target) || (btn && btn.contains(e.target))) return;
  closeEnHeaderMore();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeEnHeaderMore();
});

// ---- Navigation -------------------------------------------------------------
function enNavigate(view) {
  document.querySelectorAll('.en-view').forEach((v) => v.classList.remove('active'));
  const el = $('view-' + view);
  if (el) el.classList.add('active');
  document.querySelectorAll('#en-nav button').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  window.scrollTo(0, 0);
  if (view === 'home') renderHomeQuick();
  if (view === 'learn') renderLearn();
  if (view === 'practice') renderPractice();
  if (view === 'progress') renderProgress();
}

function enGoLearn() { enNavigate('learn'); }
function enGoPractice() { enNavigate('practice'); }

// ---- Language switching (chrome + content) ---------------------------------
const STATIC_TEXT = {
  'brand-sub': 'brand.sub',
  'back-canto': 'back.canto',
  'hero-title': 'hero.title',
  'hero-sub': 'hero.sub',
  'home-quick-title': 'learn.title',
  'learn-title': 'learn.title',
  'practice-title': 'practice.title',
  'practice-sub': 'practice.sub',
  'quiz-title': 'quiz.title',
  'scenario-title': 'scenario.title',
  'progress-title': 'progress.title',
  'nav-home': 'nav.home',
  'nav-learn': 'nav.learn',
  'nav-practice': 'nav.practice',
  'nav-progress': 'nav.progress',
  'browse-quiz-btn': 'btn.quiz',
  'browse-back': 'btn.back',
  'quiz-back': 'btn.back',
  'scenario-back': 'btn.back',
};

function renderLangSwitch() {
  const wrap = $('en-lang');
  wrap.innerHTML = EN_LANGS.map(
    (l) => `<button class="${l.code === enCurrentLang() ? 'active' : ''}" onclick="setEnLang('${l.code}');renderLangSwitch();applyStaticLang();renderLearn();renderPractice();closeEnHeaderMore();">${l.label}</button>`
  ).join('');
}

function applyStaticLang() {
  for (const id of Object.keys(STATIC_TEXT)) {
    const el = $(id);
    if (el) el.textContent = enT(STATIC_TEXT[id]);
  }
  // Hero CTAs
  const ctas = document.querySelectorAll('.en-hero .en-cta');
  if (ctas[0]) ctas[0].textContent = enT('hero.cta1');
  if (ctas[1]) ctas[1].textContent = enT('hero.cta2');
}

// ---- Rendering --------------------------------------------------------------
function categoryName(c) {
  const lang = enCurrentLang();
  if (lang === 'yue') return c.name_yue || c.name_en;
  if (lang === 'zh') return c.name_zh || c.name_en;
  if (lang === 'fil') return c.name_fil || c.name_en;
  if (lang === 'id') return c.name_id || c.name_en;
  return c.name_en;
}

function renderHomeQuick() {
  const featured = [1, 3, 8, 9]; // Greetings, Kitchen, Shopping Goods, Emergency
  const grid = $('home-quick');
  grid.innerHTML = STATE.categories
    .filter((c) => featured.includes(c.id))
    .map((c) => {
      const count = STATE.words.filter((w) => w.category_id === c.id).length;
      return `<div class="en-cat" onclick="openCategory(${c.id})">
        <div class="ic">${escapeHtml(c.icon || '📁')}</div>
        <div class="nm">${escapeHtml(categoryName(c))}</div>
        <div class="ct">${enT('learn.words', { n: count })}</div>
      </div>`;
    }).join('');
}

function renderLearn() {
  const grid = $('learn-grid');
  if (!grid) return;
  grid.innerHTML = STATE.categories
    .map((c) => {
      const count = STATE.words.filter((w) => w.category_id === c.id).length;
      return `<div class="en-cat" onclick="openCategory(${c.id})">
        <div class="ic">${escapeHtml(c.icon || '📁')}</div>
        <div class="nm">${escapeHtml(categoryName(c))}</div>
        <div class="ct">${enT('learn.words', { n: count })}</div>
      </div>`;
    }).join('');
}

function openCategory(id) {
  STATE.currentCat = id;
  const cat = STATE.categories.find((c) => c.id === id);
  if ($('browse-title')) $('browse-title').textContent = cat ? categoryName(cat) : enT('browse.title');
  renderBrowse();
  enNavigate('browse');
}

function renderBrowse() {
  const list = $('browse-list');
  if (!list) return;
  const words = STATE.words.filter((w) => w.category_id === STATE.currentCat);
  list.innerHTML = words
    .map(
      (w) => `
      <div class="en-word">
        <div class="top">
          <span class="emoji">${escapeHtml(w.emoji || '📝')}</span>
          <span class="en">${escapeHtml(w.english)}</span>
        </div>
        <div class="ph">${escapeHtml(w.phonetic || '')}</div>
        <div class="yue">${escapeHtml(w.cantonese || '')}</div>
        <div class="en-audio-row">
          <button class="en-audio" onclick="speak('${escapeHtml(w.english.replace(/'/g, "\\'"))}', 'en')">🔊 ${enT('btn.listenEn')}</button>
          <button class="en-audio" onclick="speak('${escapeHtml(w.cantonese.replace(/'/g, "\\'"))}', 'yue')">🔊 ${enT('btn.listenYue')}</button>
        </div>
      </div>`
    )
    .join('');
}

function renderPractice() {
  const list = $('practice-list');
  if (!list) return;
  list.innerHTML = STATE.scenarios
    .map(
      (s) => `<div class="en-scn" onclick="openScenario(${s.id})">
        <span class="ic">${escapeHtml(s.icon || '💬')}</span>
        <span><span class="nm">${escapeHtml(categoryName(s))}</span><br><span class="ds">${escapeHtml(s.description || '')}</span></span>
      </div>`
    )
    .join('');
}

function openScenario(id) {
  const list = $('scenario-list');
  if (!list) return;
  const phrases = STATE.words.filter((w) => w.type === 'sentence' && w.scenario_id === id);
  list.innerHTML = phrases
    .map(
      (w) => `
      <div class="en-word">
        <div class="top">
          <span class="emoji">${escapeHtml(w.emoji || '💬')}</span>
          <span class="en">${escapeHtml(w.english)}</span>
        </div>
        <div class="ph">${escapeHtml(w.phonetic || '')}</div>
        <div class="yue">${escapeHtml(w.cantonese || '')}</div>
        <div class="en-audio-row">
          <button class="en-audio" onclick="speak('${escapeHtml(w.english.replace(/'/g, "\\'"))}', 'en')">🔊 ${enT('btn.listenEn')}</button>
          <button class="en-audio" onclick="speak('${escapeHtml(w.cantonese.replace(/'/g, "\\'"))}', 'yue')">🔊 ${enT('btn.listenYue')}</button>
        </div>
      </div>`
    )
    .join('');
  // Listening quiz over this scenario's sentences.
  list.innerHTML += `<button class="en-cta" style="width:100%;margin-top:10px" onclick="enStartScenarioQuiz(${id})">${enT('btn.quiz')}</button>`;
  enNavigate('scenario');
}

// ---- Progress: sticker album (mirrors the Cantonese "My Progress" look) -----
// These are achievement stickers derived from the learner's OWN progress — no
// server credits needed. They unlock as the elder practises, and render in the
// same tinted-shelf / sticker-tile style as the Cantonese album.
const EN_SHELF_TITLES = {
  first:    { yue: '起步獎章', zh: '起步奖章', fil: 'Unang Hakbang', id: 'Permulaan' },
  everyday: { yue: '日常練習', zh: '日常练习', fil: 'Araw-araw', id: 'Harian' },
  out:      { yue: '出街買餸', zh: '出门买菜', fil: 'Labas', id: 'Keluar' },
  local:    { yue: '高手級', zh: '高手级', fil: 'Marunong', id: 'Mahir' },
};

const EN_STICKERS = [
  { key: 'listen1', emoji: '🎧', tier: 'first', name: { yue: '第一次聽', zh: '第一次听', fil: 'Unang Paking', id: 'Dengar' }, sub: '聽過 1 個詞', test: (s) => s.seen >= 1 },
  { key: 'hello', emoji: '👋', tier: 'first', name: { yue: '講句你好', zh: '说句你好', fil: 'Sabi Hello', id: 'Kata Hi' }, sub: '打招呼', test: (s) => s.catDone('greet') },
  { key: 'numbers', emoji: '🔢', tier: 'first', name: { yue: '學數目', zh: '学数目', fil: 'Mga Numero', id: 'Nombor' }, sub: '數字 1–100', test: (s) => s.seen >= 12 },
  { key: 'words10', emoji: '📚', tier: 'everyday', name: { yue: '10 個詞', zh: '10 个词', fil: '10 Salita', id: '10 Kata' }, sub: '練習 10 個', test: (s) => s.seen >= 10 },
  { key: 'correct10', emoji: '✅', tier: 'everyday', name: { yue: '啱 10 次', zh: '对 10 次', fil: 'Tama 10', id: 'Betul 10' }, sub: '答對 10 次', test: (s) => s.correct >= 10 },
  { key: 'scn1', emoji: '💬', tier: 'everyday', name: { yue: '首個情景', zh: '首个情景', fil: 'Unang Sitemap', id: 'Satu Skenario' }, sub: '練習 1 個情景', test: (s) => s.scenarioSeen >= 1 },
  { key: 'kitchen', emoji: '🍳', tier: 'out', name: { yue: '廚房用語', zh: '厨房用语', fil: 'Kusina', id: 'Dapur' }, sub: '廚房詞語', test: (s) => s.catDone('kitchen') },
  { key: 'shop', emoji: '🛒', tier: 'out', name: { yue: '買嘢用語', zh: '买东西用语', fil: 'Pamilihan', id: 'Belanja' }, sub: '購物詞語', test: (s) => s.catDone('shop') },
  { key: 'laundry', emoji: '🧺', tier: 'out', name: { yue: '洗衣晾衫', zh: '洗衣晾衣', fil: 'Labahan', id: 'Dobi' }, sub: '洗衣露台', test: (s) => s.catDone('laund') },
  { key: 'perfect', emoji: '🏆', tier: 'local', name: { yue: '暫時零錯', zh: '暂时零错', fil: 'Perfect', id: 'Semua Betul' }, sub: '答啱晒', test: (s) => s.quizPerfect },
  { key: 'words50', emoji: '🌟', tier: 'local', name: { yue: '50 個詞', zh: '50 个词', fil: '50 Salita', id: '50 Kata' }, sub: '練習 50 個', test: (s) => s.seen >= 50 },
  { key: 'allScn', emoji: '👑', tier: 'local', name: { yue: '全部情景', zh: '全部情景', fil: 'Lahat', id: 'Semua' }, sub: '完成 12 個情景', test: (s) => s.scenarioSeen >= 12 },
];

// Build a snapshot of what the learner has achieved, from STATE.progress +
// the category/scenario word lists. `catDone(n)` is true when ~80% of a
// category's words have been practised at least once.
function computeProgressSummary() {
  const entries = Object.values(STATE.progress);
  const seen = entries.length;
  const correct = entries.reduce((a, p) => a + (p.correct || 0), 0);
  const byCat = {};
  const byScn = {};
  STATE.words.forEach((w) => {
    if (w.type === 'word') {
      byCat[w.category_id] = byCat[w.category_id] || { total: 0, done: 0 };
      byCat[w.category_id].total++;
      if (STATE.progress[w.id]) byCat[w.category_id].done++;
    } else if (w.type === 'sentence') {
      byScn[w.scenario_id] = byScn[w.scenario_id] || { total: 0, done: 0 };
      byScn[w.scenario_id].total++;
      if (STATE.progress[w.id]) byScn[w.scenario_id].done++;
    }
  });
  const catDone = (needle) => {
    const c = STATE.categories.find((x) => x.name_en && x.name_en.toLowerCase().includes(needle.toLowerCase()));
    if (!c || !byCat[c.id]) return false;
    const g = byCat[c.id];
    return g.total > 0 && g.done >= Math.ceil(g.total * 0.8);
  };
  const scenarioSeen = Object.keys(byScn).filter((k) => byScn[k].done > 0).length;
  const quizPerfect = seen > 0 && correct === seen;
  return { seen, correct, catDone, scenarioSeen, quizPerfect };
}

function renderProgress() {
  const body = $('progress-body');
  if (!body) return;
  const entries = Object.values(STATE.progress);
  const total = STATE.words.length; // words + sentences in the English track
  const seen = entries.length; // distinct items practised at least once
  const attempts = entries.reduce((a, p) => a + (p.seen || 0), 0);
  const rights = entries.reduce((a, p) => a + (p.correct || 0), 0);
  const accuracy = attempts ? Math.round((rights / attempts) * 100) : 0;
  const pct = total ? Math.round((seen / total) * 100) : 0;
  const lang = (typeof enCurrentLang === 'function' && enCurrentLang()) || 'yue';
  if (seen === 0) {
    body.innerHTML = `<div class="en-progress-card">${enT('progress.empty')}</div>
    <button class="en-reset-btn" onclick="enResetProgress()">${enT('progress.reset')}</button>`;
    return;
  }
  const s = computeProgressSummary();
  const tiers = ['first', 'everyday', 'out', 'local'];
  let album = '<div class="sticker-album">';
  for (const tier of tiers) {
    const list = EN_STICKERS.filter((st) => st.tier === tier);
    const got = list.filter((st) => st.test(s)).length;
    const tiles = list
      .map((st) => {
        const unlocked = st.test(s);
        const name = st.name[lang] || st.name.yue;
        if (unlocked) {
          return `<div class="sticker-tile tier-${tier} is-unlocked">
              <span class="sticker-emoji">${st.emoji}</span>
              <span class="sticker-name">${escapeHtml(name)}</span>
              <span class="sticker-canto">${escapeHtml(st.sub)}</span>
            </div>`;
        }
        return `<div class="sticker-tile tier-${tier} is-locked" title="${enT('progress.locked')}">
            <span class="sticker-emoji">${st.emoji}</span>
            <span class="sticker-name">${escapeHtml(name)}</span>
            <span class="sticker-cost">🔒</span>
          </div>`;
      })
      .join('');
    album += `<div class="sticker-shelf">
        <div class="sticker-shelf-title"><span>${escapeHtml(EN_SHELF_TITLES[tier][lang] || EN_SHELF_TITLES[tier].yue)}</span><span class="sticker-shelf-count">${got}/${list.length}</span></div>
        <div class="sticker-grid">${tiles}</div>
      </div>`;
  }
  album += '</div>';
  body.innerHTML = `
    <div class="en-progress-bar"><div class="en-progress-bar-fill" style="width:${pct}%"></div></div>
    <div class="en-progress-pct">${enT('progress.practicedPct', { pct, seen, total })}</div>
    <div class="en-grid3">
      <div class="en-progress-card"><div class="big">${seen}</div>${enT('progress.seen', { n: seen })}</div>
      <div class="en-progress-card"><div class="big">${rights}</div>${enT('progress.correctTotal', { n: rights })}</div>
      <div class="en-progress-card"><div class="big">${accuracy}%</div>${enT('progress.accuracy')}</div>
    </div>
    ${album}
    <button class="en-reset-btn" onclick="enResetProgress()">${enT('progress.reset')}</button>`;
}

/**
 * Reset ALL English-track progress for this device. Asks for confirmation first
 * (the action is irreversible), then clears server-side rows and the local
 * STATE.progress, and re-renders the (now empty) progress page.
 */
function enResetProgress() {
  if (!window.confirm(enT('progress.resetConfirm'))) return;
  apiDelete('/api/en/progress', { device_id: STATE.deviceId })
    .catch(() => {})
    .then(() => {
      STATE.progress = {};
      renderProgress();
    });
}

// ---- Quiz (tap the correct Cantonese meaning) -------------------------------
// Works for both word categories (groupType 'cat') and scenario sentences
// (groupType 'scn'). The quiz is always a LISTENING test: hear the English,
// pick the Cantonese meaning — never read the English, never hear Cantonese.
function enStartQuiz(catId) {
  const pool = STATE.words.filter((w) => w.type === 'word' && w.category_id === catId);
  startQuiz(pool, 'cat', catId);
}

function enStartScenarioQuiz(scId) {
  const pool = STATE.words.filter((w) => w.type === 'sentence' && w.scenario_id === scId);
  startQuiz(pool, 'scn', scId);
}

function startQuiz(pool, groupType, groupId) {
  if (!pool || pool.length === 0) return;
  const items = pool.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(10, pool.length));
  STATE.quiz = { items, idx: 0, correctCount: 0, groupType, groupId };
  enNavigate('quiz');
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const q = STATE.quiz;
  if (!q) return;
  if (q.idx >= q.items.length) {
    $('quiz-word').textContent = enT('quiz.done');
    $('quiz-ph').textContent = '';
    $('quiz-feedback').textContent = enT('quiz.score', { n: q.correctCount, t: q.items.length });
    $('quiz-feedback').className = 'en-feedback ok';
    $('quiz-options').innerHTML = `<button class="en-cta" style="width:100%" onclick="enRestartQuiz()">${enT('quiz.again')}</button>`;
    $('quiz-progress').textContent = '';
    // Offer the install at the moment she has just had a good experience.
    enMaybeOfferInstall();
    return;
  }
  const w = q.items[q.idx];
  // LISTENING TEST ONLY: never show the written English and never play
  // Cantonese. The learner HEARS the English word, then taps the correct
  // Cantonese meaning. No reading, no Cantonese audio.
  const enEsc = escapeHtml(w.english.replace(/'/g, "\\'"));
  $('quiz-word').innerHTML =
    `<button class="en-quiz-play" onclick="speak('${enEsc}', 'en')">🔊 ${enT('quiz.listen')}</button>`;
  $('quiz-ph').innerHTML = '';
  // Auto-play the English audio (the tap that opened the quiz counts as the
  // user gesture browsers require before speechSynthesis is allowed).
  speak(w.english, 'en');
  $('quiz-feedback').textContent = '';
  $('quiz-feedback').className = 'en-feedback';
  $('quiz-progress').textContent = (q.idx + 1) + ' / ' + q.items.length;
  // Build 4 options: the correct Cantonese + 3 distractors from the SAME group
  // (same category or same scenario), with a fallback to any other entry so we
  // always reach 4 options even in small scenarios.
  const inGroup = (x) =>
    q.groupType === 'cat' ? x.category_id === q.groupId : x.scenario_id === q.groupId;
  let distractors = STATE.words
    .filter((x) => x.id !== w.id && inGroup(x))
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((x) => x.cantonese);
  if (distractors.length < 3) {
    const extra = STATE.words
      .filter((x) => x.id !== w.id && distractors.indexOf(x.cantonese) === -1)
      .sort(() => Math.random() - 0.5);
    for (const x of extra) {
      if (distractors.length >= 3) break;
      distractors.push(x.cantonese);
    }
  }
  let opts = [w.cantonese, ...distractors].sort(() => Math.random() - 0.5);
  $('quiz-options').innerHTML = opts
    .map(
      (o) => `<button class="en-opt" data-correct="${o === w.cantonese ? '1' : '0'}" onclick="enQuizAnswer(this, ${w.id}, '${escapeHtml(w.cantonese.replace(/'/g, "\\'"))}')">${escapeHtml(o)}</button>`
    )
    .join('');
}

// Restart the quiz for whichever group (category or scenario) was being tested.
function enRestartQuiz() {
  const q = STATE.quiz;
  if (!q) return;
  if (q.groupType === 'scn') enStartScenarioQuiz(q.groupId);
  else enStartQuiz(q.groupId);
}

function enQuizAnswer(btn, vocabId, correctYue) {
  const chosen = btn.textContent;
  const isCorrect = chosen === correctYue;
  if (isCorrect) {
    btn.classList.add('correct');
    STATE.quiz.correctCount += 1;
    $('quiz-feedback').textContent = enT('quiz.correct');
    $('quiz-feedback').className = 'en-feedback ok';
  } else {
    btn.classList.add('wrong');
    $('quiz-feedback').textContent = enT('quiz.wrong');
    $('quiz-feedback').className = 'en-feedback no';
    // reveal the correct one
    document.querySelectorAll('#quiz-options .en-opt').forEach((o) => {
      if (o.dataset.correct === '1') o.classList.add('correct');
    });
  }
  // record progress
  const ok = isCorrect;
  STATE.progress[vocabId] = STATE.progress[vocabId] || { seen: 0, correct: 0 };
  STATE.progress[vocabId].seen += 1;
  if (ok) STATE.progress[vocabId].correct += 1;
  apiPost('/api/en/progress', { device_id: STATE.deviceId, vocab_id: vocabId, correct: ok }).catch(() => {});
  // lock options briefly, then next
  document.querySelectorAll('#quiz-options .en-opt').forEach((o) => (o.disabled = true));
  setTimeout(() => {
    STATE.quiz.idx += 1;
    renderQuizQuestion();
  }, 900);
}

// ---- PWA install (English track) -------------------------------------------
// Mirrors the Cantonese app's install flow: hold Chrome's beforeinstallprompt,
// offer a one-tap install on Android, and show step-by-step "Add to Home Screen"
// guidance on iPhone/Safari (which has no install API) and an honest message
// inside in-app webviews. The SW (/sw.js, scope "/") and manifest already cover
// /en, so only the UI/triggering lives here. Ask-once, remembered locally.

const EN_INSTALL_KEY = 'cb_en_install'; // 'installed' | 'dismissed'
let enDeferredInstall = null;

function enIsInstalled() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;
}
function enIsIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function enIsInAppBrowser() {
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|MicroMessenger|Twitter|Viber|; wv\)/i.test(navigator.userAgent);
}
function enInstallAnswered() {
  try { return Boolean(localStorage.getItem(EN_INSTALL_KEY)); } catch (e) { return false; }
}
function enMarkInstallAnswered(state) {
  try { localStorage.setItem(EN_INSTALL_KEY, state); } catch (e) {}
}

function enRenderInstallModal() {
  const body = $('en-install-body');
  const title = $('en-install-title');
  const lead = $('en-install-lead');
  const add = $('en-install-add');
  const later = $('en-install-later');
  if (!body || !title || !lead || !add || !later) return;
  const steps = (lines) => `<ol class="en-install-steps">${lines.map((l) => `<li>${l}</li>`).join('')}</ol>`;

  if (enIsInAppBrowser()) {
    add.style.display = 'none';
    later.textContent = enT('install.gotIt');
    title.textContent = enT('install.inappTitle');
    lead.textContent = '';
    body.innerHTML = `<p class="en-install-note">${enT('install.inappBody')}</p>`;
    return;
  }
  if (enDeferredInstall) {
    add.style.display = '';
    add.textContent = enT('install.add');
    later.textContent = enT('install.notNow');
    title.textContent = enT('install.title');
    lead.textContent = enT('install.lead');
    body.innerHTML = '';
    return;
  }
  add.style.display = 'none';
  later.textContent = enT('install.gotIt');
  title.textContent = enT('install.title');
  lead.textContent = enT('install.lead');
  if (enIsIOS()) {
    body.innerHTML = `<div class="en-install-sub">${enT('install.iosTitle')}</div>` +
      steps([enT('install.ios1'), enT('install.ios2'), enT('install.ios3')]);
  } else {
    body.innerHTML = `<div class="en-install-sub">${enT('install.androidTitle')}</div>` +
      steps([enT('install.android1'), enT('install.android2')]);
  }
}

function enOpenInstallModal() {
  if (enIsInstalled()) return;
  enRenderInstallModal();
  const m = $('en-install-modal'); if (m) m.classList.add('show');
}
function enCloseInstallModal(e) {
  if (e && e.target !== e.currentTarget) return;
  enDismissInstall();
}
function enDismissInstall() {
  enMarkInstallAnswered('dismissed');
  const m = $('en-install-modal'); if (m) m.classList.remove('show');
  enSyncInstallEntry();
}
async function enDoInstall() {
  const ev = enDeferredInstall;
  if (!ev) return;
  enDeferredInstall = null;
  const m = $('en-install-modal'); if (m) m.classList.remove('show');
  try {
    ev.prompt();
    const choice = await ev.userChoice;
    enMarkInstallAnswered(choice && choice.outcome === 'accepted' ? 'installed' : 'dismissed');
  } catch (e) {
    enMarkInstallAnswered('dismissed');
  }
}
function enSyncInstallEntry() {
  const btn = $('en-install-btn');
  if (!btn) return;
  if (enIsInstalled() || enInstallAnswered()) { btn.hidden = true; return; }
  btn.hidden = !(enIsIOS() || Boolean(enDeferredInstall));
}
function enMaybeOfferInstall() {
  if (enIsInstalled() || enInstallAnswered()) return;
  enOpenInstallModal();
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  enDeferredInstall = e;
  enSyncInstallEntry();
});
window.addEventListener('appinstalled', () => {
  enMarkInstallAnswered('installed');
  enDeferredInstall = null;
  const m = $('en-install-modal'); if (m) m.classList.remove('show');
  enSyncInstallEntry();
});

// ---- Init -------------------------------------------------------------------
async function init() {
  STATE.deviceId = loadDeviceId();
  renderLangSwitch();
  applyStaticLang();
  enSyncInstallEntry();   // show/hide the header "Add to Home" button correctly
  populateVoiceSelects(); // fill voice <select>s if voices are already available
  window.onEnLangChange = () => { applyStaticLang(); renderLearn(); renderPractice(); renderProgress(); };

  const loadingMsg = '<div class="en-progress-card">載入中… · Loading…</div>';
  if ($('home-quick')) $('home-quick').innerHTML = loadingMsg;
  if ($('learn-grid')) $('learn-grid').innerHTML = loadingMsg;
  if ($('practice-list')) $('practice-list').innerHTML = loadingMsg;

  try {
    const [cats, words, scns, prog] = await Promise.all([
      apiGet('/api/en/categories'),
      apiGet('/api/en/vocabulary'),
      apiGet('/api/en/scenarios'),
      apiGet('/api/en/progress?device=' + encodeURIComponent(STATE.deviceId)),
    ]);
    STATE.categories = cats;
    STATE.words = words;          // now includes BOTH words and sentences
    STATE.scenarios = scns;
    STATE.progress = prog || {};
  } catch (e) {
    console.error('Failed to load English track data', e);
    const err = '<div class="en-progress-card">資料未能載入，請重試 · Failed to load. Please retry.</div>';
    if ($('home-quick')) $('home-quick').innerHTML = err;
    if ($('learn-grid')) $('learn-grid').innerHTML = err;
    if ($('practice-list')) $('practice-list').innerHTML = err;
    return;
  }
  renderHomeQuick();
  renderLearn();
  renderPractice();

  // Register the service worker so /en is installable and works offline. The SW
  // (scope "/") is shared with the Cantonese app, so this is idempotent.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
