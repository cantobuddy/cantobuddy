/* =============================================================================
   CantoBuddy — Internationalisation (English / Filipino)
   Loaded before app.js. Exposes t(), setLang(), toggleLang(), applyTranslations().
   ============================================================================= */

const LANG_STORAGE_KEY = 'cb_lang';

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

    // share page — inviting a friend to the app
    'sharePage.title': 'Share CantoBuddy',
    'sharePage.hero': 'Tell a friend',
    'sharePage.body': "Learning is easier with company. Send CantoBuddy to a friend — it's free for helpers, always.",
    'sharePage.previewLabel': 'What your friend will see',
    'sharePage.shareBtn': 'Share CantoBuddy',
    'sharePage.copyBtn': '🔗 Copy link',
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

    // share page — inviting a friend to the app
    'sharePage.title': 'Ibahagi ang CantoBuddy',
    'sharePage.hero': 'Sabihan ang kaibigan',
    'sharePage.body': 'Mas masaya mag-aral kapag may kasama. Ipadala ang CantoBuddy sa kaibigan — libre ito para sa mga katulong, habang-buhay.',
    'sharePage.previewLabel': 'Ang makikita ng kaibigan mo',
    'sharePage.shareBtn': 'Ibahagi ang CantoBuddy',
    'sharePage.copyBtn': '🔗 Kopyahin ang link',
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
  },
};

let _lang = localStorage.getItem(LANG_STORAGE_KEY) || 'en';

/** Translate a key. Falls back to English, then to the key itself. */
function t(key) {
  if (I18N[_lang] && I18N[_lang][key] != null) return I18N[_lang][key];
  if (I18N.en[key] != null) return I18N.en[key];
  return key;
}

function currentLang() {
  return _lang;
}

/** Label for a difficulty level (1-3) or 0 for "all". */
function levelLabel(level) {
  if (level === 0) return t('browse.allLevels');
  return [null, t('home.beginner'), t('home.intermediate'), t('home.advanced')][level] || '';
}

/** Category display name in the current language (falls back to English). */
function categoryLabel(cat) {
  if (!cat) return '';
  if (_lang === 'fil' && cat.name_fil) return cat.name_fil;
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
  document.documentElement.lang = _lang === 'fil' ? 'tl' : 'en';
  updateLangButton();
}

function updateLangButton() {
  const btn = document.getElementById('lang-btn');
  if (!btn) return;
  // The button shows the language you would switch TO, not the one you are
  // reading: while the app is in English it reads "FIL", and while it is in
  // Filipino it reads "EN". So it is a label for the *action*, not the state.
  const next = _lang === 'fil' ? 'en' : 'fil';
  btn.textContent = next === 'fil' ? 'FIL' : 'EN';
  btn.title = t(next === 'fil' ? 'header.langSwitchFil' : 'header.langSwitchEn');
  btn.setAttribute('aria-label', btn.title);
}

function setLang(lang) {
  _lang = lang === 'fil' ? 'fil' : 'en';
  localStorage.setItem(LANG_STORAGE_KEY, _lang);
  applyTranslations();
  if (typeof rerenderForLanguage === 'function') rerenderForLanguage();
}

function toggleLang() {
  setLang(_lang === 'en' ? 'fil' : 'en');
}
