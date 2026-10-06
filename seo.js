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
const { GUIDES, GUIDE_BY_SLUG } = require('./content');

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
 *   2. HTML file — no configuration at all. See the /google*.html route in
 *      mount(); it answers any token Google asks for. This is the one to use if
 *      you would rather not redeploy, because it needs no env change.
 *
 * DNS TXT verification also works and needs no code — it is done in Cloudflare.
 */
const GOOGLE_VERIFICATION = (process.env.GOOGLE_SITE_VERIFICATION || '').trim();

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
       &nbsp;·&nbsp; <a href="${LANG_PREFIX[lang]}/guide">${esc((GUIDE_UI[lang] || GUIDE_UI.en).guides)}</a></p>
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

function renderSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [];

  const add = (loc, priority, changefreq, alternates) => {
    const alts = (alternates || [])
      .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.lang}" href="${esc(SITE_ORIGIN + a.path)}" />`)
      .join('\n');
    urls.push(`  <url>
    <loc>${esc(SITE_ORIGIN + loc)}</loc>
    <lastmod>${today}</lastmod>
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
  add('/', '1.0', 'weekly', hreflangLinks((l) => (LANG_PREFIX[l] ? `${LANG_PREFIX[l]}/learn` : '/')));

  // Hubs.
  for (const prefix of Object.values(LANG_PREFIX)) {
    add(`${prefix}/learn`, '0.9', 'weekly', hreflangLinks((l) => `${LANG_PREFIX[l]}/learn`));
  }

  // Guides. High priority relative to the word pages: they are the pages most
  // likely to rank for a query, and the ones a crawler should read first.
  for (const prefix of Object.values(LANG_PREFIX)) {
    add(`${prefix}/guide`, '0.8', 'monthly', hreflangLinks((l) => `${LANG_PREFIX[l]}/guide`));
    for (const g of GUIDES) {
      add(`${prefix}/guide/${g.slug}`, '0.8', 'monthly', hreflangLinks((l) => `${LANG_PREFIX[l]}/guide/${g.slug}`));
    }
  }

  // Categories, levels, words — in every language tree.
  const cats = store.listEnabledCategories();
  const { bySlug } = buildWordIndex();
  for (const prefix of Object.values(LANG_PREFIX)) {
    for (const c of cats) {
      const s = slugify(c.name_en);
      add(`${prefix}/learn/${s}`, '0.8', 'monthly', hreflangLinks((l) => `${LANG_PREFIX[l]}/learn/${s}`));
    }
    for (const n of Object.keys(LEVELS)) {
      add(`${prefix}/level/${n}`, '0.7', 'monthly', hreflangLinks((l) => `${LANG_PREFIX[l]}/level/${n}`));
    }
    for (const s of bySlug.keys()) {
      add(`${prefix}/words/${s}`, '0.6', 'monthly', hreflangLinks((l) => `${LANG_PREFIX[l]}/words/${s}`));
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
  ];

  /* Google Search Console — HTML-file verification, with no configuration.
   *
   * Google asks you to host a file named `google<token>.html` whose entire
   * content is `google-site-verification: google<token>.html`. Rather than
   * require the operator to know the token in advance, this answers ANY such
   * filename with the matching body, which is exactly what Google checks.
   *
   * Deliberately narrow: the token must be lowercase hex, and the route only
   * ever echoes it back. It serves no other path and reads no other input, so
   * it cannot be turned into an open redirect or a file read.
   */
  app.get(/^\/google([a-z0-9]+)\.html$/, (req, res) => {
    const token = req.params[0];
    res.type('text/html');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(`google-site-verification: google${token}.html`);
  });

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

module.exports = { mount, SITE_ORIGIN, slugify, buildWordIndex, wordSlugMap };
