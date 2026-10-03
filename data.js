/**
 * CantoBuddy Data Store
 * JSON-based persistent storage with seed data for Cantonese vocabulary.
 */
const fs = require('fs');
const path = require('path');

// Where the data file lives.
//   - Running locally:  db.json sits next to this file.
//   - Hosted:           set DATA_DIR to a mounted persistent volume, e.g. /data.
//                       Most free hosts use an EPHEMERAL disk, so a volume (or
//                       external database) is required or admin changes will be
//                       lost on every restart / redeploy.
const DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'db.json');

// ---------------------------------------------------------------------------
// Seed Data
// ---------------------------------------------------------------------------

const SEED_CATEGORIES = [
  { id: 1,  name_en: 'Greetings',   name_yue: '問候',   name_fil: 'Bati',          icon: '👋' },
  { id: 2,  name_en: 'Common',      name_yue: '常用',   name_fil: 'Karaniwan',     icon: '💬' },
  { id: 3,  name_en: 'Kitchen',     name_yue: '廚房',   name_fil: 'Kusina',        icon: '🍳' },
  { id: 4,  name_en: 'Cleaning',    name_yue: '清潔',   name_fil: 'Paglilinis',    icon: '🧹' },
  { id: 5,  name_en: 'Children',    name_yue: '細路仔', name_fil: 'Bata',          icon: '👦' },
  { id: 6,  name_en: 'Daily Life',  name_yue: '日常',   name_fil: 'Pang-araw-araw',icon: '⏰' },
  { id: 7,  name_en: 'Shopping',    name_yue: '買嘢',   name_fil: 'Pamimili',      icon: '🛒' },
  { id: 8,  name_en: 'Weather',     name_yue: '天氣',   name_fil: 'Panahon',       icon: '🌧️' },
  { id: 9,  name_en: 'Home',        name_yue: '屋企',   name_fil: 'Bahay',         icon: '🏠' },
  { id: 10, name_en: 'Safety',      name_yue: '安全',   name_fil: 'Kaligtasan',    icon: '⚠️' },
  { id: 11, name_en: 'Elder Care',  name_yue: '長者照顧', name_fil: 'Pag-aalaga sa nakatatanda', icon: '🧓' },
];

// level: 1 = Beginner, 2 = Intermediate, 3 = Advanced
const SEED_VOCABULARY = [
  // ---- Beginner ----
  { id: 1,  cantonese: '你好',         jyutping: 'nei5 hou2',               english: 'Hello',                      tagalog: 'Kumusta',          emoji: '👋', level: 1, category_id: 1 },
  { id: 2,  cantonese: '多謝',         jyutping: 'do1 ze6',                 english: 'Thank you',                  tagalog: 'Salamat',          emoji: '🙏', level: 1, category_id: 1 },
  { id: 3,  cantonese: '唔該',         jyutping: 'm4 goi1',                 english: 'Please / Excuse me',         tagalog: 'Pakiusap',         emoji: '🤲', level: 1, category_id: 1 },
  { id: 4,  cantonese: '再見',         jyutping: 'zoi3 gin3',               english: 'Goodbye',                    tagalog: 'Paalam',           emoji: '👋', level: 1, category_id: 1 },
  { id: 5,  cantonese: '係',           jyutping: 'hai6',                    english: 'Yes / Is',                   tagalog: 'Oo',               emoji: '✅', level: 1, category_id: 2 },
  { id: 6,  cantonese: '唔係',         jyutping: 'm4 hai6',                 english: 'No / Is not',                tagalog: 'Hindi',            emoji: '❌', level: 1, category_id: 2 },
  { id: 7,  cantonese: '好',           jyutping: 'hou2',                    english: 'Good',                       tagalog: 'Mabuti',           emoji: '👍', level: 1, category_id: 2 },
  { id: 8,  cantonese: '唔好',         jyutping: 'm4 hou2',                 english: 'Not good / Do not',          tagalog: 'Huwag',            emoji: '👎', level: 1, category_id: 2 },
  { id: 9,  cantonese: '水',           jyutping: 'seoi2',                   english: 'Water',                      tagalog: 'Tubig',            emoji: '💧', level: 1, category_id: 3 },
  { id: 10, cantonese: '飯',           jyutping: 'faan6',                   english: 'Rice / Meal',                tagalog: 'Kanin',            emoji: '🍚', level: 1, category_id: 3 },
  { id: 11, cantonese: '食',           jyutping: 'sik6',                    english: 'Eat',                        tagalog: 'Kumain',           emoji: '🍽️', level: 1, category_id: 3 },
  { id: 12, cantonese: '飲',           jyutping: 'jam2',                    english: 'Drink',                      tagalog: 'Uminom',           emoji: '🥤', level: 1, category_id: 3 },
  { id: 13, cantonese: '廚房',         jyutping: 'cyu4 fong2',              english: 'Kitchen',                    tagalog: 'Kusina',           emoji: '🍳', level: 1, category_id: 3 },
  { id: 14, cantonese: '大',           jyutping: 'daai6',                   english: 'Big',                        tagalog: 'Malaki',           emoji: '📐', level: 1, category_id: 2 },
  { id: 15, cantonese: '細',           jyutping: 'sai3',                    english: 'Small',                      tagalog: 'Maliit',           emoji: '📏', level: 1, category_id: 2 },

  // ---- Intermediate ----
  { id: 16, cantonese: '洗衫',         jyutping: 'sai2 saam1',              english: 'Wash clothes',               tagalog: 'Maglaba',          emoji: '🧺', level: 2, category_id: 4 },
  { id: 17, cantonese: '煮飯',         jyutping: 'zyu2 faan6',              english: 'Cook',                       tagalog: 'Magluto',          emoji: '🍳', level: 2, category_id: 3 },
  { id: 18, cantonese: '拖地',         jyutping: 'to1 dei2',                english: 'Mop the floor',              tagalog: 'Magpalinis ng sahig', emoji: '🧹', level: 2, category_id: 4 },
  { id: 19, cantonese: '細路仔',       jyutping: 'sai3 lou6 zai2',          english: 'Child',                      tagalog: 'Bata',             emoji: '👦', level: 2, category_id: 5 },
  { id: 20, cantonese: '瞓覺',         jyutping: 'fan3 gaau3',              english: 'Sleep',                      tagalog: 'Matulog',          emoji: '😴', level: 2, category_id: 6 },
  { id: 21, cantonese: '起身',         jyutping: 'hei2 san1',               english: 'Wake up',                    tagalog: 'Gumising',         emoji: '⏰', level: 2, category_id: 6 },
  { id: 22, cantonese: '沖涼',         jyutping: 'cung1 loeng4',            english: 'Take a shower',              tagalog: 'Maligo',           emoji: '🚿', level: 2, category_id: 6 },
  { id: 23, cantonese: '街市',         jyutping: 'gaai1 si5',               english: 'Market',                     tagalog: 'Palengke',         emoji: '🏪', level: 2, category_id: 7 },
  { id: 24, cantonese: '買嘢',         jyutping: 'maai5 je5',               english: 'Go shopping',                tagalog: 'Mamili',           emoji: '🛒', level: 2, category_id: 7 },
  { id: 25, cantonese: '返學',         jyutping: 'faan1 hok6',              english: 'Go to school',               tagalog: 'Pumasok sa paaralan', emoji: '🏫', level: 2, category_id: 5 },
  { id: 26, cantonese: '做功課',       jyutping: 'zou6 gung1 fo3',          english: 'Do homework',                tagalog: 'Gumawa ng takdang-aralin', emoji: '📚', level: 2, category_id: 5 },
  { id: 27, cantonese: '開燈',         jyutping: 'hoi1 dang1',              english: 'Turn on the light',          tagalog: 'Buksan ang ilaw',  emoji: '💡', level: 2, category_id: 9 },
  { id: 28, cantonese: '關燈',         jyutping: 'gwaan1 dang1',            english: 'Turn off the light',         tagalog: 'Patayin ang ilaw', emoji: '🔦', level: 2, category_id: 9 },
  { id: 29, cantonese: '落雨',         jyutping: 'lok6 jyu5',               english: 'Raining',                    tagalog: 'Umuulan',          emoji: '🌧️', level: 2, category_id: 8 },
  { id: 30, cantonese: '小心',         jyutping: 'siu2 sam1',               english: 'Be careful',                 tagalog: 'Mag-ingat',        emoji: '⚠️', level: 2, category_id: 10 },

  // ---- Advanced (phrases / sentences) ----
  { id: 31, cantonese: '唔該幫我買啲菜',       jyutping: 'm4 goi1 bong1 ngo5 maai5 di1 coi3',           english: 'Please help me buy some vegetables',     tagalog: 'Pakiusap tulungan mo akong bumili ng gulay',     emoji: '🥬', level: 3, category_id: 7 },
  { id: 32, cantonese: '細路仔要瞓覺喇',       jyutping: 'sai3 lou6 zai2 jiu3 fan3 gaau3 laa3',         english: 'The child needs to sleep now',            tagalog: 'Kailangan na matulog ang bata',                  emoji: '😴', level: 3, category_id: 5 },
  { id: 33, cantonese: '今日落好大雨',         jyutping: 'gam1 jat6 lok6 hou2 daai6 jyu5',              english: 'It rained heavily today',                 tagalog: 'Malakas ang ulan ngayon',                        emoji: '🌧️', level: 3, category_id: 8 },
  { id: 34, cantonese: '唔該你攞啲碗嚟',       jyutping: 'm4 goi1 nei5 lo2 di1 wun2 lai4',              english: 'Please bring some bowls',                 tagalog: 'Pakiusap dalhin mo ang mga mangkok',             emoji: '🥣', level: 3, category_id: 3 },
  { id: 35, cantonese: '我哋去街市買嘢',       jyutping: 'ngo5 dei6 heoi3 gaai1 si5 maai5 je5',         english: "Let's go to the market to shop",          tagalog: 'Pumunta tayo sa palengke para mamili',           emoji: '🏪', level: 3, category_id: 7 },
  { id: 36, cantonese: '細路仔做完功課未',     jyutping: 'sai3 lou6 zai2 zou6 jyun4 gung1 fo3 mei6',    english: 'Has the child finished homework?',        tagalog: 'Tapos na ba ang bata sa takdang-aralin?',        emoji: '📚', level: 3, category_id: 5 },
  { id: 37, cantonese: '廚房啲碗洗咗未',       jyutping: 'cyu4 fong2 di1 wun2 sai2 zo2 mei6',           english: 'Have the kitchen bowls been washed?',     tagalog: 'Nahugasan na ba ang mga plato sa kusina?',       emoji: '🍽️', level: 3, category_id: 3 },
  { id: 38, cantonese: '唔好掂嗰樣嘢',         jyutping: 'm4 hou2 dim2 go2 joeng6 je5',                 english: "Don't touch that thing",                  tagalog: 'Huwag hawakan ang bagay na iyon',                emoji: '🚫', level: 3, category_id: 10 },
  { id: 39, cantonese: '快啲返嚟',             jyutping: 'faai3 di1 faan1 lai4',                        english: 'Come back quickly',                       tagalog: 'Balik ka agad',                                  emoji: '🏃', level: 3, category_id: 6 },
  { id: 40, cantonese: '幫手打掃客廳',         jyutping: 'bong1 sau2 daa2 saan2 haak3 teng1',          english: 'Help clean the living room',              tagalog: 'Tulungang linisin ang sala',                     emoji: '🧹', level: 3, category_id: 4 },
  { id: 41, cantonese: '食早餐',               jyutping: 'sik6 zou2 caan1',                             english: 'Eat breakfast',                           tagalog: 'Kumain ng almusal',                              emoji: '🥣', level: 3, category_id: 6 },
  { id: 42, cantonese: '飲水',                 jyutping: 'jam2 seoi2',                                  english: 'Drink water',                             tagalog: 'Uminom ng tubig',                                emoji: '💧', level: 3, category_id: 6 },
  { id: 43, cantonese: '唔該開冷氣',           jyutping: 'm4 goi1 hoi1 laang5 hei3',                    english: 'Please turn on the air conditioner',      tagalog: 'Pakiusap buksan ang aircon',                     emoji: '❄️', level: 3, category_id: 9 },
  { id: 44, cantonese: '關門',                 jyutping: 'gwaan1 mun4',                                 english: 'Close the door',                          tagalog: 'Isara ang pinto',                                emoji: '🚪', level: 3, category_id: 9 },
  { id: 45, cantonese: '有冇嘢食',             jyutping: 'jau5 mou5 je5 sik6',                          english: 'Is there anything to eat?',               tagalog: 'May pagkain ba?',                                emoji: '🍽️', level: 3, category_id: 3 },

  // ---- Elder Care (category 11) ---- phrases for caring for an elderly family member ----
  { id: 46, cantonese: '坐低',                 jyutping: 'co5 dai1',                                    english: 'Sit down',                                tagalog: 'Umupo ka',                                       emoji: '🪑', level: 1, category_id: 11 },
  { id: 47, cantonese: '食藥',                 jyutping: 'sik6 joek6',                                  english: 'Take medicine',                           tagalog: 'Uminom ng gamot',                               emoji: '💊', level: 1, category_id: 11 },
  { id: 48, cantonese: '慢慢行',               jyutping: 'maan6 maan6 haang4',                          english: 'Walk slowly',                             tagalog: 'Dahan-dahang maglakad',                          emoji: '🚶', level: 1, category_id: 11 },
  { id: 49, cantonese: '今日好嗎',             jyutping: 'gam1 jat6 hou2 maa1',                         english: 'How are you today?',                      tagalog: 'Kumusta ka ngayon?',                             emoji: '😊', level: 1, category_id: 11 },
  { id: 50, cantonese: '食飽未',               jyutping: 'sik6 baau2 mei6',                             english: 'Have you eaten enough?',                  tagalog: 'Busog ka na ba?',                               emoji: '🍽️', level: 1, category_id: 11 },
  { id: 51, cantonese: '小心行路',             jyutping: 'siu2 sam1 haang4 lou6',                       english: 'Be careful walking',                      tagalog: 'Mag-ingat sa paglalakad',                       emoji: '⚠️', level: 2, category_id: 11 },
  { id: 52, cantonese: '瞓晏覺',               jyutping: 'fan3 ngaan3 gaau3',                           english: 'Take a nap',                              tagalog: 'Magpahinga ng hapon',                            emoji: '😴', level: 2, category_id: 11 },
  { id: 53, cantonese: '唔好起身太快',         jyutping: 'm4 hou2 hei2 san1 taai3 faai3',               english: 'Do not get up too fast',                  tagalog: 'Huwag mabilis tumayo',                           emoji: '⬆️', level: 2, category_id: 11 },
  { id: 54, cantonese: '幫你沖涼',             jyutping: 'bong1 nei5 cung1 loeng4',                     english: 'Help you take a bath',                    tagalog: 'Tutulungan kang maligo',                         emoji: '🚿', level: 2, category_id: 11 },
  { id: 55, cantonese: '幫你梳頭',             jyutping: 'bong1 nei5 so1 tau4',                         english: 'Help you comb your hair',                 tagalog: 'Tutulungan kitang magsuklay',                   emoji: '💇', level: 2, category_id: 11 },
  { id: 56, cantonese: '痛唔痛',               jyutping: 'tung3 m4 tung3',                              english: 'Does it hurt?',                           tagalog: 'Masakit ba?',                                   emoji: '🤕', level: 2, category_id: 11 },
  { id: 57, cantonese: '唔舒服',               jyutping: 'm4 syu1 fuk6',                                english: 'Not feeling well',                        tagalog: 'Hindi maganda ang pakiramdam',                   emoji: '🤒', level: 2, category_id: 11 },
  { id: 58, cantonese: '等一陣',               jyutping: 'dang2 jat1 zan6',                             english: 'Wait a moment',                           tagalog: 'Sandali lang',                                   emoji: '⏳', level: 2, category_id: 11 },
  { id: 59, cantonese: '唔好擔心',             jyutping: 'm4 hou2 daam1 sam1',                          english: 'Do not worry',                            tagalog: 'Huwag mag-alala',                               emoji: '😌', level: 2, category_id: 11 },
  { id: 60, cantonese: '唔好急慢慢嚟',         jyutping: 'm4 hou2 gap1 maan6 maan6 lai4',               english: 'Do not rush, take your time',             tagalog: 'Huwag magmadali, dahan-dahan',                   emoji: '🐢', level: 3, category_id: 11 },
  { id: 61, cantonese: '今日煮咩嘢食',         jyutping: 'gam1 jat6 zyu2 me1 je5 sik6',                 english: 'What shall we cook today?',               tagalog: 'Ano ang iluluto natin ngayon?',                 emoji: '🍳', level: 3, category_id: 11 },
  { id: 62, cantonese: '唔該慢慢食',           jyutping: 'm4 goi1 maan6 maan6 sik6',                     english: 'Please eat slowly',                       tagalog: 'Pakiusap nang dahan-dahan kumain',              emoji: '🥢', level: 3, category_id: 11 },
  { id: 63, cantonese: '去洗手間未',           jyutping: 'heoi3 sai2 sau2 gaan1 mei6',                   english: 'Have you been to the toilet?',            tagalog: 'Nakapag-CR ka na ba?',                          emoji: '🚽', level: 3, category_id: 11 },
  { id: 64, cantonese: '企穩啲先',             jyutping: 'kei5 wan2 di1 sin1',                          english: 'Stand steady first',                      tagalog: 'Tumayo nang matatag muna',                       emoji: '🧍', level: 3, category_id: 11 },
];

const SEED_USERS = [
  { id: 1, username: 'admin', password: 'cantobuddy2024', role: 'admin', name: 'Employer' },
];

const SEED_DATA = {
  categories: SEED_CATEGORIES,
  vocabulary: SEED_VOCABULARY,
  users: SEED_USERS,
  progress: [],
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

function load() {
  if (!fs.existsSync(DB_PATH)) {
    save(SEED_DATA);
    return JSON.parse(JSON.stringify(SEED_DATA));
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    save(SEED_DATA);
    return JSON.parse(JSON.stringify(SEED_DATA));
  }
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function reset() {
  save(SEED_DATA);
  return JSON.parse(JSON.stringify(SEED_DATA));
}

function nextId(items) {
  if (!items || items.length === 0) return 1;
  return Math.max(...items.map((i) => i.id)) + 1;
}

module.exports = { load, save, reset, nextId };
