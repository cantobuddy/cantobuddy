/**
 * CantoBuddy — the news importer.
 *
 * WHAT THIS DOES
 * --------------
 * Fills the "News" channel of the Discover feed from public sources,
 * automatically, on a schedule or on demand. It is the only part of the app
 * that pulls content in from outside.
 *
 * WHERE THE NEWS COMES FROM, AND WHY ONLY THESE
 * ---------------------------------------------
 * A helper reading this app lives in Hong Kong but follows news from home. The
 * channel therefore carries her home country as well as the city she works in:
 *
 *   Philippine Daily Inquirer  (inquirer.net)      — the Philippines
 *   Antara News — English      (antaranews.com)    — Indonesia
 *   RTHK News — Local          (rthk.hk)           — Hong Kong, public broadcaster
 *
 * All three publish an ENGLISH edition of every story. That matters twice over:
 *
 *   1. "Translated to English" is already done, by the publisher, properly —
 *      so no machine translation is needed for the sources we ship, and no API
 *      key, and no cost. `translate.js` exists only for a future non-English
 *      source.
 *   2. It is the honest way to get a translation. A machine-translated headline
 *      about a court case or a policy change is exactly the kind of text where
 *      a subtle error misinforms.
 *
 * WHAT CHANGED, AND WHY IT IS WORTH RECORDING (2026-10-16)
 * --------------------------------------------------------
 * The HK Government Press Releases feed (info.gov.hk) used to be the first
 * source. It was dropped at the operator's request — a press release about a
 * statutory consultation is not what a helper opens the app for — and the
 * home-country feeds took its place.
 *
 * The Philippine government route was tried first and is CLOSED, so do not
 * spend another afternoon on it: PNA (the state agency) answers 404 on every
 * feed path and advertises no feed at all on its homepage, and PIA, DFA, DOLE,
 * OWWA, PCO and the Official Gazette all answer 403 — to a browser User-Agent
 * as well as to a bot one. Inquirer is the substitute.
 *
 * That is a deliberate and slightly uncomfortable choice: a newspaper's feed is
 * NOT published for reuse the way a government feed is, so this is the one
 * source here whose licence does not cover republication. It is defensible only
 * because of the copyright guard below — headline, a summary capped at 320
 * characters, the source's name, and a link back. Nothing of the article is
 * reproduced, and the reader is sent to Inquirer to read it. If the guard is
 * ever weakened, this source has to go.
 *
 * Antara is the state news agency of Indonesia and the closest thing to a
 * like-for-like replacement for the HK government feed: official, and published
 * in English. Its Bahasa Indonesia edition is deliberately NOT imported — see
 * the note on that source.
 *
 * THE COPYRIGHT GUARD, IN CODE
 * ----------------------------
 * A feed item carries the WHOLE article in its <description>. This module
 * deliberately throws that away and keeps only:
 *
 *   - the headline,
 *   - the first sentence or two, as a summary,
 *   - the source's name and a link to the original.
 *
 * The post's `body` columns are never written (see importPost in db.js), so
 * there is no field a full article could ever be stored in. `tools/posts-test.js`
 * asserts that, because the guard has to survive a future edit by someone who
 * has not read this comment.
 *
 * Idempotency is the database's job, not this module's: every item is keyed on
 * its feed guid, and db.importPost ignores a key it has already seen. Running
 * the importer twice is therefore harmless — the second run adds nothing.
 *
 * CATEGORIES. Every item is given a topic on the way in (see news-category.js),
 * so the reader can narrow the News channel instead of scrolling it. This module
 * only supplies raw material — the headline, the summary, and the feed's own
 * <category> tags — and never decides the topic itself. Classification is a
 * guess, which is exactly why the operator can correct any single post in the
 * admin dashboard.
 */

const db = require('./db');
const translate = require('./translate');

/** Only sources that are published for reuse, and that we have checked. */
const SOURCES = [
  {
    // --- the helper's home country: the Philippines ---
    key: 'ph',
    name: 'Philippine Daily Inquirer',
    name_zh: '菲律賓每日詢問報',
    home: 'https://newsinfo.inquirer.net',
    lang: 'en',
    url: 'https://newsinfo.inquirer.net/feed',
  },
  {
    // --- the helper's home country: Indonesia ---
    key: 'id',
    name: 'Antara News',
    name_zh: '印尼安塔拉通訊社',
    home: 'https://en.antaranews.com',
    lang: 'en',
    url: 'https://en.antaranews.com/rss/news.xml',
    // The same agency's Bahasa Indonesia edition, kept for provenance. NOT
    // imported: this feed is English-only on purpose. There is ONE news list
    // shared by all four language trees, and `translate.js` has no key set, so
    // a Bahasa item could not be rendered for the fil/zh audiences and the
    // "summary in English" promise the Discover page makes would be false.
    idUrl: 'https://www.antaranews.com/rss/terkini.xml',
  },
  {
    // --- where the helper lives ---
    key: 'rthk',
    name: 'RTHK News — Local',
    name_zh: '香港電台 即時新聞 — 本地',
    home: 'https://news.rthk.hk',
    lang: 'en',
    url: 'https://rthk9.rthk.hk/rthk/news/rss/e_expressnews_elocal.xml',
    zhUrl: 'https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml',
  },
];

/** How much of an article is allowed into a summary. Short on purpose. */
const SUMMARY_MAX = 320;
const SUMMARY_SENTENCES = 2;

// ---------------------------------------------------------------------------
// Feed parsing — small, dependency-free, and forgiving
// ---------------------------------------------------------------------------

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '\u201C', rdquo: '\u201D', lsquo: '\u2018', rsquo: '\u2019',
  hellip: '\u2026', mdash: '\u2014', ndash: '\u2013',
};

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENTITIES[n.toLowerCase()] !== undefined ? ENTITIES[n.toLowerCase()] : m));
}

function safeChar(code) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/** Everything the app shows is text, so no markup survives a feed. */
function stripHtml(s) {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Decode entities until the string stops changing.
 *
 * ONE pass is not enough, and that is not a theoretical concern — it is what
 * Antara's feed actually does. It escapes its HTML for XML and then escapes the
 * ampersands again, so `&amp;nbsp;` and `&amp;rsquo;` arrive in the document. A
 * single decode turns those into the literal text `&nbsp;` and `&rsquo;`, which
 * then sit in the summary as visible junk. The loop is bounded rather than
 * `while (true)` so a pathological input cannot spin.
 */
function decodeDeep(s, rounds = 4) {
  let out = String(s || '');
  for (let i = 0; i < rounds; i++) {
    const next = decodeEntities(out);
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * A feed's <description> reduced to readable plain text.
 *
 * Decode-and-strip repeatedly, because a feed may escape its markup once
 * (`&lt;img ...&gt;` — Antara) or twice (`&amp;lt;img ...&amp;gt;`), and each
 * round can reveal another layer. Stripping BEFORE decoding — which is what
 * this used to do, in a single pass — handles only the feeds that wrap literal
 * tags in CDATA (RTHK, Inquirer), and lets the escaped forms through, because
 * escaped markup contains no literal '<' to match until decoding has run. A
 * live Antara import put `<img src="https://img.antaranews.com/..." ...>` at the
 * head of EVERY summary that way.
 */
function plainText(s, rounds = 4) {
  let out = String(s || '');
  for (let i = 0; i < rounds; i++) {
    const next = stripHtml(decodeEntities(out));
    if (next === out) break;
    out = next;
  }
  return out;
}

/** The raw inner text of the first <tag> in a block, CDATA unwrapped. */
function tagText(block, tag) {
  const m = String(block).match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!m) return '';
  let v = m[1].trim();
  const c = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (c) v = c[1].trim();
  return v;
}

/**
 * Every <tag> in a block, not just the first.
 *
 * Used for <category>, which appears more than once per item in two of our
 * three feeds (Inquirer's WordPress feed carries several; Antara's carries one
 * or two). A single match would throw away most of the topic signal the
 * publisher published.
 */
function tagTexts(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out = [];
  for (const m of String(block).matchAll(re)) {
    let v = m[1].trim();
    const c = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
    if (c) v = c[1].trim();
    if (v) out.push(plainText(decodeDeep(v)));
  }
  return out;
}

/** A date string → ISO, or null. Never throws on a malformed pubDate. */
function parseDate(s) {
  const d = new Date(String(s || '').trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * "First sentence or two" — the amount of someone else's article we are
 * willing to reproduce. Cut at a sentence boundary where possible, and mark a
 * hard cut with an ellipsis so it never reads as the end of the story.
 */
function summarise(text, max = SUMMARY_MAX, sentences = SUMMARY_SENTENCES) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  const window = t.slice(0, max);
  const stops = [...window.matchAll(/[.!?。！？]\s/g)];
  if (stops.length >= sentences) {
    const cut = stops[sentences - 1].index + 1;
    return window.slice(0, cut).trim();
  }
  return window.replace(/\s+\S*$/, '').trim() + '\u2026';
}

/** Every <item> block in an RSS document. */
function parseRss(xml) {
  const items = String(xml || '').match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  return items.map((block) => {
    // Titles are decoded deeply but deliberately NOT stripped: a headline is
    // plain text, and stripping after decoding would eat a legitimate "<" in a
    // headline like "Growth < 2%".
    const title = decodeDeep(tagText(block, 'title')).replace(/\s+/g, ' ').trim();
    const link = tagText(block, 'link').trim() || tagText(block, 'guid').trim();
    const description = plainText(tagText(block, 'description'));
    const guid = tagText(block, 'guid').trim() || link;
    // The publisher's own topic labels. NOT used as a category directly — an
    // Inquirer tag is a WordPress slug like "Newsbod" and an Antara tag is an
    // Indonesian word, and neither is one of our categories. They go to the
    // classifier as extra haystack instead (see news-category.js), which is
    // the honest use of a signal we cannot fully trust.
    const tags = tagTexts(block, 'category');
    return { title, link, description, guid, tags, published_at: parseDate(tagText(block, 'pubDate')) };
  });
}

/** A stable, readable slug base from a link, falling back to the title. */
function slugBaseFor(item) {
  try {
    const seg = new URL(item.link || item.guid).pathname.split('/').filter(Boolean).pop() || '';
    const cleaned = seg.replace(/\.(html?|php|aspx?)$/i, '').replace(/[^a-zA-Z0-9-]+/g, '-');
    if (cleaned.length >= 4) return cleaned.slice(0, 60);
  } catch {
    /* not a URL — fall through */
  }
  return item.title;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/**
 * Fetches one source and returns import-ready post objects.
 * Exported so a test can drive it with a fixture instead of the network.
 *
 * @param {object} source   one entry of SOURCES
 * @param {Function} doFetch
 * @returns {Promise<{posts: object[], error: string|null}>}
 */
async function postsFromSource(source, doFetch) {
  let xml;
  try {
    const res = await doFetch(source.url, {
      headers: { 'User-Agent': 'CantoBuddyBot/1.0 (+https://cantobuddy.com; news importer)', Accept: 'application/rss+xml, application/xml, text/xml' },
    });
    if (!res || !res.ok) return { posts: [], error: `${source.key}: HTTP ${res ? res.status : 'no response'}` };
    xml = await res.text();
  } catch (err) {
    return { posts: [], error: `${source.key}: ${err && err.message ? err.message : 'fetch failed'}` };
  }

  const items = parseRss(xml);
  const posts = [];

  for (const item of items) {
    if (!item.title || !item.link) continue;

    let title_en = item.title;
    let summary_en = summarise(item.description);

    // A Chinese-only source is translated here, or skipped. Never published in
    // the wrong language: a Chinese headline in the English feed is worse than
    // no story at all.
    if (source.lang !== 'en') {
      if (!translate.isConfigured()) continue;
      const [tTitle, tSummary] = await Promise.all([
        translate.translateText(item.title, { from: source.lang, to: 'EN', fetchImpl: doFetch }),
        item.description ? translate.translateText(summarise(item.description), { from: source.lang, to: 'EN', fetchImpl: doFetch }) : null,
      ]);
      if (!tTitle) continue;
      title_en = tTitle;
      if (tSummary) summary_en = summarise(tSummary);
    }

    posts.push({
      channel: 'news',
      icon: '\uD83D\uDCF0',
      slug: `${source.key}-${slugBaseFor(item)}`,
      title_en,
      // The headline in the source's own language, kept so a learner can see
      // the Chinese beside the English. Blank for a Chinese-only source, whose
      // original is already in the title.
      title_zh: source.lang === 'en' ? '' : item.title,
      summary_en,
      // The publisher's tags go through verbatim; db.importPost folds them into
      // the classifier and never stores them.
      tags: item.tags,
      source_name: source.name,
      source_url: item.link,
      source_key: `${source.key}:${item.guid}`,
      source_lang: source.lang,
      published_at: item.published_at,
    });
  }

  return { posts, error: null };
}

/**
 * Retire everything imported from a source this build no longer ships.
 *
 * Dropping a feed from SOURCES stops new items arriving but does not remove
 * what it already imported — `importPost` only inserts. Without this, replacing
 * a source leaves its old stories in the feed for ever: 40 HK government press
 * releases survived the swap to the Philippine and Indonesian feeds that way.
 *
 * Driven by the SHIPPED list, never by a caller's `sources` override. The tests
 * import a single fixture source, and retiring against that list would wipe
 * every other source's posts.
 *
 * @param {object[]} [sources] the sources still shipped
 * @returns {{removed:number, retired:string[]}}
 */
function retireUnshippedSources(sources = SOURCES) {
  return db.deleteNewsPostsFromSourcesNotIn(sources.map((s) => s.key));
}

/**
 * Imports every source. Never throws: a failing feed is reported, not fatal,
 * because the other source is still worth importing and a scheduled run must
 * not die on one bad response.
 *
 * @param {{fetchImpl?:Function, sources?:object[], limitPerSource?:number, retire?:boolean}} [opts]
 * @returns {Promise<{sources:number, fetched:number, inserted:number, skipped:number, errors:string[], retired:string[], removed:number, dryRun:boolean}>}
 */
async function importNews({ fetchImpl, sources = SOURCES, limitPerSource = 0, dryRun = false, retire } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  const report = {
    sources: sources.length, fetched: 0, inserted: 0, skipped: 0,
    errors: [], retired: [], removed: 0, dryRun: !!dryRun,
  };

  for (const source of sources) {
    const { posts, error } = await postsFromSource(source, doFetch);
    if (error) {
      report.errors.push(error);
      continue;
    }
    const list = limitPerSource > 0 ? posts.slice(0, limitPerSource) : posts;
    report.fetched += list.length;

    for (const post of list) {
      if (dryRun) {
        report.inserted += 1; // what WOULD be attempted; the DB decides novelty
        continue;
      }
      const r = db.importPost(post);
      if (r.inserted) report.inserted += 1;
      else report.skipped += 1;
    }
  }

  // Retire only on a real import of the real source list — see the note on
  // retireUnshippedSources, and never on a dry run.
  const shouldRetire = retire === undefined ? sources === SOURCES : !!retire;
  if (shouldRetire && !dryRun) {
    const swept = retireUnshippedSources();
    report.retired = swept.retired;
    report.removed = swept.removed;
  }

  return report;
}

/** Published counts, so a caller can report the feed's size after an import. */
const feedCounts = () => db.getPostCounts();

module.exports = { SOURCES, importNews, retireUnshippedSources, postsFromSource, parseRss, plainText, decodeDeep, summarise, decodeEntities, stripHtml, tagTexts, SUMMARY_MAX };
