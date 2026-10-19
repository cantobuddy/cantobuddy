/**
 * Hong Kong STATUTORY HOLIDAYS for foreign domestic helpers — 2026 and 2027.
 *
 * WHY THIS FILE EXISTS RATHER THAN PROSE IN content.js: the dates are reference
 * data that people plan their lives around, so they live in exactly one place
 * and are rendered into the guide body — the table and the surrounding text can
 * never disagree, because the text is generated FROM the table.
 *
 * SOURCES (all checked 2026-10-19 against the pages themselves, not a summary):
 *   https://www.labour.gov.hk/eng/news/latest_holidays2026.htm
 *   https://www.labour.gov.hk/eng/news/latest_holidays2027.htm
 *   Chinese names: the matching /tc/ pages of the same two URLs.
 *   Entitlement rules and the rest-day substitution rule: the Labour
 *   Department's Employment Ordinance FAQ, and the 2026 page's own worked
 *   example (Chung Yeung, Sunday 18 October 2026 -> Monday 19 October 2026).
 *
 * RULES BEHIND THE DATES, stated so the table can be trusted:
 *   - A helper is entitled to STATUTORY holidays (not the longer "general
 *     holiday" list banks and schools follow): 15 in 2026, 15 in 2027.
 *   - Easter Monday is NEW from 2026 (Employment (Amendment) Ordinance 2021,
 *     which takes the count 12 -> 17 by 2030, one extra every two years).
 *   - Lunar New Year counts as three days; if one of those falls on a Sunday,
 *     the fourth day is a statutory holiday in substitution (2027's case).
 *   - One December item is the employer's choice: the winter solstice or
 *     Christmas Day.
 *   - A statutory holiday falling on a rest day is taken on the next day that
 *     is not a rest day or another holiday.
 *
 * Every weekday name in the output is COMPUTED from the date, never typed by
 * hand — a hand-written weekday is exactly the kind of error that survives
 * review because it looks right.
 */
'use strict';

const YEARS = [2026, 2027];

/**
 * Official names. English and Chinese are the Labour Department's own wording
 * (the Chinese column is Traditional, which is what Hong Kong writes);
 * Filipino and Indonesian are the standard local terms, because a helper
 * reading this in Tagalog should not have to parse English legal phrases.
 */
const NAMES = {
  'first-day-of-january': {
    en: "The first day of January",
    fil: 'Araw ng Bagong Taon',
    zh: '1月1日',
    id: 'Tahun Baru',
  },
  'lny-1': {
    en: "Lunar New Year's Day",
    fil: 'Unang Araw ng Bagong Taong Lunar',
    zh: '農曆年初一',
    id: 'Hari Pertama Tahun Baru Imlek',
  },
  'lny-2': {
    en: 'The second day of Lunar New Year',
    fil: 'Pangalawang Araw ng Bagong Taong Lunar',
    zh: '農曆年初二',
    id: 'Hari Kedua Tahun Baru Imlek',
  },
  'lny-3': {
    en: 'The third day of Lunar New Year',
    fil: 'Pangatlong Araw ng Bagong Taong Lunar',
    zh: '農曆年初三',
    id: 'Hari Ketiga Tahun Baru Imlek',
  },
  'lny-4': {
    en: 'The fourth day of Lunar New Year',
    fil: 'Ikaapat na Araw ng Bagong Taong Lunar',
    zh: '農曆年初四',
    id: 'Hari Keempat Tahun Baru Imlek',
  },
  'ching-ming': {
    en: 'Ching Ming Festival',
    fil: 'Piyestang Ching Ming',
    zh: '清明節',
    id: 'Festival Ching Ming',
  },
  'easter-monday': {
    en: 'Easter Monday',
    fil: 'Lunes ng Pagkabuhay',
    zh: '復活節星期一',
    id: 'Senin Paskah',
  },
  'labour-day': {
    en: 'Labour Day',
    fil: 'Araw ng Paggawa',
    zh: '勞動節',
    id: 'Hari Buruh',
  },
  'buddha': {
    en: 'The Birthday of the Buddha',
    fil: 'Kaarawan ni Buddha',
    zh: '佛誕',
    id: 'Hari Lahir Buddha',
  },
  'tuen-ng': {
    en: 'Tuen Ng Festival (Dragon Boat)',
    fil: 'Piyestang Tuen Ng (Dragon Boat)',
    zh: '端午節',
    id: 'Festival Tuen Ng (Perahu Naga)',
  },
  'hksar-day': {
    en: 'Hong Kong Special Administrative Region Establishment Day',
    fil: 'Araw ng Pagtatatag ng Hong Kong SAR',
    zh: '香港特別行政區成立紀念日',
    id: 'Hari Berdirinya Hong Kong SAR',
  },
  'mid-autumn': {
    en: 'The day following the Chinese Mid-Autumn Festival',
    fil: 'Araw pagkatapos ng Piyestang Mid-Autumn',
    zh: '中秋節翌日',
    id: 'Hari setelah Festival Pertengahan Musim Gugur',
  },
  'national-day': {
    en: 'National Day',
    fil: 'Araw ng Bansa',
    zh: '國慶日',
    id: 'Hari Nasional',
  },
  'chung-yeung': {
    en: 'Chung Yeung Festival',
    fil: 'Piyestang Chung Yeung',
    zh: '重陽節',
    id: 'Festival Chung Yeung',
  },
  'december-choice': {
    en: 'Chinese Winter Solstice Festival or Christmas Day',
    fil: 'Piyestang Solstisyo ng Taglamig o Araw ng Pasko',
    zh: '冬節或聖誕節',
    id: 'Festival Titik Balik Matahari Musim Dingin atau Hari Natal',
  },
  'first-weekday-after-christmas': {
    en: 'The first weekday after Christmas Day',
    fil: 'Unang araw pagkatapos ng Pasko',
    zh: '聖誕節後第一個周日',
    id: 'Hari kerja pertama setelah Natal',
  },
};

/**
 * Row notes. `{date}` / `{date1}` / `{date2}` are filled from the row itself,
 * so a note can never name a date that contradicts the row above it.
 */
const NOTES = {
  'sunday-rest-day': {
    en: 'Falls on a Sunday. If Sunday is your rest day, the holiday moves to the next day that is not a rest day or another holiday.',
    fil: 'Nasa Linggo. Kung ang Linggo ay iyong rest day, ang pista ay lilipat sa susunod na araw na hindi rest day o ibang pista.',
    zh: '適逢星期日。如星期日是你的休息日，假期會順延至下一個既非休息日、亦非其他假日的日子。',
    id: 'Jatuh pada hari Minggu. Jika Minggu adalah hari istirahat Anda, hari libur dipindahkan ke hari berikutnya yang bukan hari istirahat atau hari libur lain.',
  },
  'moves-to': {
    en: 'Falls on a Sunday → your holiday moves to {date}.',
    fil: 'Nasa Linggo → ang pista ay lilipat sa {date}.',
    zh: '適逢星期日 → 你的假期會順延至{date}。',
    id: 'Jatuh pada hari Minggu → hari libur Anda dipindahkan ke {date}.',
  },
  'moves-to-next-is-a-holiday': {
    en: 'Falls on a Sunday, and the next day is already Easter Monday — so your holiday moves to {date}.',
    fil: 'Nasa Linggo, at ang susunod na araw ay Lunes ng Pagkabuhay — kaya ang pista ay lilipat sa {date}.',
    zh: '適逢星期日，而翌日已是復活節星期一 —— 因此你的假期會順延至{date}。',
    id: 'Jatuh pada hari Minggu, dan hari berikutnya sudah Senin Paskah — jadi hari libur Anda dipindahkan ke {date}.',
  },
  'december-choice': {
    en: "Your employer chooses which one you take: the winter solstice ({date1}) or Christmas Day ({date2}).",
    fil: 'Ang employer mo ang pumipili kung alin ang itutuloy: solstisyo ng taglamig ({date1}) o Araw ng Pasko ({date2}).',
    zh: '由僱主選擇放哪一天：冬節（{date1}）或聖誕節（{date2}）。',
    id: 'Majikan Anda memilih yang mana: titik balik matahari musim dingin ({date1}) atau Hari Natal ({date2}).',
  },
  'lny-substitute': {
    en: 'The second day of Lunar New Year ({date}) falls on a Sunday, so the fourth day is a statutory holiday in its place.',
    fil: 'Ang pangalawang araw ng Bagong Taong Lunar ({date}) ay nasa Linggo, kaya ang ikaapat na araw ang pista kapalit nito.',
    zh: '農曆年初二（{date}）適逢星期日，因此以農曆年初四為法定假日代替。',
    id: 'Hari kedua Tahun Baru Imlek ({date}) jatuh pada hari Minggu, jadi hari keempat menjadi hari libur penggantinya.',
  },
  'new-in-2026': {
    en: 'New from 2026 — added by the Employment (Amendment) Ordinance 2021, which raises the count to 17 by 2030.',
    fil: 'Bago simula 2026 — idinagdag ng Employment (Amendment) Ordinance 2021, at dadating sa 17 pista bago ang 2030.',
    zh: '2026 年起新增 —— 根據《2021年僱傭（修訂）條例》，法定假日將於 2030 年前增至 17 天。',
    id: 'Baru sejak 2026 — ditambahkan oleh Employment (Amendment) Ordinance 2021, yang menaikkan jumlahnya menjadi 17 menjelang 2030.',
  },
};

/** Everything the generated page says, in each learner's language. */
const UI = {
  en: {
    lede:
      'Fifteen paid days off a year, and they are yours by law. Every domestic helper in Hong Kong is entitled to statutory holidays — 15 in 2026 and 15 in 2027 — no matter how many hours you work or how long you have been employed. Every date is listed below, with what to do when a holiday lands on your rest day.',
    tableDate: 'Date',
    tableHoliday: 'Public holiday',
    tableNote: 'What to know',
    rulesHeading: 'What these days mean for you',
    rules: [
      'The holiday itself is yours from your first day of employment — there is no waiting period.',
      'Holiday pay: after 3 months of continuous employment you are paid your average daily wage for the holiday, no later than your next payday.',
      'If a holiday falls on your rest day (usually Sunday), the holiday moves to the next day that is not a rest day or another holiday.',
      'If you are asked to work on a holiday, your employer must give you at least 48 hours’ notice and give you another day off within 60 days before or after it.',
      'You cannot be paid instead of the holiday. Paying a helper in lieu of a statutory holiday is against the law.',
      'Lunar New Year counts as three days. If one of them falls on a Sunday, the fourth day is a holiday instead.',
      'These are statutory holidays, not the longer “general holiday” list that closes banks and schools — your entitlement is the 15 days on this page.',
    ],
    sourcesHeading: 'Where these dates come from',
    sources: [
      'Labour Department — statutory holidays for 2026 (with the rest-day rule and the Chung Yeung example)',
      'Labour Department — statutory holidays for 2027 (with the Lunar New Year substitution)',
      'Labour Department — how statutory holidays increased from 12 to 17 by 2030',
      'Employment Ordinance Cap. 57 FAQ — holiday pay, working on a holiday, and payment in lieu',
    ],
  },
  fil: {
    lede:
      'Labing-limang bayad na araw ng pahinga sa isang taon, at bunga ito ng batas. Ang bawat domestic helper sa Hong Kong ay may karapatan sa mga statutory holiday — 15 sa 2026 at 15 sa 2027 — gaano man karami ang oras ng trabaho o tagal ng pananatili. Nakatala sa ibaba ang bawat petsa, kung ano ang gagawin kapag ang pista ay nasa rest day mo.',
    tableDate: 'Petsa',
    tableHoliday: 'Pista',
    tableNote: 'Ano ang dapat malaman',
    rulesHeading: 'Ano ang kahulugan ng mga araw na ito para sa iyo',
    rules: [
      'Ikaw ang may-ari ng pista simula pa sa unang araw ng trabaho — walang hinihintay na panahon.',
      'Bayad ng pista: makalipas ang 3 buwang tuloy-tuloy na trabaho, babayaran ka ng average na sahod sa araw para sa pista, hindi lalampas sa susunod na payday.',
      'Kung ang pista ay nasa rest day mo (karaniwang Linggo), lilipat ito sa susunod na araw na hindi rest day o ibang pista.',
      'Kung ipapatrabaho ka sa isang pista, dapat magbigay ang employer mo ng hindi bababa sa 48 oras na abiso, at bigyan ka ng ibang araw ng pahinga sa loob ng 60 araw bago o pagkatapos nito.',
      'Hindi ka maaaring bayaran imbes na bigyan ng pista. Ipinagbabawal ang pagbabayad kapalit ng statutory holiday.',
      'Ang Bagong Taong Lunar ay binibilang na tatlong araw. Kung ang isa ay nasa Linggo, ang ikaapat na araw ang pista kapalit nito.',
      'Statutory holiday ito, hindi ang mas mahahabang listahang “general holiday” na nagsasara ng bangko at eskuwelahan — ang karapatan mo ay ang 15 araw na nasa pahinang ito.',
    ],
    sourcesHeading: 'Saan galing ang mga petsang ito',
    sources: [
      'Labour Department — mga statutory holiday para sa 2026 (kasama ang tuntunin ng rest day at ang halimbawa sa Chung Yeung)',
      'Labour Department — mga statutory holiday para sa 2027 (kasama ang kapalit para sa Bagong Taong Lunar)',
      'Labour Department — kung paano nadagdagan ang statutory holiday mula 12 hanggang 17 bago ang 2030',
      'FAQ ng Employment Ordinance Cap. 57 — bayad ng pista, pagtatrabaho sa pista, at bayad kapalit',
    ],
  },
  zh: {
    lede:
      '一年十五天有薪假期，這是法律賦予你的權利。在香港，每位家庭傭工均可享有法定假日 —— 2026 年與 2027 年各 15 天 —— 不論每週工時長短或受僱時間多久。以下列出每一個日期，以及當假期適逢休息日時應該怎樣處理。',
    tableDate: '日期',
    tableHoliday: '假日',
    tableNote: '備註',
    rulesHeading: '這些日子對你意味著什麼',
    rules: [
      '假期本身由入職第一天起即可享有，沒有試用期或等候期。',
      '假日薪酬：受僱滿 3 個月後，假日可獲發放相等於假日前 12 個月每日平均工資的薪酬，並須於下一個支薪日或之前支付。',
      '如法定假日適逢你的休息日（通常是星期日），該假期會順延至下一個既非休息日、亦非其他假期的日子。',
      '如僱主要求你在法定假日上班，必須最少提前 48 小時通知，並在該假日前後 60 天內安排另一天補假。',
      '僱主不得以款項代替法定假日。以薪金「買掉」家傭的法定假日屬違法。',
      '農曆新年計三天。若其中一天適逢星期日，則以年初四為法定假日代替。',
      '以上為法定假日，並非銀行及學校跟隨的較長「公眾假期」名單 —— 你的權益是本頁所列的 15 天。',
    ],
    sourcesHeading: '這些日期的來源',
    sources: [
      '勞工處 —— 2026 年法定假日（附休息日補假規定及重陽節例子）',
      '勞工處 —— 2027 年法定假日（附農曆新年補假安排）',
      '勞工處 —— 法定假日如何於 2030 年前由 12 天增至 17 天',
      '《僱傭條例》第 57 章常見問題 —— 假日薪酬、假日上班及以款項代替假日',
    ],
  },
  id: {
    lede:
      'Lima belas hari libur berbayar setahun, dan itu hak Anda menurut undang-undang. Setiap asisten rumah tangga di Hong Kong berhak atas cuti statutory — 15 di 2026 dan 15 di 2027 — berapa pun jam kerja atau lama Anda bekerja. Semua tanggal tercantum di bawah, beserta apa yang harus dilakukan saat hari libur jatuh pada hari istirahat Anda.',
    tableDate: 'Tanggal',
    tableHoliday: 'Hari libur',
    tableNote: 'Yang perlu diketahui',
    rulesHeading: 'Arti hari-hari ini bagi Anda',
    rules: [
      'Hari liburnya menjadi hak Anda sejak hari pertama bekerja — tidak ada masa tunggu.',
      'Bayaran hari libur: setelah 3 bulan kerja terus-menerus, Anda dibayar upah rata-rata harian untuk hari libur itu, paling lambat pada gajian berikutnya.',
      'Jika hari libur jatuh pada hari istirahat Anda (biasanya Minggu), liburnya dipindahkan ke hari berikutnya yang bukan hari istirahat atau hari libur lain.',
      'Jika Anda diminta bekerja pada hari libur, majikan harus memberi tahu minimal 48 jam sebelumnya dan memberi hari libur pengganti dalam 60 hari sebelum atau sesudahnya.',
      'Anda tidak boleh diganti dengan uang. Membayar pengganti cuti statutory adalah melawan hukum.',
      'Tahun Baru Imlek dihitung tiga hari. Jika salah satunya jatuh pada hari Minggu, hari keempat menjadi hari libur penggantinya.',
      'Ini cuti statutory, bukan daftar “general holiday” yang lebih panjang yang menutup bank dan sekolah — hak Anda adalah 15 hari di halaman ini.',
    ],
    sourcesHeading: 'Dari mana tanggal-tanggal ini',
    sources: [
      'Labour Department — cuti statutory 2026 (dengan aturan hari istirahat dan contoh Chung Yeung)',
      'Labour Department — cuti statutory 2027 (dengan penggantian Tahun Baru Imlek)',
      'Labour Department — bagaimana cuti statutory naik dari 12 menjadi 17 menjelang 2030',
      'FAQ Employment Ordinance Cap. 57 — bayaran hari libur, bekerja saat libur, dan bayaran pengganti',
    ],
  },
};

/** Word for "or", for the one December row that holds two possible dates. */
const OR_WORD = { en: 'or', fil: 'o', zh: '或', id: 'atau' };

/**
 * The two lists, exactly as the Labour Department publishes them.
 *
 * `noteArgs` are ISO dates the row's note refers to; the renderer formats them
 * in the reader's language, so a note can never name a date that contradicts
 * its own row. The 2026 rest-day substitutions: Ching Ming moves past Easter
 * Monday to 7 April; Buddha's Birthday to 25 May; Chung Yeung to 19 October
 * (the Department's own worked example).
 */
const HOLIDAYS = {
  2026: [
    { id: 'first-day-of-january', date: '2026-01-01' },
    { id: 'lny-1', date: '2026-02-17' },
    { id: 'lny-2', date: '2026-02-18' },
    { id: 'lny-3', date: '2026-02-19' },
    { id: 'ching-ming', date: '2026-04-05', note: 'moves-to-next-is-a-holiday', noteArgs: ['2026-04-07'] },
    { id: 'easter-monday', date: '2026-04-06', note: 'new-in-2026' },
    { id: 'labour-day', date: '2026-05-01' },
    { id: 'buddha', date: '2026-05-24', note: 'moves-to', noteArgs: ['2026-05-25'] },
    { id: 'tuen-ng', date: '2026-06-19' },
    { id: 'hksar-day', date: '2026-07-01' },
    { id: 'mid-autumn', date: '2026-09-26' },
    { id: 'national-day', date: '2026-10-01' },
    { id: 'chung-yeung', date: '2026-10-18', note: 'moves-to', noteArgs: ['2026-10-19'] },
    { id: 'december-choice', dates: ['2026-12-22', '2026-12-25'], note: 'december-choice', noteArgs: ['2026-12-22', '2026-12-25'] },
    { id: 'first-weekday-after-christmas', date: '2026-12-26' },
  ],
  2027: [
    { id: 'first-day-of-january', date: '2027-01-01' },
    { id: 'lny-1', date: '2027-02-06' },
    { id: 'lny-3', date: '2027-02-08', note: 'lny-substitute', noteArgs: ['2027-02-07'] },
    { id: 'lny-4', date: '2027-02-09' },
    { id: 'easter-monday', date: '2027-03-29' },
    { id: 'ching-ming', date: '2027-04-05' },
    { id: 'labour-day', date: '2027-05-01' },
    { id: 'buddha', date: '2027-05-13' },
    { id: 'tuen-ng', date: '2027-06-09' },
    { id: 'hksar-day', date: '2027-07-01' },
    { id: 'mid-autumn', date: '2027-09-16' },
    { id: 'national-day', date: '2027-10-01' },
    { id: 'chung-yeung', date: '2027-10-08' },
    { id: 'december-choice', dates: ['2027-12-22', '2027-12-25'], note: 'december-choice', noteArgs: ['2027-12-22', '2027-12-25'] },
    { id: 'first-weekday-after-christmas', date: '2027-12-27' },
  ],
};

/** Source pages, in the same order as UI[lang].sources. Chinese readers get the /tc/ pages. */
const SOURCES = [
  { en: 'https://www.labour.gov.hk/eng/news/latest_holidays2026.htm', zh: 'https://www.labour.gov.hk/tc/news/latest_holidays2026.htm' },
  { en: 'https://www.labour.gov.hk/eng/news/latest_holidays2027.htm', zh: 'https://www.labour.gov.hk/tc/news/latest_holidays2027.htm' },
  { en: 'https://www.labour.gov.hk/eng/news/EAO2021.htm', zh: 'https://www.labour.gov.hk/tc/news/EAO2021.htm' },
  { en: 'https://www.labour.gov.hk/eng/faq/cap57f_whole.htm', zh: 'https://www.labour.gov.hk/tc/faq/cap57f_whole.htm' },
];

const DAYS = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  fil: ['Linggo', 'Lunes', 'Martes', 'Miyerkules', 'Huwebes', 'Biyernes', 'Sabado'],
  zh: ['日', '一', '二', '三', '四', '五', '六'],
  id: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
};

const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fil: ['Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo', 'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'],
  id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
};

/** Tiny local escaper: this module is loaded by content.js, not by seo.js. */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 2026-04-05 -> "Sunday, 5 April 2026" / "Linggo, 5 Abril 2026" / "2026年4月5日". */
function formatDate(iso, lang) {
  const d = new Date(iso + 'T00:00:00Z');
  const day = DAYS[lang] ? DAYS[lang][d.getUTCDay()] : DAYS.en[d.getUTCDay()];
  const n = d.getUTCDate();
  const y = d.getUTCFullYear();
  if (lang === 'zh') return `${y}年${d.getUTCMonth() + 1}月${n}日`;
  const month = MONTHS[lang] ? MONTHS[lang][d.getUTCMonth()] : MONTHS.en[d.getUTCMonth()];
  return `${day}, ${n} ${month} ${y}`;
}

function noteText(key, args, lang) {
  const template = (NOTES[key] && (NOTES[key][lang] || NOTES[key].en)) || '';
  let i = 0;
  return template.replace(/\{date\d?\}/g, () => {
    const raw = args[i++];
    return raw ? formatDate(raw, lang) : '';
  });
}

/**
 * Fail loudly at require time if the data is wrong.
 *
 * Deliberate: a wrong statutory holiday date is worse than a missing one, and
 * a broken reference is silent in exactly the place nobody looks. This is the
 * same discipline as booting the server before a deploy — the fault only shows
 * up if something loads the file and complains.
 */
function validate() {
  const problems = [];
  for (const year of YEARS) {
    const list = HOLIDAYS[year];
    if (!Array.isArray(list) || list.length !== 15) problems.push(`${year} must list 15 holidays, found ${list && list.length}`);
    const seen = new Set();
    for (const h of list) {
      if (!NAMES[h.id]) problems.push(`${year}: unknown holiday id "${h.id}"`);
      const dates = h.dates || [h.date];
      for (const d of dates) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) { problems.push(`${year}/${h.id}: bad date "${d}"`); continue; }
        if (new Date(d + 'T00:00:00Z').getUTCFullYear() !== year) problems.push(`${year}/${h.id}: date ${d} is not in ${year}`);
        if (seen.has(d)) problems.push(`${year}: duplicate date ${d}`);
        seen.add(d);
      }
      if (h.note && !NOTES[h.note]) problems.push(`${year}/${h.id}: unknown note "${h.note}"`);
      const placeholders = ((NOTES[h.note] && NOTES[h.note].en) || '').match(/\{date\d?\}/g) || [];
      if (placeholders.length !== (h.noteArgs || []).length) {
        problems.push(`${year}/${h.id}: note "${h.note}" needs ${placeholders.length} dates, given ${(h.noteArgs || []).length}`);
      }
    }
  }
  if (!HOLIDAYS[2026].some((h) => h.id === 'easter-monday')) problems.push('2026 must include Easter Monday (new from 2026)');
  if (!HOLIDAYS[2027].some((h) => h.id === 'lny-4')) problems.push('2027 must include the fourth day of Lunar New Year');
  if (HOLIDAYS[2027].some((h) => h.id === 'lny-2')) problems.push('2027 must NOT list the second day of Lunar New Year (it falls on a Sunday)');
  if (problems.length) throw new Error('holidays.js data is wrong:/n  - ' + problems.join('\n  - '));
}

validate();

/** Heading above each year's table. Sits with the renderer that uses it. */
const YEAR_HEADING = {
  en: (y) => `${y} — 15 statutory holidays`,
  fil: (y) => `${y} — 15 statutory holiday`,
  zh: (y) => `${y} 年 —— 15 天法定假日`,
  id: (y) => `${y} — 15 cuti statutory`,
};

/**
 * One year's table.
 *
 * No classes on the elements: the SEO page sanitiser strips every attribute, so
 * the table is styled with element selectors in PAGE_CSS. That is a constraint,
 * not an oversight — it means operator-free HTML cannot smuggle in styles.
 */
function yearTable(year, lang) {
  const u = UI[lang] || UI.en;
  const or = OR_WORD[lang] || OR_WORD.en;
  const head = `<tr><th>${esc(u.tableDate)}</th><th>${esc(u.tableHoliday)}</th><th>${esc(u.tableNote)}</th></tr>`;
  const rows = HOLIDAYS[year]
    .map((h) => {
      const dates = (h.dates || [h.date]).map((d) => formatDate(d, lang));
      const dateCell = dates.length > 1 ? dates.join(` ${or} `) : dates[0];
      const name = (NAMES[h.id] || {})[lang] || (NAMES[h.id] || {}).en;
      const note = h.note ? esc(noteText(h.note, h.noteArgs || [], lang)) : '';
      return `<tr><td>${esc(dateCell)}</td><td>${esc(name)}</td><td>${note}</td></tr>`;
    })
    .join('\n');
  return `<h2>${esc(YEAR_HEADING[lang] ? YEAR_HEADING[lang](year) : YEAR_HEADING.en(year))}</h2>
<table>
<thead>
${head}
</thead>
<tbody>
${rows}
</tbody>
</table>`;
}

/** The guide's whole body, generated from the data above. */
function holidaysGuideBody(lang) {
  const u = UI[lang] || UI.en;
  const tables = YEARS.map((y) => yearTable(y, lang)).join('\n');
  const rules = u.rules.map((r) => `<li>${esc(r)}</li>`).join('\n');
  const sources = SOURCES.map(
    (s, i) => `<li><a href="${esc(s[lang] || s.en)}" rel="noopener noreferrer">${esc(u.sources[i] || s.en)}</a></li>`
  ).join('\n');
  return [
    `<p>${esc(u.lede)}</p>`,
    tables,
    `<h2>${esc(u.rulesHeading)}</h2>`,
    `<ul>\n${rules}\n</ul>`,
    `<h2>${esc(u.sourcesHeading)}</h2>`,
    `<ul>\n${sources}\n</ul>`,
  ].join('\n');
}

/** Guide metadata. `updated` is filled by content.js from its own UPDATED. */
const HOLIDAY_GUIDE = {
  slug: 'statutory-holidays-for-domestic-helpers',
  icon: '📅',
  title: {
    en: 'Statutory Holidays for Domestic Helpers 2026 & 2027',
    fil: 'Mga Statutory Holiday ng Domestic Helper 2026 at 2027',
    zh: '家傭法定假日 2026 與 2027',
    id: 'Cuti Statutory Asisten Rumah Tangga 2026 & 2027',
  },
  description: {
    en: 'Every statutory holiday a domestic helper is entitled to in 2026 and 2027 — all 15 dates each year, with the rules on rest days, holiday pay, and working on a holiday.',
    fil: 'Lahat ng statutory holiday na karapatan ng domestic helper sa 2026 at 2027 — 15 petsa bawat taon, kasama ang tuntunin sa rest day, bayad ng pista, at pagtatrabaho sa pista.',
    zh: '家傭在 2026 與 2027 年可享有的全部法定假日 —— 每年 15 天，並附上休息日補假、假日薪酬及假日上班的規定。',
    id: 'Semua cuti statutory yang menjadi hak asisten rumah tangga di 2026 dan 2027 — 15 tanggal setiap tahun, dengan aturan hari istirahat, bayaran hari libur, dan bekerja saat libur.',
  },
};

module.exports = { HOLIDAY_GUIDE, HOLIDAYS, YEARS, holidaysGuideBody, formatDate, SOURCES };
