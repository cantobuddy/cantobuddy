/**
 * The sticker album — the reward layer.
 *
 * Credits are earned (one per correct quiz answer, see getCredits() in db.js)
 * and each sticker unlocks when the credit total reaches its threshold.
 *
 * Three deliberate choices:
 *
 *   - **The thresholds widen.** The first sticker arrives after five correct
 *     answers, the last after four hundred. Early encouragement matters far
 *     more than a tidy curve: a helper who earns nothing in her first session
 *     will not come back for a second one. The gaps widen slowly so the middle
 *     of the album never feels like a drought — one new sticker every fifteen
 *     or so correct answers, all the way through.
 *
 *   - **Every sticker is a phrase worth knowing.** The album doubles as a
 *     vocabulary list rather than being pure decoration, so collecting it
 *     teaches something. Each carries Cantonese, jyutping, and a gloss in all
 *     four learner languages — a Filipino, Chinese or Indonesian reader should
 *     not meet English on her own album.
 *
 *   - **The funny ones are load-bearing.** 等陣 ("in a minute") and 唔知 ("no
 *     idea!") are here because they are the phrases that make a helper laugh
 *     when she recognises them in her own kitchen. A reward you smile at is
 *     worth more than a reward you merely own.
 *
 * `key` is the stable identifier stored in `learner_stickers` — never change
 * one without a migration, or a learner loses that sticker. The twelve original
 * keys keep their original credit values for the same reason: lowering a
 * threshold would hand out stickers she has not earned, and raising one would
 * take back a sticker she already has.
 */
const STICKERS = [
  // ---- First words -------------------------------------------------------
  { key: 'nei5hou2',      emoji: '👋', cantonese: '你好',     jyutping: 'nei5 hou2',       english: 'Hello',                 tagalog: 'Kumusta',              mandarin: '你好',     indonesian: 'Halo',              credits: 5 },
  { key: 'm4hou2ji3si3',  emoji: '😅', cantonese: '唔好意思', jyutping: 'm4 hou2 ji3 si1', english: 'Oops, sorry!',          tagalog: 'Ay, pasensya na',      mandarin: '不好意思', indonesian: 'Aduh, maaf',         credits: 10 },
  { key: 'do1ze6',        emoji: '🙏', cantonese: '多謝',     jyutping: 'do1 ze6',         english: 'Thank you',             tagalog: 'Salamat',              mandarin: '多谢',     indonesian: 'Terima kasih',      credits: 15 },
  { key: 'hou2gui6',      emoji: '😮‍💨', cantonese: '好攰',     jyutping: 'hou2 gui6',       english: 'So tired',              tagalog: 'Sobrang pagod',        mandarin: '好累',     indonesian: 'Capek banget',      credits: 22 },
  { key: 'zou2san4',      emoji: '🌅', cantonese: '早晨',     jyutping: 'zou2 san4',       english: 'Good morning',          tagalog: 'Magandang umaga',      mandarin: '早安',     indonesian: 'Selamat pagi',      credits: 30 },
  { key: 'sik6faahn6',    emoji: '🍚', cantonese: '食飯',     jyutping: 'sik6 faan6',      english: 'Time to eat',           tagalog: 'Kain na',              mandarin: '吃饭',     indonesian: 'Waktunya makan',    credits: 40 },
  { key: 'm4goi1',        emoji: '☕', cantonese: '唔該',     jyutping: 'm4 goi1',         english: 'Please / thanks a lot', tagalog: 'Paki / salamat',       mandarin: '谢谢',     indonesian: 'Tolong / makasih',  credits: 50 },

  // ---- Everyday ----------------------------------------------------------
  { key: 'gei2do1cin2',   emoji: '💰', cantonese: '幾多錢',   jyutping: 'gei2 do1 cin2',   english: 'How much?',             tagalog: 'Magkano?',             mandarin: '多少钱',   indonesian: 'Berapa harganya?',  credits: 62 },
  { key: 'hou2mei6',      emoji: '🍜', cantonese: '好味',     jyutping: 'hou2 mei6',       english: 'Delicious',             tagalog: 'Masarap',              mandarin: '好吃',     indonesian: 'Enak',              credits: 75 },
  { key: 'dang2zan6',     emoji: '⏳', cantonese: '等陣',     jyutping: 'dang2 zan6',      english: 'In a minute…',          tagalog: 'Mamaya na',            mandarin: '等一下',   indonesian: 'Nanti dulu',        credits: 90 },
  { key: 'jam2caa4',      emoji: '🫖', cantonese: '飲茶',     jyutping: 'jam2 caa4',       english: 'Yum cha',               tagalog: 'Yum cha',              mandarin: '饮茶',     indonesian: 'Yum cha',           credits: 105 },
  { key: 'hou2coi2',      emoji: '🍀', cantonese: '好彩',     jyutping: 'hou2 coi2',       english: 'Phew, lucky!',          tagalog: 'Buti na lang',         mandarin: '好在',     indonesian: 'Untung saja',       credits: 122 },
  { key: 'din6ce1',       emoji: '🚋', cantonese: '電車',     jyutping: 'din6 ce1',        english: 'Tram',                  tagalog: 'Trambya',              mandarin: '电车',     indonesian: 'Trem',              credits: 140 },

  // ---- Out and about -----------------------------------------------------
  { key: 'sau1sap6',      emoji: '🧹', cantonese: '收拾',     jyutping: 'sau1 sap6',       english: 'Tidy up',               tagalog: 'Magligpit',            mandarin: '收拾',     indonesian: 'Beres-beres',       credits: 160 },
  { key: 'gaai1si5',      emoji: '🥬', cantonese: '街市',     jyutping: 'gaai1 si5',       english: 'Wet market',            tagalog: 'Palengke',             mandarin: '街市',     indonesian: 'Pasar',             credits: 180 },
  { key: 'maai5sung3',    emoji: '🛒', cantonese: '買餸',     jyutping: 'maai5 sung3',     english: 'Buy the groceries',     tagalog: 'Mamalengke',           mandarin: '买菜',     indonesian: 'Belanja sayur',     credits: 202 },
  { key: 'saan1deng2',    emoji: '⛰️', cantonese: '山頂',     jyutping: 'saan1 deng2',     english: 'The Peak',              tagalog: 'The Peak',             mandarin: '山顶',     indonesian: 'The Peak',          credits: 225 },
  { key: 'hou2gwai3',     emoji: '💸', cantonese: '好貴',     jyutping: 'hou2 gwai3',      english: 'So expensive!',         tagalog: 'Ang mahal!',           mandarin: '好贵',     indonesian: 'Mahal banget!',     credits: 250 },
  { key: 'ding1ding1',    emoji: '🔔', cantonese: '叮叮',     jyutping: 'ding1 ding1',     english: 'Ding ding (tram bell)', tagalog: 'Ding ding',            mandarin: '叮叮',     indonesian: 'Ding ding',         credits: 275 },

  // ---- Almost local ------------------------------------------------------
  { key: 'ngaam1',        emoji: '🎯', cantonese: '啱',       jyutping: 'ngaam1',          english: 'Exactly right',         tagalog: 'Sakto',                mandarin: '刚好',     indonesian: 'Pas',               credits: 302 },
  { key: 'gung1hei2',     emoji: '🎉', cantonese: '恭喜',     jyutping: 'gung1 hei2',      english: 'Congratulations',       tagalog: 'Binabati kita',        mandarin: '恭喜',     indonesian: 'Selamat',           credits: 330 },
  { key: 'siu2sam1',      emoji: '⚠️', cantonese: '小心',     jyutping: 'siu2 sam1',       english: 'Careful!',              tagalog: 'Mag-ingat',            mandarin: '小心',     indonesian: 'Hati-hati',         credits: 350 },
  { key: 'm4zi1',         emoji: '🤷', cantonese: '唔知',     jyutping: 'm4 zi1',          english: 'No idea!',              tagalog: 'Hindi ko alam',        mandarin: '不知道',   indonesian: 'Nggak tahu',        credits: 375 },
  { key: 'lek1neoi2',     emoji: '🏆', cantonese: '叻女',     jyutping: 'lek1 neoi2',      english: 'Clever girl!',          tagalog: 'Ang galing mo!',       mandarin: '厉害',     indonesian: 'Hebat!',            credits: 400 },
];

/**
 * The album's four shelves.
 *
 * Purely a grouping and a colour, derived from the credit threshold — never
 * stored — so the four sections can never disagree with the numbers. The
 * colours are the existing level tokens (see `styles.css :root`), because the
 * project has one palette and a reward shelf is not a reason to invent a
 * second one.
 *
 * `upTo` is inclusive and the list must stay ascending, which is what makes
 * the first matching entry the right one.
 */
const STICKER_TIERS = [
  { key: 'first',    upTo: 50 },
  { key: 'everyday', upTo: 140 },
  { key: 'out',      upTo: 275 },
  { key: 'local',    upTo: Infinity },
];

/** Which shelf a sticker with this threshold belongs to. */
function tierFor(credits) {
  const hit = STICKER_TIERS.find((t) => credits <= t.upTo);
  return (hit || STICKER_TIERS[STICKER_TIERS.length - 1]).key;
}

// A guard rather than a comment, because the failure it prevents is silent:
// db.js takes the FIRST sticker above the credit balance as "what to aim for"
// (SEED_STICKERS.find((s) => credits < s.credits)), so a single out-of-order
// entry makes the album point at the wrong next sticker forever, with no error
// anywhere. This only fires if the list is edited badly, and then it fires at
// boot rather than in a learner's album three weeks later.
for (let i = 1; i < STICKERS.length; i++) {
  if (STICKERS[i].credits <= STICKERS[i - 1].credits) {
    throw new Error(
      `stickers.js: credit thresholds must strictly ascend, but ${STICKERS[i].key} ` +
        `(${STICKERS[i].credits}) follows ${STICKERS[i - 1].key} (${STICKERS[i - 1].credits}). ` +
        'The album picks the next sticker by order, so this would point at the wrong one.'
    );
  }
}

/** The album as the rest of the app sees it: each sticker plus its shelf. */
const SEED_STICKERS = STICKERS.map((s) => ({ ...s, tier: tierFor(s.credits) }));

/** How many stickers there are in total. */
const STICKER_COUNT = SEED_STICKERS.length;

/** Total credits needed to collect the whole album. */
const STICKER_TOTAL = SEED_STICKERS.reduce((sum, s) => Math.max(sum, s.credits), 0);

module.exports = { SEED_STICKERS, STICKER_TOTAL, STICKER_COUNT, STICKER_TIERS, tierFor };
