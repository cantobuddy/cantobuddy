/* =============================================================================
   CantoBuddy — the daily phrase for her kitchen.

   One phrase a day, chosen by the Hong Kong date, the same phrase for every
   device. This is the app's smallest surface and it exists for one reason: the
   streak asks her to WORK, and on a tired evening she will not. A single phrase
   keeps the daily-open habit alive on exactly the days the practice habit fails
   — which is when a streak dies.

   Pure on purpose: no database, no clock of its own, no network. Every rule
   below is a function of (vocabulary, date), so it can be tested at any date
   without freezing time, and the server and any future landing page can agree
   on today's phrase without asking each other.
   ============================================================================= */

/**
 * The seed category ids the card draws from: 3 Kitchen, 16 Meals & Feeding,
 * 20 Food.
 *
 * These are explicit ids in SEED_CATEGORIES, not names, because the ids are
 * what the rows carry and a name is operator-editable (the admin can rename
 * "Kitchen" tomorrow, and the card should not go blank because of it). A
 * category that no longer exists simply contributes no phrases.
 */
const KITCHEN_CATEGORY_IDS = [3, 16, 20];

/** Days since the Unix epoch for a YYYY-MM-DD date. Used as the rotation
 *  counter, so the phrase changes at Hong Kong midnight and not at UTC's. */
function dayNumber(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 86400000);
}

/**
 * Today's phrase from a pool, or null when the pool is empty.
 *
 * Sorted by id before choosing. That matters more than it looks: without it the
 * pick depends on whatever order the query happened to return, so two servers,
 * or the same server after a reseed, would show different phrases on the same
 * day — and the whole point of a daily card is that it is the same one.
 *
 * The rotation is a plain modulo over the day number. It walks the pool in
 * order and repeats only when the pool is exhausted, which for a hundred-odd
 * kitchen phrases is a different phrase for months.
 */
function pickPhrase(pool, date) {
  const list = (Array.isArray(pool) ? pool : [])
    .filter((v) => v && v.cantonese)
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id));
  if (!list.length) return null;

  const n = dayNumber(date);
  if (n === null) return null;

  const word = list[((n % list.length) + list.length) % list.length];
  return {
    id: word.id,
    cantonese: word.cantonese,
    jyutping: word.jyutping || '',
    english: word.english || '',
    tagalog: word.tagalog || '',
    mandarin: word.mandarin || '',
    indonesian: word.indonesian || '',
    emoji: word.emoji || '🍳',
    category_id: word.category_id || null,
    level: word.level || 1,
  };
}

module.exports = {
  KITCHEN_CATEGORY_IDS,
  dayNumber,
  pickPhrase,
};
