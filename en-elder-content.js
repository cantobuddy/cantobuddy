'use strict';
/**
 * CantoBuddy — /en elder companion content (Phase 1 of EN-ROADMAP.md).
 *
 * This is STATIC, EDITORIAL content, served read-only from /api/en/elder/*.
 * There is no user-generated text, no account, no device id and no database
 * write anywhere in this module. Phase 1 deliberately ships the elder features
 * that are safe to put in front of a vulnerable reader without a moderation
 * queue; the two-way helper board and pen-pal features stay in Phase 3, where
 * they inherit the forums' pre-moderation, reports and device blocks.
 *
 * TWO HARD RULES
 * --------------
 * 1. NEVER FABRICATE HELP NUMBERS. Every telephone number below is copied from
 *    the already-verified directory in public/tools.js (checked 2026-11-06
 *    against the Labour Department FDH contact page, HAD "Just for You" and
 *    HELP for Domestic Workers). Anything we have not verified is a LINK to an
 *    official website, not a made-up phone number. A wrong hotline shown to an
 *    elderly person is worse than no hotline.
 * 2. NEVER FABRICATE NEWS. "Local interesting news" (A6) is delivered as live
 *    official data — the existing /api/today-in-hk HKO weather and 1823 holiday
 *    feed — plus links to official portals. No invented headlines, ever.
 *
 * READING LANGUAGE (§0b)
 * ----------------------
 * Every item carries `tc` (Traditional, default for Hong Kong), `sc`
 * (Simplified, for elders from the mainland) and `en` (for the Fil/Indo UI
 * chrome, which helpers use). Content is stored as three explicit strings so
 * no automatic converter can quietly mangle a joke or a safety tip.
 *
 * DAILY ROTATION (A1)
 * -------------------
 * A deterministic pick per KIND, keyed on the HONG KONG calendar day. No clock
 * pressure, no streak, no "you missed yesterday": an elder who opens the app
 * on Tuesday and again on Friday simply sees two different small things.
 */

const CONTENT_VERSION = '2026-11-10.1';
const SHARE_SITE = 'https://cantobuddy.com/en';
const VERIFIED_ON = '2026-11-06';
const HKT_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// A3 jokes / A7 生活小常識 / A8 中國智慧故事 / E1 helper-voice cards
// ---------------------------------------------------------------------------
const ELDER_ITEMS = [
  // ---- jokes ---------------------------------------------------------------
  {
    id: 'joke-1', kind: 'joke', emoji: '😄',
    tc: { title: '雪櫃盞燈', body: '孫仔問：「婆婆，點解雪櫃一開門就有燈，一關門就熄？」婆婆話：「因為佢都要瞓覺呀。」' },
    sc: { title: '冰箱那盏灯', body: '孙子问：「奶奶，为什么冰箱一开门就亮灯，一关门就灭？」奶奶说：「因为它也要睡觉呀。」' },
    en: { title: 'The fridge light', body: '"Grandma, why does the fridge light come on when you open the door?" "Because even the fridge needs a little sleep," she said.' },
  },
  {
    id: 'joke-2', kind: 'joke', emoji: '🐟',
    tc: { title: '街市買魚', body: '魚檔老闆話：「呢條魚好新鮮，今朝仲識游水！」我話：「咁你仲唔快啲放佢返去？」' },
    sc: { title: '菜市场买鱼', body: '鱼档老板说：「这条鱼很新鲜，今早还会游泳！」我说：「那你怎么还不快放它回去？」' },
    en: { title: 'At the market', body: '"This fish is so fresh it was swimming this morning!" said the seller. "Then shouldn\'t you put it back?" I asked.' },
  },
  {
    id: 'joke-3', kind: 'joke', emoji: '👓',
    tc: { title: '眼鏡去咗邊', body: '阿爺搵咗半日眼鏡，孫女話：「爺爺，喺你額頭上面呀。」阿爺笑：「哦，怪唔得我睇嘢矇查查，原來佢去咗旅行。」' },
    sc: { title: '眼镜去哪了', body: '爷爷找了半天眼镜，孙女说：「爷爷，在你额头上呀。」爷爷笑：「怪不得我看东西糊里糊涂，原来它去旅行了。」' },
    en: { title: 'Where are my glasses?', body: 'Grandpa searched for his glasses for half an hour. "They are on your forehead," said his granddaughter. "No wonder everything looked blurry — they went on holiday."' },
  },
  {
    id: 'joke-4', kind: 'joke', emoji: '📱',
    tc: { title: '第一次講語音訊息', body: '婆婆對住電話講咗三次：「喂？喂？喂？」孫女回覆：「婆婆，我聽到三次啦，唔使再喂我啦。」' },
    sc: { title: '第一次发语音', body: '奶奶对着手机讲了三次：「喂？喂？喂？」孙女回复：「奶奶，我听到三次啦，不用再喂我啦。」' },
    en: { title: 'First voice message', body: 'Grandma said "Hello? Hello? Hello?" three times into the phone. Her granddaughter replied, "I heard all three, Grandma — you don\'t have to feed me again!"' },
  },

  // ---- 生活小常識 ----------------------------------------------------------
  {
    id: 'tip-1', kind: 'tip', emoji: '💧',
    tc: { title: '飲水要分開幾次', body: '天氣熱或者長期開冷氣，唔好等口乾先飲水。每次飲少少、全日分開幾次，會舒服啲。' },
    sc: { title: '喝水要分几次', body: '天气热或者长时间开空调，不要等口渴才喝水。每次喝一点、一天分几次，会更舒服。' },
    en: { title: 'Sip water through the day', body: 'In hot weather or in air conditioning, do not wait until you are thirsty. A little at a time, a few times a day, feels better.' },
  },
  {
    id: 'tip-2', kind: 'tip', emoji: '🦶',
    tc: { title: '廚房浴室防跣', body: '地面濕咗，先抹乾先至行。拖鞋揀有防滑底，浴室門口放一塊乾毛巾。' },
    sc: { title: '厨房浴室防滑', body: '地面湿了，先擦干再走。拖鞋选防滑底的，浴室门口放一块干毛巾。' },
    en: { title: 'Mind wet floors', body: 'Dry a wet floor before walking on it. Wear non-slip slippers and keep a dry towel by the bathroom door.' },
  },
  {
    id: 'tip-3', kind: 'tip', emoji: '💊',
    tc: { title: '食藥前望清楚', body: '食藥之前睇清楚藥袋上嘅名、份量同時間。有任何唔肯定，打去醫生或者藥房問清楚，唔好靠估。' },
    sc: { title: '吃药前看清楚', body: '吃药之前看清药袋上的名字、份量和时间。有任何不确定，打电话问医生或药房，不要靠猜。' },
    en: { title: 'Check medicine labels', body: 'Before taking medicine, read the name, dose and time on the packet. If anything is unclear, call your doctor or pharmacist — never guess.' },
  },
  {
    id: 'tip-4', kind: 'tip', emoji: '🍲',
    tc: { title: '食剩嘅餸', body: '食剩嘅餸盡快放入雪櫃，翻熱要徹底。唔記得放咗幾耐，就唔好勉強食。' },
    sc: { title: '吃剩的菜', body: '吃剩的菜尽快放进冰箱，翻热要热透。不记得放了多久，就不要勉强吃。' },
    en: { title: 'Leftovers', body: 'Put leftovers in the fridge promptly and reheat them thoroughly. If you cannot remember how long they have been there, leave them.' },
  },
  {
    id: 'tip-5', kind: 'tip', emoji: '🔑',
    tc: { title: '出門前摸一摸', body: '出門前摸一摸袋：鎖匙、電話、八達通。再望一眼有冇關火、關窗。' },
    sc: { title: '出门前摸一摸', body: '出门前摸一摸口袋：钥匙、手机、公交卡。再看一眼有没有关火、关窗。' },
    en: { title: 'Before you go out', body: 'Check your pocket: keys, phone, travel card. Then take one look back — cooker off, windows closed.' },
  },
  {
    id: 'tip-6', kind: 'tip', emoji: '📵',
    tc: { title: '電話叫你畀密碼', body: '有人打嚟叫你講驗證碼、銀行密碼或者即刻轉帳，先收線，再搵屋企人商量。真正嘅機構唔會咁做。' },
    sc: { title: '电话里要密码', body: '有人打电话要你说验证码、银行密码或者马上转账，先挂断，再找家人商量。真正的机构不会这样做。' },
    en: { title: 'Never give codes by phone', body: 'If a caller asks for an OTP, a bank password or an instant transfer, hang up and talk to family first. Real organisations do not ask this way.' },
  },
  {
    id: 'tip-7', kind: 'tip', emoji: '🌦️',
    tc: { title: '出門先望天氣', body: '出門前望吓天氣同警告。有暴雨或者酷熱警告，就改期、帶遮同帶水，唔使急。' },
    sc: { title: '出门先看天气', body: '出门前看看天气和预警。有暴雨或酷热预警，就改期、带伞和带水，不用急。' },
    en: { title: 'Check the weather first', body: 'Look at the weather and any warnings before leaving. In a rainstorm or extreme heat, go another time, or take an umbrella and water.' },
  },

  // ---- 中國智慧故事 --------------------------------------------------------
  {
    id: 'wisdom-1', kind: 'wisdom', emoji: '⛰️',
    tc: { title: '愚公移山', body: '門前有兩座大山，愚公決定每日掘少少。有人笑佢傻，佢話：「我掘唔完，仲有仔孫。」今日掘一籮，聽日掘一籮，山就慢慢矮落去。學英文都一樣：每日認一個字，一年就三百幾個。' },
    sc: { title: '愚公移山', body: '门前有两座大山，愚公决定每天挖一点。有人笑他傻，他说：「我挖不完，还有子孙。」今天挖一筐，明天挖一筐，山就慢慢矮下去。学英文也一样：每天认一个词，一年就是三百多个。' },
    en: { title: 'The old man who moved a mountain', body: 'Two mountains blocked his door, so the old man dug a little every day. "I may not finish," he said, "but my children will." Learning English works the same way: one word a day is more than three hundred in a year.' },
  },
  {
    id: 'wisdom-2', kind: 'wisdom', emoji: '🐎',
    tc: { title: '塞翁失馬', body: '邊疆老人走失咗一匹馬，鄰居嚟安慰，佢話：「未必係壞事。」幾日後匹馬帶咗另一匹馬返嚟。一時嘅好壞，唔使太快落判斷，慢慢睇。' },
    sc: { title: '塞翁失马', body: '边疆老人丢了一匹马，邻居来安慰，他说：「未必是坏事。」几天后那匹马带回另一匹马。一时的好坏，不用太快下判断，慢慢看。' },
    en: { title: 'The old man at the border', body: 'When his horse ran away, the neighbours offered sympathy. "Who knows if this is bad luck?" he said. Days later the horse returned with another. Good and bad take time to reveal themselves.' },
  },
  {
    id: 'wisdom-3', kind: 'wisdom', emoji: '🐇',
    tc: { title: '守株待兔', body: '農夫見到一隻兔撞喺樹頭，從此日日坐喺樹下等，田都唔耕，最後咩都等唔到。機會唔會日日撞埋嚟；想學識新嘢，撳一下「聽英文」就有得學。' },
    sc: { title: '守株待兔', body: '农夫看见一只兔子撞在树桩上，从此天天坐在树下等，田也不耕，最后什么也没等到。机会不会天天撞过来；想学新东西，点一下「听英文」就能开始。' },
    en: { title: 'Waiting by the tree stump', body: 'A farmer saw a rabbit run into a stump and sat there every day waiting for another. His field went untended. Opportunities do not arrive twice by themselves — tap "Listen" and start.' },
  },

  // ---- Understand your helper (E1, editorial composite, NOT an interview) ---
  {
    id: 'helper-1', kind: 'helper', emoji: '🏠',
    tc: { title: '「我都會掛住屋企」', body: '我喺香港照顧屋企人，我自己嘅小朋友喺家鄉由外婆帶。放假嗰陣，我最想嘅係同佢哋視像，聽吓佢哋今日食咗咩。你問我一句「屋企人好嗎」，我會好開心。' },
    sc: { title: '「我也会想家」', body: '我在香港照顾一家人，我自己的孩子在家乡由外婆带。放假的时候，我最想跟他们视频，听听他们今天吃了什么。你问我一句「家里人好吗」，我会很开心。' },
    en: { title: '"I miss my family too"', body: 'I look after a family here in Hong Kong, and my own children are back home with their grandmother. On my day off, all I want is a video call and to hear what they ate today. Asking "How is your family?" means a lot.' },
  },
  {
    id: 'helper-2', kind: 'helper', emoji: '🗣️',
    tc: { title: '「我唔係唔想做，係有時聽唔明」', body: '一句說話講得快，或者夾雜住我未學過嘅詞，我就會猶豫。可唔可以講慢少少、指一指嗰樣嘢，或者寫低？我想做啱，唔想靠估。' },
    sc: { title: '「我不是不想做，是有时听不懂」', body: '一句话讲得太快，或者夹着我没学过的词，我就会犹豫。可以讲慢一点、指一指那样东西，或者写下来吗？我想做对，不想靠猜。' },
    en: { title: '"I want to get it right"', body: 'When an instruction is very fast, or uses a word I have not learned, I hesitate. Could you say it a little slower, point to the thing, or write it down? I want to do it correctly, not guess.' },
  },
  {
    id: 'helper-3', kind: 'helper', emoji: '🎉',
    tc: { title: '「我都有自己嘅節日」', body: '我哋家鄉有自己嘅節日、食物同歌。有時我會同朋友聚一聚，或者帶啲小食返嚟。你問我哋點慶祝，我會好樂意講你知。' },
    sc: { title: '「我也有自己的节日」', body: '我的家乡有自己的节日、食物和歌。有时我会和朋友聚一聚，或者带点小吃回来。你问问我们怎么庆祝，我会很乐意讲给你听。' },
    en: { title: '"I have my own festivals"', body: 'Back home we have our own holidays, food and songs. On my day off I may meet friends or bring back a small snack. Ask me how we celebrate — I would love to tell you.' },
  },
  {
    id: 'helper-4', kind: 'helper', emoji: '🤝',
    tc: { title: '「大家住得舒服嘅小貼士」', body: '一張寫清楚嘅清單、一個固定放鎖匙嘅位置、一句「唔該」，就已經好好。有改動早少少講，我會更容易安排，唔會手忙腳亂。' },
    sc: { title: '「大家住得舒服的小贴士」', body: '一张写清楚的清单、一个固定放钥匙的位置、一句「谢谢」，就已经很好。有变动早一点说，我会更容易安排，不会手忙脚乱。' },
    en: { title: '"Small things that help us both"', body: 'A short written list, one fixed place for the keys, and a "thank you" go a long way. If plans change, telling me a little earlier helps me arrange things calmly.' },
  },
];

// ---------------------------------------------------------------------------
// F1 — preset feelings. No free-text input, so nothing here can need
// moderation, and an elder with limited dexterity can still say something.
// ---------------------------------------------------------------------------
const MOODS = [
  { id: 'glad', emoji: '😊', tc: '今日幾開心', sc: '今天挺开心', en: 'Feeling good today' },
  { id: 'calm', emoji: '😌', tc: '平安無事', sc: '平安无事', en: 'All well here' },
  { id: 'thanks', emoji: '🙏', tc: '多謝你', sc: '谢谢你', en: 'Thank you' },
  { id: 'cheer', emoji: '💪', tc: '一齊加油', sc: '一起加油', en: 'Keep going!' },
  { id: 'tired', emoji: '😴', tc: '有啲攰', sc: '有点累', en: 'A little tired' },
  { id: 'chat', emoji: '💬', tc: '想傾下偈', sc: '想聊聊天', en: 'Would like a chat' },
  { id: 'love', emoji: '❤️', tc: '掛住你', sc: '想你了', en: 'Thinking of you' },
  { id: 'sunny', emoji: '🌤️', tc: '天氣好好', sc: '天气很好', en: 'Lovely weather' },
];

// ---------------------------------------------------------------------------
// A6 — official local information. Links only, plus the live HKO/1823 feed
// already exposed by /api/today-in-hk. No invented headlines.
// ---------------------------------------------------------------------------
const LOCAL_LINKS = [
  {
    id: 'hko', icon: '🌡️', url: 'https://www.hko.gov.hk/en/wxinfo/currwx/warningsum.htm',
    tc: { title: '香港天文台 · 天氣同警告', desc: '官方即時天氣、暴雨同酷熱警告' },
    sc: { title: '香港天文台 · 天气和预警', desc: '官方实时天气、暴雨和酷热预警' },
    en: { title: 'Hong Kong Observatory', desc: 'Official live weather, rainstorm and heat warnings' },
  },
  {
    id: 'holiday', icon: '📅', url: 'https://www.1823.gov.hk/en/public-holiday/',
    tc: { title: '1823 · 公眾假期', desc: '政府公布嘅公眾假期日期' },
    sc: { title: '1823 · 公众假期', desc: '政府公布的公众假期日期' },
    en: { title: '1823 · Public holidays', desc: 'Official general holiday calendar' },
  },
  {
    id: 'news', icon: '📰', url: 'https://www.news.gov.hk/eng/',
    tc: { title: '香港政府新聞網', desc: '官方本地新聞，唔使登入' },
    sc: { title: '香港政府新闻网', desc: '官方本地新闻，不用登录' },
    en: { title: 'news.gov.hk', desc: 'Official Hong Kong government news, no login' },
  },
  {
    id: 'swd', icon: '🏛️', url: 'https://www.swd.gov.hk/en/',
    tc: { title: '社會福利署', desc: '長者服務同社區支援嘅官方資訊' },
    sc: { title: '社会福利署', desc: '长者服务和社区支援的官方信息' },
    en: { title: 'Social Welfare Department', desc: 'Official information on elderly services and community support' },
  },
];

// ---------------------------------------------------------------------------
// B2 / D2 — help directory. EVERY phone number is copied from the verified
// DIRECTORY in public/tools.js. Unverified services are website links instead.
// ---------------------------------------------------------------------------
const HELP_GROUPS = [
  {
    id: 'danger', icon: '🚨', emergency: true,
    tc: { title: '即刻有危險' }, sc: { title: '马上有危险' }, en: { title: 'In immediate danger' },
    entries: [
      {
        id: '999', icon: '🚨', phone: '999', display: '999', web: null,
        tc: { name: '警察 · 消防 · 救護車', desc: '香港免費緊急電話，日夜都有人聽。講唔到廣東話可以講 English。' },
        sc: { name: '警察 · 消防 · 救护车', desc: '香港免费紧急电话，日夜都有人接。不会说广东话可以讲 English。' },
        en: { name: 'Police · Fire · Ambulance', desc: 'Free 24-hour emergency call in Hong Kong. English is available.' },
      },
    ],
  },
  {
    id: 'government', icon: '🏛️',
    tc: { title: '政府同社區支援' }, sc: { title: '政府和社区支援' }, en: { title: 'Government & community' },
    entries: [
      {
        id: 'swd-hotline', icon: '☎️', phone: '23432255', display: '2343 2255',
        web: 'https://www.swd.gov.hk/en/',
        tc: { name: '社會福利署熱線', desc: '政府服務查詢。長者服務詳情可睇官方網站。' },
        sc: { name: '社会福利署热线', desc: '政府服务查询。长者服务详情请看官方网站。' },
        en: { name: 'Social Welfare Department hotline', desc: 'Government service enquiries. See the official site for elderly services.' },
      },
      {
        id: 'labour-fdh', icon: '📞', phone: '27171771', display: '2717 1771',
        web: 'https://www.fdh.labour.gov.hk/en/contact_us.html',
        tc: { name: '勞工處 · 外傭 24 小時熱線', desc: '關於家務助理嘅合約、假期同薪金問題（由 1823 接聽）。' },
        sc: { name: '劳工处 · 外佣 24 小时热线', desc: '关于家务助理的合同、假期和薪金问题（由 1823 接听）。' },
        en: { name: 'Labour Department · FDH 24-hour hotline', desc: 'Contract, rest-day and pay questions about a domestic helper. Answered by 1823.' },
      },
    ],
  },
  {
    id: 'talk', icon: '💬',
    tc: { title: '想搵人傾吓' }, sc: { title: '想找人聊聊' }, en: { title: 'Someone to talk to' },
    entries: [
      {
        id: 'samaritans', icon: '💬', phone: '28960000', display: '2896 0000', web: null,
        tc: { name: '撒瑪利亞會（英語）', desc: '24 小時保密傾訴熱線。' },
        sc: { name: '撒玛利亚会（英语）', desc: '24 小时保密倾诉热线。' },
        en: { name: 'The Samaritans (English)', desc: '24-hour confidential someone to talk to.' },
      },
      {
        id: 'help-ngo', icon: '🤝', phone: '25234020', display: '2523 4020',
        whatsapp: '85259363780', web: 'https://helpfordomesticworkers.org/get-help/',
        tc: { name: 'HELP for Domestic Workers', desc: '免費意見同轉介，俾家務助理用；屋企人都可以幫手問。' },
        sc: { name: 'HELP for Domestic Workers', desc: '免费意见和转介，给家务助理用；家人也可以帮忙问。' },
        en: { name: 'HELP for Domestic Workers', desc: 'Free advice and referrals for domestic helpers; family members may call on their behalf.' },
      },
    ],
  },
];

/** The sources behind the numbers above, kept visible so they can be re-checked. */
const HELP_SOURCES = [
  { label: 'Labour Department FDH — Contact us', url: 'https://www.fdh.labour.gov.hk/en/contact_us.html' },
  { label: 'HELP for Domestic Workers — Get help', url: 'https://helpfordomesticworkers.org/get-help/' },
  { label: 'Social Welfare Department', url: 'https://www.swd.gov.hk/en/' },
  { label: 'Hong Kong Observatory — weather warnings', url: 'https://www.hko.gov.hk/en/wxinfo/currwx/warningsum.htm' },
];

const HELP_NOTE = {
  tc: '電話號碼只適用於香港，資料核對日期 2026-11-06，來源見下面連結。如有即時危險，請先撥 999。呢度係一般資訊，唔係醫療或法律意見。',
  sc: '电话号码只适用于香港，资料核对日期 2026-11-06，来源见下面链接。如有即时危险，请先拨 999。这里是一般信息，不是医疗或法律意见。',
  en: 'These are Hong Kong numbers, checked 2026-11-06; sources are linked below. In immediate danger call 999 first. General information only — not medical or legal advice.',
};

/** Helper-voice cards are editorial composites, not quotations from a person. */
const HELPER_NOTE = {
  tc: '以下係編輯整理嘅常見心聲，唔係真人訪問。希望幫大家多一分明白。',
  sc: '以下是编辑整理的常见心声，不是真人采访。希望大家多一分理解。',
  en: 'These are editorial composites of common experiences, not interviews. Shared to help everyone understand one another.',
};

// ---------------------------------------------------------------------------
// A1 — deterministic daily rotation in Hong Kong time (UTC+8, no DST)
// ---------------------------------------------------------------------------
function hktDateKey(refMs = Date.now()) {
  return new Date(refMs + HKT_MS).toISOString().slice(0, 10);
}
function hktDayIndex(refMs = Date.now()) {
  return Math.floor((refMs + HKT_MS) / DAY_MS);
}
function rotate(list, n) {
  if (!list.length) return null;
  return list[((n % list.length) + list.length) % list.length];
}
function byKind(kind) {
  return ELDER_ITEMS.filter((i) => i.kind === kind);
}
function dailySelection(refMs = Date.now()) {
  const day = hktDayIndex(refMs);
  return {
    date: hktDateKey(refMs),
    picks: {
      joke: rotate(byKind('joke'), day),
      tip: rotate(byKind('tip'), day),
      wisdom: rotate(byKind('wisdom'), day),
      helper: rotate(byKind('helper'), day),
    },
  };
}

/** Pick the tc / sc / en branch for the current /en UI language. */
function localised(entry, lang) {
  if (!entry) return null;
  if (lang === 'zh') return entry.sc || entry.tc;
  if (lang === 'fil' || lang === 'id') return entry.en || entry.tc;
  return entry.tc || entry.en;
}

/** Shape returned by GET /api/en/elder/content. */
function publicContent(refMs = Date.now()) {
  return {
    version: CONTENT_VERSION,
    daily: dailySelection(refMs),
    items: ELDER_ITEMS,
    moods: MOODS,
    localLinks: LOCAL_LINKS,
    helperNote: HELPER_NOTE,
    shareSite: SHARE_SITE,
  };
}

/** Shape returned by GET /api/en/elder/help. */
function helpDirectory() {
  return {
    verifiedOn: VERIFIED_ON,
    groups: HELP_GROUPS,
    sources: HELP_SOURCES,
    note: HELP_NOTE,
    localLinks: LOCAL_LINKS,
  };
}

module.exports = {
  CONTENT_VERSION, SHARE_SITE, VERIFIED_ON, HKT_MS,
  ELDER_ITEMS, MOODS, LOCAL_LINKS, HELP_GROUPS, HELP_SOURCES, HELP_NOTE, HELPER_NOTE,
  hktDateKey, hktDayIndex, rotate, byKind, dailySelection, localised,
  publicContent, helpDirectory,
};
