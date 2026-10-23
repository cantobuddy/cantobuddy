/**
 * CantoBuddy — glosses for the 37 new entries in vocabulary-expansion-draft.js.
 *
 * Two overlays, matching the shape of MANDARIN_GLOSSES and INDONESIAN_GLOSSES in
 * data.js. Keyed by the same ids as the draft (143-180).
 *
 * WHY THEY ARE MANDATORY, NOT OPTIONAL
 *   - `mandarin`  — the app has a Simplified-Chinese learner tree. Without a
 *     gloss, app.js falls back to `english` for the multiple-choice options, so
 *     a Mandarin speaker is asked to prove she understood a Cantonese word by
 *     picking between English words. She is not served by the Filipino gloss
 *     either. Every seeded id has one; these must too.
 *   - `indonesian` — tools/indonesian-test.js asserts EVERY seeded row has one
 *     ("all 142 seeded rows still have a Tagalog gloss" and the Indonesian
 *     equivalent). Ship the entries without these and that suite goes red.
 *
 * WORDING RULES (same two the data.js header sets out — do not tidy them away)
 *   1. Prefer the natural Mandarin/Indonesian EQUIVALENT of the Cantonese, not
 *      a literal gloss of the characters. 唔該 is 请/劳驾, not "not should".
 *   2. Where Cantonese and Mandarin genuinely differ, the gloss is still the
 *      Mandarin word for the same thing (食藥 -> 吃药), so a reader can map what
 *      she already knows onto what she is hearing.
 *
 *   3. The Indonesian is the everyday register a domestic worker in HK speaks
 *      with an Indonesian employer/agency — not literary. Where Indonesian and
 *      Tagalog differ in feel, the Indonesian follows the Indonesian, not a
 *      transliteration of the Tagalog field.
 *
 *   4. A few entries are Cantonese-only slang or fixed phrases with no clean
 *      Mandarin one-word equivalent. Those get a short explanatory gloss
 *      (marked with an em dash) rather than a wrong single word. They are the
 *      ones a Chinese-speaking reviewer should read first:
 *        146 慢行   160 係咁先喇   147 食咗飯未   151 唔該借借
 */

const EXPANSION_MANDARIN = {
  // Greetings L2
  143: '不用客气',
  144: '对不起',
  145: '不用',
  146: '慢走 — 送客时说的话',
  147: '吃饭了吗 — 这是问候，不是真的问吃饭',
  // Greetings L3
  148: '不好意思打扰你',
  149: '有事就打电话给我',
  150: '小姐早上好',
  151: '请让一让',
  // Common L2
  152: '很多',
  153: '太少',
  154: '没问题',
  155: '等我',
  156: '等等',
  // Common L3
  157: '你说什么？',
  158: '请说慢一点',
  159: '我不太明白',
  160: '就先这样吧 — 结束对话时的固定说法',
  // Cleaning L1
  161: '干净',
  162: '脏',
  163: '扫地',
  164: '擦手',
  // Children L1
  165: '妈妈',
  166: '爸爸',
  167: '玩',
  168: '哭',
  // Daily Life L1
  169: '觉 — 睡觉的觉',
  170: '衣服',
  171: '穿衣服',
  172: '刷牙',
  // Shopping L1
  173: '菜',
  174: '鱼',
  175: '肉',
  176: '水果',
  // Home L1
  177: '开',
  178: '关 — 关门、关盖',
  179: '房间',
  180: '大门',
};

const EXPANSION_INDONESIAN = {
  // Greetings L2
  143: 'Sama-sama',
  144: 'Maaf',
  145: 'Tidak perlu',
  146: 'Hati-hati di jalan — diucapkan saat mengantar tamu pulang',
  147: 'Sudah makan belum? — ini sapaan, bukan pertanyaan soal makan',
  // Greetings L3
  148: 'Maaf mengganggu',
  149: 'Kalau ada apa-apa telepon saya',
  150: 'Selamat pagi, Bu',
  151: 'Permisi, numpang lewat',
  // Common L2
  152: 'Banyak',
  153: 'Terlalu sedikit',
  154: 'Tidak masalah',
  155: 'Tunggu saya',
  156: 'Sebentar',
  // Common L3
  157: 'Kamu bilang apa?',
  158: 'Tolong bicara lebih pelan',
  159: 'Saya kurang mengerti',
  160: 'Sudah, segitu dulu — penutup percakapan',
  // Cleaning L1
  161: 'Bersih',
  162: 'Kotor',
  163: 'Menyapu',
  164: 'Lap tangan',
  // Children L1
  165: 'Mama / Ibu',
  166: 'Papa / Ayah',
  167: 'Bermain',
  168: 'Menangis',
  // Daily Life L1
  169: 'Tidur — kata benda',
  170: 'Baju / Pakaian',
  171: 'Pakai baju',
  172: 'Sikat gigi',
  // Shopping L1
  173: 'Sayur',
  174: 'Ikan',
  175: 'Daging',
  176: 'Buah',
  // Home L1
  177: 'Buka / Nyalakan',
  178: 'Tutup — pintu atau tutup wadah',
  179: 'Kamar',
  180: 'Pintu depan',
};

module.exports = { EXPANSION_MANDARIN, EXPANSION_INDONESIAN };
