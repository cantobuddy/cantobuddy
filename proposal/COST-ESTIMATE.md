# CantoBuddy — what the vocabulary change costs

**Prepared:** 5 October 2026
**Question:** how much money is needed to implement `VOCABULARY-PROPOSAL.md`
**Currency:** HK$ primary (the operating context is Hong Kong), US$ in brackets where it helps
**Horizon:** the full ~680-entry build, with a phased option

---

## Bottom line

Three numbers, depending on how much you do yourself.

| Path | One-time cash | Monthly | Your own time |
|---|---|---|---|
| **A — DIY / AI-assisted** (build it the way you have been) | **HK$7,000–19,000** | HK$60–350 | ~35–40 days |
| **B — Hybrid** (AI-written content, hired engineer) | HK$52,000–139,000 | HK$60–350 | ~10 days |
| **C — Full professional** (agency content + contractor) | HK$112,000–259,000 | HK$250–400 | ~2 days |

And the number that actually matters if you want to start:

> **Phase 1 — the elder-care core (Tier A) plus the plumbing that makes it work — costs
> under HK$4,000 in cash.** Everything else can be added later without rework.

The reason the spread is so wide is that **the cost is almost entirely content, and content can
be drafted by machine and verified by a human.** Infrastructure — the part people expect to be
expensive — is under HK$350/month even at your three-month target.

---

## What you are actually paying for

Four pools. Only one of them is large.

| Pool | Share of the bill | Why |
|---|---|---|
| **A. Content authoring** — ~680 entries × 7 strings each | **the dominant cost** | Cantonese + jyutping + English + Filipino + an example sentence per entry |
| **B. Content verification** — native Cantonese + native Filipino | **the non-negotiable cost** | §8.6: a wrong word in elder care is a safety issue, not a typo |
| **C. Engineering** — ~30 developer-days | large *if hired*, near-zero if AI-assisted | the schema, review, and scale work in §4, §7, §8, §9 |
| **D. Infrastructure** — Render, disk, backups | **small** | this app is light; the payload fix (§9.1) keeps it light |

---

## Pool A — content authoring

An "entry" is not one string. Under the proposal (§4, §7.1) each one carries seven: the
Cantonese, its jyutping, an English gloss, a Filipino gloss, and one example sentence in all
three languages — plus a scenario and speaker tag.

| Route | Unit cost | 680 entries | Notes |
|---|---|---|---|
| **AI-drafted** (you prompt, you review) | your time | **HK$0 cash** | ~2–3 days of drafting; the review in Pool B still applies |
| **Freelance trilingual writer** | HK$150–350/hr × ~15 min/entry | **HK$25,000–60,000** | HK$40–90/entry fully loaded |
| **Translation agency** | HK$90–180/entry | **HK$60,000–120,000** | most expensive, slowest to iterate |

The AI route is not a compromise here, and it is worth saying why: the *plan* (§5) already
decides **what** to teach — the 24 categories, the tiers, the scenario sets. The writer is not
being asked to design a curriculum, only to render a known phrase in three languages. That is
exactly the work machine drafting is good at, and exactly the work a human should then check.

**Do not skip Pool B because Pool A was cheap.** Machine-drafted Cantonese is plausible-sounding
and sometimes wrong — tone, register, and the difference between what a phrase means and what an
80-year-old would actually say. That gap is invisible unless a native speaker looks.

---

## Pool B — content verification (the cost you cannot skip)

This is the line item that protects the product. At 64 words a bad entry is embarrassing; at 680
entries used by carers of frail elderly people it is a safety problem (§9.4).

| Reviewer | Volume | Rate | Cost |
|---|---|---|---|
| **Native Cantonese speaker** — the critical check | 680 entries × 2–3 min | HK$150–300/hr | **HK$5,000–15,000** |
| **Native Filipino speaker** — the gloss check | 680 entries × 1–2 min | HK$120–250/hr | **HK$2,000–4,000** |
| | | **Total** | **HK$7,000–19,000** |

The Cantonese check is the one to spend on. It is also the one to keep *continuous* rather than
batch: reviewing 20 entries a week as they are written catches a systematic mistake on entry 5
instead of entry 600.

Filipino review is cheaper to source — Filipino VAs are widely available on Upwork at
US$8–15/hr, and the check is simpler (does the Tagalog gloss mean what the English gloss means).

---

## Pool C — engineering

~30 developer-days across the proposal's sequencing (§10):

| Work | Days |
|---|---|
| Entry types + `scenarios` table + migration (§4) | 2 |
| Persist `category_id` + category-scoped quizzes (§2.2–2.3) | 1.5 |
| `learner_word_state` + spaced repetition (§7.3) | 4 |
| Daily / weekly sets (§7.4) | 2 |
| Admin vocabulary table (§8.2) | 2.5 |
| Coverage report (§8.5) | 1.5 |
| Quiz upgrades — real `fill_blank`, sentence questions (§7.6) | 3 |
| Learner-facing reporting (§7.5) | 2.5 |
| Vocabulary payload fix — paginate/version the endpoint (§9.1) | 1.5 |
| Off-host, restore-tested backups (§9.3) | 1.5 |
| Content review tooling — `draft`/`published` status, review queue (§8.6) | 1.5 |
| **Subtotal** | **23.5** |
| Testing & verification (~25%, the project's existing standard) | 6 |
| **Total** | **~30 days** |

| Route | Cost |
|---|---|
| **AI-assisted** (you drive, as in every session so far) | **HK$0 cash**, ~30 days of your attention |
| **Hong Kong contractor** | HK$1,500–4,000/day → **HK$45,000–120,000** |
| **Offshore contractor** | US$25–60/hr → **HK$62,000–117,000** |

The honest observation: this codebase has been built AI-assisted from the start, with a
consistent verification discipline (headless browser checks, sabotage testing, live production
assertions). Continuing that way is not a shortcut — it is the same process that produced the
current working system. The cash cost of Pool C is genuinely near-zero; the cost is your review
time, and it is the largest *time* item in this document.

---

## Pool D — infrastructure (recurring)

| Item | Now | At ~3,000 users |
|---|---|---|
| Render web service | $7/mo (Starter) | $25/mo (Standard, headroom) |
| Persistent disk (1–5 GB) | ~$0.25/mo | ~$1/mo |
| Bandwidth (Render includes 100 GB/mo) | included | ~$0–8/mo — **near-zero once §9.1 lands** |
| Cloudflare (DNS, CDN, TLS) | free | free |
| Off-host backup (Backblaze B2 / S3) | ~$1/mo | ~$1/mo |
| Domain (`cantobuddy.com`) | ~HK$100/yr | ~HK$100/yr |
| **Total** | **≈ HK$60/mo** | **≈ HK$250–350/mo** |

Year one, all-in: **HK$2,000–4,000.**

Note the bandwidth line. Today `GET /api/vocabulary` returns every row to every client — fine at
64 entries, ~600 KB per app load at 3,000. **The payload fix is not a cost, it is a saving**: it
is what keeps the bandwidth line near zero at scale.

---

## Phased budget — what to actually authorise

You do not need the full HK$7,000–19,000 to start, and you should not spend it before the shape
is proven.

### Phase 1 — Tier A + the plumbing (recommended first spend)

| Item | Cost |
|---|---|
| ~120 entries (elder-care core), AI-drafted | HK$0 |
| Cantonese + Filipino verification of those 120 | HK$1,500–3,500 |
| Engineering: schema (§4) + `category_id` + category quizzes + coverage report | HK$0 cash (AI-assisted, ~6–8 days) |
| Infrastructure | HK$60/mo |
| **Phase 1 cash total** | **under HK$4,000** |

Phase 1 proves the shape: real phrase entries, real category quizzes, a coverage report that
shows the remaining gap. If the content architecture is wrong, you find out for HK$4,000 rather
than HK$20,000.

### Phase 2 — learner depth

`learner_word_state` + spaced repetition + daily sets + the admin vocabulary table.
~HK$0 cash AI-assisted (~12 days) · plus continuing content verification at ~HK$1,000–2,500 per
100 entries.

### Phase 3 — the remaining ~560 entries + scale work

Content verification HK$5,000–14,000 · payload fix + backups HK$0 cash (~3 days) · infra rises
toward HK$250–350/mo as users arrive.

---

## What is free — and one thing you avoid

**Free, and worth not re-buying:**

- **Text-to-speech.** The app uses the Web Speech API (`zh-HK`). There is no per-entry audio
  asset, no voice talent, no storage.
- **Hosting at current scale.** Cloudflare's free tier carries the CDN and TLS.
- **The curriculum design.** §5 already specifies the 24 categories and the scenario sets. You
  are paying to *fill* a plan, not to *make* one.

**Avoided:** human voice-over for 680 entries would run **HK$10,000–30,000** (studio time plus
talent, in two languages). Using the device's own voice removes that entirely — at the cost of a
slightly robotic accent, which is a reasonable trade for a vocabulary trainer.

---

## Assumptions — stated so you can argue with them

1. **Rates.** HK freelance trilingual content work HK$150–350/hr; HK native review HK$150–300/hr;
   HK contract development HK$1,500–4,000/day. Sourced from current market listings, October 2026.
2. **Volume.** ~680 entries = 24 categories × 3 levels × ~8, plus ~100 scenario phrases (§5.1).
3. **Depth.** Each entry carries an example sentence (§7.1). Without sentences, Pool A and B
   fall by roughly 40% — but the sentences are what make it teachable rather than a word list.
4. **Engineering is AI-assisted.** If it is hired out, add Pool C at HK$45,000–120,000.
5. **Render pricing** (Starter $7/mo, Standard $25/mo, disk ~$0.25/GB/mo, 100 GB egress included)
   is current as of the pricing page, October 2026.

**The two things that could move this materially:**

- **Content sourcing is the swing factor.** AI-drafted + verified vs agency-written is roughly a
  **5× difference** (HK$7,000 vs HK$112,000) and both produce a shippable product if the
  verification is real.
- **Depth creep.** Adding a second example sentence, or audio, or Cantonese variants per entry
  multiplies Pool A and B. Keep the entry shape fixed and the estimate holds.

---

## Recommendation

1. **Authorise Phase 1 at under HK$4,000.** It is the smallest spend that de-risks the whole
   plan — it proves the entry shape and the review process on 120 entries.
2. **Spend the money on Pool B, not Pool A.** Verification is where the quality lives, and it is
   cheap relative to its value.
3. **Keep the engineering AI-assisted.** It is how this system was built, and the cash cost is
   the difference between HK$4,000 and HK$120,000.
4. **Do the payload fix and the backups before you need them.** They cost ~3 days and no cash,
   and one of them is the difference between an incident and a loss (§9.3).
