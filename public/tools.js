/* ===========================================================================
   CantoBuddy — Daily Tools (/tools)
   ---------------------------------------------------------------------------
   Four self-contained, offline-first utilities for domestic helpers in HK:
     1. Elderly-Care Recipe Translator (Cantonese + audio)
     2. Holiday & Leave Tracker (HK statutory holidays 2026-2027)
     3. Contract & Visa Countdown (private, with .ics calendar reminders)
     4. Emergency & Support Directory (verified HK numbers)

   Design constraints, deliberately matching the rest of the app:
     - No account, no network calls, no data leaves the device. Everything is
       in localStorage under the `cbtools.` prefix.
     - Audio uses the Web Speech API with a zh-HK / yue voice, the same engine
       app.js uses for the vocabulary words.
     - Holiday dates are transcribed from holidays.js (Labour Department,
       checked 2026-10-19) so the calendar and the existing guide never drift.
     - Emergency numbers are from the Labour Department FDH contact page, the
       HAD "Just for You" Chapter 24, and HELP for Domestic Workers' own site.
   =========================================================================== */
'use strict';

/* ---------------------------------------------------------------------------
   Tiny helpers
   --------------------------------------------------------------------------- */
const CB = {
  get(k, fallback) {
    try { const v = localStorage.getItem('cbtools.' + k); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem('cbtools.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ }
  },
  del(k) { try { localStorage.removeItem('cbtools.' + k); } catch (e) {} },
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function iso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function parseISO(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}
function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
function todayISO() { return iso(new Date()); }
function fmtDate(s, opts) {
  const d = parseISO(s);
  return d ? d.toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}
function track(event, extra) {
  try { if (window.gtag) gtag('event', event, Object.assign({ page: 'tools' }, extra || {})); } catch (e) {}
}

/* ===========================================================================
   TOOL SWITCHER
   =========================================================================== */
const TOOL_IDS = ['recipe', 'leave', 'contract', 'emergency'];
function showTool(name) {
  if (TOOL_IDS.indexOf(name) === -1) name = 'recipe';
  TOOL_IDS.forEach(function (id) {
    const panel = document.getElementById('tool-' + id);
    if (panel) panel.hidden = (id !== name);
  });
  document.querySelectorAll('.tool-tab').forEach(function (tab) {
    tab.classList.toggle('active', tab.getAttribute('data-tool') === name);
  });
  CB.set('lastTool', name);
  track('tools_open', { tool: name });
  const main = document.getElementById('app');
  if (main && window.scrollY > main.offsetTop) window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ===========================================================================
   TOOL 1 — ELDERLY-CARE RECIPE TRANSLATOR
   ---------------------------------------------------------------------------
   A starter dictionary of soft, easy-to-eat dishes commonly cooked for
   elders in Hong Kong homes. Each entry carries the Cantonese characters,
   Jyutping, an Indonesian name and search aliases in both languages.
   =========================================================================== */
const RECIPES = [
  { en: 'Plain congee', id: 'Bubur putih', zh: '白粥', jyut: 'baak6 zuk1', emoji: '🥣', tags: ['congee', 'porridge', 'rice porridge', 'bubur', 'nasi', 'soft food'] },
  { en: 'Century egg & pork congee', id: 'Bubur telur pitan & babi', zh: '皮蛋瘦肉粥', jyut: 'pei4 daan2 sau3 juk6 zuk1', emoji: '🥣', tags: ['congee', 'porridge', 'bubur', 'pitan', 'babi'] },
  { en: 'Fish slice congee', id: 'Bubur ikan', zh: '魚片粥', jyut: 'jyu4 pin2 zuk1', emoji: '🐟', tags: ['congee', 'fish', 'ikan', 'bubur', 'porridge'] },
  { en: 'Pumpkin congee', id: 'Bubur labu', zh: '南瓜粥', jyut: 'naam4 gwaa1 zuk1', emoji: '🎃', tags: ['congee', 'pumpkin', 'labu', 'bubur'] },
  { en: 'Oat porridge', id: 'Bubur oat', zh: '燕麥粥', jyut: 'jin3 mak6 zuk1', emoji: '🌾', tags: ['oat', 'oatmeal', 'porridge', 'bubur', 'sarapan'] },
  { en: 'Steamed fish', id: 'Ikan kukus', zh: '蒸魚', jyut: 'zing1 jyu4', emoji: '🐟', tags: ['fish', 'steam', 'ikan', 'kukus', '清蒸魚'] },
  { en: 'Steamed fish with ginger & spring onion', id: 'Ikan kukus jahe & daun bawang', zh: '薑蔥蒸魚', jyut: 'goeng1 cung1 zing1 jyu4', emoji: '🐟', tags: ['fish', 'ikan', 'ginger', 'jahe', '蒸魚'] },
  { en: 'Steamed egg custard', id: 'Telur kukus', zh: '蒸水蛋', jyut: 'zing1 seoi2 daan2', emoji: '🍮', tags: ['egg', 'steamed egg', 'telur', 'kukus', '水蛋', 'soft food'] },
  { en: 'Minced pork steamed egg', id: 'Telur kukus daging cincang', zh: '肉碎蒸蛋', jyut: 'juk6 seoi3 zing1 daan2', emoji: '🍮', tags: ['egg', 'telur', 'pork', 'babi', '蒸蛋'] },
  { en: 'Steamed chicken', id: 'Ayam kukus', zh: '蒸雞', jyut: 'zing1 gai1', emoji: '🍗', tags: ['chicken', 'ayam', 'kukus', 'steam'] },
  { en: 'Poached chicken', id: 'Ayam rebus', zh: '白切雞', jyut: 'baak6 cit3 gai1', emoji: '🍗', tags: ['chicken', 'ayam', 'rebus', '白切雞'] },
  { en: 'Winter melon soup', id: 'Sup labu air / sup beligo', zh: '冬瓜湯', jyut: 'dung1 gwaa1 tong1', emoji: '🍲', tags: ['soup', 'sup', 'winter melon', 'labu', 'tong'] },
  { en: 'Tomato egg drop soup', id: 'Sup tomat telur', zh: '番茄蛋花湯', jyut: 'faan1 ke2 daan2 faa1 tong1', emoji: '🍅', tags: ['soup', 'sup', 'tomato', 'tomat', 'egg', 'telur'] },
  { en: 'Sweet corn soup', id: 'Sup jagung', zh: '粟米湯', jyut: 'suk1 mai5 tong1', emoji: '🌽', tags: ['soup', 'sup', 'corn', 'jagung'] },
  { en: 'Slow-simmered soup', id: 'Sup rebus lama', zh: '老火湯', jyut: 'lou5 fo2 tong1', emoji: '🍲', tags: ['soup', 'sup', '老火湯', 'herbal'] },
  { en: 'Pork rib soup', id: 'Sup tulang rusuk babi', zh: '排骨湯', jyut: 'paai4 gwat1 tong1', emoji: '🍖', tags: ['soup', 'sup', 'pork', 'babi', 'rib'] },
  { en: 'Choy sum (green vegetables)', id: 'Sayur hijau / caisim', zh: '菜心', jyut: 'coi3 sam1', emoji: '🥬', tags: ['vegetable', 'sayur', 'greens', 'caisim', '菜心'] },
  { en: 'Stir-fried vegetables', id: 'Sayur tumis', zh: '炒菜心', jyut: 'caau2 coi3 sam1', emoji: '🥬', tags: ['vegetable', 'sayur', 'tumis', 'stir fry'] },
  { en: 'Steamed pumpkin', id: 'Labu kukus', zh: '蒸南瓜', jyut: 'zing1 naam4 gwaa1', emoji: '🎃', tags: ['pumpkin', 'labu', 'kukus', 'steam', 'soft food'] },
  { en: 'Tofu', id: 'Tahu', zh: '豆腐', jyut: 'dau6 fu6', emoji: '⬜', tags: ['tofu', 'tahu', 'bean curd', 'soft food'] },
  { en: 'Steamed rice', id: 'Nasi putih', zh: '白飯', jyut: 'baak6 faan6', emoji: '🍚', tags: ['rice', 'nasi', '白飯'] },
  { en: 'Rice vermicelli', id: 'Bihun / mi beras', zh: '米粉', jyut: 'mai5 fan2', emoji: '🍜', tags: ['noodle', 'mie', 'bihun', 'rice noodle'] },
  { en: 'Wonton noodles', id: 'Mi wonton / pangsit', zh: '雲吞麵', jyut: 'wan4 tan1 min6', emoji: '🍜', tags: ['noodle', 'mie', 'wonton', 'pangsit'] },
  { en: 'Banana', id: 'Pisang', zh: '香蕉', jyut: 'hoeng1 ziu1', emoji: '🍌', tags: ['fruit', 'buah', 'pisang', 'banana'] },
  { en: 'Apple', id: 'Apel', zh: '蘋果', jyut: 'ping4 gwo2', emoji: '🍎', tags: ['fruit', 'buah', 'apel', 'apple'] },
  { en: 'Papaya', id: 'Pepaya', zh: '木瓜', jyut: 'mok6 gwaa1', emoji: '🍈', tags: ['fruit', 'buah', 'pepaya', 'papaya'] },
  { en: 'Ginger tea', id: 'Teh jahe', zh: '薑茶', jyut: 'goeng1 caa4', emoji: '🫖', tags: ['tea', 'teh', 'ginger', 'jahe'] },
  { en: 'Hot water', id: 'Air panas', zh: '熱水', jyut: 'jit6 seoi2', emoji: '💧', tags: ['water', 'air', 'drink', 'minum'] },
  { en: 'Medicine', id: 'Obat', zh: '藥', jyut: 'joek6', emoji: '💊', tags: ['medicine', 'obat', '藥', 'pill'] },
  { en: 'Red bean sweet soup', id: 'Sup kacang merah', zh: '紅豆沙', jyut: 'hung4 dau6 saa1', emoji: '🍧', tags: ['dessert', 'red bean', 'kacang merah', 'sweet soup'] },
];

const QUICK_DISHES = ['Plain congee', 'Bubur putih', 'Steamed fish', 'Ikan kukus', 'Ayam kukus', 'Sup tomat telur', 'Telur kukus', 'Nasi putih'];

/* ---- Cantonese text-to-speech (mirrors app.js: zh-HK, yue fallback) ---- */
let _ttsVoices = [];
function loadTtsVoices() {
  _ttsVoices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
}
if ('speechSynthesis' in window) {
  loadTtsVoices();
  window.speechSynthesis.onvoiceschanged = loadTtsVoices;
}
function cantoneseVoice() {
  const vs = _ttsVoices.length ? _ttsVoices : (window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
  // Prefer an explicitly Cantonese voice; a generic zh voice is a last resort.
  return vs.find(function (v) { return /^(yue|zh-HK|zh-Hant-HK|zh_HK)/i.test(v.lang); })
      || vs.find(function (v) { return /cantonese|香港|sin-?ji|tracy/i.test(v.name); })
      || vs.find(function (v) { return /^zh/i.test(v.lang); })
      || null;
}
function hasCantoneseVoice() {
  const vs = _ttsVoices.length ? _ttsVoices : (window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
  return vs.some(function (v) { return /^(yue|zh-HK|zh-Hant-HK)/i.test(v.lang) || /cantonese|香港/i.test(v.name); });
}
function speakYue(text, btn) {
  if (!('speechSynthesis' in window)) {
    alert('Audio is not supported in this browser. Please open CantoBuddy in Chrome or Safari.');
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-HK';
  const voice = cantoneseVoice();
  if (voice) u.voice = voice;
  // Respect the learner's chosen practice speed if she set one in the main app.
  const profile = (function () { try { return localStorage.getItem('cb_voice_profile'); } catch (e) { return null; } })();
  u.rate = profile && /slow/.test(profile) ? 0.5 : 0.85;
  document.querySelectorAll('.audio-btn.speaking').forEach(function (b) { b.classList.remove('speaking'); });
  if (btn) {
    btn.classList.add('speaking');
    u.onend = u.onerror = function () { btn.classList.remove('speaking'); };
  }
  window.speechSynthesis.speak(u);
  track('tools_audio', { length: text.length });
}

/* ---- Search + render ---- */
let lastRecipeQuery = '';
function searchRecipes(raw) {
  const q = String(raw || '').trim().toLowerCase();
  lastRecipeQuery = q;
  const box = document.getElementById('recipe-results');
  if (!box) return;

  if (!q) { renderRecipes(RECIPES.slice(0, 6), false); return; }

  const tokens = q.split(/\s+/).filter(Boolean);
  const scored = RECIPES.map(function (r) {
    const hay = [r.en, r.id, r.zh, r.jyut].concat(r.tags).join(' ').toLowerCase();
    let score = 0;
    if (r.en.toLowerCase() === q || r.id.toLowerCase() === q || r.zh === raw.trim()) score = 100;
    else if (hay.indexOf(q) !== -1) score = 60;
    else if (tokens.length > 1 && tokens.every(function (t) { return hay.indexOf(t) !== -1; })) score = 40;
    else if (tokens.some(function (t) { return t.length >= 3 && hay.indexOf(t) !== -1; })) score = 20;
    // Prefer shorter (more generic) names when scores tie.
    return { r: r, s: score };
  }).filter(function (x) { return x.s > 0; });

  scored.sort(function (a, b) { return b.s - a.s || a.r.en.length - b.r.en.length; });
  renderRecipes(scored.slice(0, 8).map(function (x) { return x.r; }), true);
}

function renderRecipes(list, isSearch) {
  const box = document.getElementById('recipe-results');
  if (!box) return;

  if (!list.length) {
    box.innerHTML = '<div class="empty-state"><span class="big">🍽️</span>'
      + 'No dish found for <strong>' + esc(lastRecipeQuery) + '</strong>.<br>'
      + 'Try a simpler word like <em>congee</em>, <em>fish</em>, <em>ayam</em> or <em>sup</em>.</div>';
    return;
  }

  const warn = !hasCantoneseVoice() && ('speechSynthesis' in window)
    ? '<div class="tts-warning">⚠️ This phone has no Cantonese voice installed, so audio may sound like Mandarin. '
      + 'Add a Cantonese (中文（香港）/ yue) voice in your phone\'s text-to-speech settings, or ask your employer to help.</div>'
    : '';

  box.innerHTML = list.map(function (r) {
    const phrase = '今晚食' + r.zh + '好唔好呀？';
    const phraseJyut = 'gam1 maan5 sik6 ' + r.jyut + ' hou2 m4 hou2 aa3';
    return '<article class="recipe-card">'
      + '<div class="recipe-card-top"><div class="recipe-names">'
      + '<div class="recipe-query">' + (isSearch ? 'Match' : 'Common dish') + '</div>'
      + '<div class="recipe-en">' + esc(r.en) + '</div>'
      + '<div class="recipe-id">ID: ' + esc(r.id) + '</div>'
      + '</div><div class="recipe-emoji">' + r.emoji + '</div></div>'
      + '<div class="recipe-yue">' + esc(r.zh) + '</div>'
      + '<div class="recipe-jyut">' + esc(r.jyut) + '</div>'
      + '<div class="recipe-phrase">'
      + '<div class="recipe-phrase-label">Say it to an elder</div>'
      + '<div class="recipe-phrase-yue">' + esc(phrase) + '</div>'
      + '<div class="recipe-phrase-en">' + esc(phraseJyut) + ' · “Shall we have ' + esc(r.en.toLowerCase()) + ' tonight?”</div>'
      + '</div>'
      + '<div class="audio-row">'
      + '<button class="audio-btn" onclick="speakYue(\'' + esc(r.zh) + '\', this)">🔊 Dish name</button>'
      + '<button class="audio-btn secondary" onclick="speakYue(\'' + esc(phrase) + '\', this)">🗣️ Whole sentence</button>'
      + '</div></article>';
  }).join('') + warn;
}

function renderChips() {
  const el = document.getElementById('recipe-chips');
  if (!el) return;
  el.innerHTML = QUICK_DISHES.map(function (label) {
    return '<button class="chip-btn" onclick="quickDish(\'' + esc(label) + '\')">' + esc(label) + '</button>';
  }).join('');
}
function quickDish(label) {
  const input = document.getElementById('recipe-search');
  if (input) input.value = label;
  searchRecipes(label);
  track('tools_recipe_quick', { label: label });
}

/* ===========================================================================
   TOOL 2 — HOLIDAY & LEAVE TRACKER
   ---------------------------------------------------------------------------
   Dates transcribed from holidays.js (Labour Department statutory holidays
   for foreign domestic helpers, 2026 & 2027). The `sub` entries are the
   substituted days off when a holiday falls on a Sunday rest day.
   =========================================================================== */
const HOLIDAY_NAMES = {
  'first-day-of-january': { en: "The first day of January", zh: '1月1日', short: 'New Year' },
  'lny-1': { en: "Lunar New Year's Day", zh: '農曆年初一', short: 'LNY Day 1' },
  'lny-2': { en: 'The second day of Lunar New Year', zh: '農曆年初二', short: 'LNY Day 2' },
  'lny-3': { en: 'The third day of Lunar New Year', zh: '農曆年初三', short: 'LNY Day 3' },
  'lny-4': { en: 'The fourth day of Lunar New Year', zh: '農曆年初四', short: 'LNY Day 4' },
  'ching-ming': { en: 'Ching Ming Festival', zh: '清明節', short: 'Ching Ming' },
  'easter-monday': { en: 'Easter Monday', zh: '復活節星期一', short: 'Easter Monday' },
  'labour-day': { en: 'Labour Day', zh: '勞動節', short: 'Labour Day' },
  'buddha': { en: "The Birthday of the Buddha", zh: '佛誕', short: "Buddha's Birthday" },
  'tuen-ng': { en: 'Tuen Ng Festival (Dragon Boat)', zh: '端午節', short: 'Tuen Ng' },
  'hksar-day': { en: 'HKSAR Establishment Day', zh: '香港特別行政區成立紀念日', short: 'HKSAR Day' },
  'mid-autumn': { en: 'Day following the Mid-Autumn Festival', zh: '中秋節翌日', short: 'Mid-Autumn' },
  'national-day': { en: 'National Day', zh: '國慶日', short: 'National Day' },
  'chung-yeung': { en: 'Chung Yeung Festival', zh: '重陽節', short: 'Chung Yeung' },
  'december-choice': { en: 'Winter Solstice or Christmas Day (employer chooses)', zh: '冬節或聖誕節', short: 'Winter Solstice / Christmas' },
  'first-weekday-after-christmas': { en: 'First weekday after Christmas Day', zh: '聖誕節後第一個周日', short: 'After Christmas' },
};

const HOLIDAY_ROWS = [
  /* --- 2026 --- */
  { date: '2026-01-01', id: 'first-day-of-january' },
  { date: '2026-02-17', id: 'lny-1' },
  { date: '2026-02-18', id: 'lny-2' },
  { date: '2026-02-19', id: 'lny-3' },
  { date: '2026-04-05', id: 'ching-ming' },
  { date: '2026-04-06', id: 'easter-monday' },
  { date: '2026-05-01', id: 'labour-day' },
  { date: '2026-05-24', id: 'buddha' },
  { date: '2026-06-19', id: 'tuen-ng' },
  { date: '2026-07-01', id: 'hksar-day' },
  { date: '2026-09-26', id: 'mid-autumn' },
  { date: '2026-10-01', id: 'national-day' },
  { date: '2026-10-18', id: 'chung-yeung' },
  { date: '2026-12-22', id: 'december-choice' },
  { date: '2026-12-25', id: 'december-choice' },
  { date: '2026-12-26', id: 'first-weekday-after-christmas' },
  /* --- 2027 --- */
  { date: '2027-01-01', id: 'first-day-of-january' },
  { date: '2027-02-06', id: 'lny-1' },
  { date: '2027-02-08', id: 'lny-3' },
  { date: '2027-02-09', id: 'lny-4' },
  { date: '2027-03-29', id: 'easter-monday' },
  { date: '2027-04-05', id: 'ching-ming' },
  { date: '2027-05-01', id: 'labour-day' },
  { date: '2027-05-13', id: 'buddha' },
  { date: '2027-06-09', id: 'tuen-ng' },
  { date: '2027-07-01', id: 'hksar-day' },
  { date: '2027-09-16', id: 'mid-autumn' },
  { date: '2027-10-01', id: 'national-day' },
  { date: '2027-10-08', id: 'chung-yeung' },
  { date: '2027-12-22', id: 'december-choice' },
  { date: '2027-12-25', id: 'december-choice' },
  { date: '2027-12-27', id: 'first-weekday-after-christmas' },
];

/* When a statutory holiday falls on a Sunday rest day, the day off moves. */
const SUBSTITUTIONS = [
  { from: '2026-04-05', to: '2026-04-07', id: 'ching-ming' },
  { from: '2026-05-24', to: '2026-05-25', id: 'buddha' },
  { from: '2026-10-18', to: '2026-10-19', id: 'chung-yeung' },
  { from: '2027-02-07', to: '2027-02-09', id: 'lny-2' },
];

const HOLIDAY_MAP = (function () {
  const m = {};
  HOLIDAY_ROWS.forEach(function (r) {
    const n = HOLIDAY_NAMES[r.id] || { en: r.id, zh: '', short: r.id };
    if (!m[r.date]) m[r.date] = { en: n.en, zh: n.zh, short: n.short, sub: false };
  });
  SUBSTITUTIONS.forEach(function (s) {
    const n = HOLIDAY_NAMES[s.id] || { en: s.id, zh: '', short: s.id };
    m[s.to] = { en: n.en + ' (moved from ' + fmtDate(s.from, { day: 'numeric', month: 'short' }) + ')', zh: n.zh, short: n.short + ' (moved)', sub: true };
  });
  return m;
})();

let calCursor = (function () { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();

function saveLeavePrefs() {
  const sel = document.getElementById('rest-day');
  CB.set('restDay', Number(sel ? sel.value : 0));
  renderCalendar();
  track('tools_leave_restday');
}
function getLeave() { return CB.get('leave', []); }
function setLeave(arr) { CB.set('leave', arr); }
function addLeaveToday() {
  const t = todayISO();
  const arr = getLeave();
  const i = arr.indexOf(t);
  if (i === -1) arr.push(t); else arr.splice(i, 1);
  setLeave(arr.sort());
  renderCalendar();
  track('tools_leave_toggle');
}
function toggleLeave(dateStr) {
  const arr = getLeave();
  const i = arr.indexOf(dateStr);
  if (i === -1) arr.push(dateStr); else arr.splice(i, 1);
  setLeave(arr.sort());
  renderCalendar();
  track('tools_leave_toggle');
}
function clearLeave() {
  setLeave([]);
  renderCalendar();
  track('tools_leave_clear');
}
function changeMonth(delta) {
  calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + delta, 1);
  renderCalendar();
  track('tools_leave_month', { delta: delta });
}

function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  const title = document.getElementById('cal-title');
  if (!grid || !title) return;

  const y = calCursor.getFullYear(), mo = calCursor.getMonth();
  title.textContent = calCursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const first = new Date(y, mo, 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const restDay = CB.get('restDay', 0);
  const leave = getLeave();
  const today = todayISO();

  let html = '';
  for (let i = 0; i < offset; i++) html += '<div class="cal-cell blank"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(y, mo, d);
    const key = iso(dt);
    const hol = HOLIDAY_MAP[key];
    const isRest = dt.getDay() === restDay;
    const isLeave = leave.indexOf(key) !== -1;
    const isToday = key === today;
    const cls = ['cal-cell'];
    if (hol) cls.push('is-holiday');
    else if (isLeave) cls.push('is-leave');
    else if (isRest) cls.push('is-rest');
    if (isToday) cls.push('is-today');
    let mark = '';
    if (hol) mark = '<span class="cal-hol-name">' + esc(hol.short) + '</span>';
    else if (isLeave) mark = '<span class="cal-mark">✕</span>';
    else if (isRest) mark = '<span class="cal-mark">☁</span>';
    html += '<button class="' + cls.join(' ') + '" title="' + esc(key + (hol ? ' — ' + hol.en : '')) + '" onclick="toggleLeave(\'' + key + '\')">'
      + '<span>' + d + '</span>' + mark + '</button>';
  }
  grid.innerHTML = html;

  // Month holiday list + compliance summary
  const monthPrefix = y + '-' + String(mo + 1).padStart(2, '0') + '-';
  const monthHols = Object.keys(HOLIDAY_MAP).filter(function (k) { return k.indexOf(monthPrefix) === 0; }).sort();
  const rows = monthHols.map(function (k) {
    const h = HOLIDAY_MAP[k];
    return '<div class="holiday-row"><span class="hdate">' + esc(fmtDate(k, { weekday: 'short', day: 'numeric', month: 'short' }))
      + '</span><span class="hname">' + esc(h.en) + ' <span class="hzh">' + esc(h.zh) + '</span></span></div>';
  }).join('');

  const listId = 'cal-holiday-list';
  let list = document.getElementById(listId);
  if (!list) {
    list = document.createElement('div');
    list.id = listId;
    list.className = 'holiday-list';
    const legend = document.querySelector('.cal-legend');
    if (legend) legend.parentNode.insertBefore(list, legend.nextSibling);
    else grid.parentNode.appendChild(list);
  }
  list.innerHTML = '<h3>Statutory holidays this month</h3>'
    + (rows || '<div class="holiday-row"><span class="hname">None this month.</span></div>');

  const leaveThisMonth = leave.filter(function (k) { return k.indexOf(monthPrefix) === 0; }).length;
  const summary = document.getElementById('leave-summary');
  if (summary) {
    summary.innerHTML = '<strong>Your rights:</strong> one rest day every 7 days, and '
      + '<strong>15 paid statutory holidays</strong> a year in 2026 &amp; 2027. '
      + 'A holiday that falls on your rest day moves to the next working day — it is never lost. '
      + 'You have marked <strong>' + leave.length + '</strong> leave day(s) in total'
      + (leaveThisMonth ? ' (<strong>' + leaveThisMonth + '</strong> this month)' : '') + '. '
      + 'Tap any date to add or remove your own leave.';
  }
}

/* ===========================================================================
   TOOL 3 — CONTRACT & VISA COUNTDOWN
   ---------------------------------------------------------------------------
   All dates stay in localStorage. "Notifications" are delivered two ways:
     (a) an in-app banner whenever a milestone is within 30 days, and
     (b) a standards-based .ics file the helper adds to her phone calendar,
         which fires real alarms 30 and 7 days before each deadline.
   No server, no account, no push subscription needed.
   =========================================================================== */
function addMonths(date, n) {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}
function shiftDays(date, n) { const d = new Date(date.getTime()); d.setDate(d.getDate() + n); return d; }

function contractData() {
  const startEl = document.getElementById('contract-start');
  const lenEl = document.getElementById('contract-len');
  const passEl = document.getElementById('passport-exp');
  const visaEl = document.getElementById('visa-exp');
  const start = parseISO(startEl ? startEl.value : '');
  const len = Number(lenEl ? lenEl.value : 24);
  const passport = parseISO(passEl ? passEl.value : '');
  const visaGiven = parseISO(visaEl ? visaEl.value : '');
  if (!start) return null;
  const end = addMonths(start, len);
  const visa = visaGiven || end;
  return {
    start: start,
    len: len,
    end: end,
    visa: visa,
    visaAuto: !visaGiven,
    passport: passport || null,
  };
}
function saveContract() {
  const fields = ['contract-start', 'contract-len', 'passport-exp', 'visa-exp'];
  const vals = {};
  fields.forEach(function (id) { const el = document.getElementById(id); vals[id] = el ? el.value : ''; });
  CB.set('contract', vals);
  renderContract();
  track('tools_contract_save');
}
function clearContract() {
  CB.del('contract');
  ['contract-start', 'passport-exp', 'visa-exp'].forEach(function (id) { const el = document.getElementById(id); if (el) el.value = ''; });
  const len = document.getElementById('contract-len'); if (len) len.value = '24';
  renderContract();
  track('tools_contract_clear');
}
function restoreContract() {
  const vals = CB.get('contract', null);
  if (!vals) return;
  ['contract-start', 'contract-len', 'passport-exp', 'visa-exp'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el && vals[id] !== undefined) el.value = vals[id];
  });
}

const REMINDER_DEFS = [
  { key: 'passport', title: 'Renew your passport', detail: 'Aim to renew at least 6 months before it expires — some consulates will not renew a passport with less validity.', date: function (d) { return d.passport ? shiftDays(d.passport, -183) : null; }, icon: '🛂', offsetDays: 183 },
  { key: 'renewal', title: 'Talk to your employer about renewing the contract', detail: 'Starting 3 months early leaves time for paperwork, a new contract and the visa application.', date: function (d) { return shiftDays(d.end, -91); }, icon: '📝', offsetDays: 91 },
  { key: 'visa', title: 'Start the visa extension', detail: 'Your employment visa is tied to this employer. Submit the extension well before it expires.', date: function (d) { return shiftDays(d.visa, -56); }, icon: '🛂', offsetDays: 56 },
  { key: 'end', title: 'Contract ends', detail: 'If you are not renewing, the "2-week rule" usually means leaving Hong Kong within two weeks. Confirm with the Immigration Department.', date: function (d) { return d.end; }, icon: '📅', offsetDays: 0 },
];

function renderContract() {
  const d = contractData();
  const empty = document.getElementById('contract-empty');
  const cards = document.getElementById('contract-cards');
  const reminders = document.getElementById('contract-reminders');
  const banner = document.getElementById('notify-banner');
  if (!empty || !cards || !reminders || !banner) return;

  if (!d) {
    empty.hidden = false;
    cards.innerHTML = '';
    reminders.innerHTML = '';
    banner.hidden = true;
    return;
  }
  empty.hidden = true;

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const items = [
    { label: 'Contract end date', date: d.end, icon: '📅' },
    { label: d.visaAuto ? 'Visa expiry (est.)' : 'Visa expiry', date: d.visa, icon: '🛂' },
  ];
  if (d.passport) items.push({ label: 'Passport expiry', date: d.passport, icon: '📕' });

  cards.innerHTML = items.map(function (it) {
    const left = daysBetween(now, it.date);
    const state = left < 0 ? 'urgent' : left <= 90 ? 'warn' : 'ok';
    const label = left < 0 ? 'passed' : 'days';
    return '<div class="cd-card ' + state + '">'
      + '<div class="cd-ic">' + it.icon + '</div>'
      + '<div class="cd-body"><div class="cd-label">' + esc(it.label) + '</div>'
      + '<div class="cd-date">' + esc(it.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })) + '</div></div>'
      + '<div class="cd-days">' + (left < 0 ? Math.abs(left) : left) + '<small>' + label + '</small></div>'
      + '</div>';
  }).join('');

  const computed = REMINDER_DEFS.map(function (r) {
    return { def: r, date: r.date(d) };
  }).filter(function (x) { return x.date; })
    .sort(function (a, b) { return a.date - b.date; });

  reminders.innerHTML = '<h3>Your milestone checklist</h3>' + computed.map(function (x) {
    const left = daysBetween(now, x.date);
    const due = left >= 0 && left <= 30;
    const status = left < 0 ? 'Passed ' + Math.abs(left) + ' days ago' : left === 0 ? 'Today' : 'In ' + left + ' days · ' + fmtDate(iso(x.date));
    return '<div class="rem-row ' + (due ? 'due' : '') + '">'
      + '<span class="rem-ic">' + x.def.icon + '</span>'
      + '<div><div class="rem-title">' + esc(x.def.title) + (due ? ' ⚠️' : '') + '</div>'
      + '<div class="rem-when">' + esc(status) + '</div>'
      + '<div style="font-size:.8rem;line-height:1.5;margin-top:3px">' + esc(x.def.detail) + '</div></div></div>';
  }).join('')
    + '<button class="btn btn-ghost" style="margin-top:6px" onclick="downloadIcs()">📲 Add all reminders to my phone calendar</button>'
    + '<button class="btn btn-ghost" style="margin-top:6px" onclick="requestNotifications()">🔔 Enable on-page alerts</button>';

  const upcoming = computed.filter(function (x) { const l = daysBetween(now, x.date); return l >= 0 && l <= 30; });
  if (upcoming.length) {
    banner.hidden = false;
    banner.innerHTML = '<strong>⏰ Coming up soon:</strong> ' + esc(upcoming.map(function (x) { return x.def.title; }).join('; '))
      + '. <br>Tap “Add all reminders” above so your phone alerts you even when this page is closed.'
      + '<br><button onclick="requestNotifications()">Turn on browser alerts</button>';
  } else {
    banner.hidden = true;
  }
}

/* ---- .ics calendar export (real alarms, no backend) ---- */
function icsEscape(s) { return String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); }
function icsDate(d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
function buildIcs() {
  const d = contractData();
  if (!d) return null;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CantoBuddy//Daily Tools//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  REMINDER_DEFS.forEach(function (r, i) {
    const date = r.date(d);
    if (!date) return;
    const day = icsDate(date);
    const next = icsDate(shiftDays(date, 1));
    lines.push('BEGIN:VEVENT');
    lines.push('UID:cbtools-' + d.start.getTime() + '-' + r.key + '@cantobuddy.com');
    lines.push('DTSTAMP:' + stamp);
    lines.push('DTSTART;VALUE=DATE:' + day);
    lines.push('DTEND;VALUE=DATE:' + next);
    lines.push('SUMMARY:' + icsEscape('CantoBuddy: ' + r.title));
    lines.push('DESCRIPTION:' + icsEscape(r.detail + ' Add the CantoBuddy Tools page to your home screen to check all your dates.'));
    lines.push('BEGIN:VALARM', 'TRIGGER:-P30D', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(r.title + ' — 30 days to go'), 'END:VALARM');
    lines.push('BEGIN:VALARM', 'TRIGGER:-P7D', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(r.title + ' — 7 days to go'), 'END:VALARM');
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
function downloadIcs() {
  const ics = buildIcs();
  if (!ics) { alert('Add your contract start date first.'); return; }
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'cantobuddy-contract-reminders.ics';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  track('tools_contract_ics');
}
function requestNotifications() {
  if (!('Notification' in window)) {
    alert('This browser cannot show notifications. Use “Add all reminders to my phone calendar” instead — those alerts work even when this page is closed.');
    return;
  }
  if (Notification.permission === 'granted') {
    fireDueNotification(true);
    return;
  }
  Notification.requestPermission().then(function (p) {
    if (p === 'granted') fireDueNotification(true);
    else alert('Alerts stay inside this page. For reminders when the page is closed, use “Add all reminders to my phone calendar”.');
  });
}
function fireDueNotification(test) {
  const d = contractData();
  if (!d) return;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const due = REMINDER_DEFS.map(function (r) { return { def: r, date: r.date(d) }; })
    .filter(function (x) { const l = x.date && daysBetween(now, x.date); return x.date && l >= 0 && l <= 30; });
  try {
    if (due.length) {
      new Notification('CantoBuddy — deadlines coming up', {
        body: due.map(function (x) { return x.def.title + ' (' + fmtDate(iso(x.date)) + ')'; }).join('\n'),
        tag: 'cbtools-milestones',
      });
    } else if (test) {
      new Notification('CantoBuddy alerts are on', { body: 'We will show a reminder here when a deadline is within 30 days.', tag: 'cbtools-test' });
    }
  } catch (e) { /* some mobile browsers require a service worker */ }
  track('tools_contract_notify');
}

/* ===========================================================================
   TOOL 4 — EMERGENCY & SUPPORT DIRECTORY
   ---------------------------------------------------------------------------
   Sources (checked 2026-11-06):
     - Labour Department FDH "Contact us": https://www.fdh.labour.gov.hk/en/contact_us.html
     - HAD "Just for You" Chapter 24 (Organisations), government-published
     - HELP for Domestic Workers, own contact + "useful numbers" pages
     - HELP's useful-numbers page for consular emergency hotlines and NGOs
   Numbers are HK local (8 digits); prefix +852 when calling from abroad.
   =========================================================================== */
const DIRECTORY = [
  { group: 'In immediate danger', icon: '🚨', emergency: true, entries: [
    { name: 'Police · Fire · Ambulance', desc: 'Free emergency call. English is available — say 救命 (gau3 meng6) first if you cannot speak.', phone: '999', icon: '🚨' },
  ]},
  { group: 'Hong Kong government', icon: '🏛️', entries: [
    { name: 'Labour Department — FDH 24-hour hotline', desc: 'Pay disputes, rest days, contract problems. Handled by 1823.', phone: '27171771', display: '2717 1771', web: 'https://www.fdh.labour.gov.hk/en/contact_us.html', icon: '📞' },
    { name: 'Dedicated FDH hotline', desc: 'The Labour Department line just for foreign domestic helpers.', phone: '21579537', display: '2157 9537', web: 'https://www.fdh.labour.gov.hk/en/contact_us.html', icon: '📞' },
    { name: 'Immigration Department', desc: 'Visa, contract and the 2-week rule questions.', phone: '28246111', display: '2824 6111', web: 'https://www.immd.gov.hk', icon: '🛂' },
  ]},
  { group: 'Your consulate', icon: '🏛️', teal: true, entries: [
    { name: 'Philippine Consulate General', desc: '14/F United Centre, 95 Queensway, Admiralty. Help for Filipino workers.', phone: '28238500', display: '2823 8500', web: 'https://hongkongpcg.dfa.gov.ph', icon: '🇵🇭' },
    { name: 'OWWA emergency hotline', desc: '24-hour assistance for Filipino workers in difficulty.', phone: '63459324', display: '6345 9324', icon: '🇵🇭' },
    { name: 'Philippine Consulate emergency hotline', desc: 'Consular assistance outside office hours.', phone: '91554023', display: '9155 4023', icon: '🇵🇭' },
    { name: 'Consulate General of Indonesia', desc: '127–129 Leighton Road, Causeway Bay. Help for Indonesian workers.', phone: '36510200', display: '3651 0200', web: 'https://kemlu.go.id/hongkong', icon: '🇮🇩' },
  ]},
  { group: 'Trusted local NGOs', icon: '🤝', entries: [
    { name: 'HELP for Domestic Workers', desc: 'Free advice, assistance and referrals. Mon–Fri 10:00–18:00, Sun 10:30–14:30. Sheung Wan.', phone: '25234020', display: '2523 4020', whatsapp: '85259363780', web: 'https://helpfordomesticworkers.org/get-help/', icon: '💛' },
    { name: 'Mission for Migrant Workers', desc: 'Rights and welfare advice. St John\'s Cathedral, 4–8 Garden Road, Central.', phone: '25228264', display: '2522 8264', icon: '🤝' },
    { name: 'Pathfinders', desc: 'Support for pregnant migrant mothers: shelter, counselling and legal help.', phone: '51904886', display: '5190 4886', web: 'https://www.pathfinders.org.hk/en/', icon: '🤰' },
    { name: 'RainLily', desc: '24-hour crisis support for survivors of sexual violence.', phone: '23755322', display: '2375 5322', web: 'http://www.rainlily.org.hk/en/rainlily/', icon: '🆘' },
    { name: 'Justice Centre Hong Kong', desc: 'Legal help for forced labour and trafficking survivors.', phone: '31097359', display: '3109 7359', web: 'http://www.justicecentre.org.hk/', icon: '⚖️' },
    { name: 'Enrich HK', desc: 'Free money-management and savings courses for domestic workers.', phone: '23865811', display: '2386 5811', web: 'https://enrichhk.org', icon: '💰' },
    { name: 'Uplifters', desc: 'Free online courses and community support for migrant domestic workers.', phone: '97319731', display: '9731 9731', web: 'https://uplifters-edu.org/', icon: '📚' },
  ]},
  { group: 'Someone to talk to', icon: '💬', entries: [
    { name: 'The Samaritans', desc: '24-hour confidential someone to talk to, in English.', phone: '28960000', display: '2896 0000', icon: '💬' },
    { name: 'Social Welfare Department hotline', desc: 'Government support line, including help with an unplanned pregnancy.', phone: '23432255', display: '2343 2255', icon: '☎️' },
  ]},
];

function renderDirectory() {
  const box = document.getElementById('emergency-list');
  if (!box) return;
  box.innerHTML = DIRECTORY.map(function (g) {
    return '<div class="em-group-title">' + esc(g.group) + '</div>'
      + g.entries.map(function (e) {
        let actions = '<a class="em-call ' + (g.teal ? 'teal' : '') + '" href="tel:' + esc(e.phone) + '">📞 ' + esc(e.display) + '</a>';
        if (e.whatsapp) actions += '<a class="em-call teal" href="https://wa.me/' + esc(e.whatsapp) + '" target="_blank" rel="noopener">💬 WhatsApp</a>';
        if (e.web) actions += '<a class="em-web" href="' + esc(e.web) + '" target="_blank" rel="noopener">Official website ↗</a>';
        return '<div class="em-card ' + (g.emergency ? 'emergency' : '') + '">'
          + '<div class="em-ic">' + (e.icon || '📞') + '</div>'
          + '<div class="em-info"><div class="em-name">' + esc(e.name) + '</div>'
          + '<div class="em-desc">' + esc(e.desc) + '</div></div>'
          + '<div class="em-actions">' + actions + '</div></div>';
      }).join('');
  }).join('');
}

/* ===========================================================================
   BOOT
   =========================================================================== */
(function init() {
  renderChips();
  renderRecipes(RECIPES.slice(0, 6), false);

  const restSel = document.getElementById('rest-day');
  if (restSel) restSel.value = String(CB.get('restDay', 0));
  renderCalendar();

  restoreContract();
  renderContract();
  renderDirectory();

  // Re-render the countdown when the page is re-opened after sleeping.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) renderContract();
  });

  const last = CB.get('lastTool', 'recipe');
  showTool(TOOL_IDS.indexOf(last) !== -1 ? last : 'recipe');
})();
