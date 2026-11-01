'use strict';
/**
 * CantoBuddy — English Track seed content.
 *
 * This is the agreed content spec (proposal/ENGLISH-CONTENT-DRAFT.md v3, approved).
 * Audience: an elderly Cantonese-speaking person at home who wants to (1) name
 * household items room-by-room, (2) give the helper housework instructions by
 * room, and (3) shop for daily goods — plus call family and handle emergencies.
 *
 * Delivered in the app as two 🔊 buttons (English en voice + 粵語 zh-HK voice,
 * both browser TTS) and a tap-quiz. No recording in v1.
 *
 * Schema (see en.js): en_categories, en_vocabulary, en_scenarios, en_progress.
 *   - en_vocabulary.type = 'word'  -> browsed/quizzed by category (household
 *                                     items, shopping goods, basics, etc.)
 *   - en_vocabulary.type = 'sentence' -> belongs to a scenario (scenario_id set,
 *                                     category_id null). These form the
 *                                     two-way "practice" situations.
 *   - phonetic = elder-friendly syllable spelling (NOT IPA).
 *
 * Vocabulary ids are auto-assigned by SQLite (INTEGER PRIMARY KEY); categories
 * and scenarios carry explicit ids so sentences can reference scenario_id.
 */

const SEED_EN_CATEGORIES = [
  { id: 1,  name_en: 'Greetings',          name_yue: '問候',        name_zh: '问候',     name_fil: 'Bati',                 name_id: 'Salam',                icon: '👋' },
  { id: 2,  name_en: 'Numbers & Money',    name_yue: '數目同錢',    name_zh: '數目和錢', name_fil: 'Mga Numero at Pera',    name_id: 'Angka & Uang',          icon: '🔢' },
  { id: 3,  name_en: 'Kitchen',            name_yue: '廚房',        name_zh: '厨房',     name_fil: 'Kusina',               name_id: 'Dapur',                 icon: '🍳' },
  { id: 4,  name_en: 'Toilet',             name_yue: '廁所',        name_zh: '厕所',     name_fil: 'Banyo',                name_id: 'Toilet',                icon: '🚽' },
  { id: 5,  name_en: 'Bedroom',            name_yue: '睡房',        name_zh: '睡房',     name_fil: 'Kwarto',               name_id: 'Kamar',                 icon: '🛏️' },
  { id: 6,  name_en: 'Living Room',        name_yue: '客廳',        name_zh: '客厅',     name_fil: 'Salas',                name_id: 'Ruang Tamu',            icon: '🛋️' },
  { id: 7,  name_en: 'Laundry & Balcony',  name_yue: '洗衣同露台',  name_zh: '洗衣和露台', name_fil: 'Labahan at Balkonahe', name_id: 'Cuci & Balkon',          icon: '🧺' },
  { id: 8,  name_en: 'Shopping Goods',     name_yue: '日用品·買餸',  name_zh: '日用品·买菜', name_fil: 'Bibilhin',             name_id: 'Belanja',               icon: '🛒' },
  { id: 9,  name_en: 'Emergency',          name_yue: '緊急',        name_zh: '紧急',     name_fil: 'Emergency',            name_id: 'Darurat',               icon: '⚠️' },
  { id: 10, name_en: 'Useful Words',       name_yue: '實用字詞',    name_zh: '实用字词', name_fil: 'Mga Salitang Gamit',    name_id: 'Kata Berguna',          icon: '📌' },
];

const SEED_EN_SCENARIOS = [
  { id: 1,  name_en: 'Kitchen duties',     name_yue: '廚房工作', name_zh: '厨房工作', name_fil: 'Gawain sa Kusina', name_id: 'Tugas Dapur',     icon: '🍳', description: 'Tell the helper what to do in the kitchen.' },
  { id: 2,  name_en: 'Toilet duties',      name_yue: '廁所工作', name_zh: '厕所工作', name_fil: 'Gawain sa Banyo',  name_id: 'Tugas Toilet',    icon: '🚽', description: 'Tell the helper what to do in the toilet.' },
  { id: 3,  name_en: 'Bedroom duties',     name_yue: '睡房工作', name_zh: '睡房工作', name_fil: 'Gawain sa Kwarto', name_id: 'Tugas Kamar',     icon: '🛏️', description: 'Tell the helper what to do in the bedroom.' },
  { id: 4,  name_en: 'Living room duties', name_yue: '客廳工作', name_zh: '客厅工作', name_fil: 'Gawain sa Salas', name_id: 'Tugas Ruang Tamu', icon: '🛋️', description: 'Tell the helper what to do in the living room.' },
  { id: 5,  name_en: 'Laundry duties',     name_yue: '洗衣工作', name_zh: '洗衣工作', name_fil: 'Labada',           name_id: 'Cuci Baju',      icon: '🧺', description: 'Tell the helper what to do with the washing.' },
  { id: 6,  name_en: 'Balcony duties',     name_yue: '露台工作', name_zh: '露台工作', name_fil: 'Balkonahe',        name_id: 'Balkon',         icon: '🌤️', description: 'Hang clothes to dry and enjoy the sun.' },
  { id: 7,  name_en: 'Market shopping',    name_yue: '街市買餸', name_zh: '街市买菜', name_fil: 'Palengke',         name_id: 'Pasar',          icon: '🥬', description: 'Buy vegetables and daily food at the market.' },
  { id: 8,  name_en: 'Supermarket shopping',name_yue: '超市買嘢', name_zh: '超市买东西', name_fil: 'Supermarket',    name_id: 'Supermarket',    icon: '🛒', description: 'Buy daily goods at the supermarket.' },
  { id: 9,  name_en: 'Convenience store',  name_yue: '便利店',   name_zh: '便利店',   name_fil: 'Tindahan',         name_id: 'Toko',           icon: '🏪', description: 'Buy snacks and essentials at 7-Eleven.' },
  { id: 10, name_en: 'Calling family',     name_yue: '打畀屋企人',name_zh: '打电话给家人', name_fil: 'Tawag sa Pamilya', name_id: 'Telepon Keluarga', icon: '📞', description: 'Call your grandson or family.' },
  { id: 11, name_en: 'On the phone',       name_yue: '聽電話',   name_zh: '听电话',   name_fil: 'Sa Telepono',      name_id: 'Di Telepon',     icon: '📱', description: 'Understand and speak on the phone.' },
  { id: 12, name_en: 'Emergency talk',     name_yue: '緊急用語', name_zh: '紧急用语', name_fil: 'Emergency',        name_id: 'Darurat',        icon: '🆘', description: 'Ask for help in an emergency.' },
];

// type 'word' -> browsed by category. type 'sentence' -> belongs to a scenario.
const W = (english, phonetic, cantonese, emoji, level, category_id) =>
  ({ english, phonetic, cantonese, emoji, level, category_id, type: 'word', scenario_id: null });
const S = (english, phonetic, cantonese, emoji, level, scenario_id) =>
  ({ english, phonetic, cantonese, emoji, level, category_id: null, type: 'sentence', scenario_id });

const SEED_EN_VOCABULARY = [
  // ---- Category 1: Greetings ----
  W('Hello', 'ha-LOH', '你好', '👋', 1, 1),
  W('Good morning', 'good MOR-ning', '早晨', '🌅', 1, 1),
  W('Good evening', 'good EEV-ning', '晚上好', '🌆', 1, 1),
  W('Goodbye', 'good-BYE', '拜拜', '👋', 1, 1),
  W('Thank you', 'THANK you', '多謝', '🙏', 1, 1),
  W('Please', 'pleez', '唔該 / 請', '🤲', 1, 1),
  W('Sorry', 'SOR-ree', '對唔住', '😟', 1, 1),
  W('Yes', 'yes', '係', '✅', 1, 1),
  W('No', 'noh', '唔係', '❌', 1, 1),
  W('Excuse me', 'ex-KYOOZ me', '唔該姐姐', '🙇', 1, 1),

  // ---- Category 2: Numbers & Money ----
  W('One', 'wun', '一', '1️⃣', 1, 2),
  W('Two', 'too', '二', '2️⃣', 1, 2),
  W('Three', 'three', '三', '3️⃣', 1, 2),
  W('Four', 'for', '四', '4️⃣', 1, 2),
  W('Five', 'fyv', '五', '5️⃣', 1, 2),
  W('Six', 'siks', '六', '6️⃣', 1, 2),
  W('Seven', 'SEV-en', '七', '7️⃣', 1, 2),
  W('Eight', 'ayt', '八', '8️⃣', 1, 2),
  W('Nine', 'nyn', '九', '9️⃣', 1, 2),
  W('Ten', 'ten', '十', '🔟', 1, 2),
  W('Twenty', 'TWEN-tee', '二十', '🔢', 2, 2),
  W('Fifty', 'FIF-tee', '五十', '🔢', 2, 2),
  W('One hundred', 'wun HUN-dred', '一百', '🔢', 2, 2),
  W('How much money?', 'how MUCH MUN-ee', '幾多錢', '💲', 2, 2),
  W('Money', 'MUN-ee', '錢', '💰', 1, 2),
  W('Dollar', 'DO-ler', '蚊 / 元', '💵', 1, 2),

  // ---- Category 3: Kitchen items ----
  W('Fridge', 'frij', '雪櫃', '🧊', 1, 3),
  W('Stove', 'stohv', '爐灶', '🔥', 2, 3),
  W('Rice cooker', 'rys KUK-er', '電飯煲', '🍚', 2, 3),
  W('Pot', 'pot', '煲', '🍲', 2, 3),
  W('Pan', 'pan', '平底鑊', '🍳', 2, 3),
  W('Bowl', 'bohl', '碗', '🥣', 1, 3),
  W('Plate', 'playt', '碟', '🍽️', 1, 3),
  W('Cup', 'kup', '杯', '☕', 1, 3),
  W('Glass', 'glas', '玻璃杯', '🥛', 2, 3),
  W('Knife', 'nyf', '刀', '🔪', 1, 3),
  W('Fork', 'fork', '叉', '🍴', 2, 3),
  W('Chopsticks', 'CHOP-stiks', '筷子', '🥢', 1, 3),
  W('Spoon', 'spoon', '匙羹', '🥄', 1, 3),
  W('Sink', 'sink', '水槽', '🚰', 2, 3),
  W('Tap', 'tap', '水龍頭', '🚿', 1, 3),
  W('Dish soap', 'dish sohp', '洗潔精', '🧴', 2, 3),
  W('Table', 'TAY-bel', '檯', '🪑', 1, 3),
  W('Chair', 'chayr', '櫈', '🪑', 1, 3),
  W('Trash bin', 'trash bin', '垃圾筒', '🗑️', 2, 3),

  // ---- Category 4: Toilet items ----
  W('Toilet', 'TOI-let', '馬桶 / 廁所', '🚽', 1, 4),
  W('Toilet paper', 'TOI-let PAY-per', '廁紙', '🧻', 1, 4),
  W('Tap', 'tap', '水龍頭', '🚿', 1, 4),
  W('Shower', 'SHOW-er', '花灑', '🚿', 2, 4),
  W('Basin', 'BAY-sin', '洗手盆', '🚰', 2, 4),
  W('Towel', 'TOW-el', '毛巾', '🧺', 1, 4),
  W('Soap', 'sohp', '番梘', '🧼', 1, 4),
  W('Mirror', 'MI-ror', '鏡', '🪞', 2, 4),
  W('Bath', 'bath', '浴缸', '🛁', 2, 4),
  W('Mop', 'mop', '拖把', '🧹', 2, 4),

  // ---- Category 5: Bedroom items ----
  W('Bed', 'bed', '床', '🛏️', 1, 5),
  W('Pillow', 'PIL-oh', '枕頭', '🛏️', 1, 5),
  W('Blanket', 'BLAN-ket', '毯', '🛌', 2, 5),
  W('Sheet', 'sheet', '床單', '🛏️', 2, 5),
  W('Wardrobe', 'WARD-rohb', '衣櫃', '🚪', 2, 5),
  W('Drawer', 'DRAW-er', '抽屜', '🗄️', 2, 5),
  W('Lamp', 'lamp', '檯燈', '💡', 2, 5),
  W('Window', 'WIN-doh', '窗', '🪟', 1, 5),
  W('Hanger', 'HANG-er', '衣架', '🧥', 2, 5),
  W('Clock', 'klok', '鐘', '🕰️', 2, 5),

  // ---- Category 6: Living room items ----
  W('Sofa', 'SOH-fa', '沙發', '🛋️', 2, 6),
  W('Table', 'TAY-bel', '茶幾', '🪑', 1, 6),
  W('Chair', 'chayr', '櫈', '🪑', 1, 6),
  W('TV', 'tee-VEE', '電視', '📺', 1, 6),
  W('Remote', 're-MOHT', '遙控', '🕹️', 2, 6),
  W('Fan', 'fan', '風扇', '💨', 2, 6),
  W('Curtain', 'KUR-ten', '窗簾', '🪟', 2, 6),
  W('Light', 'lyt', '燈', '💡', 1, 6),
  W('Carpet', 'KAR-pet', '地毯', '🟫', 2, 6),
  W('Plant', 'plant', '植物', '🪴', 2, 6),

  // ---- Category 7: Laundry & Balcony items ----
  W('Washing machine', 'WOSH-ing ma-SHEEN', '洗衣機', '🧺', 1, 7),
  W('Clothes', 'klohz', '衫', '👕', 1, 7),
  W('Drying rack', 'DRY-ing rak', '晾衣架', '🪜', 2, 7),
  W('Laundry basket', 'LAWN-dree BAS-ket', '洗衣籃', '🧺', 2, 7),
  W('Iron', 'yern', '燙斗', '🔥', 2, 7),
  W('Balcony', 'BAL-ko-nee', '露台', '🌤️', 2, 7),

  // ---- Category 8: Shopping goods ----
  W('Vegetables', 'VEJ-ta-belz', '蔬菜', '🥬', 1, 8),
  W('Meat', 'meet', '肉', '🍖', 1, 8),
  W('Fish', 'fish', '魚', '🐟', 1, 8),
  W('Chicken', 'CHIK-in', '雞', '🍗', 2, 8),
  W('Egg', 'eg', '蛋', '🥚', 1, 8),
  W('Rice', 'rys', '米 / 飯', '🍚', 1, 8),
  W('Noodles', 'NOO-delz', '麵', '🍜', 2, 8),
  W('Bread', 'bred', '麵包', '🍞', 2, 8),
  W('Milk', 'milk', '牛奶', '🥛', 1, 8),
  W('Fruit', 'froot', '生果', '🍎', 1, 8),
  W('Oil', 'oyl', '油', '🫗', 2, 8),
  W('Salt', 'sawlt', '鹽', '🧂', 2, 8),
  W('Sugar', 'SHOO-ger', '糖', '🍬', 2, 8),
  W('Soy sauce', 'soi saws', '豉油', '🫙', 2, 8),
  W('Bottled water', 'BOT-eld WAH-ter', '樽裝水', '💧', 2, 8),
  W('Soap', 'sohp', '番梘', '🧼', 1, 8),
  W('Detergent', 'de-TER-jent', '洗衣液', '🧴', 2, 8),
  W('Tissue', 'TISH-yoo', '紙巾', '🧻', 1, 8),
  W('Trash bag', 'trash bag', '垃圾袋', '🗑️', 2, 8),
  W('Light bulb', 'lyt bulb', '燈泡', '💡', 2, 8),
  W('Batteries', 'BAT-er-eez', '電池', '🔋', 2, 8),
  W('Snack', 'snak', '零食', '🍫', 2, 8),
  W('Phone card', 'fohn card', '電話卡', '📞', 2, 8),

  // ---- Category 9: Emergency words ----
  W('Help!', 'help', '幫手！', '🆘', 1, 9),
  W('Police', 'po-LEES', '警察', '👮', 1, 9),
  W('Ambulance', 'AM-byu-lans', '救護車', '🚑', 1, 9),
  W('Fire', 'fy-er', '火', '🔥', 1, 9),
  W('Danger', 'DAYN-jer', '危險', '⚠️', 2, 9),
  W('Hospital', 'HOS-pi-tal', '醫院', '🏥', 2, 9),

  // ---- Category 10: Useful words ----
  W('Today', 'to-DAY', '今日', '📅', 2, 10),
  W('Tomorrow', 'to-MOR-oh', '聽日', '📆', 2, 10),
  W('Morning', 'MOR-ning', '朝早', '🌅', 2, 10),
  W('Afternoon', 'af-ter-NOON', '下晝', '☀️', 2, 10),
  W('Night', 'nyt', '夜晚', '🌙', 2, 10),
  W('Left', 'left', '左', '👈', 2, 10),
  W('Right', 'ryt', '右', '👉', 2, 10),
  W('Straight', 'strayt', '直行', '⬆️', 2, 10),
  W('Here', 'heer', '呢度', '📍', 2, 10),
  W('Stop', 'stop', '停', '🛑', 2, 10),
  W('Bus', 'bus', '巴士', '🚌', 2, 10),
  W('Taxi', 'TAK-see', '的士', '🚕', 2, 10),
  W('MTR', 'em-tee-AR', '港鐵', '🚇', 2, 10),
  W('Hot', 'hot', '熱', '🔥', 2, 10),
  W('Cold', 'kohld', '冷', '❄️', 2, 10),
  W('Rain', 'rayn', '雨', '🌧️', 2, 10),
  W('Sun', 'sun', '太陽', '☀️', 2, 10),
  W('Umbrella', 'um-BREL-a', '遮', '☂️', 2, 10),
  W('Happy', 'HAP-ee', '開心', '😊', 2, 10),
  W('Tired', 'ty-er', '攰', '😴', 2, 10),
  W('Hungry', 'HUN-gree', '肚餓', '🍚', 2, 10),
  W('Sick', 'sik', '唔舒服', '🤒', 2, 10),
  W('Understand', 'un-der-STAND', '明唔明', '🤔', 2, 10),
  W('Slowly', 'SLOH-lee', '慢慢', '🐢', 2, 10),
  W('Repeat', 're-PEET', '再講一次', '🔁', 2, 10),

  // ---- Scenarios (sentences) ----
  // Scenario 1: Kitchen duties
  S('Wash the dishes.', 'wosh de DISH-es', '洗碗', '🍽️', 1, 1),
  S('Wipe the table.', 'wyp de TAY-bel', '抹檯', '🧽', 1, 1),
  S('Sweep the floor.', 'sweep de flor', '掃地', '🧹', 1, 1),
  S('Mop the floor.', 'mop de flor', '拖地', '🧹', 1, 1),
  S('Cook the rice.', 'cook de rys', '煲飯', '🍚', 1, 1),
  S('Throw away the leftovers.', 'throw a-WAY de LEFT-oh-verz', '掉咗剩菜', '🗑️', 2, 1),
  S('Clean the fridge.', 'kleen de frij', '清潔雪櫃', '🧊', 2, 1),

  // Scenario 2: Toilet duties
  S('Clean the toilet.', 'kleen de TOI-let', '清潔廁所', '🚽', 1, 2),
  S('Scrub the basin.', 'skrub de BAY-sin', '刷洗手盆', '🚰', 2, 2),
  S('Mop the floor.', 'mop de flor', '拖地', '🧹', 1, 2),
  S('Change the towel.', 'chaynj de TOW-el', '換毛巾', '🧺', 1, 2),
  S('Refill the toilet paper.', 'ree-FIL de TOI-let PAY-per', '補廁紙', '🧻', 2, 2),

  // Scenario 3: Bedroom duties
  S('Make the bed.', 'mayk de bed', '鋪床', '🛏️', 1, 3),
  S('Tidy the room.', 'TY-dee de room', '執房', '🧹', 1, 3),
  S('Vacuum the floor.', 'VAK-yoom de flor', '吸地', '🌀', 2, 3),
  S('Fold the clothes.', 'fohld de klohz', '摺衫', '👕', 1, 3),
  S('Put away the clothes.', 'poot a-WAY de klohz', '收衫', '👕', 2, 3),
  S('Open the window.', 'OH-pen de WIN-doh', '開窗', '🪟', 1, 3),
  S('Close the window.', 'klohz de WIN-doh', '關窗', '🪟', 1, 3),

  // Scenario 4: Living room duties
  S('Vacuum the floor.', 'VAK-yoom de flor', '吸地', '🌀', 2, 4),
  S('Dust the furniture.', 'dust de FUR-ni-cher', '抹傢俬', '🧽', 2, 4),
  S('Tidy the sofa.', 'TY-dee de SOH-fa', '執沙發', '🛋️', 1, 4),
  S('Take out the trash.', 'tayk OUT de trash', '倒垃圾', '🗑️', 1, 4),
  S('Water the plants.', 'WA-ter de plants', '淋花', '🪴', 1, 4),
  S('Turn on the light.', 'tern ON de lyt', '開燈', '💡', 1, 4),
  S('Turn off the light.', 'tern OFF de lyt', '關燈', '💡', 1, 4),

  // Scenario 5: Laundry duties
  S('Wash the clothes.', 'wosh de klohz', '洗衫', '🧺', 1, 5),
  S('Hang the clothes.', 'hang de klohz', '晾衫', '👕', 1, 5),
  S('Fold the clothes.', 'fohld de klohz', '摺衫', '👕', 1, 5),
  S('Iron the clothes.', 'yern de klohz', '燙衫', '🔥', 2, 5),
  S('Put away the clothes.', 'poot a-WAY de klohz', '收衫', '👕', 2, 5),

  // Scenario 6: Balcony duties
  S('Water the plants.', 'WA-ter de plants', '淋花', '🪴', 1, 6),
  S('Hang the clothes to dry.', 'hang de klohz too dry', '晾衫', '👕', 1, 6),
  S('Enjoy the sun.', 'en-JOY de sun', '晒下太陽', '☀️', 2, 6),

  // Scenario 7: Market shopping
  S('Please buy …', 'pleez by', '唔該買…', '🛒', 1, 7),
  S('We need …', 'wee NEED', '我哋需要…', '🛒', 2, 7),
  S('Get some vegetables.', 'get sum VEJ-ta-belz', '買啲菜', '🥬', 1, 7),
  S('How much is this?', 'how MUCH iz dis', '幾錢？', '💲', 1, 7),
  S('Too expensive.', 'too ex-PEN-siv', '太貴', '💸', 1, 7),
  S('Cheaper, please.', 'CHEE-per pleez', '平啲啦唔該', '💲', 2, 7),
  S('Where is the market?', 'WAIR iz de MAR-ket', '街市喺邊？', '🥬', 2, 7),

  // Scenario 8: Supermarket shopping
  S('Where is the supermarket?', 'WAIR iz de SOO-per-mar-ket', '超級市場喺邊？', '🛒', 2, 8),
  S('We need rice and eggs.', 'wee NEED rys and egz', '我哋需要米同蛋', '🍚', 2, 8),
  S('Get some fruit.', 'get sum froot', '買啲生果', '🍎', 1, 8),
  S('How much is this?', 'how MUCH iz dis', '幾錢？', '💲', 1, 8),
  S('Too expensive.', 'too ex-PEN-siv', '太貴', '💸', 1, 8),

  // Scenario 9: Convenience store (7-Eleven)
  S('Where is 7-Eleven?', 'WAIR iz SEV-en E-lev-en', '7-Eleven喺邊？', '🏪', 2, 9),
  S('Buy from 7-Eleven.', 'by from SEV-en E-lev-en', '去7-Eleven買', '🏪', 2, 9),
  S('Get some snacks.', 'get sum SNAKS', '買啲零食', '🍫', 1, 9),
  S('I need a phone card.', 'eye NEED a fohn card', '我要電話卡', '📞', 2, 9),

  // Scenario 10: Calling family
  S('Call my grandson.', 'kawl my GRAND-sun', '打畀孫仔', '📞', 2, 10),
  S('Phone my grandson.', 'fohn my GRAND-sun', '打電話畀孫仔', '📞', 2, 10),
  S('Where is my phone?', 'WAIR iz my fohn', '我部電話喺邊？', '📱', 1, 10),
  S('Speak to him.', 'speak too him', '同佢講', '🗣️', 2, 10),
  S('I want to call home.', 'eye want too kawl hohm', '我想打電話返屋企', '🏠', 2, 10),
  S('Call the family.', 'kawl de FAM-lee', '打畀屋企人', '📞', 2, 10),

  // Scenario 11: On the phone
  S('Hello?', 'ha-LOH', '喂？', '📱', 1, 11),
  S('Who is this?', 'hoo iz dis', '邊位？', '📱', 2, 11),
  S("I don't understand.", 'eye DONT un-der-STAND', '我唔明', '🤔', 1, 11),
  S('Please speak slowly.', 'pleez speak SLOH-lee', '唔該講慢啲', '🐢', 1, 11),

  // Scenario 12: Emergency talk
  S('Help!', 'help', '幫手！', '🆘', 1, 12),
  S('Call the police!', 'kawl de po-LEES', '叫差人！', '👮', 2, 12),
  S('Call an ambulance!', 'kawl an AM-byu-lans', '叫救護車！', '🚑', 2, 12),
  S('Fire!', 'fy-er', '火燭！', '🔥', 1, 12),
  S('It is dangerous.', 'it iz DAYN-jer-us', '好危險', '⚠️', 2, 12),
];

module.exports = { SEED_EN_CATEGORIES, SEED_EN_VOCABULARY, SEED_EN_SCENARIOS };
