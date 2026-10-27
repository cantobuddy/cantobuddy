/**
 * CantoBuddy — Chinese Checkers rules, in the four languages the app ships.
 *
 * WHY THIS IS A SEPARATE MODULE. The rules appear in two places: a "How to
 * play" panel inside the game, and a public guide page at
 * /guide/how-to-play-chinese-checkers. Written twice, they drift - one gets a
 * correction and the other keeps the old wording, and then the game and the
 * page that explains the game disagree about the game. So the text lives here
 * once, and both read it: `require`d by content.js for the guide, loaded as a
 * <script> by the game client. Same pattern as core.js, for the same reason.
 *
 * WHY THE RULES THEMSELVES ARE DESCRIBED AND NOT COMPUTED. These sentences have
 * to be true of the engine in core.js, and they are checked by
 * tools/chinesechecker-test.js where the rule is mechanical (ten pegs per
 * corner, opposite corners for 2 and 4 players, a jump needs an empty landing).
 * Prose cannot be tested; the claims in it can, and are.
 *
 * NO PADDING. Each section says one thing. A rules page that is long because it
 * is long is worse than a short one - the reader is a domestic helper with five
 * minutes, not a tournament player.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CheckerRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LANGS = ['en', 'fil', 'zh', 'id'];

  var RULES = {
    /* ================================================================ EN */
    en: {
      title: 'How to play Chinese Checkers',
      lede: 'The rules take a minute. Winning takes a while.',
      sections: [
        {
          h: 'The board',
          p: 'A six-pointed star with 121 holes. Six colours of ten pegs sit in the six corners. Two, three, four or six people can play — not five, because with five somebody always starts closer to their goal than somebody else.',
        },
        {
          h: 'Setting up',
          p: 'Everyone takes one corner and plays that colour.',
          list: [
            '2 or 4 players — opposite corners, so each player races toward the corner facing them.',
            '3 players — one empty corner between each player.',
            '6 players — every corner is taken.',
          ],
        },
        {
          h: 'Taking turns',
          p: 'One peg moves per turn, going round the table in the same direction every time. You may only move your own colour.',
        },
        {
          h: 'The two moves',
          p: 'Each turn you make exactly one of these.',
          list: [
            'Step — move a peg to any of the six holes touching it. One hole, no further.',
            'Jump — if a peg sits in the hole next to yours and the hole directly beyond it is empty, you may jump over it and land there. Any colour may be jumped, including your own.',
          ],
        },
        {
          h: 'Chaining jumps',
          p: 'If the hole you land on has another jump available, you may keep jumping in the same turn. You may also stop wherever you like — you are never forced to take the whole chain.',
        },
        {
          h: 'When a jump is blocked',
          p: 'A jump only works if the hole beyond the peg you are jumping is empty. If something is sitting there, that jump does not exist — it is not a shorter jump or another route, it simply cannot be played. The peg you jump over must be exactly one hole away; you cannot jump across a gap.',
        },
        {
          h: 'Winning',
          p: 'The first player to fill all ten holes of the opposite corner wins. The game ends there and then; there is no second place.',
        },
      ],
      faq: [
        {
          q: 'Can I jump over my own pegs?',
          a: 'Yes. The peg you jump over can be any colour, including yours. That is what makes long chains possible.',
        },
        {
          q: 'Do I have to jump if I can?',
          a: 'No. A jump is always optional. You may step instead, or stop halfway through a chain.',
        },
        {
          q: 'Can five people play?',
          a: 'No. The star has six corners, and any five-player arrangement leaves one player closer to their goal than another. Two, three, four and six are the fair numbers.',
        },
        {
          q: 'What if I cannot move at all?',
          a: 'Every hole on this board has at least two neighbours, so a peg can always step somewhere. You cannot be stuck.',
        },
        {
          q: 'Can I jump into a corner that is not mine?',
          a: 'You may move anywhere on the board, but only your own ten holes count as home. Landing in someone else\'s corner just wastes a turn.',
        },
      ],
    },

    /* =============================================================== FIL */
    fil: {
      title: 'Paano Laruin ang Chinese Checkers',
      lede: 'Isang minuto lang ang rules. Ang panalo, mas matagal.',
      sections: [
        {
          h: 'Ang board',
          p: 'Bituin na may anim na sulok at 121 butas. Anim na kulay, sampung piraso bawat isa, nasa anim na sulok. Puwedeng 2, 3, 4 o 6 na manlalaro — hindi lima, dahil sa limang manlalaro laging may isang mas malapit sa goal kaysa sa iba.',
        },
        {
          h: 'Paano mag-umpisa',
          p: 'Bawat manlalaro ay may isang sulok, at iyon ang kulay niya.',
          list: [
            '2 o 4 na manlalaro — magkatalikod na sulok, para ang bawat isa ay tumatakbo papunta sa sulok sa harap niya.',
            '3 manlalaro — may isang bakanteng sulok sa pagitan ng bawat isa.',
            '6 na manlalaro — lahat ng sulok ay may tao.',
          ],
        },
        {
          h: 'Paghalili ng tira',
          p: 'Isang piraso lang ang igagalaw sa bawat tira, paikot sa parehong direksyon. Sariling kulay lang ang puwedeng galawin.',
        },
        {
          h: 'Dalawang uri ng tira',
          p: 'Isang galaw lang ang gagawin mo bawat tira.',
          list: [
            'Hakbang — ilipat ang piraso sa alinman sa anim na butas na katabi nito. Isang butas lang.',
            'Lundag — kung may piraso sa katabing butas at bakante ang butas sa kabila nito, puwede mong lundagin iyon at doon bumaba. Kahit anong kulay ang lundagin, pati na ang sarili mo.',
          ],
        },
        {
          h: 'Sunod-sunod na lundag',
          p: 'Kung may panibagong lundag mula sa binabaan mo, puwede kang magpatuloy sa parehong tira. Puwede ka ring huminto kahit saan — hindi ka pinipilit tapusin ang buong chain.',
        },
        {
          h: 'Kapag harang ang lundag',
          p: 'Gagana lang ang lundag kung bakante ang butas sa kabila ng pirasong nilulundagan. Kapag may nakaupo doon, wala ang lundag na iyon — hindi ito mas maikling lundag o ibang ruta, hindi lang talaga ito puwede. Ang pirasong nilulundagan ay dapat katabi mismo; hindi ka puwedeng lumundag sa may puwang.',
        },
        {
          h: 'Paano manalo',
          p: 'Ang unang makapuno sa sampung butas ng katapat na sulok ang panalo. Tapos agad ang laro; walang pangalawa.',
        },
      ],
      faq: [
        {
          q: 'Puwede bang lundagin ang sarili kong piraso?',
          a: 'Oo. Kahit anong kulay ang lundagin, pati ang sa iyo. Iyon ang dahilan kung bakit may mahahabang chain.',
        },
        {
          q: 'Kailangan bang lundag kung kaya?',
          a: 'Hindi. Laging opsyonal ang lundag. Puwede kang humakbang, o huminto sa gitna ng chain.',
        },
        {
          q: 'Puwede bang lima ang manlalaro?',
          a: 'Hindi. Anim ang sulok, at sa anumang lima-lima na ayos may isang mas malapit sa goal. 2, 3, 4 at 6 lang ang patas.',
        },
        {
          q: 'Paano kung wala akong magalaw?',
          a: 'Bawat butas dito ay may hindi bababa sa dalawang katabi, kaya laging may mahakbangan ang piraso. Hindi ka matutulak sa sulok.',
        },
        {
          q: 'Puwede bang lumundag papunta sa sulok na hindi sa akin?',
          a: 'Puwede kang pumunta kahit saan sa board, pero ang sampung butas mo lang ang bahay. Ang bumaba sa sulok ng iba ay sayang na tira.',
        },
      ],
    },

    /* ================================================================ ZH */
    zh: {
      title: '跳棋玩法',
      lede: '规则一分钟就学会，想赢要久一点。',
      sections: [
        {
          h: '棋盘',
          p: '棋盘是一个六角星，共 121 个洞。六种颜色各 10 颗棋子，分别摆在六个角上。可以 2、3、4 或 6 个人玩——不能 5 个人，因为五人局里总有人比别人更靠近终点。',
        },
        {
          h: '开局摆位',
          p: '每人占一个角，就下那个颜色的棋子。',
          list: [
            '2 人或 4 人——放相对的角，各自奔向正对面的角。',
            '3 人——每两人之间空一个角。',
            '6 人——六个角全满。',
          ],
        },
        {
          h: '轮流下棋',
          p: '每一手只移动一颗自己的棋子，每次都按同一个方向轮下去。',
        },
        {
          h: '两种走法',
          p: '每一手只能选其中一种。',
          list: [
            '平移——把棋子移到与它相邻的六个洞中的任意一个。只走一格。',
            '跳跃——如果紧挨着的洞里有棋子，而它正后方的洞是空的，就可以跳过它落在那里。跳过谁的棋子都行，包括自己的。',
          ],
        },
        {
          h: '连续跳',
          p: '落点如果还能再跳，可以在同一手里继续跳。也可以随时停下——没人逼你把整条路线跳完。',
        },
        {
          h: '什么时候跳不了',
          p: '只有被跳那颗棋子正后方的洞是空的，这一跳才成立。那里只要有东西，这一跳就不存在——它不是「跳短一点」或「换条路」，而是根本不能走。被跳的棋子必须紧挨着，中间有空隙就跳不过去。',
        },
        {
          h: '胜负',
          p: '最先把自己十颗棋子全部填满对面那个角的玩家获胜。棋局立刻结束，没有第二名。',
        },
      ],
      faq: [
        {
          q: '可以跳自己的棋子吗？',
          a: '可以。被跳的棋子是什么颜色都行，包括自己的。连跳就是这么来的。',
        },
        {
          q: '能跳的时候一定要跳吗？',
          a: '不用。跳永远是可选动作。你可以改为平移，也可以在连跳到一半时停下。',
        },
        {
          q: '五个人可以玩吗？',
          a: '不行。六角星有六个角，五人局无论怎么摆，总有人比别人更靠近终点。公平的人数只有 2、3、4、6。',
        },
        {
          q: '如果一颗棋子都动不了怎么办？',
          a: '这个棋盘上每个洞至少有两个相邻的洞，所以任何棋子都一定有地方可走，不会被困死。',
        },
        {
          q: '可以跳进别人的角吗？',
          a: '棋盘上任何位置都可以走，但只有自己那十个洞算到家。落在别人的角里只是浪费一手。',
        },
      ],
    },

    /* ================================================================ ID */
    id: {
      title: 'Cara Bermain Chinese Checkers',
      lede: 'Aturannya satu menit. Menangnya lebih lama.',
      sections: [
        {
          h: 'Papan',
          p: 'Bintang bersudut enam dengan 121 lubang. Enam warna, masing-masing sepuluh bidak, di enam sudut. Bisa dimainkan 2, 3, 4, atau 6 orang — bukan lima, karena dengan lima pemain selalu ada yang lebih dekat ke tujuannya.',
        },
        {
          h: 'Penyusunan awal',
          p: 'Setiap pemain mengambil satu sudut dan memainkan warna itu.',
          list: [
            '2 atau 4 pemain — sudut yang saling berhadapan, jadi masing-masing berlari ke sudut di depannya.',
            '3 pemain — ada satu sudut kosong di antara tiap pemain.',
            '6 pemain — semua sudut terisi.',
          ],
        },
        {
          h: 'Giliran',
          p: 'Setiap giliran hanya satu bidak yang bergerak, berputar ke arah yang sama terus. Hanya bidak warnamu sendiri.',
        },
        {
          h: 'Dua jenis langkah',
          p: 'Tiap giliran kamu melakukan tepat satu dari ini.',
          list: [
            'Langkah — pindahkan bidak ke salah satu dari enam lubang yang bersebelahan. Satu lubang saja.',
            'Lompat — kalau ada bidak di lubang sebelah dan lubang tepat di baliknya kosong, kamu boleh melompatinya dan mendarat di sana. Warna apa pun boleh dilompati, termasuk milikmu sendiri.',
          ],
        },
        {
          h: 'Lompat berantai',
          p: 'Kalau dari tempat mendarat masih ada lompatan lain, kamu boleh terus melompat di giliran yang sama. Kamu juga boleh berhenti di mana saja — tidak wajib menghabiskan seluruh rantainya.',
        },
        {
          h: 'Kapan lompatan tidak bisa',
          p: 'Lompatan hanya sah kalau lubang di balik bidak yang dilompati kosong. Kalau ada isinya, lompatan itu tidak ada — bukan lompatan yang lebih pendek atau jalur lain, memang tidak bisa dimainkan. Bidak yang dilompati harus tepat bersebelahan; tidak bisa melompati celah.',
        },
        {
          h: 'Memenangkan permainan',
          p: 'Pemain pertama yang mengisi kesepuluh lubang di sudut seberang menang. Permainan langsung selesai; tidak ada juara dua.',
        },
      ],
      faq: [
        {
          q: 'Boleh melompati bidak sendiri?',
          a: 'Boleh. Bidak yang dilompati bisa warna apa saja, termasuk warnamu. Itulah yang membuat rantai panjang mungkin.',
        },
        {
          q: 'Harus melompat kalau bisa?',
          a: 'Tidak. Lompatan selalu pilihan. Kamu boleh melangkah, atau berhenti di tengah rantai.',
        },
        {
          q: 'Bisakah lima orang bermain?',
          a: 'Tidak. Bintang ini punya enam sudut, dan susunan lima pemain apa pun membuat satu orang lebih dekat ke tujuannya. Yang adil: 2, 3, 4, dan 6.',
        },
        {
          q: 'Bagaimana kalau tidak ada bidak yang bisa jalan?',
          a: 'Setiap lubang di papan ini punya minimal dua tetangga, jadi selalu ada tempat untuk melangkah. Kamu tidak akan buntu.',
        },
        {
          q: 'Boleh melompat ke sudut orang lain?',
          a: 'Kamu boleh bergerak ke mana saja di papan, tapi hanya sepuluh lubangmu yang dihitung sebagai rumah. Mendarat di sudut orang lain hanya membuang giliran.',
        },
      ],
    },
  };

  /** The rules for one language, falling back to English. */
  function forLang(lang) {
    return RULES[lang] || RULES.en;
  }

  /* The one-sentence meta description for the guide page, taken from the lede
     so the search snippet and the first line of the page agree. */
  var DESC = {
    en: 'The full rules of Chinese Checkers in plain language: how to set up for 2, 3, 4 or 6 players, how stepping and jumping work, when a jump is blocked, and how to win.',
    fil: 'Ang buong rules ng Chinese Checkers sa simpleng salita: paano mag-umpisa sa 2, 3, 4 o 6 na manlalaro, paano ang hakbang at lundag, kailan harang ang lundag, at paano manalo.',
    zh: '跳棋完整规则，说人话：2、3、4、6 人怎么摆位，平移和跳跃怎么走，什么时候跳不了，以及怎么赢。',
    id: 'Aturan lengkap Chinese Checkers dengan bahasa sederhana: cara menyusun untuk 2, 3, 4, atau 6 pemain, cara melangkah dan melompat, kapan lompatan terhalang, dan cara menang.',
  };

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* The guide page body. Rendered from the same sections the in-game panel
     uses, so the two cannot say different things.

     NO LEDE HERE. The guide page already prints the meta description as its
     lede paragraph, so emitting `r.lede` as well put two one-line intro
     paragraphs back to back and read like a mistake. The panel keeps it,
     because the panel has no description of its own. */
  function guideBody(lang) {
    var r = forLang(lang);
    var out = [];
    r.sections.forEach(function (s) {
      out.push('<h2>' + esc(s.h) + '</h2>');
      out.push('<p>' + esc(s.p) + '</p>');
      if (s.list && s.list.length) {
        out.push('<ul>\n' + s.list.map(function (li) { return '  <li>' + esc(li) + '</li>'; }).join('\n') + '\n</ul>');
      }
    });
    return out.join('\n');
  }

  /* The FAQ in the shape content.js expects: one entry per question, with a
     per-language answer inside. Transposed from the per-language source above
     so neither copy has to be maintained by hand. */
  function faqEntries() {
    var n = RULES.en.faq.length;
    var out = [];
    for (var i = 0; i < n; i++) {
      var q = {};
      var a = {};
      LANGS.forEach(function (l) {
        var f = (RULES[l].faq || [])[i];
        if (f) { q[l] = f.q; a[l] = f.a; }
      });
      out.push({ q: q, a: a });
    }
    return out;
  }

  function mapLang(pick) {
    var out = {};
    LANGS.forEach(function (l) { out[l] = pick(RULES[l]); });
    return out;
  }

  return {
    LANGS: LANGS,
    RULES: RULES,
    forLang: forLang,
    guideBody: guideBody,
    faqEntries: faqEntries,
    titles: mapLang(function (r) { return r.title; }),
    descriptions: DESC,
    slugs: 'how-to-play-chinese-checkers',
  };
});
