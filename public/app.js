/* =============================================================================
   CantoBuddy  —  Learner App Logic
   ============================================================================= */

// ---- State -----------------------------------------------------------------

// ---- Device identity -------------------------------------------------------
//
// A helper never creates an account. Her identity is a long random token kept
// in localStorage; the server turns it into a learner row the first time it
// sees it. The name is only a label — she can change it at any time without
// losing a single quiz result, because nothing is keyed on the name.
const DEVICE_KEY = 'cb_device';

function randomToken(bytes = 18) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function loadDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = 'dev_' + randomToken();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

const STATE = {
  vocabulary: [],
  categories: [],
  learner: localStorage.getItem('cb_learner') || '',
  deviceId: loadDeviceId(),   // this device's identity — never shown to the user
  employers: [],              // who is allowed to see this learner's progress
  currentLevel: 0,      // 0 = all, 1-3 = specific
  currentCat: 0,        // 0 = all
  quiz: null,           // active quiz object
};

// ---- TTS (Cantonese text-to-speech) with selectable practice voices --------

const VOICE_STORAGE_KEY = 'cb_voice_profile';

/**
 * Four practice voices: a woman's voice and a man's voice, each at two speeds.
 *
 * `pitch` is only applied as a FALLBACK — when the device has no real voice of
 * the requested gender. When a genuine male/female voice is found, pitch stays
 * at 1.0 so the voice sounds natural.
 */
const VOICE_PROFILES = [
  {
    id: 'woman-slow',
    gender: 'female',
    emoji: '👩‍🏫',
    speedEmoji: '🐢',
    speedKey: 'voice.slow',
    lang: 'zh-HK',
    rate: 0.5,
    pitch: 1.3,
  },
  {
    id: 'woman-normal',
    gender: 'female',
    emoji: '👩',
    speedEmoji: '🚶',
    speedKey: 'voice.natural',
    lang: 'zh-HK',
    rate: 0.85,
    pitch: 1.3,
  },
  {
    id: 'man-slow',
    gender: 'male',
    emoji: '👨‍🏫',
    speedEmoji: '🐢',
    speedKey: 'voice.slow',
    lang: 'zh-HK',
    rate: 0.5,
    pitch: 0.45,
  },
  {
    id: 'man-normal',
    gender: 'male',
    emoji: '👨',
    speedEmoji: '🚶',
    speedKey: 'voice.natural',
    lang: 'zh-HK',
    rate: 0.85,
    pitch: 0.45,
  },
];

// Known Chinese TTS voice names by gender (heuristic — varies by device/OS).
// NOTE: generic words like "male"/"man" are deliberately NOT listed here —
// they're handled by the word-boundary regex in detectGender(), because a
// plain substring match would wrongly flag "Mandarin" as male.
const FEMALE_VOICE_HINTS = [
  'huihui', 'yaoyao', 'xiaoxiao', 'xiaoyi', 'xiaomo', 'xiaohan', 'xiaoshuang',
  'ting-ting', 'tingting', 'mei-jia', 'meijia', 'sin-ji', 'sinji',
  'tracy', 'hanhan', 'zhiyu', 'lili',
  'samantha', 'karen', 'moira', 'tessa', 'fiona', 'zira', 'susan', 'yuna',
];
const MALE_VOICE_HINTS = [
  'kangkang', 'danny', 'li-mu', 'limu', 'yunjian', 'yunxi', 'yunyang',
  'hiuga', 'aaron', 'daniel', 'alex', 'fred', 'david', 'mark',
];

let _ttsVoices = [];
let _selectedVoiceId = localStorage.getItem(VOICE_STORAGE_KEY) || 'woman-normal';

function loadVoices() {
  _ttsVoices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  // Refresh the picker if it's currently open
  const list = document.getElementById('voice-list');
  if (list) renderVoiceList();
  updateVoiceButton();
}

if ('speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function getSelectedProfile() {
  // A specific installed voice chosen from the "All voices" list
  if (_selectedVoiceId.startsWith('voice:')) {
    const name = _selectedVoiceId.slice('voice:'.length);
    const v = _ttsVoices.find((x) => x.name === name);
    if (v) {
      const g = detectGender(v.name);
      return {
        id: _selectedVoiceId,
        gender: g === 'unknown' ? null : g,
        emoji: g === 'female' ? '👩' : g === 'male' ? '👨' : '🗣️',
        speedEmoji: '🎚️',
        speedLabel: v.lang,
        lang: v.lang,
        rate: 0.85,
        pitch: 1.0,
        fixedVoice: v,
      };
    }
    // That voice is no longer available — fall back to the default tile
    _selectedVoiceId = 'woman-normal';
  }
  return (
    VOICE_PROFILES.find((p) => p.id === _selectedVoiceId) ||
    VOICE_PROFILES.find((p) => p.id === 'woman-normal') ||
    VOICE_PROFILES[0]
  );
}

/** True if the device actually has a Cantonese (zh-HK / yue) voice installed. */
function hasCantoneseVoice() {
  return _ttsVoices.some((v) => /zh[-_]HK|yue/i.test(v.lang));
}

/** Chinese-capable voices on this device (Cantonese preferred). */
function chineseVoices() {
  return _ttsVoices.filter((v) => v.lang.startsWith('zh') || /yue/i.test(v.lang));
}

/**
 * Best-effort gender detection from a voice's name.
 * Returns 'female' | 'male' | 'unknown'.
 * Browsers don't expose gender, so this is a name-based heuristic.
 */
function detectGender(voiceName) {
  const n = (voiceName || '').toLowerCase();
  if (!n) return 'unknown';
  // Check female first — the word "female" contains "male"
  if (/\bfemale\b|woman|girl/.test(n)) return 'female';
  if (/\bmale\b|\bman\b|\bboy\b/.test(n)) return 'male';
  for (const h of FEMALE_VOICE_HINTS) if (n.includes(h)) return 'female';
  for (const h of MALE_VOICE_HINTS) if (n.includes(h)) return 'male';
  return 'unknown';
}

/**
 * Find the best available system voice for a profile.
 *
 * Priority:
 *   1. A real voice of the wanted gender in Cantonese (ideal)
 *   2. A real voice of the wanted gender in any Chinese dialect — a genuine
 *      male voice sounds male, whereas a pitch-shifted female voice usually
 *      does not, so correct gender wins over dialect here
 *   3. Any Cantonese (or Chinese) voice — pitch differentiates as a last resort
 */
function pickVoiceForProfile(profile) {
  const chinese = chineseVoices();
  if (chinese.length === 0) return null;

  const cantonese = chinese.filter((v) => /zh[-_]HK|yue/i.test(v.lang));

  if (profile.gender) {
    const cantoMatch = cantonese.filter((v) => detectGender(v.name) === profile.gender);
    if (cantoMatch.length > 0) return cantoMatch[0];

    const anyMatch = chinese.filter((v) => detectGender(v.name) === profile.gender);
    if (anyMatch.length > 0) return anyMatch[0];
  }

  return (cantonese.length > 0 ? cantonese : chinese)[0];
}

/**
 * True when the voice a profile would actually use already matches the
 * requested gender (so no pitch trickery is needed).
 */
function profileHasRealGender(profile) {
  const v = pickVoiceForProfile(profile);
  if (!v || !profile.gender) return false;
  return detectGender(v.name) === profile.gender;
}

/** Whether a real (name-identifiable) voice of the given gender exists. */
function hasRealGenderedVoice(gender) {
  return chineseVoices().some((v) => detectGender(v.name) === gender);
}

/**
 * Speak Cantonese text using the learner's selected practice voice.
 * Falls back to any available Chinese voice if Cantonese is unavailable.
 */
function speak(text, btn) {
  if (!('speechSynthesis' in window)) {
    alert('Audio is not supported on this browser. Please use Chrome or Safari.');
    return;
  }
  window.speechSynthesis.cancel();

  const profile = getSelectedProfile();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = profile.lang;
  const voice = profile.fixedVoice || pickVoiceForProfile(profile);
  if (voice) u.voice = voice;
  u.rate = profile.rate;

  // Only pitch-shift when the voice we got doesn't already match the gender
  // the learner asked for. A real male/female voice stays at its natural pitch.
  const gotGender = voice ? detectGender(voice.name) : 'unknown';
  const needsShift = profile.gender && gotGender !== profile.gender;
  u.pitch = needsShift ? profile.pitch : 1.0;

  if (btn) {
    btn.classList.add('playing');
    u.onend = () => btn.classList.remove('playing');
    u.onerror = () => btn.classList.remove('playing');
  }

  window.speechSynthesis.speak(u);
}

// ---- Voice picker UI -------------------------------------------------------

function updateVoiceButton() {
  const btn = document.getElementById('voice-btn');
  if (!btn) return;
  const profile = getSelectedProfile();
  btn.textContent = profile.emoji;
  const gender =
    profile.gender === 'female'
      ? t('voice.woman')
      : profile.gender === 'male'
        ? t('voice.man')
        : '';
  const speed = profile.speedKey ? t(profile.speedKey) : profile.speedLabel || '';
  btn.title = [t('header.voiceTitle'), gender, speed].filter(Boolean).join(' · ');
}

function openVoiceModal() {
  renderVoiceList();
  document.getElementById('voice-modal').classList.add('show');
}

function closeVoiceModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('voice-modal').classList.remove('show');
}

function renderVoiceList() {
  const wrap = document.getElementById('voice-list');
  if (!wrap) return;

  wrap.className = 'voice-grid';
  wrap.innerHTML = VOICE_PROFILES.map((p) => {
    const selected = p.id === _selectedVoiceId;
    const genderLabel = p.gender === 'female' ? t('voice.woman') : t('voice.man');
    // Mark tiles backed by a genuine voice of that gender
    const real = profileHasRealGender(p);
    const speedLabel = p.speedKey ? t(p.speedKey) : p.speedLabel || '';
    return `
      <div class="voice-tile ${selected ? 'selected' : ''}" onclick="selectVoice('${p.id}')">
        <div class="voice-tile-icon">${p.emoji}</div>
        <div class="voice-tile-gender">${genderLabel}${selected ? ' <span class="voice-check">✓</span>' : ''}</div>
        <div class="voice-tile-speed">${p.speedEmoji} ${speedLabel}</div>
        ${real ? `<div class="voice-tile-tag">${t('voice.realVoice')}</div>` : ''}
      </div>`;
  }).join('');

  renderVoiceDiagnostics();
}

/**
 * Show what's actually installed, and list every Chinese voice on the device
 * so the learner can pick a genuine male voice directly if one exists.
 */
function renderVoiceDiagnostics() {
  const status = document.getElementById('voice-status');
  const allWrap = document.getElementById('voice-all-wrap');
  const allList = document.getElementById('voice-all');

  const chinese = chineseVoices();
  const realFemale = hasRealGenderedVoice('female');
  const realMale = hasRealGenderedVoice('male');

  if (status) {
    if (!('speechSynthesis' in window)) {
      status.innerHTML = t('voice.noAudio');
    } else if (_ttsVoices.length === 0) {
      status.innerHTML = t('voice.loading');
    } else if (chinese.length === 0) {
      status.innerHTML = t('voice.noChinese');
    } else if (realMale && realFemale) {
      status.innerHTML = t('voice.bothFound');
    } else if (realMale) {
      status.innerHTML = t('voice.maleOnly');
    } else if (realFemale) {
      status.innerHTML = t('voice.femaleOnly');
    } else {
      status.innerHTML = t('voice.noGender');
    }
  }

  if (!allWrap || !allList) return;
  if (chinese.length === 0) {
    allWrap.style.display = 'none';
    return;
  }

  allWrap.style.display = '';
  allList.innerHTML = chinese
    .map((v, i) => {
      const g = detectGender(v.name);
      const badge =
        g === 'female'
          ? '👩 ' + t('voice.female')
          : g === 'male'
            ? '👨 ' + t('voice.male')
            : '❔ ' + t('voice.unknown');
      const selected = _selectedVoiceId === 'voice:' + v.name;
      return `
        <div class="voice-row ${selected ? 'selected' : ''}" onclick="selectVoiceByIndex(${i})">
          <div class="voice-row-info">
            <div class="voice-row-name">${v.name}</div>
            <div class="voice-row-lang">${v.lang}</div>
          </div>
          <div class="voice-row-badge">${badge}</div>
        </div>`;
    })
    .join('');
}

/** Select a specific installed voice by its index in the Chinese voice list. */
function selectVoiceByIndex(i) {
  const v = chineseVoices()[i];
  if (!v) return;
  selectVoice('voice:' + v.name);
}

function selectVoice(id) {
  _selectedVoiceId = id;
  localStorage.setItem(VOICE_STORAGE_KEY, id);
  renderVoiceList();
  updateVoiceButton();
  // Play a sample immediately so the learner hears the difference
  speak('你好');
}

// ---- API helpers -----------------------------------------------------------

async function apiGet(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${url} failed: ${r.status}`);
  return r.json();
}

async function apiPost(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `API ${url} failed: ${r.status}`);
  }
  return r.json();
}

async function apiDelete(url) {
  const r = await fetch(url, { method: 'DELETE' });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `API ${url} failed: ${r.status}`);
  }
  return r.json();
}

/** Escape text that came from another person before putting it in innerHTML. */
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---- Navigation ------------------------------------------------------------

function navigate(view) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');

  // bottom nav
  document.querySelectorAll('.nav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });

  window.scrollTo(0, 0);

  if (view === 'progress') renderProgress();
  if (view === 'share') renderSharePage();
}

function goBrowse(level) {
  if (level) {
    STATE.currentLevel = level;
    document.querySelectorAll('#filter-level .chip').forEach((c) => {
      c.classList.toggle('active', Number(c.dataset.val) === level);
    });
  }
  navigate('browse');
  renderVocabList();
}

// ---- Init ------------------------------------------------------------------

async function init() {
  try {
    const [vocab, cats] = await Promise.all([
      apiGet('/api/vocabulary'),
      apiGet('/api/categories'),
    ]);
    STATE.vocabulary = vocab;
    STATE.categories = cats;

    // Level counts on home
    for (const lvl of [1, 2, 3]) {
      const n = vocab.filter((v) => v.level === lvl).length;
      const el = document.getElementById('count-' + lvl);
      if (el) el.textContent = n + ' ' + t('home.words');
    }

    // Category pills on home
    renderHomeCategories();

    // Category filter chips
    renderCategoryChips();

    // Quiz type cards
    renderQuizTypes();

    // Learner badge
    updateLearnerBadge();

    // Voice picker button
    updateVoiceButton();

    // Apply the saved language to all static labels
    applyTranslations();
  } catch (err) {
    console.error('Init error:', err);
    document.getElementById('app').insertAdjacentHTML(
      'afterbegin',
      `<div style="padding:20px;text-align:center;color:#e63946">${t('misc.loadFailed')}</div>`
    );
  }
}

/**
 * Re-render everything that contains translated text.
 * Called by setLang() whenever the learner switches language.
 */
function rerenderForLanguage() {
  const counts = {};
  for (const lvl of [1, 2, 3]) counts[lvl] = STATE.vocabulary.filter((v) => v.level === lvl).length;
  for (const lvl of [1, 2, 3]) {
    const el = document.getElementById('count-' + lvl);
    if (el) el.textContent = counts[lvl] + ' ' + t('home.words');
  }
  renderHomeCategories();
  renderCategoryChips();
  renderQuizTypes();
  renderVocabList();
  updateLearnerBadge();
  renderVoiceList();

  const active = document.querySelector('.view.active');
  if (active && active.id === 'view-progress') renderProgress();
  if (active && active.id === 'view-share') renderSharePage();
}

function renderHomeCategories() {
  const wrap = document.getElementById('home-categories');
  if (!wrap) return;
  wrap.innerHTML =
    `<h4>${t('home.browseByCategory')}</h4>` +
    '<div class="cat-strip">' +
    STATE.categories
      .map(
        (c) => `
      <button class="cat-pill" onclick="filterByCategory(${c.id})">
        <span class="cat-pill-icon">${c.icon}</span>
        <span class="cat-pill-name">${categoryLabel(c)}</span>
      </button>`
      )
      .join('') +
    '</div>';
}

function filterByCategory(catId) {
  STATE.currentCat = catId;
  STATE.currentLevel = 0;
  document.querySelectorAll('#filter-level .chip').forEach((c) => {
    c.classList.toggle('active', Number(c.dataset.val) === 0);
  });
  renderCategoryChips();
  document.querySelectorAll('#filter-cat .chip').forEach((c) => {
    c.classList.toggle('active', Number(c.dataset.val) === catId);
  });
  navigate('browse');
  renderVocabList();
}

function renderCategoryChips() {
  const wrap = document.getElementById('filter-cat');
  if (!wrap) return;
  wrap.innerHTML =
    `<button class="chip active" data-val="0">${t('browse.all')}</button>` +
    STATE.categories
      .map(
        (c) =>
          `<button class="chip" data-val="${c.id}" onclick="setFilterCat(${c.id}, this)">${c.icon} ${categoryLabel(c)}</button>`
      )
      .join('');
}

// ---- Filters ---------------------------------------------------------------

document.querySelectorAll('#filter-level .chip').forEach((chip) => {
  chip.addEventListener('click', function () {
    document.querySelectorAll('#filter-level .chip').forEach((c) => c.classList.remove('active'));
    this.classList.add('active');
    STATE.currentLevel = Number(this.dataset.val);
    renderVocabList();
  });
});

function setFilterCat(catId, el) {
  document.querySelectorAll('#filter-cat .chip').forEach((c) => c.classList.remove('active'));
  el.classList.add('active');
  STATE.currentCat = catId;
  renderVocabList();
}

// ---- Vocab list ------------------------------------------------------------

function renderVocabList() {
  const wrap = document.getElementById('vocab-list');
  let items = STATE.vocabulary;

  if (STATE.currentLevel > 0)
    items = items.filter((v) => v.level === STATE.currentLevel);
  if (STATE.currentCat > 0)
    items = items.filter((v) => v.category_id === STATE.currentCat);

  // update title
  const title = document.getElementById('browse-title');
  title.textContent = levelLabel(STATE.currentLevel);

  if (items.length === 0) {
    wrap.innerHTML = `<div class="progress-empty">${t('browse.empty')}</div>`;
    return;
  }

  wrap.innerHTML = items
    .map(
      (v) => `
    <div class="vocab-card" onclick="openVocabModal(${v.id})">
      <div class="vocab-emoji">${v.emoji || '📝'}</div>
      <div class="vocab-body">
        <div class="vocab-cantonese">${v.cantonese}</div>
        <div class="vocab-jyutping">${v.jyutping}</div>
        <div class="vocab-english">${v.english}</div>
        ${v.tagalog ? `<div class="vocab-tagalog">${v.tagalog}</div>` : ''}
      </div>
      <button class="vocab-audio-btn" onclick="event.stopPropagation(); speak('${v.cantonese.replace(/'/g, "\\'")}', this)">🔊</button>
    </div>`
    )
    .join('');
}

// ---- Vocab modal (detailed card) ------------------------------------------

function openVocabModal(id) {
  const v = STATE.vocabulary.find((x) => x.id === id);
  if (!v) return;
  const cat = STATE.categories.find((c) => c.id === v.category_id);
  const modal = document.getElementById('vocab-modal');
  modal.querySelector('.modal-card').innerHTML = `
    <div class="modal-emoji">${v.emoji || '📝'}</div>
    <div class="modal-cantonese">${v.cantonese}</div>
    <div class="modal-jyutping">${v.jyutping}</div>
    <div class="modal-english">${v.english}</div>
    ${v.tagalog ? `<div class="modal-tagalog">${v.tagalog}</div>` : ''}
    ${cat ? `<div style="margin-top:8px;font-size:0.8rem;color:#6c757d">${cat.icon} ${categoryLabel(cat)}</div>` : ''}
    <button class="modal-audio-btn" onclick="speak('${v.cantonese.replace(/'/g, "\\'")}', this)">🔊</button>
    <div style="font-size:0.75rem;color:#6c757d;margin-top:6px">${t('browse.tapToHear')}</div>
    <button class="modal-share-btn" onclick="shareWord(${v.id})">${SHARE_ICON_SVG}${t('misc.shareWord')}</button>
    <button class="modal-close" onclick="closeModal()">${t('misc.close')}</button>
  `;
  modal.classList.add('show');
}

function closeModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('vocab-modal').classList.remove('show');
}

// ---- Learner name ----------------------------------------------------------

function updateLearnerBadge() {
  const badge = document.getElementById('learner-badge');
  if (STATE.learner) {
    badge.textContent = '👤 ' + STATE.learner;
  } else {
    badge.textContent = t('header.setName');
  }
}

function editLearnerName() {
  document.getElementById('name-input').value = STATE.learner;
  document.getElementById('name-modal').classList.add('show');
  setTimeout(() => document.getElementById('name-input').focus(), 100);
}

function closeNameModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('name-modal').classList.remove('show');
}

function saveLearnerName() {
  const name = document.getElementById('name-input').value.trim();
  if (!name) return;
  STATE.learner = name;
  localStorage.setItem('cb_learner', name);
  updateLearnerBadge();
  closeNameModal();
  // Push the new label to the server so any connected employer sees it too.
  identifySelf();
}

// ===========================================================================
// QUIZ ENGINE
// ===========================================================================

const QUIZ_TYPES = [
  { id: 'multiple_choice', icon: '🔤', nameKey: 'quiz.tMultipleChoice', descKey: 'quiz.dMultipleChoice' },
  { id: 'listen_choose', icon: '👂', nameKey: 'quiz.tListenChoose', descKey: 'quiz.dListenChoose' },
  { id: 'match_picture', icon: '🖼️', nameKey: 'quiz.tMatchPicture', descKey: 'quiz.dMatchPicture' },
  { id: 'fill_blank', icon: '✏️', nameKey: 'quiz.tFillBlank', descKey: 'quiz.dFillBlank' },
];

/** Translated display name for a quiz type id. */
function quizTypeName(typeId) {
  const q = QUIZ_TYPES.find((x) => x.id === typeId);
  return q ? t(q.nameKey) : typeId;
}

function renderQuizTypes() {
  const wrap = document.getElementById('quiz-types');
  if (!wrap) return;
  wrap.innerHTML = QUIZ_TYPES.map(
    (qt) => `
    <div class="quiz-type-card" onclick="startQuiz('${qt.id}')">
      <div class="quiz-type-icon">${qt.icon}</div>
      <div class="quiz-type-info">
        <h4>${t(qt.nameKey)}</h4>
        <p>${t(qt.descKey)}</p>
      </div>
    </div>`
  ).join('');
}

function goQuizSelect() {
  navigate('quiz-select');
}

// ---- Quiz level chips ----
document.querySelectorAll('#quiz-level .chip').forEach((chip) => {
  chip.addEventListener('click', function () {
    document.querySelectorAll('#quiz-level .chip').forEach((c) => c.classList.remove('active'));
    this.classList.add('active');
  });
});

function getQuizLevel() {
  const active = document.querySelector('#quiz-level .chip.active');
  return active ? Number(active.dataset.val) : 1;
}

// ---- Shuffle helper ----
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Generate quiz questions ----
function generateQuestions(type, level) {
  const pool = STATE.vocabulary.filter((v) => v.level === level);
  if (pool.length < 4) return [];

  const questions = [];
  const numQ = Math.min(10, pool.length);
  const chosen = shuffle(pool).slice(0, numQ);

  for (const item of chosen) {
    // Pick 3 distractors
    const distract = shuffle(pool.filter((v) => v.id !== item.id)).slice(0, 3);

    switch (type) {
      case 'multiple_choice':
        questions.push({
          type,
          item,
          prompt: t('quiz.promptMeaning'),
          display: {
            cantonese: item.cantonese,
            jyutping: item.jyutping,
            emoji: null,
          },
          options: shuffle([item, ...distract]).map((v) => v.english),
          answer: item.english,
        });
        break;

      case 'listen_choose':
        questions.push({
          type,
          item,
          prompt: t('quiz.promptListen'),
          display: { cantonese: item.cantonese, jyutping: null, emoji: null, listen: true },
          options: shuffle([item, ...distract]).map((v) => v.english),
          answer: item.english,
        });
        break;

      case 'match_picture':
        questions.push({
          type,
          item,
          prompt: t('quiz.promptMatch'),
          display: { cantonese: null, jyutping: null, emoji: item.emoji },
          options: shuffle([item, ...distract]).map((v) => v.cantonese),
          answer: item.cantonese,
        });
        break;

      case 'fill_blank':
        // Build a sentence with a blank — use advanced phrases if available,
        // otherwise wrap the word in a simple template sentence.
        let sentence, blankAnswer, options;

        if (level === 3 && item.cantonese.length > 4) {
          // It's already a sentence; split a key word out as the blank
          // For phrases we'll make the whole phrase the "answer" and
          // ask which phrase fills the context.
          sentence = item.english.replace(
            new RegExp(item.english.split(' ')[0], 'i'),
            '______'
          );
          blankAnswer = item.english.split(' ')[0];
          options = shuffle([
            blankAnswer,
            ...distract.map((v) => v.english.split(' ')[0]),
          ]);
        } else {
          // Simple template: "I want to ______."  etc.
          const templates = [
            `______ — ${item.jyutping}`,
            `Fill: ${item.english}`,
          ];
          sentence = `______  (${item.jyutping})`;
          blankAnswer = item.cantonese;
          options = shuffle([item, ...distract]).map((v) => v.cantonese);
        }

        questions.push({
          type,
          item,
          prompt: t('quiz.promptFill'),
          display: {
            cantonese: sentence,
            jyutping: null,
            emoji: null,
            blank: true,
          },
          options,
          answer: blankAnswer,
        });
        break;
    }
  }

  return questions;
}

// ---- Progress persistence --------------------------------------------------

/** Unique id for one run through a quiz. */
function newQuizSessionId() {
  return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

/**
 * Save the current quiz to the server.
 *
 * Called after EVERY answered question (completed = false) and once more when
 * the quiz finishes (completed = true). The server upserts on `session_id`, so
 * all of these writes collapse into a single row — which means a learner who
 * stops halfway still leaves a record behind instead of nothing at all.
 */
async function persistProgress(completed) {
  const q = STATE.quiz;
  if (!q || !STATE.learner) return null;
  try {
    return await apiPost('/api/progress', {
      session_id: q.sessionId,
      public_id: STATE.deviceId,
      learner: STATE.learner,
      level: q.level,
      category_id: 0,
      quiz_type: q.type,
      score: q.score,
      total: q.questions.length,
      answered: q.answeredCount,
      completed: !!completed,
    });
  } catch (err) {
    // A failed save must never interrupt the quiz itself.
    console.error('Failed to save progress:', err);
    return null;
  }
}

/**
 * Last-resort flush for when the learner closes the tab or switches away.
 * A normal fetch would be cancelled as the page unloads, so this uses
 * sendBeacon, which the browser guarantees to deliver.
 */
function flushProgressBeacon() {
  const q = STATE.quiz;
  if (!q || !STATE.learner) return;
  const payload = JSON.stringify({
    session_id: q.sessionId,
    public_id: STATE.deviceId,
    learner: STATE.learner,
    level: q.level,
    category_id: 0,
    quiz_type: q.type,
    score: q.score,
    total: q.questions.length,
    answered: q.answeredCount,
    completed: false,
  });
  try {
    navigator.sendBeacon('/api/progress', new Blob([payload], { type: 'application/json' }));
  } catch (e) {
    /* nothing more we can do while the page is going away */
  }
}

window.addEventListener('pagehide', flushProgressBeacon);
// iOS Safari often skips pagehide, but does fire visibilitychange.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushProgressBeacon();
});

// ---- Start quiz ----
function startQuiz(type) {
  const level = getQuizLevel();
  const questions = generateQuestions(type, level);

  if (questions.length < 4) {
    alert(t('quiz.notEnough'));
    return;
  }

  if (!STATE.learner) {
    // Prompt for name first
    editLearnerName();
    // Store pending quiz and retry after name is saved
    window._pendingQuiz = { type, level };
    return;
  }

  STATE.quiz = {
    type,
    level,
    questions,
    index: 0,
    score: 0,
    answeredCount: 0,
    sessionId: newQuizSessionId(),
    answered: false,
  };

  navigate('quiz-play');
  renderQuizQuestion();
}

// ---- Render question ----
function renderQuizQuestion() {
  const q = STATE.quiz;
  if (!q) return;

  const total = q.questions.length;
  const num = q.index + 1;

  document.getElementById('quiz-q-num').textContent = `${t('quiz.questionOf')} ${num}/${total}`;
  document.getElementById('quiz-score').textContent = `${t('quiz.score')} ${q.score}`;
  document.getElementById('quiz-bar-fill').style.width = `${(num / total) * 100}%`;

  const item = q.questions[q.index];
  const qWrap = document.getElementById('quiz-question');
  const oWrap = document.getElementById('quiz-options');
  const fWrap = document.getElementById('quiz-feedback');
  fWrap.innerHTML = '';
  q.answered = false;

  // Build question display
  let html = '<div class="quiz-question-inner">';

  if (item.display.listen) {
    html += `<button class="quiz-listen-btn" onclick="speak('${item.display.cantonese.replace(/'/g, "\\'")}', this)">🔊</button>`;
    html += `<div class="quiz-q-prompt">${t('quiz.tapSpeaker')}</div>`;
  } else if (item.display.emoji) {
    html += `<div class="quiz-q-emoji">${item.display.emoji}</div>`;
    html += `<div class="quiz-q-prompt">${item.prompt}</div>`;
  } else if (item.display.blank) {
    html += `<div class="quiz-q-blank">${item.display.cantonese}</div>`;
    html += `<div class="quiz-q-prompt">${item.prompt}</div>`;
  } else {
    if (item.display.emoji) html += `<div class="quiz-q-emoji">${item.display.emoji}</div>`;
    html += `<div class="quiz-q-cantonese">${item.display.cantonese}</div>`;
    if (item.display.jyutping)
      html += `<div class="quiz-q-jyutping">${item.display.jyutping}</div>`;
    html += `<div class="quiz-q-prompt">${item.prompt}</div>`;
  }
  html += '</div>';
  qWrap.innerHTML = html;

  // For listen_choose, auto-play on render
  if (item.display.listen) {
    setTimeout(() => {
      const btn = qWrap.querySelector('.quiz-listen-btn');
      if (btn) speak(item.display.cantonese, btn);
    }, 400);
  }

  // Options
  oWrap.innerHTML = item.options
    .map(
      (opt, i) =>
        `<button class="quiz-option" data-val="${escapeAttr(opt)}" onclick="answerQuiz(this)">${opt}</button>`
    )
    .join('');
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---- Answer handling ----
function answerQuiz(btn) {
  const q = STATE.quiz;
  if (!q || q.answered) return;
  q.answered = true;

  const chosen = btn.textContent;
  const item = q.questions[q.index];
  const correct = chosen === item.answer;

  // Disable all options, highlight correct/wrong
  document.querySelectorAll('.quiz-option').forEach((opt) => {
    opt.classList.add('disabled');
    if (opt.textContent === item.answer) opt.classList.add('correct');
    else if (opt === btn) opt.classList.add('wrong');
  });

  const fWrap = document.getElementById('quiz-feedback');
  if (correct) {
    q.score++;
    fWrap.innerHTML = `<div class="fb-correct">${t('quiz.correct')}</div>`;
  } else {
    fWrap.innerHTML = `<div class="fb-wrong">${t('quiz.answerIs')} ${item.answer}</div>`;
  }

  // Persist right away (fire-and-forget) so that even a quiz abandoned on the
  // very next screen still counts as an attempt.
  q.answeredCount++;
  persistProgress(false);

  // Next button
  const isLast = q.index === q.questions.length - 1;
  fWrap.innerHTML += `<div class="fb-next"><button class="btn btn-primary" onclick="${isLast ? 'finishQuiz()' : 'nextQuestion()'}">${isLast ? t('quiz.seeResults') : t('quiz.next')}</button></div>`;
}

function nextQuestion() {
  STATE.quiz.index++;
  renderQuizQuestion();
}

// ---- Finish quiz ----
async function finishQuiz() {
  const q = STATE.quiz;
  if (!q) return;
  const total = q.questions.length;
  const score = q.score;
  const pct = Math.round((score / total) * 100);

  // Mark this attempt as finished. The server upserts on session_id, so this
  // updates the partial row already written during the quiz rather than
  // creating a second one.
  await persistProgress(true);

  // Ask for the rewards now, while the learner is looking at her score — this
  // is the moment a new sticker actually means something. The server reports
  // each unlock exactly once, so this cannot re-announce an old one.
  const rewards = await fetchRewards();
  const celebration = renderStickerCelebration(rewards);

  // Remember the result so the share button can use it
  window._lastResult = { score, total, pct, type: q.type };

  const resultHtml = `
    <div class="quiz-question" style="text-align:center;padding:36px 20px">
      <div style="font-size:3rem;margin-bottom:12px">${pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '💪'}</div>
      <h2 style="font-size:1.6rem;font-weight:700;margin-bottom:8px">${t('result.complete')}</h2>
      <div style="font-size:2.5rem;font-weight:700;color:#e63946;margin:12px 0">${score} / ${total}</div>
      <div style="font-size:1rem;color:#6c757d">${pct}${t('result.percentCorrect')}</div>
      ${celebration}
      <div style="margin-top:24px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-outline" onclick="startQuiz('${q.type}')">${t('result.tryAgain')}</button>
        <button class="btn btn-primary" onclick="navigate('home')">${t('result.done')}</button>
      </div>
      ${
        rewards && rewards.newly_unlocked && rewards.newly_unlocked.length
          ? `<button class="btn btn-primary btn-block" style="margin-top:12px" onclick="navigate('progress')">🏅 ${t('rewards.viewAlbum')}</button>`
          : ''
      }
      <button class="btn btn-outline btn-block" style="margin-top:12px" onclick="shareResult()">${SHARE_ICON_SVG}${t('result.share')}</button>
    </div>
  `;

  document.getElementById('view-quiz-play').innerHTML = resultHtml;
}

async function quitQuiz() {
  // Flush the partial result before the page reloads, then clear the session so
  // the unload beacon can't write a duplicate row.
  await persistProgress(false);
  STATE.quiz = null;
  // Restore original quiz-play HTML (in case it was overwritten by results)
  location.reload();
}

// ---- Rewards: credits and stickers -----------------------------------------
//
// Credits are earned, never bought: one per correct quiz answer, counted by the
// server from the progress rows themselves. Stickers unlock at credit
// thresholds. Nothing here is money — see the note in the project memory.

/** The reward state for this device, cached for the current render. */
let _rewards = null;

async function fetchRewards() {
  try {
    _rewards = await apiGet(
      '/api/learners/rewards?public_id=' + encodeURIComponent(STATE.deviceId)
    );
  } catch (err) {
    _rewards = null;
  }
  return _rewards;
}

/** A sticker's name in the language currently being read. */
function stickerName(s) {
  return currentLang() === 'fil' ? s.tagalog || s.english : s.english;
}

/**
 * The credit balance and the sticker album.
 *
 * Uncollected stickers still show what they cost, so the album reads as
 * something to work towards rather than a wall of padlocks. Each sticker is
 * also a phrase worth knowing, so it doubles as a vocabulary list.
 */
function renderRewardsCard() {
  const r = _rewards;
  if (!r || !r.stickers.length) return '';

  const collected = r.stickers.filter((s) => s.unlocked).length;
  const creditWord = r.credits === 1 ? t('rewards.creditOne') : t('rewards.credits');

  let next;
  if (r.next) {
    const pct = Math.min(100, Math.round((r.credits / r.next.credits) * 100));
    const left = r.next.credits - r.credits;
    next = `
      <div class="rewards-next">
        <div class="rewards-next-row">
          <span>${t('rewards.next')}</span>
          <span class="rewards-next-count">${left} ${t('rewards.toGo')}</span>
        </div>
        <div class="rewards-next-name">${r.next.emoji} ${escapeHtml(stickerName(r.next))}</div>
        <div class="progress-bar-mini"><div class="progress-bar-mini-fill" style="width:${pct}%"></div></div>
      </div>`;
  } else {
    next = `<p class="rewards-complete">${t('rewards.complete')}</p>`;
  }

  const tiles = r.stickers
    .map((s) =>
      s.unlocked
        ? `<div class="sticker-tile is-unlocked">
             <div class="sticker-emoji">${s.emoji}</div>
             <div class="sticker-name">${escapeHtml(stickerName(s))}</div>
             <div class="sticker-canto">${escapeHtml(s.cantonese)}</div>
           </div>`
        : `<div class="sticker-tile is-locked" title="${t('rewards.notYet')}">
             <div class="sticker-emoji">🔒</div>
             <div class="sticker-name">${s.credits}</div>
             <div class="sticker-canto">${t('rewards.credits')}</div>
           </div>`
    )
    .join('');

  return `
    <div class="progress-card rewards-card">
      <h4>${t('rewards.title')}</h4>
      <div class="rewards-balance">
        <span class="rewards-credits">${r.credits}</span>
        <span class="rewards-credit-word">${creditWord}</span>
        <span class="rewards-count">${collected}/${r.stickers.length}</span>
      </div>
      <p class="rewards-hint">${t('rewards.hint')}</p>
      ${next}
      <div class="sticker-grid">${tiles}</div>
    </div>`;
}

/**
 * The "you earned a sticker" block shown on the quiz result screen.
 *
 * Only ever shows stickers unlocked by THIS quiz — the server reports them once
 * and then forgets, so re-opening the result cannot re-announce them.
 */
function renderStickerCelebration(r) {
  if (!r || !r.newly_unlocked || !r.newly_unlocked.length) return '';
  const won = r.stickers.filter((s) => r.newly_unlocked.includes(s.key));
  const body =
    won.length === 1
      ? t('rewards.newBody').replace('{name}', escapeHtml(stickerName(won[0])))
      : t('rewards.newBodyMany').replace('{n}', won.length);

  return `
    <div class="sticker-celebrate">
      <div class="sticker-celebrate-title">${t('rewards.newTitle')}</div>
      <div class="sticker-celebrate-row">
        ${won.map((s) => `<span class="sticker-celebrate-tile">${s.emoji}</span>`).join('')}
      </div>
      <div class="sticker-celebrate-body">${body}</div>
    </div>`;
}

// ---- Connect with a code ---------------------------------------------------
//
// An invitation link needs the employer to send it. Reading a code out loud or
// writing it on paper is often easier — so the code is a second door into the
// SAME flow, not a second implementation of it: this only looks the code up and
// then hands over to openJoinModal().

/** Accept what a person actually types: spaces, dashes, lower case. */
function normaliseCode(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function openCodeModal() {
  const input = document.getElementById('code-input');
  const err = document.getElementById('code-error');
  if (input) input.value = '';
  if (err) err.textContent = '';
  document.getElementById('code-modal').classList.add('show');
  setTimeout(() => input && input.focus(), 120);
}

function closeCodeModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('code-modal').classList.remove('show');
}

async function submitEmployerCode() {
  const input = document.getElementById('code-input');
  const errEl = document.getElementById('code-error');
  const btn = document.getElementById('code-submit');
  const code = normaliseCode(input && input.value);
  if (errEl) errEl.textContent = '';

  // Codes are 8 characters; anything much shorter is a typo, and asking the
  // server about it would just burn a lookup.
  if (code.length < 6) {
    if (errEl) errEl.textContent = t('connect.codeNotFound');
    return;
  }

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('connect.codeChecking');
  try {
    const inv = await apiGet('/api/invitations/' + encodeURIComponent(code));
    document.getElementById('code-modal').classList.remove('show');
    openJoinModal(inv, code);
  } catch (err) {
    if (errEl) errEl.textContent = t('connect.codeNotFound');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// ---- Progress view ---------------------------------------------------------

async function renderProgress() {
  const wrap = document.getElementById('progress-content');
  if (!STATE.learner) {
    wrap.innerHTML = `<div class="progress-empty">${t('progress.setNameFirst')}</div>`;
    return;
  }

  try {
    // Read by device token, not by name. The server resolves the token, so this
    // can only ever return the rows belonging to this device.
    const records = await apiGet(`/api/progress?public_id=${encodeURIComponent(STATE.deviceId)}`);
    await fetchRewards();

    if (records.length === 0) {
      wrap.innerHTML =
        `<div class="progress-empty">${t('progress.none')}</div>` +
        renderRewardsCard() +
        renderSharingCard();
      return;
    }

    // Overall stats
    const totalScore = records.reduce((s, r) => s + r.score, 0);
    const totalMax = records.reduce((s, r) => s + r.total, 0);
    const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

    // By level
    const byLevel = {};
    for (const r of records) {
      if (!byLevel[r.level]) byLevel[r.level] = { score: 0, max: 0, attempts: 0 };
      byLevel[r.level].score += r.score;
      byLevel[r.level].max += r.total;
      byLevel[r.level].attempts++;
    }

    const levelEmojis = { 1: '🌱', 2: '🌿', 3: '🌳' };

    let html = renderRewardsCard() + `
      <div class="progress-card">
        <h4>${t('progress.overall')}</h4>
        <div class="progress-score">${pct}%</div>
        <div class="progress-detail">${totalScore} ${t('progress.correctOutOf')} ${totalMax} • ${records.length} ${t('progress.attempts')}</div>
        <div class="progress-bar-mini"><div class="progress-bar-mini-fill" style="width:${pct}%"></div></div>
      </div>
    `;

    html += `<div class="progress-card"><h4>${t('progress.byLevel')}</h4>`;
    for (const lvl of [1, 2, 3]) {
      const d = byLevel[lvl];
      if (!d) continue;
      const lpct = d.max > 0 ? Math.round((d.score / d.max) * 100) : 0;
      html += `
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-weight:600">${levelEmojis[lvl]} ${levelLabel(lvl)}</span>
            <span style="font-size:0.85rem;color:#6c757d">${d.score}/${d.max} (${lpct}%)</span>
          </div>
          <div class="progress-bar-mini"><div class="progress-bar-mini-fill" style="width:${lpct}%"></div></div>
        </div>
      `;
    }
    html += '</div>';

    // Recent attempts
    html += `<div class="progress-card"><h4>${t('progress.recent')}</h4>`;
    const recent = records.slice(-5).reverse();
    for (const r of recent) {
      // `completed` arrives as a boolean from the old JSON store and as 0/1
      // from SQLite — accept both, or abandoned quizzes stop being flagged.
      const partial = r.completed === false || r.completed === 0;
      const rpct = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
      const type = QUIZ_TYPES.find((x) => x.id === r.quiz_type);
      const date = new Date(r.created_at).toLocaleDateString();
      const badge = partial
        ? ` <span style="font-size:0.68rem;font-weight:600;color:#8a5a00;background:#fdf0d5;border-radius:999px;padding:1px 7px">${t('progress.partial')}</span>`
        : '';
      const detail = partial
        ? `${levelEmojis[r.level]} ${levelLabel(r.level)} • ${t('progress.stoppedAt')} ${r.answered || 0}/${r.total}`
        : `${levelEmojis[r.level]} ${levelLabel(r.level)} • ${date}`;
      html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f0f0f0">
          <div>
            <div style="font-weight:600">${type ? type.icon + ' ' + quizTypeName(r.quiz_type) : r.quiz_type}${badge}</div>
            <div style="font-size:0.78rem;color:#6c757d">${detail}</div>
          </div>
          <div style="font-weight:700;color:${rpct >= 50 ? '#52b788' : '#e63946'}">${r.score}/${r.total}</div>
        </div>
      `;
    }
    html += '</div>';

    // Who is allowed to see all of the above.
    html += renderSharingCard();

    wrap.innerHTML = html;
  } catch (err) {
    wrap.innerHTML = `<div class="progress-empty">${t('progress.couldNotLoad')}</div>`;
  }
}

// ---- Sharing: who can see my progress --------------------------------------

/**
 * The consent panel, shown at the bottom of My Progress.
 *
 * This is the helper's side of the deal. It lists exactly who can see her
 * scores and lets her withdraw that with one tap — no confirmation, no
 * notification to the employer. She may not feel free to refuse an employer's
 * invitation, so leaving has to be frictionless.
 */
function renderSharingCard() {
  const list = STATE.employers || [];
  let inner;

  if (!list.length) {
    inner = `<p class="sharing-none">${t('sharing.none')}</p>`;
  } else {
    inner = list
      .map(
        (e) => `
      <div class="sharing-row">
        <div style="min-width:0">
          <div class="sharing-name">👤 ${escapeHtml(e.employer_name || '')}</div>
          <div class="sharing-meta">${t('sharing.since')} ${new Date(e.connected_at).toLocaleDateString()}</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="disconnectEmployer(${e.id})">${t('sharing.stop')}</button>
      </div>`
      )
      .join('');
  }

  return `
    <div class="progress-card sharing-card">
      <h4>${t('sharing.title')}</h4>
      <p class="sharing-hint">${t('sharing.hint')}</p>
      ${inner}
      <button class="btn btn-outline btn-block sharing-code-btn" onclick="openCodeModal()">
        🔑 ${t('sharing.enterCode')}
      </button>
    </div>`;
}

/** Withdraw an employer's access. One call, no confirmation dialog. */
async function disconnectEmployer(linkId) {
  try {
    const res = await apiDelete(
      `/api/learners/employers/${linkId}?public_id=${encodeURIComponent(STATE.deviceId)}`
    );
    STATE.employers = res.employers || [];
    showToast(t('sharing.stopped'));
    renderProgress();
  } catch (err) {
    showToast(t('sharing.failed'));
  }
}

// ---- Share -----------------------------------------------------------------

/** Show a short confirmation message at the bottom of the screen. */
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2200);
}

/**
 * Share via the native share sheet when available (mobile), otherwise copy
 * to the clipboard. Handles the user cancelling the share sheet gracefully.
 */
async function shareOrCopy({ title, text, url }) {
  const payload = { title, text, url };
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) {
      await navigator.share(payload);
      return;
    }
  } catch (err) {
    // Cancelling the share sheet isn't an error worth reporting
    if (err && err.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    showToast(t('share.copied'));
  } catch {
    showToast(t('share.failed'));
  }
}

/** Share a single vocabulary word. */
function shareWord(id) {
  const v = STATE.vocabulary.find((x) => x.id === id);
  if (!v) return;
  const meaning = v.tagalog ? `${v.english} / ${v.tagalog}` : v.english;
  const text = `${v.emoji || ''} ${v.cantonese} (${v.jyutping}) = ${meaning}\n${t('share.wordText')}`;
  shareOrCopy({ title: 'CantoBuddy', text: text.trim(), url: location.origin });
}

/**
 * The share glyph — a box with an arrow leaving it, the icon people already
 * recognise as "share".
 *
 * Inline SVG rather than an emoji, for two reasons: it inherits the surrounding
 * text colour, so it is grey on an inactive nav tab and red when active; and it
 * stays crisp at any size. The outbox-tray emoji it replaces rendered as a pale
 * grey tray that read as a small cloud at nav size.
 */
const SHARE_ICON_SVG = `
  <svg class="share-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12.4 5.4H7.2A2.6 2.6 0 0 0 4.6 8v9.4A2.6 2.6 0 0 0 7.2 20h9.2A2.6 2.6 0 0 0 19 17.4V12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M9.5 14.8C9.9 11.4 12.2 9.5 15.3 9.5h2.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M17.1 6.1 22.6 9.5 17.1 12.9z" fill="currentColor"/>
  </svg>`;

/** Fill every `data-share-icon` placeholder with the share glyph. */
function mountShareIcons() {
  document.querySelectorAll('[data-share-icon]').forEach((el) => {
    el.innerHTML = SHARE_ICON_SVG;
  });
}

/** Share the most recent quiz score. */
function shareResult() {
  const r = window._lastResult;
  if (!r) return;
  const text = t('share.scoreText').replace('{score}', r.score).replace('{total}', r.total);
  shareOrCopy({ title: 'CantoBuddy', text, url: location.origin });
}

/**
 * Share the app itself, so a helper can tell a friend about CantoBuddy.
 *
 * The URL is deliberately `location.origin` and never the current path. If she
 * is sitting on a /join/<code> page, the path holds a private invitation code,
 * and forwarding it would hand a stranger access to her practice. The origin
 * is always just the site itself.
 */
function shareApp() {
  shareOrCopy({
    title: 'CantoBuddy',
    text: t('sharePage.message'),
    url: location.origin,
  });
}

/** Copy just the site link, for pasting somewhere by hand. */
async function copyShareLink() {
  try {
    await navigator.clipboard.writeText(location.origin);
    showToast(t('sharePage.copied'));
  } catch {
    showToast(t('sharePage.copyFailed'));
  }
}

/**
 * Fill in the Share page: the exact message the friend will receive, and the
 * link. Re-run on language change so the preview matches what would be sent.
 */
function renderSharePage() {
  const url = location.origin;
  const previewText = document.getElementById('share-preview-text');
  const previewLink = document.getElementById('share-preview-link');
  if (previewText) previewText.textContent = t('sharePage.message');
  if (previewLink) previewLink.textContent = url;
}

// ---- Employer connections --------------------------------------------------
//
// A helper connects to an employer by opening an invitation link. She has no
// account, so the link is the entire flow: show who is asking, then accept.

/** Tell the server which device this is, and who may see its progress. */
async function identifySelf() {
  try {
    const res = await apiPost('/api/learners/identify', {
      public_id: STATE.deviceId,
      display_name: STATE.learner,
    });
    STATE.employers = res.employers || [];
  } catch (err) {
    console.warn('Could not identify this device:', err);
  }
}

/** The invitation code from /join/<code>, if this is an invitation link. */
function inviteCodeFromPath() {
  const m = location.pathname.match(/^\/join\/([A-Za-z0-9]+)\/?$/);
  return m ? m[1].toUpperCase() : null;
}

/** Handle /join/<code>: look the invitation up and show the connect card. */
async function handleJoinLink() {
  const code = inviteCodeFromPath();
  if (!code) return;
  try {
    const inv = await apiGet('/api/invitations/' + encodeURIComponent(code));
    openJoinModal(inv, code);
  } catch (err) {
    openJoinError(err.message);
  }
}

function openJoinModal(inv, code) {
  const employer = inv.employer_name || '';
  const needsName = !STATE.learner;

  document.getElementById('join-body').innerHTML = `
    <div class="join-icon">🤝</div>
    <h3>${t('connect.title').replace('{name}', escapeHtml(employer))}</h3>
    <p class="modal-hint">${t('connect.see').replace('{name}', escapeHtml(employer))}</p>
    ${inv.note ? `<blockquote class="join-note">${escapeHtml(inv.note)}</blockquote>` : ''}
    ${
      needsName
        ? `<div class="form-field" style="text-align:left">
             <label for="join-name">${t('connect.yourName')}</label>
             <input type="text" id="join-name" maxlength="30" placeholder="${t('name.placeholder')}" />
             <p class="form-hint">${t('connect.nameHint')}</p>
           </div>`
        : ''
    }
    <div id="join-error" class="form-error"></div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeJoinModal()">${t('connect.notNow')}</button>
      <button class="btn btn-primary" id="join-connect" onclick="acceptInvite('${code}')">${t('connect.connect')}</button>
    </div>`;
  document.getElementById('join-modal').classList.add('show');
}

function openJoinError(message) {
  document.getElementById('join-body').innerHTML = `
    <div class="join-icon">⚠️</div>
    <h3>${t('connect.invalid')}</h3>
    <p class="modal-hint">${escapeHtml(message || '')}</p>
    <div class="modal-actions">
      <button class="btn btn-primary btn-block" onclick="closeJoinModal()">${t('misc.close')}</button>
    </div>`;
  document.getElementById('join-modal').classList.add('show');
}

async function acceptInvite(code) {
  const btn = document.getElementById('join-connect');
  const errEl = document.getElementById('join-error');
  if (errEl) errEl.textContent = '';

  // If she has no name yet, take the one she typed on the card.
  const nameInput = document.getElementById('join-name');
  if (nameInput) {
    const name = nameInput.value.trim();
    if (!name) {
      if (errEl) errEl.textContent = t('connect.yourName');
      return;
    }
    STATE.learner = name;
    localStorage.setItem('cb_learner', name);
    updateLearnerBadge();
  }

  btn.disabled = true;
  btn.textContent = t('connect.connecting');

  try {
    const res = await apiPost(`/api/invitations/${encodeURIComponent(code)}/accept`, {
      public_id: STATE.deviceId,
      display_name: STATE.learner,
    });
    STATE.employers = res.employers || [];
    const employer = (res.employer && res.employer.name) || '';

    // Rewrite /join/<code> → / so a refresh does not replay the join.
    history.replaceState({}, '', '/');

    document.getElementById('join-body').innerHTML = `
      <div class="join-icon">🎉</div>
      <h3>${t('connect.doneTitle')}</h3>
      <p class="modal-hint">${t('connect.doneBody').replace('{name}', escapeHtml(employer))}</p>
      <div class="modal-actions">
        <button class="btn btn-primary btn-block" onclick="closeJoinModal()">${t('connect.doneBtn')}</button>
      </div>`;
  } catch (err) {
    btn.disabled = false;
    btn.textContent = t('connect.connect');
    if (errEl) errEl.textContent = err.message || t('connect.failed');
  }
}

function closeJoinModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('join-modal').classList.remove('show');
  // Dismissing an invitation should also get the join URL out of the way.
  if (inviteCodeFromPath()) history.replaceState({}, '', '/');
}

// ---- PWA -------------------------------------------------------------------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

// ---- Boot ------------------------------------------------------------------

(async function boot() {
  // Icons first, so the share glyph is present even if the data fetch fails.
  mountShareIcons();
  await init();
  // Register this device with the server so it can attach progress to a learner
  // row, and learn who (if anyone) is allowed to see that progress.
  await identifySelf();
  // Then handle an invitation link, if this load is one.
  handleJoinLink();
})();
