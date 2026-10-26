/**
 * CantoBuddy Data Store — seed data + LEGACY JSON store.
 *
 * NOTE: the app no longer reads db.json at runtime. SQLite (see db.js) is the
 * store of record. This module is retained for two reasons:
 *   1. It holds the canonical SEED_* arrays that db.js seeds a fresh database from.
 *   2. `load()` is used by migrate.js to import an existing db.json in one shot.
 */
const fs = require('fs');
const path = require('path');

// Where the legacy data file lives.
//   - Running locally:  db.json sits next to this file.
//   - Hosted:           set DATA_DIR to a mounted persistent volume, e.g. /data.
//                       Most free hosts use an EPHEMERAL disk, so a volume (or
//                       external database) is required or admin changes will be
//                       lost on every restart / redeploy.
//
// NOTE: nothing is created on require. db.js imports the SEED_* arrays below and
// never touches the JSON file, so requiring this module must not have side
// effects — on a read-only hosting sandbox, a mkdir here would take the whole
// app down before SQLite ever opened. The directory is created lazily in save().
const DATA_DIR = process.env.DATA_DIR || __dirname;
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

  // ---- Tier A expansion: caring for the person -----------------------------
  // The helper's Cantonese need is set by ONE person — the elderly care
  // recipient, who cannot meet her in English. Everything else in her day she
  // can negotiate in English. So Tier A is the reason she is employed, and it
  // is where the content should be densest.
  { id: 12, name_en: 'Health & Symptoms',      name_yue: '病徵',     name_fil: 'Mga Sintomas',            icon: '🩺' },
  { id: 13, name_en: 'Medicine & Appointments', name_yue: '食藥覆診', name_fil: 'Gamot at Check-up',      icon: '💊' },
  { id: 14, name_en: 'Mobility & Walking',     name_yue: '行路扶助', name_fil: 'Paglalakad',              icon: '🦯' },
  { id: 15, name_en: 'Toilet & Personal Care', name_yue: '如廁清潔', name_fil: 'Banyo at Paglilinis',     icon: '🚿' },
  { id: 16, name_en: 'Meals & Feeding',        name_yue: '食飯餵食', name_fil: 'Pagkain',                 icon: '🍚' },
  { id: 17, name_en: 'Comfort & Reassurance',  name_yue: '安慰',     name_fil: 'Pagpapalakas ng Loob',    icon: '🤗' },

  // ---- Everyday life outside the home ------------------------------------
  // The helper's job does not stop at the front door. Taking the elderly
  // person out for dim sum is one of the most ordinary — and most
  // Cantonese-only — things she does in a week: the tea-house auntie does not
  // speak English, the menu is in Chinese, and the elderly person she is with
  // will ask her for things across the table. This is practical, daily, and
  // the vocabulary is compact and high-frequency.
  { id: 18, name_en: 'Restaurant',  name_yue: '酒樓食飯', name_fil: 'Restawran', icon: '🍽️' },

  // A whole category for the festival calendar, because in Hong Kong it is a
  // work surface rather than a cultural interest. Twelve or so public holidays
  // a year, each one changing what is in the flat, what is banned, what must be
  // bought, and what the employer says to her — and the words are specific to
  // the day, so they are useless known in the wrong week. 恭喜發財 learnt in
  // February is forgotten by March; learnt the morning of, it is the sentence
  // that gets her a good word instead of a mistake.
  { id: 19, name_en: 'Festivals',   name_yue: '節日',     name_fil: 'Mga Pista',  icon: '🎊' },

  // ---- v9: the everyday table-and-shop vocabulary ---------------------
  // Food, Fruit, Colours, Money and Counting. These sit AFTER Festivals
  // deliberately: the array order and each row's sort_order must agree,
  // because seedIfEmpty() and migrateContent() read them from different
  // places (see the note in db.js). Appending them above Festivals left a
  // fresh database ordering them 18..23 while a migrated one ordered them
  // 19..23, with Festivals in a different place in each.
  { id: 20, name_en: 'Food', name_yue: '食物', name_fil: 'Pagkain at Ulam', name_zh: '食物', name_id: 'Makanan', icon: '🍲', sort_order: 19 },
  { id: 21, name_en: 'Fruit', name_yue: '生果', name_fil: 'Prutas', name_zh: '水果', name_id: 'Buah', icon: '🍎', sort_order: 20 },
  { id: 22, name_en: 'Colours', name_yue: '顏色', name_fil: 'Kulay', name_zh: '颜色', name_id: 'Warna', icon: '🎨', sort_order: 21 },
  { id: 23, name_en: 'Money', name_yue: '錢銀', name_fil: 'Pera', name_zh: '钱', name_id: 'Uang', icon: '💰', sort_order: 22 },
  { id: 24, name_en: 'Counting', name_yue: '數字', name_fil: 'Bilang', name_zh: '数字', name_id: 'Angka', icon: '🔢', sort_order: 23 },
];

// Scenario sets — a situation groups phrases that are used together, which is
// not the same thing as a topic. 「幫我攞杯水」 belongs to "understanding a
// request", not to "kitchen". Same shape as a category on purpose.
const SEED_SCENARIOS = [
  { id: 1, name_en: 'Asking for help',       name_yue: '求助',   name_fil: 'Humingi ng tulong',   icon: '🙋', description: 'The helper needs something from the family or a neighbour.', sort_order: 0 },
  { id: 2, name_en: 'Understanding a request', name_yue: '聽指示', name_fil: 'Pag-unawa sa utos', icon: '👂', description: 'What the elderly person says to her, all day.', sort_order: 1 },
  { id: 3, name_en: 'Reporting to the family', name_yue: '交代情況', name_fil: 'Pag-uulat sa pamilya', icon: '📋', description: 'Understand it in Cantonese, say it in English. The highest-value set.', sort_order: 2 },
  { id: 4, name_en: 'At the clinic',         name_yue: '睇醫生', name_fil: 'Sa klinika',          icon: '🏥', description: 'Doctor visits, symptoms, follow-ups.', sort_order: 3 },
  { id: 5, name_en: 'On the phone',          name_yue: '講電話', name_fil: 'Sa telepono',         icon: '📞', description: 'Calls from family and from the clinic.', sort_order: 4 },
  { id: 6, name_en: 'Emergency',             name_yue: '緊急',   name_fil: 'Emerhensiya',         icon: '🚨', description: 'A fall, a fever, can\'t breathe — what to say and what to understand.', sort_order: 5 },
  { id: 7, name_en: 'Reassurance',           name_yue: '安慰',   name_fil: 'Pagpapalakas ng loob', icon: '🤝', description: 'Calming and orienting someone who is frightened or confused.', sort_order: 6 },
  { id: 8, name_en: 'Festival greetings',    name_yue: '節日祝賀', name_fil: 'Pagbati sa pista',  icon: '🎊', description: 'Lunar New Year, Mid-Autumn, and the rest of the calendar.', sort_order: 7 },
];

// level: 1 = Beginner, 2 = Intermediate, 3 = Advanced
const SEED_VOCABULARY = [  // ---- Beginner ----
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

  /* =========================================================================
     Tier A expansion — "caring for the person" (ids 65–120)

     These are the fields that did not exist before:
       type       word | phrase | sentence
       speaker    helper (she says it) | elderly (she hears it) | either
       scenario_id  which situation it belongs to
     `speaker` is the important one. It answers the question the app could not
     previously ask: am I learning to SAY this, or to UNDERSTAND it?

     ⚠ These entries are machine-drafted and have NOT yet been checked by a
     native Cantonese speaker. Per the proposal (§8.6) a wrong word in elder
     care is a safety issue, not a typo — so they carry `status: 'draft'` and
     the review is the outstanding work, not an optional extra.
     ========================================================================= */

  // ---- 12 · Health & Symptoms -------------------------------------------
  { id: 65, cantonese: '痛',           jyutping: 'tung3',                   english: 'Pain / It hurts',        tagalog: 'Sakit',                            emoji: '😖', level: 1, category_id: 12, type: 'word',     speaker: 'either',  tags: 'body' },
  { id: 66, cantonese: '頭痛',         jyutping: 'tau4 tung3',              english: 'Headache',               tagalog: 'Sakit ng ulo',                     emoji: '🤕', level: 1, category_id: 12, type: 'word',     speaker: 'either',  tags: 'body', example_yue: '我今日頭痛', example_jyutping: 'ngo5 gam1 jat6 tau4 tung3', example_en: 'I have a headache today' },
  { id: 67, cantonese: '咳',           jyutping: 'kat1',                    english: 'Cough',                  tagalog: 'Ubo',                              emoji: '😷', level: 1, category_id: 12, type: 'word',     speaker: 'either',  tags: 'body' },
  { id: 68, cantonese: '發燒',         jyutping: 'faat3 siu1',              english: 'Fever',                  tagalog: 'Lagnat',                           emoji: '🤒', level: 2, category_id: 12, type: 'word',     speaker: 'either',  tags: 'body', usage_note: 'Also used as a verb: 佢發燒 = she has a fever.' },
  { id: 69, cantonese: '頭暈',         jyutping: 'tau4 wan4',               english: 'Dizzy',                  tagalog: 'Nahihilo',                         emoji: '😵', level: 2, category_id: 12, type: 'word',     speaker: 'either',  tags: 'body' },
  { id: 70, cantonese: '肚痛',         jyutping: 'tou5 tung3',              english: 'Stomach ache',           tagalog: 'Sakit ng tiyan',                   emoji: '🤢', level: 2, category_id: 12, type: 'word',     speaker: 'either',  tags: 'body' },
  { id: 71, cantonese: '邊度痛呀',     jyutping: 'bin1 dou6 tung3 aa3',     english: 'Where does it hurt?',    tagalog: 'Saan masakit?',                    emoji: '❓', level: 2, category_id: 12, type: 'phrase',   speaker: 'helper',  scenario_id: 4, tags: 'question,care' },
  { id: 72, cantonese: '我好唔舒服',   jyutping: 'ngo5 hou2 m4 syu1 fuk6',  english: 'I feel very unwell',     tagalog: 'Sobrang masama ang pakiramdam ko', emoji: '😞', level: 3, category_id: 12, type: 'sentence', speaker: 'elderly', scenario_id: 3, tags: 'reporting' },

  // ---- 13 · Medicine & Appointments -------------------------------------
  { id: 73, cantonese: '藥',           jyutping: 'joek6',                   english: 'Medicine',               tagalog: 'Gamot',                            emoji: '💊', level: 1, category_id: 13, type: 'word',     speaker: 'either',  tags: 'health' },
  { id: 74, cantonese: '藥丸',         jyutping: 'joek6 jyun2',             english: 'Pill',                   tagalog: 'Tableta',                          emoji: '⚪', level: 2, category_id: 13, type: 'word',     speaker: 'either',  tags: 'health' },
  { id: 75, cantonese: '藥水',         jyutping: 'joek6 seoi2',             english: 'Liquid medicine',        tagalog: 'Gamot na likido',                  emoji: '🧴', level: 2, category_id: 13, type: 'word',     speaker: 'either',  tags: 'health' },
  { id: 76, cantonese: '診所',         jyutping: 'can2 so2',                english: 'Clinic',                 tagalog: 'Klinika',                          emoji: '🏥', level: 1, category_id: 13, type: 'word',     speaker: 'either',  tags: 'health' },
  { id: 77, cantonese: '醫生',         jyutping: 'ji1 sang1',               english: 'Doctor',                 tagalog: 'Doktor',                           emoji: '🩺', level: 1, category_id: 13, type: 'word',     speaker: 'either',  tags: 'health', example_yue: '去睇醫生', example_jyutping: 'heoi3 tai2 ji1 sang1', example_en: 'Go and see the doctor' },
  { id: 78, cantonese: '食咗藥未',     jyutping: 'sik6 zo2 joek6 mei6',     english: 'Have you taken your medicine?', tagalog: 'Uminom ka na ba ng gamot?',  emoji: '⏰', level: 2, category_id: 13, type: 'phrase',   speaker: 'helper',  scenario_id: 2, tags: 'question,care' },
  { id: 79, cantonese: '去診所',       jyutping: 'heoi3 can2 so2',          english: 'Go to the clinic',       tagalog: 'Pumunta sa klinika',               emoji: '🚑', level: 2, category_id: 13, type: 'phrase',   speaker: 'either',  scenario_id: 4, tags: 'imperative' },
  { id: 80, cantonese: '幾時覆診',     jyutping: 'gei2 si4 fuk1 can2',      english: 'When is the follow-up?', tagalog: 'Kailan ang follow-up?',            emoji: '📅', level: 3, category_id: 13, type: 'sentence', speaker: 'helper',  scenario_id: 4, tags: 'question' },

  // ---- 14 · Mobility & Walking ------------------------------------------
  { id: 81, cantonese: '行',           jyutping: 'haang4',                  english: 'Walk',                   tagalog: 'Maglakad',                         emoji: '🚶', level: 1, category_id: 14, type: 'word',     speaker: 'either',  tags: 'verb,movement' },
  { id: 82, cantonese: '企',           jyutping: 'kei5',                    english: 'Stand',                  tagalog: 'Tumayo',                           emoji: '🧍', level: 1, category_id: 14, type: 'word',     speaker: 'either',  tags: 'verb,movement' },
  { id: 83, cantonese: '扶手',         jyutping: 'fu4 sau2',                english: 'Handrail / to hold on',  tagalog: 'Hawakan',                          emoji: '🛗', level: 2, category_id: 14, type: 'word',     speaker: 'either',  tags: 'noun,movement' },
  { id: 84, cantonese: '輪椅',         jyutping: 'leon4 ji2',               english: 'Wheelchair',             tagalog: 'Wheelchair',                       emoji: '♿', level: 2, category_id: 14, type: 'word',     speaker: 'either',  tags: 'noun,movement', example_yue: '攞輪椅嚟', example_jyutping: 'lo2 leon4 ji2 lai4', example_en: 'Bring the wheelchair' },
  { id: 85, cantonese: '扶住我',       jyutping: 'fu4 zyu6 ngo5',           english: 'Hold on to me',          tagalog: 'Humawak ka sa akin',               emoji: '🤝', level: 2, category_id: 14, type: 'phrase',   speaker: 'helper',  tags: 'care,imperative' },
  { id: 86, cantonese: '慢慢嚟',       jyutping: 'maan6 maan6 lai4',        english: 'Take your time',         tagalog: 'Dahan-dahan lang',                 emoji: '🐢', level: 2, category_id: 14, type: 'phrase',   speaker: 'helper',  tags: 'care,reassurance' },
  { id: 87, cantonese: '唔好跌倒',     jyutping: 'm4 hou2 dit3 dou2',       english: 'Do not fall',            tagalog: 'Huwag kang matumba',               emoji: '⚠️', level: 3, category_id: 14, type: 'sentence', speaker: 'helper',  tags: 'care,warning' },
  { id: 88, cantonese: '我扶你起身',   jyutping: 'ngo5 fu4 nei5 hei2 san1', english: "I'll help you get up",   tagalog: 'Tutulungan kitang bumangon',       emoji: '💪', level: 3, category_id: 14, type: 'sentence', speaker: 'helper',  tags: 'care' },

  // ---- 15 · Toilet & Personal Care --------------------------------------
  { id: 89, cantonese: '洗手間',       jyutping: 'sai2 sau2 gaan1',         english: 'Toilet',                 tagalog: 'Banyo / CR',                       emoji: '🚽', level: 1, category_id: 15, type: 'word',     speaker: 'either',  tags: 'noun,place' },
  { id: 90, cantonese: '牙刷',         jyutping: 'ngaa4 caat2',             english: 'Toothbrush',             tagalog: 'Toothbrush',                       emoji: '🪥', level: 1, category_id: 15, type: 'word',     speaker: 'either',  tags: 'noun' },
  { id: 91, cantonese: '毛巾',         jyutping: 'mou4 gan1',               english: 'Towel',                  tagalog: 'Tuwalya',                          emoji: '🧻', level: 1, category_id: 15, type: 'word',     speaker: 'either',  tags: 'noun' },
  { id: 92, cantonese: '洗面',         jyutping: 'sai2 min6',               english: 'Wash face',              tagalog: 'Maghugas ng mukha',                emoji: '🧼', level: 2, category_id: 15, type: 'phrase',   speaker: 'either',  tags: 'care' },
  { id: 93, cantonese: '換衫',         jyutping: 'wun6 saam1',              english: 'Change clothes',         tagalog: 'Magpalit ng damit',                emoji: '👕', level: 2, category_id: 15, type: 'phrase',   speaker: 'either',  tags: 'care' },
  { id: 94, cantonese: '去洗手間',     jyutping: 'heoi3 sai2 sau2 gaan1',   english: 'Go to the toilet',       tagalog: 'Pumunta sa CR',                    emoji: '🚻', level: 2, category_id: 15, type: 'phrase',   speaker: 'helper',  scenario_id: 2, tags: 'imperative,care' },
  { id: 95, cantonese: '我幫你換衫',   jyutping: 'ngo5 bong1 nei5 wun6 saam1', english: "I'll help you change", tagalog: 'Tutulungan kitang magpalit',       emoji: '👚', level: 3, category_id: 15, type: 'sentence', speaker: 'helper',  tags: 'care' },
  { id: 96, cantonese: '要唔要去洗手間', jyutping: 'jiu3 m4 jiu3 heoi3 sai2 sau2 gaan1', english: 'Do you need the toilet?', tagalog: 'Kailangan mo bang pumunta sa CR?', emoji: '❓', level: 3, category_id: 15, type: 'sentence', speaker: 'helper', scenario_id: 2, tags: 'question,care' },

  // ---- 16 · Meals & Feeding ---------------------------------------------
  { id: 97, cantonese: '肚餓',         jyutping: 'tou5 ngo6',               english: 'Hungry',                 tagalog: 'Gutom',                            emoji: '🍽️', level: 1, category_id: 16, type: 'word',     speaker: 'either',  tags: 'feeling', example_yue: '你肚餓未', example_jyutping: 'nei5 tou5 ngo6 mei6', example_en: 'Are you hungry?' },
  { id: 98, cantonese: '飽',           jyutping: 'baau2',                   english: 'Full (after eating)',    tagalog: 'Busog',                            emoji: '😌', level: 1, category_id: 16, type: 'word',     speaker: 'either',  tags: 'feeling' },
  { id: 99, cantonese: '胃口',         jyutping: 'mei6 hau2',               english: 'Appetite',               tagalog: 'Gana sa pagkain',                  emoji: '🍲', level: 2, category_id: 16, type: 'word',     speaker: 'either',  tags: 'noun,health' },
  { id: 100, cantonese: '熱',          jyutping: 'jit6',                    english: 'Hot',                    tagalog: 'Mainit',                           emoji: '🔥', level: 1, category_id: 16, type: 'word',     speaker: 'either',  tags: 'adjective' },
  { id: 101, cantonese: '凍',          jyutping: 'dung3',                   english: 'Cold',                   tagalog: 'Malamig',                          emoji: '🧊', level: 1, category_id: 16, type: 'word',     speaker: 'either',  tags: 'adjective' },
  { id: 102, cantonese: '食多啲',      jyutping: 'sik6 do1 di1',            english: 'Eat a bit more',         tagalog: 'Kumain ka pa ng kaunti',           emoji: '➕', level: 2, category_id: 16, type: 'phrase',   speaker: 'helper',  tags: 'care,imperative' },
  { id: 103, cantonese: '太熱呀',      jyutping: 'taai3 jit6 aa3',          english: "It's too hot",           tagalog: 'Sobrang init',                     emoji: '🥵', level: 2, category_id: 16, type: 'phrase',   speaker: 'elderly', scenario_id: 2, tags: 'complaint' },
  { id: 104, cantonese: '冇胃口',      jyutping: 'mou5 mei6 hau2',          english: 'No appetite',            tagalog: 'Walang gana',                      emoji: '😔', level: 3, category_id: 16, type: 'sentence', speaker: 'elderly', scenario_id: 3, tags: 'reporting,health' },

  // ---- 17 · Comfort & Reassurance ---------------------------------------
  { id: 105, cantonese: '唔怕',        jyutping: 'm4 paa3',                 english: "Don't be afraid",        tagalog: 'Huwag kang matakot',               emoji: '😊', level: 1, category_id: 17, type: 'phrase',   speaker: 'helper',  scenario_id: 7, tags: 'reassurance', example_yue: '唔怕，我喺度', example_jyutping: 'm4 paa3, ngo5 hai2 dou6', example_en: "Don't be afraid, I'm here" },
  { id: 106, cantonese: '冇事',        jyutping: 'mou5 si6',                english: "It's alright",           tagalog: 'Ayos lang',                        emoji: '👌', level: 1, category_id: 17, type: 'phrase',   speaker: 'helper',  scenario_id: 7, tags: 'reassurance' },
  { id: 107, cantonese: '我喺度',      jyutping: 'ngo5 hai2 dou6',          english: "I'm here",               tagalog: 'Nandito ako',                      emoji: '🙋', level: 1, category_id: 17, type: 'phrase',   speaker: 'helper',  scenario_id: 7, tags: 'reassurance' },
  { id: 108, cantonese: '乖',          jyutping: 'gwaai1',                  english: 'Good (to a child or elder)', tagalog: 'Mabait',                       emoji: '🥰', level: 2, category_id: 17, type: 'word',     speaker: 'helper',  tags: 'care', usage_note: 'Said to a child, or affectionately to an elderly person you are close to. To a stranger it can sound patronising.' },
  { id: 109, cantonese: '唔緊要',      jyutping: 'm4 gan2 jiu3',            english: 'Never mind',             tagalog: 'Ayos lang, walang problema',       emoji: '🤷', level: 2, category_id: 17, type: 'phrase',   speaker: 'helper',  scenario_id: 7, tags: 'reassurance' },
  { id: 110, cantonese: '你好叻',      jyutping: 'nei5 hou2 lek1',          english: "You're doing well",      tagalog: 'Ang galing mo',                    emoji: '👏', level: 2, category_id: 17, type: 'phrase',   speaker: 'helper',  tags: 'encouragement' },
  { id: 111, cantonese: '你嘅女打嚟',  jyutping: 'nei5 ge3 neoi2 daa2 lai4', english: 'Your daughter called',  tagalog: 'Tumawag ang anak mong babae',      emoji: '📞', level: 3, category_id: 17, type: 'sentence', speaker: 'helper',  scenario_id: 5, tags: 'reporting,family' },
  { id: 112, cantonese: '陣間就返嚟',  jyutping: 'zan6 gaan1 zau6 faan1 lai4', english: "She'll be back soon",  tagalog: 'Babalik din siya agad',            emoji: '⏳', level: 3, category_id: 17, type: 'sentence', speaker: 'helper',  scenario_id: 7, tags: 'reassurance' },

  // ---- 10 · Safety — emergency expansion --------------------------------
  { id: 113, cantonese: '救命',        jyutping: 'gau3 meng6',              english: 'Help!',                  tagalog: 'Saklolo!',                         emoji: '🆘', level: 1, category_id: 10, type: 'phrase',   speaker: 'either',  scenario_id: 6, tags: 'emergency', usage_note: 'Shout it. This is the one phrase to know before all others.', example_yue: '救命呀！', example_jyutping: 'gau3 meng6 aa3', example_en: 'Help!' },
  { id: 114, cantonese: '叫白車',      jyutping: 'giu3 baak6 ce1',          english: 'Call an ambulance',      tagalog: 'Tumawag ng ambulansya',            emoji: '🚑', level: 2, category_id: 10, type: 'phrase',   speaker: 'helper',  scenario_id: 6, tags: 'emergency,imperative', usage_note: '白車 ("white car") is the everyday word for an ambulance in Hong Kong.' },
  { id: 115, cantonese: '打電話',      jyutping: 'daa2 din6 waa2',          english: 'Make a phone call',      tagalog: 'Tumawag',                          emoji: '📱', level: 1, category_id: 10, type: 'phrase',   speaker: 'either',  scenario_id: 6, tags: 'emergency' },
  { id: 116, cantonese: '跌親',        jyutping: 'dit3 can1',               english: 'Fell down',              tagalog: 'Natumba',                          emoji: '🩹', level: 2, category_id: 10, type: 'phrase',   speaker: 'elderly', scenario_id: 6, tags: 'emergency,reporting' },
  { id: 117, cantonese: '唔好郁',      jyutping: 'm4 hou2 juk1',            english: "Don't move",             tagalog: 'Huwag kang gumalaw',               emoji: '✋', level: 2, category_id: 10, type: 'phrase',   speaker: 'helper',  scenario_id: 6, tags: 'emergency,imperative' },
  { id: 118, cantonese: '火警',        jyutping: 'fo2 ging2',               english: 'Fire',                   tagalog: 'Sunog',                            emoji: '🔥', level: 1, category_id: 10, type: 'word',     speaker: 'either',  scenario_id: 6, tags: 'emergency' },
  { id: 119, cantonese: '婆婆跌親',    jyutping: 'po4 po2 dit3 can1',       english: 'Grandma fell',           tagalog: 'Natumba si Lola',                  emoji: '🚨', level: 3, category_id: 10, type: 'sentence', speaker: 'helper',  scenario_id: 6, tags: 'emergency,reporting' },
  { id: 120, cantonese: '佢呼吸唔到',  jyutping: 'keoi5 fu1 kap1 m4 dou3',  english: "She can't breathe",      tagalog: 'Hindi siya makahinga',             emoji: '😰', level: 3, category_id: 10, type: 'sentence', speaker: 'helper',  scenario_id: 6, tags: 'emergency,reporting' },

  // ---- Coverage top-up (v3): every category needs at least 5 words --------
  // Five categories were below five: Greetings 4, Cleaning 3, Shopping 4,
  // Weather 2, Home 4. These twelve take each of them to 6 or better.
  //
  // They are deliberately not filler. Every one is something a carer either
  // says or hears in a normal week — 早晨 to the family, 倒垃圾 in the evening,
  // 帶遮 before she takes the elderly person out — so the quota is met by
  // content that earns its place rather than by padding the thin categories.
  //
  // Marked draft by the rule below, like the rest of the machine-drafted set.
  //   Greetings 4→6 · Cleaning 3→5 · Shopping 4→6 · Weather 2→6 · Home 4→6
  { id: 121, cantonese: '早晨',       jyutping: 'zou2 san4',              english: 'Good morning',           tagalog: 'Magandang umaga',              emoji: '🌅', level: 1, category_id: 1,  type: 'word',   speaker: 'helper',  tags: 'greeting' },
  { id: 122, cantonese: '早唞',       jyutping: 'zou2 tau2',              english: 'Good night',             tagalog: 'Magandang gabi',               emoji: '🌙', level: 1, category_id: 1,  type: 'word',   speaker: 'helper',  tags: 'greeting' },
  { id: 123, cantonese: '抹枱',       jyutping: 'maat3 toi2',             english: 'Wipe the table',         tagalog: 'Punasan ang mesa',             emoji: '🧽', level: 2, category_id: 4,  type: 'word',   speaker: 'helper',  tags: 'imperative,cleaning' },
  { id: 124, cantonese: '倒垃圾',     jyutping: 'dou2 laap6 saap3',       english: 'Take out the rubbish',   tagalog: 'Itapon ang basura',            emoji: '🗑️', level: 2, category_id: 4,  type: 'word',   speaker: 'helper',  tags: 'imperative,cleaning' },
  { id: 125, cantonese: '幾多錢',     jyutping: 'gei2 do1 cin2',          english: 'How much is it?',        tagalog: 'Magkano?',                     emoji: '💰', level: 2, category_id: 7,  type: 'phrase', speaker: 'helper',  tags: 'question,shopping' },
  { id: 126, cantonese: '平啲得唔得', jyutping: 'peng4 di1 dak1 m4 dak1', english: 'Can it be cheaper?',     tagalog: 'Puwede bang mas mura?',        emoji: '💬', level: 3, category_id: 7,  type: 'sentence', speaker: 'helper', tags: 'question,shopping' },
  { id: 127, cantonese: '好熱',       jyutping: 'hou2 jit6',              english: "It's very hot",          tagalog: 'Napakainit',                   emoji: '🌡️', level: 1, category_id: 8,  type: 'word',   speaker: 'either',  tags: 'weather' },
  { id: 128, cantonese: '好凍',       jyutping: 'hou2 dung3',             english: "It's very cold",         tagalog: 'Napakalamig',                  emoji: '🥶', level: 1, category_id: 8,  type: 'word',   speaker: 'either',  tags: 'weather' },
  { id: 129, cantonese: '打風',       jyutping: 'daa2 fung1',             english: 'A typhoon is coming',    tagalog: 'May bagyo',                    emoji: '🌀', level: 2, category_id: 8,  type: 'word',   speaker: 'either',  tags: 'weather,safety' },
  { id: 130, cantonese: '帶遮',       jyutping: 'daai3 ze1',              english: 'Bring an umbrella',      tagalog: 'Magdala ng payong',            emoji: '☂️', level: 2, category_id: 8,  type: 'word',   speaker: 'elderly', tags: 'weather,instruction' },
  { id: 131, cantonese: '開門',       jyutping: 'hoi1 mun4',              english: 'Open the door',          tagalog: 'Buksan ang pinto',             emoji: '🚪', level: 3, category_id: 9,  type: 'word',   speaker: 'either',  tags: 'imperative,home' },
  { id: 132, cantonese: '開窗',       jyutping: 'hoi1 coeng1',            english: 'Open the window',        tagalog: 'Buksan ang bintana',           emoji: '🪟', level: 2, category_id: 9,  type: 'word',   speaker: 'either',  tags: 'imperative,home' },

  // ---- 18 · Restaurant (v4): taking the elderly person out to eat ---------
  // Ten entries for one of the most ordinary things a carer does — dim sum,
  // a tea house, a quick lunch. Deliberately a mix of the two directions the
  // app cares about: what the waiter or the elderly person says TO her
  // (comprehension), and the handful of phrases she must produce herself
  // (ordering, asking, paying). Level 1-3 so the set works at every stage,
  // and the type spread (word / phrase / sentence) keeps the picture quiz
  // supplied — generateQuestions narrows match_picture to type='word', so at
  // least four words are here on purpose (點心, 茶, 埋單, 辣).
  { id: 133, cantonese: '點心',    jyutping: 'dim2 sam1',              english: 'Dim sum',                tagalog: 'Dim sum',                       emoji: '🥟', level: 1, category_id: 18, type: 'word',     speaker: 'either',  tags: 'food,restaurant' },
  { id: 134, cantonese: '飲茶',    jyutping: 'jam2 caa4',              english: 'Go for dim sum (lit. drink tea)', tagalog: 'Mag-dim sum',           emoji: '🍵', level: 1, category_id: 18, type: 'word',     speaker: 'either',  tags: 'food,restaurant', usage_note: 'Not just "drink tea" — 去飲茶 is the everyday phrase for going out for dim sum.' },
  { id: 135, cantonese: '茶',      jyutping: 'caa4',                   english: 'Tea',                    tagalog: 'Tsa',                           emoji: '🫖', level: 1, category_id: 18, type: 'word',     speaker: 'either',  tags: 'drink,restaurant' },
  { id: 136, cantonese: '辣',      jyutping: 'laat6',                  english: 'Spicy',                  tagalog: 'Maanghang',                     emoji: '🌶️', level: 1, category_id: 18, type: 'word',     speaker: 'either',  tags: 'taste,restaurant' },
  { id: 137, cantonese: '唔辣',    jyutping: 'm4 laat6',               english: 'Not spicy',              tagalog: 'Hindi maanghang',               emoji: '🙂', level: 2, category_id: 18, type: 'phrase',   speaker: 'helper',  tags: 'taste,restaurant,request' },
  { id: 138, cantonese: '唔要葱',  jyutping: 'm4 jiu3 cung1',          english: 'No spring onion',        tagalog: 'Walang sibuyas na mura',        emoji: '🧅', level: 2, category_id: 18, type: 'phrase',   speaker: 'helper',  tags: 'request,restaurant' },
  { id: 139, cantonese: '唔該埋單', jyutping: 'm4 goi1 maai4 daan1',    english: 'The bill, please',       tagalog: 'Pakisuyo, ang bayad',           emoji: '🧾', level: 2, category_id: 18, type: 'phrase',   speaker: 'helper',  tags: 'request,restaurant,payment' },
  { id: 140, cantonese: '埋單',    jyutping: 'maai4 daan1',            english: 'Pay the bill',           tagalog: 'Magbayad ng bayarin',           emoji: '💰', level: 2, category_id: 18, type: 'word',     speaker: 'helper',  tags: 'payment,restaurant' },
  { id: 141, cantonese: '要唔要茶', jyutping: 'jiu3 m4 jiu3 caa4',      english: 'Would you like tea?',    tagalog: 'Gusto mo ba ng tsa?',           emoji: '🫖', level: 3, category_id: 18, type: 'sentence', speaker: 'either',  scenario_id: 2, tags: 'question,restaurant' },
  { id: 142, cantonese: '想要啲咩', jyutping: 'soeng2 jiu3 di1 me1',   english: 'What would you like?',   tagalog: 'Ano ang gusto mo?',             emoji: '🤲', level: 3, category_id: 18, type: 'sentence', speaker: 'either',  scenario_id: 2, tags: 'question,restaurant' },

  // ---- category 19: Festivals ----------------------------------------------
  //
  // Hong Kong's public-holiday calendar is dense and it is a WORK surface for
  // her: every festival changes what is in the flat, what is forbidden, what
  // must be bought, and what the employer says to her that morning. The words
  // are useless learned in the wrong week, which is why they are gathered in
  // one category that the landing page can name when the festival approaches
  // (see seo.js → FESTIVALS).
  //
  // THE SHAPE. Words (the things a festival is made of — the bun, the packet,
  // the boat), keywords (the set phrases that are said AS the festival), and
  // sentences (the two or three things she has to be able to say). Six of each
  // so the quiz has a pool at every level: generateQuestions needs 4.

  // --- level 1: the things themselves ---
  { id: 181, cantonese: '農曆新年', jyutping: 'nung4 lik6 san1 nin2', english: 'Lunar New Year', tagalog: 'Bagong Taon ng Tsino', emoji: '🎆', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,lny,date' },
  { id: 182, cantonese: '中秋節',   jyutping: 'zung1 cau1 zit3',     english: 'Mid-Autumn Festival', tagalog: 'Pistang Mid-Autumn', emoji: '🥮', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,moon,date' },
  { id: 183, cantonese: '端午節',   jyutping: 'dyun1 ng5 zit3',      english: 'Dragon Boat Festival', tagalog: 'Pistang Dragon Boat', emoji: '🐉', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,boat,date' },
  { id: 184, cantonese: '利是',     jyutping: 'lai6 si6',            english: 'Red packet (lucky money)', tagalog: 'Red packet', emoji: '🧧', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,lny,money' },
  { id: 185, cantonese: '年糕',     jyutping: 'nin2 gou1',           english: 'New Year cake', tagalog: 'Nian gao', emoji: '🍡', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,lny,food' },
  { id: 186, cantonese: '月餅',     jyutping: 'jyut6 beng2',         english: 'Mooncake', tagalog: 'Mooncake', emoji: '🥮', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,moon,food' },
  { id: 187, cantonese: '燈籠',     jyutping: 'dang1 lung4',         english: 'Lantern', tagalog: 'Parol', emoji: '🏮', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,moon,object' },
  { id: 188, cantonese: '粽',       jyutping: 'zung3',               english: 'Rice dumpling (zongzi)', tagalog: 'Zongzi', emoji: '🍙', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,boat,food' },
  { id: 189, cantonese: '煙花',     jyutping: 'jin1 faa1',           english: 'Fireworks', tagalog: 'Paputok', emoji: '🎇', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,lny,night' },
  { id: 190, cantonese: '平安包',   jyutping: 'ping4 on1 baau1',      english: 'Peace bun (Cheung Chau)', tagalog: 'Bun ng kapayapaan', emoji: '🍞', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,cheungchau,food' },
  { id: 191, cantonese: '團圓',     jyutping: 'tyun4 jyun4',         english: 'Reunion', tagalog: 'Pagkakabuklod', emoji: '👨‍👩‍👧', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,moon,family' },
  { id: 192, cantonese: '搶包山',   jyutping: 'coeng2 baau1 saan1',  english: 'Bun-scrambling (the Cheung Chau tower)', tagalog: 'Bun scrambling', emoji: '⛰️', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,cheungchau,event', usage_note: 'A 14-metre tower of buns, climbed at midnight on the last night of the Cheung Chau festival. The single most photographed thing in Hong Kong in May.' },

  // --- level 2: the keywords — phrases that are the festival ---
  { id: 193, cantonese: '恭喜發財', jyutping: 'gung1 hei2 faat3 coi4', english: 'Wishing you prosperity (the New Year greeting)', tagalog: 'Sana yumaman ka', emoji: '🧨', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,lny,greeting', usage_note: ' Said to almost everyone in the first two weeks. The standard reply is 恭喜發財 back — it is not hierarchical.' },
  { id: 194, cantonese: '新年快樂', jyutping: 'san1 nin2 faai3 lok6',  english: 'Happy New Year', tagalog: 'Maligayang Bagong Taon', emoji: '🎊', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,lny,greeting' },
  { id: 195, cantonese: '身體健康', jyutping: 'san1 tai2 gin6 hong1',  english: 'Good health', tagalog: 'Mabuhay nang malusog', emoji: '💪', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,lny,greeting' },
  { id: 196, cantonese: '快高長大', jyutping: 'faai3 gou1 coeng4 daai6', english: 'Grow up fast and tall (said to children)', tagalog: 'Mabilis lumaki', emoji: '🧒', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,lny,children' },
  { id: 197, cantonese: '逗利是',   jyutping: 'dau3 lai6 si6',       english: 'To collect red packets', tagalog: 'Manghingi ng red packet', emoji: '🧧', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,lny,money' },
  { id: 198, cantonese: '派利是',   jyutping: 'paai3 lai6 si6',      english: 'To hand out red packets', tagalog: 'Magbigay ng red packet', emoji: '💸', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,lny,money', usage_note: 'The married give to the unmarried and to staff. As a helper she is on the receiving side, from the family and from married friends.' },
  { id: 199, cantonese: '拜年',     jyutping: 'baai3 nin2',          english: 'New Year visits', tagalog: 'Panggugulo sa bahay-bahay', emoji: '🙇', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,lny,visit' },
  { id: 200, cantonese: '買年花',   jyutping: 'maai5 nin4 faa1',     english: 'Buy New Year flowers', tagalog: 'Bumili ng bulaklak', emoji: '🌸', level: 2, category_id: 19, type: 'word', speaker: 'helper', tags: 'festival,lny,shopping' },
  { id: 201, cantonese: '行花市',   jyutping: 'haang4 faa1 si5',     english: 'Walk the flower market', tagalog: 'Pumunta sa palengke ng bulaklak', emoji: '🛍️', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,lny,event' },
  { id: 202, cantonese: '賞月',     jyutping: 'soeng2 jyut6',        english: 'Look at the full moon', tagalog: 'Manood ng buwan', emoji: '🌕', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,moon,night' },
  { id: 203, cantonese: '拜神',     jyutping: 'baai3 san4',          english: 'Worship the gods', tagalog: 'Sumamba sa diyos', emoji: '🕯️', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,religion,altar', usage_note: 'What the household does at the altar on the first and fifteenth of most lunar months. She may be asked to help lay out the fruit, never to move anything already there.' },
  { id: 204, cantonese: '燒衣',     jyutping: 'siu1 ji1',            english: 'Burn paper offerings', tagalog: 'Magsunog ng papel na alay', emoji: '🔥', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,ghost,outdoor', usage_note: 'Done outdoors, in a tin or a marked spot, during the Hungry Ghost month. Ashes and paper left in the street are offerings, not litter.' },

  // --- level 3: the sentences she has to be able to say ---
  { id: 205, cantonese: '恭喜發財，恭喜發財', jyutping: 'gung1 hei2 faat3 coi4, gung1 hei2 faat3 coi4', english: 'Wishing you prosperity! (to everyone, in turn)', tagalog: 'Sana yumaman ka, sana yumaman ka', emoji: '🧧', level: 3, category_id: 19, type: 'sentence', speaker: 'helper', tags: 'festival,lny,greeting' },
  { id: 206, cantonese: '今年有咩節日？', jyutping: 'gam1 nin2 jau5 me1 zit3 jat6', english: 'What festivals are there this year?', tagalog: 'Anong pista ang mayroon ngayong taon?', emoji: '📅', level: 3, category_id: 19, type: 'sentence', speaker: 'helper', tags: 'festival,question,planning' },
  { id: 207, cantonese: '我要去唔去拜年？', jyutping: 'ngo5 jiu3 hei3 m4 hei3 baai3 nin2', english: 'Should I go on the New Year visits?', tagalog: 'Dapat ba akong sumama sa panggugulo?', emoji: '🚶', level: 3, category_id: 19, type: 'sentence', speaker: 'helper', tags: 'festival,lny,question' },
  { id: 208, cantonese: '邊個派利是俾你？', jyutping: 'bin1 go3 paai3 lai6 si6 bei2 nei5', english: 'Who gives you a red packet?', tagalog: 'Sino ang nagbibigay sa iyo ng red packet?', emoji: '🧧', level: 3, category_id: 19, type: 'sentence', speaker: 'either', tags: 'festival,lny,question' },
  { id: 209, cantonese: '中秋節食月餅，你去唔去？', jyutping: 'zung1 cau1 zit3 sik6 jyut6 beng2, nei5 hei3 m4 hei3', english: 'We eat mooncakes at Mid-Autumn — are you coming?', tagalog: 'Kumakain ng mooncake sa Mid-Autumn, sasama ka ba?', emoji: '🥮', level: 3, category_id: 19, type: 'sentence', speaker: 'either', tags: 'festival,moon,invitation' },
  { id: 210, cantonese: '今晚去邊度賞月？', jyutping: 'gam1 maan5 heoi3 bin1 dou6 soeng2 jyut6', english: 'Where are we going to see the moon tonight?', tagalog: 'Saan tayo manonood ng buwan ngayong gabi?', emoji: '🌕', level: 3, category_id: 19, type: 'sentence', speaker: 'either', tags: 'festival,moon,question' },
  { id: 211, cantonese: '端午節有龍舟比賽', jyutping: 'dyun1 ng5 zit3 jau5 lung4 zau1 bei2 coi3', english: 'There are dragon-boat races at Dragon Boat Festival', tagalog: 'May karera ng dragon boat sa Dragon Boat Festival', emoji: '🐉', level: 3, category_id: 19, type: 'sentence', speaker: 'either', tags: 'festival,boat,information' },
  { id: 212, cantonese: '呢排係盂蘭，唔好亂扔嘢', jyutping: 'ni1 paai4 hai6 jyu4 laan4, m4 hou2 lyun6 waak6 je5', english: "It's Hungry Ghost month now — don't throw things around", tagalog: 'Buwan ng Hungry Ghost ngayon, huwag magtapon nang walang pakundangan', emoji: '👻', level: 3, category_id: 19, type: 'sentence', speaker: 'either', tags: 'festival,ghost,rule' },
  { id: 213, cantonese: '開工喇，恭喜發財', jyutping: 'hoi1 gung1 laa3, gung1 hei2 faat3 coi4', english: "You're back at work — wishing you prosperity", tagalog: 'Bumalik ka na sa trabaho, sana yumaman ka', emoji: '🧨', level: 3, category_id: 19, type: 'sentence', speaker: 'either', tags: 'festival,lny,greeting' },
  { id: 214, cantonese: '記得攞利是', jyutping: 'gei3 dak1 lo2 lai6 si6', english: 'Remember to collect your red packet', tagalog: 'Tandaan kunin ang red packet mo', emoji: '🧧', level: 3, category_id: 19, type: 'sentence', speaker: 'either', tags: 'festival,lny,reminder' },
  { id: 215, cantonese: '今晚有煙花睇', jyutping: 'gam1 maan5 jau5 jin1 faa1 tai2', english: "There are fireworks tonight", tagalog: 'May paputok mamayang gabi', emoji: '🎆', level: 3, category_id: 19, type: 'sentence', speaker: 'either', tags: 'festival,lny,night' },
  { id: 216, cantonese: '去唔去長洲睇太平清醮？', jyutping: 'heoi3 m4 heoi3 coeng4 zau1 tai2 taai3 ping4 cing1 ziu3', english: 'Are you going to Cheung Chau for the Bun Festival?', tagalog: 'Pupunta ka ba sa Cheung Chau para sa Bun Festival?', emoji: '🏝️', level: 3, category_id: 19, type: 'sentence', speaker: 'either', tags: 'festival,cheungchau,invitation' },

  // ---- v8: the festivals that had NO vocabulary of their own ---------------
  //
  // The first 36 entries covered Lunar New Year, Mid-Autumn, Dragon Boat, the
  // Cheung Chau buns and the Hungry Ghost month. Five of the ten events in
  // seo.js → HK_FESTIVALS had nothing: Ching Ming, Buddha's Birthday,
  // Chongyang, Winter Solstice and Christmas. That gap was not visible until
  // the landing-page banner started naming the next festival, and then it was
  // very visible — the banner carried one hard-coded array of New Year
  // greetings and printed 恭喜發財 under a Chongyang heading.
  //
  // The fix has two halves and this is the content half: every festival in the
  // table now has words a learner can actually be taught, tagged with the
  // festival key (`chingming`, `chongyang`, …) so the banner's curated list and
  // this set can be checked against each other. `posts-test.js` asserts that
  // every word the banner shows exists here in category 19.
  //
  // Three of these are work-surface words rather than decoration: 拜山 is what
  // the family calls the Ching Ming outing, 做冬 is the solstice dinner she
  // will be asked to cook for, and 敬老 is why the employer's parents visit on
  // Chongyang.

  // --- level 1: the day, and the things it is made of ---
  { id: 217, cantonese: '清明節', jyutping: 'cing1 ming4 zit3', english: 'Ching Ming Festival (grave-sweeping day)', tagalog: 'Pistang Ching Ming', emoji: '🪦', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,chingming,date', usage_note: 'A public holiday in early April. The whole family goes to the grave together, tidies it, and leaves flowers and food.' },
  { id: 218, cantonese: '拜山', jyutping: 'baai3 saan1', english: 'Visit the family grave (literally "worship the mountain")', tagalog: 'Bisitahin ang libingan', emoji: '🪦', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,chingming,event', usage_note: 'The everyday Cantonese for the Ching Ming and Chongyang grave visit. 掃墓 is the same act in written Chinese; nobody says it out loud.' },
  { id: 219, cantonese: '佛誕', jyutping: 'fat6 daan3', english: "Buddha's Birthday", tagalog: 'Kaarawan ni Buddha', emoji: '🪷', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,buddha,date', usage_note: 'A public holiday in May. Devout households go to the temple and bathe a small statue of the infant Buddha.' },
  { id: 220, cantonese: '蓮花', jyutping: 'lin4 faa1', english: 'Lotus flower', tagalog: 'Bulaklak ng lotus', emoji: '🪷', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,buddha,object' },
  { id: 221, cantonese: '重陽節', jyutping: 'cung4 joeng4 zit3', english: 'Chongyang Festival (Double Ninth)', tagalog: 'Pistang Chongyang', emoji: '⛰️', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,chongyang,date', usage_note: 'The ninth day of the ninth lunar month, a public holiday. The custom is to climb a hill — and, in Hong Kong, to sweep the grave a second time in the year.' },
  { id: 222, cantonese: '菊花', jyutping: 'guk1 faa1', english: 'Chrysanthemum', tagalog: 'Bulaklak na chrysanthemum', emoji: '🌼', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,chongyang,object', usage_note: 'The flower of the ninth month, so it belongs to Chongyang. Also the flower left at a grave — which is why it is not a flower you give someone for a birthday.' },
  { id: 223, cantonese: '冬至', jyutping: 'dung1 zi3', english: 'Winter Solstice', tagalog: 'Winter Solstice', emoji: '🥟', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,wintersolstice,date', usage_note: 'A public holiday in late December, and in Cantonese families a bigger meal than New Year. The saying is 冬大過年 — the solstice outranks the new year.' },
  { id: 224, cantonese: '湯圓', jyutping: 'tong1 jyun2', english: 'Glutinous rice balls in sweet soup', tagalog: 'Bilog na malagkit sa matamis na sabaw', emoji: '🍡', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,wintersolstice,food', usage_note: 'Round, so they mean 團圓 — the family being complete. Served at the solstice and at Mid-Autumn.' },
  { id: 225, cantonese: '聖誕節', jyutping: 'sing3 daan3 zit3', english: 'Christmas', tagalog: 'Pasko', emoji: '🎄', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,christmas,date', usage_note: 'A public holiday on 25 and 26 December, and the one festival in this list that is not Chinese. Decorations go up in the shops from November.' },
  { id: 226, cantonese: '聖誕樹', jyutping: 'sing3 daan3 syu6', english: 'Christmas tree', tagalog: 'Puno ng Pasko', emoji: '🎄', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,christmas,object' },
  { id: 227, cantonese: '禮物', jyutping: 'lai5 mat6', english: 'Present, gift', tagalog: 'Regalo', emoji: '🎁', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,christmas,object' },
  { id: 228, cantonese: '盂蘭節', jyutping: 'jyu4 laan4 zit3', english: 'Hungry Ghost Festival', tagalog: 'Pistang Hungry Ghost', emoji: '👻', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,hungryghost,date', usage_note: 'The seventh lunar month, when the dead are said to walk. Not a public holiday — the flat is simply quieter for a month.' },

  // --- level 2: what she is asked to do ---
  { id: 229, cantonese: '掃墓', jyutping: 'sou3 mou6', english: 'Sweep and tidy the grave', tagalog: 'Maglinis ng libingan', emoji: '🧹', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,chingming,event' },
  { id: 230, cantonese: '上香', jyutping: 'soeng5 hoeng1', english: 'Offer incense', tagalog: 'Magsindi ng insenso', emoji: '🪔', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,altar,event', usage_note: 'Three sticks, held in both hands, bowed three times. At the temple and at the home altar on every festival morning.' },
  { id: 231, cantonese: '食齋', jyutping: 'sik6 zaai1', english: 'Eat vegetarian (for the day)', tagalog: 'Kumain ng gulay lang', emoji: '🥗', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,buddha,food', usage_note: "On Buddha's Birthday and the first and fifteenth of the lunar month, many households eat no meat at all. She may be asked to cook it." },
  { id: 232, cantonese: '登高', jyutping: 'dang1 gou1', english: 'Climb a hill', tagalog: 'Umakyat sa bundok', emoji: '⛰️', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,chongyang,event', usage_note: 'The Chongyang custom, and the reason it is a day off: the family goes up a hill, often with a picnic.' },
  { id: 233, cantonese: '敬老', jyutping: 'ging3 lou5', english: 'Respect the elderly', tagalog: 'Igalang ang matatanda', emoji: '👵', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,chongyang,custom', usage_note: 'The other half of Chongyang — it is also Senior Citizens Day, so the employer\'s parents may visit and there will be a lunch.' },
  { id: 234, cantonese: '做冬', jyutping: 'zou6 dung1', english: 'Have the Winter Solstice family dinner', tagalog: 'Handaan sa Winter Solstice', emoji: '🍲', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,wintersolstice,event', usage_note: 'A sit-down dinner at home, often a whole chicken and a big pot of soup. The busiest cooking day of the winter for her.' },
  { id: 235, cantonese: '太平清醮', jyutping: 'taai3 ping4 cing1 ziu3', english: 'The Cheung Chau Bun Festival (a Taoist purification rite)', tagalog: 'Pistang Bun ng Cheung Chau', emoji: '🏮', level: 2, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,cheungchau,event', usage_note: 'The full name of the festival whose buns are in 平安包. For three days the island eats vegetarian.' },

  // --- level 3: the two or three things she has to be able to ask ---
  { id: 236, cantonese: '清明節要唔要去拜山？', jyutping: 'cing1 ming4 zit3 jiu3 m4 jiu3 heoi3 baai3 saan1', english: 'Do we need to go to the grave at Ching Ming?', tagalog: 'Kailangan ba nating pumunta sa libingan sa Ching Ming?', emoji: '🪦', level: 3, category_id: 19, type: 'sentence', speaker: 'helper', tags: 'festival,chingming,question' },
  { id: 237, cantonese: '重陽節我哋去登高', jyutping: 'cung4 joeng4 zit3 ngo5 dei6 heoi3 dang1 gou1', english: 'We go up the hill on Chongyang', tagalog: 'Umaakyat kami sa bundok sa Chongyang', emoji: '⛰️', level: 3, category_id: 19, type: 'sentence', speaker: 'either', tags: 'festival,chongyang,information' },
  { id: 238, cantonese: '冬至做冬，一家人食飯', jyutping: 'dung1 zi3 zou6 dung1, jat1 gaa1 jan4 sik6 faan6', english: 'At Winter Solstice the whole family has dinner together', tagalog: 'Sa Winter Solstice, sabay kumakain ang buong pamilya', emoji: '🍲', level: 3, category_id: 19, type: 'sentence', speaker: 'either', tags: 'festival,wintersolstice,information' },
  { id: 239, cantonese: '聖誕節你想去邊度？', jyutping: 'sing3 daan3 zit3 nei5 soeng2 heoi3 bin1 dou6', english: 'Where do you want to go at Christmas?', tagalog: 'Saan mo gustong pumunta sa Pasko?', emoji: '🎄', level: 3, category_id: 19, type: 'sentence', speaker: 'either', tags: 'festival,christmas,question' },

  // Appended out of id order on purpose: the Dragon Boat banner needed a third
  // word and the category had only the festival's name (端午節) and the food
  // (粽). 龍舟 is the thing the day is about, so it is the word she will hear
  // on the television all week. Ids are explicit, so sequence costs nothing.
  { id: 240, cantonese: '龍舟', jyutping: 'lung4 zau1', english: 'Dragon boat', tagalog: 'Dragon boat', emoji: '🚣', level: 1, category_id: 19, type: 'word', speaker: 'either', tags: 'festival,dragonboat,object', usage_note: 'The long boats with a dragon head and tail, raced at 端午節. The Hong Kong races are at Stanley and Aberdeen.' },

  // ---- v6: the 9 empty (category x level) combinations, filled ----------
  // Machine-drafted to the same standard and with the same caveat as Tier A.
  // Rule: no combination empty, floor 4 (generateQuestions needs a pool of 4).
  // See VOCABULARY-EXPANSION-REVIEW.md. Verify the jyutping before release.
  {id: 143,cantonese: "唔使客氣",jyutping: "m4 sai2 haak3 hei3",english: "You're welcome",tagalog: "Walang anuman",emoji: "🙇",level: 2,category_id: 1,type: "word",speaker: "helper",tags: "greeting,polite"},
  {id: 144,cantonese: "對唔住",jyutping: "deoi3 m4 zyu6",english: "Sorry",tagalog: "Pasensya na",emoji: "😔",level: 2,category_id: 1,type: "word",speaker: "helper",tags: "greeting,polite"},
  {id: 145,cantonese: "唔使",jyutping: "m4 sai2",english: "No need / You don't have to",tagalog: "Hindi na kailangan",emoji: "🙅",level: 2,category_id: 1,type: "word",speaker: "either",tags: "greeting,polite",usage_note: "The workhorse refusal. 唔使客氣 = \"you're welcome\"; bare 唔使 = \"no need\". Distinct from 唔好 (do not) — 唔使 means it is not necessary."},
  {id: 146,cantonese: "慢行",jyutping: "maan6 haang4",english: "Goodbye (to someone leaving)",tagalog: "Ingat",emoji: "🚶",level: 2,category_id: 1,type: "word",speaker: "either",tags: "greeting,farewell",usage_note: "Said TO the person leaving, the way 慢行 is used at a door or a lift. Not a literal instruction to walk slowly."},
  {id: 147,cantonese: "食咗飯未",jyutping: "sik6 zo2 faan6 mei6",english: "Have you eaten yet? (a greeting)",tagalog: "Kumain ka na ba?",emoji: "🍚",level: 2,category_id: 1,type: "word",speaker: "elderly",tags: "greeting",usage_note: "In Cantonese this is a greeting, not really a question about food. The expected answer is 食咗 (yes), not a menu."},
  {id: 148,cantonese: "唔好意思阻你",jyutping: "m4 hou2 ji3 si1 zo2 nei5",english: "Sorry to bother you",tagalog: "Pasensya na sa abala",emoji: "🙏",level: 3,category_id: 1,type: "sentence",speaker: "helper",tags: "greeting,polite"},
  {id: 149,cantonese: "有事就打電話俾我",jyutping: "jau5 si6 zau6 daa2 din6 waa2 bei2 ngo5",english: "Call me if anything happens",tagalog: "Tumawag ka sa akin kung may mangyari",emoji: "📞",level: 3,category_id: 1,type: "sentence",speaker: "helper",tags: "greeting,reporting"},
  {id: 150,cantonese: "小姐早晨",jyutping: "siu2 ze2 zou2 san4",english: "Good morning, ma'am",tagalog: "Magandang umaga, ma'am",emoji: "🌅",level: 3,category_id: 1,type: "sentence",speaker: "helper",tags: "greeting,polite",usage_note: "The address term 小姐 goes BEFORE 早晨 — the reverse of English word order. Same pattern with 先生 (Mr) and 太太 (Mrs)."},
  {id: 151,cantonese: "唔該借借",jyutping: "m4 goi1 ze3 ze3",english: "Excuse me, let me through",tagalog: "Makiray, makikiraan po",emoji: "🚶",level: 3,category_id: 1,type: "sentence",speaker: "helper",tags: "greeting,polite"},
  {id: 152,cantonese: "好多",jyutping: "hou2 do1",english: "A lot",tagalog: "Marami",emoji: "📚",level: 2,category_id: 2,type: "word",speaker: "either",tags: "quantity"},
  {id: 153,cantonese: "太少",jyutping: "taai3 siu2",english: "Too little",tagalog: "Kulang",emoji: "🤏",level: 2,category_id: 2,type: "word",speaker: "either",tags: "quantity"},
  {id: 154,cantonese: "冇問題",jyutping: "mou5 man6 tai4",english: "No problem",tagalog: "Walang problema",emoji: "👌",level: 2,category_id: 2,type: "word",speaker: "helper",tags: "reassurance"},
  {id: 155,cantonese: "等我",jyutping: "dang2 ngo5",english: "Wait for me",tagalog: "Hintayin mo ako",emoji: "✋",level: 2,category_id: 2,type: "word",speaker: "elderly",tags: "instruction"},
  {id: 156,cantonese: "等等",jyutping: "dang2 dang2",english: "Hold on a moment",tagalog: "Teka lang",emoji: "⏳",level: 2,category_id: 2,type: "word",speaker: "either",tags: "request"},
  {id: 157,cantonese: "你講咩呀",jyutping: "nei5 gong2 me1 aa3",english: "What did you say?",tagalog: "Ano ang sinabi mo?",emoji: "❓",level: 3,category_id: 2,type: "sentence",speaker: "helper",tags: "question,clarify"},
  {id: 158,cantonese: "唔該講慢啲",jyutping: "m4 goi1 gong2 maan6 di1",english: "Please speak more slowly",tagalog: "Pakisuyo, dahan-dahan",emoji: "🐌",level: 3,category_id: 2,type: "sentence",speaker: "helper",tags: "request,clarify"},
  {id: 159,cantonese: "我唔係好明",jyutping: "ngo5 m4 hai6 hou2 ming4",english: "I don't quite understand",tagalog: "Hindi ko lubos maintindihan",emoji: "🤔",level: 3,category_id: 2,type: "sentence",speaker: "helper",tags: "clarify"},
  {id: 160,cantonese: "係咁先喇",jyutping: "hai6 gam3 sin1 laa3",english: "That's all for now",tagalog: "Iyon muna",emoji: "🙆",level: 3,category_id: 2,type: "sentence",speaker: "either",tags: "closing",usage_note: "A fixed closing phrase — 係咁先喇 ends a conversation or a task. Not composable from its parts."},
  {id: 161,cantonese: "乾淨",jyutping: "gon1 zeng6",english: "Clean",tagalog: "Malinis",emoji: "✨",level: 1,category_id: 4,type: "word",speaker: "either",tags: "cleaning,state"},
  {id: 162,cantonese: "污糟",jyutping: "wu1 zou1",english: "Dirty",tagalog: "Marumi",emoji: "🧦",level: 1,category_id: 4,type: "word",speaker: "either",tags: "cleaning,state"},
  {id: 163,cantonese: "掃地",jyutping: "sou2 dei2",english: "Sweep the floor",tagalog: "Magwalis",emoji: "🧹",level: 1,category_id: 4,type: "word",speaker: "helper",tags: "imperative,cleaning"},
  {id: 164,cantonese: "抹手",jyutping: "maat3 sau2",english: "Wipe your hands",tagalog: "Punasan ang kamay",emoji: "🧻",level: 1,category_id: 4,type: "word",speaker: "elderly",tags: "instruction,hygiene"},
  {id: 165,cantonese: "媽媽",jyutping: "maa1 maa1",english: "Mummy / Mother",tagalog: "Mommy / Nanay",emoji: "👩",level: 1,category_id: 5,type: "word",speaker: "either",tags: "family"},
  {id: 166,cantonese: "爸爸",jyutping: "baa1 baa1",english: "Daddy / Father",tagalog: "Daddy / Tatay",emoji: "👨",level: 1,category_id: 5,type: "word",speaker: "either",tags: "family"},
  {id: 167,cantonese: "玩",jyutping: "waan2",english: "Play",tagalog: "Maglaro",emoji: "🪀",level: 1,category_id: 5,type: "word",speaker: "either",tags: "children"},
  {id: 168,cantonese: "喊",jyutping: "haam3",english: "Cry",tagalog: "Umiyak",emoji: "😭",level: 1,category_id: 5,type: "word",speaker: "either",tags: "children"},
  {id: 169,cantonese: "覺",jyutping: "gaau3",english: "A sleep",tagalog: "Tulog",emoji: "😴",level: 1,category_id: 6,type: "word",speaker: "either",tags: "routine"},
  {id: 170,cantonese: "衫",jyutping: "saam1",english: "Clothes",tagalog: "Damit",emoji: "👕",level: 1,category_id: 6,type: "word",speaker: "either",tags: "routine"},
  {id: 171,cantonese: "着衫",jyutping: "zoek3 saam1",english: "Put on clothes",tagalog: "Magbihis",emoji: "🧥",level: 1,category_id: 6,type: "phrase",speaker: "either",tags: "routine,instruction"},
  {id: 172,cantonese: "刷牙",jyutping: "caat3 ngaa4",english: "Brush teeth",tagalog: "Magsipilyo",emoji: "🪥",level: 1,category_id: 6,type: "word",speaker: "either",tags: "routine,hygiene"},
  {id: 173,cantonese: "菜",jyutping: "coi3",english: "Vegetables",tagalog: "Gulay",emoji: "🥬",level: 1,category_id: 7,type: "word",speaker: "either",tags: "shopping,food"},
  {id: 174,cantonese: "魚",jyutping: "jyu2",english: "Fish",tagalog: "Isda",emoji: "🐟",level: 1,category_id: 7,type: "word",speaker: "either",tags: "shopping,food"},
  {id: 175,cantonese: "肉",jyutping: "juk6",english: "Meat",tagalog: "Karne",emoji: "🥩",level: 1,category_id: 7,type: "word",speaker: "either",tags: "shopping,food"},
  {id: 176,cantonese: "生果",jyutping: "saang1 gwo2",english: "Fruit",tagalog: "Prutas",emoji: "🍎",level: 1,category_id: 7,type: "word",speaker: "either",tags: "shopping,food"},
  {id: 177,cantonese: "開",jyutping: "hoi1",english: "Open / Turn on",tagalog: "Buksan",emoji: "🔓",level: 1,category_id: 9,type: "word",speaker: "either",tags: "imperative,home"},
  {id: 178,cantonese: "閂",jyutping: "saan1",english: "Close / Shut",tagalog: "Isara",emoji: "🔒",level: 1,category_id: 9,type: "word",speaker: "either",tags: "imperative,home",usage_note: "閂 is the everyday door-and-lid verb in Cantonese; 關 appears in the seeded 關燈/關門. Worth teaching as a pair so she recognises both."},
  {id: 179,cantonese: "房",jyutping: "fong2",english: "Room",tagalog: "Kwarto",emoji: "🚪",level: 1,category_id: 9,type: "word",speaker: "either",tags: "home,place"},
  {id: 180,cantonese: "大門",jyutping: "daai6 mun4",english: "Front door",tagalog: "Pintuan",emoji: "🏠",level: 1,category_id: 9,type: "word",speaker: "either",tags: "home,place"},
  // ---- v9: Food, Fruit, Colours, Money, Counting (categories 20-24) ----
  // The five topics a helper is asked about across a table or a shop counter:
  // what is in the pot, what is in the fruit bowl, what colour the shirt is,
  // what it costs, and how many. Graded the same way as the rest of the
  // library — level 1 is a single word, level 2 a compound or a short
  // phrase, level 3 a full sentence she can say. Every new category fills
  // all three levels with at least 4 entries, so tools/vocab-coverage-test
  // stays green and every (category x level) pool can run a quiz.
  //
  // Where a word already existed elsewhere it is NOT repeated here: 菜, 魚,
  // 肉 and 生果 stay in Shopping (id 173-176), 飯 stays in Kitchen (id 10)
  // and 點心 stays in Restaurant (id 133). Food therefore carries the
  // SPECIFIC cuts and the Chinese-meal dishes instead of the general nouns.

  // -- Food: the specific meats, and what a Chinese meal is actually made of
  { id: 241, cantonese: '豬肉', jyutping: 'zyu1 juk6', english: 'Pork', tagalog: 'Karne ng baboy', emoji: '🐷', level: 1, category_id: 20, type: 'word', speaker: 'either', tags: 'food,meat,pork' },
  { id: 242, cantonese: '牛肉', jyutping: 'ngau4 juk6', english: 'Beef', tagalog: 'Karne ng baka', emoji: '🐮', level: 1, category_id: 20, type: 'word', speaker: 'either', tags: 'food,meat,beef' },
  { id: 243, cantonese: '雞肉', jyutping: 'gai1 juk6', english: 'Chicken meat', tagalog: 'Karne ng manok', emoji: '🍗', level: 1, category_id: 20, type: 'word', speaker: 'either', tags: 'food,meat,chicken' },
  { id: 244, cantonese: '蛋', jyutping: 'daan6', english: 'Egg', tagalog: 'Itlog', emoji: '🥚', level: 1, category_id: 20, type: 'word', speaker: 'either', tags: 'food,egg' },
  { id: 245, cantonese: '白飯', jyutping: 'baak6 faan6', english: 'Plain steamed rice', tagalog: 'Kanin', emoji: '🍚', level: 1, category_id: 20, type: 'word', speaker: 'either', tags: 'food,rice', usage_note: '飯 on its own means both the cooked rice and a whole meal — 食飯 is to eat, not only to eat rice. 白飯 is specifically plain steamed rice.' },
  { id: 246, cantonese: '麵', jyutping: 'min6', english: 'Noodles', tagalog: 'Pansit', emoji: '🍜', level: 1, category_id: 20, type: 'word', speaker: 'either', tags: 'food,noodles', usage_note: '麵 is noodles; 麵包 is bread. Adding 包 changes it to the baked loaf, so the two are not interchangeable.' },
  { id: 247, cantonese: '粥', jyutping: 'zuk1', english: 'Congee', tagalog: 'Lugaw', emoji: '🥣', level: 1, category_id: 20, type: 'word', speaker: 'either', tags: 'food,congee' },
  { id: 248, cantonese: '豆腐', jyutping: 'dau6 fu6', english: 'Tofu', tagalog: 'Tokwa', emoji: '🍥', level: 1, category_id: 20, type: 'word', speaker: 'either', tags: 'food,tofu' },
  { id: 249, cantonese: '蔬菜', jyutping: 'so1 coi3', english: 'Vegetables', tagalog: 'Gulay', emoji: '🥬', level: 2, category_id: 20, type: 'phrase', speaker: 'either', tags: 'food,vegetable', usage_note: 'The word on a supermarket label or a menu. 菜 alone is the everyday word, and it also means a dish of food — 啲菜 can be the vegetables or the dishes on the table.' },
  { id: 250, cantonese: '海鮮', jyutping: 'hoi2 sin1', english: 'Seafood', tagalog: 'Pagkaing-dagat', emoji: '🦐', level: 2, category_id: 20, type: 'phrase', speaker: 'either', tags: 'food,seafood' },
  { id: 251, cantonese: '燒味', jyutping: 'siu1 mei2', english: 'Cantonese roast meat', tagalog: 'Karneng inihaw', emoji: '🥩', level: 2, category_id: 20, type: 'phrase', speaker: 'either', tags: 'food,roast', usage_note: 'The Cantonese roast-meat counter: 叉燒, 燒肉 and 燒鵝 hanging in the window. One word covers the whole shop category.' },
  { id: 252, cantonese: '叉燒', jyutping: 'caa1 siu1', english: 'Char siu (barbecue pork)', tagalog: 'Char siu', emoji: '🍖', level: 2, category_id: 20, type: 'phrase', speaker: 'either', tags: 'food,roast' },
  { id: 253, cantonese: '燒肉', jyutping: 'siu1 juk6', english: 'Crispy roast pork belly', tagalog: 'Inihaw na tiyan ng baboy', emoji: '🥓', level: 2, category_id: 20, type: 'phrase', speaker: 'either', tags: 'food,roast', usage_note: 'Crispy-skinned pork belly, sold by weight at the 燒味 counter. Not the same as 叉燒, which is the red barbecue pork.' },
  { id: 254, cantonese: '白切雞', jyutping: 'baak6 cit3 gai1', english: 'Poached chicken', tagalog: 'Pinakuluang manok', emoji: '🐔', level: 2, category_id: 20, type: 'phrase', speaker: 'either', tags: 'food,chicken', usage_note: 'Poached chicken served at room temperature with ginger-scallion oil. 白切 means plain-boiled, not white-cut.' },
  { id: 255, cantonese: '蒸魚', jyutping: 'zing1 jyu2', english: 'Steamed fish', tagalog: 'Pinasingaw na isda', emoji: '🐟', level: 2, category_id: 20, type: 'phrase', speaker: 'either', tags: 'food,fish' },
  { id: 256, cantonese: '炒飯', jyutping: 'caau2 faan6', english: 'Fried rice', tagalog: 'Sinangag', emoji: '🍛', level: 2, category_id: 20, type: 'phrase', speaker: 'either', tags: 'food,rice' },
  { id: 257, cantonese: '米粉', jyutping: 'mai5 fan2', english: 'Rice vermicelli', tagalog: 'Bihon', emoji: '🍲', level: 2, category_id: 20, type: 'phrase', speaker: 'either', tags: 'food,noodles' },
  { id: 258, cantonese: '啲餸好鹹', jyutping: 'di1 sung3 hou2 haam4', english: 'The dishes are very salty', tagalog: 'Masyadong maalat ang ulam', emoji: '🧂', level: 3, category_id: 20, type: 'sentence', speaker: 'elderly', tags: 'food,taste,complaint', usage_note: '餸 is the dish eaten WITH rice — the thing on the plate, not the rice. 鹹 is salty; 甜 is sweet; 淡 is bland.' },
  { id: 259, cantonese: '幫我添碗飯', jyutping: 'bong1 ngo5 tim1 wun2 faan6', english: 'Please give me another bowl of rice', tagalog: 'Pahingi pa ng kanin', emoji: '🍚', level: 3, category_id: 20, type: 'sentence', speaker: 'elderly', tags: 'food,request' },
  { id: 260, cantonese: '我唔食牛肉', jyutping: 'ngo5 m4 sik6 ngau4 juk6', english: 'I do not eat beef', tagalog: 'Hindi ako kumakain ng baka', emoji: '🚫', level: 3, category_id: 20, type: 'sentence', speaker: 'helper', tags: 'food,preference' },
  { id: 261, cantonese: '啲菜要煮腍啲', jyutping: 'di1 coi3 jiu3 zyu2 nam4 di1', english: 'Cook the vegetables a bit softer', tagalog: 'Lutuin nang mas malambot ang gulay', emoji: '🥬', level: 3, category_id: 20, type: 'sentence', speaker: 'elderly', tags: 'food,cooking,request' },
  { id: 262, cantonese: '今晚食咩餸', jyutping: 'gam1 maan5 sik6 me1 sung3', english: 'What is for dinner tonight', tagalog: 'Ano ang ulam ngayong gabi', emoji: '🍽️', level: 3, category_id: 20, type: 'sentence', speaker: 'elderly', tags: 'food,question', usage_note: '咩 is the everyday what. 食咩餸 asks what dishes are being cooked, not what she herself will eat.' },

  // -- Fruit: the counter fruit she is sent out to buy, plus the imported ones
  { id: 263, cantonese: '橙', jyutping: 'caang2', english: 'Orange', tagalog: 'Orange', emoji: '🍊', level: 1, category_id: 21, type: 'word', speaker: 'either', tags: 'fruit', usage_note: 'The fruit and the colour share one word. 橙 as a fruit takes 個; 橙色 as a colour takes 色.' },
  { id: 264, cantonese: '蘋果', jyutping: 'ping4 gwo2', english: 'Apple', tagalog: 'Mansanas', emoji: '🍎', level: 1, category_id: 21, type: 'word', speaker: 'either', tags: 'fruit' },
  { id: 265, cantonese: '香蕉', jyutping: 'hoeng1 ziu1', english: 'Banana', tagalog: 'Saging', emoji: '🍌', level: 1, category_id: 21, type: 'word', speaker: 'either', tags: 'fruit' },
  { id: 266, cantonese: '西瓜', jyutping: 'sai1 gwaa1', english: 'Watermelon', tagalog: 'Pakwan', emoji: '🍉', level: 1, category_id: 21, type: 'word', speaker: 'either', tags: 'fruit' },
  { id: 267, cantonese: '提子', jyutping: 'tai4 zi2', english: 'Grapes', tagalog: 'Ubas', emoji: '🍇', level: 1, category_id: 21, type: 'word', speaker: 'either', tags: 'fruit' },
  { id: 268, cantonese: '芒果', jyutping: 'mong1 gwo2', english: 'Mango', tagalog: 'Mangga', emoji: '🥭', level: 1, category_id: 21, type: 'word', speaker: 'either', tags: 'fruit' },
  { id: 269, cantonese: '火龍果', jyutping: 'fo2 lung4 gwo2', english: 'Dragon fruit', tagalog: 'Dragon fruit', emoji: '🐲', level: 2, category_id: 21, type: 'phrase', speaker: 'either', tags: 'fruit' },
  { id: 270, cantonese: '奇異果', jyutping: 'kei4 ji6 gwo2', english: 'Kiwi', tagalog: 'Kiwi', emoji: '🥝', level: 2, category_id: 21, type: 'phrase', speaker: 'either', tags: 'fruit', usage_note: 'Also called 獼猴桃 in Mandarin. In Hong Kong shops the label usually says 奇異果.' },
  { id: 271, cantonese: '梨', jyutping: 'lei2', english: 'Pear', tagalog: 'Peras', emoji: '🍐', level: 2, category_id: 21, type: 'word', speaker: 'either', tags: 'fruit' },
  { id: 272, cantonese: '木瓜', jyutping: 'muk6 gwaa1', english: 'Papaya', tagalog: 'Papaya', emoji: '🍈', level: 2, category_id: 21, type: 'word', speaker: 'either', tags: 'fruit' },
  { id: 273, cantonese: '荔枝', jyutping: 'lai6 zi1', english: 'Lychee', tagalog: 'Litsiyas', emoji: '🍒', level: 2, category_id: 21, type: 'word', speaker: 'either', tags: 'fruit' },
  { id: 274, cantonese: '菠蘿', jyutping: 'bo1 lo4', english: 'Pineapple', tagalog: 'Pinya', emoji: '🍍', level: 2, category_id: 21, type: 'word', speaker: 'either', tags: 'fruit' },
  { id: 275, cantonese: '檸檬', jyutping: 'ning4 mung1', english: 'Lemon', tagalog: 'Limon', emoji: '🍋', level: 2, category_id: 21, type: 'word', speaker: 'either', tags: 'fruit' },
  { id: 276, cantonese: '士多啤梨', jyutping: 'si6 do1 be1 lei2', english: 'Strawberry', tagalog: 'Presa', emoji: '🍓', level: 2, category_id: 21, type: 'phrase', speaker: 'either', tags: 'fruit', usage_note: 'A sound-borrowed word, like many fruit names in Hong Kong Cantonese. Say it as it sounds; the characters carry no meaning.' },
  { id: 277, cantonese: '呢個橙甜唔甜', jyutping: 'ni1 go3 caang2 tim4 m4 tim4', english: 'Is this orange sweet', tagalog: 'Matamis ba ang orange na ito', emoji: '🍊', level: 3, category_id: 21, type: 'sentence', speaker: 'helper', tags: 'fruit,question', usage_note: 'The A-not-A question: verb, 唔, verb again. 甜唔甜 is the whole question, with no question word at the end.' },
  { id: 278, cantonese: '幫我切開個西瓜', jyutping: 'bong1 ngo5 cit3 hoi1 go3 sai1 gwaa1', english: 'Cut the watermelon for me', tagalog: 'Hatiin mo ang pakwan', emoji: '🔪', level: 3, category_id: 21, type: 'sentence', speaker: 'elderly', tags: 'fruit,request' },
  { id: 279, cantonese: '生果要洗乾淨先食', jyutping: 'saang1 gwo2 jiu3 sai2 gon1 zeng6 sin1 sik6', english: 'Wash the fruit before eating', tagalog: 'Hugasan ang prutas bago kainin', emoji: '🚿', level: 3, category_id: 21, type: 'sentence', speaker: 'either', tags: 'fruit,hygiene', usage_note: '先 comes AFTER the verb it governs: 洗乾淨先食 is wash it clean, then eat. The order is the reverse of English.' },
  { id: 280, cantonese: '我唔食得芒果', jyutping: 'ngo5 m4 sik6 dak1 mong1 gwo2', english: 'I cannot eat mango', tagalog: 'Hindi ako puwedeng kumain ng mangga', emoji: '⚠️', level: 3, category_id: 21, type: 'sentence', speaker: 'helper', tags: 'fruit,allergy', usage_note: '食得 is can eat; 唔食得 is cannot eat. The 得 is what turns eat into be able to eat, so this is an allergy or a restriction, not a dislike.' },

  // -- Colours: the eleven she is actually asked to fetch or to sort laundry by
  { id: 281, cantonese: '紅色', jyutping: 'hung4 sik1', english: 'Red', tagalog: 'Pula', emoji: '🔴', level: 1, category_id: 22, type: 'phrase', speaker: 'either', tags: 'colour' },
  { id: 282, cantonese: '黃色', jyutping: 'wong4 sik1', english: 'Yellow', tagalog: 'Dilaw', emoji: '🟡', level: 1, category_id: 22, type: 'phrase', speaker: 'either', tags: 'colour' },
  { id: 283, cantonese: '藍色', jyutping: 'laam4 sik1', english: 'Blue', tagalog: 'Asul', emoji: '🔵', level: 1, category_id: 22, type: 'phrase', speaker: 'either', tags: 'colour' },
  { id: 284, cantonese: '綠色', jyutping: 'luk6 sik1', english: 'Green', tagalog: 'Berde', emoji: '🟢', level: 1, category_id: 22, type: 'phrase', speaker: 'either', tags: 'colour' },
  { id: 285, cantonese: '黑色', jyutping: 'hak1 sik1', english: 'Black', tagalog: 'Itim', emoji: '⚫', level: 1, category_id: 22, type: 'phrase', speaker: 'either', tags: 'colour' },
  { id: 286, cantonese: '白色', jyutping: 'baak6 sik1', english: 'White', tagalog: 'Puti', emoji: '⚪', level: 1, category_id: 22, type: 'phrase', speaker: 'either', tags: 'colour' },
  { id: 287, cantonese: '橙色', jyutping: 'caang2 sik1', english: 'Orange (colour)', tagalog: 'Kahel', emoji: '🟠', level: 1, category_id: 22, type: 'phrase', speaker: 'either', tags: 'colour' },
  { id: 288, cantonese: '粉紅色', jyutping: 'fan2 hung4 sik1', english: 'Pink', tagalog: 'Rosas', emoji: '🌸', level: 2, category_id: 22, type: 'phrase', speaker: 'either', tags: 'colour' },
  { id: 289, cantonese: '紫色', jyutping: 'zi2 sik1', english: 'Purple', tagalog: 'Lila', emoji: '🟣', level: 2, category_id: 22, type: 'phrase', speaker: 'either', tags: 'colour' },
  { id: 290, cantonese: '灰色', jyutping: 'fui1 sik1', english: 'Grey', tagalog: 'Abo', emoji: '🩶', level: 2, category_id: 22, type: 'phrase', speaker: 'either', tags: 'colour' },
  { id: 291, cantonese: '啡色', jyutping: 'fe1 sik1', english: 'Brown', tagalog: 'Kayumanggi', emoji: '🟤', level: 2, category_id: 22, type: 'phrase', speaker: 'either', tags: 'colour' },
  { id: 292, cantonese: '金色', jyutping: 'gam1 sik1', english: 'Gold', tagalog: 'Ginto', emoji: '🏅', level: 2, category_id: 22, type: 'phrase', speaker: 'either', tags: 'colour' },
  { id: 293, cantonese: '銀色', jyutping: 'ngan4 sik1', english: 'Silver', tagalog: 'Pilak', emoji: '🥈', level: 2, category_id: 22, type: 'phrase', speaker: 'either', tags: 'colour' },
  { id: 294, cantonese: '呢件衫咩顏色', jyutping: 'ni1 gin6 saam1 me1 ngaan4 sik1', english: 'What colour is this shirt', tagalog: 'Anong kulay ang damit na ito', emoji: '👕', level: 3, category_id: 22, type: 'sentence', speaker: 'helper', tags: 'colour,question' },
  { id: 295, cantonese: '我鍾意藍色', jyutping: 'ngo5 zung1 ji3 laam4 sik1', english: 'I like blue', tagalog: 'Gusto ko ang asul', emoji: '💙', level: 3, category_id: 22, type: 'sentence', speaker: 'helper', tags: 'colour,preference' },
  { id: 296, cantonese: '呢隻色太深', jyutping: 'ni1 zek3 sik1 taai3 sam1', english: 'This colour is too dark', tagalog: 'Masyadong madilim ang kulay na ito', emoji: '🎨', level: 3, category_id: 22, type: 'sentence', speaker: 'elderly', tags: 'colour,opinion', usage_note: '隻 is the classifier for a colour and for one of a pair. 呢隻色 is this colour, the way 呢件衫 is this shirt.' },
  { id: 297, cantonese: '淺色定深色', jyutping: 'cin2 sik1 ding6 sam1 sik1', english: 'Light or dark', tagalog: 'Maliwanag o madilim', emoji: '🌗', level: 3, category_id: 22, type: 'phrase', speaker: 'helper', tags: 'colour,question', usage_note: '定 is the everyday or in a choice question, the way 或者 is in Mandarin. Two options, one 定 between them.' },

  // -- Money: price, change, the Octopus card, and sending it home
  { id: 298, cantonese: '錢', jyutping: 'cin2', english: 'Money', tagalog: 'Pera', emoji: '💵', level: 1, category_id: 23, type: 'word', speaker: 'either', tags: 'money' },
  { id: 299, cantonese: '蚊', jyutping: 'man1', english: 'Dollar (Hong Kong)', tagalog: 'Dolyar', emoji: '💲', level: 1, category_id: 23, type: 'word', speaker: 'either', tags: 'money,dollar', usage_note: 'The everyday word for a Hong Kong dollar — 十蚊 is ten dollars. It literally means mosquito; the two senses are unrelated, so do not read it literally.' },
  { id: 300, cantonese: '毫子', jyutping: 'hou4 zi2', english: 'Cents', tagalog: 'Sentimo', emoji: '🪙', level: 1, category_id: 23, type: 'word', speaker: 'either', tags: 'money,coins', usage_note: 'Ten cents. 五毫子 is fifty cents; 兩個毫子 is twenty cents.' },
  { id: 301, cantonese: '八達通', jyutping: 'baat3 daat6 tung1', english: 'Octopus card', tagalog: 'Octopus card', emoji: '💳', level: 1, category_id: 23, type: 'phrase', speaker: 'either', tags: 'money,transport', usage_note: 'The stored-value card used on the MTR, the buses and in most shops. She will be asked to 拍卡 (tap the card) at the till.' },
  { id: 302, cantonese: '貴', jyutping: 'gwai3', english: 'Expensive', tagalog: 'Mahal', emoji: '💸', level: 1, category_id: 23, type: 'word', speaker: 'either', tags: 'money,price' },
  { id: 303, cantonese: '平', jyutping: 'peng4', english: 'Cheap', tagalog: 'Mura', emoji: '🏷️', level: 1, category_id: 23, type: 'word', speaker: 'either', tags: 'money,price', usage_note: '平 is cheap in price, and it is also the ordinary word for flat. Context, not tone, tells them apart.' },
  { id: 304, cantonese: '找錢', jyutping: 'zaau2 cin2', english: 'Change (money handed back)', tagalog: 'Sukli', emoji: '🔄', level: 1, category_id: 23, type: 'phrase', speaker: 'either', tags: 'money,change', usage_note: 'The change handed back, and the act of giving it. 唔使找 means keep the change.' },
  { id: 305, cantonese: '俾錢', jyutping: 'bei2 cin2', english: 'To pay', tagalog: 'Magbayad', emoji: '💰', level: 2, category_id: 23, type: 'phrase', speaker: 'either', tags: 'money,pay' },
  { id: 306, cantonese: '收據', jyutping: 'sau1 geoi3', english: 'Receipt', tagalog: 'Resibo', emoji: '🧾', level: 2, category_id: 23, type: 'phrase', speaker: 'either', tags: 'money,receipt' },
  { id: 307, cantonese: '銀包', jyutping: 'ngan4 baau1', english: 'Wallet', tagalog: 'Pitaka', emoji: '👛', level: 2, category_id: 23, type: 'phrase', speaker: 'either', tags: 'money,wallet' },
  { id: 308, cantonese: '人工', jyutping: 'jan4 gung1', english: 'Salary', tagalog: 'Sahod', emoji: '💼', level: 2, category_id: 23, type: 'phrase', speaker: 'either', tags: 'money,salary', usage_note: 'The everyday word for pay. 人工 literally reads as manpower, so it does not mean wages in every context.' },
  { id: 309, cantonese: '匯錢', jyutping: 'wui6 cin2', english: 'Send money (remittance)', tagalog: 'Magpadala ng pera', emoji: '🌏', level: 2, category_id: 23, type: 'phrase', speaker: 'helper', tags: 'money,remittance' },
  { id: 310, cantonese: '銀行', jyutping: 'ngan4 hong4', english: 'Bank', tagalog: 'Bangko', emoji: '🏦', level: 2, category_id: 23, type: 'phrase', speaker: 'either', tags: 'money,bank' },
  { id: 311, cantonese: '我每個月匯錢返鄉下', jyutping: 'ngo5 mui5 go3 jyut6 wui6 cin2 faan1 hoeng1 haa2', english: 'I send money home every month', tagalog: 'Nagpapadala ako ng pera sa probinsya buwan-buwan', emoji: '🌏', level: 3, category_id: 23, type: 'sentence', speaker: 'helper', tags: 'money,remittance', usage_note: '鄉下 is the home town or home village, not a rural place in the English sense. 返鄉下 is to go back home.' },
  { id: 312, cantonese: '八達通唔夠錢', jyutping: 'baat3 daat6 tung1 m4 gau3 cin2', english: 'There is not enough money on the Octopus card', tagalog: 'Kulang ang laman ng Octopus', emoji: '💳', level: 3, category_id: 23, type: 'sentence', speaker: 'helper', tags: 'money,transport' },
  { id: 313, cantonese: '我冇散紙', jyutping: 'ngo5 mou5 saan2 zi2', english: 'I do not have small change', tagalog: 'Wala akong barya', emoji: '🪙', level: 3, category_id: 23, type: 'sentence', speaker: 'helper', tags: 'money,change', usage_note: '散紙 is small change — low-value notes or coins. 冇 is the everyday not-have, so 冇散紙 is the reason a shop cannot break a 500-dollar note.' },
  { id: 314, cantonese: '張單好似計錯咗', jyutping: 'zoeng1 daan1 hou2 ci5 gai3 co3 zo2', english: 'The bill looks like it has been added up wrong', tagalog: 'Mukhang mali ang kwenta ng bill', emoji: '🧾', level: 3, category_id: 23, type: 'sentence', speaker: 'helper', tags: 'money,bill,problem', usage_note: '單 is the bill or the order slip. 好似 is looks like; 計錯 is calculated wrong. Useful when the total is not what she expected.' },

  // -- Counting: one to ten, then the tens that Hong Kong prices are read in
  { id: 315, cantonese: '一', jyutping: 'jat1', english: 'One', tagalog: 'Isa', emoji: '1️⃣', level: 1, category_id: 24, type: 'word', speaker: 'either', tags: 'number' },
  { id: 316, cantonese: '二', jyutping: 'ji6', english: 'Two', tagalog: 'Dalawa', emoji: '2️⃣', level: 1, category_id: 24, type: 'word', speaker: 'either', tags: 'number' },
  { id: 317, cantonese: '三', jyutping: 'saam1', english: 'Three', tagalog: 'Tatlo', emoji: '3️⃣', level: 1, category_id: 24, type: 'word', speaker: 'either', tags: 'number' },
  { id: 318, cantonese: '四', jyutping: 'sei3', english: 'Four', tagalog: 'Apat', emoji: '4️⃣', level: 1, category_id: 24, type: 'word', speaker: 'either', tags: 'number', usage_note: 'Four is sei3, which sounds close to 死 (sei2, to die). That is why some buildings in Hong Kong have no fourth floor, and why 四 is handled carefully.' },
  { id: 319, cantonese: '五', jyutping: 'ng5', english: 'Five', tagalog: 'Lima', emoji: '5️⃣', level: 1, category_id: 24, type: 'word', speaker: 'either', tags: 'number', usage_note: 'The ng- initial is the hardest sound in Cantonese for most learners. It is a hum, not an n.' },
  { id: 320, cantonese: '六', jyutping: 'luk6', english: 'Six', tagalog: 'Anim', emoji: '6️⃣', level: 1, category_id: 24, type: 'word', speaker: 'either', tags: 'number' },
  { id: 321, cantonese: '七', jyutping: 'cat1', english: 'Seven', tagalog: 'Pito', emoji: '7️⃣', level: 1, category_id: 24, type: 'word', speaker: 'either', tags: 'number' },
  { id: 322, cantonese: '八', jyutping: 'baat3', english: 'Eight', tagalog: 'Walo', emoji: '8️⃣', level: 1, category_id: 24, type: 'word', speaker: 'either', tags: 'number' },
  { id: 323, cantonese: '九', jyutping: 'gau2', english: 'Nine', tagalog: 'Siyam', emoji: '9️⃣', level: 1, category_id: 24, type: 'word', speaker: 'either', tags: 'number' },
  { id: 324, cantonese: '十', jyutping: 'sap6', english: 'Ten', tagalog: 'Sampu', emoji: '🔟', level: 1, category_id: 24, type: 'word', speaker: 'either', tags: 'number', usage_note: 'Eleven to nineteen are 十一 to 十九; twenty is 二十, not 兩十. The tens stack: 二十, 三十, 四十, and colloquially 廿 for twenty.' },
  { id: 325, cantonese: '百', jyutping: 'baak3', english: 'Hundred', tagalog: 'Isandaan', emoji: '💯', level: 2, category_id: 24, type: 'word', speaker: 'either', tags: 'number' },
  { id: 326, cantonese: '千', jyutping: 'cin1', english: 'Thousand', tagalog: 'Isang libo', emoji: '🔢', level: 2, category_id: 24, type: 'word', speaker: 'either', tags: 'number' },
  { id: 327, cantonese: '萬', jyutping: 'maan6', english: 'Ten thousand', tagalog: 'Sampung libo', emoji: '🧮', level: 2, category_id: 24, type: 'word', speaker: 'either', tags: 'number', usage_note: 'Cantonese groups in tens of thousands, not thousands: 一萬 is ten thousand and 十萬 is a hundred thousand. Prices are read this way.' },
  { id: 328, cantonese: '幾多', jyutping: 'gei2 do1', english: 'How many', tagalog: 'Ilan', emoji: '❓', level: 2, category_id: 24, type: 'word', speaker: 'either', tags: 'number,question', usage_note: '幾多 asks how many or how much. 幾多錢 asks the price; 幾多個 asks the count.' },
  { id: 329, cantonese: '第一', jyutping: 'dai6 jat1', english: 'First', tagalog: 'Una', emoji: '🥇', level: 2, category_id: 24, type: 'word', speaker: 'either', tags: 'number,ordinal', usage_note: '第 in front of any number makes it an ordinal — 第一 first, 第二 second, 第三 third.' },
  { id: 330, cantonese: '一半', jyutping: 'jat1 bun3', english: 'Half', tagalog: 'Kalahati', emoji: '🍰', level: 2, category_id: 24, type: 'word', speaker: 'either', tags: 'number,fraction' },
  { id: 331, cantonese: '我要兩個', jyutping: 'ngo5 jiu3 loeng5 go3', english: 'I want two', tagalog: 'Gusto ko ng dalawa', emoji: '🖐️', level: 3, category_id: 24, type: 'sentence', speaker: 'either', tags: 'number,request', usage_note: 'Before a measure word, two is 兩, not 二. 兩個 is two of something; 二 is the number itself, used for counting and for dates.' },
  { id: 332, cantonese: '我屋企有四個人', jyutping: 'ngo5 uk1 kei2 jau5 sei3 go3 jan4', english: 'There are four people in my home', tagalog: 'Apat kami sa bahay', emoji: '👨‍👩‍👧‍👦', level: 3, category_id: 24, type: 'sentence', speaker: 'helper', tags: 'number,family', usage_note: '屋企 is home as a household, not the building. 四個人 counts people with the classifier 個.' },
  { id: 333, cantonese: '你數下有幾多個', jyutping: 'nei5 sou2 haa5 jau5 gei2 do1 go3', english: 'Count how many there are', tagalog: 'Bilangin mo kung ilan', emoji: '🔢', level: 3, category_id: 24, type: 'sentence', speaker: 'helper', tags: 'number,instruction', usage_note: '數下 is count a bit — the 下 softens the verb into a quick, casual action, the same way 睇下 is take a look.' },
  { id: 334, cantonese: '仲有一半', jyutping: 'zung6 jau5 jat1 bun3', english: 'There is still half left', tagalog: 'May natitira pang kalahati', emoji: '🌓', level: 3, category_id: 24, type: 'sentence', speaker: 'either', tags: 'number,quantity', usage_note: '仲有 is still have, and it is the ordinary way to say there is some left. 仲 also means more or even in other sentences.' },
];

/* The Tier A expansion (ids 65+) was machine-drafted and has NOT been checked
   by a native Cantonese speaker. `status` records REVIEW state, not visibility:
   marking them 'draft' means the admin can show "what still needs checking" as
   a list rather than a memory, and it is the field §8.6 turns into a filter
   once the review workflow ships.

   They are deliberately still served to learners today — hiding two thirds of
   the content would be a worse outcome than shipping it flagged. The one-line
   change that stages them is `publishedOnly: true` in the /api/vocabulary
   route. */
SEED_VOCABULARY.forEach((v) => {
  if (v.id >= 65 && v.status === undefined) v.status = 'draft';
});

/* ---------------------------------------------------------------------------
   Mandarin glosses — the meaning in Simplified Chinese.

   WHO THIS IS FOR. Not the Filipino helpers the app was built for. Hongkong
   has a second, much larger, and much newer group learning Cantonese: people
   who arrived from the mainland and already speak Mandarin. They are not
   served by an English gloss (`english`) or a Filipino one (`tagalog`), and
   the quiz engine draws its multiple-choice options from `english` — so
   without this column a Mandarin speaker would be asked to prove she
   understood a Cantonese word by picking between English words.

   WHY SIMPLIFIED. The audience reads 简体. Giving them 繁體 would recreate the
   exact reading barrier this column exists to remove.

   WHY AN OVERLAY AND NOT INLINE FIELDS. Two reasons, both practical:
     1. The translation is a separate job from the authoring. Keeping it in one
        block makes "what still needs translating" a single readable list
        instead of 132 scattered lines.
     2. `SEED_VOCABULARY` is already the canonical record; merging here means
        one source of truth for the entry and its glosses, with no ordering
        requirement between this table and the array above.
   Keyed by entry id. Every id that appears here must exist in
   SEED_VOCABULARY — asserted by tools/mandarin-sample-test.js.

   COVERAGE: every entry (142 as of v5). Ships as a complete first pass, not a
   sample.

   STATUS: drafted, not native-verified — the same caveat the Tier A entries
   carry. No Chinese-speaking reviewer has read these yet, so the Cantonese and
   the gloss both carry the usual draft risk. Kept as one overlay (below) so a
   reviewer has a single block to read rather than 132 scattered fields.

   The gloss is deliberately NOT a character-for-character rendering of the
   Cantonese. 「唔該」 is not "not should" — it is 请/劳驾, and the gloss gives the
   meaning a Mandarin speaker would actually use in that situation.

   Two rules the wording follows, because this audience already speaks Mandarin
   and does not need to be taught what a phrase means so much as what the
   Cantonese IS:
     - Prefer the natural Mandarin equivalent (「唔該」→ 请/劳驾, 「叻」→ 厉害),
       not a literal gloss of the Cantonese characters.
     - Where Cantonese and Mandarin genuinely differ, the gloss is still the
       Mandarin word for the same thing (「食藥」→ 吃药, not 食药) — so a reader
       can map what she already knows onto what she is hearing.
   --------------------------------------------------------------------------- */
const MANDARIN_GLOSSES = {
  // --- ids 1-30: the first pass (week-one words) ---
  1:  '你好',
  2:  '谢谢',
  3:  '请 / 劳驾',
  4:  '再见',
  5:  '是',
  6:  '不是',
  7:  '好',
  8:  '不好 / 不要',
  9:  '水',
  10: '饭 / 一餐',
  11: '吃',
  12: '喝',
  13: '厨房',
  14: '大',
  15: '小',
  16: '洗衣服',
  17: '做饭',
  18: '拖地',
  19: '小孩',
  20: '睡觉',
  21: '起床',
  22: '洗澡',
  23: '菜市场',
  24: '买东西',
  25: '上学',
  26: '做功课',
  27: '开灯',
  28: '关灯',
  29: '下雨',
  30: '小心',

  // --- ids 31-45: level 3 sentences and phrases (daily life, kitchen,
  //     shopping, children, weather) ---
  31: '请帮我买些菜',
  32: '孩子该睡觉了',
  33: '今天下了很大的雨',
  34: '请你拿些碗来',
  35: '我们去菜市场买东西',
  36: '孩子做完功课了吗',
  37: '厨房的碗洗了吗',
  38: '不要碰那个东西',
  39: '快点回来',
  40: '帮忙打扫客厅',
  41: '吃早饭',
  42: '喝水',
  43: '请开空调',
  44: '关门',
  45: '有什么吃的吗',

  // --- ids 46-50: elder care, level 1-2 (standing, sitting, eating, walking) ---
  46: '坐下',
  47: '吃药',
  48: '慢慢走',
  49: '今天好吗',
  50: '吃饱了吗',

  // --- ids 51-64: elder care, level 2-3 (bathing, combing, napping,
  //     reassurance, standing steady) ---
  51: '走路小心',
  52: '睡午觉',
  53: '不要起得太快',
  54: '帮你洗澡',
  55: '帮你梳头',
  56: '痛不痛',
  57: '不舒服',
  58: '等一会儿',
  59: '别担心',
  60: '别着急，慢慢来',
  61: '今天煮什么吃',
  62: '请慢慢吃',
  63: '去过洗手间了吗',
  64: '先站稳',

  // --- ids 65-72: health & symptoms ---
  65: '痛',
  66: '头痛',
  67: '咳嗽',
  68: '发烧',
  69: '头晕',
  70: '肚子痛',
  71: '哪里痛',
  72: '我很不舒服',

  // --- ids 73-80: medicine & appointments ---
  73: '药',
  74: '药丸',
  75: '药水',
  76: '诊所',
  77: '医生',
  78: '吃过药了吗',
  79: '去诊所',
  80: '什么时候复诊',

  // --- ids 81-88: mobility & walking ---
  81: '走',
  82: '站',
  83: '扶手',
  84: '轮椅',
  85: '扶着我',
  86: '慢慢来',
  87: '不要摔倒',
  88: '我扶你起来',

  // --- ids 89-96: toilet & personal care ---
  89: '洗手间',
  90: '牙刷',
  91: '毛巾',
  92: '洗脸',
  93: '换衣服',
  94: '去洗手间',
  95: '我帮你换衣服',
  96: '要不要去洗手间',

  // --- ids 97-104: meals & feeding ---
  97: '肚子饿',
  98: '饱',
  99: '胃口',
  100: '热',
  101: '冷',
  102: '多吃一点',
  103: '太热了',
  104: '没胃口',

  // --- ids 105-112: comfort & reassurance ---
  105: '别怕',
  106: '没事',
  107: '我在这儿',
  108: '乖',
  109: '没关系',
  110: '你真棒',
  111: '你女儿打来了',
  112: '她很快就回来',

  // --- ids 113-120: safety & emergencies ---
  113: '救命',
  114: '叫救护车',
  115: '打电话',
  116: '摔倒了',
  117: '不要动',
  118: '火警',
  119: '婆婆摔倒了',
  120: '她不能呼吸',

  // --- ids 121-132: the v3 coverage top-up (greetings, cleaning, shopping,
  //     weather, home) ---
  121: '早上好',
  122: '晚安',
  123: '擦桌子',
  124: '倒垃圾',
  125: '多少钱',
  126: '便宜点行吗',
  127: '很热',
  128: '很冷',
  129: '要打台风了',
  130: '带伞',
  131: '开门',
  132: '开窗',

  // --- ids 133-142: the v4 Restaurant set (dim sum, ordering, the bill) ---
  // Natural Mandarin equivalents, not character-for-character renderings of
  // the Cantonese — 埋單 is 买单, 唔要葱 is 不要葱, and 想要啲咩 is 想要什么.
  133: '点心',
  134: '喝茶',
  135: '茶',
  136: '辣',
  137: '不辣',
  138: '不要葱',
  139: '麻烦买单',
  140: '买单',
  141: '要不要茶',
  142: '想要什么',

  // --- ids 143-180: the v6 expansion ---
  143:  '不用客气',
  144:  '对不起',
  145:  '不用',
  146:  '慢走 — 送客时说的话',
  147:  '吃饭了吗 — 这是问候，不是真的问吃饭',
  148:  '不好意思打扰你',
  149:  '有事就打电话给我',
  150:  '小姐早上好',
  151:  '请让一让',
  152:  '很多',
  153:  '太少',
  154:  '没问题',
  155:  '等我',
  156:  '等等',
  157:  '你说什么？',
  158:  '请说慢一点',
  159:  '我不太明白',
  160:  '就先这样吧 — 结束对话时的固定说法',
  161:  '干净',
  162:  '脏',
  163:  '扫地',
  164:  '擦手',
  165:  '妈妈',
  166:  '爸爸',
  167:  '玩',
  168:  '哭',
  169:  '觉 — 睡觉的觉',
  170:  '衣服',
  171:  '穿衣服',
  172:  '刷牙',
  173:  '菜',
  174:  '鱼',
  175:  '肉',
  176:  '水果',
  177:  '开',
  178:  '关 — 关门、关盖',
  179:  '房间',
  180:  '大门',
  // --- ids 181-216: the festival calendar (category 19) ---
  181:  '农历新年',
  182:  '中秋节',
  183:  '端午节',
  184:  '红包',
  185:  '年糕',
  186:  '月饼',
  187:  '灯笼',
  188:  '粽子',
  189:  '烟花',
  190:  '平安包',
  191:  '团圆',
  192:  '抢包山',
  193:  '恭喜发财',
  194:  '新年快乐',
  195:  '身体健康',
  196:  '快高长大',
  197:  '讨红包',
  198:  '发红包',
  199:  '拜年',
  200:  '买年花',
  201:  '逛花市',
  202:  '赏月',
  203:  '拜神',
  204:  '烧衣',
  205:  '恭喜发财，恭喜发财',
  206:  '今年有什么节日？',
  207:  '我要不要去拜年？',
  208:  '谁发红包给你？',
  209:  '中秋节吃月饼，你去不去？',
  210:  '今晚去哪里赏月？',
  211:  '端午节有龙舟比赛',
  212:  '现在是盂兰，不要乱扔东西',
  213:  '开工了，恭喜发财',
  214:  '记得拿红包',
  215:  '今晚有烟花看',
  216:  '去不去长洲看太平清醮？',

  // --- ids 217-239: the five festivals that had no vocabulary (v8) ---
  217:  '清明节',
  218:  '上坟',
  219:  '佛诞',
  220:  '莲花',
  221:  '重阳节',
  222:  '菊花',
  223:  '冬至',
  224:  '汤圆',
  225:  '圣诞节',
  226:  '圣诞树',
  227:  '礼物',
  228:  '盂兰节',
  229:  '扫墓',
  230:  '上香',
  231:  '吃素',
  232:  '登高',
  233:  '敬老',
  234:  '过冬至',
  235:  '太平清醮',
  236:  '清明节要不要去上坟？',
  237:  '重阳节我们去登高',
  238:  '冬至做冬，一家人吃饭',
  239:  '圣诞节你想去哪里？',
  // --- ids 241-262: food ---
  241: '猪肉',
  242: '牛肉',
  243: '鸡肉',
  244: '鸡蛋',
  245: '白饭',
  246: '面条',
  247: '粥',
  248: '豆腐',
  249: '蔬菜',
  250: '海鲜',
  251: '烧味',
  252: '叉烧',
  253: '烧肉',
  254: '白切鸡',
  255: '蒸鱼',
  256: '炒饭',
  257: '米粉',
  258: '菜太咸了',
  259: '帮我添碗饭',
  260: '我不吃牛肉',
  261: '菜要煮软一点',
  262: '今晚吃什么菜',
  // --- ids 263-280: fruit ---
  263: '橙子',
  264: '苹果',
  265: '香蕉',
  266: '西瓜',
  267: '葡萄',
  268: '芒果',
  269: '火龙果',
  270: '猕猴桃',
  271: '梨',
  272: '木瓜',
  273: '荔枝',
  274: '菠萝',
  275: '柠檬',
  276: '草莓',
  277: '这个橙子甜不甜',
  278: '帮我把西瓜切开',
  279: '水果要洗干净再吃',
  280: '我不能吃芒果',
  // --- ids 281-297: colours ---
  281: '红色',
  282: '黄色',
  283: '蓝色',
  284: '绿色',
  285: '黑色',
  286: '白色',
  287: '橙色',
  288: '粉红色',
  289: '紫色',
  290: '灰色',
  291: '棕色',
  292: '金色',
  293: '银色',
  294: '这件衣服什么颜色',
  295: '我喜欢蓝色',
  296: '这个颜色太深',
  297: '浅色还是深色',
  // --- ids 298-314: money ---
  298: '钱',
  299: '块钱',
  300: '毛钱',
  301: '八达通',
  302: '贵',
  303: '便宜',
  304: '找钱',
  305: '付钱',
  306: '收据',
  307: '钱包',
  308: '工资',
  309: '汇款',
  310: '银行',
  311: '我每个月汇款回乡下',
  312: '八达通钱不够',
  313: '我没有零钱',
  314: '账单好像算错了',
  // --- ids 315-334: counting ---
  315: '一',
  316: '二',
  317: '三',
  318: '四',
  319: '五',
  320: '六',
  321: '七',
  322: '八',
  323: '九',
  324: '十',
  325: '百',
  326: '千',
  327: '万',
  328: '多少',
  329: '第一',
  330: '一半',
  331: '我要两个',
  332: '我家有四个人',
  333: '你数一下有多少个',
  334: '还剩一半',
  240:  '龙舟',
};

SEED_VOCABULARY.forEach((v) => {
  const gloss = MANDARIN_GLOSSES[v.id];
  if (gloss && !v.mandarin) v.mandarin = gloss;
});

/* ---------------------------------------------------------------------------
   Category names in Simplified Mandarin, keyed by category id.

   Why this is a separate overlay and not `name_yue`: `name_yue` holds the
   CANTONESE name in Traditional characters — 長者照顧, 食藥覆診, 行路扶助. A
   Mandarin reader can parse those, but they are the wrong register (Cantonese
   phrasing) and in the wrong script for this audience. These are the names a
   mainland reader would actually use — 长者照顾, 吃药复诊, 走路辅助.

   Kept out of SEED_CATEGORIES* so the whole translation is one reviewable
   block, exactly like MANDARIN_GLOSSES above. Applied by a guarded UPDATE in
   db.js (categories_zh_backfilled) because the 17 rows already exist in every
   live database and migrateContent() only INSERTs.
   --------------------------------------------------------------------------- */
const CATEGORY_ZH_NAMES = {
  1:  '问候',
  2:  '常用',
  3:  '厨房',
  4:  '清洁',
  5:  '孩子',
  6:  '日常生活',
  7:  '购物',
  8:  '天气',
  9:  '家里',
  10: '安全',
  11: '照顾老人',
  12: '症状',
  13: '吃药复诊',
  14: '走路辅助',
  15: '洗漱如厕',
  16: '吃饭喂食',
  17: '安慰与鼓励',
  18: '餐厅',
  20: '食物',
  21: '水果',
  22: '颜色',
  23: '钱',
  24: '数字',
  19: '节日',
};

SEED_CATEGORIES.forEach((c) => {
  const zh = CATEGORY_ZH_NAMES[c.id];
  if (zh && !c.name_zh) c.name_zh = zh;
});

/* ---------------------------------------------------------------------------
   Indonesian glosses, keyed by vocabulary id.

   The third audience. Roughly 150,000 Indonesian domestic helpers work in Hong
   Kong — comparable to the Filipino community the app was built for — and they
   arrive with the same problem: the person they care for cannot meet them in
   English, so the Cantonese has to be understood, not produced.

   TWO RULES THE WORDING FOLLOWS

     1. This is BAHASA INDONESIA, not Malay and not Tagalog. The three are
        related, and the temptation to reuse a Tagalog gloss is real, but
        「街市」 is pasar in Indonesian and palengke in Tagalog; 「藥」 is obat, not
        gamot. A Tagalog gloss on an Indonesian screen is the bug this file
        exists to prevent, and tools/content-migration-test.js asserts the two
        columns are never identical.
     2. Everyday spoken Indonesian, not formal baku. A helper says "Hati-hati"
        and "Sudah kenyang?", not "Berhati-hatilah Anda" and "Apakah Anda sudah
        merasa kenyang". Where a formal and a colloquial form both exist, the
        gloss is the one she would actually say in the kitchen.

   MACHINE-DRAFTED — NOT YET NATIVE-REVIEWED.

   This is the same honesty the Tier A elder-care drafts and the Mandarin
   glosses shipped with: every entry has a gloss rather than a blank, and the
   whole set is flagged in `meta` (vocab_indonesian_backfilled) so it can be
   reviewed in one pass. The Cantonese itself is already verified; only the
   gloss column is new, and a wrong gloss is a correction rather than a
   correctness risk to the lessons.

   Kept out of SEED_VOCABULARY so the whole translation is one reviewable block.
   Applied by a guarded UPDATE in db.js, because the 142 rows already exist in
   every live database and migrateContent() only INSERTs.
   --------------------------------------------------------------------------- */
const INDONESIAN_GLOSSES = {
  // --- ids 1-15: the words a helper needs in her first week ---
  1:  'Halo',
  2:  'Terima kasih',
  3:  'Tolong / Permisi',
  4:  'Selamat tinggal',
  5:  'Ya',
  6:  'Tidak',
  7:  'Bagus',
  8:  'Tidak bagus / Jangan',
  9:  'Air',
  10: 'Nasi / Makanan',
  11: 'Makan',
  12: 'Minum',
  13: 'Dapur',
  14: 'Besar',
  15: 'Kecil',

  // --- ids 16-45: daily routine, the market, the weather ---
  16: 'Mencuci baju',
  17: 'Memasak',
  18: 'Mengepel lantai',
  19: 'Anak',
  20: 'Tidur',
  21: 'Bangun',
  22: 'Mandi',
  23: 'Pasar',
  24: 'Belanja',
  25: 'Pergi ke sekolah',
  26: 'Mengerjakan PR',
  27: 'Menyalakan lampu',
  28: 'Mematikan lampu',
  29: 'Hujan',
  30: 'Hati-hati',
  31: 'Tolong bantu saya beli sayur',
  32: 'Anak harus tidur sekarang',
  33: 'Hari ini hujan deras',
  34: 'Tolong bawakan mangkuk',
  35: 'Ayo pergi ke pasar belanja',
  36: 'Anak sudah selesai PR belum?',
  37: 'Mangkuk di dapur sudah dicuci belum?',
  38: 'Jangan sentuh barang itu',
  39: 'Cepat kembali',
  40: 'Bantu bersihkan ruang tamu',
  41: 'Sarapan',
  42: 'Minum air',
  43: 'Tolong nyalakan AC',
  44: 'Tutup pintu',
  45: 'Ada makanan?',

  // --- ids 46-64: elder care. The register matters most here: 「慢慢行」 is
  // encouragement to someone unsteady, so it is "Jalan pelan-pelan", not an
  // instruction. 「乖」 has no single Indonesian word — it is praise for being
  // good, given to a child or an old person, so the gloss carries both. ---
  46: 'Duduk',
  47: 'Minum obat',
  48: 'Jalan pelan-pelan',
  49: 'Bagaimana kabar Anda hari ini?',
  50: 'Sudah kenyang?',
  51: 'Hati-hati jalan',
  52: 'Tidur siang',
  53: 'Jangan bangun terlalu cepat',
  54: 'Bantu Anda mandi',
  55: 'Bantu Anda menyisir rambut',
  56: 'Sakit tidak?',
  57: 'Badan tidak enak',
  58: 'Tunggu sebentar',
  59: 'Jangan khawatir',
  60: 'Jangan buru-buru, pelan-pelan saja',
  61: 'Hari ini masak apa?',
  62: 'Tolong makan pelan-pelan',
  63: 'Sudah ke toilet belum?',
  64: 'Berdiri tegak dulu',

  // --- ids 65-80: symptoms, medicine, appointments ---
  65: 'Sakit',
  66: 'Sakit kepala',
  67: 'Batuk',
  68: 'Demam',
  69: 'Pusing',
  70: 'Sakit perut',
  71: 'Sakit di mana?',
  72: 'Badan saya sangat tidak enak',
  73: 'Obat',
  74: 'Pil',
  75: 'Obat cair',
  76: 'Klinik',
  77: 'Dokter',
  78: 'Sudah minum obat belum?',
  79: 'Pergi ke klinik',
  // "kontrol" is the ordinary Indonesian word for a follow-up medical visit;
  // "tindak lanjut" is a translation, not something anyone says.
  80: 'Kapan kontrol lagi?',

  // --- ids 81-88: mobility ---
  81: 'Jalan',
  82: 'Berdiri',
  83: 'Pegangan',
  84: 'Kursi roda',
  85: 'Pegang saya',
  86: 'Pelan-pelan saja',
  87: 'Jangan sampai jatuh',
  88: 'Saya bantu Anda bangun',

  // --- ids 89-96: toilet and personal care ---
  89: 'Toilet',
  90: 'Sikat gigi',
  91: 'Handuk',
  92: 'Cuci muka',
  93: 'Ganti baju',
  94: 'Ke toilet',
  95: 'Saya bantu Anda ganti baju',
  96: 'Mau ke toilet?',

  // --- ids 97-104: meals ---
  97: 'Lapar',
  98: 'Kenyang',
  99: 'Nafsu makan',
  100: 'Panas',
  101: 'Dingin',
  102: 'Makan lagi sedikit',
  103: 'Terlalu panas',
  104: 'Tidak ada nafsu makan',

  // --- ids 105-112: reassurance. 「冇事」 and 「唔緊要」 both land near
  // "never mind" in English; Indonesian separates them, so they are split
  // rather than duplicated. ---
  105: 'Jangan takut',
  106: 'Tidak apa-apa',
  107: 'Saya di sini',
  108: 'Baik / Penurut',
  109: 'Tidak masalah',
  110: 'Kamu hebat',
  111: 'Anak perempuan Anda menelepon',
  112: 'Dia sebentar lagi pulang',

  // --- ids 113-120: emergencies. Kept short on purpose: these are the words
  // that have to come out fast, so no gloss here is a full sentence. ---
  113: 'Tolong!',
  114: 'Panggil ambulans',
  115: 'Menelepon',
  116: 'Jatuh',
  117: 'Jangan bergerak',
  118: 'Kebakaran',
  119: 'Nenek jatuh',
  120: 'Dia tidak bisa bernapas',

  // --- ids 121-132: the coverage top-up ---
  121: 'Selamat pagi',
  // 「早唞」 is said when someone goes to bed, so it is "Selamat tidur" (sleep
  // well), not "Selamat malam" (good evening).
  122: 'Selamat tidur',
  123: 'Lap meja',
  124: 'Buang sampah',
  125: 'Berapa harganya?',
  126: 'Bisa lebih murah?',
  127: 'Panas sekali',
  128: 'Dingin sekali',
  129: 'Akan ada topan',
  130: 'Bawa payung',
  131: 'Buka pintu',
  132: 'Buka jendela',

  // --- ids 133-142: the Restaurant set ---
  133: 'Dim sum',
  134: 'Makan dim sum',
  135: 'Teh',
  136: 'Pedas',
  137: 'Tidak pedas',
  138: 'Tanpa daun bawang',
  139: 'Minta bon',
  140: 'Bayar bon',
  141: 'Mau teh?',
  142: 'Mau apa?',

  // --- ids 143-180: the v6 expansion ---
  143:  'Sama-sama',
  144:  'Maaf',
  145:  'Tidak perlu',
  146:  'Hati-hati di jalan — diucapkan saat mengantar tamu pulang',
  147:  'Sudah makan belum? — ini sapaan, bukan pertanyaan soal makan',
  148:  'Maaf mengganggu',
  149:  'Kalau ada apa-apa telepon saya',
  150:  'Selamat pagi, Bu',
  151:  'Permisi, numpang lewat',
  152:  'Banyak',
  153:  'Terlalu sedikit',
  154:  'Tidak masalah',
  155:  'Tunggu saya',
  156:  'Sebentar',
  157:  'Kamu bilang apa?',
  158:  'Tolong bicara lebih pelan',
  159:  'Saya kurang mengerti',
  160:  'Sudah, segitu dulu — penutup percakapan',
  161:  'Bersih',
  162:  'Kotor',
  163:  'Menyapu',
  164:  'Lap tangan',
  165:  'Mama / Ibu',
  166:  'Papa / Ayah',
  167:  'Bermain',
  168:  'Menangis',
  169:  'Tidur — kata benda',
  170:  'Baju / Pakaian',
  171:  'Pakai baju',
  172:  'Sikat gigi',
  173:  'Sayur',
  174:  'Ikan',
  175:  'Daging',
  176:  'Buah',
  177:  'Buka / Nyalakan',
  178:  'Tutup — pintu atau tutup wadah',
  179:  'Kamar',
  180:  'Pintu depan',
  // --- ids 181-216: the festival calendar (category 19) ---
  181:  'Tahun Baru Imlek',
  182:  'Festival Pertengahan Musim Gugur',
  183:  'Festival Perahu Naga',
  184:  'Angpao (uang keberuntungan)',
  185:  'Kue tahun baru',
  186:  'Kue bulan',
  187:  'Lampion',
  188:  'Bakcang',
  189:  'Kembang api',
  190:  'Bun perdamaian (Cheung Chau)',
  191:  'Bersatu kembali',
  192:  'Perebutan bun (menara Cheung Chau)',
  193:  'Semoga Anda maju',
  194:  'Selamat tahun baru',
  195:  'Semoga sehat selalu',
  196:  'Cepat tinggi besar (kata ke anak)',
  197:  'Meminta angpao',
  198:  'Memberi angpao',
  199:  'Kunjungan tahun baru',
  200:  'Beli bunga tahun baru',
  201:  'Keliling pasar bunga',
  202:  'Menatap bulan purnama',
  203:  'Berdoa kepada dewa',
  204:  'Bakar kertas persembahan',
  205:  'Semoga Anda maju, semoga Anda maju',
  206:  'Festival apa saja tahun ini?',
  207:  'Perlu ikut kunjungan tahun baru?',
  208:  'Siapa yang memberi angpao kepada Anda?',
  209:  'Festival Pertengahan Musim Gugur makan kue bulan, ikut?',
  210:  'Malam ini ke mana menatap bulan?',
  211:  'Festival Perahu Naga ada lomba perahu naga',
  212:  'Sekarang bulan orang lapar, jangan buang barang sembarangan',
  213:  'Mulai bekerja lagi, semoga Anda maju',
  214:  'Ingat ambil angpao',
  215:  'Malam ini ada kembang api',
  216:  'Ikut ke Cheung Chau lihat Bun Festival?',

  // --- ids 217-239: the five festivals that had no vocabulary (v8) ---
  217:  'Festival Ching Ming (hari ziarah makam)',
  218:  'Ziarah makam keluarga',
  219:  'Hari Raya Buddha',
  220:  'Bunga teratai',
  221:  'Festival Chongyang',
  222:  'Bunga krisan',
  223:  'Titik balik matahari musim dingin',
  224:  'Bola ketan dalam kuah manis',
  225:  'Natal',
  226:  'Pohon Natal',
  227:  'Hadiah',
  228:  'Festival Arwah',
  229:  'Membersihkan makam',
  230:  'Menyembah dengan dupa',
  231:  'Makan sayur saja',
  232:  'Mendaki bukit',
  233:  'Menghormati orang tua',
  234:  'Makan malam titik balik musim dingin',
  235:  'Ritual Cheung Chau Bun',
  236:  'Perlu ziarah makam saat Ching Ming?',
  237:  'Kami mendaki bukit saat Chongyang',
  238:  'Saat titik balik musim dingin, keluarga makan bersama',
  239:  'Kamu mau ke mana saat Natal?',
  // --- ids 241-262: food ---
  241: 'Daging babi',
  242: 'Daging sapi',
  243: 'Daging ayam',
  244: 'Telur',
  245: 'Nasi putih',
  246: 'Mi',
  247: 'Bubur',
  248: 'Tahu',
  249: 'Sayuran',
  250: 'Makanan laut',
  251: 'Daging panggang Kanton',
  252: 'Char siu',
  253: 'Babi panggang renyah',
  254: 'Ayam rebus',
  255: 'Ikan kukus',
  256: 'Nasi goreng',
  257: 'Bihun',
  258: 'Masakannya terlalu asin',
  259: 'Tolong tambah nasi',
  260: 'Saya tidak makan daging sapi',
  261: 'Sayurnya dimasak lebih lunak',
  262: 'Makan apa malam ini',
  // --- ids 263-280: fruit ---
  263: 'Jeruk',
  264: 'Apel',
  265: 'Pisang',
  266: 'Semangka',
  267: 'Anggur',
  268: 'Mangga',
  269: 'Buah naga',
  270: 'Kiwi',
  271: 'Pir',
  272: 'Pepaya',
  273: 'Leci',
  274: 'Nanas',
  275: 'Lemon',
  276: 'Stroberi',
  277: 'Jeruk ini manis tidak',
  278: 'Tolong potong semangka ini',
  279: 'Cuci buahnya dulu baru makan',
  280: 'Saya tidak boleh makan mangga',
  // --- ids 281-297: colours ---
  281: 'Merah',
  282: 'Kuning',
  283: 'Biru',
  284: 'Hijau',
  285: 'Hitam',
  286: 'Putih',
  287: 'Oren',
  288: 'Merah muda',
  289: 'Ungu',
  290: 'Abu-abu',
  291: 'Coklat',
  292: 'Emas',
  293: 'Perak',
  294: 'Baju ini warna apa',
  295: 'Saya suka warna biru',
  296: 'Warna ini terlalu tua',
  297: 'Warna muda atau tua',
  // --- ids 298-314: money ---
  298: 'Uang',
  299: 'Dolar',
  300: 'Sen',
  301: 'Kartu Octopus',
  302: 'Mahal',
  303: 'Murah',
  304: 'Uang kembalian',
  305: 'Bayar',
  306: 'Struk',
  307: 'Dompet',
  308: 'Gaji',
  309: 'Kirim uang',
  310: 'Bank',
  311: 'Saya kirim uang ke kampung tiap bulan',
  312: 'Saldo Octopus tidak cukup',
  313: 'Saya tidak punya uang kecil',
  314: 'Tagihannya sepertinya salah hitung',
  // --- ids 315-334: counting ---
  315: 'Satu',
  316: 'Dua',
  317: 'Tiga',
  318: 'Empat',
  319: 'Lima',
  320: 'Enam',
  321: 'Tujuh',
  322: 'Delapan',
  323: 'Sembilan',
  324: 'Sepuluh',
  325: 'Seratus',
  326: 'Seribu',
  327: 'Sepuluh ribu',
  328: 'Berapa',
  329: 'Pertama',
  330: 'Setengah',
  331: 'Saya mau dua',
  332: 'Di rumah saya ada empat orang',
  333: 'Coba hitung ada berapa',
  334: 'Masih ada setengah',
  240:  'Perahu naga',
};

SEED_VOCABULARY.forEach((v) => {
  const gloss = INDONESIAN_GLOSSES[v.id];
  if (gloss && !v.indonesian) v.indonesian = gloss;
});

/* ---------------------------------------------------------------------------
   Category names in Bahasa Indonesia, keyed by category id.

   Same reason as CATEGORY_ZH_NAMES above: kept out of SEED_CATEGORIES so the
   translation is one reviewable block, and applied by a guarded UPDATE in db.js
   (categories_id_backfilled) because the rows already exist in every live
   database.

   「照顧老人」 is MERAWAT LANSIA — lansia (lanjut usia) is the ordinary word for an
   elderly person, and it is what an Indonesian carer would call the job. --- */
const CATEGORY_ID_NAMES = {
  1:  'Salam',
  2:  'Umum',
  3:  'Dapur',
  4:  'Kebersihan',
  5:  'Anak-anak',
  6:  'Kehidupan Sehari-hari',
  7:  'Belanja',
  8:  'Cuaca',
  9:  'Rumah',
  10: 'Keselamatan',
  11: 'Merawat Lansia',
  12: 'Kesehatan & Gejala',
  13: 'Obat & Kontrol',
  14: 'Mobilitas & Berjalan',
  15: 'Toilet & Kebersihan Diri',
  16: 'Makan & Menyuapi',
  17: 'Menenangkan & Menyemangati',
  18: 'Restoran',
  20: 'Makanan',
  21: 'Buah',
  22: 'Warna',
  23: 'Uang',
  24: 'Angka',
  19: 'Hari Raya',
};

SEED_CATEGORIES.forEach((c) => {
  const id = CATEGORY_ID_NAMES[c.id];
  if (id && !c.name_id) c.name_id = id;
});

// No password is stored here, deliberately. This repository is public, so a
// committed default would be a published credential — anyone could read it and
// sign in as the operator. The password comes from the ADMIN_USER /
// ADMIN_PASSWORD environment variables instead (see db.js → syncEnvAdmin). If
// they are unset, the first run generates a random password and prints it once
// to the server log, so there is never a guessable default to fall back on.
const SEED_USERS = [
  { id: 1, username: 'admin', password: null, role: 'admin', name: 'Operator' },
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
  // Created here rather than at require time — see the note above.
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
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

/* ===========================================================================
   SEED_POSTS — the first articles in the "Discover" feed.

   These are the CULTURE channel's opening set. The news channel is not seeded;
   it is filled by the importer (news.js) from public sources.

   WHY THESE ARE HERE AND NOT IN content.js: a guide is written once and ships
   with the code. A post is a dated item in a feed that the operator keeps
   adding to. Same words, different lifecycle — see the `posts` table comment
   in db.js.

   CONTENT RULES (the same ones the guides follow):
     - Written to be USEFUL, not to be complete. Each post answers one question
       a helper actually has, and says what to do.
     - Every claim about Cantonese is checked; jyutping is real jyutping.
     - Nothing here is asserted as a universal rule. Customs differ between
       families, and the honest instruction when they do is "ask the family",
       which is said out loud rather than hidden.
     - `body` is a small, fixed HTML subset (<p>, <h2>, <ul>, <li>, <strong>,
       <em>, <a>) — the same subset the guides use, and the only tags the
       renderers will let through.

   LANGUAGE COVERAGE: English is complete. Simplified Chinese carries the title
   and summary. Filipino and Indonesian, and the Chinese body, are deliberately
   left blank for now and fall back to English — the same order used for the 38
   machine-drafted words: approve the English, then translate. See
   proposal/CULTURE-FEED-REVIEW.md.
   =========================================================================== */

const SEED_POSTS = [
  {
    slug: 'm-goi-and-do-ze-not-the-same',
    channel: 'culture',
    icon: '🙏',
    status: 'published',
    published_at: '2026-10-12T09:00:00.000Z',
    title_en: '唔該 and 多謝 Are Not the Same Word',
    title_zh: '「唔该」和「多谢」不是同一个词',
    summary_en:
      'Cantonese has two ways to say thank you, and using the wrong one is a small mistake that nobody corrects you for. Here is the difference, and how to tell which one a situation wants.',
    summary_zh: '粤语里有两个「谢谢」，用错了一般没人会纠正你。这篇讲清它们的区别，以及什么场合该用哪一个。',
    body_en: `<p>Most learners meet 唔該 and 多謝 on the same day, are told both mean "thank you", and then spend months using them at random. They are not interchangeable, and the difference is easy to remember once you see it.</p>
<h2>The rule</h2>
<p><strong>唔該</strong> (m4 goi1) is for a <em>service</em> — something a person <strong>does</strong> for you. Someone holds the lift door, passes you a bowl, answers your question, brings the bill.</p>
<p><strong>多謝</strong> (do1 ze6) is for a <em>gift</em> — something a person <strong>gives</strong> you. A present, a red packet, money, food that is being handed over as a gift rather than served.</p>
<h2>Why it matters</h2>
<p>Say 多謝 for a small favour and it sounds slightly formal, as if you had been given a present for opening a door. Say 唔該 when you are handed a gift and it sounds like you are thanking someone for a service — a little cold. Neither is a disaster. Both are the kind of thing a family notices and never mentions.</p>
<h2>The everyday test</h2>
<p>Ask yourself: <strong>did they do something, or did they give me something?</strong> Done → 唔該. Given → 多謝.</p>
<ul>
  <li>The helper at the shop hands you your change → <strong>唔該</strong></li>
  <li>Your employer's mother gives you a red packet at New Year → <strong>多謝</strong></li>
  <li>Someone moves aside for you in a corridor → <strong>唔該</strong></li>
  <li>A relative presses a box of cakes into your hands to take home → <strong>多謝</strong></li>
</ul>
<h2>The one you will use most</h2>
<p>唔該 is also the word for "please" and for "excuse me" — the same two syllables cover all three. That is why it is the single most useful phrase in the app: it is 唔該 when you ask, 唔該 when you receive, and 唔該 when you need to get past someone. If you learn one word this week, learn this one.</p>`,
  },

  {
    slug: 'the-altar-is-not-clutter',
    channel: 'culture',
    icon: '🕯️',
    status: 'published',
    published_at: '2026-10-13T09:00:00.000Z',
    title_en: 'The Altar in the Flat Is Not Clutter — Please Do Not Move It',
    title_zh: '家中的神枱不是杂物，请不要移动它',
    summary_en:
      'A red shelf with small figures, a photograph, an incense holder and sometimes fruit. It looks untidy and it is the one thing in the flat you should never tidy. Here is what it is and what to do instead.',
    summary_zh: '红色的小架子，上面有神像、照片、香炉，有时还有水果。它看起来像没收拾好的杂物，却是家里最不该动的东西。这篇说明它是什么，以及该怎么做。',
    body_en: `<p>Many Hong Kong flats contain something that looks, at a glance, like an untidy shelf: a small red cabinet or wall-mounted shelf, often near the door or in the living room, holding two or three small figures, a photograph, a holder with incense, and sometimes a plate of fruit. It may look dusty or cluttered, and your instinct will be to tidy it.</p>
<p><strong>Please do not.</strong> That is 神枱 (san4 toi2) — the family altar. It is not decoration and it is not storage. Every object on it is placed there deliberately, and the arrangement carries meaning to the family.</p>
<h2>What to do instead</h2>
<ul>
  <li><strong>Do not move anything on it.</strong> Not the figures, not the photograph, not the fruit.</li>
  <li><strong>Do not dust or wipe it</strong> without asking first. If it clearly needs cleaning, ask how the family would like it done — many families clean it themselves.</li>
  <li><strong>Never throw anything from it away.</strong> Ash in the incense holder is not dirt to be emptied, and used offerings are not rubbish.</li>
  <li><strong>If you are unsure whether an object belongs to the altar</strong>, treat it as if it does, and ask.</li>
</ul>
<h2>The wider point</h2>
<p>This is the single most useful thing to understand about a Hong Kong household: <strong>a few things that look like clutter have a purpose you cannot see.</strong> A bag of printed paper in gold and silver, a stack of folded paper, a plate of fruit left out — all of these can be part of household practice. When something looks like rubbish but you did not put it there, the safe answer is always the same: leave it, and ask.</p>
<h2>The sentence that solves it</h2>
<p><strong>唔好意思，我唔知道</strong> (m4 hou2 ji3 si1, ngo5 m4 zi1 dou6) — "Sorry, I didn't know." Say it plainly and early if you have already moved something. In most households that is the end of it. What turns a small thing into a problem is not the mistake — it is discovering it later and saying nothing.</p>`,
  },

  {
    slug: 'have-you-eaten-is-a-greeting',
    channel: 'culture',
    icon: '🍚',
    status: 'published',
    published_at: '2026-10-13T10:30:00.000Z',
    title_en: '"Have You Eaten?" Is a Greeting, Not a Dinner Invitation',
    title_zh: '「食咗飯未？」是问候，不是请你吃饭',
    summary_en:
      '食咗飯未 is asked constantly by older relatives, and answering it as a real question is the mistake every new helper makes. It is a greeting. Here is what it means and how to answer.',
    summary_zh: '长辈会经常问你「食咗飯未」，把它当成真问题来回答，是每个新来的家佣都会犯的错。它其实是一句问候。这篇讲它是什么意思、该怎么回。',
    body_en: `<p><strong>食咗飯未</strong> (sik6 zo2 faan6 mei6) translates literally as "Have you eaten yet?" — and it is one of the first things an elderly person in the household will say to you. It is not a question about your lunch.</p>
<p>It is a <strong>greeting</strong>. It means roughly "hello, are you well", and it comes from a time when asking after someone's next meal was how you asked after them. An elderly relative may say it several times a day, including straight after you have eaten.</p>
<h2>How to answer</h2>
<p>You do not owe a real answer. A short, cheerful one is what the greeting is asking for:</p>
<ul>
  <li><strong>食咗喇</strong> (sik6 zo2 laa3) — "I've eaten." The usual reply.</li>
  <li><strong>未呀</strong> (mei6 aa3) — "Not yet." Perfectly fine, and often the start of a conversation about what to cook.</li>
</ul>
<p>What not to do is give a full account of what you ate and when. That is the equivalent of answering "how are you" with a medical history — technically responsive, socially strange.</p>
<h2>Why this is worth a whole post</h2>
<p>Because it is the clearest example of the thing that trips up new helpers: <strong>a phrase whose words you know perfectly, and whose meaning is not the words.</strong> Cantonese is full of these. 得閒飲茶 (dak1 haan4 jam2 caa4), "let's have tea sometime", is not an invitation either — it is a warm way of saying goodbye.</p>
<p>When a phrase seems oddly literal or oddly repetitive, that is usually the signal. It is doing social work, not information work. Learn what it is <em>for</em>, and the words stop mattering so much.</p>`,
  },

  {
    slug: 'lunar-new-year-at-home',
    channel: 'culture',
    icon: '🧧',
    status: 'published',
    published_at: '2026-10-14T08:00:00.000Z',
    title_en: 'Lunar New Year: What Changes at Home, and the One Rule to Remember',
    title_zh: '农历新年：家里会有什么变化，以及最要紧的一条规矩',
    summary_en:
      'The biggest week of the Hong Kong year. The cleaning happens before, not during — and on the first day there is one ordinary household task you should not do.',
    summary_zh: '香港一年里最忙的一周。大扫除是在年前做的，不是过年时做的——而年初一，有一件最平常的家务你最好别做。',
    body_en: `<p>Lunar New Year falls in late January or February, depending on the lunar calendar, so the date moves each year. The family will always know the exact days — asking at the start of the month is a good habit, because this is the busiest week in a Hong Kong household.</p>
<h2>The rule to remember</h2>
<p><strong>Do not sweep or clean on the first day of the new year.</strong> The reason usually given is that sweeping on the first day sweeps the year's good fortune out of the house, so all the cleaning is done in the days <em>before</em> the new year instead.</p>
<p>This is worth knowing precisely because it is easy to break by accident. You will be trying to be helpful, the flat will be full of people and crumbs, and reaching for a broom is the obvious thing to do. Wait until the family has started tidying, or ask.</p>
<h2>What else changes</h2>
<ul>
  <li><strong>The deep clean comes first.</strong> Expect a thorough clean of the whole flat in the days before.</li>
  <li><strong>利是</strong> (lai6 si6) — red packets, small red envelopes with money, given to children, to unmarried people, and often to helpers. If one is given to you, take it with <strong>both hands</strong> and say <strong>多謝</strong> — it is a gift, not a service.</li>
  <li><strong>Visitors.</strong> Relatives visit in the first days. There is a lot of food, a lot of tea, and the kettle runs constantly.</li>
  <li><strong>Gift boxes.</strong> Fruit, cakes and sweets arrive in boxes, and many are re-gifted rather than eaten. Ask before opening a box that is still wrapped.</li>
  <li><strong>Plants and flowers.</strong> A small kumquat tree or other lucky plant is often bought for the festival. Do not move it or throw it out while the festival is on.</li>
</ul>
<h2>Words for the week</h2>
<ul>
  <li><strong>恭喜發財</strong> (gung1 hei2 faat3 coi4) — the standard new-year greeting, "wishing you prosperity".</li>
  <li><strong>新年快樂</strong> (san1 nin2 faai3 lok6) — Happy New Year.</li>
  <li><strong>利是</strong> (lai6 si6) — red packet.</li>
</ul>
<p>As always, households differ. The family's own practice is the one that counts, and asking is never the wrong move.</p>`,
  },

  {
    slug: 'mid-autumn-mooncakes',
    channel: 'culture',
    icon: '🥮',
    status: 'published',
    published_at: '2026-10-14T11:00:00.000Z',
    title_en: 'Mid-Autumn Festival: Mooncakes, and the Tin You Must Not Throw Away',
    title_zh: '中秋节：月饼，和那个不能扔的铁盒',
    summary_en:
      'In September or early October, decorated tins of mooncakes arrive in the flat — and they are not all for eating. What the boxes are for, and why you should not open one early.',
    summary_zh: '九月或十月初，家里会陆续收到一盒盒包装精美的月饼——它们不全是拿来吃的。这篇讲这些盒子是做什么用的，以及为什么不要提前拆。',
    body_en: `<p>Mid-Autumn Festival falls in September or early October, on the fifteenth day of the eighth lunar month. If you work in a Hong Kong household you will notice it before you understand it, because that is when the mooncakes arrive.</p>
<h2>What arrives</h2>
<p><strong>月餅</strong> (jyut6 beng2) — mooncakes. Dense, rich, expensive, and given as gifts in decorated tins and boxes. Families receive far more than they can eat, because everyone gives them to everyone.</p>
<h2>Two things not to do</h2>
<ul>
  <li><strong>Do not open a tin early.</strong> Many of the tins in the flat are waiting to be given to somebody else. A box that has been cut into may no longer be suitable to pass on.</li>
  <li><strong>Do not throw away a tin or its box.</strong> The tins are good quality and often kept and reused, and some are collectible. If you are not sure whether a box is rubbish, ask before it goes out.</li>
</ul>
<h2>What the household does</h2>
<ul>
  <li><strong>Lanterns.</strong> Children carry them in the evening, often as a family outing.</li>
  <li><strong>Going out at night</strong> to see the moon, which is the point of the festival. Expect to be asked to help with preparation, and possibly to work later than usual.</li>
  <li><strong>Fruit</strong> is part of it too — pomelo and star fruit in particular.</li>
</ul>
<h2>The general lesson</h2>
<p>Mid-Autumn is a good example of a pattern that runs through the whole year here: <strong>during a festival, ordinary objects have an extra purpose.</strong> A box is not just a box; it is a gift in transit. A tin is not just a tin; it is something to keep. When a festival is coming, slow down before you tidy, and ask.</p>
<p><strong>嚟緊有咩節日要準備？</strong> (lai4 gan6 jau5 me1 zit3 jat6 jiu3 zeon2 bei6) — "Is there a festival coming that we need to prepare for?" It is a good question to ask at the start of every month.</p>`,
  },

  {
    slug: 'chopsticks-five-rules',
    channel: 'culture',
    icon: '🥢',
    status: 'published',
    published_at: '2026-10-17T09:00:00.000Z',
    title_en: 'Chopsticks: Five Things That Are Done, and One That Is Not',
    title_zh: '筷子：五件该做的事，和一件绝不能做的事',
    summary_en:
      'You will use chopsticks every day, and there are exactly two rules most Hong Kong households actually care about. Here is what matters, what is only a story, and the one thing that will genuinely upset an older relative.',
    summary_zh: '你每天都会用到筷子，而香港家庭真正在意的其实只有两条规矩。这篇讲哪些重要、哪些只是传说，以及哪一件事是真的会让长辈不高兴。',
    body_en: `<p>Chopstick etiquette is a subject where most of what is written down is not what families actually do. This is the short, true version — the things that come up in a Hong Kong household.</p>
<h2>The one that genuinely upsets people</h2>
<p><strong>Never stand chopsticks upright in a bowl of rice.</strong> Not while you eat, not while you carry it, not for a second while you reach for something else. Upright sticks in rice is the shape of the offerings at a funeral, and it is the one chopstick mistake that will make an older relative put down their bowl.</p>
<p>If you need to set chopsticks down, lay them flat beside the bowl, or across it.</p>
<h2>The four that are good manners, not taboos</h2>
<ul>
  <li><strong>Use the serving spoons or the far end of the serving chopsticks</strong> when you take food from a shared plate to someone else's bowl. Passing food chopstick-to-chopstick is another funeral shape; flipping the chopsticks around and using the thick end is the everyday fix.</li>
  <li><strong>Do not spear food</strong> because it will not come up cleanly. It is not forbidden, it just looks hurried.</li>
  <li><strong>Do not point at people with them</strong>, and do not wave them while talking.</li>
  <li><strong>Do not dig through a shared dish</strong> looking for the piece you want. Take from the near side.</li>
</ul>
<h2>What nobody will actually mind</h2>
<ul>
  <li><strong>Holding them low or high.</strong> There is an old claim that holding them far from the tip means you will marry far from home. It is said as a joke to children. Nobody is judging your grip.</li>
  <li><strong>Crossing them on the table.</strong> Fine.</li>
  <li><strong>Tapping the bowl.</strong> Poor manners in general, but the specific story about beggars is folklore.</li>
</ul>
<h2>The sentence that helps</h2>
<p><strong>唔好意思，我第一次用</strong> (m4 hou2 ji3 si1, ngo5 dai3 jat1 ci3 jung6) — "Sorry, it's my first time." Said cheerfully, it turns a mistake into a moment people enjoy. Almost everything on this page is softer than you expect.</p>
<h2>Useful to know</h2>
<p>筷子 (<strong>faai3 zi2</strong>) — chopsticks. 碗 (<strong>wun2</strong>) — bowl. 飯 (<strong>faan6</strong>) — rice. Most kitchen vocabulary in this app is in the Kitchen and Restaurant categories if you want the words around the table.</p>`,
  },

  {
    slug: 'numbers-sound-lucky-unlucky',
    channel: 'culture',
    icon: '🔢',
    status: 'published',
    published_at: '2026-10-17T10:00:00.000Z',
    title_en: 'Why Some Numbers Are Lucky Here and Others Are Never Said',
    title_zh: '为什么有些数字是吉利的，有些数字没人愿意说出口',
    summary_en:
      'In Cantonese a number can sound exactly like a word for something good or something dreadful. Four is avoided on whole floors of buildings, eight is paid extra for. This is why, in plain terms.',
    summary_zh: '在粤语里，一个数字的发音可能刚好和某个好词或某个可怕的词一样。数字「四」会被整层楼避开，「八」却要加价买。这篇用最简单的话说明原因。',
    body_en: `<p>This is one of the first things a new helper notices and cannot explain: the lifts in some buildings skip a number, a phone number with lots of eights costs money, and nobody will say the number of a hotel room out loud without a small laugh.</p>
<h2>The reason is sound, not superstition about numbers</h2>
<p>It is not that numbers are magical. It is that Cantonese has many homophones — different words with the same sound — so a number sounds like whatever else it sounds like. A few of these:</p>
<ul>
  <li><strong>四</strong> (sei3, four) sounds like <strong>死</strong> (sei2, death). Very close. This is the origin of "tetraphobia", and it is why buildings often have no 4th, 14th, 24th or 40th floor.</li>
  <li><strong>八</strong> (baat3, eight) sounds like <strong>發</strong> (faat3, to prosper / to get rich). Same reason 8 is lucky, and why the Beijing Olympics opened on 08/08/08.</li>
  <li><strong>九</strong> (gau2, nine) sounds like <strong>久</strong> (gau2, long-lasting). Long-lasting marriage, long-lasting business.</li>
  <li><strong>六</strong> (luk6, six) sounds like <strong>祿</strong> (luk6, a salary or blessing). Good for work and money.</li>
  <li><strong>三</strong> (saam1, three) sounds like <strong>生</strong> (saang1, to be born / to live). Life, growth.</li>
</ul>
<h2>What you will actually see</h2>
<ul>
  <li><strong>Buildings without a 4th floor.</strong> The lift goes 3, 5, 6. Nothing is missing; the number is being avoided.</li>
  <li><strong>Phone numbers and licence plates</strong> with 8s sell for more.</li>
  <li><strong>Red packets</strong> hold amounts that avoid 4. Even the number of items in a gift can matter.</li>
  <li><strong>Weddings avoid 4</strong> in dates and in gift amounts.</li>
  <li><strong>13 is not avoided</strong> the way it is in the West. A Western superstition that exists here is imported and mild.</li>
</ul>
<h2>How to handle it</h2>
<p>You do not need to believe any of it. You do need to <strong>avoid the number out loud when someone else is uncomfortable</strong>. If a lift skips a floor and someone makes a face, the polite move is to not draw attention to it.</p>
<p>And if you slip and say something that sounds unlucky, the ordinary fix is to say something lucky immediately after — most people do it as a joke. Nobody is angry about it. This is a set of habits, not a set of rules anyone enforces on you.</p>
<h2>The useful vocabulary</h2>
<ul>
  <li><strong>數字</strong> (sou3 zi6) — number</li>
  <li><strong>四</strong> (sei3) — four</li>
  <li><strong>八</strong> (baat3) — eight</li>
  <li><strong>幾多</strong> (gei2 do1) — how many</li>
  <li><strong>唔好意思，講錯咗</strong> (m4 hou2 ji3 si1, gong2 co3 zo2) — "Sorry, I said the wrong thing."</li>
</ul>`,
  },

  {
    slug: 'colours-when-to-wear-what',
    channel: 'culture',
    icon: '🎨',
    status: 'published',
    published_at: '2026-10-17T11:00:00.000Z',
    title_en: 'Colour Rules: When to Wear Red, and When Never to Wear It',
    title_zh: '颜色的讲究：什么时候该穿红，什么时候千万不要穿红',
    summary_en:
      'Red means celebration and money at a wedding, and it means death at a funeral. The same colour flips meaning with the occasion. This is the short guide to the colours a helper actually has to get right.',
    summary_zh: '红色在婚礼上代表喜庆和吉利，在丧礼上却代表死亡。同一件颜色换个场合，意思完全相反。这篇讲家佣真正需要分清楚的那几种颜色。',
    body_en: `<p>Colour in Chinese culture is tied to the occasion, not to the colour itself. A colour is right or wrong depending on what is happening. This is the version you need for work.</p>
<h2>紅 — red</h2>
<p>The colour of <strong>joy, luck and money</strong>. Worn at weddings, at New Year, at a birthday, at a birth. Given in red packets. Wearing red to a happy event is correct and welcome.</p>
<p><strong>But never to a funeral.</strong> Red at a funeral is the single worst colour choice. At a funeral you wear white or black, quiet and plain.</p>
<h2>白 — white</h2>
<p>In the West white is for weddings. Here, <strong>white is for mourning</strong>. Wearing white to a funeral is correct. Wearing a white dress to a wedding is unusual and will be noticed.</p>
<p>That said, white as an everyday clothing colour is completely fine — a white shirt is a white shirt. The rule is about <em>occasions</em>, not about owning white clothes.</p>
<h2>黑 — black</h2>
<p>Mourning, and also just dark neutral clothing. A black outfit is safe at a funeral. Black at a wedding is fine — nobody will object to black at a wedding here the way some Western etiquette books do.</p>
<h2>金 — gold</h2>
<p>Wealth and celebration. Gold with red at New Year and weddings is the classic pairing. Gold jewellery is a normal gift for a child at New Year.</p>
<h2>The rule that covers everything</h2>
<p><strong>Red for a happy occasion, white or black for a sad one.</strong></p>
<p>If you are not sure which kind of occasion you are dressing for, ask: <strong>喜事定喪事？</strong> (hei2 si6 ding6 song1 si6) — "Is this a happy event or a funeral?" It sounds blunt written down; asked plainly and early it is exactly the right question, and it is much better than guessing.</p>
<h2>One thing not to worry about</h2>
<p>Your own clothes on an ordinary working day can be any colour you like. Nothing here governs a Tuesday.</p>`,
  },

  {
    slug: 'festival-stories-you-will-hear',
    channel: 'culture',
    icon: '🏮',
    status: 'published',
    published_at: '2026-10-17T12:00:00.000Z',
    title_en: 'The Four Festival Stories You Will Actually Be Told',
    title_zh: '你真的会听到的四个节日故事',
    summary_en:
      'Every family has a version of these, told at the dinner table while you are serving. Here is what they are, so you are not hearing a story about a monster for the first time while holding a plate.',
    summary_zh: '每个家庭都有自己的版本，通常在你上菜的时候在饭桌上讲给你听。这篇先把这些故事讲一遍，免得你第一次听说「年兽」的时候手里还端着菜。',
    body_en: `<p>Hong Kong families tell stories about the festivals. You will hear these four, in some version, in your first year. None of them are long, and knowing them turns a story you cannot follow into a story you can enjoy.</p>
<h2>1. 年獸 — the monster afraid of red and loud noises (Lunar New Year)</h2>
<p>A beast called Nian came down from the mountains on the last night of the year to eat livestock and people. One year the villagers discovered it was terrified of three things: <strong>the colour red, fire, and loud banging</strong>. So they pasted red paper on the doors, lit fires, and set off firecrackers. The beast fled. The next morning everyone greeted each other with 恭喜 — "you have survived".</p>
<p>That is why New Year is red, why there are fireworks, and why the greeting is a congratulation rather than a "happy new year".</p>
<h2>2. 嫦娥 — the woman who flew to the moon (Mid-Autumn)</h2>
<p>Chang'e drank an elixir of immortality meant for her husband, and it lifted her off the ground. She rose until she landed on the moon, and she lives there now, with a jade rabbit that pounds medicine. Her husband could only watch. On the night of the full moon in the eighth lunar month, families eat mooncakes, go outside, and look up.</p>
<p>The mooncakes are round because the moon is round, and round means the family is together.</p>
<h2>3. 屈原 — the poet the dragon boats race for (Dragon Boat Festival)</h2>
<p>Qu Yuan was a loyal official who drowned himself in a river in protest. The people raced out in boats to try to save him, or at least to find his body, beating drums and throwing rice into the water so the fish would not eat him.</p>
<p>That is the whole origin of both the dragon-boat race and the rice dumplings (粽), which are still made by wrapping glutinous rice in bamboo leaves.</p>
<h2>4. 盂蘭 — the hungry ghosts of the seventh month</h2>
<p>In the seventh lunar month the gates of the underworld open and the dead walk. Not as a horror story — more like relatives coming to visit who need feeding. Families burn paper money and paper goods for them, put out food, and go out of their way not to sit on, step on, or throw away anything left in the street. The month is considered a bad time for big new ventures and a good time for caution.</p>
<h2>The one question that always works</h2>
<p>When someone starts telling you a story, <strong>然後呢？</strong> (jin4 hau6 ne1) — "And then?" It keeps the story going and tells the teller you are listening. It will get you a better version of all four than any textbook.</p>`,
  },

  {
    slug: 'lunar-new-year-customs',
    channel: 'culture',
    icon: '🧨',
    status: 'published',
    published_at: '2026-10-17T13:00:00.000Z',
    title_en: 'Lunar New Year Customs: The Week Before, and the Rules for the First Three Days',
    title_zh: '农历新年习俗：年前那一周，和年初头三天的规矩',
    summary_en:
      'The most work-heavy week of your year, and two days of rules that nobody explains. Here is the sequence — what to clean, what to buy, what you must not sweep away, and what to wear on the first morning.',
    summary_zh: '一年里最忙的一周，外加两天没人会解释的规矩。这篇按顺序讲清楚：该打扫什么、该买什么、什么绝对不能扫掉，以及初一早上该穿什么。',
    body_en: `<p>Lunar New Year (<strong>農曆新年</strong>, nung4 lik6 san1 nin2) is the biggest event in the Hong Kong year and it is the one that changes your working life most. It falls in late January or February, and the important part starts about a week before the first day.</p>
<h2>The week before: cleaning</h2>
<p>There is a saying that you sweep out the old year to make room for the new. The whole flat gets cleaned, top to bottom, and it is normally the helper who does it. Practical points:</p>
<ul>
  <li><strong>Clean before New Year's Eve, not after.</strong> The cleaning is finished by the last day — the new year brings its own rules about sweeping.</li>
  <li><strong>Do not throw out anything you do not recognise.</strong> Old calendars, red paper decorations, packets from last year, a bundle of gold and silver paper — these are all festival material, and some families keep them year to year.</li>
  <li><strong>Windows and doors get cleaned first</strong> in many households. Ask which rooms the family wants done in which order.</li>
  <li><strong>You will be asked to do more than usual</strong>, and possibly to work later. It is understood, but if the load is impossible, say so early — the week goes badly for everyone when it is discovered on the last day.</li>
</ul>
<h2>What gets bought</h2>
<ul>
  <li><strong>Red packets</strong> (利是, lai6 si6) — new ones every year, in quantity.</li>
  <li><strong>Nian gao</strong> (年糕, nin2 gou1) — the New Year cake. Sweet and sticky.</li>
  <li><strong>New flowers and a kumquat or mandarin plant</strong> for the entrance.</li>
  <li><strong>New clothes</strong>, and new red decorations for the door.</li>
  <li><strong>Food for the reunion dinner</strong> — which you may be cooking.</li>
</ul>
<h2>New Year's Eve: the reunion dinner</h2>
<p>年夜飯 (nin4 je6 faan6) — the reunion dinner — is the most important meal of the year. Everyone who can be there is there. It is usually the biggest, most formal thing you will cook, and the family may invite relatives. Fish is on the table because the word for fish sounds like the word for surplus. Expect to work late.</p>
<h2>The first three days: the rules</h2>
<p>These are the ones that surprise new helpers, because nobody announces them and breaking one is genuinely noticed.</p>
<ul>
  <li><strong>Do not sweep or take the rubbish out on the first day.</strong> Sweeping on New Year's Day sweeps the good fortune out of the door with it. If something must be cleaned, sweep it inward or wait.</li>
  <li><strong>Do not wash your hair on the first day.</strong> It washes away the year's good luck.</li>
  <li><strong>Do not use sharp words.</strong> Nothing about death, nothing about owing money, no arguments. "Happy New Year" and cheerful things only. This is the reason the standard greeting is a congratulation.</li>
  <li><strong>Do not break anything.</strong> If something does break, say something lucky straight away — most families do this as a joke and the moment passes.</li>
  <li><strong>Wear red on the first morning</strong> if you have anything red. New clothes are traditional — wearing last year's is considered bad luck by some families.</li>
</ul>
<h2>What you actually say</h2>
<ul>
  <li><strong>恭喜發財</strong> (gung1 hei2 faat3 coi4) — "Wishing you prosperity." Said to everyone.</li>
  <li><strong>新年快樂</strong> (san1 nin2 faai3 lok6) — "Happy New Year."</li>
  <li><strong>身體健康</strong> (san1 tai2 gin6 hong1) — "Good health."</li>
  <li>The reply to 恭喜發財 is 恭喜發財 — you say it back. It is not a one-way greeting.</li>
</ul>
<h2>Red packets, and the money question</h2>
<p>Married people give red packets to unmarried people, to children, and to staff. As a helper you will receive one from the family, and you may receive several from married friends and relatives. It is polite to accept with both hands, and to say 多謝 — the thank-you for a gift, not the one for a service (see 唔該 and 多謝 in the Culture channel).</p>
<p>How much is in it is not your business and is not to be commented on. Say thank you and put it away.</p>
<h2>The three days after</h2>
<p>The visit-and-greeting continues, and there is a good chance of being asked to cook for visitors or to help with an outing. If you are given time off, ask when the family wants you back — being late back from New Year is one of the things that is remembered for a long time.</p>
<h2>If it all goes wrong</h2>
<p><strong>唔好意思，我唔知道</strong> — "Sorry, I didn't know." It works for a swept floor, a broken cup, and a wrong greeting. Say it early and plainly. What turns a small mistake into a real one is discovering it later and saying nothing.</p>`,
  },

  {
    slug: 'pointing-and-beckoning',
    channel: 'culture',
    icon: '🖐️',
    status: 'published',
    published_at: '2026-10-18T14:00:00.000Z',
    title_en: 'Pointing and Beckoning: Two Gestures People Read Before You Speak',
    title_zh: '「指人」和「招手」：别人会先看你的手',
    summary_en:
      'Pointing your index finger at someone, and beckoning with an upward palm, are the two small gestures most likely to be read as rude in Hong Kong. Neither requires a word — which is why both are worth learning before you use them.',
    summary_zh: '用手指指着别人、以及手掌向上地招手，是香港最容易被看作无礼的两个小动作。它们不用说话就能传达意思，所以更值得先学会。',
    body_en: `<p>Two hand gestures do more damage in a Hong Kong household than anything you can say by accident. Both are small, both are things you do without thinking, and both are read instantly by people who will never mention them to you.</p>
<h2>Do not point at people with your index finger</h2>
<p><strong>食指</strong> (sik6 zi2) — the index finger — is for food. Using it on a person, particularly an older person, reads as rude, and in some households it is also the finger used to scold. The local way to point is with the whole open hand and a tilt of the head: "that one, there". If you must single someone out, point with your open hand, never with one finger.</p>
<h2>Beckon with the palm down</h2>
<p><strong>招手</strong> (ziu1 sau1) — the "come here" gesture — is done with the <strong>palm facing down</strong> and the fingers curled slightly inward, the hand moving toward you in small waves. The palm-up version, fingers curling in one by one, is what you use on an animal, and using it on a person is worse than careless — it reads as dismissive.</p>
<h2>What to say instead</h2>
<p>Words cost nothing and need no gesture at all. To call someone over:</p>
<ul>
  <li><strong>過嚟</strong> (gwo3 lei4) — "come here." The everyday form, fine with anyone you know well.</li>
  <li><strong>唔好意思</strong> (m4 hou2 ji3 si1) — said first, before anything you need. It is the most useful phrase in the app, and it carries you through a hand you are not sure about.</li>
</ul>
<h2>Why this one is worth the effort</h2>
<p>Gestures are read before words arrive. A helper who points a finger at the grandmother is remembered for that, not for anything she said. The fix is a habit — open hand, palm down — and after a month you will not have to think about it.</p>
<p>Families differ in how strict they are about both gestures, and almost nobody will tell you. When you are unsure, the default is the same one that works for everything else in this app: keep the hand open, and ask.</p>`,
  },

  {
    slug: 'dont-ask-where-they-live',
    channel: 'culture',
    icon: '🏠',
    status: 'published',
    published_at: '2026-10-18T14:10:00.000Z',
    title_en: '查家宅: The Questions You Do Not Ask When You Just Met Someone',
    title_zh: '「查家宅」：刚认识的人，这些问题不要问',
    summary_en:
      '查家宅 — sizing up someone’s household — is what Hong Kong calls asking where you live, whether you bought or rent, and what you earn. Here are those questions, why they land badly, and what to ask instead.',
    summary_zh: '「查家宅」在香港指打听住哪里、买房还是租房、赚多少这一类问题。这篇列出这些问题，说明它们为什么会让人不舒服，以及该聊什么。',
    body_en: `<p><strong>查家宅</strong> (caa4 gaa1 zaak6) means, literally, checking someone’s household — asking the questions that work out what someone is worth. In Hong Kong it is not a compliment, and it is one of the clearest social rules a newcomer can learn: at a first meeting, these questions do not get asked.</p>
<h2>The list</h2>
<ul>
  <li><strong>你住喺邊度？</strong> (nei5 zyu6 hai2 bin1 dou6?) — "Where do you live?"</li>
  <li><strong>租嘅定係買嘅？</strong> — "Do you rent, or did you buy it?"</li>
  <li><strong>人工有幾多？</strong> — "How much is your salary?"</li>
  <li><strong>呢個幾多錢？</strong> (ni1 go3 gei2 do1 cin2?) — "How much was that?"</li>
  <li><strong>你間屋有幾大？</strong> — "How big is your flat?"</li>
</ul>
<p>One of these is a question. All five together are an interview — and that is how it feels to be asked them. The problem is not the topic. It is that a first meeting is not the place for it, and the questions carry an obvious ranking behind them.</p>
<h2>What the questions are really saying</h2>
<p>People read them as: <em>you are being measured.</em> In a city where a flat is the biggest thing in most people’s lives, asking about it first is asking about the most sensitive number there is. Salary is the same question in a different coat.</p>
<h2>What to say instead</h2>
<p>Safe ground is everything around the household rather than inside it:</p>
<ul>
  <li>Where they are <strong>from</strong>, and how long they have been in Hong Kong.</li>
  <li>The weather, the commute, the food — 傾偈 (king1 gai2), chatting, the way conversations actually open here.</li>
  <li>Anything about work that is not a number: what the day looks like, what the job is called.</li>
</ul>
<p>If you must know something — and sometimes you genuinely do, for instance which stop to get off at — ask once, plainly, and let it go. <strong>唔好意思，我唔知道</strong> (m4 hou2 ji3 si1, ngo5 m4 zi1 dou6) covers the reverse mistake too: if you have already asked, the answer is to say so and move on, not to explain.</p>
<p>Families and offices differ in how exact the rule is, and the safest reading is the strict one: nobody has ever been thought rude for not asking.</p>`,
  },

  {
    slug: 'who-pays-the-bill',
    channel: 'culture',
    icon: '🧾',
    status: 'published',
    published_at: '2026-10-18T14:20:00.000Z',
    title_en: 'Stop Fighting Over the Bill: How Paying Works Here',
    title_zh: '不要每次都在「抢埋单」：在香港怎么付钱才得体',
    summary_en:
      '搶埋單 — fighting to pay the whole bill — reads as warmth in some places and as pressure in Hong Kong. Here is the actual local custom: AA or taking turns, and why the loud fight is the version that loses.',
    summary_zh: '「抢埋单」在有些地方是热情，在香港却是一种压力。这里讲本地真正的做法：AA制或轮流请客，以及为什么大声争付反而失礼。',
    body_en: `<p>The bill arrives, and someone reaches for it. Someone else grabs it first. Both are now standing, holding the folder, and neither is having a good time. In Hong Kong this is a well-known failure with a name: <strong>搶埋單</strong> (coeng2 maai4 daan1), fighting to pay the bill.</p>
<h2>The mistake</h2>
<p>In many places, fighting for the bill is how you show generosity. Here it is more often read the other way: <strong>the person who was not allowed to pay has been made small.</strong> Done repeatedly, it stops being a gesture and becomes a problem — the other person either feels pressured to reciprocate, or starts quietly avoiding meals with you.</p>
<h2>What is actually customary</h2>
<ul>
  <li><strong>AA</strong> — splitting the bill is completely normal here, colleagues and friends included, and nobody thinks twice about it.</li>
  <li><strong>輪流請</strong> — taking turns. Someone pays this time; someone pays next time. The obligation is tracked quietly, and it is the most common pattern in any regular group.</li>
  <li><strong>One person pays, properly.</strong> If you invited someone out, you pay. That is the clean case, and there is no fight to have.</li>
</ul>
<h2>The words that solve it</h2>
<ul>
  <li><strong>唔使，唔使</strong> (m4 sai2, m4 sai2) — "no, no, there is no need." The polite refusal, said with a smile, ends the fight without anyone losing.</li>
  <li><strong>今次我請，下次你請</strong> — "this round is mine, next round is yours." Say it once, calmly. It turns the fight into a plan.</li>
</ul>
<p>If someone insists on paying and you can see they mean it, let them — and then <em>be the one who suggests the next one.</em> Repaying quietly, over several meals, is the local version of the same generosity.</p>
<h2>The one hard rule</h2>
<p>Watch the person on the other side of the table. If the bill would visibly strain someone — a junior colleague, a friend between jobs — do not let them split it evenly. Cover it, and say nothing. What is remembered is not the amount; it is that nobody had to do arithmetic at dinner.</p>
<p>Groups differ, and some families fight over the bill every time and enjoy it. When you are unsure, the safe default is the AA default: it is never rude to offer to pay your way.</p>`,
  },

  {
    slug: 'no-arms-around-shoulders',
    channel: 'culture',
    icon: '🧍',
    status: 'published',
    published_at: '2026-10-18T14:30:00.000Z',
    title_en: 'Keep Your Hands to Yourself: 搭膊頭 and the Rules of Distance',
    title_zh: '身体界限：不要随意「搭膊头」',
    summary_en:
      '搭膊頭 — an arm around the shoulders — is friendly in some countries and far too familiar in a Hong Kong workplace. Here is where the line sits, and the saying behind it.',
    summary_zh: '「搭膊头」（搭着别人的肩膀）在有些地方表示友好，在香港的职场上却太过随便。这篇讲这条界线在哪里，以及背后的说法。',
    body_en: `<p><strong>搭膊頭</strong> (daap3 bok3 tau4) — throwing an arm around someone’s shoulders, or a heavy pat on the shoulder as you walk past — is a gesture of warmth in a lot of the world. In a Hong Kong workplace, formal setting, or a household you work in, it more often reads as <strong>too familiar</strong>, as though the other person had been claimed.</p>
<h2>Where the line sits</h2>
<ul>
  <li><strong>Not in the workplace.</strong> With colleagues, managers, employers — especially people you have just met — it reads as over-familiar, and some find it faintly patronising.</li>
  <li><strong>Not with anyone significantly older.</strong> Touching an elder’s shoulder or back, even kindly, is something to avoid. Older people in particular may be unreceptive to physical contact from a helper they have known for a week.</li>
  <li><strong>Not as an apology.</strong> Reaching for someone’s arm or shoulder while saying sorry makes the apology bigger, not smaller, in a culture where the apology is supposed to be words.</li>
</ul>
<h2>The saying behind it</h2>
<p>There is also an older belief many families still hold: a hand on someone’s shoulder can press down their luck — some say it can cost a gambler the table. You do not have to believe it to let it steer your hands. What matters is that <strong>the people around you may believe it</strong>, and the gesture costs you nothing to leave out.</p>
<h2>What replaces it</h2>
<p>Nothing at all. Hong Kong manages warmth at arm’s length: a nod, a smile, a 唔好意思 (m4 hou2 ji3 si1) when you need to get past someone, and food — which is where affection actually goes. When you want to show care, do it with the work: the meal ready on time, the thing you fixed without being asked, the chair you pulled out.</p>
<p>Families differ, of course — some are hands-on, and close colleagues do slap each other’s shoulders. When you are unsure, the default is the distance-keeping one. Nobody has ever been thought cold for giving someone room.</p>`,
  },

  {
    slug: 'public-manners',
    channel: 'culture',
    icon: '🚇',
    status: 'published',
    published_at: '2026-10-18T14:40:00.000Z',
    title_en: 'Manners in Public: Queues, the MTR, and What to Call People',
    title_zh: '公共场合礼仪：排队、车厢和称呼',
    summary_en:
      'Queueing, letting people off before you board, keeping the carriage quiet, not claiming extra seats with your bags, and calling a woman 靚女 — the public rules nobody announces, in one place.',
    summary_zh: '排队、先下后上、车厢里保持安静、不用袋子占座，以及称呼女性为「靓女」——那些没人宣布的公共规则，一次讲清。',
    body_en: `<p>Most of the public rules in Hong Kong are unspoken, which is exactly why they are worth reading once. None of them is complicated; all of them are the kind of thing that gets noticed.</p>
<h2>Queue, and let people off first</h2>
<p><strong>排隊</strong> (paai4 deoi2) — queueing — is close to a religion here. At the MTR, the bank, the market stall and the doctor’s, you join the back of the line and wait. Cutting is remembered.</p>
<p>At the train doors the rule is <strong>先落後上</strong> (sin1 lok6 hau6 soeng5) — those getting off go first, then those getting on. Pushing in while people are still stepping out is one of the few behaviours that gets spoken about out loud.</p>
<h2>The carriage</h2>
<ul>
  <li><strong>No phone calls.</strong> Take the call if you must, but keep it short and quiet — a loud conversation in a crowded carriage is the classic complaint.</li>
  <li><strong>No video without earphones.</strong> Anything you play, you wear. This one is enforced socially and instantly.</li>
  <li><strong>One seat per person.</strong> Your bag, your shopping and your luggage go on your lap or the floor — not the seat beside you. At eight in the morning there is somebody standing who could use it.</li>
</ul>
<h2>What to call people</h2>
<p>Addressing a woman — a shop assistant, a waitress, someone in a uniform — you will hear <strong>靚女</strong> (leng3 neoi2), and it is the ordinary polite form here, the equivalent of "miss". For men it is 先生; in a casual shop or market you may also hear 阿哥 and 阿姐.</p>
<p>If you need anything, lead with it: <strong>唔好意思</strong> (m4 hou2 ji3 si1) — "excuse me" — works on everyone, in every situation, and is the only phrase you strictly need.</p>
<h2>When you get it wrong</h2>
<p>Nobody will correct you. Sit in the seat you should have kept clear, or call out across a carriage, and what you get is a look. The rule that covers all of it is simple: <strong>do what is easiest for the most people</strong> — and <strong>唔好意思，我唔知道</strong> (m4 hou2 ji3 si1, ngo5 m4 zi1 dou6) when you realise you got it wrong.</p>`,
  },

  {
    slug: 'gifts-you-should-not-give',
    channel: 'culture',
    icon: '🎁',
    status: 'published',
    published_at: '2026-10-18T14:50:00.000Z',
    title_en: 'Gifts You Should Not Give: Clocks, Pears, and the Wrong Colours',
    title_zh: '送礼禁忌：别送钟，别送梨',
    summary_en:
      '鐘 sounds like 送終 and 梨 sounds like 離 — two gifts whose names say something nobody means. Plus the colours to keep off the wrapping paper.',
    summary_zh: '「钟」谐音「送终」，「梨」谐音「离」——名字会替你说出你没说的意思。还有包装纸上要避开的颜色。',
    body_en: `<p>Gift-giving in Hong Kong runs on homophones. A gift’s name can say something the giver never intended, and two of them are famous enough that families check for them by reflex.</p>
<h2>Do not give a clock</h2>
<p><strong>鐘</strong> (zung1), a clock, sounds exactly like <strong>終</strong> — as in <strong>送終</strong> (sung3 zung1), to see someone out at the end of their life. A clock on the wall says it, in someone’s home, quietly, every day. Do not give one, at any age and for any occasion.</p>
<h2>Do not give pears</h2>
<p><strong>梨</strong> (lei4), a pear, sounds exactly like <strong>離</strong> (lei4) — to part, to separate. A gift of pears, especially between a couple, says the relationship is ending. Do not give them, and do not cut them up in front of people either.</p>
<h2>Keep the wrapping quiet</h2>
<p>White and black are the colours of mourning and do not belong on a gift; many families would add blue to that list. Red is the safe, warm choice, and gold and pink are welcome. If you are wrapping something for the family you work for, red or gold is never a mistake.</p>
<h2>If a clock is unavoidable</h2>
<p>The old workaround, for the rare case where a clock must change hands: the receiver <strong>pays you one dollar for it</strong>, so the clock is bought rather than given, and the saying loses its grip. Families who care about the custom do this without discussion. Families who do not will simply wonder why you are holding out your hand.</p>
<h2>The wider point</h2>
<p>These are not superstitions you have to believe. They are words, and words land whether or not the speaker meant them. When you are choosing something for someone else’s home — especially someone older, or a couple — the safe habit is to ask what they would like, rather than to surprise them.</p>`,
  },

  {
    slug: 'new-year-taboos',
    channel: 'culture',
    icon: '🧨',
    status: 'published',
    published_at: '2026-10-18T15:00:00.000Z',
    title_en: 'New Year Taboos: The Third Day, and Why Nobody Buys Shoes',
    title_zh: '新年禁忌：赤口不拜年，正月不买鞋',
    summary_en:
      'Two rules that run for the whole first lunar month, not just the first day: the third day is 赤口, a day for quarrels, and shoes stay in the shop until the month is over.',
    summary_zh: '有两条规矩管着整个农历正月，不只是初一：年初三是「赤口」，容易口角；而鞋店，正月里最好别买鞋。',
    body_en: `<p>Most New Year rules people know about the first day. These two run for the whole of the first lunar month (<strong>正月</strong>, zing1 jyut6), and both are the kind of thing a household will quietly observe.</p>
<h2>年初三：赤口</h2>
<p>The third day of the new year is called <strong>赤口</strong> (cek3 hau2) — "red mouth", a day on which quarrels start easily. Traditionally you do not go visiting, and you keep out of arguments; the day is for staying in and keeping the peace.</p>
<p>What this means for you in practice: families differ, but a good many simply do not go out on the third day. If your family does, fine. If they do not, do not plan anything for that day, and if someone in the house is short-tempered, let it pass.</p>
<h2>正月裡不買鞋</h2>
<p>Shoes stay unbought until the new year’s first month is over, because <strong>鞋</strong> (haai4) sounds like <strong>邪</strong> (haai4) — bad luck, evil — and buying shoes in the first month is said to buy a year of it. Some families give a second reason: it also sounds like <strong>唉</strong> (aai4), sighing, and nobody wants a year of that either.</p>
<p>You will meet this one mainly when you are asked to run an errand. If a family member asks for shoes in January, mention it once — some households will still buy them and simply not care, and the answer then is to do as they ask. Nothing here is enforced; all of it is preference.</p>
<h2>The one habit that covers both</h2>
<p>Ask early, and casually, how the family keeps the new year — which day they stay in, what they will not do. <strong>唔好意思，我唔知道</strong> (m4 hou2 ji3 si1, ngo5 m4 zi1 dou6) is the honest opening, and it works far better than guessing correctly by accident.</p>`,
  },

  {
    slug: 'funeral-etiquette',
    channel: 'culture',
    icon: '🤍',
    status: 'published',
    published_at: '2026-10-18T15:10:00.000Z',
    title_en: 'At a Funeral in Hong Kong: What to Wear, What to Say, and 帛金',
    title_zh: '香港丧礼：穿什么、说什么、帛金怎么给',
    summary_en:
      'Dress plain, give an odd amount, say 有心 instead of 多謝 and 慢行 instead of 再見 — and spend the coin from the 吉儀 packet before you get home.',
    summary_zh: '穿素色、帛金给单数、说「有心」不说「多谢」、道别说「慢行」不说「再见」——还有，「吉仪」里那枚硬币，回家前就要花掉。',
    body_en: `<p>If the family you work for has a funeral, you may be asked to attend, or to help with the preparations. The customs here are specific, they are not announced, and getting them wrong is the kind of thing that is remembered kindly but never forgotten. This is what is expected.</p>
<h2>What to wear</h2>
<p>Plain or black. No bright colours, no patterns, nothing red — red is for weddings. If you have nothing black, the darkest plain clothes you own will do; nobody will inspect you.</p>
<h2>帛金: the money</h2>
<p>You bring a white envelope with money in it — <strong>帛金</strong> (baak6 gam1). The amount must be an <strong>odd number</strong>: one hundred and one dollars is the usual way to give a hundred, with one dollar added to make it single. Never round it up to an even number.</p>
<p>Hand it over quietly when you arrive, to whoever is receiving. Do not count it out in the open, and do not comment on the amount in either direction.</p>
<h2>What to say — and what not to</h2>
<ul>
  <li>Receiving the family’s return gift, say <strong>有心</strong> (jau5 sam1) — "thank you for the thought." <strong>Not</strong> 多謝, which is for gifts.</li>
  <li>Taking your leave, say <strong>慢行</strong> (maan6 haang4) — "walk slowly", take care — or let the family say <strong>唔送</strong> (m4 sung3), "I will not see you out." <strong>再見</strong> (zoi3 gin3) is not used here.</li>
</ul>
<h2>吉儀: the packet you are given</h2>
<p>Before you leave you will be handed a small packet — <strong>吉儀</strong> (gat1 ji4) — containing a tissue, some sweets, and a one-dollar coin.</p>
<p><strong>Spend the coin the same day.</strong> Buy something small with it, or give it away. It must not come home, and it must not go into your wallet and stay there — the saying is that money kept from a funeral carries the bad luck back into the house. The tissue and the sweets are yours to keep; it is the coin that has to move on.</p>
<h2>The hundred days after</h2>
<p>A household that has had a funeral (<strong>白事</strong>, baak6 si6) observes <strong>百日</strong> (baak3 zat6) — a hundred days. During that time the family avoids visiting other people’s homes and stays away from weddings and other happy occasions. If you work for a household in that period, help them keep it: no bringing home party news, no planning visits.</p>
<h2>If you are unsure</h2>
<p>Customs differ between families — some give a different 吉儀, and some observe the hundred days strictly while others observe them loosely. The safe default when nobody has told you: dress plain, stay quiet, follow whatever the person beside you does, and say <strong>唔好意思，我唔知道</strong> (m4 hou2 ji3 si1, ngo5 m4 zi1 dou6) if you are asked something you cannot answer. At a funeral, as everywhere else in this app, the worst mistake is the one you hide.</p>`,
  },

  {
    slug: 'lucky-words-and-taboos',
    channel: 'culture',
    icon: '🧿',
    status: 'published',
    published_at: '2026-10-18T15:20:00.000Z',
    title_en: 'Why the Almanac Is Called 通勝: Hong Kong’s Lucky Words',
    title_zh: '为什么通书叫「通胜」：香港人的意头',
    summary_en:
      '通書 becomes 通勝, an empty shop is 吉舖, and you never say 食完 — Hong Kong swaps words whose SOUNDS carry loss, emptiness or death, and it has a name: 意頭. Here are the swaps you will actually hear.',
    summary_zh: '通書要叫「通胜」，空舖要叫「吉舖」，飯不能說「食完」——香港人避開讀音像「輸、空、完」的字，改說吉利話，這叫「意頭」。這篇講最常見的幾個。',
    body_en: `<p><strong>意頭</strong> (ji3 tau4) means, roughly, the lucky meaning behind a thing — whether a word, a name, a time of day or a gift is good to say and good to do. It is the reason a Cantonese speaker will look at you, choose a different word, and say that one instead. Nobody announces this; you pick it up or you do not. These are the ones you will hear.</p>
<h2>Words that mean money</h2>
<p><strong>書</strong> (syu1), a book, sounds exactly like <strong>輸</strong> (syu1), to lose. So the Chinese almanac is not called 通書 — it is <strong>通勝</strong> (tung1 sing3), win. If a family is checking the almanac for a good date — a wedding, moving house, opening a shop — the word you use is 通勝, never 通書.</p>
<p>The same trade applies to <strong>絲瓜</strong> (si1 gwaa1), the loofah. Because 絲 is said to sound like 輸, the vegetable is sold and cooked as <strong>勝瓜</strong> (sing3 gwaa1). Order it as 絲瓜 and you may be corrected.</p>
<h2>Words that mean empty</h2>
<p><strong>空</strong> (hung1), empty, sounds exactly like <strong>凶</strong> (hung1), misfortune. So a shop that is empty is never called 空舖 — it is <strong>吉舖</strong> (gat1 pou3), the lucky shop. That is why the "to let" signs in the street read 吉舖. An empty shop is exactly what a landlord wants to fill, so the word must not say empty.</p>
<p>The same thinking reaches the dinner table. <strong>食完飯</strong> (sik6 jyun4 faan6) — "have finished eating" — puts 完, finished, right next to rice, because 完 means there is nothing left, and a household with no rice is a household short of money. Say <strong>食咗飯</strong> (sik6 zo2 faan6) — "have eaten" — or simply 食飽 (sik6 baau2), "eaten full". Both are safe; 食完 is the one to drop.</p>
<h2>Words about children</h2>
<p>There is a strong habit of <strong>not praising a child out loud.</strong> "This child is so healthy, has never been ill a day in his life" is exactly the sentence not to say — the fear is that saying it aloud tells illness where to find the child, and it arrives to prove you wrong.</p>
<p>The same caution covers calling a baby fat. Do not do it, and do not joke about it — the worry is not the word but what a spirit might make of the complaint, and what it might then take away.</p>
<p>What you say instead is the reverse: a small kindness in words, nothing more. If you must comment, comment on the present moment — 「好得意」(hou2 dak1 ji3), cute — and leave the future alone. When you are unsure, say nothing; a helper who is quiet about a child is never faulted for it.</p>
<h2>The green hat</h2>
<p>In Chinese folk association, <strong>綠帽</strong> (luk6 mou3) — a green hat — means a man whose wife has been unfaithful. The colour is a punishment, not a fashion: under laws from the Ming and Qing dynasties a husband in that position was made to wear a green headscarf, and the colour has carried the meaning ever since.</p>
<p>So: <strong>if you are buying clothes or a cap for a male member of the household, do not pick green.</strong> A green bag or a green shirt is fine; a green cap, especially, is not. Nobody will explain why the green cap was a mistake — you will only notice it is never worn.</p>
<h2>The one habit that covers all of it</h2>
<p>意頭 is preference, not law, and families differ in how much they observe. The habit worth keeping is simply to <strong>notice which words the family uses, and copy them.</strong> When you are not sure, follow the person next to you, and if you have already said the wrong one — <strong>唔好意思，我唔知道</strong> (m4 hou2 ji3 si1, ngo5 m4 zi1 dou6), said early, is always the right answer.</p>`,
  },
  {
    // Added 2026-10-21 at the operator's request, digested from a general
    // expat guide and rewritten for this app's reader: she is often the one
    // COOKING for the table, so the customs are given in both directions —
    // serving a family, and being a guest at one. The chopstick rules are NOT
    // repeated here; chopsticks-five-rules owns them and is linked instead.
    slug: 'hong-kong-table-customs',
    channel: 'culture',
    icon: '🍵',
    status: 'published',
    published_at: '2026-10-20T22:30:00.000Z',
    title_en: 'At a Hong Kong Table: Tea, Shared Plates, and What to Leave Behind',
    title_zh: '香港飯桌：茶、共菜，還有那口要剩下來的飯',
    summary_en: "Almost nothing at a Hong Kong table is a taboo. The customs that actually matter are about tea, sharing, and one plate you should not finish — and they matter whether you are cooking for the family or eating with them.",
    summary_zh: '在香港的餐桌上，幾乎沒有什麼是禁忌。真正重要的規矩只有幾條：茶怎麼倒、共菜怎麼夾，還有哪一口飯不該吃光——這些對要做飯給一家人吃的你，同樣適用。',
    body_en: `<p>Food in Hong Kong is a social event, and the customs around it are gentler than most guidebooks make them sound. Very few of them are taboos. These are the ones that actually happen at a Hong Kong table — the one you may be cooking for, and the one you may one day be invited to.</p>
<h2>Tea: filling the cup is the whole job</h2>
<p>The one rule that matters: <strong>when a cup is empty, fill it</strong> — and while you are up, fill everyone else's too. Topping up only your own is the thing people notice.</p>
<p>It works in both directions. When someone pours for <em>you</em>, <strong>tap two fingers on the table</strong> to say thank you without stopping the conversation. That small tap is Hong Kong's answer to calling 唔該 across a noisy table, and an older person will do it to you.</p>
<p>You rarely see tea in a takeaway cup here. It is a sit-down drink, and a meal is not finished until the tea has been poured.</p>
<h2>Everything comes to the middle</h2>
<p>Dishes are placed in the middle of the table and shared. You do not get your own plate of food the way you would at home in the Philippines or Indonesia — you take a little from the shared dish onto your rice, several times over the meal.</p>
<ul>
<li><strong>Take from the side nearest you.</strong> Reaching across is what the serving spoons are for.</li>
<li><strong>Use the serving spoons</strong>, or the thick end of the serving chopsticks, to move food onto someone else's bowl.</li>
<li><strong>Do not dig</strong> through a dish looking for the piece you want.</li>
</ul>
<p>The rest of the chopstick rules — including the one that genuinely upsets an older relative — are in <a href="/discover/chopsticks-five-rules">Chopsticks: Five Things That Are Done, and One That Is Not</a>.</p>
<h2>If you are the one serving</h2>
<p>In many households the helper serves the food and eats afterwards, alone or with the children. If that is your arrangement, the same customs are what make you look like someone who understands the family: <strong>fill the elders' cups first</strong>, put the serving spoons out with the dishes, and set the rice bowls down without asking who wants what.</p>
<p>You are not expected to eat at the table, and you are not expected to refuse if you are asked. Both happen in different houses, and neither is a comment on you.</p>
<h2>As a guest: two small things</h2>
<ul>
<li><strong>Let the host start.</strong> Wait until the eldest person present picks up their chopsticks, or until someone says <strong>開飯</strong> (hoi1 faan6) — "the meal is starting" — then begin.</li>
<li><strong>Leave a little on your plate.</strong> Finishing everything says the host did not give you enough. An empty bowl is a small failure of hospitality, not a compliment to the cook.</li>
</ul>
<p>Eating everything is the right instinct almost everywhere else in the world. This is the one table where it is better to leave a spoonful of rice.</p>
<h2>If chopsticks defeat you</h2>
<p>Ask for a fork — <strong>唔該，有叉嗎？</strong> (m4 goi1, jau5 caa1 maa3) — and almost every restaurant will bring one without comment. Using them well is a kindness that will be noticed, but a helper who can eat neatly with a fork has committed no rudeness. Nobody at the table is keeping score.</p>
<h2>Useful to know</h2>
<p>茶 (<strong>caa4</strong>) — tea. 添茶 (<strong>tim1 caa4</strong>) — to top up the tea. 開飯 (<strong>hoi1 faan6</strong>) — the meal is starting, said before the first bite. 慢慢食 (<strong>maan6 maan6 sik6</strong>) — take your time eating, said to a guest. The rest of the table and kitchen words are in the Kitchen and Restaurant categories.</p>`,
  },
  {
    // Added 2026-10-21 at the operator's request, digested from a general
    // expat guide and rewritten in this app's own words. The source's
    // "more than a fifth of all medical consultations" figure could not be
    // traced to a primary source, so it is deliberately NOT asserted here.
    // What IS asserted is checkable: the Chinese Medicine Council under the
    // Chinese Medicine Ordinance (Cap. 549), degree-level registration, and
    // the Chinese Medicine Hospital that opened in phases from 2025.
    // The safety section is the point of the post — a helper is often the
    // person holding both the hospital tablets and the herb bundle.
    slug: 'chinese-medicine-in-hong-kong',
    channel: 'culture',
    icon: '🌿',
    status: 'published',
    published_at: '2026-10-20T23:15:00.000Z',
    title_en: 'Chinese Medicine in Hong Kong: Ordinary, Regulated, and Usually in Your Kitchen',
    title_zh: '香港的中醫：很日常、有規管，而且常常在你的廚房',
    summary_en: "In Hong Kong, Chinese medicine is not the 'alternative' to seeing a doctor — it is one of the ordinary options, regulated by law and often the reason your kitchen smells of herbs. Here is how it works, and the three rules to get right.",
    summary_zh: '在香港，中醫不是「西醫以外」的另類選擇——它是正規醫療的一部分，受法律規管，而且常常就是你廚房裡那股草藥味的來源。這裡說明它如何運作，以及三條必須守住的規矩。',
    body_en: `<p>In Hong Kong, Chinese medicine is not the alternative to seeing a doctor. It is one of the ordinary things people do, and often they do it <em>as well as</em> hospital medicine rather than instead of it. If the family says they are going to <strong>睇中醫</strong> — to see a Chinese medicine practitioner — that is a normal medical appointment, not a superstition and not a last resort.</p>
<h2>It is regulated by law</h2>
<p>A practitioner must be registered, and registration is not easy. The regulator is the Chinese Medicine Council of Hong Kong, a statutory body set up under the Chinese Medicine Ordinance (Cap. 549). A registered practitioner has completed an approved university degree in Chinese medicine and passed a licensing examination, and the Council has the power to strike a practitioner off its register for misconduct.</p>
<p>In 2025 the city's first Chinese Medicine Hospital opened in phases — a large government project where Chinese and Western medicine work side by side under one roof. That tells you how seriously this medicine is taken here.</p>
<h2>Where you will meet it first: the kitchen</h2>
<p>Long before anyone books a consultation, Chinese medicine arrives in your kitchen — usually as a job for you.</p>
<ul>
<li><strong>老火湯</strong> (<strong>lou5 fo2 tong1</strong>) — a clear soup simmered gently for two or three hours. Many families believe a particular soup suits a particular season or a particular body, and you may be asked to keep one going on the stove all afternoon.</li>
<li><strong>涼茶</strong> (<strong>loeng4 caa4</strong>) — herbal tea, bought at a small shop when someone feels <strong>熱氣</strong> (<strong>jit6 hei3</strong>), "heaty" — a sore throat, a mouth ulcer, one fried dinner too many. It is extremely bitter. That is the point of it, and nobody offers you a sip to be polite.</li>
<li><strong>中藥</strong> (<strong>zung1 joek6</strong>) — a prescription of dried roots, leaves and bark, dispensed as a paper bundle and boiled at home into a dark liquid. This is the part you may be asked to do yourself.</li>
</ul>
<p>Households here commonly use both systems at once: a GP for one complaint, a Chinese medicine practitioner for another, sometimes for the same person in the same week. Nobody sees that as a contradiction.</p>
<h2>Boiling herbs: what the job actually is</h2>
<p>The herbs come from the practitioner's shop in a paper bundle with a sheet of instructions — how many times to boil, how much to drink, and when. <strong>Follow that sheet, not your instincts.</strong> The usual method is:</p>
<ul>
<li><strong>Rinse</strong> the herbs briefly, cover them with water and <strong>soak for about 30 minutes</strong>.</li>
<li>Bring to the boil, then <strong>simmer until about one bowl of liquid</strong> is left. Pour it off and keep the herbs.</li>
<li><strong>Boil the same herbs a second time</strong> the next day. Most prescriptions are boiled twice, and the second boil is a dose in its own right — not a weaker left-over to be thrown away.</li>
</ul>
<p>Use a <strong>clay pot or a ceramic pot</strong>, never a metal one, and never the pot dinner is cooked in. The dose is drunk <strong>warm</strong>, at the times written on the sheet.</p>
<h2>Three rules that are not negotiable</h2>
<ul>
<li><strong>A prescription belongs to one person.</strong> The herbs are chosen for one body, on one day. Never move herbs from one bundle to another — not even within the same family, not even if two people have "the same cold".</li>
<li><strong>Never give a decoction to a pregnant woman or a small child</strong> unless the practitioner wrote it for her, or for them. If you are asked to, say plainly that the family should check with the practitioner first.</li>
<li><strong>Herbs are medicine, and they interact.</strong> They can change the way blood-pressure tablets, blood thinners and diabetes medicine work. If someone in the household takes hospital medicine <em>and</em> herbs, the doctor and the practitioner should each know about the other — and if you are the person who sees both in the same kitchen, say so to the family.</li>
</ul>
<h2>Emergencies do not wait for herbs</h2>
<p>Chest pain, difficulty breathing, heavy bleeding, a bad fall, anything sudden: go to the hospital's accident and emergency department, or call <strong>999</strong>. Herbal medicine is for the slow complaints it is good at. No family will thank you for patiently simmering a prescription while someone is turning blue.</p>
<h2>Useful phrases</h2>
<p><strong>我想睇中醫</strong> (ngo5 soeng2 tai2 zung1 ji1) — I would like to see a Chinese medicine practitioner. <strong>呢啲中藥點煎？</strong> (ni1 di1 zung1 joek6 dim2 zin1) — how do I boil these herbs? <strong>係咪要先浸吓？</strong> (hai6 mai6 jiu3 sin1 zam3 haa5) — do they need soaking first? <strong>一日煎幾多次？</strong> (jat1 jat6 zin1 gei2 do1 ci3) — how many boils a day? For the words you would need when someone in the house is simply unwell, the phrases in <a href="/guide/cantonese-for-elderly-care">Cantonese for Elderly Care</a> are the ones that get used.</p>
<h2>Useful to know</h2>
<p>中醫 (<strong>zung1 ji1</strong>) — Chinese medicine; 中醫師 (<strong>zung1 ji1 si1</strong>) — a Chinese medicine practitioner. 中藥 (<strong>zung1 joek6</strong>) — a prescription of Chinese herbs. 煎 (<strong>zin1</strong>) — to boil a decoction. 涼茶 (<strong>loeng4 caa4</strong>) — herbal tea. 老火湯 (<strong>lou5 fo2 tong1</strong>) — slow-simmered clear soup. 熱氣 (<strong>jit6 hei3</strong>) — "heaty", the state herbal tea is taken for. 把脈 (<strong>baa2 mak6</strong>) — taking the pulse, the diagnosis you will watch at every consultation.</p>`,
  },
];

// ---------------------------------------------------------------------------
// Living — supportive passages about life in Hong Kong, grouped by situation.
//
// These are EDITORIAL, not user-submitted: passages the operator writes to meet
// a helper where she is — sick, homesick, short of money, lonely on a rest day.
// The helper reads them by category and can react, comment and share, Facebook-
// style. Categories: medical, holiday, entertainment, homesick, food, transport,
// churches. Bodies are plain text in four languages; a blank column falls back to
// English on the client. Keep bodies warm and practical, never preachy.
// ---------------------------------------------------------------------------
const SEED_LIVING = [
  {
    "slug": "living-before-system",
    "category": "before",
    "sub_key": "bf_system",
    "icon": "🧭",
    "status": "published",
    "published_at": "2026-10-22T09:00:00.000Z",
    "title_en": "Understanding Hong Kong Before You Come",
    "sub_en": "What the foreign domestic helper system really means",
    "body_en": "If you are in the Philippines or Indonesia thinking about working in Hong Kong, understand the system before you decide. A clear picture helps you choose well and avoid surprises.\n\nWHAT A FOREIGN DOMESTIC HELPER IS\nA foreign domestic helper (FDW) is hired to live in the employer's home and do household work and care — cleaning, cooking, childcare, or looking after the elderly. Almost all are women from the Philippines and Indonesia.\n\nTHE LIVE-IN RULE\nBy law, you live with your employer. You get your own sleeping space, but you are part of the household. This means less privacy than you may be used to, and you are on call within the home.\n\nTHE EMPLOYMENT VISA\nYour visa is tied to ONE employer. You cannot change jobs freely; to work for someone else you must get a new contract and visa. If your contract ends or is cancelled, you must leave Hong Kong within two weeks — the \"2-week rule.\" This is the single most important thing to understand before you come.\n\nTHE CONTRACT AND PAY\nYou sign a Standard Employment Contract (ID 407). Your pay must be at least the Minimum Allowable Wage (MAW) for foreign domestic helpers.\n\nTHE MINIMUM WAGE — HK$5,220 PER MONTH\nThe MAW applies to contracts signed on or after 3 October 2026. It rose from HK$5,100 to HK$5,220, so any contract signed on or after that date must pay at least HK$5,220 a month. Always confirm the current figure with the Labour Department before you sign, because it can be adjusted. This is the minimum monthly wage for FDWs — it is a special rate that is separate from Hong Kong's general minimum wage, which does NOT apply to live-in foreign domestic helpers. The employer also provides free accommodation, medical care, and your return ticket home.\n\nWHO CAN HIRE\nEmployers must meet an income test (about HK$15,000 a month) and prove they need a helper. FDWs are exempt from the pension (MPF) scheme. An old employer levy was abolished in 2013, so employers no longer pay it.\n\nIS HONG KONG RIGHT FOR YOU?\nHong Kong pays more than many places, but living costs are high and the work is live-in. Decide based on real numbers, not promises. Talk to someone who has been, and use official sources.\n\nSTEP BY STEP\n1. Learn the live-in rule and 2-week rule.\n2. Confirm the current minimum wage with the Labour Department.\n3. Talk to a helper who has worked in Hong Kong.\n4. Compare the offer with other countries.\n5. Use POLO/OWWA or BP2MI before you sign.\n\nWHERE TO GET HELP\n- Labour Department (Hong Kong): 2815 2200, official rules.\n- POLO / OWWA: for Filipino workers, before and after arrival.\n- Indonesian Consulate General / BP2MI: for Indonesian workers.\n- Asian Domestic Workers Union (ADWU): honest advice.\n- Mission for Migrant Workers (MFMW): support.\n- HELP for Domestic Workers: rights education.\n\nKEY THINGS TO REMEMBER\nKnowing the system protects you. The visa is tied to one employer, the 2-week rule is strict, and the minimum wage is the law. Decide with facts, not hope alone.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  },
  {
    "slug": "living-before-contract",
    "category": "before",
    "sub_key": "bf_contract",
    "icon": "📝",
    "status": "published",
    "published_at": "2026-10-22T10:30:00.000Z",
    "title_en": "Your Contract and Your Rights",
    "sub_en": "Read it before you sign — it is your protection",
    "body_en": "Your employment contract is the most important document you will sign. Read it, understand it, and keep your own copy. It is your protection if anything goes wrong.\n\nTHE STANDARD CONTRACT (ID 407)\nEvery FDW in Hong Kong uses the same Standard Employment Contract. Key points:\n\n- Salary: at least the Minimum Allowable Wage for FDWs.\n\nTHE MINIMUM WAGE — HK$5,220 PER MONTH (FROM 3 OCTOBER 2026)\nThe HK$5,220 minimum wage applies to contracts signed on or after 3 October 2026. It was raised from HK$5,100, so any new contract dated on or after that day must pay at least HK$5,220 a month. Confirm the exact current figure with the Labour Department, as the rate can be reviewed. This is the FDW minimum wage — it is separate from Hong Kong's general minimum wage, which does not apply to live-in helpers.\n- Food: if the employer does not provide food, they must pay a food allowance (about HK$1,236 per month — verify the current amount).\n- Accommodation: free, with your own sleeping space.\n- Medical: the employer must provide medical care.\n- Return passage: the employer pays your trip home at the end of the contract.\n- Rest day: one full day off every seven days.\n- Paid sick leave: after one month, you earn paid sick days with a doctor's certificate.\n- Bonus: if you finish one year, you get a pro-rata end-of-year payment.\n- Notice: ending the contract needs one month's notice or payment in place of notice.\n\nREAD BEFORE YOU SIGN\nNever sign a blank contract. Check the salary, rest day, and whether food is provided. Make sure the employer's name and your name are correct. If something is unclear, ask POLO/OWWA (for Filipinos) or BP2MI / the Indonesian Consulate (for Indonesians) before signing.\n\nKEEP YOUR COPY\nYour employer keeps the original, but you must have your own copy. Photograph it and save it in your phone. You may need it to prove your terms.\n\nIF THINGS GO WRONG\nIf pay is withheld or conditions break the contract, the Labour Department can help. Free legal advice exists through helper organisations.\n\nSTEP BY STEP\n1. Read every line before signing.\n2. Confirm salary, food, and rest day.\n3. Get POLO/OWWA or BP2MI to attest the contract.\n4. Photograph your signed copy.\n5. Save important numbers in your phone.\n\nWHERE TO GET HELP\n- Labour Department: 2815 2200, employment rights.\n- POLO / OWWA: contract attestation for Filipinos.\n- Indonesian Consulate General / BP2MI: for Indonesians.\n- Asian Domestic Workers Union (ADWU): contract advice.\n- HELP for Domestic Workers: rights education.\n- Mission for Migrant Workers (MFMW): legal referrals.\n\nKEY THINGS TO REMEMBER\nThe contract is your shield. Read it, keep it, and know your rights before you board the plane.\n\nREAD BEFORE YOU SIGN\nRead every line of the Standard Employment Contract (ID 407) before you sign, and keep your own copy in your phone and a paper copy at home. Check the salary — it must be at least HK$5,220 a month for contracts signed on or after 3 October 2026 — the food allowance (HK$1,236 a month if no food is provided), and the free accommodation. POLO/OWWA (for Filipinos) or BP2MI (for Indonesians) must attest the contract, which is your protection against unfair terms. Free legal-advice NGOs can explain anything you do not understand. Never sign a blank contract or one with a different employer's name than the agency promised.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  },
  {
    "slug": "living-before-costs",
    "category": "before",
    "sub_key": "bf_costs",
    "icon": "💰",
    "status": "published",
    "published_at": "2026-10-22T12:00:00.000Z",
    "title_en": "The Real Costs of Coming to Hong Kong",
    "sub_en": "Be honest about money before you decide",
    "body_en": "Hong Kong can pay well, but the costs and risks are real. Being honest about money before you come protects you from debt and disappointment.\n\nTHE WAGE\nA helper's pay starts at the minimum wage. After sending money home, the amount left for your own needs in Hong Kong may be small. Work out your real budget, not just the headline salary.\n\nAGENCY FEES — WATCH OUT\nHong Kong law limits a LOCAL agency's fee to 10% of your first month's wages. But fees charged in your home country can be much higher, and some workers borrow to pay them. This creates a debt trap that takes months or years to clear. Never borrow at very high interest to come.\n\nOTHER COSTS\n- Airfare (often your own, at least one way).\n- Documents, medical checks, and visa photos.\n- Daily living: phone, transport, food if not provided, sending money home.\n\nPROS AND CONS\nPros: higher pay than many countries, free accommodation, a clear contract, a large helper community. Cons: live-in with little privacy, high living costs, the strict 2-week rule if the job ends, and the risk of unfair agencies.\n\nAVOID DEBT AND BAD FEES\nUse only licensed agencies. Go through POLO/OWWA (Filipinos) or BP2MI (Indonesians), which regulate placement. If an agency demands a huge fee or your passport, stop and report it.\n\nCOUNT THE REAL TAKE-HOME\nSit down with a pen. Write your salary, minus what you must send home, minus phone, transport, and food. What remains is your true Hong Kong budget. If it is close to zero, ask whether two years away from your children is worth it.\n\nLEARN FROM REAL HELPERS\nTalk to at least two helpers who worked in Hong Kong recently, not just one with a perfect story. Ask what they kept after sending money home, how private their room was, and whether the agency fee was fair. Honest stories beat advertisements. If the maths does not build a better life for your family, waiting for a better offer may be the smarter choice.\n\nREMEMBER THE 2-WEEK RULE\nBuild the cost of the 2-week rule into your thinking. If a job ends early, you have only two weeks to leave Hong Kong unless you quickly find a new employer and a new contract. A small savings buffer before you fly protects you from that pressure.\n\nSTEP BY STEP\n1. Calculate the real take-home pay after sending money home.\n2. Ask the exact agency fee, in writing.\n3. Refuse to hand over your passport.\n4. Use POLO/OWWA or BP2MI, not informal brokers.\n5. Only sign when the numbers make sense.\n\nWHERE TO GET HELP\n- POLO / OWWA: regulated placement for Filipinos.\n- Indonesian Consulate General / BP2MI: for Indonesians.\n- Employment Agencies Administration (EAA): complaints about agencies.\n- Asian Domestic Workers Union (ADWU): advice.\n- HELP for Domestic Workers: rights education.\n- Enrich: free money-management workshops.\n\nKEY THINGS TO REMEMBER\nThe job is only good if the maths works. Beware debt and unfair fees. Decide with clear numbers, and use official channels only.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  },
  {
    "slug": "living-before-help",
    "category": "before",
    "sub_key": "bf_help",
    "icon": "🤝",
    "status": "published",
    "published_at": "2026-10-22T13:30:00.000Z",
    "title_en": "Where to Get Help — Before and After",
    "sub_en": "Save these numbers before you need them",
    "body_en": "Help exists at every step — before you leave home, during your contract, and if you ever need to leave a bad situation. The smartest thing you can do is save the important contacts now, before you need them.\n\nBEFORE YOU COME\n- POLO / OWWA (Filipino workers): processes your contract, runs pre-departure orientation, and protects your rights. Use them, not informal brokers.\n- Indonesian Consulate General / BP2MI (Indonesian workers): regulates placement and supports you before and after arrival.\n- Licensed employment agencies only: verify with the Employment Agencies Administration (EAA).\n\nAFTER YOU ARRIVE\n- Labour Department: 2815 2200. The government office for employment rights, pay disputes, and the 2-week rule.\n- Immigration Department: visa and status questions.\n- Employment Agencies Administration (EAA): complaints against agencies.\n- Asian Domestic Workers Union (ADWU): join for advice, community, and rights support.\n- Mission for Migrant Workers (MFMW): counselling, legal referrals, and a drop-in centre.\n- HELP for Domestic Workers: rights education and case help.\n- Bethune House: a refuge for helpers who need safe shelter.\n- Enrich: free money and wellbeing workshops.\n\nIN AN EMERGENCY\n- Police, Ambulance, Fire: 999.\n- The Samaritans: 2896 0000, 24-hour confidential talk.\n- Your consulate: if you are stranded, abused, or need to go home.\n\nIF YOU NEED TO LEAVE\nIf your workplace is unsafe or your pay is withheld, do not run without a plan. Contact MFMW, ADWU, or your consulate first. Shelters like Bethune House exist, and your consulate can help with the trip home.\n\nCHECK THE AGENCY\nBefore paying any agency, ask for its licence number and verify it with the EAA. A real agency will show it proudly.\n\nPROTECT YOURSELF FROM DAY ONE\nKeep your passport somewhere safe, not with your employer. Save your contract photo, your agency's licence number, and the Labour Department number in your phone from the very first day. If you keep a small emergency fund, you can travel home if a job ends suddenly and the 2-week rule closes in. Preparation is the best protection.\n\nSPEAK TO OTHER HELPERS EARLY\nThe first weeks are the most vulnerable. Find one trustworthy helper in your first week, someone who can explain how things really work and who to call. A single friend is often the difference between a safe first contract and a painful one.\n\nSTEP BY STEP\n1. Save these numbers in your phone now.\n2. Use POLO/OWWA or BP2MI before signing.\n3. Keep your contract photo and passport separate and safe.\n4. Contact a helper group at the first sign of trouble.\n5. Never face a problem alone.\n\nKEY THINGS TO REMEMBER\nYou have more support than you think. Save the contacts, use official channels, and reach out early. Asking for help is strength, not shame.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  },
  {
    "slug": "living-medical-sick",
    "category": "medical",
    "sub_key": "med_sick",
    "icon": "🤒",
    "status": "published",
    "published_at": "2026-10-15T09:00:00.000Z",
    "title_en": "When You Feel Sick in Hong Kong",
    "sub_en": "Your health matters, and you have the right to see a doctor",
    "body_en": "You do not have to push through sickness to prove you are a good helper. Many helpers worry that telling the employer they are unwell will be seen as laziness, or that wages will be cut. That fear is real, but your health comes first. A helper who is rested and treated recovers faster and works better.\n\nWHY THIS MATTERS\nWorking while seriously ill can turn a small problem into a hospital stay. It also puts the people you care for at risk, especially young children and the elderly. Telling your employer early is not weakness — it is responsible.\n\nWHAT TO DO FIRST\nAs soon as you feel unwell in the morning, send a short, polite message: \"Good morning, I am not feeling well today and may need to see a doctor. I will let you know if I need rest.\" Keep it simple and honest. If you live in, tell the person you report to in person when possible.\n\nKNOW YOUR RIGHTS\nIf you have been employed for at least one month, you build up paid sickness days — two paid sick days for every month of service, up to 120 days per year. To use paid sick leave you must give your employer a medical certificate from a registered doctor. Without a certificate, the employer may treat the day as unpaid, but you still have the right to see a doctor.\n\nWHEN IT IS AN EMERGENCY\nDo not wait if you have chest pain, trouble breathing, fainting, a very high fever, or if a child or elderly person in the home is in distress. Call 999 for an ambulance, or go straight to the Accident and Emergency department of the nearest public hospital. Emergency care is for everyone.\n\nSTEP BY STEP\n1. Notice the symptoms and rest as much as you can.\n2. Drink warm water and watch your temperature.\n3. If it is not better after two days, or it gets worse, see a doctor.\n4. Ask the clinic for a medical certificate for your employer.\n5. If your employer refuses to pay lawful sick leave, contact the Labour Department.\n\nWHERE TO GET HELP\n- Public hospital Accident and Emergency: call 999 in an emergency.\n- Government General Outpatient Clinics: low-cost visits with a medical certificate.\n- Private clinics and doctors: walk-in, faster but cost more.\n- Labour Department: 2815 2200, for problems with sick pay.\n- Mission for Migrant Workers (MFMW): counselling and advice.\n- Asian Domestic Workers Union (ADWU): support with employment issues.\n\nA REAL EXAMPLE\nMarites felt dizzy but went to work cleaning. By noon she fainted. Her employer took her to A&E, where she was treated for dehydration. After that, her employer understood that a same-day message about feeling unwell prevents bigger problems.\n\nKEY THINGS TO REMEMBER\nYour health is not a luxury. Tell your employer early, see a doctor when needed, keep your medical certificate, and know that paid sick leave exists after one month of work. You are worth taking care of.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  },
  {
    "slug": "living-medical-doctor",
    "category": "medical",
    "sub_key": "med_doctor",
    "icon": "🩺",
    "status": "published",
    "published_at": "2026-10-15T10:30:00.000Z",
    "title_en": "Seeing a Doctor Without Fear",
    "sub_en": "Public or private, walk-in or booked — here is how it works",
    "body_en": "Seeing a doctor in Hong Kong is easier than many helpers expect. You have choices, and help with language is available. The hardest part is often the worry, not the system.\n\nPUBLIC OR PRIVATE\nPublic hospitals and Government General Outpatient Clinics (GOPC) are low cost and serve everyone, including foreign workers. Private doctors and clinics are faster and more flexible but cost more. For routine sickness, either works. For emergencies, go to a public hospital Accident and Emergency department.\n\nWALK-IN AND BOOKING\nMany private clinics take walk-ins. GOPC clinics usually ask you to book a same-day appointment by phone or queue early in the morning. Bring your Hong Kong ID and, if you have it, a copy of your employment contract.\n\nFREE LANGUAGE HELP\nPublic hospitals provide a free interpreter service in many languages, including Tagalog and Bahasa Indonesia. Tell the reception staff which language you speak and ask for an interpreter. You do not have to explain your symptoms in English or Cantonese if you are not comfortable.\n\nGET YOUR CERTIFICATE\nAlways ask the doctor for a medical certificate (sick note). Your employer needs it for sick leave records, and you may need it for the Labour Department if there is a dispute. Check the certificate shows the dates you should rest.\n\nCOSTS\nAt a public GOPC, a standard visit is a small fee, and people with low income can apply for a fee waiver through the Community Care Fund. Private visits cost more but are still affordable for a single consultation. Keep your receipt.\n\nSTEP BY STEP\n1. Decide public or private based on your need and budget.\n2. Bring ID, contract copy, and any medicine you already take.\n3. Tell the doctor your symptoms simply and honestly.\n4. Ask for an interpreter if you need one.\n5. Get the medical certificate and keep the receipt.\n\nWHERE TO GET HELP\n- Hospital Authority: information on public clinics and A&E.\n- Government General Outpatient Clinics: low-cost consultations.\n- Community Care Fund: fee waivers for those who qualify.\n- Mission for Migrant Workers (MFMW): health and rights advice.\n- Labour Department: 2815 2200, if an employer questions your certificate.\n- HELP for Domestic Workers: support and referrals.\n\nA REAL EXAMPLE\nAna had a bad cough for a week. She feared the clinic would be confusing, but the hospital interpreter helped her explain everything in Tagalog. The doctor gave medicine and a certificate, and her employer accepted it without problem.\n\nKEY THINGS TO REMEMBER\nYou deserve care, not silence. Public and private options exist, interpreters are free in public hospitals, and a medical certificate protects you. Seeing a doctor early is always the smarter choice.\n\nKEY THINGS TO REMEMBER\nBring your Hong Kong ID card and your employment contract to every visit, even a walk-in clinic. Always ask the doctor or nurse for a medical certificate (some call it a sick note) before you leave — you need it for your employer and for paid sick leave. If the doctor prescribes medicine, ask the name and when to take it. Public hospitals and clinics can give you an interpreter in Tagalog or Bahasa Indonesia for free; just tell the reception staff which language you need. Keep your receipts in a small envelope so you can show your employer what you paid.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  },
  {
    "slug": "living-holiday-home",
    "category": "holiday",
    "sub_key": "hol_home",
    "icon": "✈️",
    "status": "published",
    "published_at": "2026-10-16T09:00:00.000Z",
    "title_en": "Going Home: Saving for the Trip",
    "sub_en": "A simple plan so the visit you dream of becomes real",
    "body_en": "The trip home is worth every sacrifice. But plane tickets are expensive, and the pressure to send money to family every month can leave little left for your own visit. A small, steady plan makes the difference.\n\nWHY THIS MATTERS\nSeeing your children, parents, and husband or wife fills a hole that video calls cannot. It also reminds you why you work far away. Planning early means cheaper tickets and less stress.\n\nSTART THE MOMENT THE SALARY ARRIVES\nWhen money lands in your account, move a fixed amount to savings first — before paying debts or sending remittance. Even HK$500 a month, started a year ahead, becomes HK$6,000. The money you see leave first is the money you will not spend.\n\nBOOK EARLY\nAirfares to the Philippines and Indonesia change with the season. School holidays and Christmas are the most expensive. If you can travel in the low season, or book three to six months ahead, you can save a lot. Watch for early-bird sales from the airlines.\n\nBALANCE REMITTANCE AND SAVING\nFamily needs are real, but so is your need to come home. Talk openly with your family about a small monthly amount that goes only to your visit fund. When they know the goal, they can help protect it.\n\nMAKE THE MOST OF REST DAYS\nWhile home, your rest day is your own. Use it to rest, not to take on extra paid jobs that delay your healing. The point of the trip is to reconnect.\n\nWHERE TO GET HELP\n- POLO / OWWA: travel and welfare support for Filipino workers.\n- Indonesian Consulate General: assistance for Indonesian workers.\n- Enrich: free money-management workshops for helpers.\n- Remittance centres: compare fees; small differences add up.\n- Migrant worker groups: shared tips on cheap tickets and packing.\n- Your church or community: group buys and travel advice.\n\nA REAL EXAMPLE\nGrace saved HK$800 a month for ten months, booked a January ticket in August, and flew home spending far less than a friend who bought at Christmas. The extra months of planning paid for gifts her children remembered all year.\n\nKEY THINGS TO REMEMBER\nPay yourself first, book early, and let family know the plan. The day you hug them again will make the waiting worthwhile.\n\nA SIMPLE WAY TO SAVE\nOpen a separate savings pocket in your bank app and move a fixed amount there the same day your salary arrives, before you send money home. Even HK$200 to 400 each month adds up to a real ticket by the time your contract allows a long break. Book flights two to three months early and compare both the Philippine and Indonesian carriers and the Gulf and Asian airlines, because prices change daily. If your family expects a big balikbayan box every time, agree together on a smaller, once-a-year box and put the rest toward your visit. POLO/OWWA and some community groups can advise on cheaper travel and on the documents you need to leave and return without problems.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  },
  {
    "slug": "living-holiday-rest",
    "category": "holiday",
    "sub_key": "hol_rest",
    "icon": "🌿",
    "status": "published",
    "published_at": "2026-10-16T10:30:00.000Z",
    "title_en": "Your Rest Day Is Yours",
    "sub_en": "The law gives you one full day off a week — use it for you",
    "body_en": "Your weekly rest day is a right written into Hong Kong law, not a favour from your employer. Knowing this helps you protect your time and your wellbeing.\n\nTHE LAW\nEvery helper is entitled to at least one rest day every period of seven days. A rest day is one uninterrupted period of not less than 24 hours. It is normally a Sunday, but the exact day is agreed with your employer.\n\nYOU CHOOSE HOW TO SPEND IT\nSleep, pray, walk, meet friends, or simply sit quietly — it is your time. You do not owe anyone an explanation for how you spend it. Many helpers use the rest day to recharge so they can keep going through the week.\n\nIF YOUR EMPLOYER ASKS YOU TO WORK\nYour employer cannot force you to work on your rest day. If they ask and you agree, the work must be compensated: either another rest day within the same month, or extra wages. You always have the right to say no.\n\nWHEN PRESSURE HAPPENS\nSome employers ask helpers to \"stay in\" or do light chores on the rest day. A polite reply works: \"I understand, but my contract gives me this day to rest. Can we agree on another time?\" If pressure continues or you are made to work without pay, that is a labour issue.\n\nIDEAS FOR THE DAY\n- Join your church or community gathering.\n- Meet friends in a park or at the waterfront.\n- Learn something new at a public library or community centre.\n- Rest properly so your body recovers.\n\nWHERE TO GET HELP\n- Labour Department: 2815 2200, for rest-day disputes.\n- Asian Domestic Workers Union (ADWU): advice and support.\n- Mission for Migrant Workers (MFMW): counselling.\n- HELP for Domestic Workers: rights education.\n- Your consulate (POLO/OWWA or Indonesian Consulate): assistance.\n- Enrich: wellbeing and money workshops.\n\nA REAL EXAMPLE\nWhen her employer kept asking Lina to babysit on Sundays, she showed the rest-day rule from her contract and proposed a paid swap. They agreed on extra wages for the occasional Sunday, and her regular day off was protected.\n\nKEY THINGS TO REMEMBER\nYour rest day is yours by law. You can say no to work, and any agreed work must be paid or swapped. Guard those hours — they are the breath that lets you keep going.\n\nHOW TO SAY IT POLITELY\nIf an employer asks you to just stay in on your rest day, you can say: \"Thank you, but my contract gives me one rest day each week. I will rest at my friend's place so I have energy for the week.\" You are not being rude — you are following the law. An employer cannot force you to work on your rest day. If you agree to work, you must be given another rest day or extra pay. Good rest-day plans: borrow a library book, sit in a park, join a church group, or video-call home. If an employer keeps your rest day from you, note the dates and speak to the Labour Department.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  },
  {
    "slug": "living-entertainment-free",
    "category": "entertainment",
    "sub_key": "ent_free",
    "icon": "🎶",
    "status": "published",
    "published_at": "2026-10-17T09:00:00.000Z",
    "title_en": "Free Time That Lifts You",
    "sub_en": "Joy does not have to cost money",
    "body_en": "Free time is not wasted time. When you live far from home and work hard, small moments of joy are not a luxury — they are part of surviving and staying well.\n\nWHY THIS MATTERS\nLoneliness grows in empty hours. Filling them with simple, free things you love protects your mood and your health. You do not need money to feel alive.\n\nTHINGS THAT COST NOTHING\n- A video or voice call home, even ten minutes.\n- A favourite song, sung or played.\n- A walk in a park, along the waterfront, or up a gentle hill.\n- A book or magazine from a public library.\n- Time with friends, sharing stories and food.\n\nPUBLIC PLACES MADE FOR YOU\nHong Kong has many free or low-cost public spaces run by the Leisure and Cultural Services Department: parks, beaches, swimming pools (small fee), libraries, and museums with free admission days. Community centres often host free activities for migrant workers.\n\nSMALL RITUALS\nBuild tiny habits: a Sunday call with your child, a Monday evening walk, a Friday listen to one song that reminds you of home. Rituals give the week shape and something to look forward to.\n\nSTEP BY STEP\n1. Pick one free thing you enjoy.\n2. Put it in your week like an appointment.\n3. Protect it the way you protect work.\n4. Notice how your mood lifts, and add another.\n\nWHERE TO GET HELP\n- Leisure and Cultural Services Department: free parks, libraries, pools.\n- Public libraries: books, free wifi, events.\n- Community centres: activities and classes.\n- Your church or fellowship: friendship and support.\n- Migrant worker groups: free social events.\n- Enrich: workshops on wellbeing and money.\n\nA REAL EXAMPLE\nRosa started a ten-minute Sunday-night call with her daughter to read a story together. It cost nothing, but her daughter began sleeping better, and Rosa felt less alone through the week.\n\nKEY THINGS TO REMEMBER\nJoy is part of surviving far from home. The best things — a call, a song, a walk, a friend — are free. Find the small things that make you smile, and protect them.\n\nFREE PLACES TO GO\nHong Kong has many free or nearly free places. Public libraries let you borrow books, use free Wi-Fi, and join free events, and they are quiet, cool, and safe on a hot day. Museums such as the Hong Kong Museum of History have free admission on Wednesdays. Beaches like Repulse Bay and Shek O, and country parks with easy walks such as the Peak Circle Walk, cost nothing. The Leisure and Cultural Services Department runs free concerts and sports days. Spending an afternoon reading, walking by the sea, or singing with friends lifts your mood far more than scrolling alone in a small room.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  },
  {
    "slug": "living-entertainment-places",
    "category": "entertainment",
    "sub_key": "ent_places",
    "icon": "🌳",
    "status": "published",
    "published_at": "2026-10-17T10:30:00.000Z",
    "title_en": "Places to Go on a Sunday",
    "sub_en": "Where Hong Kong opens its arms to helpers",
    "body_en": "On a Sunday, Hong Kong belongs to its helpers. Parks, the waterfront, and open squares fill with friends, food, laughter, and music. You do not need money to belong.\n\nSTATUE SQUARE AND CHATER ROAD\nIn Central, Statue Square and Chater Road become a gathering place where thousands of Filipino helpers meet, eat, sing, and rest together. Bring a mat, share food, and enjoy the one day that feels like yours.\n\nVICTORIA PARK\nIn Causeway Bay, Victoria Park is another big Sunday meeting point, especially for Indonesian helpers. There is space to sit, talk, and join community events.\n\nBEACHES AND COUNTRY PARKS\nHong Kong has clean beaches and green hiking trails. A bus or minibus can take you to the sea or a hill with a view. Fresh air and open space do wonders for a tired body.\n\nWHAT TO BRING\n- A mat or towel to sit on.\n- Water and shared snacks.\n- A small bag with your phone, ID, and Octopus card.\n- A jacket if it gets cool in the evening.\n\nSTAYING SAFE IN CROWDS\nKeep your bag close, agree a meeting spot with friends, and charge your phone before you leave. If you feel unwell, step to a quieter area and tell a friend.\n\nSTEP BY STEP\n1. Choose a place near you or easy to reach by MTR and bus.\n2. Go with friends or join a group from your church.\n3. Arrive earlier for a good spot.\n4. Leave with enough time to get home before dark if needed.\n\nWHERE TO GET HELP\n- Leisure and Cultural Services Department: parks and beaches info.\n- MTR and bus apps: plan your route.\n- Your church or community: organised Sunday gatherings.\n- Migrant worker groups: meet-up tips and safety.\n- Police: 999, or ask a uniformed officer if lost.\n- Tourist information centres: maps and advice.\n\nA REAL EXAMPLE\nOn her first Sunday, Jen felt shy and stayed in. The next week a friend brought her to Victoria Park. Sitting among familiar faces and shared food, she finally felt she was not alone in the city.\n\nKEY THINGS TO REMEMBER\nYou are not alone out there. Hong Kong has free, welcoming places made for you every Sunday. Bring a mat, bring a friend, and claim your day.\n\nWHAT TO BRING AND HOW TO STAY SAFE\nOn Sundays, thousands of helpers gather at Statue Square and Chater Road in Central and at Victoria Park in Causeway Bay. Bring a mat, water, shared snacks, and a fully charged phone. These are happy, safe gatherings, but in any big crowd keep your bag closed and stay with friends. If you feel unwell or lost, walk to a nearby shop or MTR station and ask a staff member in a red uniform for help. Many churches and groups also meet on Sundays, so you can find both community and quiet in the same day.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  },
  {
    "slug": "living-homesick-missing",
    "category": "homesick",
    "sub_key": "hom_missing",
    "icon": "💌",
    "status": "published",
    "published_at": "2026-10-18T09:00:00.000Z",
    "title_en": "Missing Family Far Away",
    "sub_en": "Love across distance is still love",
    "body_en": "Missing your family does not mean you are weak. It means you love them, and love does not switch off because you are far away. The ache is proof of a bond worth everything.\n\nWHY THIS MATTERS\nMany helpers carry quiet guilt — that they are not there for their children, or that parents are ageing without them. That guilt is heavy, but it is also love. Naming it helps you carry it.\n\nA SIMPLE PLAN TO STAY CLOSE\n- Set a regular call time with family, even if short.\n- Send photos and voice messages through the week, not only on rest days.\n- Involve children in small decisions, like what to cook or wear.\n- Keep a notebook of their milestones so you feel part of them.\n\nDEALING WITH GUILT\nYou left to give your family a better life. Remind yourself of that purpose on hard days. Talking to other helpers who are parents helps — you are not the only one feeling this.\n\nSUPPORTING CHILDREN FROM AFAR\nChildren need to feel you are present, not perfect. A consistent ten-minute call means more than rare long ones. Praise their effort in school, and listen when they are sad.\n\nWHEN IT HURTS TOO MUCH\nIf missing home stops you sleeping or working, reach out. Counselling is not only for crises; it is for carrying heavy feelings well.\n\nWHERE TO GET HELP\n- Church or fellowship: prayer and community.\n- Mission for Migrant Workers (MFMW): counselling.\n- Caritas: family and emotional support.\n- The Samaritans: 2896 0000, 24-hour someone to talk to.\n- POLO / OWWA: family welfare services for Filipinos.\n- Indonesian Consulate General: support for Indonesians.\n\nA REAL EXAMPLE\nTomas felt guilty he missed his son's first day of school. His wife filmed it and sent it with a message. Watching it together on a call turned guilt into pride, and they planned a monthly \"school story\" call.\n\nKEY THINGS TO REMEMBER\nThe distance is temporary; what you share is not. Missing them means you love them. Stay close in small ways, and ask for help when the weight grows.\n\nSTAYING CLOSE FROM FAR AWAY\nSet a fixed call time each week with your children or parents so they know when to expect you, and keep the promise even when you are tired. Let your family help with small decisions, like which photo to print or what to cook, so they feel part of your life. For your children's schooling, ask their teacher for a short monthly update and record a bedtime story they can replay. Sending money is love, but a short voice message saying \"I am proud of you\" matters just as much. Guilt is normal; it does not mean you are a bad mother or daughter.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  },
  {
    "slug": "living-homesick-lonely",
    "category": "homesick",
    "sub_key": "hom_lonely",
    "icon": "🌙",
    "status": "published",
    "published_at": "2026-10-18T10:30:00.000Z",
    "title_en": "Lonely Evenings Are Normal",
    "sub_en": "The quiet after a long day, and how to get through it",
    "body_en": "Some evenings feel heavy, and that is normal. After a long day of work, the quiet of a small live-in room can swallow you whole. You are not broken for feeling this.\n\nWHY THIS MATTERS\nLoneliness left unspoken grows. Reaching for one small connection before the silence deepens is one of the kindest things you can do for yourself.\n\nBUILD A ROUTINE\nA simple evening rhythm helps: a short walk, a call home, a shower, an early night. Routine tells your mind the day has a shape and an end.\n\nFIND YOUR PEOPLE\nJoin a church, a community group, or an evening class. Even one friend you can message at the end of the day changes everything. Connection does not have to be big to count.\n\nLOW-COST COMFORT\n- A familiar song or podcast in your language.\n- A short video call with someone who knows you.\n- Writing a few lines in a journal.\n- A warm drink and an early rest.\n\nKNOW THE WARNING SIGNS\nIf sadness lasts weeks, you stop eating or sleeping, or you feel hopeless, that is more than loneliness. It may be depression, and it deserves real help — not silence.\n\nSTEP BY STEP\n1. Notice the feeling instead of hiding it.\n2. Reach for one connection — a text, a call, a voice.\n3. Keep a small routine that ends the day well.\n4. If it persists, tell someone and seek support.\n\nWHERE TO GET HELP\n- The Samaritans: 2896 0000, 24-hour confidential talk.\n- Caritas: counselling and emotional support.\n- Mission for Migrant Workers (MFMW): counselling.\n- Your church or fellowship: prayer and friendship.\n- Asian Domestic Workers Union (ADWU): peer support.\n- Labour Department: 2815 2200, if work stress is the cause.\n\nA REAL EXAMPLE\nAfter a hard week, Precy messaged a friend from church instead of staying quiet. They met for a walk on Sunday, and the heavy feeling lifted enough to keep going.\n\nKEY THINGS TO REMEMBER\nYou have made it through every hard night so far, and this one too shall pass. Lonely evenings are normal — but you do not have to face them alone.\n\nSMALL HABITS THAT HELP\nA simple daily rhythm stops the long evenings from feeling empty: a short walk, a phone call home, a book from the library, a shared meal with a friend. Try a low-cost hobby such as sewing, singing, jogging, or a free language class at a community centre. Sadness becomes a problem when you stop eating, sleeping, or leaving your room for days. If that happens, tell someone: a friend, your church, or a helpline. The Samaritans (2896 0000, 24 hours) and MFMW counselling are free and confidential. Reaching out early is strength, not weakness.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  },
  {
    "slug": "living-food-money",
    "category": "food",
    "sub_key": "food_money",
    "icon": "🍚",
    "status": "published",
    "published_at": "2026-10-19T09:00:00.000Z",
    "title_en": "Not Enough Money for Food",
    "sub_en": "Eating well on a small budget is possible",
    "body_en": "When money runs short, food is often the first worry. After sending money home, the amount left for yourself can feel too small. You are not failing — the cost of living in Hong Kong is high for everyone.\n\nWHY THIS MATTERS\nSkipping meals hurts your health and your work. Cheap, filling food is available if you know where to look and how to plan.\n\nCHEAP STAPLES\nRice, eggs, noodles, canned fish or beans, and seasonal vegetables are filling and cheap. A few of these feed you for days at low cost. Buy what keeps, and cook in batches.\n\nWET MARKETS VS SUPERMARKETS\nWet markets often beat supermarkets on price for vegetables, fruit, and meat, especially near closing time. Supermarkets have cheaper house brands and discounted items near expiry. Compare and choose.\n\nGROUP BUYS\nMany helpers pool orders with friends — rice, cooking oil, or a whole chicken split between households. Buying together lowers the price per person. Ask in your community group.\n\nFOOD ASSISTANCE\nIf you are truly struggling, help exists. Some charities and worker centres give food parcels or hot meals. Asking is not shameful; it is how we look after each other.\n\nSTEP BY STEP\n1. List the cheapest staples you can cook.\n2. Shop at a wet market or discount shelf.\n3. Cook extra and keep leftovers safely.\n4. Join or start a small group buy with friends.\n5. Reach out to a helper group if money is gone.\n\nWHERE TO GET HELP\n- Asian Domestic Workers Union (ADWU): worker support.\n- Mission for Migrant Workers (MFMW): referrals.\n- HELP for Domestic Workers: assistance and advice.\n- Local charities and churches: food parcels.\n- Enrich: money-management workshops.\n- Your consulate (POLO/OWWA or Indonesian Consulate): welfare aid.\n\nA REAL EXAMPLE\nMila joined a five-person group buy for rice and vegetables. Her weekly food cost dropped by nearly half, and the shared cooking became a Sunday she looked forward to.\n\nKEY THINGS TO REMEMBER\nYou are not alone in this. Cheap, good food is possible with planning, and asking a friend where she shops is how we look after each other.\n\nEAT WELL ON A SMALL BUDGET\nRice, eggs, canned sardines, tofu, and seasonal vegetables are cheap and filling. Shop at wet markets near closing time for the best prices, and buy staples in bigger packs with friends. Cook a double portion and share with a roommate to save both money and loneliness. If money is truly short, ask your church or an NGO such as HELP for Domestic Workers or a community centre about food assistance — there is no shame in taking help when you need it. Keep sending money home, but protect a small food fund first so you never skip meals.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  },
  {
    "slug": "living-food-cook",
    "category": "food",
    "sub_key": "food_cook",
    "icon": "🍳",
    "status": "published",
    "published_at": "2026-10-19T10:30:00.000Z",
    "title_en": "Cooking Comforts You",
    "sub_en": "A simple meal can undo a hard day",
    "body_en": "A meal that tastes like home can undo a hard day. Even a tiny kitchen corner is enough for rice, a fried egg, and a memory. Cooking for yourself is not a luxury — it is care.\n\nWHY THIS MATTERS\nFood made your way soothes the homesick heart. It also saves money and keeps you healthy when canteen or employer food does not suit you.\n\nSMALL-KITCHEN COOKING\nYou rarely have a full kitchen, but a rice cooker, one pan, and a small stove are enough. Rice, an egg, and a vegetable become a full meal. A pressure cooker or slow cooker opens even more options.\n\nCHEAP, NUTRITIOUS MEALS\n- Garlic fried rice with egg and greens.\n- Noodles with canned tuna or beans and vegetables.\n- Soup from bones or stock cubes with root vegetables.\n- Omelette with tomato and onion.\nAdd a little protein and a vegetable to every meal so you stay strong.\n\nFOOD SAFETY\nIn a shared kitchen, label your food, keep raw and cooked separate, and refrigerate leftovers promptly. Wash hands before cooking. A small container set stops mix-ups with the employer's food.\n\nCOOK EXTRA, SHARE\nCooking a little more to share with a friend turns a chore into a moment of joy. Feeding a friend is its own comfort, and they may cook for you next time.\n\nSTEP BY STEP\n1. Learn two or three simple dishes you love.\n2. Shop staples once a week at a wet market.\n3. Cook in batches so you have food ready.\n4. Store leftovers safely and label them.\n5. Invite a friend to share sometimes.\n\nWHERE TO GET HELP\n- Community cooking groups: shared recipes and tips.\n- Mission for Migrant Workers (MFMW): community activities.\n- Your church or fellowship: potluck gatherings.\n- Enrich: budgeting workshops that include food tips.\n- Migrant worker groups: online recipe sharing.\n- Asian Domestic Workers Union (ADWU): peer support.\n\nA REAL EXAMPLE\nAfter a bad day, Anna cooked her mother's garlic fried rice. The smell filled the small kitchen, and for a moment she was home. She started cooking extra on Sundays to share with two friends.\n\nKEY THINGS TO REMEMBER\nYou are allowed to take care of you. A simple, cheap meal made your way is medicine for the heart and the body.\n\nEASY, CHEAP, COMFORTING\nA pot of garlic fried rice with an egg, a tin of sardines with tomato, or a simple vegetable soup can taste like home and costs little. In a small live-in kitchen, keep one sharp knife, a pot, and a plate, and clean as you go so the employer is comfortable with you using the space. Store cooked food in a covered container and eat it within a day. Cooking extra and sharing with a friend who is also far from home turns a hard day into a small celebration, and the smell of home cooking can lift the whole flat.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  },
  {
    "slug": "living-transport-taxi",
    "category": "transport",
    "sub_key": "tr_taxi",
    "icon": "🚕",
    "status": "published",
    "published_at": "2026-10-20T09:00:00.000Z",
    "title_en": "Getting Home Safely at Night",
    "sub_en": "Your safety is worth more than speed",
    "body_en": "After a late night out, getting home safely is the most important part of the evening. Plan it before you enjoy yourself, not after you are tired.\n\nLICENSED TAXIS\nUse red taxis in Hong Kong Island, Kowloon, and the New Territories; green taxis in the New Territories; blue taxis on Lantau. Look for the \"TAXI\" sign and the meter. Apps such as HKTaxi let you book and share the ride.\n\nSAFETY HABITS\n- Share your ride details (plate number, time, route) with a friend.\n- Sit where the driver can see you in the mirror.\n- Trust your instinct. If something feels wrong, ask to stop in a lit, busy place.\n- Keep your phone charged and your bag close.\n\nRIDE-HAILING NOTE\nRules around ride-hailing in Hong Kong are limited. For your safety, use licensed taxis rather than unofficial rides.\n\nIF YOU FEEL UNSAFE\nCall 999 for Police or Ambulance. You can also walk into a 24-hour shop or MTR station and ask for help. Do not stay in a car that makes you uneasy.\n\nSTEP BY STEP\n1. Before going out, note the last train or plan a taxi.\n2. Tell a friend your plan and check in when you leave.\n3. Use a licensed taxi and share the plate number.\n4. Stop in a safe place if anything feels wrong.\n\nWHERE TO GET HELP\n- Police: 999, any emergency.\n- HKTaxi and similar apps: licensed taxi booking.\n- MTR: staff and safe waiting areas at stations.\n- Your friend network: a planned check-in call.\n- Mission for Migrant Workers (MFMW): advice.\n- Your consulate: support if you are in trouble.\n\nA REAL EXAMPLE\nOn a late Sunday, Carla shared her taxi plate with a friend and messaged when she left. The driver took a longer route, so she asked firmly to be dropped at a busy 7-Eleven. She was home safely and reported the driver later.\n\nKEY THINGS TO REMEMBER\nYour employer would rather you arrive safe than arrive fast. You are worth the caution. Plan ahead, share your ride, and trust your instinct.\n\nSAFE RIDES AT NIGHT\nUse licensed red taxis (green taxis serve the New Territories, blue serve Lantau). You can book through the HKTaxi app so the driver and car are recorded. Sit where the driver can see you, share your live location with a friend, and trust your instinct — if something feels wrong, ask to stop in a lit, busy place. Ride-hailing apps that are not licensed are risky in Hong Kong, so a licensed taxi is your safest choice. If you ever feel unsafe, call 999. Save the address of home in your phone so you can simply show it to the driver.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  },
  {
    "slug": "living-transport-mtr",
    "category": "transport",
    "sub_key": "tr_mtr",
    "icon": "🚇",
    "status": "published",
    "published_at": "2026-10-20T10:30:00.000Z",
    "title_en": "Riding the MTR with Confidence",
    "sub_en": "The train is clean, safe, and easy once you know it",
    "body_en": "The MTR is one of the easiest ways to move around Hong Kong. Clean, safe, and clearly signed, it speaks every language through its maps and colours. A few rides turn the unknown into routine.\n\nGET AN OCTOPUS CARD\nBuy an Octopus card at any MTR station. Tap in and out; the fare is automatic. You can top up at machines and even use it in shops. Keep it in a safe place — it is your key to the city.\n\nREAD THE MAP\nEach line has a colour and a name: Island, Tsuen Wan, Kwun Tong, and others. Follow the coloured signs to your line and direction. Big stations have maps on the wall and on trains.\n\nIF YOU ARE LOST\nStaff in red uniforms at the station help desk will point the way. Show them your destination on your phone, and they will guide you. Do not be shy — they help everyone.\n\nLATE NIGHT\nThe MTR closes around midnight. After that, use night buses, minibuses, or taxis. Know your last train time before you go out so you are not stranded.\n\nBUSES AND MINIBUSES\nBuses (double-deckers) and green or red minibuses fill the gaps. Buses show routes on the front; minibuses are faster but fill quickly. An Octopus card works on both.\n\nSTEP BY STEP\n1. Get an Octopus card and top it up.\n2. Find your line by colour and direction.\n3. Tap in, ride, tap out.\n4. Ask red-uniform staff if unsure.\n5. Check the last train time before going home.\n\nWHERE TO GET HELP\n- MTR customer service: staff at every station.\n- MTR website and app: maps and train times.\n- Police: 999, in an emergency.\n- Your friends: share routes you learn.\n- Tourist information centres: free maps.\n- Migrant worker groups: route tips.\n\nA REAL EXAMPLE\nOn her first solo trip, Maria panicked at a big interchange. A red-uniform staff member walked her to the right platform and showed her the exit. Now she rides confidently across the city.\n\nKEY THINGS TO REMEMBER\nThe city is yours to move through. With an Octopus card and a little courage, the MTR becomes second nature.\n\nRIDE WITH CONFIDENCE\nGet an Octopus card at any MTR station and top it up at the machine or a convenience shop. The coloured line map is easy: each line has a colour and a name, and signs in the station show the next train and the exit number. If you are lost, ask a staff member in a red uniform — they are used to helping. After the MTR closes, use a night bus, a minibus, or a taxi. Buses show their number clearly; green and red minibuses are cheap but stop where you ask. Keep a screenshot of your route so you can show it if you need help.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  },
  {
    "slug": "living-churches-community",
    "category": "churches",
    "sub_key": "ch_community",
    "icon": "⛪",
    "status": "published",
    "published_at": "2026-10-21T09:00:00.000Z",
    "title_en": "Finding Your Community",
    "sub_en": "A family away from family",
    "body_en": "Church is more than a service; it is a family away from family. Across Hong Kong, Filipino and Indonesian congregations gather on Sundays with food, song, and familiar faces. Walking in once can change your whole experience of the city.\n\nWHY THIS MATTERS\nHelpers often arrive knowing no one. A community gives you people who understand your story without explanation — and practical help when life gets hard.\n\nFIND A CONGREGATION\nMost churches near Central, Causeway Bay, and across the New Territories hold Tagalog or Bahasa Indonesia services on Sunday. Ask a friend, check community boards, or simply walk into a church and ask. You will be welcomed.\n\nWHAT YOU WILL FIND\n- Worship in your language.\n- Shared meals and fellowship after service.\n- Friends who become family.\n- Practical help: advice, rides, even emergency support.\n\nBEYOND CHURCH\nCommunity centres, worker groups, and cultural associations also connect helpers. Unifil Centre and similar spaces host gatherings, classes, and support for Filipinos. Indonesian helpers have their own active networks too.\n\nSTEP BY STEP\n1. Ask a friend or neighbour where they worship.\n2. Visit once, even if you feel shy.\n3. Stay for the fellowship meal or gathering.\n4. Exchange contacts with one or two people.\n5. Return next week and build the bond.\n\nWHERE TO GET HELP\n- Your local church: worship and community.\n- Mission for Migrant Workers (MFMW): support and events.\n- Unifil Centre: Filipino worker gatherings.\n- Asian Domestic Workers Union (ADWU): community and rights.\n- Indonesian Consulate General: community referrals.\n- HELP for Domestic Workers: activities and advice.\n\nA REAL EXAMPLE\nWhen Beth arrived, she knew no one. A fellow helper invited her to a Sunday service. Within a month she had a circle of friends, a choir to join, and people to call in an emergency.\n\nKEY THINGS TO REMEMBER\nYou belong here. One visit can lead to a community that holds you up through the hard and happy days alike.\n\nFIND YOUR PEOPLE\nFilipino and Indonesian congregations meet across Hong Kong on Sundays, often with shared food, music, and familiar faces. Places like the Unifil Centre and the Mission for Migrant Workers (MFMW) welcome newcomers without any paperwork. Walk in, sit at the back if you prefer, and someone will usually say hello. Beyond church, community centres and groups such as ADWU hold gatherings where you can make friends who understand your life. Belonging to a group turns a strange city into a place where people know your name.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  },
  {
    "slug": "living-churches-prayer",
    "category": "churches",
    "sub_key": "ch_prayer",
    "icon": "🙏",
    "status": "published",
    "published_at": "2026-10-21T10:30:00.000Z",
    "title_en": "Someone Understands: Prayer and Support",
    "sub_en": "Reach out before the weight grows too heavy",
    "body_en": "On the hardest days, know that someone understands. Prayer, a kind word from a sister or brother, a message from home — these are not small things. They are how we survive far from the people we love.\n\nWHY THIS MATTERS\nCarrying every burden alone wears you down. Reaching out early, before the weight grows too heavy, protects your mind and your spirit.\n\nPRAYER HELPS\nMany helpers find that prayer brings calm and perspective. Whether in a church, a quiet corner, or a whispered word on the bus, it reminds you that you are not forgotten.\n\nPEOPLE WHO CARE\nYour church family, a trusted friend, and helpline volunteers are ready to listen. You do not need a big problem to call — loneliness and a bad day are reasons enough.\n\nREACH OUT EARLY\nDo not wait until you break. A short talk with a friend, a counselling session, or a prayer group can stop a small sadness from becoming a crisis.\n\nSTEP BY STEP\n1. Name what you feel, even privately.\n2. Tell one trusted person.\n3. Use a helpline or counselling if needed.\n4. Keep a practice — prayer, walking, calling home — that steadies you.\n5. Return to community weekly.\n\nWHERE TO GET HELP\n- Your church or fellowship: prayer and friendship.\n- Mission for Migrant Workers (MFMW): counselling.\n- The Samaritans: 2896 0000, 24-hour confidential talk.\n- Caritas: emotional and family support.\n- HELP for Domestic Workers: advice and referral.\n- Asian Domestic Workers Union (ADWU): peer support.\n\nA REAL EXAMPLE\nAfter a fight with her employer, Grace sat alone all Sunday. A church friend called and listened for an hour. The next week Grace joined a prayer group, and the heavy feeling slowly lifted.\n\nKEY THINGS TO REMEMBER\nYou are seen, you are held, and you are not carrying this alone. Someone understands — let them.\n\nYOU ARE NOT ALONE\nOn the hardest days, a short prayer, a kind word from a sister or brother, or a message from home can hold you up. Church is not only a Sunday service — it is a family you can return to any week. When the burden feels heavy, reach out BEFORE it grows too large: tell a friend, speak to your church leader, or call a helpline. The Samaritans (2896 0000) and MFMW counselling are free, confidential, and there day or night. Asking for support is not a failure; it is how strong women keep going for the people they love.",
    "title_fil": "",
    "sub_fil": "",
    "body_fil": "",
    "title_zh": "",
    "sub_zh": "",
    "body_zh": "",
    "title_id": "",
    "sub_id": "",
    "body_id": ""
  }
];

/* Starter comments on the Living passages.

   WHY THESE EXIST: an empty comment thread is not neutral. It tells a first
   visitor that nobody comes here, and she leaves before she has read a word.
   A few genuinely useful notes under the passages that matter most turn a dead
   room into a room where someone has already been helpful.

   WHY THEY ARE CREDITED TO THE TEAM AND NOT TO A HELPER: these are written by
   us, so they say so. Inventing "Maria, 34, Wan Chai" to look like social
   proof would be a lie told to someone deciding whether to trust this app with
   a wage dispute — the exact person we cannot afford to mislead. The content
   has to stand on being useful, not on seeming popular.

   The same rule applies to reactions: the counts are NOT seeded. A fabricated
   tally is the same lie in a different shape, so the card hides a zero instead
   (see livingCardHtml in app.js).

   `seed_key` is the idempotency handle — stable per comment, UNIQUE in the
   table, and NULL for anything a real device writes. */
const SEED_LIVING_COMMENTS = [
  {
    seed_key: 'seed:living-before-system:1',
    slug: 'living-before-system',
    display_name: 'CantoBuddy team',
    body: 'The two-week rule is the one to remember before you sign anything: if your contract ends or is terminated, you must leave Hong Kong within 14 days. If you are thinking of changing employers, talk to the Labour Department or a helper support group BEFORE the contract ends — the clock starts the day it ends, not the day you find a new family.',
  },
  {
    seed_key: 'seed:living-before-contract:1',
    slug: 'living-before-contract',
    display_name: 'CantoBuddy team',
    body: 'Keep your own copy of the signed contract (ID 407) and photograph every page with your phone. If there is ever a disagreement about pay, rest days or duties, that copy is your evidence — your employer holds the other one, and the photos take ten seconds.',
  },
  {
    seed_key: 'seed:living-before-contract:2',
    slug: 'living-before-contract',
    display_name: 'CantoBuddy team',
    body: 'Your contract must state your wages, your rest day, and whether you get free food. If your employer gives you money instead of food, the food allowance is HK$1,236 a month and it comes ON TOP of your wages — it is not part of the HK$5,220 minimum.',
  },
  {
    seed_key: 'seed:living-medical-sick:1',
    slug: 'living-medical-sick',
    display_name: 'CantoBuddy team',
    body: 'Free medical treatment is part of your contract, not a favour from your employer. If you are sick, tell your employer and go to a public clinic or a hospital A&E — and keep every receipt and every sick-leave certificate. If you are too sick to work, that doctor\u2019s note is what protects your pay.',
  },
  {
    seed_key: 'seed:living-food-cook:1',
    slug: 'living-food-cook',
    display_name: 'CantoBuddy team',
    body: 'In your first week, ask the family two things: how salty they like their food, and whether anyone cannot eat pork or seafood. Write it on a note and stick it inside a cupboard door. Most disagreements about cooking in the first month are about those two answers, not about skill.',
  },
  {
    seed_key: 'seed:living-transport-mtr:1',
    slug: 'living-transport-mtr',
    display_name: 'CantoBuddy team',
    body: 'Get an Octopus card in your first week — every MTR station sells them, and the same card works in supermarkets and convenience stores. You can also check the fare before you travel: the MTR app shows the exact price of any journey, so a day out never costs more than you planned.',
  },
  {
    seed_key: 'seed:living-homesick-lonely:1',
    slug: 'living-homesick-lonely',
    display_name: 'CantoBuddy team',
    body: 'Missing home is not a weakness and it does not mean you made a mistake. The first three months are the hardest and almost everyone feels it. If it gets heavy, call a helper support line or go to a Sunday gathering — talking to someone who has been here longer helps more than you expect, and sometimes more than a video call.',
  },
  {
    seed_key: 'seed:living-holiday-rest:1',
    slug: 'living-holiday-rest',
    display_name: 'CantoBuddy team',
    body: 'Your rest day is 24 continuous hours every week, and it is in the law, not only in your contract. If you agree to work on it, that is your choice and it should be paid by agreement — and you are allowed to say no. Nobody can take the day away as a punishment.',
  },
  {
    seed_key: 'seed:living-churches-community:1',
    slug: 'living-churches-community',
    display_name: 'CantoBuddy team',
    body: 'Sunday gatherings are where most helpers find their people — a church, a mosque, or a Filipino or Indonesian community group. You do not have to be religious to go. Most of them are simply a place to sit, eat, and speak your own language for a few hours.',
  },
];

/* ===========================================================================
   USAGE NOTES — the prose that makes a word page worth indexing
   ===========================================================================

   WHY THIS MAP EXISTS, AND WHY IT IS SEPARATE FROM SEED_VOCABULARY.

   A word page used to carry exactly one sentence of prose, and that sentence
   was a template: "<word> in Cantonese is <hanzi>, pronounced <jyutping>. It
   belongs to the <category> group…". Four substituted variables do not make
   334 pages distinct, and Google said so plainly — 268 /words/ URLs sat in
   "Discovered - currently not indexed" with "Last crawled: N/A", and later 190
   more in "Crawled - currently not indexed".

   These notes are the fix. They are the only per-word text that is genuinely
   written rather than generated, which is exactly what a page needs to stop
   being thin. They are ALSO what the sitemap's lastmod keys on (see
   wordLastmod() in seo.js) and what decides whether a word page renders a
   "How it is used" section at all.

   WHY AN OVERLAY RATHER THAN EDITING SEED_VOCABULARY IN PLACE:
   migrateContent() is INSERT OR IGNORE, so it can never update a row that
   already exists. A note added to an existing word in the array would reach a
   FRESH database and silently never reach production. The overlay is applied by
   its own UPDATE migration (db.js), guarded on the SIZE of this map — the same
   mechanism MANDARIN_GLOSSES and INDONESIAN_GLOSSES already use, so adding a
   batch later keeps working without touching the guard.

   VOICE. One specific thing a learner would otherwise get wrong — a nuance,
   a social rule, or a short example. Not a definition restated, and never a
   sentence that would be equally true of any other word. If a note could be
   pasted onto a different entry without anyone noticing, it is not a note.

   COVERAGE. Batch 1: the 25 Greetings and Common entries, because those are
   the words people actually search for ("how to say thank you in Cantonese").
   262 of 334 words still have none; each batch added here makes its pages
   indexable and dated automatically.
   =========================================================================== */
const USAGE_NOTES = {
  // --- Greetings (11) ---
  1: 'The textbook greeting, and mostly used that way — for a first meeting or a stranger. In a home where people see each other every morning, 早晨 is what is actually said.',
  2: 'For a gift, a favour, or someone\'s time. The everyday mix-up is with 唔該: 多謝 is too heavy for a plate of food being set down, and 唔該 is too light for a present.',
  3: 'The workhorse — please, thanks, and excuse me all at once. When someone puts a bowl in front of you, this is the word, not 多謝.',
  4: 'Correct, and slightly formal. Leaving for the day, people usually say 我走先 ("I\'ll go first") or simply 拜拜.',
  5: 'Also the verb "to be" before a noun: 佢係我老闆. Cantonese uses it far less than English uses "is" — most sentences need no verb at all.',
  6: 'The standard "no". To contradict what someone just said, 唔係呀 with a falling tone is the everyday reply.',
  7: 'Also "very" when placed before an adjective: 好熱 is very hot, not good-hot. And 好呀 is how you agree to something.',
  8: 'Before a verb it is the everyday "don\'t": 唔好行 = don\'t go. Said to a child reaching for something, this is the word.',
  121: 'The normal morning greeting in a household — not 你好. Said to the family, and to neighbours in the lift.',
  122: 'Said when someone is going to bed, not when you leave in the evening. Literally "rest early".',
  143: 'The polite full form. In daily life most people just say 唔使 or 唔緊要.',
  144: 'For a real apology. For squeezing past someone, 唔該 or 唔好意思 is enough — 對唔住 would sound far too heavy.',
  148: 'Said before interrupting an employer who is busy. For a small interruption, the shorter 唔好意思 carries the same meaning.',
  149: 'What an employer says when leaving her alone with an elderly parent. Worth recognising even if she never has to say it back.',
  151: 'The market and MTR version. In a crowd, 借借 on its own is enough.',
  // --- Common (14) ---
  14: 'Also "older" in family order — 大佬 is elder brother. 大聲 is loud, literally "big voice".',
  15: 'The everyday spoken word for small in Hong Kong; 小 is the written form. 細佬 is a younger brother.',
  152: 'Follows the noun: 人好多 = lots of people. Before a noun it means "many", as in 好多錢.',
  153: '太 + adjective is the "too much" pattern — 太貴 too expensive, 太熱 too hot. This is its opposite number.',
  154: 'The direct answer to a request. 冇 is the everyday "not have"; 唔有 does not exist.',
  155: 'Also "let me": 等我幫你 = let me help you. Only the tone tells you which one is meant.',
  156: 'Doubling it softens the request. Said to a person, or into a phone.',
  157: 'The everyday "pardon?". 咩 is the casual "what"; 乜嘢 is the fuller form of the same word.',
  158: 'The single most useful sentence for a new arrival. 啲 after an adjective makes the comparative — 慢啲 slower, 快啲 faster.',
  159: 'Softer than a bare 我唔明. The 唔係好 pattern is how Cantonese makes a complaint gentle rather than blunt.',
};

/* Fresh databases get the notes here; EXISTING ones get them from the UPDATE
   migration in db.js. Both paths are needed and neither is redundant:
   migrateContent() INSERTs a new word with whatever usage_note it already
   carries, while a word that is already on disk is only reachable by UPDATE.

   `!v.usage_note` rather than an unconditional assign, so a note written
   directly into SEED_VOCABULARY wins over this map — the array stays the
   source of truth for anything that has already been hand-placed. */
for (const v of SEED_VOCABULARY) {
  if (!String(v.usage_note || '').trim() && USAGE_NOTES[v.id]) v.usage_note = USAGE_NOTES[v.id];
}

module.exports = {
  load,
  save,
  reset,
  nextId,
  DB_PATH,
  SEED_DATA,
  SEED_CATEGORIES,
  SEED_VOCABULARY,
  SEED_SCENARIOS,
  SEED_USERS,
  SEED_POSTS,
  SEED_LIVING,
  SEED_LIVING_COMMENTS,
  MANDARIN_GLOSSES,
  CATEGORY_ZH_NAMES,
  INDONESIAN_GLOSSES,
  CATEGORY_ID_NAMES,
  USAGE_NOTES,
};
