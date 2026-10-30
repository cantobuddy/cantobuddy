# CantoBuddy — Making helpers come back constantly

**Date:** 24 October 2026
**Answers:** "do u have proposal to make domestic helpers use cantobuddy site constantly"
**Builds on:** `RETENTION.md` (15 Oct — R1–R3 built, R4 push since shipped) and `GROWTH-PLAYBOOK.md` (acquisition)
**Status:** **P1 is built** (24 Oct 2026). P2–P6 are proposals. Nothing is deployed yet.

---

## P1 — what was actually built

The diagnosis in G1 below was right, and the fix touched four files plus two new
modules. What changed:

| | Before | Now |
|---|---|---|
| **Trigger** | one sweep a day, on a 24h `setInterval`, if idle ≥ 3 days | a sweep every 10 minutes that only acts inside **19:20–19:59 HKT** |
| **Moment** | 3 days after she left — the streak already dead | the evening it is about to die, while it can still be saved |
| **Message** | one generic sentence for every device | her streak length, the answers left to her next sticker, a headline that is new today, or one phrase — in her language |
| **Languages** | English only | en / fil / zh / id, captured from the page she reads |
| **Duplicate sends** | "mark first, then send" in JS | a `push_log` primary key; the database decides |
| **Learner link** | `learner_id` always NULL (the client never sent one) | sent on subscribe **and** backfilled on every ping, so existing devices repair themselves |

New files: `push-reminders.js` (the planner — pure, so the whole ladder is
testable at any date and hour), `push-sweep.js` (the send path — a factory, so
it can be tested against a fake sender), `tools/push-p1-test.js` (**120
assertions, all green**).

The five rungs, and what each one is for:

| Rung | Condition | Message |
|---|---|---|
| `streak` | practised yesterday, not yet today | *Day 12 — 2 minutes keeps it* |
| `new` | idle 3+ days | *New today: \<headline\>* |
| `sticker` | idle 7+ days | *12 answers from 💰 幾多錢* |
| `phrase` | idle 14+ days | *One phrase for your kitchen: 唔該* |
| — | idle 21+ days | **silence, permanently** |

A device that practised today gets nothing. A device that has already received
one message today gets nothing. A device gone three weeks gets nothing, because
a fourth notification does not win anyone back — it just trains her to swipe.

**What P1 does not do:** it cannot raise the permission rate. Push only works
for devices that opted in, and on iOS only for an installed PWA. If that number
is small, P4 (the in-app daily phrase) is the lever that matters, not this.

---

## First, the honest reframe

"Constantly" is the wrong target, and aiming at it produces dark patterns that burn trust.

A Filipino domestic helper in Hong Kong works six days a week, ~10–12 hours, often with a phone
she can only glance at. She will never open a learning app five times a day. What she *will* do,
if the app earns it:

| Rhythm | When | What she wants in that moment |
|---|---|---|
| **Daily, 2 min** | evening, in bed, after the family sleeps | one small win — not a lesson |
| **Weekly, 20–30 min** | **Sunday, her day off** | company — friends, games, gossip, news from home |
| **As needed** | the moment something happens | wages, rights, a phrase she needs *right now* |

So the real goal is not "constant use". It is: **be the default app for those three moments.**
Three opens a week plus one long Sunday session is a healthy, honest ceiling for this audience —
and it is enough to make the product sticky, because the content is genuinely useful.

Everything below is judged against that target.

---

## What is already live

More exists than the 15 Oct document assumes. Audited in source today:

| Asset | State | Where |
|---|---|---|
| Streak + "Continue" card on Home | **live** — 4 states, hidden for a device that never practised | `public/app.js:904`, `#home-resume` |
| Daily Culture (server-picked, same for every device) | **live** | `#home-daily-culture`, `/api/posts/daily-culture` |
| Festival countdown card (±3 days) | **live** | `#home-festival` |
| Discover feed | **live** — 292 posts | `/api/posts` |
| Sticker album + credits (5 → 400, widening) | **live** | `stickers.js`, `/api/learners/rewards` |
| **Web Push** | **live and configured** — VAPID keys set, daily sweep, admin "send now" | `push.js`, `push_subscriptions`, `/api/admin/push/reminders` |
| 4 multiplayer games with rooms + WhatsApp invite | **live** | `uno.js` `bigtwo.js` `wordmatch.js` `sudoku.js` |
| Living: 18 long passages with reactions + comments | **live** | `living_posts` / `living_comments` |
| Employer ↔ helper linking, invitations | **live but unused** | `employer_learners`, `invitations` |

That is a lot of machinery. The problem is not missing features — it is that **the machinery
is not wired to a habit, and several social surfaces are empty.**

---

## Why she does not come back constantly — five gaps

**G1. The reminder is the exact message the retention doc warned would get muted.**
`runPracticeReminders()` sends *"A quick Cantonese review? / A few minutes a day keeps the words
in your head."* — generic, identical for every device, at a fixed **3-day idle** trigger.
`RETENTION.md` said in writing: *"'Practise Cantonese' gets muted. 'Day 12 — 2 minutes keeps your
streak' does not."* The one push that exists is the bad version.
**And it never fires at the moment that matters most** — the evening a streak dies. A 3-day idle
trigger is already too late; the streak is gone by then.

**G2. The games have no memory.** `wins` lives on an in-memory room object (`uno.js:141`,
`sudoku.js:95`); rooms are a `Map` that a restart wipes. Nothing is stored per device. So there
is no record, no "you beat Ana 3–1", no reason to play *tomorrow* rather than once.

**G3. The social surfaces are visibly empty.** `living_comments` = 0, `living_reactions` = 0,
`stories` = 0, `employer_learners` = 0. A helper who opens a Living passage sees a comment box
and a reaction row with nobody in them. **An empty social surface is worse than no social
surface** — it says "nobody uses this", which is the one thing a new user must never conclude.

**G4. The reward layer only rewards one behaviour.** `getCredits()` = `sumScoreByLearner` — sum of
quiz scores. So reading a Living passage, playing a game, or reacting earns **nothing**. The
album is also buried in Progress, not on Home, so the thing designed to bring her back is on a
screen she visits rarely.

**G5. There is no reason to open the app that is not study.** The word-of-the-day card described
as R2 in the retention doc is not in the current Home markup (no `#home-word`); Daily Culture
took that slot. That leaves the tired-evening case uncovered — the exact moment streaks die.

---

## The plan, ranked by value per unit of work

### P1 — Fix the push before adding any (1–2 days) ⭐ highest leverage — ✅ **built 24 Oct**
The trigger already existed; only the copy and the timing were wrong. What it does now:

1. **Streak-at-risk push.** If she practised yesterday and has not practised today, send at
   **19:30 HKT** (her local evening): *"Day 12 — 2 minutes keeps it."* This is the single
   highest-value notification the app can send, because it arrives when the streak is worth
   something.
2. **Idle ladder instead of a flat 3 days.** Day 1 idle → streak message; day 3 → *"New story:
   [headline]"* (a reason, not a chore); day 7 → *"Your 5 saved words are still here"*; day 14 →
   last one, then stop. Never more than one per day, ever.
3. **Make the body specific.** Her streak number, her next sticker threshold, or the actual
   headline. `push.js` already takes an arbitrary payload, and `store.listStaleForReminder()`
   already selects per device — this is a query change, not a new subsystem.

**Why first:** it is the only change that reaches her when the app is closed, it is the cheapest,
and the existing message is actively training her to mute notifications.

### P2 — Give the games a memory, and a tiny social graph (3–5 days) — ✅ **built & deployed 25 Oct**
- New table `game_results (public_id, game, won, players, created_at)`, written by each game's
  finish handler.
- Show it inside the room and on the games lobby: *"You 7 · Ana 5"* — a **table** record, not a
  global leaderboard. Global rankings demoralise a beginner; a four-person table is a rivalry.
- This turns games from a novelty into an **appointment**, and Sunday is the natural slot.

**What shipped, against the sketch above:**

| Sketch | Built |
|---|---|
| `game_results(public_id, game, won, …)` | Yes, plus `players`, `room_code`, `display_name`, and two indexes |
| Written by each finish handler | One shared `game-records.js` called by all four engines, so the four tables cannot disagree about what a win is |
| "You 7 · Ana 5" in the room and lobby | Lifetime line per game in the lobby and at the end of a game, in en/fil/zh/id — and **nothing at all** until she has played once |
| Table record, not a leaderboard | Yes. No cross-player ranking exists anywhere in the schema |

Two things the sketch did not anticipate, both of which decide whether the number can be trusted:
`room.recordedRound` makes a round record **once** even if a finish handler runs twice (Word Match
resets it on `startGame`, so a rematch counts as the new game it is), and a **draw is a played game,
not a win** — Word Match on a tie has `winner === null` and records `played=1, won=0`.

**Why second:** the games are already the most social thing in the app and the only feature that
*requires another person* — which is the strongest retention force available. It currently has
zero memory, so all of that energy evaporates at the end of each room.

### P3 — Fill the empty surfaces, or hide them (1–2 days) — ✅ **built & deployed 25 Oct**
- Hide comment counts and reaction tallies until there is something real to show. Where a surface
  is empty, phrase it as an invitation ("Be the first to react"), never as a void.
- Seed 5–8 Living passages with genuinely useful comments (from real helpers, credited) so the
  first visitor sees a living room, not an empty one.
- Make **one reaction per day earn credits** — a micro-habit that costs 2 seconds.

**What shipped, and the one place I did not follow the sketch:** the sketch says "from real
helpers, credited". There are no real helper comments to draw on yet, and inventing them —
"Maria, 34, Wan Chai" — would be a lie told to someone deciding whether to trust this app with a
wage dispute. So the nine starter comments across eight passages are credited to **CantoBuddy
team**, which is true, and stand on being useful (the two-week rule, the HK$1,236 food allowance,
the doctor's note that protects her pay). **No reaction counts were seeded** for the same reason;
the card hides a zero instead. That is the honest version of "fill the empty surface": fill it
with something true, or say nothing.

**Why third:** cheap, and it removes an active negative signal rather than adding a positive one.

### P4 — One daily reason to open that is not study (1 day) — ✅ **built & deployed 25 Oct**
Bring back the daily phrase card on Home, but framed for this audience:
**"Today's phrase for your kitchen"** — one phrase, audio, one tap, ~10 seconds. Sits directly
under the streak card.

**Why:** the streak asks her to *work*; on a tired evening she will not. A single phrase keeps the
daily-open habit alive on the days the practice habit fails — which is precisely when a streak dies.

Built exactly as sketched, with two decisions worth recording: the phrase is chosen from the
**Hong Kong date**, so every device sees the same one and it cannot be refreshed into a different
word; and it is shown to **strangers too**, which is a deliberate exception to the "a stranger sees
the old screen" rule the streak card follows. The streak is a reward for having started — this card
is the reason to start, so hiding it from new devices would hide it from the only people it helps.

**One correction after launch.** The pool is vocabulary, and 10 of its 39 kitchen entries are a
single character (水 食 飲 飽 熱 凍 蛋 …). The first live card therefore promised *"Today's phrase
for your kitchen"* and delivered `飲` — a good flashcard and a useless sentence. The pool now
excludes single characters: 29 phrases remain, a month without a repeat, and today's card reads
`海鮮` (hoi2 sin1, seafood). The label was the promise; the data had to meet it.

### P5 — The Sunday Table (1–2 weeks) — the big one — ✅ **built & deployed 25 Oct**
Sunday is the only day she has real free time, so build the product around it:
- A weekly fixed slot (e.g. **4pm HKT Sunday**): one featured game, the Living passage of the
  week, and a short "what happened in HK this week" digest.
- A **WhatsApp-shareable result card** ("I scored 9/10 at CantoBuddy Sunday Table 🎉") generated
  from her actual result. The WhatsApp share plumbing already exists in all four games.
- Push once, Sunday morning: *"Sunday Table starts at 4 — Ana is already in."*

**Why it is worth the effort:** it is the only mechanic that makes a *weekly* habit, it uses the
assets already built (games + Living + WhatsApp share), and the result card is the rare feature
that is simultaneously retention and acquisition.

**What shipped, and what did not.** The slot is 16:00–18:00 HKT — two hours, because her afternoon
is not a calendar event. The featured game rotates on the ISO week, the passage of the week is
picked the same way, and the digest is bounded to the last seven days so a quiet week reads as
quiet instead of reaching back a month to fill four slots. The card only appears in the 48 hours
before a Table and while one is open: a weekly card that is always there is furniture.

The result card is built from her **actual games that day** — `/api/games/record` gained a `since`
date for exactly this, so it cannot report a lifetime total as Sunday's score — and it only appears
once she has finished a game, because an empty "share my result" button asks her to send a lie.

**The "Ana is already in" line is not shippable and was not shipped.** There is no presence system;
that sentence would be fabricated social proof, which is the same category of mistake as an invented
testimonial. The push says what is true: *"Sunday Table at 4 — Sudoku and one passage, two hours,
no rush."* It sends at 09:00–09:59, which is a second **window**, not a second message — `push_log`'s
`(endpoint, day)` primary key means the Sunday send claims the day and the evening ladder is
suppressed by the same constraint that already stops a duplicate sweep.

**One correction after launch.** The digest was headed *"Hong Kong this week"* in all four
languages, and the first live digest was four Manila stories — Dela Rosa, a Davao libel case, the
Supreme Court, the ECC. `posts` carries no region and the news channel mixes Hong Kong with the
Philippines and Indonesia, so the heading could not be honoured by filtering. The label now says
*"In the news this week"* (fil/zh/id equivalent). The data could not be made to fit the claim, so
the claim was reduced to what the data supports — which is the only honest direction to move.

**A second correction, same day, reported by the user as "all four links are broken."** Every
digest row landed on *"That story is not available."* The digest is built from `posts`, but the
client opened each row with `openStory()`, which reads the `stories` table — the helper-submitted
ones. Unrelated tables, so a guaranteed 404: the rows were right and the click was wrong. One word
fixed it (`openStory` → `openPost`). Worth naming the shape of it, because no schema can catch it:
three surfaces on one card, three tables, three openers, and a slug is just a string either way.
`tools/sunday-digest-test.js` now pins the pairing so it cannot drift back.


### P6 — Let every job earn credits (0.5 day) — ✅ **built & deployed 25 Oct**
Credits for: quiz answer (exists), reading a Living passage, finishing a game, first reaction of
the day. Keep the thresholds untouched so no one loses a sticker.

The hard part is done: `credit_events` now exists as the home for a credit that is not a quiz
answer, `getCredits()` sums it alongside `progress.score`, and `awardDailyCredit()` enforces one
per device per kind per HKT day in SQLite. **The first reaction of the day is already paying.**
The remaining work is one call site each for "read a passage" and "finished a game" — deliberately
not bundled into this release, because each one changes what a sticker means and that deserves its
own measurement window rather than a quiet ride along with a bigger changeset.

**Shipped, with three decisions the sketch did not make.**

Both call sites pay **one credit a day**, not one per event, and that is a design rather than a
shortcut. Per-passage would pay up to 18 credits a day for tapping through the shelf — more than a
ten-question quiz — and a sticker that arrives that easily stops meaning anything. The habit being
rewarded is "she read something today", and that happens once a day by definition. The database
enforces it; no caller has to remember to.

Finishing a game pays **win or lose**, to every identified player. Paying only the winner would
teach her that losing costs her the sticker, which is the opposite of what a game played with
friends is for.

And `kind` is now a **closed set** — `reaction`, `reading`, `game` — with an unknown value refused
rather than written. That is the one bug the table's `UNIQUE(public_id, kind, day)` cannot catch: a
typo does not error, it silently opens a *second* daily allowance for the same activity. Refusing
fails towards "no credit", which is the only safe direction.

The sticker thresholds were left exactly as they were — 24 stickers, 5 to 400 credits — and are now
pinned by assertions, because credits can only move forward, so nobody loses a sticker they had.

---

## What to measure

| Question | Where it already exists |
|---|---|
| Did she come back the next day? | `learner_daily` — **day-2 return is the one number that matters** |
| Did she come back on Sunday? | `learner_daily`, day-of-week |
| Are games producing a habit? | rooms created per week; games per device per week |
| Is push working or being muted? | `push_subscriptions` count vs. 410/404 prune rate |
| Is the social layer alive? | `living_reactions` / `living_comments` per device |

If P1–P4 do not move day-2 return, the diagnosis was wrong and the *content* is the problem,
not the triggers.

---

## What not to do

- **No global leaderboard.** It rewards the top 1% and tells everyone else they are losing.
- **No accounts or login.** "No sign-up" is a promise on the hero, and it is why she tries it at all.
- **No more than one notification a day**, ever. The fastest way to be uninstalled.
- **No forum yet.** `FORUM-PROPOSAL.md` is sound in principle, but moderation is a daily human
  cost and an unmoderated forum in this community is a liability, not an asset. Revisit only
  after the Sunday Table has a regular crowd.
- **No streak-shaming copy.** "You lost your 12-day streak" makes people quit. "Welcome back —
  start again today" keeps them.

---

## Honest limits

- **None of this fixes acquisition.** A perfect habit loop on 50 devices is still 50 devices.
  The playbook's Tier 1 — getting listed with the Filipino Hub and the existing Sunday Cantonese
  classes — remains the highest-value human action available.
- **P1 is only as good as the permission rate.** Push requires opt-in, and on iOS the PWA must be
  installed to the home screen. If install rate is low, P1's ceiling is low, and P4 (in-app daily
  phrase) becomes the primary lever instead.
- **P5 is the only item with real scope.** It should not be started until P1–P3 have run for a
  month and day-2 return has been measured, because its whole justification is "the weekly rhythm
  works" — and that is a claim worth testing cheaply first.
