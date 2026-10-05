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

/**
 * Canonical origin. Overridable so a preview deployment can canonicalise to
 * itself instead of pointing at production. The default is the real domain
 * because a wrong-but-absolute canonical is far safer than a missing one.
 */
const SITE_ORIGIN = (process.env.SITE_ORIGIN || 'https://cantobuddy.com').replace(/\/+$/, '');

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
  1: { en: 'Beginner', yue: '初級', fil: 'Baguhan', blurb: 'Basic greetings and the everyday words you need in the first week.' },
  2: { en: 'Intermediate', yue: '中級', fil: 'Katamtaman', blurb: 'Daily routines and household activities — cooking, cleaning, shopping, weather.' },
  3: { en: 'Advanced', yue: '高級', fil: 'Mahusay', blurb: 'Full sentences and phrases, including elder care and asking questions.' },
};

function levelName(n, lang) {
  const l = LEVELS[n];
  if (!l) return `Level ${n}`;
  return lang === 'fil' ? l.fil : l.en;
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
};

/** Category display name in the requested language, falling back sensibly. */
function catName(cat, lang) {
  if (!cat) return '';
  if (lang === 'fil') return cat.name_fil || cat.name_en;
  return cat.name_en || cat.name_fil;
}

/** Where a category page lives, in the right language tree. */
function catHref(cat, lang) {
  const prefix = lang === 'fil' ? '/fil' : '';
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
 * Build a full HTML document.
 * @param {object} o  {lang,title,description,path,jsonLd,body,noindex,alternates}
 */
function page(o) {
  const lang = o.lang === 'fil' ? 'fil' : 'en';
  const canonical = `${SITE_ORIGIN}${o.path}`;

  // hreflang alternates. Emitted only when the caller supplies both trees —
  // a self-referential pair with no real counterpart would be a lie.
  const alt = (o.alternates || [])
    .map((a) => `<link rel="alternate" hreflang="${esc(a.lang)}" href="${esc(SITE_ORIGIN + a.path)}" />`)
    .join('\n  ');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(o.title)}</title>
  <meta name="description" content="${esc(o.description)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  ${o.noindex ? '<meta name="robots" content="noindex, follow" />' : '<meta name="robots" content="index, follow" />'}
  ${alt}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="CantoBuddy" />
  <meta property="og:title" content="${esc(o.title)}" />
  <meta property="og:description" content="${esc(o.description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="${SITE_ORIGIN}/icons/icon-512.png" />
  <meta property="og:locale" content="${lang === 'fil' ? 'fil_PH' : 'en_HK'}" />
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
    <a class="brand" href="${lang === 'fil' ? '/fil' : '/'}"><span class="em">🦜</span>CantoBuddy</a>
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
    <p><a href="${lang === 'fil' ? '/' : '/fil'}">${lang === 'fil' ? 'English' : 'Filipino'}</a>
       &nbsp;·&nbsp; <a href="${lang === 'fil' ? '/fil/learn' : '/learn'}">${esc(L[lang].browse)}</a></p>
  </div>
</footer>
${VISIT_BEACON}
</body>
</html>`;
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
  const parts = [`<a href="${lang === 'fil' ? '/fil/learn' : '/learn'}">${esc(t.learn)}</a>`];
  for (const c of trail) {
    parts.push(c.href ? `<a href="${esc(c.href)}">${esc(c.label)}</a>` : `<span>${esc(c.label)}</span>`);
  }
  return `<nav class="crumbs" aria-label="Breadcrumb">${parts.join('<span class="sep">›</span>')}</nav>`;
}

/** Vocabulary table. `linkWords` turns the English column into internal links. */
function vocabTable(rows, lang, linkWords) {
  const t = L[lang];
  const trs = rows
    .map((w) => {
      const en = linkWords && w.slug
        ? `<a href="${lang === 'fil' ? '/fil' : ''}/words/${esc(w.slug)}">${esc(w.english)}</a>`
        : esc(w.english);
      const fil = lang === 'fil' ? '' : `<br /><span style="color:var(--muted);font-size:13.5px">${esc(w.tagalog)}</span>`;
      return `<tr>
      <td class="em">${esc(w.emoji || '')}</td>
      <td class="han">${esc(w.cantonese)}</td>
      <td class="jy">${esc(w.jyutping)}</td>
      <td>${en}${fil}</td>
    </tr>`;
    })
    .join('\n');

  const filHead = lang === 'fil' ? '' : `<th>${esc(t.filipino)}</th>`;
  return `<table>
  <thead><tr>
    <th aria-label="Icon"></th>
    <th>${esc(t.cantonese)}</th>
    <th>${esc(t.jyutping)}</th>
    <th>${esc(t.english)}${lang === 'fil' ? ` / ${esc(t.filipino)}` : ''}</th>
    ${filHead}
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
    'A free Cantonese learning app for Filipino domestic helpers in Hong Kong: practical vocabulary with audio, pictures and quizzes.',
  areaServed: { '@type': 'Place', name: 'Hong Kong' },
  audience: { '@type': 'Audience', audienceType: 'Filipino domestic helpers' },
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
  const prefix = lang === 'fil' ? '/fil' : '';

  const catItems = cats
    .map((c) => {
      const n = store.listVocabulary({ category_id: c.id, enabledOnly: true }).length;
      return `<li><a href="${catHref(c, lang)}">
        <span class="em">${esc(c.icon || '📘')}</span>
        <span>${esc(catName(c, lang))}<span class="n">${n} ${lang === 'fil' ? 'salita' : 'words'}</span></span>
      </a></li>`;
    })
    .join('\n');

  const levelItems = Object.keys(LEVELS)
    .map((n) => {
      const count = store.listVocabulary({ level: Number(n), enabledOnly: true }).length;
      return `<li><a href="${prefix}/level/${n}">
        <span class="em">${n === '1' ? '🌱' : n === '2' ? '🌿' : '🌳'}</span>
        <span>${esc(levelName(Number(n), lang))}<span class="n">${count} ${lang === 'fil' ? 'salita' : 'words'}</span></span>
      </a></li>`;
    })
    .join('\n');

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
${ctaCard(lang)}
`;

  const title = lang === 'fil'
    ? `Bokabularyong Cantonese — ${total} salita para sa mga helper sa Hong Kong | CantoBuddy`
    : `Cantonese Vocabulary — ${total} Words for Helpers in Hong Kong | CantoBuddy`;
  const description = lang === 'fil'
    ? `Tingnan ang ${total} praktikal na salitang Cantonese sa ${cats.length} kategorya, may Jyutping at kahulugan sa Filipino at Ingles.`
    : `Browse ${total} practical Cantonese words across ${cats.length} categories, with Jyutping romanisation and English and Filipino meanings.`;

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
        inLanguage: lang === 'fil' ? 'fil' : 'en',
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
    alternates: [
      { lang: 'en', path: '/learn' },
      { lang: 'fil', path: '/fil/learn' },
      { lang: 'x-default', path: '/learn' },
    ],
  });
}

/** One category page: all of its words, rendered as HTML. */
function renderCategory(lang, slug) {
  const t = L[lang];
  const cat = findCategoryBySlug(slug);
  if (!cat) return null;

  const rows = withSlugs(store.listVocabulary({ category_id: cat.id, enabledOnly: true }));
  const name = catName(cat, lang);
  const other = lang === 'fil' ? 'en' : 'fil';
  const prefix = lang === 'fil' ? '/fil' : '';
  const otherPrefix = lang === 'fil' ? '' : '/fil';

  const byLevel = Object.keys(LEVELS)
    .map((n) => rows.filter((w) => w.level === Number(n)))
    .map((group, i) =>
      group.length
        ? `<h2>${esc(levelName(i + 1, lang))}</h2>\n${vocabTable(group, lang, true)}`
        : ''
    )
    .filter(Boolean)
    .join('\n');

  const body = `
${crumbs(lang, [
    { label: t.categories, href: `${prefix}/learn` },
    { label: name },
  ])}
<h1>${esc(name)}<span class="sub">${esc(cat.name_yue || '')} · ${esc(t.tagline)}</span></h1>
<p class="lede">${esc(t.aboutBody(name, rows.length))}</p>
${byLevel}
${ctaCard(lang)}
`;

  const title = lang === 'fil'
    ? `${name} sa Cantonese — ${rows.length} salita (${cat.name_yue || ''}) | CantoBuddy`
    : `${name} in Cantonese — ${rows.length} Words (${cat.name_yue || ''}) | CantoBuddy`;
  const description = lang === 'fil'
    ? `${rows.length} praktikal na salitang Cantonese para sa ${name.toLowerCase()}, may Jyutping at kahulugan sa Filipino at Ingles.`
    : `Learn ${rows.length} practical Cantonese ${name.toLowerCase()} words with Jyutping romanisation and English and Filipino meanings — free.`;

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
        inLanguage: lang === 'fil' ? 'fil' : 'en',
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
    alternates: [
      { lang: 'en', path: `/learn/${slug}` },
      { lang: 'fil', path: `/fil/learn/${slug}` },
      { lang: 'x-default', path: `/learn/${slug}` },
    ],
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
  const prefix = lang === 'fil' ? '/fil' : '';
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
    <span class="han" style="font-family:'Noto Sans SC',sans-serif">${esc(r.cantonese)}<span class="n">${esc(r.english)}</span></span>
  </a></li>`
  )
  .join('\n')}
</ul>`
    : '';

  const body = `
${crumbs(lang, [
    { label: t.categories, href: `${prefix}/learn` },
    { label: name, href: catUrl },
    { label: w.english },
  ])}
<h1 class="word-hero">
  <span class="han">${esc(w.cantonese)}</span>
  <span class="jy">${esc(w.jyutping)}</span>
  <span class="gloss">${esc(w.english)}</span>
  <span class="fil">${lang === 'fil' ? esc(w.english) : esc(w.tagalog)}</span>
</h1>
<p class="lede">${esc(t.wordBody(w.cantonese, w.jyutping, w.english, name))}</p>
<dl class="meta">
  <dt>${esc(t.cantonese)}</dt><dd>${esc(w.cantonese)}</dd>
  <dt>${esc(t.pronunciation)}</dt><dd>${esc(w.jyutping)}</dd>
  <dt>${esc(t.meaning)}</dt><dd>${esc(w.english)}</dd>
  <dt>${esc(t.alsoSaid)}</dt><dd>${esc(w.tagalog)}</dd>
  <dt>${esc(t.levelLabel)}</dt><dd><a href="${prefix}/level/${w.level}">${esc(levelName(w.level, lang))}</a></dd>
  <dt>${esc(t.categoryLabel)}</dt><dd><a href="${esc(catUrl)}">${esc(name)}</a></dd>
</dl>
${ctaCard(lang)}
${relatedBlock}
`;

  const title = lang === 'fil'
    ? `${w.english} sa Cantonese — ${w.cantonese} (${w.jyutping}) | CantoBuddy`
    : `${w.english} in Cantonese — ${w.cantonese} (${w.jyutping}) | CantoBuddy`;
  const description = lang === 'fil'
    ? `${w.english} sa Cantonese ay ${w.cantonese}, binibigkas na ${w.jyutping}. Kasama sa ${name.toLowerCase()}.`
    : `${w.english} in Cantonese is ${w.cantonese} (${w.jyutping}). Learn this ${name.toLowerCase()} word with audio and quizzes — free for helpers in Hong Kong.`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG_LD,
      breadcrumbLd([
        { name: t.learn, path: `${prefix}/learn` },
        { name, path: cat ? `${prefix}/learn/${slugify(cat.name_en)}` : `${prefix}/learn` },
        { name: w.english, path: `${prefix}/words/${slug}` },
      ]),
      {
        '@type': 'DefinedTerm',
        name: w.english,
        alternateName: w.cantonese,
        description: `${w.english} in Cantonese is ${w.cantonese}, pronounced ${w.jyutping}.`,
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
    alternates: [
      { lang: 'en', path: `/words/${slug}` },
      { lang: 'fil', path: `/fil/words/${slug}` },
      { lang: 'x-default', path: `/words/${slug}` },
    ],
  });
}

/** One level page. */
function renderLevel(lang, level) {
  const t = L[lang];
  const n = Number(level);
  if (!LEVELS[n]) return null;

  const rows = withSlugs(store.listVocabulary({ level: n, enabledOnly: true }));
  const name = levelName(n, lang);
  const prefix = lang === 'fil' ? '/fil' : '';

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

  const title = lang === 'fil'
    ? `${name} Cantonese — ${rows.length} salita | CantoBuddy`
    : `${name} Cantonese — ${rows.length} Words | CantoBuddy`;
  const description = lang === 'fil'
    ? `${LEVELS[n].blurb} ${rows.length} salitang Cantonese na may Jyutping at kahulugan sa Filipino.`
    : `${LEVELS[n].blurb} ${rows.length} Cantonese words with Jyutping and English and Filipino meanings.`;

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
        inLanguage: lang === 'fil' ? 'fil' : 'en',
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
    alternates: [
      { lang: 'en', path: `/level/${n}` },
      { lang: 'fil', path: `/fil/level/${n}` },
      { lang: 'x-default', path: `/level/${n}` },
    ],
  });
}

/** 404 body for an unknown content slug, so a bad URL stays useful. */
function renderNotFound(lang) {
  const t = L[lang];
  const prefix = lang === 'fil' ? '/fil' : '';
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

  // The SPA itself.
  add('/', '1.0', 'weekly', [
    { lang: 'en', path: '/' },
    { lang: 'fil', path: '/fil/learn' },
    { lang: 'x-default', path: '/' },
  ]);

  // Hubs.
  for (const [lang, prefix] of [['en', ''], ['fil', '/fil']]) {
    add(`${prefix}/learn`, '0.9', 'weekly', [
      { lang: 'en', path: '/learn' },
      { lang: 'fil', path: '/fil/learn' },
      { lang: 'x-default', path: '/learn' },
    ]);
  }

  // Categories, levels, words — in both language trees.
  const cats = store.listEnabledCategories();
  for (const [lang, prefix] of [['en', ''], ['fil', '/fil']]) {
    for (const c of cats) {
      const s = slugify(c.name_en);
      add(`${prefix}/learn/${s}`, '0.8', 'monthly', [
        { lang: 'en', path: `/learn/${s}` },
        { lang: 'fil', path: `/fil/learn/${s}` },
        { lang: 'x-default', path: `/learn/${s}` },
      ]);
    }
    for (const n of Object.keys(LEVELS)) {
      add(`${prefix}/level/${n}`, '0.7', 'monthly', [
        { lang: 'en', path: `/level/${n}` },
        { lang: 'fil', path: `/fil/level/${n}` },
        { lang: 'x-default', path: `/level/${n}` },
      ]);
    }
    const { bySlug } = buildWordIndex();
    for (const s of bySlug.keys()) {
      add(`${prefix}/words/${s}`, '0.6', 'monthly', [
        { lang: 'en', path: `/words/${s}` },
        { lang: 'fil', path: `/fil/words/${s}` },
        { lang: 'x-default', path: `/words/${s}` },
      ]);
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
Allow: /fil

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

  // English tree.
  const routes = [
    ['/learn', (lang) => renderLearnHub(lang)],
    ['/learn/:slug', (lang, p) => renderCategory(lang, p.slug)],
    ['/words/:slug', (lang, p) => renderWord(lang, p.slug)],
    ['/level/:n', (lang, p) => renderLevel(lang, p.n)],
  ];

  for (const [route, build] of routes) {
    for (const lang of ['en', 'fil']) {
      const prefix = lang === 'fil' ? '/fil' : '';
      app.get(prefix + route, (req, res) => {
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

  // /fil on its own goes to the Filipino hub.
  app.get('/fil', (req, res) => res.redirect(301, '/fil/learn'));

  console.log(`  SEO:          ${SITE_ORIGIN}/sitemap.xml  (${store.listVocabulary({ enabledOnly: true }).length} words, ${store.listEnabledCategories().length} categories)`);
}

module.exports = { mount, SITE_ORIGIN, slugify, buildWordIndex, wordSlugMap };
