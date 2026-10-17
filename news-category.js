/**
 * CantoBuddy — news categories.
 *
 * WHY THIS EXISTS
 * ---------------
 * The News channel used to be one long list, newest first. A helper who wanted
 * "anything about my contract" had to scroll past every headline from three
 * countries to find it, and the channel only grows — the importer runs hourly.
 * So the reader can now narrow it to what she came for.
 *
 * WHAT A CATEGORY IS, AND WHAT IT IS NOT
 * --------------------------------------
 * It is a TOPIC, not a place. The source already says which country an item
 * came from — that is printed on the card — so a Philippines/Indonesia/Hong
 * Kong split would tell her nothing new. What she cannot see from the card is
 * that this one is about a wage rise, and that one is about her contract.
 *
 * `hongkong` is the one exception and it is deliberate: "what is happening in
 * the city I live in" is a real question with a real answer, and the RTHK feed
 * is the only source that answers it.
 *
 * HOW CLASSIFICATION WORKS — AND WHY IT IS BEST-EFFORT
 * ----------------------------------------------------
 * There is no editorial pass. The importer classifies every item on the way in
 * with a keyword scorer over the headline (weight 3), the summary (weight 1)
 * and any <category> tags the feed published (weight 1 — Inquirer and Antara
 * both emit them, and whatever topic the publisher chose is worth more than a
 * guess). Highest score wins; a tie goes to the earlier category in
 * NEWS_CATEGORY_KEYS, so the result is stable rather than dependent on key
 * order in an object.
 *
 * It will be wrong sometimes. That is acceptable ONLY because the operator can
 * correct any single post in the admin dashboard, and because `backfill()`
 * exists to re-run the guess over everything. What is not acceptable is a
 * category that cannot be corrected — so `category` is a plain column, and the
 * admin form writes it.
 *
 * The classifier NEVER invents a category it was not given: an unrecognised
 * value is dropped, not stored. A typo in a keyword list must not be able to
 * put a broken label in front of a reader.
 */

/** Valid category keys, in display order. Also the tie-break order. */
const NEWS_CATEGORY_KEYS = ['hongkong', 'work', 'money', 'health', 'home', 'politics', 'other'];

/**
 * Keywords per category. Lower case, matched on word boundaries, in any of the
 * four languages a headline might arrive in — Inquirer and Antara both publish
 * English editions (see news.js) but a headline can still carry a Filipino or
 * Indonesian word, and a helper searching for "upah" should find it.
 */
const KEYWORDS = {
  // The city she works in. "central" is deliberately absent: it is also a
  // Philippine region, and a Luzon story is not a Hong Kong story.
  hongkong: [
    'hong kong', 'hk', 'kowloon', 'admiralty', 'causeway bay', 'mong kok', 'tsim sha tsui',
    'yuen long', 'sha tin', 'tuen mun', 'kwun tong', 'wan chai', 'north point', 'quarry bay',
    'aberdeen', 'stanley', 'lantau', 'cheung chau', 'new territories', 'legislative council',
    'legco', 'mtr', 'happy valley', 'hong kong sar', 'victoria park', 'polyu',
    'university of hong kong', 'chinese university of hong kong', 'hkust', 'hong kong police',
    'immigration tower', 'west kowloon', 'hong kong international airport', 'cathay pacific',
    'hkex', 'tsuen wan', 'sai kung', 'tai po', 'sheung shui', 'fanling', 'yau tsim mong',
    'hongkongers', 'hong kong dollar', 'hk dollar',
  ],

  // Work: her job, her contract, her rights, and the agencies in between.
  work: [
    'worker', 'workers', 'labour', 'labor', 'labourer', 'employment', 'employer', 'employers',
    'employee', 'employees', 'domestic helper', 'domestic helpers', 'domestic worker',
    'domestic workers', 'migrant worker', 'migrant workers', 'ofw', 'ofws',
    'overseas filipino', 'overseas filipinos', 'owwa', 'dole', 'poea', 'dmw', 'kasambahay',
    'tki', 'pekerja migran', 'buruh', 'serikat pekerja', 'phk', 'union', 'unions', 'strike',
    'striking', 'picketing', 'recruitment', 'recruiter', 'recruitment agency',
    'employment agency', 'trafficking', 'trafficked', 'job', 'jobs', 'hiring', 'hired',
    'fired', 'dismissed', 'dismissal', 'layoff', 'layoffs', 'retrenchment', 'redundant',
    'apprentice', 'apprenticeship', 'trainee', 'internship', 'seafarer', 'seafarers',
    'seaman', 'seamen', 'labour market', 'jobless', 'underpaid', 'exploited', 'exploitation',
    'agency fee', 'placement fee', 'end of contract', 'contract renewal', 'hours of work',
    'rest day', 'statutory minimum wage', 'labour code', 'keselamatan kerja',
  ],

  // Money: what things cost and what she is paid. Separate from `work` because
  // "the minimum wage went up" is a number she can act on, and "an agency lost
  // its licence" is not.
  money: [
    'money', 'wage', 'wages', 'minimum wage', 'salary', 'salaries', 'pay rise', 'pay hike',
    'wage hike', 'pay increase', 'income', 'earnings', 'remittance', 'remittances', 'peso',
    'pesos', 'rupiah', 'dollar', 'dollars', 'exchange rate', 'inflation', 'cost of living',
    'prices', 'price hike', 'price increase', 'consumer price', 'spending', 'budget', 'tax',
    'taxes', 'tax cut', 'tariff', 'economy', 'economic', 'gdp', 'recession', 'poverty',
    'benefits', 'pension', 'allowance', 'subsidy', 'loan', 'loans', 'debt', 'interest rate',
    'stock market', 'shares', 'currency', 'centavo', 'banking', 'inflation rate', 'purchasing power',
  ],

  health: [
    'health', 'healthcare', 'health care', 'hospital', 'hospitals', 'clinic', 'doctor',
    'doctors', 'nurse', 'nurses', 'medical', 'medicine', 'medicines', 'disease', 'diseases',
    'illness', 'sick', 'sickness', 'vaccine', 'vaccines', 'vaccination', 'dengue', 'covid',
    'coronavirus', 'tuberculosis', 'hiv', 'aids', 'malaria', 'influenza', 'flu', 'outbreak',
    'epidemic', 'pandemic', 'infected', 'infection', 'mental health', 'depression', 'anxiety',
    'suicide', 'pregnant', 'pregnancy', 'maternal', 'nutrition', 'malnutrition', 'polio',
    'measles', 'rabies', 'ambulance', 'emergency room', 'dental', 'pharmacy', 'prescription',
    'surgery', 'patient', 'patients', 'treatment', 'cancer', 'diabetes', 'hypertension',
    'stroke', 'heart attack', 'kesehatan', 'rumah sakit',
  ],

  home: [
    'family', 'families', 'parents', 'mother', 'father', 'children', 'child', 'kids', 'son',
    'daughter', 'grandmother', 'grandfather', 'husband', 'wife', 'marriage', 'married',
    'wedding', 'divorce', 'school', 'schools', 'education', 'student', 'students', 'pupils',
    'teacher', 'teachers', 'university', 'college', 'graduation', 'scholarship', 'exam',
    'exams', 'food', 'cuisine', 'recipe', 'cooking', 'festival', 'festivals', 'holiday',
    'holidays', 'christmas', 'holy week', 'eid', 'ramadan', 'lunar new year', 'mid autumn',
    'weather', 'typhoon', 'flood', 'floods', 'earthquake', 'volcano', 'ashfall', 'heat wave',
    'drought', 'traffic', 'transport', 'commute', 'bus', 'jeepney', 'train', 'flight',
    'flights', 'airport', 'housing', 'house', 'province', 'provincial', 'barangay', 'village',
    'community', 'church', 'faith', 'religion', 'culture', 'tradition', 'reunion', 'burial',
    'funeral', 'birth', 'baby', 'newborn', 'elderly', 'senior citizens', 'rumah tangga',
    'keluarga', 'sekolah', 'banjir',
  ],

  politics: [
    'politics', 'political', 'politician', 'politicians', 'government', 'administration',
    'president', 'vice president', 'senate', 'senator', 'senators', 'congress',
    'congressman', 'house of representatives', 'election', 'elections', 'electoral', 'vote',
    'votes', 'voting', 'voters', 'ballot', 'campaign', 'candidate', 'candidates', 'law',
    'laws', 'bill', 'bills', 'legislation', 'policy', 'policies', 'reform', 'reforms',
    'corruption', 'scandal', 'impeachment', 'resignation', 'resigned', 'appointed',
    'cabinet', 'ministry', 'minister', 'bureau', 'officials', 'authorities', 'treaty',
    'diplomatic', 'diplomacy', 'protest', 'protests', 'rally', 'demonstration', 'court',
    'supreme court', 'judge', 'judges', 'ruling', 'verdict', 'sentenced', 'arrested',
    'arrest', 'charged', 'indicted', 'lawsuit', 'case', 'hearing', 'trial', 'appeal',
    'justice', 'crime', 'criminal', 'police', 'murder', 'homicide', 'killing', 'robbery',
    'theft', 'fraud', 'scam', 'smuggling', 'narcotics', 'national security', 'sovereignty',
    'pemerintah', 'presiden', 'pemilu', 'korupsi',
  ],
};

/** Titles count for more than summaries: a headline is the publisher's own topic label. */
const TITLE_WEIGHT = 3;
const TEXT_WEIGHT = 1;

/**
 * Fold a string into a comparable shape: lower case, punctuation to spaces,
 * single-spaced, and padded so a keyword can be matched with a leading and
 * trailing space. The padding is what makes word-boundary matching work
 * without a regex per keyword — 'flu' must not match 'flung'.
 */
function fold(s) {
  return ` ${String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\uac00-\ud7af]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

/** How many distinct keywords of one category appear in one haystack. */
function hits(haystack, list) {
  if (!haystack || !list) return 0;
  let n = 0;
  for (const kw of list) {
    if (haystack.includes(` ${fold(kw).trim()} `)) n += 1;
  }
  return n;
}

/**
 * The category for one news item.
 *
 * @param {{title?:string, summary?:string, tags?:string[], source_key?:string}} item
 * @returns {string} one of NEWS_CATEGORY_KEYS
 */
function classifyNews(item = {}) {
  const title = fold(item.title);
  const rest = [item.summary, ...(Array.isArray(item.tags) ? item.tags : [])]
    .filter(Boolean)
    .map(fold)
    .join('');

  let best = 'other';
  let bestScore = 0;
  for (const key of NEWS_CATEGORY_KEYS) {
    if (key === 'other') continue; // the fallback, never a winner on merit
    const score = hits(title, KEYWORDS[key]) * TITLE_WEIGHT + hits(rest, KEYWORDS[key]) * TEXT_WEIGHT;
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }

  if (bestScore === 0) return sourceDefault(item.source_key);
  return best;
}

/**
 * Nothing matched. Hong Kong is a safe default for the RTHK feed — a local
 * story with no keywords in it is still a local story — and for a home-country
 * feed there is no better answer than the bucket that says "everything else",
 * because guessing a topic she did not come for is worse than admitting we
 * could not tell.
 */
function sourceDefault(sourceKey) {
  const prefix = String(sourceKey || '').split(':')[0];
  return prefix === 'rthk' ? 'hongkong' : 'other';
}

/** True when `v` is a category this build knows how to render. */
function isValidCategory(v) {
  return NEWS_CATEGORY_KEYS.includes(String(v || ''));
}

/** A category to store: the given one if valid, else '' — never garbage. */
function normaliseCategory(v) {
  const s = String(v || '').trim().toLowerCase();
  return isValidCategory(s) ? s : '';
}

module.exports = {
  NEWS_CATEGORY_KEYS,
  KEYWORDS,
  classifyNews,
  sourceDefault,
  isValidCategory,
  normaliseCategory,
};
