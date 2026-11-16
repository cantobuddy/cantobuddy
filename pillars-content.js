'use strict';
/**
 * CantoBuddy — pillar / topic pages, in four languages.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The vocabulary pages are organised by the DATABASE (category, level, word).
 * That is right for browsing and wrong for search: nobody types "Kitchen
 * category", they type "how to say mop in Cantonese" or "Cantonese for
 * domestic helpers". These pillars are the pages that answer the QUERY, and
 * each one links down into the real vocabulary, Discover and /en pages so the
 * crawlable surface grows and the pages reinforce one another.
 *
 * Content lives here rather than in seo.js so the renderer stays small and the
 * copy can be edited without touching routing. Every language carries its own
 * slug, because a Filipino searcher types a Filipino query and should land on a
 * Filipino URL — that is the whole point of the fil/zh/id trees.
 *
 * `catRegex` selects the category pages a pillar links to (matched against the
 * English category name, which is the stable key). `postSlug` points at a
 * Discover article that belongs to the same intent.
 */

const PILLARS = {
  'cantonese-for-domestic-helpers': {
    icon: '🧹',
    catRegex: /kitchen|food|meal|clean|house|home|wash|shop|market|emergency|health|child|care|daily|family|greet|basic/i,
    postSlug: 'asking-where-does-this-go',
    en: {
      slug: 'cantonese-for-domestic-helpers',
      title: 'Cantonese for Domestic Helpers in Hong Kong',
      description:
        'The Cantonese words families actually use at home — housework, food, shopping and emergencies — with Jyutping and English. Free, no sign-up.',
      intro:
        'Most helpers learn Cantonese on the job, one shouted instruction at a time. This page collects the words that come up every day — the ones nobody translates for you — and groups them so you can learn the room you are standing in. No textbook, no homework. Just the words your employer already uses.',
      tips: [
        'Start with the kitchen. It is where most instructions are given, and where a wrong word costs the least.',
        'Learn the verb before the noun: 抹 (maat3) to wipe, 洗 (sai2) to wash, 煮 (zyu2) to cook. Then any object can follow.',
        'When you do not understand, 唔該講多次 (m4 goi1 gong2 do1 ci3) — “please say it again” — is never rude.',
        'Write new words on your phone with the tone. Tone is the difference between 買 (buy) and 賣 (sell).',
      ],
      postLabel: 'How to ask “where does this go?”',
    },
    fil: {
      slug: 'mga-salitang-cantonese-para-sa-katulong',
      title: 'Cantonese para sa mga Katulong sa Hong Kong',
      description:
        'Ang mga salitang Cantonese na talagang ginagamit sa bahay — gawaing-bahay, pagkain, pamimili at emergency — may Jyutping at Ingles. Libre.',
      intro:
        'Karamihan sa mga katulong, natututo ng Cantonese sa trabaho — isang sigaw ng utos sa isang pagkakataon. Dito nakolekta ang mga salitang lumalabas araw-araw, na hindi ipinapaliwanag sa iyo ng kahit sino, at nakaayos ayon sa kwartong kinatatayuan mo. Walang textbook, walang assignment. Ang mga salita lang na gamit na ng amo mo.',
      tips: [
        'Magsimula sa kusina. Doon madalas ang utos, at doon pinakamaliit ang gastos kung magkamali ka ng salita.',
        'Unahin ang pandiwa bago ang bagay: 抹 (maat3) punasan, 洗 (sai2) hugasan, 煮 (zyu2) lutuin.',
        'Kapag hindi mo naintindihan, ang 唔該講多次 (m4 goi1 gong2 do1 ci3) — “pakiulit po” — ay hindi bastos.',
        'Isulat ang bagong salita sa notes ng telepono kasama ang tono. Tono ang pagkakaiba ng 買 (bumili) at 賣 (magbenta).',
      ],
      postLabel: 'Paano itanong ang “saan ito nilalagay?”',
    },
    zh: {
      slug: 'yue-yu-jia-wu-ci-hui',
      title: '香港家佣粤语：家里真正用得到的词',
      description:
        '香港家庭每天都在用的粤语词——家务、饮食、购物和紧急情况，附粤拼和英文，免费学习，无需注册。',
      intro:
        '大多数家佣是在工作中学会粤语的——一次一句被喊出来的指令。这一页收集每天都会出现的词，那些没人会替你翻译的词，并按房间分好，让你学你正站着的地方。没有课本，没有作业，只有雇主已经在用的词。',
      tips: [
        '从厨房开始。那里指令最多，说错一个词的代价也最小。',
        '先学动词再学名词：抹 (maat3)、洗 (sai2)、煮 (zyu2)。学会动词，任何东西都能接。',
        '听不懂时，说 唔該講多次 (m4 goi1 gong2 do1 ci3)「请再说一次」，永远不失礼。',
        '把新词连声调一起记在手机备忘录里。声调不同，買（买）和賣（卖）就是两个词。',
      ],
      postLabel: '怎么问「这个放哪里？」',
    },
    id: {
      slug: 'bahasa-kanton-untuk-asisten-rumah-tangga',
      title: 'Bahasa Kanton untuk Asisten Rumah Tangga di Hong Kong',
      description:
        'Kata-kata Kanton yang benar-benar dipakai di rumah — pekerjaan rumah, makanan, belanja, dan darurat — dengan Jyutping dan Inggris. Gratis.',
      intro:
        'Sebagian besar asisten belajar bahasa Kanton sambil bekerja — satu perintah diteriakkan setiap kali. Halaman ini mengumpulkan kata-kata yang muncul setiap hari, yang tidak pernah diterjemahkan untuk Anda, dan menyusunnya per ruangan. Tanpa buku teks, tanpa PR. Hanya kata-kata yang sudah dipakai majikan Anda.',
      tips: [
        'Mulai dari dapur. Di sana paling banyak perintah, dan salah kata paling murah akibatnya.',
        'Pelajari kata kerja dulu: 抹 (maat3) mengelap, 洗 (sai2) mencuci, 煮 (zyu2) memasak.',
        'Kalau tidak paham, 唔該講多次 (m4 goi1 gong2 do1 ci3) — “tolong ulangi” — tidak pernah kasar.',
        'Catat kata baru di ponsel beserta nadanya. Nada membedakan 買 (beli) dan 賣 (jual).',
      ],
      postLabel: 'Cara bertanya “ini ditaruh di mana?”',
    },
  },

  'cantonese-for-elderly-learners': {
    icon: '👵',
    catRegex: /greet|number|basic|everyday|essential|useful|family|daily/i,
    postSlug: 'cantonese-survival-phrases-market',
    en: {
      slug: 'cantonese-for-elderly-learners',
      title: 'Cantonese & English for Elderly Learners',
      description:
        'Gentle English and Cantonese practice for older learners in Hong Kong — household words, greetings and everyday phrases, with clear audio.',
      intro:
        'Learning a language later in life works best with words you already know the meaning of — the kettle, the market, your grandson’s name. This page starts with the English-for-daily-life track, then the Cantonese topics that pair with it. Go slowly. One word a day is a good day.',
      tips: [
        'Use the English track (/en) to name household things and give simple instructions.',
        'Say the word out loud twice. The mouth remembers longer than the eyes.',
        'Pair a new word with a routine: 早晨 (zou2 san4) every morning, 晚安 every night.',
        'There is no exam. If you forget, the page will still be here tomorrow.',
      ],
      postLabel: 'Cantonese survival phrases for the market',
    },
    fil: {
      slug: 'cantonese-at-ingles-para-sa-matatanda',
      title: 'Cantonese at Ingles para sa mga Matatanda',
      description:
        'Mahinahong pagsasanay sa Ingles at Cantonese para sa mga matatandang nag-aaral sa Hong Kong — mga salita sa bahay, pagbati at parirala, may malinaw na audio.',
      intro:
        'Mas madaling matuto ng wika kapag may edad ka na kung pamilyar na ang mga salita — ang kettle, ang palengke, ang pangalan ng apo mo. Nagsisimula ang pahinang ito sa English-for-daily-life, pagkatapos ang mga paksang Cantonese na kaakibat nito. Dahan-dahan lang. Isang salita sa isang araw ay mabuti nang araw.',
      tips: [
        'Gamitin ang English track (/en) para pangalanan ang mga gamit sa bahay at magbigay ng simpleng utos.',
        'Bigkasin ang salita nang dalawang beses. Mas matagal matandaan ng bibig kaysa sa mata.',
        'Iugnay ang bagong salita sa gawain: 早晨 (zou2 san4) tuwing umaga, 晚安 tuwing gabi.',
        'Walang exam. Kung makalimutan mo, nandito pa rin ang pahina bukas.',
      ],
      postLabel: 'Mga survival na parirala sa palengke',
    },
    zh: {
      slug: 'yue-yu-yu-ying-yu-chang-zhe-xue-xi',
      title: '长者学粤语与英语',
      description:
        '为香港长者设计的温和英语与粤语练习——家居词汇、问候和日常用语，配有清晰发音。',
      intro:
        '年纪大一点学语言，最好从你已经知道意思的词开始——水壶、街市、孙子的名字。这一页先带你进入「每日英语」专区，再配上相应的粤语主题。慢慢来，一天一个词，就是好的一天。',
      tips: [
        '想说出家里的物品、给出简单指令，可以先用英语专区（/en）。',
        '把词大声念两遍。嘴比眼睛记得久。',
        '把新词和日常动作绑在一起：每天早上 早晨 (zou2 san4)，每晚 晚安。',
        '没有考试。忘了也没关系，明天这一页还在。',
      ],
      postLabel: '街市生存粤语',
    },
    id: {
      slug: 'bahasa-kanton-untuk-lansia',
      title: 'Bahasa Kanton & Inggris untuk Lansia',
      description:
        'Latihan bahasa Inggris dan Kanton yang lembut untuk pelajar lanjut usia di Hong Kong — kata rumah tangga, sapaan, dan frasa sehari-hari, dengan audio jelas.',
      intro:
        'Belajar bahasa di usia lanjut paling mudah dengan kata-kata yang sudah Anda kenal artinya — ketel, pasar, nama cucu. Halaman ini dimulai dengan jalur bahasa Inggris sehari-hari, lalu topik Kanton yang menyertainya. Pelan-pelan saja. Satu kata sehari sudah hari yang baik.',
      tips: [
        'Gunakan jalur bahasa Inggris (/en) untuk menyebut barang rumah dan memberi perintah sederhana.',
        'Ucapkan kata itu dua kali dengan suara keras. Mulut lebih lama ingat daripada mata.',
        'Pasangkan kata baru dengan kebiasaan: 早晨 (zou2 san4) setiap pagi, 晚安 setiap malam.',
        'Tidak ada ujian. Kalau lupa, halaman ini masih ada besok.',
      ],
      postLabel: 'Frasa Kanton untuk bertahan di pasar',
    },
  },

  'cantonese-food-phrases': {
    icon: '🍜',
    catRegex: /food|meal|kitchen|drink|fruit|vegetable|market|snack|restaurant/i,
    postSlug: 'cha-chaan-teng-hong-kong-style-cafe',
    en: {
      slug: 'cantonese-food-phrases',
      title: 'Ordering Food in Cantonese',
      description:
        'Order, shop and talk about food in Cantonese — market and supermarket words, classic dishes, and the Hong Kong café (Cha Chaan Teng) explained.',
      intro:
        'Food is where most everyday Cantonese happens. You will order, point, ask for less sugar and argue about whether the milk tea is hot enough — all in four or five words. This page collects the words for the market, the supermarket and the table, plus the café culture that invented half of them.',
      tips: [
        '唔該 (m4 goi1) before a request, 多謝 (do1 ze6) when something is handed to you as a gift.',
        '少甜 (siu2 tim1) = less sweet. 走冰 (zau2 bing1) = no ice. Two words that improve every drink order.',
        'In a Cha Chaan Teng, 凍檸茶 (dung3 ning2 caa4) is iced lemon tea — the national drink.',
        'At the market, 幾多錢 (gei2 do1 cin2) is “how much?”. Pointing works too, but the words get a better price.',
      ],
      postLabel: 'Cha Chaan Teng: the Hong Kong-style café',
    },
    fil: {
      slug: 'mga-salitang-cantonese-sa-pagkain',
      title: 'Pag-order ng Pagkain sa Cantonese',
      description:
        'Mag-order, mamili at mag-usap tungkol sa pagkain sa Cantonese — mga salita sa palengke at supermarket, klasikong pagkain, at ang Cha Chaan Teng.',
      intro:
        'Sa pagkain nangyayari ang karamihan ng araw-araw na Cantonese. Oorder ka, tuturo, hihingi ng kaunting asukal, at pagtatalunan kung sapat ang init ng milk tea — sa apat o limang salita lang. Dito nakolekta ang mga salita para sa palengke, supermarket at hapag, kasama ang kultura ng café na nagpauso sa kalahati ng mga ito.',
      tips: [
        '唔該 (m4 goi1) bago ang hiling, 多謝 (do1 ze6) kapag may ibinigay sa iyo.',
        '少甜 (siu2 tim1) = kaunting tamis. 走冰 (zau2 bing1) = walang yelo.',
        'Sa Cha Chaan Teng, ang 凍檸茶 (dung3 ning2 caa4) ay iced lemon tea — ang pambansang inumin.',
        'Sa palengke, 幾多錢 (gei2 do1 cin2) ang “magkano?”. Nakakatulong ang pagturo, pero mas maganda ang presyo kapag may salita.',
      ],
      postLabel: 'Cha Chaan Teng: ang café ng Hong Kong',
    },
    zh: {
      slug: 'yue-yu-yin-shi-yong-yu',
      title: '粤语点餐与饮食用语',
      description:
        '用粤语点餐、买菜、聊吃的——街市和超市词汇、经典菜式，以及茶餐厅文化。',
      intro:
        '日常生活里的粤语，多半发生在餐桌上。点单、指一指、要少糖、争论奶茶够不够热——四五个字就够了。这一页收集街市、超市和餐桌上的词，还有发明了其中一半词的那杯茶餐厅文化。',
      tips: [
        '提要求前说 唔該 (m4 goi1)，别人把东西递给你时说 多謝 (do1 ze6)。',
        '少甜 (siu2 tim1)＝少糖，走冰 (zau2 bing1)＝去冰。两个词，让每杯饮料都好喝一点。',
        '茶餐厅里，凍檸茶 (dung3 ning2 caa4) 是冻柠檬茶——本地人的国民饮料。',
        '街市里，幾多錢 (gei2 do1 cin2) 是「多少钱？」。指一指也行，但开口往往能拿到更好的价。',
      ],
      postLabel: '茶餐厅：香港式咖啡馆',
    },
    id: {
      slug: 'frasa-makanan-bahasa-kanton',
      title: 'Memesan Makanan dalam Bahasa Kanton',
      description:
        'Pesan, belanja, dan bicara soal makanan dalam bahasa Kanton — kata pasar dan supermarket, hidangan klasik, dan Cha Chaan Teng.',
      intro:
        'Makanan adalah tempat sebagian besar bahasa Kanton sehari-hari terjadi. Anda memesan, menunjuk, minta kurang gula, dan berdebat apakah teh susunya cukup panas — semuanya dalam empat atau lima kata. Halaman ini mengumpulkan kata untuk pasar, supermarket, dan meja makan, plus budaya kafe yang menemukan separuhnya.',
      tips: [
        '唔該 (m4 goi1) sebelum meminta, 多謝 (do1 ze6) saat sesuatu diberikan sebagai hadiah.',
        '少甜 (siu2 tim1) = kurang manis. 走冰 (zau2 bing1) = tanpa es.',
        'Di Cha Chaan Teng, 凍檸茶 (dung3 ning2 caa4) adalah es teh lemon — minuman nasional.',
        'Di pasar, 幾多錢 (gei2 do1 cin2) berarti “berapa?”. Menunjuk bisa, tapi kata-kata memberi harga lebih baik.',
      ],
      postLabel: 'Cha Chaan Teng: kafe gaya Hong Kong',
    },
  },

  'cantonese-for-health-emergencies': {
    icon: '🚑',
    catRegex: /health|emergency|body|sick|medical|hospital|doctor/i,
    postSlug: 'saying-you-feel-sick-in-cantonese',
    en: {
      slug: 'cantonese-for-health-emergencies',
      title: 'Cantonese for Health & Medical Emergencies',
      description:
        'The Cantonese words that get help fast — feeling sick, pain, fever, calling an ambulance, and talking to a doctor or pharmacist.',
      intro:
        'When something goes wrong, language is the first thing that fails. These are the words to say before you can think of a sentence: where it hurts, how long, and whether you need an ambulance. Learn them now, while nothing is happening.',
      tips: [
        '我唔舒服 (ngo5 m4 syu1 fuk6) = “I don’t feel well”. The one sentence that starts every conversation.',
        '邊度痛 (bin1 dou6 tung3) = “where does it hurt?”. Answer 呢度 (ni1 dou6) = “here” and point.',
        'Call 999 for an ambulance. 救護車 (gau3 wu6 ce1) is the word for it.',
        '發燒 (faat3 siu1) = fever, 頭痛 (tau4 tung3) = headache, 肚痛 (tou5 tung3) = stomach ache.',
        'At the pharmacy, show the phone: 我發燒 (ngo5 faat3 siu1) and they will point you to the right shelf.',
      ],
      postLabel: 'Telling someone you feel sick',
    },
    fil: {
      slug: 'cantonese-para-sa-kalusugan-at-emergency',
      title: 'Cantonese para sa Kalusugan at Emergency',
      description:
        'Ang mga salitang Cantonese na nagdadala ng tulong agad — pakiramdam na may sakit, pananakit, lagnat, pagtawag ng ambulansya, at pakikipag-usap sa doktor o parmasya.',
      intro:
        'Kapag may nangyaring mali, ang wika ang unang bumibigay. Ito ang mga salitang masasabi mo bago ka pa makaisip ng buong pangungusap: saan masakit, gaano katagal, at kung kailangan mo ng ambulansya. Pag-aralan ngayon, habang wala pang nangyayari.',
      tips: [
        '我唔舒服 (ngo5 m4 syu1 fuk6) = “masama ang pakiramdam ko”. Isang pangungusap na nagbubukas ng lahat.',
        '邊度痛 (bin1 dou6 tung3) = “saan masakit?”. Sumagot ng 呢度 (ni1 dou6) = “dito” at ituro.',
        'Tumawag ng 999 para sa ambulansya. 救護車 (gau3 wu6 ce1) ang salita para dito.',
        '發燒 (faat3 siu1) = lagnat, 頭痛 (tau4 tung3) = sakit ng ulo, 肚痛 (tou5 tung3) = sakit ng tiyan.',
        'Sa parmasya, ipakita ang telepono: 我發燒 (ngo5 faat3 siu1) at ituturo nila ang tamang shelf.',
      ],
      postLabel: 'Pagsasabi na masama ang pakiramdam mo',
    },
    zh: {
      slug: 'yue-yu-jian-kang-yu-jin-ji-yong-yu',
      title: '粤语健康与紧急用语',
      description:
        '能马上求助的粤语——不舒服、疼痛、发烧、叫救护车，以及和医生、药房沟通。',
      intro:
        '出事的时候，最先失灵的就是语言。这些词让你在想不出整句话之前就能开口：哪里痛、痛了多久、要不要叫救护车。趁现在没事，先学会。',
      tips: [
        '我唔舒服 (ngo5 m4 syu1 fuk6)＝「我不舒服」。一句话就能开始所有对话。',
        '邊度痛 (bin1 dou6 tung3)＝「哪里痛？」。回答 呢度 (ni1 dou6)「这里」，再指一指。',
        '叫救护车打 999。救护车的粤语是 救護車 (gau3 wu6 ce1)。',
        '發燒 (faat3 siu1)＝发烧，頭痛 (tau4 tung3)＝头痛，肚痛 (tou5 tung3)＝肚子痛。',
        '在药房把手机给店员看：我發燒 (ngo5 faat3 siu1)，他们会带你去对的货架。',
      ],
      postLabel: '怎么说不舒服',
    },
    id: {
      slug: 'bahasa-kanton-untuk-kesehatan-dan-darurat',
      title: 'Bahasa Kanton untuk Kesehatan & Darurat',
      description:
        'Kata-kata Kanton yang mendatangkan bantuan cepat — merasa sakit, nyeri, demam, memanggil ambulans, dan berbicara dengan dokter atau apoteker.',
      intro:
        'Saat sesuatu terjadi, bahasa adalah hal pertama yang gagal. Ini kata-kata yang bisa Anda ucapkan sebelum sempat menyusun kalimat: di mana sakitnya, sudah berapa lama, dan apakah perlu ambulans. Pelajari sekarang, selagi belum terjadi apa-apa.',
      tips: [
        '我唔舒服 (ngo5 m4 syu1 fuk6) = “saya tidak enak badan”. Satu kalimat pembuka semua percakapan.',
        '邊度痛 (bin1 dou6 tung3) = “di mana sakitnya?”. Jawab 呢度 (ni1 dou6) = “di sini” sambil menunjuk.',
        'Telepon 999 untuk ambulans. 救護車 (gau3 wu6 ce1) adalah kata untuknya.',
        '發燒 (faat3 siu1) = demam, 頭痛 (tau4 tung3) = sakit kepala, 肚痛 (tou5 tung3) = sakit perut.',
        'Di apotek, tunjukkan ponsel: 我發燒 (ngo5 faat3 siu1) dan mereka akan mengarahkan ke rak yang tepat.',
      ],
      postLabel: 'Mengatakan Anda merasa sakit',
    },
  },

  'cantonese-greetings': {
    icon: '👋',
    catRegex: /greet|basic|common|family/i,
    postSlug: 'have-you-eaten-is-a-greeting',
    en: {
      slug: 'cantonese-greetings',
      title: 'Cantonese Greetings: Hello, Thank You & Goodbye',
      description:
        'The Cantonese greetings and polite words you will use every day — good morning, thank you, sorry and goodbye — with Jyutping and plain meanings. Free, no sign-up.',
      intro:
        'In Hong Kong the first words you say matter more than perfect grammar. A cheerful 早晨 gets a smile; the right 唔該 gets help. This page gathers the small words that open every conversation — greetings, thanks, apologies and goodbyes — with the Jyutping you need to say them out loud.',
      tips: [
        '早晨 (zou2 san4) is good morning — the everyday greeting, used from early until about eleven.',
        '唔該 (m4 goi1) and 多謝 (do1 ze6) both mean thank you. Use 唔該 when someone does something for you, 多謝 for a gift.',
        '食咗飯未 (sik6 zo2 faan6 mei6) — "have you eaten?" — is a greeting, not a question about food. 食咗 (yes, I have) is the usual answer.',
        '對唔住 (deoi3 m4 zyu6) is sorry, and 唔使客氣 (m4 sai2 haak3 hei3) is you are welcome.',
        '慢行 (maan6 haang4) is goodbye said TO the person leaving — at the door or the lift. It is not an instruction to walk slowly.',
      ],
      postLabel: 'Why "have you eaten?" is a greeting',
    },
    fil: {
      slug: 'mga-bati-sa-cantonese',
      title: 'Mga Bati sa Cantonese: Kumusta, Salamat at Paalam',
      description:
        'Ang mga bati at magalang na salitang Cantonese na araw-araw mong gagamitin — magandang umaga, salamat, pasensya at paalam — may Jyutping at malinaw na kahulugan. Libre.',
      intro:
        'Sa Hong Kong, mas mahalaga ang unang salitang sasabihin mo kaysa sa perpektong gramatika. Isang masayang 早晨 ay nagbubukas ng ngiti; ang tamang 唔該 ay nagbubukas ng tulong. Pinagsasama ng pahinang ito ang maliliit na salitang nagbubukas ng bawat usapan — bati, pasasalamat, paghingi ng paumanhin at paalam — kasama ang Jyutping para bigkasin mo ito nang malakas.',
      tips: [
        'Ang 早晨 (zou2 san4) ay magandang umaga — ang pang-araw-araw na bati, mula umaga hanggang mga alas-diyes.',
        'Ang 唔該 (m4 goi1) at 多謝 (do1 ze6) ay parehong salamat. Gamitin ang 唔該 kapag may gumawa sa iyo ng pabor; ang 多謝 para sa regalo.',
        'Ang 食咗飯未 (sik6 zo2 faan6 mei6) — "kumain ka na ba?" — ay bati, hindi tanong tungkol sa pagkain. 食咗 (oo, kinain ko na) ang karaniwang sagot.',
        'Ang 對唔住 (deoi3 m4 zyu6) ay pasensya na, at ang 唔使客氣 (m4 sai2 haak3 hei3) ay walang anuman.',
        'Ang 慢行 (maan6 haang4) ay paalam na sinasabi SA umaalis — sa pintuan o sa elevator. Hindi ito utos na maglakad nang dahan-dahan.',
      ],
      postLabel: 'Bakit bati ang "kumain ka na ba?"',
    },
    zh: {
      slug: 'yue-yu-wen-hou-yong-yu',
      title: '粤语问候用语：你好、多谢、再见',
      description:
        '每天都会用到的粤语问候和礼貌用语——早晨、多谢、对不住、慢行——附粤拼和浅白解释，免费学习，无需注册。',
      intro:
        '在香港，第一句话比完美语法更重要。一句爽快的「早晨」换来一个笑容；用对「唔该」换来别人的帮忙。这一页收集打开每段对话的小词——问候、道谢、道歉和道别——并附上粤拼，让你能开口念出来。',
      tips: [
        '早晨 (zou2 san4) 就是「早上好」，从清早用到大约十一点，是最日常的问候。',
        '唔该 (m4 goi1) 和 多谢 (do1 ze6) 都是「谢谢」。别人帮你做事用「唔该」，收到礼物用「多谢」。',
        '食咗饭未 (sik6 zo2 faan6 mei6)「吃饭了吗」是问候，不是真的问你吃了什么。通常答「食咗」（吃了）就可以。',
        '对唔住 (deoi3 m4 zyu6) 是「对不起」，唔使客气 (m4 sai2 haak3 hei3) 是「不用谢」。',
        '慢行 (maan6 haang4) 是对「要离开的人」说的再见——在门口或电梯口说，不是叫人慢慢走。',
      ],
      postLabel: '为什么「食咗饭未」是问候',
    },
    id: {
      slug: 'sapaan-dalam-bahasa-kanton',
      title: 'Sapaan dalam Bahasa Kanton: Halo, Terima Kasih & Selamat Tinggal',
      description:
        'Sapaan dan kata sopan Kanton yang dipakai setiap hari — selamat pagi, terima kasih, maaf, dan selamat tinggal — dengan Jyutping dan arti yang jelas. Gratis.',
      intro:
        'Di Hong Kong, kata pertama yang Anda ucapkan lebih penting daripada tata bahasa yang sempurna. 早晨 yang ceria memunculkan senyum; 唔該 yang tepat mendatangkan bantuan. Halaman ini mengumpulkan kata-kata kecil yang membuka setiap percakapan — sapaan, terima kasih, permintaan maaf, dan pamit — lengkap dengan Jyutping agar Anda bisa mengucapkannya.',
      tips: [
        '早晨 (zou2 san4) = “selamat pagi” — sapaan sehari-hari, dipakai pagi sampai sekitar pukul sebelas.',
        '唔該 (m4 goi1) dan 多謝 (do1 ze6) sama-sama berarti terima kasih. Pakai 唔該 kalau seseorang melakukan sesuatu untuk Anda; 多謝 untuk hadiah.',
        '食咗飯未 (sik6 zo2 faan6 mei6) — “sudah makan?” — adalah sapaan, bukan pertanyaan soal makanan. Jawabannya biasanya 食咗 (sudah).',
        '對唔住 (deoi3 m4 zyu6) = maaf, dan 唔使客氣 (m4 sai2 haak3 hei3) = sama-sama.',
        '慢行 (maan6 haang4) = selamat tinggal yang diucapkan KEPADA orang yang pergi — di pintu atau di lift. Bukan perintah untuk berjalan pelan.',
      ],
      postLabel: 'Kenapa “sudah makan?” itu sapaan',
    },
  },

  'cantonese-numbers-and-counting': {
    icon: '🔢',
    catRegex: /count|money|number/i,
    postSlug: 'numbers-sound-lucky-unlucky',
    en: {
      slug: 'cantonese-numbers-and-counting',
      title: 'Cantonese Numbers & Counting: One to a Thousand',
      description:
        'Learn Cantonese numbers 1–10, the teens, tens, hundreds and thousands — with Jyutping and the lucky/unlucky numbers Hong Kong actually cares about. Free.',
      intro:
        'Numbers are the first Cantonese most helpers need: a floor number, a bus, a price, a phone number. The system is regular once you know ten words, and this page walks you from 一 to 千 with the sounds written out. Learn the first ten by heart and the rest is counting practice.',
      tips: [
        'One to ten: 一 jat1, 二 ji6, 三 saam1, 四 sei3, 五 ng5, 六 luk6, 七 cat1, 八 baat3, 九 gau2, 十 sap6.',
        '五 (ng5) starts with a hummed ng- sound — the hardest sound in Cantonese for most learners. Keep the back of your tongue up.',
        'Eleven to nineteen are 十一 to 十九. Twenty is 二十 (not 兩十); the tens stack — 三十, 四十, and colloquially 廿 for twenty.',
        'Hundred is 百 baak3 and thousand is 千 cin1: 二百 is two hundred, 三千 is three thousand.',
        'A Hong Kong dollar is 蚊 man1, so 十蚊 is ten dollars. Eight (八 baat3) sounds like "prosper", which is why it is lucky; four (四 sei3) sounds like "die", so it is often avoided.',
      ],
      postLabel: 'Lucky and unlucky numbers in Hong Kong',
    },
    fil: {
      slug: 'mga-bilang-sa-cantonese',
      title: 'Mga Bilang sa Cantonese: Isa hanggang Sanlibo',
      description:
        'Matutong magbilang sa Cantonese mula 1–10, hanggang sa dosena, daan at libo — may Jyutping at mga numerong maswerte o hindi sa Hong Kong. Libre.',
      intro:
        'Ang mga bilang ang unang Cantonese na kailangan ng karamihang katulong: number ng palapag, ng bus, presyo, o number ng telepono. Regular ang sistema kapag alam mo na ang sampung salita, at dito ipinapakita ang 一 hanggang 千 kasama ang tunog. Kaya mong kabisaduhin ang unang sampu, at ang natitira ay pagsasanay na lang.',
      tips: [
        'Isa hanggang sampu: 一 jat1, 二 ji6, 三 saam1, 四 sei3, 五 ng5, 六 luk6, 七 cat1, 八 baat3, 九 gau2, 十 sap6.',
        'Ang 五 (ng5) ay nagsisimula sa tunog na ng- — pinakamahirap na tunog sa Cantonese para sa maraming natututo. Itaas ang likod ng dila.',
        'Ang laba-y isa hanggang labas-siyam ay 十一 hanggang 十九. Ang dalawampu ay 二十 (hindi 兩十); nagsasalansan ang mga dekada — 三十, 四十, at 廿 bilang dalawampu sa usapan.',
        'Ang daan ay 百 baak3 at ang libo ay 千 cin1: 二百 ay dalawang daan, 三千 ay tatlong libo.',
        'Ang isang dolyar ng Hong Kong ay 蚊 man1, kaya 十蚊 ay sampung dolyar. Ang 八 (baat3) ay parang "kasaganaan" kaya maswerte; ang 四 (sei3) ay parang "mamatay" kaya madalas iwasan.',
      ],
      postLabel: 'Mga maswerte at hindi-maswerteng bilang sa Hong Kong',
    },
    zh: {
      slug: 'yue-yu-shu-zi-yu-ji-shu',
      title: '粤语数字与数数：一到一千',
      description:
        '学粤语数字 1–10、十几、几十、几百几千——附粤拼，以及香港人真正在意的吉利与忌讳数字。免费学习。',
      intro:
        '数字是多数家佣最先要用的粤语：楼层、巴士、价钱、电话号码。只要记住十个基本词，整套系统就很有规律。这一页从「一」写到「千」，把读音都标出来。先把前十个背熟，剩下的就是数数练习。',
      tips: [
        '一到十：一 jat1、二 ji6、三 saam1、四 sei3、五 ng5、六 luk6、七 cat1、八 baat3、九 gau2、十 sap6。',
        '五 (ng5) 以鼻音 ng- 开头，是多数学习者觉得最难的粤语声母。舌根要抬起来哼。',
        '十一到十九是「十一」到「十九」。二十是「二十」（不是「两十」）；十位会叠加——三十、四十，口语也说「廿」表示二十。',
        '百是 百 baak3，千是 千 cin1：「二百」是两百，「三千」是三千。',
        '香港一元叫「蚊」man1，所以「十蚊」是十元。「八」baat3 听起来像「发」，所以吉利；「四」sei3 像「死」，所以常被避开。',
      ],
      postLabel: '香港的吉利与忌讳数字',
    },
    id: {
      slug: 'angka-dalam-bahasa-kanton',
      title: 'Angka dalam Bahasa Kanton: Satu sampai Seribu',
      description:
        'Belajar angka Kanton 1–10, belasan, puluhan, ratusan dan ribuan — dengan Jyutping dan angka yang dianggap beruntung atau tidak di Hong Kong. Gratis.',
      intro:
        'Angka adalah bahasa Kanton pertama yang dibutuhkan sebagian asisten: nomor lantai, bus, harga, atau nomor telepon. Sistemnya teratur begitu Anda tahu sepuluh kata dasar, dan halaman ini memandu dari 一 sampai 千 dengan bunyi yang ditulis. Hafalkan sepuluh pertama, sisanya tinggal berlatih menghitung.',
      tips: [
        'Satu sampai sepuluh: 一 jat1, 二 ji6, 三 saam1, 四 sei3, 五 ng5, 六 luk6, 七 cat1, 八 baat3, 九 gau2, 十 sap6.',
        '五 (ng5) diawali bunyi ng- yang dihumkan — bunyi paling sulit dalam bahasa Kanton bagi kebanyakan pemula. Angkat pangkal lidah.',
        'Sebelas sampai sembilan belas adalah 十一 sampai 十九. Dua puluh adalah 二十 (bukan 兩十); puluhan bertumpuk — 三十, 四十, dan 廿 untuk dua puluh dalam percakapan.',
        'Ratusan adalah 百 baak3 dan ribuan 千 cin1: 二百 dua ratus, 三千 tiga ribu.',
        'Satu dolar Hong Kong adalah 蚊 man1, jadi 十蚊 sepuluh dolar. 八 (baat3) terdengar seperti "makmur" sehingga beruntung; 四 (sei3) terdengar seperti "mati" sehingga sering dihindari.',
      ],
      postLabel: 'Angka beruntung dan sial di Hong Kong',
    },
  },

  'cantonese-for-shopping': {
    icon: '🛒',
    catRegex: /shop|market|food|fruit|restaurant|money/i,
    postSlug: 'cantonese-survival-phrases-market',
    en: {
      slug: 'cantonese-for-shopping',
      title: 'Cantonese for Shopping in Hong Kong Markets',
      description:
        'Ask the price, ask for a discount, pay and get change in Cantonese — the words for the wet market, shops and restaurants, with Jyutping. Free.',
      intro:
        'A wet market is loud, fast and mostly Cantonese. These are the phrases that get you through it: how much, can it be cheaper, too expensive, and keep the change. Learn them once and every shop in Hong Kong becomes a little easier.',
      tips: [
        '幾多錢 (gei2 do1 cin2) is "how much?" — the single most useful shopping phrase. Point and ask.',
        '平啲得唔得 (peng4 di1 dak1 m4 dak1) is "can it be cheaper?" — normal at a wet market, not at a chain store.',
        '貴 (gwai3) is expensive and 平 (peng4) is cheap. 十蚊 (sap6 man1) is ten dollars.',
        '找錢 (zaau2 cin2) is the change handed back. 唔使找 means "keep the change".',
        '收據 (sau1 geoi3) is a receipt — useful when you need to return something or claim it on an employer’s account.',
      ],
      postLabel: 'Survival phrases for the market',
    },
    fil: {
      slug: 'pamimili-sa-cantonese',
      title: 'Pamimili sa Cantonese sa mga Palengke ng Hong Kong',
      description:
        'Itanong ang presyo, makipagtawad, magbayad at kumuha ng sukli sa Cantonese — ang mga salita sa palengke, tindahan at restaurant, may Jyutping. Libre.',
      intro:
        'Maingay, mabilis, at halos Cantonese lang ang palengke. Ito ang mga pariralang makakapagdala sa iyo roon: magkano, pwede bang mas mura, masyadong mahal, at ibayad na ang sukli. Matutunan mo ito nang isang beses at mas madali na ang bawat tindahan sa Hong Kong.',
      tips: [
        'Ang 幾多錢 (gei2 do1 cin2) ay "magkano?" — ang pinakakapaki-pakinabang na parirala sa pamimili. Ituro mo at itanong.',
        'Ang 平啲得唔得 (peng4 di1 dak1 m4 dak1) ay "puwede bang mas mura?" — normal sa palengke, hindi sa chain store.',
        'Ang 貴 (gwai3) ay mahal at ang 平 (peng4) ay mura. Ang 十蚊 (sap6 man1) ay sampung dolyar.',
        'Ang 找錢 (zaau2 cin2) ay ang sukli. Ang 唔使找 ay ibig sabihin "ibayad na ang sukli".',
        'Ang 收據 (sau1 geoi3) ay resibo — kapaki-pakinabang kapag kailangan mong ibalik ang isang bagay o i-claim ito sa amo.',
      ],
      postLabel: 'Mga survival phrase sa palengke',
    },
    zh: {
      slug: 'yue-yu-gou-wu-yong-yu',
      title: '香港买东西的粤语：街市与商店用语',
      description:
        '用粤语问价、讲价、付钱、找赎——街市、商店和茶餐厅常用词，附粤拼，免费学习。',
      intro:
        '街市又吵又快，说的几乎全是粤语。下面这些句子能帮你撑过去：多少钱、能便宜点吗、太贵了、不用找了。学会一次，香港每间店铺都会容易一点。',
      tips: [
        '幾多錢 (gei2 do1 cin2) 是「多少钱？」——买东西最有用的一句话。指一指东西再问。',
        '平啲得唔得 (peng4 di1 dak1 m4 dak1) 是「能便宜点吗？」——在街市很正常，在连锁店就不合适。',
        '貴 (gwai3) 是贵，平 (peng4) 是便宜。十蚊 (sap6 man1) 是十元。',
        '找錢 (zaau2 cin2) 是找回来的零钱。唔使找 就是「不用找了」。',
        '收據 (sau1 geoi3) 是收据——要退货或向雇主报账时用得上。',
      ],
      postLabel: '街市必备粤语句子',
    },
    id: {
      slug: 'belanja-dalam-bahasa-kanton',
      title: 'Belanja dalam Bahasa Kanton di Pasar Hong Kong',
      description:
        'Tanya harga, minta diskon, bayar, dan terima kembalian dalam bahasa Kanton — kata-kata untuk pasar basah, toko, dan restoran, dengan Jyutping. Gratis.',
      intro:
        'Pasar basah itu bising, cepat, dan hampir semuanya bahasa Kanton. Ini kalimat-kalimat yang menuntun Anda melewatinya: berapa harganya, bisa lebih murah, terlalu mahal, dan kembaliannya tidak usah. Pelajari sekali, dan setiap toko di Hong Kong jadi sedikit lebih mudah.',
      tips: [
        '幾多錢 (gei2 do1 cin2) = “berapa harganya?” — kalimat belanja yang paling berguna. Tunjuk barangnya lalu tanya.',
        '平啲得唔得 (peng4 di1 dak1 m4 dak1) = “bisa lebih murah?” — wajar di pasar basah, tidak di toko waralaba.',
        '貴 (gwai3) = mahal, 平 (peng4) = murah. 十蚊 (sap6 man1) = sepuluh dolar.',
        '找錢 (zaau2 cin2) = kembalian yang diberikan. 唔使找 berarti “kembaliannya tidak usah”.',
        '收據 (sau1 geoi3) = kwitansi — berguna kalau harus menukar barang atau mengajukan ke majikan.',
      ],
      postLabel: 'Kalimat bertahan hidup di pasar',
    },
  },
};

module.exports = { PILLARS };
