/**
 * The sticker album — the reward layer.
 *
 * Credits are earned (one per correct quiz answer, see getCredits() in db.js)
 * and each sticker unlocks when the credit total reaches its threshold.
 *
 * Two deliberate choices:
 *
 *   - **The thresholds widen.** The first sticker arrives after five correct
 *     answers, the last after four hundred. Early encouragement matters far
 *     more than a tidy curve: a helper who earns nothing in her first session
 *     will not come back for a second one.
 *
 *   - **Every sticker is a phrase worth knowing.** The album doubles as a
 *     vocabulary list rather than being pure decoration, so collecting it
 *     teaches something. Each carries Cantonese, jyutping, English and Tagalog.
 *
 * `key` is the stable identifier stored in the database — never change one
 * without a migration, or a learner loses that sticker.
 */
const SEED_STICKERS = [
  { key: 'nei5hou2',   emoji: '👋',  cantonese: '你好',  jyutping: 'nei5 hou2',   english: 'Hello',              tagalog: 'Kumusta',           credits: 5 },
  { key: 'do1ze6',     emoji: '🙏',  cantonese: '多謝',  jyutping: 'do1 ze6',     english: 'Thank you',          tagalog: 'Salamat',           credits: 15 },
  { key: 'zou2san4',   emoji: '🌅',  cantonese: '早晨',  jyutping: 'zou2 san4',   english: 'Good morning',       tagalog: 'Magandang umaga',  credits: 30 },
  { key: 'm4goi1',     emoji: '☕',  cantonese: '唔該',  jyutping: 'm4 goi1',     english: 'Please / excuse me', tagalog: 'Paki-usap',         credits: 50 },
  { key: 'hou2mei6',   emoji: '🍜',  cantonese: '好味',  jyutping: 'hou2 mei6',   english: 'Delicious',          tagalog: 'Masarap',           credits: 75 },
  { key: 'jam2caa4',   emoji: '🫖',  cantonese: '飲茶',  jyutping: 'jam2 caa4',   english: 'Yum cha',            tagalog: 'Yum cha',           credits: 105 },
  { key: 'din6ce1',    emoji: '🚋',  cantonese: '電車',  jyutping: 'din6 ce1',    english: 'Tram',               tagalog: 'Trambya',           credits: 140 },
  { key: 'gaai1si5',   emoji: '🥬',  cantonese: '街市',  jyutping: 'gaai1 si5',   english: 'Wet market',         tagalog: 'Palengke',          credits: 180 },
  { key: 'saan1deng2', emoji: '⛰️',  cantonese: '山頂',  jyutping: 'saan1 deng2', english: 'The Peak',           tagalog: 'The Peak',          credits: 225 },
  { key: 'ding1ding1', emoji: '🔔',  cantonese: '叮叮',  jyutping: 'ding1 ding1', english: 'Ding ding (tram bell)', tagalog: 'Ding ding',      credits: 275 },
  { key: 'gung1hei2',  emoji: '🎉',  cantonese: '恭喜',  jyutping: 'gung1 hei2',  english: 'Congratulations',    tagalog: 'Binabati kita',     credits: 330 },
  { key: 'lek1neoi2',  emoji: '🏆',  cantonese: '叻女',  jyutping: 'lek1 neoi2',  english: 'Clever girl!',       tagalog: 'Ang galing mo!',    credits: 400 },
];

/** Total credits needed to collect the whole album. */
const STICKER_TOTAL = SEED_STICKERS.reduce((sum, s) => Math.max(sum, s.credits), 0);

module.exports = { SEED_STICKERS, STICKER_TOTAL };
