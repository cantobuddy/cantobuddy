/* =============================================================================
   CantoBuddy  —  Learner App Logic
   ============================================================================= */

// ---- State -----------------------------------------------------------------

const STATE = {
  vocabulary: [],
  categories: [],
  learner: localStorage.getItem('cb_learner') || '',
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
    <button class="modal-share-btn" onclick="shareWord(${v.id})">${t('misc.shareWord')}</button>
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

  // Save progress
  try {
    await apiPost('/api/progress', {
      learner: STATE.learner,
      level: q.level,
      category_id: 0,
      quiz_type: q.type,
      score,
      total,
    });
  } catch (err) {
    console.error('Failed to save progress:', err);
  }

  // Remember the result so the share button can use it
  window._lastResult = { score, total, pct, type: q.type };

  const resultHtml = `
    <div class="quiz-question" style="text-align:center;padding:36px 20px">
      <div style="font-size:3rem;margin-bottom:12px">${pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '💪'}</div>
      <h2 style="font-size:1.6rem;font-weight:700;margin-bottom:8px">${t('result.complete')}</h2>
      <div style="font-size:2.5rem;font-weight:700;color:#e63946;margin:12px 0">${score} / ${total}</div>
      <div style="font-size:1rem;color:#6c757d">${pct}${t('result.percentCorrect')}</div>
      <div style="margin-top:24px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-outline" onclick="startQuiz('${q.type}')">${t('result.tryAgain')}</button>
        <button class="btn btn-primary" onclick="navigate('home')">${t('result.done')}</button>
      </div>
      <button class="btn btn-outline btn-block" style="margin-top:12px" onclick="shareResult()">${t('result.share')}</button>
    </div>
  `;

  document.getElementById('view-quiz-play').innerHTML = resultHtml;
}

function quitQuiz() {
  STATE.quiz = null;
  // Restore original quiz-play HTML (in case it was overwritten by results)
  location.reload();
}

// ---- Progress view ---------------------------------------------------------

async function renderProgress() {
  const wrap = document.getElementById('progress-content');
  if (!STATE.learner) {
    wrap.innerHTML = `<div class="progress-empty">${t('progress.setNameFirst')}</div>`;
    return;
  }

  try {
    const records = await apiGet(`/api/progress?learner=${encodeURIComponent(STATE.learner)}`);

    if (records.length === 0) {
      wrap.innerHTML = `<div class="progress-empty">${t('progress.none')}</div>`;
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

    let html = `
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
      const rpct = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
      const type = QUIZ_TYPES.find((x) => x.id === r.quiz_type);
      const date = new Date(r.created_at).toLocaleDateString();
      html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f0f0f0">
          <div>
            <div style="font-weight:600">${type ? type.icon + ' ' + quizTypeName(r.quiz_type) : r.quiz_type}</div>
            <div style="font-size:0.78rem;color:#6c757d">${levelEmojis[r.level]} ${levelLabel(r.level)} • ${date}</div>
          </div>
          <div style="font-weight:700;color:${rpct >= 50 ? '#52b788' : '#e63946'}">${r.score}/${r.total}</div>
        </div>
      `;
    }
    html += '</div>';

    wrap.innerHTML = html;
  } catch (err) {
    wrap.innerHTML = `<div class="progress-empty">${t('progress.couldNotLoad')}</div>`;
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

/** Share the most recent quiz score. */
function shareResult() {
  const r = window._lastResult;
  if (!r) return;
  const text = t('share.scoreText').replace('{score}', r.score).replace('{total}', r.total);
  shareOrCopy({ title: 'CantoBuddy', text, url: location.origin });
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

init();
