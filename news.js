/**
 * CantoBuddy — the news importer.
 *
 * WHAT THIS DOES
 * --------------
 * Fills the "News" channel of the Discover feed from Hong Kong public sources,
 * automatically, on a schedule or on demand. It is the only part of the app
 * that pulls content in from outside.
 *
 * WHERE THE NEWS COMES FROM, AND WHY ONLY THESE
 * ---------------------------------------------
 * The request was "local news from HK local newspaper, translated to English".
 * Republishing a newspaper's article — in any language — is copyright
 * infringement: a translation is a derivative work, and the paper owns the
 * original. So the importer uses only sources whose content is *published for
 * reuse*, and it never republishes more than a short summary plus a link:
 *
 *   HK Government Press Releases  (info.gov.hk)   — official, reusable
 *   RTHK News — Local             (rthk.hk)      — public broadcaster
 *
 * Both publish an official ENGLISH edition of every story alongside the
 * Chinese one. That matters twice over:
 *
 *   1. "Translated to English" is already done, by the publisher, properly —
 *      so no machine translation is needed for the sources we ship, and no API
 *      key, and no cost. `translate.js` exists only for a future Chinese-only
 *      source.
 *   2. It is the honest way to get a translation. A machine-translated headline
 *      about a court case or a policy change is exactly the kind of text where
 *      a subtle error misinforms.
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
 */

const db = require('./db');
const translate = require('./translate');

/** Only sources that are published for reuse, and that we have checked. */
const SOURCES = [
  {
    key: 'gov',
    name: 'HK Government Press Releases',
    name_zh: '香港特區政府新聞公報',
    home: 'https://www.info.gov.hk/gia/general/today.htm',
    lang: 'en',
    url: 'https://www.info.gov.hk/gia/rss/general_en.xml',
    // Kept for provenance: the same stories, officially, in Chinese. Not
    // imported — it cannot be paired to the English item (the two feeds assign
    // different document ids), and the English feed is already the translation.
    zhUrl: 'https://www.info.gov.hk/gia/rss/general_zh.xml',
  },
  {
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

/** The raw inner text of the first <tag> in a block, CDATA unwrapped. */
function tagText(block, tag) {
  const m = String(block).match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!m) return '';
  let v = m[1].trim();
  const c = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (c) v = c[1].trim();
  return v;
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
    const title = decodeEntities(tagText(block, 'title')).replace(/\s+/g, ' ').trim();
    const link = tagText(block, 'link').trim() || tagText(block, 'guid').trim();
    const description = decodeEntities(stripHtml(tagText(block, 'description')));
    const guid = tagText(block, 'guid').trim() || link;
    return { title, link, description, guid, published_at: parseDate(tagText(block, 'pubDate')) };
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
 * Imports every source. Never throws: a failing feed is reported, not fatal,
 * because the other source is still worth importing and a scheduled run must
 * not die on one bad response.
 *
 * @param {{fetchImpl?:Function, sources?:object[], limitPerSource?:number}} [opts]
 * @returns {Promise<{sources:number, fetched:number, inserted:number, skipped:number, errors:string[], dryRun:boolean}>}
 */
async function importNews({ fetchImpl, sources = SOURCES, limitPerSource = 0, dryRun = false } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  const report = { sources: sources.length, fetched: 0, inserted: 0, skipped: 0, errors: [], dryRun: !!dryRun };

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

  return report;
}

/** Published counts, so a caller can report the feed's size after an import. */
const feedCounts = () => db.getPostCounts();

module.exports = { SOURCES, importNews, postsFromSource, parseRss, summarise, decodeEntities, stripHtml, SUMMARY_MAX };
