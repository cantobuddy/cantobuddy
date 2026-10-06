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
  nameRequired: false,   // true while the name dialog is a gate, not an edit
  deviceId: loadDeviceId(),   // this device's identity — never shown to the user
  employers: [],              // who is allowed to see this learner's progress
  currentLevel: 0,      // 0 = all, 1-3 = specific
  currentCat: 0,        // 0 = all
  quiz: null,           // active quiz object
  stats: null,          // her own statistics, from /api/learners/stats
  statsDays: 30,        // chart window only — never affects totals or streak
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
    const err = new Error(e.error || `API ${url} failed: ${r.status}`);
    // Callers that must tell one refusal from another need the code, not the
    // sentence — a throttled 429 and a server error are both "it did not work"
    // to a naive check, but only one of them is worth retrying.
    err.status = r.status;
    throw err;
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
  // My Progress is read by device token but *displayed* by name, and an unnamed
  // learner sees a board with nothing to attribute. Ask for the name before
  // showing it rather than after she has already been disappointed by it.
  if (view === 'progress' && !STATE.learner) {
    window._pendingView = 'progress';
    editLearnerName(true);
    return;
  }

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
  // Before anything else, and before the identify call below can send it: record
  // the ?ref= this device arrived with. Attribution is first-touch, so missing
  // it here would lose the referrer permanently.
  captureReferrer();

  try {
    const [vocab, cats] = await Promise.all([
      apiGet('/api/vocabulary'),
      apiGet('/api/categories'),
    ]);
    STATE.vocabulary = vocab;
    STATE.categories = cats;

    // Category pills on home
    renderHomeCategories();

    // Category filter chips
    renderCategoryChips();

    // Quiz type cards
    renderQuizTypes();

    // Voice picker button
    updateVoiceButton();

    // Apply the saved language to all static labels. This rewrites the
    // textContent of every [data-i18n] element, so anything dynamic has to be
    // rendered *after* it or it gets overwritten with the static placeholder.
    applyTranslations();

    // Learner badge last, for that reason — it shows her name, not a label.
    updateLearnerBadge();
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
  renderHomeCategories();
  renderCategoryChips();
  renderQuizTypes();
  renderVocabList();
  updateLearnerBadge();
  renderVoiceList();

  const active = document.querySelector('.view.active');
  if (active && active.id === 'view-progress') renderProgress();
  if (active && active.id === 'view-share') renderSharePage();

  // The install dialog's instructions are built in JS, so a language switch has
  // to rebuild them or half the text stays in the old language.
  const installModal = document.getElementById('install-modal');
  if (installModal && installModal.classList.contains('show')) renderInstallModal();
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

  // "Words viewed" is words put in front of her by a browse list — the honest
  // reading of this screen. It is a count, never a record of which words.
  bumpActivity('words_viewed', items.length);

  wrap.innerHTML = items
    .map(
      (v) => `
    <div class="vocab-card" onclick="openVocabModal(${v.id})">
      <div class="vocab-emoji">${v.emoji || '📝'}</div>
      <div class="vocab-body">
        <div class="vocab-cantonese">${v.cantonese}</div>
        <div class="vocab-jyutping">${v.jyutping}</div>
        ${meaningRows(v)}
      </div>
      <button class="vocab-audio-btn" onclick="event.stopPropagation(); speak('${v.cantonese.replace(/'/g, "\\'")}', this)">🔊</button>
    </div>`
    )
    .join('');
}

/**
 * The meaning side of a vocabulary card, in the reader's own language.
 *
 * The rule is the same one the stickers and the categories already follow: show
 * the language being read FIRST, keep English underneath as the fallback,
 * because an entry with no gloss in her language must still say something
 * rather than render an empty box.
 *
 * `mandarin` is a MEANING, not a translation of the Cantonese — which is why a
 * zh reader sees 谢谢 for 多謝 rather than a romanisation she cannot use.
 */
function meaningRows(v) {
  const lang = currentLang();
  if (lang === 'zh') {
    return (
      (v.mandarin ? `<div class="vocab-english">${escapeHtml(v.mandarin)}</div>` : '') +
      (v.english ? `<div class="vocab-tagalog">${escapeHtml(v.english)}</div>` : '')
    );
  }
  if (lang === 'fil') {
    return (
      (v.tagalog ? `<div class="vocab-english">${escapeHtml(v.tagalog)}</div>` : '') +
      (v.english ? `<div class="vocab-tagalog">${escapeHtml(v.english)}</div>` : '')
    );
  }
  return (
    `<div class="vocab-english">${escapeHtml(v.english)}</div>` +
    (v.tagalog ? `<div class="vocab-tagalog">${escapeHtml(v.tagalog)}</div>` : '')
  );
}

/**
 * One short string for the meaning, for places that cannot render two lines —
 * quiz options, the share text, the fill-blank prompt.
 *
 * English is the safe fallback rather than a specific language, because that is
 * the one column every entry is guaranteed to have.
 */
function meaning(v) {
  if (!v) return '';
  const lang = currentLang();
  if (lang === 'zh') return v.mandarin || v.english || '';
  if (lang === 'fil') return v.tagalog || v.english || '';
  return v.english || '';
}

// ---- Language picker -------------------------------------------------------

/**
 * The language picker.
 *
 * Each row is written in the language it selects, not in the language you are
 * currently reading. That is the one rule that makes a language menu usable by
 * someone who has accidentally landed in a language she cannot read: she needs
 * to recognise her own language's name, and "English" is no help to a Mandarin
 * speaker who cannot read English.
 *
 * The count of entries translated so far is shown against Chinese, because the
 * glossary is partial and a learner deserves to know that before she switches —
 * finding out by hitting English words mid-quiz is worse.
 */
function openLangModal() {
  const wrap = document.getElementById('lang-options');
  if (wrap) {
    const zhWords = STATE.vocabulary.filter((v) => v.mandarin).length;
    const total = STATE.vocabulary.length;
    wrap.innerHTML = allLangs()
      .map((l) => {
        const active = l.code === currentLang();
        const note =
          l.code === 'zh' && zhWords && zhWords < total
            ? `<span class="lang-row-note">${zhWords} / ${total} 词已有中文释义</span>`
            : '';
        return `
          <button class="lang-row${active ? ' is-active' : ''}" onclick="chooseLang('${l.code}')"
                  lang="${l.html}"${active ? ' aria-current="true"' : ''}>
            <span class="lang-row-label">${l.label}</span>
            <span class="lang-row-name">${l.name}</span>
            ${note}
            ${active ? '<span class="lang-row-tick">✓</span>' : ''}
          </button>`;
      })
      .join('');
  }
  const m = document.getElementById('lang-modal');
  if (m) m.classList.add('show');
}

function closeLangModal(e) {
  if (e && e.target !== e.currentTarget) return;
  const m = document.getElementById('lang-modal');
  if (m) m.classList.remove('show');
}

function chooseLang(code) {
  setLang(code);
  closeLangModal();
}

// ---- Vocab modal (detailed card) ------------------------------------------
function openVocabModal(id) {
  const v = STATE.vocabulary.find((x) => x.id === id);
  if (!v) return;
  // Tapping a card open is the clearest deliberate study action there is —
  // far more meaningful than a page view, and the signal that tells the
  // operator someone is practising without ever taking a quiz.
  bumpActivity('cards_opened');
  const cat = STATE.categories.find((c) => c.id === v.category_id);
  const modal = document.getElementById('vocab-modal');
  modal.querySelector('.modal-card').innerHTML = `
    <div class="modal-emoji">${v.emoji || '📝'}</div>
    <div class="modal-cantonese">${v.cantonese}</div>
    <div class="modal-jyutping">${v.jyutping}</div>
    ${meaningRows(v)}
    ${cat ? `<div style="margin-top:8px;font-size:0.8rem;color:#6c757d">${cat.icon} ${categoryLabel(cat)}</div>` : ''}
    <button class="modal-audio-btn" onclick="speak('${v.cantonese.replace(/'/g, "\\'")}', this)">🔊</button>
    <div style="font-size:0.75rem;color:#6c757d;margin-top:6px">${t('browse.tapToHear')}</div>
    <button class="modal-share-btn" onclick="shareWord(${v.id})">${SHARE_ICON_SVG}${t('misc.shareWord')}</button>
    <button class="modal-share-btn modal-share-btn--ghost" onclick="shareWordCard(${v.id})">🖼️ ${t('misc.shareCard')}</button>
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

/**
 * Open the name dialog.
 *
 * `required` is the difference between "she tapped her name to fix a typo" and
 * "she cannot go any further without one". Without a name a learner is invisible
 * to every report — no attribution on a quiz, no row under People, and no way for
 * a connected employer to tell which result is hers. Unnamed learners are a real
 * and current problem (two of them in the dev database), and Cancel was the way
 * past the prompt. So the required form has no Cancel, ignores Escape, and
 * ignores a click on the backdrop.
 */
function editLearnerName(required = false) {
  STATE.nameRequired = !!required;
  const modal = document.getElementById('name-modal');
  const input = document.getElementById('name-input');
  const hint = document.getElementById('name-hint');
  const cancel = document.getElementById('name-cancel');

  input.value = STATE.learner;
  input.classList.remove('input-error');
  // Only nag when she has no name yet; an edit is a deliberate act.
  hint.textContent = t(required && !STATE.learner ? 'name.requiredHint' : 'name.hint');
  hint.classList.toggle('name-hint--required', required && !STATE.learner);
  cancel.style.display = required ? 'none' : '';
  document.getElementById('name-save').textContent = t(
    required && !STATE.learner ? 'name.saveAndStart' : 'name.save'
  );

  modal.classList.add('show');
  setTimeout(() => input.focus(), 100);
}

/** True while the modal is a gate rather than an edit. */
function nameIsRequired() {
  const modal = document.getElementById('name-modal');
  return !!STATE.nameRequired && modal.classList.contains('show');
}

function closeNameModal(e) {
  // Dismissing the gate is the bug this whole flow exists to prevent: a backdrop
  // tap, an Escape, or a stray click must not hand her back an unnamed session.
  if (nameIsRequired()) return;
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('name-modal').classList.remove('show');
}

/**
 * Write the learner's name, and confirm it really landed.
 *
 * localStorage throws rather than failing quietly when it is unavailable —
 * private windows, "block all cookies", or storage evicted under pressure. Her
 * name is the one thing she types in herself, so if it cannot be kept, say so
 * now instead of letting her find out on the next visit.
 */
function persistLearnerName(name) {
  try {
    localStorage.setItem('cb_learner', name);
    return localStorage.getItem('cb_learner') === name;
  } catch (err) {
    console.warn('Could not save the learner name:', err);
    return false;
  }
}

function saveLearnerName() {
  const name = document.getElementById('name-input').value.trim();
  const input = document.getElementById('name-input');
  if (!name) {
    // Say why the button appears to do nothing, rather than staying silent.
    input.classList.add('input-error');
    input.focus();
    return;
  }
  input.classList.remove('input-error');
  STATE.learner = name;
  STATE.nameRequired = false;
  updateLearnerBadge();
  document.getElementById('name-modal').classList.remove('show');
  if (!persistLearnerName(name)) showToast(t('name.notSaved'));
  // Push the new label to the server so any connected employer sees it too.
  identifySelf();
  resumeAfterName();
}

/**
 * If she was stopped mid-task by the name gate, finish what she started now
 * that she has a name. Runs only on a successful save, so cancelling — which is
 * only possible for an edit, not the gate — cleanly does nothing.
 */
function resumeAfterName() {
  const view = window._pendingView;
  if (view) {
    window._pendingView = null;
    navigate(view);
  }
  const pending = window._pendingQuiz;
  if (!pending) return;
  window._pendingQuiz = null;
  startQuiz(pending.type);
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
  let pool = STATE.vocabulary.filter((v) => v.level === level);
  if (pool.length < 4) return [];

  // A picture question only means something for a single word. Asking a learner
  // to match an emoji to 「唔好起身太快」 is not a question — and now that entries
  // carry a `type`, the engine can simply decline to. Falls back to the whole
  // level when there are too few single words to build a quiz from, so this can
  // never turn a working quiz into an empty one.
  if (type === 'match_picture') {
    const words = pool.filter((v) => (v.type || 'word') === 'word');
    if (words.length >= 4) pool = words;
  }

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
          options: shuffle([item, ...distract]).map((v) => meaning(v)),
          answer: meaning(item),
        });
        break;

      case 'listen_choose':
        questions.push({
          type,
          item,
          prompt: t('quiz.promptListen'),
          display: { cantonese: item.cantonese, jyutping: null, emoji: null, listen: true },
          options: shuffle([item, ...distract]).map((v) => meaning(v)),
          answer: meaning(item),
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
          // It's already a sentence; split a key word out as the blank.
          // Operates on the meaning in the current language, so a zh reader
          // gets a Chinese sentence with a Chinese blank in it.
          const line = meaning(item);
          sentence = line.replace(new RegExp(line.split(' ')[0], 'i'), '______');
          blankAnswer = line.split(' ')[0];
          options = shuffle([
            blankAnswer,
            ...distract.map((v) => meaning(v).split(' ')[0]),
          ]);
        } else {
          // Simple template: "I want to ______."  etc.
          const templates = [
            `______ — ${item.jyutping}`,
            `Fill: ${meaning(item)}`,
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

// ===========================================================================
// Practice tracking
//
// What she READS is counted, not what she read about: three counters, not a
// browsing log. That is the whole distinction between "did she practise?",
// which the operator genuinely needs, and a record of everything a helper
// looked at, which this app has no business keeping.
//
// Batched, because twenty minutes of study should cost one request rather
// than forty. Flushed on the way out as well as on a timer, because closing
// the tab mid-session is the normal case here, not the exception.
//
// Nothing in here may ever break a lesson: every failure is swallowed, and a
// lost count is treated as a missing statistic rather than an error.
// ===========================================================================

const pendingActivity = { words_viewed: 0, cards_opened: 0, quizzes_started: 0 };

function bumpActivity(kind, n = 1) {
  if (!(kind in pendingActivity)) return;
  const add = Math.floor(Number(n));
  if (!Number.isFinite(add) || add <= 0) return;
  pendingActivity[kind] += add;
  scheduleActivityFlush();
}

let activityTimer = null;

function scheduleActivityFlush() {
  if (activityTimer) return;
  activityTimer = setTimeout(() => { activityTimer = null; flushActivity(); }, 20000);
}

/** Take the pending counts, resetting the buffer in the same step. */
function takeActivity() {
  const payload = { ...pendingActivity };
  pendingActivity.words_viewed = 0;
  pendingActivity.cards_opened = 0;
  pendingActivity.quizzes_started = 0;
  return payload;
}

const hasActivity = (a) => Boolean(a.words_viewed || a.cards_opened || a.quizzes_started);

async function flushActivity() {
  if (!STATE.deviceId) return;
  const payload = takeActivity();
  if (!hasActivity(payload)) return;
  try {
    await apiPost('/api/learners/activity', { public_id: STATE.deviceId, ...payload });
  } catch (err) {
    console.warn('Could not record practice:', err);
  }
}

/** The unload path: a normal fetch would be cancelled as the page goes away. */
function flushActivityBeacon() {
  if (!STATE.deviceId) return;
  const payload = takeActivity();
  if (!hasActivity(payload)) return;
  try {
    navigator.sendBeacon(
      '/api/learners/activity',
      new Blob(
        [JSON.stringify({ public_id: STATE.deviceId, ...payload })],
        { type: 'application/json' }
      )
    );
  } catch { /* nothing further is possible on the way out */ }
}

window.addEventListener('pagehide', flushActivityBeacon);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushActivityBeacon();
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
    // Required, not optional: an unnamed quiz cannot be attributed to anyone.
    // Remember the quiz so saving the name resumes it instead of dropping her
    // back on the screen she was on.
    window._pendingQuiz = { type, level };
    editLearnerName(true);
    return;
  }

  // Counted after the name gate on purpose: a quiz that never began because
  // she was still being asked her name is not a start. Note this is a START —
  // finishing is what `progress` records, and the two are deliberately
  // different claims (see getVisitorReport).
  bumpActivity('quizzes_started');

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

  // She has just finished a quiz — the one moment the app has demonstrably been
  // worth keeping. Offer to put it on her home screen. Delayed so she reads her
  // score and sees any sticker first; maybeOfferInstall() decides whether to
  // actually ask (it will not, if she has already installed or answered).
  setTimeout(maybeOfferInstall, 1400);
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

// ---- Statistics: her own numbers -------------------------------------------

/**
 * Fetch her statistics for the current chart window.
 *
 * Read by device token, exactly like progress and rewards, so this can only
 * ever come back with her own rows. A failure leaves STATE.stats null and the
 * statistics simply do not render — a chart that will not load must never stop
 * the rest of My Progress from showing.
 */
async function fetchLearnerStats() {
  try {
    STATE.stats = await apiGet(
      `/api/learners/stats?public_id=${encodeURIComponent(STATE.deviceId)}&days=${STATE.statsDays}`
    );
  } catch (err) {
    console.warn('Could not load statistics:', err);
    STATE.stats = null;
  }
}

/** "1 day" / "3 days" — English needs the distinction, Filipino does not. */
function statPlural(n, oneKey, manyKey) {
  return `${n} ${t(n === 1 ? oneKey : manyKey)}`;
}

/**
 * The practice chart: one bar per day, oldest on the left.
 *
 * Inline SVG, so it scales to whatever width the phone gives it with no
 * charting library and nothing to download. A quiet day gets a short grey stub
 * rather than nothing at all — the shape of her habit is the whole point, and
 * an invisible zero would hide exactly the gaps worth seeing.
 *
 * Each bar carries a <title>, which the browser shows as a tooltip on tap.
 */
function practiceChart(series) {
  const n = series.length;
  if (!n) return '';

  const W = 300;
  const H = 88;
  const BASELINE = 74;
  const MAXH = 58;

  const gap = n <= 10 ? 4 : n <= 35 ? 2 : 1;
  const barW = (W - (n - 1) * gap) / n;
  const peak = Math.max(1, ...series.map((d) => d.attempts));

  const bars = series
    .map((d, i) => {
      const x = i * (barW + gap);
      // A day with no practice still gets a 2px stub, so the chart reads as a
      // bar per day rather than as missing data.
      const h = d.attempts ? Math.max(3, Math.round((d.attempts / peak) * MAXH)) : 2;
      const fill = d.attempts ? '#e63946' : '#e6e6ee';
      const label = `${d.day} · ${statPlural(d.attempts, 'stats.attemptOne', 'stats.attempts')}`;
      return `<rect x="${x.toFixed(2)}" y="${BASELINE - h}" width="${barW.toFixed(2)}" height="${h}" rx="1" fill="${fill}"><title>${escapeHtml(label)}</title></rect>`;
    })
    .join('');

  // Only the two ends are labelled. On a 90-day window there is no room for
  // more, and on a phone the exact date of a bar is what the tooltip is for.
  const first = series[0].day.slice(5);
  const last = series[n - 1].day.slice(5);

  return `
    <div class="report-chart">
      <svg class="report-svg" viewBox="0 0 ${W} ${H}" role="img"
           aria-label="${escapeHtml(t('stats.overTime'))}">
        <line x1="0" y1="${BASELINE}" x2="${W}" y2="${BASELINE}" stroke="#e6e6ee" stroke-width="1" />
        ${bars}
      </svg>
      <div class="stats-axis"><span>${escapeHtml(first)}</span><span>${escapeHtml(last)}</span></div>
      <div class="stats-chart-hint">${t('stats.chartHint')}</div>
    </div>`;
}

/**
 * The streak, on its own so it can sit directly under the sticker album.
 *
 * This is the number with a reason attached: it is the only one she can lose by
 * not coming back tomorrow, which is why it goes above the overall score rather
 * than below it. Nothing is shown until she has practised at least once.
 */
function renderStreakCard() {
  const s = STATE.stats;
  if (!s || !s.totals.attempts) return '';

  const { streak } = s;
  const value = streak.current
    ? statPlural(streak.current, 'stats.dayOne', 'stats.days')
    : t('stats.streakNone');

  return `
    <div class="progress-card stats-streak">
      <h4>${t('stats.streak')}</h4>
      <div class="stats-streak-row">
        <div class="stats-streak-value">${escapeHtml(value)}</div>
        ${streak.current ? `<div class="stats-streak-suffix">${t('stats.inARow')}</div>` : ''}
      </div>
      <div class="stats-streak-sub">${escapeHtml(streak.practisedToday ? t('stats.practisedToday') : t('stats.practiseToday'))}</div>
      <div class="stats-streak-facts">
        <span>${t('stats.best')}: ${escapeHtml(statPlural(streak.longest, 'stats.dayOne', 'stats.days'))}</span>
        <span>${t('stats.daysPractised')}: ${streak.daysActive}</span>
      </div>
    </div>`;
}

/**
 * The rest of the statistics: this week, the chart, and how she practises.
 *
 * Renders nothing when she has never finished a quiz, so a new device sees the
 * friendly empty state instead of a wall of zeros.
 */
function renderStatsCards() {
  const s = STATE.stats;
  if (!s || !s.totals.attempts) return '';

  const { weeks, byQuizType } = s;

  // ---- this week, against last week ----
  const w = weeks.thisWeek;
  const lw = weeks.lastWeek;
  const delta = w.accuracy - lw.accuracy;
  let compare;
  if (!lw.questions) {
    compare = t('stats.nothingLastWeek');
  } else if (delta === 0) {
    compare = `${t('stats.lastWeek')}: ${t('stats.correctPct').replace('{n}', lw.accuracy)}`;
  } else {
    compare = `${t('stats.lastWeek')}: ${t('stats.correctPct').replace('{n}', lw.accuracy)} · ${delta > 0 ? '+' : ''}${delta}%`;
  }

  let html = `
    <div class="progress-card">
      <h4>${t('stats.thisWeek')}</h4>
      <div class="stats-week">
        <div>
          <div class="stats-week-num">${w.attempts}</div>
          <div class="stats-week-lbl">${t(w.attempts === 1 ? 'stats.attemptOne' : 'stats.attempts')}</div>
        </div>
        <div>
          <div class="stats-week-num">${w.accuracy}%</div>
          <div class="stats-week-lbl">${t('stats.correctPct').replace('{n}', '').replace('%', '').trim()}</div>
        </div>
        <div>
          <div class="stats-week-num">${w.days}</div>
          <div class="stats-week-lbl">${t(w.days === 1 ? 'stats.dayOne' : 'stats.days')}</div>
        </div>
      </div>
      <div class="stats-compare">${escapeHtml(compare)}</div>
    </div>`;

  // ---- practice over time ----
  html += `
    <div class="progress-card">
      <h4>${t('stats.overTime')}</h4>
      <div class="stats-ranges">
        ${[7, 30, 90]
          .map(
            (d) =>
              `<button type="button" class="stats-range${d === STATE.statsDays ? ' active' : ''}"
                 onclick="setStatsDays(${d})">${t('stats.range' + d)}</button>`
          )
          .join('')}
      </div>
      ${practiceChart(s.series)}
    </div>`;

  // ---- how she practises ----
  if (byQuizType.length) {
    html += `<div class="progress-card"><h4>${t('stats.byQuizType')}</h4>`;
    for (const q of byQuizType) {
      const type = QUIZ_TYPES.find((x) => x.id === q.quiz_type);
      const label = type ? `${type.icon} ${quizTypeName(q.quiz_type)}` : q.quiz_type;
      html += `
        <div class="stats-type">
          <div class="stats-type-row">
            <span class="stats-type-name">${escapeHtml(label)}</span>
            <span class="stats-type-num">${q.accuracy}% · ${escapeHtml(statPlural(q.attempts, 'stats.attemptOne', 'stats.attempts'))}</span>
          </div>
          <div class="progress-bar-mini"><div class="progress-bar-mini-fill" style="width:${q.accuracy}%"></div></div>
        </div>`;
    }
    html += '</div>';
  }

  return html;
}

/**
 * Switch the chart window.
 *
 * Only the chart changes. Totals and the streak come from her whole history on
 * the server, so a narrower window can never make her numbers look worse.
 *
 * No fetch here on purpose: renderProgress() already pulls the statistics, and
 * calling it here as well sent the same request twice on every chip tap.
 */
async function setStatsDays(days) {
  if (STATE.statsDays === days) return;
  STATE.statsDays = days;
  renderProgress();
}

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
    // Both are read by device token, so neither can return anyone else's rows.
    await Promise.all([fetchRewards(), fetchLearnerStats()]);

    if (records.length === 0) {
      wrap.innerHTML =
        `<div class="progress-empty">${t('progress.none')}</div>` +
        renderRewardsCard() +
        renderSharingCard() +
        renderFeedbackCard();
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

    let html = renderRewardsCard() + renderStreakCard() + `
      <div class="progress-card">
        <h4>${t('progress.overall')}</h4>
        <div class="progress-score">${pct}%</div>
        <div class="progress-detail">${totalScore} ${t('progress.correctOutOf')} ${totalMax} • ${records.length} ${t('progress.attempts')}</div>
        <div class="progress-bar-mini"><div class="progress-bar-mini-fill" style="width:${pct}%"></div></div>
      </div>
    `;

    // Statistics come after the headline score: the streak above it is the
    // motivation, this is the detail for anyone who wants to look closer.
    html += renderStatsCards();

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

    // And how to talk to us. Last card on the page: the numbers come first, the
    // admin of "who can see this" second, and the invitation to reply last.
    html += renderFeedbackCard();

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

// ---- Feedback: "tell us what you think" -------------------------------------
//
// The only place in the app where a helper can say something back. Reachable
// from the bottom of My Progress and from the footer, because someone who has
// just hit a problem should not have to guess where to report it.
//
// ANONYMOUS BY DEFAULT, and the form says so out loud. She is a live-in worker
// whose employer can already see her scores, so a complaint that could be traced
// back to her — about the app, or about the family she works for — would simply
// not get written. The server enforces it: it records the role but never an
// identity for a learner (see createFeedback in db.js). The optional contact box
// is the only route back to her, and it is hers to fill in or leave empty.

/**
 * The feedback card at the bottom of My Progress.
 *
 * Sits below the sharing card deliberately: that one is about who can see her
 * data, this one is about her talking to us. Both say "you are in charge here".
 */
function renderFeedbackCard() {
  return `
    <div class="progress-card feedback-card">
      <h4>💬 ${t('feedback.cardTitle')}</h4>
      <p class="feedback-card-hint">${t('feedback.cardHint')}</p>
      <button class="btn btn-outline btn-block" onclick="openFeedbackModal()">
        ${t('feedback.cardBtn')}
      </button>
    </div>`;
}

/**
 * Which view she is looking at, as a path fragment.
 *
 * Recorded with the message so "the audio does not play" can be tied to the
 * screen it happened on. Read from the DOM rather than tracked in STATE: the
 * active class is already the single source of truth for this, and a second copy
 * would be one more thing that can drift.
 */
function currentViewPath() {
  const active = document.querySelector('.view.active');
  return active ? '/' + active.id.replace(/^view-/, '') : location.pathname;
}

function openFeedbackModal() {
  const msg = document.getElementById('feedback-message');
  const contact = document.getElementById('feedback-contact');
  const send = document.getElementById('feedback-send');
  // Always start clean: a half-typed message left over from a cancelled attempt
  // reappearing later reads as the app having eaten it.
  if (msg) msg.value = '';
  if (contact) contact.value = '';
  if (send) { send.disabled = false; send.textContent = t('feedback.send'); }
  document.getElementById('feedback-modal').classList.add('show');
  // Focus after the open transition — focusing during it fights the animation
  // and, on a phone, pops the keyboard over a dialog that is still sliding in.
  if (msg) setTimeout(() => { try { msg.focus(); } catch { /* not focusable */ } }, 60);
}

function closeFeedbackModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('feedback-modal').classList.remove('show');
}

/**
 * Send it.
 *
 * The button is disabled while the request is in flight, which is the only
 * guard that matters here: a double tap on a slow connection would otherwise
 * post the same message twice and the operator would answer it twice.
 */
async function submitFeedback() {
  const msg = document.getElementById('feedback-message');
  const contact = document.getElementById('feedback-contact');
  const send = document.getElementById('feedback-send');
  const text = ((msg && msg.value) || '').trim();

  // Caught here so the answer is immediate and in her own language. The server
  // refuses an empty message as well, because this endpoint is public and a
  // crafted request never passes through this function.
  if (!text) {
    showToast(t('feedback.empty'));
    if (msg) msg.focus();
    return;
  }

  if (send) { send.disabled = true; send.textContent = t('feedback.sending'); }
  try {
    await apiPost('/api/feedback', {
      message: text,
      contact: ((contact && contact.value) || '').trim(),
      lang: currentLang(),
      page: currentViewPath(),
    });
    closeFeedbackModal();
    showToast(t('feedback.thanks'));
  } catch (err) {
    if (send) { send.disabled = false; send.textContent = t('feedback.send'); }
    // A throttle gets its own words. "Try again later" is true and actionable;
    // "something went wrong" would just make her tap Send again immediately and
    // be refused again.
    showToast(err.status === 429 ? t('feedback.tooMany') : t('feedback.failed'));
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

// ---- Referral attribution --------------------------------------------------
//
// CantoBuddy grows the way this community actually passes things on: one helper
// tells another, in a group chat or on a Sunday. That works without any code —
// but it cannot be *seen* without one, and a channel you cannot measure is a
// channel you cannot double down on.
//
// Two halves:
//   cb_ref      where SHE arrived from — the ?ref= on the link that created this
//               device. First touch, written once, never overwritten.
//   cb_my_code  her own code, issued by the server, put on every link she shares.
//
// Together those make the chain of introductions readable: a link she sends
// carries her code, and whoever opens it records her as their referrer.

const REF_STORAGE_KEY = 'cb_ref';
const REF_CODE_KEY = 'cb_my_code';

/**
 * Record where this device first arrived from.
 *
 * First touch only: once a referrer is stored it is never replaced, so a helper
 * who later opens a different link does not silently reassign credit away from
 * whoever actually brought her in.
 */
function captureReferrer() {
  try {
    if (localStorage.getItem(REF_STORAGE_KEY)) return;
    const params = new URLSearchParams(location.search);
    const ref = (params.get('ref') || params.get('utm_source') || '').trim();
    if (ref) localStorage.setItem(REF_STORAGE_KEY, ref.slice(0, 64));
  } catch {
    // Private browsing can refuse localStorage. Attribution is not worth
    // breaking the app over.
  }
}

/** Where this device came from, or '' if it was a direct visit. */
function myReferrer() {
  try { return localStorage.getItem(REF_STORAGE_KEY) || ''; } catch { return ''; }
}

/** This device's own referral code, or '' before the server has issued one. */
function myReferralCode() {
  try { return localStorage.getItem(REF_CODE_KEY) || ''; } catch { return ''; }
}

/**
 * Build the URL to put in a share.
 *
 * Always based on `location.origin`, never on the current path. If she happens
 * to be sitting on a /join/<code> page the path holds a private invitation code,
 * and forwarding it would hand a stranger access to her practice.
 *
 * Her referral code rides along as ?ref=. It is a one-way derivative of her
 * device id (see db.js), so it is safe to publish — unlike the device id itself,
 * which is the token that controls her name and her employer links.
 *
 * @param {string|null} path  e.g. '/words/thank-you' to deep-link a page.
 */
function shareUrl(path) {
  const url = new URL(location.origin);
  if (path) url.pathname = path;
  const code = myReferralCode();
  if (code) url.searchParams.set('ref', code);
  return url.toString();
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

/**
 * Share straight to WhatsApp.
 *
 * WhatsApp gets its own button rather than relying on the OS share sheet,
 * because that is where this community actually talks — helpers are in group
 * chats with each other, and a link that lands in one is seen by dozens of
 * people who have the same job and the same problem. On many Android builds the
 * share sheet buries WhatsApp several taps deep; one tap is the difference
 * between a share happening and not.
 */
function shareToWhatsApp(text, url) {
  const msg = `${text}\n${url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
}

/** Share a single vocabulary word. */
function shareWord(id) {
  const v = STATE.vocabulary.find((x) => x.id === id);
  if (!v) return;
  // Deliberately bilingual rather than current-language-only: a shared link is
  // read by whoever it is forwarded to, and the whole point of the referral
  // code is that it travels beyond the language the sender was using.
  const gloss = [meaning(v), v.english].filter(Boolean).filter((s, i, a) => a.indexOf(s) === i).join(' / ');
  const text = `${v.emoji || ''} ${v.cantonese} (${v.jyutping}) = ${gloss}\n${t('share.wordText')}`;
  // Deep-link to the word's own page when the server gave us a slug. That page
  // shows the same word with its meaning, pronunciation and related words, and
  // links back into the app — so the recipient lands somewhere useful instead
  // of on the home screen having to find it again.
  shareOrCopy({
    title: 'CantoBuddy',
    text: text.trim(),
    url: shareUrl(v.slug ? `/words/${v.slug}` : null),
  });
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

/** WhatsApp glyph, same treatment as the share glyph. */
const WHATSAPP_ICON_SVG = `
  <svg class="share-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Z" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M8.6 7.6c.3-.1.6 0 .8.3l.8 1.3c.1.3.1.6-.1.8l-.5.5c-.2.2-.2.4-.1.6.5.9 1.3 1.7 2.2 2.2.2.1.4.1.6-.1l.5-.5c.2-.2.5-.3.8-.1l1.3.8c.3.2.4.5.3.8-.3 1-1.3 1.7-2.4 1.6-2.8-.3-5.2-2.7-5.5-5.5-.1-1.1.6-2.1 1.6-2.4Z" fill="currentColor"/>
  </svg>`;

/** Fill every `data-share-icon` placeholder with the share glyph. */
function mountShareIcons() {
  document.querySelectorAll('[data-share-icon]').forEach((el) => {
    el.innerHTML = SHARE_ICON_SVG;
  });
  document.querySelectorAll('[data-whatsapp-icon]').forEach((el) => {
    el.innerHTML = WHATSAPP_ICON_SVG;
  });
}

// ---- Shareable card --------------------------------------------------------
//
// Text-only shares die in a busy group chat. A picture survives: it is readable
// without a tap, it carries the branding, and it is the thing people forward on
// to somebody else. Drawn with canvas so there is no server round-trip, no new
// dependency, and it works offline.

const CARD_SIZE = 1080;

/** Draw text centred on one line, shrinking until it fits `maxWidth`. */
function cardFitText(ctx, text, maxWidth, startSize, family) {
  let size = startSize;
  do {
    ctx.font = `700 ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size > 28);
  return size;
}

/**
 * Render a word as a square PNG.
 * @returns {Promise<Blob|null>} null if canvas is unavailable.
 */
function wordCardBlob(v) {
  return new Promise((resolve) => {
    try {
      const cv = document.createElement('canvas');
      cv.width = CARD_SIZE;
      cv.height = CARD_SIZE;
      const ctx = cv.getContext('2d');
      if (!ctx) return resolve(null);

      const HAN = '"Noto Sans SC","PingFang HK","Microsoft JhengHei",sans-serif';
      const UI = 'Inter,-apple-system,"Segoe UI",Roboto,sans-serif';

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

      // Brand bar
      ctx.fillStyle = '#e63946';
      ctx.fillRect(0, 0, CARD_SIZE, 14);

      // Wordmark
      ctx.fillStyle = '#1a1a2e';
      ctx.font = `700 44px ${UI}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('🦜 CantoBuddy', 72, 96);

      // The Cantonese, the whole point of the card
      const han = v.cantonese || '';
      const hanSize = cardFitText(ctx, han, CARD_SIZE - 160, 300, HAN);
      ctx.font = `500 ${hanSize}px ${HAN}`;
      ctx.fillStyle = '#1a1a2e';
      ctx.textAlign = 'center';
      ctx.fillText(han, CARD_SIZE / 2, 430);

      // Jyutping
      ctx.font = `400 52px ui-monospace,Menlo,monospace`;
      ctx.fillStyle = '#e63946';
      ctx.fillText(v.jyutping || '', CARD_SIZE / 2, 600);

      // Meaning. The reader's own language is promoted to the top line and
      // English sits underneath as the fallback — the same order as the browse
      // card, so a shared picture reads the same way the sender saw it.
      const primary = meaning(v) || v.english || '';
      const secondary = currentLang() === 'en' ? v.tagalog || '' : v.english || '';

      if (primary) {
        const pSize = cardFitText(ctx, primary, CARD_SIZE - 200, 68, primary === (v.mandarin || '') ? HAN : UI);
        ctx.font = `700 ${pSize}px ${primary === (v.mandarin || '') ? HAN : UI}`;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillText(primary, CARD_SIZE / 2, 720);
      }

      if (secondary && secondary !== primary) {
        const sSize = cardFitText(ctx, secondary, CARD_SIZE - 200, 52, UI);
        ctx.font = `400 ${sSize}px ${UI}`;
        ctx.fillStyle = '#6c757d';
        ctx.fillText(secondary, CARD_SIZE / 2, 800);
      }

      // Footer: what the app is, and where to get it
      ctx.font = `400 38px ${UI}`;
      ctx.fillStyle = '#6c757d';
      ctx.fillText(t('share.cardFooter'), CARD_SIZE / 2, 950);

      ctx.font = `700 42px ${UI}`;
      ctx.fillStyle = '#e63946';
      ctx.fillText('cantobuddy.com', CARD_SIZE / 2, 1010);

      cv.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/**
 * Share a word as a picture.
 *
 * Falls back to the plain text share whenever the platform cannot send files —
 * desktop browsers mostly cannot — and downloads the card instead, so the
 * helper can still post it by hand.
 */
async function shareWordCard(id) {
  const v = STATE.vocabulary.find((x) => x.id === id);
  if (!v) return;
  const url = shareUrl(v.slug ? `/words/${v.slug}` : null);
  const text = `${v.emoji || ''} ${v.cantonese} (${v.jyutping}) = ${v.english}\n${t('share.wordText')}`;

  const blob = await wordCardBlob(v);
  if (!blob) return shareOrCopy({ title: 'CantoBuddy', text: text.trim(), url });

  const file = new File([blob], `cantobuddy-${v.slug || v.id}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: text.trim(), url });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }

  // No file sharing here. Save the image and put the text on the clipboard, so
  // she has both halves of the post in hand.
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    await navigator.clipboard.writeText(`${text}\n${url}`);
    showToast(t('share.cardSaved'));
  } catch {
    showToast(t('share.failed'));
  }
}

/** Share the most recent quiz score. */
function shareResult() {
  const r = window._lastResult;
  if (!r) return;
  const text = t('share.scoreText').replace('{score}', r.score).replace('{total}', r.total);
  shareOrCopy({ title: 'CantoBuddy', text, url: shareUrl(null) });
}

/**
 * Share the app itself, so a helper can tell a friend about CantoBuddy.
 *
 * The URL is deliberately the origin and never the current path. If she is
 * sitting on a /join/<code> page, the path holds a private invitation code, and
 * forwarding it would hand a stranger access to her practice.
 */
function shareApp() {
  shareOrCopy({
    title: 'CantoBuddy',
    text: t('sharePage.message'),
    url: shareUrl(null),
  });
}

/** Send the app straight to a WhatsApp chat. */
function shareAppWhatsApp() {
  shareToWhatsApp(t('sharePage.message'), shareUrl(null));
}

/** Copy just the site link, for pasting somewhere by hand. */
async function copyShareLink() {
  try {
    await navigator.clipboard.writeText(shareUrl(null));
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
  // The real link, referral code and all — the preview's whole job is to show
  // her exactly what her friend will receive, so it must not be a prettified
  // version of it.
  const url = shareUrl(null);
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
      // Where this device first arrived from. The server records it once and
      // never overwrites, so opening a different link later cannot reassign
      // credit away from whoever actually brought her in.
      referrer: myReferrer(),
    });
    STATE.employers = res.employers || [];
    // Her own code, to put on the links she shares. Stored so shareUrl() can
    // attach it without a round-trip, and so it survives offline.
    if (res.referral_code) {
      try { localStorage.setItem(REF_CODE_KEY, res.referral_code); } catch { /* private mode */ }
    }
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
    updateLearnerBadge();
    if (!persistLearnerName(name)) showToast(t('name.notSaved'));
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

    // The "Enter a code" button lives *inside* the sharing card, so she connects
    // without ever leaving My Progress — nothing else would re-render that card,
    // and it would keep claiming nobody can see her progress. Redraw it here, the
    // same way disconnectEmployer() does, so the new employer appears immediately.
    // renderProgress() writes into #progress-content whether or not it is on
    // screen, so the card is also correct the next time she opens the view.
    renderProgress();
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

// ---- Install: "keep CantoBuddy on your phone" ------------------------------
//
// CantoBuddy is a PWA, so it can live on her home screen and open like a native
// app — one tap, no browser bar, and it still works offline. Nothing in the app
// ever said so, which is why almost nobody installs it: an installable PWA is
// invisible by default, and this audience does not go hunting through browser
// menus. So we ask — once.
//
// "Add to home screen" is a genuinely different procedure on each phone, and
// getting it wrong is worse than not asking at all (she taps, nothing happens,
// and the app takes the blame):
//
//   Android / Chrome  fires `beforeinstallprompt`, which we hold and replay on
//                     a real button — a one-tap install, no instructions.
//   iPhone / Safari   has NO install API. Share → Add to Home Screen is the only
//                     route, so it has to be spelled out as steps.
//   In-app browser    a link opened inside WhatsApp / Facebook / Messenger runs
//                     in a webview that cannot install a PWA. The only honest
//                     answer is "open this in Safari or Chrome first".
//
// The offer is made at the moment she has just had a good experience — the end
// of a quiz — and her answer is remembered, so it never becomes a nag.

const INSTALL_KEY = 'cb_install';   // 'installed' | 'dismissed' — asked once, then never again

/** Chrome's install event, held until she taps our button (it is one-shot). */
let deferredInstall = null;

/** Already running installed, rather than in a browser tab. */
function isInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

/** iPhone / iPad. iPadOS 13+ claims to be a Mac; the touch points give it away. */
function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Running inside another app's webview — which cannot install a PWA. */
function isInAppBrowser() {
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|MicroMessenger|Twitter|Viber|; wv\)/i.test(
    navigator.userAgent
  );
}

function installAnswered() {
  try { return Boolean(localStorage.getItem(INSTALL_KEY)); } catch { return false; }
}

function markInstallAnswered(state) {
  try { localStorage.setItem(INSTALL_KEY, state); } catch { /* private mode */ }
}

/** Fill the dialog for whichever phone she is on. */
function renderInstallModal() {
  const body = document.getElementById('install-body');
  const add = document.getElementById('install-add');
  const later = document.getElementById('install-later');
  if (!body || !add || !later) return;

  const steps = (lines) =>
    `<ol class="install-steps">${lines.map((l) => `<li>${l}</li>`).join('')}</ol>`;

  // In-app browser first: even if a prompt event somehow fired, installing from
  // a webview does not work, so offering the button would be a lie.
  if (isInAppBrowser()) {
    add.style.display = 'none';
    later.textContent = t('install.gotIt');
    body.innerHTML =
      `<div class="install-sub">${t('install.inappTitle')}</div>` +
      `<p class="install-note">${t('install.inappBody')}</p>`;
    return;
  }

  // Android / Chrome: a real install, one tap. No instructions needed.
  if (deferredInstall) {
    add.style.display = '';
    add.textContent = t('install.add');
    later.textContent = t('install.notNow');
    body.innerHTML = '';
    return;
  }

  add.style.display = 'none';
  later.textContent = t('install.gotIt');

  if (isIOS()) {
    body.innerHTML =
      `<div class="install-sub">${t('install.iosTitle')}</div>` +
      steps([t('install.ios1'), t('install.ios2'), t('install.ios3')]);
    return;
  }

  body.innerHTML =
    `<div class="install-sub">${t('install.androidTitle')}</div>` +
    steps([t('install.android1'), t('install.android2')]);
}

function openInstallModal() {
  if (isInstalled()) return;      // nothing to offer — she already has it
  renderInstallModal();
  document.getElementById('install-modal').classList.add('show');
}

function closeInstallModal(e) {
  if (e && e.target !== e.currentTarget) return;
  dismissInstall();
}

/** "Not now" — an answer, and we take it. */
function dismissInstall() {
  markInstallAnswered('dismissed');
  document.getElementById('install-modal').classList.remove('show');
}

/** The primary button — only ever shown while a real install prompt is held. */
async function doInstall() {
  const ev = deferredInstall;
  if (!ev) return;
  deferredInstall = null;                       // the event is single-use
  document.getElementById('install-modal').classList.remove('show');
  try {
    ev.prompt();
    const choice = await ev.userChoice;
    // Accepting installs the app (and fires `appinstalled`). Declining the OS
    // dialog is still an answer — either way we do not ask again.
    markInstallAnswered(choice && choice.outcome === 'accepted' ? 'installed' : 'dismissed');
  } catch {
    markInstallAnswered('dismissed');
  }
}

/**
 * Offer the install — unless she already has it or has already answered.
 * Called at the end of a quiz (see finishQuiz). Deliberately NOT on a timer: a
 * prompt that appears while she is reading is an interruption, not an offer.
 */
function maybeOfferInstall() {
  if (isInstalled() || installAnswered()) return;
  openInstallModal();
}

// Chrome's own mini-infobar is suppressed: we would rather ask in her language,
// at a moment we choose, than have the browser ask on its own schedule.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
});

window.addEventListener('appinstalled', () => {
  markInstallAnswered('installed');
  deferredInstall = null;
  document.getElementById('install-modal').classList.remove('show');
  showToast(t('install.done'));
});

// ---- PWA -------------------------------------------------------------------

if ('serviceWorker' in navigator) {
  // A new build takes over the moment it is installed (the worker calls
  // skipWaiting + clients.claim), but the page keeps running the app.js it was
  // loaded with. That mismatch is what "I refreshed and the fix still isn't
  // there" actually is: the worker is serving the new cache while the old code
  // is still on screen, and it takes a second visit to resolve.
  //
  // Reloading once closes the gap, so the next visit always runs the build the
  // worker is serving. Two guards on it:
  //   - Only on an *update*. On the very first install there was no controller,
  //     and reloading then would just be a pointless extra load.
  //   - Never mid-quiz. Answers are saved after every question, but the screen
  //     she is looking at would be thrown away under her.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController || STATE.quiz) return;
    reloading = true;
    location.reload();
  });

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
