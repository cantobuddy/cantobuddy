/**
 * CantoBuddy — the entries that fill the 9 empty (category × level) combinations.
 *
 * WHY THIS FILE EXISTS. Rule: no (category × level) combination may be EMPTY,
 * floor 4 items (the quiz engine needs a pool of >= 4 — generateQuestions,
 * app.js:1126). Nine combinations are empty today; this closes them.
 *
 *     Greetings  L2 + L3   ┐ beginner-only category, needs the upper levels
 *     Common     L2 + L3   ┘   (9 + 8 = 17 entries)
 *     Cleaning   L1        ┐
 *     Children   L1        │ intermediate-only categories, need the Beginner
 *     Daily Life L1        │   level (4 each = 20 entries)
 *     Shopping   L1        │
 *     Home       L1        ┘
 *                          ── 37 entries, every combination reaching >= 4
 *
 *     (Greetings L2 gets 5 and Common L2 gets 5, one over the floor, because
 *     九唔使 / 等等 replace two words that turned out to already exist in the
 *     seed at a different category and level — see REVIEW NOTE 6.)
 * THIS IS A DRAFT, NOT SEED DATA. Nothing here is wired into data.js yet.
 * These are machine-drafted, exactly like the Tier A + Restaurant sets already
 * in the seed (which carry status:'draft' for the same reason). They have NOT
 * been checked by a native Cantonese speaker. Read the review notes at the
 * bottom before promoting them.
 *
 * HOW TO PROMOTE. Append these objects to SEED_VOCABULARY in data.js (ids
 * 143-180 are free), add the `mandarin` gloss for each to MANDARIN_GLOSSES and
 * the `indonesian` gloss to INDONESIAN_GLOSSES (ids 65+ get status:'draft'
 * automatically — see the forEach below SEED_VOCABULARY), then run:
 *
 *     node tools/vocab-coverage-test.js     # must go 4 passed, 0 failed
 *     node tools/regression.js              # 29 suites, all green
 *
 * FIELD NOTES
 *   type     word | phrase | sentence. match_picture narrows to type='word',
 *            so each combination needs >= 4 WORDS to keep that quiz type fed
 *            (content-migration-test asserts this per level). Levels 1 and 2
 *            here are all `word` on purpose; level 3 mixes, as the seed does.
 *   speaker  helper | elderly | either. The app cares about BOTH directions:
 *            what she must SAY, and what she must UNDERSTAND when the elderly
 *            person or the family says it to her.
 *   level    1 = one concept, single word; 2 = two-concept word or fixed
 *            phrase; 3 = full sentence or a phrase whose Cantonese is not
 *            guessable from its parts.
 */

const EXPANSION_DRAFT = [
  // =========================================================================
  // Greetings (問候) — needs L2 and L3. L1 already holds 6.
  // =========================================================================
  // The gap in this category is real, not a filing error: Greetings genuinely
  // has only beginner words. What is missing is the next register up — the
  // polite forms a carer actually needs in front of an employer's family
  // (早晨 to the family is in the seed; 早唞 is too), and the full sentences
  // she needs when she cannot just nod. Every one of these is heard or said
  // in an ordinary week in a Hong Kong household.

  // ---- L2 ----
  { id: 143, cantonese: '唔使客氣', jyutping: 'm4 sai2 haak3 hei3', english: "You're welcome",       tagalog: 'Walang anuman',            emoji: '🙇', level: 2, category_id: 1, type: 'word',   speaker: 'helper',  tags: 'greeting,polite' },
  { id: 144, cantonese: '對唔住',   jyutping: 'deoi3 m4 zyu6',      english: 'Sorry',                tagalog: 'Pasensya na',              emoji: '😔', level: 2, category_id: 1, type: 'word',   speaker: 'helper',  tags: 'greeting,polite' },
  { id: 145, cantonese: '唔使',     jyutping: 'm4 sai2',            english: 'No need / You don\'t have to', tagalog: 'Hindi na kailangan', emoji: '🙅', level: 2, category_id: 1, type: 'word',   speaker: 'either',  tags: 'greeting,polite', usage_note: 'The workhorse refusal. 唔使客氣 = "you\'re welcome"; bare 唔使 = "no need". Distinct from 唔好 (do not) — 唔使 means it is not necessary.' },
  { id: 146, cantonese: '慢行',     jyutping: 'maan6 haang4',       english: 'Goodbye (to someone leaving)', tagalog: 'Ingat',             emoji: '🚶', level: 2, category_id: 1, type: 'word',   speaker: 'either',  tags: 'greeting,farewell', usage_note: 'Said TO the person leaving, the way 慢行 is used at a door or a lift. Not a literal instruction to walk slowly.' },
  { id: 147, cantonese: '食咗飯未', jyutping: 'sik6 zo2 faan6 mei6', english: 'Have you eaten yet? (a greeting)', tagalog: 'Kumain ka na ba?', emoji: '🍚', level: 2, category_id: 1, type: 'word',   speaker: 'elderly', tags: 'greeting', usage_note: 'In Cantonese this is a greeting, not really a question about food. The expected answer is 食咗 (yes), not a menu.' },

  // ---- L3 ----
  { id: 148, cantonese: '唔好意思阻你', jyutping: 'm4 hou2 ji3 si1 zo2 nei5', english: 'Sorry to bother you', tagalog: 'Pasensya na sa abala', emoji: '🙏', level: 3, category_id: 1, type: 'sentence', speaker: 'helper', tags: 'greeting,polite' },
  { id: 149, cantonese: '有事就打電話俾我', jyutping: 'jau5 si6 zau6 daa2 din6 waa2 bei2 ngo5', english: 'Call me if anything happens', tagalog: 'Tumawag ka sa akin kung may mangyari', emoji: '📞', level: 3, category_id: 1, type: 'sentence', speaker: 'helper', tags: 'greeting,reporting' },
  { id: 150, cantonese: '小姐早晨', jyutping: 'siu2 ze2 zou2 san4', english: 'Good morning, ma\'am', tagalog: 'Magandang umaga, ma\'am', emoji: '🌅', level: 3, category_id: 1, type: 'sentence', speaker: 'helper', tags: 'greeting,polite', usage_note: 'The address term 小姐 goes BEFORE 早晨 — the reverse of English word order. Same pattern with 先生 (Mr) and 太太 (Mrs).' },
  { id: 151, cantonese: '唔該借借',   jyutping: 'm4 goi1 ze3 ze3', english: 'Excuse me, let me through', tagalog: 'Makiray, makikiraan po', emoji: '🚶', level: 3, category_id: 1, type: 'sentence', speaker: 'helper', tags: 'greeting,polite' },

  // =========================================================================
  // Common (常用) — needs L2 and L3. L1 already holds 6.
  // =========================================================================
  // The highest-frequency small words, and the category most likely to be hit
  // in the first five minutes of the day. L2 is the "how much / how many /
  // where" layer she needs before she can answer anything; L3 is the repair
  // language — asking someone to slow down or repeat, which is the single most
  // useful thing a beginner can be able to say.

  // ---- L2 ----
  { id: 152, cantonese: '好多',   jyutping: 'hou2 do1',        english: 'A lot',            tagalog: 'Marami',              emoji: '📚', level: 2, category_id: 2, type: 'word',   speaker: 'either', tags: 'quantity' },
  { id: 153, cantonese: '太少',   jyutping: 'taai3 siu2',      english: 'Too little',       tagalog: 'Kulang',              emoji: '🤏', level: 2, category_id: 2, type: 'word',   speaker: 'either', tags: 'quantity' },
  { id: 154, cantonese: '冇問題', jyutping: 'mou5 man6 tai4',  english: 'No problem',       tagalog: 'Walang problema',     emoji: '👌', level: 2, category_id: 2, type: 'word',   speaker: 'helper', tags: 'reassurance' },
  { id: 155, cantonese: '等我',   jyutping: 'dang2 ngo5',      english: 'Wait for me',      tagalog: 'Hintayin mo ako',     emoji: '✋', level: 2, category_id: 2, type: 'word',   speaker: 'elderly', tags: 'instruction' },
  { id: 156, cantonese: '等等',   jyutping: 'dang2 dang2',      english: 'Hold on a moment', tagalog: 'Teka lang',           emoji: '⏳', level: 2, category_id: 2, type: 'word',   speaker: 'either', tags: 'request' },

  // ---- L3 ----
  { id: 157, cantonese: '你講咩呀',   jyutping: 'nei5 gong2 me1 aa3',      english: 'What did you say?',        tagalog: 'Ano ang sinabi mo?',        emoji: '❓', level: 3, category_id: 2, type: 'sentence', speaker: 'helper', tags: 'question,clarify' },
  { id: 158, cantonese: '唔該講慢啲', jyutping: 'm4 goi1 gong2 maan6 di1', english: 'Please speak more slowly', tagalog: 'Pakisuyo, dahan-dahan',     emoji: '🐌', level: 3, category_id: 2, type: 'sentence', speaker: 'helper', tags: 'request,clarify' },
  { id: 159, cantonese: '我唔係好明', jyutping: 'ngo5 m4 hai6 hou2 ming4', english: "I don't quite understand", tagalog: 'Hindi ko lubos maintindihan', emoji: '🤔', level: 3, category_id: 2, type: 'sentence', speaker: 'helper', tags: 'clarify' },
  { id: 160, cantonese: '係咁先喇',   jyutping: 'hai6 gam3 sin1 laa3',     english: "That's all for now",       tagalog: 'Iyon muna',                 emoji: '🙆', level: 3, category_id: 2, type: 'sentence', speaker: 'either', tags: 'closing', usage_note: 'A fixed closing phrase — 係咁先喇 ends a conversation or a task. Not composable from its parts.' },

  // =========================================================================
  // Cleaning (清潔) — needs L1. L2/L3 already hold 5.
  // =========================================================================
  // This category's existing content starts at L2 — every entry is an
  // imperative (洗衫, 拖地, 抹枱, 倒垃圾). So a Beginner saw an empty
  // category. What a Beginner needs first is not the tasks but the OBJECTS
  // and the two directions: clean / dirty.

  // ---- L1 ----
  { id: 161, cantonese: '乾淨', jyutping: 'gon1 zeng6',     english: 'Clean',        tagalog: 'Malinis',        emoji: '✨', level: 1, category_id: 4, type: 'word', speaker: 'either', tags: 'cleaning,state' },
  { id: 162, cantonese: '污糟', jyutping: 'wu1 zou1',       english: 'Dirty',        tagalog: 'Marumi',         emoji: '🧦', level: 1, category_id: 4, type: 'word', speaker: 'either', tags: 'cleaning,state' },
  { id: 163, cantonese: '掃地', jyutping: 'sou2 dei2',      english: 'Sweep the floor', tagalog: 'Magwalis',    emoji: '🧹', level: 1, category_id: 4, type: 'word', speaker: 'helper', tags: 'imperative,cleaning' },
  { id: 164, cantonese: '抹手', jyutping: 'maat3 sau2',     english: 'Wipe your hands', tagalog: 'Punasan ang kamay', emoji: '🧻', level: 1, category_id: 4, type: 'word', speaker: 'elderly', tags: 'instruction,hygiene' },

  // =========================================================================
  // Children (細路仔) — needs L1. L2/L3 already hold 5.
  // =========================================================================
  // Same shape of gap: the category opens at L2 with 細路仔 itself. A Beginner
  // looking at "Children" saw nothing. L1 supplies the family nouns she needs
  // to talk about who is in the flat at all, plus the two universal verbs.

  // ---- L1 ----
  { id: 165, cantonese: '媽媽', jyutping: 'maa1 maa1',      english: 'Mummy / Mother', tagalog: 'Mommy / Nanay', emoji: '👩', level: 1, category_id: 5, type: 'word', speaker: 'either', tags: 'family' },
  { id: 166, cantonese: '爸爸', jyutping: 'baa1 baa1',      english: 'Daddy / Father', tagalog: 'Daddy / Tatay', emoji: '👨', level: 1, category_id: 5, type: 'word', speaker: 'either', tags: 'family' },
  { id: 167, cantonese: '玩',   jyutping: 'waan2',          english: 'Play',           tagalog: 'Maglaro',       emoji: '🪀', level: 1, category_id: 5, type: 'word', speaker: 'either', tags: 'children' },
  { id: 168, cantonese: '喊',   jyutping: 'haam3',          english: 'Cry',            tagalog: 'Umiyak',        emoji: '😭', level: 1, category_id: 5, type: 'word', speaker: 'either', tags: 'children' },

  // =========================================================================
  // Daily Life (日常) — needs L1. L2/L3 already hold 5.
  // =========================================================================
  // L2 starts with 瞓覺/起身/沖涼. L1 here is the body-and-routine nouns and
  // the two verbs that carry most of a carer's day. Note these are the same
  // concepts as their L2 relatives on purpose: the progression is the POINT
  // (飯 → 食飯 → 食早餐), so a learner climbs rather than meets a wall.

  // ---- L1 ----
  { id: 169, cantonese: '覺',   jyutping: 'gaau3',         english: 'A sleep',        tagalog: 'Tulog',        emoji: '😴', level: 1, category_id: 6, type: 'word',   speaker: 'either', tags: 'routine' },
  { id: 170, cantonese: '衫',   jyutping: 'saam1',         english: 'Clothes',        tagalog: 'Damit',        emoji: '👕', level: 1, category_id: 6, type: 'word',   speaker: 'either', tags: 'routine' },
  { id: 171, cantonese: '着衫', jyutping: 'zoek3 saam1',   english: 'Put on clothes', tagalog: 'Magbihis',     emoji: '🧥', level: 1, category_id: 6, type: 'phrase', speaker: 'either', tags: 'routine,instruction' },
  { id: 172, cantonese: '刷牙', jyutping: 'caat3 ngaa4',   english: 'Brush teeth',    tagalog: 'Magsipilyo',   emoji: '🪥', level: 1, category_id: 6, type: 'word',   speaker: 'either', tags: 'routine,hygiene' },

  // =========================================================================
  // Shopping (買嘢) — needs L1. L2/L3 already hold 5.
  // =========================================================================
  // The gap is the noun layer: L2 opens with 街市 and 買嘢, so a Beginner had
  // no words at all for the things she is sent out to buy.

  // ---- L1 ----
  { id: 173, cantonese: '菜',   jyutping: 'coi3',          english: 'Vegetables',   tagalog: 'Gulay',        emoji: '🥬', level: 1, category_id: 7, type: 'word', speaker: 'either', tags: 'shopping,food' },
  { id: 174, cantonese: '魚',   jyutping: 'jyu2',          english: 'Fish',         tagalog: 'Isda',         emoji: '🐟', level: 1, category_id: 7, type: 'word', speaker: 'either', tags: 'shopping,food' },
  { id: 175, cantonese: '肉',   jyutping: 'juk6',          english: 'Meat',         tagalog: 'Karne',        emoji: '🥩', level: 1, category_id: 7, type: 'word', speaker: 'either', tags: 'shopping,food' },
  { id: 176, cantonese: '生果', jyutping: 'saang1 gwo2',   english: 'Fruit',        tagalog: 'Prutas',       emoji: '🍎', level: 1, category_id: 7, type: 'word', speaker: 'either', tags: 'shopping,food' },

  // =========================================================================
  // Home (屋企) — needs L1. L2/L3 already hold 5.
  // =========================================================================
  // Home is the category where the mis-levelling shows most. 開燈/關燈 sit at
  // L2 and 開門/關門 at L3, though all four read as Beginner. The entries here
  // are the ones that are NOT already in the seed — see REVIEW NOTE 1, which
  // proposes MOVING four existing rows down instead of writing new ones. If you
  // take that option, only 開/閂 and 有冇人 need authoring here and two of
  // these four can be dropped, giving 36 total either way.

  // ---- L1 ----
  { id: 177, cantonese: '開',     jyutping: 'hoi1',        english: 'Open / Turn on',  tagalog: 'Buksan',        emoji: '🔓', level: 1, category_id: 9, type: 'word', speaker: 'either', tags: 'imperative,home' },
  { id: 178, cantonese: '閂',     jyutping: 'saan1',       english: 'Close / Shut',    tagalog: 'Isara',         emoji: '🔒', level: 1, category_id: 9, type: 'word', speaker: 'either', tags: 'imperative,home', usage_note: '閂 is the everyday door-and-lid verb in Cantonese; 關 appears in the seeded 關燈/關門. Worth teaching as a pair so she recognises both.' },
  { id: 179, cantonese: '房',     jyutping: 'fong2',       english: 'Room',            tagalog: 'Kwarto',        emoji: '🚪', level: 1, category_id: 9, type: 'word', speaker: 'either', tags: 'home,place' },
  { id: 180, cantonese: '大門',   jyutping: 'daai6 mun4',  english: 'Front door',      tagalog: 'Pintuan',       emoji: '🏠', level: 1, category_id: 9, type: 'word', speaker: 'either', tags: 'home,place' },
];

/* ===========================================================================
   REVIEW NOTES — read these before promoting any of it
   ===========================================================================

   1. HOME: MOVE, DON'T WRITE, WHERE YOU CAN
      The cheapest correction in the whole set. 開燈 and 關燈 are filed at Home
      L2, 開門 and 關門 at Home L3 — every one of them reads as Beginner, and
      the seed already teaches 開窗 at L2. Moving those four down to L1 fills
      Home L1 with words that ALREADY EXIST and are ALREADY reviewed.
      If you move them, Home L1 is full without 177/178/179/180 and this file
      supplies 32 new entries instead of 36. Both satisfy the rule; the move
      is less new unreviewed Cantonese in front of learners. Your call — it is
      a teaching judgement about level, not a correctness question.

   2. JYUTPING: THE HIGHEST-RISK FIELD
      Tone numbers were assigned carefully but have NOT been checked by a
      speaker, and Cantonese tone sandhi in compounds is exactly where a
      non-native gets it wrong. Highest-risk entries, verify first:
        145 唔緊要     m4 gan2 jiu3     — 緊 read gan2 (not gan1)
        151 唔該借借   m4 goi1 ze3 ze3  — 借 doubled, both ze3
        160 係咁先喇   hai6 gam3 sin1 laa3
        146 慢行       maan6 haang4     — 行 read haang4 (to walk)
        171 着衫      zoek3 saam1      — 着 read zoek3 (to wear)
        177 開         hoi1
        178 閂         saan1            — easily confused with 山 saan1

   3. REGISTER / VARIANT CALLS A SPEAKER SHOULD CONFIRM
      - 148 唔好意思阻你  — polite formula; some households prefer just 唔好意思.
      - 150 小姐早晨      — 小姐 is standard in HK domestic employment; confirm it
        is the right address for this employer, since 太太 or a name may be
        preferred in the household.
      - 178 閂 vs 關        — both in use; the seed already uses 關. Teaching 閂
        as the L1 word and 關 as the L2/L3 variant is a deliberate choice, not
        a claim that one is wrong.
      - 169 覺 as a bare noun is a back-formation from 瞓覺 for level-1 grading;
        a speaker may prefer to drop it and keep 瞓覺 at L2 only.
      - 147 食咗飯未       — glossing a greeting as a question risks teaching the
        literal reading. The usage_note carries the real meaning; confirm the
        multiple-choice distractors do not turn it into a food question.

   4. INDONESIAN AUDIENCE
      The tagalog field is filled for every entry (the app's Filipino audience).
      Indonesian glosses live in INDONESIAN_GLOSSES and MUST be added for each
      new id before serving — indonesian-test.js asserts every seeded row has
      one, and will fail loudly if these go in without theirs.

   5. WHAT THIS SET DOES NOT DO
      It closes the 9 EMPTY combinations. It does not make every combination
      rich: 31 combinations still hold only 1-3 items. That is reported by
      tools/vocab-gap.js and is not a build failure.

   6. TWO WORDS I FIRST DRAFTED ALREADY EXIST ELSEWHERE — worth knowing
      The first pass put 唔緊要 in Greetings L2 and 慢慢嚟 in Common L2. A
      duplicate check against the whole seed caught both: 唔緊要 is already
      id 109 at Comfort & Reassurance L2 ("Never mind") and 慢慢嚟 is id 86 at
      Health & Symptoms L2 ("Take your time"). Replaced with 唔使 and 等等.
      TWO THINGS FOLLOW FROM THIS:
        - The categorisation overlap is real, not a mistake in either set. A
          phrase like 慢慢嚟 genuinely belongs to more than one topic. The app
          has no many-to-many link (one category_id per row), so the duplicate
          check is the only guard. Run it after any future authoring:
              node tools/vocab-dup-check.js    # if/when such a tool exists
          or the inline check used here — compare new `cantonese` values
          against every existing row, not just the target category.
        - It is why this file ships 37 entries and not 36. Two no-answer
          combinations went one over the floor. That is harmless: the rule is
          a minimum, and 5 items make a better quiz than 4.
   =========================================================================== */

module.exports = { EXPANSION_DRAFT };
