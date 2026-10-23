# CantoBuddy — Retention: why a helper comes back

**Date:** 15 October 2026
**Answers:** "how to make CantoBuddy get more visitors *and stay to use* it"
**Companion to:** `GROWTH-PLAYBOOK.md` (which answers *more visitors* — this one answers
*stay to use*).

**Status:** **R1, R2 and R3 are built** (15 Oct 2026) — see *What was built* below.
R4 and R5 are still proposals.

---

## What was built

Three cards on Home, in `public/index.html` + `public/app.js`, with 15 new i18n keys across
all four languages and `public/sw.js` bumped to `cantobuddy-v53`. Covered by
`tools/home-retention-test.js` — 48 assertions, all green.

| | Card | What it does |
|---|---|---|
| **R1** | `#home-resume` | Her streak and a **Continue** button, above the fold |
| **R2** | `#home-word` | **Word of the day** — same word all day, drawn from the library |
| **R3** | `#home-discover` | The **newest Discover post**, one tap to open it |

**The rule that shaped all three:** a device that has never practised renders **nothing**.
A stranger's first screen is byte-for-byte the screen that existed before, and the test
asserts that explicitly — it is the single most important property here, because the whole
justification for putting these on Home is that they only appear for someone who has
already come back at least once.

**Two things the data did not support, and what was done instead:**

1. **"Continue: the next unlearned word" is not buildable.** There is no per-word completion
   record — `progress` is one row per quiz *attempt*, and its `category_id` is never
   populated. So Continue opens the browse list at **the furthest level she has actually
   practised**, derived from `stats.byLevel`. That is honest ("where you stopped") and needs
   no new state. Real per-word tracking would be a schema change.
2. **The streak does not come from where it looks like it does.** `getLearnerStats` derives
   it from the **`progress` table** (`learnerActiveDays`: `SELECT DISTINCT
   date(created_at,'+8 hours') FROM progress`), **not** from the `learner_daily` activity
   rollup. So one quiz attempt creates a streak of one, and posting activity alone creates
   none. Worth knowing before anyone reasons about streaks from the activity data.

**The four states, all asserted:**

| State | Headline | Sub |
|---|---|---|
| Never practised | *card hidden* | — |
| Practised today | `1 day` (green) | You practised today — nice work |
| Streak alive, not today | `1 day` (amber) | Practise today to keep your streak |
| Streak broken | Welcome back | Start your streak today |

The third row is the one that matters: it fires at the only moment the streak is worth
anything to her, which is when it is about to be lost.

---

## Two engines, not one

The playbook is entirely about **acquisition** — being found, being recommended, being
trusted. It is good at that and it needs a human with a phone and an email address.

Retention is a different engine, and it is the one that decides whether any of that
acquisition compounds. A visitor who practises once and never returns costs the same to
acquire as one who practises for a year, and produces nothing. The playbook's own metric
table already implies this: *"Words practised per learner — did it get used, or just
opened."*

So this document is about the second half.

---

## The diagnosis

Three things are true of the app today, all verifiable in the source.

**1. The streak exists, and it is one tab away from where she lands.**
`renderStreakCard()` (`public/app.js:1843`) is called from exactly one place — the Progress
view (`public/app.js:2003`). The streak is the strongest habit mechanic the app has: it is
the only thing that makes *not* opening the app cost something. It is never shown on Home.

**2. The home screen has no memory.**
`#view-home` (`public/index.html:164`) is identical for a first-time visitor and someone who
has practised 30 days in a row: a hero, three level cards, Start Quiz / My Progress, and a
static category list (`renderHomeCategories()`, `public/app.js:558`). Nothing on it knows
who she is, what she has learned, or what she was doing last time. There is no "continue",
no "next word", no "you were here yesterday".

**3. Nothing brings her back.**
There is no re-engagement code anywhere: no `Notification`, no `push`, no
`showNotification` in `public/` or `public/sw.js`. A streak only defends itself if she
remembers to open the app, and on a working day in a Hong Kong household, she will not.

The Discover feed just built is the app's **first** genuine retention mechanic — a reason to
come back *for something new*. It is also, today, the only one.

**In one line:** the app is good at teaching and has no mechanism at all for being returned
to.

*(Points 1 and 2 are addressed by R1–R3 below, which are now built. Point 3 — nothing brings
her back when the app is closed — is still true, and is R4.)*

---

## What to build, ranked by value per unit of work

### R1 — Give the home screen a memory ✅ *built*

A returning learner should not see the same screen as a stranger. On Home, above the level
cards, show one line of state and one action:

> **Day 12.** Practise today to keep it. → **[ Continue: 廚房 words ]**

Everything it needs is already fetched — the streak comes from the same progress data the
Progress view uses, and "next" is the first unlearned word in her level. This is a frontend
change with no new backend, no new permission, and no new data. It converts the streak from
a *report she has to go looking for* into the *first thing she sees*.

It also fixes the worst case: today a learner who is one day from a personal best is told
nothing at the moment it matters.

### R2 — Word of the day on Home ✅ *built*

A reason to open the app that is not a study session. Deterministic (seeded on the date, so
it needs no server and no storage), drawn from the existing library, with audio.

This matters more than it looks: the streak asks her to *do work*, and on a tired evening
she will not. A word of the day asks her to read one word. It keeps the daily-open habit
alive on the days the practice habit fails, which is exactly when a streak dies.

### R3 — Surface the newest Discover item on Home ✅ *built*

The news and culture feed is fresh by construction, and right now it is invisible unless she
taps the Discover tab. One card on Home — the newest headline, or the culture piece — makes
"something new" the reason she opened, rather than something she has to go and look for.
Reuses `GET /api/posts`, which already exists.

### R4 — The daily reminder (Web Push) — *the missing arrow*

This is the highest-leverage change and the most work, and it needs to be built honestly
rather than promised.

**What does not work:** a purely client-side "remind me at 7pm" cannot fire while the app is
closed. Browsers will not schedule a local notification for later. The `Notification
Triggers` API that would allow it is not broadly supported. Any reminder that only works
when she already has the app open is not a reminder.

**What does work:** **Web Push** — the server sends, the service worker displays, and it
arrives with the app closed. It needs:

- a **VAPID keypair** and a push subscription stored per device;
- a **server-side send** (a small module, plus a scheduling trigger);
- on **iOS, the PWA must be installed to the home screen** (iOS 16.4+). Android Chrome
  works from the browser.

Two things make this more reasonable here than it sounds. The app **already has** the
scheduling pattern — the news importer added this session runs on a timer and is designed to
be driven by a Render Cron Job, which is exactly the trigger a reminder needs. And the app
**already has** a PWA install prompt, so install → permission → reminder is a coherent
funnel rather than three unrelated features.

**Two decisions it forces, and they are real:**

1. **When to ask.** Notification permission is a one-shot. Ask on first load and the answer
   is no, permanently, forever. Ask *after the first completed quiz* — she has just had a
   small win and knows what the app is for — and the answer is different.
2. **Privacy.** The app's whole design is device identity, no accounts, no personal data.
   A push endpoint is a device-identifying string the app would store and send to. That is
   more personal data than CantoBuddy holds today. It is defensible — it is her own device,
   she opted in, and it can be revoked — but it is a change in kind, and it should be a
   conscious one rather than a side effect of adding notifications.

**Content of the reminder matters as much as sending it.** "Practise Cantonese" gets muted.
*"Day 12 — 2 minutes keeps your streak"* or *"New today: a Hong Kong news story"* does not.
One a day, at a time she chooses, and never a second one.

### R5 — The streak-at-risk nudge

If she opens the app in the evening and has not practised, the streak is the thing to say.
Small, in-app, no permission needed, and it is the moment the streak is actually worth
something to her.

---

## What to measure

Retention is measurable here already — this is not a case for new analytics.

| Question | Where |
|---|---|
| Did she come back at all? | Admin → Reports, the daily visitors series (`learner_daily`) |
| Did she practise, or just open? | Admin → Progress, words practised per learner |
| Is a streak forming? | the streak card; `streak.longest` vs `streak.current` |
| Is the employer loop producing retention? | Admin → People, learners with an employer link |

The one number that answers this document's question is **day-2 return**: of the learners
active on a given day, how many are active the next. If R1–R4 are working, it moves. If it
does not move, the diagnosis was wrong and the content is the problem, not the triggers.

---

## What only a human can do

Nothing in this document gets CantoBuddy its first thousand users. That is
`GROWTH-PLAYBOOK.md`, and its Tier 1 item — **get listed with the Filipino Hub and the
existing Sunday Cantonese classes** — is still the single highest-value action available.

One item on that list is unfinished and is entirely within reach: **the Google Search
Console submission.** It is the last on-page lever — the SEO layer already renders the
pages, the sitemap and the verification file; the property simply has not been submitted.
Everything past it is backlinks and distribution, which is the playbook's job.

---

## Honest limits

- **R1, R2 and R3 are built** and are the cheap half of this document — frontend only, no
  new backend, no permission, no new data. **R5** is the same kind of change and is still
  open.
- **R4 is real work** — a VAPID keypair, a server-side sender, a subscription store, and a
  scheduling trigger — plus the two decisions above. It is the single change most likely to
  move day-2 return, and it should not be built until the permission-timing and privacy
  questions have an answer.
- **None of this is a growth strategy.** Retention multiplies acquisition; it does not
  replace it. A perfect return loop on 50 users is still 50 users.
- **The content is the ceiling.** Triggers bring her back to the app; the words are what
  make her stay. The long-tail situational content in the playbook ("what to say when the
  baby is crying") is the same work seen from the retention side.
