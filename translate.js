/**
 * CantoBuddy — optional machine translation.
 *
 * WHY THIS IS OPTIONAL, AND WHY IT IS SO SMALL
 * --------------------------------------------
 * The news channel was specified as "local news, translated to English".
 * The obvious reading is "fetch non-English news and translate it", and that is
 * exactly what this module is for — but it is deliberately NOT the main path,
 * because it turns out not to be needed for the sources we are allowed to use.
 *
 * Every approved source publishes its own English edition:
 *
 *   Philippine Daily Inquirer   newsinfo.inquirer.net/feed
 *   Antara News (Indonesia)     en.antaranews.com/rss/news.xml
 *   RTHK News — Local           rthk9.rthk.hk/.../e_expressnews_elocal.xml
 *
 * So for those, "translate to English" is already done, by the publisher, to a
 * far higher standard than a machine can manage — and with no API key and no
 * cost. `news.js` therefore prefers the English feed and never spends a
 * translation call on it.
 *
 * This module exists for the case that remains: a source that publishes ONLY in
 * one non-English language. The Indonesian audience is the live example —
 * Antara's Bahasa Indonesia edition carries the same stories and would serve an
 * Indonesian helper better, but one news list is shared by all four language
 * trees, so it is imported only if this module can translate it. With no key
 * configured the item is skipped and reported, never published in the wrong
 * language — a Bahasa headline in an English feed is worse than a missing story.
 *
 * PROVIDERS are chosen by environment variable, so enabling one is a config
 * change and not a code change:
 *
 *   DEEPL_API_KEY=...            (DeepL — best Chinese→English quality)
 *   GOOGLE_TRANSLATE_API_KEY=... (Google Cloud Translation v2)
 *
 * Neither is set on this deployment. That is a supported state, not a broken
 * one: the import runs, and simply does not need either.
 */

const DEEPL_ENDPOINT = process.env.DEEPL_ENDPOINT || 'https://api-free.deepl.com/v2/translate';
const GOOGLE_ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';

/** Which provider the environment asks for, or null. */
function activeProvider() {
  if (process.env.DEEPL_API_KEY) return 'deepl';
  if (process.env.GOOGLE_TRANSLATE_API_KEY) return 'google';
  return null;
}

const isConfigured = () => activeProvider() !== null;

/** DeepL wants upper-case target codes; Google wants lower-case. */
function deeplTarget(to) {
  const t = String(to || 'EN').toUpperCase();
  return t === 'ZH' ? 'ZH' : t; // 'EN', 'FIL'→'EN' is not supported; caller decides
}

/**
 * Translates one string. Returns the translation, or null when there is no
 * provider or the call fails — never a partial or a guess. A caller that gets
 * null must decide what to do (news.js skips the item).
 *
 * @param {string} text
 * @param {{from?:string,to?:string,fetchImpl?:Function}} [opts]
 * @returns {Promise<string|null>}
 */
async function translateText(text, { from = 'ZH', to = 'EN', fetchImpl } = {}) {
  const src = String(text || '').trim();
  if (!src) return null;
  const provider = activeProvider();
  if (!provider) return null;
  const doFetch = fetchImpl || globalThis.fetch;
  if (typeof doFetch !== 'function') return null;

  try {
    if (provider === 'deepl') {
      const res = await doFetch(DEEPL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
        },
        body: new URLSearchParams({ text: src, source_lang: deeplTarget(from), target_lang: deeplTarget(to) }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const out = data && data.translations && data.translations[0] && data.translations[0].text;
      return out ? String(out).trim() : null;
    }

    if (provider === 'google') {
      const url = `${GOOGLE_ENDPOINT}?key=${encodeURIComponent(process.env.GOOGLE_TRANSLATE_API_KEY)}`;
      const res = await doFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: src, source: String(from).toLowerCase(), target: String(to).toLowerCase(), format: 'text' }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const out =
        data && data.data && data.data.translations && data.data.translations[0] && data.data.translations[0].translatedText;
      return out ? String(out).trim() : null;
    }
  } catch {
    // A translation failure must never break an import run.
    return null;
  }
  return null;
}

module.exports = { isConfigured, activeProvider, translateText };
