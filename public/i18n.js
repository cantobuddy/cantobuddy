/* =============================================================================
   CantoBuddy — Internationalisation (English / Filipino / 简体中文 / Bahasa Indonesia)
   Loaded before app.js. Exposes t(), setLang(), toggleLang(), applyTranslations().
   ============================================================================= */

const LANG_STORAGE_KEY = 'cb_lang';

/* The four languages the app can be read in.

   `zh` is written 中文 on the control and means Simplified Chinese. The name
   matters: this is not a translation of the interface for Chinese speakers, it
   is a second audience — people who came to Hong Kong from the mainland and
   already speak Mandarin. They are learning Cantonese for a different reason
   than the Filipino helpers the app was built for: the helper needs to
   understand her employer, the new arrival needs to be understood at the market
   and the clinic. The words overlap; the priorities do not.

   `id` is Bahasa Indonesia, for the Indonesian domestic-helper audience — the
   other large group in Hong Kong, and the reason this app is not only for
   Filipino helpers.

   `html` is what goes in the document's lang attribute. */
const LANGS = [
  { code: 'en', label: 'EN',  name: 'English',  html: 'en' },
  { code: 'fil', label: 'FIL', name: 'Filipino', html: 'tl' },
  { code: 'zh', label: '中文', name: '简体中文', html: 'zh-Hans' },
  { code: 'id', label: 'ID',  name: 'Bahasa Indonesia', html: 'id' },
];
const LANG_CODES = LANGS.map((l) => l.code);

const I18N = {
  en: {
    // nav / header
    'nav.home': 'Home',
    'nav.learn': 'Learn',
    'nav.quiz': 'Quiz',
    'nav.progress': 'Progress',
    'nav.feedback': 'Feedback',
    'nav.share': 'Share',
    'nav.discover': 'Discover',

    // discover — the culture + news feed
    'discover.title': 'Discover: HK life, news & stories from home',
    'discover.lead': 'Hong Kong life, news from the Philippines and Indonesia, and stories written by helpers.',
    // The Categories page — the Learn tab's destination. `{n}` is the number of
    // categories and `{w}` the number of words behind them.
    'categories.backHome': '← Home',
    'categories.title': 'Categories',
    'categories.lead': '{n} categories, {w} words. Pick where you want to start.',
    'categories.words': '{n} words',
    'discover.tabCulture': 'Culture',
    'discover.tabNews': 'News',
    'discover.cultureLead': 'How things work in a Hong Kong home — the customs nobody explains.',
    'discover.newsLead': 'News from the Philippines, Indonesia and Hong Kong, in English, with a link to each original.',
    'discover.empty': 'Nothing here yet — check back soon.',
    'discover.loadFailed': 'Could not load this. Please try again.',
    'discover.readMore': 'Read',
    'discover.back': '← Discover',
    'discover.source': 'Source',
    'discover.readOriginal': 'Read the full story',
    'discover.notFound': 'That article is not available.',
    'discover.newsNote': 'Headlines and short summaries from Philippine, Indonesian and Hong Kong sources. The full story is at the link.',
    // News categories. The chips narrow the News channel to one topic, because
    // the channel grows without bound and a helper should not have to scroll to
    // find what she came for. Labels are per language on purpose — these are
    // topic names a reader chooses by, not untranslated interface furniture.
    'discover.filterLabel': 'Show only',
    'discover.regionLabel': 'News from',
    'discover.regionAll': 'Everywhere',
    'discover.regionPh': 'Philippines',
    'discover.regionId': 'Indonesia',
    'discover.catAll': 'All news',
    'discover.catHongkong': 'Hong Kong',
    'discover.catWork': 'Work & your rights',
    'discover.catMoney': 'Money & prices',
    'discover.catHealth': 'Health',
    'discover.catHome': 'Home & family',
    'discover.catPolitics': 'Government',
    'discover.catOther': 'Other news',
    // The pager. `%s` is the number of items still hidden.
    'discover.showMore': 'Show more (%s)',
    'discover.showAll': 'Show everything',
    'discover.allShown': 'That is everything.',
    // Stories — a helper's own life story. It lives INSIDE Discover, beside
    // Culture and News, because a story is a thing to read like any other, and
    // because a seventh bottom-nav tab does not fit a 320px phone.
    'discover.tabStories': 'Stories',
    'discover.storiesLead': 'Real stories written by helpers, in their own language — daily life, home, and what happened along the way.',
    'discover.storiesEmpty': 'No stories have been published yet. Yours could be the first.',
    'discover.storiesLoadFailed': 'Could not load the stories. Please try again.',
    'story.back': '← Stories',
    'story.langLabel': 'What language is your story in?',
    'story.shareYours': 'Share your story',
    'story.introTitle': 'Tell your story',
    'story.introBody': 'Your daily life, where you come from, or something that happened to you. Write it in your own language — it does not have to be in English.',
    'story.introRule': 'We read every story before it appears. It is published with your name only if you ask us to.',
    'story.titleLabel': 'Title',
    'story.titlePlaceholder': 'A few words about your story',
    'story.bodyLabel': 'Your story',
    'story.bodyPlaceholder': 'Write as much as you like.',
    'story.topicLabel': 'What is it about?',
    'story.topicDaily': 'My daily life',
    'story.topicBackground': 'Where I come from',
    'story.topicInteresting': 'Something that happened',
    'story.signLabel': 'Show my name with my story',
    'story.signHint': 'Leave this unticked and your story is published without a name — and we do not keep your name at all.',
    'story.nameLabel': 'The name to show',
    'story.submit': 'Send to be read',
    'story.submitting': 'Sending…',
    'story.sentTitle': 'Thank you — we have your story',
    'story.sentBody': 'We will read it before it appears. Check back here to see whether it was published.',
    'story.sentAgain': 'Write another',
    'story.mineTitle': 'Your stories',
    'story.mineEmpty': 'You have not sent a story yet.',
    'story.statusPending': 'Waiting to be read',
    'story.statusPublished': 'Published',
    'story.statusRejected': 'Not published',
    'story.reviewerNote': 'From us',
    'story.anonymous': 'Anonymous',
    'story.writtenIn': 'Written in',
    'story.glossTitle': 'In English',
    'story.notFound': 'That story is not available.',
    'story.backToStories': '← All stories',
    'story.needTitle': 'Please write a title.',
    'story.needBody': 'Please write your story.',
    'story.quotaFull': 'You have shared your stories for today. Please come back tomorrow.',
    'story.sendFailed': 'Could not send your story. Please try again.',
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
    'header.install': 'Add to home screen',

    // home
    'home.title': 'Learn Cantonese',
    'home.subtitle': 'for daily life in Hong Kong',
    'home.desc': 'Practical words and phrases with audio, pictures, and quizzes. Start at your level!',
    'home.freeChip': 'Free for helpers',
    'home.beginner': 'Beginner',
    'home.intermediate': 'Intermediate',
    'home.advanced': 'Advanced',
    'home.beginnerDesc': 'Basic greetings & common words',
    'home.intermediateDesc': 'Daily activities & routines',
    'home.advancedDesc': 'Full sentences & phrases',
    'home.startQuiz': '📝 Start Quiz',
    'home.myProgress': '📊 My Progress',
    'home.browseByCategory': 'Browse by Category',
    'home.showMoreCategories': 'Show more',
    'home.showLessCategories': 'Show less',
    // The returning-learner cards on Home. Nothing here is shown to a device
    // that has never practised, so these strings are only ever read by someone
    // who has already used the app at least once.
    'home.resumeWelcome': 'Welcome back',
    'home.resumeKeep': 'Practise today to keep your streak',
    'home.resumeDone': 'You practised today — nice work',
    'home.resumeStart': 'Start your streak today',
    'home.resumeContinue': 'Continue',
    'home.wordOfDay': 'Word of the day',
    'home.latest': 'New on Discover',
    'home.dailyCulture': "Today's Culture",

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
    'name.requiredHint': 'Please enter your name first — your scores cannot be saved without it.',
    'name.saveAndStart': 'Save & continue',

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

    // share cards — one picture per part of the app
    'share.cardWord': 'Cantonese',
    'share.cardSticker': 'Sticker {n} of {total}',
    'share.cardStickerShort': 'Sticker',
    'share.cardAlbum': 'My sticker album',
    'share.cardAlbumSub': 'stickers collected',
    'share.cardResult': 'Quiz result',
    'share.cardResultSub': '{pct}% correct',
    'share.cardStory': 'A story from a helper',
    'share.cardArticle': 'From CantoBuddy',
    'share.chatBtn': 'WhatsApp',
    'share.pictureBtn': 'Picture',
    'share.stickerText': '{emoji} {cantonese} ({jyutping}) = {name} — a sticker I earned on CantoBuddy! 🇭🇰',
    'share.albumText': 'I have collected {n} of {total} Cantonese stickers on CantoBuddy! 🇭🇰',
    'share.storyText': 'A helper wrote this: "{title}" — read it on CantoBuddy',
    'share.articleText': '"{title}" — worth reading on CantoBuddy',

    // the share hub — the different parts of the app she can send
    'share.hubAlbum': 'My sticker album',
    'share.hubAlbumSub': '{n} of {total} collected — send it as a picture',
    'share.hubScore': 'My last quiz score',
    'share.hubScoreSub': '{score} out of {total} — send it as a picture',
    'share.hubWord': 'A word I am learning',
    'share.hubWordSub': '{word} — send it as a picture',
    'share.hubStory': 'A story from the community',
    'share.hubStorySub': '{title} — send it as a picture',
    'share.hubArticle': 'Something from Discover',
    'share.hubArticleSub': '{title} — send it as a picture',

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
    'sharePage.hubHeading': 'Or share what you did',

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
    'rewards.openSticker': 'Open sticker',
    'rewards.earnedOn': 'Collected',
    'rewards.shelf.first': 'First words',
    'rewards.shelf.everyday': 'Everyday',
    'rewards.shelf.out': 'Out and about',
    'rewards.shelf.local': 'Almost local',

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

    // install — "keep CantoBuddy on your phone". Offered once, right after she
    // finishes a quiz, and never again once she answers. The instructions differ
    // by phone, so app.js picks a branch; these are the strings for all of them.
    'install.title': 'Keep CantoBuddy on your phone',
    'install.lead': 'Add it to your home screen and it opens like a normal app — one tap, and it works even without internet.',
    'install.add': '📲 Add to Home screen',
    'install.notNow': 'Not now',
    'install.gotIt': 'Got it',
    'install.iosTitle': 'On iPhone / iPad',
    'install.ios1': 'Tap the Share button at the bottom of Safari',
    'install.ios2': 'Scroll down and tap "Add to Home Screen"',
    'install.ios3': 'Tap "Add" in the top corner',
    'install.androidTitle': 'On Android',
    'install.android1': 'Tap the ⋮ menu at the top right of Chrome',
    'install.android2': 'Tap "Add to Home screen" or "Install app"',
    'install.inappTitle': 'Open CantoBuddy in your browser first',
    'install.inappBody': 'You are viewing this inside another app. Tap its ⋯ or ⋮ menu and choose "Open in Safari" or "Open in Chrome" — then add CantoBuddy to your home screen there.',
    'install.done': 'CantoBuddy was added to your home screen 🎉',

    // feedback — the one place she can talk back to us. The copy promises
    // anonymity plainly instead of burying it, because she may be reporting a
    // problem with the family's own phone, in the family's own home.
    'feedback.title': 'Tell us what you think',
    'feedback.lead': 'Found a problem, or have an idea? Write it here.',
    'feedback.placeholder': 'What would you like us to know?',
    'feedback.contactLabel': 'Want a reply? Leave a contact (optional)',
    'feedback.contactPlaceholder': 'Email or phone (optional)',
    'feedback.anon': 'Your name is not sent with this message.',
    'feedback.cancel': 'Cancel',
    'feedback.send': 'Send',
    'feedback.sending': 'Sending…',
    'feedback.empty': 'Please write something first.',
    'feedback.thanks': 'Thank you — we read every message 💛',
    'feedback.tooMany': 'You have sent a lot of messages. Please try again later.',
    'feedback.failed': 'Could not send that. Please try again.',
    'feedback.cardTitle': 'Send us feedback',
    'feedback.cardHint': 'Something broken, or something missing? Tell us — it stays anonymous.',
    'feedback.cardBtn': '💬 Write to us',
    'feedback.footerLink': '💬 Send feedback',

    // footer — the crawlable links to the server-rendered vocabulary pages
    // (see seo.js). Real anchors, not JS navigation, so a crawler can follow
    // them into the content layer.
    'footer.title': 'Browse Cantonese vocabulary',
    'footer.allWords': 'All words & categories',
    'footer.filipino': 'Filipino',
    'footer.mandarin': '中文',
    'footer.indonesian': 'Bahasa Indonesia',
    'footer.guide': "Learn Cantonese: the beginner's guide",
    'footer.privacy': 'Privacy',
  },

  fil: {
    // nav / header
    'nav.home': 'Simula',
    'nav.learn': 'Mag-aral',
    'nav.quiz': 'Pagsusulit',
    'nav.progress': 'Progreso',
    'nav.feedback': 'Puna',
    'nav.share': 'Ibahagi',
    'nav.discover': 'Tuklasin',

    // discover — ang feed ng kultura at balita
    'discover.title': 'Tuklasin: buhay sa HK, balita at mga kuwento',
    'discover.lead': 'Buhay sa Hong Kong, balita mula sa Pilipinas at Indonesia, at mga kuwentong isinulat ng mga helper.',
    'categories.backHome': '← Home',
    'categories.title': 'Mga kategorya',
    'categories.lead': '{n} kategorya, {w} salita. Piliin kung saan ka magsisimula.',
    'categories.words': '{n} salita',
    'discover.tabCulture': 'Kultura',
    'discover.tabNews': 'Balita',
    'discover.cultureLead': 'Paano gumagana ang isang tahanan sa Hong Kong — ang mga kaugaliang walang nagpapaliwanag.',
    'discover.newsLead': 'Balita mula sa Pilipinas, Indonesia at Hong Kong, sa Ingles, may link sa orihinal.',
    'discover.empty': 'Wala pa rito — bumalik mamaya.',
    'discover.loadFailed': 'Hindi ito ma-load. Subukan muli.',
    'discover.readMore': 'Basahin',
    'discover.back': '← Tuklasin',
    'discover.source': 'Pinagmulan',
    'discover.readOriginal': 'Basahin ang buong balita',
    'discover.notFound': 'Hindi available ang artikulong iyon.',
    'discover.newsNote': 'Mga headline at maikling buod mula sa mga pinagmulan sa Pilipinas, Indonesia at Hong Kong. Nasa link ang buong balita.',
    // News categories
    'discover.filterLabel': 'Ipakita lang ang',
    'discover.regionLabel': 'Balita mula sa',
    'discover.regionAll': 'Kahit saan',
    'discover.regionPh': 'Pilipinas',
    'discover.regionId': 'Indonesia',
    'discover.catAll': 'Lahat ng balita',
    'discover.catHongkong': 'Hong Kong',
    'discover.catWork': 'Trabaho at karapatan',
    'discover.catMoney': 'Pera at presyo',
    'discover.catHealth': 'Kalusugan',
    'discover.catHome': 'Tahanan at pamilya',
    'discover.catPolitics': 'Pamahalaan',
    'discover.catOther': 'Iba pang balita',
    'discover.showMore': 'Ipakita pa (%s)',
    'discover.showAll': 'Ipakita lahat',
    'discover.allShown': 'Yan lahat na.',
    // Stories — a helper's own life story. It lives INSIDE Discover, beside
    // Culture and News, because a story is a thing to read like any other, and
    // because a seventh bottom-nav tab does not fit a 320px phone.
    'discover.tabStories': 'Mga Kuwento',
    'discover.storiesLead': 'Totoong kuwento ng mga helper, sa sarili nilang wika — pang-araw-araw na buhay, tahanan, at mga nangyari.',
    'discover.storiesEmpty': 'Wala pang nailathalang kuwento. Baka sa iyo ang mauna.',
    'discover.storiesLoadFailed': 'Hindi ma-load ang mga kuwento. Subukan muli.',
    'story.back': '← Mga Kuwento',
    'story.langLabel': 'Sa anong wika ang kuwento mo?',
    'story.shareYours': 'Ibahagi ang kuwento mo',
    'story.introTitle': 'Ikuwento mo',
    'story.introBody': 'Ang pang-araw-araw mong buhay, ang pinanggalingan mo, o isang bagay na nangyari sa iyo. Isulat sa sarili mong wika — hindi kailangang Ingles.',
    'story.introRule': 'Binabasa namin ang bawat kuwento bago ito lumabas. Ilalathala ito kasama ng pangalan mo kung hihilingin mo lamang.',
    'story.titleLabel': 'Pamagat',
    'story.titlePlaceholder': 'Ilang salita tungkol sa kuwento mo',
    'story.bodyLabel': 'Ang kuwento mo',
    'story.bodyPlaceholder': 'Isulat lahat ng gusto mo.',
    'story.topicLabel': 'Tungkol saan ito?',
    'story.topicDaily': 'Araw-araw kong buhay',
    'story.topicBackground': 'Ang pinanggalingan ko',
    'story.topicInteresting': 'Isang bagay na nangyari',
    'story.signLabel': 'Ipakita ang pangalan ko kasama ng kuwento',
    'story.signHint': 'Kung hindi mo ito tinitikan, ilalathala ang kuwento nang walang pangalan — at hindi namin iniimbak ang pangalan mo.',
    'story.nameLabel': 'Ang ipapakitang pangalan',
    'story.submit': 'Ipadala para basahin',
    'story.submitting': 'Ipinapadala…',
    'story.sentTitle': 'Salamat — natanggap namin ang kuwento mo',
    'story.sentBody': 'Babasahin namin ito bago lumabas. Bumalik dito para tingnan kung nailathala.',
    'story.sentAgain': 'Sumulat ng isa pa',
    'story.mineTitle': 'Mga kuwento mo',
    'story.mineEmpty': 'Wala ka pang naipadalang kuwento.',
    'story.statusPending': 'Naghihintay basahin',
    'story.statusPublished': 'Nailathala',
    'story.statusRejected': 'Hindi nailathala',
    'story.reviewerNote': 'Mula sa amin',
    'story.anonymous': 'Hindi nagpakilala',
    'story.writtenIn': 'Nakasulat sa',
    'story.glossTitle': 'Sa Ingles',
    'story.notFound': 'Hindi available ang kuwentong iyon.',
    'story.backToStories': '← Lahat ng kuwento',
    'story.needTitle': 'Mangyaring maglagay ng pamagat.',
    'story.needBody': 'Mangyaring isulat ang kuwento mo.',
    'story.quotaFull': 'Naibahagi mo na ang mga kuwento mo ngayong araw. Bumalik bukas.',
    'story.sendFailed': 'Hindi naipadala ang kuwento mo. Subukan muli.',
    'header.setName': 'Ilagay ang pangalan',
    'header.voiceTitle': 'Pumili ng boses',
    'header.langTitle': 'Palitan ang wika',
    'header.langSwitchEn': 'Palitan sa Ingles',
    'header.langSwitchFil': 'Palitan sa Filipino',
    'header.employerSite': 'Para sa employer',
    'header.learnerSite': 'App ng mag-aaral',
    'header.shareSite': 'Ibahagi ang CantoBuddy',
    'header.install': 'Idagdag sa home screen',

    // home
    'home.title': 'Mag-aral ng Cantonese',
    'home.subtitle': 'para sa araw-araw na buhay sa Hong Kong',
    'home.desc': 'Mga praktikal na salita at parirala na may audio, larawan, at pagsusulit. Magsimula sa iyong antas!',
    'home.freeChip': 'Libre para sa mga helper',
    'home.beginner': 'Baguhan',
    'home.intermediate': 'Katamtaman',
    'home.advanced': 'Mahusay',
    'home.beginnerDesc': 'Mga basic na pagbati at karaniwang salita',
    'home.intermediateDesc': 'Mga pang-araw-araw na gawain',
    'home.advancedDesc': 'Mga buong pangungusap at parirala',
    'home.startQuiz': '📝 Simulan ang Pagsusulit',
    'home.myProgress': '📊 Aking Progreso',
    'home.browseByCategory': 'Tingnan ayon sa Kategorya',
    'home.showMoreCategories': 'Magpakita ng higit pa',
    'home.showLessCategories': 'Magpakita ng mas kaunti',
    'home.resumeWelcome': 'Maligayang pagbabalik',
    'home.resumeKeep': 'Magpraktis ngayon para tuloy ang sunod-sunod mo',
    'home.resumeDone': 'Nagpraktis ka na ngayon — magaling',
    'home.resumeStart': 'Simulan ang sunod-sunod mo ngayon',
    'home.resumeContinue': 'Ituloy',
    'home.wordOfDay': 'Salita ng araw',
    'home.latest': 'Bago sa Tuklasin',
    'home.dailyCulture': 'Kultura ngayong araw',

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
    'name.requiredHint': 'Pakilagay muna ang iyong pangalan — hindi mai-save ang mga puntos mo kung wala ito.',
    'name.saveAndStart': 'I-save at magpatuloy',

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

    // share cards
    'share.cardWord': 'Cantonese',
    'share.cardSticker': 'Sticker {n} ng {total}',
    'share.cardStickerShort': 'Sticker',
    'share.cardAlbum': 'Ang album ko ng sticker',
    'share.cardAlbumSub': 'sticker ang nakuha',
    'share.cardResult': 'Resulta ng quiz',
    'share.cardResultSub': '{pct}% ang tama',
    'share.cardStory': 'Kuwento mula sa isang helper',
    'share.cardArticle': 'Mula sa CantoBuddy',
    'share.chatBtn': 'WhatsApp',
    'share.pictureBtn': 'Larawan',
    'share.stickerText': '{emoji} {cantonese} ({jyutping}) = {name} — sticker na nakuha ko sa CantoBuddy! 🇭🇰',
    'share.albumText': 'Nakuha ko na ang {n} sa {total} sticker ng Cantonese sa CantoBuddy! 🇭🇰',
    'share.storyText': 'Isinulat ito ng isang helper: "{title}" — basahin sa CantoBuddy',
    'share.articleText': '"{title}" — sulit basahin sa CantoBuddy',

    'share.hubAlbum': 'Ang album ko ng sticker',
    'share.hubAlbumSub': '{n} sa {total} ang nakuha — ipadala bilang larawan',
    'share.hubScore': 'Huling score ko sa quiz',
    'share.hubScoreSub': '{score} sa {total} — ipadala bilang larawan',
    'share.hubWord': 'Isang salitang pinag-aaralan ko',
    'share.hubWordSub': '{word} — ipadala bilang larawan',
    'share.hubStory': 'Kuwento mula sa komunidad',
    'share.hubStorySub': '{title} — ipadala bilang larawan',
    'share.hubArticle': 'Isang bagay mula sa Discover',
    'share.hubArticleSub': '{title} — ipadala bilang larawan',

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
    'sharePage.hubHeading': 'O ibahagi ang nagawa mo',

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
    'rewards.openSticker': 'Buksan ang sticker',
    'rewards.earnedOn': 'Nakuha noong',
    'rewards.shelf.first': 'Mga unang salita',
    'rewards.shelf.everyday': 'Araw-araw',
    'rewards.shelf.out': 'Sa labas',
    'rewards.shelf.local': 'Halos lokal na',

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

    // install — "keep CantoBuddy on your phone"
    'install.title': 'Ilagay ang CantoBuddy sa telepono mo',
    'install.lead': 'Idagdag ito sa home screen mo at bubukas ito tulad ng normal na app — isang tap lang, at gumagana kahit walang internet.',
    'install.add': '📲 Idagdag sa Home screen',
    'install.notNow': 'Mamaya na',
    'install.gotIt': 'Sige, naintindihan ko',
    'install.iosTitle': 'Sa iPhone / iPad',
    'install.ios1': 'I-tap ang Share button sa ibaba ng Safari',
    'install.ios2': 'Mag-scroll pababa at i-tap ang "Add to Home Screen"',
    'install.ios3': 'I-tap ang "Add" sa kanang itaas',
    'install.androidTitle': 'Sa Android',
    'install.android1': 'I-tap ang ⋮ menu sa kanang itaas ng Chrome',
    'install.android2': 'I-tap ang "Add to Home screen" o "Install app"',
    'install.inappTitle': 'Buksan muna ang CantoBuddy sa browser mo',
    'install.inappBody': 'Binubuksan mo ito sa loob ng ibang app. I-tap ang ⋯ o ⋮ menu nito at piliin ang "Open in Safari" o "Open in Chrome" — tapos idagdag ang CantoBuddy sa home screen doon.',
    'install.done': 'Naidagdag na ang CantoBuddy sa home screen mo 🎉',

    // feedback — the one place she can talk back to us.
    'feedback.title': 'Sabihin ang iniisip mo',
    'feedback.lead': 'May problema ka bang nakita, o may ideya? Isulat dito.',
    'feedback.placeholder': 'Ano ang gusto mong ipaalam sa amin?',
    'feedback.contactLabel': 'Gusto mo ng sagot? Mag-iwan ng contact (opsyonal)',
    'feedback.contactPlaceholder': 'Email o telepono, kung gusto mo ng sagot',
    'feedback.anon': 'Hindi ipinapadala ang pangalan mo kasama ng mensaheng ito.',
    'feedback.cancel': 'Kansel',
    'feedback.send': 'Ipadala',
    'feedback.sending': 'Ipinapadala…',
    'feedback.empty': 'Mangyaring magsulat muna ng mensahe.',
    'feedback.thanks': 'Salamat — binabasa namin ang bawat mensahe 💛',
    'feedback.tooMany': 'Marami ka nang naipadalang mensahe. Subukan ulit mamaya.',
    'feedback.failed': 'Hindi naipadala. Subukan ulit.',
    'feedback.cardTitle': 'Magpadala ng puna',
    'feedback.cardHint': 'May sira, o may kulang? Sabihin mo sa amin — hindi ito nakikilala.',
    'feedback.cardBtn': '💬 Sumulat sa amin',
    'feedback.footerLink': '💬 Magpadala ng puna',

    // footer — the crawlable links to the server-rendered vocabulary pages
    // (see seo.js).
    'footer.title': 'Tingnan ang bokabularyong Cantonese',
    'footer.allWords': 'Lahat ng salita at kategorya',
    'footer.filipino': 'Filipino',
    'footer.mandarin': '中文',
    'footer.indonesian': 'Bahasa Indonesia',
    'footer.guide': 'Mag-aral ng Cantonese: gabay para sa baguhan',
    'footer.privacy': 'Privacy',
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
    'nav.feedback': '反馈',
    'nav.share': '分享',
    'nav.discover': '发现',

    // discover — 文化与新闻
    'discover.title': '发现：香港生活、新闻与家佣故事',
    'discover.lead': '香港生活、来自菲律宾和印尼的消息，以及家佣写下的故事。',
    'categories.backHome': '← 首页',
    'categories.title': '分类',
    'categories.lead': '{n} 个分类，{w} 个词语。选一个开始吧。',
    'categories.words': '{n} 个词',
    'discover.tabCulture': '文化',
    'discover.tabNews': '新闻',
    'discover.cultureLead': '香港家庭里的事是怎么运作的——那些没人会解释的习俗。',
    'discover.newsLead': '来自菲律宾、印尼和香港的新闻，英文呈现，附原文链接。',
    'discover.empty': '这里还没有内容，请稍后再来。',
    'discover.loadFailed': '加载失败，请重试。',
    'discover.readMore': '阅读',
    'discover.back': '← 发现',
    'discover.source': '来源',
    'discover.readOriginal': '阅读完整报道',
    'discover.notFound': '这篇文章暂不可用。',
    'discover.newsNote': '标题与简短摘要来自菲律宾、印尼和香港的媒体，完整报道见链接。',
    // 新闻分类
    'discover.filterLabel': '只看',
    'discover.regionLabel': '新闻来自',
    'discover.regionAll': '全部地区',
    'discover.regionPh': '菲律宾',
    'discover.regionId': '印尼',
    'discover.catAll': '全部新闻',
    'discover.catHongkong': '香港',
    'discover.catWork': '工作与权益',
    'discover.catMoney': '金钱与物价',
    'discover.catHealth': '健康',
    'discover.catHome': '家乡与家庭',
    'discover.catPolitics': '政府',
    'discover.catOther': '其他新闻',
    'discover.showMore': '再看 %s 条',
    'discover.showAll': '全部显示',
    'discover.allShown': '已经全部显示。',
    // Stories — a helper's own life story. It lives INSIDE Discover, beside
    // Culture and News, because a story is a thing to read like any other, and
    // because a seventh bottom-nav tab does not fit a 320px phone.
    'discover.tabStories': '家佣故事',
    'discover.storiesLead': '家佣亲笔写下的真实故事，用她们自己的语言——日常、家乡，以及一路上的经历。',
    'discover.storiesEmpty': '目前还没有已发布的故事。你的故事可以是第一篇。',
    'discover.storiesLoadFailed': '故事加载失败，请重试。',
    'story.back': '← 家佣故事',
    'story.langLabel': '你的故事用什么语言写的？',
    'story.shareYours': '分享你的故事',
    'story.introTitle': '说说你的故事',
    'story.introBody': '你的日常生活、你的家乡，或发生在你身上的事。用你自己的语言写——不必是英文。',
    'story.introRule': '每一篇故事在发布前我们都会先读一遍。只有你要求时，才会署上你的名字。',
    'story.titleLabel': '标题',
    'story.titlePlaceholder': '用几个字概括你的故事',
    'story.bodyLabel': '你的故事',
    'story.bodyPlaceholder': '想写多少都可以。',
    'story.topicLabel': '写的是哪方面？',
    'story.topicDaily': '我的日常生活',
    'story.topicBackground': '我的家乡',
    'story.topicInteresting': '发生在我身上的事',
    'story.signLabel': '在故事上显示我的名字',
    'story.signHint': '不勾选的话，故事将以匿名发布，我们也不会保存你的名字。',
    'story.nameLabel': '要显示的名字',
    'story.submit': '发送给我们审阅',
    'story.submitting': '发送中…',
    'story.sentTitle': '谢谢你——我们已收到你的故事',
    'story.sentBody': '我们会在发布前读一遍。可以回来这里查看是否已发布。',
    'story.sentAgain': '再写一篇',
    'story.mineTitle': '你的故事',
    'story.mineEmpty': '你还没有投稿。',
    'story.statusPending': '等待审阅',
    'story.statusPublished': '已发布',
    'story.statusRejected': '未发布',
    'story.reviewerNote': '我们的回复',
    'story.anonymous': '匿名',
    'story.writtenIn': '语言',
    'story.glossTitle': '英文版',
    'story.notFound': '这篇故事暂不可用。',
    'story.backToStories': '← 全部故事',
    'story.needTitle': '请填写标题。',
    'story.needBody': '请写下你的故事。',
    'story.quotaFull': '你今天分享的故事已达上限，请明天再来。',
    'story.sendFailed': '故事发送失败，请重试。',
    'header.setName': '设置姓名',
    'header.voiceTitle': '选择练习语音',
    'header.langTitle': '切换语言',
    'header.langSwitchEn': '切换到英文',
    'header.langSwitchFil': '切换到菲律宾语',
    'header.langSwitchZh': '切换到简体中文',
    'header.employerSite': '雇主入口',
    'header.learnerSite': '学习版',
    'header.shareSite': '分享 CantoBuddy',
    'header.install': '添加到主屏幕',

    // home
    'home.title': '学粤语',
    'home.subtitle': '香港日常生活用语',
    'home.desc': '实用的词和句子，配有发音、图片和测验。从你的水平开始！',
    'home.freeChip': '家佣免费使用',
    'home.beginner': '入门',
    'home.intermediate': '中级',
    'home.advanced': '进阶',
    'home.beginnerDesc': '基本问候和常用词',
    'home.intermediateDesc': '日常活动和习惯',
    'home.advancedDesc': '完整句子和短语',
    'home.startQuiz': '📝 开始测验',
    'home.myProgress': '📊 我的进度',
    'home.browseByCategory': '按类别浏览',
    'home.showMoreCategories': '显示更多',
    'home.showLessCategories': '收起',
    'home.resumeWelcome': '欢迎回来',
    'home.resumeKeep': '今天练习，保持连续记录',
    'home.resumeDone': '今天已经练习了，做得好',
    'home.resumeStart': '今天开始你的连续记录',
    'home.resumeContinue': '继续',
    'home.wordOfDay': '每日一词',
    'home.latest': '发现新内容',
    'home.dailyCulture': '今日文化',

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
    'name.requiredHint': '请先输入你的姓名——没有姓名，测验成绩无法保存。',
    'name.saveAndStart': '保存并继续',

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

    // share cards
    'share.cardWord': '粤语',
    'share.cardSticker': '第 {n} 张，共 {total} 张',
    'share.cardStickerShort': '贴纸',
    'share.cardAlbum': '我的贴纸册',
    'share.cardAlbumSub': '张已收集',
    'share.cardResult': '测验成绩',
    'share.cardResultSub': '正确率 {pct}%',
    'share.cardStory': '一位家佣的故事',
    'share.cardArticle': '来自 CantoBuddy',
    'share.chatBtn': 'WhatsApp',
    'share.pictureBtn': '图片',
    'share.stickerText': '{emoji} {cantonese}（{jyutping}）= {name} —— 我在 CantoBuddy 拿到的贴纸！🇭🇰',
    'share.albumText': '我在 CantoBuddy 已经收集了 {n}/{total} 张粤语贴纸！🇭🇰',
    'share.storyText': '一位家佣写的：{title} —— 在 CantoBuddy 读读看',
    'share.articleText': '{title} —— 值得在 CantoBuddy 一读',

    'share.hubAlbum': '我的贴纸册',
    'share.hubAlbumSub': '已收集 {n}/{total} —— 以图片分享',
    'share.hubScore': '我上次的测验成绩',
    'share.hubScoreSub': '{score}/{total} —— 以图片分享',
    'share.hubWord': '我正在学的一个词',
    'share.hubWordSub': '{word} —— 以图片分享',
    'share.hubStory': '社区里的一个故事',
    'share.hubStorySub': '{title} —— 以图片分享',
    'share.hubArticle': '发现页的内容',
    'share.hubArticleSub': '{title} —— 以图片分享',

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
    'sharePage.hubHeading': '或者分享你做到的',

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
    'rewards.openSticker': '打开贴纸',
    'rewards.earnedOn': '收集于',
    'rewards.shelf.first': '第一批词',
    'rewards.shelf.everyday': '日常',
    'rewards.shelf.out': '出门在外',
    'rewards.shelf.local': '快像本地人了',

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

    // install — "keep CantoBuddy on your phone"
    'install.title': '把 CantoBuddy 留在手机上',
    'install.lead': '添加到主屏幕后，它就能像普通应用一样打开——一点即开，没有网络也能用。',
    'install.add': '📲 添加到主屏幕',
    'install.notNow': '以后再说',
    'install.gotIt': '知道了',
    'install.iosTitle': '在 iPhone / iPad 上',
    'install.ios1': '点一下 Safari 底部的分享按钮',
    'install.ios2': '向下滚动，点"添加到主屏幕"',
    'install.ios3': '点右上角的"添加"',
    'install.androidTitle': '在安卓手机上',
    'install.android1': '点 Chrome 右上角的 ⋮ 菜单',
    'install.android2': '点"添加到主屏幕"或"安装应用"',
    'install.inappTitle': '请先在浏览器中打开 CantoBuddy',
    'install.inappBody': '你正在另一个应用里查看这个页面。点它的 ⋯ 或 ⋮ 菜单，选择"在 Safari 中打开"或"在 Chrome 中打开"，然后在浏览器里添加到主屏幕。',
    'install.done': 'CantoBuddy 已添加到你的主屏幕 🎉',

    // feedback — the one place she can talk back to us.
    'feedback.title': '告诉我们你的想法',
    'feedback.lead': '发现了问题，或者有建议？写在这里。',
    'feedback.placeholder': '你想让我们知道什么？',
    'feedback.contactLabel': '想收到回复？留下联系方式（可选）',
    'feedback.contactPlaceholder': '邮箱或电话（如果你想收到回复）',
    'feedback.anon': '这条消息不会带上你的名字。',
    'feedback.cancel': '取消',
    'feedback.send': '发送',
    'feedback.sending': '正在发送…',
    'feedback.empty': '请先写点内容。',
    'feedback.thanks': '谢谢 — 每条消息我们都会看 💛',
    'feedback.tooMany': '你发送的消息太多了，请稍后再试。',
    'feedback.failed': '发送失败，请再试一次。',
    'feedback.cardTitle': '给我们反馈',
    'feedback.cardHint': '有地方坏了，或者缺了什么？告诉我们 — 这是匿名的。',
    'feedback.cardBtn': '💬 给我们留言',
    'feedback.footerLink': '💬 发送反馈',

    // footer — the crawlable links to the server-rendered vocabulary pages
    // (see seo.js).
    'footer.title': '浏览粤语词汇',
    'footer.allWords': '所有词和类别',
    'footer.filipino': '菲律宾语',
    'footer.mandarin': '中文版',
    'footer.indonesian': '印尼语版',
    'footer.guide': '粤语入门：初学者完整指南',
    'footer.privacy': '隐私政策',
  },

  /* Bahasa Indonesia — the fourth audience.

     Indonesian domestic helpers are the other large group in Hong Kong, and
     they need the same thing the Filipino audience needs (understand the
     person you care for), in a language neither of the other two trees
     provides. This is NOT Malay: `asisten rumah tangga` rather than `pembantu
     rumah`, `gratis` rather than `percuma`, `beranda` rather than `laman
     utama`, `unduh`/`pasang` rather than `muat turun`. A Malaysian reader would
     understand nearly all of it, but an Indonesian reader must never feel the
     app was written for someone else. */
  id: {
    // nav / header
    'nav.home': 'Beranda',
    'nav.learn': 'Belajar',
    'nav.quiz': 'Kuis',
    'nav.progress': 'Kemajuan',
    'nav.feedback': 'Masukan',
    'nav.share': 'Bagikan',
    'nav.discover': 'Jelajah',

    // discover — umpan budaya dan berita
    'discover.title': 'Jelajahi: kehidupan HK, berita & kisah',
    'discover.lead': 'Kehidupan di Hong Kong, berita dari Indonesia dan Filipina, serta kisah yang ditulis para asisten.',
    'categories.backHome': '← Beranda',
    'categories.title': 'Kategori',
    'categories.lead': '{n} kategori, {w} kata. Pilih mau mulai dari mana.',
    'categories.words': '{n} kata',
    'discover.tabCulture': 'Budaya',
    'discover.tabNews': 'Berita',
    'discover.cultureLead': 'Bagaimana rumah tangga Hong Kong bekerja — kebiasaan yang tak pernah dijelaskan.',
    'discover.newsLead': 'Berita dari Indonesia, Filipina, dan Hong Kong, dalam bahasa Inggris, dengan tautan ke aslinya.',
    'discover.empty': 'Belum ada apa-apa di sini — cek lagi nanti.',
    'discover.loadFailed': 'Gagal memuat. Coba lagi.',
    'discover.readMore': 'Baca',
    'discover.back': '← Jelajah',
    'discover.source': 'Sumber',
    'discover.readOriginal': 'Baca berita lengkapnya',
    'discover.notFound': 'Artikel itu tidak tersedia.',
    'discover.newsNote': 'Judul dan ringkasan singkat dari sumber Indonesia, Filipina, dan Hong Kong. Berita lengkapnya ada di tautan.',
    // Kategori berita
    'discover.filterLabel': 'Tampilkan hanya',
    'discover.regionLabel': 'Berita dari',
    'discover.regionAll': 'Semua daerah',
    'discover.regionPh': 'Filipina',
    'discover.regionId': 'Indonesia',
    'discover.catAll': 'Semua berita',
    'discover.catHongkong': 'Hong Kong',
    'discover.catWork': 'Kerja & hak Anda',
    'discover.catMoney': 'Uang & harga',
    'discover.catHealth': 'Kesehatan',
    'discover.catHome': 'Kampung & keluarga',
    'discover.catPolitics': 'Pemerintah',
    'discover.catOther': 'Berita lain',
    'discover.showMore': 'Tampilkan %s lagi',
    'discover.showAll': 'Tampilkan semua',
    'discover.allShown': 'Itu saja.',
    // Stories — a helper's own life story. It lives INSIDE Discover, beside
    // Culture and News, because a story is a thing to read like any other, and
    // because a seventh bottom-nav tab does not fit a 320px phone.
    'discover.tabStories': 'Kisah',
    'discover.storiesLead': 'Kisah nyata dari para asisten rumah tangga, dalam bahasa mereka sendiri — kehidupan sehari-hari, kampung halaman, dan apa yang terjadi.',
    'discover.storiesEmpty': 'Belum ada kisah yang diterbitkan. Kisahmu bisa menjadi yang pertama.',
    'discover.storiesLoadFailed': 'Gagal memuat kisah. Coba lagi.',
    'story.back': '← Kisah',
    'story.langLabel': 'Kisahmu dalam bahasa apa?',
    'story.shareYours': 'Bagikan kisahmu',
    'story.introTitle': 'Ceritakan kisahmu',
    'story.introBody': 'Kehidupan sehari-harimu, kampung halamanmu, atau sesuatu yang pernah terjadi. Tulislah dalam bahasamu sendiri — tidak harus bahasa Inggris.',
    'story.introRule': 'Kami membaca setiap kisah sebelum ditampilkan. Nama Anda hanya dicantumkan jika Anda memintanya.',
    'story.titleLabel': 'Judul',
    'story.titlePlaceholder': 'Beberapa kata tentang kisahmu',
    'story.bodyLabel': 'Kisahmu',
    'story.bodyPlaceholder': 'Tulis sebanyak yang kamu mau.',
    'story.topicLabel': 'Tentang apa ini?',
    'story.topicDaily': 'Kehidupan sehari-hariku',
    'story.topicBackground': 'Kampung halamanku',
    'story.topicInteresting': 'Sesuatu yang pernah terjadi',
    'story.signLabel': 'Tampilkan namaku bersama kisah ini',
    'story.signHint': 'Jika tidak dicentang, kisah diterbitkan tanpa nama — dan kami tidak menyimpan namamu sama sekali.',
    'story.nameLabel': 'Nama yang ditampilkan',
    'story.submit': 'Kirim untuk dibaca',
    'story.submitting': 'Mengirim…',
    'story.sentTitle': 'Terima kasih — kisahmu sudah kami terima',
    'story.sentBody': 'Kami akan membacanya sebelum ditampilkan. Cek kembali di sini untuk melihat apakah sudah diterbitkan.',
    'story.sentAgain': 'Tulis lagi',
    'story.mineTitle': 'Kisahmu',
    'story.mineEmpty': 'Kamu belum pernah mengirim kisah.',
    'story.statusPending': 'Menunggu dibaca',
    'story.statusPublished': 'Diterbitkan',
    'story.statusRejected': 'Tidak diterbitkan',
    'story.reviewerNote': 'Dari kami',
    'story.anonymous': 'Tanpa nama',
    'story.writtenIn': 'Ditulis dalam',
    'story.glossTitle': 'Dalam bahasa Inggris',
    'story.notFound': 'Kisah itu tidak tersedia.',
    'story.backToStories': '← Semua kisah',
    'story.needTitle': 'Mohon tulis judulnya.',
    'story.needBody': 'Mohon tulis kisahmu.',
    'story.quotaFull': 'Kisahmu untuk hari ini sudah habis. Silakan kembali besok.',
    'story.sendFailed': 'Gagal mengirim kisahmu. Coba lagi.',
    'header.setName': 'Atur nama Anda',
    'header.voiceTitle': 'Pilih suara latihan',
    'header.langTitle': 'Ganti bahasa',
    'header.langSwitchEn': 'Ganti ke bahasa Inggris',
    'header.langSwitchFil': 'Ganti ke bahasa Filipino',
    'header.employerSite': 'Untuk majikan',
    'header.learnerSite': 'Aplikasi belajar',
    'header.shareSite': 'Bagikan CantoBuddy',
    'header.install': 'Tambahkan ke layar utama',

    // home
    'home.title': 'Belajar bahasa Kanton',
    'home.subtitle': 'untuk kehidupan sehari-hari di Hong Kong',
    'home.desc': 'Kata dan frasa praktis dengan audio, gambar, dan kuis. Mulai dari tingkat Anda!',
    'home.freeChip': 'Gratis untuk asisten rumah tangga',
    'home.beginner': 'Pemula',
    'home.intermediate': 'Menengah',
    'home.advanced': 'Mahir',
    'home.beginnerDesc': 'Sapaan dasar & kata umum',
    'home.intermediateDesc': 'Kegiatan & rutinitas harian',
    'home.advancedDesc': 'Kalimat & frasa lengkap',
    'home.startQuiz': '📝 Mulai Kuis',
    'home.myProgress': '📊 Kemajuan Saya',
    'home.browseByCategory': 'Jelajahi per Kategori',
    'home.showMoreCategories': 'Tampilkan lebih banyak',
    'home.showLessCategories': 'Tampilkan lebih sedikit',
    'home.resumeWelcome': 'Selamat datang kembali',
    'home.resumeKeep': 'Latihan hari ini agar rentetanmu tetap berjalan',
    'home.resumeDone': 'Kamu sudah berlatih hari ini — bagus',
    'home.resumeStart': 'Mulai rentetanmu hari ini',
    'home.resumeContinue': 'Lanjutkan',
    'home.wordOfDay': 'Kata hari ini',
    'home.latest': 'Baru di Jelajah',
    'home.dailyCulture': 'Budaya hari ini',

    // browse
    'browse.backHome': '← Beranda',
    'browse.title': 'Kosakata',
    'browse.level': 'Tingkat:',
    'browse.category': 'Kategori:',
    'browse.all': 'Semua',
    'browse.allLevels': 'Semua Tingkat',
    'browse.empty': 'Tidak ada kata untuk filter ini.',
    'browse.tapToHear': 'Ketuk untuk mendengar pelafalan',

    // quiz setup
    'quiz.title': 'Waktunya Kuis!',
    'quiz.chooseLevel': 'Pilih Tingkat',
    'quiz.chooseType': 'Pilih Jenis Kuis',
    'quiz.tMultipleChoice': 'Pilihan Ganda',
    'quiz.dMultipleChoice': 'Lihat bahasa Kanton, pilih arti bahasa Inggrisnya',
    'quiz.tListenChoose': 'Dengar & Pilih',
    'quiz.dListenChoose': 'Dengar audionya, pilih arti yang benar',
    'quiz.tMatchPicture': 'Cocokkan Gambar',
    'quiz.dMatchPicture': 'Lihat gambar, cocokkan dengan kata Kantonnya',
    'quiz.tFillBlank': 'Isi Bagian Kosong',
    'quiz.dFillBlank': 'Lengkapi kalimat dengan kata yang tepat',

    // quiz play
    'quiz.quit': '← Keluar',
    'quiz.questionOf': 'Soal',
    'quiz.score': 'Skor:',
    'quiz.tapSpeaker': 'Ketuk pengeras suara untuk mendengar',
    'quiz.promptMeaning': 'Apa artinya ini?',
    'quiz.promptListen': 'Dengar lalu pilih arti yang benar',
    'quiz.promptMatch': 'Kata Kanton mana yang cocok dengan gambar ini?',
    'quiz.promptFill': 'Isi bagian kosong dengan kata yang benar',
    'quiz.correct': '✅ Benar!',
    'quiz.answerIs': '❌ Jawaban:',
    'quiz.next': 'Berikutnya →',
    'quiz.seeResults': 'Lihat Hasil 🎉',
    'quiz.notEnough': 'Kata di tingkat ini belum cukup untuk kuis. Coba tingkat lain.',

    // results
    'result.complete': 'Kuis Selesai!',
    'result.percentCorrect': '% benar',
    'result.tryAgain': 'Coba Lagi',
    'result.done': 'Selesai',
    'result.share': 'Bagikan skor saya',

    // progress
    'progress.title': 'Kemajuan Saya',
    'progress.setNameFirst': 'Atur nama Anda dulu supaya kemajuan tercatat! Ketuk "Atur nama Anda" di bagian atas.',
    'progress.none': 'Belum ada kuis yang dikerjakan. Coba kuis pertama Anda! 📝',
    'progress.overall': 'Skor Keseluruhan',
    'progress.byLevel': 'per Tingkat',
    'progress.recent': 'Percobaan Terakhir',
    'progress.correctOutOf': 'benar dari',
    'progress.attempts': 'percobaan kuis',
    'progress.couldNotLoad': 'Tidak bisa memuat kemajuan.',
    'progress.partial': 'Belum selesai',
    'progress.stoppedAt': 'Berhenti di',

    // statistics
    'stats.title': 'Statistik Anda',
    'stats.none': 'Selesaikan satu kuis dan statistik Anda akan muncul di sini.',
    'stats.streak': 'Rentetan latihan',
    'stats.streakNone': 'Belum dimulai',
    'stats.dayOne': 'hari',
    'stats.days': 'hari',
    'stats.inARow': 'berturut-turut',
    'stats.practisedToday': 'Anda sudah berlatih hari ini — lanjutkan!',
    'stats.practiseToday': 'Berlatihlah hari ini supaya rentetan Anda tidak putus',
    'stats.best': 'Terbaik',
    'stats.daysPractised': 'Hari berlatih',
    'stats.thisWeek': 'Minggu ini',
    'stats.lastWeek': 'Minggu lalu',
    'stats.attemptOne': 'percobaan',
    'stats.attempts': 'percobaan',
    'stats.correctPct': '{n}% benar',
    'stats.nothingLastWeek': 'Tidak ada minggu lalu',
    'stats.overTime': 'Latihan dari waktu ke waktu',
    'stats.range7': '7 hari',
    'stats.range30': '30 hari',
    'stats.range90': '90 hari',
    'stats.byQuizType': 'Cara Anda berlatih',
    'stats.chartHint': 'Setiap batang adalah satu hari',

    // name modal
    'name.title': 'Nama Anda',
    'name.hint': 'Masukkan nama Anda supaya skor kuis tersimpan.',
    'name.placeholder': 'mis. Siti',
    'name.cancel': 'Batal',
    'name.save': 'Simpan',
    'name.notSaved': 'Browser Anda memblokir data tersimpan, jadi nama Anda mungkin tidak diingat. Coba jendela biasa, bukan mode penjelajahan pribadi.',
    'name.requiredHint': 'Masukkan nama Anda dulu — tanpa itu skor Anda tidak bisa disimpan.',
    'name.saveAndStart': 'Simpan & lanjutkan',

    // voice modal
    'voice.title': '🎙️ Pilih Suara Latihan',
    'voice.hint': 'Ketuk suara untuk mendengar 你好 — pilih suara perempuan atau laki-laki, lambat atau alami.',
    'voice.woman': 'Perempuan',
    'voice.man': 'Laki-laki',
    'voice.slow': 'Lambat & Jelas',
    'voice.natural': 'Alami',
    'voice.realVoice': 'suara asli',
    'voice.allOnDevice': 'Semua suara di perangkat ini',
    'voice.female': 'Perempuan',
    'voice.male': 'Laki-laki',
    'voice.unknown': 'Tidak diketahui',
    'voice.done': 'Selesai',
    'voice.loading': 'Memuat suara…',
    'voice.noChinese': '⚠️ Tidak ada suara Tionghoa di perangkat ini. Pasang satu di pengaturan ponsel atau PC Anda.',
    'voice.bothFound': '✓ Suara Tionghoa laki-laki dan perempuan asli ditemukan — ubin ini memakainya langsung.',
    'voice.maleOnly': 'ℹ️ Suara laki-laki asli ditemukan, tetapi tidak ada yang perempuan — ubin Perempuan memakai penyesuaian nada.',
    'voice.femaleOnly': '⚠️ Hanya suara Tionghoa perempuan yang terpasang, jadi ubin Laki-laki mungkin masih terdengar perempuan. Pilih suara laki-laki di bawah, atau pakai Microsoft Edge (punya suara Kanton laki-laki asli).',
    'voice.noGender': 'ℹ️ Suara ditemukan, tetapi jenis kelaminnya tidak bisa dideteksi — Laki-laki/Perempuan dibuat lewat nada. Pilih suara tertentu di bawah kalau ada yang terdengar pas.',
    'voice.noAudio': '⚠️ Browser ini tidak bisa memutar audio. Coba Chrome, Edge, atau Safari.',

    // share
    'share.wordText': 'Belajar bahasa Kanton dengan CantoBuddy',
    'share.scoreText': 'Saya dapat {score}/{total} di CantoBuddy! 🇭🇰',
    'share.copied': 'Tersalin ke papan klip!',
    'share.failed': 'Tidak bisa membagikan.',
    'share.cardSaved': 'Gambar tersimpan — tempel di mana saja!',
    'share.cardFooter': 'Latihan bahasa Kanton gratis untuk asisten rumah tangga di Hong Kong',

    // share cards
    'share.cardWord': 'Bahasa Kanton',
    'share.cardSticker': 'Stiker {n} dari {total}',
    'share.cardStickerShort': 'Stiker',
    'share.cardAlbum': 'Album stiker saya',
    'share.cardAlbumSub': 'stiker terkumpul',
    'share.cardResult': 'Hasil kuis',
    'share.cardResultSub': '{pct}% benar',
    'share.cardStory': 'Cerita dari seorang asisten',
    'share.cardArticle': 'Dari CantoBuddy',
    'share.chatBtn': 'WhatsApp',
    'share.pictureBtn': 'Gambar',
    'share.stickerText': '{emoji} {cantonese} ({jyutping}) = {name} — stiker yang saya dapat di CantoBuddy! 🇭🇰',
    'share.albumText': 'Saya sudah mengumpulkan {n} dari {total} stiker Kanton di CantoBuddy! 🇭🇰',
    'share.storyText': 'Seorang asisten menulis ini: "{title}" — baca di CantoBuddy',
    'share.articleText': '"{title}" — layak dibaca di CantoBuddy',

    'share.hubAlbum': 'Album stiker saya',
    'share.hubAlbumSub': '{n} dari {total} terkumpul — kirim sebagai gambar',
    'share.hubScore': 'Skor kuis terakhir saya',
    'share.hubScoreSub': '{score} dari {total} — kirim sebagai gambar',
    'share.hubWord': 'Kata yang sedang saya pelajari',
    'share.hubWordSub': '{word} — kirim sebagai gambar',
    'share.hubStory': 'Cerita dari komunitas',
    'share.hubStorySub': '{title} — kirim sebagai gambar',
    'share.hubArticle': 'Sesuatu dari Discover',
    'share.hubArticleSub': '{title} — kirim sebagai gambar',

    // share page
    'sharePage.title': 'Bagikan CantoBuddy',
    'sharePage.hero': 'Beri tahu teman',
    'sharePage.body': 'Belajar lebih mudah kalau ada teman. Kirim CantoBuddy ke teman — gratis untuk asisten rumah tangga, selamanya.',
    'sharePage.previewLabel': 'Yang akan dilihat teman Anda',
    'sharePage.shareBtn': 'Bagikan CantoBuddy',
    'sharePage.copyBtn': '🔗 Salin tautan',
    'sharePage.whatsappBtn': 'Kirim lewat WhatsApp',
    'sharePage.footnote': 'Setiap tautan yang Anda bagikan membawa kode Anda sendiri, supaya kami bisa melihat bagaimana CantoBuddy menyebar di komunitas. Tanpa nama, tanpa data pribadi.',
    'sharePage.copied': 'Tautan tersalin!',
    'sharePage.copyFailed': 'Tidak bisa menyalin tautan.',
    'sharePage.message': 'Saya belajar bahasa Kanton dengan CantoBuddy — gratis, dan dibuat untuk asisten rumah tangga di Hong Kong. Coba!',
    'sharePage.hubHeading': 'Atau bagikan yang sudah kamu lakukan',

    // connecting to an employer
    'connect.title': 'Hubungkan ke {name}?',
    'connect.see': '{name} akan bisa melihat latihan CantoBuddy Anda — skor kuis dan kemajuan Anda. Tidak yang lain.',
    'connect.yourName': 'Nama Anda',
    'connect.nameHint': 'Nama yang akan dilihat majikan Anda.',
    'connect.notNow': 'Nanti saja',
    'connect.connect': 'Hubungkan',
    'connect.connecting': 'Menghubungkan…',
    'connect.doneTitle': 'Anda sudah terhubung 🎉',
    'connect.doneBody': '{name} sekarang bisa melihat latihan Anda. Anda bisa berhenti berbagi kapan saja.',
    'connect.doneBtn': 'Mulai belajar',
    'connect.invalid': 'Tautan undangan ini tidak berlaku atau sudah kedaluwarsa.',
    'connect.failed': 'Tidak bisa menghubungkan. Coba lagi.',

    // who can see my progress
    'sharing.title': 'Siapa yang bisa melihat kemajuan saya',
    'sharing.hint': 'Orang-orang ini bisa melihat skor kuis Anda. Anda bisa berhenti berbagi kapan saja — kemajuan Anda selalu tetap pada Anda.',
    'sharing.none': 'Tidak ada yang bisa melihat kemajuan Anda. Hanya Anda.',
    'sharing.since': 'Terhubung',
    'sharing.stop': 'Berhenti berbagi',
    'sharing.stopped': 'Berhenti berbagi',
    'sharing.failed': 'Tidak bisa memperbarui. Coba lagi.',
    'sharing.enterCode': 'Punya kode dari majikan Anda?',

    // rewards
    'rewards.title': 'Stiker Saya',
    'rewards.hint': 'Anda mendapat 1 kredit untuk setiap jawaban benar. Capai angka sebuah stiker dan stiker itu jadi milik Anda.',
    'rewards.credits': 'kredit',
    'rewards.creditOne': 'kredit',
    'rewards.next': 'Stiker berikutnya',
    'rewards.toGo': 'lagi',
    'rewards.locked': 'Terkunci',
    'rewards.complete': 'Anda mengumpulkan seluruh album! 🏆',
    'rewards.newTitle': 'Stiker baru!',
    'rewards.newBody': 'Anda mendapat {name}',
    'rewards.newBodyMany': 'Anda mendapat {n} stiker baru!',
    'rewards.viewAlbum': 'Lihat album saya',
    'rewards.notYet': 'Belum dikumpulkan',
    'rewards.openSticker': 'Buka stiker',
    'rewards.earnedOn': 'Dikumpulkan',
    'rewards.shelf.first': 'Kata pertama',
    'rewards.shelf.everyday': 'Sehari-hari',
    'rewards.shelf.out': 'Di luar rumah',
    'rewards.shelf.local': 'Hampir warga lokal',

    // connecting with a code
    'connect.enterCode': 'Masukkan kode',
    'connect.codeTitle': 'Hubungkan ke majikan Anda',
    'connect.codeHint': 'Ketik kode yang diberikan majikan Anda.',
    'connect.codeLabel': 'Kode majikan',
    'connect.codePlaceholder': 'mis. 4GTBVT6R',
    'connect.codeSubmit': 'Hubungkan',
    'connect.codeChecking': 'Memeriksa…',
    'connect.codeNotFound': 'Kode itu tidak ditemukan. Periksa lagi dan coba ulang.',

    // misc
    'misc.close': 'Tutup',
    'misc.loadFailed': 'Tidak bisa memuat data. Apakah server berjalan?',
    'misc.shareWord': 'Bagikan kata ini',
    'misc.shareCard': 'Bagikan sebagai gambar',

    // install
    'install.title': 'Simpan CantoBuddy di ponsel Anda',
    'install.lead': 'Tambahkan ke layar utama dan aplikasinya terbuka seperti aplikasi biasa — sekali ketuk, dan tetap jalan tanpa internet.',
    'install.add': '📲 Tambahkan ke layar utama',
    'install.notNow': 'Nanti saja',
    'install.gotIt': 'Mengerti',
    'install.iosTitle': 'Di iPhone / iPad',
    'install.ios1': 'Ketuk tombol Bagikan di bagian bawah Safari',
    'install.ios2': 'Gulir ke bawah dan ketuk "Tambahkan ke Layar Utama"',
    'install.ios3': 'Ketuk "Tambah" di sudut atas',
    'install.androidTitle': 'Di Android',
    'install.android1': 'Ketuk menu ⋮ di kanan atas Chrome',
    'install.android2': 'Ketuk "Tambahkan ke layar utama" atau "Pasang aplikasi"',
    'install.inappTitle': 'Buka CantoBuddy di browser dulu',
    'install.inappBody': 'Anda sedang melihat ini di dalam aplikasi lain. Ketuk menu ⋯ atau ⋮ dan pilih "Buka di Safari" atau "Buka di Chrome" — lalu tambahkan CantoBuddy ke layar utama di sana.',
    'install.done': 'CantoBuddy sudah ditambahkan ke layar utama 🎉',

    // feedback
    'feedback.title': 'Ceritakan pendapat Anda',
    'feedback.lead': 'Menemukan masalah, atau punya ide? Tulis di sini.',
    'feedback.placeholder': 'Apa yang ingin Anda sampaikan?',
    'feedback.contactLabel': 'Mau dibalas? Tinggalkan kontak (opsional)',
    'feedback.contactPlaceholder': 'Email atau telepon (opsional)',
    'feedback.anon': 'Nama Anda tidak dikirim bersama pesan ini.',
    'feedback.cancel': 'Batal',
    'feedback.send': 'Kirim',
    'feedback.sending': 'Mengirim…',
    'feedback.empty': 'Tulis dulu sesuatu.',
    'feedback.thanks': 'Terima kasih — kami membaca setiap pesan 💛',
    'feedback.tooMany': 'Anda sudah mengirim banyak pesan. Coba lagi nanti.',
    'feedback.failed': 'Tidak bisa mengirim. Coba lagi.',
    'feedback.cardTitle': 'Kirim masukan',
    'feedback.cardHint': 'Ada yang rusak, atau ada yang kurang? Beri tahu kami — tetap anonim.',
    'feedback.cardBtn': '💬 Tulis ke kami',
    'feedback.footerLink': '💬 Kirim masukan',

    // footer
    'footer.title': 'Jelajahi kosakata bahasa Kanton',
    'footer.allWords': 'Semua kata & kategori',
    'footer.filipino': 'Filipino',
    'footer.mandarin': '中文',
    'footer.indonesian': 'Bahasa Indonesia',
    'footer.guide': 'Belajar bahasa Kanton: panduan untuk pemula',
    'footer.privacy': 'Privasi',
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
  if (_lang === 'id' && cat.name_id) return cat.name_id;
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
