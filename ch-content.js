'use strict';
/**
 * CantoBuddy — /ch: a starting shelf for people who have come to Hong Kong
 * from the mainland.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The audience is not a helper and not an elder learning English. They are
 * newly arrived adults and families who need three things quickly: to read
 * daily life in Cantonese, to find a school or a job, and — the part most
 * guides skip — to find other people. Everything here is authored ONCE in
 * Traditional Chinese, then converted to Simplified by zh-convert.js at render
 * time. Do not paste two versions of a sentence here; that is how they drift.
 *
 * Every external link below is an official government page, an organisation
 * named on the Home Affairs Department's new-arrivals partner list, or the
 * Hong Kong Tourism Board. Check a link before replacing it: a dead "help"
 * link costs more trust than a missing one.
 */

const CH_SOURCE_DATE = '2026-11-27';

const CH_UI = {
  eyebrow: '新來港人士專區',
  homeTitle: '剛剛來到香港？由呢度開始。',
  homeLede: '認識香港、搵學、搵工，同埋最重要的——搵到可以同行的人。內容用繁體寫成，一撳就轉簡體。',
  scriptLabel: '文字',
  traditional: '繁體',
  simplified: '简体',
  scriptNote: '兩個版本是同一頁，分享連結可以直接轉發。',
  startHere: '由這裏開始',
  allTopics: '全部主題',
  explore: '睇完整指南',
  stepsTitle: '怎樣開始',
  phrasesTitle: '你會聽到的話',
  resourcesTitle: '官方資源',
  peopleTitle: '可以 Contact 的機構',
  weekTitle: '一星期行動清單',
  backHome: '返回新來港人士專區',
  nextLabel: '下一站',
  appTitle: '同時學吓粵語',
  appText: 'CantoBuddy 用生活場景教你粵語：買嘢、搭車、開戶、同鄰舍打招呼。免費，唔使註冊。',
  appButton: '打開 CantoBuddy',
  footerNote: '本頁提供一般生活資訊，具體資格、申請手續同活動日期請以政府及機構最新公佈為準。',
  officialNote: '資料來源：政府部門及民政事務總署認可機構，最後核對日期 2026-11-27。'
};

const CH_LINKS = {
  hadGuideTc: 'https://www.had.gov.hk/file_manager/tc/documents/public_services/services_for_new_arrivals_from_the_mainland/handbook/Edition_30.pdf',
  hadGuideSc: 'https://www.had.gov.hk/file_manager/sc/documents/public_services/services_for_new_arrivals_from_the_mainland/handbook/Edition_30.pdf',
  hadNewArrivals: 'https://www.had.gov.hk/tc/public_services/services_for_new_arrivals_from_the_mainland/index.htm',
  hadActivities: 'https://www.had.gov.hk/tc/public_services/services_for_new_arrivals_from_the_mainland/activity.php',
  hadNgos: 'https://www.had.gov.hk/tc/public_services/services_for_new_arrivals_from_the_mainland/role.php',
  hadCommunity: 'https://www.had.gov.hk/tc/public_services/community_halls_centres_index.htm',
  housing: 'https://www.housingauthority.gov.hk/tc/flat-application/application-guide/new-arrivals/index.html',
  transport: 'https://www.td.gov.hk/tc/transport_in_hong_kong/public_transport/index.html',
  hkemobility: 'https://www.td.gov.hk/en/public_services/hong_kong_emobility/index.html',
  edbPlacement: 'https://www.edb.gov.hk/tc/student-parents/newly-arrived-children/placement/index.html',
  edbReo: 'https://www.edb.gov.hk/tc/contact-us/reo.html',
  edbForm: 'https://www.edb.gov.hk/tc/public-admin/public-forms/about-public-forms/edb115_20200519133211.html',
  cef: 'https://www.lwb.gov.hk/tc/highlights/CEF/index.html',
  erb: 'https://www.erb.org/',
  erbSc: 'https://www.erb.org/home/erb/cn/',
  vtc: 'https://www.vtc.edu.hk/tc/home.html',
  jobs: 'https://www.jobs.gov.hk/',
  jobsNewArrivals: 'https://www.jobs.gov.hk/0/tc/jobseeker/Na/JobServiceForNewArrivals/',
  labour: 'https://www.labour.gov.hk/tc/public/content2_5.htm',
  arts: 'https://www.discoverhongkong.com/tc/arts.html',
  culture: 'https://www.discoverhongkong.com/tc/culture.html',
  hkpl: 'https://www.hkpl.gov.hk/tc/'
};

const CH_TOPICS = [
  {
    slug: 'start',
    title: '落地香港：第一個月',
    summary: '身份、電話卡、八達通、住處同區內服務 — 將最急的事排好次序。',
    metaTitle: '新來港人士落地香港指南：第一個月要辦的事 | CantoBuddy',
    metaDescription: '內地新來港人士到香港後第一個月的實用清單：證件、電話卡、八達通、銀行、住處、民政諮詢中心，以及繁體／簡體服務指南。',
    steps: [
      { title: '先把隨身資料整理好', body: '護照或往返證件、簽注、入境許可、住址證明同緊急聯絡人資料，各自影印一份，手機入面再存一份。辦任何服務都會用到，唔使每次翻行李。' },
      { title: '電話卡同八達通先辦', body: '一落地就要能被聯絡。電話卡揀可以接收香港短信嘅計劃，因為銀行、政府服務同求職平台常用短信驗證。八達通適用於港鐵、巴士、便利店，差不多每日都要用。' },
      { title: '去一次你所屬區嘅民政諮詢中心', body: '民政事務總署喺 18 區都有諮詢中心，可以問區內服務、活動同社區組織。帶住住址證明去，職員會告訴你最近可以用嘅資源。' },
      { title: '唔好急住一次過搞掂所有嘢', body: '第一星期先確保有得住、有得聯絡；第二星期先辦銀行同交通；到第三、四星期先開始搵學、搵工同參加社區活動。慢一點，反而穩陣。' }
    ],
    phrases: [
      { cantonese: '唔該，我想問…', meaning: '禮貌地開始問問題，差不多任何服務場所都適用。' },
      { cantonese: '呢張表格點填？', meaning: '看不懂表格時直接用這句，職員一般會指引你。' },
      { cantonese: '有冇簡體版？', meaning: '政府表格和服務指南很多都有簡體版本，可以主動問。' }
    ],
    resources: [
      { name: '新來港定居人士服務指南（繁體／簡體）', url: CH_LINKS.hadGuideTc, note: '民政事務總署每年更新，涵蓋日常生活、政府部門同服務機構聯絡資料；簡體版在同一頁提供。' },
      { name: '民政事務總署：內地新來港定居人士支援服務', url: CH_LINKS.hadNewArrivals, note: '官方入口，包括大使計劃、地區融入計劃、語文課程津貼同服務指南。' },
      { name: '香港房屋委員會：新來港人士', url: CH_LINKS.housing, note: '申請公屋的基本資格，以及租買私人樓宇時要避開的非法分間單位。' }
    ],
    week: [
      '第 1 日：電話卡可以收香港短信，手機存好重要資料。',
      '第 2 至 3 日：買八達通，熟習住所附近兩個港鐵站或巴士站。',
      '第 1 星期：去一次區內民政諮詢中心，攞服務指南。',
      '第 2 星期：開銀行戶口，問清楚手續費同短信驗證。',
      '第 1 個月：報名一次粵語班或社區活動，認識第一個街坊。'
    ]
  },
  {
    slug: 'everyday',
    title: '衣食住行：在香港過日子',
    summary: '街市、茶餐廳、冷氣、租約、港鐵同小巴 — 由日常細節認識香港。',
    metaTitle: '香港生活指南：衣、食、住、行 | 新來港人士 | CantoBuddy',
    metaDescription: '給內地新來港人士的香港日常生活指南：街市買餸、茶餐廳點餐、夏天穿搭、租樓注意、港鐵巴士小巴交通。[繁體／簡體]',
    steps: [
      { title: '食：由街市同茶餐廳開始', body: '街市通常比超市便宜，星期二、五收檔前會有減價；茶餐廳的「例湯」、「常餐」同「快餐」是香港日常。落單講「凍奶茶，少冰」已經好地道。穆斯林、素食或清真需要，可以先用手機搜尋區內店舖再打電話問。' },
      { title: '衣：夏天要防潮，冬天要洋蔥式穿着', body: '香港夏天又熱又潮，速乾衣物比厚棉舒服；冬天不太冷，但室內冷氣強，薄外套長年有用。帶一把摺傘，雨季和猛烈太陽都用得着。買鞋時試走斜坡樓梯，防滑比款式重要。' },
      { title: '住：睇清楚合約，唔好急住交大定金', body: '香港租金按平方米計，同一區價格差距可以很大。睇樓時問清楚是否合法分間單位、水電點計、有冇管理費，以及業主是否提供正式租約。官方提醒新來港人士不要買寮屋，遇到可疑單位可致電屋宇署熱線 2626 1616。' },
      { title: '行：港鐵、巴士、小巴各有規矩', body: '港鐵用八達通最方便；巴士上車付款、不設找續；綠色小巴要上車PayWave或八達通，紅色小巴很多路線接受現金，落車前要按鈴或喊「唔該，有落」。用「香港出行易」plan 路線，比估時間可靠。' }
    ],
    phrases: [
      { cantonese: '幾多錢？平啲得唔得？', meaning: '街市議價常用，語氣友善一點通常更有效。' },
      { cantonese: '唔該，有落！', meaning: '在小巴上要下車時喊這句，或者按車廂的鈴。' },
      { cantonese: '凍飲，少冰，唔該。', meaning: '茶餐廳落單；凍飲通常要加錢，少冰是常見要求。' }
    ],
    resources: [
      { name: '運輸署：公共交通', url: CH_LINKS.transport, note: '鐵路、巴士、小巴、電車同渡輪的官方資訊。' },
      { name: '香港出行易 HKeMobility', url: CH_LINKS.hkemobility, note: '運輸署的官方路程規劃工具，可查巴士同小巴路線。' },
      { name: '房屋署：新來港人士及私人樓宇注意事項', url: CH_LINKS.housing, note: '公屋申請與非法分間單位的官方提醒。' }
    ],
    week: [
      '去一次住所附近的街市，記下兩檔會講普通話或英語嘅檔口。',
      '行一次由屋企到最近港鐵站嘅路，計實際時間唔係地圖時間。',
      '拍低租約同水電錶讀數，存入手機。',
      '試一次茶餐廳落單，記住「凍飲」、「少冰」、「唔該」。',
      '傍晚時分去一趟附近公園，觀察街坊平時做甚麼。'
    ]
  },
  {
    slug: 'culture',
    title: '潮流文化：由茶餐廳到 M+',
    summary: '香港不只有高樓。流行曲、電影、博物館、節慶同街頭藝術，都係認識這座城的方法。',
    metaTitle: '香港潮流文化入門：新來港人士文化指南 | CantoBuddy',
    metaDescription: '從茶餐廳、街市、博物館、電影、流行曲到節慶，給新來港人士的香港潮流文化入門，附官方文化活動連結。[繁體／簡體]',
    steps: [
      { title: '由生活場景開始，唔使等到「懂文化」', body: '茶餐廳點餐、街市議價、睇八點新聞、搭電車去上環，本身就是香港文化。先將日常當成課堂，你會比導覽更快理解這裏的人。' },
      { title: '一個月去一個文化場所', body: 'M+、故宮文化博物館、大館、香港文化中心同各區公共圖書館，有些展覽免費，有些逢星期四免費入場。出發前睇官方頁確認開放時間同票價。' },
      { title: '流行曲同電影是快速入門', body: '聽幾首九十年代到現在的廣東歌，你會發現不少香港人用歌詞講生活；電影則由喜劇、警匪到文藝都有。電影資料館同圖書館常有免費或低價放映。' },
      { title: '節慶跟着街上看', body: '春節花車、端午龍舟、中秋綵燈、年宵花市，最熱鬧的往往不是票價最貴的活動。留意康樂及文化事務署同區議會的活動日曆，跟着人羣走就對了。' }
    ],
    phrases: [
      { cantonese: '呢首歌好熟耳，但唔知唱咩。', meaning: '和同事聊流行曲時很好用，對方通常會樂意推薦。' },
      { cantonese: '邊度有得睇？', meaning: '問哪裏可以看／哪裏有活動。' },
      { cantonese: '我想融入，但唔知由邊度開始。', meaning: '直接的說法，多數香港人會給你很具體的建議。' }
    ],
    resources: [
      { name: '香港旅遊發展局：藝聚香港', url: CH_LINKS.arts, note: '藝術活動、場地、畫廊同街頭藝術的官方指南。' },
      { name: '香港旅遊發展局：在地文化', url: CH_LINKS.culture, note: '文化節慶、歷史古蹟、博物館同宗教場所。' },
      { name: '香港公共圖書館', url: CH_LINKS.hkpl, note: '免費圖書、報章同講座，深水埗有專為新來港人士而設的社區圖書館。' }
    ],
    week: [
      '聽三首廣東歌，挑一句你喜歡的歌詞抄低。',
      '去一次免費展覽，唔使懂，睇到甚麼就寫低甚麼。',
      '問一位同事：「放工之後你通常去邊？」',
      '行一條老街，例如上環、深水埗或油麻地，記下三間老店。',
      '揀一個下個月的節慶，現在就查日期同地點。'
    ]
  },
  {
    slug: 'study',
    title: '搵學：小朋友同大人都唔同',
    summary: '新來港學童有教育局的學位安排；成年人有持續進修基金同再培訓課程。',
    metaTitle: '新來港人士搵學指南：學童入學、持續進修、再培訓 | CantoBuddy',
    metaDescription: '內地新來港兒童學位安排、區域教育服務處聯絡方式、持續進修基金 CEF 同僱員再培訓局 ERB 課程指南。[繁體／簡體]',
    steps: [
      { title: '小朋友：先聯絡學校，同時搽教育局', body: '家長可以直接向學校遞交申請，學校會按學位情況考慮；亦可按居住區域聯絡港島、九龍、新界東或新界西的區域教育服務處，職員會協助安排學位。特殊教育需要會轉介至教育局支援組。' },
      { title: '三條途徑一齊做，唔好只等一個答覆', body: '出入境管制站、教育局區域教育服務處同民政諮詢中心都有教育制度簡介單張，附郵柬或網上表格。遞交後，學位安排及支援組一般會在三個工作天內聯絡家長。查詢電話 2892 6191。' },
      { title: '大人：CEF 同 ERB 是兩個不同工具', body: '持續進修基金（CEF）資助成年人報讀合資格課程；僱員再培訓局（ERB）提供涵蓋多個行業同通用技能的課程，部分適合新來港人士。先用官方頁確認資格同開課日期，再交費。' },
      { title: '語文課程津貼要主動問', body: '民政事務總署為非在學的新來港人士提供語文課程津貼，亦有資助報考語文考試。這類資助未必在機構網站的醒目位置，打電話時直接講「我想問新來港人士語文課程津貼」。' }
    ],
    phrases: [
      { cantonese: '我想幫仔女申請學位。', meaning: '到教育局或民政諮詢中心時可直接這樣說。' },
      { cantonese: '有冇粵語班？幾時開課？', meaning: '問語文班最快的一句。' },
      { cantonese: '這個課程有冇資助？', meaning: '報名前一定要問，資格視乎個人情況。' }
    ],
    resources: [
      { name: '教育局：新來港兒童入學安排', url: CH_LINKS.edbPlacement, note: '申請途徑、流程圖、online form 同查詢電話。' },
      { name: '教育局：區域教育服務處', url: CH_LINKS.edbReo, note: '按港島、九龍、新界東、新界西找最近辦事處。' },
      { name: '持續進修基金 CEF', url: CH_LINKS.cef, note: '成年人進修資助的官方概覽。' },
      { name: '僱員再培訓局 ERB', url: CH_LINKS.erb, note: '課程涵蓋多個行業；網站亦有簡體版。' },
      { name: '職業訓練局 VTC', url: CH_LINKS.vtc, note: '職業訓練同進修課程資料。' }
    ],
    week: [
      '寫低小朋友的年級、居住面積同就近學校名。',
      '致電或電郵所屬區域教育服務處，問清楚所需文件。',
      '去一次民政諮詢中心，問新來港人士語文課程津貼。',
      '成年人上 CEF 同 ERB 官方頁各揀一個有興趣的課程。',
      '將報名截止日期寫入日曆，唔好靠記憶。'
    ]
  },
  {
    slug: 'work',
    title: '搵工：第一份工，由資料開始',
    summary: '勞工處的免費求職服務、新來港人士專櫃、再培訓課程同求職安全。',
    metaTitle: '新來港人士搵工指南：勞工處、職位搜尋、再培訓 | CantoBuddy',
    metaDescription: '內地新來港人士在香港搵工：勞工處互動就業服務、新來港人士就業輔導、再培訓課程，以及避免求職受騙的貼士。[繁體／簡體]',
    steps: [
      { title: '先用免費嘅官方平台', body: '勞工處互動就業服務 jobs.gov.hk 有空缺搜尋、招聘會同求職資源，設有「內地新來港人士」專頁。註冊帳戶後可以按行業、地區、薪酬同語言能力篩選。所有求職服務免費。' },
      { title: '去就業中心，唔好只上網', body: '就業中心為內地新來港求職人士設有特別櫃台同就業資訊角，可以同就業主任會面，討論求職方向、履歷同培訓需要，亦有工作轉介同就業講座。' },
      { title: '履歷要就香港寫', body: '將工作經驗寫成具體結果，例如「每日處理 80 張訂單」多過「負責訂單」。職位要求若寫「良好粵語」，先老實評估自己；「良好英語」通常用書面溝通。「可即時上班」是常見優勢，寫清楚你的到崗日期。' },
      { title: '遇上這些情況要停低', body: '正規僱主不會要求求職者先交保證金、培訓費或押金；面試地點若是私人住宅、對方不願意寫公司資料，或者要求交出身份證原件長期保管，都應該先離開再查證。有飲食或零售經驗的人可考慮 ERB 相關課程。' }
    ],
    phrases: [
      { cantonese: '我想搵全職／兼職。', meaning: '就業中心第一句可以這樣講。' },
      { cantonese: '我有幾年相關經驗。', meaning: '後面接具體的行業同數字會更有說服力。' },
      { cantonese: '幾時可以上班？', meaning: '面試官常問；準備好確切日期。' }
    ],
    resources: [
      { name: '勞工處互動就業服務', url: CH_LINKS.jobs, note: '官方免費空缺搜尋、招聘會同求職工具。' },
      { name: '勞工處：為內地新來港人士提供的就業服務', url: CH_LINKS.jobsNewArrivals, note: '特別櫃台、就業主任會面、就業資訊角同講座時間表。' },
      { name: '勞工處：就業服務', url: CH_LINKS.labour, note: '求職資料、職前培訓同附近就業中心地址。' },
      { name: '僱員再培訓局 ERB（簡體）', url: CH_LINKS.erbSc, note: '適合新來港人士的技能提升課程。' }
    ],
    week: [
      '用一頁 A4 寫好履歷，存成 PDF。',
      '在 jobs.gov.hk 註冊，設定三個工種提醒。',
      '去一次就近就業中心，問新來港人士專櫃服務。',
      '打電話問一個你感興趣的 ERB 課程開課日期。',
      '每天固定半小時回覆空缺，連續做兩星期。'
    ]
  },
  {
    slug: 'community',
    title: '搵朋友：你不該只有一個人',
    summary: '語文班、社區中心、圖書館、同鄉會同社工 — 香港有專門服務新來港人士的網絡。',
    metaTitle: '新來港人士社交網絡：香港社區、社工、語文班 | CantoBuddy',
    metaDescription: '內地新來港人士如何在香港建立社交網絡：民政事務總署活動季刊、社區中心、公共圖書館，以及服務新來港人士的非政府機構名單。「繁體／簡體」',
    steps: [
      { title: '唔使等到粵語講得好先去認識人', body: '很多社區活動本來就為新來港人士而設，職員習慣普通話，亦樂意慢慢講。第一次去可以只帶住問題，唔使帶住完美嘅粵語。' },
      { title: '三條路一齊行，成功機會最大', body: '第一條係政府服務：民政事務總署的地區活動同語文津貼；第二條係非政府機構的互助小組、課後託管同就業輔導；第三條係日常場所：圖書館、公園、球場同街市。三條路唔係二選一。' },
      { title: '按你所屬的區找活動', body: '民政事務總署每季度整理 18 區的活動和服務，包括適應課程、就業輔導、語文課程、分享小組同探訪活動。入官方頁按你所屬的區睇 PDF，打電話確認日期同報名方法。' },
      { title: '第一次接觸，講一句就夠', body: '「我想認識多啲街坊，有冇(activity)推薦？」通常就夠打開話題。約人出來時先講清楚時間、地鐵站同你嘅電話，讓對方安心。幫過你嘅人，下次記得主動打招呼——network 就係咁慢慢建立的。' }
    ],
    phrases: [
      { cantonese: '我想認識多啲街坊。', meaning: '在社區中心、語文班自我介紹時很好用。' },
      { cantonese: '可唔可以留個聯絡方法？', meaning: '禮貌地交換聯絡方式，不要直接索取證件資料。' },
      { cantonese: '下一次幾時舉行？', meaning: '問活動日期，通常職員會告訴你下一期。' }
    ],
    resources: [
      { name: '民政事務總署：活動和服務季刊（18 區）', url: CH_LINKS.hadActivities, note: '每季更新，按區列出適應課程、語文班、分享小組同探訪活動。' },
      { name: '民政事務總署：服務新來港人士的非政府機構', url: CH_LINKS.hadNgos, note: '官方認可機構名單，附電話同網站，按區聯繫最可靠。' },
      { name: '民政事務總署：社區會堂及社區中心', url: CH_LINKS.hadCommunity, note: '找住所附近可以報名活動、租場同認識街坊的地方。' },
      { name: '香港公共圖書館', url: CH_LINKS.hkpl, note: '免費講座、讀書會同社區圖書館，適合一家人一起去的低成本活動。' }
    ],
    people: [
      { name: '新家園協會', phone: '2815 7001', url: 'https://www.nha.org.hk/', note: '服務新來港、少數族裔人士的慈善機構，提供一站式社會服務同社區參與。' },
      { name: '新福事工協會', phone: '2729 6400', url: 'https://www.newarrivals.org.hk/', note: '專注新來港人士服務，網站名稱就是 New Arrivals。' },
      { name: '香港新來港人士服務基金', phone: '3998 4271', url: 'https://www.hknasf.org/', note: '提供升學、就業、家庭及學童課餘輔導，協助擴闊生活圈子。' },
      { name: '香港中華基督教青年會', phone: '2771 9111', url: 'https://www.ymca.org.hk/', note: '多區設有服務中心，常有親子、語文同社區活動。' },
      { name: '香港家庭福利會', phone: '2832 9700', url: 'https://www.hkfws.org.hk/', note: '家庭支援、親子活動同社區工作，適合帶小朋友的家庭。' },
      { name: '東華三院', phone: '2392 2133', url: 'https://www.tungwah.org.hk/', note: '全港多區設有社會服務單位，提供多元化的社區支援。' }
    ],
    week: [
      '第 1 日：喺民政事務總署頁找出你所屬區嘅季刊 PDF。',
      '第 2 日：揀一個免費活動，記低電話同報名期限。',
      '第 3 日：打去一間機構，直接問「我想認識新朋友，有冇推薦？」。',
      '第 4 日：去一次住所附近嘅社區中心或圖書館，攞活動月曆。',
      '第 5 日：用上面嘅粵語句子同一位職員或義工講一次。',
      '週末：出席活動並約定下一次見面嘅時間同地點。'
    ]
  }
];

module.exports = {
  CH_SOURCE_DATE,
  CH_UI,
  CH_LINKS,
  CH_TOPICS,
  topicBySlug(slug) { return CH_TOPICS.find((t) => t.slug === slug) || null; }
};
