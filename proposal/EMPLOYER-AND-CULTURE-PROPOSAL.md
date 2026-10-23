# CantoBuddy — Three Proposals

**Prepared:** 11 October 2026
**Status:** Proposal for review. **Nothing here is built yet.** Point 1 needs one decision from
you before any code is written, because it touches money — see §1.6.
**Answers:** three requests — (1) an employer/helper introduction, (2) a Hong Kong culture session,
(3) a Hong Kong festivals session.

---

## Executive summary

| # | Request | Verdict | Effort | Blocker |
|---|---|---|---|---|
| 1 | Employer↔helper guide | **Yes — the biggest gap on the site.** A `/for-employers` page plus one guide | ~1 session | One decision: does the employer give **money**? (§1.6) |
| 2 | HK customs & culture session | **Yes, but not as a vocabulary category.** A *guide*, not 20 words | ~1 session | Needs native review of etiquette claims |
| 3 | HK festivals session | **Yes, and it is the stronger of the two** | ~1 session | Calendar dates need annual upkeep |

**The one thing to read if you read nothing else:** points 2 and 3 are **not vocabulary categories**.
They are articles. I explain why in §2.3 and §3.3 — and it is the same reason in both cases.
Vocabulary in this app is a word you say to someone; culture is a thing you understand. Putting
"don't point at people with chopsticks" in a quiz with audio and a sticker would be a category error
and would dilute the library.

---

## 1. The employer side — the biggest gap on the site

### 1.1 What you asked for

> *Employer can connect to the helper and know the learning progress. Employer can be the starter for
> helper to learn and maybe give helper bonus. The site has no guideline or intro for this.*

### 1.2 What I found — the feature exists, the explanation does not

The employer portal **already works**. `public/portal.html` + `portal.js` (33 KB) support:

- employer sign-in, and a set-password flow
- **invite a helper** — by shareable link *or* a spoken code, "codes leave out 0/O and 1/I so they are
  never misheard" — with an optional note (*"Please practise the Elder Care words"*)
- a per-helper card showing accuracy %, a progress bar and **View progress**
- **disconnect**, which stops the employer seeing progress and leaves the helper's learning intact

But I checked the public site, and:

- **`/for-employers` → 404. `/employers` → 404.** There is no employer-facing page of any kind.
- All four existing guides are written **to the helper**, not the employer:
  `learn-cantonese-for-domestic-helpers` · `cantonese-for-elderly-care` · `cantonese-vs-mandarin` ·
  `learn-cantonese`
- The portal itself is only reachable if you already know the URL.

**So the feature you described exists and is invisible.** Nobody can find it, and nobody who finds it
is told what it is for. That is the whole of the gap, and it is a real one: an employer who never
learns the portal exists will never invite a helper — which is the exact mechanism you want.

One more thing worth saying plainly: **the employer is the one who would pay.** Your project already
decided "learners are never charged; the employer side is monetised." The employer is therefore both
your acquisition channel *and* your revenue, and right now there is nothing on the site addressed to
them at all.

### 1.3 What to add

**A. `/for-employers` — a new public page.** The one page a Hong Kong employer would find by
searching *"how can my helper learn Cantonese"*. Contents, in this order:

1. **The problem, stated honestly.** "Most helpers arrive speaking English and learn Cantonese on the
   job — usually from the person in the household who speaks English least. If your mother is the one
   at home all day, she is the one your helper cannot talk to." (This is already written, in
   `facebook-hk-groups.html` Post D — it is the right opening and it is not currently anywhere on the
   site.)
2. **What CantoBuddy is** — free, no sign-up, works offline, audio + quizzes.
3. **How to connect with your helper** — the four real steps, with the code-vs-link choice explained.
4. **What you can and cannot see.** Say it before they worry: progress and accuracy only. **Never**
   her quiz answers word by word, never her feedback, never anything else. She can disconnect at any
   time and keeps all her progress.
5. **How to encourage without spying** — the part that makes it work, below.
6. **Sign in** → `/portal.html`.

**B. A guide: `getting-your-helper-started-with-cantonese`** — the longer argument, for the employer
who is willing to read. This is where the encouragement advice lives, because it is genuinely
non-obvious and it is the thing that decides whether the invite changes anything.

**C. Link it from the places that already exist** — the guide hub, the footer, and the share page.
A page nobody links to is a page nobody finds.

### 1.4 "Employer can be the starter for helper to learn"

This is the strongest idea in your three requests and it is **already half-built**: the invitation
carries a *note*. What is missing is guidance on using it. The advice I would give the employer:

- **Name one thing, not five.** "This week, the Elder Care words" beats "please study" — the note is
  400 characters and the temptation is to use them all.
- **Invite at the right moment.** During the first week, not the first day; she is overwhelmed with
  the household, and an app request on day one reads as more work.
- **Ask her to set it up herself.** The invite is accepted on *her* phone, from *her* choice.

### 1.5 ⚠️ "Maybe give helper bonus" — read this before anything is built

**I did not write this into the draft, and I want to flag why, because it is a genuine fork.**

I searched the codebase. There is **no payment system, no wallet, no bonus field, and no money
anywhere**:

- the only table resembling this is `learner_stickers` + credits — and **"credits" here are learning
  points (one per correct quiz answer), not money.** They unlock stickers.
- there are 4,320 word pages and no transaction of any kind.

So "bonus" can mean two very different things, and they cost wildly different amounts:

**(a) Recognition, not payment — "the helper's progress is visible, so you can reward her yourself."**
This is what a guide can say today, with **zero code**: sign in, see that she has practised 6 days in
a row, and hand her the HK$100 yourself at the end of the month. Nothing is stored, nothing is
promised, nothing can break. **This is what I would ship first.**

**(b) A real paid-incentive feature** — employer tops up a balance, helper earns from it, money moves.
This is **not a guide, it is a payments product.** It needs, at minimum: a `bonus` / `payout` table, an
employer wallet, a helper-facing balance, a payout mechanism, a refund path, *and* a legal answer for
Hong Kong employment law — deducting from or adding to a helper's pay is regulated, and a
"bonus tied to app activity" can be argued to be part of wages. It also collides head-on with the
privacy policy's promise that *"We do not use your learning activity to make decisions about your
employment."* A bonus paid on learning activity **is** using learning activity to make an employment
decision.

**My recommendation: do (a) now, and treat (b) as a separate decision with a legal review.** I would
not build (b) without a lawyer looking at it, and I would not write a public page implying (b) exists
when it does not — that is exactly the class of defect we found in the Facebook pack, where a post
pointed at a word the app could not teach.

### 1.6 The one decision I need from you

> **Does "bonus" mean (a) recognition the employer handles herself, or (b) money moving inside the app?**

- **(a)** → I write the page and guide now, and the wording is honest and safe.
- **(b)** → I would scope it properly as a separate project, with the compliance question answered
  first. I will not quietly ship a payments feature.

---

## 2. A Hong Kong customs & culture session

### 2.1 Your request

> *"Another session talking about HK customs and culture."*

### 2.2 Why this is a good idea and where it belongs

This is genuinely valuable, and for a reason your app is unusually well placed to serve. A helper who
can say the words but does not know the **customs** still has the awkward moments — the ones the
vocabulary cannot fix. Things like:

- why the elderly are greeted and served first, and why refusing food three times is normal
- why you hand money and receive items with **both hands**, and never point with one finger
- the mahjong table, the ancestral altar, the joss paper — **do not tidy these**, and the specific
  reason a helper might clear away something that must not be moved
- shoes off, the doorway threshold, the incense urn
- what is actually polite when the family says *"食咗飯未"* — it is a greeting, not a dinner invitation

That last one is a perfect example: it is **already a vocabulary entry** — `食咗飯未` / *sik6 zo2
faan6 mei6*, **id 147, Greetings, Level 2** — with the gloss *"Have you eaten yet? (a greeting)"*. The
gloss is doing culture work inside a word card, which proves the need is real — it just has nowhere to
live.

### 2.3 Why it should be a **guide**, not a vocabulary category

I considered adding category 19 "Customs & Culture" and rejected it. Reasons:

1. **Vocabulary here is a word you say; a custom is a thing you understand.** Every entry in the
   library has a Cantonese form, a jyutping reading and audio. "Don't point with one finger" has
   none of those. It would be a row with an empty audio button.
2. **The quiz would be nonsense.** `generateQuestions` builds a quiz from a level pool. "Which
   hand do you use to give money?" is not a Cantonese listening question, and making it one teaches
   the wrong thing.
3. **It would dilute the one property that makes this library good:** every entry is *sayable*.
   The moment some are not, the badge "180 words with audio" stops being true.
4. **The guides already rank.** The guide pages are the only long-form content on the site and they
   are what search engines can index. A culture guide is a page an employer *and* a helper would
   both search for, and neither would type a vocabulary term.

**The right home is a guide** — the same shape as `cantonese-for-elderly-care`, which is ~1,634 words
of real prose. A culture guide sits naturally beside it.

### 2.4 The one risk to name

**Culture content is where a stranger's guess looks like a fact.** An app written by a non-native
author asserting what is "polite" in a Hong Kong household is exactly the kind of content that is
confidently wrong, and wrongness here does not just look bad — it can cause the awkwardness it was
meant to prevent. **Every etiquette claim must be reviewed by a native Cantonese speaker, and by
someone who has worked in a Hong Kong household.** Same rule already applied to the 38 machine-drafted
words: ship as draft, review before you rely on it.

---

## 3. A Hong Kong festivals session

### 3.1 Your request

> *"Another session talking about HK different festival."*

### 3.2 Why this is the stronger of the two

Festivals are **concrete, dated, and useful in advance**. Unlike general customs, a festival guide can
tell a helper what is about to happen in her household and what she will be asked to do:

| Festival | What actually changes at home |
|---|---|
| **Lunar New Year** | *lai see* red packets; the deep clean before; **no sweeping on day one**; visiting days |
| **Mid-Autumn** | mooncakes; the box that must not be opened early; lanterns |
| **Chung Yeung / Ching Ming** | grave-visiting days; the family is out; **what to prepare** |
| **Tuen Ng (Dragon Boat)** | rice dumplings (*zong*), which arrive as gifts and need storing |
| **Winter Solstice (冬至)** | the "family reunion" dinner — often treated as more important than CNY |
| **Buddhist / Taoist observances** | incense, offerings, **what not to move or throw away** |

The most valuable entries are the **"do not do this"** ones — the house is full of objects that look
like clutter and are not, and a helper who does not know this cannot be expected to guess.

### 3.3 Same conclusion as §2.3: a **guide**, not a category

Identical reasoning — a festival is not sayable, it is understandable. And festivals need **prose**:
a date, what it means, what changes in the house, and what to do. That is a guide.

### 3.4 The two real caves

**Dates move.** Lunar New Year, Mid-Autumn and Chung Yeung are lunisolar — the date changes every
year. If the guide hardcodes "3 February", it is **wrong within twelve months** and there is no
mechanism that would notice. Three options:

- **Safest:** write the guide **without hard dates** — "in late January or February, depending on the
  lunar calendar", plus a line telling her to ask the family. Never goes stale.
- **Better but needs upkeep:** name the festival, and carry a small `FESTIVALS` table with the year's
  dates, bumped annually. Correct, but someone must remember — and nothing currently remembers dates
  of any kind. This is a **new class of thing for the codebase to maintain.**

I recommend the **first**, and adding the year's dates only if you commit to the annual update.

**Scope.** Six festivals × four languages = 24 passages. That is a real content job, not an
afternoon — same scale as the 38-word expansion, which took a full session.

---

## 4. What I recommend, in order

1. **Point 1, decision (a)** — the `/for-employers` page + the getting-started guide. **Highest value
   of the three**, because it fixes something that is already built and invisible, it addresses the
   person who pays, and it needs no native review and no new schema.
2. **Point 3** — the festivals guide, written **without hard dates**.
3. **Point 2** — the customs guide, held for **native review** before publication.

I would do 1 first and alone, then 2 and 3 as a pair (they share voice and structure and are cheaper
written together).

## 5. What this does not include

- **No vocabulary rows added.** Nothing here changes the 180-word library, the quiz pool, or
  `CONTENT_VERSION`.
- **No schema change**, unless you pick bonus option (b).
- **No payment feature.** See §1.5.
- **No dates hardcoded** in the recommended option.
- **Nothing written in Cantonese yet** — the culture and festival pages are English prose with
  Cantonese *terms* glossed inline, and those glosses need the same native review as everything else.

## 6. Open questions for you

1. **§1.6 — bonus: (a) recognition, or (b) money in the app?** This gates point 1.
2. **Employer page tone** — speak to the employer as *"your helper"*, or *"the helper you employ"*?
   The first is warmer and is what the Facebook pack uses; the second is more respectful of the
   helper as a person with her own standing. I lean to the second for a permanent page, the first for
   a social post.
3. **Native reviewer** — do you have someone? Two of the three proposals lean on that person, and
   without them the culture pages cannot honestly ship.
