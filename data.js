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
  MANDARIN_GLOSSES,
  CATEGORY_ZH_NAMES,
  INDONESIAN_GLOSSES,
  CATEGORY_ID_NAMES,
};
