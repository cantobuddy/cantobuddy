/**
 * CantoBuddy — SEO layer.
 *
 * WHY THIS EXISTS
 * ---------------
 * The learner app is a single-page app. Everything a learner reads — every
 * Cantonese word, its Jyutping, its English and Filipino meaning — arrives at
 * runtime from /api/vocabulary, and every view is rendered by app.js into one
 * URL (`/`). A crawler that fetches / therefore gets the hero headline and
 * nothing else, and /api/ is Disallow-ed in robots.txt, so the content that
 * does exist is unreachable too. Net result: one thin indexable page for a
 * site whose whole value is 64 words and 11 categories.
 *
 * This module fixes that without touching the SPA. It server-renders the same
 * content the app already holds in SQLite as plain, crawlable HTML:
 *
 *   /learn              hub — every category and level
 *   /learn/:slug        one category, all of its words
 *   /words/:slug        one word, with meaning + related words
 *   /level/:level       one level (beginner / intermediate / advanced)
 *
 * and a Filipino-language mirror under /fil/... for the Tagalog-speaking
 * audience the app is built for, cross-linked with hreflang.
 *
 * The SPA is untouched: / still serves public/index.html, and every rendered
 * page carries a prominent link back into the app. These pages are additive.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const store = require('./db');
const { GUIDES, GUIDE_BY_SLUG, UPDATED } = require('./content');
const enStore = require('./en');
const dailyPhrase = require('./daily-phrase');
// The practical channels (survival / household / health / festivals). Shared
// with server.js and the app so adding one is a single-file edit.
const { PRACTICAL_CHANNELS, practicalText, practicalSection } = require('./practical-channels');
// The long-form editorial shelf behind /articles. Only the slugs and metadata
// are read here; titles and summaries come from the live store so an operator's
// edit in the admin is reflected on the index without a code change.
const LONGFORM_GUIDES = require('./longform-guides');
const todayInHk = require('./today-in-hk');

/* ---------------------------------------------------------------------------
   Outings (/places) — ONE data source, two runtimes
   ---------------------------------------------------------------------------
   The 17 days out are authored in public/places.js, translated in
   public/i18n.js and attributed in public/places/credits.js. Before this
   change they existed ONLY in the browser: a crawler fetching /discover saw
   an empty <div>, so 17 real, photographed guides were invisible to search.

   Re-typing all of that into a second server-side list would guarantee drift
   the first time an outing is added. Instead:

     places.js       already has a guarded CommonJS export (like server.js uses
                     for /api/home/featured), so it is require()-ed directly.
     i18n.js         is a classic browser <script> whose only top-level DOM
                     access is localStorage.getItem(), so it is evaluated in a
                     throwaway vm context with a stub and I18N is lifted out.
     credits.js      is GENERATED ("do not edit by hand") and its whole body is
                     `window.PLACE_CREDITS = {...}`, so the same vm approach
                     lifts the object without editing the generator's output.

   The vm sandbox has no require, no process and no filesystem: these files are
   plain data-plus-functions, not code we execute beyond the initialisation
   statements. If one of them ever grows a real top-level DOM call, the server
   fails loudly at boot instead of silently rendering an empty page.
   --------------------------------------------------------------------------- */
function browserValue(relPath, expression) {
  const src = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
  const box = {
    console,
    window: {},
    localStorage: { getItem: () => null, setItem: () => {} },
  };
  vm.runInNewContext(`${src}\n;globalThis.__CB_VALUE__ = (${expression});`, box, {
    filename: relPath,
    timeout: 2000,
  });
  return box.__CB_VALUE__;
}

const { PLACES, PLACE_KINDS } = require('./public/places.js');
const PLACE_I18N = browserValue('public/i18n.js', 'I18N');
const PLACE_CREDITS = browserValue('public/places/credits.js', 'window.PLACE_CREDITS');

/** The day these outing URLs first became publicly indexable. A fixed
 *  historical fact, NOT a crawl date — bumping it on every deploy is exactly
 *  the over-claiming that teaches Google to ignore lastmod. */
const PLACES_FIRST_PUBLISHED = '2026-11-05';

/**
 * The date the vocabulary library last changed. This is the honest `lastmod`
 * for every /words/, /learn/ and /level/ page: they are all renderings of the
 * same library, so they cannot be fresher (or staler) than it is. Sourced from
 * content.js rather than typed twice, so the two can never disagree.
 */
const VOCAB_UPDATED = UPDATED;

/**
 * The date the WORD PAGE began rendering prose, as distinct from the date the
 * vocabulary DATA changed.
 *
 * WHY THE DISTINCTION EXISTS. VOCAB_UPDATED above was a good enough answer
 * while a word page was a pure function of its row: the row changed, the page
 * changed, one date covered both. On 2026-10-26 that stopped being true —
 * renderWord() started rendering `usage_note` and `example_*`, which had been
 * sitting in the database unrendered since the beginning. The DATA did not
 * change; the OUTPUT of 68 words did.
 *
 * Leaving those 272 URLs (68 words x 4 languages) stamped with the library date
 * would tell Google "nothing here has moved" about the exact pages we want it
 * to revisit — and they are the pages sitting in "Discovered - currently not
 * indexed". lastmod is the signal Google uses to decide what to spend a recrawl
 * on, so a stale one is not neutral; it is a reason not to come.
 *
 * APPLIED PER WORD, NOT PER FAMILY. Only a word that actually carries a note or
 * an example gained a block; the other 266 render byte-identically to before.
 * Stamping all 334 with today's date would be the over-claiming that teaches
 * Google to distrust the whole sitemap. See wordLastmod().
 *
 * This is a fixed historical fact, not a version to bump: it records when the
 * prose first appeared, and that will still be true next year.
 */
const WORD_PROSE_ADDED = '2026-10-26';

/**
 * The honest `lastmod` for one word page: the later of the library date and the
 * date its prose first rendered.
 *
 * A word with no note and no example did not change on 2026-10-26 and must keep
 * the library date — that is the whole point of doing this per word.
 */
function wordLastmod(w) {
  const hasProse = Boolean(
    String(w.usage_note || '').trim() ||
    String(w.example_yue || '').trim() ||
    String(w.example_en || '').trim()
  );
  if (!hasProse) return VOCAB_UPDATED;
  // ISO dates compare correctly as strings; no Date objects needed.
  return WORD_PROSE_ADDED > VOCAB_UPDATED ? WORD_PROSE_ADDED : VOCAB_UPDATED;
}

/**
 * Canonical origin. Overridable so a preview deployment can canonicalise to
 * itself instead of pointing at production. The default is the real domain
 * because a wrong-but-absolute canonical is far safer than a missing one.
 */
const SITE_ORIGIN = (process.env.SITE_ORIGIN || 'https://cantobuddy.com').replace(/\/+$/, '');

/**
 * The project's Facebook page.
 *
 * `rel="me"` on the outbound link is deliberate: it is the machine-readable
 * counterpart of the `sameAs` below, and is how a crawler (or Facebook's own
 * link checker) confirms the page really belongs to this site. One constant so
 * the footer, the About page and the Organization JSON-LD cannot drift apart.
 * The static HTML shells (index.html / domestic-helpers.html) repeat the URL
 * verbatim because they are served as files and cannot require this module.
 */
const FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61595817612067';
const FACEBOOK_LINK = `<a href="${FACEBOOK_URL}" target="_blank" rel="me noopener noreferrer">Facebook</a>`;

/**
 * Sentinel returned by a renderer whose page was RETIRED on purpose.
 *
 * The route table below turns a null return into 404 and this into 410. It is
 * a Symbol rather than a string or an object so it can never be confused with
 * rendered HTML — a page body is always a string, so `body === GONE` cannot be
 * true by accident.
 *
 * Only /discover/:slug returns it today, from the tombstone check in
 * renderPost(). Every other renderer returns a string or null.
 */
const GONE = Symbol('gone');

/**
 * Google Search Console ownership token.
 *
 * The single highest-value SEO action is not on this site at all — it is
 * verifying the domain in Search Console and submitting the sitemap, because
 * until that happens Google has no reliable signal that the content exists.
 * There are four ways to verify; this supports two of them so the operator has
 * a choice:
 *
 *   1. Meta tag — set GOOGLE_SITE_VERIFICATION to the token Google shows you
 *      (the `content` value). It is emitted on every server-rendered page.
 *      NOTE: this does NOT verify a URL-prefix property on '/' — '/' is the
 *      hand-written public/index.html and shadows the generated pages, so the
 *      tag never appears at the one URL that property checks.
 *   2. HTML file — drop Google's google<token>.html into public/ and add it to
 *      FILES in tools/deploy-to-github.js. It must be a real file serving ONE
 *      token; see the note in mount() for why a wildcard route gets the
 *      property refused as suspected hacking.
 *
 * DNS TXT verification also works and needs no code — it is done in Cloudflare,
 * and it is the most robust of the three because it does not depend on the app
 * being up at the moment Google looks.
 */
const GOOGLE_VERIFICATION = (process.env.GOOGLE_SITE_VERIFICATION || '').trim();

/**
 * Google AdSense publisher id, and the Auto Ads loader snippet.
 *
 * Hardcoded rather than an env var, deliberately. A publisher id is public by
 * design — it ships in the markup of every ad-serving page and anyone can read
 * it with View Source, so there is nothing to keep out of a public repo. Making
 * it an env var would only create a way for the tag to silently vanish on a
 * fresh deploy.
 *
 * Auto Ads means Google decides placement at runtime; there is no per-slot
 * markup to write. Loading it is the entire integration.
 *
 * The SAME snippet is also hand-written into public/index.html, and it has to
 * be in both places: express.static serves that file for "/", so it shadows
 * everything generated here, and the SEO pages never pass through it. Miss
 * either one and half the site serves no ads.
 */
const ADSENSE_CLIENT = 'ca-pub-6845142564408798';
const ADSENSE_SNIPPET =
  `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>
  <meta name="google-adsense-account" content="${ADSENSE_CLIENT}">`;

/**
 * Google Analytics 4. Same reasoning as ADSENSE_CLIENT above: a measurement id
 * is public by design (it ships in the markup and anyone can read it with View
 * Source), so an env var would only be a way for the tag to vanish silently on
 * a fresh deploy. It is hardcoded, and it is hardcoded TWICE on purpose —
 * see the note in public/index.html: that file shadows every page rendered
 * here, so the snippet has to be emitted in both places or half the site is
 * invisible to analytics.
 *
 * Two lines, `async` on the loader so first paint is never blocked. The
 * `config` call is on its own line because that is what GA4's own snippet
 * does, and because putting the measurement id in a second, differently-named
 * place is how the two drift apart.
 */
const GA_MEASUREMENT_ID = 'G-877054DW3X';
const GA_SNIPPET = [
  `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>`,
  '<script>',
  'window.dataLayer = window.dataLayer || [];',
  'function gtag(){dataLayer.push(arguments);}',
  "gtag('js', new Date());",
  `gtag('config', '${GA_MEASUREMENT_ID}');`,
  '</script>',
].join('\n  ');

/**
 * W1.1 — the ONE funnel client, on every server-rendered page.
 *
 * `defer` so it never blocks first paint (these pages are read on mid-range
 * Android over metered data). public/index.html loads the SAME file for the
 * SPA, which is the point: one vocabulary, one per-device-per-day dedupe key,
 * one shared localStorage identity across the whole origin. A reader who lands
 * on a search page and then opens the app is ONE landing_view, not two.
 *
 * The inline visit beacon below still queues an early landing_view through
 * `window.__cbFunnelQ` in case this script has not executed yet; the client
 * drains that queue on load, and its own boot() is deduped against it.
 */
const FUNNEL_SNIPPET = '<script src="/funnel-client.js" defer></script>';


// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** ASCII slug. Cantonese characters are dropped rather than percent-encoded —
 *  an English slug is what people and search engines actually type. */
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'word';
}

/**
 * Deterministic slug -> word map. Collisions (e.g. two words both glossing as
 * "Water") get an id suffix, and because the input is sorted by id the mapping
 * is stable across restarts and redeploys — a URL never silently changes
 * meaning, which is the one thing that would poison the index.
 */
function buildWordIndex() {
  // enabledOnly: a category the operator has switched off is gone from the
  // app, so its words must not linger as indexable pages either.
  const words = store.listVocabulary({ enabledOnly: true });
  const bySlug = new Map();
  const used = new Set();
  for (const w of words) {
    let slug = slugify(w.english);
    if (used.has(slug)) slug = `${slug}-${w.id}`;
    used.add(slug);
    bySlug.set(slug, w);
  }
  return { words, bySlug };
}

const LEVELS = {
  1: { en: 'Beginner', yue: '初級', fil: 'Baguhan', zh: '入门', id: 'Pemula', blurb: 'Basic greetings and the everyday words you need in the first week.' },
  2: { en: 'Intermediate', yue: '中級', fil: 'Katamtaman', zh: '中级', id: 'Menengah', blurb: 'Daily routines and household activities — cooking, cleaning, shopping, weather.' },
  3: { en: 'Advanced', yue: '高級', fil: 'Mahusay', zh: '进阶', id: 'Mahir', blurb: 'Full sentences and phrases, including elder care and asking questions.' },
};

function levelName(n, lang) {
  const l = LEVELS[n];
  if (!l) return `Level ${n}`;
  if (lang === 'fil') return l.fil;
  if (lang === 'zh') return l.zh;
  if (lang === 'id') return l.id;
  return l.en;
}

/** Localised UI strings for the content pages. Deliberately separate from
 *  public/i18n.js: that file is the app's runtime dictionary, this is a small
 *  server-side set for the pages this module emits. */
const L = {
  en: {
    htmlLang: 'en',
    brand: 'CantoBuddy',
    tagline: 'Learn Cantonese for daily life in Hong Kong',
    learn: 'Learn',
    discover: 'Discover',
    browse: 'Browse vocabulary',
    openApp: 'Open the app',
    openAppDesc: 'Practise these words with audio, pictures and quizzes — free.',
    jyutping: 'Jyutping',
    cantonese: 'Cantonese',
    english: 'English',
    filipino: 'Filipino',
    chinese: '中文',
    categories: 'Categories',
    levels: 'Levels',
    allWords: (n) => `All ${n} words`,
    wordsIn: (c) => `Words in ${c}`,
    relatedIn: (c) => `More ${c} words`,
    howToUse: 'How it is used',
    example: 'In a sentence',
    home: 'Home',
    pronunciation: 'Pronunciation',
    meaning: 'Meaning',
    alsoSaid: 'In Filipino',
    levelLabel: 'Level',
    categoryLabel: 'Category',
    aboutTitle: (c) => `About these ${c} words`,    aboutBody: (c, n) =>
      `These are ${n} practical ${c.toLowerCase()} words and phrases for everyday life in Hong Kong, ` +
      `written for Filipino domestic helpers. Each entry gives the Cantonese characters, the Jyutping ` +
      `romanisation so you can say it out loud, and the meaning in both English and Filipino.`,
    hubLede: (total, cats) =>
      `Every Cantonese word in CantoBuddy: ${total} practical words across ${cats} everyday categories, ` +
      `each with Jyutping romanisation and the meaning in both English and Filipino.`,
    wordIntro: (w) => `${w} in Cantonese`,
    wordBody: (w, j, e, c) =>
      `${e} in Cantonese is ${w}, pronounced ${j}. It belongs to the ${c} group and is ` +
      `one of the words used every day by domestic helpers in Hong Kong.`,
    notFound: 'Page not found',
    notFoundBody: 'That page does not exist. Try browsing the vocabulary instead.',
    footerNote: 'CantoBuddy — free Cantonese practice for helpers in Hong Kong.',
  },
  fil: {
    htmlLang: 'fil',
    brand: 'CantoBuddy',
    tagline: 'Matuto ng Cantonese para sa araw-araw na buhay sa Hong Kong',
    learn: 'Pag-aralan',
    discover: 'Tuklasin',
    browse: 'Tingnan ang bokabularyo',
    openApp: 'Buksan ang app',
    openAppDesc: 'Magpraktis ng mga salitang ito may audio, larawan at pagsusulit — libre.',
    jyutping: 'Jyutping',
    cantonese: 'Cantonese',
    english: 'Ingles',
    filipino: 'Filipino',
    chinese: '中文',
    categories: 'Mga kategorya',
    levels: 'Mga antas',
    allWords: (n) => `Lahat ng ${n} salita`,
    wordsIn: (c) => `Mga salita sa ${c}`,
    relatedIn: (c) => `Iba pang salitang ${c}`,
    howToUse: 'Paano ito ginagamit',
    example: 'Sa isang pangungusap',
    home: 'Simula',
    pronunciation: 'Pagbigkas',
    meaning: 'Kahulugan',
    alsoSaid: 'Sa Ingles',
    levelLabel: 'Antas',
    categoryLabel: 'Kategorya',
    aboutTitle: (c) => `Tungkol sa mga salitang ${c}`,
    aboutBody: (c, n) =>
      `Ito ang ${n} praktikal na salita at pariralang ${c.toLowerCase()} para sa araw-araw na buhay sa ` +
      `Hong Kong, para sa mga Filipino domestic helper. May Cantonese na karakter, Jyutping na ` +
      `pagbigkas, at kahulugan sa Filipino at Ingles ang bawat entry.`,
    hubLede: (total, cats) =>
      `Lahat ng salitang Cantonese sa CantoBuddy: ${total} praktikal na salita sa ${cats} kategorya, ` +
      `may Jyutping na pagbigkas at kahulugan sa Filipino at Ingles.`,
    wordIntro: (w) => `${w} sa Cantonese`,
    wordBody: (w, j, e, c) =>
      `Ang ${e} sa Cantonese ay ${w}, binibigkas na ${j}. Bahagi ito ng grupong ${c} at ` +
      `isa sa mga salitang gamit araw-araw ng mga domestic helper sa Hong Kong.`,
    notFound: 'Hindi mahanap ang pahina',
    notFoundBody: 'Wala ang pahinang ito. Tingnan na lang ang bokabularyo.',
    footerNote: 'CantoBuddy — libreng Cantonese practice para sa mga helper sa Hong Kong.',
  },

  /* Simplified Chinese, for the mainland-born audience in Hong Kong.
     Search intent differs sharply from the other two trees: an English or
     Filipino speaker searches "learn Cantonese for helpers"; this reader
     searches 粤语学习 / 广东话日常用语 / 香港 粤语 入门. The copy is written to those
     phrases rather than translated from the English. */
  zh: {
    htmlLang: 'zh-Hans',
    brand: 'CantoBuddy',
    tagline: '学香港日常生活粤语',
    learn: '学习',
    discover: '发现',
    browse: '浏览粤语词汇',
    openApp: '打开应用',
    openAppDesc: '配发音、图片和测验来练习这些词 — 免费。',
    jyutping: '粤拼',
    cantonese: '粤语',
    english: '英文',
    filipino: '菲律宾语',
    chinese: '中文',
    categories: '分类',
    levels: '水平',
    allWords: (n) => `全部 ${n} 个词`,
    wordsIn: (c) => `${c}类词汇`,
    relatedIn: (c) => `更多${c}类词汇`,
    howToUse: '用法',
    example: '例句',
    home: '首页',
    pronunciation: '发音',
    meaning: '意思',
    alsoSaid: '英文',
    levelLabel: '水平',
    categoryLabel: '分类',
    aboutTitle: (c) => `关于这些${c}类的词`,
    aboutBody: (c, n) =>
      `这里有 ${n} 个实用的${c}类词汇和短句，用于香港日常生活。每条都给出粤语字、` +
      `粤拼（Jyutping）读音，以及中文意思。`,
    hubLede: (total, cats) =>
      `CantoBuddy 里的全部粤语词汇：${total} 个实用词，分为 ${cats} 个日常分类，` +
      `每个都有粤拼读音和中文意思。`,
    wordIntro: (w) => `${w} 粤语怎么说`,
    wordBody: (w, j, e, c) =>
      `${e} 的粤语是 ${w}，读作 ${j}。它属于${c}类，是香港日常生活中常用的词。`,
    notFound: '找不到页面',
    notFoundBody: '这个页面不存在。试试浏览词汇表。',
    footerNote: 'CantoBuddy — 香港免费粤语学习工具。',
  },

  /* Bahasa Indonesia, for the Indonesian domestic-helper audience.
     Indonesia is the second-largest source of foreign domestic helpers in Hong
     Kong, and this reader searches in her own language: "belajar bahasa Kanton",
     "kosakata Kanton sehari-hari", "bahasa Kanton untuk ART". The copy is
     written to those phrases, not translated from the English tree.

     Deliberately NOT Malay: the two are close, but "asisten rumah tangga"
     (not "pembantu rumah"), "gratis" (not "percuma") and "beranda" (not
     "laman utama") are Indonesian choices. */
  id: {
    htmlLang: 'id',
    brand: 'CantoBuddy',
    tagline: 'Belajar bahasa Kanton untuk kehidupan sehari-hari di Hong Kong',
    learn: 'Belajar',
    discover: 'Jelajah',
    browse: 'Jelajahi kosakata',
    openApp: 'Buka aplikasi',
    openAppDesc: 'Latih kata-kata ini dengan audio, gambar, dan kuis — gratis.',
    jyutping: 'Jyutping',
    cantonese: 'Kanton',
    english: 'Inggris',
    filipino: 'Filipino',
    chinese: '中文',
    categories: 'Kategori',
    levels: 'Tingkat',
    allWords: (n) => `Semua ${n} kata`,
    wordsIn: (c) => `Kata dalam ${c}`,
    relatedIn: (c) => `Kata ${c} lainnya`,
    howToUse: 'Cara pemakaiannya',
    example: 'Dalam kalimat',
    home: 'Beranda',
    pronunciation: 'Pelafalan',
    meaning: 'Arti',
    alsoSaid: 'Dalam bahasa Inggris',
    levelLabel: 'Tingkat',
    categoryLabel: 'Kategori',
    aboutTitle: (c) => `Tentang kata ${c} ini`,
    aboutBody: (c, n) =>
      `Ini ${n} kata dan frasa ${c.toLowerCase()} praktis untuk kehidupan sehari-hari di Hong Kong, ` +
      `ditulis untuk asisten rumah tangga dari Indonesia. Setiap entri memuat aksara Kanton, romanisasi ` +
      `Jyutping supaya bisa diucapkan, serta artinya dalam bahasa Indonesia dan Inggris.`,
    hubLede: (total, cats) =>
      `Semua kosakata Kanton di CantoBuddy: ${total} kata praktis dalam ${cats} kategori sehari-hari, ` +
      `masing-masing dengan romanisasi Jyutping dan artinya dalam bahasa Indonesia.`,
    wordIntro: (w) => `${w} dalam bahasa Kanton`,
    wordBody: (w, j, e, c) =>
      `${e} dalam bahasa Kanton adalah ${w}, diucapkan ${j}. Kata ini termasuk kelompok ${c} dan ` +
      `dipakai setiap hari oleh asisten rumah tangga di Hong Kong.`,
    notFound: 'Halaman tidak ditemukan',
    notFoundBody: 'Halaman itu tidak ada. Coba jelajahi kosakatanya.',
    footerNote: 'CantoBuddy — latihan bahasa Kanton gratis untuk asisten rumah tangga di Hong Kong.',
  },
};

/** Category display name in the requested language, falling back sensibly.
 *
 * `name_zh` is a genuine Simplified Mandarin name, NOT `name_yue` — the latter
 * is the Cantonese name in Traditional characters, which is the wrong register
 * and the wrong script for the zh tree. `name_id` is likewise a real Indonesian
 * name, not a variant of the Filipino one (Kebersihan ≠ Paglilinis). */
function catName(cat, lang) {
  if (!cat) return '';
  if (lang === 'fil') return cat.name_fil || cat.name_en;
  if (lang === 'zh') return cat.name_zh || cat.name_en;
  if (lang === 'id') return cat.name_id || cat.name_en;
  return cat.name_en || cat.name_fil;
}

/** The URL prefix for a language tree. English is the root, deliberately. */
const LANG_PREFIX = { en: '', fil: '/fil', zh: '/zh', id: '/id' };

/**
 * Where the top-left wordmark and the "Open app" button must lead: the app's
 * HOME page, not the language tree the reader happens to be standing in.
 *
 * The old default was `LANG_PREFIX[lang]` — `/id`, `/fil`, `/zh`. Those bare
 * prefixes are 301 redirects to `<prefix>/learn`, so on the vocabulary hub
 * (the page nearly every search visitor lands on) clicking the logo bounced
 * straight back to the same URL and looked completely dead. A translated SEO
 * tree has no home page of its own; `/` is the only home there is.
 *
 * `?lang=` carries the reader's language across the boundary so an Indonesian
 * page does not dump her into an English interface. public/i18n.js applies it
 * once, remembers it, then strips it from the address bar — leaving it there
 * would silently undo a language she picks herself on the next reload. English
 * needs no marker because it is already the app's default.
 *
 * Callers that ARE their own app (the /en English track) pass an explicit
 * brandHref/ctaHref and are unaffected.
 */
function appHomeHref(lang) {
  return lang && lang !== 'en' ? `/?lang=${encodeURIComponent(lang)}` : '/';
}

// Employer-facing landing page and the footer link that points at it. The page
// itself lives on the portal (see renderEmployerLanding / portalPage), not on a
// route this module registers, because it is the portal shell with content
// spliced in.
//
// One URL in every tree, because the page is English only. A per-language href
// here would send a Chinese reader to a /zh/for-employers that 301s straight
// back to English.
const FOR_EMPLOYERS_HREF = { en: '/portal', fil: '/portal', zh: '/portal', id: '/portal' };
const FOR_EMPLOYERS_LABEL = { en: 'For employers', fil: 'Para sa mga employer', zh: '雇主专区', id: 'Untuk majikan' };

/**
 * The single-segment route families this module serves, WITHOUT a language
 * prefix — the list `mount()` registers below.
 *
 * This exists as one exported constant because the sitemap's ENGLISH count has
 * to know every family. English has no prefix, so it is counted as "content
 * URLs that belong to none of the other trees and match one of these" — and a
 * family missing from that pattern makes English look SMALLER than the three
 * prefixed trees, which each count on their prefix alone.
 *
 * That is not hypothetical. `/discover` shipped without being added to the
 * hand-written copies of this list inside `indonesian-test.js` and
 * `prod-id-check.js`, and both immediately reported `en=208 fil=214` — a
 * comparison of two different page sets, dressed up as a missing English page.
 * (The same shape of bug happened once before, with `/privacy`.) Those suites
 * now derive the pattern from this export, so the next route cannot repeat it.
 */
/* Route families that have a page in every language tree.
 *
 * `/portal` is deliberately NOT here: it is the employer landing page, it is
 * English only, and it is not registered as a seo.js route at all (server.js
 * serves it via portalPage()). Listing it would make the language suites
 * expect /fil/portal, /zh/portal and /id/portal to exist, and would count it as
 * an English-only URL when they assert the four trees are the same size. */
// `places` is here because the outing guides now ship as four mirrored SSR
// trees. Test suites derive their four-tree counts and the service-worker
// network-first matcher from this list, so a new family that is left out would
// be invisible to every drift guard. `living` is deliberately NOT here: its
// passages and hub are English-only, so it has no four-tree count to compare.
const ROUTE_FAMILIES = ['learn', 'words', 'level', 'guide', 'discover', 'stories', 'privacy', 'places'];

/** Every language tree this module serves, in the order links should list them. */
const LANGS = ['en', 'fil', 'zh', 'id'];

/* ===========================================================================
   Privacy policy
   ===========================================================================

   AdSense will not approve a site without one, and Google's crawler checks it.
   But the reason this is written carefully rather than boilerplate is that the
   app's own design decisions ARE privacy claims, and a policy that contradicted
   them would be worse than none:

     - A learner is identified by a random device id, never an account. There is
       no email, no phone number, no password, and no name unless she types one.
     - Visit counting (`visit_daily`) is aggregate by day+path with no learner
       link. Page-level, not person-level.
     - Feedback from a learner stores no learner_id and no user_id. Anonymity is
       the point: she is a live-in worker whose employer can see her progress, so
       a complaint has to be unattributable or it will not be written.
     - An employer sees only a learner's progress, and only while the helper's
       consent link is live; she can revoke it at any time.

   The one thing that genuinely CHANGES the picture is AdSense, which is what
   made this page necessary: a third-party script that sets its own cookies and
   sees the reader's IP and user agent. That is disclosed plainly below, named,
   with the opt-out route. Pretending otherwise would be the dishonest version.

   Google Analytics (GA4) joined it on 2026-10-21 and is disclosed the same way,
   in its own "Statistics" section in all four trees. Two third-party scripts,
   one rule: name it, say what it sees, give the way out. Both snippets are
   loaded in BOTH public/index.html (because express.static serves that file
   for "/" and it shadows everything generated here) and in the head template
   below — so a policy that describes a script the page does not actually load
   would be the version of this bug that nobody catches.

   Kept as data, one object per language, so the four trees cannot drift and a
   new tree cannot be added without this page appearing in it.
   ------------------------------------------------------------------------- */
const PRIVACY = {
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: 21 October 2026',
    lede: 'CantoBuddy is a free Cantonese practice app for domestic helpers in Hong Kong. This page explains, in plain language, what the app records, what it does not, and how to have it deleted.',
    sections: [
      {
        h: 'What we record about a learner',
        p: [
          'You do not need an account to use CantoBuddy. There is no email address, no phone number, and no password. When you open the app for the first time, your device is given a random identifier that is stored in your own browser. That identifier is how your progress, your streak, and your saved words are remembered on your phone.',
          'We record which words you practise, your quiz answers, your streak, and when you last opened the app. If you type a display name, we store that name. You can change it or clear it at any time from inside the app.',
          'We do not record your location. We do not record your contacts. We do not ask for your real name, your date of birth, or any identity document.',
        ],
      },
      {
        h: 'Employers and progress sharing',
        p: [
          'An employer can see a helper\'s learning progress only through an invitation link that the helper accepts. Sharing is off by default. The helper can turn it off again at any time from inside the app, and when she does, the employer stops seeing her progress and any existing link stops working.',
          'An employer never sees a helper\'s quiz answers word by word, her feedback, or anything outside the progress summary. The employer cannot see the helper\'s other activity on this site.',
        ],
      },
      {
        h: 'Feedback',
        p: [
          'If you send feedback through the app, the message is stored without linking it to you. We deliberately do not attach your device identifier or any account to a learner\'s feedback, so that a helper can report a problem — including one about the app or about her household — without it being traceable to her.',
          'A contact detail is stored only if you choose to type one in. It is never filled in on your behalf.',
        ],
      },
      {
        h: 'Stories',
        p: [
          'You can write your own story — about your daily life, where you come from, or something that happened to you — and send it to us from inside the app. A story is read by us before it appears anywhere. Nothing you write is visible to anyone else until we have read it and chosen to publish it, and we may edit it, ask you to change it, or decline it.',
          'Your name is published with the story only if you tick the box asking us to show it. If you do not tick it, your name is not stored at all — not hidden, not blanked out later, simply never written down. Your device identifier is never shown to a reader. We keep it only so that you can see the status of your own submissions and so that one device cannot flood the queue; it is not part of the published page.',
          'If you do put your name to a story, remember that a published story is public: anyone can read it, copy it, and search engines may index it. Once it is out, we cannot take back a copy someone else has already made. You can ask us to remove your story at any time and we will take it down, but we cannot promise it has not been copied in the meantime.',
          'Please do not include an address, a phone number, an employer\'s full name, or anything else that could identify you or the family you work for. If you do, we will remove it before publishing.',
        ],
      },
      {
        h: 'Visit counting',
        p: [
          'The public guide pages count visits by day and by page. This count is stored as a total per page per day, with no link to any individual, and it is used only to see which vocabulary pages are useful.',
        ],
      },
      {
        h: 'Advertising',
        p: [
          'Third-party vendors, including Google, use cookies to serve ads on this site. This site shows advertisements supplied by Google AdSense; to do that, Google and its vendor partners load a script on the page and may set cookies or read device identifiers in order to select, personalise and measure advertising.',
          'This means Google, and the advertisers it works with, can see your IP address, your browser type, and which pages you view on this site. That is a change from the rest of this app, which is built not to track you, and we would rather state it plainly than bury it.',
          'You can control personalised advertising in your Google Ads Settings, and you can opt out of third-party advertising cookies through aboutads.info or youronlinechoices.eu. If you are in the European Economic Area, the United Kingdom, or Switzerland, a consent prompt appears before advertising cookies are used, and declining it does not stop you using the app.',
          'If you would prefer no advertising at all, a browser extension that blocks advertising will also stop the AdSense script from loading, and the app works normally without it.',
        ],
      },
      {
        h: 'Statistics',
        p: [
          'This site also uses Google Analytics (GA4) to count visits. To do that, Google loads a script on the page, which places a cookie in your browser and sends Google the pages you view, roughly where you are (by country or city, not by street address), what kind of device and browser you use, and how you arrived at the site.',
          'The Analytics cookie is not tied to your name or to the random device identifier this app uses for your progress. It cannot read your quiz answers, your words, your feedback, or anything else you have written here. IP anonymisation is switched on, so the full address is not stored.',
          'This is a change from the rest of the app, which is built not to track you, and we would rather say so plainly. If you would rather not be counted, a browser extension that blocks analytics — or turning Google Analytics off in your browser settings — stops the script, and the app works normally without it. Nothing is lost but the count.',
        ],
      },
      {
        h: 'Push notifications',
        p: [
          'With your permission, CantoBuddy can send browser notifications — gentle reminders to practise, and a note when a new story arrives. Nothing is sent until you tap "Turn on"; you are never subscribed without asking.',
          'To deliver a notification, your browser hands us a token (an endpoint address plus two short keys). We store it only so the message reaches you. It is not linked to your name, your feedback, or anything else you do in the app, and we never read its contents.',
          'You can turn notifications off at any time: tap "Turn off" on the notification pill in the app, or block notifications for this site in your browser settings. Turning them off deletes the token from our server, so no further messages can be sent to that device.',
        ],
      },
      {
        h: 'What we never do',
        p: [
          'We do not sell your personal information.',
          'We do not require any payment from a helper. CantoBuddy is free for learners, and it always will be.',
          'We do not use your learning activity to make decisions about your employment, and we do not share it with anyone except an employer you have explicitly invited.',
        ],
      },
      {
        h: 'Children',
        p: [
          'CantoBuddy is intended for adults working in Hong Kong. It is not directed at children, and we do not knowingly collect information from a child.',
        ],
      },
      {
        h: 'Deleting your data',
        p: [
          'Because your progress is tied to a random identifier stored in your own browser, clearing your browser data for this site removes it from your device. If you would like the records held on our server deleted, send us a message through the feedback button in the app and tell us your display name. We will delete the matching learner record.',
          'An employer may ask us to delete her account at any time, and we will do so.',
        ],
      },
      {
        h: 'Changes to this policy',
        p: [
          'If this policy changes in a way that affects you, we will update the date at the top of this page. Continuing to use CantoBuddy after a change means you accept the updated policy.',
        ],
      },
      {
        h: 'Contact',
        p: [
          'For any question about this policy, or to ask for your data to be deleted, use the feedback button inside the app. We read every message.',
        ],
      },
    ],
  },

  fil: {
    title: 'Patakaran sa Privacy',
    updated: 'Huling na-update: 21 Oktubre 2026',
    lede: 'Ang CantoBuddy ay isang libreng app para sa pagsasanay ng Cantonese para sa mga domestic helper sa Hong Kong. Ipinaliwanag sa page na ito, sa simpleng pananalita, kung ano ang itinatala ng app, kung ano ang hindi nito itinatala, at paano ito ipapabura.',
    sections: [
      {
        h: 'Ano ang itinatala namin tungkol sa isang mag-aaral',
        p: [
          'Hindi kailangan ng account para gamitin ang CantoBuddy. Walang email address, walang numero ng telepono, at walang password. Sa unang pagbukas mo ng app, bibigyan ang iyong device ng random na pangalan na nakaimbak sa sarili mong browser. Iyan ang paraan ng pag-alala sa iyong progreso, streak, at mga naka-save na salita sa iyong telepono.',
          'Itinatala namin kung aling mga salita ang sinasanay mo, ang iyong mga sagot sa pagsusulit, ang iyong streak, at kung kailan ka huling nagbukas ng app. Kung mag-type ka ng pangalan, iniimbak namin iyon. Mababago o mabubura mo ito anumang oras sa loob ng app.',
          'Hindi namin itinatala ang iyong lokasyon. Hindi namin itinatala ang iyong mga kontak. Hindi kami humihingi ng tunay na pangalan, petsa ng kapanganakan, o anumang dokumento ng pagkakakilanlan.',
        ],
      },
      {
        h: 'Mga employer at pagbabahagi ng progreso',
        p: [
          'Makikita ng employer ang progreso ng helper sa pag-aaral sa pamamagitan lamang ng link ng imbitasyon na tinanggap ng helper. Naka-off ang pagbabahagi sa simula. Maaari itong patayin ng helper anumang oras sa loob ng app, at kapag ginawa niya iyon, hindi na makikita ng employer ang kanyang progreso at titigil na ang anumang existing na link.',
          'Hindi nakikita ng employer ang bawat sagot ng helper sa pagsusulit, ang kanyang feedback, o anumang bagay sa labas ng buod ng progreso. Hindi rin nakikita ng employer ang iba pang aktibidad ng helper sa site na ito.',
        ],
      },
      {
        h: 'Feedback',
        p: [
          'Kung magpapadala ka ng feedback sa app, iniimbak ang mensahe nang hindi ito nakaugnay sa iyo. Sadyang hindi namin ikinakabit ang identifier ng iyong device o anumang account sa feedback ng isang mag-aaral, para makapag-ulat ang isang helper ng problema — kasama na ang tungkol sa app o sa kanyang sambahayan — nang hindi ito natutunton sa kanya.',
          'Ang contact detail ay iniimbak lamang kung pipiliin mong mag-type nito. Hindi ito kailanman pinupunan para sa iyo.',
        ],
      },
      {
        h: 'Mga Kuwento',
        p: [
          'Maaari kang sumulat ng sarili mong kuwento — tungkol sa pang-araw-araw mong buhay, sa pinanggalingan mo, o sa isang bagay na nangyari sa iyo — at ipadala ito sa amin mula sa loob ng app. Binabasa namin ang kuwento bago ito lumabas kahit saan. Walang makikita ng kahit ano sa isinulat mo hangga\'t hindi namin ito nabasa at piniling ilathala; maaari rin naming i-edit ito, hilingin sa iyong baguhin, o tanggihan.',
          'Ilalathala ang pangalan mo kasama ng kuwento kung tinitikan mo ang kahon na humihiling na ipakita ito. Kung hindi mo tinitikan, hindi ito iniimbak — hindi nakatago, hindi binura mamaya, kundi hindi kailanman isinulat. Hindi kailanman ipinapakita sa mambabasa ang identifier ng iyong device. Iniingatan namin ito para makita mo ang kalagayan ng sarili mong mga isinumite at para hindi maipon ng isang device ang pila; wala ito sa nailathalang pahina.',
          'Kung ilalagay mo ang pangalan mo sa isang kuwento, tandaan na ang nailathalang kuwento ay pampubliko: kahit sino ay makakabasa, makakopya, at maaaring i-index ito ng mga search engine. Kapag lumabas na, hindi na namin maibabalik ang kopyang nakuha na ng iba. Maaari mong hilingin anumang oras na alisin ang kuwento mo at aalisin namin ito, ngunit hindi namin maipapangako na hindi pa ito nakopya.',
          'Huwag isama ang address, numero ng telepono, buong pangalan ng employer, o anumang bagay na maaaring magpakilala sa iyo o sa pamilyang pinaglilingkuran mo. Kung mayroon, aalisin namin ito bago ilathala.',
        ],
      },
      {
        h: 'Pagbilang ng pagbisita',
        p: [
          'Binibilang ng mga pampublikong guide page ang pagbisita ayon sa araw at ayon sa pahina. Ang bilang na ito ay iniimbak bilang kabuuan bawat pahina bawat araw, walang koneksyon sa sinumang indibidwal, at ginagamit lamang upang makita kung aling mga page ng bokabularyo ang kapaki-pakinabang.',
        ],
      },
      {
        h: 'Advertising',
        p: [
          'Nagpapakita ang site na ito ng advertising mula sa Google AdSense. Para gawin iyon, naglo-load ang Google at ang mga kasosyo nito ng script sa pahina at maaaring maglagay ng cookies o magbasa ng identifier ng device upang pumili at sumukat ng advertising.',
          'Ibig sabihin nito, nakikita ng Google, at ng mga advertiser na katrabaho nito, ang iyong IP address, uri ng browser, at kung aling mga pahina ang tinitingnan mo sa site na ito. Ito ay pagbabago mula sa iba pang bahagi ng app na ito, na ginawa para hindi ka subaybayan, at mas gusto naming sabihin ito nang tapat kaysa ilihim.',
          'Maaari mong kontrolin ang personalised advertising sa iyong Google Ads Settings, at maaari kang mag-opt out sa third-party advertising cookies sa pamamagitan ng aboutads.info o youronlinechoices.eu. Kung nasa European Economic Area, United Kingdom, o Switzerland ka, may lalabas na consent prompt bago gamitin ang advertising cookies, at ang pagtanggi dito ay hindi humahadlang sa paggamit mo ng app.',
          'Kung ayaw mo ng anumang advertising, mapipigilan din ng browser extension na nagba-block ng advertising ang pag-load ng AdSense script, at gumagana pa rin nang normal ang app.',
        ],
      },
      {
        h: 'Estadistika',
        p: [
          'Gumagamit din ang site na ito ng Google Analytics (GA4) para bilangin ang pagbisita. Para gawin iyon, naglo-load ang Google ng script sa pahina, na naglalagay ng cookie sa iyong browser at ipinapadala sa Google ang mga pahinang tinitingnan mo, ang tinatayang lugar mo (ayon sa bansa o lungsod, hindi sa eksaktong address), ang uri ng device at browser mo, at kung paano ka nakarating sa site.',
          'Ang cookie ng Google Analytics ay hindi nakaugnay sa pangalan mo o sa random na device identifier na ginagamit ng app na ito para sa progreso mo. Hindi nito mababasa ang iyong mga sagot sa pagsusulit, ang iyong mga salita, ang iyong feedback, o anumang isinulat mo dito. Naka-on ang IP anonymisation nito, kaya ang buong address ay hindi iniimbak.',
          'Ito ay pagbabago mula sa iba pang bahagi ng app na ito, na ginawa para hindi ka subaybayan, at mas gusto naming sabihin ito nang tapat. Kung ayaw mong mabilang, mapipigilan ng browser extension na nagba-block ng analytics — o ang pag-off sa Google Analytics sa settings ng iyong browser — ang script, at gumagana pa rin nang normal ang app. Walang nawawala kundi ang bilang.',
        ],
      },
      {
        h: 'Mga push notification',
        p: [
          'Kung pumayag ka, maaaring magpadala ang CantoBuddy ng mga browser notification — banayad na paalala na mag-practice, at abiso kapag may bagong kuwento. Walang ipapadala hangga\'t hindi mo tinatap ang "I-on"; hindi ka sasali nang hindi nagtatanong.',
          'Upang maihatid ang notification, ibinibigay ng iyong browser sa amin ang isang token (isang endpoint address at dalawang maikling key). Iniimbak namin ito para lang dumating ang mensahe sa iyo. Hindi ito nakaugnay sa iyong pangalan, feedback, o anumang iba mong ginagawa sa app, at hindi namin binabasa ang laman nito.',
          'Maaari mong patayin ang mga notification anumang oras: i-tap ang "I-off" sa notification pill sa app, o harangin ang mga notification para sa site na ito sa settings ng iyong browser. Kapag pinatay, buburahin ang token mula sa aming server, kaya wala nang mensahe ang maidadalang sa device na iyon.',
        ],
      },
      {
        h: 'Ang hindi namin ginagawa',
        p: [
          'Hindi namin ibinebenta ang iyong personal na impormasyon.',
          'Hindi kami nagpapabayad sa isang helper. Libre ang CantoBuddy para sa mga mag-aaral, at mananatili itong libre.',
          'Hindi namin ginagamit ang iyong aktibidad sa pag-aaral para gumawa ng desisyon tungkol sa iyong trabaho, at hindi namin ito ibinabahagi sa kahit sino maliban sa employer na malinaw mong iniimbitahan.',
        ],
      },
      {
        h: 'Mga bata',
        p: [
          'Ang CantoBuddy ay para sa mga nasa hustong gulang na nagtatrabaho sa Hong Kong. Hindi ito para sa mga bata, at hindi namin sinasadyang mangolekta ng impormasyon mula sa isang bata.',
        ],
      },
      {
        h: 'Pagbura ng iyong data',
        p: [
          'Dahil ang iyong progreso ay nakatali sa isang random na identifier na nakaimbak sa sarili mong browser, ang pag-clear ng browser data para sa site na ito ay nag-aalis nito sa iyong device. Kung gusto mong burahin ang mga talaan na nasa aming server, magpadala ng mensahe sa pamamagitan ng feedback button sa app at sabihin ang iyong pangalan. Buburahin namin ang katumbas na talaan ng mag-aaral.',
          'Maaaring hilingin ng isang employer na burahin ang kanyang account anumang oras, at gagawin namin iyon.',
        ],
      },
      {
        h: 'Mga pagbabago sa patakarang ito',
        p: [
          'Kung magbabago ang patakarang ito sa paraang nakakaapekto sa iyo, ia-update namin ang petsa sa itaas ng page na ito. Ang patuloy na paggamit ng CantoBuddy pagkatapos ng pagbabago ay nangangahulugang tinatanggap mo ang na-update na patakaran.',
        ],
      },
      {
        h: 'Makipag-ugnayan',
        p: [
          'Para sa anumang tanong tungkol sa patakarang ito, o para hilingin na burahin ang iyong data, gamitin ang feedback button sa loob ng app. Binabasa namin ang bawat mensahe.',
        ],
      },
    ],
  },

  zh: {
    title: '隐私政策',
    updated: '最后更新：2026 年 10 月 21 日',
    lede: 'CantoBuddy 是给香港外佣免费使用的粤语练习应用。本页用平实的语言说明：应用记录什么、不记录什么，以及如何删除这些记录。',
    sections: [
      {
        h: '关于学习者，我们记录什么',
        p: [
          '使用 CantoBuddy 不需要注册账号。没有邮箱、没有手机号、也没有密码。你第一次打开应用时，你的设备会获得一个随机标识符，保存在你自己的浏览器里。你的进度、连续学习天数和收藏的词，就是靠这个标识符在你的手机上记住的。',
          '我们会记录你练习了哪些词、测验答案、连续天数，以及你上次打开应用的时间。如果你填写了显示名称，我们会保存这个名称。你可以随时在应用内修改或清除它。',
          '我们不记录你的位置，不读取你的通讯录，也不要求你提供真实姓名、出生日期或任何身份证明。',
        ],
      },
      {
        h: '雇主与进度共享',
        p: [
          '雇主只有在收到并接受邀请链接后，才能看到外佣的学习进度。共享默认是关闭的。外佣可以随时在应用内关闭它；一旦关闭，雇主将不再看到进度，原有链接也会失效。',
          '雇主不会看到外佣逐题的测验答案、她的反馈，或进度摘要以外的任何内容，也看不到她在这个网站上的其他活动。',
        ],
      },
      {
        h: '反馈',
        p: [
          '如果你通过应用发送反馈，这条消息会被保存，但不会与你关联。我们特意不把设备标识符或任何账号附在用户的反馈上，这样外佣才能报告问题（包括关于应用或关于雇主家庭的问题）而不必担心被追溯到本人。',
          '只有在你自己填写的情况下，我们才会保存联系方式。我们绝不会替你填写。',
        ],
      },
      {
        h: '家佣故事',
        p: [
          '你可以写下自己的故事——关于你的日常生活、你的家乡，或发生在你身上的事——并在应用内发给我们。故事在出现在任何地方之前，都会先由我们阅读。在我们读过并决定发布之前，你写的内容对任何人都不可见；我们也可能会编辑它、请你修改，或不予采用。',
          '只有当你勾选「显示我的名字」时，你的名字才会随故事一起发布。如果你没有勾选，你的名字根本不会被保存——不是被隐藏，也不是事后抹去，而是从未被写下。你的设备标识符绝不会展示给读者。我们保留它，只是为了让你能看到自己投稿的状态，以及防止单一设备刷屏；它不会出现在已发布的页面上。',
          '如果你选择署名，请记住：已发布的故事是公开的——任何人都可以阅读、复制，搜索引擎也可能收录。一旦发布，别人已经留下的副本我们无法收回。你可以随时要求我们删除你的故事，我们会照办，但无法保证这段时间内它没有被复制。',
          '请不要写入门牌地址、电话号码、雇主的全名，或任何能识别你或你雇主家庭的信息。如有，我们会在发布前删除。',
        ],
      },
      {
        h: '访问统计',
        p: [
          '公开的指南页面会按日期和页面统计访问量。这些数据以「每天每页的总数」形式保存，不与任何个人关联，仅用于了解哪些词汇页面有用。',
        ],
      },
      {
        h: '广告',
        p: [
          '本站显示由 Google AdSense 提供的广告。为此，Google 及其合作方会在页面上加载脚本，并可能放置 Cookie 或读取设备标识符，用于选择与衡量广告。',
          '这意味着 Google 及其广告客户可以看到你的 IP 地址、浏览器类型，以及你访问了本站的哪些页面。这与本应用的其他部分不同——那些部分刻意不做跟踪——我们认为应当坦白说明，而不是藏起来。',
          '你可以在 Google 广告设置中管理个性化广告，也可以通过 aboutads.info 或 youronlinechoices.eu 退出第三方广告 Cookie。如果你位于欧洲经济区、英国或瑞士，在使用广告 Cookie 前会出现同意提示；拒绝该提示不影响你使用本应用。',
          '如果你完全不希望看到广告，安装广告拦截扩展也会阻止 AdSense 脚本加载，应用在没有广告的情况下依然正常运行。',
        ],
      },
      {
        h: '统计',
        p: [
          '本站同时使用 Google Analytics（GA4）统计访问量。为此，Google 会在页面加载一段脚本，在您的浏览器中放置 Cookie，并把您浏览的页面、您的大致位置（按国家或城市，而非街道地址）、您使用的设备与浏览器类型，以及您如何到达本站等资料传送给 Google。',
          '该 Analytics Cookie 不会与您的姓名关联，也不会与本应用用来保存学习进度的随机设备标识符关联。它无法读取您的测验答案、您学习的字词、您的反馈，或您在此写下的任何内容。其 IP 匿名化功能已启用，因此完整地址不会被保存。',
          '这与本应用其他部分「刻意不跟踪您」的设计并不相同，我们选择坦白说明。若您不希望被统计，使用拦截分析脚本的浏览器扩展（或在浏览器设置中停用 Google Analytics）即可阻止该脚本，应用在没有它的情况下依然正常运行——失去的只是一个统计数字。',
        ],
      },
      {
        h: '推送通知',
        p: [
          '在获得你的许可后，CantoBuddy 可以发送浏览器通知——温和的练习提醒，以及新故事上线时的提示。在你点击「开启」之前，我们不会发送任何内容；没有询问就不会订阅。',
          '为了送达通知，你的浏览器会交给我们一个令牌（一个端点地址和两串短密钥）。我们保存它只是为了把消息送到你手上。它不会与你的名字、你的反馈，或你在应用里的任何其他行为关联，我们也从不读取它的内容。',
          '你可以随时关闭通知：在应用内点击通知浮标上的「关闭」，或在浏览器设置中屏蔽本站的通知。关闭后，令牌会从我们的服务器上删除，因此该设备将不再收到任何消息。',
        ],
      },
      {
        h: '我们绝不会做的事',
        p: [
          '我们不会出售你的个人信息。',
          '我们不向外佣收取任何费用。CantoBuddy 对学习者永久免费。',
          '我们不会用你的学习记录对你的工作做任何决定，也不会把它分享给除你明确邀请的雇主以外的任何人。',
        ],
      },
      {
        h: '儿童',
        p: [
          'CantoBuddy 面向在香港工作的成年人，不面向儿童，我们也不会在知情的情况下收集儿童的信息。',
        ],
      },
      {
        h: '删除你的数据',
        p: [
          '由于你的进度绑定在保存在你自己浏览器里的随机标识符上，清除该网站的浏览器数据即可从你的设备上移除。如果你希望删除我们服务器上的记录，请通过应用内的反馈按钮联系我们并告知你的显示名称，我们会删除对应的学习者记录。',
          '雇主可以随时要求我们删除她的账号，我们会照办。',
        ],
      },
      {
        h: '本政策的变更',
        p: [
          '如果本政策有影响你的变更，我们会更新本页顶部的日期。变更后继续使用 CantoBuddy，即表示你接受更新后的政策。',
        ],
      },
      {
        h: '联系方式',
        p: [
          '对本政策有任何疑问，或希望删除你的数据，请使用应用内的反馈按钮。每一条消息我们都会阅读。',
        ],
      },
    ],
  },

  id: {
    title: 'Kebijakan Privasi',
    updated: 'Terakhir diperbarui: 21 Oktober 2026',
    lede: 'CantoBuddy adalah aplikasi latihan bahasa Kanton gratis untuk asisten rumah tangga di Hong Kong. Halaman ini menjelaskan dengan bahasa sederhana apa yang dicatat aplikasi, apa yang tidak dicatat, dan cara meminta penghapusannya.',
    sections: [
      {
        h: 'Apa yang kami catat tentang pengguna',
        p: [
          'Anda tidak perlu akun untuk memakai CantoBuddy. Tidak ada alamat email, tidak ada nomor telepon, dan tidak ada kata sandi. Saat pertama kali membuka aplikasi, perangkat Anda diberi pengenal acak yang disimpan di browser Anda sendiri. Pengenal itulah yang mengingat kemajuan, rentetan hari belajar, dan kata tersimpan Anda di ponsel Anda.',
          'Kami mencatat kata apa yang Anda latih, jawaban kuis, rentetan hari, dan kapan terakhir Anda membuka aplikasi. Jika Anda menuliskan nama tampilan, kami menyimpan nama itu. Anda bisa mengubah atau menghapusnya kapan saja dari dalam aplikasi.',
          'Kami tidak mencatat lokasi Anda. Kami tidak membaca kontak Anda. Kami tidak meminta nama asli, tanggal lahir, atau dokumen identitas apa pun.',
        ],
      },
      {
        h: 'Pemberi kerja dan berbagi kemajuan',
        p: [
          'Pemberi kerja hanya dapat melihat kemajuan belajar seorang asisten melalui tautan undangan yang diterima oleh asisten tersebut. Berbagi dalam keadaan mati secara bawaan. Asisten dapat mematikannya lagi kapan saja dari dalam aplikasi, dan setelah itu pemberi kerja berhenti melihat kemajuannya serta tautan yang ada tidak lagi berfungsi.',
          'Pemberi kerja tidak pernah melihat jawaban kuis asisten satu per satu, umpan baliknya, atau apa pun di luar ringkasan kemajuan. Pemberi kerja juga tidak dapat melihat aktivitas asisten lainnya di situs ini.',
        ],
      },
      {
        h: 'Umpan balik',
        p: [
          'Jika Anda mengirim umpan balik melalui aplikasi, pesannya disimpan tanpa dikaitkan dengan Anda. Kami sengaja tidak melampirkan pengenal perangkat atau akun apa pun pada umpan balik seorang pengguna, supaya seorang asisten dapat melaporkan masalah — termasuk tentang aplikasi atau tentang rumah tangganya — tanpa bisa dilacak kembali kepadanya.',
          'Detail kontak hanya disimpan jika Anda memilih menuliskannya. Kami tidak pernah mengisinya untuk Anda.',
        ],
      },
      {
        h: 'Kisah',
        p: [
          'Anda bisa menulis kisah Anda sendiri — tentang kehidupan sehari-hari, kampung halaman, atau sesuatu yang pernah terjadi pada Anda — dan mengirimkannya kepada kami dari dalam aplikasi. Kisah dibaca oleh kami sebelum muncul di mana pun. Tidak ada yang bisa dilihat orang lain dari tulisan Anda sampai kami membacanya dan memutuskan untuk menerbitkannya; kami juga dapat menyuntingnya, meminta Anda mengubahnya, atau menolaknya.',
          'Nama Anda diterbitkan bersama kisah itu hanya jika Anda mencentang kotak untuk menampilkannya. Jika tidak dicentang, nama Anda tidak disimpan sama sekali — bukan disembunyikan, bukan dihapus belakangan, tetapi memang tidak pernah ditulis. Pengenal perangkat Anda tidak pernah ditampilkan kepada pembaca. Kami menyimpannya hanya agar Anda dapat melihat status kiriman Anda sendiri dan agar satu perangkat tidak membanjiri antrean; pengenal itu tidak ada di halaman yang diterbitkan.',
          'Jika Anda mencantumkan nama, ingatlah bahwa kisah yang diterbitkan bersifat publik: siapa pun dapat membacanya, menyalinnya, dan mesin pencari dapat mengindeksnya. Setelah terbit, kami tidak dapat menarik kembali salinan yang sudah dibuat orang lain. Anda dapat meminta kami menghapus kisah Anda kapan saja dan kami akan menurunkannya, tetapi kami tidak dapat menjamin belum ada yang menyalinnya.',
          'Mohon jangan mencantumkan alamat, nomor telepon, nama lengkap majikan, atau apa pun yang dapat mengidentifikasi Anda atau keluarga tempat Anda bekerja. Jika ada, kami akan menghapusnya sebelum menerbitkan.',
        ],
      },
      {
        h: 'Penghitungan kunjungan',
        p: [
          'Halaman panduan publik menghitung kunjungan per hari dan per halaman. Angka ini disimpan sebagai total per halaman per hari, tanpa kaitan dengan individu mana pun, dan hanya dipakai untuk melihat halaman kosakata mana yang bermanfaat.',
        ],
      },
      {
        h: 'Iklan',
        p: [
          'Situs ini menampilkan iklan dari Google AdSense. Untuk itu, Google dan mitranya memuat skrip di halaman dan dapat menempatkan cookie atau membaca pengenal perangkat guna memilih dan mengukur iklan.',
          'Artinya, Google dan pengiklan yang bekerja dengannya dapat melihat alamat IP Anda, jenis browser, dan halaman mana yang Anda buka di situs ini. Ini berbeda dari bagian lain aplikasi ini yang dirancang untuk tidak melacak Anda, dan kami lebih memilih menyatakannya terus terang daripada menyembunyikannya.',
          'Anda dapat mengatur iklan yang dipersonalisasi di Setelan Iklan Google, dan Anda dapat menolak cookie iklan pihak ketiga melalui aboutads.info atau youronlinechoices.eu. Jika Anda berada di Kawasan Ekonomi Eropa, Inggris Raya, atau Swiss, akan muncul permintaan persetujuan sebelum cookie iklan digunakan, dan menolaknya tidak menghalangi Anda memakai aplikasi.',
          'Jika Anda sama sekali tidak ingin iklan, ekstensi browser yang memblokir iklan juga akan menghentikan skrip AdSense dimuat, dan aplikasi tetap berjalan normal tanpa itu.',
        ],
      },
      {
        h: 'Statistik',
        p: [
          'Situs ini juga menggunakan Google Analytics (GA4) untuk menghitung kunjungan. Untuk itu, Google memuat sebuah skrip di halaman, yang menempatkan cookie di browser Anda dan mengirim ke Google halaman-halaman yang Anda lihat, perkiraan lokasi Anda (menurut negara atau kota, bukan alamat lengkap), jenis perangkat dan browser yang Anda pakai, serta bagaimana Anda sampai ke situs ini.',
          'Cookie Google Analytics tidak terkait dengan nama Anda maupun dengan pengenal perangkat acak yang dipakai aplikasi ini untuk menyimpan kemajuan Anda. Skrip itu tidak dapat membaca jawaban kuis Anda, kata-kata yang Anda pelajari, umpan balik Anda, atau apa pun yang Anda tulis di sini. Fitur anonimisasi IP-nya aktif, sehingga alamat lengkap tidak disimpan.',
          'Ini berbeda dari bagian lain aplikasi ini yang memang dirancang untuk tidak melacak Anda, dan kami lebih memilih menyatakannya terus terang. Jika Anda tidak ingin dihitung, ekstensi browser yang memblokir analitik — atau mematikan Google Analytics di pengaturan peramban Anda — akan menghentikan skrip tersebut, dan aplikasi tetap berjalan normal. Yang hilang hanyalah angka statistiknya.',
        ],
      },
      {
        h: 'Notifikasi push',
        p: [
          'Dengan izin Anda, CantoBuddy dapat mengirim notifikasi peramban — pengingat lembut untuk berlatih, dan kabar bila ada cerita baru. Tidak ada yang dikirim sebelum Anda mengetuk "Aktifkan"; Anda tidak pernah diikutsertakan tanpa ditanya.',
          'Untuk mengirim notifikasi, peramban Anda memberi kami token (alamat endpoint ditambah dua kunci pendek). Kami menyimpannya hanya agar pesan sampai kepada Anda. Token itu tidak dihubungkan dengan nama, umpan balik, atau hal lain yang Anda lakukan di aplikasi, dan kami tidak pernah membaca isinya.',
          'Anda dapat mematikan notifikasi kapan saja: ketuk "Matikan" pada pil notifikasi di aplikasi, atau blokir notifikasi untuk situs ini di pengaturan peramban Anda. Mematikananya menghapus token dari server kami, sehingga tidak ada lagi pesan yang dapat dikirim ke perangkat tersebut.',
        ],
      },
      {
        h: 'Yang tidak pernah kami lakukan',
        p: [
          'Kami tidak menjual informasi pribadi Anda.',
          'Kami tidak memungut biaya apa pun dari seorang asisten. CantoBuddy gratis bagi pengguna, dan akan selalu gratis.',
          'Kami tidak memakai aktivitas belajar Anda untuk mengambil keputusan tentang pekerjaan Anda, dan kami tidak membagikannya kepada siapa pun kecuali pemberi kerja yang Anda undang secara jelas.',
        ],
      },
      {
        h: 'Anak-anak',
        p: [
          'CantoBuddy ditujukan untuk orang dewasa yang bekerja di Hong Kong. Aplikasi ini bukan untuk anak-anak, dan kami tidak dengan sengaja mengumpulkan informasi dari anak-anak.',
        ],
      },
      {
        h: 'Menghapus data Anda',
        p: [
          'Karena kemajuan Anda terikat pada pengenal acak yang tersimpan di browser Anda sendiri, menghapus data browser untuk situs ini akan menghapusnya dari perangkat Anda. Jika Anda ingin catatan di server kami dihapus, kirim pesan melalui tombol umpan balik di aplikasi dan sebutkan nama tampilan Anda. Kami akan menghapus catatan pengguna yang cocok.',
          'Pemberi kerja dapat meminta penghapusan akunnya kapan saja, dan kami akan melakukannya.',
        ],
      },
      {
        h: 'Perubahan kebijakan ini',
        p: [
          'Jika kebijakan ini berubah dengan cara yang memengaruhi Anda, kami akan memperbarui tanggal di bagian atas halaman ini. Terus memakai CantoBuddy setelah perubahan berarti Anda menerima kebijakan yang diperbarui.',
        ],
      },
      {
        h: 'Kontak',
        p: [
          'Untuk pertanyaan apa pun tentang kebijakan ini, atau untuk meminta data Anda dihapus, gunakan tombol umpan balik di dalam aplikasi. Kami membaca setiap pesan.',
        ],
      },
    ],
  },
};

/** The contact route named in the policy — the in-app feedback button. */
const PRIVACY_HREF = { en: '/privacy', fil: '/fil/privacy', zh: '/zh/privacy', id: '/id/privacy' };


/** Where a category page lives, in the right language tree. */
function catHref(cat, lang) {
  const prefix = LANG_PREFIX[lang] || '';
  return `${prefix}/learn/${slugify(cat.name_en)}`;
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

/**
 * Compact, self-contained stylesheet. The content pages deliberately do not
 * load public/styles.css (57 KB of app chrome) — these pages need to be fast
 * and paint without waiting on the SPA bundle. Same brand palette: red #e63946,
 * warm off-white, Noto Sans SC for the Cantonese glyphs.
 */
const PAGE_CSS = `
:root{--red:#e63946;--ink:#1d2733;--muted:#5b6b7c;--line:#e3e8ee;--bg:#fbfcfd}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif;
  -webkit-text-size-adjust:100%}
a{color:var(--red)}
.wrap{max-width:820px;margin:0 auto;padding:0 20px}
header.site{background:#fff;border-bottom:1px solid var(--line);padding:14px 0}
header.site .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{font-weight:700;font-size:19px;text-decoration:none;color:var(--ink);
  display:flex;align-items:center;gap:8px}
.brand .em{font-size:22px}
.cta{background:var(--red);color:#fff;text-decoration:none;font-weight:600;font-size:14px;
  padding:9px 16px;border-radius:999px;white-space:nowrap}
main{padding:34px 0 8px}
nav.crumbs{font-size:14px;color:var(--muted);margin-bottom:18px}
nav.crumbs a{color:var(--muted);text-decoration:none}
nav.crumbs a:hover{color:var(--red)}
nav.crumbs span.sep{margin:0 7px;opacity:.5}
h1{font-size:clamp(26px,4.6vw,36px);line-height:1.25;margin:0 0 10px;letter-spacing:-.01em}
h1 .sub{display:block;font-size:.62em;font-weight:500;color:var(--muted);margin-top:6px}
h2{font-size:21px;margin:34px 0 12px}
p.lede{font-size:17px;color:var(--muted);margin:0 0 26px;max-width:64ch}
/* Date tables (the statutory-holidays guide).
 *
 * Scoped to <article> on purpose: the level pages' vocabulary table is NOT in
 * an article, and an earlier unscoped table{} block here quietly added
 * vertical rules to it. The body sanitiser strips every attribute, so none of
 * this can rely on a class reaching the markup — element and structural
 * selectors only.
 *
 * A guide whose body is mostly a table also wants the full column: the 70ch
 * measure that makes prose readable turns three columns of dates and sentences
 * into a squeezed strip with a dead gutter beside it. The :has() exception is
 * progressive — without it the page keeps 70ch and the warm table below still
 * applies. */
article:has(table){max-width:none}
article table{width:100%;border-collapse:collapse;margin:22px 0 32px;font-size:15.5px}
article table th{background:#fff5f5;color:#c1121f;font-size:12px;font-weight:700;
  letter-spacing:.06em;text-transform:uppercase;text-align:left;padding:11px 14px;
  border-bottom:2px solid #f3c2c7}
article table td{padding:12px 14px;border:0;border-bottom:1px solid var(--line);
  vertical-align:top;line-height:1.55}
article table tbody tr:last-child td{border-bottom:0}
article table tbody tr:nth-child(even){background:#fffafa}
/* The date is what a reader scans for, so it carries the weight; the name
   labels it; the note explains it. */
article table td:first-child{white-space:nowrap;font-weight:700}
article table td:nth-child(2){font-weight:600}
article table td:nth-child(3){color:var(--muted);font-size:14.5px}
article table a{color:var(--red);text-decoration:none;border-bottom:1px solid rgba(230,57,70,.3)}
/* Year headings are the spine of this page, so they get the app's warm tick. */
article:has(table) h2{font-size:19px;margin:38px 0 14px;padding-bottom:9px;border-bottom:2px solid #f3c2c7}
/* The facts strip: the first list in a table-bearing article is the one
   holidays.js generates (the "See also" links come later). Three or four
   cards, so a phone reader gets the shape of their entitlement before the
   first table. */
article:has(table) ul:first-of-type{list-style:none;padding:0;margin:0 0 28px;
  display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}
article:has(table) ul:first-of-type li{background:#fff;border:1px solid #f3c2c7;border-radius:12px;
  padding:12px 14px;font-size:14px;line-height:1.5;color:var(--muted)}
article:has(table) ul:first-of-type li strong{display:block;color:var(--ink);font-size:15.5px;margin-bottom:2px}
@media (max-width:560px){
  /* Three columns of dates and sentences do not survive a 390px screen, so
     each row becomes a small stack, name first: "Labour Day / Friday, 1 May
     2026 / …". No colspan or class is needed — order and display do it. */
  article table,article table tbody{display:block}
  article table{margin:18px 0 26px;font-size:15px}
  article table thead{display:none}
  article table tr{display:flex;flex-direction:column;border-bottom:1px solid var(--line);padding:10px 0}
  article table tbody tr:last-child{border-bottom:0}
  article table tbody tr:nth-child(even){background:transparent}
  article table td{border:0;padding:3px 0}
  /* Repeated with the pseudo-class: the desktop rule that keeps a date on one
     line is MORE specific than a bare td, so without this the December row's
     two dates stay on one nowrap line and push the table 68px wide. */
  article table td:first-child{white-space:normal}
  article table td:nth-child(2){order:-1;font-size:16px}
  article table td:first-child{color:var(--red);font-weight:600;font-size:14.5px}
  article table td:nth-child(3){font-size:14px;margin-top:2px}
}
/* The coming-up festival. Red rather than neutral because it is the one thing
   on this page that changes with the calendar: a reader who arrives in October
   sees a different panel from one who arrives in February, and the colour has
   to say "this is new" before the words do. */
.fest-banner{background:linear-gradient(135deg,#fff5f5,#fff);border:1px solid #f3c2c7;
  border-left:5px solid #e63946;border-radius:14px;padding:20px 22px;margin:0 0 26px}
.fest-banner-kicker{margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.09em;
  text-transform:uppercase;color:#c1121f}
.fest-banner-title{margin:0 0 4px;font-size:23px}
.fest-banner-when{margin:0 0 10px;font-size:14px;font-weight:600;color:#c1121f}
.fest-banner-body{margin:0 0 14px;font-size:15px;color:var(--muted);max-width:60ch}
.fest-banner-words{list-style:none;margin:0 0 16px;padding:0;display:flex;flex-wrap:wrap;gap:10px}
.fest-banner-words li{display:flex;align-items:baseline;gap:7px;background:#fff;
  border:1px solid #f3c2c7;border-radius:999px;padding:7px 14px}
.fest-yue{font-family:"Noto Sans SC","PingFang HK","Microsoft JhengHei",sans-serif;
  font-size:18px;font-weight:500;white-space:nowrap}
.fest-jyut{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;color:var(--muted)}
@media (max-width:560px){.fest-banner-words li{flex:1 1 auto}}
/* Outings (/places): the photo-card hub and the long-form guide. */
.place-grid{list-style:none;padding:0;margin:0 0 26px;display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.place-card{margin:0;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden}
.place-card>a{display:block;height:100%;text-decoration:none;color:var(--ink)}
.place-card-img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#e9edf2}
.place-card-body{display:block;padding:12px 14px 16px}
.place-card-name{display:block;font-size:16px;line-height:1.35}
.place-card-zh{display:block;font-size:13px;color:var(--muted);margin-top:2px}
.place-card-meta{display:block;font-size:12.5px;color:var(--muted);margin-top:8px}
.place-card-sum{display:block;font-size:14px;color:var(--muted);line-height:1.5;margin-top:8px}
.place-card:hover{border-color:#f3c2c7;box-shadow:0 3px 14px rgba(29,39,51,.06)}
.place-figure{margin:0 0 22px}
.place-hero{display:block;width:100%;height:auto;max-height:420px;object-fit:cover;
  border-radius:14px;background:#e9edf2}
.place-figure figcaption{font-size:12.5px;color:var(--muted);margin-top:8px}
.place-figure figcaption p{margin:0}
.place-figure figcaption a{color:var(--muted)}
.place-facts{list-style:none;padding:0;margin:0 0 26px;display:flex;flex-wrap:wrap;gap:8px}
.place-facts li{background:#fff;border:1px solid var(--line);border-radius:999px;
  padding:6px 13px;font-size:13.5px}
.place-facts li strong{font-weight:600;color:var(--muted);font-size:12px;margin-right:5px}
.place-steps{list-style:none;counter-reset:step;padding:0;margin:0 0 30px;max-width:70ch}
.place-steps li{position:relative;padding:10px 0 10px 42px;border-bottom:1px solid var(--line);font-size:15.5px}
.place-steps li:before{counter-increment:step;content:counter(step);position:absolute;left:0;top:9px;
  width:26px;height:26px;border-radius:50%;background:#fff5f5;color:#c1121f;font-size:13px;
  font-weight:700;display:flex;align-items:center;justify-content:center}
.place-step-icon{margin-right:7px}
.place-fees{list-style:none;padding:0;margin:0 0 12px;max-width:52ch}
.place-fees li{display:flex;justify-content:space-between;gap:12px;padding:9px 0;
  border-bottom:1px solid var(--line);font-size:15.5px}
.place-fee-amt{font-weight:700;white-space:nowrap}
.place-fee-when{font-size:12px;color:var(--muted);margin-left:6px}
.place-free-note{font-size:17px;font-weight:600}
.place-oneway-note,.place-prices-note,.place-hours{font-size:14.5px;color:var(--muted)}
.place-tips{padding-left:22px;max-width:70ch}
.place-tips li{margin:0 0 8px}
.place-more{margin-top:38px;padding-top:22px;border-top:1px solid var(--line)}
.place-more h2{margin-top:0}
.place-more ul{list-style:none;padding:0;display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.place-more li a{display:block;background:#fff;border:1px solid var(--line);border-radius:10px;
  padding:10px 13px;text-decoration:none;font-weight:600;font-size:14.5px}
@media (max-width:620px){
  .place-grid,.place-more ul{grid-template-columns:1fr}
  .place-hero{max-height:260px}
}
.cta-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px 22px;
  display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;margin:26px 0}
.cta-card p{margin:0;color:var(--muted);font-size:15px;max-width:46ch}
/* Sharing an article. WhatsApp and Facebook are ordinary links, so this works
   with JavaScript off — the reader most likely to forward a link is on a phone
   with a hostile network, not a desktop with a fast one. */
.share-row{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:26px 0;max-width:70ch}
.share-ask{margin:0 0 12px;font-size:15px;font-weight:600;color:var(--ink)}
.share-actions{display:flex;flex-wrap:wrap;gap:10px}
.share-actions a,.share-actions button{display:inline-flex;align-items:center;justify-content:center;
  border-radius:999px;padding:9px 18px;font:inherit;font-size:14px;font-weight:600;text-decoration:none;cursor:pointer}
.share-wa{background:#25d366;color:#fff;border:1px solid #25d366}
.share-fb{background:#1877f2;color:#fff;border:1px solid #1877f2}
.share-copy{background:#fff;color:var(--ink);border:1px solid var(--line)}
.share-actions a:hover,.share-actions button:hover{filter:brightness(.94)}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);
  border-radius:12px;overflow:hidden;font-size:15px}
th,td{text-align:left;padding:11px 13px;border-bottom:1px solid var(--line);vertical-align:top}
th{background:#f4f7f9;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600}
tr:last-child td{border-bottom:none}
td.han{font-family:"Noto Sans SC","PingFang HK","Microsoft JhengHei",sans-serif;
  font-size:20px;font-weight:500;white-space:nowrap}
td.jy{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13.5px;color:var(--muted)}
td.em{font-size:20px;width:1%}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;
  list-style:none;padding:0;margin:0}
.grid li a{display:flex;align-items:center;gap:11px;background:#fff;border:1px solid var(--line);
  border-radius:12px;padding:14px 15px;text-decoration:none;color:var(--ink);font-weight:600;
  font-size:15px;height:100%}
.grid li a:hover{border-color:var(--red)}
.grid li a .em{font-size:21px;flex:none}
.grid li a .n{display:block;font-weight:400;font-size:13px;color:var(--muted);margin-top:2px}
.chip{display:inline-block;background:#fff;border:1px solid var(--line);border-radius:999px;
  padding:4px 12px;font-size:13px;color:var(--muted);text-decoration:none;margin:0 7px 7px 0}
a.chip:hover{border-color:var(--red);color:var(--red)}
.word-hero{background:#fff;border:1px solid var(--line);border-radius:16px;padding:26px;
  margin:0 0 26px;text-align:center;font-weight:400}
.word-hero .han{display:block;font-family:"Noto Sans SC","PingFang HK","Microsoft JhengHei",sans-serif;
  font-size:clamp(46px,10vw,68px);line-height:1.15;font-weight:500}
.word-hero .jy{display:block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--red);
  font-size:19px;margin-top:8px;font-weight:400}
.word-hero .gloss{display:block;font-size:21px;font-weight:600;margin-top:14px}
.word-hero .fil{display:block;color:var(--muted);font-size:16px;margin-top:5px;font-weight:400}
dl.meta{display:grid;grid-template-columns:auto 1fr;gap:8px 18px;margin:0;font-size:15px}
dl.meta dt{color:var(--muted)}
dl.meta dd{margin:0;font-weight:600}
/* The usage note and example sentence on a word page. These are the only
   blocks on the page that are NOT a template — the note is written per word,
   so it gets prose rhythm rather than the tight definition-list spacing. */
p.usage-note{max-width:66ch;font-size:16.5px;line-height:1.7;color:var(--ink);
  margin:0 0 4px;padding-left:15px;border-left:3px solid var(--red)}
figure.example{max-width:66ch;margin:0;padding:16px 18px;background:#fff;
  border:1px solid var(--line);border-radius:10px}
figure.example p{margin:0 0 6px}
figure.example p:last-child{margin-bottom:0}
figure.example .ex-yue{font-size:19px;font-weight:600;line-height:1.5}
figure.example .ex-jp{font-size:14px;color:var(--muted);letter-spacing:.01em}
figure.example .ex-en{font-size:15.5px;color:var(--ink)}
footer.site{border-top:1px solid var(--line);margin-top:44px;padding:24px 0 40px;
  color:var(--muted);font-size:14px}
footer.site a{color:var(--muted)}
/* The Facebook page gets its own line: a social profile buried in a long link
   run is the one thing a reader who came to say hello will not find. */
footer.site .site-social{margin-top:16px;font-size:15px}
footer.site .site-social a{color:var(--red);font-weight:600;text-decoration:none}
footer.site .site-social a:hover{text-decoration:underline}
/* Guides — long-form prose. The vocabulary pages are tables; these are articles,
   so they need real reading rhythm rather than the tight table spacing. */
article{max-width:70ch}
article p{margin:0 0 16px;line-height:1.7;font-size:16.5px}
article ul,article ol{margin:0 0 16px;padding-left:22px;line-height:1.7;font-size:16.5px}
article li{margin:0 0 8px}
article h2{font-size:21px;margin:34px 0 12px}
article a{color:var(--red);text-decoration:none;border-bottom:1px solid rgba(230,57,70,.3)}
article a:hover{border-bottom-color:var(--red)}
.guide-list{list-style:none;padding:0;margin:0;display:grid;gap:12px}
.guide-card a{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;
  padding:18px 20px;text-decoration:none;color:var(--ink)}
.guide-card a:hover{border-color:var(--red)}
.guide-card .em{font-size:24px;display:block;margin-bottom:8px}
.guide-card .gt{display:block;font-weight:700;font-size:17px;margin-bottom:5px;line-height:1.35}
.guide-card .gd{display:block;color:var(--muted);font-size:14.5px;line-height:1.55}
.faq{margin:0 0 16px}
.faq details{background:#fff;border:1px solid var(--line);border-radius:12px;
  padding:13px 16px;margin-bottom:9px}
.faq summary{font-weight:600;cursor:pointer;font-size:16px}
.faq summary::marker{color:var(--red)}
.faq p{margin:11px 0 0;color:var(--muted);font-size:15.5px;line-height:1.65}
p.updated{color:var(--muted);font-size:13.5px;margin-top:30px}
/* The contact form — the only form on the server-rendered pages, so it is
   written out rather than reusing app styles that never load here. It has to
   survive with JavaScript off: the form POSTs and the page redirects back. */
.contact-form{background:#fff;border:1px solid var(--line);border-radius:14px;
  padding:22px 22px 20px;margin:0 0 30px;max-width:620px}
.contact-form label{display:block;font-weight:600;font-size:14.5px;margin:0 0 6px}
.contact-form label .opt{font-weight:400;color:var(--muted)}
.contact-form textarea,.contact-form input{width:100%;font:inherit;font-size:15.5px;
  padding:11px 12px;border:1px solid #cfd8e3;border-radius:10px;background:#fff;
  color:var(--ink);margin:0 0 18px}
.contact-form textarea{resize:vertical;min-height:150px;line-height:1.6}
.contact-form textarea:focus,.contact-form input:focus{outline:2px solid rgba(230,57,70,.35);
  outline-offset:1px;border-color:var(--red)}
.contact-form button{font:inherit;font-weight:600;font-size:16px;padding:12px 26px;
  border:0;border-radius:999px;background:var(--red);color:#fff;cursor:pointer}
.contact-form button:hover{background:#c1121f}
/* Honeypot: parked far off-screen so a person can never see or reach it, but a
   bot that blindly fills every field will. The server drops any submission that
   arrives with it filled — no IP, no storage, the bot just thinks it sent. */
.contact-form .hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.contact-form .form-note{font-size:13.5px;color:var(--muted);margin:14px 0 0;line-height:1.55}
.sent-note{background:#f1f8f4;border:1px solid #cfe8d8;border-radius:12px;
  padding:18px 20px;margin:0 0 26px;line-height:1.65}
ul.links{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:9px}
ul.links li a{display:inline-block;background:#fff;border:1px solid var(--line);border-radius:999px;
  padding:7px 15px;font-size:14.5px;text-decoration:none;color:var(--ink)}
ul.links li a:hover{border-color:var(--red);color:var(--red)}
/* Discover feed */
h2.disc-h2{font-size:21px;margin:34px 0 6px}
h3.disc-h3{font-size:17px;margin:26px 0 8px}
/* The topic tag on a news card. A pill, because a topic is a bucket and a
   bucket should read as something you could also navigate by — which is what
   the nav below does. */
.pc-topic{display:inline-block;background:#fdeced;color:var(--red);border-radius:999px;
  padding:3px 11px;font-size:12.5px;font-weight:700;margin-bottom:9px}
/* Jump links to each topic section. Reuses the pill styling of ul.links so
   the page gains one visual idiom rather than two. */
nav.topic-nav ul{list-style:none;padding:0;margin:0 0 8px;display:flex;flex-wrap:wrap;gap:9px}
nav.topic-nav a{display:inline-block;background:#fff;border:1px solid var(--line);border-radius:999px;
  padding:7px 15px;font-size:14.5px;text-decoration:none;color:var(--ink)}
nav.topic-nav a:hover{border-color:var(--red);color:var(--red)}
.post-item .pm{display:block;color:var(--muted);font-size:12.5px;font-weight:600;
  letter-spacing:.03em;text-transform:uppercase;margin-bottom:5px}
/* The meta line inside a guide-card (the date and author on a Discover item, the
   date and byline on a story). It was only ever styled for .post-item, so the
   same markup inside a card fell back to body text — the one line on the card
   that is meant to be quiet was the loudest. */
.guide-card .pm{display:block;color:var(--muted);font-size:12.5px;font-weight:600;
  letter-spacing:.03em;text-transform:uppercase;margin-bottom:5px}
.post-source{margin-top:34px;padding-top:20px;border-top:1px solid var(--line)}
.post-source .btn{display:inline-block;background:var(--red);color:#fff;text-decoration:none;
  padding:11px 20px;border-radius:999px;font-weight:600;font-size:15.5px}
.post-source .btn:hover{background:#c1121f}
p.news-note{color:var(--muted);font-size:13px;margin-top:12px}
/* Stories. The gloss is the operator's hand-written English version of a story
   written in another language. It is set apart deliberately: a reader must be
   able to tell at a glance where her words end and someone else's begin. */
.story-gloss{margin-top:38px;padding-top:22px;border-top:1px solid var(--line)}
.story-gloss h2{margin-top:0}
/* Editorial retellings carry a clickable source. It is set apart from the
   story text so a reader can always tell where the reporting came from. */
.story-source{margin-top:32px;padding-top:18px;border-top:1px solid var(--line);font-size:.9rem;line-height:1.65;opacity:.9}
.story-source a{color:inherit;text-decoration:underline;text-underline-offset:2px}
@media(max-width:560px){
  td.jy{display:none}
  .cta-card{flex-direction:column;align-items:flex-start}
  .cta-card .cta{width:100%;text-align:center}
}
/* Today in Hong Kong page (server-rendered, no app styles loaded) */
.tk-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 14px}
.tk-cell{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.tk-label{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.tk-value{font-size:24px;font-weight:800;color:var(--ink)}
.tk-warn{margin:0 0 14px}
.tk-warn ul{margin:4px 0 0;padding-left:20px}
.tk-warn li{color:#a83a00;font-weight:600;margin:3px 0}
.tk-none{color:#1f7a3d;font-weight:600;margin:4px 0 0}
.tk-fore{margin:0 0 14px}
.tk-fore p{margin:4px 0 0;line-height:1.6}
.tk-hol{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:0 0 14px}
.tk-hol-name{font-size:17px;font-weight:800;color:var(--ink)}
.tk-hol-when{font-size:13px;color:var(--muted);margin-top:2px}
.tk-unavailable{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;
  padding:12px 14px;margin:0 0 14px;line-height:1.6}
@media(max-width:560px){.tk-grid{grid-template-columns:1fr}}
`;

/**
 * The landing-page beacon.
 *
 * These pages are static HTML with no app runtime, so before this a visitor
 * arriving from a search engine was invisible to every report the operator
 * had — which, for a site whose whole growth plan is search, is most of them.
 *
 * It mints the SAME device token the app uses ('dev_' + 36 hex), so a landing
 * visitor and an app user end up as ONE identity rather than two populations.
 * That is what makes "how many people visited" answerable at all.
 *
 * It writes a page view and a visit and nothing else — no path is tied to a
 * person (see visit_daily in db.js), because which page was read is useful to
 * know and who read it is not.
 *
 * Inline, ~1KB, non-blocking, and wrapped so that ANY failure — no
 * localStorage, no sendBeacon, no crypto — leaves the page exactly as it was.
 * Counting is never allowed to cost a reader the page.
 */
const VISIT_BEACON = `<script>
(function () {
  try {
    var KEY = 'cb_device';
    var id = null;
    try { id = localStorage.getItem(KEY); } catch (e) {}
    if (!id) {
      var b = new Uint8Array(18);
      crypto.getRandomValues(b);
      id = 'dev_' + Array.prototype.map.call(b, function (x) {
        return ('0' + x.toString(16)).slice(-2);
      }).join('');
      try { localStorage.setItem(KEY, id); } catch (e) {}
    }
    // First-touch referral, same rule as the app: whoever brought her here
    // is recorded once and never overwritten, so a later link cannot steal it.
    var ref = '';
    try {
      var p = new URLSearchParams(location.search);
      ref = (p.get('ref') || p.get('utm_source') || '').trim();
      if (ref && !localStorage.getItem('cb_ref')) {
        localStorage.setItem('cb_ref', ref.slice(0, 64));
      }
    } catch (e) {}
    var body = JSON.stringify({ path: location.pathname, public_id: id, ref: ref || undefined });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/visit', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      });
    }
    // W1.1: the SAME visit is also the first funnel step. funnel-client.js is
    // deferred, so it may not have executed yet — stash the call for it to
    // drain on load. Its per-device-per-HK-day dedupe means this can never
    // double-count against the client's own boot(), nor against a later open
    // of the SPA on this same origin.
    var fx = ['landing_view'];
    if (typeof window.cbFunnel === 'function') window.cbFunnel.apply(null, fx);
    else (window.__cbFunnelQ = window.__cbFunnelQ || []).push(fx);
  } catch (e) {}
})();
</script>`;

/**
 * Every language tree's copy of one page, as hreflang alternates.
 *
 * `pathFor(lang)` returns the path of this page in that language, or null when
 * the page has no counterpart there — a self-referential pair with no real
 * counterpart would be a lie, so those are simply left out.
 */
function hreflangLinks(pathFor) {
  const out = [];
  for (const lang of LANGS) {
    const p = pathFor(lang);
    if (p) out.push({ lang: L[lang].htmlLang, path: p });
  }
  // x-default tells a search engine which tree to serve when it cannot match
  // the searcher's language. English, because it is the one that is complete.
  const def = pathFor('en');
  if (def) out.push({ lang: 'x-default', path: def });
  return out;
}

/**
 * Build a full HTML document.
 * @param {object} o  {lang,title,description,path,jsonLd,body,noindex,alternates,canonicalPath}
 */
function page(o) {
  const lang = LANGS.includes(o.lang) ? o.lang : 'en';
  // canonicalPath is an override for a page that is a genuine duplicate of
  // another URL rather than a document in its own right — the untranslated post
  // variants, which are the English article served at a second address. See
  // isTranslated().
  const canonical = `${SITE_ORIGIN}${o.canonicalPath || o.path}`;

  // hreflang alternates. Emitted only when the caller supplies a real set —
  // a self-referential pair with no real counterpart would be a lie.
  const alt = (o.alternates || [])
    .map((a) => `<link rel="alternate" hreflang="${esc(a.lang)}" href="${esc(SITE_ORIGIN + a.path)}" />`)
    .join('\n  ');

  const OG_LOCALE = { en: 'en_HK', fil: 'fil_PH', zh: 'zh_CN', id: 'id_ID' };

  // A 512px app icon was the social card for EVERY server-rendered page.
  // WhatsApp and Facebook render that as a tiny square in the middle of a
  // wide card, so an article someone forwards looks like an app advert rather
  // than a story. Article pages supply a real 1280px Hong Kong photograph;
  // o.ogImage keeps the icon as the fallback for pages with no natural image.
  const ogImage = o.ogImage || `${SITE_ORIGIN}/icons/icon-512.png`;
  const ogImageAlt = o.ogImageAlt || 'CantoBuddy — free Cantonese for helpers in Hong Kong';

  return `<!DOCTYPE html>
<html lang="${esc(L[lang].htmlLang)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(o.title)}</title>
  <meta name="description" content="${esc(o.description)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  ${o.noindex ? '<meta name="robots" content="noindex, follow" />' : '<meta name="robots" content="index, follow" />'}
  ${GOOGLE_VERIFICATION ? `<meta name="google-site-verification" content="${esc(GOOGLE_VERIFICATION)}" />` : ''}
  ${ADSENSE_SNIPPET}
  ${GA_SNIPPET}
  ${FUNNEL_SNIPPET}
  ${alt}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="CantoBuddy" />
  <meta property="og:title" content="${esc(o.title)}" />
  <meta property="og:description" content="${esc(o.description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="${esc(ogImage)}" />
  <meta property="og:image:alt" content="${esc(ogImageAlt)}" />
  <meta property="og:locale" content="${OG_LOCALE[lang]}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(o.title)}" />
  <meta name="twitter:description" content="${esc(o.description)}" />
  <meta name="twitter:image" content="${esc(ogImage)}" />
  <meta name="twitter:image:alt" content="${esc(ogImageAlt)}" />
  <meta name="theme-color" content="#e63946" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>${PAGE_CSS}</style>
  <script type="application/ld+json">${JSON.stringify(o.jsonLd || {})}</script>
</head>
<body data-seo-page="1">
<header class="site">
  <div class="wrap">
  <a class="brand" href="${esc(o.brandHref || appHomeHref(lang))}" aria-label="CantoBuddy — ${esc(L[lang].home || 'Home')}"><span class="em">🦜</span>CantoBuddy</a>
  <a class="cta" data-funnel-cta href="${esc(o.ctaHref || appHomeHref(lang))}">${esc(L[lang].openApp)}</a>
  </div>
</header>
<main>
  <div class="wrap">
${o.body}
  </div>
</main>
<footer class="site">
  <div class="wrap">
    <p>${esc(L[lang].footerNote)}</p>
    <p>${languageLinks(lang)}
       &nbsp;·&nbsp; <a href="${LANG_PREFIX[lang]}/learn">${esc(L[lang].browse)}</a>
       &nbsp;·&nbsp; <a href="${LANG_PREFIX[lang]}/guide">${esc((GUIDE_UI[lang] || GUIDE_UI.en).guides)}</a>
       &nbsp;·&nbsp; <a href="${LANG_PREFIX[lang]}/discover">${esc(L[lang].discover)}</a>
       &nbsp;·&nbsp; <a href="${LANG_PREFIX[lang]}/stories">${esc((STORIES_UI[lang] || STORIES_UI.en).title)}</a>
       &nbsp;·&nbsp; <a href="${LANG_PREFIX[lang]}/privacy">${esc(PRIVACY[lang].title)}</a>
       &nbsp;·&nbsp; <a href="${FOR_EMPLOYERS_HREF[lang]}">${esc(FOR_EMPLOYERS_LABEL[lang])}</a>
       &nbsp;·&nbsp; <a href="/about">About Us</a>
       &nbsp;·&nbsp; <a href="/contact">Contact Us</a>
       &nbsp;·&nbsp; <a href="/terms">Terms of Service</a>
       &nbsp;·&nbsp; <a href="/disclaimer">Disclaimer</a>
       &nbsp;·&nbsp; <a href="/articles">Articles &amp; Guides</a>
       &nbsp;·&nbsp; <a href="/cantonese-for-domestic-helpers">For helpers</a>
       &nbsp;·&nbsp; <a href="/cantonese-food-phrases">Food phrases</a>
       &nbsp;·&nbsp; <a href="/cantonese-for-elderly-learners">Elderly learners</a>
       &nbsp;·&nbsp; <a href="/cantonese-for-health-emergencies">Health</a></p>
    <p class="site-social">📘 ${FACEBOOK_LINK}</p>
  </div>
</footer>
${VISIT_BEACON}
<script src="/push-client.js" defer></script>
<script>
/* "Copy link" on an article's share row. Delegated, so it works for any number
   of rows and never runs on pages without one. The Clipboard API needs HTTPS;
   on an old WebView the two share LINKS above still work with JS disabled. */
document.addEventListener('click', function (e) {
  var b = e.target && e.target.closest ? e.target.closest('[data-copy]') : null;
  if (!b) return;
  function done() { b.textContent = b.getAttribute('data-done'); }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(b.getAttribute('data-copy')).then(done, function () {});
  }
});
</script>
</body>
</html>`;
}

/**
 * The language switcher in the footer, listing every tree BUT the current one.
 *
 * Written in each target language's OWN name (endonym), so a reader who has
 * landed in a language she cannot read can still find her way out — "中文" is
 * recognisable to a Mandarin speaker in a way that "Chinese" is not.
 *
 * This used to read `L[l].chinese || L[l].filipino || l`, which was a real bug:
 * `chinese` is '中文' in EVERY dictionary, so an English page rendered
 * "中文 · 中文" — two identical links, one of them pointing at Filipino and
 * labelled Chinese. A language switcher whose labels are wrong is worse than
 * no switcher, and it is also a crawl path between the language trees.
 */
const LANG_ENDONYM = { en: 'English', fil: 'Filipino', zh: '中文', id: 'Bahasa Indonesia' };

function languageLinks(current) {
  return LANGS.filter((l) => l !== current)
    .map((l) => `<a href="${LANG_PREFIX[l]}/learn" hreflang="${L[l].htmlLang}">${esc(LANG_ENDONYM[l] || l)}</a>`)
    .join(' &nbsp;·&nbsp; ');
}

/** Shared CTA block linking back into the SPA. */
function ctaCard(lang, extra, href) {
  const t = L[lang];
  const to = href || '/';
  return `<div class="cta-card">
    <p>${esc(t.openAppDesc)}</p>
    <a class="cta" href="${esc(to)}">${esc(t.openApp)}</a>
  </div>`;
}

function crumbs(lang, trail) {
  const t = L[lang];
  const parts = [`<a href="${LANG_PREFIX[lang]}/learn">${esc(t.learn)}</a>`];
  for (const c of trail) {
    parts.push(c.href ? `<a href="${esc(c.href)}">${esc(c.label)}</a>` : `<span>${esc(c.label)}</span>`);
  }
  return `<nav class="crumbs" aria-label="Breadcrumb">${parts.join('<span class="sep">›</span>')}</nav>`;
}

/** The word "words" in the page's language, for the count labels. */
function wordUnit(lang) {
  if (lang === 'fil') return 'salita';
  if (lang === 'zh') return '个词';
  if (lang === 'id') return 'kata';
  return 'words';
}

/** The meaning of an entry in the page's language, for tables and cards. */
function glossOf(w, lang) {
  if (lang === 'zh') return w.mandarin || w.english || '';
  if (lang === 'fil') return w.tagalog || w.english || '';
  if (lang === 'id') return w.indonesian || w.english || '';
  return w.english || '';
}

/**
 * Vocabulary table. `linkWords` turns the meaning column into internal links.
 *
 * The columns are the same in every language tree — Cantonese, Jyutping, then
 * the meaning — because the meaning column is the only thing that changes. A
 * language-specific column layout would mean three separate tables to keep in
 * sync, and the hreflang work assumes the pages are the same document in
 * different languages.
 */
function vocabTable(rows, lang, linkWords) {
  const t = L[lang];
  const trs = rows
    .map((w) => {
      // The linking language is always English, so the target page is the
      // English tree's — a zh reader following the link gets the word page
      // rather than a fourth tree that does not exist.
      const primary = linkWords && w.slug
        ? `<a href="/words/${esc(w.slug)}">${esc(glossOf(w, lang))}</a>`
        : esc(glossOf(w, lang));
      // The English meaning underneath, except on the English tree where it
      // would just be the same string twice.
      const second = lang === 'en'
        ? (w.tagalog ? `<br /><span style="color:var(--muted);font-size:13.5px">${esc(w.tagalog)}</span>` : '')
        : `<br /><span style="color:var(--muted);font-size:13.5px">${esc(w.english)}</span>`;
      return `<tr>
      <td class="em">${esc(w.emoji || '')}</td>
      <td class="han">${esc(w.cantonese)}</td>
      <td class="jy">${esc(w.jyutping)}</td>
      <td>${primary}${second}</td>
    </tr>`;
    })
    .join('\n');

  return `<table>
  <thead><tr>
    <th aria-label="Icon"></th>
    <th>${esc(t.cantonese)}</th>
    <th>${esc(t.jyutping)}</th>
    <th>${esc(t.meaning)}</th>
  </tr></thead>
  <tbody>
${trs}
  </tbody>
</table>`;
}

// ---------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------

const ORG_LD = {
  '@type': 'EducationalOrganization',
  name: 'CantoBuddy',
  url: SITE_ORIGIN,
  logo: `${SITE_ORIGIN}/icons/icon-512.png`,
  description:
    'A free Cantonese learning app for Filipino and Indonesian domestic helpers in Hong Kong: practical vocabulary with audio, pictures and quizzes.',
  areaServed: { '@type': 'Place', name: 'Hong Kong' },
  audience: { '@type': 'Audience', audienceType: 'Filipino and Indonesian domestic helpers' },
  // sameAs is the one field that tells a search engine which social profile is
  // actually ours rather than a fan page or a name collision. Every server-
  // rendered page embeds ORG_LD, so one line here covers the whole SEO tree.
  sameAs: [FACEBOOK_URL],
  // The address already used as the site's VAPID subject. A ContactPage that
  // names no address at all is a weaker trust signal for both readers and
  // reviewers, so the publisher's address belongs in the organisation node
  // that every server-rendered page carries.
  email: 'hello@cantobuddy.com',
};

function breadcrumbLd(trail) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: `${SITE_ORIGIN}${t.path}`,
    })),
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/** Resolve a category slug (English name) to its row. */
function findCategoryBySlug(slug) {
  const cats = store.listEnabledCategories();
  return cats.find((c) => slugify(c.name_en) === slug) || null;
}

function wordSlugFor(id) {
  const { bySlug } = buildWordIndex();
  for (const [slug, w] of bySlug) if (w.id === id) return slug;
  return null;
}

/** Attach slugs to vocabulary rows for internal linking. */
function withSlugs(rows) {
  const { bySlug } = buildWordIndex();
  const idToSlug = new Map();
  for (const [slug, w] of bySlug) idToSlug.set(w.id, slug);
  return rows.map((w) => ({ ...w, slug: idToSlug.get(w.id) }));
}

/** The /learn hub: every category and every level. */
function renderLearnHub(lang) {
  const t = L[lang];
  const cats = store.listEnabledCategories();
  const total = store.listVocabulary({ enabledOnly: true }).length;
  const prefix = LANG_PREFIX[lang] || '';

  const catItems = cats
    .map((c) => {
      const n = store.listVocabulary({ category_id: c.id, enabledOnly: true }).length;
      return `<li><a href="${catHref(c, lang)}">
        <span class="em">${esc(c.icon || '📘')}</span>
        <span>${esc(catName(c, lang))}<span class="n">${n} ${wordUnit(lang)}</span></span>
      </a></li>`;
    })
    .join('\n');

  const levelItems = Object.keys(LEVELS)
    .map((n) => {
      const count = store.listVocabulary({ level: Number(n), enabledOnly: true }).length;
      return `<li><a href="${prefix}/level/${n}">
        <span class="em">${n === '1' ? '🌱' : n === '2' ? '🌿' : '🌳'}</span>
        <span>${esc(levelName(Number(n), lang))}<span class="n">${count} ${wordUnit(lang)}</span></span>
      </a></li>`;
    })
    .join('\n');

  const guideItems = GUIDES.map(
    (g) => `<li><a href="${prefix}/guide/${esc(g.slug)}">
        <span class="em">${esc(g.icon)}</span>
        <span>${esc(guideText(g.title, lang))}<span class="n">${esc(guideText(g.description, lang))}</span></span>
      </a></li>`
  ).join('\n');

  const body = `
${crumbs(lang, [{ label: t.browse }])}
${festivalBanner(lang)}
<h1>${esc(t.browse)}<span class="sub">${esc(t.tagline)}</span></h1>
<p class="lede">${esc(t.hubLede(total, cats.length))}</p>

<h2>${esc(t.categories)}</h2>
<ul class="grid">
${catItems}
</ul>

<h2>${esc(t.levels)}</h2>
<ul class="grid">
${levelItems}
</ul>

<h2>${esc((GUIDE_UI[lang] || GUIDE_UI.en).guides)}</h2>
<ul class="grid">
${guideItems}
</ul>
${ctaCard(lang)}
`;

  const TITLE = {
    en: `Cantonese Vocabulary — ${total} Words for Helpers in Hong Kong | CantoBuddy`,
    fil: `Bokabularyong Cantonese — ${total} salita para sa mga helper sa Hong Kong | CantoBuddy`,
    zh: `${total} 个香港粤语常用词 — 粤语学习词汇表 | CantoBuddy`,
    id: `Kosakata Bahasa Kanton — ${total} Kata untuk Asisten Rumah Tangga di Hong Kong | CantoBuddy`,
  };
  const DESC = {
    en: `Browse ${total} practical Cantonese words across ${cats.length} categories, with Jyutping romanisation and English and Filipino meanings.`,
    fil: `Tingnan ang ${total} praktikal na salitang Cantonese sa ${cats.length} kategorya, may Jyutping at kahulugan sa Filipino at Ingles.`,
    zh: `浏览 ${total} 个实用粤语词汇，分为 ${cats.length} 个日常分类，配有粤拼读音和中文意思。适合在香港生活、想学广东话的普通话使用者。`,
    id: `Jelajahi ${total} kata Kanton praktis dalam ${cats.length} kategori, lengkap dengan romanisasi Jyutping dan arti dalam bahasa Indonesia dan Inggris.`,
  };
  const title = TITLE[lang];
  const description = DESC[lang];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG_LD,
      breadcrumbLd([{ name: t.learn, path: `${prefix}/learn` }]),
      {
        '@type': 'CollectionPage',
        name: title,
        description,
        url: `${SITE_ORIGIN}${prefix}/learn`,
        inLanguage: L[lang].htmlLang,
        about: { '@type': 'Thing', name: 'Cantonese language' },
      },
    ],
  };

  return page({
    lang,
    title,
    description,
    path: `${prefix}/learn`,
    jsonLd,
    body,
    alternates: hreflangLinks((l) => `${LANG_PREFIX[l]}/learn`),
  });
}

/** One category page: all of its words, rendered as HTML. */
function renderCategory(lang, slug) {
  const t = L[lang];
  const cat = findCategoryBySlug(slug);
  if (!cat) return null;

  const rows = withSlugs(store.listVocabulary({ category_id: cat.id, enabledOnly: true }));
  const name = catName(cat, lang);
  const prefix = LANG_PREFIX[lang] || '';

  const byLevel = Object.keys(LEVELS)
    .map((n) => rows.filter((w) => w.level === Number(n)))
    .map((group, i) =>
      group.length
        ? `<h2>${esc(levelName(i + 1, lang))}</h2>\n${vocabTable(group, lang, true)}`
        : ''
    )
    .filter(Boolean)
    .join('\n');

  // The sub-line and the title parenthetical show the name in the OTHER script:
  // the Cantonese name for en/fil readers, and the Simplified Mandarin name for
  // a zh reader. Showing 長者照顧 in Traditional on the /zh/ page would be the
  // wrong script for the audience the page is written for.
  const altName = lang === 'zh' ? (cat.name_zh || '') : (cat.name_yue || '');

  const body = `
${crumbs(lang, [
    { label: t.categories, href: `${prefix}/learn` },
    { label: name },
  ])}
<h1>${esc(name)}<span class="sub">${esc(altName)} · ${esc(t.tagline)}</span></h1>
<p class="lede">${esc(t.aboutBody(name, rows.length))}</p>
${byLevel}
${ctaCard(lang)}
`;

  const TITLE = {
    en: `${name} in Cantonese — ${rows.length} Words (${altName}) | CantoBuddy`,
    fil: `${name} sa Cantonese — ${rows.length} salita (${altName}) | CantoBuddy`,
    zh: `${name}粤语怎么说 — ${rows.length} 个常用词 (${altName}) | CantoBuddy`,
    id: `${name} dalam Bahasa Kanton — ${rows.length} Kata (${altName}) | CantoBuddy`,
  };
  const DESC = {
    en: `Learn ${rows.length} practical Cantonese ${name.toLowerCase()} words with Jyutping romanisation and English and Filipino meanings — free.`,
    fil: `${rows.length} praktikal na salitang Cantonese para sa ${name.toLowerCase()}, may Jyutping at kahulugan sa Filipino at Ingles.`,
    zh: `${rows.length} 个实用的${name}粤语词汇，配粤拼读音和中文意思。香港日常生活常用的广东话，免费学习。`,
    id: `Pelajari ${rows.length} kata Kanton praktis untuk ${name.toLowerCase()}, lengkap dengan romanisasi Jyutping dan arti dalam bahasa Indonesia dan Inggris — gratis.`,
  };
  const title = TITLE[lang];
  const description = DESC[lang];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG_LD,
      breadcrumbLd([
        { name: t.learn, path: `${prefix}/learn` },
        { name, path: `${prefix}/learn/${slug}` },
      ]),
      {
        '@type': 'LearningResource',
        name: title,
        description,
        url: `${SITE_ORIGIN}${prefix}/learn/${slug}`,
        inLanguage: L[lang].htmlLang,
        learningResourceType: 'Vocabulary list',
        educationalLevel: 'Beginner to advanced',
        teaches: `${name} vocabulary in Cantonese`,
        isAccessibleForFree: true,
        numberOfItems: rows.length,
        provider: ORG_LD,
      },
    ],
  };

  return page({
    lang,
    title,
    description,
    path: `${prefix}/learn/${slug}`,
    jsonLd,
    body,
    alternates: hreflangLinks((l) => `${LANG_PREFIX[l]}/learn/${slug}`),
  });
}

/** One word page. */
function renderWord(lang, slug) {
  const t = L[lang];
  const { bySlug } = buildWordIndex();
  const w = bySlug.get(slug);
  if (!w) return null;

  const cat = store.getCategory(w.category_id);
  const name = catName(cat, lang);
  const prefix = LANG_PREFIX[lang] || '';
  const catUrl = cat ? catHref(cat, lang) : `${prefix}/learn`;

  const related = withSlugs(
    store.listVocabulary({ category_id: w.category_id, enabledOnly: true }).filter((r) => r.id !== w.id)
  ).slice(0, 12);

  const relatedBlock = related.length
    ? `<h2>${esc(t.relatedIn(name))}</h2>
<ul class="grid">
${related
  .map(
    (r) => `<li><a href="${prefix}/words/${esc(r.slug)}">
    <span class="em">${esc(r.emoji || '')}</span>
    <span class="han" style="font-family:'Noto Sans SC',sans-serif">${esc(r.cantonese)}<span class="n">${esc(glossOf(r, lang))}</span></span>
  </a></li>`
  )
  .join('\n')}
</ul>`
    : '';

  const gloss = glossOf(w, lang);

  /* "In Filipino" on the English page must show the FILIPINO gloss.
   *
   * It rendered w.english instead, so on a site built for Filipino helpers the
   * one gloss that audience actually needs was replaced by the English they
   * already understood. All 334 words carry a tagalog value and 323 of them
   * differ from the English — so this was wrong on almost every page. It
   * survived because 11 words happen to have tagalog === english
   * (Chrysanthemum, Mooncake), and a spot-check landed on one of them.
   *
   * The fil/zh/id trees keep w.english, because their label genuinely reads
   * "In English" (Sa Ingles / 英文 / Dalam bahasa Inggris) — there the English
   * gloss is the correct answer, not a mistake.
   *
   * Falls back to the English when a word has no tagalog, so the row never
   * renders empty. */
  const otherGloss = lang === 'en' ? (String(w.tagalog || '').trim() || w.english) : w.english;

  /* THE UNIQUE PROSE THIS PAGE ALREADY HAD AND WAS THROWING AWAY.
   *
   * Without this block a word page carried exactly one sentence of prose, and
   * that sentence was a template: "<word> in Cantonese is <hanzi>, pronounced
   * <jyutping>. It belongs to the <category> group…". Substituting four
   * variables does not make 334 pages distinct, and Search Console said so
   * plainly — 268 word URLs sat in "Discovered - currently not indexed" with
   * "Last crawled: N/A", i.e. Google read the sitemap, looked at the cluster,
   * and declined to spend budget on any of it.
   *
   * Meanwhile `usage_note` — the one field per word that is genuinely written
   * by a human and genuinely differs ("The flower of the ninth month, so it
   * belongs to Chongyang. Also the flower left at a grave — which is why it is
   * not a flower you give someone for a birthday.") — was rendered NOWHERE.
   * Not here, not in the app. 67 words carry one and none of it reached a
   * crawler.
   *
   * The notes are English-only; the app's own convention is that a missing
   * translation falls back to English rather than to nothing, so a Filipino or
   * Chinese reader sees the English note under a localised heading. That is
   * honest and it is strictly more than she got before.
   *
   * Words with neither a note nor an example still render without this block —
   * no empty heading, no placeholder text. */
  const usageNote = String(w.usage_note || '').trim();
  const exampleYue = String(w.example_yue || '').trim();
  const exampleJp = String(w.example_jyutping || '').trim();
  const exampleEn = String(w.example_en || '').trim();
  const hasExample = Boolean(exampleYue || exampleEn);

  const usageBlock = usageNote
    ? `<h2>${esc(t.howToUse)}</h2>
<p class="usage-note">${esc(usageNote)}</p>`
    : '';

  const exampleBlock = hasExample
    ? `<h2>${esc(t.example)}</h2>
<figure class="example">
  ${exampleYue ? `<p class="ex-yue" lang="yue">${esc(exampleYue)}</p>` : ''}
  ${exampleJp ? `<p class="ex-jp">${esc(exampleJp)}</p>` : ''}
  ${exampleEn ? `<p class="ex-en">${esc(exampleEn)}</p>` : ''}
</figure>`
    : '';

  const body = `
${crumbs(lang, [
    { label: t.categories, href: `${prefix}/learn` },
    { label: name, href: catUrl },
    { label: gloss },
  ])}
<h1 class="word-hero">
  <span class="han">${esc(w.cantonese)}</span>
  <span class="jy">${esc(w.jyutping)}</span>
  <span class="gloss">${esc(gloss)}</span>
  ${lang === 'en'
      ? (w.tagalog ? `<span class="fil">${esc(w.tagalog)}</span>` : '')
      : `<span class="fil">${esc(w.english)}</span>`}
</h1>
<p class="lede">${esc(t.wordBody(w.cantonese, w.jyutping, gloss, name))}</p>
<dl class="meta">
  <dt>${esc(t.cantonese)}</dt><dd>${esc(w.cantonese)}</dd>
  <dt>${esc(t.pronunciation)}</dt><dd>${esc(w.jyutping)}</dd>
  <dt>${esc(t.meaning)}</dt><dd>${esc(gloss)}</dd>
  <dt>${esc(t.alsoSaid)}</dt><dd>${esc(otherGloss)}</dd>
  ${w.mandarin && lang !== 'zh' ? `<dt>${esc(t.chinese || '中文')}</dt><dd lang="zh-Hans">${esc(w.mandarin)}</dd>` : ''}
  <dt>${esc(t.levelLabel)}</dt><dd><a href="${prefix}/level/${w.level}">${esc(levelName(w.level, lang))}</a></dd>
  <dt>${esc(t.categoryLabel)}</dt><dd><a href="${esc(catUrl)}">${esc(name)}</a></dd>
</dl>
${usageBlock}
${exampleBlock}
${ctaCard(lang)}
${relatedBlock}
`;

  const TITLE = {
    en: `${w.english} in Cantonese — ${w.cantonese} (${w.jyutping}) | CantoBuddy`,
    fil: `${w.english} sa Cantonese — ${w.cantonese} (${w.jyutping}) | CantoBuddy`,
    zh: `${w.cantonese} 粤语怎么说 — ${gloss} (${w.jyutping}) | CantoBuddy`,
    id: `${gloss} dalam Bahasa Kanton — ${w.cantonese} (${w.jyutping}) | CantoBuddy`,
  };
  const DESC = {
    en: `${w.english} in Cantonese is ${w.cantonese} (${w.jyutping}). Learn this ${name.toLowerCase()} word with audio and quizzes — free for helpers in Hong Kong.`,
    fil: `${w.english} sa Cantonese ay ${w.cantonese}, binibigkas na ${w.jyutping}. Kasama sa ${name.toLowerCase()}.`,
    zh: `${gloss}的粤语是${w.cantonese}，读作 ${w.jyutping}。属于${name}类，附发音和测验，免费学习。`,
    id: `${gloss} dalam bahasa Kanton adalah ${w.cantonese}, diucapkan ${w.jyutping}. Termasuk kelompok ${name.toLowerCase()} — belajar gratis dengan audio dan kuis.`,
  };
  const title = TITLE[lang];
  const description = DESC[lang];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG_LD,
      breadcrumbLd([
        { name: t.learn, path: `${prefix}/learn` },
        { name, path: cat ? `${prefix}/learn/${slugify(cat.name_en)}` : `${prefix}/learn` },
        { name: gloss, path: `${prefix}/words/${slug}` },
      ]),
      {
        '@type': 'DefinedTerm',
        name: gloss,
        alternateName: w.cantonese,
        description: `${gloss} in Cantonese is ${w.cantonese}, pronounced ${w.jyutping}.`,
        inLanguage: 'yue',
        url: `${SITE_ORIGIN}${prefix}/words/${slug}`,
        inDefinedTermSet: { '@type': 'DefinedTermSet', name: `CantoBuddy ${name} vocabulary` },
      },
    ],
  };

  return page({
    lang,
    title,
    description,
    path: `${prefix}/words/${slug}`,
    jsonLd,
    body,
    alternates: hreflangLinks((l) => `${LANG_PREFIX[l]}/words/${slug}`),
  });
}

/** One level page. */
function renderLevel(lang, level) {
  const t = L[lang];
  const n = Number(level);
  if (!LEVELS[n]) return null;

  const rows = withSlugs(store.listVocabulary({ level: n, enabledOnly: true }));
  const name = levelName(n, lang);
  const prefix = LANG_PREFIX[lang] || '';

  const cats = store.listEnabledCategories();
  const present = cats.filter((c) => rows.some((w) => w.category_id === c.id));
  const chips = present
    .map((c) => `<a class="chip" href="${catHref(c, lang)}">${esc(c.icon || '')} ${esc(catName(c, lang))}</a>`)
    .join('');

  const body = `
${crumbs(lang, [{ label: t.levels, href: `${prefix}/learn` }, { label: name }])}
<h1>${esc(name)} Cantonese<span class="sub">${esc(LEVELS[n].yue)} · ${esc(t.tagline)}</span></h1>
<p class="lede">${esc(LEVELS[n].blurb)}</p>
<h2>${esc(t.categories)}</h2>
<p>${chips}</p>
<h2>${esc(t.allWords(rows.length))}</h2>
${vocabTable(rows, lang, true)}
${ctaCard(lang)}
`;

  const TITLE = {
    en: `${name} Cantonese — ${rows.length} Words | CantoBuddy`,
    fil: `${name} Cantonese — ${rows.length} salita | CantoBuddy`,
    zh: `${name}粤语 — ${rows.length} 个常用词 | CantoBuddy`,
    id: `Bahasa Kanton ${name} — ${rows.length} Kata | CantoBuddy`,
  };
  const DESC = {
    en: `${LEVELS[n].blurb} ${rows.length} Cantonese words with Jyutping and English and Filipino meanings.`,
    fil: `${LEVELS[n].blurb} ${rows.length} salitang Cantonese na may Jyutping at kahulugan sa Filipino.`,
    zh: `${LEVELS[n].blurb} 共 ${rows.length} 个粤语词，配粤拼读音和中文意思。`,
    id: `${LEVELS[n].blurb} ${rows.length} kata Kanton dengan Jyutping dan arti dalam bahasa Indonesia.`,
  };
  const title = TITLE[lang];
  const description = DESC[lang];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG_LD,
      breadcrumbLd([
        { name: t.learn, path: `${prefix}/learn` },
        { name, path: `${prefix}/level/${n}` },
      ]),
      {
        '@type': 'LearningResource',
        name: title,
        description,
        url: `${SITE_ORIGIN}${prefix}/level/${n}`,
        inLanguage: L[lang].htmlLang,
        learningResourceType: 'Vocabulary list',
        educationalLevel: name,
        isAccessibleForFree: true,
        numberOfItems: rows.length,
        provider: ORG_LD,
      },
    ],
  };

  return page({
    lang,
    title,
    description,
    path: `${prefix}/level/${n}`,
    jsonLd,
    body,
    alternates: hreflangLinks((l) => `${LANG_PREFIX[l]}/level/${n}`),
  });
}

/* ---------------------------------------------------------------------------
   Guides — the long-form content layer.

   The vocabulary pages answer "how do you say X in Cantonese". These answer
   the question behind it: "how do I actually learn this for my job". That is
   the query this audience types, and it is the one the ranking pages on live
   search are written for. See content.js for why.

   Kept in a separate module so seo.js stays about rendering.
   --------------------------------------------------------------------------- */

/** UI strings for the guide pages, in the reader's language. */
const GUIDE_UI = {
  en: { guides: 'Guides', faq: 'Frequently asked questions', updated: 'Updated', seeAlso: 'See also' },
  fil: { guides: 'Mga gabay', faq: 'Mga madalas itanong', updated: 'Na-update', seeAlso: 'Tingnan din' },
  zh: { guides: '学习指南', faq: '常见问题', updated: '更新于', seeAlso: '相关' },
  id: { guides: 'Panduan', faq: 'Pertanyaan yang sering diajukan', updated: 'Diperbarui', seeAlso: 'Lihat juga' },
};

/** Pick a per-language field off a guide, falling back to English. */
function guideText(obj, lang) {
  if (!obj) return '';
  return obj[lang] || obj.en || '';
}

/** The guide hub: every guide, listed. */
function renderGuideHub(lang) {
  const t = L[lang];
  const ui = GUIDE_UI[lang] || GUIDE_UI.en;
  const prefix = LANG_PREFIX[lang] || '';

  const cards = GUIDES.map(
    (g) => `<li class="guide-card">
  <a href="${prefix}/guide/${esc(g.slug)}">
    <span class="em">${esc(g.icon)}</span>
    <span class="gt">${esc(guideText(g.title, lang))}</span>
    <span class="gd">${esc(guideText(g.description, lang))}</span>
  </a>
</li>`
  ).join('\n');

  const body = `
${crumbs(lang, [{ label: ui.guides }])}
<h1>${esc(ui.guides)}</h1>
<p class="lede">${esc(guideText({
    en: 'Practical guides for learning Cantonese in Hong Kong — what to study first, how to care for an elderly person in Cantonese, and how Cantonese differs from Mandarin.',
    fil: 'Mga praktikal na gabay sa pag-aaral ng Cantonese sa Hong Kong — ano ang unahin, paano mag-alaga ng matanda sa Cantonese, at ang pagkakaiba ng Cantonese at Mandarin.',
    zh: '在香港学粤语的实用指南——先学什么、怎么用粤语照顾老人，以及粤语和普通话到底差在哪里。',
    id: 'Panduan praktis belajar bahasa Kanton di Hong Kong — apa yang dipelajari lebih dulu, cara merawat lansia dengan bahasa Kanton, dan bedanya bahasa Kanton dengan Mandarin.',
  }, lang))}</p>
<ul class="guide-list">
${cards}
</ul>
${ctaCard(lang)}
`;

  const title = {
    en: 'Cantonese Guides for Helpers in Hong Kong | CantoBuddy',
    fil: 'Mga Gabay sa Cantonese para sa Helper sa Hong Kong | CantoBuddy',
    zh: '香港粤语学习指南 | CantoBuddy',
    id: 'Panduan Bahasa Kanton untuk Asisten Rumah Tangga di Hong Kong | CantoBuddy',
  }[lang];

  const description = {
    en: 'Practical guides to learning Cantonese for domestic work in Hong Kong — study plans, elder care vocabulary, and Cantonese vs Mandarin.',
    fil: 'Mga praktikal na gabay sa Cantonese para sa trabaho sa Hong Kong — study plan, bokabularyo sa pag-aalaga, at Cantonese vs Mandarin.',
    zh: '在香港做家佣学粤语的实用指南：先学什么、每天十分钟怎么安排、怎么用粤语照顾老人，以及粤语和普通话的区别。全部免费。',
    id: 'Panduan praktis belajar bahasa Kanton untuk bekerja di Hong Kong — rencana belajar, kosakata merawat lansia, dan perbedaan bahasa Kanton dengan Mandarin. Semuanya gratis.',
  }[lang];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG_LD,
      breadcrumbLd([
        { name: t.learn, path: `${prefix}/learn` },
        { name: ui.guides, path: `${prefix}/guide` },
      ]),
      {
        '@type': 'CollectionPage',
        name: title,
        description,
        url: `${SITE_ORIGIN}${prefix}/guide`,
        inLanguage: L[lang].htmlLang,
        hasPart: GUIDES.map((g) => ({
          '@type': 'Article',
          headline: guideText(g.title, lang),
          url: `${SITE_ORIGIN}${prefix}/guide/${g.slug}`,
        })),
      },
    ],
  };

  return page({
    lang,
    title,
    description,
    path: `${prefix}/guide`,
    jsonLd,
    body,
    alternates: hreflangLinks((l) => `${LANG_PREFIX[l]}/guide`),
  });
}

/** One guide, with its FAQ rendered visibly and as structured data. */
function renderGuide(lang, slug) {
  const t = L[lang];
  const ui = GUIDE_UI[lang] || GUIDE_UI.en;
  const g = GUIDE_BY_SLUG.get(slug);
  if (!g) return null;

  const prefix = LANG_PREFIX[lang] || '';
  const title = guideText(g.title, lang);
  const description = guideText(g.description, lang);

  // FAQ: rendered once for the reader, and once as FAQPage data. Same text, so
  // the structured data can never drift from what the page actually says —
  // Google penalises markup that does not match the visible content.
  const faqBlock = (g.faq || []).length
    ? `<h2>${esc(ui.faq)}</h2>
<div class="faq">
${g.faq
  .map(
    (f) => `<details>
  <summary>${esc(guideText(f.q, lang))}</summary>
  <p>${esc(guideText(f.a, lang))}</p>
</details>`
  )
  .join('\n')}
</div>`
    : '';

  const relatedBlock = (g.related || []).length
    ? `<h2>${esc(ui.seeAlso)}</h2>
<ul class="links">
${g.related
  .map((r) => {
    // Guide-to-guide links need the language prefix; vocabulary links in the
    // copy are already written absolute and are left as they are.
    const href = r.href.startsWith('/guide/') ? `${prefix}${r.href}` : r.href;
    return `<li><a href="${esc(href)}">${esc(guideText(r.label, lang))}</a></li>`;
  })
  .join('\n')}
</ul>`
    : '';

  const body = `
${crumbs(lang, [
    { label: ui.guides, href: `${prefix}/guide` },
    { label: title },
  ])}
<article>
<h1>${esc(title)}</h1>
<p class="lede">${esc(description)}</p>
${guideText(g.body, lang)}
${faqBlock}
${relatedBlock}
<p class="updated">${esc(ui.updated)} ${esc(g.updated)}</p>
</article>
${ctaCard(lang)}
`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG_LD,
      breadcrumbLd([
        { name: t.learn, path: `${prefix}/learn` },
        { name: ui.guides, path: `${prefix}/guide` },
        { name: title, path: `${prefix}/guide/${slug}` },
      ]),
      {
        '@type': 'Article',
        headline: title,
        description,
        inLanguage: L[lang].htmlLang,
        datePublished: g.updated,
        dateModified: g.updated,
        mainEntityOfPage: `${SITE_ORIGIN}${prefix}/guide/${slug}`,
        author: { '@type': 'Organization', name: 'CantoBuddy' },
        publisher: { '@type': 'Organization', name: 'CantoBuddy', logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/icons/icon-512.png` } },
      },
      ...(g.faq || []).length
        ? [{
            '@type': 'FAQPage',
            mainEntity: g.faq.map((f) => ({
              '@type': 'Question',
              name: guideText(f.q, lang),
              acceptedAnswer: { '@type': 'Answer', text: guideText(f.a, lang) },
            })),
          }]
        : [],
    ],
  };

  return page({
    lang,
    title: `${title} | CantoBuddy`,
    description,
    path: `${prefix}/guide/${slug}`,
    jsonLd,
    body,
    alternates: hreflangLinks((l) => `${LANG_PREFIX[l]}/guide/${slug}`),
  });
}

/* ===========================================================================
   The employer landing page — /portal
   ===========================================================================

   /portal used to be the sign-in shell and nothing else: `noindex`, no
   canonical, no content. It was the one page aimed at the people who actually
   pay for domestic help, and a search engine could see none of it.

   It is now the employer landing page. Rather than build a second page and
   leave the portal as a bare form, the landing content is server-rendered
   INTO the portal shell (see portalPage below), so:

     - /portal is one URL, indexable, with real content — not a login page
       whose purpose Google has to guess at;
     - the sign-in form stays exactly where it was, so an employer with the URL
       bookmarked, and the /reset flow that redirects here, still work;
     - /portal.html and /reset keep their noindex, because they are the bare
       shell with none of this content.

   The content sits inside #portal-auth, so it disappears the moment she signs
   in. Nothing in it is personalised: the counts come from the shared library,
   never from an account.
   =========================================================================== */

/**
 * The questions employers actually ask.
 *
 * Data, not markup, because the same list feeds both the visible FAQ and the
 * FAQPage structured data. Google requires a marked-up answer to match what is
 * on the page, and two hand-maintained copies are exactly how that drifts.
 */
const EMPLOYER_FAQ = [
  [
    'How do I connect with my helper on CantoBuddy?',
    'Sign in with your name, then send her the invitation link from your dashboard. There is also a short code you can read aloud — the codes leave out 0/O and 1/I so they cannot be misheard over the phone. Nothing is shared until she accepts on her own phone.',
  ],
  [
    'Can I see my helper’s quiz answers?',
    'No. You see how many quiz attempts she has made, her accuracy, her total correct answers, her progress per level, and when she last practised. You never see which words she got wrong, her feedback to us, or anything else she does on this site.',
  ],
  [
    'Does my helper have to pay for CantoBuddy?',
    'No. It is free for helpers, always — no subscription, no in-app purchase, and nothing in the app to sell her.',
  ],
  [
    'What if she does not want me to see her progress?',
    'That is allowed, and the app still works completely for her. She can decline the invitation or disconnect at any time, and she keeps every bit of her progress either way.',
  ],
  [
    'Does it work without an internet connection?',
    'Yes. Once she has opened it, the app and its audio keep working offline — which matters in a flat with weak signal, or on the MTR.',
  ],
];

/**
 * The employer landing body, as an HTML fragment.
 *
 * A fragment rather than a whole page because it is injected into portal.html,
 * which owns the header, the form and the app runtime. `page()` is not used
 * here for the same reason — its chrome would replace the portal.
 *
 * English only, deliberately. The portal is English (its labels are hardcoded
 * in portal.html), so a /zh/portal would be an English page behind a Chinese
 * URL. Emitting hreflang alternates for trees that do not exist would be worse
 * than emitting none — see the note in page().
 */
function renderEmployerLanding() {
  const words = store.listVocabulary({ enabledOnly: true }).length;
  const topics = store.listEnabledCategories().length;
  const guide = '/guide/getting-your-helper-started-with-cantonese';

  const faqHtml = EMPLOYER_FAQ.map(
    ([q, a]) => `      <h3>${esc(q)}</h3>\n      <p>${esc(a)}</p>`
  ).join('\n');

  return `<section class="portal-landing" id="employers" aria-labelledby="employer-h1">
  <div class="pl-inner">
    <p class="pl-eyebrow">For employers</p>
    <h1 class="pl-h1" id="employer-h1">Your helper learns Cantonese. Here’s how you help.</h1>
    <p class="pl-lede">Most helpers arrive speaking English and learn Cantonese on the job — usually from the person in the household who speaks English least.</p>
    <p>If your mother is the one at home all day, she is the one your helper cannot talk to. That is where the small misunderstandings start: a request repeated three times, a symptom not reported, a medicine taken at the wrong hour because nobody could confirm it.</p>

    <h2>What CantoBuddy is</h2>
    <p>A free Cantonese practice app built for domestic helpers in Hong Kong: <strong>${words} words and phrases</strong> across ${topics} everyday topics — elder care, the kitchen, medication, emergencies — each with audio, Jyutping romanisation and quizzes. No sign-up, no cost, and it works offline.</p>
    <p><strong>Free to your helper, always</strong>, and there is nothing in it to sell her. You are welcome to <a href="/learn">browse the vocabulary yourself</a> before you invite anyone.</p>

    <h2>How to connect with your helper</h2>
    <ol class="pl-steps">
      <li><strong>Sign in above.</strong> Your name is all it takes — no email address, no password to forget.</li>
      <li><strong>Invite her.</strong> You get a link to send, and a short code you can read aloud.</li>
      <li><strong>Add one note.</strong> “Please practise the Elder Care words” works far better than “please study”.</li>
      <li><strong>She accepts on her own phone.</strong> Sharing stays off until she does.</li>
    </ol>

    <h2>What you can see — and what you cannot</h2>
    <div class="pl-split">
      <div class="pl-col pl-yes">
        <h3>You can see</h3>
        <ul>
          <li>How many quiz attempts she has made</li>
          <li>Her accuracy, as a percentage</li>
          <li>Her total correct answers</li>
          <li>Her progress in each level</li>
          <li>When she last practised</li>
        </ul>
      </div>
      <div class="pl-col pl-no">
        <h3>You cannot see</h3>
        <ul>
          <li>Her quiz answers, word by word</li>
          <li>Her feedback to us</li>
          <li>Anything else she does on this site</li>
          <li>Anything at all once she disconnects</li>
        </ul>
      </div>
    </div>
    <p>She can disconnect at any time and keeps every bit of her progress. The invitation is hers to accept and hers to end — that is not a setting we might change later, it is the reason a helper can use this app honestly, and it is written into our <a href="/privacy">privacy policy</a>.</p>

    <h2>How to encourage her — without watching her</h2>
    <ul class="pl-tips">
      <li><strong>Start small and be specific.</strong> One topic this week. A helper given “learn Cantonese” does nothing; a helper given “the Elder Care words” opens the app.</li>
      <li><strong>Invite in the first week, not the first day.</strong> On day one she is learning the household. An app request then reads as one more task.</li>
      <li><strong>Let her own it.</strong> If she would rather not connect, that is allowed, and the app still works completely for her.</li>
      <li><strong>Say thank you out loud.</strong> You can see when she last practised and how her accuracy is moving. Noticing it costs nothing, and it is the entire mechanism.</li>
    </ul>
    <p><em>If you want to recognise progress with a gift, that happens between you and her — the app does not handle money and never will.</em></p>

    <h2>Questions employers ask</h2>
    <div class="pl-faq">
${faqHtml}
    </div>

    <p class="pl-cta"><a class="cta" href="#auth-form">Sign in to the employer portal</a></p>
    <p class="pl-more"><a href="${guide}">Read the full guide: getting your helper started →</a></p>
    <p class="pl-more"><a href="/privacy">Privacy Policy</a> · <a href="/about">About Us</a> · <a href="/contact">Contact Us</a> · <a href="/terms">Terms of Service</a> · <a href="/disclaimer">Disclaimer</a> · <a href="/articles">Articles &amp; Guides</a></p>
  </div>
</section>`;
}

/**
 * The indexable <head> block for /portal, replacing the noindex block that
 * portal.html ships. See the PORTAL_SEO_HEAD marker in that file.
 *
 * No hreflang alternates: this page exists in English only, and a self-
 * referential alternate set that claims translations which do not exist is a
 * lie a crawler can check. The page's own lang="en" is the honest signal.
 */
function portalHead() {
  const title = 'For employers — help your helper learn Cantonese | CantoBuddy';
  const description =
    'Connect to your domestic helper’s Cantonese progress — what you can see, what you cannot, and how to encourage her without watching her. Free for helpers, always.';
  const canonical = `${SITE_ORIGIN}/portal`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG_LD,
      breadcrumbLd([
        { name: 'CantoBuddy', path: '/' },
        { name: 'For employers', path: '/portal' },
      ]),
      {
        '@type': 'WebPage',
        name: title,
        description,
        url: canonical,
        inLanguage: 'en-HK',
        isPartOf: { '@type': 'WebSite', name: 'CantoBuddy', url: SITE_ORIGIN },
      },
      {
        '@type': 'FAQPage',
        mainEntity: EMPLOYER_FAQ.map(([q, a]) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    ],
  };

  return `  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta name="robots" content="index, follow" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="CantoBuddy" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="${SITE_ORIGIN}/icons/icon-512.png" />
  <meta property="og:locale" content="en_HK" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${SITE_ORIGIN}/icons/icon-512.png" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  ${ADSENSE_SNIPPET}`;
}

/* The portal shell, read once. portal.html is the app — the form, the
 * dashboard, portal.js — so it must not be rewritten per request; only the
 * head block and the landing fragment are spliced in. */
const PORTAL_SHELL_PATH = path.join(__dirname, 'public', 'portal.html');
const PORTAL_HEAD_MARKER = '  <!-- PORTAL_SEO_HEAD';
const PORTAL_LANDING_MARKER = '    <!-- PORTAL_SEO_LANDING';
let portalShellCache = null;

function readPortalShell() {
  if (portalShellCache === null) portalShellCache = fs.readFileSync(PORTAL_SHELL_PATH, 'utf8');
  return portalShellCache;
}

/**
 * /portal — the employer landing page, with the sign-in form it always had.
 *
 * Both splices throw rather than degrade. A missing marker means portal.html
 * was refactored and this module would otherwise serve either a noindex page
 * (invisible to search) or a contentless one (thin), and both failures are
 * silent in production. A 500 at request time is the loud version.
 */
function portalPage() {
  let html = readPortalShell();

  const headAt = html.indexOf(PORTAL_HEAD_MARKER);
  if (headAt === -1) {
    throw new Error('portal.html: PORTAL_SEO_HEAD marker missing — refusing to serve a noindex employer page');
  }
  const titleEnd = html.indexOf('</title>', headAt);
  if (titleEnd === -1) {
    throw new Error('portal.html: <title> missing after the PORTAL_SEO_HEAD marker');
  }
  html = html.slice(0, headAt) + portalHead() + html.slice(titleEnd + '</title>'.length);

  const landAt = html.indexOf(PORTAL_LANDING_MARKER);
  if (landAt === -1) {
    throw new Error('portal.html: PORTAL_SEO_LANDING marker missing — refusing to serve a contentless employer page');
  }
  // Insert after the marker's closing `-->`, not after its first line: the
  // marker is a multi-line comment, and splicing inside it would comment out
  // the whole landing page.
  const commentEnd = html.indexOf('-->', landAt);
  const lineEnd = html.indexOf('\n', commentEnd === -1 ? landAt : commentEnd);
  const insertAt = lineEnd === -1 ? html.length : lineEnd + 1;
  return html.slice(0, insertAt) + renderEmployerLanding() + '\n' + html.slice(insertAt);
}

// ---------------------------------------------------------------------------
// Discover — the culture and news feed, server-rendered.
//
// The learner app has the same two channels as a tab, but every view of that
// app renders into `/` — so without these pages the whole feed would be
// invisible to a search engine, which is the opposite of the point. A feed is
// the one kind of content that earns repeat visits, and repeat visits start
// with someone finding it once.
//
// Content comes from the same `posts` table the app reads (store.listPosts),
// so an article posted in the admin appears here on the next request with no
// deploy — which is what "regularly post" has to mean.
//
// IMPORTED NEWS is always attributed and always linked. The body columns are
// empty for a news row (news.js never writes them), so a news page is a
// headline, a short summary, and a prominent link to the original. That is a
// deliberate limit, not missing data: republishing the article would be a
// copyright problem. See news.js.
// ---------------------------------------------------------------------------

/**
 * News topic labels, per language.
 *
 * The same keys news-category.js classifies into. Kept here rather than shared
 * with the app's i18n.js because these are server-rendered page text, and a
 * crawler has no client to translate for it. 'all' is the unfiltered label.
 */
const NEWS_TOPIC_UI = {
  en: { all: 'All news', hongkong: 'Hong Kong', work: 'Work & your rights', money: 'Money & prices', health: 'Health', home: 'Home & family', politics: 'Government', other: 'Other news' },
  fil: { all: 'Lahat ng balita', hongkong: 'Hong Kong', work: 'Trabaho at karapatan', money: 'Pera at presyo', health: 'Kalusugan', home: 'Tahanan at pamilya', politics: 'Pamahalaan', other: 'Iba pang balita' },
  zh: { all: '全部新闻', hongkong: '香港', work: '工作与权益', money: '金钱与物价', health: '健康', home: '家乡与家庭', politics: '政府', other: '其他新闻' },
  id: { all: 'Semua berita', hongkong: 'Hong Kong', work: 'Kerja & hak Anda', money: 'Uang & harga', health: 'Kesehatan', home: 'Kampung & keluarga', politics: 'Pemerintah', other: 'Berita lain' },
};

const newsTopicLabel = (lang, key) =>
  (NEWS_TOPIC_UI[lang] || NEWS_TOPIC_UI.en)[key] || key;

/* ---------------------------------------------------------------------------
   The Hong Kong festival calendar, as DATE RANGES.

   WHY THIS IS A TABLE AND NOT A CALCULATION. Most of these festivals are
   lunar, which means their Gregorian date moves every year — Lunar New Year
   falls anywhere between 21 January and 20 February. A lunar-calendar library
   would be the correct general answer and is far more code than this is worth:
   the app needs to answer one question ("is a festival in the next three
   days?"), for roughly a dozen known events, and the answers are published in
   advance by the Hong Kong government. So the table is maintained by hand, one
   line per year per festival, and it is honest about being hand-maintained.

   THE WINDOW IS THREE DAYS, and it used to be seven. Seven days is a calendar,
   not a prompt: it put a banner on the front page for a quarter of every month,
   which is often enough that it stops being read. Three days is the point at
   which the household is actually preparing — the shopping, the cooking, the
   day off being arranged — and it is short enough that the card means
   "something is happening" rather than "there is a festival this month".

   `key` is also the tag the vocabulary carries, and the lookup into
   FESTIVAL_WORDS below, which is what the banner actually prints. The banner
   links to /learn/festivals, where the words are one tap away.
   --------------------------------------------------------------------------- */
const HK_FESTIVALS = [
  { key: 'lny',          name_en: 'Lunar New Year',        name_zh: '农历新年',   icon: '🧨', dates: ['2026-02-17', '2027-02-06', '2028-01-26'] },
  { key: 'chingming',    name_en: 'Ching Ming Festival',   name_zh: '清明节',     icon: '🌿', dates: ['2026-04-05', '2027-04-05', '2028-04-04'] },
  { key: 'buddha',       name_en: "Buddha's Birthday",      name_zh: '佛诞',       icon: '🪷', dates: ['2026-05-24', '2027-05-12', '2028-04-30'] },
  { key: 'bun',          name_en: 'Cheung Chau Bun Festival', name_zh: '长洲太平清醮', icon: '🍞', dates: ['2026-05-17', '2027-05-06', '2028-05-24'] },
  { key: 'dragonboat',   name_en: 'Dragon Boat Festival',  name_zh: '端午节',     icon: '🐉', dates: ['2026-06-19', '2027-06-09', '2028-05-28'] },
  { key: 'hungryghost',  name_en: 'Hungry Ghost Festival', name_zh: '盂兰盆节',   icon: '👻', dates: ['2026-08-27', '2027-08-16', '2028-08-05'] },
  { key: 'midautumn',    name_en: 'Mid-Autumn Festival',   name_zh: '中秋节',     icon: '🥮', dates: ['2026-09-25', '2027-09-15', '2028-10-03'] },
  { key: 'chongyang',    name_en: 'Chongyang Festival',    name_zh: '重阳节',     icon: '⛰️', dates: ['2026-10-18', '2027-10-08', '2028-10-26'] },
  { key: 'wintersolstice', name_en: 'Winter Solstice',     name_zh: '冬至',       icon: '🥟', dates: ['2026-12-22', '2027-12-22', '2028-12-21'] },
  { key: 'christmas',    name_en: 'Christmas Day',         name_zh: '圣诞节',     icon: '🎄', dates: ['2026-12-25', '2027-12-25', '2028-12-25'] },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Hong Kong's day, as YYYY-MM-DD. The server runs in UTC; the events are local. */
// The arithmetic must be on the TIMESTAMP, never on the value itself. A Date on
// the left of `+` string-concatenates ("Mon Oct 19 … GMT+0800)28800000"); V8 then
// leniently parses the date prefix and ignores the trailing digits, so the +8h
// shift is silently dropped and every caller between 16:00 and 24:00 UTC is told
// it is still yesterday in Hong Kong. Numbers and Dates must behave identically
// here — the renderers accept either, and the tests render every festival case
// on demand through this clock.
const hkToday = (now = Date.now()) => new Date(new Date(now).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Whole days from `date` to `today`. Negative is in the past. */
const daysUntil = (date, today) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);

/**
 * Festivals starting within the next `window` days, soonest first.
 *
 * The window is measured from TODAY, so an event three days away is "coming
 * up" and an event four days away is not — which is the honest reading of the
 * request: a card for something a week out is not a prompt, it is a calendar,
 * and it would sit there so often that it stops being read.
 */
function upcomingFestivals(now = Date.now(), window = 3) {
  const today = hkToday(now);
  const out = [];
  for (const f of HK_FESTIVALS) {
    for (const d of f.dates) {
      const n = daysUntil(d, today);
      if (n >= 0 && n <= window) out.push({ ...f, startsOn: d, inDays: n });
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}

/**
 * The next festival within the window, as DATA rather than as markup.
 *
 * The front page draws this itself (public/app.js), because the app shell is a
 * client-rendered PWA and a server-rendered panel cannot be injected into it.
 * That makes one thing load-bearing: "which festival, and how many days away"
 * must be decided in exactly ONE place, or the landing page and the app will
 * disagree on the day a window opens or closes. So festivalBanner() below
 * renders FROM this, and GET /api/festival serves it.
 *
 * `date` is formatted here rather than in the client because it is a date in
 * HONG KONG, not in the reader's timezone, and the server already owns that
 * distinction (see hkToday).
 */
function upcomingFestivalPayload(now = Date.now()) {
  const soon = upcomingFestivals(now);
  if (!soon.length) return null;
  // The soonest festival only. Two cards stacked would compete with each other,
  // and the first is the one she needs to prepare for.
  const f = soon[0];
  return {
    key: f.key,
    name_en: f.name_en,
    name_zh: f.name_zh,
    icon: f.icon,
    startsOn: f.startsOn,
    inDays: f.inDays,
    date: new Date(`${f.startsOn}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }),
    words: (FESTIVAL_WORDS[f.key] || []).map(([cantonese, jyutping]) => ({ cantonese, jyutping })),
  };
}

/** The panel shown on the landing page, or '' when no festival is near. */
function festivalBanner(lang, now = Date.now()) {
  const f = upcomingFestivalPayload(now);
  if (!f) return '';
  const prefix = LANG_PREFIX[lang] || '';
  const ui = FESTIVAL_BANNER_UI[lang] || FESTIVAL_BANNER_UI.en;
  const when = f.inDays === 0 ? ui.today : f.inDays === 1 ? ui.tomorrow : ui.inDays.replace('{n}', String(f.inDays));
  const name = f.key === 'christmas' || f.key === 'wintersolstice'
    ? f.name_en
    : (L[lang] === L.zh ? f.name_zh : f.name_en);

  return `<div class="fest-banner" role="region" aria-label="${esc(ui.label)}">
  <p class="fest-banner-kicker">${esc(ui.kicker)}</p>
  <h2 class="fest-banner-title">${esc(f.icon)} ${esc(name)}</h2>
  <p class="fest-banner-when">${esc(when)} · ${esc(f.date)}</p>
  <p class="fest-banner-body">${esc(ui.body.replace('{festival}', f.name_en))}</p>
  ${f.words.length ? `<ul class="fest-banner-words">
    ${f.words.map((w) => `<li><span class="fest-yue">${esc(w.cantonese)}</span><span class="fest-jyut">${esc(w.jyutping)}</span></li>`).join('\n    ')}
  </ul>` : ''}
  <a class="cta" href="${prefix}/learn/festivals">${esc(ui.cta)}</a>
</div>`;
}

/* ---------------------------------------------------------------------------
   THE WORDS UNDER THE BANNER, PER FESTIVAL.

   This used to be a single array of Lunar New Year greetings declared inside
   festivalBanner(), so every festival printed 恭喜發財 / 新年快樂 / 利是. It went
   unnoticed for a year because the banner only appears within seven days of an
   event and the first one to land after the banner shipped was, by luck, a
   festival where the words were wrong but not absurd. Chongyang made it
   absurd: a grave-sweeping and hill-climbing day, captioned with red packets.

   So the list is now keyed on the festival, and a festival with no entry shows
   no words at all rather than someone else's. Silence is a smaller lie than the
   wrong vocabulary — she would have learned three phrases that do not belong to
   the day she is being told to prepare for.

   Every word here must also exist in data.js under category 19, because the CTA
   sends her to that lesson. `posts-test.js` asserts both halves: that all ten
   festivals are covered, and that each curated word is really in the set she
   will be shown.
   --------------------------------------------------------------------------- */
const FESTIVAL_WORDS = {
  lny:            [['恭喜發財', 'gung1 hei2 faat3 coi4'], ['新年快樂', 'san1 nin2 faai3 lok6'], ['利是', 'lai6 si6']],
  chingming:      [['清明節', 'cing1 ming4 zit3'], ['拜山', 'baai3 saan1'], ['掃墓', 'sou3 mou6']],
  buddha:         [['佛誕', 'fat6 daan3'], ['上香', 'soeng5 hoeng1'], ['食齋', 'sik6 zaai1']],
  bun:            [['太平清醮', 'taai3 ping4 cing1 ziu3'], ['平安包', 'ping4 on1 baau1'], ['搶包山', 'coeng2 baau1 saan1']],
  dragonboat:     [['端午節', 'dyun1 ng5 zit3'], ['粽', 'zung3'], ['龍舟', 'lung4 zau1']],
  hungryghost:    [['盂蘭節', 'jyu4 laan4 zit3'], ['燒衣', 'siu1 ji1'], ['上香', 'soeng5 hoeng1']],
  midautumn:      [['中秋節', 'zung1 cau1 zit3'], ['月餅', 'jyut6 beng2'], ['燈籠', 'dang1 lung4']],
  chongyang:      [['重陽節', 'cung4 joeng4 zit3'], ['登高', 'dang1 gou1'], ['菊花', 'guk1 faa1']],
  wintersolstice: [['冬至', 'dung1 zi3'], ['湯圓', 'tong1 jyun2'], ['做冬', 'zou6 dung1']],
  christmas:      [['聖誕節', 'sing3 daan3 zit3'], ['聖誕樹', 'sing3 daan3 syu6'], ['禮物', 'lai5 mat6']],
};

/** The banner's own copy, per language. */
const FESTIVAL_BANNER_UI = {
  en: {
    label: 'Festival coming up',
    kicker: 'COMING UP',
    today: 'Today',
    tomorrow: 'Tomorrow',
    inDays: 'In {n} days',
    body: '{festival} starts soon. The household will be busy, and there are words you will hear all week — start with these.',
    cta: 'Practise the festival words',
  },
  fil: {
    label: 'Papalapit na pista',
    kicker: 'PAPALAPIT',
    today: 'Ngayon',
    tomorrow: 'Bukas',
    inDays: 'Sa {n} araw',
    body: 'Malapit na ang {festival}. Magiging abala ang tahanan, at may mga salitang maririnig mo buong linggo — simulan dito.',
    cta: 'Sanayin ang mga salita sa pista',
  },
  zh: {
    label: '即将到来的节日',
    kicker: '即将到来',
    today: '今天',
    tomorrow: '明天',
    inDays: '{n} 天后',
    body: '{festival}快到了。家里会很忙，这一周你会反复听到这些话——从这几个词开始。',
    cta: '练习节日用语',
  },
  id: {
    label: 'Hari raya akan datang',
    kicker: 'SEGERA',
    today: 'Hari ini',
    tomorrow: 'Besok',
    inDays: 'Dalam {n} hari',
    body: '{festival} sebentar lagi. Rumah akan sibuk, dan ada kata-kata yang akan Anda dengar sepanjang pekan — mulai dari sini.',
    cta: 'Latihan kata hari raya',
  },
};

const DISCOVER_UI = {
  en: {
    title: 'Discover: Hong Kong life, news and stories from home',
    lede: 'Hong Kong life for domestic helpers — how things work at home — plus news from the Philippines, Indonesia and Hong Kong, and stories written by helpers themselves, in plain English.',
    culture: 'Hong Kong culture',
    cultureLede: 'The customs nobody explains — the altar, the festivals, and the two ways to say thank you.',
    news: 'News from home and Hong Kong',
    newsLede: 'News from the Philippines, Indonesia and Hong Kong. Each item is a short summary with a link to the full story.',
    stories: 'Stories from helpers',
    storiesLede: 'Real stories from helpers in Hong Kong — shared by them or retold from published reports, with the source named on every story.',
    empty: 'Nothing here yet — check back soon.',
    source: 'Source',
    readOriginal: 'Read the full story',
    newsNote: 'Headline and summary from the linked source. The full story is at the link above.',
    backToDiscover: 'All articles',
    notFound: 'That article is not available.',
    notFoundTitle: 'Article not found',
  },
  fil: {
    title: 'Tuklasin: buhay sa Hong Kong, balita at mga kuwento',
    lede: 'Buhay sa Hong Kong para sa mga helper — kung paano gumagana ang tahanan — at balita mula sa Pilipinas, Indonesia at Hong Kong, at mga kuwentong isinulat mismo ng mga helper, sa simpleng Ingles.',
    culture: 'Kultura ng Hong Kong',
    cultureLede: 'Ang mga kaugaliang walang nagpapaliwanag — ang altar, ang mga pista, at ang dalawang paraan ng pagpapasalamat.',
    news: 'Balita sa tahanan at Hong Kong',
    newsLede: 'Balita mula sa Pilipinas, Indonesia at Hong Kong. Maikling buod ang bawat isa, may link sa buong balita.',
    stories: 'Mga kuwento ng mga helper',
    storiesLede: 'Totoong kuwento mula sa mga helper sa Hong Kong — ibinahagi nila o muling isinalaysay mula sa ulat na nalathala, na may nakasaad na pinagmulan.',
    empty: 'Wala pa rito — bumalik mamaya.',
    source: 'Pinagmulan',
    readOriginal: 'Basahin ang buong balita',
    newsNote: 'Headline at buod mula sa pinagmulang naka-link. Nasa link sa itaas ang buong balita.',
    backToDiscover: 'Lahat ng artikulo',
    notFound: 'Hindi available ang artikulong iyon.',
    notFoundTitle: 'Hindi mahanap ang artikulo',
  },
  zh: {
    title: '发现：香港生活、新闻与家佣故事',
    lede: '为家佣准备的香港生活——家里的事是怎么运作的——以及来自菲律宾、印尼和香港的新闻，还有家佣亲手写下的故事，都用简单的英文讲清楚。',
    culture: '香港文化',
    cultureLede: '那些没人会解释的习俗——神枱、节庆，以及两个「谢谢」的区别。',
    news: '家乡与香港新闻',
    newsLede: '来自菲律宾、印尼和香港的新闻。每条都是简短摘要，并附完整报道的链接。',
    stories: '家佣的故事',
    storiesLede: '来自香港家佣的真实故事——由她们分享，或根据已刊发报道改写，每篇均注明来源。',
    empty: '这里还没有内容，请稍后再来。',
    source: '来源',
    readOriginal: '阅读完整报道',
    newsNote: '标题与摘要来自链接所指的来源，完整报道见上方链接。',
    backToDiscover: '全部文章',
    notFound: '这篇文章暂不可用。',
    notFoundTitle: '找不到文章',
  },
  id: {
    title: 'Jelajahi: kehidupan Hong Kong, berita & kisah',
    lede: 'Kehidupan di Hong Kong untuk asisten rumah tangga — bagaimana rumah tangga bekerja — serta berita dari Indonesia, Filipina, dan Hong Kong, dan kisah yang ditulis sendiri oleh para asisten, dalam bahasa Inggris sederhana.',
    culture: 'Budaya Hong Kong',
    cultureLede: 'Kebiasaan yang tak pernah dijelaskan — altar, perayaan, dan dua cara mengucapkan terima kasih.',
    news: 'Berita kampung halaman dan Hong Kong',
    newsLede: 'Berita dari Indonesia, Filipina, dan Hong Kong. Setiap item adalah ringkasan singkat dengan tautan ke berita lengkapnya.',
    stories: 'Kisah dari para asisten',
    storiesLede: 'Kisah nyata dari para asisten di Hong Kong — dibagikan langsung atau diceritakan kembali dari laporan terbitan, dengan sumber disebutkan pada setiap kisah.',
    empty: 'Belum ada apa-apa di sini — cek lagi nanti.',
    source: 'Sumber',
    readOriginal: 'Baca berita lengkapnya',
    newsNote: 'Judul dan ringkasan dari sumber yang ditautkan. Berita lengkapnya ada di tautan di atas.',
    backToDiscover: 'Semua artikel',
    notFound: 'Artikel itu tidak tersedia.',
    notFoundTitle: 'Artikel tidak ditemukan',
  },
};

/**
 * The Stories hub and reader.
 *
 * A story is written in ONE language — the one its author writes in — and is
 * NOT translated. That is the deliberate decision, not a missing feature: a
 * helper's own account of her life is worth more in her own words than in a
 * machine's, and the hub is a shared shelf rather than four parallel shelves.
 * So every language tree renders the SAME list, and the only thing that changes
 * per tree is the chrome around it: the heading, the labels, the "written in"
 * note. An optional hand-written English gloss (written by the operator when
 * she approves the story) is what lets a reader who does not speak the language
 * follow along — see `gloss` below.
 */
const STORIES_UI = {
  en: {
    title: 'Stories',
    lede: 'Real stories from domestic helpers in Hong Kong — daily life, family, and what happened along the way. Some are shared here by the helpers who wrote them; others are carefully retold from published reports, with the original source named on every story.',
    empty: 'No stories have been published yet. If you would like to share yours, open the app and tap Stories.',
    anonymous: 'Anonymous',
    writtenIn: 'Written in',
    gloss: 'In English',
    source: 'Source',
    backToStories: 'All stories',
    shareYours: 'Share your story',
    shareYoursBody: 'Your story can help another helper feel less alone. Write it in your own language — it will be read by us first, then shared here if it is published.',
    notFound: 'That story is not available.',
    notFoundTitle: 'Story not found',
  },
  fil: {
    title: 'Mga Kuwento',
    lede: 'Totoong kuwento mula sa mga helper sa Hong Kong — pang-araw-araw na buhay, pamilya, at mga nangyari sa daan. Ang ilan ay ibinahagi mismo ng mga helper na sumulat; ang iba ay muling isinalaysay mula sa mga ulat na nalathala, at nakasaad ang pinagmulan sa bawat kuwento.',
    empty: 'Wala pang nai-publish na kuwento. Kung gusto mong ibahagi ang sa iyo, buksan ang app at pindutin ang Mga Kuwento.',
    anonymous: 'Hindi nagpakilala',
    writtenIn: 'Nakasulat sa',
    gloss: 'Sa Ingles',
    source: 'Pinagmulan',
    backToStories: 'Lahat ng kuwento',
    shareYours: 'Ibahagi ang kuwento mo',
    shareYoursBody: 'Malaki ang maitutulong ng kuwento mo para hindi mag-isa ang kapwa helper. Isulat ito sa sarili mong wika — babasahin muna namin, at ilalathala rito kapag naaprubahan.',
    notFound: 'Hindi available ang kuwentong iyon.',
    notFoundTitle: 'Hindi mahanap ang kuwento',
  },
  zh: {
    title: '家佣故事',
    lede: '来自香港家佣的真实故事——日常生活、家人，以及一路上的经历。有些由家佣本人写下并分享；有些根据已刊发的报道改写，每篇都注明原始来源。',
    empty: '目前还没有已发布的故事。想分享你的故事，请打开应用并点击「故事」。',
    anonymous: '匿名',
    writtenIn: '语言',
    gloss: '英文版',
    source: '来源',
    backToStories: '全部故事',
    shareYours: '分享你的故事',
    shareYoursBody: '你的故事可以让另一位家佣感到不那么孤单。请用你自己的语言写——我们会先读一遍，通过后才在这里分享。',
    notFound: '这篇故事暂不可用。',
    notFoundTitle: '找不到故事',
  },
  id: {
    title: 'Kisah',
    lede: 'Kisah nyata dari para asisten rumah tangga di Hong Kong — kehidupan sehari-hari, keluarga, dan apa yang terjadi di sepanjang jalan. Sebagian dibagikan langsung oleh para asisten yang menuliskannya; sebagian lain diceritakan kembali dari laporan yang telah diterbitkan, dengan sumber aslinya disebutkan pada setiap kisah.',
    empty: 'Belum ada kisah yang diterbitkan. Jika ingin membagikan kisahmu, buka aplikasi dan ketuk Kisah.',
    anonymous: 'Tanpa nama',
    writtenIn: 'Ditulis dalam',
    gloss: 'Dalam bahasa Inggris',
    source: 'Sumber',
    backToStories: 'Semua kisah',
    shareYours: 'Bagikan kisahmu',
    shareYoursBody: 'Kisahmu bisa membuat sesama asisten rumah tangga merasa tidak sendirian. Tulislah dalam bahasamu sendiri — kami akan membacanya lebih dulu, lalu membagikannya di sini jika disetujui.',
    notFound: 'Kisah itu tidak tersedia.',
    notFoundTitle: 'Kisah tidak ditemukan',
  },
};

/**
 * What a story's language is called, indexed by the language the READER is
 * browsing in — so a Filipino reader sees "Ingles" and a Chinese reader sees
 * "英文" for the same English story. The first key is the reader's tree; the
 * second is the language the story was written in.
 */
const STORY_LANG_NAME = {
  en: { en: 'English', fil: 'Filipino', zh: 'Chinese', id: 'Indonesian' },
  fil: { en: 'Ingles', fil: 'Filipino', zh: 'Chinese', id: 'Indonesian' },
  zh: { en: '英文', fil: '菲律宾语', zh: '中文', id: '印尼语' },
  id: { en: 'Inggris', fil: 'Filipino', zh: 'Tionghoa', id: 'Indonesia' },
};

/** A post's text in one language, falling back to English — same rule as the app. */
function postText(post, field, lang) {
  const localised = post[`${field}_${lang}`];
  if (localised != null && String(localised).trim()) return String(localised);
  return String(post[`${field}_en`] || '');
}

/**
 * Is this language a real translation of the post, or English wearing a
 * different language's chrome?
 *
 * WHY THIS MATTERS, AND WHY IT IS NOT PEDANTIC. postText() falls back to the
 * English when a translation is missing, which is right for a reader — a
 * Filipino helper would rather see English than an empty page. But it means
 * /fil/discover/<slug> can be BYTE-IDENTICAL to /discover/<slug> while
 * declaring itself canonical.
 *
 * That is the exact shape Google reported as "Duplicate, Google chose
 * different canonical than user": it found two identical documents, each
 * insisting it was the original, and overrode us. All 21 seeded posts have no
 * Filipino and no Indonesian translation, so 42 URLs were in that state.
 *
 * A variant with no translated body AND no translated summary is not a
 * translation. It is the English document at a second address, and it must say
 * so — see the canonicalPath in renderPost().
 *
 * English is always "translated": it is the base the others fall back TO.
 */
function isTranslated(post, lang) {
  if (lang === 'en') return true;
  return Boolean(
    String(post[`body_${lang}`] || '').trim() ||
    String(post[`summary_${lang}`] || '').trim()
  );
}

/** A locale-independent date, which is what belongs in server-rendered HTML. */
function postDateShort(iso) {
  const d = new Date(iso || '');
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/**
 * Post bodies are an operator-authored HTML subset. This strips everything
 * outside it before the string reaches the page — the same allowlist the app
 * applies in sanitizePostHtml(), applied again here because the two render the
 * same column through different code paths.
 */
// TABLE and its parts are in the allowlist for the statutory-holidays guide: a
// list of dates is a table, and the alternative — 30 hand-written <li>s — reads
// worse and is harder to check. Attributes are still stripped wholesale, so
// an allowed <table> carries no class, no style and no colspan.
const BODY_TAGS = new Set(['P', 'H2', 'H3', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'B', 'I', 'BR', 'BLOCKQUOTE', 'A',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH']);

function sanitizeBodyHtml(html) {
  return String(html || '')
    .replace(/<(script|style|iframe|object|embed|svg|math)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(script|style|iframe|object|embed|svg|math)[^>]*>/gi, '')
    .replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (m, name, attrs) => {
      const tag = String(name).toUpperCase();
      if (!BODY_TAGS.has(tag)) return '';
      if (tag === 'A') {
        const href = (String(attrs).match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/i) || []);
        const url = href[1] || href[2] || '';
        return /^(https?:\/\/|\/)/i.test(url)
          ? `<a href="${esc(url)}" rel="noopener noreferrer">`
          : '<a>';
      }
      return m.startsWith('</') ? `</${tag.toLowerCase()}>` : `<${tag.toLowerCase()}>`;
    });
}

/** One card, shared by both channels of the hub. */
function postCardLi(post, lang, prefix) {
  const date = postDateShort(post.published_at || post.created_at);
  const meta = [date, post.source_name].filter(Boolean).join(' · ');
  // A news card names its topic; a culture card has none and is not given one.
  const topic = post.channel === 'news' && post.category
    ? `<span class="pc-topic">${esc(newsTopicLabel(lang, post.category))}</span>`
    : '';
  return `<li class="guide-card">
  <a href="${prefix}/discover/${esc(post.slug)}">
    <span class="em">${esc(post.icon || '📰')}</span>
    ${topic}
    ${meta ? `<span class="pm">${esc(meta)}</span>` : ''}
    <span class="gt">${esc(postText(post, 'title', lang))}</span>
    <span class="gd">${esc(postText(post, 'summary', lang))}</span>
  </a>
</li>`;
}

/**
 * The News channel as topic sections.
 *
 * WHY GROUPED, AND WHY IT MATTERS FOR A PAGE LIKE THIS. The News channel grows
 * without bound — the importer runs hourly — so a flat newest-first list of it
 * is a page nobody can read and a section search engines cannot summarise.
 * Grouping by topic gives every bucket a real heading and an anchor, and it
 * means the newest story in each topic is near the top of its own section
 * rather than buried under whatever else happened to arrive.
 *
 * Only topics that actually have items appear. An empty section headed
 * "Government" with nothing under it is a promise the page does not keep.
 */
function newsTopicSections(news, lang, prefix, perTopic = 6) {
  const topics = ['hongkong', 'work', 'money', 'health', 'home', 'politics', 'other'];
  const groups = new Map();
  for (const p of news) {
    const key = topics.includes(p.category) ? p.category : 'other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const nav = [...groups.keys()]
    .map((k) => `<li><a href="#topic-${esc(k)}">${esc(newsTopicLabel(lang, k))}</a></li>`)
    .join('');
  // The hub is a doorway, not an archive. Rendering every imported headline put
  // 200 news cards on one page, which buried the editorial pillars and split the
  // internal link equity across items nobody scrolls to. Eight newest per topic
  // keeps every bucket current and keeps the page a reasonable weight.
  const sections = [...groups.entries()]
    .map(([k, items]) => `
<h3 class="disc-h3" id="topic-${esc(k)}">${esc(newsTopicLabel(lang, k))}</h3>
<ul class="guide-list">
${items.slice(0, perTopic).map((p) => postCardLi(p, lang, prefix)).join('\n')}
</ul>`)
    .join('\n');
  return `
<nav class="topic-nav" aria-label="${esc(newsTopicLabel(lang, 'all'))}">
<ul>${nav}</ul>
</nav>
${sections}`;
}

/** The Discover hub: both channels, newest first. */
function renderDiscoverHub(lang) {
  const ui = DISCOVER_UI[lang] || DISCOVER_UI.en;
  const storiesUi = STORIES_UI[lang] || STORIES_UI.en;
  const prefix = LANG_PREFIX[lang] || '';

  // Ask each channel on its own terms. A single limit-200 list ordered by date
  // is filled by the hourly news import, which pushes the editorial channels
  // (culture AND the new intent channels) out of the window entirely. This is
  // the same starvation the sitemap already fixes; the hub needed it too.
  const culture = store.listPosts({ status: 'published', channel: 'culture', limit: 200 });
  const news = store.listPosts({ status: 'published', channel: 'news', limit: 200 });
  const posts = [...culture, ...news];
  // The third channel. Discover has three, and this page is the one with the
  // authority to link into the stories — without a section here the stories hub
  // is reachable only from the footer and the app, so the pages that most need
  // to be found would have no internal link pointing at them.
  const stories = store.listPublishedStories({ limit: 200 });

  const section = (heading, lede, list) => `
<h2 class="disc-h2">${esc(heading)}</h2>
<p class="lede">${esc(lede)}</p>
${
    list.length
      ? `<ul class="guide-list">\n${list.map((p) => postCardLi(p, lang, prefix)).join('\n')}\n</ul>`
      : `<p class="lede">${esc(ui.empty)}</p>`
  }`;

  // A link to the full shelf, so this page is a doorway rather than a dead end.
  const more = (label, href) => `<p class="lede"><a href="${href}">${esc(label)} →</a></p>`;

  // The practical channels, straight from practical-channels.js — the same
  // registry the app's Living shelf and the /living hub read. Adding a channel
  // there puts it on all three surfaces at once.
  //
  // Computed AFTER section() is defined — referencing it earlier would be a
  // temporal-dead-zone error at render time.
  const extraSections = PRACTICAL_CHANNELS
    .map((c) => {
      const list = store.listPosts({ status: 'published', channel: c.channel, limit: 50 });
      if (!list.length) return '';
      return section(practicalText(c, 'label', lang), practicalText(c, 'lede', lang), list);
    })
    .filter(Boolean)
    .join('\n');

  const body = `
${crumbs(lang, [{ label: ui.title }])}
<h1>${esc(ui.title)}</h1>
<p class="lede">${esc(ui.lede)}</p>
${section(ui.culture, ui.cultureLede, culture)}
${extraSections}
<h2 class="disc-h2">${esc(ui.news)}</h2>
<p class="lede">${esc(ui.newsLede)}</p>
${news.length ? newsTopicSections(news, lang, prefix) : `<p class="lede">${esc(ui.empty)}</p>`}
  ${
    stories.length
      // NOT section(): that helper maps postCardLi, which links to
      // /discover/<slug>. A story lives at /stories/<slug>, so with a populated
      // shelf those cards would all have been dead links. It was invisible
      // while the shelf was empty. storyCardLi is hoisted, so using it here is
      // fine even though it is declared further down the file.
      ? `<h2 class="disc-h2">${esc(ui.stories)}</h2>
<p class="lede">${esc(ui.storiesLede)}</p>
<ul class="guide-list">\n${stories.slice(0, 24).map((s) => storyCardLi(s, storiesUi, prefix)).join('\n')}\n</ul>
${more(storiesUi.backToStories, `${prefix}/stories`)}`
      : more(ui.stories, `${prefix}/stories`)
  }
${ctaCard(lang)}
`;

  const title = {
    en: 'Discover: Hong Kong Life, News and Helper Stories | CantoBuddy',
    fil: 'Tuklasin: Buhay sa Hong Kong, Balita at mga Kuwento | CantoBuddy',
    zh: '发现：香港生活、新闻与家佣故事 | CantoBuddy',
    id: 'Jelajahi: Kehidupan Hong Kong, Berita dan Kisah | CantoBuddy',
  }[lang];

  const description = {
    en: 'Hong Kong customs explained, news from the Philippines, Indonesia and Hong Kong in English, and real stories written by domestic helpers — written for helpers.',
    fil: 'Paliwanag sa mga kaugalian ng Hong Kong, balita mula sa Pilipinas, Indonesia at Hong Kong sa Ingles, at totoong kuwento ng mga helper — para sa mga helper.',
    zh: '香港习俗讲解、来自菲律宾、印尼和香港的英文新闻，以及家佣写下的真实故事——为家佣而写。',
    id: 'Penjelasan kebiasaan Hong Kong, berita dari Indonesia, Filipina, dan Hong Kong dalam bahasa Inggris, serta kisah nyata dari para asisten rumah tangga — untuk para asisten.',
  }[lang];

  // Every published story is part of this page's structured data, so a story is
  // attributable to the hub that lists it as well as to its own URL.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG_LD,
      breadcrumbLd([{ name: ui.title, path: `${prefix}/discover` }]),
      {
        '@type': 'CollectionPage',
        name: title,
        description,
        url: `${SITE_ORIGIN}${prefix}/discover`,
        inLanguage: L[lang].htmlLang,
        hasPart: [
          ...posts.slice(0, 50).map((p) => ({
            '@type': 'Article',
            headline: postText(p, 'title', lang),
            url: `${SITE_ORIGIN}${prefix}/discover/${p.slug}`,
          })),
          ...stories.slice(0, 50).map((s) => ({
            '@type': 'Article',
            headline: s.title,
            url: `${SITE_ORIGIN}${prefix}/stories/${s.slug}`,
          })),
        ],
      },
    ],
  };

  return page({
    lang,
    title,
    description,
    path: `${prefix}/discover`,
    jsonLd,
    body,
    ogImage: `${SITE_ORIGIN}/og-home.jpg`,
    alternates: hreflangLinks((l) => `${LANG_PREFIX[l]}/discover`),
  });
}

/* ---------------------------------------------------------------------------
   Article social cards and sharing (2026-11-04)
   ---------------------------------------------------------------------------
   Every server-rendered page used icon-512.png as its og:image. On WhatsApp
   and Facebook that renders as a small square inside a wide card, so a helper
   forwarding "Yum cha in Hong Kong" was forwarding a picture of the app icon.
   The Outings photos are real 1280px Hong Kong photographs that already ship
   with the build, so they are reused here: one stable photo per article, no
   image pipeline, no new assets, and nothing to maintain when content grows.
   --------------------------------------------------------------------------- */
const ARTICLE_OG_PHOTOS = [
  'cheung-chau', 'dragons-back', 'flower-market', 'kowloon-park',
  'lamma-island', 'lion-rock', 'nan-lian-garden', 'repulse-bay',
  'sai-kung', 'stanley', 'star-ferry', 'tai-o', 'tai-tam',
  'temple-street', 'tst-promenade', 'victoria-park', 'victoria-peak',
];

/** Hash the SLUG, not the title: fixing a typo must not change the preview. */
function articleOgImage(post) {
  let h = 0x811c9dc5;
  const s = 'cb-og-' + String((post && post.slug) || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${SITE_ORIGIN}/places/${ARTICLE_OG_PHOTOS[(h >>> 0) % ARTICLE_OG_PHOTOS.length]}.jpg`;
}

const SHARE_UI = {
  en: {
    ask: 'Useful? Send it to a friend.',
    wa: 'WhatsApp', fb: 'Facebook', copy: 'Copy link', copied: 'Link copied!',
    intro: 'I found this on CantoBuddy (free for helpers in Hong Kong):',
  },
  fil: {
    ask: 'Nakatulong? Ipadala sa kaibigan.',
    wa: 'WhatsApp', fb: 'Facebook', copy: 'Kopyahin ang link', copied: 'Nakopya na!',
    intro: 'Nakita ko ito sa CantoBuddy (libre para sa mga helper sa Hong Kong):',
  },
  zh: {
    ask: '觉得有用？分享给朋友吧。',
    wa: 'WhatsApp', fb: 'Facebook', copy: '复制链接', copied: '已复制！',
    intro: '在 CantoBuddy 看到的（香港家佣免费使用）：',
  },
  id: {
    ask: 'Berguna? Kirim ke teman.',
    wa: 'WhatsApp', fb: 'Facebook', copy: 'Salin tautan', copied: 'Tautan tersalin!',
    intro: 'Saya menemukan ini di CantoBuddy (gratis untuk pekerja rumah tangga di Hong Kong):',
  },
};

/**
 * WhatsApp and Facebook are plain links (they work with JS off); only "Copy
 * link" needs the delegated handler in page(). The prefilled message is in the
 * reader's own language, which is the whole point of a share button on a site
 * whose readers are Filipino and Indonesian.
 */
function shareRow(lang, url, title) {
  const u = SHARE_UI[lang] || SHARE_UI.en;
  const text = `${u.intro} ${title}\n${url}`;
  const wa = 'https://wa.me/?text=' + encodeURIComponent(text);
  const fb = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url);
  return `<aside class="share-row">
  <p class="share-ask">${esc(u.ask)}</p>
  <div class="share-actions">
    <a class="share-wa" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">${esc(u.wa)}</a>
    <a class="share-fb" href="${esc(fb)}" target="_blank" rel="noopener noreferrer">${esc(u.fb)}</a>
    <button class="share-copy" type="button" data-copy="${esc(url)}" data-done="${esc(u.copied)}">${esc(u.copy)}</button>
  </div>
</aside>`;
}

/** One article. Returns null for an unknown slug, so the route can 404. */
function renderPost(lang, slug) {
  const ui = DISCOVER_UI[lang] || DISCOVER_UI.en;
  const prefix = LANG_PREFIX[lang] || '';
  const post = store.getPostBySlug(slug);
  // A draft has no public page. Treating it as missing is the honest answer:
  // it is not "not ready", to a reader it does not exist.
  if (!post || post.status !== 'published') {
    /* A post we DELETED on purpose answers 410, not 404.
       pruneNewsPast() retires imported news after three days, and a plain 404
       makes that look like a typo — which is why the operator's Search Console
       filled with "Not found (404)" entries that were all deliberate. The
       tombstone says so explicitly and Google drops the URL in weeks instead
       of months. An unknown slug still 404s: nothing was retired, it just is
       not a page. */
    if (store.isPostGone(slug)) return GONE;
    return null;
  }

  const title = postText(post, 'title', lang);
  const summary = postText(post, 'summary', lang);
  const bodyHtml = sanitizeBodyHtml(postText(post, 'body', lang));
  const date = postDateShort(post.published_at || post.created_at);
  // Does this tree actually translate the post, or is it the English text in
  // another tree's clothing? Drives the canonical and the hreflang set below.
  const translated = isTranslated(post, lang);
  // Share the CANONICAL url, not the untranslated variant the reader may have
  // arrived on — otherwise Filipino and English readers forward two different
  // links to the same article and the credit is split.
  const shareUrl = `${SITE_ORIGIN}${translated ? `${prefix}/discover/${slug}` : `/discover/${slug}`}`;

  // Attribution block, only when there is a source to attribute. Culture posts
  // have none, and an empty "Source:" line would be worse than no line.
  const sourceBlock = post.source_url
    ? `<div class="post-source">
  <p>${esc(ui.source)}: <strong>${esc(post.source_name || post.source_url)}</strong></p>
  <p><a class="btn" href="${esc(post.source_url)}" rel="noopener noreferrer">${esc(ui.readOriginal)}</a></p>
  <p class="news-note">${esc(ui.newsNote)}</p>
</div>`
    : '';

  const body = `
${crumbs(lang, [
    { label: ui.title, href: `${prefix}/discover` },
    { label: title },
  ])}
<article>
<h1>${esc(title)}</h1>
${date ? `<p class="updated">${esc(date)}</p>` : ''}
${summary ? `<p class="lede">${esc(summary)}</p>` : ''}
${bodyHtml}
${sourceBlock}
</article>
${shareRow(lang, shareUrl, title)}
<p class="updated"><a href="${prefix}/discover">${esc(ui.backToDiscover)}</a></p>
${ctaCard(lang)}
`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG_LD,
      breadcrumbLd([
        { name: ui.title, path: `${prefix}/discover` },
        { name: title, path: `${prefix}/discover/${slug}` },
      ]),
      {
        '@type': 'Article',
        headline: title,
        description: summary,
        inLanguage: L[lang].htmlLang,
        ...(date ? { datePublished: date, dateModified: date } : {}),
        mainEntityOfPage: `${SITE_ORIGIN}${prefix}/discover/${slug}`,
        author: { '@type': 'Organization', name: 'CantoBuddy' },
        publisher: {
          '@type': 'Organization',
          name: 'CantoBuddy',
          logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/icons/icon-512.png` },
        },
        // For an imported news item, point the crawler at the original too, so
        // the source keeps the credit and the traffic.
        ...(post.source_url ? { isBasedOn: post.source_url } : {}),
      },
    ],
  };

  return page({
    lang,
    title: `${title} | CantoBuddy`,
    description: summary || title,
    path: `${prefix}/discover/${slug}`,
    jsonLd,
    body,
    ogImage: articleOgImage(post),
    ogImageAlt: title,
    /* IMPORTED NEWS IS NOINDEX, AND THAT IS THE POINT.
     *
     * The importer runs hourly and pruneNewsPast() deletes its rows after
     * three days, so every imported article is a URL that is thin (a summary
     * plus a link to the source — the body columns are never filled from a
     * feed, for copyright reasons), duplicated from whoever wrote it, and
     * guaranteed to 404 within 72 hours.
     *
     * Asking Google to index that was actively harmful, and the Search Console
     * data proved it: ~25 of the 34 "Crawled - currently not indexed" pages
     * were imported news, and another 24 URLs sat in "Not found (404)" after
     * their rows were pruned. The site was spending its crawl budget on pages
     * it would delete, and collecting error buckets for doing so.
     *
     * These pages are not hidden. They still render, still return 200, and are
     * still linked from /discover — they exist for in-app freshness, which is
     * what they are good at. They simply stop competing in the index, which
     * frees crawl budget for the vocabulary pages that are meant to rank.
     *
     * `follow` stays on: the source attribution link is worth passing, and a
     * noindex,follow page is still a useful hop.
     *
     * Operator-written news is NOT included: it never expires, so it is
     * evergreen and indexable like any culture post. Same `origin === 'auto'`
     * test the pruner uses, so the two cannot disagree about which rows die. */
    noindex: post.origin === 'auto',
    /* hreflang is meaningless on a noindex page — Google ignores it, and
       emitting alternates that all point at noindex URLs only creates noise.
       On an indexable post, the set is filtered to the languages that ACTUALLY
       have a translation: listing /fil/discover/<slug> as the Filipino version
       when it is the English article verbatim is the claim that produced the
       duplicate-canonical report in the first place. */
    alternates: post.origin === 'auto' || !translated
      ? []
      : hreflangLinks((l) => (isTranslated(post, l) ? `${LANG_PREFIX[l]}/discover/${slug}` : null)),
    /* AN UNTRANSLATED VARIANT IS NOT A SEPARATE DOCUMENT.
       /fil/discover/<slug> renders the English title and body, so declaring it
       self-canonical asks Google to index two identical pages. It now points
       its canonical at the English URL — which is simply true — and Google
       files it as "Alternate page with proper canonical tag", an intentional
       state, instead of "Duplicate, Google chose different canonical", which
       means it overruled us. */
    canonicalPath: translated ? `${prefix}/discover/${slug}` : `/discover/${slug}`,
  });
}

/* ===========================================================================
   Outings — /places and /places/<slug>
   ===========================================================================
   The app's Outings tab is drawn entirely by app.js into one URL. It has 17
   real Hong Kong photographs, 17 MTR/ferry routes, opening hours, fares and
   tips — and none of it existed as HTML for a crawler. A search for "Peak Tram
   how to get there" could not land on a page that answers it.

   These two renderers publish that content in all four language trees. Chrome
   AND the summary text come from the same i18n/places data the app uses, so
   the four trees are genuinely different documents and the hreflang set below
   is an honest claim rather than four copies of one English page.

   The hub is also the crawl path: every one of the 17 detail pages is linked
   from a plain <a href> here, from the sitemap, and from the Home photo strip.
   =========================================================================== */

/** Chrome that is SEO copy rather than UI copy, so it is not in i18n.js. */
const PLACE_SEO_UI = {
  en: {
    hubName: 'Days out in Hong Kong',
    hubTitle: 'Free days out in Hong Kong: MTR routes, hours and prices | CantoBuddy',
    hubDescription: 'Free and low-cost days out in Hong Kong for domestic helpers on their day off, with MTR and ferry routes, opening hours, fares and a real photograph of each place.',
    hubLede: (n) => `Pick one of ${n} days out in Hong Kong. Every guide gives the route from the MTR or ferry, what it costs, the opening hours and things worth knowing before you go — with a real photograph of the place.`,
    pageSuffix: 'Hong Kong day out: MTR route, opening hours and cost',
    moreDaysOut: 'More days out',
    inApp: 'Take the full route with you on your phone, with the Cantonese words you will need.',
  },
  fil: {
    hubName: 'Mga gala sa Hong Kong',
    hubTitle: 'Libreng gala sa Hong Kong: ruta ng MTR, oras at presyo | CantoBuddy',
    hubDescription: 'Libre at murang lakad sa Hong Kong para sa mga helper sa araw ng pahinga, na may ruta ng MTR at bangka, oras ng pagbubukas, pamasahe at totoong larawan ng bawat lugar.',
    hubLede: (n) => `Pumili sa ${n} gala sa Hong Kong. Bawat gabay ay may ruta mula sa MTR o bangka, magkano, oras ng pagbubukas, at mga dapat malaman bago umalis — na may totoong larawan ng lugar.`,
    pageSuffix: 'Gala sa Hong Kong: ruta, oras at gastos',
    moreDaysOut: 'Iba pang gala',
    inApp: 'Dalhin ang buong ruta sa iyong phone, kasama ang mga salitang Cantonese na kakailanganin mo.',
  },
  zh: {
    hubName: '香港好去处',
    hubTitle: '香港免费好去处：港铁路线、开放时间与费用 | CantoBuddy',
    hubDescription: '为香港家佣整理的放假好去处：港铁与渡轮路线、开放时间、票价，以及每个地点的实景照片。',
    hubLede: (n) => `从 ${n} 个香港好去处中挑一个。每篇都有港铁或渡轮路线、费用、开放时间和出发前的实用提示，并附上实景照片。`,
    pageSuffix: '香港好去处：交通路线、开放时间与费用',
    moreDaysOut: '其他好去处',
    inApp: '把完整路线带在手机上，还可以一起学会用得上的粤语词。',
  },
  id: {
    hubName: 'Jalan-jalan di Hong Kong',
    hubTitle: 'Jalan-jalan gratis di Hong Kong: rute MTR, jam buka dan biaya | CantoBuddy',
    hubDescription: 'Tempat jalan-jalan gratis dan murah di Hong Kong untuk asisten rumah tangga saat hari libur, lengkap dengan rute MTR dan kapal, jam buka, tarif, serta foto asli setiap tempat.',
    hubLede: (n) => `Pilih salah satu dari ${n} tempat jalan-jalan di Hong Kong. Setiap panduan berisi rute dari MTR atau kapal, biaya, jam buka, dan hal yang perlu diketahui sebelum berangkat — dengan foto asli tempatnya.`,
    pageSuffix: 'Jalan-jalan di Hong Kong: rute, jam buka dan biaya',
    moreDaysOut: 'Tempat lain',
    inApp: 'Bawa rute lengkapnya di ponsel, bersama kata-kata Kanton yang akan Anda butuhkan.',
  },
};

const placeCap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);

/** t() for the place dictionary, with the same {name} substitution the app uses. */
function placeT(lang, key, vars) {
  const dict = PLACE_I18N[lang] || PLACE_I18N.en;
  const raw = dict[key] != null ? dict[key] : (PLACE_I18N.en[key] != null ? PLACE_I18N.en[key] : key);
  return String(raw).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
}

const PLACE_TIME_KEYS = { fewHours: 'place.timeFew', halfDay: 'place.timeHalf', fullDay: 'place.timeFull' };
const placeTime = (p, lang) => placeT(lang, PLACE_TIME_KEYS[p.time] || 'place.timeFew');
const placeSummary = (p, lang) => (p.summary && (p.summary[lang] || p.summary.en)) || '';

function placeMoney(n) {
  const v = Math.round(Number(n) * 10) / 10;
  return Number.isInteger(v) ? `HK$${v}` : `HK$${v.toFixed(1)}`;
}

/** The one price on a card. A one-way fare says so, or a day on an island
 *  looks like it costs half of what it does. Same rule as app.js. */
function placePriceChip(p, lang) {
  if (!p.fee) return '';
  if (p.fee.free) return placeT(lang, 'place.free');
  const first = p.fee.items && p.fee.items[0];
  if (!first) return placeT(lang, 'place.free');
  const each = p.fee.oneWay ? ` ${placeT(lang, 'place.eachWay')}` : '';
  return `${first.approx ? '≈' : ''}${placeMoney(first.hkd)}${each}`;
}

/** One route step, mirroring app.js so the two never disagree. */
function placeStepText(s, lang) {
  if (s.t === 'mtr') {
    const base = placeT(lang, 'place.stepMtr', { station: s.station });
    return s.exit ? `${base} · ${placeT(lang, 'place.stepExit', { exit: s.exit })}` : base;
  }
  if (s.t === 'walk') {
    return s.to
      ? placeT(lang, 'place.stepWalkTo', { min: s.min, to: s.to })
      : placeT(lang, 'place.stepWalk', { min: s.min });
  }
  if (s.t === 'bus') {
    if (s.from && s.to) return `${placeT(lang, 'place.stepBusFrom', { route: s.route, from: s.from })} → ${s.to}`;
    if (s.to) return placeT(lang, 'place.stepBusTo', { route: s.route, to: s.to });
    return placeT(lang, 'place.stepBus', { route: s.route });
  }
  if (s.t === 'minibus') return placeT(lang, 'place.stepMinibusTo', { route: s.route, to: s.to });
  if (s.t === 'ferry') {
    return s.min
      ? placeT(lang, 'place.stepFerryMin', { to: s.to, min: s.min })
      : placeT(lang, 'place.stepFerryTo', { to: s.to });
  }
  if (s.t === 'tram') return placeT(lang, 'place.stepTram');
  return '';
}

/** The photograph is somebody's work under a licence that names them. */
function placeCreditHtml(p, lang) {
  const c = PLACE_CREDITS[p.slug];
  if (!c) return '';
  const author = String(c.author || '').replace(/\s*\(Wikimedia Commons\)$/i, '') || 'Wikimedia Commons';
  return `<p class="place-credit">${esc(placeT(lang, 'place.credit', { author, licence: c.licence }))}
    · <a href="${esc(c.page)}" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a></p>`;
}

function placeCardLi(p, lang, prefix) {
  return `<li class="place-card">
  <a href="${esc(`${prefix}/places/${p.slug}`)}">
    <img class="place-card-img" src="${esc(p.card)}" alt="${esc(p.name)} — ${esc(p.nameZh)}" loading="lazy" decoding="async" width="640" height="360" />
    <span class="place-card-body">
      <strong class="place-card-name">${esc(p.emoji)} ${esc(p.name)}</strong>
      <span class="place-card-zh">${esc(p.nameZh)}</span>
      <span class="place-card-meta">📍 ${esc(p.area)} · ⏱ ${esc(placeTime(p, lang))} · 💵 ${esc(placePriceChip(p, lang))}</span>
      <span class="place-card-sum">${esc(placeSummary(p, lang))}</span>
    </span>
  </a>
</li>`;
}

function renderPlacesHub(lang) {
  const ui = PLACE_SEO_UI[lang] || PLACE_SEO_UI.en;
  const prefix = LANG_PREFIX[lang] || '';

  // Grouped by kind: six real sections rather than one undifferentiated wall of
  // cards, and every group label is one the app already translates.
  const sections = PLACE_KINDS.map((kind) => {
    const list = PLACES.filter((p) => p.kind === kind);
    if (!list.length) return '';
    return `<h2 class="disc-h2">${esc(placeT(lang, `place.kind${placeCap(kind)}`))}</h2>
<ul class="place-grid">\n${list.map((p) => placeCardLi(p, lang, prefix)).join('\n')}\n</ul>`;
  }).join('\n');

  const body = `
${crumbs(lang, [{ label: ui.hubName }])}
<h1>${esc(ui.hubName)}</h1>
<p class="lede">${esc(ui.hubLede(PLACES.length))}</p>
${sections}
${ctaCard(lang)}
`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG_LD,
      breadcrumbLd([{ name: ui.hubName, path: `${prefix}/places` }]),
      {
        '@type': 'CollectionPage',
        name: ui.hubName,
        description: ui.hubDescription,
        url: `${SITE_ORIGIN}${prefix}/places`,
        inLanguage: L[lang].htmlLang,
        hasPart: PLACES.map((p) => ({
          '@type': 'TouristAttraction',
          name: p.name,
          url: `${SITE_ORIGIN}${prefix}/places/${p.slug}`,
        })),
      },
      {
        '@type': 'ItemList',
        numberOfItems: PLACES.length,
        itemListElement: PLACES.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: p.name,
          url: `${SITE_ORIGIN}${prefix}/places/${p.slug}`,
        })),
      },
    ],
  };

  return page({
    lang,
    title: ui.hubTitle,
    description: ui.hubDescription,
    path: `${prefix}/places`,
    jsonLd,
    body,
    ogImage: `${SITE_ORIGIN}/og-home.jpg`,
    alternates: hreflangLinks((l) => `${LANG_PREFIX[l]}/places`),
  });
}

/** One outing. Returns null for an unknown slug so the route answers 404. */
function renderPlace(lang, slug) {
  const p = PLACES.find((x) => x.slug === slug);
  if (!p) return null;
  const ui = PLACE_SEO_UI[lang] || PLACE_SEO_UI.en;
  const prefix = LANG_PREFIX[lang] || '';
  const free = !!(p.fee && p.fee.free);
  const summary = placeSummary(p, lang);
  const canonicalPath = `${prefix}/places/${p.slug}`;
  const shareUrl = `${SITE_ORIGIN}${canonicalPath}`;
  const title = `${p.name} (${p.nameZh}) — ${ui.pageSuffix}`;

  const steps = (p.steps || []).map((s) => `<li><span class="place-step-icon" aria-hidden="true">${
    { mtr: '🚇', walk: '🚶', bus: '🚌', minibus: '🚐', ferry: '⛴️', tram: '🚊' }[s.t] || '•'
  }</span>${esc(placeStepText(s, lang))}</li>`).join('\n');

  const feeRows = free ? '' : (p.fee.items || []).map((it) => {
    const when = it.when ? ` <span class="place-fee-when">${esc(placeT(lang, `place.fee${placeCap(it.when)}`))}</span>` : '';
    return `<li><span>${esc(placeT(lang, `place.fee${placeCap(it.label)}`))}${when}</span>
      <span class="place-fee-amt">${it.approx ? '≈' : ''}${esc(placeMoney(it.hkd))}</span></li>`;
  }).join('\n');

  const tips = (p.goodToKnow || []).map((tip) => `<li>${esc(tip)}</li>`).join('\n');

  // Internal links to sibling outings. Prefer the same kind (someone reading
  // about a hike is likelier to want another hike), then fill up to four from
  // the rest so a group with only one entry is never a dead end.
  const sameKind = PLACES.filter((x) => x.slug !== p.slug && x.kind === p.kind);
  const others = [...sameKind, ...PLACES.filter((x) => x.slug !== p.slug && x.kind !== p.kind)].slice(0, 4);
  const moreHtml = `<section class="place-more">
  <h2>${esc(ui.moreDaysOut)}</h2>
  <ul>${others.map((x) => `<li><a href="${esc(`${prefix}/places/${x.slug}`)}">${esc(x.emoji)} ${esc(x.name)}</a></li>`).join('\n')}</ul>
  <p class="updated"><a href="${esc(`${prefix}/places`)}">${esc(placeT(lang, 'place.back'))}</a></p>
</section>`;

  const body = `
${crumbs(lang, [{ label: ui.hubName, href: `${prefix}/places` }, { label: p.name }])}
<article class="place-article">
  <figure class="place-figure">
    <img class="place-hero" src="${esc(p.photo)}" alt="${esc(p.name)} — ${esc(p.nameZh)}, Hong Kong" width="1280" height="720" decoding="async" />
    <figcaption>${placeCreditHtml(p, lang)}</figcaption>
  </figure>
  <h1>${esc(p.emoji)} ${esc(p.name)}<span class="sub">${esc(p.nameZh)}</span></h1>
  ${summary ? `<p class="lede">${esc(summary)}</p>` : ''}
  <ul class="place-facts">
    <li><strong>${esc(placeT(lang, 'place.area'))}</strong>${esc(p.area)}</li>
    <li><strong>${esc(placeT(lang, 'place.timeNeeded'))}</strong>${esc(placeTime(p, lang))}</li>
    <li><strong>${esc(placeT(lang, 'place.cost'))}</strong>${esc(placePriceChip(p, lang))}</li>
  </ul>
  <h2>🚇 ${esc(placeT(lang, 'place.howToGet'))}</h2>
  <ol class="place-steps">${steps}</ol>
  <h2>💵 ${esc(placeT(lang, 'place.cost'))}</h2>
  ${free
    ? `<p class="place-free-note">🎉 ${esc(placeT(lang, 'place.free'))}</p>`
    : `<ul class="place-fees">${feeRows}</ul>`}
  ${!free && p.fee.oneWay ? `<p class="place-oneway-note">↔️ ${esc(placeT(lang, 'place.oneWayNote'))}</p>` : ''}
  <p class="place-prices-note">${esc(placeT(lang, 'place.pricesNote'))}</p>
  <h2>🕒 ${esc(placeT(lang, 'place.open'))}</h2>
  <p class="place-hours">${esc(p.hours)}</p>
  <h2>💡 ${esc(placeT(lang, 'place.goodToKnow'))}</h2>
  <ul class="place-tips">${tips}</ul>
</article>
${shareRow(lang, shareUrl, title)}
${moreHtml}
<div class="cta-card">
  <p>${esc(ui.inApp)}</p>
  <a class="cta" href="/?view=place&amp;p=${esc(encodeURIComponent(p.slug))}">${esc(L[lang].openApp)}</a>
</div>
`;

  const fares = free ? [] : (p.fee.items || []).map((it) => Number(it.hkd)).filter(Number.isFinite);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG_LD,
      breadcrumbLd([
        { name: ui.hubName, path: `${prefix}/places` },
        { name: p.name, path: canonicalPath },
      ]),
      {
        '@type': 'TouristAttraction',
        name: p.name,
        alternateName: p.nameZh,
        description: summary,
        inLanguage: L[lang].htmlLang,
        url: `${SITE_ORIGIN}${canonicalPath}`,
        image: `${SITE_ORIGIN}${p.photo}`,
        isAccessibleForFree: free,
        address: {
          '@type': 'PostalAddress',
          addressLocality: p.area,
          addressRegion: 'Hong Kong',
          addressCountry: 'HK',
        },
        ...(fares.length ? {
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'HKD',
            lowPrice: Math.min(...fares),
            offerCount: fares.length,
          },
        } : {}),
      },
    ],
  };

  return page({
    lang,
    title: `${title} | CantoBuddy`,
    description: summary || title,
    path: canonicalPath,
    jsonLd,
    body,
    ogImage: `${SITE_ORIGIN}${p.photo}`,
    ogImageAlt: `${p.name} (${p.nameZh}), Hong Kong`,
    // All four trees really do render translated chrome AND a translated
    // summary, so unlike the untranslated /discover posts every alternate is
    // an honest, distinct document.
    alternates: hreflangLinks((l) => `${LANG_PREFIX[l]}/places/${p.slug}`),
  });
}

// ---------------------------------------------------------------------------
// Stories — a helper's own life story, written in her own language
// ---------------------------------------------------------------------------

/**
 * A story's body is PLAIN TEXT, not the operator's HTML subset. She typed it
 * into a textarea, so the only structure she has is the newline: a blank line
 * is a paragraph break, a single newline is a line break. Escaping first and
 * adding structure after means nothing she types can ever become markup —
 * which matters more here than anywhere else on the site, because this is the
 * one page whose text a stranger wrote.
 */
function storyParagraphs(body) {
  return String(body || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

/** Her name, or the honest label when she chose not to put one to it. */
function storyByline(story, ui) {
  const name = String(story.display_name || '').trim();
  return name ? esc(name) : esc(ui.anonymous);
}

/** The label a reader needs: which language this story is in, in their own. */
function storyLangLabel(story, ui, readerLang) {
  const names = STORY_LANG_NAME[readerLang] || STORY_LANG_NAME.en;
  return `${esc(ui.writtenIn)}: ${esc(names[story.lang] || story.lang)}`;
}

/** One card on the shared shelf. */
function storyCardLi(story, ui, prefix) {
  const date = postDateShort(story.published_at);
  const meta = [date, storyByline(story, ui)].filter(Boolean).join(' · ');
  return `<li class="guide-card">
  <a href="${prefix}/stories/${esc(story.slug)}">
    <span class="em">📖</span>
    ${meta ? `<span class="pm">${esc(meta)}</span>` : ''}
    <span class="gt">${esc(story.title)}</span>
    ${story.gloss_en ? `<span class="gd">${esc(story.gloss_en)}</span>` : ''}
  </a>
</li>`;
}

/**
 * The Stories hub. ONE shared shelf in every language tree — the stories are
 * not translated, so filtering them by tree would show a reader a different
 * site depending on which language they browse in. See STORIES_UI.
 */
function renderStoriesHub(lang) {
  const ui = STORIES_UI[lang] || STORIES_UI.en;
  const prefix = LANG_PREFIX[lang] || '';

  const stories = store.listPublishedStories({ limit: 200 });

  const list = stories.length
    ? `<ul class="guide-list">\n${stories.map((s) => storyCardLi(s, ui, prefix)).join('\n')}\n</ul>`
    : `<p class="lede">${esc(ui.empty)}</p>`;

  const body = `
${crumbs(lang, [{ label: ui.title }])}
<h1>${esc(ui.title)}</h1>
<p class="lede">${esc(ui.lede)}</p>
${list}
<div class="cta-card">
  <p>${esc(ui.shareYoursBody)}</p>
  <a class="cta" href="/">${esc(ui.shareYours)}</a>
</div>
`;

  const title = {
    en: 'Stories from domestic helpers in Hong Kong | CantoBuddy',
    fil: 'Mga kuwento ng mga helper sa Hong Kong | CantoBuddy',
    zh: '香港家佣的真实故事 | CantoBuddy',
    id: 'Kisah para asisten rumah tangga di Hong Kong | CantoBuddy',
  }[lang];

  const description = {
    en: 'Real stories from domestic helpers in Hong Kong — daily life, family and what happened along the way. Written by helpers or retold from published reports, each with its source named.',
    fil: 'Totoong kuwento mula sa mga helper sa Hong Kong — pang-araw-araw na buhay, pamilya, at mga nangyari. Isinulat ng mga helper o muling isinalaysay mula sa ulat na nalathala, bawat isa ay may nakasaad na pinagmulan.',
    zh: '来自香港家佣的真实生活故事——日常、家人，以及一路上的经历。由家佣亲笔撰写，或根据已刊发报道改写，每篇均注明来源。',
    id: 'Kisah nyata dari para asisten rumah tangga di Hong Kong — kehidupan sehari-hari, keluarga, dan perjalanan hidup. Ditulis oleh para asisten atau diceritakan kembali dari laporan terbitan, masing-masing dengan sumber yang disebutkan.',
  }[lang];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG_LD,
      breadcrumbLd([{ name: ui.title, path: `${prefix}/stories` }]),
      {
        '@type': 'CollectionPage',
        name: title,
        description,
        url: `${SITE_ORIGIN}${prefix}/stories`,
        inLanguage: L[lang].htmlLang,
        hasPart: stories.slice(0, 50).map((s) => ({
          '@type': 'Article',
          headline: s.title,
          url: `${SITE_ORIGIN}${prefix}/stories/${s.slug}`,
          inLanguage: L[s.lang] ? L[s.lang].htmlLang : undefined,
        })),
      },
    ],
  };

  return page({
    lang,
    title,
    description,
    path: `${prefix}/stories`,
    jsonLd,
    body,
    alternates: hreflangLinks((l) => `${LANG_PREFIX[l]}/stories`),
  });
}

/** One story. Returns null for anything not published, so the route can 404. */
function renderStory(lang, slug) {
  const ui = STORIES_UI[lang] || STORIES_UI.en;
  const prefix = LANG_PREFIX[lang] || '';
  const story = store.getPublishedStoryBySlug(slug);
  // A pending or rejected story has no public page, exactly as a draft post has
  // none. To a reader who was sent the link, it simply does not exist yet.
  if (!story) return null;

  const date = postDateShort(story.published_at);
  const meta = [storyByline(story, ui), date, storyLangLabel(story, ui, lang)].filter(Boolean).join(' · ');

  // The gloss is optional and only ever hand-written by the operator. It is
  // labelled, and it sits after the original — never instead of it.
  const glossBlock = story.gloss_en
    ? `<div class="story-gloss">
  <h2>${esc(ui.gloss)}</h2>
  ${storyParagraphs(story.gloss_en)}
</div>`
    : '';

  // Editorial retellings link back to the published reporting. A community
  // submission has no source_url, so this stays empty for her own words.
  const sourceBlock = story.source_url
    ? `<p class="story-source">${esc(ui.source || 'Source')}: <a href="${esc(story.source_url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(story.source_name)} — ${esc(story.source_title)} — ${esc(story.source_date)}</a></p>`
    : '';

  const body = `
${crumbs(lang, [
    { label: ui.title, href: `${prefix}/stories` },
    { label: story.title },
  ])}
<article>
<h1>${esc(story.title)}</h1>
<p class="updated">${meta}</p>
${storyParagraphs(story.body)}
${glossBlock}
${sourceBlock}
</article>
<p class="updated"><a href="${prefix}/stories">${esc(ui.backToStories)}</a></p>
${ctaCard(lang)}
`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG_LD,
      breadcrumbLd([
        { name: ui.title, path: `${prefix}/stories` },
        { name: story.title, path: `${prefix}/stories/${slug}` },
      ]),
      {
        '@type': 'Article',
        headline: story.title,
        description: story.gloss_en || story.body.slice(0, 200),
        inLanguage: L[story.lang] ? L[story.lang].htmlLang : L[lang].htmlLang,
        ...(date ? { datePublished: date, dateModified: date } : {}),
        mainEntityOfPage: `${SITE_ORIGIN}${prefix}/stories/${slug}`,
        // A signed story is the helper's own account, so the credit is hers;
        // an unsigned one is credited to the site rather than to nobody, which
        // is what keeps the structured data valid.
        author: story.display_name
          ? { '@type': 'Person', name: story.display_name }
          : { '@type': 'Organization', name: 'CantoBuddy' },
        publisher: {
          '@type': 'Organization',
          name: 'CantoBuddy',
          logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/icons/icon-512.png` },
        },
      },
    ],
  };

  return page({
    lang,
    title: `${story.title} | CantoBuddy`,
    description: story.gloss_en || story.body.slice(0, 200),
    path: `${prefix}/stories/${slug}`,
    jsonLd,
    body,
    alternates: hreflangLinks((l) => `${LANG_PREFIX[l]}/stories/${slug}`),
  });
}

/**
 * The privacy policy page. Rendered from PRIVACY above, one entry per language.
 *
 * noindex is deliberately NOT set: Google's AdSense reviewers look for this
 * page, and a policy a reviewer cannot find is a policy that does not exist.
 * It is linked from the footer of every page (see page() and public/index.html),
 * which is where both a reader checking it and a crawler expect to find it.
 */
function renderPrivacy(lang) {
  const t = L[lang];
  const prefix = LANG_PREFIX[lang] || '';
  const p = PRIVACY[lang] || PRIVACY.en;

  const body = `
${crumbs(lang, [{ label: esc(p.title) }])}
<article>
<h1>${esc(p.title)}</h1>
<p class="lede">${esc(p.lede)}</p>
<p class="updated">${esc(p.updated)}</p>
${p.sections
  .map(
    (s) => `<h2>${esc(s.h)}</h2>
${s.p.map((para) => `<p>${esc(para)}</p>`).join('\n')}`
  )
  .join('\n')}
</article>
${ctaCard(lang)}
`;

  return page({
    lang,
    title: `${p.title} | CantoBuddy`,
    description: p.lede,
    path: `${prefix}/privacy`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: p.title,
      description: p.lede,
      inLanguage: t.htmlLang,
      mainEntityOfPage: `${SITE_ORIGIN}${prefix}/privacy`,
    },
    body,
    alternates: hreflangLinks((l) => `${LANG_PREFIX[l]}/privacy`),
  });
}

/** 404 body for an unknown content slug, so a bad URL stays useful. */
function renderNotFound(lang) {
  const t = L[lang];
  const prefix = LANG_PREFIX[lang] || '';

  const body = `
${crumbs(lang, [{ label: t.browse, href: `${prefix}/learn` }])}
<h1>${esc(t.notFound)}</h1>
<p class="lede">${esc(t.notFoundBody)}</p>
<a class="cta" href="${prefix}/learn">${esc(t.browse)}</a>
`;
  return page({
    lang,
    title: `${t.notFound} | CantoBuddy`,
    description: t.notFoundBody,
    path: `${prefix}/learn`,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: t.notFound },
    body,
    noindex: true,
  });
}

/** id -> slug for the whole enabled vocabulary. Lets /api/vocabulary hand the
 *  app a real page URL for each word, so "share this word" can deep-link to
 *  /words/<slug> instead of dumping the recipient at the app root. */
function wordSlugMap() {
  const { bySlug } = buildWordIndex();
  const m = new Map();
  for (const [slug, w] of bySlug) m.set(w.id, slug);
  return m;
}

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

/**
 * The date the site's *shell* (routes, templates, sitemap shape) last changed.
 * Bumped by hand when that changes — it is the honest `lastmod` for the
 * handful of URLs whose content is not a dated document (the hub pages, the
 * privacy policy, and their language variants).
 *
 * It is deliberately NOT "today". See the note in renderSitemap() for why a
 * lastmod that equals the crawl date is worse than no lastmod at all.
 */
const SITE_STRUCTURE_DATE = '2026-10-17';

// ---------------------------------------------------------------------------
// Living passages (server-rendered head + hub)
//
// The Living passages are substantial, SEO-minded articles for prospective
// foreign domestic helpers (the FDW system, the contract, real costs, everyday
// life). They are served by the SPA at /living/<slug>, which deep-links and
// renders them client-side — so a crawler DOES see the body after JS. The one
// thing the SPA shell does not give them is a distinct <title> / meta / OG, so
// every passage inherits the app's generic homepage title and competes with it.
//
// These helpers fix that without forking the page: livingPostShell() injects a
// per-passage <head> (title, description, canonical, OG, Article JSON-LD) into
// the SPA shell, so the SAME interactive page keeps a distinct identity for
// search and social. renderLivingHub() is a standalone, crawlable directory of
// every passage, so the set has a proper entry point and internal links.
// ---------------------------------------------------------------------------

const SPA_SHELL = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');

const LIVING_CAT_LABEL = {
  medical: 'Medical', holiday: 'Holidays', entertainment: 'Entertainment',
  homesick: 'Homesick', food: 'Food', transport: 'Transport',
  churches: 'Churches', before: 'Before You Come',
};
// The order a reader expects, not the order above: what to know BEFORE you
// come first, then the situations in the order she is likely to meet them.
// Mirrors LIVING_CAT_ORDER in public/app.js so the shelf and this page agree.
const LIVING_CAT_ORDER = ['before', 'medical', 'holiday', 'entertainment', 'homesick', 'food', 'transport', 'churches'];

/** Plain-text snippet for meta descriptions and hub cards. */
function plainSnippet(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
}

/** Inject a per-passage <head> into the SPA shell, replacing the generic tags. */
function injectLivingHead(shell, o) {
  let h = shell;
  h = h.replace(/<title>[^<]*<\/title>/, `<title>${esc(o.title)}</title>`);
  h = h.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(o.description)}" />`);
  h = h.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(SITE_ORIGIN + o.canonicalPath)}" />`);
  h = h.replace(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="${esc(o.ogType || 'website')}" />`);
  h = h.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(o.title)}" />`);
  h = h.replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(o.description)}" />`);
  h = h.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(SITE_ORIGIN + o.canonicalPath)}" />`);
  h = h.replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(o.title)}" />`);
  h = h.replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(o.description)}" />`);
  // A Living passage is served from the SPA shell, whose head carries the home
  // page's social card. Replace it too, or a forwarded guide still previews as
  // the homepage.
  if (o.ogImage) {
    h = h.replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(o.ogImage)}" />`);
    h = h.replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(o.ogImage)}" />`);
  }
  const ld = o.jsonLd ? `\n  <script type="application/ld+json">${JSON.stringify(o.jsonLd)}</script>` : '';
  return h.replace('</head>', `${ld}\n</head>`);
}

/** A passage's server-rendered shell, or null if it is missing/unpublished. */
function livingPostShell(slug) {
  const post = store.getLivingPostBySlug(String(slug || ''));
  if (!post || post.status !== 'published') return null;
  const title = `${post.title_en || post.slug} | CantoBuddy`;
  const description = plainSnippet(post.sub_en || post.body_en, 155)
    || 'A practical guide for foreign domestic helpers in Hong Kong.';
  const canonicalPath = `/living/${post.slug}`;
  const published = (post.published_at || SITE_STRUCTURE_DATE).slice(0, 10);
  const modified = (post.updated_at || post.published_at || SITE_STRUCTURE_DATE).slice(0, 10);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title_en || post.slug,
    description,
    inLanguage: 'en',
    datePublished: published,
    dateModified: modified,
    publisher: ORG_LD,
    mainEntityOfPage: `${SITE_ORIGIN}${canonicalPath}`,
  };
  return injectLivingHead(SPA_SHELL, {
    title, description, canonicalPath,
    ogType: 'article', jsonLd,
    ogImage: articleOgImage(post),
  });
}

/**
 * Standalone, crawlable directory of every published Living passage.
 *
 * Organised the way the app's Living shelf is organised: the practical
 * channels first (words for today), then the passages grouped by situation
 * (before you come, medical, holiday…). One registry drives both, so the page
 * a crawler reads and the shelf a helper taps never drift apart.
 */
function renderLivingHub() {
  const posts = store.listLivingPosts({ limit: 300 });

  // Practical channels — same registry, same order, same labels as the app.
  const practicalGroups = PRACTICAL_CHANNELS
    .map((c) => ({ c, list: store.listPosts({ status: 'published', channel: c.channel, limit: 50 }) }))
    .filter((g) => g.list.length);

  const practicalSection_ = practicalGroups.length
    ? `<h2 class="disc-h2">${esc(practicalSection('practical', 'en').title)}</h2>
<p class="lede">${esc(practicalSection('practical', 'en').lede)}</p>
${practicalGroups.map((g) => `
<h3 class="disc-h3">${esc(practicalText(g.c, 'label', 'en'))}</h3>
<p class="lede">${esc(practicalText(g.c, 'lede', 'en'))}</p>
<ul class="guide-list">
${g.list.map((p) => postCardLi(p, 'en', '')).join('\n')}
</ul>`).join('\n')}`
    : '';

  // Passages, grouped by situation. LIVING_CAT_ORDER is the order a reader
  // expects — "before you come" first, not whatever order the DB returns.
  const catOrder = LIVING_CAT_ORDER;
  const byCat = new Map();
  for (const p of posts) {
    const k = p.category || 'other';
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k).push(p);
  }
  const cats = [...byCat.keys()].sort((a, b) => {
    const ia = catOrder.indexOf(a);
    const ib = catOrder.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  const passageCard = (p) => {
    const title = p.title_en || p.slug;
    const sub = p.sub_en || '';
    const snippet = plainSnippet(p.body_en, 160);
    return `<li class="guide-card">
  <a href="/living/${esc(p.slug)}">
    <span class="em">${esc(p.icon || '🏠')}</span>
    ${sub ? `<span class="pm">${esc(LIVING_CAT_LABEL[p.category] || p.category)} · ${esc(sub)}</span>` : `<span class="pm">${esc(LIVING_CAT_LABEL[p.category] || p.category)}</span>`}
    <span class="gt">${esc(title)}</span>
    ${snippet ? `<span class="gd">${esc(snippet)}</span>` : ''}
  </a>
</li>`;
  };

  const passages = posts.length
    ? `<h2 class="disc-h2">${esc(practicalSection('passages', 'en').title)}</h2>
<p class="lede">${esc(practicalSection('passages', 'en').lede)}</p>
${cats.map((c) => `
<h3 class="disc-h3">${esc(LIVING_CAT_LABEL[c] || c)}</h3>
<ul class="guide-list">
${byCat.get(c).map(passageCard).join('\n')}
</ul>`).join('\n')}`
    : `<p class="lede">Practical guides for life in Hong Kong.</p>`;

  const title = 'Practical guides for life in Hong Kong | CantoBuddy';
  const description = 'Plain-English guides for foreign domestic helpers in Hong Kong — the FDW system, your contract, real costs, everyday life, and the Cantonese words you need at the market, at home, and when you feel unwell.';
  const path = '/living';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG_LD,
      breadcrumbLd([{ name: 'Living guides', path }]),
      {
        '@type': 'CollectionPage',
        name: title,
        description,
        url: `${SITE_ORIGIN}${path}`,
        inLanguage: 'en',
        hasPart: [
          ...practicalGroups.flatMap((g) => g.list).map((p) => ({
            '@type': 'Article',
            headline: p.title_en || p.slug,
            url: `${SITE_ORIGIN}/discover/${p.slug}`,
            inLanguage: 'en',
          })),
          ...posts.slice(0, 50).map((p) => ({
            '@type': 'Article',
            headline: p.title_en || p.slug,
            url: `${SITE_ORIGIN}/living/${p.slug}`,
            inLanguage: 'en',
          })),
        ],
      },
    ],
  };
  const body = `
${crumbs('en', [{ label: 'Living guides' }])}
<h1>Living guides for domestic helpers in Hong Kong</h1>
<p class="lede">${esc(description)}</p>
${practicalSection_}
${passages}
${ctaCard('en')}
`;
  return page({
    lang: 'en', title, description, path, jsonLd, body,
    ogImage: `${SITE_ORIGIN}/og-home.jpg`,
  });
}

/* ============================ English Track (/en) ============================
   Server-rendered SEO siblings of the /en single-page app. The /en app (en.html)
   renders nothing crawlable at its own URL, so Google sees an empty shell and
   assigns no rankings — the gap the operator reported. Mirroring the main site,
   the SPA stays at /en and the content is exposed as plain HTML here, linked from
   /en, and listed in the sitemap. Content is sourced from the same seed the app
   is built from (en-data.js) so the two can never disagree.
   ============================================================================ */
/* Read the English track from the SAME database the app uses (cantobuddy-en.db,
 * via en.js), NOT from the seed. The seed only fills an empty DB; once populated
 * the DB is the source of truth, and an operator edit must show up on these pages
 * too. server.js already loads en.js, so requiring it here reuses that module and
 * its single connection. */
function enWordRows() {
  // listEnWords({}) returns words AND scenario sentences; the SEO pages are about
  // browsable words, so sentences are filtered out exactly as the app does.
  return enStore.listEnWords({}).filter((v) => v.type === 'word');
}
function enCategoryRows() {
  return enStore.listEnCategories();
}
function enCatById(cats, id) {
  return cats.find((c) => c.id === id) || null;
}

/* Unique slug index, mirroring buildWordIndex() for the main site.
 * A handful of English words appear in two rooms (Tap in Kitchen and Toilet,
 * Table in Bedroom and Living Room), so slugify(english) alone collides: the
 * second word would be unreachable and the sitemap would list the same URL
 * twice. A colliding slug gains its category id, which is stable across boots.
 * Built per render (not once at boot) so a DB change is reflected immediately,
 * the same way buildWordIndex() works for the Cantonese site. */
function buildEnWordIndex() {
  const words = enWordRows();
  const bySlug = new Map();
  const byWord = new Map();
  const used = new Set();
  for (const w of words) {
    let s = slugify(w.english);
    if (used.has(s)) s = `${s}-${w.category_id}`;
    let n = 2;
    while (used.has(s)) { s = `${slugify(w.english)}-${w.category_id}-${n++}`; }
    used.add(s);
    bySlug.set(s, w);
    byWord.set(w, s);
  }
  return { words, bySlug, byWord };
}

/* hreflang for an English-only page: it is its own alternate, and x-default
 * points at it. Used in both the <head> and the sitemap. */
function enAlternates(path) {
  return [{ lang: 'en', path }, { lang: 'x-default', path }];
}

function renderEnLearnHub() {
  const cats = enCategoryRows();
  const words = enWordRows();
  const cards = cats.map((c) => {
    const count = words.filter((w) => w.category_id === c.id).length;
    return `<li><a href="/en/category/${esc(slugify(c.name_en))}">
      <span class="em">${esc(c.icon || '')}</span>
      <span class="t">${esc(c.name_en)}</span>
      <span class="n">${count} words</span>
    </a></li>`;
  }).join('\n');

  const body = `
<h1>English for Daily Life</h1>
<p class="lede">Simple English words and phrases for everyday home life in Hong Kong — name household items room by room, give the helper housework instructions, and shop with confidence. Each word shows its Cantonese meaning so you can learn at home.</p>
<ul class="grid">
${cards}
</ul>
${ctaCard('en', '', '/en')}
`;
  return page({
    lang: 'en',
    title: 'English for Daily Life — Learn Everyday English | CantoBuddy',
    description: 'Simple English words and phrases for elderly learners in Hong Kong: household items, shopping, greetings and emergencies, each with its Cantonese meaning. Free.',
    path: '/en/learn',
    body,
    brandHref: '/en',
    ctaHref: '/en',
    alternates: enAlternates('/en/learn'),
  });
}

function renderEnCategory(slug) {
  const idx = buildEnWordIndex();
  const cat = enCategoryRows().find((c) => slugify(c.name_en) === slug);
  if (!cat) return null;
  const words = idx.words.filter((w) => w.category_id === cat.id);
  const rows = words.map((w) => `<li><a href="/en/words/${esc(idx.byWord.get(w))}">
    <span class="em">${esc(w.emoji || '')}</span>
    <span class="han">${esc(w.english)}<span class="n">${esc(w.cantonese || '')}</span></span>
  </a></li>`).join('\n');
  const body = `
<nav class="crumbs" aria-label="Breadcrumb"><a href="/en/learn">English for Daily Life</a><span class="sep">›</span><span>${esc(cat.name_en)}</span></nav>
<h1>${esc(cat.icon || '')} ${esc(cat.name_en)}</h1>
<p class="lede">English words for ${esc(cat.name_en).toLowerCase()} — each shown with its Cantonese meaning (${esc(cat.name_yue || '')}) so you can learn at home.</p>
<ul class="grid">
${rows}
</ul>
${ctaCard('en', '', '/en')}
`;
  return page({
    lang: 'en',
    title: `${cat.name_en} — Everyday English Words | CantoBuddy`,
    description: `Learn ${cat.name_en} in English with Cantonese meanings. Free everyday English words for elderly learners and domestic helpers in Hong Kong.`,
    path: `/en/category/${slug}`,
    body,
    brandHref: '/en',
    ctaHref: '/en',
    alternates: enAlternates(`/en/category/${slug}`),
  });
}

function renderEnWord(slug) {
  const idx = buildEnWordIndex();
  const w = idx.bySlug.get(slug);
  if (!w) return null;
  const cat = enCatById(enCategoryRows(), w.category_id);
  const catName = cat ? cat.name_en : 'Useful Words';
  const catSlug = cat ? slugify(cat.name_en) : 'useful-words';
  const related = idx.words.filter((r) => r.category_id === w.category_id && r.english !== w.english).slice(0, 12);
  const relatedBlock = related.length ? `<h2>More ${esc(catName)} words</h2>
<ul class="grid">
${related.map((r) => `<li><a href="/en/words/${esc(idx.byWord.get(r))}">
  <span class="em">${esc(r.emoji || '')}</span>
  <span class="han">${esc(r.english)}<span class="n">${esc(r.cantonese || '')}</span></span>
</a></li>`).join('\n')}
</ul>` : '';
  const body = `
<nav class="crumbs" aria-label="Breadcrumb"><a href="/en/learn">English for Daily Life</a><span class="sep">›</span><a href="/en/category/${esc(catSlug)}">${esc(catName)}</a><span class="sep">›</span><span>${esc(w.english)}</span></nav>
<h1 class="word-hero">
  <span class="han">${esc(w.english)}</span>
  ${w.phonetic ? `<span class="jy">${esc(w.phonetic)}</span>` : ''}
  ${w.cantonese ? `<span class="gloss">${esc(w.cantonese)}</span>` : ''}
</h1>
<dl class="meta">
  <dt>English</dt><dd>${esc(w.english)}</dd>
  ${w.phonetic ? `<dt>Say it like</dt><dd>${esc(w.phonetic)}</dd>` : ''}
  ${w.cantonese ? `<dt>廣東話 (Cantonese)</dt><dd lang="zh-Hans">${esc(w.cantonese)}</dd>` : ''}
  <dt>Topic</dt><dd><a href="/en/category/${esc(catSlug)}">${esc(catName)}</a></dd>
</dl>
${ctaCard('en', '', '/en')}
${relatedBlock}
`;
  const desc = `${w.english}${w.phonetic ? `, pronounced "${w.phonetic}"` : ''}${w.cantonese ? `, means ${w.cantonese} in Cantonese` : ''}. A simple everyday English word for elderly learners in Hong Kong.`;
  return page({
    lang: 'en',
    title: `${w.english} — English word with Cantonese meaning | CantoBuddy`,
    description: desc,
    path: `/en/words/${slug}`,
    body,
    brandHref: '/en',
    ctaHref: '/en',
    alternates: enAlternates(`/en/words/${slug}`),
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        ORG_LD,
        { '@type': 'DefinedTerm', name: w.english, alternateName: w.cantonese, description: desc, inLanguage: 'en', url: `${SITE_ORIGIN}/en/words/${slug}` },
      ],
    },
  });
}

/* ============================ Pillar / topic pages ============================
   Indexable pages organised by SEARCH INTENT, not by the database schema. Each
   links into the real vocabulary, Discover and /en pages, so the crawlable
   surface area grows and the pages reinforce one another. Content lives in
   pillars-content.js in all four languages, because a Filipino searcher types a
   Filipino query and should land on a Filipino URL.
   ============================================================================ */
const { PILLARS } = require('./pillars-content');

function pillarCatLinks(regex, lang, limit) {
  const prefix = LANG_PREFIX[lang] || '';
  return store.listEnabledCategories()
    .filter((c) => regex.test(c.name_en))
    .slice(0, limit || 12)
    .map((c) => `<li><a href="${prefix}/learn/${esc(slugify(c.name_en))}"><span class="em">${esc(c.icon || '')}</span> ${esc(catName(c, lang))}</a></li>`)
    .join('\n');
}

function pillarBySlug(lang, slug) {
  for (const key of Object.keys(PILLARS)) {
    const p = PILLARS[key];
    if (p[lang] && p[lang].slug === slug) return { key, def: p };
  }
  return null;
}

const PILLAR_UI = {
  en: { start: 'Start with these topics', know: 'Good to know', elderly: 'English for Daily Life (elderly track)' },
  fil: { start: 'Simulan sa mga paksang ito', know: 'Dapat mong malaman', elderly: 'English for Daily Life (para sa matatanda)' },
  zh: { start: '从这些主题开始', know: '值得知道', elderly: '每日英语（长者专区）' },
  id: { start: 'Mulai dari topik ini', know: 'Perlu diketahui', elderly: 'Bahasa Inggris Sehari-hari (jalur lansia)' },
};

function renderPillar(lang, slug) {
  const hit = pillarBySlug(lang, slug);
  if (!hit) return null;
  const { key, def } = hit;
  const c = def[lang];
  const prefix = LANG_PREFIX[lang] || '';
  const path = `${prefix}/${slug}`;
  const ui = PILLAR_UI[lang] || PILLAR_UI.en;

  // hreflang: every language's own slug for this same pillar.
  const alternates = hreflangLinks((l) => {
    const s = def[l] && def[l].slug;
    return s ? `${LANG_PREFIX[l] || ''}/${s}` : null;
  });

  let links = pillarCatLinks(def.catRegex, lang);
  if (def.postSlug) {
    links = `<li><a href="${prefix}/discover/${esc(def.postSlug)}"><span class="em">📖</span> ${esc(c.postLabel)}</a></li>\n` + links;
  }
  if (key === 'cantonese-for-elderly-learners') {
    links = `<li><a href="/en/learn"><span class="em">📘</span> ${esc(ui.elderly)}</a></li>\n` + links;
  }

  const tips = (c.tips || []).map((t) => `<li>${esc(t)}</li>`).join('\n');
  const body = `
<h1>${esc(c.title)}</h1>
<p class="lede">${esc(c.description)}</p>
<p>${esc(c.intro)}</p>
<h2>${esc(ui.start)}</h2>
<ul class="grid">
${links}
</ul>
${tips ? `<h2>${esc(ui.know)}</h2>\n<ul>\n${tips}\n</ul>` : ''}
${ctaCard(lang, '', '/')}
`;
  return page({
    lang,
    title: `${c.title} | CantoBuddy`,
    description: c.description,
    path,
    body,
    alternates,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        ORG_LD,
        { '@type': 'WebPage', name: c.title, description: c.description, url: `${SITE_ORIGIN}${path}`, inLanguage: L[lang].htmlLang },
      ],
    },
  });
}

/* ============================ Phrase of the Day ============================
   One crawlable, permanent page per calendar day. The daily-phrase logic
   (daily-phrase.js) is a pure function of vocabulary + date; here we render it
   as static HTML so each day accrues its own indexable URL — about 365 new
   pages a year — instead of living only inside the SPA.
   ============================================================================ */
const PHRASE_POOL = (() => {
  let pool = [];
  for (const id of dailyPhrase.KITCHEN_CATEGORY_IDS) {
    pool = pool.concat(store.listVocabulary({ category_id: id, enabledOnly: true }));
  }
  return pool;
})();

function hkDateStr(d) {
  const hk = new Date(d.getTime() + 8 * 3600 * 1000);
  return hk.toISOString().slice(0, 10);
}

function renderPhrase(dateStr) {
  const date = dateStr || hkDateStr(new Date());
  // Reject anything that is not a REAL calendar date. A format-only check lets
  // /phrase/2026-13-99 through (Date.UTC normalises it), which would make every
  // typo an indexable page — an unbounded set of soft-404 junk URLs.
  if (dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  }
  const word = dailyPhrase.pickPhrase(PHRASE_POOL, date);
  if (!word) return null;
  const { bySlug } = buildWordIndex();
  let slug = null;
  for (const [s, w] of bySlug) { if (w.id === word.id) { slug = s; break; } }
  const title = `Cantonese Phrase for ${date} — ${word.cantonese}${word.jyutping ? ` (${word.jyutping})` : ''} | CantoBuddy`;
  const description = `Daily Cantonese phrase for ${date}: ${word.cantonese}${word.jyutping ? ` (${word.jyutping})` : ''} means "${word.english}". Practise with CantoBuddy's free audio and quiz.`;
  const body = `
<h1>Daily Cantonese Phrase</h1>
<p class="lede">A Cantonese phrase to practise every day. This one is for the Hong Kong date ${esc(date)}.</p>
<h1 class="word-hero">
  <span class="han">${esc(word.cantonese)}</span>
  ${word.jyutping ? `<span class="jy">${esc(word.jyutping)}</span>` : ''}
  <span class="gloss">${esc(word.english)}</span>
</h1>
<dl class="meta">
  <dt>Cantonese</dt><dd>${esc(word.cantonese)}</dd>
  ${word.jyutping ? `<dt>Jyutping</dt><dd>${esc(word.jyutping)}</dd>` : ''}
  <dt>English</dt><dd>${esc(word.english)}</dd>
  ${word.tagalog ? `<dt>Filipino</dt><dd>${esc(word.tagalog)}</dd>` : ''}
  <dt>Date</dt><dd>${esc(date)}</dd>
</dl>
${slug ? `<p><a class="cta" href="/words/${esc(slug)}">Practise “${esc(word.cantonese)}” with audio &amp; quiz →</a></p>` : ''}
${ctaCard('en', '', '/')}
`;
  return page({
    lang: 'en',
    title,
    description,
    path: dateStr ? `/phrase/${dateStr}` : '/phrase',
    body,
    alternates: [{ lang: 'en', path: dateStr ? `/phrase/${dateStr}` : '/phrase' }],
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        ORG_LD,
        { '@type': 'DefinedTerm', name: word.cantonese, alternateName: word.english, description, inLanguage: 'yue', url: `${SITE_ORIGIN}${dateStr ? `/phrase/${dateStr}` : '/phrase'}` },
      ],
    },
  });
}

function renderSitemap() {
  const urls = [];

  /**
   * @param loc         path relative to SITE_ORIGIN
   * @param lastmod     ISO date (YYYY-MM-DD) this URL's content truly changed.
   *                    MUST be a real date. Passing today's date for a page
   *                    that did not change is the single most common way a
   *                    sitemap loses Google's trust — see the block comment
   *                    below the function.
   */
  const add = (loc, priority, changefreq, alternates, lastmod) => {
    const alts = (alternates || [])
      .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.lang}" href="${esc(SITE_ORIGIN + a.path)}" />`)
      .join('\n');
    urls.push(`  <url>
    <loc>${esc(SITE_ORIGIN + loc)}</loc>
    <lastmod>${esc(lastmod)}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${alts}
  </url>`);
  };

  // The SPA itself. Its alternates point at each tree's hub, because "/" is
  // only the app in English — every other language enters through its own
  // /<lang>/learn.
  //
  // Derived from LANGS rather than hand-written. This list WAS hand-written,
  // and when the fourth tree shipped it silently lost `id` while every other
  // entry in the sitemap gained it — a one-language hole in the alternates of
  // the single highest-priority URL on the site. A derived list cannot drift
  // that way: `en` has an empty prefix, so it resolves to "/" and x-default
  // follows it, exactly as before.
  add('/', '1.0', 'weekly', hreflangLinks((l) => (LANG_PREFIX[l] ? `${LANG_PREFIX[l]}/learn` : '/')), SITE_STRUCTURE_DATE);

  // Hubs.
  for (const prefix of Object.values(LANG_PREFIX)) {
    add(`${prefix}/learn`, '0.9', 'weekly', hreflangLinks((l) => `${LANG_PREFIX[l]}/learn`), SITE_STRUCTURE_DATE);
  }

  // Guides. High priority relative to the word pages: they are the pages most
  // likely to rank for a query, and the ones a crawler should read first.
  //
  // The hub takes the newest date among the guides it lists (it is a directory
  // of them, so it is as fresh as its freshest entry); each guide takes its own
  // `updated`. Both are real dates declared in content.js, not the crawl date.
  const newestGuide = GUIDES.reduce((m, g) => (g.updated > m ? g.updated : m), UPDATED);
  for (const prefix of Object.values(LANG_PREFIX)) {
    add(`${prefix}/guide`, '0.8', 'monthly', hreflangLinks((l) => `${LANG_PREFIX[l]}/guide`), newestGuide);
    for (const g of GUIDES) {
      add(`${prefix}/guide/${g.slug}`, '0.8', 'monthly',
        hreflangLinks((l) => `${LANG_PREFIX[l]}/guide/${g.slug}`), g.updated || UPDATED);
    }
  }

  // The privacy policy, in every tree. Low priority and yearly — it is not a
  // page anyone is searching for — but listed so AdSense's reviewers (and
  // anyone else looking) can find it without hunting through the footer.
  for (const prefix of Object.values(LANG_PREFIX)) {
    add(`${prefix}/privacy`, '0.3', 'yearly', hreflangLinks((l) => `${LANG_PREFIX[l]}/privacy`), SITE_STRUCTURE_DATE);
  }

  // The employer landing page. ONE URL, not four: it is English only (so are
  // the portal's own labels), so it has no tree to mirror and no hreflang
  // alternates. Priority sits above /learn because this is the page that turns
  // a family into a connected employer, and it is the only page on the site
  // written for the person who is not the learner.
  add('/portal', '0.8', 'monthly', null, SITE_STRUCTURE_DATE);

  // Daily Tools — the four offline-first utilities for helpers. One English
  // URL only, like /portal: the page has no language tree yet, so advertising
  // four alternates would point three of them at an untranslated document.
  // Priority below /learn because the vocabulary is the site's primary job,
  // but above the publisher pages because people do search for these tools.
  add('/tools', '0.7', 'monthly', null, SITE_STRUCTURE_DATE);

  // Publisher identity. AdSense would not approve a site that had none of
  // these, and a reader deciding whether to trust a privacy policy wants to
  // know who wrote it. Low priority because nobody searches for them — they
  // exist to be found from the footer, not from Google.
  add('/about', '0.4', 'yearly', null, SITE_STRUCTURE_DATE);
  add('/contact', '0.4', 'yearly', null, SITE_STRUCTURE_DATE);
  add('/terms', '0.3', 'yearly', null, SITE_STRUCTURE_DATE);
  add('/disclaimer', '0.3', 'yearly', null, SITE_STRUCTURE_DATE);

  // The long-form shelf index. Priority above the publisher pages because it
  // IS content, and it is the one page that links all eighteen articles in a
  // single crawl. lastmod is the newest article it lists, not the crawl date —
  // the same honesty rule the /discover and /living hubs follow.
  const newestLongformArticle = LONGFORM_GUIDES.reduce(
    (m, g) => {
      const d = postDateShort(g.published_at);
      return d > m ? d : m;
    },
    SITE_STRUCTURE_DATE
  );
  add('/articles', '0.8', 'weekly', null, newestLongformArticle);
  add('/today', '0.6', 'daily', null, SITE_STRUCTURE_DATE);
  // Community Forums (Phase A). Crawlable landing; content changes as threads are
  // published, so daily is honest without over-claiming.
  add('/forums', '0.6', 'daily', null, SITE_STRUCTURE_DATE);

  // Stories — the shared shelf of helper-written stories.
  //
  // ONE shelf, every tree. The hub is listed in all four language trees because
  // the CHROME is translated and a Filipino reader searching in Filipino should
  // land on it; the stories themselves are not translated, so the same slug is
  // the same document in each tree and the alternates are honest.
  //
  // lastmod is the story's own published date, never the crawl date — the same
  // rule as the Discover feed, and for the same reason. Computed BEFORE the
  // Discover block below, which needs it: /discover lists the stories too.
  const publishedStories = store.listPublishedStorySlugs();
  const newestStory = publishedStories.reduce((m, s) => {
    const d = postDateShort(s.updated_at || s.published_at);
    return d > m ? d : m;
  }, SITE_STRUCTURE_DATE);

  // Discover — the culture and news feed, the stories, and each article in it.
  //
  // lastmod is the post's OWN date, never the crawl date: a feed that claims to
  // change every day is a feed Google stops trusting, which is the same trap the
  // word pages already fell into once (see the note below this function). The
  // hub takes the newest item it lists — posts AND stories, because the page
  // renders both — so it is exactly as fresh as its freshest item and moves on
  // its own the moment either kind is published. Taking only the posts was
  // correct until the stories section was added to this page; after that, a
  // newly published story changed the page without changing its date.
  // TWO queries, not one, and the reason is a bug this nearly shipped.
  //
  // A single `listPosts({ status:'published', limit: 200 })` is ordered by date
  // across BOTH channels. Once the news feed is busy it fills the whole window,
  // so the editorial posts — the ones that never expire — get pushed out of it.
  // With ~200 news rows live, the sitemap was listing 5 of the 10 culture
  // posts. Asking each channel on its own terms cannot starve either one.
  const culturePosts = store.listPosts({ status: 'published', channel: 'culture', limit: 200 });
  const newsPosts = store.listPosts({ status: 'published', channel: 'news', limit: 500 });
  // The intent channels (survival / work / health / festivals). They are
  // operator-written and evergreen, so they belong in the sitemap exactly like
  // the culture posts. Asked per channel so none can starve the others.
  const extraChannelPosts = ['survival-phrases', 'work-household', 'health', 'festivals']
    .flatMap((ch) => store.listPosts({ status: 'published', channel: ch, limit: 200 }));

  const newestOf = (list) =>
    list.reduce((m, p) => {
      const d = postDateShort(p.published_at || p.updated_at || p.created_at);
      return d > m ? d : m;
    }, SITE_STRUCTURE_DATE);

  const newestPost = newestOf([...culturePosts, ...newsPosts, ...extraChannelPosts]);
  const newestDiscoverItem = newestPost > newestStory ? newestPost : newestStory;

  // IMPORTED NEWS IS DELIBERATELY NOT LISTED HERE.
  //
  // The hub's lastmod above still counts it, because /discover really does
  // render the news — that date is honest. What changes is the per-article
  // entries: `db.pruneNewsPast` deletes imported news after 72h, so every
  // imported news URL in the sitemap is GUARANTEED to become a 404 within three
  // days. At the time of writing that was 796 of 1,797 entries, and Search
  // Console reports those as "Not found (404)" while trusting the sitemap less
  // for it.
  //
  // The filter is `origin === 'auto'` rather than just the channel, because
  // that is exactly the set the pruner deletes. A news post the OPERATOR wrote
  // is never pruned, so it is evergreen and belongs in the sitemap like any
  // other.
  //
  // The pages are not hidden: they still render, still return 200, and are
  // still linked from /discover and the app, so Google finds them the ordinary
  // way. They are simply not ADVERTISED as canonical in a file whose job is to
  // list what will still exist tomorrow.
  const evergreenPosts = [...culturePosts, ...newsPosts.filter((p) => p.origin !== 'auto'), ...extraChannelPosts];

  for (const prefix of Object.values(LANG_PREFIX)) {
    add(`${prefix}/discover`, '0.7', 'daily', hreflangLinks((l) => `${LANG_PREFIX[l]}/discover`), newestDiscoverItem);
  }
  /* ONE ENTRY PER TRANSLATED TREE, not one per tree.
   *
   * The loop above this used to list every post under all four prefixes. But a
   * post with no Filipino translation serves the English article at
   * /fil/discover/<slug>, and advertising that in the sitemap asks Google to
   * index a second copy of a page it already has — the duplicate-canonical
   * problem the canonical now fixes. A sitemap entry for a URL whose canonical
   * points elsewhere is a contradiction; the honest answer is not to list it.
   *
   * The untranslated URL still renders and is still linked from the /fil/
   * discover hub, so a reader loses nothing. It simply stops being advertised
   * as a page in its own right. */
  for (const lang of LANGS) {
    const prefix = LANG_PREFIX[lang];
    for (const p of evergreenPosts) {
      if (!isTranslated(p, lang)) continue;
      const d = postDateShort(p.published_at || p.updated_at || p.created_at);
      add(`${prefix}/discover/${p.slug}`, '0.6', 'monthly',
        hreflangLinks((l) => (isTranslated(p, l) ? `${LANG_PREFIX[l]}/discover/${p.slug}` : null)),
        d || SITE_STRUCTURE_DATE);
    }
  }

  for (const prefix of Object.values(LANG_PREFIX)) {
    add(`${prefix}/stories`, '0.7', 'weekly', hreflangLinks((l) => `${LANG_PREFIX[l]}/stories`), newestStory);
    for (const s of publishedStories) {
      const d = postDateShort(s.updated_at || s.published_at);
      add(`${prefix}/stories/${s.slug}`, '0.6', 'monthly',
        hreflangLinks((l) => `${LANG_PREFIX[l]}/stories/${s.slug}`), d || SITE_STRUCTURE_DATE);
    }
  }

  // Categories, levels, words — in every language tree. Category and level
  // pages are pure functions of the library, so their true freshness is
  // UPDATED from content.js: a category cannot change without the words in it
  // changing.
  //
  // A WORD page is the exception, and it is not a theoretical one. Its
  // rendering gained blocks (usage note, example sentence) that do not live in
  // the vocabulary data, so a word can now change without UPDATED moving. Those
  // words get their own date from wordLastmod(); the rest keep the library date
  // because they genuinely did not change.
  const cats = store.listEnabledCategories();
  const { bySlug } = buildWordIndex();
  for (const prefix of Object.values(LANG_PREFIX)) {
    for (const c of cats) {
      const s = slugify(c.name_en);
      add(`${prefix}/learn/${s}`, '0.8', 'monthly', hreflangLinks((l) => `${LANG_PREFIX[l]}/learn/${s}`), VOCAB_UPDATED);
    }
    for (const n of Object.keys(LEVELS)) {
      add(`${prefix}/level/${n}`, '0.7', 'monthly', hreflangLinks((l) => `${LANG_PREFIX[l]}/level/${n}`), VOCAB_UPDATED);
    }
    for (const [s, w] of bySlug) {
      add(`${prefix}/words/${s}`, '0.6', 'monthly',
        hreflangLinks((l) => `${LANG_PREFIX[l]}/words/${s}`), wordLastmod(w));
    }
  }

  // Living passages — a server-rendered head + hub now exist for these (see
  // livingPostShell / renderLivingHub). They are substantial, SEO-minded
  // articles for prospective FDW helpers, and were previously absent from the
  // sitemap, so Google was never told to crawl them. English only, like /portal:
  // the fil/zh/id columns are empty, so the app falls back to English.
  const livingPosts = store.listLivingPosts({ limit: 300 });
  const livingDates = [];
  for (const p of livingPosts) {
    const d = postDateShort(p.updated_at || p.published_at || SITE_STRUCTURE_DATE);
    livingDates.push(d);
    add(`/living/${p.slug}`, '0.7', 'monthly', null, d);
  }
  /* THE HUB WAS MISSING. Every /living/<slug> passage was listed, but the page
     that organises them — the one with the category headings and all the
     internal links — was not. Google could find a leaf but never the doorway.
     Its honest lastmod is the newest passage it lists, not the crawl date. */
  const newestLiving = livingDates.reduce((m, d) => (d > m ? d : m), SITE_STRUCTURE_DATE);
  add('/living', '0.8', 'weekly', null, newestLiving);

  /* Outings. 17 photographed guides, four language trees each, plus the four
     hubs. Before this they had no indexable URL at all — the app rendered them
     into /discover at runtime. lastmod is the fixed day these pages shipped;
     the underlying place data has no updated_at column, and stamping today's
     date on every crawl would be a lie that devalues the whole file. */
  for (const prefix of Object.values(LANG_PREFIX)) {
    add(`${prefix}/places`, '0.8', 'monthly',
      hreflangLinks((l) => `${LANG_PREFIX[l]}/places`), PLACES_FIRST_PUBLISHED);
    for (const p of PLACES) {
      add(`${prefix}/places/${p.slug}`, '0.7', 'monthly',
        hreflangLinks((l) => `${LANG_PREFIX[l]}/places/${p.slug}`), PLACES_FIRST_PUBLISHED);
    }
  }

  // Games — the UNO / Big Two / Word Match tables. App features, not search
  // content, so they sit below the editorial pages; listed so they are at least
  // discoverable and resolve to a real page rather than a soft 404 in the index.
  for (const g of ['/games/uno', '/games/bigtwo', '/games/wordmatch', '/games/sudoku', '/games/chinesechecker']) {
    add(g, '0.5', 'monthly', null, SITE_STRUCTURE_DATE);
  }

  // English track (/en) — the SPA landing plus its server-rendered siblings.
  // English-only pages, so hreflang is a self-reference plus x-default.
  add('/en', '0.9', 'weekly', enAlternates('/en'), SITE_STRUCTURE_DATE);
  add('/en/learn', '0.8', 'weekly', enAlternates('/en/learn'), SITE_STRUCTURE_DATE);
  for (const c of enCategoryRows()) {
    const p = `/en/category/${slugify(c.name_en)}`;
    add(p, '0.7', 'monthly', enAlternates(p), SITE_STRUCTURE_DATE);
  }
  const enIdx = buildEnWordIndex();
  for (const s of enIdx.bySlug.keys()) {
    const p = `/en/words/${s}`;
    add(p, '0.6', 'monthly', enAlternates(p), SITE_STRUCTURE_DATE);
  }

  // Pillar / topic pages (search intent), in every language.
  for (const key of Object.keys(PILLARS)) {
    const def = PILLARS[key];
    for (const lang of LANGS) {
      const c = def[lang];
      if (!c) continue;
      const p = `${LANG_PREFIX[lang] || ''}/${c.slug}`;
      add(p, '0.7', 'monthly', hreflangLinks((l) => {
        const s = def[l] && def[l].slug;
        return s ? `${LANG_PREFIX[l] || ''}/${s}` : null;
      }), SITE_STRUCTURE_DATE);
    }
  }

  // Phrase of the Day — one crawlable URL per day (past year + today).
  {
    const today = new Date();
    for (let i = 364; i >= 0; i--) {
      const ds = hkDateStr(new Date(today.getTime() - i * 86400000));
      add(`/phrase/${ds}`, '0.4', 'daily', null, ds);
    }
    add('/phrase', '0.5', 'daily', null, hkDateStr(today));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

/** robots.txt with the sitemap declared. Kept here so it can never drift from
 *  the routes this module actually serves. */
function renderRobots() {
  return `# CantoBuddy
# The learner app and the server-rendered vocabulary pages are public.
# The admin area is operator-only and must not be indexed or crawled — see the
# X-Robots-Tag header in server.js, which enforces the same thing at the
# response level (robots.txt is a request, not a control).

User-agent: *
Allow: /
Allow: /learn
Allow: /words
Allow: /level
Allow: /guide
Allow: /discover
Allow: /articles
Allow: /today
Allow: /forums
Allow: /stories
Allow: /living
# /places is BOTH a server-rendered hub and the directory holding the photos.
# express.static is mounted with redirect:false so the bare URL reaches the
# hub; an explicit Allow makes the intent clear to anyone reading this file.
Allow: /places
Allow: /fil
Allow: /zh
Allow: /id
Allow: /privacy
Allow: /portal
Allow: /en
Allow: /phrase
Allow: /cantonese-for-domestic-helpers
Allow: /cantonese-for-elderly-learners
Allow: /cantonese-food-phrases

# The employer landing page is /portal. /portal.html is the same shell WITHOUT
# the landing content, and it carries its own noindex — so it is deliberately
# not disallowed here. A Disallow would stop a crawler from ever reading that
# noindex, which is the classic way a page gets indexed while asking not to be.

# The JSON API is not a page — it is the SPA's data feed. Crawling it just
# duplicates the server-rendered pages below.
Disallow: /api/

# Admin area: never indexed.
Disallow: /admin
Disallow: /admin.html
Disallow: /admin.js

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
}

/* ===========================================================================
   Publisher pages — /about, /contact, /terms
   ===========================================================================

   AdSense rejected the site with the generic "Meet AdSense program policies"
   message. That message is what Google shows when a reviewer cannot satisfy
   themselves that a real publisher stands behind the site — and the two things
   they look for first, a page saying who runs it and a way to reach them, were
   both 404s. So were /terms and /disclaimer.

   English only, like /portal, and for the same reason: these are publisher
   identity, not learner content. Inventing three more translations of a legal
   page would add exactly the near-duplicate URLs the indexing report is
   already complaining about.

   /contact is a WORKING form, not an invented address. It posts to the same
   feedback table the app already writes to (see POST /contact in server.js),
   which the operator reads in the admin Feedback tab. An address like
   hello@cantobuddy.com would look better on the page and might not exist — a
   reviewer who tries it and gets a bounce is worse than a form that works.
   =========================================================================== */

/** Shared head/meta for the three publisher pages. */
function publisherPage({ title, docTitle, description, path, body, jsonLd, type = 'WebPage' }) {
  return page({
    lang: 'en',
    // `title` is the page's NAME — the h1, the breadcrumb label and the JSON-LD
    // name, so it stays as written. The document title is a separate thing and
    // needs an override on the two pages whose name already contains the brand:
    // without it /about shipped as "About CantoBuddy | CantoBuddy".
    title: docTitle || `${title} | CantoBuddy`,
    description,
    path,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        ORG_LD,
        breadcrumbLd([
          { name: 'CantoBuddy', path: '/' },
          { name: title, path },
        ]),
        {
          '@type': type,
          name: title,
          description,
          url: `${SITE_ORIGIN}${path}`,
          inLanguage: 'en-HK',
          isPartOf: { '@type': 'WebSite', name: 'CantoBuddy', url: SITE_ORIGIN },
        },
      ],
    },
  });
}

/**
 * /about — who publishes this, and on what basis.
 *
 * Every claim here is one the code can support. There is no company name, no
 * founding date and no team size, because none of that is recorded anywhere and
 * a plausible invention on an AdSense review page is the one kind of content
 * that must not be guessed.
 */
function renderAbout() {
  const words = store.listVocabulary({ enabledOnly: true }).length;
  const topics = store.listEnabledCategories().length;

  const body = `
${crumbs('en', [{ label: 'About' }])}
<article>
<h1>About CantoBuddy</h1>
<p class="lede">CantoBuddy is a free Cantonese practice app for domestic helpers in Hong Kong. It is an independent project, not a company, an agency or a recruitment service.</p>

<h2>What it is</h2>
<p>${words} words and phrases across ${topics} everyday topics — greetings, the kitchen, elder care, medication, emergencies, transport, money. Each entry carries the characters, Jyutping romanisation, the meaning in English and Filipino, and audio. Quizzes and a practice game turn the list into something a helper can actually remember.</p>
<p>It works offline, needs no sign-up, and costs nothing. That is not a trial: there is no paid tier to upgrade to.</p>

<h2>Our mission</h2>
<p>The aim is narrow and practical: to help a domestic helper understand the Cantonese she hears in the home, and to give her enough of the language to answer clearly when it matters — a symptom, a medicine time, a request repeated three times. CantoBuddy is not a course, an exam prep tool or a placement service. It is a free, offline-capable practice aid for the working day, and it stays free because the people it is built for should not have to pay to be understood at work.</p>
<p>That mission also sets the limits. We do not give legal, medical or financial advice, we do not act as an intermediary between a helper and an employer, and we do not collect the personal details that a commercial learning platform would ask for.</p>

<h2>Who it is for</h2>
<p>Around 200,000 Filipino and Indonesian women work as live-in helpers in Hong Kong. Most arrive speaking English and learn Cantonese on the job, from the person in the household who speaks English least. That gap is where small misunderstandings happen — a request repeated three times, a symptom not reported, a medicine taken at the wrong hour.</p>
<p>The app is built for that situation rather than for exam preparation. The vocabulary is chosen by what comes up in a flat, not by what appears in a textbook.</p>

<h2>Who publishes it</h2>
<p>CantoBuddy is an independent project with one maintainer. The same person writes the vocabulary, checks the guides against their sources and reads every message the contact form sends. There is no parent company, no investor and no agency behind it, and we are not paid by any employment agency to feature one. If that ever changes, this page will say so before it happens.</p>

<h2>How the content is written</h2>
<p>Vocabulary entries are written and checked by hand. Where a word has more than one common form — 菜 and 蔬菜 for vegetables, for instance — both are kept, because a helper will hear either one.</p>
<p>The guides on rights, holidays, pay and health are written from primary sources: the Hong Kong Labour Department, the Immigration Department, the Minimum Wage Ordinance, and the official sites of the hospitals and utilities they describe. Dates are checked against the current year rather than carried forward, and every guide carries the month it was last reviewed.</p>
<p>Nothing here is legal, medical or financial advice, and the <a href="/terms">terms of use</a> say so plainly. Where a decision matters, the guide links to the body that actually decides it.</p>

<h2>Experience, expertise and how the work is checked</h2>
<p>These are the parts of the site a reader should be able to test, so they are stated concretely rather than as a claim to authority:</p>
<ul>
  <li><strong>The subject matter is the job, not the textbook.</strong> The vocabulary is organised around what happens in a Hong Kong flat — elder care, medication, kitchen instructions, cleaning, transport, emergencies — and around the words a helper <em>hears</em> rather than only the ones she says. Where Cantonese has two common forms for one idea, both are kept, because she will hear either one.</li>
  <li><strong>Guides are written against primary sources.</strong> Material on employment rights, statutory holidays, pay, health and transport is checked against the Hong Kong Labour Department, the Immigration Department and the official pages of the bodies that actually decide the question. Each guide names the body responsible and carries the date it was last reviewed.</li>
  <li><strong>Figures that expire are not frozen.</strong> A wage rate, a holiday date or a visa condition changes. Where a number would go stale, the guide points to the current official source instead of printing a figure that will be wrong next year. If an official source and a guide disagree, the official source wins and <a href="/contact">we ask to be told</a> so the guide can be corrected.</li>
  <li><strong>Pronunciation is not guessed.</strong> Jyutping readings follow a single in-house vocabulary set used by the app, the word pages and the guides, so the same word is not spelt three different ways in three places.</li>
  <li><strong>Corrections are part of the process.</strong> Cantonese varies by household and by district. A reading that is right in one home can sound odd in another; the <a href="/contact">contact form</a> goes to the maintainer and corrections are published rather than merely acknowledged.</li>
</ul>
<p>CantoBuddy is an independent project, not a government service, a law firm, a clinic, an employer or an employment agency. Nothing here is a certified translation or professional advice, and the <a href="/terms">terms of use</a> and <a href="/disclaimer">disclaimer</a> set out those limits in full. The <a href="/articles">articles and guides index</a> lists the long-form material so a reader can see the scope of what has been published and when.</p>

<h2>How it is paid for</h2>
<p>Hosting and the audio cost money, and advertising pays for it. Ads appear on this website; they are served by Google, and they are never targeted using anything a helper tells the app. There is no subscription, no in-app purchase, and nothing in the app to sell her.</p>
<p>We do not sell personal information, and there is no account to sell it from — a learner is identified by a device token, not an email address. The <a href="/privacy">privacy policy</a> sets out exactly what is and is not collected.</p>

<h2>Follow along</h2>
<p>New words, practical guides and days out are posted on the <a href="${FACEBOOK_URL}" target="_blank" rel="me noopener noreferrer">CantoBuddy Facebook page</a>. It is the quickest way to see what changed without waiting for a search engine to catch up, and it is a public place to ask a question in front of other helpers who may have the same one.</p>

<h2>Corrections</h2>
<p>Cantonese is not one thing, and a word that is right in one household can sound odd in another. If an entry is wrong, if a Jyutping reading is off, or if a guide has gone out of date, tell us — <a href="/contact">the contact form</a> goes straight to the person who maintains this.</p>
</article>`;

  return publisherPage({
    title: 'About CantoBuddy',
    docTitle: 'About CantoBuddy | free Cantonese practice for HK helpers',
    description:
      'CantoBuddy is a free Cantonese practice app for domestic helpers in Hong Kong — who publishes it, how the content is written, and how it is paid for.',
    path: '/about',
    body,
    type: 'AboutPage',
  });
}

/**
 * /contact — a form that writes to the feedback table the operator already
 * reads. `?sent=1` is the success state after the POST redirects back here, so
 * the page works with JavaScript disabled as well as without it.
 */
function renderContact(sent) {
  const body = `
${crumbs('en', [{ label: 'Contact' }])}
<article>
<h1>Contact CantoBuddy</h1>
<p class="lede">Corrections, questions about privacy, a bug, or something that reads wrong — this form reaches the person who maintains the site.</p>

<p><strong>The form below is the direct support channel.</strong> It posts to the same feedback inbox the app's &ldquo;Send feedback&rdquo; button uses, and a person reads every message. There is no account, no ticket number and no automated reply. If you leave an email address or phone number, that is where a reply goes; if you do not, the message is still read and we still act on it. Use it for a correction, a privacy question, a problem with the app, or anything about advertising on this site. The <a href="/privacy">Privacy Policy</a> sets out exactly what is stored when you send one.</p>

<p>If you would rather use email, write to <a href="mailto:hello@cantobuddy.com">hello@cantobuddy.com</a>. The form above is the primary support channel because it is read directly by the person who maintains the site and works with JavaScript disabled; either way the same person receives it.</p>

${
  sent
    ? `<div class="sent-note" role="status"><strong>Thank you — your message has been sent.</strong><br />
We read every message. If it needs a reply, you will get one at the address you left.</div>
<p><a href="/">Back to CantoBuddy</a> · <a href="/contact">Send another message</a></p>`
    : `<form class="contact-form" method="post" action="/contact">
  <input type="hidden" name="page" value="/contact" />
  <label for="cf-message">Your message</label>
  <textarea id="cf-message" name="message" rows="7" maxlength="2000" required
            placeholder="Tell us what is wrong, or what you need."></textarea>

  <label for="cf-contact">Your email or phone <span class="opt">(optional — only if you want a reply)</span></label>
  <input id="cf-contact" name="contact" type="text" maxlength="120" autocomplete="email"
         placeholder="you@example.com" />

  <div class="hp" aria-hidden="true">
    <label for="cf-website">Website</label>
    <input id="cf-website" name="website" type="text" tabindex="-1" autocomplete="off" />
  </div>

  <button type="submit">Send message</button>
  <p class="form-note">We use your message only to answer it. It is stored with the rest of the feedback described in the <a href="/privacy">privacy policy</a>, and never published.</p>
</form>`
}

<h2>What to write about</h2>
<ul>
  <li><strong>A word that is wrong.</strong> A misheard Jyutping reading, the wrong character, or a meaning that does not fit how it is used.</li>
  <li><strong>A guide that has gone out of date.</strong> Statutory holidays, the minimum wage and visa rules change; if a figure is stale, say which one.</li>
  <li><strong>Privacy.</strong> What is stored, what an employer can see, or how to have something deleted.</li>
  <li><strong>Something broken.</strong> A page that will not load, audio that will not play, a quiz that marks a correct answer wrong.</li>
</ul>

<h2>For employers</h2>
<p>If you are an employer trying to connect to your helper's progress, the <a href="/portal">employer page</a> explains how the invitation works and what you can and cannot see. If you are stuck at that step, the form above is the right place.</p>
</article>`;

  return publisherPage({
    title: 'Contact CantoBuddy',
    docTitle: 'Contact CantoBuddy | report a wrong word or a bug',
    description:
      'Contact CantoBuddy about a wrong word, an out-of-date guide, a privacy question or a bug. Messages go straight to the person who maintains the site.',
    path: '/contact',
    body,
    type: 'ContactPage',
  });
}

/** /terms — the plain-language terms AdSense expects beside the privacy policy. */
function renderTerms() {
  const body = `
${crumbs('en', [{ label: 'Terms of use' }])}
<article>
<h1>Terms of use</h1>
<p class="lede">Plain terms for using CantoBuddy. They are short because the product is simple: it is free, it does not ask for much, and it does not promise more than it can do.</p>

<h2>Using the app</h2>
<p>CantoBuddy is free to use. Learners need no account, no email address and no payment. You may use the app on any device you control, for your own learning or for helping someone else learn.</p>

<h2>Employer accounts</h2>
<p>An employer account is created with a name and a device token, not a password. Keep the device you signed in on; anyone using that device can reach the account. Inviting a helper does not give you access to her learning until she accepts on her own phone, and she may disconnect at any time.</p>

<h2>Content you send us</h2>
<p>Comments, stories and feedback you submit must be your own words. Do not post anything unlawful, abusive, hateful, sexually explicit, or that reveals another person's private information without their consent. We may remove anything that breaks these rules, and we may close a thread that has turned abusive.</p>
<p>You keep ownership of what you write. By posting it you allow us to show it in the app, which is the only thing we do with it.</p>

<h2>What this site is not</h2>
<p>The guides on this site — on employment rights, statutory holidays, pay, health and housing — are general information, written carefully and checked against official sources, but they are <strong>not legal, medical or financial advice</strong>. They cannot account for your contract, your visa or your circumstances. Where a decision matters, the guide links to the body that actually decides it, and that body's answer is the one that counts.</p>
<p>Cantonese varies by household and by neighbourhood. An entry that is correct here may sound unusual somewhere else; the app is a practice aid, not an authority on how a particular family speaks.</p>

<h2>Availability</h2>
<p>We aim to keep the app online and the content correct, but we do not guarantee either. The service may change, and features may be added or removed. Nothing on this site is a promise of a particular result, including progress in learning.</p>

<h2>Intellectual property</h2>
<p>The vocabulary, audio, guides and design are ours or used with permission. You may quote and link to pages freely with attribution. You may not republish the vocabulary library or the audio as your own product.</p>

<h2>Privacy</h2>
<p>What we collect, why, and how to have it deleted is set out in the <a href="/privacy">privacy policy</a>, which forms part of these terms.</p>

<h2>Changes and contact</h2>
<p>If these terms change materially, the date below changes with them. Questions about any of this go through the <a href="/contact">contact form</a>.</p>
<p class="updated">Last reviewed: October 2026</p>
</article>`;

  return publisherPage({
    title: 'Terms of use',
    description:
      'The terms for using CantoBuddy: free to use, what employer accounts can and cannot see, rules for comments, and why the guides are not legal or medical advice.',
    path: '/terms',
    body,
  });
}

/**
 * /disclaimer — the fourth publisher page.
 *
 * The AdSense rejection note listed /disclaimer as a 404 alongside /about and
 * /contact; the earlier remediation added three of the four and left this one
 * out. It is not a duplicate of /terms: the terms govern USE of the app, this
 * page bounds the CLAIMS the site makes — no professional advice, no government
 * affiliation, no endorsement from the sources it cites, and no advertising
 * relationship disguised as editorial.
 *
 * English only, same reason as the other three. Every sentence below is one the
 * code and the site layout can support; there is no invented legal entity, no
 * made-up regulator and no promise a reviewer could test and find false.
 */
function renderDisclaimer() {
  const body = `
${crumbs('en', [{ label: 'Disclaimer' }])}
<article>
<h1>Disclaimer</h1>
<p class="lede">CantoBuddy is a free practice app, not an authority. This page sets out what the guides on this site are, what they are not, and who actually decides the questions they discuss.</p>

<h2>General information, not professional advice</h2>
<p>The guides cover everyday subjects that come up in a Hong Kong household: employment rights, statutory holidays, minimum wage, rest days, health, medication, housing and transport. They are written carefully and checked against primary sources, but they are <strong>general information only</strong>. They are not legal advice, medical advice, financial advice or immigration advice, and using them does not create a professional relationship of any kind.</p>
<p>Nothing here substitutes for your employment contract, the advice of a doctor or pharmacist, or an answer from the body that actually decides the question. Where a decision matters — a visa condition, a dose, a day off, a payment — the guide links to that body and its answer is the one that counts. If a guide and an official source disagree, follow the official source and <a href="/contact">tell us</a> so the guide can be corrected.</p>

<h2>No government or commercial affiliation</h2>
<p>CantoBuddy is an independent project with one maintainer. It is <strong>not affiliated with, endorsed by, or operated by</strong> the Government of the Hong Kong SAR, the Labour Department, the Immigration Department, any hospital or utility, any employer, or any employment agency. The Hong Kong Free Press, SCMP and other publications are cited as sources of reporting, not as partners.</p>
<p>Names of official bodies, publications and companies appear only to identify where a fact came from or where to get the authoritative answer. A link to an external site is a reference, not a recommendation, and never implies that the linked organisation endorses CantoBuddy. We are not paid to feature any agency, employer, product or service, and there is no sponsored content on this site.</p>

<h2>Language and accuracy</h2>
<p>Cantonese is not one fixed thing. A word that is right in one household can sound unusual in another, and Jyutping romanisation, English meanings and Filipino or Indonesian translations are approximations chosen for everyday use, not certified translations. The app is a practice aid for a learner, not an authority on how a particular family speaks, and it must not be used as a certified translation for a contract, a medical instruction or an official form.</p>
<p>Vocabulary and guides are written and checked by hand. Mistakes and out-of-date details are still possible. Dates are reviewed against the current year, but rules change between reviews; check the linked official source before relying on any figure. If you find an error, the <a href="/contact">contact form</a> goes straight to the maintainer.</p>

<h2>External links and sources</h2>
<p>Guides link out to the official sites that hold the underlying rules. We do not control those sites, they can change or disappear without notice, and we are not responsible for their content, availability or privacy practices. Links to sources are opened with <code>noopener noreferrer nofollow</code> so a reference cannot be mistaken for an endorsement or take over the page you were reading.</p>

<h2>Advertising</h2>
<p>Hosting and audio cost money, and advertising helps pay for it. Ads on this website are served by Google through AdSense; the publisher identifier is declared in <a href="/ads.txt">ads.txt</a>. Ads are <strong>not</strong> targeted using anything a learner tells the app — there is no account, no email address and no learner profile to target with, and the <a href="/privacy">privacy policy</a> sets out exactly what is collected. An advertisement appearing beside a guide is not an endorsement of that product by CantoBuddy, and the presence or absence of an ad slot is Google's decision, not an editorial one.</p>

<h2>Availability and liability</h2>
<p>The app is provided as it is, free of charge, with no account and no warranty. We aim to keep it online and correct but do not guarantee either; features and content may change or be withdrawn. To the extent the law allows, CantoBuddy is not liable for a decision made, a cost incurred or a loss suffered because someone relied on a guide instead of the official source, nor for any result — including progress in learning — that the app does not promise.</p>

<h2>Questions and related pages</h2>
<p>Who publishes this site is explained on the <a href="/about">About page</a>; the rules for using it are in the <a href="/terms">terms of use</a>; what is and is not collected is in the <a href="/privacy">privacy policy</a>. Anything this page does not answer goes through the <a href="/contact">contact form</a>.</p>
<p class="updated">Last reviewed: November 2026</p>
</article>`;

  return publisherPage({
    title: 'Disclaimer',
    description:
      'CantoBuddy disclaimer: guides are general information, not legal, medical or financial advice; no government or agency affiliation; how ads and sources work.',
    path: '/disclaimer',
    body,
  });
}

/* ---------------------------------------------------------------------------
   /articles — the crawlable doorway to the long-form shelf.
   ---------------------------------------------------------------------------

   The footer of every server-rendered page and the SPA has linked to
   /articles since the trust-signal pass. Until now that link was a 404: the
   eighteen guides existed as /discover/<slug> leaves, but no page gathered
   them, so a reviewer landing on the footer found a dead link and Google had
   no doorway to the deepest content on the site.

   This is deliberately a plain, English-only, server-rendered document. There
   is no client-side fetch, no spinner and no runtime dependency: everything a
   crawler sees arrives in the first response. It reads the LIVE post rows so
   an operator's title or summary edit in the admin is reflected here too, and
   falls back to the seed copy for a guide that is not in the database yet.
   --------------------------------------------------------------------------- */

/**
 * The server-rendered "Today in Hong Kong" page. The data is fetched live (HKO +
 * 1823) and written straight into the HTML so a crawler — and the AdSense
 * reviewer's "URL Inspection" view — sees real content with no JavaScript, not a
 * blank shell. It degrades honestly: if the upstream is down, the page says so
 * and still links to the official sources.
 */
function renderTodayInHkPage(data) {
  const d = data || {};
  const w = d.weather || {};
  const src = d.sources || {};
  const warns = Array.isArray(w.warnings) ? w.warnings : [];
  const hol = d.nextHoliday || null;
  const weatherUrl = src.weather || 'https://www.hko.gov.hk/en/wxinfo/currwx/current.htm';
  const holidayUrl = src.holidays || 'https://www.1823.gov.hk/en/hong-kong-public-holidays-ical';

  const temp = w.temperatureC != null ? w.temperatureC + '°C' : null;
  const hum = w.humidityPct != null ? w.humidityPct + '%' : null;

  const weatherBlock = d.available === false
    ? '<p class="tk-unavailable">Live data is temporarily unavailable. See the official sources below.</p>'
    : '<div class="tk-grid">' +
        '<div class="tk-cell"><div class="tk-label">Temperature</div><div class="tk-value">' + (temp || '—') + '</div></div>' +
        '<div class="tk-cell"><div class="tk-label">Humidity</div><div class="tk-value">' + (hum || '—') + '</div></div>' +
      '</div>' +
      '<div class="tk-warn">' +
        '<div class="tk-label">Weather warnings</div>' +
        (warns.length
          ? '<ul>' + warns.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>'
          : '<p class="tk-none">No special weather warnings in force.</p>') +
      '</div>' +
      (w.forecast
        ? '<div class="tk-fore"><div class="tk-label">Today’s forecast</div><p>' + esc(w.forecast) + '</p></div>'
        : '');

  const holidayBlock = hol && hol.date
    ? '<div class="tk-hol">' +
        '<div class="tk-label">Next public holiday</div>' +
        '<div class="tk-hol-name">' + esc(hol.name) + '</div>' +
        '<div class="tk-hol-when">' + (hol.daysUntil === 0 ? 'Today' : hol.daysUntil + ' days away') + '</div>' +
      '</div>'
    : '';

  const description =
    'Live Hong Kong weather from the Hong Kong Observatory and the date of the next public holiday, read from official open data — no account, no sign-up.';

  const body = `
${crumbs('en', [{ label: 'Today in Hong Kong' }])}
<article>
<h1>Today in Hong Kong</h1>
<p class="lede">Live weather from the Hong Kong Observatory and the date of the next public holiday in Hong Kong, updated from official open-data sources. No account, no sign-up — just the numbers a domestic helper or a Cantonese learner actually checks before a shift.</p>

<h2>Right now</h2>
${weatherBlock}
${holidayBlock}

<h2>Where this comes from</h2>
<p>Weather and warnings are read live from the <a href="${esc(weatherUrl)}" rel="noopener">Hong Kong Observatory</a>. Public-holiday dates are read live from <a href="${esc(holidayUrl)}" rel="noopener">1823</a>, the Hong Kong government’s one-stop portal. CantoBuddy does not store or alter these figures; if an official page and this one disagree, the official page is the one to trust.</p>
<p>For the Cantonese behind the weather, the <a href="/learn">topic library</a> has the characters, Jyutping, meanings and audio for the words you hear on a rainy morning. The <a href="/articles">guides</a> explain the holiday rules and the phrases for a typhoon-signal day at home.</p>
${ctaCard('en', null, '/learn')}
</article>`;

  return page({
    lang: 'en',
    title: 'Today in Hong Kong — Live Weather & Next Public Holiday | CantoBuddy',
    description,
    path: '/today',
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        ORG_LD,
        breadcrumbLd([
          { name: 'CantoBuddy', path: '/' },
          { name: 'Today in Hong Kong', path: '/today' },
        ]),
        {
          '@type': 'WebPage',
          name: 'Today in Hong Kong',
          description,
          url: `${SITE_ORIGIN}/today`,
          inLanguage: 'en-HK',
          isPartOf: { '@type': 'WebSite', name: 'CantoBuddy', url: SITE_ORIGIN },
        },
      ],
    },
  });
}

/**
 * Community Forums landing page (Phase A). Server-rendered and crawlable: lists
 * the three topic buckets and their published threads so search engines and link
 * unfurlers see real content. The interactive app is reached via "/?view=forums".
 * Styles are inlined (these classes are only used on this page).
 */
function renderForumsPage() {
  const FM_CSS = `
.fm-topics { display: grid; gap: 8px; }
.fm-topic { margin: 26px 0; }
.fm-topic-name { font-size: 1.4rem; color: #c1121f; margin: 0 0 4px; }
.fm-topic-desc { color: #5b6470; line-height: 1.55; margin: 0 0 14px; }
.fm-thread-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
.fm-thread { border: 1px solid #e0e0e6; border-radius: 14px; padding: 14px 16px; background: #fff; }
.fm-thread-title { font-size: 1.05rem; margin: 0 0 4px; color: #1a1a2e; }
.fm-thread-meta { font-size: .8rem; color: #5b6470; margin: 0 0 6px; }
.fm-thread-snippet { margin: 0; color: #1a1a2e; line-height: 1.55; }
.fm-empty { color: #5b6470; }`;

  const topics = [
    { key: 'cooking', name: 'Cooking', desc: 'Recipes, tips and questions from the kitchen — what to cook on a helper’s day off, how to explain a dish to your employer, and where to find ingredients.' },
    { key: 'elderly-care', name: 'Elderly Care', desc: 'Caring for an elderly employer: advice, reassurance and shared experience for the hard days as well as the easy ones.' },
    { key: 'sunday-buysell', name: 'Sunday Buy & Sell', desc: 'Buy, sell or give away within the community — phones, tickets, furniture and the things that help a fellow helper settle in.' },
  ];

  const sections = topics.map((tp) => {
    const threads = store.listPublishedForumThreads({ topic: tp.key, limit: 12 });
    const items = threads.length
      ? threads.map((th) => {
          const name = String(th.display_name || '').trim() || 'Anonymous';
          const body = String(th.body || '');
          const snippet = body.slice(0, 200);
          return '<li class="fm-thread">' +
            '<h3 class="fm-thread-title">' + esc(th.title) + '</h3>' +
            '<p class="fm-thread-meta">' + esc(name) + ' · ' + esc(postDateShort(th.created_at)) + '</p>' +
            '<p class="fm-thread-snippet">' + esc(snippet) + (body.length > 200 ? '…' : '') + '</p>' +
          '</li>';
        }).join('\n')
      : '<li class="fm-empty">No discussions yet — be the first to start one.</li>';
    return '<section class="fm-topic">' +
      '<h2 class="fm-topic-name">' + esc(tp.name) + '</h2>' +
      '<p class="fm-topic-desc">' + esc(tp.desc) + '</p>' +
      '<ul class="fm-thread-list">' + items + '</ul>' +
    '</section>';
  }).join('\n');

  const description = 'CantoBuddy community forums for domestic helpers in Hong Kong — cooking, elderly care and Sunday buy & sell. Read real discussions from fellow helpers, all reviewed before they appear.';

  const body = `<style>${FM_CSS}</style>
${crumbs('en', [{ label: 'Community Forums' }])}
<article>
<h1>Community Forums</h1>
<p class="lede">A quiet, moderated space for domestic helpers in Hong Kong to talk about the things that matter on a Sunday: cooking for the family, caring for an elderly employer, and buying and selling within the community. Every post is reviewed before it appears, so the conversations stay safe and useful.</p>

<h2>Topics</h2>
${sections}

<h2>Join the conversation</h2>
<p>The forums live inside the CantoBuddy app. Open the app to start a discussion, reply to a thread or react to a post — all anonymous unless you choose to show your name. <a href="/?view=forums">Open the Community Forums →</a></p>
${ctaCard('en', null, '/?view=forums')}
</article>`;

  return page({
    lang: 'en',
    title: 'Community Forums — Cooking, Elderly Care & Sunday Buy & Sell | CantoBuddy',
    description,
    path: '/forums',
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        ORG_LD,
        breadcrumbLd([
          { name: 'CantoBuddy', path: '/' },
          { name: 'Community Forums', path: '/forums' },
        ]),
        {
          '@type': 'WebPage',
          name: 'Community Forums',
          description,
          url: SITE_ORIGIN + '/forums',
          inLanguage: 'en-HK',
          isPartOf: { '@type': 'WebSite', name: 'CantoBuddy', url: SITE_ORIGIN },
        },
      ],
    },
  });
}

function renderArticlesHub() {
  const live = new Map(
    store.listPosts({ status: 'published', channel: 'culture', limit: 300 })
      .map((p) => [p.slug, p])
  );
  const guides = LONGFORM_GUIDES.map((g) => live.get(g.slug) || g);

  const cards = guides.map((g) => {
    const date = postDateShort(g.published_at || g.created_at);
    return `<li class="guide-card">
  <a href="/discover/${esc(g.slug)}">
    <span class="em">${esc(g.icon || '📖')}</span>
    ${date ? `<span class="pm">${esc(date)}</span>` : ''}
    <span class="gt">${esc(postText(g, 'title', 'en'))}</span>
    <span class="gd">${esc(postText(g, 'summary', 'en'))}</span>
  </a>
</li>`;
  }).join('\n');

  const description =
    'Eighteen original long-form Cantonese guides for domestic helpers in Hong Kong: holidays, contracts, markets, clinics, transport, elder care and daily practice.';

  const body = `
${crumbs('en', [{ label: 'Articles and Guides' }])}
<article>
<h1>Articles and Guides</h1>
<p class="lede">CantoBuddy publishes practical, checked writing about the Cantonese a domestic helper actually hears at work and around Hong Kong. Every article below is free, needs no account and is written to be read on a phone on a short break. The dates are the dates the articles were published, not a crawl timestamp.</p>

<h2>Long-form guides for everyday working life</h2>
<p>Each of these is a full guide, not a phrase list: the situation, the decision you have to make in it, the words that carry it, and an honest note on what the guide cannot decide for you. Start with the one that matches tomorrow.</p>
<ul class="guide-list">
${cards}
</ul>

<h2>Shorter guides and the rest of the library</h2>
<p>The long articles sit alongside smaller, more focused material. The <a href="/guide">guides index</a> collects study plans, elder care and the difference between Cantonese and Mandarin. The <a href="/discover">Discover feed</a> carries shorter culture pieces and headlines, the <a href="/living">Living shelf</a> holds passages written for helpers arriving in Hong Kong, and the <a href="/stories">stories shelf</a> is written by helpers themselves.</p>
<p>For the words behind the articles, the <a href="/learn">topic library</a> gives characters, Jyutping, meanings and audio, and the <a href="/tools">Daily Tools</a> page works offline. None of it requires a sign-up.</p>

<h2>How these articles are written</h2>
<p>Every Cantonese phrase and its Jyutping romanisation comes from the site's checked vocabulary library; an article never invents a plausible-sounding reading. Vocabulary is organised around what happens in a Hong Kong flat rather than around a textbook chapter, and where two common forms of a word exist, both are kept because a helper will hear either one.</p>
<p>Where a question belongs to an official body, the article names that body — the Hong Kong Labour Department, the Immigration Department, the Hong Kong Observatory, the Hospital Authority — and tells you to check its current page. Figures that expire, including holiday dates, wage rates, allowances and hotline numbers, are deliberately not frozen into prose that will be wrong next year. If an official source and an article disagree, the official source wins and the article is corrected.</p>
<p>The articles are written and reviewed by the same person who maintains the rest of the site, with no sponsored content and no commercial placement inside an article. A correction, a privacy question or a complaint about advertising goes through the <a href="/contact">contact form</a> and is read by a person.</p>

<h2>What these articles cannot decide</h2>
<p>These are language and orientation guides. They are not legal, medical, immigration or financial advice, they are not certified translations, and they do not tell you what your contract should say, what you are entitled to, or how a rule applies to your situation. Those decisions belong to the official bodies named in each article and to advisers who can read the current rules alongside your own documents. The <a href="/disclaimer">disclaimer</a> and the <a href="/terms">terms of use</a> set those limits out in full; the <a href="/privacy">privacy policy</a> explains what the site stores, and the <a href="/about">About page</a> says who publishes it and how the material is checked.</p>
${ctaCard('en', null, '/discover')}
</article>`;

  return page({
    lang: 'en',
    title: 'Cantonese Articles and Guides for Helpers | CantoBuddy',
    description,
    path: '/articles',
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        ORG_LD,
        breadcrumbLd([
          { name: 'CantoBuddy', path: '/' },
          { name: 'Articles and Guides', path: '/articles' },
        ]),
        {
          '@type': 'CollectionPage',
          name: 'Articles and Guides',
          description,
          url: `${SITE_ORIGIN}/articles`,
          inLanguage: 'en-HK',
          isPartOf: { '@type': 'WebSite', name: 'CantoBuddy', url: SITE_ORIGIN },
          hasPart: guides.map((g) => ({
            '@type': 'Article',
            headline: postText(g, 'title', 'en'),
            description: postText(g, 'summary', 'en'),
            datePublished: postDateShort(g.published_at || g.created_at) || undefined,
            url: `${SITE_ORIGIN}/discover/${g.slug}`,
          })),
        },
      ],
    },
  });
}

// ---------------------------------------------------------------------------
// Mounting
// ---------------------------------------------------------------------------

/**
 * Register every SEO route on the Express app.
 *
 * Called from server.js after express.static, so real files still win, and
 * before the app starts listening. Every route here is a GET that returns
 * cacheable HTML — none of them touch session or auth.
 */
function mount(app) {
  const html = (res, body, status) => {
    res.status(status || 200);
    res.type('html');
    // Short shared-cache window: Cloudflare absorbs the traffic, and a content
    // edit goes live within the hour without a manual purge.
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
    res.send(body);
  };

  // Sitemap + robots, generated from live data.
  app.get('/sitemap.xml', (req, res) => {
    res.type('application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.send(renderSitemap());
  });

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.send(renderRobots());
  });

  /* ads.txt — the Authorized Digital Sellers file.
   *
   * AdSense recommends this so that only the publisher id above is allowed to
   * sell this site's inventory. Without it a reseller could list cantobuddy.com
   * in their own ads.txt chain; with it, buyers can verify the id is genuine.
   * Hardcoded to match ADSENSE_CLIENT so the two can never disagree.
   *
   * Served from a route rather than a file in public/ for the same reason
   * robots.txt is: one source of truth, and no chance of a stale copy in the
   * repo drifting from the id actually loaded in the page.
   */
  app.get('/ads.txt', (req, res) => {
    res.type('text/plain');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.send(`google.com, ${ADSENSE_CLIENT.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);
  });

  // /for-employers was the employer landing page before it moved onto /portal.
  // A 301 rather than a second copy: two URLs serving the same content is the
  // duplicate pair this module exists to prevent, and the page has never been
  // deployed under the old name, so there is no ranking to preserve — only a
  // link that should not 404. The language variants redirect to the one English
  // page, because that is what they always served anyway.
  app.get(
    ['/for-employers', '/fil/for-employers', '/zh/for-employers', '/id/for-employers'],
    (req, res) => res.redirect(301, '/portal')
  );

  // English tree lives at the root; the other trees mirror it under a prefix.
  const routes = [
    ['/learn', (lang) => renderLearnHub(lang)],
    ['/learn/:slug', (lang, p) => renderCategory(lang, p.slug)],
    ['/words/:slug', (lang, p) => renderWord(lang, p.slug)],
    ['/level/:n', (lang, p) => renderLevel(lang, p.n)],
    // Guides. Registered after the vocabulary routes so a guide slug can never
    // shadow a category — the two namespaces are distinct, but the ordering
    // makes that explicit.
    ['/guide', (lang) => renderGuideHub(lang)],
    ['/guide/:slug', (lang, p) => renderGuide(lang, p.slug)],
    // Discover — the culture and news feed. Two segments, so it is registered
    // after the single-segment routes; a post slug can never shadow /guide or
    // /learn because those namespaces are distinct and the ordering is explicit.
    ['/discover', (lang) => renderDiscoverHub(lang)],
    ['/discover/:slug', (lang, p) => renderPost(lang, p.slug)],
    // Stories — a helper's own life story. Two segments, registered after the
    // single-segment routes for the same reason as Discover: the namespaces are
    // distinct and the ordering makes that explicit.
    ['/stories', (lang) => renderStoriesHub(lang)],
    ['/stories/:slug', (lang, p) => renderStory(lang, p.slug)],
    // Outings. Registered in the mirrored route table, so /places and all 17
    // /places/<slug> guides exist in each of the four language trees with a
    // self-canonical plus the full hreflang set. A bare /places is NOT served
    // by express.static: that mount has redirect:false (see server.js), so the
    // directory request falls through to here instead of bouncing to /places/.
    ['/places', (lang) => renderPlacesHub(lang)],
    ['/places/:slug', (lang, p) => renderPlace(lang, p.slug)],
    // The privacy policy. Last, so the two-segment guide route above cannot be
    // shadowed, and reachable at /privacy (root) plus /fil|/zh|/id/privacy.
    ['/privacy', (lang) => renderPrivacy(lang)],
  ];

  /* Google Search Console — HTML-file verification is a REAL FILE, not a route.
   *
   * This used to be a wildcard: `app.get(/^\/google([a-z0-9]+)\.html$/)` echoed
   * the token back for ANY filename, so the operator never had to know the token
   * in advance. It was convenient, and it was a bug.
   *
   * Google refused the property with "verification has failed in a way that
   * indicates that your site might have been hacked". The reason is the
   * wildcard: a site that serves the verification body for an ARBITRARY token is
   * indistinguishable from a compromised site rigged to claim properties, and
   * probing for exactly that is part of how Google decides a verification file
   * is trustworthy. Serving ONE file is the entire point of the method.
   *
   * So the file ships like any other asset: put Google's google<token>.html in
   * public/ and list it in FILES in tools/deploy-to-github.js. express.static is
   * registered before this module, so it is served directly — and every other
   * google*.html 404s, which is the property Google is actually checking.
   *
   * Do not reintroduce a wildcard here to "save a deploy". The deploy is the
   * cheap part; a refused property is not.
   */

  for (const [route, build] of routes) {
    for (const lang of LANGS) {
      app.get(LANG_PREFIX[lang] + route, (req, res) => {
        let body;
        try {
          body = build(lang, req.params);
        } catch (err) {
          console.error(`  ! SEO render failed for ${req.path}:`, err.message);
          return html(res, renderNotFound(lang), 500);
        }
        // An unknown slug is a real 404 — not a soft 200, which would let
        // Google index unlimited junk URLs.
        // A RETIRED slug is a 410: same "not here", but it tells Google the
        // removal was deliberate, so the URL leaves the index in weeks rather
        // than lingering in "Not found (404)" for months. See renderPost().
        if (body === GONE) return html(res, renderNotFound(lang), 410);
        if (!body) return html(res, renderNotFound(lang), 404);
        html(res, body);
      });
    }
  }

  // A bare prefix goes to that language's hub. Derived from LANGS so a new
  // tree cannot be added and then forgotten here.
  for (const lang of LANGS) {
    if (!LANG_PREFIX[lang]) continue;
    app.get(LANG_PREFIX[lang], (req, res) => res.redirect(301, `${LANG_PREFIX[lang]}/learn`));
  }

  // The publisher pages. Single URLs, not language families — they are English
  // only, so they are registered here rather than in the `routes` array (which
  // mirrors every entry into all four trees). /contact reads ?sent=1, the state
  // the POST redirects back to, so the form works without JavaScript.
  app.get('/about', (req, res) => html(res, renderAbout()));
  app.get('/contact', (req, res) => html(res, renderContact(req.query.sent === '1')));
  app.get('/terms', (req, res) => html(res, renderTerms()));
  // The rejection note named /disclaimer as a 404 too. It is a plain GET here,
  // so the generic trailing-slash 301 in server.js covers /disclaimer/ as well.
  app.get('/disclaimer', (req, res) => html(res, renderDisclaimer()));
  // "Today in Hong Kong" — served by its own route below; the function is
  // defined here next to the other page renderers.
  app.get('/articles', (req, res) => {
    try { html(res, renderArticlesHub()); }
    catch (e) { console.error('  ! /articles render failed:', e.message); html(res, renderNotFound('en'), 500); }
  });

  // Live weather + next public holiday. Async because it aggregates two external
  // open-data feeds; on any failure it still renders an honest, crawlable page
  // with links to the official sources.
  app.get('/today', async (req, res) => {
    try { html(res, renderTodayInHkPage(await todayInHk.getTodayInHk())); }
    catch (e) { console.error('  ! /today render failed:', e.message); html(res, renderTodayInHkPage(null)); }
  });

  // Community Forums (Phase A) — crawlable landing that links into the SPA.
  app.get('/forums', (req, res) => {
    try { html(res, renderForumsPage()); }
    catch (e) { console.error('  ! /forums render failed:', e.message); html(res, renderNotFound('en'), 500); }
  });

  // --- English track (/en) SEO siblings of the /en SPA ---
  app.get('/en/learn', (req, res) => {
    try { const b = renderEnLearnHub(); if (!b) return html(res, renderNotFound('en'), 404); html(res, b); }
    catch (e) { console.error('  ! /en/learn render failed:', e.message); html(res, renderNotFound('en'), 500); }
  });
  app.get('/en/category/:slug', (req, res) => {
    try { const b = renderEnCategory(req.params.slug); if (!b) return html(res, renderNotFound('en'), 404); html(res, b); }
    catch (e) { console.error('  ! /en/category render failed:', e.message); html(res, renderNotFound('en'), 500); }
  });
  app.get('/en/words/:slug', (req, res) => {
    try { const b = renderEnWord(req.params.slug); if (!b) return html(res, renderNotFound('en'), 404); html(res, b); }
    catch (e) { console.error('  ! /en/words render failed:', e.message); html(res, renderNotFound('en'), 500); }
  });

  // --- Pillar / topic pages (search intent), one URL per language ---
  for (const key of Object.keys(PILLARS)) {
    const def = PILLARS[key];
    for (const lang of LANGS) {
      const c = def[lang];
      if (!c) continue;
      const route = `${LANG_PREFIX[lang] || ''}/${c.slug}`;
      app.get(route, (req, res) => {
        try { const b = renderPillar(lang, c.slug); if (!b) return html(res, renderNotFound(lang), 404); html(res, b); }
        catch (e) { console.error(`  ! ${route} render failed:`, e.message); html(res, renderNotFound(lang), 500); }
      });
    }
  }

  // --- Phrase of the Day (one crawlable URL per day) ---
  app.get('/phrase', (req, res) => {
    try { const b = renderPhrase(null); if (!b) return html(res, renderNotFound('en'), 404); html(res, b); }
    catch (e) { console.error('  ! /phrase render failed:', e.message); html(res, renderNotFound('en'), 500); }
  });
  app.get('/phrase/:date', (req, res) => {
    try { const b = renderPhrase(req.params.date); if (!b) return html(res, renderNotFound('en'), 404); html(res, b); }
    catch (e) { console.error('  ! /phrase/:date render failed:', e.message); html(res, renderNotFound('en'), 500); }
  });

  console.log(`  SEO:          ${SITE_ORIGIN}/sitemap.xml  (${store.listVocabulary({ enabledOnly: true }).length} words, ${store.listEnabledCategories().length} categories, ${LANGS.length} languages)`);
}

module.exports = { mount, portalPage, livingPostShell, renderLivingHub, SITE_ORIGIN, slugify, buildWordIndex, wordSlugMap, LANG_PREFIX, LANGS, ROUTE_FAMILIES, HK_FESTIVALS, upcomingFestivals, upcomingFestivalPayload, festivalBanner };
