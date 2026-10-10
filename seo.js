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
    updated: 'Last updated: 10 October 2026',
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
    updated: 'Huling na-update: 10 Oktubre 2026',
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
    updated: '最后更新：2026 年 10 月 10 日',
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
    updated: 'Terakhir diperbarui: 10 Oktober 2026',
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
    var body = JSON.stringify({ path: location.pathname, public_id: id });
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
       &nbsp;·&nbsp; <a href="${LANG_PREFIX[lang]}/privacy">${esc(PRIVACY[lang].title)}</a></p>
  </div>
</footer>
${VISIT_BEACON}
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
const SITE_STRUCTURE_DATE = '2026-10-10';

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

module.exports = { mount, SITE_ORIGIN, slugify, buildWordIndex, wordSlugMap, LANG_PREFIX, LANGS };
