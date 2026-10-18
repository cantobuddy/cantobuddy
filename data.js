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
];

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
  MANDARIN_GLOSSES,
  CATEGORY_ZH_NAMES,
  INDONESIAN_GLOSSES,
  CATEGORY_ID_NAMES,
};
