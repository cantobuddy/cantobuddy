# CantoBuddy 2.0 — Revamp Proposal

**Prepared:** 3 October 2026 · **Last updated:** 4 October 2026
**Status:** Phase 1's **data layer is built, tested and live in production.** Everything else in this document is still a proposal for review. See the build-status note in §3.
**Companion:** `prototype.html` (clickable screen mockups, 17 screens)

> **Revision note.** This version follows three instructions: **no sticker store**, **remove the money layer entirely**, and **remove donations**. CantoBuddy never receives, handles, holds, charges or transfers money — nothing enters it at all. Stickers carry **credits**; **the employer decides what those credits mean and fulfils the reward themselves, off the site.** The donations research is archived in `archive/donations-research.md`, out of the plan but not thrown away.

---

## 1. Scope reality check

The brief describes **three separate products**:

| Product | Users | What it needs |
|---|---|---|
| Learning app | Helpers (~370k in HK) | Content, audio, quizzes, progress |
| Employer portal | Employers | Accounts, invitations, sticker sending, reporting |
| Back office | You / operators | Content, reports, feedback |

**What already exists** is roughly the first product's engine: 64 words, 11 categories, TTS, quizzes, EN/Filipino, PWA, persistent storage. That is genuinely valuable and should be **kept, not rebuilt**.

Everything else is new. Realistically this is a **new application built around the existing learning engine**, not a revamp of it. Being clear about that up front avoids a painful surprise halfway through.

---

## 2. Technical foundation — what has to change

The current stack cannot support any of this:

| Today | Needed | Why |
|---|---|---|
| Single JSON file | Real database (**SQLite**, Postgres later) | Concurrent users, relationships, an audit trail |
| One shared admin password | Accounts + roles + password reset | Three distinct user types with different permissions |
| No email | Transactional email | Invitations, encouragement, sticker notifications |
| Progress keyed by typed name | Progress keyed to a user id | Two people typing "Maria" must not merge |
| No credit ledger | Credit ledger (integer only) | Stickers add credits; the employer's rule reads them |

**Note what is *not* on this list:** no payment provider, no card storage, no wallet, no payout rail, no currency handling. That is the whole point of this revision — it removes the single most expensive and most legally delicate part of the original brief.

**Recommended approach:** keep the Express app and the whole `public/` front end, and replace the data layer with a real database plus proper auth. The learning screens barely change — that is deliberate.

**Database route — decided: no extra spend.** Full evaluation in `DB-EVALUATION.md`. Short version:

| Route | Extra cost | Verdict |
|---|---|---|
| **SQLite on the existing `/data` disk** | **$0** | ⭐ **Recommended** — zero new vendors, zero new dependencies, real SQL, no idle-pause risk |
| Supabase Free | **$0** | Good alternative if you'd rather not build auth — but adds a vendor, a 7-day pause and no backups |
| Render Postgres Free | $0 for 30 days | ❌ **Expires and deletes data** |
| Neon Free | $0 | ⚠️ No auth, cold-start delays |
| WorkBuddy Cloud Service | bundled | ❌ **Blocked** — origin conflict with cantobuddy.com |
| Keep JSON + disk (today) | $0 | ❌ Cannot support Phase 1 at all |

**`node:sqlite` is built into your Node version — verified working on `v22.22.2` with no flag and no new dependency.** The monthly bill stays at **$7.25**; the only change is `db.json` → a SQLite file on the disk you already pay for.

**Migration risk is low** — 64 vocabulary entries and a handful of progress rows, and both options are SQL. Switching later is an afternoon's work, so this must not hold up Phase 1.

---

## 3. Proposed phasing

Ordered so that **value lands early and risk lands late**. Five phases — the previous version had seven; the two payment phases are gone.

> **Build status (4 Oct 2026).** The **data layer of Phase 1 is built, tested and DEPLOYED.** CantoBuddy now runs on SQLite in production — the legacy `db.json` was migrated automatically on first boot, and the migration is verified to have carried the content across (64 vocabulary entries, 11 categories and existing progress records). Sessions now persist in the database, so redeploys no longer log the admin out. **The remaining Phase 1 work is accounts, roles and password reset.**

### Phase 1 — Foundation *(invisible, everything depends on it)*
Real database, user accounts, three roles, sessions, password reset.
No new screens. Nothing works until this is right.

### Phase 2 — Employer portal + invitations ⭐ *highest value*
Employer sign-up, invite helpers by email or link, helper accepts with a code, employer sees progress.
**This phase alone solves the problem you actually hit** — "why can't I see Jeanilyn's progress?"

### Phase 3 — Stickers, credits & encouragement
Notification inbox, sticker sending, sticker catalogue, the credit counter.
Pure motivation loop. No money of any kind — a sticker is worth credits, full stop.

### Phase 4 — Rewards *(the employer's own rule)*
The employer writes, in their own words, what credits are worth to them — "100 credits = a day off", "100 credits = HK$50 paid directly". The helper sees a progress bar toward the next reward. The app **counts and displays**; it never pays.
This is what gives the helper something real to aim at while keeping "free for helpers" true.

### Phase 5 — Admin back office
Reports, engagement analytics, feedback inbox.

---

## 4. Risks

### 4.1 ✅ The big risk is now gone — and that is the headline

The previous version of this proposal carried a serious warning: if CantoBuddy moved money **to** helpers as a business activity, in Hong Kong that can fall under **Money Service Operator (MSO) licensing** administered by Customs & Excise, plus **KYC/AML** obligations — identity verification, record-keeping, suspicious-transaction reporting, licence fees.

**Your instruction to remove the money layer eliminates that risk completely.** With no wallet, no top-up, no payout and no platform-held balance, CantoBuddy is not a money transmitter and not a payment intermediary. It is a **learning app with a points system**. That is a categorically simpler product to launch, operate and defend.

**The rule that keeps it that way — please treat this as a hard design constraint:**

> **No money ever enters, moves through, or leaves CantoBuddy.**
> Stickers grant integer credits. The employer defines, in their own words, what credits are worth. The employer fulfils the reward directly. The app records and displays only.

**That constraint is now absolute.** Donations were the last money-adjacent feature in the product, and they have been removed from the plan (4 October 2026). There is no longer any route by which money reaches CantoBuddy at all — nothing is received, nothing is held, nothing is forwarded. The research behind that decision is archived in `archive/donations-research.md` in case it is ever reconsidered.

If a future feature ever wants to "just add a top-up button", it re-opens section 4.1 in full. Flag it before building, not after.

### 4.2 "Free for helpers" is now fully consistent

This was a direct contradiction in the previous version: the brief wanted a **Sticker Store with real-money purchases inside the learner area**, which cannot coexist with the standing rule that **helpers are never charged, permanently**.

That contradiction is resolved. **Helpers have no purchase path of any kind** — no store, no price, no checkout, no payment form. They receive stickers and accumulate credits. Employers are the only ones who might ever pay for anything, and even they do not pay through the app in this model.

### 4.3 Other risks

- **A promise the app did not make.** The employer's reward text appears to the helper under the employer's name ("Emily's reward: 100 credits = HK$50, paid to you directly"). If an employer never follows through, the helper may feel cheated and associate that with CantoBuddy. Mitigation: attribute every reward to the employer by name, show a one-line plain notice that the app only counts credits, and keep the wording the employer's own so nothing reads as a CantoBuddy guarantee.
- **Helper privacy (PDPO).** Progress sharing must be **opt-in and revocable**. Helpers must be able to disconnect and stop sharing. Do not let employers see anything beyond learning progress.
- **Power imbalance.** A helper may not feel free to refuse an employer's invitation. Design for that: the helper must be able to use the app fully without ever connecting, and disconnecting must be one tap with no notification that would feel confrontational.
- **Notification fatigue.** Encouragement stops working if it becomes noise. Rate-limit sticker sends and batch notifications.
- **Content quality at scale.** 64 words is a solid start; 370k users will want thousands, with Cantonese audio recorded by a human.
- **Credits as a score, not a currency.** Keep the copy disciplined. "Credits" are a tally, never described as money, balance, value held, or something to withdraw. Wording drifts first; behaviour follows.

## 5. Screen changes at a glance

Full mockups are in `prototype.html` — **17 screens**, all clickable, with a role switcher. Summary:

### Learner (mobile) — 6 screens
| Screen | Status |
|---|---|
| Dashboard with streak + progress ring | **New** |
| Learn (browse categories) | Keep |
| Notifications inbox | **New** |
| My Stickers + credits earned | **New** — collection and credit count. No store, no price, no payout. |
| Progress | Keep (extended) |
| Profile & connect to employer | **New** |

### Employer (desktop) — 6 screens
| Screen | Status |
|---|---|
| Sign in | **New** |
| Dashboard | **New** |
| Invite a helper | **New** |
| Helper progress report | **New** |
| Send stickers | **New** — pick stickers, add a message, optionally *record* a bonus given off-site |
| Rewards | **New** — replaces the old wallet screen; the employer writes their own credit-to-gift rule |

### Admin (desktop) — 5 screens
| Screen | Status |
|---|---|
| Overview | **New** |
| Content | **Keep** — already works |
| Sticker catalogue | **New** — each sticker's only number is its credit value |
| Reports | **New** — engagement only, no financial summary |
| Feedback | **New** |

---

## 6. Decisions

**Resolved:**

- ✅ **Donations — removed from the plan** (4 October 2026, your instruction). Not for legal reasons: the research found online donations lawful in Hong Kong with no licence, permit or registration. Removed as a *product* decision — they add a record-keeping and tax chore for revenue the app does not need right now, and fewer moving parts is worth more than a small income stream. Research archived in `archive/donations-research.md`; the donations screen is out of `prototype.html` and out of the admin back office.
- ✅ **Which phase first — Phase 1 + 2 together.** Agreed. This is the build order; Phases 3–5 follow once employers are actually using it.
- ✅ **Keep all of the existing app.** Agreed. The learning engine is not rebuilt — the learning screens barely change, deliberately.
- ✅ **Reward guardrails — free text plus a suggested-examples hint** (option b). Agreed. The employer keeps full flexibility in their own words, with a few examples nudging toward rewards that are easy to honour. No fixed pick-list, no cash enforcement.
- ✅ **Database route — SQLite on the existing disk, $0 extra spend.** Evaluated in full in `DB-EVALUATION.md`. `node:sqlite` verified working on Node 22.22.2 with no flag and no new dependency. Supabase Free kept as the alternative; WorkBuddy Cloud Service ruled out (origin conflict).

**Still open:**

1. **Are you operating as a sole trader or a limited company?**
   Narrower than it was. With donations gone, the donations-tax angle is moot — what remains is **personal liability**, and the practical matter of how the employer accounts and the hosting services get signed up. Still worth settling before Phase 1 creates real accounts, but it no longer blocks anything.

**Next step:** the remainder of Phase 1 — **accounts, roles, password reset** — then Phase 2, the employer portal and invitations.

---

## 7. What I would not do

- **Not** put a payment form, a price, or a "buy" button anywhere in the product — this revision removed all of them, and they should not come back without a deliberate decision.
- **Not** hold a helper's money, or anything that behaves like money.
- **Not** accept donations. Removed deliberately on 4 October 2026; the legal research is archived, not deleted, so the decision is reversible — but reversing it should be a decision, not a drift.
- **Not** migrate to a new framework. The current vanilla front end loads instantly on a cheap Android phone over mobile data, which matters a lot for this audience.
- **Not** build all 17 screens at once. Phase 2 is where the value is.
