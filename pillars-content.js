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
};

module.exports = { PILLARS };
