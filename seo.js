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
const path = require('path');

const store = require('./db');
const { GUIDES, GUIDE_BY_SLUG, UPDATED } = require('./content');

/**
 * The date the vocabulary library last changed. This is the honest `lastmod`
 * for every /words/, /learn/ and /level/ page: they are all renderings of the
 * same library, so they cannot be fresher (or staler) than it is. Sourced from
 * content.js rather than typed twice, so the two can never disagree.
 */
const VOCAB_UPDATED = UPDATED;

/**
 * Canonical origin. Overridable so a preview deployment can canonicalise to
 * itself instead of pointing at production. The default is the real domain
 * because a wrong-but-absolute canonical is far safer than a missing one.
 */
const SITE_ORIGIN = (process.env.SITE_ORIGIN || 'https://cantobuddy.com').replace(/\/+$/, '');

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
  `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>`;


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

// Employer-facing landing page (/for-employers) and its footer link. The body
// is English-primary and falls back to English in every tree until the
// translations land (see the guide in content.js). The chrome is localised by
// page() already.
const FOR_EMPLOYERS_HREF = { en: '/for-employers', fil: '/fil/for-employers', zh: '/zh/for-employers', id: '/id/for-employers' };
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
const ROUTE_FAMILIES = ['learn', 'words', 'level', 'guide', 'discover', 'stories', 'privacy', 'for-employers'];

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

   Kept as data, one object per language, so the four trees cannot drift and a
   new tree cannot be added without this page appearing in it.
   ------------------------------------------------------------------------- */
const PRIVACY = {
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: 17 October 2026',
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
          'This site shows advertisements supplied by Google AdSense. To do that, Google and its partners load a script on the page and may place cookies or read device identifiers in order to select and measure advertising.',
          'This means Google, and the advertisers it works with, can see your IP address, your browser type, and which pages you view on this site. That is a change from the rest of this app, which is built not to track you, and we would rather state it plainly than bury it.',
          'You can control personalised advertising in your Google Ads Settings, and you can opt out of third-party advertising cookies through aboutads.info or youronlinechoices.eu. If you are in the European Economic Area, the United Kingdom, or Switzerland, a consent prompt appears before advertising cookies are used, and declining it does not stop you using the app.',
          'If you would prefer no advertising at all, a browser extension that blocks advertising will also stop the AdSense script from loading, and the app works normally without it.',
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
    updated: 'Huling na-update: 17 Oktubre 2026',
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
    updated: '最后更新：2026 年 10 月 17 日',
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
    updated: 'Terakhir diperbarui: 17 Oktober 2026',
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
.cta-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px 22px;
  display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;margin:26px 0}
.cta-card p{margin:0;color:var(--muted);font-size:15px;max-width:46ch}
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
footer.site{border-top:1px solid var(--line);margin-top:44px;padding:24px 0 40px;
  color:var(--muted);font-size:14px}
footer.site a{color:var(--muted)}
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
@media(max-width:560px){
  td.jy{display:none}
  .cta-card{flex-direction:column;align-items:flex-start}
  .cta-card .cta{width:100%;text-align:center}
}
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
 * @param {object} o  {lang,title,description,path,jsonLd,body,noindex,alternates}
 */
function page(o) {
  const lang = LANGS.includes(o.lang) ? o.lang : 'en';
  const canonical = `${SITE_ORIGIN}${o.path}`;

  // hreflang alternates. Emitted only when the caller supplies a real set —
  // a self-referential pair with no real counterpart would be a lie.
  const alt = (o.alternates || [])
    .map((a) => `<link rel="alternate" hreflang="${esc(a.lang)}" href="${esc(SITE_ORIGIN + a.path)}" />`)
    .join('\n  ');

  const OG_LOCALE = { en: 'en_HK', fil: 'fil_PH', zh: 'zh_CN', id: 'id_ID' };

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
  ${alt}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="CantoBuddy" />
  <meta property="og:title" content="${esc(o.title)}" />
  <meta property="og:description" content="${esc(o.description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="${SITE_ORIGIN}/icons/icon-512.png" />
  <meta property="og:locale" content="${OG_LOCALE[lang]}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(o.title)}" />
  <meta name="twitter:description" content="${esc(o.description)}" />
  <meta name="twitter:image" content="${SITE_ORIGIN}/icons/icon-512.png" />
  <meta name="theme-color" content="#e63946" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>${PAGE_CSS}</style>
  <script type="application/ld+json">${JSON.stringify(o.jsonLd || {})}</script>
</head>
<body>
<header class="site">
  <div class="wrap">
    <a class="brand" href="${LANG_PREFIX[lang] || '/'}"><span class="em">🦜</span>CantoBuddy</a>
    <a class="cta" href="/">${esc(L[lang].openApp)}</a>
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
       &nbsp;·&nbsp; <a href="${FOR_EMPLOYERS_HREF[lang]}">${esc(FOR_EMPLOYERS_LABEL[lang])}</a></p>
  </div>
</footer>
${VISIT_BEACON}
<script src="/push-client.js" defer></script>
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
function ctaCard(lang, extra) {
  const t = L[lang];
  return `<div class="cta-card">
    <p>${esc(t.openAppDesc)}</p>
    <a class="cta" href="/">${esc(t.openApp)}</a>
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
  <dt>${esc(t.alsoSaid)}</dt><dd>${esc(w.english)}</dd>
  ${w.mandarin && lang !== 'zh' ? `<dt>${esc(t.chinese || '中文')}</dt><dd lang="zh-Hans">${esc(w.mandarin)}</dd>` : ''}
  <dt>${esc(t.levelLabel)}</dt><dd><a href="${prefix}/level/${w.level}">${esc(levelName(w.level, lang))}</a></dd>
  <dt>${esc(t.categoryLabel)}</dt><dd><a href="${esc(catUrl)}">${esc(name)}</a></dd>
</dl>
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

/**
 * The employer landing page: /for-employers.
 *
 * Short and employer-first — an employer deciding whether to bother will not
 * read 2,000 words. It explains what CantoBuddy is, how to connect to a
 * helper, what progress is and is not visible, and where the line is. The
 * longer version lives at /guide/getting-your-helper-started-with-cantonese.
 *
 * English-primary: the body falls back to English in every tree until the
 * translations land (see content.js). The header and footer chrome is
 * localised by page() already.
 */
function renderForEmployers(lang) {
  const t = L[lang];
  const prefix = LANG_PREFIX[lang] || '';

  const body = `
<h1>Your helper learns Cantonese. Here's how you help.</h1>
<blockquote>Most helpers arrive speaking English and learn Cantonese on the job — usually from the person in the household who speaks English least.</blockquote>
<p>If your mother is the one at home all day, she is the one your helper cannot talk to. That is where the small misunderstandings start: a request repeated three times, a symptom not reported, a medicine taken at the wrong hour because nobody could confirm it.</p>

<h2>What CantoBuddy is</h2>
<p>A free Cantonese practice app, built for domestic helpers in Hong Kong. 180 words and phrases for the situations that actually come up at home — elder care, the kitchen, medication, emergencies — each with audio, Jyutping, and quizzes.</p>
<p>No sign-up. No cost. Works offline. <strong>Free to your helper, always</strong> — and there is nothing in it to sell her.</p>

<h2>How to connect with your helper</h2>
<ol>
  <li><strong>Sign in</strong> at the employer portal.</li>
  <li><strong>Invite her.</strong> You get a link to send, <em>and</em> a short code you can read aloud — the codes leave out 0/O and 1/I so they cannot be misheard over the phone.</li>
  <li><strong>Add a note.</strong> One thing, this week. "Please practise the Elder Care words" works far better than "please study".</li>
  <li><strong>She accepts on her own phone.</strong> Sharing is off until she does.</li>
</ol>

<h2>What you can see — and what you cannot</h2>
<p><strong>You can see:</strong> how many quiz attempts she has done, her accuracy (% correct), her total right answers, a progress bar, her progress per level, and when she last practised.</p>
<p><strong>You cannot see:</strong></p>
<ul>
  <li>her quiz answers, word by word;</li>
  <li>her feedback to us;</li>
  <li>anything else she does on this site;</li>
  <li>anything at all once she disconnects.</li>
</ul>
<p>She can disconnect at any time, and she keeps every bit of her progress. The invitation is hers to accept and hers to end. That is not a setting we might change later — it is the reason a helper can use this app honestly, and it is written into our <a href="${prefix}/privacy">privacy policy</a>.</p>

<h2>How to encourage her — without watching her</h2>
<ul>
  <li><strong>Start small and be specific.</strong> One category this week. A helper given "learn Cantonese" does nothing; a helper given "the Elder Care words" opens the app.</li>
  <li><strong>Invite in the first week, not the first day.</strong> On day one she is learning the household. An app request then reads as one more task. Give her a week to settle.</li>
  <li><strong>Let her own it.</strong> The app is hers. If she asks you not to connect, that is allowed, and the app still works completely for her.</li>
  <li><strong>Say thank you out loud.</strong> You can see when she last practised and how her accuracy is moving. Noticing it costs nothing and is the entire mechanism.</li>
</ul>
<p><em>If you want to recognise progress with a gift, that happens between you and her — the app does not handle money and never will.</em></p>

<p class="cta-card"><a class="cta" href="/portal.html">Sign in to the employer portal</a></p>
<p><a href="${prefix}/guide/getting-your-helper-started-with-cantonese">Read the full guide →</a></p>
`;

  const title = 'For employers — help your helper learn Cantonese | CantoBuddy';
  const description = 'How to connect to your domestic helper’s Cantonese progress on CantoBuddy — what you can see, what you cannot, and how to encourage her without watching her. Free for helpers, always.';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG_LD,
      breadcrumbLd([
        { name: t.learn, path: `${prefix}/learn` },
        { name: 'For employers', path: `${prefix}/for-employers` },
      ]),
      {
        '@type': 'WebPage',
        name: title,
        description,
        inLanguage: L[lang].htmlLang,
        url: `${SITE_ORIGIN}${prefix}/for-employers`,
        isPartOf: { '@type': 'WebSite', name: 'CantoBuddy', url: SITE_ORIGIN },
      },
    ],
  };

  return page({
    lang,
    title,
    description,
    path: `${prefix}/for-employers`,
    jsonLd,
    body,
    alternates: hreflangLinks((l) => `${LANG_PREFIX[l]}/for-employers`),
  });
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
    storiesLede: 'Real stories written by domestic helpers in their own language — their daily life, where they come from, and what happened along the way.',
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
    storiesLede: 'Totoong kuwento ng mga helper sa Hong Kong, nakasulat sa sarili nilang wika — ang pang-araw-araw na buhay, ang pinanggalingan, at ang mga nangyari sa daan.',
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
    storiesLede: '香港家佣写下的真实故事，用她们自己的语言——日常生活、家乡，以及一路上的经历。',
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
    storiesLede: 'Kisah nyata dari para asisten rumah tangga di Hong Kong, ditulis dalam bahasa mereka sendiri — kehidupan sehari-hari, kampung halaman, dan apa yang terjadi di sepanjang jalan.',
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
    lede: 'Real stories from domestic helpers in Hong Kong — their daily life, where they come from, and what happened along the way. Each one is written in the helper\'s own language and read here exactly as she wrote it.',
    empty: 'No stories have been published yet. If you would like to share yours, open the app and tap Stories.',
    anonymous: 'Anonymous',
    writtenIn: 'Written in',
    gloss: 'In English',
    backToStories: 'All stories',
    shareYours: 'Share your story',
    shareYoursBody: 'Your story can help another helper feel less alone. Write it in your own language — it will be read by us first, then shared here if it is published.',
    notFound: 'That story is not available.',
    notFoundTitle: 'Story not found',
  },
  fil: {
    title: 'Mga Kuwento',
    lede: 'Totoong kuwento mula sa mga helper sa Hong Kong — ang pang-araw-araw na buhay, ang pinanggalingan, at ang mga nangyari sa daan. Ang bawat isa ay nakasulat sa sariling wika ng helper at binabasa rito nang eksakto kung paano niya ito isinulat.',
    empty: 'Wala pang nai-publish na kuwento. Kung gusto mong ibahagi ang sa iyo, buksan ang app at pindutin ang Mga Kuwento.',
    anonymous: 'Hindi nagpakilala',
    writtenIn: 'Nakasulat sa',
    gloss: 'Sa Ingles',
    backToStories: 'Lahat ng kuwento',
    shareYours: 'Ibahagi ang kuwento mo',
    shareYoursBody: 'Malaki ang maitutulong ng kuwento mo para hindi mag-isa ang kapwa helper. Isulat ito sa sarili mong wika — babasahin muna namin, at ilalathala rito kapag naaprubahan.',
    notFound: 'Hindi available ang kuwentong iyon.',
    notFoundTitle: 'Hindi mahanap ang kuwento',
  },
  zh: {
    title: '家佣故事',
    lede: '来自香港家佣的真实故事——日常生活、家乡背景，以及一路上发生的事。每一篇都以她自己的语言写成，在这里原样呈现。',
    empty: '目前还没有已发布的故事。想分享你的故事，请打开应用并点击「故事」。',
    anonymous: '匿名',
    writtenIn: '语言',
    gloss: '英文版',
    backToStories: '全部故事',
    shareYours: '分享你的故事',
    shareYoursBody: '你的故事可以让另一位家佣感到不那么孤单。请用你自己的语言写——我们会先读一遍，通过后才在这里分享。',
    notFound: '这篇故事暂不可用。',
    notFoundTitle: '找不到故事',
  },
  id: {
    title: 'Kisah',
    lede: 'Kisah nyata dari para asisten rumah tangga di Hong Kong — kehidupan sehari-hari, asal-usul, dan apa yang terjadi di sepanjang jalan. Setiap kisah ditulis dalam bahasa asli penulisnya dan dibaca di sini persis seperti yang ia tulis.',
    empty: 'Belum ada kisah yang diterbitkan. Jika ingin membagikan kisahmu, buka aplikasi dan ketuk Kisah.',
    anonymous: 'Tanpa nama',
    writtenIn: 'Ditulis dalam',
    gloss: 'Dalam bahasa Inggris',
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
const BODY_TAGS = new Set(['P', 'H2', 'H3', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'B', 'I', 'BR', 'BLOCKQUOTE', 'A']);

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
function newsTopicSections(news, lang, prefix) {
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
  const sections = [...groups.entries()]
    .map(([k, items]) => `
<h3 class="disc-h3" id="topic-${esc(k)}">${esc(newsTopicLabel(lang, k))}</h3>
<ul class="guide-list">
${items.map((p) => postCardLi(p, lang, prefix)).join('\n')}
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

  const posts = store.listPosts({ status: 'published', limit: 200 });
  const culture = posts.filter((p) => p.channel === 'culture');
  const news = posts.filter((p) => p.channel === 'news');
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

  const body = `
${crumbs(lang, [{ label: ui.title }])}
<h1>${esc(ui.title)}</h1>
<p class="lede">${esc(ui.lede)}</p>
${section(ui.culture, ui.cultureLede, culture)}
<h2 class="disc-h2">${esc(ui.news)}</h2>
<p class="lede">${esc(ui.newsLede)}</p>
${news.length ? newsTopicSections(news, lang, prefix) : `<p class="lede">${esc(ui.empty)}</p>`}
${section(ui.stories, ui.storiesLede, stories)}
${more(storiesUi.backToStories, `${prefix}/stories`)}
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
    alternates: hreflangLinks((l) => `${LANG_PREFIX[l]}/discover`),
  });
}

/** One article. Returns null for an unknown slug, so the route can 404. */
function renderPost(lang, slug) {
  const ui = DISCOVER_UI[lang] || DISCOVER_UI.en;
  const prefix = LANG_PREFIX[lang] || '';
  const post = store.getPostBySlug(slug);
  // A draft has no public page. Treating it as missing is the honest answer:
  // it is not "not ready", to a reader it does not exist.
  if (!post || post.status !== 'published') return null;

  const title = postText(post, 'title', lang);
  const summary = postText(post, 'summary', lang);
  const bodyHtml = sanitizeBodyHtml(postText(post, 'body', lang));
  const date = postDateShort(post.published_at || post.created_at);

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
    alternates: hreflangLinks((l) => `${LANG_PREFIX[l]}/discover/${slug}`),
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
    en: 'Real life stories written by domestic helpers in Hong Kong — daily life, home, and what happened along the way. Read them in the language they were written in.',
    fil: 'Totoong kuwento ng buhay na isinulat ng mga helper sa Hong Kong — pang-araw-araw, tahanan, at mga nangyari. Basahin sa wikang ginamit nila.',
    zh: '由香港家佣亲笔写下的真实生活故事——日常、家乡，以及一路上的经历。以她们原本的语言阅读。',
    id: 'Kisah hidup nyata yang ditulis oleh asisten rumah tangga di Hong Kong — kehidupan sehari-hari, kampung halaman, dan apa yang terjadi. Baca dalam bahasa aslinya.',
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

  // The employer landing page, in every tree. This is the page aimed at the
  // only paying audience, so it earns a mid priority and a monthly cadence
  // (the content is stable but the surrounding product moves).
  for (const prefix of Object.values(LANG_PREFIX)) {
    add(`${prefix}/for-employers`, '0.7', 'monthly', hreflangLinks((l) => `${LANG_PREFIX[l]}/for-employers`), SITE_STRUCTURE_DATE);
  }

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

  const newestOf = (list) =>
    list.reduce((m, p) => {
      const d = postDateShort(p.published_at || p.updated_at || p.created_at);
      return d > m ? d : m;
    }, SITE_STRUCTURE_DATE);

  const newestPost = newestOf([...culturePosts, ...newsPosts]);
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
  const evergreenPosts = [...culturePosts, ...newsPosts.filter((p) => p.origin !== 'auto')];

  for (const prefix of Object.values(LANG_PREFIX)) {
    add(`${prefix}/discover`, '0.7', 'daily', hreflangLinks((l) => `${LANG_PREFIX[l]}/discover`), newestDiscoverItem);
    for (const p of evergreenPosts) {
      const d = postDateShort(p.published_at || p.updated_at || p.created_at);
      add(`${prefix}/discover/${p.slug}`, '0.6', 'monthly',
        hreflangLinks((l) => `${LANG_PREFIX[l]}/discover/${p.slug}`), d || SITE_STRUCTURE_DATE);
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

  // Categories, levels, words — in every language tree. All three are drawn
  // from the vocabulary library, so their true freshness is the library's:
  // UPDATED from content.js. A category page cannot change without the words
  // in it changing, and a word cannot change without UPDATED moving.
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
    for (const s of bySlug.keys()) {
      add(`${prefix}/words/${s}`, '0.6', 'monthly', hreflangLinks((l) => `${LANG_PREFIX[l]}/words/${s}`), VOCAB_UPDATED);
    }
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
Allow: /stories
Allow: /fil
Allow: /zh
Allow: /id
Allow: /privacy

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
    // The privacy policy. Last, so the two-segment guide route above cannot be
    // shadowed, and reachable at /privacy (root) plus /fil|/zh|/id/privacy.
    ['/privacy', (lang) => renderPrivacy(lang)],
    // The employer landing page — reachable at /for-employers (root) plus
    // /fil|/zh|/id/for-employers, mirroring every other top-level page.
    ['/for-employers', (lang) => renderForEmployers(lang)],
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

  console.log(`  SEO:          ${SITE_ORIGIN}/sitemap.xml  (${store.listVocabulary({ enabledOnly: true }).length} words, ${store.listEnabledCategories().length} categories, ${LANGS.length} languages)`);
}

module.exports = { mount, SITE_ORIGIN, slugify, buildWordIndex, wordSlugMap, LANG_PREFIX, LANGS, ROUTE_FAMILIES, HK_FESTIVALS, upcomingFestivals, upcomingFestivalPayload, festivalBanner };
