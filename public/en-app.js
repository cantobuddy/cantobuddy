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
 *
 * Phase 1 of EN-ROADMAP.md adds the elder companion: a Today view (daily reads,
 * jokes, 生活小常識, 中國智慧故事, helper-voice cards, live official HK weather,
 * emoji share cards) and a Help view (big 999 target, verified hotlines, local
 * medication reminders). 繁/簡 now also switches the MEANING script via the new
 * `meaning_sc` column — see readingMeaning() below.
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
  elder: null,        // /api/en/elder/content payload (read-only editorial)
  help: null,         // /api/en/elder/help payload (verified numbers)
  todayHk: null,      // /api/today-in-hk (live official HKO + 1823 data)
  todayTab: 'all',
  mood: null,
  shareItem: null,    // the content item the reader chose to share
  reminders: [],      // localStorage only — never leaves this device
};

const $ = (id) => document.getElementById(id);
const escapeHtml = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * §0b — which Chinese script to show for a word's meaning.
 *
 * `cantonese` is the Traditional source of truth (Hong Kong, the majority of
 * our elders). `meaning_sc` is its Simplified twin, stored by en.js so the
 * browser needs no converter table. The Fil/Indo UI languages are for helpers
 * reading the CHROME; the teaching content stays Chinese, so they fall back to
 * Traditional just as the app did before this release.
 */
function readingMeaning(w) {
  if (!w) return '';
  if (enCurrentLang() === 'zh' && w.meaning_sc) return w.meaning_sc;
  return w.cantonese || '';
}

/** Pick the tc / sc / en branch of an elder content item for the UI language. */
function elderText(entry) {
  if (!entry) return { title: '', body: '' };
  const lang = enCurrentLang();
  if (lang === 'zh') return entry.sc || entry.tc || entry.en;
  if (lang === 'fil' || lang === 'id') return entry.en || entry.tc;
  return entry.tc || entry.en;
}

/**
 * The reader's script for ANY localised material — live weather, official links
 * and source labels alike. 繁→tc, 簡→sc, Fil/Indo UI→en. Keeping one resolver
 * means a Chinese reader never silently gets an English wall of text.
 */
function elderScript() {
  const lang = enCurrentLang();
  if (lang === 'zh') return 'sc';
  if (lang === 'yue') return 'tc';
  return 'en';
}

/** Language-matched official URL. Falls back to the API's English `url`. */
function elderUrl(entry) {
  if (!entry) return '';
  const s = elderScript();
  const local = s === 'tc' ? entry.urlTc : s === 'sc' ? entry.urlSc : entry.urlEn;
  return local || entry.url || '';
}

/** Language-matched source label, falling back to the English label. */
function elderLabel(entry) {
  if (!entry) return '';
  const s = elderScript();
  const local = s === 'tc' ? entry.labelTc : s === 'sc' ? entry.labelSc : null;
  return local || entry.label || '';
}

/** Language-matched "official website" link on a help-directory entry. */
function elderWeb(entry) {
  if (!entry) return '';
  const s = elderScript();
  const local = s === 'tc' ? entry.webTc : s === 'sc' ? entry.webSc : null;
  return local || entry.web || '';
}

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

// ---- TTS (English + Cantonese ONLY, never Mandarin) ------------------------
let _voices = [];
// localStorage can throw in private-mode / blocked-storage browsers; never let
// that blank the whole page, so wrap every access.
function safeGet(key) { try { return (typeof localStorage !== 'undefined') ? localStorage.getItem(key) : ''; } catch (e) { return ''; } }
function safeSet(key, val) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, val); } catch (e) {} }
let _selEn = safeGet('en_voice_en') || '';
let _selYue = safeGet('en_voice_yue') || '';

/**
 * A genuine Cantonese voice. `zh-CN` / `cmn` Mandarin voices are deliberately
 * excluded: an elder in Hong Kong asked for Cantonese, and a Mandarin fallback
 * is worse than an honest "please install a Cantonese voice" message.
 */
function isCantoneseVoice(v) {
  const l = String((v && v.lang) || '').toLowerCase().replace(/_/g, '-');
  const n = String((v && v.name) || '').toLowerCase();
  return /(^|-)yue(-|$)/.test(l) ||
    /^zh-(hk|hant-hk)(-|$)/.test(l) ||
    /cantonese|粵語|粤语|廣東話|广东话/.test(n);
}

function loadVoices() {
  if ('speechSynthesis' in window) {
    _voices = window.speechSynthesis.getVoices() || [];
    // An earlier release could store a Mandarin voice under this key. Drop it.
    if (_selYue && !_voices.some((v) => v.name === _selYue && isCantoneseVoice(v))) {
      _selYue = '';
      safeSet('en_voice_yue', '');
    }
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
    if (isCantoneseVoice(v)) s += 6;
    if (/google|microsoft|neural|premium|female|natural|sinji|mei|ting|ya|hong|kong/i.test(name)) s += 3;
    if (/espeak|robot|default|compact|espeakng/i.test(name)) s -= 3;
  }
  return s;
}
function pickVoice(lang) {
  const pool = lang === 'en'
    ? _voices.filter((v) => String(v.lang || '').toLowerCase().startsWith('en'))
    : _voices.filter(isCantoneseVoice);
  if (!pool.length) return null;
  pool.sort((a, b) => scoreVoice(b, lang) - scoreVoice(a, lang));
  return pool[0];
}
function speak(text, lang) {
  if (!('speechSynthesis' in window)) { alert(enT('noAudio')); return; }
  if (!_voices.length) loadVoices();
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  if (lang === 'en') {
    let v = _selEn
      ? _voices.find((x) => x.name === _selEn && String(x.lang || '').toLowerCase().startsWith('en')) || null
      : null;
    if (!v) v = pickVoice('en');
    if (v) u.voice = v;
    u.lang = (v && v.lang) || 'en-US';
  } else {
    // Every Chinese string in this app is read in Cantonese, including 简体.
    let v = _selYue
      ? _voices.find((x) => x.name === _selYue && isCantoneseVoice(x)) || null
      : null;
    if (!v) v = pickVoice('yue');
    if (!v) { alert(enT('noCantoneseVoice')); return; }
    u.voice = v;
    u.lang = v.lang || 'zh-HK';
  }
  window.speechSynthesis.speak(u);
}

/**
 * Speak the meaning in the reader's CURRENT script (§0b). Passing the id rather
 * than an interpolated string also removes the inline-quote escaping the old
 * audio buttons needed — a meaning can now safely contain an apostrophe.
 */
function speakReading(vocabId, lang) {
  const w = STATE.words.find((x) => x.id === Number(vocabId));
  if (w) speak(readingMeaning(w), lang);
}

// ---- Voice chooser (top menu) ----------------------------------------------
function fillVoiceSelect(sel, voices, selected, emptyLabel) {
  sel.innerHTML = '';
  if (!voices.length) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = emptyLabel || '(呢部機無語音 / no voice)';
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
  const enVoices = _voices.filter((v) => String(v.lang || '').toLowerCase().startsWith('en'));
  const yueVoices = _voices.filter(isCantoneseVoice);
  fillVoiceSelect(enSel, enVoices, _selEn);
  fillVoiceSelect(yueSel, yueVoices, _selYue, enT('noCantoneseVoice'));
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
  if (lang === 'yue') {
    const v = _voices.find((x) => x.name === name);
    if (!v || !isCantoneseVoice(v)) { alert(enT('noCantoneseVoice')); return; }
    _selYue = name;
    safeSet('en_voice_yue', name);
    speak('你好，早晨。', 'yue');
    return;
  }
  _selEn = name;
  safeSet('en_voice_en', name);
  speak('Hello, good morning.', 'en');
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
  if (view === 'home') { renderHomeQuick(); renderHomeToday(); }
  if (view === 'learn') renderLearn();
  if (view === 'practice') renderPractice();
  if (view === 'progress') renderProgress();
  if (view === 'today') renderToday();
  if (view === 'help') renderHelp();
}

function enGoLearn() { enNavigate('learn'); }
function enGoPractice() { enNavigate('practice'); }

// ---- Language switching (chrome + content) ---------------------------------
const STATIC_TEXT = {
  'brand-sub': 'brand.sub',
  'back-canto': 'back.canto',
  'hero-title': 'hero.title',
  'hero-sub': 'hero.sub',
  'hero-chip': 'hero.chip',
  'hero-bold': 'hero.bold',
  'hero-rest': 'hero.rest',
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
  'nav-today': 'nav.today',
  'nav-help': 'nav.help',
  'home-help-cta': 'home.help',
  'home-today-kicker': 'home.todayKicker',
  'home-today-btn': 'home.todayBtn',
  'reading-note': 'learn.readingNote',
  'today-title': 'today.title',
  'mood-kicker': 'today.moodKicker',
  'mood-title': 'today.moodTitle',
  'mood-note': 'today.moodNote',
  'local-title': 'today.localTitle',
  'help-title': 'help.title',
  'reminder-title': 'help.reminderTitle',
  'reminder-note': 'help.reminderNote',
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
        <div class="yue">${escapeHtml(readingMeaning(w))}</div>
        <div class="en-audio-row">
          <button class="en-audio" onclick="speak('${escapeHtml(w.english.replace(/'/g, "\\'"))}', 'en')">🔊 ${enT('btn.listenEn')}</button>
          <button class="en-audio" onclick="speakReading(${w.id}, 'yue')">🔊 ${enT('btn.listenYue')}</button>
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
        <div class="yue">${escapeHtml(readingMeaning(w))}</div>
        <div class="en-audio-row">
          <button class="en-audio" onclick="speak('${escapeHtml(w.english.replace(/'/g, "\\'"))}', 'en')">🔊 ${enT('btn.listenEn')}</button>
          <button class="en-audio" onclick="speakReading(${w.id}, 'yue')">🔊 ${enT('btn.listenYue')}</button>
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
    .map((x) => readingMeaning(x));
  if (distractors.length < 3) {
    const extra = STATE.words
      .filter((x) => x.id !== w.id && distractors.indexOf(readingMeaning(x)) === -1)
      .sort(() => Math.random() - 0.5);
    for (const x of extra) {
      if (distractors.length >= 3) break;
      distractors.push(readingMeaning(x));
    }
  }
  // §0b: the answer AND the decoys are in the reader's chosen script. Mixing
  // Traditional and Simplified here would make the right answer obvious.
  const correctMeaning = readingMeaning(w);
  let opts = [correctMeaning, ...distractors].sort(() => Math.random() - 0.5);
  $('quiz-options').innerHTML = opts
    .map(
      (o) => `<button class="en-opt" data-correct="${o === correctMeaning ? '1' : '0'}" onclick="enQuizAnswer(this, ${w.id})">${escapeHtml(o)}</button>`
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

function enQuizAnswer(btn, vocabId) {
  const chosen = btn.textContent;
  // Resolve the answer at click time in the CURRENT reading script, so a
  // language switch mid-quiz cannot produce a false "wrong" mark.
  const correctYue = readingMeaning(STATE.words.find((x) => x.id === Number(vocabId)));
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

// ===========================================================================
// /en Phase 1 — elder companion (EN-ROADMAP.md)
//
// Everything in this block is READ-ONLY against the server (two editorial JSON
// endpoints + the existing official-weather endpoint). The only write is the
// medication reminder list, and that goes to localStorage on THIS device — it
// is never posted anywhere, has no device id, and cannot identify anyone.
//
// All server strings go through escapeHtml(). Share links are built from a
// fixed set of preset strings plus our own site URL, so there is no free-text
// input to escape, moderate or inject.
// ===========================================================================

const ELDER_KINDS = [
  { id: 'all', key: 'today.tabAll' },
  { id: 'joke', key: 'today.tabJoke' },
  { id: 'tip', key: 'today.tabTip' },
  { id: 'wisdom', key: 'today.tabWisdom' },
  { id: 'helper', key: 'today.tabHelper' },
];
const KIND_LABEL = {
  joke: 'elder.joke', tip: 'elder.tip', wisdom: 'elder.wisdom', helper: 'elder.helper',
};
const REMINDER_LABELS = [
  { id: 'morning', tc: '朝早食藥', sc: '早上吃药', en: 'Morning medicine' },
  { id: 'noon', tc: '中午食藥', sc: '中午吃药', en: 'Lunchtime medicine' },
  { id: 'evening', tc: '夜晚食藥', sc: '晚上吃药', en: 'Evening medicine' },
  { id: 'bedtime', tc: '睡前食藥', sc: '睡前吃药', en: 'Bedtime medicine' },
  { id: 'water', tc: '飲杯水', sc: '喝杯水', en: 'Drink some water' },
  { id: 'walk', tc: '落樓行吓', sc: '下楼走走', en: 'Go for a short walk' },
  { id: 'call', tc: '打畀屋企人', sc: '给家人打电话', en: 'Call the family' },
  { id: 'bp', tc: '量血壓', sc: '量血压', en: 'Check blood pressure' },
];
const REMINDER_KEY = 'en_reminders_v1';

/** String-valued content (moods, notes) picks a language differently from items. */
function noteText(n) {
  if (!n || typeof n !== 'object') return String(n || '');
  const lang = enCurrentLang();
  if (lang === 'zh') return n.sc || n.tc || n.en || '';
  if (lang === 'fil' || lang === 'id') return n.en || n.tc || '';
  return n.tc || n.en || '';
}
function reminderLabelText(l) { return noteText(l); }
function moodText(m) { return noteText(m); }

/** Hong Kong calendar day — the "done" tick resets at HKT midnight, not UTC. */
function hktToday() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function loadReminders() {
  try {
    const raw = safeGet(REMINDER_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((r) => r && r.id && r.time && r.label).slice(0, 20) : [];
  } catch (e) { return []; }
}
function saveReminders() {
  try { safeSet(REMINDER_KEY, JSON.stringify(STATE.reminders)); } catch (e) { /* storage blocked */ }
}

function elderItem(id) {
  return (STATE.elder && STATE.elder.items || []).find((x) => x.id === id) || null;
}
function elderItemCard(item) {
  const t = elderText(item);
  return `<div class="elder-card elder-item">
    <div class="elder-kicker">${escapeHtml(item.emoji || '📖')} ${escapeHtml(enT(KIND_LABEL[item.kind] || 'today.tabAll'))}</div>
    <div class="elder-title">${escapeHtml(t.title)}</div>
    <div class="elder-body">${escapeHtml(t.body)}</div>
    <div class="elder-row">
      <button class="elder-btn small" onclick="enSpeakItem('${escapeHtml(item.id)}')">${escapeHtml(enT('today.speak'))}</button>
      <button class="elder-btn small" onclick="enChooseShareItem('${escapeHtml(item.id)}')">${escapeHtml(enT('today.shareItem'))}</button>
    </div>
  </div>`;
}

function enSpeakItem(id) {
  const item = elderItem(id);
  if (!item) return;
  const t = elderText(item);
  const englishChrome = enCurrentLang() === 'fil' || enCurrentLang() === 'id';
  speak(t.body, englishChrome ? 'en' : 'yue');
}

// ---- Home teaser (A1) -------------------------------------------------------
function renderHomeToday() {
  const title = $('home-today-title');
  const body = $('home-today-body');
  if (!title || !body) return;
  const daily = STATE.elder && STATE.elder.daily;
  const item = daily && daily.picks && daily.picks.joke;
  if (!item) {
    title.textContent = enT('home.todayTitle');
    body.textContent = enT(STATE.elder ? 'elder.error' : 'elder.loading');
    return;
  }
  const t = elderText(item);
  title.textContent = '😄 ' + t.title;
  body.textContent = t.body;
}

// ---- Today ------------------------------------------------------------------
function renderToday() {
  renderTodayWeather();
  renderTodayDaily();
  renderTodayTabs();
  renderTodayItems();
  renderTodayMoods();
  renderTodayLocal();
  renderTodayShare();
}

/** An ISO date reads as English on a Chinese TTS voice; say it in Chinese. */
function holidayDateText(iso) {
  const s = String(iso || '');
  if (elderScript() === 'en' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split('-');
  return Number(parts[0]) + '年' + Number(parts[1]) + '月' + Number(parts[2]) + '日';
}

/**
 * One place resolves the official en / tc / sc fields. For 繁/簡 readers we
 * never fall back to the English strings: if the Chinese feeds are down, the
 * card says so in Chinese instead of showing a wall of unreadable English.
 */
function weatherParts() {
  const d = STATE.todayHk || {};
  const w = d.weather || {};
  const script = elderScript();
  const pick = (key) => {
    const suffix = script === 'tc' ? 'Tc' : script === 'sc' ? 'Sc' : '';
    const v = w[key + suffix];
    return v == null ? (key === 'warnings' ? [] : '') : v;
  };
  const rawWarnings = pick('warnings');
  const warnings = (Array.isArray(rawWarnings) ? rawWarnings : [rawWarnings])
    .map(String).filter(Boolean);
  const forecast = String(pick('forecast') || '');
  const outlook = String(pick('outlook') || '');
  const h = d.nextHoliday || null;
  const holidayName = !h ? '' : script === 'tc'
    ? String(h.nameTc || '')
    : script === 'sc' ? String(h.nameSc || '') : String(h.name || '');
  const englishWarnings = Array.isArray(w.warnings)
    ? w.warnings
    : (w.warnings ? [w.warnings] : []);
  const hasEnglishText = englishWarnings.length > 0 || !!w.forecast || !!w.outlook || !!(h && h.name);
  const hasChineseText = warnings.length > 0 || !!forecast || !!outlook || !!holidayName;
  return {
    d, w, script, holiday: h, holidayName, warnings, forecast, outlook,
    temp: w.temperatureC, humidity: w.humidityPct,
    hasEnglishText, hasChineseText,
  };
}

/** Big-tap "read the weather to me" — always Cantonese for a Chinese reader. */
function enSpeakWeather() {
  const p = weatherParts();
  const lines = [enT('today.weatherTitle')];
  if (p.temp != null) {
    lines.push(p.script === 'en'
      ? 'Temperature ' + p.temp + ' degrees'
      : enT('elder.temp') + ' ' + p.temp + '度');
  }
  if (p.humidity != null) {
    lines.push(p.script === 'en'
      ? 'Humidity ' + p.humidity + ' percent'
      : enT('elder.humidity') + ' ' + p.humidity);
  }
  if (p.warnings.length) lines.push(enT('elder.warnings') + '：' + p.warnings.join('，'));
  if (p.forecast) lines.push(enT('elder.forecast') + '：' + p.forecast);
  if (p.outlook) lines.push(enT('elder.outlook') + '：' + p.outlook);
  if (p.holidayName) {
    lines.push(enT('elder.holiday') + '：' + p.holidayName + '，' +
      holidayDateText(p.holiday && p.holiday.date));
  }
  if (p.script !== 'en' && !p.hasChineseText && p.hasEnglishText) {
    lines.push(enT('elder.weatherMissingZh'));
  }
  const text = lines.filter(Boolean).join('。') + '。';
  speak(text, p.script === 'en' ? 'en' : 'yue');
}

function renderTodayWeather() {
  const box = $('today-weather');
  if (!box) return;
  const p = weatherParts();
  const hasNumbers = p.temp != null || p.humidity != null;
  const has = hasNumbers || p.hasChineseText || (p.script !== 'en' && p.hasEnglishText);
  let html = `<div class="elder-card"><h3>🌤️ ${escapeHtml(enT('today.weatherTitle'))}</h3>`;
  if (!has) {
    const loaded = p.d && Object.keys(p.d).length > 0;
    html += `<p>${escapeHtml(enT(loaded ? 'today.weatherMissing' : 'elder.loading'))}</p>`;
  } else {
    const bits = [];
    if (p.temp != null) bits.push('🌡️ ' + enT('elder.temp') + ' ' + p.temp + '°C');
    if (p.humidity != null) bits.push('💧 ' + enT('elder.humidity') + ' ' + p.humidity + '%');
    if (bits.length) html += `<p>${escapeHtml(bits.join(' · '))}</p>`;
    if (p.warnings.length) {
      html += `<p>⚠️ ${escapeHtml(enT('elder.warnings'))}：${escapeHtml(p.warnings.join('、'))}</p>`;
    }
    if (p.forecast) {
      html += `<p><strong>${escapeHtml(enT('elder.forecast'))}：</strong>${escapeHtml(p.forecast)}</p>`;
    }
    if (p.outlook) {
      html += `<p><strong>${escapeHtml(enT('elder.outlook'))}：</strong>${escapeHtml(p.outlook)}</p>`;
    }
    if (p.script !== 'en' && !p.hasChineseText && p.hasEnglishText) {
      html += `<p class="elder-note">${escapeHtml(enT('elder.weatherMissingZh'))}</p>`;
    }
    if (p.holidayName) {
      html += `<p class="elder-note">📅 ${escapeHtml(enT('elder.holiday'))}：${escapeHtml(p.holidayName)} (${escapeHtml(holidayDateText(p.holiday && p.holiday.date))})</p>`;
    }
    html += `<button class="elder-btn primary" type="button" onclick="enSpeakWeather()">${escapeHtml(enT('today.speakWeather'))}</button>`;
  }
  html += '</div>';
  box.innerHTML = html;
}

function renderTodayDaily() {
  const box = $('today-daily');
  if (!box) return;
  const daily = STATE.elder && STATE.elder.daily;
  if (!daily) { box.innerHTML = `<div class="elder-card"><p>${escapeHtml(enT('elder.loading'))}</p></div>`; return; }
  const picks = daily.picks || {};
  const chosen = [picks.joke, picks.tip, picks.wisdom].filter(Boolean);
  box.innerHTML = `<div class="elder-kicker" style="margin-bottom:8px">${escapeHtml(enT('today.dailyTitle'))} · ${escapeHtml(daily.date)}</div>`
    + chosen.map(elderItemCard).join('');
}

function enSetTodayTab(kind) {
  STATE.todayTab = kind;
  renderTodayTabs();
  renderTodayItems();
}
function renderTodayTabs() {
  const box = $('today-tabs');
  if (!box) return;
  box.innerHTML = ELDER_KINDS.map(
    (k) => `<button class="elder-tab ${STATE.todayTab === k.id ? 'active' : ''}" onclick="enSetTodayTab('${k.id}')">${escapeHtml(enT(k.key))}</button>`
  ).join('');
}
function renderTodayItems() {
  const box = $('today-items');
  if (!box) return;
  if (!STATE.elder) { box.innerHTML = `<div class="elder-card"><p>${escapeHtml(enT('elder.loading'))}</p></div>`; return; }
  const items = (STATE.elder.items || []).filter((x) => STATE.todayTab === 'all' || x.kind === STATE.todayTab);
  const helperNote = (STATE.todayTab === 'helper' || STATE.todayTab === 'all') && STATE.elder.helperNote
    ? `<p class="elder-note">${escapeHtml(noteText(STATE.elder.helperNote))}</p>` : '';
  box.innerHTML = helperNote + items.map(elderItemCard).join('');
}

// ---- Emoji expression + one-tap sharing (F1 / F2 / C1) ---------------------
function enSelectMood(id) {
  STATE.mood = (STATE.elder && STATE.elder.moods || []).find((m) => m.id === id) || null;
  renderTodayMoods();
  renderTodayShare();
}
function renderTodayMoods() {
  const box = $('today-moods');
  if (!box) return;
  const moods = STATE.elder && STATE.elder.moods || [];
  if (!moods.length) { box.innerHTML = `<p class="elder-note">${escapeHtml(enT('elder.loading'))}</p>`; return; }
  box.innerHTML = moods.map(
    (m) => `<button class="elder-mood ${STATE.mood && STATE.mood.id === m.id ? 'active' : ''}" onclick="enSelectMood('${escapeHtml(m.id)}')"><span class="em">${escapeHtml(m.emoji)}</span><span class="tx">${escapeHtml(moodText(m))}</span></button>`
  ).join('');
}
function enChooseShareItem(id) {
  STATE.shareItem = elderItem(id);
  renderTodayShare();
  const p = $('today-share-preview');
  if (p && p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function enShareText() {
  const bits = [];
  if (STATE.mood) bits.push(moodText(STATE.mood));
  if (STATE.shareItem) {
    const t = elderText(STATE.shareItem);
    bits.push(t.title + '\n' + t.body);
  }
  if (!bits.length) return '';
  const site = (STATE.elder && STATE.elder.shareSite) || 'https://cantobuddy.com/en';
  bits.push(site);
  return bits.join('\n\n');
}
function renderTodayShare() {
  const preview = $('today-share-preview');
  const actions = $('today-share-actions');
  if (!preview || !actions) return;
  const text = enShareText();
  if (!text) {
    preview.textContent = enT('today.shareEmpty');
    actions.innerHTML = '';
    return;
  }
  preview.textContent = text;
  const site = (STATE.elder && STATE.elder.shareSite) || 'https://cantobuddy.com/en';
  const wa = 'https://wa.me/?text=' + encodeURIComponent(text);
  const fb = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(site)
    + '&quote=' + encodeURIComponent(text);
  actions.innerHTML =
    `<a class="elder-btn green" href="${escapeHtml(wa)}" target="_blank" rel="noopener noreferrer">${escapeHtml(enT('today.shareWhatsapp'))}</a>`
    + `<a class="elder-btn" href="${escapeHtml(fb)}" target="_blank" rel="noopener noreferrer">${escapeHtml(enT('today.shareFacebook'))}</a>`
    + `<button class="elder-btn small" onclick="enCopyShare()" aria-label="Copy">📋</button>`;
}
async function enCopyShare() {
  const text = enShareText();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const p = $('today-share-preview');
    if (p) { const old = p.textContent; p.textContent = enT('elder.copyOk'); setTimeout(() => { p.textContent = old; }, 1800); }
  } catch (e) { /* clipboard blocked — the two share links still work */ }
}

function renderTodayLocal() {
  const box = $('today-local');
  if (!box) return;
  const links = STATE.elder && STATE.elder.localLinks || [];
  box.innerHTML = links.map((l) => {
    const t = elderText(l);
    return `<a class="elder-link" href="${escapeHtml(elderUrl(l))}" target="_blank" rel="noopener noreferrer"><span class="ic">${escapeHtml(l.icon || '🔗')}</span><span><span class="nm">${escapeHtml(t.title)}</span><br><span class="ds">${escapeHtml(t.desc || '')}</span></span></a>`;
  }).join('');
}

// ---- Help (D1 / D2 / B2) ----------------------------------------------------
function renderHelp() {
  renderHelp999();
  renderHelpDirectory();
  renderReminderList();
  renderHelpLinks();
  renderHelpSources();
}
function helpEntryActions(e, danger) {
  let html = `<a class="elder-call ${danger ? 'danger' : ''}" href="tel:${escapeHtml(e.phone)}">📞 ${escapeHtml(e.display || e.phone)}</a>`;
  if (e.whatsapp) {
    html += `<a class="elder-btn small" href="https://wa.me/${escapeHtml(e.whatsapp)}" target="_blank" rel="noopener noreferrer">${escapeHtml(enT('help.whatsapp'))}</a>`;
  }
  const web = elderWeb(e);
  if (web) {
    html += `<a class="elder-btn small" href="${escapeHtml(web)}" target="_blank" rel="noopener noreferrer">${escapeHtml(enT('help.website'))}</a>`;
  }
  return html;
}
function renderHelp999() {
  const box = $('help-999');
  if (!box) return;
  const g = STATE.help && (STATE.help.groups || []).find((x) => x.id === 'danger');
  const e = g && g.entries && g.entries[0];
  const t = e ? elderText(e) : { name: '999', desc: '' };
  box.innerHTML = `<div class="elder-card" style="border-color:var(--red)">
      <h3>${escapeHtml(enT('help.emergencyTitle'))}</h3>
      <a class="elder-call danger" href="tel:999" style="font-size:1.6rem;min-width:100%">📞 999</a>
      <p class="elder-note">${escapeHtml(t.name)} — ${escapeHtml(t.desc)}</p>
    </div>`;
}
function renderHelpDirectory() {
  const box = $('help-directory');
  if (!box) return;
  if (!STATE.help) { box.innerHTML = `<div class="elder-card"><p>${escapeHtml(enT('elder.loading'))}</p></div>`; return; }
  box.innerHTML = (STATE.help.groups || []).filter((g) => g.id !== 'danger').map((g) => {
    const gt = elderText(g);
    return `<div class="elder-card"><h3>${escapeHtml(g.icon || '📞')} ${escapeHtml(gt.title || '')}</h3>`
      + (g.entries || []).map((e) => {
        const t = elderText(e);
        return `<div class="elder-help-entry"><div class="nm">${escapeHtml(e.icon || '')} ${escapeHtml(t.name)}</div>
          <div class="ds">${escapeHtml(t.desc || '')}</div>${helpEntryActions(e, false)}</div>`;
      }).join('') + '</div>';
  }).join('');
}
function renderHelpLinks() {
  const box = $('help-links');
  if (!box) return;
  const links = STATE.help && STATE.help.localLinks || [];
  if (!links.length) return;
  box.innerHTML = `<div class="elder-card"><h3>${escapeHtml(enT('help.linksTitle'))}</h3>`
    + links.map((l) => {
      const t = elderText(l);
      return `<a class="elder-link" href="${escapeHtml(elderUrl(l))}" target="_blank" rel="noopener noreferrer"><span class="ic">${escapeHtml(l.icon || '🔗')}</span><span><span class="nm">${escapeHtml(t.title)}</span><br><span class="ds">${escapeHtml(t.desc || '')}</span></span></a>`;
    }).join('') + '</div>';
}
function renderHelpSources() {
  const box = $('help-sources');
  if (!box) return;
  if (!STATE.help) return;
  const note = noteText(STATE.help.note);
  const sources = STATE.help.sources || [];
  box.innerHTML = `<div class="elder-card"><h3>${escapeHtml(enT('help.sourcesTitle'))}</h3>
    <p class="elder-note">${escapeHtml(note)}</p>
    ${sources.map((s) => `<a class="elder-link" href="${escapeHtml(elderUrl(s))}" target="_blank" rel="noopener noreferrer"><span class="ic">🔗</span><span class="nm">${escapeHtml(elderLabel(s))}</span></a>`).join('')}
    </div>`;
}

// ---- Medication reminders (B1) — local-only, no server, no notification API -
function renderReminderForm() {
  const box = $('reminder-form');
  if (!box) return;
  const opts = REMINDER_LABELS.map(
    (l) => `<option value="${escapeHtml(l.id)}">${escapeHtml(reminderLabelText(l))}</option>`
  ).join('');
  box.innerHTML = `<select id="reminder-label" aria-label="${escapeHtml(enT('help.reminderTitle'))}">${opts}</select>`
    + `<input type="time" id="reminder-time" value="08:00" aria-label="Time">`
    + `<button class="elder-btn primary" onclick="enAddReminder()">${escapeHtml(enT('help.reminderAdd'))}</button>`;
}
function renderReminderList() {
  const box = $('reminder-list');
  if (!box) return;
  if (!STATE.reminders.length) {
    box.innerHTML = `<p class="elder-note">${escapeHtml(enT('help.reminderEmpty'))}</p>`;
    return;
  }
  const today = hktToday();
  box.innerHTML = STATE.reminders.slice().sort((a, b) => String(a.time).localeCompare(String(b.time)))
    .map((r) => {
      const label = REMINDER_LABELS.find((l) => l.id === r.label);
      const text = label ? reminderLabelText(label) : r.label;
      const done = r.doneOn === today;
      return `<div class="elder-reminder ${done ? 'done' : ''}">
        <span class="when">${escapeHtml(r.time)}</span>
        <span class="what">${escapeHtml(text)}</span>
        <button class="elder-btn small" onclick="enSpeakReminder('${escapeHtml(r.id)}')">${escapeHtml(enT('help.reminderSpeak'))}</button>
        <button class="elder-btn small" onclick="enToggleReminder('${escapeHtml(r.id)}')">${escapeHtml(done ? enT('help.reminderUndo') : enT('help.reminderDone'))}</button>
        <button class="elder-btn small" onclick="enDeleteReminder('${escapeHtml(r.id)}')" aria-label="Delete">${escapeHtml(enT('help.reminderDelete'))}</button>
      </div>`;
    }).join('');
}
function enAddReminder() {
  const sel = $('reminder-label');
  const time = $('reminder-time');
  if (!sel || !time || !time.value) return;
  if (STATE.reminders.length >= 20) return;
  STATE.reminders.push({
    id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    label: sel.value, time: time.value, doneOn: '',
  });
  saveReminders();
  renderReminderList();
}
function enToggleReminder(id) {
  const r = STATE.reminders.find((x) => x.id === id);
  if (!r) return;
  r.doneOn = r.doneOn === hktToday() ? '' : hktToday();
  saveReminders();
  renderReminderList();
}
function enDeleteReminder(id) {
  STATE.reminders = STATE.reminders.filter((x) => x.id !== id);
  saveReminders();
  renderReminderList();
}
function enSpeakReminder(id) {
  const r = STATE.reminders.find((x) => x.id === id);
  if (!r) return;
  const label = REMINDER_LABELS.find((l) => l.id === r.label);
  const englishChrome = enCurrentLang() === 'fil' || enCurrentLang() === 'id';
  speak(label ? reminderLabelText(label) : String(r.label), englishChrome ? 'en' : 'yue');
}

/**
 * Load the elder data OUT OF BAND from the vocabulary. If any of these three
 * endpoints is down, the learning app still works — this is a companion, not a
 * dependency. Promise.allSettled is deliberate: a dead HKO upstream must not
 * hide the help directory from someone who needs it.
 */
async function loadElderData() {
  const results = await Promise.allSettled([
    apiGet('/api/en/elder/content'),
    apiGet('/api/en/elder/help'),
    apiGet('/api/today-in-hk'),
  ]);
  if (results[0].status === 'fulfilled') STATE.elder = results[0].value;
  if (results[1].status === 'fulfilled') STATE.help = results[1].value;
  if (results[2].status === 'fulfilled') STATE.todayHk = results[2].value;
  STATE.reminders = loadReminders();
  renderHomeToday();
  renderReminderForm();
  renderReminderList();
  const active = document.querySelector('.en-view.active');
  if (active && active.id === 'view-today') renderToday();
  if (active && active.id === 'view-help') renderHelp();
}

// ---- Init -------------------------------------------------------------------
async function init() {
  STATE.deviceId = loadDeviceId();
  renderLangSwitch();
  applyStaticLang();
  enSyncInstallEntry();   // show/hide the header "Add to Home" button correctly
  populateVoiceSelects(); // fill voice <select>s if voices are already available
  window.onEnLangChange = () => {
    applyStaticLang();
    renderLearn(); renderPractice(); renderProgress();
    // §0b — browse/scenario meanings and the quiz options are script-aware,
    // so every surface has to be redrawn when 繁 ⇄ 簡 changes.
    renderBrowse(); renderQuizQuestion();
    renderHomeToday(); renderToday(); renderHelp();
    renderReminderForm(); renderReminderList();
  };

  // Elder companion data is deliberately NOT part of the vocabulary Promise:
  // if HKO, the content endpoint or the help endpoint is down, learning still
  // boots, and a failure in one companion feed cannot hide the other two.
  loadElderData();

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
