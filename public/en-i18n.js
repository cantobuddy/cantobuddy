'use strict';
/**
 * CantoBuddy — English Track UI strings.
 *
 * The English track's on-screen UI is offered in four languages, chosen by the
 * elderly learner (or the helper): Traditional Chinese (繁, default for HK),
 * Simplified Chinese (簡), Filipino (Fil) and Indonesian (Indo).
 *
 * This is a SEPARATE file from the Cantonese app's i18n.js so the Cantonese
 * strings are never touched.
 *
 * `yue` is the default because the target user is a Cantonese-speaking elder in
 * Hong Kong. The English content itself and the Cantonese translations of that
 * content live in the database (en-data.js), not here — this file is only the
 * chrome (buttons, labels, navigation).
 */
const EN_LANGS = [
  { code: 'yue', label: '繁', name: '繁體中文' },
  { code: 'zh', label: '簡', name: '簡體中文' },
  { code: 'fil', label: 'Fil', name: 'Filipino' },
  { code: 'id', label: 'Indo', name: 'Bahasa Indonesia' },
];

const EN_I18N = {
  yue: {
    'brand.sub': '學英文',
    'back.canto': '粵語版',
    'hero.title': '學日常英文',
    'hero.sub': '教你點同家務助理溝通 · 認屋企嘢 · 出街買餸',
    'hero.cta1': '學詞',
    'hero.cta2': '情景練習',
    'nav.home': '主頁',
    'nav.learn': '學詞',
    'nav.practice': '練習',
    'nav.progress': '進度',
    'learn.title': '揀一類嚟學詞',
    'learn.words': '{n} 個詞',
    'practice.title': '情景練習',
    'practice.sub': '同家務助理講嘅句子',
    'browse.title': '詞語',
    'btn.listenEn': '聽英文',
    'btn.listenYue': '聽粵語',
    'btn.quiz': '測驗',
    'btn.back': '返回',
    'btn.next': '下一個',
    'quiz.title': '測驗：撳啱嘅意思',
    'quiz.question': '呢個英文字係咩意思？',
    'quiz.correct': '啱㗎！',
    'quiz.wrong': '再試吓',
    'quiz.done': '做完喇！',
    'quiz.score': '你啱咗 {n} / {t} 個',
    'quiz.again': '再做一次',
    'quiz.listen': '聽英文',
    'quiz.showText': '睇文字',
    'scenario.title': '句子',
    'progress.title': '我的進度',
    'progress.seen': '睇過 {n} 個詞',
    'progress.correct': '啱咗 {n} 個',
    'progress.empty': '仲未學過，去「學詞」開始啦！',
    'progress.practicedPct': '已練習 {pct}%（{seen}/{total}）',
    'progress.correctTotal': '總共啱咗 {n} 次',
    'progress.accuracy': '準確度',
    'noAudio': '呢部機唔支援語音，請用 Chrome 或 Safari。',
    'lang.switch': '語言',
  },
  zh: {
    'brand.sub': '学英文',
    'back.canto': '粤语版',
    'hero.title': '学日常英文',
    'hero.sub': '教你怎样跟家务助理沟通 · 认家里东西 · 上街买菜',
    'hero.cta1': '学词',
    'hero.cta2': '情景练习',
    'nav.home': '主页',
    'nav.learn': '学词',
    'nav.practice': '练习',
    'nav.progress': '进度',
    'learn.title': '选一类来学词',
    'learn.words': '{n} 个词',
    'practice.title': '情景练习',
    'practice.sub': '跟家务助理说的句子',
    'browse.title': '词语',
    'btn.listenEn': '听英文',
    'btn.listenYue': '听粤语',
    'btn.quiz': '测验',
    'btn.back': '返回',
    'btn.next': '下一个',
    'quiz.title': '测验：按对的意思',
    'quiz.question': '这个英文词是什么意思？',
    'quiz.correct': '对！',
    'quiz.wrong': '再试一次',
    'quiz.done': '做完啦！',
    'quiz.score': '你对了 {n} / {t} 个',
    'quiz.again': '再做一次',
    'scenario.title': '句子',
    'progress.title': '我的进度',
    'progress.seen': '看过 {n} 个词',
    'progress.correct': '对了 {n} 个',
    'progress.empty': '还没学过，去「学词」开始吧！',
    'progress.practicedPct': '已练习 {pct}%（{seen}/{total}）',
    'progress.correctTotal': '总共答对 {n} 次',
    'progress.accuracy': '准确度',
    'noAudio': '这部机不支持语音，请用 Chrome 或 Safari。',
    'lang.switch': '语言',
  },
  fil: {
    'brand.sub': 'English',
    'back.canto': 'Cantonese',
    'hero.title': 'Matutong English',
    'hero.sub': 'Paano kausapin ang katulong · Mga bagay sa bahay · Pamalengke',
    'hero.cta1': 'Mga Salita',
    'hero.cta2': 'Practice',
    'nav.home': 'Home',
    'nav.learn': 'Salita',
    'nav.practice': 'Practice',
    'nav.progress': 'Progress',
    'learn.title': 'Pili ng isang group',
    'learn.words': '{n} salita',
    'practice.title': 'Practice',
    'practice.sub': 'Mga pangungusap para sa katulong',
    'browse.title': 'Mga salita',
    'btn.listenEn': 'Marinig EN',
    'btn.listenYue': 'Marinig Yue',
    'btn.quiz': 'Quiz',
    'btn.back': 'Bumalik',
    'btn.next': 'Susunod',
    'quiz.title': 'Quiz: pili ang tamang kahulugan',
    'quiz.question': 'Ano ang ibig sabihin nito?',
    'quiz.correct': 'Tama!',
    'quiz.wrong': 'Subukan ulit',
    'quiz.done': 'Tapos na!',
    'quiz.score': 'Tama ka sa {n} / {t}',
    'quiz.again': 'Ulitin',
    'scenario.title': 'Pangungusap',
    'progress.title': 'Progress ko',
    'progress.seen': 'Nakita {n} salita',
    'progress.correct': 'Tama {n}',
    'progress.empty': 'Wala pa, pumunta sa "Salita"!',
    'progress.practicedPct': 'Natapos {pct}% ({seen}/{total})',
    'progress.correctTotal': 'Tama {n} beses',
    'progress.accuracy': 'Tama porsyento',
    'noAudio': 'Hindi gumagana ang audio, gamitin Chrome o Safari.',
    'lang.switch': 'Wika',
  },
  id: {
    'brand.sub': 'English',
    'back.canto': 'Kanton',
    'hero.title': 'Belajar English',
    'hero.sub': 'Cara bicara dengan pembantu · Barang di rumah · Belanja',
    'hero.cta1': 'Kata',
    'hero.cta2': 'Practice',
    'nav.home': 'Home',
    'nav.learn': 'Kata',
    'nav.practice': 'Practice',
    'nav.progress': 'Progress',
    'learn.title': 'Pilih satu grup',
    'learn.words': '{n} kata',
    'practice.title': 'Practice',
    'practice.sub': 'Kalimat untuk pembantu',
    'browse.title': 'Kata',
    'btn.listenEn': 'Dengar EN',
    'btn.listenYue': 'Dengar Yue',
    'btn.quiz': 'Kuis',
    'btn.back': 'Kembali',
    'btn.next': 'Berikutnya',
    'quiz.title': 'Kuis: pilih arti yang benar',
    'quiz.question': 'Apa arti ini?',
    'quiz.correct': 'Benar!',
    'quiz.wrong': 'Coba lagi',
    'quiz.done': 'Selesai!',
    'quiz.score': 'Benar {n} / {t}',
    'quiz.again': 'Ulangi',
    'scenario.title': 'Kalimat',
    'progress.title': 'Progress saya',
    'progress.seen': 'Lihat {n} kata',
    'progress.correct': 'Benar {n}',
    'progress.empty': 'Belum belajar, ke "Kata"!',
    'progress.practicedPct': 'Latihan {pct}% ({seen}/{total})',
    'progress.correctTotal': 'Betul {n} kali',
    'progress.accuracy': 'Ketepatan',
    'noAudio': 'Audio tidak disokong, guna Chrome atau Safari.',
    'lang.switch': 'Bahasa',
  },
};

const EN_LANG_STORAGE_KEY = 'en_lang';

(function () {
  let _lang = localStorage.getItem(EN_LANG_STORAGE_KEY) || 'yue';
  if (!EN_LANGS.some((l) => l.code === _lang)) _lang = 'yue';

  window.enCurrentLang = function () { return _lang; };
  window.enLangs = EN_LANGS;

  window.setEnLang = function (code) {
    if (!EN_LANGS.some((l) => l.code === code)) return;
    _lang = code;
    localStorage.setItem(EN_LANG_STORAGE_KEY, code);
    if (typeof window.onEnLangChange === 'function') window.onEnLangChange(code);
  };

  window.enT = function (key, vars) {
    const table = EN_I18N[_lang] || EN_I18N.yue;
    let s = table[key] != null ? table[key] : (EN_I18N.yue[key] != null ? EN_I18N.yue[key] : key);
    if (vars) for (const k of Object.keys(vars)) s = s.replace('{' + k + '}', String(vars[k]));
    return s;
  };
})();
