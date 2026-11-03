/**
 * The "practical" channels — the single source of truth.
 *
 * These are the editorial channels that answer "how do I actually do this"
 * rather than "tell me a story": the words for the market, the words for the
 * household, what to say when you feel ill, and what happens at festival time.
 *
 * They appear in three places, and all three read from THIS file:
 *
 *   1. the Living shelf in the app      (server.js  → /api/living)
 *   2. the Discover hub                 (seo.js     → renderDiscoverHub)
 *   3. the crawlable /living hub page   (seo.js     → renderLivingHub)
 *
 * ---------------------------------------------------------------------------
 * HOW TO ADD A NEW ONE
 * ---------------------------------------------------------------------------
 * 1. Append an entry to PRACTICAL_CHANNELS below. `channel` MUST already be in
 *    POST_CHANNELS in db.js — an unknown channel is silently dropped by
 *    listPosts() and the group simply never renders.
 * 2. Seed at least one post in that channel (see SEED_POSTS in data.js). A
 *    channel with no posts is filtered out everywhere, by design: an empty
 *    shelf reads worse than no shelf.
 *
 * That is the whole job. Nothing in app.js, seo.js or i18n.js needs editing —
 * the label and lede travel with the entry, and the client picks the language
 * from the object it is handed.
 */

/** Section chrome. The shelf is two halves; each needs a heading and a lede. */
const PRACTICAL_SECTIONS = {
  practical: {
    en: ['Practical phrases & everyday', 'The words you meet every day — at the market, around the house, when you feel unwell, and at festival time.'],
    fil: ['Praktikal na parirala at araw-araw', 'Ang mga salitang hinaharap mo araw-araw — sa palengke, sa bahay, kapag may sakit, at tuwing pista.'],
    zh: ['实用短语与日常', '每天都会遇到的词——街市、家里、身体不舒服的时候，以及过节的时候。'],
    id: ['Frasa praktis & keseharian', 'Kata yang Anda temui setiap hari — di pasar, di rumah, saat tidak enak badan, dan saat festival.'],
  },
  passages: {
    en: ['Longer guides', 'When you have time to read: arriving, money, health, rest days, and the harder days.'],
    fil: ['Mas mahabang gabay', 'Kapag may oras kang magbasa: pagdating, pera, kalusugan, rest day, at ang mahihirap na araw.'],
    zh: ['长文指南', '有空的时候慢慢读：初到香港、金钱、健康、休息日，以及难熬的日子。'],
    id: ['Panduan lebih panjang', 'Saat Anda punya waktu membaca: kedatangan, uang, kesehatan, hari libur, dan hari-hari berat.'],
  },
};

/**
 * The channels, in the order a helper is likely to need them: first week,
 * then the household, then the urgent one, then the calendar.
 */
const PRACTICAL_CHANNELS = [
  {
    channel: 'survival-phrases',
    icon: '🧺',
    label: {
      en: 'Survival phrases', fil: 'Mga parirala para maka-survive',
      zh: '生存粤语', id: 'Frasa bertahan',
    },
    lede: {
      en: 'The words you need in your first week — market, phone, directions.',
      fil: 'Ang mga salitang kailangan mo sa unang linggo — palengke, telepono, direksyon.',
      zh: '第一周就用得到的词——街市、电话、问路。',
      id: 'Kata yang Anda butuhkan di minggu pertama — pasar, telepon, arah.',
    },
  },
  {
    channel: 'work-household',
    icon: '🧹',
    label: {
      en: 'Work & household', fil: 'Trabaho at bahay',
      zh: '工作与家务', id: 'Kerja & rumah',
    },
    lede: {
      en: 'Instructions, chores, and asking where things go.',
      fil: 'Mga utos, gawaing-bahay, at pagtatanong kung saan nilalagay ang mga bagay.',
      zh: '指令、家务，以及「这个放哪里」。',
      id: 'Perintah, pekerjaan rumah, dan bertanya barang ditaruh di mana.',
    },
  },
  {
    channel: 'health',
    icon: '🤒',
    label: {
      en: 'Health', fil: 'Kalusugan', zh: '健康', id: 'Kesehatan',
    },
    lede: {
      en: 'Feeling sick, pain, and getting help fast.',
      fil: 'Pakiramdam na may sakit, pananakit, at mabilis na tulong.',
      zh: '不舒服、疼痛，以及尽快求助。',
      id: 'Merasa sakit, nyeri, dan mendapat bantuan cepat.',
    },
  },
  {
    channel: 'festivals',
    icon: '🌕',
    label: {
      en: 'Festivals', fil: 'Mga pista', zh: '节庆', id: 'Festival',
    },
    lede: {
      en: 'What the family celebrates, and what to do.',
      fil: 'Ang ipinagdiriwang ng pamilya, at ang dapat gawin.',
      zh: '家里在庆祝什么，以及你该怎么做。',
      id: 'Apa yang dirayakan keluarga, dan apa yang harus dilakukan.',
    },
  },
];

/** Just the channel keys, in shelf order. */
const PRACTICAL_CHANNEL_KEYS = PRACTICAL_CHANNELS.map((c) => c.channel);

/** Pick a localized field off a channel entry, falling back to English. */
function practicalText(entry, field, lang) {
  const v = entry && entry[field];
  if (!v) return '';
  return (v[lang] || v.en || '');
}

/** Section chrome for one language, as { title, lede }. */
function practicalSection(key, lang) {
  const s = PRACTICAL_SECTIONS[key] || PRACTICAL_SECTIONS.practical;
  const pair = s[lang] || s.en;
  return { title: pair[0], lede: pair[1] };
}

module.exports = {
  PRACTICAL_CHANNELS,
  PRACTICAL_CHANNEL_KEYS,
  PRACTICAL_SECTIONS,
  practicalText,
  practicalSection,
};
