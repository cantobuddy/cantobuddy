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
    },
    description: {
      en: 'A practical guide to learning Cantonese for domestic work in Hong Kong — what to learn first, how Jyutping helps, and a realistic daily routine.',
      fil: 'Praktikal na gabay sa pag-aaral ng Cantonese para sa trabahong domestic helper sa Hong Kong — ano ang unahin, paano nakakatulong ang Jyutping, at seryosong routine.',
      zh: '在香港做家佣，粤语要从哪里学起？先学什么、粤拼怎么用、每天十分钟怎么安排，一份务实的入门指南。',
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
    },
    faq: [
      {
        q: {
          en: 'How long does it take to learn enough Cantonese to work in Hong Kong?',
          fil: 'Gaano katagal bago matuto ng sapat na Cantonese para magtrabaho sa Hong Kong?',
          zh: '在香港工作，粤语要学多久才够用？',
        },
        a: {
          en: 'For everyday comprehension, most helpers need three to six months of consistent short practice. Ten minutes a day is enough to learn about 60 words a month, which covers the routine requests in a Hong Kong household. Speaking fluently takes years, but understanding the person you care for does not.',
          fil: 'Para sa pang-araw-araw na pag-intindi, kailangan ng tatlo hanggang anim na buwan ng tuloy-tuloy na maikling pag-aaral. Ang sampung minuto kada araw ay sapat para sa mga 60 salita kada buwan — sakop na nito ang karaniwang utos sa isang bahay sa Hong Kong.',
          zh: '就日常听懂来说，多数人需要三到六个月的持续短练。每天十分钟，一个月大约能掌握 60 个词，香港家庭里的日常吩咐基本就听得懂了。说流利要好几年，但听懂你照顾的人，用不了那么久。',
        },
      },
      {
        q: {
          en: 'Do I need to learn to read Chinese characters?',
          fil: 'Kailangan ko bang matutong bumasa ng Chinese characters?',
          zh: '一定要学会认汉字吗？',
        },
        a: {
          en: 'No. You can learn to speak and understand entirely through Jyutping romanisation. Reading characters helps — labels, menus, signs — but it is not required to do the job, and it is a much bigger task than learning to speak.',
          fil: 'Hindi. Puwede kang matutong magsalita at umintindi gamit lang ang Jyutping. Nakakatulong ang pagbasa ng karakter — sa mga label at menu — pero hindi ito kailangan para sa trabaho.',
          zh: '不必。你完全可以只靠粤拼来学说话和听懂。认字有好处——看标签、菜单、路牌——但不是做这份工作的前提，而且比学说话要难得多。',
        },
      },
      {
        q: {
          en: 'Should I learn Mandarin instead of Cantonese?',
          fil: 'Mas mabuti bang Mandarin ang pag-aralan kaysa Cantonese?',
          zh: '我该学普通话还是粤语？',
        },
        a: {
          en: 'If you live and work in Hong Kong, learn Cantonese. Mandarin is not widely spoken in Hong Kong households, and it will not help you understand an elderly Cantonese speaker. If you already speak Mandarin, you have a head start — see our guide on the differences.',
          fil: 'Kung sa Hong Kong ka nakatira at nagtatrabaho, Cantonese ang pag-aralan. Hindi laganap ang Mandarin sa mga bahay sa Hong Kong. Kung marunong ka na ng Mandarin, may kalamangan ka na.',
          zh: '如果你在香港生活和工作，就学粤语。香港家庭里普通话并不通用，它帮不了你听懂说粤语的老人。如果你本来就会普通话，那是你的优势——可以看我们那篇讲两者区别的文章。',
        },
      },
    ],
    related: [
      { href: '/learn/elder-care', label: { en: 'Elder Care vocabulary', fil: 'Bokabularyo sa pag-aalaga', zh: '照顾老人词汇' } },
      { href: '/guide/cantonese-for-elderly-care', label: { en: 'Caring for an elderly person', fil: 'Pag-aalaga sa matanda', zh: '照顾老人的粤语' } },
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
    },
    description: {
      en: 'The Cantonese an elderly person will say to you, and the phrases you need to answer — for helpers caring for an elderly parent in Hong Kong.',
      fil: 'Ang Cantonese na sasabihin sa iyo ng matanda, at ang mga pariralang kailangan mong isagot — para sa mga helper na nag-aalaga ng matanda sa Hong Kong.',
      zh: '在香港照顾老人，老人常对你说的粤语，以及你必须会回应的那些话。按听和说分开整理。',
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
    },
    faq: [
      {
        q: {
          en: 'What is the most important Cantonese phrase for a carer?',
          fil: 'Ano ang pinakamahalagang Cantonese phrase para sa nag-aalaga?',
          zh: '照顾老人最该先学哪一句？',
        },
        a: {
          en: '我喺度 — "I\'m here". It is short, calm, and answers the fear an elderly person feels most often: that she has been left alone. In an emergency, learn 救命 ("help!") and 叫白車 ("call an ambulance") first.',
          fil: '我喺度 — "Nandito ako". Maikli, kalmado, at sinasagot nito ang pinakamadalas na takot ng matanda: na naiwan siyang mag-isa.',
          zh: '我喺度——"我在。"短、稳，正好回应老人最常见的那份不安：怕自己一个人。如果只学一句应急的，先学 救命 和 叫白車。',
        },
      },
      {
        q: {
          en: 'What does 婆婆 (po4 po2) mean?',
          fil: 'Ano ang ibig sabihin ng 婆婆 (po4 po2)?',
          zh: '婆婆 是什么意思？',
        },
        a: {
          en: '婆婆 is a respectful way to address an elderly woman — close to "grandma", but polite rather than familiar. Helpers commonly use it for the elderly person they care for. For an elderly man, 公公 (gung1 gung1) is the matching word.',
          fil: 'Ang 婆婆 ay magalang na tawag sa matandang babae — parang "Lola", pero magalang. Para sa matandang lalaki, 公公 (gung1 gung1).',
          zh: '婆婆是对老年女性的尊称，接近"奶奶/姥姥"，但更客气。很多家佣就用它称呼自己照顾的老人。老年男性对应的称呼是 公公（gung1 gung1）。',
        },
      },
    ],
    related: [
      { href: '/guide/learn-cantonese-for-domestic-helpers', label: { en: 'How to learn Cantonese', fil: 'Paano mag-aral ng Cantonese', zh: '家佣如何学粤语' } },
      { href: '/learn/safety', label: { en: 'Safety vocabulary', fil: 'Bokabularyo sa kaligtasan', zh: '安全词汇' } },
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
    },
    description: {
      en: 'Cantonese and Mandarin share a writing system but are not mutually intelligible. Here is what is actually different — and which one a helper in Hong Kong needs.',
      fil: 'Pareho ang sistema ng pagsulat ng Cantonese at Mandarin, pero hindi sila nagkakaintindihan. Ito ang tunay na pagkakaiba — at alin ang kailangan ng helper sa Hong Kong.',
      zh: '粤语和普通话共用一套书写系统，但彼此听不懂。真正的差别在哪里，在香港做家佣又该学哪一种。',
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
    },
    faq: [
      {
        q: {
          en: 'Can a Mandarin speaker understand Cantonese?',
          fil: 'Naiintindihan ba ng marunong ng Mandarin ang Cantonese?',
          zh: '会普通话能听懂粤语吗？',
        },
        a: {
          en: 'Not in speech. The two are not mutually intelligible, even though they share a writing system. A Mandarin speaker will recognise many characters in Hong Kong, but will not follow a spoken Cantonese conversation without learning it.',
          fil: 'Hindi, sa pagsasalita. Hindi sila nagkakaintindihan kahit pareho ang sistema ng pagsulat. Makikilala ng marunong ng Mandarin ang maraming karakter sa Hong Kong, pero hindi makakasunod sa usapan.',
          zh: '口语上听不懂。两者共用书写系统，但口语不能互通。会说普通话的人在香港能认出很多字，但如果不专门学，跟不上粤语对话。',
        },
      },
      {
        q: {
          en: 'Is Cantonese harder than Mandarin?',
          fil: 'Mas mahirap ba ang Cantonese kaysa Mandarin?',
          zh: '粤语比普通话难吗？',
        },
        a: {
          en: 'Mostly yes, for two reasons: it has more tones (six versus four), and there is less standardised learning material. It is not dramatically harder, but it rewards structured study more than Mandarin does.',
          fil: 'Sa karamihan, oo — dahil mas maraming tono (anim kumpara sa apat) at mas kaunti ang maayos na materyal sa pag-aaral.',
          zh: '大体上更难，原因有两个：声调更多（六个对四个），而且标准化的学习材料更少。倒不是难得多，但它比普通话更依赖有结构的学习。',
        },
      },
    ],
    related: [
      { href: '/zh/learn', label: { en: 'The Chinese-language version', fil: 'Ang bersyon sa Chinese', zh: '中文版应用' } },
      { href: '/guide/learn-cantonese-for-domestic-helpers', label: { en: 'How to learn Cantonese', fil: 'Paano mag-aral ng Cantonese', zh: '家佣如何学粤语' } },
    ],
  },
];

/** Guide lookup by slug. */
const GUIDE_BY_SLUG = new Map(GUIDES.map((g) => [g.slug, g]));

module.exports = { GUIDES, GUIDE_BY_SLUG, UPDATED };
