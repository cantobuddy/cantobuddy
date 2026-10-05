/* =============================================================================
   CantoBuddy — Internationalisation (English / Filipino / Simplified Chinese)
   Loaded before app.js. Exposes t(), setLang(), toggleLang(), applyTranslations().
   ============================================================================= */

const LANG_STORAGE_KEY = 'cb_lang';

/* The three languages the app can be read in.

   `zh` is written 中文 on the control and means Simplified Chinese. The name
   matters: this is not a translation of the interface for Chinese speakers, it
   is a second audience — people who came to Hong Kong from the mainland and
   already speak Mandarin. They are learning Cantonese for a different reason
   than the Filipino helpers the app was built for: the helper needs to
   understand her employer, the new arrival needs to be understood at the market
   and the clinic. The words overlap; the priorities do not.

   `html` is what goes in the document's lang attribute. */
const LANGS = [
  { code: 'en', label: 'EN',  name: 'English',  html: 'en' },
  { code: 'fil', label: 'FIL', name: 'Filipino', html: 'tl' },
  { code: 'zh', label: '中文', name: '简体中文', html: 'zh-Hans' },
];
const LANG_CODES = LANGS.map((l) => l.code);

const I18N = {
  en: {
    // nav / header
    'nav.home': 'Home',
    'nav.learn': 'Learn',
    'nav.quiz': 'Quiz',
    'nav.progress': 'Progress',
    'nav.share': 'Share',
    'header.setName': 'Set your name',
    'header.voiceTitle': 'Choose practice voice',
    'header.langTitle': 'Change language',
    // The language button advertises the language you would switch TO, so
    // these two are the button's label/tooltip, not the current language.
    'header.langSwitchEn': 'Switch to English',
    'header.langSwitchFil': 'Switch to Filipino',
    'header.employerSite': 'For employers',
    'header.learnerSite': 'Learner app',
    'header.shareSite': 'Share CantoBuddy',

    // home
    'home.title': 'Learn Cantonese',
    'home.subtitle': 'for daily life in Hong Kong',
    'home.desc': 'Practical words and phrases with audio, pictures, and quizzes. Start at your level!',
    'home.beginner': 'Beginner',
    'home.intermediate': 'Intermediate',
    'home.advanced': 'Advanced',
    'home.beginnerDesc': 'Basic greetings & common words',
    'home.intermediateDesc': 'Daily activities & routines',
    'home.advancedDesc': 'Full sentences & phrases',
    'home.startQuiz': '📝 Start Quiz',
    'home.myProgress': '📊 My Progress',
    'home.browseByCategory': 'Browse by Category',

    // browse
    'browse.backHome': '← Home',
    'browse.title': 'Vocabulary',
    'browse.level': 'Level:',
    'browse.category': 'Category:',
    'browse.all': 'All',
    'browse.allLevels': 'All Levels',
    'browse.empty': 'No words found for this filter.',
    'browse.tapToHear': 'Tap to hear pronunciation',

    // quiz setup
    'quiz.title': 'Quiz Time!',
    'quiz.chooseLevel': 'Choose Level',
    'quiz.chooseType': 'Choose Quiz Type',
    'quiz.tMultipleChoice': 'Multiple Choice',
    'quiz.dMultipleChoice': 'See Cantonese, pick the English meaning',
    'quiz.tListenChoose': 'Listen & Choose',
    'quiz.dListenChoose': 'Hear the audio, pick the correct meaning',
    'quiz.tMatchPicture': 'Match Picture',
    'quiz.dMatchPicture': 'See an image, match the Cantonese word',
    'quiz.tFillBlank': 'Fill in the Blank',
    'quiz.dFillBlank': 'Complete the sentence with the right word',

    // quiz play
    'quiz.quit': '← Quit',
    'quiz.questionOf': 'Q',
    'quiz.score': 'Score:',
    'quiz.tapSpeaker': 'Tap the speaker to listen',
    'quiz.promptMeaning': 'What does this mean?',
    'quiz.promptListen': 'Listen and choose the correct meaning',
    'quiz.promptMatch': 'Which Cantonese word matches this picture?',
    'quiz.promptFill': 'Fill in the blank with the correct word',
    'quiz.correct': '✅ Correct!',
    'quiz.answerIs': '❌ Answer:',
    'quiz.next': 'Next →',
    'quiz.seeResults': 'See Results 🎉',
    'quiz.notEnough': 'Not enough words at this level for a quiz. Try another level.',

    // results
    'result.complete': 'Quiz Complete!',
    'result.percentCorrect': '% correct',
    'result.tryAgain': 'Try Again',
    'result.done': 'Done',
    'result.share': 'Share my score',

    // progress
    'progress.title': 'My Progress',
    'progress.setNameFirst': 'Set your name first to track progress! Tap "Set your name" at the top.',
    'progress.none': 'No quiz attempts yet. Take your first quiz! 📝',
    'progress.overall': 'Overall Score',
    'progress.byLevel': 'By Level',
    'progress.recent': 'Recent Attempts',
    'progress.correctOutOf': 'correct out of',
    'progress.attempts': 'quiz attempt(s)',
    'progress.couldNotLoad': 'Could not load progress.',
    'progress.partial': 'Incomplete',
    'progress.stoppedAt': 'Stopped at',

    // statistics — her own numbers, shown inside My Progress
    'stats.title': 'Your statistics',
    'stats.none': 'Finish a quiz and your statistics will appear here.',
    'stats.streak': 'Practice streak',
    'stats.streakNone': 'Not started yet',
    'stats.dayOne': 'day',
    'stats.days': 'days',
    'stats.inARow': 'in a row',
    'stats.practisedToday': 'You practised today — keep it going!',
    'stats.practiseToday': 'Practise today to keep your streak',
    'stats.best': 'Best',
    'stats.daysPractised': 'Days practised',
    'stats.thisWeek': 'This week',
    'stats.lastWeek': 'Last week',
    'stats.attemptOne': 'attempt',
    'stats.attempts': 'attempts',
    'stats.correctPct': '{n}% correct',
    'stats.nothingLastWeek': 'Nothing last week',
    'stats.overTime': 'Practice over time',
    'stats.range7': '7 days',
    'stats.range30': '30 days',
    'stats.range90': '90 days',
    'stats.byQuizType': 'How you practise',
    'stats.chartHint': 'Each bar is one day',

    // name modal
    'name.title': 'Your Name',
    'name.hint': 'Enter your name so your quiz scores are saved.',
    'name.placeholder': 'e.g. Maria',
    'name.cancel': 'Cancel',
    'name.save': 'Save',
    'name.notSaved': 'Your browser is blocking saved data, so your name may not be remembered. Try a normal window, not private browsing.',

    // voice modal
    'voice.title': '🎙️ Choose a Practice Voice',
    'voice.hint': "Tap a voice to hear 你好 — choose a woman's or a man's voice, slow or natural.",
    'voice.woman': 'Woman',
    'voice.man': 'Man',
    'voice.slow': 'Slow & Clear',
    'voice.natural': 'Natural',
    'voice.realVoice': 'real voice',
    'voice.allOnDevice': 'All voices on this device',
    'voice.female': 'Female',
    'voice.male': 'Male',
    'voice.unknown': 'Unknown',
    'voice.done': 'Done',
    'voice.loading': 'Loading voices…',
    'voice.noChinese': '⚠️ No Chinese voice found on this device. Install one in your phone or PC settings.',
    'voice.bothFound': '✓ Real male and female Chinese voices found — the tiles use them directly.',
    'voice.maleOnly': 'ℹ️ A real male voice was found, but no female one — the Woman tiles use pitch adjustment.',
    'voice.femaleOnly': '⚠️ Only a female Chinese voice is installed, so the Man tiles may still sound female. Pick a male voice below, or use Microsoft Edge (it has a real male Cantonese voice).',
    'voice.noGender': 'ℹ️ Voices found, but gender could not be detected — Man/Woman is created by pitch. Pick a specific voice below if one sounds right.',
    'voice.noAudio': '⚠️ This browser cannot play audio. Try Chrome, Edge or Safari.',

    // share
    'share.wordText': 'Learn Cantonese with CantoBuddy',
    'share.scoreText': 'I scored {score}/{total} on CantoBuddy! 🇭🇰',
    'share.copied': 'Copied to clipboard!',
    'share.failed': 'Could not share.',
    'share.cardSaved': 'Image saved — paste it anywhere!',
    'share.cardFooter': 'Free Cantonese practice for helpers in Hong Kong',

    // share page — inviting a friend to the app
    'sharePage.title': 'Share CantoBuddy',
    'sharePage.hero': 'Tell a friend',
    'sharePage.body': "Learning is easier with company. Send CantoBuddy to a friend — it's free for helpers, always.",
    'sharePage.previewLabel': 'What your friend will see',
    'sharePage.shareBtn': 'Share CantoBuddy',
    'sharePage.copyBtn': '🔗 Copy link',
    'sharePage.whatsappBtn': 'Send on WhatsApp',
    'sharePage.footnote': 'Every link you share carries your own code, so we can see how CantoBuddy is spreading through the community. No names, no personal details.',
    'sharePage.copied': 'Link copied!',
    'sharePage.copyFailed': 'Could not copy the link.',
    'sharePage.message': "I'm learning Cantonese with CantoBuddy — free, and made for helpers in Hong Kong. Try it!",

    // connecting to an employer (invitation link)
    'connect.title': 'Connect to {name}?',
    'connect.see': '{name} will be able to see your CantoBuddy practice — your quiz scores and progress. Nothing else.',
    'connect.yourName': 'Your name',
    'connect.nameHint': 'The name your employer will see.',
    'connect.notNow': 'Not now',
    'connect.connect': 'Connect',
    'connect.connecting': 'Connecting…',
    'connect.doneTitle': "You're connected 🎉",
    'connect.doneBody': '{name} can now see your practice. You can stop sharing any time.',
    'connect.doneBtn': 'Start learning',
    'connect.invalid': 'This invitation link is not valid or has expired.',
    'connect.failed': 'Could not connect. Please try again.',

    // who can see my progress
    'sharing.title': 'Who can see my progress',
    'sharing.hint': 'These people can see your quiz scores. You can stop sharing at any time — your progress always stays with you.',
    'sharing.none': 'Nobody can see your progress. Only you.',
    'sharing.since': 'Connected',
    'sharing.stop': 'Stop sharing',
    'sharing.stopped': 'Stopped sharing',
    'sharing.failed': 'Could not update. Please try again.',
    'sharing.enterCode': 'Have a code from your employer?',

    // rewards: credits and the sticker album
    'rewards.title': 'My Stickers',
    'rewards.hint': 'You earn 1 credit for every correct answer. Reach a sticker\'s number and it is yours.',
    'rewards.credits': 'credits',
    'rewards.creditOne': 'credit',
    'rewards.next': 'Next sticker',
    'rewards.toGo': 'to go',
    'rewards.locked': 'Locked',
    'rewards.complete': 'You collected the whole album! 🏆',
    'rewards.newTitle': 'New sticker!',
    'rewards.newBody': 'You earned {name}',
    'rewards.newBodyMany': 'You earned {n} new stickers!',
    'rewards.viewAlbum': 'See my album',
    'rewards.notYet': 'Not collected yet',

    // connecting with a code instead of a link
    'connect.enterCode': 'Enter a code',
    'connect.codeTitle': 'Connect to your employer',
    'connect.codeHint': 'Type the code your employer gave you.',
    'connect.codeLabel': 'Employer code',
    'connect.codePlaceholder': 'e.g. 4GTBVT6R',
    'connect.codeSubmit': 'Connect',
    'connect.codeChecking': 'Checking…',
    'connect.codeNotFound': 'That code was not found. Please check it and try again.',

    // misc
    'misc.close': 'Close',
    'misc.loadFailed': 'Could not load data. Is the server running?',
    'misc.shareWord': 'Share this word',
    'misc.shareCard': 'Share as a picture',

    // footer — the crawlable links to the server-rendered vocabulary pages
    // (see seo.js). Real anchors, not JS navigation, so a crawler can follow
    // them into the content layer.
    'footer.title': 'Browse Cantonese vocabulary',
    'footer.allWords': 'All words & categories',
    'footer.filipino': 'Filipino',
  },

  fil: {
    // nav / header
    'nav.home': 'Simula',
    'nav.learn': 'Mag-aral',
    'nav.quiz': 'Pagsusulit',
    'nav.progress': 'Progreso',
    'nav.share': 'Ibahagi',
    'header.setName': 'Ilagay ang pangalan',
    'header.voiceTitle': 'Pumili ng boses',
    'header.langTitle': 'Palitan ang wika',
    'header.langSwitchEn': 'Palitan sa Ingles',
    'header.langSwitchFil': 'Palitan sa Filipino',
    'header.employerSite': 'Para sa employer',
    'header.learnerSite': 'App ng mag-aaral',
    'header.shareSite': 'Ibahagi ang CantoBuddy',

    // home
    'home.title': 'Mag-aral ng Cantonese',
    'home.subtitle': 'para sa araw-araw na buhay sa Hong Kong',
    'home.desc': 'Mga praktikal na salita at parirala na may audio, larawan, at pagsusulit. Magsimula sa iyong antas!',
    'home.beginner': 'Baguhan',
    'home.intermediate': 'Katamtaman',
    'home.advanced': 'Mahusay',
    'home.beginnerDesc': 'Mga basic na pagbati at karaniwang salita',
    'home.intermediateDesc': 'Mga pang-araw-araw na gawain',
    'home.advancedDesc': 'Mga buong pangungusap at parirala',
    'home.startQuiz': '📝 Simulan ang Pagsusulit',
    'home.myProgress': '📊 Aking Progreso',
    'home.browseByCategory': 'Tingnan ayon sa Kategorya',

    // browse
    'browse.backHome': '← Simula',
    'browse.title': 'Bokabularyo',
    'browse.level': 'Antas:',
    'browse.category': 'Kategorya:',
    'browse.all': 'Lahat',
    'browse.allLevels': 'Lahat ng Antas',
    'browse.empty': 'Walang nahanap na salita.',
    'browse.tapToHear': 'I-tap para marinig ang bigkas',

    // quiz setup
    'quiz.title': 'Oras ng Pagsusulit!',
    'quiz.chooseLevel': 'Piliin ang Antas',
    'quiz.chooseType': 'Piliin ang Uri ng Pagsusulit',
    'quiz.tMultipleChoice': 'Maramihang Pagpipilian',
    'quiz.dMultipleChoice': 'Tingnan ang Cantonese, piliin ang kahulugan',
    'quiz.tListenChoose': 'Makinig at Pumili',
    'quiz.dListenChoose': 'Pakinggan ang audio, piliin ang tamang kahulugan',
    'quiz.tMatchPicture': 'Itugma ang Larawan',
    'quiz.dMatchPicture': 'Tingnan ang larawan, itugma ang salitang Cantonese',
    'quiz.tFillBlank': 'Punan ang Patlang',
    'quiz.dFillBlank': 'Kumpletuhin ang pangungusap ng tamang salita',

    // quiz play
    'quiz.quit': '← Umalis',
    'quiz.questionOf': 'T',
    'quiz.score': 'Puntos:',
    'quiz.tapSpeaker': 'I-tap ang speaker para makinig',
    'quiz.promptMeaning': 'Ano ang ibig sabihin nito?',
    'quiz.promptListen': 'Makinig at piliin ang tamang kahulugan',
    'quiz.promptMatch': 'Aling salitang Cantonese ang tumutugma sa larawan?',
    'quiz.promptFill': 'Punan ang patlang ng tamang salita',
    'quiz.correct': '✅ Tama!',
    'quiz.answerIs': '❌ Sagot:',
    'quiz.next': 'Susunod →',
    'quiz.seeResults': 'Tingnan ang Resulta 🎉',
    'quiz.notEnough': 'Kulang ang mga salita sa antas na ito. Subukan ang ibang antas.',

    // results
    'result.complete': 'Tapos na ang Pagsusulit!',
    'result.percentCorrect': '% tama',
    'result.tryAgain': 'Subukan Muli',
    'result.done': 'Tapos',
    'result.share': 'Ibahagi ang puntos',

    // progress
    'progress.title': 'Aking Progreso',
    'progress.setNameFirst': 'Itakda muna ang iyong pangalan! I-tap ang "Ilagay ang pangalan" sa itaas.',
    'progress.none': 'Wala pang pagsubok. Subukan ang iyong unang pagsusulit! 📝',
    'progress.overall': 'Kabuuang Puntos',
    'progress.byLevel': 'Ayon sa Antas',
    'progress.recent': 'Mga Huling Pagsubok',
    'progress.correctOutOf': 'tama sa',
    'progress.attempts': 'pagsubok',
    'progress.couldNotLoad': 'Hindi ma-load ang progreso.',
    'progress.partial': 'Hindi kumpleto',
    'progress.stoppedAt': 'Huminto sa',

    // statistics — her own numbers, shown inside My Progress
    'stats.title': 'Iyong estadistika',
    'stats.none': 'Tapusin ang isang pagsusulit at lalabas dito ang iyong estadistika.',
    'stats.streak': 'Sunod-sunod na araw',
    'stats.streakNone': 'Hindi pa nagsisimula',
    'stats.dayOne': 'araw',
    'stats.days': 'araw',
    'stats.inARow': 'na sunod-sunod',
    'stats.practisedToday': 'Nagsanay ka ngayon — ituloy mo!',
    'stats.practiseToday': 'Magsanay ngayon para tuloy ang sunod-sunod',
    'stats.best': 'Pinakamahaba',
    'stats.daysPractised': 'Mga araw ng pagsasanay',
    'stats.thisWeek': 'Ngayong linggo',
    'stats.lastWeek': 'Nakaraang linggo',
    'stats.attemptOne': 'pagsubok',
    'stats.attempts': 'pagsubok',
    'stats.correctPct': '{n}% tama',
    'stats.nothingLastWeek': 'Walang pagsasanay noong nakaraang linggo',
    'stats.overTime': 'Pagsasanay sa paglipas ng panahon',
    'stats.range7': '7 araw',
    'stats.range30': '30 araw',
    'stats.range90': '90 araw',
    'stats.byQuizType': 'Paano ka nagsasanay',
    'stats.chartHint': 'Bawat bar ay isang araw',

    // name modal
    'name.title': 'Iyong Pangalan',
    'name.hint': 'Ilagay ang iyong pangalan para ma-save ang iyong mga puntos.',
    'name.placeholder': 'hal. Maria',
    'name.cancel': 'Kanselahin',
    'name.save': 'I-save',
    'name.notSaved': 'Hinaharang ng browser mo ang pag-save ng data, kaya maaaring hindi maalala ang pangalan mo. Subukan ang normal na window, hindi private browsing.',

    // voice modal
    'voice.title': '🎙️ Pumili ng Boses',
    'voice.hint': 'I-tap ang boses para marinig ang 你好 — pumili ng boses ng babae o lalaki, mabagal o natural.',
    'voice.woman': 'Babae',
    'voice.man': 'Lalaki',
    'voice.slow': 'Mabagal at Malinaw',
    'voice.natural': 'Natural',
    'voice.realVoice': 'tunay na boses',
    'voice.allOnDevice': 'Lahat ng boses sa device na ito',
    'voice.female': 'Babae',
    'voice.male': 'Lalaki',
    'voice.unknown': 'Hindi alam',
    'voice.done': 'Tapos',
    'voice.loading': 'Naglo-load ng mga boses…',
    'voice.noChinese': '⚠️ Walang Chinese na boses sa device na ito. Mag-install sa settings ng iyong phone o PC.',
    'voice.bothFound': '✓ May tunay na boses ng lalaki at babae — direktang ginagamit ang mga ito.',
    'voice.maleOnly': 'ℹ️ May tunay na boses ng lalaki, pero walang babae — pitch ang ginagamit sa Babae.',
    'voice.femaleOnly': '⚠️ Babaeng boses lang ang naka-install, kaya maaaring parang babae pa rin ang Lalaki. Pumili ng boses ng lalaki sa ibaba, o gamitin ang Microsoft Edge.',
    'voice.noGender': 'ℹ️ May mga boses, pero hindi matukoy ang kasarian — pitch ang gumagawa ng Lalaki/Babae. Pumili ng partikular na boses sa ibaba.',
    'voice.noAudio': '⚠️ Hindi makapagpatugtog ng audio ang browser na ito. Subukan ang Chrome, Edge o Safari.',

    // share
    'share.wordText': 'Mag-aral ng Cantonese sa CantoBuddy',
    'share.scoreText': 'Nakakuha ako ng {score}/{total} sa CantoBuddy! 🇭🇰',
    'share.copied': 'Nakopya sa clipboard!',
    'share.failed': 'Hindi maibahagi.',
    'share.cardSaved': 'Nai-save ang larawan — i-paste kahit saan!',
    'share.cardFooter': 'Libreng Cantonese practice para sa mga helper sa Hong Kong',

    // share page — inviting a friend to the app
    'sharePage.title': 'Ibahagi ang CantoBuddy',
    'sharePage.hero': 'Sabihan ang kaibigan',
    'sharePage.body': 'Mas masaya mag-aral kapag may kasama. Ipadala ang CantoBuddy sa kaibigan — libre ito para sa mga katulong, habang-buhay.',
    'sharePage.previewLabel': 'Ang makikita ng kaibigan mo',
    'sharePage.shareBtn': 'Ibahagi ang CantoBuddy',
    'sharePage.copyBtn': '🔗 Kopyahin ang link',
    'sharePage.whatsappBtn': 'Ipadala sa WhatsApp',
    'sharePage.footnote': 'Ang bawat link na ibinabahagi mo ay may sarili mong code, para makita namin kung paano kumakalat ang CantoBuddy sa komunidad. Walang pangalan, walang personal na detalye.',
    'sharePage.copied': 'Nakopya ang link!',
    'sharePage.copyFailed': 'Hindi makopya ang link.',
    'sharePage.message': 'Nag-aaral ako ng Cantonese sa CantoBuddy — libre, at para sa mga katulong sa Hong Kong. Subukan mo!',

    // connecting to an employer (invitation link)
    'connect.title': 'Kumonekta kay {name}?',
    'connect.see': 'Makikita ni {name} ang iyong pagsasanay sa CantoBuddy — ang iyong mga puntos at progreso. Wala nang iba.',
    'connect.yourName': 'Iyong pangalan',
    'connect.nameHint': 'Ang pangalang makikita ng iyong employer.',
    'connect.notNow': 'Mamaya na',
    'connect.connect': 'Kumonekta',
    'connect.connecting': 'Kumokonekta…',
    'connect.doneTitle': 'Konektado ka na 🎉',
    'connect.doneBody': 'Makikita na ni {name} ang iyong pagsasanay. Maaari mong itigil ang pagbabahagi anumang oras.',
    'connect.doneBtn': 'Magsimula',
    'connect.invalid': 'Hindi wasto o lipas na ang link na ito.',
    'connect.failed': 'Hindi makakonekta. Subukan muli.',

    // who can see my progress
    'sharing.title': 'Sino ang nakakakita ng progreso ko',
    'sharing.hint': 'Nakikita ng mga taong ito ang iyong mga puntos. Maaari mong itigil ang pagbabahagi anumang oras — mananatili sa iyo ang progreso mo.',
    'sharing.none': 'Walang nakakakita ng progreso mo. Ikaw lang.',
    'sharing.since': 'Konektado',
    'sharing.stop': 'Itigil ang pagbabahagi',
    'sharing.stopped': 'Itinigil ang pagbabahagi',
    'sharing.failed': 'Hindi ma-update. Subukan muli.',
    'sharing.enterCode': 'May code ka ba mula sa employer mo?',

    // rewards: credits and the sticker album
    'rewards.title': 'Aking mga Sticker',
    'rewards.hint': 'May 1 credit ka sa bawat tamang sagot. Abutin ang numero ng sticker at sa iyo na ito.',
    'rewards.credits': 'credits',
    'rewards.creditOne': 'credit',
    'rewards.next': 'Susunod na sticker',
    'rewards.toGo': 'pa',
    'rewards.locked': 'Naka-lock',
    'rewards.complete': 'Nakuha mo na ang buong album! 🏆',
    'rewards.newTitle': 'Bagong sticker!',
    'rewards.newBody': 'Nakuha mo ang {name}',
    'rewards.newBodyMany': 'Nakakuha ka ng {n} bagong sticker!',
    'rewards.viewAlbum': 'Tingnan ang album ko',
    'rewards.notYet': 'Wala pa',

    // connecting with a code instead of a link
    'connect.enterCode': 'Maglagay ng code',
    'connect.codeTitle': 'Kumonekta sa employer mo',
    'connect.codeHint': 'I-type ang code na ibinigay ng employer mo.',
    'connect.codeLabel': 'Code ng employer',
    'connect.codePlaceholder': 'hal. 4GTBVT6R',
    'connect.codeSubmit': 'Kumonekta',
    'connect.codeChecking': 'Sinusuri…',
    'connect.codeNotFound': 'Hindi mahanap ang code. Pakisuri at subukan muli.',

    // misc
    'misc.close': 'Isara',
    'misc.loadFailed': 'Hindi ma-load ang data. Gumagana ba ang server?',
    'misc.shareWord': 'Ibahagi ang salitang ito',
    'misc.shareCard': 'Ibahagi bilang larawan',

    // footer — the crawlable links to the server-rendered vocabulary pages
    // (see seo.js).
    'footer.title': 'Tingnan ang bokabularyong Cantonese',
    'footer.allWords': 'Lahat ng salita at kategorya',
    'footer.filipino': 'Filipino',
  },

  /* Simplified Chinese, for learners who arrived from the mainland and already
     speak Mandarin.

     Written as a functional translation with a few deliberate choices:
       - 「粤语」 for Cantonese, not 「广东话」. Both are understood, but 粤语 is the
         term used in language-learning contexts, which is where this reader is.
       - 「菲佣」 is avoided entirely despite being the common Hong Kong shorthand;
         it is dismissive, and this screen is also read by the helpers themselves
         when they switch language. 「外佣」/「家庭助理」 is used instead.
       - Short, verb-first labels, matching the terse English rather than
         translating its politeness. Chinese UI text that mirrors English
         sentence structure reads as machine-translated. */
  zh: {
    // nav / header
    'nav.home': '首页',
    'nav.learn': '学习',
    'nav.quiz': '测验',
    'nav.progress': '进度',
    'nav.share': '分享',
    'header.setName': '设置姓名',
    'header.voiceTitle': '选择练习语音',
    'header.langTitle': '切换语言',
    'header.langSwitchEn': '切换到英文',
    'header.langSwitchFil': '切换到菲律宾语',
    'header.langSwitchZh': '切换到简体中文',
    'header.employerSite': '雇主入口',
    'header.learnerSite': '学习版',
    'header.shareSite': '分享 CantoBuddy',

    // home
    'home.title': '学粤语',
    'home.subtitle': '香港日常生活用语',
    'home.desc': '实用的词和句子，配有发音、图片和测验。从你的水平开始！',
    'home.beginner': '入门',
    'home.intermediate': '中级',
    'home.advanced': '进阶',
    'home.beginnerDesc': '基本问候和常用词',
    'home.intermediateDesc': '日常活动和习惯',
    'home.advancedDesc': '完整句子和短语',
    'home.startQuiz': '📝 开始测验',
    'home.myProgress': '📊 我的进度',
    'home.browseByCategory': '按类别浏览',

    // browse
    'browse.backHome': '← 首页',
    'browse.title': '词汇',
    'browse.level': '水平：',
    'browse.category': '类别：',
    'browse.all': '全部',
    'browse.allLevels': '全部水平',
    'browse.empty': '这个筛选条件下没有找到词。',
    'browse.tapToHear': '点按听发音',

    // quiz setup
    'quiz.title': '开始测验！',
    'quiz.chooseLevel': '选择水平',
    'quiz.chooseType': '选择测验类型',
    'quiz.tMultipleChoice': '选择题',
    'quiz.dMultipleChoice': '看粤语，选中文意思',
    'quiz.tListenChoose': '听音选择',
    'quiz.dListenChoose': '听发音，选正确的意思',
    'quiz.tMatchPicture': '看图配对',
    'quiz.dMatchPicture': '看图片，选出对应的粤语词',
    'quiz.tFillBlank': '填空',
    'quiz.dFillBlank': '用正确的词补全句子',

    // quiz play
    'quiz.quit': '← 退出',
    'quiz.questionOf': '第',
    'quiz.score': '得分：',
    'quiz.tapSpeaker': '点喇叭听发音',
    'quiz.promptMeaning': '这是什么意思？',
    'quiz.promptListen': '听录音，选出正确的意思',
    'quiz.promptMatch': '哪个粤语词对应这张图片？',
    'quiz.promptFill': '用正确的词填空',
    'quiz.correct': '✅ 答对了！',
    'quiz.answerIs': '❌ 答案：',
    'quiz.next': '下一题 →',
    'quiz.seeResults': '查看结果 🎉',
    'quiz.notEnough': '这个水平的词不够做测验，换一个水平试试。',

    // results
    'result.complete': '测验完成！',
    'result.percentCorrect': '% 正确',
    'result.tryAgain': '再试一次',
    'result.done': '完成',
    'result.share': '分享我的成绩',

    // progress
    'progress.title': '我的进度',
    'progress.setNameFirst': '先设置姓名才能记录进度！点顶部的「设置姓名」。',
    'progress.none': '还没有测验记录。开始第一次测验吧！📝',
    'progress.overall': '总得分',
    'progress.byLevel': '按水平',
    'progress.recent': '最近的测验',
    'progress.correctOutOf': '正确，共',
    'progress.attempts': '次测验',
    'progress.couldNotLoad': '无法加载进度。',
    'progress.partial': '未完成',
    'progress.stoppedAt': '中止于',

    // statistics — her own numbers, shown inside My Progress
    'stats.title': '我的统计',
    'stats.none': '完成一次测验后，这里会显示你的统计。',
    'stats.streak': '连续练习',
    'stats.streakNone': '还没开始',
    'stats.dayOne': '天',
    'stats.days': '天',
    'stats.inARow': '连续',
    'stats.practisedToday': '今天练习了 — 继续保持！',
    'stats.practiseToday': '今天练一练，别断了连续记录',
    'stats.best': '最长',
    'stats.daysPractised': '练习天数',
    'stats.thisWeek': '本周',
    'stats.lastWeek': '上周',
    'stats.attemptOne': '次',
    'stats.attempts': '次',
    'stats.correctPct': '{n}% 正确',
    'stats.nothingLastWeek': '上周没有练习',
    'stats.overTime': '练习趋势',
    'stats.range7': '7 天',
    'stats.range30': '30 天',
    'stats.range90': '90 天',
    'stats.byQuizType': '你的练习方式',
    'stats.chartHint': '每根柱子代表一天',

    // name modal
    'name.title': '你的姓名',
    'name.hint': '输入姓名，你的测验成绩才能保存。',
    'name.placeholder': '例如：小明',
    'name.cancel': '取消',
    'name.save': '保存',
    'name.notSaved': '浏览器阻止了本地存储，姓名可能无法记住。请用普通窗口，不要用无痕浏览。',

    // voice modal
    'voice.title': '🎙️ 选择练习语音',
    'voice.hint': '点一个语音听 你好 — 可选女声或男声，慢速或自然。',
    'voice.woman': '女声',
    'voice.man': '男声',
    'voice.slow': '慢速清晰',
    'voice.natural': '自然',
    'voice.realVoice': '真实语音',
    'voice.allOnDevice': '本设备上的所有语音',
    'voice.female': '女声',
    'voice.male': '男声',
    'voice.unknown': '未知',
    'voice.done': '完成',
    'voice.loading': '正在加载语音…',
    'voice.noChinese': '⚠️ 本设备没有中文语音。请在手机或电脑设置里安装。',
    'voice.bothFound': '✓ 找到真实的男女中文语音 — 直接使用。',
    'voice.maleOnly': 'ℹ️ 找到真实男声，但没有女声 — 女声使用变调处理。',
    'voice.femaleOnly': '⚠️ 只安装了女声，男声可能听起来还是女声。请在下面选一个男声，或用 Microsoft Edge。',
    'voice.noGender': 'ℹ️ 找到语音，但无法判断性别 — 男声/女声由变调生成。如果哪个人声更合适，请在下面选择。',
    'voice.noAudio': '⚠️ 这个浏览器无法播放音频。请用 Chrome、Edge 或 Safari。',

    // share
    'share.wordText': '用 CantoBuddy 学粤语',
    'share.scoreText': '我在 CantoBuddy 拿了 {score}/{total} 分！🇭🇰',
    'share.copied': '已复制到剪贴板！',
    'share.failed': '分享失败。',
    'share.cardSaved': '图片已保存 — 可粘贴到任何地方！',
    'share.cardFooter': '香港外佣和外籍家庭助理的免费粤语练习',

    // share page — inviting a friend to the app
    'sharePage.title': '分享 CantoBuddy',
    'sharePage.hero': '告诉朋友',
    'sharePage.body': '有人一起学更容易坚持。把 CantoBuddy 发给朋友 — 对所有学习者永久免费。',
    'sharePage.previewLabel': '你朋友会看到',
    'sharePage.shareBtn': '分享 CantoBuddy',
    'sharePage.copyBtn': '🔗 复制链接',
    'sharePage.whatsappBtn': '用 WhatsApp 发送',
    'sharePage.footnote': '你分享的每个链接都带着你自己的代码，这样我们可以看到 CantoBuddy 怎样在社区里传播。不记录姓名，不记录个人信息。',
    'sharePage.copied': '链接已复制！',
    'sharePage.copyFailed': '无法复制链接。',
    'sharePage.message': '我在用 CantoBuddy 学粤语 — 免费，专门为在香港生活的人做的。你也试试！',

    // connecting to an employer (invitation link)
    'connect.title': '连接到 {name}？',
    'connect.see': '{name} 可以看到你在 CantoBuddy 的练习 — 你的测验成绩和进度，仅此而已。',
    'connect.yourName': '你的姓名',
    'connect.nameHint': '雇主会看到的姓名。',
    'connect.notNow': '以后再说',
    'connect.connect': '连接',
    'connect.connecting': '正在连接…',
    'connect.doneTitle': '已连接 🎉',
    'connect.doneBody': '{name} 现在可以看到你的练习了。你随时可以停止分享。',
    'connect.doneBtn': '开始学习',
    'connect.invalid': '这个邀请链接无效或已过期。',
    'connect.failed': '连接失败，请重试。',

    // who can see my progress
    'sharing.title': '谁能看到我的进度',
    'sharing.hint': '这些人可以看到你的测验成绩。你随时可以停止分享 — 你的进度始终属于你。',
    'sharing.none': '没有人能看到你的进度，只有你自己。',
    'sharing.since': '已连接',
    'sharing.stop': '停止分享',
    'sharing.stopped': '已停止分享',
    'sharing.failed': '更新失败，请重试。',
    'sharing.enterCode': '有雇主给你的代码吗？',

    // rewards: credits and the sticker album
    'rewards.title': '我的贴纸',
    'rewards.hint': '每答对一题得 1 分。攒到贴纸所需的分数，它就是你的了。',
    'rewards.credits': '分',
    'rewards.creditOne': '分',
    'rewards.next': '下一张贴纸',
    'rewards.toGo': '还差',
    'rewards.locked': '未解锁',
    'rewards.complete': '你集齐了整本贴纸！🏆',
    'rewards.newTitle': '新贴纸！',
    'rewards.newBody': '你获得了 {name}',
    'rewards.newBodyMany': '你获得了 {n} 张新贴纸！',
    'rewards.viewAlbum': '看我的贴纸册',
    'rewards.notYet': '还没收集',

    // connecting with a code instead of a link
    'connect.enterCode': '输入代码',
    'connect.codeTitle': '连接到你的雇主',
    'connect.codeHint': '输入雇主给你的代码。',
    'connect.codeLabel': '雇主代码',
    'connect.codePlaceholder': '例如：4GTBVT6R',
    'connect.codeSubmit': '连接',
    'connect.codeChecking': '正在检查…',
    'connect.codeNotFound': '找不到这个代码，请检查后重试。',

    // misc
    'misc.close': '关闭',
    'misc.loadFailed': '无法加载数据。服务器在运行吗？',
    'misc.shareWord': '分享这个词',
    'misc.shareCard': '存成图片分享',

    // footer — the crawlable links to the server-rendered vocabulary pages
    // (see seo.js).
    'footer.title': '浏览粤语词汇',
    'footer.allWords': '所有词和类别',
    'footer.filipino': '菲律宾语',
    'footer.mandarin': '中文版',
  },
};

let _lang = localStorage.getItem(LANG_STORAGE_KEY) || 'en';
if (!LANG_CODES.includes(_lang)) _lang = 'en';

/** Translate a key. Falls back to English, then to the key itself. */
function t(key) {
  if (I18N[_lang] && I18N[_lang][key] != null) return I18N[_lang][key];
  if (I18N.en[key] != null) return I18N.en[key];
  return key;
}

function currentLang() {
  return _lang;
}

/** The <html lang> value for the language being read. */
function currentHtmlLang() {
  const l = LANGS.find((x) => x.code === _lang);
  return l ? l.html : 'en';
}

/** Label for a difficulty level (1-3) or 0 for "all". */
function levelLabel(level) {
  if (level === 0) return t('browse.allLevels');
  return [null, t('home.beginner'), t('home.intermediate'), t('home.advanced')][level] || '';
}

/**
 * Category display name in the current language.
 *
 * Falls back to English rather than showing nothing, which is the same rule the
 * vocabulary meanings follow — an untranslated category must still render a
 * word the learner can recognise, and English is the one she is most likely to
 * have some of.
 *
 * `name_yue` is deliberately NEVER used as the zh label. It holds the Cantonese
 * name in Traditional characters (長者照顧, 食藥覆診) — parseable by a Mandarin
 * reader but the wrong register and the wrong script for this audience. The zh
 * label comes from `name_zh`, which is Simplified Mandarin (照顾老人, 吃药复诊).
 */
function categoryLabel(cat) {
  if (!cat) return '';
  if (_lang === 'fil' && cat.name_fil) return cat.name_fil;
  if (_lang === 'zh' && cat.name_zh) return cat.name_zh;
  return cat.name_en;
}

/** Apply translations to any element carrying a data-i18n attribute. */
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const attr = el.dataset.i18nAttr;
    if (attr) el.setAttribute(attr, t(key));
    else el.textContent = t(key);
    // Icon-only controls carry no visible text, so mirror the same string into
    // aria-label — otherwise screen readers announce a bare emoji.
    if (el.dataset.i18nAria) el.setAttribute('aria-label', t(key));
  });
  document.documentElement.lang = currentHtmlLang();
  updateLangButton();
}

/**
 * The language control.
 *
 * It CYCLEs rather than toggles now that there are three languages. A toggle
 * only works for two: with three you would need two buttons, or a button whose
 * meaning depends on where you happen to be in the cycle. One button that
 * advances is the smallest control that stays honest.
 *
 * The label shows the language being READ (not the next one). With two
 * languages the switch-to convention was fine; with three it is genuinely
 * confusing, because "中文" on an English screen could mean either "you are
 * reading Chinese" or "press for Chinese". Showing the current state and
 * letting the control advance is unambiguous.
 */
function updateLangButton() {
  const btn = document.getElementById('lang-btn');
  if (!btn) return;
  const cur = LANGS.find((l) => l.code === _lang) || LANGS[0];
  btn.textContent = cur.label;
  btn.title = `${t('header.langTitle')} — ${cur.name}`;
  btn.setAttribute('aria-label', btn.title);
  // One button, three languages: a MENU is the honest control, and the app
  // already has a modal pattern for this. Long-press / right-click opens it.
  btn.dataset.menu = '1';
}

function setLang(lang) {
  _lang = LANG_CODES.includes(lang) ? lang : 'en';
  localStorage.setItem(LANG_STORAGE_KEY, _lang);
  applyTranslations();
  if (typeof rerenderForLanguage === 'function') rerenderForLanguage();
}

/** Advance to the next language in the cycle. */
function toggleLang() {
  const i = LANG_CODES.indexOf(_lang);
  setLang(LANG_CODES[(i + 1) % LANG_CODES.length]);
}

/** Every language, for the picker. */
function allLangs() {
  return LANGS.slice();
}
