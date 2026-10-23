# CantoBuddy — Vocabulary: content architecture, structure, and scale

**Prepared:** 5 October 2026 · supersedes the 4 October draft
**Status:** Proposal for review. Two exceptions, marked inline:
- the admin **Categories listing** (§8.3) is **built and live** — `69fb05af8be7`
- the **category on/off switch** (§8.4) is **built and tested but NOT deployed** — held back
  deliberately, see §8.4

**Audience:** helpers caring for **elderly people** in Hong Kong
**Horizon:** thousands of users within three months
**Companion:** `PROPOSAL.md` (the CantoBuddy 2.0 revamp) — this sits inside it and changes none
of its decisions.
**Budget:** `COST-ESTIMATE.md` — what this costs to build (Phase 1 under HK$4,000; the full
~680-entry build HK$7,000–19,000 AI-assisted).

---

## 1. Who this is actually for — and why it changes the design

The brief contains one sentence that reshapes everything else:

> *Old people have communication problem between helper. Young people can speak english with the
> helper.*

That is not context. It is the design constraint, and it inverts the usual assumption behind a
language app.

**The usual assumption:** the learner wants to talk to the people around her, so teach a broad
survival vocabulary.

**The actual situation:** the helper's need for Cantonese is set by **one person**, and that
person cannot meet her halfway.

| Who she deals with | Language | Can she fall back to English? |
|---|---|---|
| **The elderly person she cares for** | Cantonese — often only Cantonese, and not always easy to follow | **No. There is no fallback.** |
| The adult children (her employers) | English | Yes, comfortably |
| Doctors, nurses, pharmacists | Cantonese-first; some English | Partly |
| Shops, taxis, neighbours, the building guard | Cantonese | No |

Everything except the elderly person can be negotiated in English. **So the app should not be a
general "Cantonese for helpers" course. It should be the vocabulary needed to care for someone
who cannot explain herself in a language you speak.** That is a much narrower, much more
teachable product — and it is a different product from what the current content implies.

Four consequences. Each one changes what gets built.

### 1.1 Comprehension matters more than production

The elderly person speaks *to* her. The helper's hardest moment is not "how do I say this" — it
is **"what did she just say?"** — and elderly speech is fast, quiet, mumbled, or slurred, often
with a hearing aid she has not adjusted and a television on.

So **listening should lead, not follow.** The app already has a `listen_choose` quiz type; it
should become the primary exercise for care vocabulary rather than one of four equals. A
"understand what she said" drill — play the phrase, pick the meaning — is closer to the real job
than any flashcard.

### 1.2 Phrases beat words

An elderly person says 「幫我攞杯水」 (get me a glass of water), not 「水」. She says 「我唔舒服」
(I don't feel well), not 「舒服」.

A single-word vocabulary list is the **wrong unit of teaching for this job**, and the schema has
no other unit — every entry today is one word with one emoji. This is the single biggest
structural gap in the brief, and §4 addresses it.

### 1.3 Reassurance is core vocabulary, not advanced vocabulary

With an elderly person who is confused, frightened, or in pain, the phrases that matter are not
transactional:

> 「我喺度」 I'm here · 「冇事嘅」 It's alright · 「醫生就嚟」 The doctor is coming ·
> 「你個女打過嚟」 Your daughter called

These are not "Advanced". They are what a frightened person needs to hear **today**, on day one.
A level system that files them behind Advanced is teaching the wrong thing first — and it is the
clearest argument for letting the operator control what learners see (§8.4).

### 1.4 The family is the reporting channel — so the app's job is asymmetric

The helper must be able to say what happened: *she didn't eat · she fell · she has a fever · she
refused her medicine.* She can do that **in English**, because the family speaks English.

So the app's job is not "translate everything". It is:

> **understand in Cantonese → report in English**

That is a specific, buildable feature (§7.5), and it is far more valuable than a general
translation tool. A "report to the family" scenario set, where each phrase pairs the Cantonese
she will *hear* with the English she will *say*, is the highest-value content in this document.

### 1.5 And one thing that follows from "thousands of users"

At 64 words, a wrong translation is embarrassing. At 3,000 words used by thousands of people
caring for elderly Hongkongers, **a wrong word is a safety issue.** The wrong word for
*medicine*, *fall*, *pain*, or *allergic* has consequences that a flashcard app for tourists
does not.

**Content review stops being a quality nicety and becomes a requirement.** See §9.4.

---

## 2. What exists today — measured, not remembered

Read out of the running code and a live database, not from notes.

| | |
|---|---|
| Vocabulary entries | **64** |
| Categories | **11** |
| Levels | 3 (Beginner / Intermediate / Advanced) |
| Fields per entry | `cantonese`, `jyutping`, `english`, `tagalog`, `emoji`, `level`, `category_id`, timestamps |
| Distribution by level | L1 = 20, L2 = 24, L3 = 20 |

No field is empty anywhere — all 64 entries have a Cantonese form, jyutping, English, Tagalog,
emoji, level and category. **The content that exists is clean. There is just very little of it,
and it is not arranged.**

### 2.1 The finding that matters: the coverage matrix is mostly holes

The same 64 entries, by category and level, generated from the live database:

| Category | Beginner | Intermediate | Advanced | Total |
|---|:--:|:--:|:--:|:--:|
| Greetings | 4 | — | — | 4 |
| Common | 6 | — | — | 6 |
| Kitchen | 5 | 1 | 3 | 9 |
| Elder Care | 5 | 9 | 5 | 19 |
| Cleaning | — | 2 | 1 | 3 |
| Children | — | 3 | 2 | 5 |
| Daily Life | — | 3 | 3 | 6 |
| Shopping | — | 2 | 2 | 4 |
| Home | — | 2 | 2 | 4 |
| Weather | — | 1 | 1 | 2 |
| Safety | — | 1 | 1 | 2 |
| **Total** | **20** | **24** | **20** | **64** |

33 cells (11 categories × 3 levels). Now:

- **11 of the 33 cells are completely empty.**
- **8 of 11 categories have no beginner content at all.** A learner who taps Beginner can browse
  4 categories; the other 7 give her an empty screen.
- **Greetings and Common have nothing above Beginner** — the first two categories a new learner
  meets are dead ends the moment she levels up.
- **Only 6 cells can produce a quiz at all.** The engine refuses to build a question set from
  fewer than 4 words, so only Greetings-L1 (4), Common-L1 (6), Kitchen-L1 (5), Elder Care-L1 (5),
  Elder Care-L2 (9) and Elder Care-L3 (5) qualify.
- **Exactly 1 cell is comfortably filled** (Elder Care-Intermediate, 9).

Of 33 possible combinations, **6 are usable and 1 is good.** Nothing in the product says so —
you find out by walking into a dead end.

Note also what the numbers already hint at: **Elder Care is 30% of all the content.** The
instinct that produced that was right. The taxonomy in §5 makes it deliberate rather than
accidental.

### 2.2 The quiz ignores categories entirely

`generateQuestions(type, level)` filters by **level only**:

```js
const pool = STATE.vocabulary.filter((v) => v.level === level);
if (pool.length < 4) return [];
```

Category is a *browse* filter; it never reaches the quiz. Two consequences:

- A learner who has been studying **Elder Care** cannot be quizzed on Elder Care. She gets ten
  random words from all 20 beginner words, which may include none of what she just studied.
- **Distractors are random from the whole level pool**, not the same category. So the wrong
  answers often come from a different topic — trivially eliminated, which makes the quiz feel
  easier than it is.

### 2.3 Progress never records the topic

`public/app.js` hardcodes the category on both write paths:

```js
// persistProgress(), line 869        // flushProgressBeacon(), line 896
category_id: 0,                       category_id: 0,
```

The `progress` table *has* a `category_id` column. It is always 0. Nothing reads it.

A two-line fix, but load-bearing: **per-topic quizzes, per-topic reporting and category-aware
review are all blocked on it.**

### 2.4 Progress cannot say *which* words were wrong

`progress` stores one row per quiz session — a score and a total. There is no `vocabulary_id`
anywhere in it.

So the system knows a learner scored 7/10. It cannot know she missed 「痛」 and 「覆診」 twice
running. **Every feature that depends on knowing what she personally struggles with — review,
spaced repetition, "words I got wrong" — is impossible on the current schema.** Not hard.
Impossible.

### 2.5 Order within a level is arbitrary

```js
listVocabulary: db.prepare('SELECT * FROM vocabulary ORDER BY level, id'),
```

`id` is insertion order — the order someone happened to type them in. A level is a **bag**, not a
**path**.

### 2.6 `fill_blank` is not really a blank

For levels 1 and 2 the question is built from a template, not a sentence:

```js
sentence = `______  (${item.jyutping})`;
blankAnswer = item.cantonese;
```

It renders as `______ (nei5 hou2)` with the answer among four Cantonese options — a
multiple-choice question in a fill-in-the-blank costume, which **shows the learner the jyutping
of the answer.** It is only a real exercise at level 3, and only because advanced entries happen
to be full phrases.

**This is the same problem §4 solves.** Once entries can be sentences, `fill_blank` has something
real to blank out.

---

## 3. The two problems, named separately

The request contains two different things and they should not be solved together.

**"Comprehensive" = depth per entry.** How much does one entry teach? Today: four translations and
an emoji. No example sentence, no part of speech, no measure word, no usage note.

**"Systematic" = a path through the content.** Does the learner know where she is, what comes
next, and what she has actually learned? Today: no. She picks a level, gets ten random words, and
her score never changes what she is shown next.

**Only the second is really missing, and it is the more important half.** But the brief adds a
third problem the original draft did not have — **the content is the wrong shape**, not just the
wrong amount (§4). That comes first, because getting the shape wrong makes every later decision
harder.

---

## 4. Entry types: the schema gap that blocks the brief

The brief asks for "scenario-based phrases — common phrases and sentences used in real-life
situations". The database cannot store one.

Every entry in `vocabulary` is assumed to be **one word with one emoji**. A phrase like
「幫我攞杯水」 is not that, and it behaves differently in every direction:

| Type | Example | Emoji? | `match_picture`? | `fill_blank`? | Review unit |
|---|---|---|---|---|---|
| `word` | 水 · seoi2 · water | yes | works | no | the word |
| `phrase` | 幫我攞杯水 · get me a glass of water | no | **meaningless** | possible | the phrase |
| `sentence` | 婆婆今日冇胃口，食咗好少 | no | **meaningless** | **this is the real use** | the sentence |

Today all three would be forced into the `word` shape, which means either an arbitrary emoji on a
sentence, or a separate table that loses the review machinery.

### 4.1 Proposed additions

```sql
ALTER TABLE vocabulary ADD COLUMN type TEXT NOT NULL DEFAULT 'word';      -- word | phrase | sentence
ALTER TABLE vocabulary ADD COLUMN speaker TEXT NOT NULL DEFAULT 'either'; -- helper | elderly | either
ALTER TABLE vocabulary ADD COLUMN scenario_id INTEGER REFERENCES scenarios(id) ON DELETE SET NULL;
```

- **`type`** — lets the quiz engine stop offering `match_picture` for a sentence, and lets
  `fill_blank` become real. It also lets the learner browse "phrases" as a distinct thing, which
  is what she actually wants at work.
- **`speaker`** — this is the field that encodes §1's asymmetry. It answers: **am I learning to
  say this, or to understand it?** 「幫我攞杯水」 is something she *hears*. 「我喺度」 is something
  she *says*. The two need different drills, and without this field the app cannot tell them
  apart.
- **`scenario_id`** — groups phrases into situations.

### 4.2 Scenarios are a grouping, not an entry

A scenario is a *set* of phrases, so it needs its own table rather than being a value on an
entry:

```sql
CREATE TABLE scenarios (
  id          INTEGER PRIMARY KEY,
  name_en     TEXT NOT NULL,
  name_yue    TEXT NOT NULL DEFAULT '',
  name_fil    TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT '💬',
  description TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  enabled     INTEGER NOT NULL DEFAULT 1
);
```

Modelled on `categories` deliberately — same shape, same `enabled` switch, so the operator
manages both the same way and the admin code for one works for the other.

**Why phrases belong in `vocabulary` rather than their own table:** the review queue, the
progress records and the spaced-repetition state all key on one content pool. Splitting phrases
into a separate table means either duplicating that machinery or leaving phrases out of review —
and phrases are the content that most needs reviewing. One pool, distinguished by `type`.

---

## 5. The content architecture — an elderly-care-first taxonomy

The brief lists categories (household chores, food and groceries, family members, emergency
phrases, shopping and transactions) plus "cooking & food, actions to do, the locations of
positions of the item, all house works". Below is a tree that covers all of it, **ordered by
what the job actually demands** rather than by topic convenience.

Tier A is first because §1 says it is the reason the helper is there. Today it is one category
out of eleven.

### Tier A — Caring for the person *(the reason she is employed)*

| # | Category | Today |
|---|---|---|
| A1 | Elder Care Basics | ✅ **Elder Care** (19 words) — keep, expand |
| A2 | Health & Symptoms — pain, dizzy, fever, cough, nausea | **new** |
| A3 | Medicine & Appointments — dosage, after meals, clinic, follow-up | **new** |
| A4 | Mobility, Walking & Falls — hold my arm, slowly, the wheelchair, don't get up | **new** |
| A5 | Toilet & Personal Care — bathroom, help me, wash, change | **new** |
| A6 | Meals & Feeding — appetite, too hot, too hard, eat more | partly in **Kitchen** |
| A7 | Comfort & Reassurance — I'm here, it's alright, your daughter called | **new** |
| A8 | Emergency & Urgent — call an ambulance, she fell, she can't breathe | ✅ **Safety** (2) — far too small |

### Tier B — Running the home *("all house works")*

| # | Category | Today |
|---|---|---|
| B1 | Cooking & Food | ✅ **Kitchen** (9) — keep, expand |
| B2 | Kitchen Tools & Utensils | **new** |
| B3 | Groceries & Market — quantities, weights, fresh, cheap | **new** |
| B4 | Cleaning & Chores | ✅ **Cleaning** (3) |
| B5 | Laundry & Ironing — wash separately, delicate, hang up | **new** |
| B6 | Home, Rooms & Furniture | ✅ **Home** (4) |
| B7 | **Locations & Positions** — on, under, beside, inside, behind | **new** |
| B8 | Household Items & Appliances | **new** |

> **On Locations & Positions** (asked for explicitly): these are close to useless as isolated
> words and essential as **patterns**. 「喺檯上面」 is *on the table*; the teaching unit is the
> frame 「喺___上面」 with items substituted, not a list of prepositions. This is a category that
> should be **built from phrases** (`type='phrase'`), and it is the clearest example of why §4
> has to come first.

### Tier C — Actions and instructions *("actions to do")*

| # | Category | Today |
|---|---|---|
| C1 | Daily Actions — verbs: take, put, open, close, turn, wait, help | partly **Daily Life** (6) |
| C2 | Instructions & Requests — the imperative forms the elderly use constantly | **new** |

> **On actions:** the helper mostly needs to *recognise* instructions, not conjugate verbs.
> 「攞」 (take/get) and 「放」 (put) carry most of a day. Worth resisting the urge to build a
> verb-conjugation feature — Cantonese verbs do not conjugate, and a helper does not need grammar,
> she needs to understand 「放喺邊」 (where do I put it).

### Tier D — Living in Hong Kong

| # | Category | Today |
|---|---|---|
| D1 | Greetings & Politeness | ✅ **Greetings** (4) |
| D2 | Family Members | **new** |
| D3 | Numbers, Money & Time | **new** |
| D4 | Transport & Getting Around | **new** |
| D5 | Shopping & Transactions | ✅ **Shopping** (4) |
| D6 | Weather & Seasons | ✅ **Weather** (2) |
| D7 | **Hong Kong Festivals** | **new** — see §6 |
| D8 | Emergencies & Public Services | **new** |

### Tier E — Scenario phrase sets *(the new content type from §4)*

| # | Scenario | Speaker focus |
|---|---|---|
| E1 | **Asking for help** | helper says |
| E2 | **Understanding a request** | helper hears |
| E3 | **Reporting to the family** | helper hears (Cantonese) → says (English) |
| E4 | At the clinic / hospital | both |
| E5 | On the phone | helper hears |
| E6 | Emergency | both |
| E7 | Reassurance & orientation | helper says |
| E8 | Festival greetings | helper says |

**E3 is the highest-value set in the whole document.** It is the one scenario where the app does
something no phrasebook does: it teaches the helper to *understand* what she saw in Cantonese and
*say* it in English. It is also the set that most directly serves the elderly person, because it
is what gets her the right care.

### 5.1 What this means for the coverage target

The tree above is **24 categories + 8 scenario sets**. At the minimum viable 8 words per
category-level cell (§7.2), 24 categories × 3 levels × 8 = **576 entries**, plus scenario sets of
roughly 10–15 phrases each ≈ **100 more**. So ~**680 entries** for a fully covered curriculum —
against 64 today.

That number is the honest size of the job, and it is a content project measured in months. It
should not be attempted as one push. §10 sequences it.

---

## 6. Hong Kong Festivals

Worth its own note because it is the one category that is **calendar-bound**, and because it is
more practical than it sounds.

**Why it matters for this audience specifically.** Festival food is usually the helper's job —
年糕 and 蘿蔔糕 at Lunar New Year, 月餅 at Mid-Autumn, 粽 at Dragon Boat, 湯圓 at Winter Solstice.
She is also the person who has to shop for it, and who receives the family's guests. And she will
not know when any of it falls, because the dates are lunar.

**So the category should carry three things:**

1. **Festival greetings she can offer** — a small, high-status set. Getting this right earns real
   goodwill in a household.
2. **The food and what it is** — names, and the fact that it is seasonal.
3. **When it is** — a "next festival" indicator, because a lunar calendar is genuinely opaque to
   someone who did not grow up with it.

**Design note:** festival content is the natural pairing for the daily/weekly sets in §7.4. A
Mid-Autumn set that surfaces in the two weeks before Mid-Autumn is worth ten times the same set
in March. That argues for **`available_from` / `available_to` on a set**, so seasonal content can
be scheduled rather than manually switched on and off — which is exactly the kind of thing the
category `enabled` switch (§8.4) handles well, applied to time.

---

## 7. Making it comprehensive and systematic

### 7.1 Depth per entry

The existing migration helper makes this cheap and safe — `addColumnIfMissing()` is idempotent
and runs on the production database every boot, so each of these is one line:

```js
addColumnIfMissing('vocabulary', 'example_yue', "TEXT NOT NULL DEFAULT ''");
```

| Field | What it gives the learner | Unlocks | Cost to fill |
|---|---|---|---|
| `example_yue` / `example_jyutping` / `example_en` | The word used in a real sentence | **A real `fill_blank`** (§2.6) | High — 3 fields per entry |
| `pos` | Noun, verb, adjective, phrase | Grammar-aware grouping | Low |
| `measure_word` | 個 / 隻 / 條 … | One of the hardest things for a learner | Low |
| `usage_note` | Formal? Polite? Only to children? Rude? | Prevents unintended rudeness — **this matters a lot with an elderly person** | Medium |
| `related_ids` | 你好 ↔ 早晨 ↔ 晚安 | Word families instead of isolated items | Medium |
| `tags` | `polite`, `question`, `imperative`, `care` | Filtering, targeted drills | Low |
| `frequency_rank` | Most useful first | **Ordering within a level** (§7.2) | Medium |
| `sort_order` | Explicit curriculum position | Manual control of the teaching sequence | Low |
| `audio_url` | A human voice, not TTS | Real pronunciation | **High — recording 680+ entries** |
| `status` | `draft` / `published` | **Stage unreviewed content safely** — see §9.4 | Trivial |

**The schema is the cheap part. Filling it is the expensive part.** Ten columns is an afternoon
and carries no risk — they default to empty. But `example_yue` on 680 entries is 680 sentences
that must be *correct Cantonese*, with matching jyutping and English, plus Filipino. That is
translation and proofreading, and it is the real budget line.

**Recommendation:** add the columns now, let them be empty, and add content incrementally. An
entry with an empty `usage_note` is fine — the learner screen simply omits that line, exactly as
it already does with `tagalog`. Then give the admin a **completeness indicator per entry** so
filling content becomes a visible, plannable job instead of a vague intention.

### 7.2 Order, and a coverage target that is a checklist

**Order.** Today: `ORDER BY level, id` — insertion order. Proposed: `ORDER BY level, category_id,
sort_order, id`, with `frequency_rank` seeding it and the operator able to override any position.
The difference between "here are 20 words" and "here is today's set, and you are 6 words in" is
the difference between a reference and a course.

**Coverage target.** From §2.1, 11 of 33 cells are empty and only 6 are usable. Concrete targets:

| Cell target | Entries | Why |
|---|---|---|
| **Minimum viable** | **8** | Enough for a 10-question quiz without repeats |
| **Comfortable** | 12–15 | Two different quizzes from one topic |
| **Full course** | 20+ | Every category viable at every level |

**And until the gaps are filled, the app must not pretend.** A category with no content at a level
should be **hidden or visibly disabled at that level**, not a door onto nothing. Small change,
worth doing now, independent of the content work.

**Spend the effort where it removes a visible defect.** A beginner can currently browse 4
categories. Getting **every** category to beginner level is the smallest change that means no
learner ever taps into an empty screen. Do that first, then work up.

### 7.3 Per-word mastery, and then spaced repetition

This is the structural change that makes the app teach rather than test.

```sql
CREATE TABLE learner_word_state (
  learner_id    INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  vocabulary_id INTEGER NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  seen          INTEGER NOT NULL DEFAULT 0,
  correct       INTEGER NOT NULL DEFAULT 0,
  wrong         INTEGER NOT NULL DEFAULT 0,
  streak        INTEGER NOT NULL DEFAULT 0,   -- consecutive correct answers
  last_seen_at  TEXT,
  due_at        TEXT,                          -- when to show it again
  PRIMARY KEY (learner_id, vocabulary_id)
);
CREATE INDEX idx_lws_due ON learner_word_state(learner_id, due_at);
```

One row per learner per entry. Each entry then has a state she can see — **New** (never answered),
**Learning** (answered, not yet reliable), **Learned** (several correct in a row, spaced out).

What it unlocks, in order of how soon it pays off:

1. **"Words I got wrong"** — a list she can review. Immediately useful, no scheduling needed.
2. **Review mode** — a quiz drawn only from her weak entries. The single most wanted thing a
   learner wants, and the app cannot do it today.
3. **Spaced repetition** — `due_at` scheduling so learned entries reappear before they are
   forgotten. The well-established mechanism; what turns ten minutes a day into retention.
4. **Honest progress** — "142 of 680 learned" instead of a score with no denominator.

**Three rules, each learned from how this usually goes wrong:**

- **A correct answer means *first try*.** Answering wrong then right must not mark an entry
  learned. This is the most common way an SRS gets quietly wrong — it counts a lucky retry as
  knowledge.
- **Phrases and words share one queue.** A care phrase she cannot understand is more urgent than
  a noun she has half-learned. Two separate queues would let the phrases starve.
- **Keep it additive.** `progress` stays exactly as it is — credits, stickers and the
  employer-facing reports all read from it. `learner_word_state` is a *second* record answering a
  different question. Nothing that works today is rebuilt to get this.

**A note on precision:** learner identity is a **device token**, not an account (deliberately, so a
helper can use the app without signing up). Mastery state is therefore per-device — a good-enough
signal, not an exact record.

### 7.4 Daily and weekly sets — two different mechanisms, deliberately separated

The brief asks for "daily or weekly vocabulary sets for learners to focus on". This is worth
doing, but it is **not** the same thing as spaced repetition, and conflating them makes both
worse.

| | **Today's set** | **Your review** |
|---|---|---|
| Whose | **Everyone's** — the same set for all learners | Personal |
| Driven by | The calendar | Her own mastery state (§7.3) |
| Purpose | **A habit** — a reason to open the app | **Retention** — beat forgetting |
| Source | A deterministic slice of the curriculum | Entries she got wrong or is due to revisit |

**Both, kept separate.** A global daily set creates a shared rhythm — and for a dispersed
audience of helpers who may not know each other, "today's ten words" is a small but real social
object. Personal review is the thing that actually makes her remember.

**Two implementation rules that matter:**

- **Derive it, don't store it.** `today's set = slice(curriculum, dayIndex)` — no table, no
  nightly job, nothing to fall out of sync. Seeded from the **Hong Kong date** (UTC+8), matching
  the convention already used for day-bucketing elsewhere in the project.
- **It must be stable within the day.** If the operator adds a word at noon, learners must not
  see their set change under them. Deriving from `sort_order` positions (a fixed slice of the
  ordered curriculum) achieves this; deriving from a re-sorted list does not.

**Weekly sets** are the same mechanism with a longer slice — and the natural home for the seasonal
festival content in §6.

### 7.5 The reporting feature (from §1.4)

The one feature that follows directly from the audience insight, and that nothing in the current
product does:

> **She hears Cantonese. She reports in English.**

A scenario set where each item pairs what she will *hear* (「佢今日冇食嘢」) with what she should
*say* (She didn't eat today), drilled in that direction. This is not translation — it is
**comprehension plus reporting**, and it is the thing that gets the elderly person the right care
when the family comes home.

Build it as scenario E3, with `speaker='elderly'` on the heard side and a drill type that plays
the Cantonese and asks her to pick the English report.

### 7.6 Quiz upgrades

In dependency order:

| Change | Depends on | Effect |
|---|---|---|
| **Persist `category_id`** | nothing — 2 lines | Unblocks all of the below |
| **Category-aware quizzes** | above | "Quiz me on Elder Care" actually works |
| **Distractors from the same category** | above | Wrong answers become plausible, so the quiz measures knowledge |
| **`listen_choose` becomes the lead drill for care vocabulary** | nothing | Matches the real job (§1.1) |
| **Suppress `match_picture` for phrases and sentences** | `type` (§4) | Stops asking her to match a sentence to an emoji |
| **Real `fill_blank`** | `example_yue` | A genuine blank in a genuine sentence |
| **Stop showing jyutping in the blank** | nothing | Removes the answer leak in §2.6 |
| **Adaptive draw** | `learner_word_state` | Weight questions toward weak entries |
| **Review mode** | `learner_word_state` | Practise only what she got wrong |

The first three are the highest value per line of code in this document — small, no new content,
and they fix a learner-visible oddity: studying a topic and then not being quizzed on it.

### 7.7 Learner-facing browse

1. **Search** across Cantonese, jyutping, English and Filipino — cheapest, and it is what people
   reach for when they want one specific word at work, which is the real usage moment.
2. **Learned / learning / new marking** on each card (from §7.3).
3. **"Practise my weak entries"** as a first-class entry point on the home screen.
4. **Favourites** — helpers ask for "the words I use at work".
5. **Recently viewed.**

---

## 8. Admin: listings, and control over what learners see

### 8.1 What the admin actually shows today

Measured by signing in and screenshotting both content screens, because "matrix" and "listing"
are both plausible readings of the same page.

**Vocabulary tab — already a list, but a poor one.** A single column of 64 tall cards at every
width (measured: one grid column, 680px, at 1280px viewport). Two problems: **Tagalog is not
rendered at all**, so the Filipino content cannot be proofread; and 64 cards is roughly 64 screens
of scrolling with no column alignment.

**Categories tab — the matrix.** A 4-across tile grid (measured: four 162.5px columns), each tile
carrying the name and nothing else. **The one number that matters — how many words are in this
category — was nowhere on the screen.**

### 8.2 Proposed vocabulary listing

Replace the cards with a **data table** — the shape anyone expects for "many rows of similar
records": sortable columns, **all fields visible including Filipino**, the existing level filter
and search extended to Filipino, pagination (free now, expensive at 3,000 rows), a compact row
density for proofreading sessions, inline edit for the common case, **bulk select** (moving 20
words into a new category should be one action, not 20), and a **completeness column** so content
debt is visible and sortable.

### 8.3 Category listing — ✅ **built and live**

> Shipped in commit `69fb05af8be7`, service worker `cantobuddy-v27`. The tile grid is gone.
> Verified against the API by `tools/ui-admin-categories.js` (36 assertions, sabotage-tested) and
> confirmed to load and run on production by `tools/prod-admin-check.js`.

Each category is a single row carrying the order, icon, English name, **Cantonese and Filipino**
names, the **total word count**, and the **per-level split flagged against the quiz engine's own
threshold** (`QUIZ_MIN = 4`, mirroring `if (pool.length < 4) return []` in `app.js`). Red = no
words, amber = too few to quiz, green = usable.

On current content the flags read **11 empty, 16 below minimum, 6 usable** — the coverage problem
from §2.1, on the screen, without running a script. Counts are derived from the vocabulary the
admin already loads, so it adds **no request** and cannot drift from what the API serves.

### 8.4 Category on/off switch — ⚠️ **built and tested, NOT deployed**

The brief asks that "admin can enable and disable different categories". It is built:

- `categories.enabled` column, added idempotently in `migrateSchema()`
- `GET /api/categories` and `GET /api/vocabulary` branch on the session role — **the operator sees
  everything** (or they could never switch a category back on), a learner sees only what is on
- A switch on each admin row, `role="switch"` + `aria-checked`, with a confirmation that says
  what will happen rather than "are you sure?"
- **Nothing is deleted.** Words, and progress already earned against them, survive; switching
  back on restores it exactly

**The design point that matters:** "off" filters the **vocabulary pool**, not just the category
list. The quiz draws its questions from that pool, so hiding a category alone would leave
learners still being tested on a topic the app had removed from the menu — worse than not having
the feature. Sabotaging exactly that filter failed the right assertions, reporting **"leaked 19"**
words into the level quiz pool.

**Verified:** `tools/category-toggle-test.js` (25 assertions) and `tools/ui-admin-categories.js`
(36 assertions) — including that the switch survives a restart, that the operator still sees
disabled categories, and that deleting a category leaves its words reachable rather than hidden.

**Why it is not deployed.** While this was being built, a **concurrent session added `seo.js` and
wired it into `server.js`**. At the time the server did not boot at all (`store.countVocabulary is
not a function`); that session has since fixed it, and the server boots again. But **`seo.js` is
not in the deploy file list**, so pushing right now would ship a `server.js` that cannot resolve
its own dependency and **take production down**. The only reason that cannot happen by accident is
that `public/robots.txt` was deleted while still being listed, so the deploy pre-flight refuses to
run.

**So the switch is held, deliberately** (your call). It goes out once the SEO work is either
finished and added to the deploy list, or reverted. Do not deploy until `node server.js` boots and
`/api/vocabulary` returns 200.

### 8.5 The coverage report — the operator's view of "systematic"

Everything in §2.1 had to be computed by hand in a script. **It should be a screen.**

A **Coverage** view: the category × level grid, each cell showing its word count and shaded by
distance from the target in §7.2. Plus a summary line — *"18 of 33 cells can produce a quiz"*.

This is the highest-value admin addition in this document and it costs almost nothing: the query
is a `GROUP BY category_id, level`, and the data already exists. It turns "the content feels thin"
into **"here are the 11 empty cells, in priority order"** — a work queue instead of a worry. It is
also what makes the content work and the structure work one project instead of two.

With §5's tree it extends naturally to **coverage across 24 categories**, which is where it
becomes genuinely load-bearing rather than merely useful.

### 8.6 Content review — needed before the content scales, not after

From §1.5: at 3,000 entries used by thousands of carers, a wrong word is a safety issue.

The `status` field (`draft` / `published`) is trivial to add, and it is the thing that makes a
review step possible at all. Concretely:

- New entries land as `draft` and **do not reach learners** until published
- The admin listing filters by status, so "what still needs checking" is a view, not a memory
- Where Filipino is unverified, **flag it and fall back to English** rather than show confident
  wrong Filipino — many helpers read English, and in a care context a wrong word is not cosmetic

---

## 9. Scale: thousands of users within three months

The brief sets a horizon of thousands of users in three months. Most of this stack scales for
free; a small number of things do not, and one is a genuine risk.

### 9.1 What actually breaks: the vocabulary payload

`GET /api/vocabulary` returns **every row, unfiltered and unsorted**, with no pagination. At 64
words that is a few KB. At the ~680 entries in §5.1 it is roughly **150 KB**; at 3,000 it is
**600–700 KB of JSON on every app load, for every user.**

For a helper on a mid-range Android over Hong Kong mobile data, that is a second or two of
loading and a few hundred KB of data — every single time she opens the app. Multiplied by
thousands of users it is also a real bandwidth bill.

**This is the first thing to fix, and it is already latent** — the admin has the same problem
worse, because it loads the whole table into a browser.

Fixes, in order of effort:

1. **Serve only what the screen needs** — the browse view is paginated by category and level
   anyway, so the client should ask for that rather than everything.
2. **Send a compact shape.** The admin needs ten fields; the learner card needs five.
3. **Cache it.** Vocabulary changes rarely. An `ETag` on a content version number turns almost
   every request into a 304.

### 9.2 Database size and writes

- **SQLite in WAL mode** handles many readers plus one writer, which matches this app: reads
  dominate, writes are short.
- **`learner_word_state` is the growth.** Thousands of learners × hundreds of entries = millions
  of rows. Fine for SQLite with the right index, but it is what makes the file grow, so the disk
  limit is worth knowing before it is a surprise rather than after.
- **Do not write per answer.** A quiz is 10 answers; writing each one is 10 transactions where 1
  would do. Upsert the whole quiz's state once at the end — the app already batches progress this
  way, and the same pattern applies.
- **Sessions** already carry an expiry index; they need periodic pruning at scale.

### 9.3 Backups — the actual risk

**This is the one that should worry you most, and it is not about load.** Losing this database
means losing the learning history of every user. At 64 words and a handful of users that is a bad
afternoon; at thousands of users it is the product.

The project already has a correct snapshot primitive — `VACUUM INTO`, which is the right way to
copy a live SQLite database (copying the file alone can miss recent writes). What is missing is
that **a snapshot sitting on the same disk is not a backup.** It protects against a bad migration,
not against losing the disk.

Before the user numbers arrive: an **automated snapshot copied off the host on a schedule**, and
**a restore that has actually been tested.** An untested backup is a belief, not a backup.

### 9.4 Content review is a scale problem, not just a quality one

Covered in §8.6, repeated here because it belongs to the scale story: at 64 words a typo is
embarrassing; at 3,000 words in an elderly-care context it is a safety issue, and it reaches
thousands of people before anyone notices. **The review workflow is part of the scale plan.**

### 9.5 What scales for free

- **Text-to-speech** is client-side (Web Speech API) — thousands of users cost nothing.
- **Static assets and the app shell** go through Cloudflare and a service worker.
- **The service worker** means a returning learner re-downloads almost nothing.
- **`node:sqlite`** has no per-query cost and no vendor to grow into.

### 9.6 One structural note

The app runs as a **single instance with a local SQLite file on a persistent disk**. That is a
genuinely good fit for this product — cheap, no vendor, no cold-start. It also means there is no
redundancy: a restart is a brief outage, and the disk is a single point of failure. That is an
acceptable trade at this size, but it should be a **decision that is revisited deliberately** when
user numbers arrive, rather than discovered by an outage.

---

## 10. Suggested sequencing

Ordered so cheap structural work lands first, the expensive content work lands last, and every
step leaves the app working.

| # | Work | Size | Why here |
|---|---|---|---|
| 1 | **Persist `category_id`** (2 lines) | Trivial | Unblocks everything category-aware |
| 2 | **Hide/disable empty category-level combinations** | Small | Removes a visible defect, no content needed |
| 3 | **Coverage report in the admin** (§8.5) | Small | Turns the content gap into a work queue |
| 4 | ✅ **Category listing** — **done**, live as `69fb05af8be7` | — | Already shipped |
| 4b | ⚠️ **Category on/off switch** — built, **held** (§8.4) | — | Deploys once the SEO work is resolved |
| 5 | **`type` + `speaker` + `scenarios`** (§4) | Medium | **Everything phrase-related depends on this** |
| 6 | **Admin vocabulary table** (§8.2) | Medium | Makes the content work fast — before writing 680 entries, not after |
| 7 | **Category-aware quizzes + same-category distractors** | Small | Biggest learner-visible win per line |
| 8 | **`learner_word_state` + "words I got wrong" + review mode** | Medium | The app starts teaching, not just testing |
| 9 | **New vocabulary fields** (§7.1) | Small | Cheap, and unblocks 10 |
| 10 | **Fix the vocabulary payload** (§9.1) | Small | Do it before it is urgent, not after |
| 11 | **Backups, off-host and restore-tested** (§9.3) | Small | Before user numbers arrive |
| 12 | **Fill the content** — Tier A first (§5.1) | **Large — content** | The real project |
| 13 | **Today's set / weekly sets** (§7.4) | Medium | Needs an ordered curriculum to slice |
| 14 | **Festival content + scheduling** (§6) | Medium | Needs §5 and §13 |
| 15 | **Reporting feature** (§7.5) | Medium | Needs §5 and §8 |
| 16 | **Tone drills, search** | Medium | Once there is content worth searching |

**Four things worth noting about this order.**

- **Step 5 comes before step 12 deliberately.** Getting the content *shape* right before writing
  680 entries is the difference between one content project and two.
- **Step 6 precedes step 12** — build the tool before writing the words, not after.
- **Steps 10 and 11 are placed before the user numbers arrive**, not after. Both are cheap now
  and expensive later; one of them (backups) is the difference between an incident and a loss.
- **Step 12 is Tier A first.** Making elderly care properly covered matters more than making all
  24 categories equally thin.

---

## 11. What I would not do

- **Not add ten fields and fill none.** A field ships with a completeness indicator and a plan to
  fill it, or it does not ship.
- **Not build phrases into a separate table.** They belong in the same review pool as words, or
  they never get reviewed — and they are the content that most needs reviewing.
- **Not build spaced repetition before `learner_word_state` exists.** SRS needs per-entry history;
  doing it first means inventing a worse version of that table.
- **Not count a retry as "learned".** First-try-correct only. It is the most common way an SRS is
  quietly wrong.
- **Not merge the daily set with spaced repetition.** One is a habit, one is retention; a single
  mechanism does neither well.
- **Not teach verb conjugation.** Cantonese verbs do not conjugate, and a helper does not need
  grammar — she needs to understand 「放喺邊」.
- **Not machine-translate hundreds of entries into Filipino.** In a caregiving context a wrong
  word is not a cosmetic bug. English is a safer fallback than confident bad Filipino.
- **Not record real audio yet.** TTS works and is free at any scale. Design the field, defer the
  680-entry recording project.
- **Not rebuild `progress`, or touch credits and stickers.** They work, the employer reports read
  from them, and credits are deliberately derived rather than stored.
- **Not turn the admin into a spreadsheet.** Sorting, filtering and bulk actions is the goal;
  formulas and free-form columns are a different, worse product.
- **Not ship unreviewed content to learners.** Draft status exists for exactly this.

---

## 12. Open questions

1. **Where does the content come from?** ~680 entries of correct Cantonese with real sentences
   and verified Filipino. Written in-house, commissioned from a Cantonese speaker, or adapted
   from an existing open list? **This is the largest decision in the document and it is not a
   technical one.**
2. **Who reviews it?** §9.4 argues a review step is required, not optional. Is there someone who
   can verify Cantonese and Filipino, or should unverified content be flagged and held back?
3. **Is the helper's own Cantonese level known?** "Beginner" means something different for
   someone who has been in Hong Kong five years and speaks a little, versus someone who arrived
   last month. It changes whether level should be self-selected or assessed.
4. **Is per-entry mastery worth the storage?** One row per learner per entry. At 3,000 learners ×
   680 entries that is ~2M rows — fine for SQLite, but worth knowing before it is a surprise.

---

## 13. Summary

**The audience changes the product.** The helper's Cantonese requirement is set by one person —
the elderly person she cares for, who cannot meet her in English. Everything else in her day can
be negotiated in English. So this is not a general "Cantonese for helpers" course; it is **the
vocabulary needed to care for someone who cannot explain herself in a language you speak.**
Comprehension matters more than production. Phrases beat words. Reassurance is core vocabulary,
not advanced vocabulary. And the app's real job is asymmetric: **understand in Cantonese, report
in English.**

**The content is the wrong shape before it is the wrong size.** The database cannot store a
phrase — every entry is one word with one emoji — so "scenario-based phrases" cannot be built at
all today. That is the first thing to fix, before any content is written, because getting the
shape wrong makes every later decision harder. It also fixes `fill_blank`, which is currently a
multiple-choice question in disguise.

**The content is also far too thin, and that is measurable.** 64 entries across 33 category-level
combinations: 11 cells empty, 8 of 11 categories with no beginner content, only 6 cells able to
produce a quiz, and exactly 1 comfortably filled. The full tree in §5 is 24 categories plus 8
scenario sets — roughly **680 entries**. That is a months-long content project, not an afternoon,
and the proposal is mostly about building the tooling that makes it possible and getting out of
its way.

**The learner side needs structure before it needs depth.** Persisting `category_id` is two lines
and unblocks category quizzes. A per-entry mastery table is what makes review, "words I got
wrong" and spaced repetition possible at all — and today the system literally cannot know which
words a learner got wrong. Those two changes do more for how the app feels than doubling the
entry count would.

**The admin is half done.** The Categories listing is live and shows the coverage problem on the
screen; the on/off switch is built and tested but held back because a concurrent change to
`server.js` would take production down if deployed (§8.4). Still open: the vocabulary table, and
the coverage report that turns §2.1's numbers into a work queue.

**And at thousands of users, two things stop being optional.** The vocabulary endpoint currently
returns every row to every client — fine at 64 entries, 600KB per app load at 3,000. And a
snapshot on the same disk is not a backup: losing this database means losing every user's
learning history. Both are cheap now and expensive later, and one of them is the difference
between an incident and a loss.
