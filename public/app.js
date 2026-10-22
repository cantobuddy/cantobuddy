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

/**
 * How many News cards are on screen before the "Show more" button appears.
 *
 * The News channel is the only one that grows without bound — the importer
 * runs hourly — so it is the only one that needs a pager. Ten is roughly a
 * screen and a half on a phone, which is enough to decide whether this channel
 * is worth scrolling and small enough that the button is always visible
 * without hunting. Culture and Stories are short lists and render whole; the
 * pager is applied to them too but never reaches a second page, so they are
 * unchanged by it.
 */
const NEWS_PAGE_SIZE = 10;

/**
 * The News topics, in display order. Kept here as well as on the server (see
 * news-category.js) because the client has to render chips in a stable order
 * before it has heard from the server, and a filter row that reshuffles itself
 * while you reach for it is worse than one in the wrong order.
 *
 * `key` and `i18n` are listed separately and on purpose. The key is a STORED
 * VALUE — it is written in the database, put in the query string and returned by
 * the API, so it is lowercase and never changes. The i18n key is read by a human.
 * Deriving one from the other with a capitalisation rule was tried and failed
 * silently: `discover.cat${key}` produced `discover.cathongkong`, which has no
 * entry, and t() falls back to the raw key — so the chips read
 * "discover.cathongkong 11" to a helper in Hong Kong. Listed side by side, a new
 * topic is one line and tools/posts-test.js checks that every row here resolves
 * in all four languages rather than trusting it.
 */
const NEWS_CATEGORY_ORDER = [
  { key: 'all', i18n: 'discover.catAll' },
  { key: 'hongkong', i18n: 'discover.catHongkong' },
  { key: 'work', i18n: 'discover.catWork' },
  { key: 'money', i18n: 'discover.catMoney' },
  { key: 'health', i18n: 'discover.catHealth' },
  { key: 'home', i18n: 'discover.catHome' },
  { key: 'politics', i18n: 'discover.catPolitics' },
  { key: 'other', i18n: 'discover.catOther' },
];

/** The taxonomy keys only, for the places that ask "is this a real topic?". */
const NEWS_CATEGORY_KEYS = NEWS_CATEGORY_ORDER.map((c) => c.key);

/**
 * The News channel's second filter axis: where the story came from. Each key is
 * the prefix of a stored `source_key` ("rthk:…", "ph:…", "id:…"), so the value
 * is what the server filters on and the i18n key is what a helper reads.
 * `all` is the unfiltered channel. This is deliberately separate from the topic
 * row: a Filipino helper may want Philippine news *about work*, and the two
 * filters combine.
 */
const NEWS_REGION_ORDER = [
  { key: 'all', i18n: 'discover.regionAll' },
  { key: 'ph', i18n: 'discover.regionPh' },
  { key: 'id', i18n: 'discover.regionId' },
];

/** The real region keys only (no `all`), for validating a stored selection. */
const NEWS_REGION_KEYS = NEWS_REGION_ORDER.map((r) => r.key).filter((k) => k !== 'all');

const STATE = {
  vocabulary: [],
  categories: [],
  learner: localStorage.getItem('cb_learner') || '',
  nameRequired: false,   // true while the name dialog is a gate, not an edit
  deviceId: loadDeviceId(),   // this device's identity — never shown to the user
  employers: [],              // who is allowed to see this learner's progress
  currentLevel: 0,      // 0 = all, 1-3 = specific
  currentCat: 0,        // 0 = all
  browseFrom: 'home',   // where Browse was entered from, so back goes back there
  catNudgeDone: false,  // set the moment she scrolls the category row herself
  homeCatsExpanded: false,  // home category grid: collapsed to 2 rows, "more" reveals the rest
  quiz: null,           // active quiz object
  stats: null,          // her own statistics, from /api/learners/stats
  statsDays: 30,        // chart window only — never affects totals or streak
  // Discover feed. `posts` caches each channel so switching tabs is instant and
  // does not re-fetch; `current` is the open article, kept so a language switch
  // can re-render it without another request.
  //
  // `category` is the News channel's topic filter — null is "All news". The
  // cache is keyed by channel AND category, because a filtered view is a
  // different list, not a subset of the one on screen. `counts` is the
  // per-topic tally the chips render, and `shown` is how many cards of the
  // current list are on screen (the pager — see NEWS_PAGE_SIZE).
  discover: {
    channel: 'culture',
    category: null,
    region: null,
    posts: { culture: null, news: null },
    counts: null,
    shown: NEWS_PAGE_SIZE,
    current: null,
  },
  // Stories — a helper's own life story, read from the Stories channel inside
  // Discover. `list` caches the shelf so a tab switch is instant; `current` is
  // the open story, kept so a language switch can re-render it without another
  // request; `mine` is her own submissions, which is the only place a reviewer's
  // note is ever shown.
  stories: { list: null, current: null, mine: null, langPicked: false },
  // Living — supportive passages about life in Hong Kong, grouped by situation
  // (Medical, Holiday, Entertainment, Homesick, Food, Transport, Churches). The
  // reader browses by category and opens a passage; reactions, comments and share
  // live on the passage page. `list` caches the shelf; `current` is the open
  // passage, kept so a language switch re-renders without a refetch.
  living: { list: null, current: null },
  // One culture article per day, from /api/posts/daily-culture. `null` means
  // "not asked yet", `false` means "asked and there is nothing" — the
  // distinction stops Home re-fetching on every language switch when there is
  // legitimately no pick today.
  homeDailyCulture: null,
  // The next festival, from /api/festival. Same `null` / `false` distinction as
  // above: most of the year there is no festival within the window, and that
  // "no" must not be re-asked on every language switch.
  homeFestival: null,
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

  // The category-row hint runs only while the browse screen is on screen. Any
  // navigation away cancels it, so it can never start moving behind a screen
  // the learner is not looking at.
  stopCatNudge();
  if (view === 'browse') startCatNudge();

  // bottom nav
  document.querySelectorAll('.nav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });

  window.scrollTo(0, 0);

  if (view === 'progress') renderProgress();
  if (view === 'share') renderSharePage();
  if (view === 'discover') renderDiscover();
  if (view === 'categories') renderCategoriesPage();
  // Opening the write form re-reads her own submissions: the point of the
  // screen is "here is what happened to the last one", and a stale list would
  // be worse than none.
  if (view === 'story-new') { defaultStoryLang(); renderStoryMine(); }
}

/**
 * Honour `?view=<name>` once, on boot.
 *
 * Only a name that actually exists as a section is accepted — `navigate()`
 * dereferences the element directly, so an unknown name from a URL would throw.
 * The query string is then removed from the address bar, or a reload would keep
 * re-opening that view and she could never get back to Home by refreshing.
 *
 * The Games tab is the reason this exists: the game is a real page at
 * /games/uno, and its back link is `/?view=games`. Without this, leaving a game
 * would drop her on Home and the tab she came from would look lost.
 */
function openViewFromUrl() {
  const name = new URLSearchParams(location.search).get('view');
  if (!name) return;
  if (!document.getElementById('view-' + name)) return;
  if (name !== 'home') navigate(name);
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ }
}

/**
 * Points the story's language select at the language she is reading in.
 *
 * Only until she chooses one herself: the whole reason this control exists is
 * that the two can legitimately differ, so overwriting her answer on the next
 * visit would put back the bug it was added to fix.
 */
function defaultStoryLang() {
  const sel = document.getElementById('story-lang');
  if (!sel || STATE.stories.langPicked) return;
  sel.value = currentLang();
}

/** She chose a language for this story; stop defaulting it for her. */
function markStoryLangPicked() {
  STATE.stories.langPicked = true;
}

/**
 * The Learn tab's destination: every category, one screen, with a word count.
 *
 * This is the screen that answers "what do I want to learn?" — the question a
 * new helper actually has. It used to be answered by a scrolling chip row
 * inside Browse, which only showed a handful of categories at a time, so most
 * of them were effectively invisible. The decision was being made from a list
 * she could not see, which is not a decision.
 *
 * The word count is on each card on purpose: a category with 3 words in it and
 * one with 60 are not the same promise, and hiding the number means she finds
 * out by opening the small one.
 */
function renderCategoriesPage() {
  const grid = document.getElementById('categories-grid');
  const lead = document.getElementById('categories-lead');
  if (!grid) return;
  if (lead) {
    lead.textContent = t('categories.lead')
      .replace('{n}', String(STATE.categories.length))
      .replace('{w}', String(STATE.vocabulary.length));
  }

  // Counts come from the vocabulary already on screen, not from a second fetch:
  // STATE.vocabulary is loaded once at init and every card here is a filter
  // over it, so a re-count costs nothing and cannot disagree with Browse.
  const countFor = (id) => STATE.vocabulary.filter((v) => v.category_id === id).length;

  grid.innerHTML = STATE.categories
    .map(
      (c) => `
      <button class="category-card" onclick="openCategory(${c.id})">
        <span class="category-card-icon">${escapeHtml(c.icon || '📘')}</span>
        <span class="category-card-name">${escapeHtml(categoryLabel(c))}</span>
        <span class="category-card-count">${t('categories.words').replace('{n}', String(countFor(c.id)))}</span>
      </button>`
    )
    .join('');
}

/** The Learn tab. */
function goCategories() {
  navigate('categories');
}

/**
 * One category chosen from the Categories page → Browse, already filtered.
 *
 * Opens at BEGINNER level (1) by default, not "all levels": a helper who taps a
 * category wants to start at the easy words in that topic, and "all levels"
 * drops her into the hardest sentences before she has a foothold. She can still
 * lift the level filter from the chips — openCategory only sets the *default*.
 *
 * Both chip rows are synced to the selection so the screen agrees with itself:
 * the Beginner level chip lights up, and the chosen category chip lights up,
 * exactly as the home-strip entry point (filterByCategory) does for "all levels".
 *
 * `browseFrom` is remembered so Browse's back button returns HERE rather than
 * jumping to Home: she came from a list of categories and back means "the list
 * again", not "start over".
 */
function openCategory(id) {
  const catId = Number(id);
  STATE.currentCat = catId;
  STATE.currentLevel = 1;
  STATE.browseFrom = 'categories';

  document.querySelectorAll('#filter-level .chip').forEach((c) => {
    c.classList.toggle('active', Number(c.dataset.val) === 1);
  });
  renderCategoryChips();
  document.querySelectorAll('#filter-cat .chip').forEach((c) => {
    c.classList.toggle('active', Number(c.dataset.val) === catId);
  });

  navigate('browse');
  renderVocabList();
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

/**
 * Browse's back button, which is context-aware: back from a category opened out
 * of the Categories page returns to that page, and back from anywhere else
 * returns Home. A fixed back target that ignores where she came from is how a
 * person ends up at the wrong end of the app with no way back but the nav bar.
 */
function backFromBrowse() {
  navigate(STATE.browseFrom === 'categories' ? 'categories' : 'home');
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

    // Decide whether the header's install entry point should exist at all. After
    // applyTranslations() so its title is translated, and after the badge for the
    // same "dynamic last" reason.
    syncInstallEntry();

    // The returning-learner cards, last for the same reason — they show her own
    // numbers, not labels. Statistics are awaited so the streak card does not
    // draw empty and then fill in; a failure leaves STATE.stats null and the
    // card simply does not appear.
    await fetchLearnerStats();
    renderHomeCards();
    renderHomeFestival();
    renderHomeDailyCulture();
    renderHomeDiscoverPromo();
  renderHomeGamesPromo();

    // A view named in the URL, so a page outside the SPA can send her back to a
    // specific screen. The Games tab needs this: the game is a real page at
    // /games/uno, and its "back" link is `/?view=games` — without this, leaving a
    // game would dump her on Home and the tab she came from would look lost.
    openViewFromUrl();
    openLivingFromUrl();
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
  renderHomeCards();
  renderHomeFestival();
  renderHomeDailyCulture();
  renderHomeDiscoverPromo();
  renderHomeGamesPromo();
  renderCategoryChips();
  renderQuizTypes();
  renderVocabList();
  updateLearnerBadge();
  renderVoiceList();

  const active = document.querySelector('.view.active');
  if (active && active.id === 'view-progress') renderProgress();
  if (active && active.id === 'view-share') renderSharePage();
  if (active && active.id === 'view-discover') renderDiscover();
  // An open article is a body of text in one language; switching language has
  // to rebuild it from the cached row, or it stays in the old one.
  if (active && active.id === 'view-post' && STATE.discover.current) renderPost(STATE.discover.current);
  // An open story is the same problem as an open article: one body of text,
  // rebuilt from the cached row so it does not stay in the old language.
  if (active && active.id === 'view-story' && STATE.stories.current) renderStoryPage(STATE.stories.current);
  // An open Living passage: one body of text, rebuilt from the cached row so the
  // language switch does not leave it stranded in the old language.
  if (active && active.id === 'view-living' && STATE.living.current) renderLivingPage(STATE.living.current);
  // The write form is static markup and re-translates in place, so only her
  // own submissions below it are rebuilt. Her half-typed draft is untouched.
  if (active && active.id === 'view-story-new') renderStoryMine();

  // The install dialog's instructions are built in JS, so a language switch has
  // to rebuild them or half the text stays in the old language.
  const installModal = document.getElementById('install-modal');
  if (installModal && installModal.classList.contains('show')) renderInstallModal();

  // The header entry point is a data-i18n element, so applyTranslations() has
  // just rewritten its content — re-evaluate whether it should be visible.
  syncInstallEntry();
}

function renderHomeCategories() {
  const wrap = document.getElementById('home-categories');
  if (!wrap) return;
  // The strip is intentionally long (24 categories), which makes the home page
  // honest about how much there is to learn — but the strip itself is a choice
  // she's not yet making. Show two rows and a "Show more" button. The grid
  // keeps every card in the DOM and the container is the thing that clips,
  // so the reveal is instant and the chips are still rendered, just behind a
  // max-height. A fade at the bottom is a hint that the strip continues, not
  // a wall.
  const total = STATE.categories.length;
  const expanded = STATE.homeCatsExpanded;
  wrap.innerHTML =
    `<h4>${t('home.browseByCategory')}</h4>` +
    `<div class="cat-strip-wrap${expanded ? '' : ' collapsed'}" id="cat-strip-wrap">` +
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
    '</div>' +
    '</div>' +
    (total > 4 // anything that fits in 2 rows at every breakpoint stays uncluttered
      ? `<button class="cat-strip-toggle" onclick="toggleHomeCategories()">${t(expanded ? 'home.showLessCategories' : 'home.showMoreCategories')}</button>`
      : '');
}

/** The "Show more / Show less" toggle on the home category grid. */
function toggleHomeCategories() {
  STATE.homeCatsExpanded = !STATE.homeCatsExpanded;
  renderHomeCategories();
}

// ---- Home: the returning-learner cards -------------------------------------
//
// The streak is the app's only habit mechanic, and until now it lived one tab
// away in My Progress — a report she had to go looking for. These cards put the
// reason to come back on the screen she actually lands on.
//
// Two rules all of them follow:
//   * A device that has never practised renders NOTHING, so the first screen a
//     stranger sees is exactly the screen that existed before.
//   * A failure is SILENT. Home must never be broken, or half-drawn, by a feed
//     that will not load or a statistics call that times out.

/**
 * Where "Continue" goes.
 *
 * There is no per-word completion record to continue *from*: `progress` is one
 * row per quiz attempt and its category_id is not populated. So the honest
 * target is the furthest level she has actually practised — that is where she
 * stopped, and it is derived from data that already exists rather than from
 * state this screen would have to start inventing.
 */
function continueLevel(s) {
  const byLevel = (s && s.byLevel) || {};
  const attempted = Object.keys(byLevel)
    .map(Number)
    .filter((l) => l >= 1 && l <= 3 && byLevel[l] && byLevel[l].attempts > 0);
  return attempted.length ? Math.max(...attempted) : 1;
}

/**
 * A JS string literal that is safe inside an HTML attribute.
 *
 * The ORDER is the whole point. The browser decodes HTML entities before it
 * runs the JS, so the value must be JS-escaped first and HTML-escaped second.
 * Done the other way round, a quote becomes &#39;, which decodes back to a bare
 * quote and breaks out of the JS string — the injection this is meant to stop.
 */
function jsAttr(value) {
  const js = String(value == null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
  return escapeAttr(js);
}

function renderHomeResume() {
  const wrap = document.getElementById('home-resume');
  if (!wrap) return;
  const s = STATE.stats;

  // Never practised: draw nothing. This check is the "a stranger sees the old
  // screen" rule, so it happens before anything else.
  if (!s || !s.totals || !s.totals.attempts) {
    wrap.innerHTML = '';
    return;
  }

  const streak = s.streak || {};
  // The headline is deliberately just the number and its unit. Gluing "in a
  // row" onto it reads correctly in English and wrongly in Chinese ("12 天
  // 连续"), and the sub line below already carries the meaning — so the
  // headline stays a fact and the sentence stays in the sub.
  const headline = streak.current
    ? statPlural(streak.current, 'stats.dayOne', 'stats.days')
    : t('home.resumeWelcome');
  const sub = streak.practisedToday
    ? t('home.resumeDone')
    : streak.current
      ? t('home.resumeKeep')
      : t('home.resumeStart');

  wrap.innerHTML = `
    <div class="home-resume${streak.practisedToday ? ' done' : ''}">
      <div class="home-resume-main">
        <div class="home-resume-streak">${escapeHtml(headline)}</div>
        <div class="home-resume-sub">${escapeHtml(sub)}</div>
      </div>
      <button class="btn btn-primary home-resume-btn" onclick="continueLearning()">
        ${escapeHtml(t('home.resumeContinue'))}
      </button>
    </div>`;
}

/** Opens the browse list at the level she last worked at. */
function continueLearning() {
  goBrowse(continueLevel(STATE.stats));
}

/**
 * The two synchronous home cards. Called from init() and on a language switch.
 */
function renderHomeCards() {
  renderHomeResume();
}

/**
 * The "coming up" card: the next festival, at most three days out.
 *
 * It sits ABOVE Today's Culture because it is the only card on this screen with
 * a deadline. It is empty on most days of the year, which is the point: a
 * banner that is always there is furniture, and furniture is not read.
 *
 * The server decides WHICH festival and how many days away (seo.js →
 * upcomingFestivalPayload, served at /api/festival), because the landing pages
 * draw the same panel server-side. Two renderers, one decision — otherwise the
 * app and the site disagree on the day a window opens or closes, which is the
 * only day anyone would notice.
 */
async function renderHomeFestival() {
  const wrap = document.getElementById('home-festival');
  if (!wrap) return;
  try {
    if (STATE.homeFestival === null) {
      const res = await apiGet('/api/festival');
      STATE.homeFestival = (res && res.festival) || false;
    }
    const f = STATE.homeFestival;
    if (!f) {
      wrap.innerHTML = '';
      return;
    }
    const when = f.inDays === 0 ? t('home.festToday')
      : f.inDays === 1 ? t('home.festTomorrow')
        : t('home.festInDays').replace('{n}', String(f.inDays));
    // A Chinese reader gets the Chinese name; everyone else gets the English
    // one, which is what the household says out loud anyway.
    const name = currentLang() === 'zh' ? f.name_zh : f.name_en;
    // The date is formatted HERE, from the ISO day, rather than taken from the
    // server's pre-formatted string: "18 October" is not a date in a four-
    // language app. The server still owns WHICH day it is (that is the part the
    // landing pages must agree on); naming the month is a UI concern.
    const date = new Date(`${f.startsOn}T00:00:00Z`).toLocaleDateString(
      ({ en: 'en-GB', fil: 'fil-PH', zh: 'zh-CN', id: 'id-ID' })[currentLang()] || 'en-GB',
      { day: 'numeric', month: 'long', timeZone: 'UTC' }
    );

    // A short story about the day and a custom activity, both keyed on the
    // festival `key` from the shared payload. t() returns the key when a string
    // is missing, so a festival with no copy falls back to the words alone.
    const descKey = `festival.${f.key}.desc`;
    const actKey = `festival.${f.key}.activity`;
    const desc = t(descKey);
    const activity = t(actKey);
    const hasDesc = desc !== descKey;
    const hasActivity = activity !== actKey;

    wrap.innerHTML = `
      <div class="fest-card" role="region" aria-label="${escapeHtml(t('home.festLabel'))}">
        <p class="fest-card-kicker">${escapeHtml(t('home.festKicker'))}</p>
        <p class="fest-card-title"><span class="fest-card-icon" aria-hidden="true">${escapeHtml(f.icon)}</span>${escapeHtml(name)}</p>
        <p class="fest-card-when">${escapeHtml(when)} · ${escapeHtml(date)}</p>
        ${hasDesc ? `<p class="fest-card-desc">${escapeHtml(desc)}</p>` : ''}
        ${hasActivity ? `<p class="fest-card-activity"><span class="fest-card-activity-tag">${escapeHtml(t('home.festActivityLabel'))}</span><span class="fest-card-activity-text">${escapeHtml(activity)}</span></p>` : ''}
        ${f.words.length ? `<p class="fest-card-words-label">${escapeHtml(t('home.festWordsLabel'))}</p><ul class="fest-card-words">${f.words.map((w) =>
    `<li><span class="fest-yue">${escapeHtml(w.cantonese)}</span><span class="fest-jyut">${escapeHtml(w.jyutping)}</span></li>`).join('')}</ul>` : ''}
        <button type="button" class="btn btn-outline btn-block" onclick="openFestivalWords()">${escapeHtml(t('home.festCta'))}</button>
      </div>`;
  } catch (err) {
    console.warn('Could not load the festival:', err);
    wrap.innerHTML = '';
  }
}

/** The card's button: the Festivals category, in the app. */
function openFestivalWords() {
  openCategory(19);
}

/** One culture article per day, chosen by the server. */
async function renderHomeDailyCulture() {
  const wrap = document.getElementById('home-daily-culture');
  if (!wrap) return;
  try {
    if (STATE.homeDailyCulture === null) {
      const post = await apiGet('/api/posts/daily-culture');
      STATE.homeDailyCulture = post || false;
    }
    if (!STATE.homeDailyCulture) {
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML =
      `<h4 class="home-section-title">${escapeHtml(t('home.dailyCulture'))}</h4>` +
      postCardHtml(STATE.homeDailyCulture);
  } catch (err) {
    console.warn('Could not load daily culture:', err);
    wrap.innerHTML = '';
  }
}

/** Three Discover channel cards on the home screen. */
function renderHomeDiscoverPromo() {
  const wrap = document.getElementById('home-discover-promo');
  if (!wrap) return;
  const channels = [
    { key: 'culture', emoji: '🏛️', label: t('discover.tabCulture'), desc: t('discover.cultureLead') },
    { key: 'news',    emoji: '📰', label: t('discover.tabNews'),    desc: t('discover.newsLead') },
    { key: 'living', emoji: '🏠', label: t('discover.tabLiving'), desc: t('discover.livingLead') },
  ];
  wrap.innerHTML =
    `<h4 class="home-section-title">${escapeHtml(t('discover.title'))}</h4>` +
    `<div class="discover-promo-grid">` +
    channels.map((c) => `
      <button class="discover-promo-card" onclick="navigate('discover'); showChannel('${c.key}');">
        <span class="discover-promo-emoji">${c.emoji}</span>
        <span class="discover-promo-label">${escapeHtml(c.label)}</span>
        <span class="discover-promo-desc">${escapeHtml(c.desc)}</span>
      </button>`).join('') +
    `</div>`;
}

/**
 * The Games promotion on the home screen. Two live games, reusing the same
 * `.game-card` markup the Games hub uses, so the card she taps here is the card
 * she sees there. Rendered by JS — not markup — so a language switch re-reads
 * the strings, which static [data-i18n] text would not do.
 */
function renderHomeGamesPromo() {
  const wrap = document.getElementById('home-games-promo');
  if (!wrap) return;
  const games = [
    {
      href: '/games/uno',
      art: '<i>U</i><i>N</i><i>O</i>',
      name: 'UNO',
      desc: t('games.unoDesc'),
    },
    {
      href: '/games/bigtwo',
      art: '<i>2</i><i class="suit">♠</i><i class="suit">♥</i>',
      name: t('games.bigtwoName'),
      desc: t('games.bigtwoDesc'),
    },
    {
      href: '/games/wordmatch',
      art: '<i class="cjk">配</i><i class="cjk">對</i><i>?</i>',
      name: t('games.matchName'),
      desc: t('games.matchDesc'),
    },
  ];
  wrap.innerHTML =
    `<div class="games-promo">` +
      `<div class="games-promo-head">` +
        `<h4 class="home-section-title">${escapeHtml(t('games.promoTitle'))}</h4>` +
        `<span class="games-promo-badge">${escapeHtml(t('games.promoBadge'))}</span>` +
      `</div>` +
      `<p class="games-promo-lead">${escapeHtml(t('games.promoLead'))}</p>` +
      `<div class="games-grid">` +
      games.map((g) => `
        <a class="game-card game-card-live" href="${g.href}">
          <span class="game-art" aria-hidden="true">${g.art}</span>
          <span class="game-body">
            <span class="game-name">${escapeHtml(g.name)}</span>
            <span class="game-desc">${escapeHtml(g.desc)}</span>
          </span>
          <span class="game-go" aria-hidden="true">›</span>
        </a>`).join('') +
      `</div>` +
    `</div>`;
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

/* ---- The category row nudges itself, so a helper knows it scrolls ----
   The chip row is one horizontally-scrolling line on a phone (see styles.css).
   Nothing about it *looks* scrollable: the visible chips just end, and the only
   hint is a soft fade at the right edge. A helper who does not already know to
   swipe sees "All, Greetings, Common Phrases…" and reasonably concludes that is
   the whole list — the categories further along may as well not exist. This is
   the same failure the standing install button fixed: a capability that exists
   but is never discovered.

   So the row makes a small move on its own to demonstrate that it can. The
   rules, all deliberate:

     * It waits ~1.5s after the screen appears before moving, so the row is seen
       at rest first — otherwise the movement reads as a rendering glitch on
       load rather than as "there is more over here".
     * It nudges, pauses, then nudges again, up to 3 times, and then gives up.
       Repeating is what makes it noticeable to someone who glanced away during
       the first pass; stopping is what keeps it from becoming a thing that moves
       under her eyes the whole time she is choosing.
     * It stops IMMEDIATELY AND PERMANENTLY on the first real touch — a press, a
       drag, a trackpad/touch swipe or a wheel scroll. From that moment the row
       is hers and must never move on its own again.
     * Once she has touched it, later visits do not nudge at all. She has
       demonstrably learned that the row scrolls, so a repeat would only be noise.
     * It does nothing when there is nothing to reveal — a row that fits stays
       perfectly still, as does a wide screen where every chip is already visible.
     * It is skipped entirely under `prefers-reduced-motion`. This is decorative
       motion, and self-moving content is a classic motion-sickness trigger; a
       learner who has asked for less motion gets a still row, and loses nothing,
       because the fade and the swipe both remain.
     * Leaving the browse screen cancels it, so it can never animate behind a
       screen she is not looking at.

   One thing that is NOT true, and cost a rewrite: a `scroll` event DOES fire
   when we assign `scrollLeft`. The first implementation listened for `scroll`
   to detect a touch and never checked whether it had caused the scroll itself,
   so the very first animation frame tripped its own handler and the row stopped
   after 1px. `catNudging` marks our own movement so the handler can ignore it;
   see startCatNudge for the detail. */
const CAT_NUDGE = {
  DELAY: 1500,      // ms after the row appears before the first nudge
  DISTANCE: 120,    // px to travel — enough to expose one more chip and a bit
  DURATION: 1100,   // ms of travel; slow, so it reads as a glide, not a jump
  GAP: 900,         // ms between the end of one nudge and the start of the next
  REPEATS: 3,       // then it gives up: enough to be noticed, not nagging
};
let catNudgeTimer = null;
// True only while the animation itself is writing `scrollLeft`. A `scroll` event
// that arrives during this window is ours, not the learner's — see startCatNudge.
let catNudging = false;

/** May the row still move on its own? */
function catNudgeAllowed() {
  // A learner who asked her device for less motion must not get a row that
  // slides around while she reads.
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  // She has already scrolled it herself; the hint has done its job.
  if (STATE.catNudgeDone) return false;
  return true;
}

/** Cancel a pending or in-flight nudge. Does not change `catNudgeDone`. */
function stopCatNudge() {
  if (catNudgeTimer) { clearTimeout(catNudgeTimer); catNudgeTimer = null; }
  // Clear the "we are moving it" flag too. If the tab was hidden mid-animation
  // the final frame may never have run, and leaving this set would make the next
  // visit ignore a genuine scroll event.
  catNudging = false;
}

/** Hand the row back to the learner for good, on the first real interaction. */
function catNudgeStopForever() {
  STATE.catNudgeDone = true;
  stopCatNudge();
}

function startCatNudge() {
  if (!catNudgeAllowed()) return;
  const row = document.getElementById('filter-cat');
  if (!row) return;
  // Nothing to reveal, or the whole row already fits: no hint is needed.
  if (row.scrollWidth <= row.clientWidth + 4) return;

  stopCatNudge();

  /* The first genuine interaction ends the animation permanently.

     The subtlety that cost a rewrite: a `scroll` event DOES fire for our own
     `scrollLeft` writes — measured, one event per animation, which arrived the
     moment the first frame moved the row by a pixel, tripped this handler, and
     killed the nudge before it had travelled anywhere. (The thing that is
     unreliable about firing a scroll event is `scrollTo({behavior:'smooth'})`,
     not a plain property write. Those are different cases and were conflated
     here.)

     So we cannot simply listen for `scroll` and treat it as a touch. Instead
     the animation announces itself: `catNudging` is true while we are driving
     the row and any scroll event arriving in that window is ours. A scroll that
     arrives while we are NOT animating is genuinely the learner's, because
     nothing else moves this row.

     A drag also fires `pointerdown`/`touchstart` before it produces a scroll,
     so those remain the primary signals; `scroll` is the safety net for a
     trackpad swipe or a keyboard scroll that produced no pointer event. */
  const events = ['pointerdown', 'touchstart', 'wheel', 'scroll'];
  const surrender = (ev) => {
    if (ev && ev.type === 'scroll' && catNudging) return;   // our own movement
    events.forEach((e) => row.removeEventListener(e, surrender));
    catNudgeStopForever();
  };
  events.forEach((ev) => row.addEventListener(ev, surrender, { passive: true }));

  let done = 0;
  const nudge = () => {
    if (!catNudgeAllowed()) return;
    // Re-measure on every pass: a language switch rewrites the chip labels and
    // so changes the row's width, and she may have scrolled it in the meantime.
    const max = row.scrollWidth - row.clientWidth;
    if (max <= 4) return;                      // nothing left to reveal
    const from = row.scrollLeft;
    // Never overshoot the end. If we are already at the end, return to the start
    // instead, so the pass is still a visible move rather than a silent no-op.
    const target = from >= max - 4 ? 0 : Math.min(from + CAT_NUDGE.DISTANCE, max);

    const began = performance.now();
    catNudging = true;
    const step = (now) => {
      if (!catNudgeAllowed()) { catNudging = false; return; }
      const p = Math.min((now - began) / CAT_NUDGE.DURATION, 1);
      // easeInOutQuad — a linear slide looks mechanical at this speed.
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      row.scrollLeft = from + (target - from) * e;
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        // Clear the flag only after the final frame, so a scroll event queued by
        // that last write is still recognised as ours.
        requestAnimationFrame(() => { catNudging = false; });
        done += 1;
        if (done < CAT_NUDGE.REPEATS) catNudgeTimer = setTimeout(nudge, CAT_NUDGE.GAP);
      }
    };
    requestAnimationFrame(step);
  };

  catNudgeTimer = setTimeout(nudge, CAT_NUDGE.DELAY);
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
    <div class="vocab-card lv${v.level}" onclick="openVocabModal(${v.id})">
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
  if (lang === 'id') {
    return (
      (v.indonesian ? `<div class="vocab-english">${escapeHtml(v.indonesian)}</div>` : '') +
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
  if (lang === 'id') return v.indonesian || v.english || '';
  return v.english || '';
}

/** The meaning column for a language, or '' when it has none. Used where a
 *  caller needs the column itself rather than the fallback string. */
function meaningColumn(v, code) {
  if (!v) return '';
  if (code === 'zh') return v.mandarin || '';
  if (code === 'fil') return v.tagalog || '';
  if (code === 'id') return v.indonesian || '';
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
    const total = STATE.vocabulary.length;
    // A partial glossary is worth warning about BEFORE she switches — finding
    // out by hitting English words mid-quiz is worse. Each note is written in
    // the language it describes.
    const NOTE = {
      zh: (n) => `${n} / ${total} 词已有中文释义`,
      id: (n) => `${n} / ${total} kata sudah ada artinya`,
    };
    const COLUMN = { zh: 'mandarin', id: 'indonesian' };
    wrap.innerHTML = allLangs()
      .map((l) => {
        const active = l.code === currentLang();
        const col = COLUMN[l.code];
        const n = col ? STATE.vocabulary.filter((v) => v[col]).length : 0;
        const note = col && n && n < total ? `<span class="lang-row-note">${NOTE[l.code](n)}</span>` : '';
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
      ${shareRowHtml([
        { label: t('share.chatBtn'), icon: WHATSAPP_ICON_SVG, onclick: "shareResult('chat')", variant: 'wa' },
        { label: t('share.pictureBtn'), icon: '🖼️', onclick: 'shareResult()' },
      ])}
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

/**
 * A sticker's name in the language currently being read.
 *
 * Mirrors meaning(): the reader's own column first, English as the fallback.
 * Before this, only Filipino was handled, so a Chinese or Indonesian reader met
 * English on her own album — the one place in the app where every single label
 * is a word she is meant to be learning.
 */
function stickerName(s) {
  const lang = currentLang();
  if (lang === 'zh') return s.mandarin || s.english || '';
  if (lang === 'fil') return s.tagalog || s.english || '';
  if (lang === 'id') return s.indonesian || s.english || '';
  return s.english || '';
}

/**
 * One sticker in the album.
 *
 * Unlocked stickers are buttons, because tapping one opens the detail sheet and
 * the sheet is where sharing lives — the album is the thing she is proud of, so
 * it is also the thing she most wants to send to a friend.
 *
 * A locked sticker shows its emoji greyed out and its price, and no name: the
 * greyed silhouette is the invitation ("what is that?") and the number is the
 * distance to it. Its name is withheld on purpose — the reveal is the reward.
 */
function stickerTileHtml(s) {
  const tier = s.tier || 'local';
  if (s.unlocked) {
    return `<button class="sticker-tile tier-${tier} is-unlocked" onclick="openStickerModal('${s.key}')"
                    aria-label="${escapeHtml(stickerName(s))} — ${escapeHtml(t('rewards.openSticker'))}">
              <span class="sticker-emoji">${s.emoji}</span>
              <span class="sticker-name">${escapeHtml(stickerName(s))}</span>
              <span class="sticker-canto">${escapeHtml(s.cantonese)}</span>
            </button>`;
  }
  return `<div class="sticker-tile tier-${tier} is-locked" title="${escapeHtml(t('rewards.notYet'))}">
            <span class="sticker-emoji">${s.emoji}</span>
            <span class="sticker-cost">${s.credits}</span>
          </div>`;
}

/**
 * The credit balance and the sticker album.
 *
 * Uncollected stickers still show what they cost, so the album reads as
 * something to work towards rather than a wall of padlocks. Each sticker is
 * also a phrase worth knowing, so it doubles as a vocabulary list.
 *
 * The album is grouped into four shelves by the `tier` the server derives from
 * each sticker's credit threshold — never stored, so the shelves can never
 * disagree with the numbers.
 */
function renderRewardsCard() {
  const r = _rewards;
  if (!r || !r.stickers.length) return '';

  const collected = r.stickers.filter((s) => s.unlocked).length;
  const total = r.stickers.length;
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

  // Group into shelves, keeping the seed order (which is ascending by credits).
  const order = [];
  const shelves = {};
  for (const s of r.stickers) {
    const k = s.tier || 'local';
    if (!shelves[k]) { shelves[k] = []; order.push(k); }
    shelves[k].push(s);
  }

  const album = order
    .map((k) => {
      const list = shelves[k];
      const got = list.filter((s) => s.unlocked).length;
      return `
        <div class="sticker-shelf">
          <h5 class="sticker-shelf-title">
            <span>${escapeHtml(t('rewards.shelf.' + k))}</span>
            <span class="sticker-shelf-count">${got}/${list.length}</span>
          </h5>
          <div class="sticker-grid">${list.map(stickerTileHtml).join('')}</div>
        </div>`;
    })
    .join('');

  return `
    <div class="progress-card rewards-card">
      <h4>${t('rewards.title')}</h4>
      <div class="rewards-balance">
        <span class="rewards-credits">${r.credits}</span>
        <span class="rewards-credit-word">${creditWord}</span>
        <span class="rewards-count">${collected}/${total}</span>
      </div>
      <p class="rewards-hint">${t('rewards.hint')}</p>
      ${next}
      <div class="sticker-album">${album}</div>
      ${shareRowHtml([
        { label: t('share.chatBtn'), icon: WHATSAPP_ICON_SVG, onclick: "shareAlbum('chat')", variant: 'wa' },
        { label: t('share.pictureBtn'), icon: '🖼️', onclick: 'shareAlbum()' },
      ])}
    </div>`;
}

/**
 * The sticker detail sheet — the same modal the vocabulary cards use.
 *
 * Reusing #vocab-modal rather than adding a second dialog keeps one piece of
 * modal plumbing (open, close, backdrop tap) instead of two that drift apart.
 */
function openStickerModal(key) {
  const s = _rewards && _rewards.stickers.find((x) => x.key === key);
  if (!s || !s.unlocked) return;
  const modal = document.getElementById('vocab-modal');
  if (!modal) return;

  const name = stickerName(s);
  // The reader's own gloss, then English underneath when it is a different
  // string — the same order the browse cards use.
  const extra = s.english && s.english !== name
    ? `<div class="vocab-tagalog">${escapeHtml(s.english)}</div>`
    : '';
  const when = s.unlocked_at ? postDate(s.unlocked_at) : '';

  modal.querySelector('.modal-card').innerHTML = `
    <div class="modal-emoji">${s.emoji}</div>
    <div class="modal-cantonese">${escapeHtml(s.cantonese)}</div>
    <div class="modal-jyutping">${escapeHtml(s.jyutping)}</div>
    <div class="vocab-english">${escapeHtml(name)}</div>
    ${extra}
    <button class="modal-audio-btn" onclick="speak('${s.cantonese.replace(/'/g, "\\'")}', this)">🔊</button>
    <div style="font-size:0.75rem;color:#6c757d;margin-top:6px">${escapeHtml(t('browse.tapToHear'))}</div>
    ${when ? `<div class="sticker-earned">${escapeHtml(t('rewards.earnedOn'))} ${escapeHtml(when)}</div>` : ''}
    ${shareRowHtml([
      { label: t('share.chatBtn'), icon: WHATSAPP_ICON_SVG, onclick: `shareSticker('${s.key}', 'chat')`, variant: 'wa' },
      { label: t('share.pictureBtn'), icon: '🖼️', onclick: `shareSticker('${s.key}')` },
    ])}
    <button class="modal-close" onclick="closeModal()">${t('misc.close')}</button>
  `;
  modal.classList.add('show');
}

/**
 * The "you earned a sticker" block shown on the quiz result screen.
 *
 * Only ever shows stickers unlocked by THIS quiz — the server reports them once
 * and then forgets, so re-opening the result cannot re-announce them.
 *
 * When it is a single sticker the phrase is spelled out underneath, because the
 * moment she is pleased is the moment she will actually read it. A share button
 * sits with it for the same reason: pride is the only reliable urge to post.
 */
function renderStickerCelebration(r) {
  if (!r || !r.newly_unlocked || !r.newly_unlocked.length) return '';
  const won = r.stickers.filter((s) => r.newly_unlocked.includes(s.key));
  // Guard rather than assume: `newly_unlocked` is the server's list of keys and
  // `stickers` is the catalogue, and a key that is in one but not the other
  // would make won[0] below throw on the result screen — the worst possible
  // place to break.
  if (!won.length) return '';
  const body =
    won.length === 1
      ? t('rewards.newBody').replace('{name}', escapeHtml(stickerName(won[0])))
      : t('rewards.newBodyMany').replace('{n}', won.length);

  const say = won.length === 1
    ? `<div class="sticker-celebrate-say">${escapeHtml(won[0].cantonese)} · ${escapeHtml(won[0].jyutping)}</div>`
    : '';

  return `
    <div class="sticker-celebrate">
      <div class="sticker-celebrate-title">${t('rewards.newTitle')}</div>
      <div class="sticker-celebrate-row">
        ${won.map((s) => `<span class="sticker-celebrate-tile">${s.emoji}</span>`).join('')}
      </div>
      <div class="sticker-celebrate-body">${body}</div>
      ${say}
      ${shareRowHtml([
        { label: t('share.chatBtn'), icon: WHATSAPP_ICON_SVG, onclick: `shareSticker('${won[0].key}', 'chat')`, variant: 'wa' },
        { label: t('share.pictureBtn'), icon: '🖼️', onclick: `shareSticker('${won[0].key}')` },
      ])}
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
// from three places, because someone who has just hit a problem should not have
// to guess where to report it: the fifth item in the bottom nav (the real one —
// on screen from every view), the bottom of My Progress, and the page footer.
// The nav tab was added last, after the first two proved too easy to miss: both
// needed the learner to already suspect the feature existed.
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

/**
 * Share to Facebook.
 *
 * WHY THE CARD AND NOT A BARE URL: a shared plain URL does not reach
 * Facebook's composer. On Android the app takes the link, opens its FEED, and
 * no post is ever prepared — the exact report of 2026-10-19: "after click, it
 * will not prepare a post and auto start facebook app". A shared IMAGE
 * behaves the opposite way: the app opens its composer with the picture and
 * the text already in place. So this hands over the same card the picture
 * button uses, which is both the reliable path and the better-looking post.
 *
 * WHY THE SHARER IS ONLY A FALLBACK: Meta's `sharer.php` answers **HTTP 400**
 * and, in a real browser, refuses a signed-out visitor with "You are not
 * logged in" — verified against the endpoint on 2026-10-19. `dialog/share`
 * needs an app id this project does not have. So the sharer prepares a proper
 * post (with a link preview) only in a browser already signed in to Facebook,
 * and the clipboard is the last resort when even the popup is blocked.
 */
async function shareToFacebook(args) {
  const clean = String(args.text || '').trim();

  // 1. The share sheet, WITH the card as an image. On a phone this is the
  //    only route that prepares a post inside the Facebook app.
  const file = await shareCardFile({ spec: args.spec, filename: args.filename });
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: clean, url: args.url });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return; // she changed her mind
      // anything else: fall through to Facebook's own dialog
    }
  }

  // 2. Facebook's own share dialog — prepares the post with a link preview.
  const pop = window.open(
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(args.url)}`,
    '_blank',
    'noopener'
  );
  if (!pop) {
    try {
      await navigator.clipboard.writeText(`${clean}\n${args.url}`);
      showToast(t('share.fbCopied'));
    } catch {
      showToast(t('share.failed'));
    }
  }
}

/**
 * Share a culture post to Instagram.
 *
 * Instagram has no web share URL — there is nothing to open, and a button that
 * claimed to "open Instagram" would do nothing on a desktop. What actually
 * works is the CARD: on a phone, the OS share sheet (which this hands the card
 * to) offers Instagram among its targets; on a desktop there is no sheet, so
 * the card is downloaded and the text copied, and the toast says exactly that
 * rather than pretending a share happened.
 */
function shareToInstagram(args) {
  return sharePicture({ ...args, toastKey: 'share.igSaved' });
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

/** Facebook glyph — the "f". Brand shapes are recognisable before any label. */
const FACEBOOK_ICON_SVG = `
  <svg class="share-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M13.8 21v-8h2.6l.4-3h-3V7.9c0-.9.2-1.4 1.4-1.4H17V3.7c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V10H8v3h2.6v8h3.2Z" fill="currentColor"/>
  </svg>`;

/** Instagram glyph — the camera mark. */
const INSTAGRAM_ICON_SVG = `
  <svg class="share-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
    <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/>
    <circle cx="17" cy="7" r="1.3" fill="currentColor"/>
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
//
// ONE renderer, six layouts. Every shareable thing — a word, a sticker, the
// album, a quiz score, a story, an article — is the same 1080px square with the
// same frame, and differs only in the blocks it puts in the middle. That is
// deliberate: the point of sharing several different parts of the app is that a
// friend sees SIX DIFFERENT PICTURES from one app, not six variations of a
// poster. The frame is what makes them read as one app; the middle is what
// makes each one worth sending.

const CARD_SIZE = 1080;
const CARD_HAN = '"Noto Sans SC","PingFang HK","Microsoft JhengHei",sans-serif';
const CARD_UI = 'Inter,-apple-system,"Segoe UI",Roboto,sans-serif';
const CARD_MONO = 'ui-monospace,Menlo,monospace';

/**
 * Read a CSS custom property so the cards share the app's palette instead of
 * carrying a second copy of it. A canvas cannot use a var(), but it can read
 * one — which is the difference between one palette and two that drift.
 */
let _cardTokens = null;
function cardTokens() {
  if (_cardTokens) return _cardTokens;
  const read = (name, fallback) => {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch { return fallback; }
  };
  _cardTokens = {
    primary: read('--c-primary', '#e63946'),
    primaryTint: read('--c-primary-tint', '#fff1f2'),
    secondary: read('--c-secondary', '#2a9d8f'),
    text: read('--c-text', '#1a1a2e'),
    soft: read('--c-text-soft', '#6c757d'),
    lv1: read('--lv1', '#17796d'), lv1Tint: read('--lv1-tint', '#e1f5ee'),
    lv2: read('--lv2', '#a8641a'), lv2Tint: read('--lv2-tint', '#faedda'),
    lv3: read('--lv3', '#2f66b8'), lv3Tint: read('--lv3-tint', '#e6f0fb'),
  };
  return _cardTokens;
}

/** The accent and wash for a sticker shelf, taken from the level tokens. */
function tierColours(tier) {
  const k = cardTokens();
  if (tier === 'first') return { accent: k.lv1, tint: k.lv1Tint };
  if (tier === 'everyday') return { accent: k.lv2, tint: k.lv2Tint };
  if (tier === 'out') return { accent: k.lv3, tint: k.lv3Tint };
  return { accent: k.primary, tint: k.primaryTint };
}

/** Draw text centred on one line, shrinking until it fits `maxWidth`. */
function cardFitText(ctx, text, maxWidth, startSize, family, weight = 700) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size > 22);
  return size;
}

const isCJKChar = (s) => /[\u3400-\u4dbf\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(s);

/**
 * Split text into wrap tokens: one per CJK character, one per latin word.
 *
 * Chinese has no spaces, so wrapping by words alone turns a Chinese title into
 * a single unbreakable token and it overflows the card. A story can be written
 * in any of the four languages, so this cannot assume latin word boundaries.
 */
function cardTextTokens(text) {
  const out = [];
  const re = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef]|[^\s]+/g;
  let m;
  while ((m = re.exec(String(text || '')))) out.push(m[0]);
  return out;
}

/** Join two tokens with a space only where one belongs (never around CJK). */
function cardJoin(a, b) {
  if (!a) return b;
  if (isCJKChar(a.slice(-1)) || isCJKChar(b[0])) return a + b;
  return `${a} ${b}`;
}

/**
 * Wrap text into at most `maxLines` lines, ellipsising the last one.
 *
 * A token too wide for a whole line on its own is broken by character, so a
 * long unbroken string degrades into something readable rather than running off
 * the edge of the card.
 */
function cardWrap(ctx, text, maxWidth, family, size, weight, maxLines) {
  ctx.font = `${weight} ${size}px ${family}`;
  const toks = cardTextTokens(text);
  const lines = [];
  let line = '';

  for (let i = 0; i < toks.length; i++) {
    const test = cardJoin(line, toks[i]);
    if (ctx.measureText(test).width <= maxWidth) { line = test; continue; }
    if (!line) {
      // Nothing on the line yet and this token still does not fit: split it.
      let chunk = '';
      for (const ch of toks[i]) {
        if (chunk && ctx.measureText(chunk + ch).width > maxWidth) { lines.push(chunk); chunk = ch; }
        else chunk += ch;
      }
      line = chunk;
      continue;
    }
    lines.push(line);
    line = toks[i];
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && line && lines[lines.length - 1] !== line) {
    let last = lines[maxLines - 1];
    while (last.length > 3 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

/** Draw one block of a card. */
function drawCardBlock(ctx, b, accent, textColour, softColour) {
  const color = b.color || textColour;
  const align = b.align || 'center';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const x = align === 'left' ? 72 : CARD_SIZE / 2;

  if (b.type === 'emoji') {
    ctx.font = `${b.size || 180}px ${CARD_UI}`;
    ctx.fillStyle = color;
    ctx.fillText(b.value, x, b.y);
    return;
  }

  if (b.type === 'emojiRow' || b.type === 'emojiGrid') {
    const values = b.values || [];
    if (!values.length) return;
    const size = b.size || 52;
    ctx.font = `${size}px ${CARD_UI}`;
    const gap = b.gap == null ? 12 : b.gap;
    const widths = values.map((v) => ctx.measureText(v).width);
    const rowH = size + (b.rowGap == null ? 16 : b.rowGap);

    if (b.type === 'emojiRow') {
      const total = widths.reduce((a, w) => a + w, 0) + gap * (values.length - 1);
      let cx = CARD_SIZE / 2 - total / 2;
      ctx.textAlign = 'left';
      ctx.fillStyle = color;
      values.forEach((v, i) => {
        ctx.fillText(v, cx, b.y);
        cx += widths[i] + gap;
      });
      return;
    }

    // Grid: fixed columns, each glyph centred in its cell, at most two rows.
    const cols = b.columns || Math.min(12, Math.ceil(values.length / 2)) || 1;
    const cell = (CARD_SIZE - 144) / cols;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    values.forEach((v, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      ctx.fillText(v, 72 + cell * col + cell / 2, b.y + row * rowH);
    });
    return;
  }

  if (b.type === 'wrap') {
    const family = b.family || CARD_UI;
    const weight = b.weight || 700;
    const size = b.size || 54;
    const lh = b.lineHeight || Math.round(size * 1.26);
    const lines = cardWrap(ctx, b.value, b.maxWidth || CARD_SIZE - 200, family, size, weight, b.maxLines || 3);
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillStyle = color;
    lines.forEach((ln, i) => ctx.fillText(ln, x, b.y + i * lh));
    return;
  }

  // A single fitted line.
  const family = b.family || CARD_UI;
  const weight = b.weight || 700;
  const size = cardFitText(ctx, b.value, b.maxWidth || CARD_SIZE - 200, b.size || 64, family, weight);
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.fillText(b.value, x, b.y);
}

/**
 * Render a share card as a square PNG.
 *
 * @param {object} spec  { accent, tint, eyebrow, blocks[], footnote, link }
 * @returns {Promise<Blob|null>} null if canvas is unavailable.
 */
function shareCardBlob(spec) {
  return new Promise((resolve) => {
    try {
      const k = cardTokens();
      const cv = document.createElement('canvas');
      cv.width = CARD_SIZE;
      cv.height = CARD_SIZE;
      const ctx = cv.getContext('2d');
      if (!ctx) return resolve(null);

      const accent = spec.accent || k.primary;
      const tint = spec.tint || k.primaryTint;

      // Paper.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

      // A soft wash in the top-right corner. A bare white square reads as a
      // missing image in a chat; a tinted one reads as a designed card.
      const wash = ctx.createRadialGradient(
        CARD_SIZE * 0.9, CARD_SIZE * 0.06, 0,
        CARD_SIZE * 0.9, CARD_SIZE * 0.06, CARD_SIZE * 0.72
      );
      wash.addColorStop(0, tint);
      wash.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

      // Brand bar.
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, CARD_SIZE, 14);

      // Wordmark.
      ctx.fillStyle = k.text;
      ctx.font = `700 44px ${CARD_UI}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('🦜 CantoBuddy', 72, 96);

      if (spec.eyebrow) {
        ctx.font = `700 28px ${CARD_UI}`;
        ctx.fillStyle = accent;
        ctx.fillText(String(spec.eyebrow).toUpperCase(), 72, 178);
      }

      for (const b of spec.blocks || []) drawCardBlock(ctx, b, accent, k.text, k.soft);

      // Footer: what this is, and where to get it.
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `400 36px ${CARD_UI}`;
      ctx.fillStyle = k.soft;
      ctx.fillText(spec.footnote || t('share.cardFooter'), CARD_SIZE / 2, 946);
      ctx.font = `700 42px ${CARD_UI}`;
      ctx.fillStyle = accent;
      ctx.fillText(spec.link || 'cantobuddy.com', CARD_SIZE / 2, 1006);

      cv.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/**
 * The rendered card as a File, or null if it could not be drawn.
 *
 * Factored out of sharePicture so both the picture button and the Facebook
 * button can hand the same PNG to the platform.
 */
async function shareCardFile({ spec, filename }) {
  const blob = await shareCardBlob(spec);
  if (!blob) return null;
  return new File([blob], filename, { type: 'image/png' });
}

/**
 * Hand a rendered card to the platform.
 *
 * Three paths, in order of preference:
 *   1. the native sheet WITH the file — one tap to any app she has
 *   2. save the PNG and put the text on the clipboard — desktop, and any
 *      browser that cannot share files
 * The second is not a failure: she still ends up with both halves of the post.
 */
async function sharePicture({ spec, text, url, filename, toastKey }) {
  const clean = String(text || '').trim();
  const blob = await shareCardBlob(spec);
  if (!blob) return shareOrCopy({ title: 'CantoBuddy', text: clean, url });

  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: clean, url });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }

  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    await navigator.clipboard.writeText(`${clean}\n${url}`);
    showToast(t(toastKey || 'share.cardSaved'));
  } catch {
    showToast(t('share.failed'));
  }
}

/**
 * The share strip: one consistent row under anything worth sharing.
 *
 * WhatsApp comes first because that is where this community actually talks, and
 * the picture second because a text-only post dies in a busy group chat. Having
 * the same two buttons in the same place on the album, on a story and on an
 * article is the whole "easier to share" idea — she learns the row once.
 */
function shareRowHtml(actions) {
  return `<div class="share-row">${actions
    .map(
      (a) => `<button class="share-row-btn${a.variant ? ' share-row-btn--' + a.variant : ''}" onclick="${a.onclick}">
                ${a.icon || SHARE_ICON_SVG}<span class="share-row-label">${escapeHtml(a.label)}</span>
              </button>`
    )
    .join('')}</div>`;
}

/**
 * The culture post's share strip: three social icons, no words, no message box.
 *
 * Icons only, because the brand shapes carry the meaning before any label is
 * read — and the title/aria-label carries the brand name for anyone who cannot
 * see the glyph. There is deliberately no "leave a message" affordance: a post
 * is shared OUT, not discussed here.
 *
 * Facebook opens its share dialog; WhatsApp opens a chat; Instagram has no web
 * share URL at all, so it shares the CARD (see shareToInstagram) — which on a
 * phone surfaces Instagram inside the OS share sheet.
 */
function socialRowHtml(post) {
  const btn = (kind, icon, labelKey) => `
        <button type="button" class="social-row-btn social-row-btn--${kind}"
                data-share="${kind}"
                title="${escapeHtml(t(labelKey))}" aria-label="${escapeHtml(t(labelKey))}"
                onclick="shareArticle('${post.slug}', '${kind}')">${icon}</button>`;
  return `<div class="social-row" role="group" aria-label="${escapeHtml(t('share.shareThis'))}">${btn(
    'facebook',
    FACEBOOK_ICON_SVG,
    'share.shareOnFacebook'
  )}${btn('instagram', INSTAGRAM_ICON_SVG, 'share.shareOnInstagram')}${btn(
    'whatsapp',
    WHATSAPP_ICON_SVG,
    'share.shareOnWhatsApp'
  )}
      </div>`;
}

// ---- The six card layouts --------------------------------------------------

/** A vocabulary word — the original card, now drawn through the shared frame. */
function wordSpec(v) {
  const primary = meaning(v) || v.english || '';
  const secondary = currentLang() === 'en' ? v.tagalog || '' : v.english || '';
  return {
    eyebrow: t('share.cardWord'),
    blocks: [
      { type: 'text', value: v.cantonese || '', family: CARD_HAN, weight: 500, size: 300, y: 420, maxWidth: CARD_SIZE - 160 },
      { type: 'text', value: v.jyutping || '', family: CARD_MONO, weight: 400, size: 52, color: cardTokens().primary, y: 600 },
      { type: 'text', value: primary, size: 66, y: 716, maxWidth: CARD_SIZE - 200 },
      secondary && secondary !== primary
        ? { type: 'text', value: secondary, weight: 400, size: 50, color: cardTokens().soft, y: 796, maxWidth: CARD_SIZE - 200 }
        : null,
    ].filter(Boolean),
  };
}

/** Public word-card renderer — delegates to the shared card engine. */
function wordCardBlob(v) {
  return shareCardBlob(wordSpec(v));
}

/** One collected sticker, in its shelf's colour. */
function stickerSpec(s) {
  const { accent, tint } = tierColours(s.tier);
  const r = _rewards;
  const n = r ? r.stickers.findIndex((x) => x.key === s.key) + 1 : 0;
  const total = r ? r.stickers.length : 0;
  const name = stickerName(s);
  return {
    accent,
    tint,
    eyebrow: total ? t('share.cardSticker').replace('{n}', n).replace('{total}', total) : t('share.cardStickerShort'),
    blocks: [
      { type: 'emoji', value: s.emoji, size: 200, y: 340 },
      { type: 'text', value: s.cantonese, family: CARD_HAN, weight: 600, size: 170, y: 530, maxWidth: CARD_SIZE - 220 },
      { type: 'text', value: s.jyutping, family: CARD_MONO, weight: 400, size: 50, color: accent, y: 648 },
      { type: 'text', value: name, size: 58, y: 736, maxWidth: CARD_SIZE - 200 },
      s.english && s.english !== name
        ? { type: 'text', value: s.english, weight: 400, size: 42, color: cardTokens().soft, y: 796, maxWidth: CARD_SIZE - 200 }
        : null,
    ].filter(Boolean),
  };
}

/** The whole album — the most personal thing in the app, and the most shareable. */
function albumSpec(r) {
  const got = r.stickers.filter((s) => s.unlocked);
  const total = r.stickers.length;
  const k = cardTokens();
  return {
    accent: k.primary,
    tint: k.primaryTint,
    eyebrow: t('share.cardAlbum'),
    blocks: [
      { type: 'text', value: `${got.length}/${total}`, size: 200, y: 372 },
      { type: 'text', value: t('share.cardAlbumSub'), size: 52, y: 500, maxWidth: CARD_SIZE - 200 },
      got.length
        ? { type: 'emojiGrid', values: got.map((s) => s.emoji), size: got.length > 12 ? 46 : 58, y: 640, rowGap: 22 }
        : null,
      { type: 'text', value: `${r.credits} ${t('rewards.credits')}`, weight: 500, size: 42, color: k.soft, y: 800 },
    ].filter(Boolean),
  };
}

/** A quiz score. */
function resultSpec(r) {
  const k = cardTokens();
  return {
    accent: k.primary,
    tint: k.primaryTint,
    eyebrow: t('share.cardResult'),
    blocks: [
      { type: 'text', value: `${r.score}/${r.total}`, size: 210, y: 400 },
      { type: 'text', value: t('share.cardResultSub').replace('{pct}', r.pct), size: 54, y: 540, maxWidth: CARD_SIZE - 200 },
      { type: 'text', value: quizTypeName(r.type), weight: 500, size: 44, color: k.soft, y: 632, maxWidth: CARD_SIZE - 200 },
    ],
  };
}

/** A helper's story. */
function storySpec(story) {
  const k = cardTokens();
  const byline = String(story.display_name || '').trim() || t('story.anonymous');
  return {
    accent: k.secondary,
    tint: '#e6f5f3',
    eyebrow: t('share.cardStory'),
    blocks: [
      { type: 'emoji', value: '📖', size: 140, y: 300 },
      { type: 'wrap', value: story.title, size: 60, y: 470, maxLines: 3, lineHeight: 76 },
      { type: 'text', value: byline, weight: 500, size: 42, color: k.soft, y: 790, maxWidth: CARD_SIZE - 200 },
    ],
  };
}

/** A Discover article. */
function articleSpec(post) {
  const k = cardTokens();
  const summary = postField(post, 'summary');
  return {
    accent: k.secondary,
    tint: '#e6f5f3',
    eyebrow: t('share.cardArticle'),
    blocks: [
      { type: 'emoji', value: post.icon || '🏮', size: 140, y: 300 },
      { type: 'wrap', value: postField(post, 'title'), size: 56, y: 462, maxLines: 3, lineHeight: 72 },
      summary
        ? { type: 'wrap', value: summary, size: 34, weight: 400, color: k.soft, y: 760, maxLines: 2, lineHeight: 46, maxWidth: CARD_SIZE - 220 }
        : null,
    ].filter(Boolean),
  };
}

// ---- Sharing each one ------------------------------------------------------

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
  const gloss = [meaning(v), v.english].filter(Boolean).filter((s, i, a) => a.indexOf(s) === i).join(' / ');
  await sharePicture({
    spec: wordSpec(v),
    text: `${v.emoji || ''} ${v.cantonese} (${v.jyutping}) = ${gloss}\n${t('share.wordText')}`,
    url: shareUrl(v.slug ? `/words/${v.slug}` : null),
    filename: `cantobuddy-${v.slug || v.id}.png`,
  });
}

/**
 * Share one sticker, either as a picture or straight into a chat.
 *
 * `mode` is 'picture' (default) or 'chat'. One function with a mode rather than
 * two near-identical ones, so the text and the picture can never say different
 * things about the same sticker.
 */
async function shareSticker(key, mode) {
  const s = _rewards && _rewards.stickers.find((x) => x.key === key);
  if (!s || !s.unlocked) return;
  const name = stickerName(s);
  const text = t('share.stickerText')
    .replace('{emoji}', s.emoji)
    .replace('{cantonese}', s.cantonese)
    .replace('{jyutping}', s.jyutping)
    .replace('{name}', name);
  if (mode === 'chat') return shareToWhatsApp(text, shareUrl(null));
  await sharePicture({ spec: stickerSpec(s), text, url: shareUrl(null), filename: `cantobuddy-sticker-${s.key}.png` });
}

/** Share the album, as a picture or into a chat. */
async function shareAlbum(mode) {
  const r = _rewards;
  if (!r || !r.stickers.length) return;
  const got = r.stickers.filter((s) => s.unlocked).length;
  const text = t('share.albumText')
    .replace('{n}', got)
    .replace('{total}', r.stickers.length);
  if (mode === 'chat') return shareToWhatsApp(text, shareUrl(null));
  await sharePicture({ spec: albumSpec(r), text, url: shareUrl(null), filename: 'cantobuddy-album.png' });
}

/** Share the most recent quiz score, as a picture or into a chat. */
async function shareResult(mode) {
  const r = window._lastResult;
  if (!r) return;
  const text = t('share.scoreText').replace('{score}', r.score).replace('{total}', r.total);
  if (mode === 'chat') return shareToWhatsApp(text, shareUrl(null));
  await sharePicture({ spec: resultSpec(r), text, url: shareUrl(null), filename: 'cantobuddy-score.png' });
}

/**
 * Share a story someone else wrote.
 *
 * The link is the story's own page, which is a real crawlable document with its
 * own title and description — so the share works even for a friend who never
 * installs the app.
 */
async function shareStory(slug, mode) {
  const story = STATE.stories.current && STATE.stories.current.slug === slug
    ? STATE.stories.current
    : (STATE.stories.list || []).find((s) => s.slug === slug);
  if (!story) return;
  const text = t('share.storyText').replace('{title}', story.title);
  const url = shareUrl(`/stories/${slug}`);
  if (mode === 'chat') return shareToWhatsApp(text, url);
  await sharePicture({ spec: storySpec(story), text, url, filename: `cantobuddy-story-${slug}.png` });
}

/** Share an article from the Discover feed. */
async function shareArticle(slug, mode) {
  const post = STATE.discover.current && STATE.discover.current.slug === slug
    ? STATE.discover.current
    : (STATE.discover.list || []).find((p) => p.slug === slug);
  if (!post) return;
  const text = t('share.articleText').replace('{title}', postField(post, 'title'));
  const url = shareUrl(`/discover/${slug}`);
  if (mode === 'chat' || mode === 'whatsapp') return shareToWhatsApp(text, url);
  if (mode === 'facebook') {
    return shareToFacebook({
      spec: articleSpec(post),
      text,
      url,
      filename: `cantobuddy-${slug}.png`,
    });
  }
  if (mode === 'instagram') {
    return shareToInstagram({
      spec: articleSpec(post),
      text,
      url,
      filename: `cantobuddy-${slug}.png`,
    });
  }
  await sharePicture({
    spec: articleSpec(post),
    text,
    url,
    filename: `cantobuddy-${slug}.png`,
  });
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
 * The "share what you did" cards.
 *
 * Only offers what she actually has. An empty album card is a dead end, and a
 * dead end on the one page whose whole job is to get a link sent is worse than
 * not showing the card at all — so a card appears only when there is something
 * behind it.
 */
function renderShareHub() {
  const host = document.getElementById('share-hub');
  if (!host) return;

  const cards = [];

  const r = _rewards;
  const got = r ? r.stickers.filter((s) => s.unlocked).length : 0;
  if (got) {
    cards.push({
      icon: '🏅',
      title: t('share.hubAlbum'),
      sub: t('share.hubAlbumSub').replace('{n}', got).replace('{total}', r.stickers.length),
      onclick: 'shareAlbum()',
    });
  }

  if (window._lastResult) {
    const lr = window._lastResult;
    cards.push({
      icon: '🌟',
      title: t('share.hubScore'),
      sub: t('share.hubScoreSub').replace('{score}', lr.score).replace('{total}', lr.total),
      onclick: 'shareResult()',
    });
  }

  const word = STATE.vocabulary[0];
  if (word) {
    cards.push({
      icon: word.emoji || '📝',
      title: t('share.hubWord'),
      sub: t('share.hubWordSub').replace('{word}', `${word.cantonese} · ${meaning(word)}`),
      onclick: `shareWordCard(${Number(word.id)})`,
    });
  }

  const story = (STATE.stories.list || [])[0];
  if (story) {
    cards.push({
      icon: '📖',
      title: t('share.hubStory'),
      sub: t('share.hubStorySub').replace('{title}', story.title),
      onclick: `shareStory('${story.slug}')`,
    });
  }

  const post = (STATE.discover.posts.culture || [])[0] || (STATE.discover.posts.news || [])[0];
  if (post) {
    cards.push({
      icon: post.icon || '🏮',
      title: t('share.hubArticle'),
      sub: t('share.hubArticleSub').replace('{title}', postField(post, 'title')),
      onclick: `shareArticle('${post.slug}')`,
    });
  }

  const heading = document.getElementById('share-hub-heading');
  if (heading) heading.hidden = !cards.length;

  host.innerHTML = cards
    .map(
      (c) => `<button class="share-hub-card" onclick="${c.onclick}">
                <span class="share-hub-icon">${escapeHtml(c.icon)}</span>
                <span class="share-hub-text">
                  <span class="share-hub-title">${escapeHtml(c.title)}</span>
                  <span class="share-hub-sub">${escapeHtml(c.sub)}</span>
                </span>
                <span class="share-hub-go" aria-hidden="true">›</span>
              </button>`
    )
    .join('');
}

/**
 * Quietly load what the hub needs, then redraw it.
 *
 * The album card needs her credits, and the story and article cards need a list
 * she may never have opened this session. Fetching them here rather than
 * leaving the cards out means the page is complete on a first visit, and every
 * fetch writes into the same STATE cache Discover uses — so arriving here costs
 * one request, not a second copy of the feed.
 *
 * The redraw is gated on her still being on the page: a slow response must
 * never paint over whatever she has navigated to since.
 */
async function prefetchShareHub() {
  const jobs = [];
  if (!_rewards) jobs.push(fetchRewards());
  if (!STATE.stories.list) {
    jobs.push(apiGet('/api/stories').then((s) => { STATE.stories.list = s; }).catch(() => {}));
  }
  if (!STATE.discover.posts.culture) {
    jobs.push(
      apiGet('/api/posts?channel=culture')
        .then((p) => { STATE.discover.posts.culture = p; })
        .catch(() => {})
    );
  }
  if (!jobs.length) return;
  await Promise.all(jobs);
  const view = document.getElementById('view-share');
  if (view && view.classList.contains('active')) renderShareHub();
}

/**
 * Fill in the Share page: the exact message the friend will receive, the link,
 * and the cards for everything she has made.
 *
 * Re-run on language change so the preview and the cards match what would be
 * sent.
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

  renderShareHub();
  prefetchShareHub();
}

// ---- Discover feed (culture + news) ----------------------------------------
//
// Two channels over one shape of thing — a dated article. Culture posts are
// written by the operator; news posts are imported from public Hong Kong
// sources (see news.js) and always carry a link to the original, which the
// article view surfaces. The two share this markup deliberately: a helper
// should not have to learn a different layout for each tab.

/**
 * A post's text in the language being read, falling back to English.
 *
 * The same rule vocabulary meanings follow (see meaning()): a blank translation
 * shows the English rather than nothing, because an untranslated article is
 * still worth reading and an empty card is not.
 */
function postField(post, field) {
  if (!post) return '';
  const localised = post[`${field}_${currentLang()}`];
  if (localised != null && String(localised).trim()) return String(localised);
  return String(post[`${field}_en`] || '');
}

/** A readable date, in the reader's language where the device supports it. */
function postDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString(currentHtmlLang(), { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Post bodies are HTML (a small subset — see data.js). This strips everything
 * outside that subset before it reaches innerHTML, so a body pasted into the
 * admin form, or an href that arrived in a feed, cannot inject script.
 * Unknown tags are UNWRAPPED rather than deleted, so their text survives.
 */
const POST_TAGS = /^(P|H2|H3|UL|OL|LI|STRONG|EM|B|I|BR|A|BLOCKQUOTE)$/;

function sanitizePostHtml(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html || '');
  const clean = (node) => {
    [...node.children].forEach((el) => {
      if (!POST_TAGS.test(el.tagName)) {
        const parent = el.parentNode;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        return; // its children were just moved up, so nothing left to walk
      }
      [...el.attributes].forEach((attr) => {
        const isSafeHref = el.tagName === 'A' && attr.name === 'href' && /^(https?:\/\/|\/)/i.test(attr.value);
        if (!isSafeHref) el.removeAttribute(attr.name);
      });
      if (el.tagName === 'A') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
      clean(el);
    });
  };
  clean(tpl.content);
  return tpl.innerHTML;
}

/**
 * Switches the Discover tab.
 *
 * Resets the News topic filter and the pager on the way through. Leaving the
 * filter set would be defensible for a language switch and wrong for a tab
 * switch: coming back to News from Stories should show all of it, the same way
 * a fresh visit does.
 */
function showChannel(channel) {
  STATE.discover.channel = ['news', 'stories', 'living'].includes(channel) ? channel : 'culture';
  STATE.discover.category = null;
  STATE.discover.region = null;
  STATE.discover.shown = NEWS_PAGE_SIZE;
  renderDiscover();
}

/** Which topic the News channel is narrowed to, or null for all of it. */
const newsCategoryKey = () => (STATE.discover.channel === 'news' && STATE.discover.category ? STATE.discover.category : null);

/** Which source region the News channel is narrowed to, or null for all. */
const newsRegionKey = () => (STATE.discover.channel === 'news' && STATE.discover.region ? STATE.discover.region : null);

/**
 * The cache key for the list on screen. A filtered News view is a DIFFERENT
 * list, not a subset — sharing one cache entry would mean the "All news" tab
 * silently showed only the filtered slice after she had visited a topic or a
 * region. Both filters are part of the key.
 */
const postsCacheKey = () => {
  const cat = newsCategoryKey();
  const region = newsRegionKey();
  if (!cat && !region) return STATE.discover.channel;
  return `news:${cat || 'all'}:${region || 'all'}`;
};

/** Narrows the News channel to one topic. 'all' clears the filter. */
function showNewsCategory(cat) {
  const next = cat && cat !== 'all' && NEWS_CATEGORY_KEYS.includes(cat) ? cat : null;
  if (STATE.discover.category === next) return; // already showing this — no refetch
  STATE.discover.category = next;
  STATE.discover.shown = NEWS_PAGE_SIZE;
  renderDiscover();
}

/** Narrows the News channel to one source region. 'all' clears the filter. */
function showNewsRegion(src) {
  const next = src && src !== 'all' && NEWS_REGION_KEYS.includes(src) ? src : null;
  if (STATE.discover.region === next) return; // already showing this — no refetch
  STATE.discover.region = next;
  STATE.discover.shown = NEWS_PAGE_SIZE;
  renderDiscover();
}

/** Reveals one more page of the list already on screen. No network. */
function showMorePosts() {
  STATE.discover.shown += NEWS_PAGE_SIZE;
  renderDiscover();
}

/** One category chip. `on` marks the selected one for the browser too. */
function newsFilterChip(key, label, count, active) {
  const n = count == null ? '' : ` <span class="chip-count">${count}</span>`;
  return `<button type="button" class="chip news-filter-chip${active ? ' active' : ''}"
            aria-pressed="${active ? 'true' : 'false'}"
            onclick="showNewsCategory('${key}')">${escapeHtml(label)}${n}</button>`;
}

/**
 * The topic filter row, for the News channel only.
 *
 * Counts come from the server (/api/posts/categories) rather than from the
 * list on screen, so a chip can say "Work 12" while showing the first ten.
 * They are fetched once and cached in STATE: a filter row that grows and
 * shrinks as she scrolls would be a filter she cannot aim at.
 */
function renderNewsFilters() {
  const host = document.getElementById('discover-filters');
  if (!host) return;
  if (STATE.discover.channel !== 'news') {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }
  const counts = STATE.discover.counts;
  const rows = [];
  for (const c of NEWS_CATEGORY_ORDER) {
    rows.push(
      newsFilterChip(
        c.key,
        t(c.i18n),
        counts ? (c.key === 'all' ? counts.all : counts[c.key]) : null,
        c.key === 'all' ? !STATE.discover.category : STATE.discover.category === c.key
      )
    );
  }
  host.innerHTML =
    `<span class="discover-filters-label">${escapeHtml(t('discover.filterLabel'))}</span>` +
    `<div class="discover-filters-row">${rows.join('')}</div>`;
  host.hidden = false;
}

/** One region chip. Mirrors newsFilterChip but targets showNewsRegion. */
function newsRegionChip(key, label, count, active) {
  const n = count == null ? '' : ` <span class="chip-count">${count}</span>`;
  return `<button type="button" class="chip news-filter-chip${active ? ' active' : ''}"
            aria-pressed="${active ? 'true' : 'false'}"
            onclick="showNewsRegion('${key}')">${escapeHtml(label)}${n}</button>`;
}

/**
 * The region filter row (Hong Kong / Philippines / Indonesia), News channel
 * only. Counts ride on the same /api/posts/categories response under `regions`,
 * so a number can never disagree with the list a tap would show. `all` is the
 * channel total, which is the count of every published news item in the window.
 */
function renderNewsRegionFilters() {
  const host = document.getElementById('discover-region-filters');
  if (!host) return;
  if (STATE.discover.channel !== 'news') {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }
  const counts = STATE.discover.counts;
  const regions = counts && counts.regions;
  const rows = [];
  for (const r of NEWS_REGION_ORDER) {
    const count = regions
      ? (r.key === 'all' ? (counts.all || 0) : (regions[r.key] || 0))
      : null;
    rows.push(newsRegionChip(
      r.key,
      t(r.i18n),
      count,
      r.key === 'all' ? !STATE.discover.region : STATE.discover.region === r.key
    ));
  }
  host.innerHTML =
    `<span class="discover-filters-label">${escapeHtml(t('discover.regionLabel'))}</span>` +
    `<div class="discover-filters-row">${rows.join('')}</div>`;
  host.hidden = false;
}

/** Loads the per-topic counts once, then draws the chips. */
async function loadNewsFilters() {
  if (STATE.discover.counts) return;
  try {
    STATE.discover.counts = await apiGet('/api/posts/categories');
  } catch (err) {
    // Counts are decoration: the channel still works without them, so a failed
    // tally must not stop her reading. The chips render with no numbers.
    STATE.discover.counts = null;
    return;
  }
  renderNewsFilters();
  renderNewsRegionFilters();
}

/**
 * The pager: "Show more (23)" while there is more, and a quiet full stop when
 * there is not. Both halves matter — a button that does nothing when the list
 * is exhausted teaches her that buttons here are decorative.
 */
function renderPostPager(host, posts) {
  const shown = Math.min(STATE.discover.shown, posts.length);
  const hidden = posts.length - shown;
  host.hidden = false;
  if (hidden <= 0) {
    // Only says something when the list was actually long enough to have been
    // worth paging; a three-item channel does not need to be told it is done.
    host.innerHTML = posts.length > NEWS_PAGE_SIZE
      ? `<p class="discover-pager-note">${escapeHtml(t('discover.allShown'))}</p>`
      : '';
    host.hidden = !host.innerHTML;
    return;
  }
  host.innerHTML = `<button type="button" class="btn btn-outline btn-block" onclick="showMorePosts()">
      ${escapeHtml(t('discover.showMore').replace('%s', String(hidden)))}
    </button>`;
}

/* ---------------------------------------------------------------------------
   WHAT SHE HAS ALREADY OPENED.

   Read state lives in localStorage, on the device, and never leaves it. That is
   not a shortcut around a missing server feature — it is the correct place for
   this data. A helper has no account (see the note at the top of this file), and
   this is browsing history: the one category of record that would be most
   damaging in an employer's hands. Nothing about "has she read the news" needs
   to reach a server to be useful to her.

   The list holds `post:<slug>` and `story:<slug>` keys, oldest first, capped at
   READ_CAP. The cap is not tidiness. localStorage is a shared, small, quota-
   limited bucket, and a news feed that adds twenty keys a day would eventually
   make setItem throw in the middle of a write — which is the kind of failure
   that takes out a neighbouring feature rather than the one that caused it.

   Every read is wrapped: private browsing refuses localStorage outright, and a
   refused write must cost her the tick on a card, not the page she asked for.
   --------------------------------------------------------------------------- */
const READ_KEY = 'cb_read';
const READ_CAP = 400;

function readKeys() {
  try {
    const raw = JSON.parse(localStorage.getItem(READ_KEY) || '[]');
    // Not trusted: the key is in the same bucket as everything else on the
    // origin, and a value of the wrong shape here must not throw on every card.
    return Array.isArray(raw) ? raw.filter((k) => typeof k === 'string') : [];
  } catch { return []; }
}

function isRead(key) {
  return readKeys().indexOf(key) !== -1;
}

function markRead(key) {
  const list = readKeys();
  const at = list.indexOf(key);
  if (at !== -1) list.splice(at, 1); // re-opening moves it to the recent end
  list.push(key);
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(list.slice(-READ_CAP)));
  } catch { /* private mode — the tick simply never appears */ }
}

/** The tick that says "you have opened this". Empty when she has not. */
function readChipHtml(key) {
  if (!isRead(key)) return '';
  return ` · <span class="read-chip"><span aria-hidden="true">✓</span> ${escapeHtml(t('discover.read'))}</span>`;
}

/** One feed card. A button, not a link: it opens the article in the app. */
function postCardHtml(post) {
  const date = postDate(post.published_at || post.created_at);
  const source = post.source_name ? ` · ${escapeHtml(post.source_name)}` : '';
  const summary = postField(post, 'summary');
  const read = isRead(`post:${post.slug}`);
  return `
    <button class="post-card${read ? ' is-read' : ''}" onclick="openPost('${escapeHtml(post.slug)}')">
      <span class="post-card-icon">${escapeHtml(post.icon || '📰')}</span>
      <span class="post-card-main">
        <span class="post-card-meta">${escapeHtml(date)}${source}${readChipHtml(`post:${post.slug}`)}</span>
        <span class="post-card-title">${escapeHtml(postField(post, 'title'))}</span>
        ${summary ? `<span class="post-card-summary">${escapeHtml(summary)}</span>` : ''}
      </span>
      <span class="post-card-arrow" aria-hidden="true">›</span>
    </button>`;
}

/**
 * One story card.
 *
 * The byline is the interesting part: an unsigned story carries an EMPTY
 * display_name from the server, because the name was never stored. The label
 * is therefore added here, at render time, and never sent back — which is why
 * the API shape and the card can disagree without either being wrong.
 */
function storyCardHtml(story) {
  const date = postDate(story.published_at);
  const byline = String(story.display_name || '').trim() || t('story.anonymous');
  const meta = [date, byline].filter(Boolean).join(' · ');
  const read = isRead(`story:${story.slug}`);
  return `
    <button class="post-card story-card${read ? ' is-read' : ''}" onclick="openStory('${escapeHtml(story.slug)}')">
      <span class="post-card-icon">📖</span>
      <span class="post-card-main">
        <span class="post-card-meta">${escapeHtml(meta)}${readChipHtml(`story:${story.slug}`)}</span>
        <span class="post-card-title">${escapeHtml(story.title)}</span>
        ${story.gloss_en ? `<span class="post-card-summary">${escapeHtml(story.gloss_en)}</span>` : ''}
      </span>
      <span class="post-card-arrow" aria-hidden="true">›</span>
    </button>`;
}

async function renderDiscover() {
  const feed = document.getElementById('discover-feed');
  if (!feed) return;
  const channel = STATE.discover.channel;
  const pager = document.getElementById('discover-pager');

  document.querySelectorAll('.discover-tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.channel === channel);
  });
  const note = document.getElementById('discover-note');
  if (note) {
    note.textContent = t(
      channel === 'news' ? 'discover.newsLead'
        : channel === 'living' ? 'discover.livingLead'
          : channel === 'stories' ? 'discover.storiesLead'
            : 'discover.cultureLead'
    );
  }
  // The "share your story" button belongs to one channel only. It is a
  // destination of its own (its own view), so it is a real button rather than
  // something the feed renderer draws.
  const cta = document.getElementById('story-write-cta');
  if (cta) cta.hidden = channel !== 'stories';
  if (pager) { pager.hidden = true; pager.innerHTML = ''; }

  renderNewsFilters();
  renderNewsRegionFilters();
  if (channel === 'news') loadNewsFilters();

  if (channel === 'living') return renderLivingList(feed);
  if (channel === 'stories') return renderStoryList(feed);

  // Serve the cache when we have it, so a tab switch is instant and a language
  // switch does not hit the network again. The key carries the topic filter,
  // so "All news" and "Work" are two separate lists, never one shared one.
  const key = postsCacheKey();
  let posts = STATE.discover.posts[key];
  if (!posts) {
    feed.innerHTML = `<div class="discover-loading">…</div>`;
    try {
      const cat = newsCategoryKey();
      const region = newsRegionKey();
      const q = new URLSearchParams({ channel });
      if (cat) q.set('category', cat);
      if (region) q.set('source', region);
      posts = await apiGet(`/api/posts?${q.toString()}`);
      STATE.discover.posts[key] = posts;
    } catch (err) {
      console.warn('Could not load the feed:', err);
      feed.innerHTML = `<p class="discover-empty">${escapeHtml(t('discover.loadFailed'))}</p>`;
      return;
    }
  }

  // The learner may have switched tabs, topics or regions while this was in
  // flight; drawing the old list now would overwrite the new one. Recomputing
  // the cache key from current state catches every one of those at once.
  if (STATE.discover.channel !== channel || postsCacheKey() !== key) return;

  feed.innerHTML = posts.length
    ? posts.slice(0, Math.max(STATE.discover.shown, 0)).map(postCardHtml).join('')
    : `<p class="discover-empty">${escapeHtml(t('discover.empty'))}</p>`;

  if (pager) renderPostPager(pager, posts);
}

/** The Stories channel: the shelf of published stories, newest first. */
async function renderStoryList(feed) {
  const host = feed || document.getElementById('discover-feed');
  if (!host) return;

  let stories = STATE.stories.list;
  if (!stories) {
    host.innerHTML = `<div class="discover-loading">…</div>`;
    try {
      stories = await apiGet('/api/stories');
      STATE.stories.list = stories;
    } catch (err) {
      console.warn('Could not load the stories:', err);
      host.innerHTML = `<p class="discover-empty">${escapeHtml(t('discover.storiesLoadFailed'))}</p>`;
      return;
    }
  }

  // She may have switched channel while this was in flight.
  if (STATE.discover.channel !== 'stories') return;

  host.innerHTML = stories.length
    ? stories.map(storyCardHtml).join('')
    : `<p class="discover-empty">${escapeHtml(t('discover.storiesEmpty'))}</p>`;
}

/** Opens one story by slug. */
async function openStory(slug) {
  const host = document.getElementById('story-body');
  if (!host || !slug) return;
  navigate('story');
  host.innerHTML = `<div class="discover-loading">…</div>`;
  try {
    const story = await apiGet(`/api/stories/${encodeURIComponent(slug)}`);
    STATE.stories.current = story;
    renderStoryPage(story);
    markRead(`story:${slug}`);
  } catch (err) {
    console.warn('Could not load the story:', err);
    host.innerHTML = `<p class="discover-empty">${escapeHtml(t('story.notFound'))}</p>`;
  }
}

/** The story body is plain text — paragraph breaks are the only structure. */
function storyParagraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Draws the open story. Also re-run on a language switch. */
function renderStoryPage(story) {
  const host = document.getElementById('story-body');
  if (!host || !story) return;

  const date = postDate(story.published_at);
  const byline = String(story.display_name || '').trim() || t('story.anonymous');
  const meta = [byline, date].filter(Boolean).join(' · ');
  // The language she wrote in, named in the reader's own language. The server
  // sends the code; the name is the client's job because it is a UI string.
  const langNames = {
    en: { en: 'English', fil: 'Filipino', zh: 'Chinese', id: 'Indonesian' },
    fil: { en: 'Ingles', fil: 'Filipino', zh: 'Chinese', id: 'Indonesian' },
    zh: { en: '英文', fil: '菲律宾语', zh: '中文', id: '印尼语' },
    id: { en: 'Inggris', fil: 'Filipino', zh: 'Tionghoa', id: 'Indonesia' },
  };
  const names = langNames[currentLang()] || langNames.en;
  const writtenIn = `${t('story.writtenIn')}: ${names[story.lang] || story.lang}`;

  const gloss = story.gloss_en
    ? `<div class="story-gloss">
         <h2>${escapeHtml(t('story.glossTitle'))}</h2>
         ${storyParagraphs(story.gloss_en)}
       </div>`
    : '';

  host.innerHTML = `
    <div class="post-hero">
      <div class="post-hero-icon">📖</div>
      <h1 class="post-title">${escapeHtml(story.title)}</h1>
      <div class="post-date">${escapeHtml(meta)}</div>
      <div class="post-date">${escapeHtml(writtenIn)}</div>
    </div>
    <div class="post-content">${storyParagraphs(story.body)}</div>
    ${gloss}
    ${shareRowHtml([
      { label: t('share.chatBtn'), icon: WHATSAPP_ICON_SVG, onclick: `shareStory('${story.slug}', 'chat')`, variant: 'wa' },
      { label: t('share.pictureBtn'), icon: '🖼️', onclick: `shareStory('${story.slug}')` },
    ])}
    <p class="story-back"><button class="btn-link" onclick="navigate('discover')">${escapeHtml(t('story.backToStories'))}</button></p>`;
}

// ---- Living: supportive passages about life in Hong Kong --------------------
//
// Editorial passages (seeded, not user-submitted) grouped by situation — sick,
// homesick, short of money, lonely on a rest day. The reader browses by category
// and opens a passage; on the passage page she can react (Facebook-style, one
// reaction per device), comment, and share. Bodies are plain text in four
// languages and never HTML.

/** Pick the per-language field of a living passage, falling back to English. */
function livingField(post, field) {
  const v = post[`${field}_${currentLang()}`];
  return v && String(v).trim() ? v : (post[`${field}_en`] || '');
}

const LIVING_REACTIONS = [
  { emoji: '👍', key: 'like',  labelKey: 'living.reactionLike' },
  { emoji: '❤️', key: 'love',  labelKey: 'living.reactionLove' },
  { emoji: '🤗', key: 'care',  labelKey: 'living.reactionCare' },
  { emoji: '😂', key: 'haha',  labelKey: 'living.reactionHaha' },
  { emoji: '😮', key: 'wow',   labelKey: 'living.reactionWow' },
  { emoji: '😢', key: 'sad',   labelKey: 'living.reactionSad' },
  { emoji: '😠', key: 'angry', labelKey: 'living.reactionAngry' },
];

const LIVING_CAT_ICON = {
  medical: '🩺', holiday: '✈️', entertainment: '🎉', homesick: '💔',
  food: '🍚', transport: '🚇', churches: '⛪',
};
const LIVING_CAT_ORDER = ['medical', 'holiday', 'entertainment', 'homesick', 'food', 'transport', 'churches'];

function livingCatIcon(cat) { return LIVING_CAT_ICON[cat] || '🏠'; }
function livingCatLabel(cat) { return t('living.cat' + cat.charAt(0).toUpperCase() + cat.slice(1)); }

/** One card on the Living shelf: title, excerpt, and a Facebook-style footer. */
function livingCardHtml(post) {
  const title = livingField(post, 'title');
  const sub = livingField(post, 'sub');
  const body = livingField(post, 'body');
  const excerpt = (body.split(/\n{2,}/)[0] || '').trim();
  const reacts = Number(post.reaction_count) || 0;
  const comments = Number(post.comment_count) || 0;
  return `
    <button class="post-card living-card" onclick="openLiving('${escapeHtml(post.slug)}')">
      <span class="post-card-icon">${escapeHtml(post.icon || '🏠')}</span>
      <span class="post-card-main">
        <span class="post-card-cat">${escapeHtml(livingCatLabel(post.category))} · ${escapeHtml(sub)}</span>
        <span class="post-card-title">${escapeHtml(title)}</span>
        <span class="post-card-summary">${escapeHtml(excerpt)}</span>
        <span class="living-card-footer">
          <span class="living-card-stat">${reacts ? '👍 ' + reacts : '👍'}</span>
          <span class="living-card-stat">💬 ${comments}</span>
          <span class="living-card-stat">↗</span>
        </span>
      </span>
      <span class="post-card-arrow" aria-hidden="true">›</span>
    </button>`;
}

/** The Living channel: passages grouped by category, newest first within each. */
async function renderLivingList(feed) {
  const host = feed || document.getElementById('discover-feed');
  if (!host) return;

  // Cached so a tab switch is instant and a language switch does not refetch.
  let posts = STATE.living.list;
  if (!posts) {
    host.innerHTML = `<div class="discover-loading">…</div>`;
    try {
      const data = await apiGet('/api/living');
      posts = data.posts;
      STATE.living.list = posts;
    } catch (err) {
      console.warn('Could not load Living:', err);
      host.innerHTML = `<p class="discover-empty">${escapeHtml(t('discover.livingLoadFailed'))}</p>`;
      return;
    }
  }
  if (STATE.discover.channel !== 'living') return; // she switched away mid-flight

  const byCat = {};
  for (const p of posts) (byCat[p.category] = byCat[p.category] || []).push(p);
  const cats = LIVING_CAT_ORDER.filter((c) => byCat[c] && byCat[c].length);

  if (!cats.length) {
    host.innerHTML = `<p class="discover-empty">${escapeHtml(t('discover.livingEmpty'))}</p>`;
    return;
  }

  host.innerHTML = cats.map((c) => `
    <section class="living-group">
      <h3 class="living-group-title"><span class="living-group-icon">${livingCatIcon(c)}</span>${escapeHtml(livingCatLabel(c))}</h3>
      <div class="living-group-list">${byCat[c].map(livingCardHtml).join('')}</div>
    </section>`).join('');
}

/** Opens one passage by slug, fetching its reactions and comments. */
async function openLiving(slug) {
  const host = document.getElementById('living-body');
  if (!host || !slug) return;
  navigate('living');
  host.innerHTML = `<div class="discover-loading">…</div>`;
  try {
    const data = await apiGet(`/api/living/${encodeURIComponent(slug)}?public_id=${encodeURIComponent(STATE.deviceId)}`);
    STATE.living.current = data.post;
    STATE.living.reactions = data.reactions || {};
    STATE.living.myReaction = data.myReaction || null;
    STATE.living.comments = data.comments || [];
    renderLivingPage(data.post);
    markRead(`living:${slug}`);
  } catch (err) {
    console.warn('Could not load the passage:', err);
    host.innerHTML = `<p class="discover-empty">${escapeHtml(t('story.notFound'))}</p>`;
  }
}

/** Draws the open passage: body, reaction bar, comments, share. */
function renderLivingPage(post) {
  const host = document.getElementById('living-body');
  if (!host || !post) return;
  const title = livingField(post, 'title');
  const sub = livingField(post, 'sub');
  const body = livingField(post, 'body');
  const paragraphs = String(body || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  host.innerHTML = `
    <div class="post-hero">
      <div class="post-hero-icon">${escapeHtml(post.icon || '🏠')}</div>
      <h1 class="post-title">${escapeHtml(title)}</h1>
      <div class="post-date">${escapeHtml(livingCatLabel(post.category))} · ${escapeHtml(sub)}</div>
    </div>
    <div class="post-content">${paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')}</div>

    <div class="living-reactions" id="living-reactions"></div>

    <div class="living-comments">
      <h2 class="living-comments-title">${escapeHtml(t('living.commentsTitle'))}</h2>
      <div class="living-comments-list" id="living-comments-list"></div>
      <form class="living-comment-form" id="living-comment-form" onsubmit="return submitLivingComment(event)">
        <input type="text" class="living-comment-name-input" id="living-comment-name" maxlength="80"
               placeholder="${escapeHtml(t('living.commentNamePlaceholder'))}" aria-label="${escapeHtml(t('living.commentNameLabel'))}">
        <textarea class="living-comment-input" id="living-comment-input" maxlength="500" required
                  placeholder="${escapeHtml(t('living.commentPlaceholder'))}"></textarea>
        <button type="submit" class="btn btn-primary living-comment-submit">${escapeHtml(t('living.commentPost'))}</button>
      </form>
    </div>

    ${shareRowHtml([
      { label: t('share.chatBtn'), icon: WHATSAPP_ICON_SVG, onclick: `shareLiving('${post.slug}', 'chat')`, variant: 'wa' },
      { label: t('share.pictureBtn'), icon: '🖼️', onclick: `shareLiving('${post.slug}')` },
    ])}
    <p class="story-back"><button class="btn-link" onclick="navigate('discover'); showChannel('living')">${escapeHtml(t('living.back'))}</button></p>`;

  renderLivingReactions();
  renderLivingComments();
}

/** The reaction bar: a summary (tap to open the picker) plus the Facebook set. */
function renderLivingReactions() {
  const host = document.getElementById('living-reactions');
  if (!host) return;
  const reactions = STATE.living.reactions || {};
  const my = STATE.living.myReaction;
  const count = Object.values(reactions).reduce((a, b) => a + b, 0);

  const chips = LIVING_REACTIONS
    .filter((r) => (reactions[r.key] || 0) > 0 || r.key === my)
    .map((r) => {
      const n = reactions[r.key] || 0;
      const active = r.key === my ? ' is-active' : '';
      return `<button class="living-react-chip${active}" title="${escapeHtml(t(r.labelKey))}" onclick="reactLiving('${STATE.living.current.slug}', '${r.key}')">
        <span class="living-react-emoji">${r.emoji}</span>${n ? `<span class="living-react-count">${n}</span>` : ''}
      </button>`;
    }).join('');

  host.innerHTML = `
    <div class="living-react-summary" onclick="toggleLivingPicker()" role="button" tabindex="0">
      ${count ? `<span class="living-react-total">${count}</span>` : ''}
      <span class="living-react-chips">${chips || `<span class="living-react-hint">${escapeHtml(t('living.reactTitle'))}</span>`}</span>
    </div>
    <div class="living-react-picker" id="living-react-picker" hidden>
      ${LIVING_REACTIONS.map((r) => `
        <button class="living-react-pick" title="${escapeHtml(t(r.labelKey))}" onclick="reactLiving('${STATE.living.current.slug}', '${r.key}')">${r.emoji}</button>
      `).join('')}
    </div>`;
}

/** Show/hide the reaction picker. */
function toggleLivingPicker() {
  const p = document.getElementById('living-react-picker');
  if (p) p.hidden = !p.hidden;
}

/** Send (or toggle) a reaction, then repaint the bar from the server's state. */
async function reactLiving(slug, emoji) {
  try {
    const res = await apiPost(`/api/living/${encodeURIComponent(slug)}/react`, { public_id: STATE.deviceId, emoji });
    STATE.living.reactions = res.reactions || {};
    STATE.living.myReaction = res.myReaction || null;
    renderLivingReactions();
  } catch (err) {
    console.warn('Could not react:', err);
    showToast(t('share.failed'));
  }
}

/** Draw the comment thread. */
function renderLivingComments() {
  const host = document.getElementById('living-comments-list');
  if (!host) return;
  const comments = STATE.living.comments || [];
  if (!comments.length) {
    host.innerHTML = `<p class="living-comments-empty">${escapeHtml(t('living.commentEmpty'))}</p>`;
    return;
  }
  host.innerHTML = comments.map((c) => {
    const name = String(c.display_name || '').trim() || t('story.anonymous');
    return `<div class="living-comment">
      <div class="living-comment-head"><span class="living-comment-name">${escapeHtml(name)}</span><span class="living-comment-date">${escapeHtml(postDate(c.created_at))}</span></div>
      <div class="living-comment-body">${escapeHtml(c.body)}</div>
    </div>`;
  }).join('');
}

/** Post a comment; on success, append it to the thread in place. */
async function submitLivingComment(event) {
  event.preventDefault();
  const slug = STATE.living.current && STATE.living.current.slug;
  const input = document.getElementById('living-comment-input');
  const nameInput = document.getElementById('living-comment-name');
  if (!slug || !input) return false;
  const body = input.value.trim();
  if (!body) return false;
  const name = nameInput ? nameInput.value.trim() : '';
  const btn = document.querySelector('#living-comment-form .living-comment-submit');
  if (btn) { btn.disabled = true; btn.textContent = t('living.commentPosting'); }
  try {
    const res = await apiPost(`/api/living/${encodeURIComponent(slug)}/comment`, {
      public_id: STATE.deviceId, display_name: name, body,
    });
    if (res.comment) {
      STATE.living.comments = STATE.living.comments || [];
      STATE.living.comments.push(res.comment);
      input.value = '';
      if (nameInput) nameInput.value = '';
      renderLivingComments();
    }
  } catch (err) {
    console.warn('Could not post comment:', err);
    showToast(t('share.failed'));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = t('living.commentPost'); }
  }
  return false;
}

/** A shareable card for a passage. */
function livingSpec(post) {
  const k = cardTokens();
  return {
    accent: k.secondary,
    tint: '#e6f5f3',
    eyebrow: t('living.back'),
    blocks: [
      { type: 'emoji', value: post.icon || '🏠', size: 140, y: 300 },
      { type: 'wrap', value: livingField(post, 'title'), size: 56, y: 470, maxLines: 3, lineHeight: 72 },
      { type: 'text', value: livingCatLabel(post.category), weight: 500, size: 42, color: k.soft, y: 790 },
    ],
  };
}

/** Share a passage — straight to WhatsApp, or as a picture. */
async function shareLiving(slug, mode) {
  const post = (STATE.living.current && STATE.living.current.slug === slug)
    ? STATE.living.current
    : (STATE.living.list || []).find((p) => p.slug === slug);
  if (!post) return;
  const text = t('share.livingText').replace('{title}', livingField(post, 'title'));
  const url = shareUrl(`/living/${slug}`);
  if (mode === 'chat') return shareToWhatsApp(text, url);
  await sharePicture({ spec: livingSpec(post), text, url, filename: `cantobuddy-living-${slug}.png` });
}

/** If the app was opened from a shared /living/<slug> link, open that passage. */
function openLivingFromUrl() {
  const m = location.pathname.match(/^\/living\/([^/]+)/);
  if (!m) return;
  setTimeout(() => openLiving(m[1]), 300);
}

// ---- Writing a story -------------------------------------------------------

/** Shows or hides the name field with the checkbox that decides whether we keep it. */
function syncStorySign() {
  const box = document.getElementById('story-sign');
  const row = document.getElementById('story-name-row');
  if (!box || !row) return;
  row.hidden = !box.checked;
  if (box.checked) {
    const input = document.getElementById('story-name');
    // Pre-fill from the name she already gave the app, if any — she is only
    // being asked to confirm it, not to type it twice.
    if (input && !input.value && STATE.learner) input.value = STATE.learner;
    if (input) input.focus();
  }
}

function showStoryError(message) {
  const box = document.getElementById('story-error');
  if (!box) return;
  if (!message) { box.hidden = true; box.textContent = ''; return; }
  box.hidden = false;
  box.textContent = message;
}

async function submitStory(event) {
  if (event && event.preventDefault) event.preventDefault();
  const title = document.getElementById('story-title');
  const body = document.getElementById('story-body');
  const topic = document.getElementById('story-topic');
  const lang = document.getElementById('story-lang');
  const sign = document.getElementById('story-sign');
  const name = document.getElementById('story-name');
  const btn = document.getElementById('story-submit');

  if (!title || !body) return;
  // Check the two things the server will check, so she is told before a round
  // trip rather than after one.
  if (!title.value.trim()) return showStoryError(t('story.needTitle'));
  if (!body.value.trim()) return showStoryError(t('story.needBody'));
  showStoryError('');

  if (btn) { btn.disabled = true; btn.textContent = t('story.submitting'); }
  try {
    await apiPost('/api/stories', {
      public_id: STATE.deviceId,
      title: title.value,
      body: body.value,
      topic: topic ? topic.value : 'daily',
      // ASKED, not inferred. See the note on the select in index.html: assuming
      // this from the reading language mislabelled a story written in Filipino
      // by someone using the app in English, and the label is the point.
      lang: lang ? lang.value : currentLang(),
      // The privacy decision, exactly as she left it. Default false.
      sign: !!(sign && sign.checked),
      display_name: name ? name.value : '',
    });
  } catch (err) {
    console.warn('Could not send the story:', err);
    if (btn) { btn.disabled = false; btn.textContent = t('story.submit'); }
    // A throttled submission is not a failure she should retry blindly.
    showStoryError(err && err.status === 429 ? t('story.quotaFull') : t('story.sendFailed'));
    return;
  }

  // Clear the form and say what happens next. The response said "pending", so
  // the confirmation must not say "published" — nothing is live until a human
  // has read it.
  title.value = '';
  body.value = '';
  if (sign) sign.checked = false;
  if (name) name.value = '';
  syncStorySign();
  // The next story is a new decision, so the language goes back to her reading
  // language rather than keeping the last story's answer.
  STATE.stories.langPicked = false;
  defaultStoryLang();
  if (btn) { btn.disabled = false; btn.textContent = t('story.submit'); }

  const sent = document.getElementById('story-sent');
  if (sent) {
    sent.hidden = false;
    sent.innerHTML = `
      <h3>${escapeHtml(t('story.sentTitle'))}</h3>
      <p>${escapeHtml(t('story.sentBody'))}</p>`;
  }
  // Her own list is now stale by exactly one submission.
  STATE.stories.mine = null;
  STATE.stories.list = null;
  renderStoryMine();
  window.scrollTo(0, 0);
}

/** Her own submissions, so she can see what happened to each one. */
async function renderStoryMine() {
  const host = document.getElementById('story-mine');
  if (!host) return;

  let data = STATE.stories.mine;
  if (!data) {
    host.innerHTML = `<div class="discover-loading">…</div>`;
    try {
      data = await apiGet(`/api/stories/mine?public_id=${encodeURIComponent(STATE.deviceId)}`);
      STATE.stories.mine = data;
    } catch (err) {
      console.warn('Could not load your stories:', err);
      host.innerHTML = '';
      return;
    }
  }

  const rows = (data.stories || []);
  if (!rows.length) {
    host.innerHTML = `
      <h3 class="story-mine-title">${escapeHtml(t('story.mineTitle'))}</h3>
      <p class="discover-empty">${escapeHtml(t('story.mineEmpty'))}</p>`;
    return;
  }

  const statusLabel = {
    pending: t('story.statusPending'),
    published: t('story.statusPublished'),
    rejected: t('story.statusRejected'),
  };

  host.innerHTML = `
    <h3 class="story-mine-title">${escapeHtml(t('story.mineTitle'))}</h3>
    ${rows.map((s) => `
      <div class="story-mine-row">
        <div class="story-mine-head">
          <span class="story-mine-name">${escapeHtml(s.title)}</span>
          <span class="story-status story-status-${escapeHtml(s.status)}">${escapeHtml(statusLabel[s.status] || s.status)}</span>
        </div>
        ${s.reviewer_note ? `<p class="story-mine-note"><strong>${escapeHtml(t('story.reviewerNote'))}:</strong> ${escapeHtml(s.reviewer_note)}</p>` : ''}
      </div>`).join('')}`;
}


/** Opens one article by slug. */
async function openPost(slug) {
  const host = document.getElementById('post-body');
  if (!host || !slug) return;
  navigate('post');
  host.innerHTML = `<div class="discover-loading">…</div>`;
  try {
    const post = await apiGet(`/api/posts/${encodeURIComponent(slug)}`);
    STATE.discover.current = post;
    renderPost(post);
    // Marked AFTER the article rendered, not when the card was tapped: a tap
    // that failed to load is not something she has read.
    markRead(`post:${slug}`);
  } catch (err) {
    console.warn('Could not load the article:', err);
    host.innerHTML = `<p class="discover-empty">${escapeHtml(t('discover.notFound'))}</p>`;
  }
}

/** Draws the open article. Also re-run on a language switch. */
function renderPost(post) {
  const host = document.getElementById('post-body');
  if (!host || !post) return;
  const date = postDate(post.published_at || post.created_at);
  const summary = postField(post, 'summary');
  const body = sanitizePostHtml(postField(post, 'body'));

  // Imported news carries attribution and a link. Culture posts have neither,
  // so the block simply does not render for them — no empty "Source:" line.
  const source = post.source_url
    ? `<div class="post-source">
         <p class="post-source-line">${escapeHtml(t('discover.source'))}:
           <strong>${escapeHtml(post.source_name || post.source_url)}</strong></p>
         <a class="btn btn-primary btn-block" href="${escapeHtml(post.source_url)}"
            target="_blank" rel="noopener noreferrer">${escapeHtml(t('discover.readOriginal'))}</a>
         <p class="post-news-note">${escapeHtml(t('discover.newsNote'))}</p>
       </div>`
    : '';

  // The share strip appears on EVERY post, in both channels. It used to be
  // culture-only, on the reasoning that a news item is somebody else's
  // journalism and should be shared as a link rather than a card. The operator
  // asked for it on news too, and the numbers agree with her: the row is three
  // icons either way, and the card it builds is drawn from the title and
  // summary that a news row already has. POST_CHANNELS is ['culture', 'news']
  // — see db.js — so "every post" and "both channels" are the same statement
  // here, which is why there is no channel test left in this function at all.
  //
  // The layout is the same on a post of either channel: the strip in the
  // hero's top-right corner, and again at the foot of the article. Ask for it
  // twice on purpose — a reader who reaches the end of a piece has just
  // decided it was worth reading, which is the moment she is most likely to
  // pass it on.
  host.innerHTML = `
    <div class="post-hero">
      <div class="post-hero-top">
        <div class="post-hero-icon">${escapeHtml(post.icon || '🏮')}</div>
        <div class="post-hero-share">${socialRowHtml(post)}</div>
      </div>
      <h1 class="post-title">${escapeHtml(postField(post, 'title'))}</h1>
      ${date ? `<div class="post-date">${escapeHtml(date)}</div>` : ''}
    </div>
    ${summary ? `<p class="post-summary">${escapeHtml(summary)}</p>` : ''}
    <div class="post-content">${body}</div>
    ${source}
    ${socialRowHtml(post)}`;
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
  // Her answer now stands, so the header button has nothing left to offer.
  syncInstallEntry();
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

/**
 * Show or hide the header's "Add to home screen" button.
 *
 * The button exists so the offer is not tied to finishing a quiz. But it must
 * only appear when it would actually DO something, or it teaches her that
 * tapping CantoBuddy buttons does nothing:
 *
 *   - already installed        → nothing to offer, hide it.
 *   - already answered         → she said "not now"; a button that ignores that
 *                                is a nag. Her answer is final (until she
 *                                clears site data), and the quiz-end offer
 *                                respects the same flag.
 *   - iOS / in-app browser     → there is no one-tap install. The button WOULD
 *                                still work (it opens the step-by-step dialog),
 *                                so it is shown: on iOS it is the only way in,
 *                                and "Add to Home Screen" is worth the steps.
 *   - Android before the event → hidden until `beforeinstallprompt` arrives, so
 *                                we never show a button whose tap cannot
 *                                install anything.
 *
 * Called on boot, on language change (it is a data-i18n element), and from the
 * beforeinstallprompt handler the moment Chrome is ready to install.
 */
function syncInstallEntry() {
  const btn = document.getElementById('install-btn');
  if (!btn) return;

  if (isInstalled() || installAnswered()) {
    btn.hidden = true;
    return;
  }
  // iOS has no install API, so `deferredInstall` never fills — but the dialog
  // still gives real, correct steps. Offer it.
  const canDoSomething = isIOS() || Boolean(deferredInstall);
  btn.hidden = !canDoSomething;
}


// Chrome's own mini-infobar is suppressed: we would rather ask in her language,
// at a moment we choose, than have the browser ask on its own schedule.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  // Chrome is now ready to install, which is the moment the header entry point
  // becomes truthful — before this event there is nothing for it to do.
  syncInstallEntry();
});

window.addEventListener('appinstalled', () => {
  markInstallAnswered('installed');
  deferredInstall = null;
  document.getElementById('install-modal').classList.remove('show');
  syncInstallEntry();
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
