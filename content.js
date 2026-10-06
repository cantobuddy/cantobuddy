/**
 * CantoBuddy — long-form guide content for search.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `seo.js` server-renders 400+ pages, but they are all *thin*: one word, one
 * gloss, one pronunciation. Thin pages do not rank for the queries this
 * audience actually types. When the target query
 *
 *     "Cantonese phrases for Filipino domestic helpers Hong Kong"
 *
 * was checked against live search, every result on page one was a GUIDE or a
 * blog post — not a word list. YumCha, TheFilipinoHub, Talkcademy, a YMCA
 * course page. CantoBuddy had 426 word pages and none of them answered the
 * question a beginner is actually asking.
 *
 * So the vocabulary pages and these guides do different jobs:
 *
 *   /words/thank-you      answers "how do you say thank you in Cantonese"
 *   /guide/...            answers "how do I actually learn this for my job"
 *
 * The guides are the top of the funnel; every one of them links down into the
 * word pages, which is also how a crawler discovers them.
 *
 * CONTENT RULES
 * -------------
 *  - Written per language, NOT translated. The Filipino reader searches
 *    "Cantonese para sa helper"; the mainland reader searches 粤语 日常用语 /
 *    香港 粤语 入门. Same subject, different query, different wording.
 *  - Every claim about Cantonese is checked. Jyutping is real Jyutping.
 *  - No filler. If a section would not help someone decide what to study, cut it.
 *  - Links point at real routes that seo.js serves. tools/seo-guide-test.js
 *    asserts every href resolves, so a typo fails a test rather than shipping a
 *    404 into the index.
 *
 * `body` is HTML (a small, fixed subset: <p>, <h2>, <ul>, <ol>, <li>, <a>,
 * <strong>, <em>). `faq` becomes BOTH a visible block and FAQPage structured
 * data, so the same text serves the reader and the crawler.
 */

const UPDATED = '2026-10-06';

const GUIDES = [
  /* ===================================================================== */
  {
    slug: 'learn-cantonese-for-domestic-helpers',
    // Not the 🇭🇰 flag: Windows does not render regional-indicator pairs, so it
    // falls back to the literal letters "HK". A book renders everywhere.
    icon: '📘',
    updated: UPDATED,
    title: {
      en: 'How to Learn Cantonese as a Domestic Helper in Hong Kong',
      fil: 'Paano Mag-aral ng Cantonese bilang Domestic Helper sa Hong Kong',
      zh: '香港家佣如何学粤语：从零开始的实用路线',
      id: 'Cara Belajar Bahasa Kanton sebagai Asisten Rumah Tangga di Hong Kong',
    },
    description: {
      en: 'A practical guide to learning Cantonese for domestic work in Hong Kong — what to learn first, how Jyutping helps, and a realistic daily routine.',
      fil: 'Praktikal na gabay sa pag-aaral ng Cantonese para sa trabahong domestic helper sa Hong Kong — ano ang unahin, paano nakakatulong ang Jyutping, at seryosong routine.',
      zh: '在香港做家佣，粤语要从哪里学起？先学什么、粤拼怎么用、每天十分钟怎么安排，一份务实的入门指南。',
      id: 'Panduan praktis belajar bahasa Kanton untuk bekerja sebagai asisten rumah tangga di Hong Kong — apa yang dipelajari lebih dulu, bagaimana Jyutping membantu, dan rutinitas harian yang masuk akal.',
    },
    body: {
      en: `
<p>Most domestic helpers in Hong Kong arrive speaking English and pick up Cantonese on the job — slowly, and often painfully. This guide is the shortcut: what actually matters, what you can safely ignore, and how to make progress in ten minutes a day.</p>

<h2>You do not need to be fluent</h2>
<p>This is the first thing to understand, because it changes what you study. Your employer's family usually speaks some English. The person who does <strong>not</strong> is often the one you spend the most time with: an elderly parent, or a small child. With everyone else you can negotiate in English. With them, Cantonese is the only option.</p>
<p>So the goal is not fluency. The goal is to <strong>understand what is said to you</strong>, and to say a small number of things clearly.</p>

<h2>Understanding beats speaking — at first</h2>
<p>Helpers who study by memorising phrases to say often stall, because the hard moment is not speaking — it is the moment someone says something to you quickly and you have no idea what it was. Listening comes first. Learn to <em>recognise</em> the words an elderly person or a child uses, then learn to answer.</p>
<p>Our vocabulary is organised around exactly that split. Each word is marked as something <em>you say</em> or something <em>you hear</em>.</p>

<h2>Start with these five groups</h2>
<ol>
  <li><a href="/learn/greetings">Greetings</a> — 你好, 多謝, 唔該. You will use these every single day, and 唔該 alone covers a surprising amount.</li>
  <li><a href="/learn/elder-care">Elder Care</a> — the reason many helpers are hired. This is the highest-value vocabulary in the whole app.</li>
  <li><a href="/learn/safety">Safety</a> — 救命 ("help!"), 叫白車 ("call an ambulance"). Learn these before you need them, not after.</li>
  <li><a href="/learn/kitchen">Kitchen</a> and <a href="/learn/meals-feeding">Meals</a> — food is most of the job.</li>
  <li><a href="/learn/cleaning">Cleaning</a> — the instructions you will hear most often.</li>
</ol>

<h2>Learn to read Jyutping, not to guess</h2>
<p>Cantonese has six tones. If you learn a word from hearing alone, you will usually get the tone slightly wrong, and a wrong tone can turn one word into a different one. <a href="/words/hello">Jyutping</a> is the romanisation system we use — it writes the sound <em>and</em> the tone as a number, so 唔該 is written <strong>m4 goi1</strong>. The number is the tone. Once you can read it, you can learn a new word correctly the first time instead of the tenth.</p>

<h2>A realistic routine</h2>
<p>Ten minutes a day beats two hours on Sunday. A routine that works:</p>
<ul>
  <li><strong>5 minutes</strong> — open one category and read the words out loud, following the Jyutping.</li>
  <li><strong>3 minutes</strong> — take a quiz on those words. Getting one wrong is useful; it tells you what to repeat.</li>
  <li><strong>2 minutes</strong> — pick the one word you will try to use today with the person you care for.</li>
</ul>
<p>Do that for a month and you will know roughly 60 words — enough to understand the everyday requests in a Hong Kong household.</p>

<h2>What to expect, honestly</h2>
<p>Cantonese is genuinely hard to speak well, and nobody expects a helper to master it in a year. What is very achievable is this: understanding what the elderly person in your care needs, and being able to reassure her. That is what this app is built for, and it is enough to change how your working day feels.</p>
`,
      fil: `
<p>Karamihan ng domestic helper sa Hong Kong dumarating na marunong ng Ingles, at natututo na lang ng Cantonese habang nagtatrabaho — mabagal, at kadalasan mahirap. Ang gabay na ito ang shortcut: ano ang mahalaga, ano ang puwede mong kalimutan, at paano umusad sa sampung minuto kada araw.</p>

<h2>Hindi mo kailangang maging fluent</h2>
<p>Ito ang unang dapat maintindihan, dahil binabago nito kung ano ang pag-aaralan mo. Karaniwang may alam na Ingles ang pamilya ng amo mo. Ang madalas na <strong>wala</strong> ay ang taong kasama mo buong araw: ang matandang magulang, o ang maliit na bata. Sa iba, kaya mong makipag-usap sa Ingles. Sa kanila, Cantonese lang ang paraan.</p>
<p>Kaya hindi fluency ang target. Ang target ay <strong>maintindihan ang sinasabi sa iyo</strong>, at makapagsabi ng kaunting bagay nang malinaw.</p>

<h2>Unahin ang pag-intindi, bago ang pagsasalita</h2>
<p>Ang mga nag-aaral sa paraang kabisado lang ang sasabihin ay hindi umuusad, dahil ang mahirap na sandali ay hindi ang pagsasalita — kundi ang sandaling may nagsalita sa iyo nang mabilis at wala kang naintindihan. Pakikinig muna. Matutong <em>kilalanin</em> ang mga salitang ginagamit ng matanda o ng bata, saka matutong sumagot.</p>

<h2>Simulan sa limang grupo</h2>
<ol>
  <li><a href="/fil/learn/greetings">Pagbati</a> — 你好, 多謝, 唔該. Araw-araw mo itong gagamitin.</li>
  <li><a href="/fil/learn/elder-care">Pag-aalaga sa matanda</a> — ito ang dahilan kung bakit marami ang kinukuha. Pinakamahalagang bokabularyo sa buong app.</li>
  <li><a href="/fil/learn/safety">Kaligtasan</a> — 救命 ("saklolo!"), 叫白車 ("tumawag ng ambulansya"). Pag-aralan bago mo kailanganin.</li>
  <li><a href="/fil/learn/kitchen">Kusina</a> at <a href="/fil/learn/meals-feeding">Pagkain</a> — pagkain ang malaking parte ng trabaho.</li>
  <li><a href="/fil/learn/cleaning">Paglilinis</a> — ang mga utos na pinakamadalas mong marinig.</li>
</ol>

<h2>Matutong bumasa ng Jyutping</h2>
<p>May anim na tono ang Cantonese. Kapag narinig mo lang ang salita, madalas mali ang tono, at ang maling tono ay nagiging ibang salita. Ang Jyutping ang romanisasyon na ginagamit namin — isinusulat nito ang tunog <em>at</em> ang tono bilang numero, kaya ang 唔該 ay <strong>m4 goi1</strong>. Ang numero ay ang tono.</p>

<h2>Makatotohanang routine</h2>
<p>Sampung minuto araw-araw ay mas mabuti kaysa dalawang oras tuwing Linggo.</p>
<ul>
  <li><strong>5 minuto</strong> — buksan ang isang kategorya at basahin nang malakas, sundan ang Jyutping.</li>
  <li><strong>3 minuto</strong> — mag-quiz. Ang mali ay kapaki-pakinabang; sinasabi nito kung ano ang uulitin.</li>
  <li><strong>2 minuto</strong> — pumili ng isang salitang susubukan mong gamitin ngayong araw.</li>
</ul>

<h2>Ang totoo</h2>
<p>Mahirap talagang magsalita ng Cantonese nang mahusay, at walang umaasang magiging eksperto ka sa isang taon. Ang kayang-kaya ay ito: maintindihan ang kailangan ng matandang inaalagaan mo, at maiparamdam sa kanya na ligtas siya. Para diyan ang app na ito.</p>
`,
      zh: `
<p>在香港做家佣，很多人来的时候会说英语，粤语是在工作里一点点磨出来的——慢，而且常常很吃力。这份指南是条捷径：哪些才是真正要紧的、哪些可以先放下、以及怎样每天用十分钟稳步往前走。</p>

<h2>你不需要说得很流利</h2>
<p>这一点先弄明白，因为它会决定你学什么。雇主一家人多半会一些英语。真正<strong>不会</strong>的，往往是你相处时间最长的那个人：家里的老人，或者小孩。跟其他人你可以用英语商量。跟他们，粤语是唯一的选择。</p>
<p>所以目标不是流利，而是<strong>听懂别人对你说的话</strong>，并且能把少数几句说清楚。</p>

<h2>先练听，再练说</h2>
<p>只靠背句子的人常常卡住，因为真正难的时刻不是开口，而是别人飞快地对你说了一句话，你完全没听懂。听要放在前面。先学会<em>认</em>出老人或孩子常说的那些词，再学着回应。</p>

<h2>从这五组开始</h2>
<ol>
  <li><a href="/zh/learn/greetings">问候</a>——你好、多謝、唔該。每天都会用到。</li>
  <li><a href="/zh/learn/elder-care">照顾老人</a>——很多人被雇来就是为了这件事。这是整个应用里最值得学的一组词。</li>
  <li><a href="/zh/learn/safety">安全</a>——救命、叫白車（叫救护车）。要在需要之前学会。</li>
  <li><a href="/zh/learn/kitchen">厨房</a>和<a href="/zh/learn/meals-feeding">吃饭喂食</a>——做饭占了工作的很大一部分。</li>
  <li><a href="/zh/learn/cleaning">清洁</a>——你听得最多的那些指令。</li>
</ol>

<h2>学会看粤拼，别靠猜</h2>
<p>粤语有六个声调。只靠耳朵记，声调多半会差一点，而声调一错，词就变成了另一个词。我们用的是粤拼（Jyutping）——它把读音<em>和</em>声调一起写出来，声调用数字表示，所以 唔該 写作 <strong>m4 goi1</strong>。数字就是声调。会看它，你第一次就能把新词记对。</p>

<h2>一份能坚持的日程</h2>
<p>每天十分钟，胜过周日一口气两小时。</p>
<ul>
  <li><strong>5 分钟</strong>——打开一个分类，跟着粤拼把词读出声。</li>
  <li><strong>3 分钟</strong>——做这组词的测验。答错有用，它告诉你该重来哪些。</li>
  <li><strong>2 分钟</strong>——挑一个词，今天试着对家里那位老人说一次。</li>
</ul>
<p>坚持一个月，大约能掌握 60 个词——足够听懂香港家庭里的日常吩咐。</p>

<h2>实话实说</h2>
<p>粤语要说得地道，确实很难，也没人指望家佣一年就学会。真正做得到的是：听懂你照顾的老人需要什么，并且让她安心。这个应用就是为这件事做的。</p>
`,
      id: `
<p>Sebagian besar asisten rumah tangga di Hong Kong datang sudah bisa bahasa Inggris, lalu belajar bahasa Kanton sambil bekerja — lambat, dan sering kali melelahkan. Panduan ini adalah jalan pintasnya: apa yang benar-benar penting, apa yang boleh Anda abaikan, dan bagaimana membuat kemajuan dalam sepuluh menit sehari.</p>

<h2>Anda tidak perlu fasih</h2>
<p>Ini hal pertama yang perlu dipahami, karena mengubah apa yang Anda pelajari. Keluarga majikan Anda biasanya bisa sedikit bahasa Inggris. Yang <strong>tidak</strong> bisa justru sering orang yang paling lama bersama Anda: orang tua lanjut usia, atau anak kecil. Dengan yang lain Anda bisa berunding dalam bahasa Inggris. Dengan mereka, bahasa Kanton satu-satunya pilihan.</p>
<p>Jadi targetnya bukan kefasihan. Targetnya adalah <strong>memahami apa yang dikatakan kepada Anda</strong>, dan mengucapkan sedikit hal dengan jelas.</p>

<h2>Pahami dulu, bicara kemudian</h2>
<p>Mereka yang belajar dengan menghafal kalimat untuk diucapkan sering mandek, karena momen tersulitnya bukan saat bicara — melainkan saat seseorang berbicara cepat kepada Anda dan Anda tidak mengerti apa pun. Mendengar harus lebih dulu. Belajar <em>mengenali</em> kata-kata yang dipakai orang lanjut usia atau anak kecil, baru belajar menjawab.</p>
<p>Kosakata kami disusun persis menurut pembagian itu. Setiap kata ditandai sebagai sesuatu yang <em>Anda ucapkan</em> atau sesuatu yang <em>Anda dengar</em>.</p>

<h2>Mulai dari lima kelompok ini</h2>
<ol>
  <li><a href="/id/learn/greetings">Sapaan</a> — 你好, 多謝, 唔該. Anda akan memakainya setiap hari, dan 唔該 saja sudah mencakup banyak hal.</li>
  <li><a href="/id/learn/elder-care">Merawat Lansia</a> — alasan banyak asisten rumah tangga dipekerjakan. Ini kosakata paling bernilai di seluruh aplikasi.</li>
  <li><a href="/id/learn/safety">Keselamatan</a> — 救命 ("tolong!"), 叫白車 ("panggil ambulans"). Pelajari sebelum dibutuhkan, bukan sesudahnya.</li>
  <li><a href="/id/learn/kitchen">Dapur</a> dan <a href="/id/learn/meals-feeding">Makan</a> — makanan adalah sebagian besar pekerjaannya.</li>
  <li><a href="/id/learn/cleaning">Membersihkan</a> — perintah yang paling sering Anda dengar.</li>
</ol>

<h2>Belajar membaca Jyutping, jangan menebak</h2>
<p>Bahasa Kanton punya enam nada. Kalau Anda belajar sebuah kata hanya dari mendengar, nadanya biasanya sedikit keliru, dan nada yang salah bisa mengubah satu kata menjadi kata lain. <a href="/words/hello">Jyutping</a> adalah sistem romanisasi yang kami pakai — ia menuliskan bunyi <em>dan</em> nadanya sebagai angka, jadi 唔該 ditulis <strong>m4 goi1</strong>. Angka itu adalah nadanya. Begitu bisa membacanya, Anda bisa mempelajari kata baru dengan benar pada percobaan pertama, bukan yang kesepuluh.</p>

<h2>Rutinitas yang masuk akal</h2>
<p>Sepuluh menit sehari lebih baik daripada dua jam sekali seminggu. Rutinitas yang berhasil:</p>
<ul>
  <li><strong>5 menit</strong> — buka satu kategori dan baca kata-katanya dengan suara keras, mengikuti Jyutping.</li>
  <li><strong>3 menit</strong> — kerjakan kuis untuk kata-kata itu. Salah satu itu berguna; itu memberi tahu apa yang perlu diulang.</li>
  <li><strong>2 menit</strong> — pilih satu kata yang akan Anda coba pakai hari ini dengan orang yang Anda rawat.</li>
</ul>
<p>Lakukan itu selama sebulan dan Anda akan tahu sekitar 60 kata — cukup untuk memahami permintaan sehari-hari di rumah tangga Hong Kong.</p>

<h2>Kenyataannya</h2>
<p>Bahasa Kanton memang sulit diucapkan dengan baik, dan tidak ada yang mengharapkan asisten rumah tangga menguasainya dalam setahun. Yang sangat mungkin dicapai adalah ini: memahami apa yang dibutuhkan orang lanjut usia yang Anda rawat, dan membuatnya merasa tenang. Untuk itulah aplikasi ini dibuat, dan itu sudah cukup mengubah suasana hari kerja Anda.</p>
`,
    },
    faq: [
      {
        q: {
          en: 'How long does it take to learn enough Cantonese to work in Hong Kong?',
          fil: 'Gaano katagal bago matuto ng sapat na Cantonese para magtrabaho sa Hong Kong?',
          zh: '在香港工作，粤语要学多久才够用？',
          id: 'Berapa lama untuk belajar bahasa Kanton secukupnya agar bisa bekerja di Hong Kong?',
        },
        a: {
          en: 'For everyday comprehension, most helpers need three to six months of consistent short practice. Ten minutes a day is enough to learn about 60 words a month, which covers the routine requests in a Hong Kong household. Speaking fluently takes years, but understanding the person you care for does not.',
          fil: 'Para sa pang-araw-araw na pag-intindi, kailangan ng tatlo hanggang anim na buwan ng tuloy-tuloy na maikling pag-aaral. Ang sampung minuto kada araw ay sapat para sa mga 60 salita kada buwan — sakop na nito ang karaniwang utos sa isang bahay sa Hong Kong.',
          zh: '就日常听懂来说，多数人需要三到六个月的持续短练。每天十分钟，一个月大约能掌握 60 个词，香港家庭里的日常吩咐基本就听得懂了。说流利要好几年，但听懂你照顾的人，用不了那么久。',
          id: 'Untuk pemahaman sehari-hari, sebagian besar asisten rumah tangga butuh tiga sampai enam bulan latihan singkat yang konsisten. Sepuluh menit sehari cukup untuk mempelajari sekitar 60 kata per bulan, dan itu sudah mencakup permintaan rutin di rumah tangga Hong Kong. Berbicara fasih butuh bertahun-tahun, tetapi memahami orang yang Anda rawat tidak selama itu.',
        },
      },
      {
        q: {
          en: 'Do I need to learn to read Chinese characters?',
          fil: 'Kailangan ko bang matutong bumasa ng Chinese characters?',
          zh: '一定要学会认汉字吗？',
          id: 'Apakah saya harus belajar membaca aksara Tionghoa?',
        },
        a: {
          en: 'No. You can learn to speak and understand entirely through Jyutping romanisation. Reading characters helps — labels, menus, signs — but it is not required to do the job, and it is a much bigger task than learning to speak.',
          fil: 'Hindi. Puwede kang matutong magsalita at umintindi gamit lang ang Jyutping. Nakakatulong ang pagbasa ng karakter — sa mga label at menu — pero hindi ito kailangan para sa trabaho.',
          zh: '不必。你完全可以只靠粤拼来学说话和听懂。认字有好处——看标签、菜单、路牌——但不是做这份工作的前提，而且比学说话要难得多。',
          id: 'Tidak. Anda bisa belajar berbicara dan memahami sepenuhnya lewat romanisasi Jyutping. Membaca aksara membantu — label, menu, papan tanda — tetapi tidak wajib untuk pekerjaan ini, dan jauh lebih berat daripada belajar berbicara.',
        },
      },
      {
        q: {
          en: 'Should I learn Mandarin instead of Cantonese?',
          fil: 'Mas mabuti bang Mandarin ang pag-aralan kaysa Cantonese?',
          zh: '我该学普通话还是粤语？',
          id: 'Sebaiknya saya belajar Mandarin saja, bukan bahasa Kanton?',
        },
        a: {
          en: 'If you live and work in Hong Kong, learn Cantonese. Mandarin is not widely spoken in Hong Kong households, and it will not help you understand an elderly Cantonese speaker. If you already speak Mandarin, you have a head start — see our guide on the differences.',
          fil: 'Kung sa Hong Kong ka nakatira at nagtatrabaho, Cantonese ang pag-aralan. Hindi laganap ang Mandarin sa mga bahay sa Hong Kong. Kung marunong ka na ng Mandarin, may kalamangan ka na.',
          zh: '如果你在香港生活和工作，就学粤语。香港家庭里普通话并不通用，它帮不了你听懂说粤语的老人。如果你本来就会普通话，那是你的优势——可以看我们那篇讲两者区别的文章。',
          id: 'Kalau Anda tinggal dan bekerja di Hong Kong, pelajarilah bahasa Kanton. Mandarin tidak umum dipakai di rumah tangga Hong Kong, dan tidak akan membantu Anda memahami orang lanjut usia yang berbicara Kanton. Kalau Anda sudah bisa Mandarin, Anda punya keunggulan — lihat panduan kami tentang perbedaannya.',
        },
      },
    ],
    related: [
      { href: '/learn/elder-care', label: { en: 'Elder Care vocabulary', fil: 'Bokabularyo sa pag-aalaga', zh: '照顾老人词汇', id: 'Kosakata merawat lansia' } },
      { href: '/guide/cantonese-for-elderly-care', label: { en: 'Caring for an elderly person', fil: 'Pag-aalaga sa matanda', zh: '照顾老人的粤语', id: 'Merawat orang lanjut usia' } },
      { href: '/guide/learn-cantonese', label: { en: 'Learn Cantonese: the complete beginner\u2019s guide', fil: 'Mag-aral ng Cantonese: kumpletong gabay', zh: '粤语入门：完整指南', id: 'Belajar bahasa Kanton: panduan lengkap' } },
    ],
  },

  /* ===================================================================== */
  {
    slug: 'cantonese-for-elderly-care',
    icon: '🧓',
    updated: UPDATED,
    title: {
      en: 'Cantonese Phrases for Caring for an Elderly Person',
      fil: 'Mga Cantonese na Parirala sa Pag-aalaga ng Matanda',
      zh: '照顾老人的粤语：老人会对你说什么，你该怎么说',
      id: 'Frasa Bahasa Kanton untuk Merawat Orang Lanjut Usia',
    },
    description: {
      en: 'The Cantonese an elderly person will say to you, and the phrases you need to answer — for helpers caring for an elderly parent in Hong Kong.',
      fil: 'Ang Cantonese na sasabihin sa iyo ng matanda, at ang mga pariralang kailangan mong isagot — para sa mga helper na nag-aalaga ng matanda sa Hong Kong.',
      zh: '在香港照顾老人，老人常对你说的粤语，以及你必须会回应的那些话。按听和说分开整理。',
      id: 'Bahasa Kanton yang akan diucapkan orang lanjut usia kepada Anda, dan frasa yang perlu Anda ucapkan untuk menjawabnya — untuk asisten rumah tangga yang merawat orang tua lanjut usia di Hong Kong.',
    },
    body: {
      en: `
<p>Caring for an elderly person is the part of the job where Cantonese matters most, because it is the part where English often is not available at all. This guide separates the two directions — what she says to you, and what you need to say back.</p>

<h2>Why this is the hardest part</h2>
<p>An elderly person may speak quickly, use a strong accent, and repeat the same word rather than explain it. She may also be hard of hearing, or confused. You cannot negotiate your way through this in English, and there is no colleague to translate. That is exactly why this vocabulary is worth learning first.</p>

<h2>What she will say to you</h2>
<p>These are the requests and complaints you will hear most. Learn to <em>recognise</em> them before you learn to answer:</p>
<ul>
  <li><strong>幫我攞杯水</strong> — "Get me a glass of water." One of the most common requests there is.</li>
  <li><strong>太熱呀 / 好凍</strong> — "It's too hot" / "It's very cold." She may not be able to adjust the air conditioning herself.</li>
  <li><strong>我唔舒服</strong> — "I don't feel well." Treat this as important every time.</li>
  <li><strong>冇胃口</strong> — "I have no appetite." A change in eating is a signal, not a preference.</li>
  <li><strong>帶遮</strong> — "Bring an umbrella." An instruction before you go out.</li>
</ul>
<p>See the full <a href="/learn/elder-care">Elder Care</a> and <a href="/learn/health-symptoms">Health &amp; Symptoms</a> categories.</p>

<h2>What you need to say back</h2>
<p>You do not need long sentences. Short, calm phrases do the work:</p>
<ul>
  <li><strong>唔怕</strong> — "Don't be afraid."</li>
  <li><strong>我喺度</strong> — "I'm here." Often the single most useful thing you can say.</li>
  <li><strong>唔緊要</strong> — "It's alright / never mind."</li>
  <li><strong>食多啲</strong> — "Eat a bit more."</li>
  <li><strong>慢慢嚟</strong> — "Take your time."</li>
</ul>
<p>See <a href="/learn/comfort-reassurance">Comfort &amp; Reassurance</a> and <a href="/learn/meals-feeding">Meals &amp; Feeding</a>.</p>

<h2>Medicine and appointments</h2>
<p>Medicine is where a misunderstanding has real consequences. Learn the words for the medicine itself, the time it is taken, and the clinic visit — and if you are not certain what you heard, repeat it back rather than guess. See <a href="/learn/medicine-appointments">Medicine &amp; Appointments</a>.</p>

<h2>Emergencies: learn these before you need them</h2>
<p>Four phrases, worth memorising today:</p>
<ul>
  <li><strong>救命</strong> — "Help!" Shout it.</li>
  <li><strong>叫白車</strong> — "Call an ambulance." 白車 ("white car") is the everyday Hong Kong word for an ambulance.</li>
  <li><strong>婆婆跌親</strong> — "Grandma fell." 婆婆 is a respectful word for an elderly woman.</li>
  <li><strong>佢呼吸唔到</strong> — "She can't breathe."</li>
</ul>
<p>Full set in <a href="/learn/safety">Safety</a>.</p>

<h2>One habit that matters more than vocabulary</h2>
<p>Say the person's name, or 婆婆 / 公公, before you speak. It gets her attention, and it tells her you are speaking to her rather than about her. In a house where someone is hard of hearing or easily confused, that single habit prevents more misunderstandings than any word on this page.</p>
`,
      fil: `
<p>Ang pag-aalaga sa matanda ang bahagi ng trabaho kung saan pinakamahalaga ang Cantonese, dahil ito ang bahaging madalas walang Ingles. Hinihiwalay ng gabay na ito ang dalawang direksyon — ang sinasabi niya sa iyo, at ang kailangan mong isagot.</p>

<h2>Bakit ito ang pinakamahirap</h2>
<p>Ang matanda ay maaaring mabilis magsalita, may malakas na tono, at inuulit lang ang parehong salita sa halip na ipaliwanag. Maaaring mahina ang pandinig, o nalilito. Hindi mo ito maaayos sa Ingles, at walang kasamang magsasalin. Kaya nga ito ang dapat unahin.</p>

<h2>Ang mga sasabihin niya sa iyo</h2>
<ul>
  <li><strong>幫我攞杯水</strong> — "Dalhan mo ako ng tubig." Isa sa pinakamadalas na hiling.</li>
  <li><strong>太熱呀 / 好凍</strong> — "Sobrang init" / "Sobrang lamig."</li>
  <li><strong>我唔舒服</strong> — "Masama ang pakiramdam ko." Seryosohin ito tuwing maririnig.</li>
  <li><strong>冇胃口</strong> — "Wala akong gana." Senyales ito, hindi lang gusto.</li>
  <li><strong>帶遮</strong> — "Magdala ng payong."</li>
</ul>
<p>Tingnan ang <a href="/fil/learn/elder-care">Pag-aalaga sa matanda</a> at <a href="/fil/learn/health-symptoms">Mga Sintomas</a>.</p>

<h2>Ang kailangan mong isagot</h2>
<ul>
  <li><strong>唔怕</strong> — "Huwag kang matakot."</li>
  <li><strong>我喺度</strong> — "Nandito ako." Kadalasan ito ang pinakamahalagang masasabi mo.</li>
  <li><strong>唔緊要</strong> — "Ayos lang."</li>
  <li><strong>食多啲</strong> — "Kumain ka pa ng kaunti."</li>
  <li><strong>慢慢嚟</strong> — "Dahan-dahan lang."</li>
</ul>
<p>Tingnan ang <a href="/fil/learn/comfort-reassurance">Pagpapalakas ng Loob</a> at <a href="/fil/learn/meals-feeding">Pagkain</a>.</p>

<h2>Gamot at check-up</h2>
<p>Sa gamot, ang maling pagkakaintindi ay may tunay na kapalit. Pag-aralan ang salita para sa gamot, sa oras, at sa pagpunta sa klinika — at kung hindi ka sigurado sa narinig, ulitin ito sa halip na manghula. Tingnan ang <a href="/fil/learn/medicine-appointments">Gamot at Check-up</a>.</p>

<h2>Emerhensiya</h2>
<ul>
  <li><strong>救命</strong> — "Saklolo!" Isigaw ito.</li>
  <li><strong>叫白車</strong> — "Tumawag ng ambulansya."</li>
  <li><strong>婆婆跌親</strong> — "Natumba si Lola."</li>
  <li><strong>佢呼吸唔到</strong> — "Hindi siya makahinga."</li>
</ul>
<p>Tingnan ang <a href="/fil/learn/safety">Kaligtasan</a>.</p>

<h2>Isang ugali na mas mahalaga kaysa bokabularyo</h2>
<p>Sabihin ang pangalan niya, o 婆婆 / 公公, bago ka magsalita. Nakukuha nito ang atensyon niya, at ipinapakita na kausap mo siya. Sa bahay na may mahinang pandinig o nalilitong matanda, ang ugaling ito ang pumipigil sa mas maraming hindi pagkakaunawaan kaysa anumang salita.</p>
`,
      zh: `
<p>照顾老人是这份工作里粤语最要紧的部分，因为也是英语常常完全用不上的部分。这篇文章把两个方向分开讲——她会对你说什么，以及你必须会怎么回应。</p>

<h2>为什么这一段最难</h2>
<p>老人可能说得很快、口音很重，而且宁愿把同一个词重复几遍，也不会换一种说法解释。她还可能听不清，或者一时糊涂。这一段没法用英语商量，也没有同事帮你翻译。所以这组词最该先学。</p>

<h2>她会对你说的</h2>
<p>下面这些是你会听得最多的要求和抱怨。先学<em>听懂</em>，再学怎么答：</p>
<ul>
  <li><strong>幫我攞杯水</strong>——"帮我拿杯水。"最常听到的要求之一。</li>
  <li><strong>太熱呀 / 好凍</strong>——"太热了"／"很冷。"她可能自己调不了空调。</li>
  <li><strong>我唔舒服</strong>——"我不舒服。"每一次都要当回事。</li>
  <li><strong>冇胃口</strong>——"没胃口。"吃饭的变化是信号，不只是口味。</li>
  <li><strong>帶遮</strong>——"带伞。"出门前的一句交代。</li>
</ul>
<p>完整的见<a href="/zh/learn/elder-care">照顾老人</a>和<a href="/zh/learn/health-symptoms">症状</a>两类。</p>

<h2>你需要回的</h2>
<p>不用长句子。短、稳的几句话就够了：</p>
<ul>
  <li><strong>唔怕</strong>——"别怕。"</li>
  <li><strong>我喺度</strong>——"我在。"这往往是你最有用的一句话。</li>
  <li><strong>唔緊要</strong>——"没关系。"</li>
  <li><strong>食多啲</strong>——"多吃一点。"</li>
  <li><strong>慢慢嚟</strong>——"慢慢来。"</li>
</ul>
<p>见<a href="/zh/learn/comfort-reassurance">安慰与鼓励</a>和<a href="/zh/learn/meals-feeding">吃饭喂食</a>。</p>

<h2>吃药和复诊</h2>
<p>吃药这件事，听错是有真实后果的。把药名、吃药的时间、去诊所的这几组词学会——如果没听准，就重复一遍确认，不要猜。见<a href="/zh/learn/medicine-appointments">吃药复诊</a>。</p>

<h2>紧急情况：要在需要之前学会</h2>
<ul>
  <li><strong>救命</strong>——"救命！"要喊出来。</li>
  <li><strong>叫白車</strong>——"叫救护车。"白車（"白车"）是香港对救护车的日常叫法。</li>
  <li><strong>婆婆跌親</strong>——"婆婆摔倒了。"婆婆是对老年女性长辈的尊称。</li>
  <li><strong>佢呼吸唔到</strong>——"她不能呼吸。"</li>
</ul>
<p>完整的一组见<a href="/zh/learn/safety">安全</a>。</p>

<h2>比词汇更重要的一个习惯</h2>
<p>开口之前先叫她的名字，或者叫 婆婆 / 公公。这能让她注意到你在跟她说话，而不是在说她。在有人听不清或者容易糊涂的家里，这一个习惯能避免的误会，比这一页上的任何词都多。</p>
`,
      id: `
<p>Merawat orang lanjut usia adalah bagian pekerjaan di mana bahasa Kanton paling penting, karena di sinilah bahasa Inggris sering sama sekali tidak bisa dipakai. Panduan ini memisahkan dua arah — apa yang dia katakan kepada Anda, dan apa yang perlu Anda katakan kembali.</p>

<h2>Mengapa ini bagian tersulit</h2>
<p>Orang lanjut usia bisa berbicara cepat, dengan logat yang kuat, dan mengulang kata yang sama alih-alih menjelaskannya. Pendengarannya mungkin juga kurang, atau dia sedang bingung. Anda tidak bisa berunding dalam bahasa Inggris untuk hal ini, dan tidak ada rekan kerja yang menerjemahkan. Itulah sebabnya kosakata ini paling layak dipelajari lebih dulu.</p>

<h2>Yang akan dia katakan kepada Anda</h2>
<p>Ini permintaan dan keluhan yang paling sering Anda dengar. Belajar <em>mengenali</em> dulu sebelum belajar menjawab:</p>
<ul>
  <li><strong>幫我攞杯水</strong> — "Ambilkan saya segelas air." Salah satu permintaan paling umum.</li>
  <li><strong>太熱呀 / 好凍</strong> — "Terlalu panas" / "Sangat dingin." Dia mungkin tidak bisa mengatur AC sendiri.</li>
  <li><strong>我唔舒服</strong> — "Saya tidak enak badan." Anggap ini penting setiap kali.</li>
  <li><strong>冇胃口</strong> — "Saya tidak ada selera makan." Perubahan pola makan itu tanda, bukan sekadar selera.</li>
  <li><strong>帶遮</strong> — "Bawa payung." Perintah sebelum Anda keluar rumah.</li>
</ul>
<p>Lihat kategori lengkap <a href="/id/learn/elder-care">Merawat Lansia</a> dan <a href="/id/learn/health-symptoms">Kesehatan &amp; Gejala</a>.</p>

<h2>Yang perlu Anda katakan kembali</h2>
<p>Anda tidak perlu kalimat panjang. Frasa pendek dan tenang sudah cukup:</p>
<ul>
  <li><strong>唔怕</strong> — "Jangan takut."</li>
  <li><strong>我喺度</strong> — "Saya ada di sini." Sering kali ini hal paling berguna yang bisa Anda ucapkan.</li>
  <li><strong>唔緊要</strong> — "Tidak apa-apa."</li>
  <li><strong>食多啲</strong> — "Makan sedikit lagi."</li>
  <li><strong>慢慢嚟</strong> — "Pelan-pelan saja."</li>
</ul>
<p>Lihat <a href="/id/learn/comfort-reassurance">Menghibur &amp; Menenangkan</a> dan <a href="/id/learn/meals-feeding">Makan &amp; Menyuapi</a>.</p>

<h2>Obat dan jadwal kontrol</h2>
<p>Obat adalah hal di mana salah paham punya akibat nyata. Pelajari kata untuk obatnya sendiri, waktu meminumnya, dan kunjungan ke klinik — dan kalau Anda tidak yakin dengan apa yang didengar, ulangi dulu untuk memastikan, jangan menebak. Lihat <a href="/id/learn/medicine-appointments">Obat &amp; Jadwal Kontrol</a>.</p>

<h2>Keadaan darurat: pelajari sebelum dibutuhkan</h2>
<p>Empat frasa, layak dihafal hari ini:</p>
<ul>
  <li><strong>救命</strong> — "Tolong!" Teriakkan.</li>
  <li><strong>叫白車</strong> — "Panggil ambulans." 白車 ("mobil putih") adalah sebutan sehari-hari di Hong Kong untuk ambulans.</li>
  <li><strong>婆婆跌親</strong> — "Nenek jatuh." 婆婆 adalah sebutan hormat untuk perempuan lanjut usia.</li>
  <li><strong>佢呼吸唔到</strong> — "Dia tidak bisa bernapas."</li>
</ul>
<p>Set lengkapnya di <a href="/id/learn/safety">Keselamatan</a>.</p>

<h2>Satu kebiasaan yang lebih penting daripada kosakata</h2>
<p>Sebut namanya, atau 婆婆 / 公公, sebelum Anda berbicara. Itu menarik perhatiannya, dan menunjukkan bahwa Anda berbicara kepadanya, bukan tentang dia. Di rumah yang penghuninya kurang pendengaran atau mudah bingung, satu kebiasaan ini mencegah lebih banyak salah paham daripada kata mana pun di halaman ini.</p>
`,
    },
    faq: [
      {
        q: {
          en: 'What is the most important Cantonese phrase for a carer?',
          fil: 'Ano ang pinakamahalagang Cantonese phrase para sa nag-aalaga?',
          zh: '照顾老人最该先学哪一句？',
          id: 'Frasa bahasa Kanton apa yang paling penting bagi seorang perawat?',
        },
        a: {
          en: '我喺度 — "I\'m here". It is short, calm, and answers the fear an elderly person feels most often: that she has been left alone. In an emergency, learn 救命 ("help!") and 叫白車 ("call an ambulance") first.',
          fil: '我喺度 — "Nandito ako". Maikli, kalmado, at sinasagot nito ang pinakamadalas na takot ng matanda: na naiwan siyang mag-isa.',
          zh: '我喺度——"我在。"短、稳，正好回应老人最常见的那份不安：怕自己一个人。如果只学一句应急的，先学 救命 和 叫白車。',
          id: '我喺度 — "Saya ada di sini". Singkat, tenang, dan menjawab ketakutan yang paling sering dirasakan orang lanjut usia: rasa ditinggal sendirian. Untuk keadaan darurat, pelajari 救命 ("tolong!") dan 叫白車 ("panggil ambulans") lebih dulu.',
        },
      },
      {
        q: {
          en: 'What does 婆婆 (po4 po2) mean?',
          fil: 'Ano ang ibig sabihin ng 婆婆 (po4 po2)?',
          zh: '婆婆 是什么意思？',
          id: 'Apa arti 婆婆 (po4 po2)?',
        },
        a: {
          en: '婆婆 is a respectful way to address an elderly woman — close to "grandma", but polite rather than familiar. Helpers commonly use it for the elderly person they care for. For an elderly man, 公公 (gung1 gung1) is the matching word.',
          fil: 'Ang 婆婆 ay magalang na tawag sa matandang babae — parang "Lola", pero magalang. Para sa matandang lalaki, 公公 (gung1 gung1).',
          zh: '婆婆是对老年女性的尊称，接近"奶奶/姥姥"，但更客气。很多家佣就用它称呼自己照顾的老人。老年男性对应的称呼是 公公（gung1 gung1）。',
          id: '婆婆 adalah sebutan hormat untuk perempuan lanjut usia — mirip "nenek", tetapi sopan, bukan akrab. Asisten rumah tangga biasa memakainya untuk orang lanjut usia yang mereka rawat. Untuk laki-laki lanjut usia, padanannya 公公 (gung1 gung1).',
        },
      },
    ],
    related: [
      { href: '/guide/learn-cantonese-for-domestic-helpers', label: { en: 'How to learn Cantonese', fil: 'Paano mag-aral ng Cantonese', zh: '家佣如何学粤语', id: 'Cara belajar bahasa Kanton' } },
      { href: '/learn/safety', label: { en: 'Safety vocabulary', fil: 'Bokabularyo sa kaligtasan', zh: '安全词汇', id: 'Kosakata keselamatan' } },
      { href: '/guide/learn-cantonese', label: { en: 'Learn Cantonese: the complete beginner\u2019s guide', fil: 'Mag-aral ng Cantonese: kumpletong gabay', zh: '粤语入门：完整指南', id: 'Belajar bahasa Kanton: panduan lengkap' } },
    ],
  },

  /* ===================================================================== */
  {
    slug: 'cantonese-vs-mandarin',
    icon: '🔀',
    updated: UPDATED,
    title: {
      en: 'Cantonese vs Mandarin: What Is the Difference?',
      fil: 'Cantonese vs Mandarin: Ano ang Pagkakaiba?',
      zh: '粤语和普通话的区别：一篇讲清楚',
      id: 'Bahasa Kanton vs Mandarin: Apa Bedanya?',
    },
    description: {
      en: 'Cantonese and Mandarin share a writing system but are not mutually intelligible. Here is what is actually different — and which one a helper in Hong Kong needs.',
      fil: 'Pareho ang sistema ng pagsulat ng Cantonese at Mandarin, pero hindi sila nagkakaintindihan. Ito ang tunay na pagkakaiba — at alin ang kailangan ng helper sa Hong Kong.',
      zh: '粤语和普通话共用一套书写系统，但彼此听不懂。真正的差别在哪里，在香港做家佣又该学哪一种。',
      id: 'Bahasa Kanton dan Mandarin memakai sistem tulisan yang sama, tetapi tidak saling dimengerti. Inilah bedanya yang sebenarnya — dan mana yang dibutuhkan asisten rumah tangga di Hong Kong.',
    },
    body: {
      en: `
<p>This question comes up constantly, and the answer surprises people: Cantonese and Mandarin are usually written the same way, but a Cantonese speaker and a Mandarin speaker cannot understand each other's speech at all. They are not dialects of one language in any practical sense.</p>

<h2>Same writing, different speech</h2>
<p>Both use Chinese characters, and a formal sentence written in one is largely readable to the other. That is why people assume the languages are close. But the written form is a shared standard; the spoken forms are genuinely different languages, as different as Spanish and Italian — arguably more so.</p>

<h2>They are not mutually intelligible</h2>
<p>A person who speaks only Mandarin cannot follow a conversation in Cantonese. This is the fact that matters most for a helper in Hong Kong: if you learn Mandarin, you still will not understand the elderly Cantonese speaker in your household. See <a href="/learn/elder-care">Elder Care</a>.</p>

<h2>Tones</h2>
<p>Both are tonal, but Cantonese has more tones. Jyutping marks six distinct tones; Mandarin has four. More tones means more ways for a word to be misheard, which is exactly why learning from the romanisation rather than by ear matters so much.</p>

<h2>Everyday words are different</h2>
<p>Many of the words you use most are simply not the same:</p>
<ul>
  <li>"Thank you" (for a gift) — Cantonese <strong>多謝</strong> (do1 ze6), Mandarin 谢谢 (xièxie).</li>
  <li>"Please / excuse me" — Cantonese <strong>唔該</strong> (m4 goi1), Mandarin 请 (qǐng). There is no single Mandarin word that does the whole job 唔該 does in Cantonese.</li>
  <li>"Eat" — Cantonese <strong>食</strong> (sik6), Mandarin 吃 (chī).</li>
  <li>"He / she" — Cantonese <strong>佢</strong> (keoi5), Mandarin 他 / 她 (tā).</li>
</ul>
<p>Even where the meaning matches, the word often does not, which is why a Mandarin speaker cannot simply "translate in her head" and be understood in Hong Kong.</p>

<h2>Writing: Traditional in Hong Kong</h2>
<p>Hong Kong uses Traditional characters (廣東話, 廁所); the mainland uses Simplified (广东话, 厕所). If you read Simplified, you will recognise much of the Traditional text around you, but not all of it.</p>

<h2>So which should you learn?</h2>
<p>If you live and work in Hong Kong: <strong>Cantonese</strong>. It is the language of the household, the street and the elderly person you care for. Mandarin is useful for travel and business on the mainland, but it will not help you at home.</p>
<p>If you already speak Mandarin, you are not starting from zero. You know how tones work, you recognise many characters, and a fair number of words overlap. Our <a href="/zh/learn">Chinese-language version of the app</a> is written specifically for you — it gives each Cantonese word with the Mandarin meaning beside it, so you can map what you already know onto what you are hearing.</p>
`,
      fil: `
<p>Laging itinatanong ito, at nakakagulat ang sagot: ang Cantonese at Mandarin ay kadalasang pareho ang pagsulat, pero ang nagsasalita ng Cantonese at nagsasalita ng Mandarin ay hindi nagkakaintindihan sa pagsasalita. Hindi sila dayalekto ng isang wika sa praktikal na paraan.</p>

<h2>Parehong sulat, magkaibang salita</h2>
<p>Parehong gumagamit ng Chinese characters. Kaya inaakala ng marami na magkalapit ang mga ito. Pero ang nakasulat ay isang shared standard; ang pasalita ay tunay na magkaibang wika — kasing layo ng Spanish at Italian, o higit pa.</p>

<h2>Hindi sila nagkakaintindihan</h2>
<p>Ang taong Mandarin lang ang alam ay hindi makakasunod sa usapang Cantonese. Ito ang pinakamahalagang katotohanan para sa helper sa Hong Kong: kung Mandarin ang inaral mo, hindi mo pa rin maiintindihan ang matandang nagsasalita ng Cantonese sa bahay ninyo. Tingnan ang <a href="/fil/learn/elder-care">Pag-aalaga sa matanda</a>.</p>

<h2>Tono</h2>
<p>Parehong tonal, pero mas maraming tono ang Cantonese. Anim sa Jyutping, apat sa Mandarin. Mas maraming tono, mas maraming paraan para magkamali sa narinig.</p>

<h2>Magkaiba ang mga karaniwang salita</h2>
<ul>
  <li>"Salamat" (sa regalo) — Cantonese <strong>多謝</strong> (do1 ze6), Mandarin 谢谢 (xièxie).</li>
  <li>"Pakisuyo" — Cantonese <strong>唔該</strong> (m4 goi1), Mandarin 请 (qǐng).</li>
  <li>"Kumain" — Cantonese <strong>食</strong> (sik6), Mandarin 吃 (chī).</li>
  <li>"Siya" — Cantonese <strong>佢</strong> (keoi5), Mandarin 他 / 她 (tā).</li>
</ul>

<h2>Pagsulat: Traditional sa Hong Kong</h2>
<p>Traditional characters ang gamit sa Hong Kong (廣東話); Simplified sa mainland (广东话).</p>

<h2>Alin ang dapat aralin?</h2>
<p>Kung sa Hong Kong ka nakatira at nagtatrabaho: <strong>Cantonese</strong>. Ito ang wika ng bahay at ng lansangan, at ng matandang inaalagaan mo. Ang Mandarin ay kapaki-pakinabang sa mainland, pero hindi sa bahay.</p>
<p>Kung marunong ka na ng Mandarin, hindi ka nagsisimula sa zero. Alam mo na kung paano gumagana ang tono, at marami kang nakikilalang karakter. Ang <a href="/zh/learn">bersyon ng app sa Chinese</a> ay para sa iyo — may kahulugan sa Mandarin ang bawat salitang Cantonese.</p>
`,
      zh: `
<p>这个问题经常被问到，而答案往往让人意外：粤语和普通话的书面语大体相通，但说粤语的人和说普通话的人，口语上完全听不懂对方。就实际使用而言，它们不是同一种语言的方言。</p>

<h2>同一套字，两套话</h2>
<p>两者都用汉字，一句正式的书面句子大致互相看得懂。所以很多人以为它们很接近。但书面语是一套共同的标准；口语则是真正不同的语言，差别不亚于西班牙语和意大利语，甚至更大。</p>

<h2>彼此听不懂</h2>
<p>只会普通话的人，听不懂粤语对话。对在香港做家佣的人来说，这一点最关键：如果你学的是普通话，你依然听不懂家里那位说粤语的老人。见<a href="/zh/learn/elder-care">照顾老人</a>。</p>

<h2>声调</h2>
<p>两者都是声调语言，但粤语的声调更多。粤拼标出六个声调，普通话是四个。声调越多，听错的余地越大——这正是"照着粤拼学"比"靠耳朵猜"重要得多的原因。</p>

<h2>日常用词不一样</h2>
<p>你用得最多的那些词，很多根本不同：</p>
<ul>
  <li>"谢谢"（收礼物）——粤语 <strong>多謝</strong>（do1 ze6），普通话 谢谢。</li>
  <li>"劳驾／麻烦你"——粤语 <strong>唔該</strong>（m4 goi1），普通话 请。普通话里没有一个词能完全顶替 唔該 的用法。</li>
  <li>"吃"——粤语 <strong>食</strong>（sik6），普通话 吃。</li>
  <li>"他／她"——粤语 <strong>佢</strong>（keoi5），普通话 他／她。</li>
</ul>
<p>就算意思对得上，词往往也对不上，所以会说普通话的人不能只靠"在脑子里翻译"就让人听懂。</p>

<h2>书写：香港用繁体</h2>
<p>香港用繁体字（廣東話、廁所），内地用简体（广东话、厕所）。如果你只认简体，身边的繁体字你能认出大半，但不是全部。</p>

<h2>到底该学哪个？</h2>
<p>如果你在香港生活和工作：<strong>粤语</strong>。它是家里的语言、街上的语言，也是你照顾的那位老人的语言。普通话对去内地出差、旅行有用，但在家里帮不上忙。</p>
<p>如果你本来就会普通话，那你不是从零开始：你懂声调是怎么回事，认得很多字，也有不少词是重叠的。我们的<a href="/zh/learn">中文版应用</a>就是为你写的——每个粤语词旁边都给出普通话意思，方便你把已经会的，对应到正在听的。</p>
`,
      id: `
<p>Pertanyaan ini sering muncul, dan jawabannya mengejutkan banyak orang: bahasa Kanton dan Mandarin biasanya ditulis dengan cara yang sama, tetapi penutur Kanton dan penutur Mandarin sama sekali tidak saling memahami ucapan. Secara praktis, keduanya bukan dialek dari satu bahasa.</p>

<h2>Tulisan sama, ucapan berbeda</h2>
<p>Keduanya memakai aksara Tionghoa, dan satu kalimat resmi yang ditulis dalam salah satunya sebagian besar bisa dibaca oleh yang lain. Itulah sebabnya orang mengira keduanya dekat. Tetapi bentuk tulis adalah standar bersama; bentuk ucap adalah bahasa yang benar-benar berbeda — sejauh bahasa Spanyol dan Italia, bahkan bisa lebih.</p>

<h2>Tidak saling dimengerti</h2>
<p>Orang yang hanya bisa Mandarin tidak akan bisa mengikuti percakapan dalam bahasa Kanton. Inilah fakta yang paling penting bagi asisten rumah tangga di Hong Kong: kalau Anda belajar Mandarin, Anda tetap tidak akan paham orang lanjut usia berbahasa Kanton di rumah Anda. Lihat <a href="/id/learn/elder-care">Merawat Lansia</a>.</p>

<h2>Nada</h2>
<p>Keduanya bahasa bernada, tetapi bahasa Kanton punya lebih banyak nada. Jyutping menandai enam nada berbeda; Mandarin empat. Semakin banyak nada, semakin banyak cara sebuah kata bisa salah dengar — itulah sebabnya belajar dari romanisasi, bukan dari pendengaran saja, begitu penting.</p>

<h2>Kata sehari-hari berbeda</h2>
<p>Banyak kata yang paling sering Anda pakai memang tidak sama:</p>
<ul>
  <li>"Terima kasih" (untuk hadiah) — Kanton <strong>多謝</strong> (do1 ze6), Mandarin 谢谢 (xièxie).</li>
  <li>"Permisi / tolong" — Kanton <strong>唔該</strong> (m4 goi1), Mandarin 请 (qǐng). Tidak ada satu kata Mandarin pun yang bisa menggantikan seluruh fungsi 唔該 dalam bahasa Kanton.</li>
  <li>"Makan" — Kanton <strong>食</strong> (sik6), Mandarin 吃 (chī).</li>
  <li>"Dia" — Kanton <strong>佢</strong> (keoi5), Mandarin 他 / 她 (tā).</li>
</ul>
<p>Bahkan ketika artinya sama, katanya sering tidak sama. Karena itu penutur Mandarin tidak bisa sekadar "menerjemahkan di kepalanya" lalu dimengerti di Hong Kong.</p>

<h2>Tulisan: Tradisional di Hong Kong</h2>
<p>Hong Kong memakai aksara Tradisional (廣東話, 廁所); Tiongkok daratan memakai Sederhana (广东话, 厕所). Kalau Anda bisa membaca yang Sederhana, Anda akan mengenali banyak aksara Tradisional di sekitar Anda, tetapi tidak semuanya.</p>

<h2>Jadi, mana yang harus dipelajari?</h2>
<p>Kalau Anda tinggal dan bekerja di Hong Kong: <strong>bahasa Kanton</strong>. Itu bahasa rumah tangga, bahasa jalanan, dan bahasa orang lanjut usia yang Anda rawat. Mandarin berguna untuk perjalanan dan bisnis di Tiongkok daratan, tetapi tidak akan membantu Anda di rumah.</p>
<p>Kalau Anda sudah bisa Mandarin, Anda tidak mulai dari nol. Anda tahu cara kerja nada, Anda mengenali banyak aksara, dan cukup banyak kata yang tumpang tindih. <a href="/zh/learn">Versi aplikasi dalam bahasa Mandarin</a> kami ditulis khusus untuk Anda — setiap kata Kanton disertai arti Mandarinnya, supaya Anda bisa memetakan yang sudah Anda tahu ke yang sedang Anda dengar.</p>
`,
    },
    faq: [
      {
        q: {
          en: 'Can a Mandarin speaker understand Cantonese?',
          fil: 'Naiintindihan ba ng marunong ng Mandarin ang Cantonese?',
          zh: '会普通话能听懂粤语吗？',
          id: 'Bisakah penutur Mandarin memahami bahasa Kanton?',
        },
        a: {
          en: 'Not in speech. The two are not mutually intelligible, even though they share a writing system. A Mandarin speaker will recognise many characters in Hong Kong, but will not follow a spoken Cantonese conversation without learning it.',
          fil: 'Hindi, sa pagsasalita. Hindi sila nagkakaintindihan kahit pareho ang sistema ng pagsulat. Makikilala ng marunong ng Mandarin ang maraming karakter sa Hong Kong, pero hindi makakasunod sa usapan.',
          zh: '口语上听不懂。两者共用书写系统，但口语不能互通。会说普通话的人在香港能认出很多字，但如果不专门学，跟不上粤语对话。',
          id: 'Tidak, dalam ucapan. Keduanya tidak saling dimengerti, meskipun sistem tulisannya sama. Penutur Mandarin akan mengenali banyak aksara di Hong Kong, tetapi tidak akan bisa mengikuti percakapan bahasa Kanton tanpa mempelajarinya.',
        },
      },
      {
        q: {
          en: 'Is Cantonese harder than Mandarin?',
          fil: 'Mas mahirap ba ang Cantonese kaysa Mandarin?',
          zh: '粤语比普通话难吗？',
          id: 'Apakah bahasa Kanton lebih sulit daripada Mandarin?',
        },
        a: {
          en: 'Mostly yes, for two reasons: it has more tones (six versus four), and there is less standardised learning material. It is not dramatically harder, but it rewards structured study more than Mandarin does.',
          fil: 'Sa karamihan, oo — dahil mas maraming tono (anim kumpara sa apat) at mas kaunti ang maayos na materyal sa pag-aaral.',
          zh: '大体上更难，原因有两个：声调更多（六个对四个），而且标准化的学习材料更少。倒不是难得多，但它比普通话更依赖有结构的学习。',
          id: 'Umumnya ya, karena dua hal: nadanya lebih banyak (enam berbanding empat), dan materi belajarnya lebih sedikit yang terstandardisasi. Tidak jauh lebih sulit, tetapi lebih menuntut belajar yang terstruktur dibandingkan Mandarin.',
        },
      },
    ],
    related: [
      { href: '/zh/learn', label: { en: 'The Chinese-language version', fil: 'Ang bersyon sa Chinese', zh: '中文版应用', id: 'Versi bahasa Mandarin' } },
      { href: '/guide/learn-cantonese-for-domestic-helpers', label: { en: 'How to learn Cantonese', fil: 'Paano mag-aral ng Cantonese', zh: '家佣如何学粤语', id: 'Cara belajar bahasa Kanton' } },
      { href: '/guide/learn-cantonese', label: { en: 'Learn Cantonese: the complete beginner\u2019s guide', fil: 'Mag-aral ng Cantonese: kumpletong gabay', zh: '粤语入门：完整指南', id: 'Belajar bahasa Kanton: panduan lengkap' } },
    ],
  },

  /* ===================================================================== */
  /* THE PILLAR.
   *
   * The other three guides are top-of-funnel for a *situation* ("I work in a
   * Hong Kong household"). This one is top-of-funnel for the HEAD TERM itself
   * — "learn cantonese" — which is the query with the most volume and the most
   * competition. It is deliberately the longest page on the site and the
   * broadest in scope: tones, Jyutping, the high-frequency core, how to
   * practise, what beginners get wrong. The situation guides then act as the
   * next step down, and this page links to all of them.
   *
   * It is also the page most likely to win a "People also ask" placement, so
   * its FAQ targets the questions that actually appear there ("Is Cantonese
   * hard to learn", "How many tones", "Do I need characters").
   */
  {
    slug: 'learn-cantonese',
    icon: '🗣️',
    updated: UPDATED,
    title: {
      en: 'Learn Cantonese: A Complete Beginner\u2019s Guide',
      fil: 'Mag-aral ng Cantonese: Kumpletong Gabay para sa Baguhan',
      zh: '粤语入门：零基础学粤语的完整指南',
      id: 'Belajar Bahasa Kanton: Panduan Lengkap untuk Pemula',
    },
    description: {
      en: 'Everything a beginner needs to start learning Cantonese: the six tones, Jyutping, the words that cover most of daily life, how to practise, and the mistakes to avoid.',
      fil: 'Lahat ng kailangan ng baguhan para magsimulang mag-aral ng Cantonese: ang anim na tono, Jyutping, ang mga salitang pinakamadalas gamitin, paano magsanay, at mga pagkakamaling dapat iwasan.',
      zh: '零基础学粤语要看什么：六个声调怎么分辨、粤拼怎么用、哪些词最常用、每天怎么练、初学者最容易走哪些弯路。',
      id: 'Semua yang dibutuhkan pemula untuk mulai belajar bahasa Kanton: enam nada, Jyutping, kata yang paling sering dipakai, cara berlatih, dan kesalahan yang harus dihindari.',
    },
    body: {
      en: `
<p>Cantonese is the language of Hong Kong — around seven million speakers, six tones, and a reputation as one of the hardest languages in the world to pick up. This guide is the honest version of that reputation: what actually makes it hard, what does not, and the shortest route from understanding nothing to understanding the person in front of you.</p>

<h2>What Cantonese actually is</h2>
<p>Cantonese (廣東話, <strong>gwong2 dung1 waa2</strong>) is a variety of Chinese spoken in Hong Kong, Macau, Guangdong province, and by large communities overseas. It is <strong>not</strong> a dialect of Mandarin — the two are not mutually intelligible. A Mandarin speaker and a Cantonese speaker cannot hold a conversation, even though they share a writing system.</p>
<p>In Hong Kong it is the language of the street, the market, the restaurant and the home. Written formal Chinese in Hong Kong leans towards Mandarin grammar, but almost everything said out loud is Cantonese.</p>

<h2>Is Cantonese hard to learn?</h2>
<p>Honestly: yes — but not for the reason most people assume.</p>
<p>Vocabulary is not the problem. Chinese grammar is in some ways simpler than English: no verb tenses, no plurals, no articles. The genuinely hard parts are these three:</p>
<ul>
  <li><strong>Tones.</strong> Six of them, and the same syllable in a different tone is a different word.</li>
  <li><strong>Listening speed.</strong> Native speakers run words together and drop sounds. Your first month of listening will feel like noise, and that is normal.</li>
  <li><strong>Materials.</strong> Far fewer good Cantonese courses exist than Mandarin ones, and much of what exists teaches written Chinese rather than how people actually talk.</li>
</ul>
<p>None of that is a wall. It is a hill, and it has a well-marked path up it.</p>

<h2>The six tones are the first real hurdle</h2>
<p>The syllable <em>si</em> can mean six unrelated things depending on its tone:</p>
<ul>
  <li><strong>si1</strong> 詩 — poem</li>
  <li><strong>si2</strong> 史 — history</li>
  <li><strong>si3</strong> 試 — to try</li>
  <li><strong>si4</strong> 時 — time</li>
  <li><strong>si5</strong> 市 — market</li>
  <li><strong>si6</strong> 是 — to be</li>
</ul>
<p>You do not need to master all six on day one. What matters is that you learn every word <em>with</em> its tone from the beginning, rather than guessing from a recording and correcting later. A tone learned wrong is far harder to unlearn than to learn.</p>

<h2>Jyutping: writing down what you hear</h2>
<p><a href="/words/hello">Jyutping</a> is the romanisation system used in Hong Kong linguistics, and the one this app uses. It writes the sound and the tone number together, so 唔該 becomes <strong>m4 goi1</strong> — the number is the tone.</p>
<p>You do not need to read Chinese characters to use it, and you do not need to spell perfectly. You need one thing from it: a way to record a word accurately the first time, so that repetition makes it better instead of cementing a mistake.</p>

<h2>The words that do the most work</h2>
<p>Languages are not evenly distributed. A small number of words carry most of daily conversation, and in Cantonese a handful of them are unusually powerful:</p>
<ul>
  <li><strong>唔該</strong> (m4 goi1) — please, thank you for a service, excuse me, may I. One word covering ground that English needs four phrases for.</li>
  <li><strong>多謝</strong> (do1 ze6) — thank you for a gift or a real favour. Using 唔該 here instead is a small but noticeable error.</li>
  <li><strong>係</strong> (hai6) / <strong>唔係</strong> (m4 hai6) — it is / it is not.</li>
  <li><strong>要</strong> (jiu3) / <strong>唔要</strong> (m4 jiu3) — want / do not want.</li>
  <li><strong>得</strong> (dak1) — can, OK, that works.</li>
  <li><strong>冇</strong> (mou5) — do not have, there is none.</li>
</ul>
<p>Learn these properly and you can already handle a surprising share of what a Hong Kong household says to you.</p>

<h2>How Cantonese is written</h2>
<p>Hong Kong uses <strong>Traditional</strong> characters (廣東話, 廁所); mainland China uses Simplified (广东话, 厕所). If you can read Simplified, you will recognise many Traditional characters around you — but not all of them, and the differences are not always guessable.</p>
<p>Spoken Cantonese also has its own characters that do not appear in standard written Chinese — 唔, 咗, 嘅, 佢. This is why a Cantonese learner who only studies written Chinese still cannot read a Hong Kong text message.</p>

<h2>How to practise so it actually sticks</h2>
<p>Three principles, in order of importance:</p>
<ol>
  <li><strong>Listen before you speak.</strong> The moment that defeats beginners is not speaking — it is being spoken to quickly and understanding nothing. Train recognition first.</li>
  <li><strong>Little and often.</strong> Ten minutes a day beats two hours on Sunday. Language memory is built by frequency, not by duration.</li>
  <li><strong>Test yourself; do not just review.</strong> Re-reading a word list feels productive and is close to useless. Being asked to recall a word — and getting it wrong — is what makes it stick.</li>
</ol>
<p>A routine that works: five minutes reading new words aloud, three minutes on a quiz, two minutes choosing one word you will try to use today with a real person.</p>

<h2>Mistakes beginners make</h2>
<ul>
  <li><strong>Learning phrases without the pieces.</strong> Memorising "I would like some water" gives you one sentence. Learning 水, 要 and 唔該 gives you dozens.</li>
  <li><strong>Skipping tone because practising it feels embarrassing.</strong> Tone is not decoration. Tone <em>is</em> the word.</li>
  <li><strong>Studying characters first.</strong> Reading is a much larger project than speaking. If your goal is to communicate at work, characters can wait a long time.</li>
  <li><strong>Waiting until you feel ready to speak.</strong> You will never feel ready. Use the one word you learned today, badly, and notice that it still worked.</li>
</ul>

<h2>Where to go next</h2>
<p>If you are learning because you work in a Hong Kong household, start with the words you will hear today rather than the words in a textbook. Our vocabulary is organised by situation — greetings, elder care, kitchen, cleaning, safety — and every word is marked as something you say or something you hear.</p>
<p>Start with <a href="/learn/greetings">Greetings</a>, then <a href="/learn/elder-care">Elder Care</a>. Choosing between languages? Read <a href="/guide/cantonese-vs-mandarin">Cantonese vs Mandarin</a> first. Already working and want a routine? See <a href="/guide/learn-cantonese-for-domestic-helpers">how to learn Cantonese as a domestic helper</a>.</p>
`,
      fil: `
<p>Ang Cantonese ang wika ng Hong Kong — mga pitong milyong nagsasalita, anim na tono, at reputasyon bilang isa sa pinakamahirap na wikang matutunan sa mundo. Ang gabay na ito ang tapat na bersyon ng reputasyong iyon: ano talaga ang mahirap, ano ang hindi, at ang pinakamaikling daan mula sa "wala akong naiintindihan" tungo sa "naiintindihan ko siya".</p>

<h2>Ano ba talaga ang Cantonese</h2>
<p>Ang Cantonese (廣東話, <strong>gwong2 dung1 waa2</strong>) ay isang uri ng Chinese na sinasalita sa Hong Kong, Macau, Guangdong, at ng malalaking komunidad sa ibang bansa. <strong>Hindi</strong> ito dialekto ng Mandarin — hindi sila nagkakaintindihan. Kahit pareho ang sistema ng pagsulat, hindi makakapag-usap ang marunong ng Mandarin at ang marunong ng Cantonese.</p>
<p>Sa Hong Kong, ito ang wika sa kalsada, palengke, restawran at bahay. Ang pormal na nakasulat na Chinese ay palapit sa gramatika ng Mandarin, pero halos lahat ng sinasabi nang malakas ay Cantonese.</p>

<h2>Mahirap ba talaga ang Cantonese?</h2>
<p>Sa totoo lang: oo — pero hindi sa dahilang inaakala ng karamihan.</p>
<p>Hindi ang bokabularyo ang problema. Ang gramatika ng Chinese ay mas simple pa sa Ingles sa ilang paraan: walang tense ng pandiwa, walang plural, walang article. Ang tunay na mahirap ay tatlo:</p>
<ul>
  <li><strong>Ang mga tono.</strong> Anim sila, at ang parehong pantig sa ibang tono ay ibang salita.</li>
  <li><strong>Bilis ng pagsasalita.</strong> Pinagsasama ng katutubo ang mga salita at may tinutulugan na tunog. Ang unang buwan ng pakikinig ay parang ingay — normal iyon.</li>
  <li><strong>Materyales.</strong> Mas kaunti ang magagandang kurso sa Cantonese kaysa Mandarin, at marami sa umiiral ay nagtuturo ng nakasulat na Chinese, hindi ng aktwal na pagsasalita.</li>
</ul>
<p>Walang pader dito. Burol ito, at may malinaw na daan paakyat.</p>

<h2>Ang anim na tono ang unang tunay na hadlang</h2>
<p>Ang pantig na <em>si</em> ay maaaring anim na magkaibang bagay depende sa tono:</p>
<ul>
  <li><strong>si1</strong> 詩 — tula</li>
  <li><strong>si2</strong> 史 — kasaysayan</li>
  <li><strong>si3</strong> 試 — subukan</li>
  <li><strong>si4</strong> 時 — oras</li>
  <li><strong>si5</strong> 市 — palengke</li>
  <li><strong>si6</strong> 是 — ay</li>
</ul>
<p>Hindi mo kailangang makuha lahat ng anim sa unang araw. Ang mahalaga: matutunan ang bawat salita <em>kasama</em> ang tono nito mula sa simula, sa halip na hulaan mula sa recording at itama mamaya. Ang maling tono na natutunan ay mas mahirap kalimutan kaysa matutunan.</p>

<h2>Jyutping: para maisulat ang naririnig mo</h2>
<p>Ang Jyutping ang romanisasyon na ginagamit sa lingguwistika ng Hong Kong, at sa app na ito. Isinusulat nito ang tunog at ang numero ng tono nang magkasama: ang 唔該 ay <strong>m4 goi1</strong>. Ang numero ang tono.</p>
<p>Hindi mo kailangang marunong bumasa ng Chinese characters para gamitin ito. Ang kailangan mo lang: isang paraan para maisulat nang tama ang salita sa unang pagkakataon, para pagbutihin ito ng pag-uulit sa halip na gawing permanente ang mali.</p>

<h2>Ang mga salitang pinakamalaking tulong</h2>
<p>Hindi pantay ang bigat ng mga salita. Kaunting salita lang ang bumubuhat sa halos lahat ng pang-araw-araw na usapan, at sa Cantonese, ilan sa kanila ay napakalakas:</p>
<ul>
  <li><strong>唔該</strong> (m4 goi1) — paki-usap, salamat sa serbisyo, excuse me, pwede ba. Isang salita para sa apat na parirala sa Ingles.</li>
  <li><strong>多謝</strong> (do1 ze6) — salamat sa regalo o tunay na pabor.</li>
  <li><strong>係</strong> (hai6) / <strong>唔係</strong> (m4 hai6) — oo, ito nga / hindi.</li>
  <li><strong>要</strong> (jiu3) / <strong>唔要</strong> (m4 jiu3) — gusto / ayaw.</li>
  <li><strong>得</strong> (dak1) — kaya, sige, puwede.</li>
  <li><strong>冇</strong> (mou5) — wala.</li>
</ul>
<p>Kung matutunan mo ito nang maayos, malaki na ang sakop mo sa mga sinasabi sa iyo sa isang bahay sa Hong Kong.</p>

<h2>Paano nakasulat ang Cantonese</h2>
<p>Traditional ang gamit sa Hong Kong (廣東話, 廁所); Simplified ang sa mainland China (广东话, 厕所). Kung marunong kang bumasa ng Simplified, makikilala mo ang maraming Traditional na karakter — pero hindi lahat.</p>
<p>May sariling mga karakter ang pasalitang Cantonese na wala sa pormal na nakasulat na Chinese — 唔, 咗, 嘅, 佢. Kaya kahit mahusay ka sa nakasulat na Chinese, hindi mo pa rin mababasa ang text message sa Hong Kong.</p>

<h2>Paano magsanay para tumagal</h2>
<p>Tatlong prinsipyo, ayon sa kahalagahan:</p>
<ol>
  <li><strong>Makinig bago magsalita.</strong> Ang sandaling tumatalo sa baguhan ay hindi ang pagsasalita — kundi ang mabilis na pagsasalita sa iyo na wala kang naintindihan.</li>
  <li><strong>Kaunti pero madalas.</strong> Mas mabuti ang sampung minuto araw-araw kaysa dalawang oras tuwing Linggo.</li>
  <li><strong>Subukan ang sarili, huwag lang balik-aralan.</strong> Ang muling pagbasa ng listahan ay parang produktibo pero halos walang bisa. Ang pagpapasagot sa iyo — at ang mali — ang nagpapatibay.</li>
</ol>
<p>Routine na gumagana: limang minuto sa pagbasa nang malakas, tatlong minuto sa quiz, dalawang minuto sa pagpili ng isang salitang gagamitin mo ngayong araw sa totoong tao.</p>

<h2>Mga pagkakamali ng baguhan</h2>
<ul>
  <li><strong>Mga parirala na walang piraso.</strong> Ang kabisaduhin ang "pwede bang tubig" ay isang pangungusap. Ang matutunan ang 水, 要 at 唔該 ay dose-dosenang pangungusap.</li>
  <li><strong>Nilalaktawan ang tono dahil nakakahiya.</strong> Hindi dekorasyon ang tono. Ang tono <em>ay</em> ang salita.</li>
  <li><strong>Karakter muna.</strong> Mas malaking proyekto ang pagbasa kaysa pagsasalita. Kung komunikasyon sa trabaho ang target, puwedeng maghintay ang karakter.</li>
  <li><strong>Naghihintay na maging handa.</strong> Hindi ka magiging handa. Gamitin mo na ngayon ang isang salita, kahit mali, at mapapansin mong gumana pa rin.</li>
</ul>

<h2>Saan susunod</h2>
<p>Kung nag-aaral ka dahil nagtatrabaho ka sa isang bahay sa Hong Kong, unahin ang mga salitang maririnig mo ngayong araw. Ang bokabularyo namin ay nakaayos ayon sa sitwasyon — pagbati, pag-aalaga sa matanda, kusina, paglilinis, kaligtasan.</p>
<p>Simulan sa <a href="/fil/learn/greetings">Pagbati</a>, tapos <a href="/fil/learn/elder-care">Pag-aalaga sa matanda</a>. Nag-iisip kung alin ang aaralin? Basahin muna ang <a href="/fil/guide/cantonese-vs-mandarin">Cantonese vs Mandarin</a>. Nagtatrabaho na at gusto ng routine? Tingnan ang <a href="/fil/guide/learn-cantonese-for-domestic-helpers">paano mag-aral ng Cantonese bilang helper</a>.</p>
`,
      zh: `
<p>粤语是香港的语言——大约七百万使用者、六个声调，还有"世界上最难学的语言之一"这个名声。这份指南想把这个名声讲清楚：到底难在哪里、哪里其实不难，以及从"一句都听不懂"到"听懂眼前这个人"最短的路。</p>

<h2>粤语到底是什么</h2>
<p>粤语（廣東話，<strong>gwong2 dung1 waa2</strong>）通行于香港、澳门、广东，以及海外的大量华人社区。它<strong>不是</strong>普通话的方言——两者口语不能互通。会说普通话的人和说粤语的人，即使共用一套书写系统，也没法直接对话。</p>
<p>在香港，粤语是街上、街市、餐厅和家里的语言。香港正式的书面中文偏向普通话语法，但只要开口说，几乎都是粤语。</p>

<h2>粤语难学吗</h2>
<p>说实话：难——但难的地方和多数人以为的不一样。</p>
<p>词汇不是问题。中文语法在某些方面比英语简单：动词没有时态、名词没有单复数、没有冠词。真正难的是这三点：</p>
<ul>
  <li><strong>声调。</strong>六个，同一个音节换个声调就是另一个词。</li>
  <li><strong>语速。</strong>母语者会把字连起来说、吞掉一些音。第一个月的听力会像一团噪音，这很正常。</li>
  <li><strong>教材。</strong>好的粤语课程远少于普通话课程，而且不少教材教的是书面中文，不是人们真正怎么说话。</li>
</ul>
<p>这些都不是墙，是一座坡，而且坡上有清楚的路。</p>

<h2>六个声调是第一道真坎</h2>
<p>音节 <em>si</em> 按声调不同，可以是六个毫不相干的字：</p>
<ul>
  <li><strong>si1</strong> 詩 — 诗</li>
  <li><strong>si2</strong> 史 — 历史</li>
  <li><strong>si3</strong> 試 — 试</li>
  <li><strong>si4</strong> 時 — 时间</li>
  <li><strong>si5</strong> 市 — 市场</li>
  <li><strong>si6</strong> 是 — 是</li>
</ul>
<p>你不需要第一天就掌握全部六个。要紧的是：<strong>从一开始就带着声调记词</strong>，而不是先跟着录音猜、以后再改。学错的声调，比没学过的更难纠正。</p>

<h2>粤拼：把听到的写下来</h2>
<p><a href="/zh/words/hello">粤拼</a>是香港语言学使用的罗马字方案，也是本应用使用的方案。它把读音和声调数字写在一起：唔該 就是 <strong>m4 goi1</strong>，数字就是声调。</p>
<p>用粤拼不需要会认汉字，也不需要拼得完全准确。你只需要它给你一样东西：第一次就把一个词记对，这样重复是让它变准，而不是把错误固化下来。</p>

<h2>最省力的那几个词</h2>
<p>语言的词不是平均分布的。少数词承担了日常对话的大部分，而在粤语里，有几个词格外好用：</p>
<ul>
  <li><strong>唔該</strong>（m4 goi1）——请、谢谢（对方提供服务）、劳驾、麻烦你。英语要用四个说法才能覆盖它。</li>
  <li><strong>多謝</strong>（do1 ze6）——谢谢（收礼物或受了实实在在的帮助）。这里误用唔該，是个不大但听得出来的错。</li>
  <li><strong>係</strong>（hai6）／<strong>唔係</strong>（m4 hai6）——是／不是。</li>
  <li><strong>要</strong>（jiu3）／<strong>唔要</strong>（m4 jiu3）——要／不要。</li>
  <li><strong>得</strong>（dak1）——可以、行、没问题。</li>
  <li><strong>冇</strong>（mou5）——没有。</li>
</ul>
<p>把这几个学扎实，一个香港家庭对你说的话，你已经能接住相当一部分。</p>

<h2>粤语是怎么写的</h2>
<p>香港用<strong>繁体</strong>（廣東話、廁所），内地用简体（广东话、厕所）。如果你会简体，身边很多繁体字你都能认出来，但不是全部，而且差别不一定猜得到。</p>
<p>口语粤语还有自己的一套字，不出现在标准书面中文里——唔、咗、嘅、佢。所以只学书面中文的人，仍然读不懂香港人的短信。</p>

<h2>怎么练才留得住</h2>
<p>三条原则，按重要程度排：</p>
<ol>
  <li><strong>先听，后说。</strong>让初学者崩掉的时刻不是开口，而是别人飞快地说了一句，你什么都没听懂。先练"认得出"。</li>
  <li><strong>少而勤。</strong>每天十分钟胜过周日两小时。语言记忆靠频率，不靠时长。</li>
  <li><strong>自测，而不只是复习。</strong>反复读词表感觉很有产出，其实几乎没用。被问、答错、再答对，才记得住。</li>
</ol>
<p>一套可行的安排：五分钟出声读新词，三分钟做测验，两分钟挑一个词今天找真人用一次。</p>

<h2>初学者常走的弯路</h2>
<ul>
  <li><strong>只背整句，不拆零件。</strong>背下"我想要点水"只会一句；学会 水、要、唔該，是几十句。</li>
  <li><strong>因为不好意思练就不管声调。</strong>声调不是装饰，声调<em>就是</em>这个词。</li>
  <li><strong>先学认字。</strong>阅读比说话大得多。如果目标是工作里能沟通，认字可以往后放很久。</li>
  <li><strong>等自己"准备好"再开口。</strong>你永远不会觉得准备好。今天学的那个词，说得烂也去用一次，你会发现它照样管用。</li>
</ul>

<h2>接下来从哪里开始</h2>
<p>如果你学粤语是因为在香港的家庭里工作，先学今天就会听到的词，而不是课本里的词。我们的词汇按场景编排——打招呼、照顾老人、厨房、清洁、安全——而且每个词都标注了是"你要说的"还是"你会听到的"。</p>
<p>先从<a href="/zh/learn/greetings">打招呼</a>开始，然后是<a href="/zh/learn/elder-care">照顾老人</a>。还在犹豫学哪个？先读<a href="/zh/guide/cantonese-vs-mandarin">粤语和普通话的区别</a>。已经在工作、想要一套日常安排？看<a href="/zh/guide/learn-cantonese-for-domestic-helpers">家佣怎么学粤语</a>。</p>
`,
      id: `
<p>Bahasa Kanton adalah bahasa Hong Kong — sekitar tujuh juta penutur, enam nada, dan reputasi sebagai salah satu bahasa tersulit di dunia untuk dipelajari. Panduan ini adalah versi jujurnya: apa yang sebenarnya sulit, apa yang tidak, dan jalan terpendek dari "saya tidak paham apa-apa" ke "saya paham apa yang dia bilang".</p>

<h2>Sebenarnya apa itu bahasa Kanton</h2>
<p>Bahasa Kanton (廣東話, <strong>gwong2 dung1 waa2</strong>) adalah salah satu ragam bahasa Tionghoa yang dipakai di Hong Kong, Makau, provinsi Guangdong, dan oleh komunitas besar di luar negeri. Ini <strong>bukan</strong> dialek Mandarin — keduanya tidak saling dimengerti. Penutur Mandarin dan penutur Kanton tidak bisa bercakap-cakap, meskipun sistem tulisannya sama.</p>
<p>Di Hong Kong, bahasa ini dipakai di jalan, pasar, restoran, dan rumah. Bahasa Tionghoa tertulis yang formal cenderung mengikuti tata bahasa Mandarin, tetapi hampir semua yang diucapkan adalah bahasa Kanton.</p>

<h2>Apakah bahasa Kanton sulit dipelajari?</h2>
<p>Jujur: ya — tetapi bukan karena alasan yang biasanya orang duga.</p>
<p>Kosakata bukan masalahnya. Tata bahasa Tionghoa di beberapa hal lebih sederhana daripada bahasa Inggris: tidak ada kala pada kata kerja, tidak ada bentuk jamak, tidak ada kata sandang. Yang benar-benar sulit ada tiga:</p>
<ul>
  <li><strong>Nada.</strong> Ada enam, dan suku kata yang sama dengan nada berbeda adalah kata yang berbeda.</li>
  <li><strong>Kecepatan bicara.</strong> Penutur asli menyambung kata dan menelan sebagian bunyi. Bulan pertama mendengarkan akan terasa seperti kebisingan — itu normal.</li>
  <li><strong>Materi belajar.</strong> Kursus bahasa Kanton yang bagus jauh lebih sedikit daripada bahasa Mandarin, dan banyak yang ada mengajarkan bahasa Tionghoa tertulis, bukan cara orang benar-benar berbicara.</li>
</ul>
<p>Semua itu bukan dinding. Ini tanjakan, dan jalannya jelas.</p>

<h2>Enam nada adalah rintangan pertama</h2>
<p>Suku kata <em>si</em> bisa berarti enam hal yang tidak berhubungan, tergantung nadanya:</p>
<ul>
  <li><strong>si1</strong> 詩 — puisi</li>
  <li><strong>si2</strong> 史 — sejarah</li>
  <li><strong>si3</strong> 試 — mencoba</li>
  <li><strong>si4</strong> 時 — waktu</li>
  <li><strong>si5</strong> 市 — pasar</li>
  <li><strong>si6</strong> 是 — adalah</li>
</ul>
<p>Anda tidak perlu menguasai keenamnya di hari pertama. Yang penting: pelajari setiap kata <em>beserta</em> nadanya sejak awal, bukan menebak dari rekaman lalu memperbaikinya nanti. Nada yang salah dipelajari jauh lebih sulit dihilangkan daripada dipelajari.</p>

<h2>Jyutping: menuliskan apa yang Anda dengar</h2>
<p>Jyutping adalah sistem romanisasi yang dipakai dalam linguistik Hong Kong, dan yang dipakai aplikasi ini. Sistem ini menuliskan bunyi dan nomor nada sekaligus: 唔該 menjadi <strong>m4 goi1</strong>. Nomornya adalah nada.</p>
<p>Anda tidak perlu bisa membaca aksara Tionghoa untuk memakainya, dan tidak perlu mengeja dengan sempurna. Anda hanya perlu satu hal darinya: cara mencatat kata dengan benar sejak pertama, supaya pengulangan membuatnya makin tepat, bukan mengabadikan kesalahan.</p>

<h2>Kata-kata yang paling banyak membantu</h2>
<p>Kata tidak tersebar merata. Sejumlah kecil kata memikul sebagian besar percakapan sehari-hari, dan dalam bahasa Kanton beberapa di antaranya sangat kuat:</p>
<ul>
  <li><strong>唔該</strong> (m4 goi1) — tolong, terima kasih untuk layanan, permisi, bolehkah. Satu kata untuk empat frasa bahasa Inggris.</li>
  <li><strong>多謝</strong> (do1 ze6) — terima kasih untuk hadiah atau bantuan sungguhan. Memakai 唔該 di sini adalah kesalahan kecil yang terdengar.</li>
  <li><strong>係</strong> (hai6) / <strong>唔係</strong> (m4 hai6) — ya, benar / bukan.</li>
  <li><strong>要</strong> (jiu3) / <strong>唔要</strong> (m4 jiu3) — mau / tidak mau.</li>
  <li><strong>得</strong> (dak1) — bisa, oke, cukup.</li>
  <li><strong>冇</strong> (mou5) — tidak ada.</li>
</ul>
<p>Kalau ini dikuasai dengan baik, sebagian besar ucapan di rumah tangga Hong Kong sudah bisa Anda tangani.</p>

<h2>Bagaimana bahasa Kanton ditulis</h2>
<p>Hong Kong memakai aksara <strong>Tradisional</strong> (廣東話, 廁所); Tiongkok daratan memakai Sederhana (广东话, 厕所). Kalau Anda bisa membaca yang Sederhana, banyak aksara Tradisional akan Anda kenali — tetapi tidak semuanya, dan perbedaannya tidak selalu bisa ditebak.</p>
<p>Bahasa Kanton lisan juga punya aksara sendiri yang tidak muncul dalam bahasa Tionghoa tertulis standar — 唔, 咗, 嘅, 佢. Itu sebabnya orang yang hanya belajar bahasa Tionghoa tertulis tetap tidak bisa membaca pesan teks orang Hong Kong.</p>

<h2>Cara berlatih supaya menempel</h2>
<p>Tiga prinsip, menurut urutan kepentingan:</p>
<ol>
  <li><strong>Dengarkan sebelum berbicara.</strong> Momen yang menjatuhkan pemula bukan saat berbicara — melainkan saat orang berbicara cepat kepada Anda dan Anda tidak paham apa pun.</li>
  <li><strong>Sedikit tapi sering.</strong> Sepuluh menit sehari lebih baik daripada dua jam setiap Minggu. Ingatan bahasa dibangun oleh frekuensi, bukan durasi.</li>
  <li><strong>Uji diri, bukan sekadar mengulang.</strong> Membaca ulang daftar kata terasa produktif tetapi hampir tidak berguna. Diminta mengingat — dan salah — itulah yang membuatnya menempel.</li>
</ol>
<p>Rutinitas yang berhasil: lima menit membaca kata baru dengan suara keras, tiga menit kuis, dua menit memilih satu kata yang akan Anda pakai hari ini kepada orang sungguhan.</p>

<h2>Kesalahan yang biasa dilakukan pemula</h2>
<ul>
  <li><strong>Menghafal kalimat tanpa bagiannya.</strong> Menghafal "saya mau air" hanya memberi satu kalimat. Mempelajari 水, 要 dan 唔該 memberi puluhan kalimat.</li>
  <li><strong>Melewati nada karena malu berlatih.</strong> Nada bukan hiasan. Nada <em>adalah</em> katanya.</li>
  <li><strong>Belajar aksara lebih dulu.</strong> Membaca jauh lebih besar daripada berbicara. Kalau tujuan Anda bisa berkomunikasi di tempat kerja, aksara bisa ditunda lama.</li>
  <li><strong>Menunggu sampai merasa siap.</strong> Anda tidak akan pernah merasa siap. Pakailah satu kata yang Anda pelajari hari ini, walaupun salah, dan perhatikan bahwa itu tetap berhasil.</li>
</ul>

<h2>Lanjut ke mana</h2>
<p>Kalau Anda belajar karena bekerja di rumah tangga Hong Kong, mulailah dari kata yang akan Anda dengar hari ini, bukan kata di buku pelajaran. Kosakata kami disusun menurut situasi — salam, merawat lansia, dapur, kebersihan, keselamatan — dan setiap kata ditandai sebagai yang Anda ucapkan atau yang Anda dengar.</p>
<p>Mulai dari <a href="/id/learn/greetings">Salam</a>, lalu <a href="/id/learn/elder-care">Merawat Lansia</a>. Sedang memilih bahasa? Baca dulu <a href="/id/guide/cantonese-vs-mandarin">Kanton vs Mandarin</a>. Sudah bekerja dan ingin rutinitas? Lihat <a href="/id/guide/learn-cantonese-for-domestic-helpers">cara belajar bahasa Kanton sebagai asisten rumah tangga</a>.</p>
`,
    },
    faq: [
      {
        q: {
          en: 'Is Cantonese hard to learn?',
          fil: 'Mahirap bang matuto ng Cantonese?',
          zh: '粤语难学吗？',
          id: 'Apakah bahasa Kanton sulit dipelajari?',
        },
        a: {
          en: 'It is harder than most European languages, but the difficulty is concentrated in three places: six tones, fast natural speech, and a shortage of good learning material. Grammar and vocabulary are not the obstacles people expect them to be. With regular short practice, most learners can understand everyday spoken Cantonese well before they can speak it well.',
          fil: 'Mas mahirap kaysa sa karamihan ng wikang Europeo, pero tatlo lang ang tunay na mahirap: ang anim na tono, ang mabilis na natural na pagsasalita, at kakulangan ng magandang materyales. Hindi balakid ang gramatika at bokabularyo. Sa regular na maikling pagsasanay, mauunawaan ng karamihan ang pang-araw-araw na Cantonese bago pa makapagsalita nang mahusay.',
          zh: '比多数欧洲语言难，但难点集中在三处：六个声调、母语者的自然语速、以及好教材太少。语法和词汇反而不是大家以为的障碍。只要坚持短时高频地练，多数人"听得懂日常粤语"会远早于"说得好"。',
          id: 'Lebih sulit daripada sebagian besar bahasa Eropa, tetapi kesulitannya terkumpul di tiga tempat: enam nada, ucapan alami yang cepat, dan kurangnya materi belajar yang baik. Tata bahasa dan kosakata bukan hambatan seperti yang orang duga. Dengan latihan singkat yang rutin, sebagian besar pembelajar bisa memahami bahasa Kanton sehari-hari jauh sebelum bisa berbicara dengan baik.',
        },
      },
      {
        q: {
          en: 'How long does it take to learn Cantonese?',
          fil: 'Gaano katagal bago matuto ng Cantonese?',
          zh: '学粤语要多久？',
          id: 'Berapa lama untuk belajar bahasa Kanton?',
        },
        a: {
          en: 'To understand the everyday requests in a Hong Kong household: roughly three to six months of ten minutes a day. To hold a comfortable conversation: two to three years. To sound like a native speaker: most learners never get there, and you do not need to. The useful milestone comes much earlier than the impressive one.',
          fil: 'Para maintindihan ang pang-araw-araw na utos sa isang bahay sa Hong Kong: mga tatlo hanggang anim na buwan ng sampung minuto kada araw. Para sa maayos na usapan: dalawa hanggang tatlong taon. Para tumunog na parang katutubo: karamihan ay hindi na umabot doon, at hindi mo kailangan.',
          zh: '听懂香港家庭的日常吩咐：大约三到六个月，每天十分钟。能顺畅聊天：两到三年。说得像母语者：多数人一辈子也到不了，而且你不需要。真正有用的那个节点，比"听起来很厉害"的那个节点来得早得多。',
          id: 'Untuk memahami permintaan sehari-hari di rumah tangga Hong Kong: sekitar tiga sampai enam bulan dengan sepuluh menit sehari. Untuk bercakap dengan nyaman: dua sampai tiga tahun. Untuk terdengar seperti penutur asli: sebagian besar pembelajar tidak pernah sampai, dan Anda tidak perlu. Tonggak yang berguna datang jauh lebih awal.',
        },
      },
      {
        q: {
          en: 'What is the difference between Cantonese and Mandarin?',
          fil: 'Ano ang pagkakaiba ng Cantonese at Mandarin?',
          zh: '粤语和普通话有什么区别？',
          id: 'Apa perbedaan bahasa Kanton dan Mandarin?',
        },
        a: {
          en: 'They are two separate Chinese languages, not two accents of one. They are not mutually intelligible in speech, they use different words for common concepts, and Cantonese has six tones against Mandarin four. They do share a writing system, so a Mandarin speaker will recognise many characters in Hong Kong without understanding a word of what is said.',
          fil: 'Dalawang magkaibang wikang Chinese sila, hindi dalawang punto ng isang wika. Hindi sila nagkakaintindihan sa pagsasalita, iba ang salita para sa karaniwang bagay, at anim ang tono ng Cantonese kumpara sa apat ng Mandarin. Pareho ang sistema ng pagsulat, kaya makikilala ng marunong ng Mandarin ang maraming karakter pero wala siyang maiintindihan sa usapan.',
          zh: '它们是两种不同的汉语，不是同一种话的两种口音。口语不能互通，常用词往往不同，而且粤语六个声调、普通话四个。书写系统是共用的，所以会普通话的人在香港能认出很多字，但听不懂一句对话。',
          id: 'Keduanya adalah dua bahasa Tionghoa yang berbeda, bukan dua logat dari satu bahasa. Tidak saling dimengerti dalam ucapan, memakai kata berbeda untuk konsep umum, dan bahasa Kanton punya enam nada sedangkan Mandarin empat. Sistem tulisannya sama, jadi penutur Mandarin akan mengenali banyak aksara di Hong Kong tanpa memahami satu kata pun yang diucapkan.',
        },
      },
      {
        q: {
          en: 'How many tones does Cantonese have?',
          fil: 'Ilan ang tono ng Cantonese?',
          zh: '粤语有几个声调？',
          id: 'Ada berapa nada dalam bahasa Kanton?',
        },
        a: {
          en: 'Six tones in the standard analysis used for Jyutping. They are numbered 1 to 6, which is why Jyutping writes them as digits — 唔該 is m4 goi1. Some descriptions also count two "entering tones" for syllables ending in p, t or k, but those are covered by the same six numbers in Jyutping.',
          fil: 'Anim na tono sa pamantayang pagsusuri na ginagamit sa Jyutping. Binibilang silang 1 hanggang 6, kaya numero ang isinusulat sa Jyutping — ang 唔該 ay m4 goi1. May nagbibilang din ng dalawang "entering tone" para sa pantig na nagtatapos sa p, t o k, pero sakop na rin sila ng parehong anim na numero.',
          zh: '按粤拼采用的标准分析是六个声调，编号 1 到 6，所以粤拼用数字写声调——唔該 就是 m4 goi1。也有人会把以 p、t、k 结尾的音节另算两个"入声"，但在粤拼里它们仍然归入这六个编号。',
          id: 'Enam nada menurut analisis standar yang dipakai Jyutping. Dinomori 1 sampai 6, itulah sebabnya Jyutping menulisnya sebagai angka — 唔該 adalah m4 goi1. Ada juga yang menghitung dua "nada masuk" untuk suku kata berakhiran p, t, atau k, tetapi dalam Jyutping semuanya tetap masuk keenam nomor itu.',
        },
      },
      {
        q: {
          en: 'Do I need to learn Chinese characters to speak Cantonese?',
          fil: 'Kailangan bang matuto ng Chinese characters para makapagsalita ng Cantonese?',
          zh: '学粤语一定要认汉字吗？',
          id: 'Apakah saya harus belajar aksara Tionghoa untuk bisa berbicara bahasa Kanton?',
        },
        a: {
          en: 'No. You can learn to speak and understand entirely through Jyutping romanisation. Characters help with labels, menus and signs, and they become necessary if you want to read, but reading is a much larger project than speaking. Spoken Cantonese also uses its own characters that do not appear in standard written Chinese.',
          fil: 'Hindi. Puwede kang matutong magsalita at umintindi gamit lang ang Jyutping. Nakakatulong ang karakter sa label, menu at karatula, at kailangan ito kung gusto mong bumasa — pero mas malaking proyekto ang pagbasa kaysa pagsasalita. May sariling karakter din ang pasalitang Cantonese na wala sa pormal na nakasulat na Chinese.',
          zh: '不必。你完全可以只靠粤拼来学说话和听懂。认字对看标签、菜单、路牌有帮助，想阅读的话迟早要学，但阅读比说话大得多。而且口语粤语还有一套自己的字，不出现在标准书面中文里。',
          id: 'Tidak. Anda bisa belajar berbicara dan memahami sepenuhnya lewat romanisasi Jyutping. Aksara membantu untuk label, menu, dan papan tanda, dan menjadi perlu kalau Anda ingin membaca — tetapi membaca jauh lebih besar daripada berbicara. Bahasa Kanton lisan juga punya aksara sendiri yang tidak ada dalam bahasa Tionghoa tertulis standar.',
        },
      },
      {
        q: {
          en: 'What is the easiest way to learn Cantonese?',
          fil: 'Ano ang pinakamadaling paraan para matuto ng Cantonese?',
          zh: '学粤语最有效的方法是什么？',
          id: 'Apa cara termudah belajar bahasa Kanton?',
        },
        a: {
          en: 'Learn the highest-frequency words with their tones, listen far more than you speak at first, and practise in short daily sessions rather than long weekly ones. Testing yourself beats re-reading, because recall is what builds memory. If you live in Hong Kong, use each new word with a real person the same day — that is the part no app can do for you.',
          fil: 'Pag-aralan ang pinakamadalas na salita kasama ang tono, makinig nang mas marami kaysa magsalita sa simula, at magsanay nang maikli pero araw-araw. Mas mabisa ang pagsubok sa sarili kaysa muling pagbasa. Kung sa Hong Kong ka nakatira, gamitin agad sa totoong tao ang bagong salita — iyon ang bahaging hindi kayang gawin ng app para sa iyo.',
          zh: '先学最高频的词并连着声调一起记；一开始听的量要远大于说的量；每天短练，而不是每周长练。自测比反复读更有效，因为记忆是靠"回忆"建立的。如果你人在香港，当天就找一个真人把这个词用掉——这一部分任何 app 都替你做不了。',
          id: 'Pelajari kata yang paling sering dipakai beserta nadanya, lebih banyak mendengarkan daripada berbicara di awal, dan berlatih dalam sesi singkat setiap hari, bukan sesi panjang setiap minggu. Menguji diri lebih baik daripada membaca ulang, karena mengingatlah yang membangun memori. Kalau Anda tinggal di Hong Kong, pakailah setiap kata baru kepada orang sungguhan di hari yang sama — bagian itu tidak bisa dilakukan aplikasi mana pun untuk Anda.',
        },
      },
    ],
    related: [
      { href: '/guide/learn-cantonese-for-domestic-helpers', label: { en: 'Learning Cantonese as a domestic helper', fil: 'Pag-aaral ng Cantonese bilang helper', zh: '家佣如何学粤语', id: 'Belajar bahasa Kanton sebagai asisten rumah tangga' } },
      { href: '/guide/cantonese-vs-mandarin', label: { en: 'Cantonese vs Mandarin', fil: 'Cantonese vs Mandarin', zh: '粤语和普通话的区别', id: 'Bahasa Kanton vs Mandarin' } },
      { href: '/learn/greetings', label: { en: 'Start with greetings', fil: 'Simulan sa pagbati', zh: '从打招呼开始', id: 'Mulai dari salam' } },
    ],
  },
];

/** Guide lookup by slug. */
const GUIDE_BY_SLUG = new Map(GUIDES.map((g) => [g.slug, g]));

module.exports = { GUIDES, GUIDE_BY_SLUG, UPDATED };
