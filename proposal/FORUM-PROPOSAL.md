# Feature Proposal & Evaluation: an open-source forum for helpers

**Date:** 2026-10-19
**Question:** should CantoBuddy add a forum where helpers can read freely, and only members can
post, edit and delete — with Filipino and Indonesian support?
**Recommendation in one line:** **build it inside this app (Phase 1 read-only first), do not embed an
off-the-shelf forum product** — the Filipino requirement is what settles it.

---

## 1. What you asked for

| # | Requirement | Status in today's app |
|---|---|---|
| 1 | **View without membership, or optional login** | Views are already public and login-free — Discover, Stories and every guide page render with no account |
| 2 | **Add / modify / delete: members only** | **Does not exist.** Today there are no learner accounts at all (`SOCIAL-FEATURES-PROPOSAL.md` Conflict 1) |
| 3 | **Filipino and Indonesian support** | The app is already en / fil / zh / id end-to-end — **but no forum product is** (see §3) |

Two of the three requirements are already satisfied by the architecture. The third is the problem.

---

## 2. Bottom line

**Recommendation: build the forum as a new channel inside this app.** Read-only version first
(no accounts, no risk), member posting second.

Three reasons, in order of weight:

1. **No open-source forum ships Filipino.** I checked the four serious candidates directly:
   Discourse has Indonesian and **no** Filipino locale; NodeBB has `public/language/id` and **no**
   Filipino directory; the Flarum language-pack org (`flarum-lang`) has neither; Apache Answer's
   language is chosen at install and I could not confirm Filipino coverage. Filipino is the largest
   single language group in this audience. An embedded product would either show Filipino-speaking
   users an English interface, or hand you a ~200,000-character translation project to own forever
   (every upstream update re-breaks it).
2. **Everything except #2 is already built here.** Public read, four-language UI, mobile-first
   design, the PWA, the moderation queue that already governs Stories, SEO/SSR — a forum product
   starts from zero on all of it and then has to be bolted onto this app's look.
3. **One service, one database, one deploy.** This app is one Node service with SQLite on a Render
   disk. An embedded forum means a second service, a second database, a second auth system, a
   second admin UI and a second deployment to keep patched — operated by one person.

**The honest counter-argument** (why you might still choose an off-the-shelf product): if you want
Discourse-grade machinery you cannot easily rebuild — trust levels, badges, digests, full-text
search, mature plugin ecosystem — and you are willing to run a VPS and own a translation, then
self-hosting is legitimate. §4 prices both paths so you can choose with your eyes open.

---

## 3. Evaluation of the open-source options

Verified 2026-10-19 against each project's own repository/docs. "Filipino / Indonesian UI" means
ships a translation, not "is translatable".

| | **Discourse** | **NodeBB** | **Flarum** | **Apache Answer** | **Build in place** |
|---|---|---|---|---|---|
| **Licence / stack** | GPL-2.0 · Ruby on Rails + Ember | GPL-3.0 · Node.js + Bootstrap 5 | MIT · PHP + Mithril | Apache-2.0 · Go + React | ours · Node + SQLite |
| **Database** | PostgreSQL 15 **+ Redis 7** | MongoDB 5+ **or** Redis 7.2+ | MySQL / MariaDB | MySQL, PostgreSQL **or SQLite** | SQLite (already running) |
| **Runs on our current Render service?** | **No** — second service + 2 data services | **No** — second service + Mongo/Redis | **No** — PHP host | **Partly** — same SQLite shape, still a separate service | **Yes** — what we already deploy |
| **Filipino UI** | **No** (no `fil` locale exists) | **No** (no `fil` language dir) | **No pack found** | Not confirmed | **Yes** — the app is already fil |
| **Indonesian UI** | **Yes** (`client.id.yml`, `server.id.yml`) | **Yes** (`public/language/id`) | **No pack found** | Not confirmed | **Yes** |
| **Mobile fit for a low-end Android** | Heavy (Ember SPA, 1 GB+ RAM server) | Medium-heavy | Light | Medium | Lightest — same app, same PWA |
| **Auth** | Its own accounts (email) | Its own accounts (email) | Its own accounts | Its own accounts | **Shares the app's learner identity** |
| **Joins our Stories moderation queue?** | No — separate admin | No | No | No | **Yes — already exists** |
| **Extra monthly cost** | ~HK$150–400 (VPS or Docker + Postgres + Redis) — confirm on pricing page | ~HK$150–400 (VPS + Mongo/Redis) | ~HK$60–150 (PHP host + MySQL) | ~HK$0–150 (small VPS, or beside this app) | **HK$0** |
| **Verdict for this audience** | ❌ No Filipino; heavy | ❌ No Filipino; heavy | ❌ No Filipino pack | ⚠️ SQLite is a real advantage, but coverage unconfirmed and it is still a second product | ✅ **Recommended** |

The pattern is the finding: **Indonesian is served everywhere; Filipino is served nowhere.** A
product choice here means shipping a second-class experience to the majority of your users.

---

## 4. What "open source" can still mean

If "open source forum" means *the software is open source*, §3 is the pick-list and the price is
above. Three alternatives that keep the benefit without the cost:

- **A. Build in place, keep it public.** The deployed repository is already public. A forum module
  in this repo is open source the same way the rest of the app is — anyone can read, fork, or reuse
  it. Nothing is lost except the product label.
- **B. Build in place, extract later.** Ship inside the app now; if it proves itself, split the
  schema + routes into a standalone package later. Extraction is cheap when you own the code.
- **C. Embed Apache Answer on SQLite.** The only candidate that fits our single-service shape
  (no Postgres, no Redis). Still a second deploy, a second auth, an unconfirmed Filipino UI, and a
  Q&A-shaped model rather than a discussion forum. Worth revisiting **only** if Filipino coverage
  turns out to exist and you accept a second product in production.

---

## 5. How the three requirements map onto what we have

**Read without membership.** Already true. A forum channel in Discover — a fourth tab beside
Culture / News / Stories, **not** a seventh bottom-nav tab (the rule that has held since Stories
shipped) — with server-rendered pages so a topic is readable, shareable and indexable without any
JS.

**Members only to add/modify/delete.** This is the one genuine new dependency, and it is the same
fork the earlier proposal identified: *"Learner = device identity, never an account."* The earlier
recommendation was **optional accounts for sharing, learning stays anonymous forever** — which is
exactly your requirement. Assumptions I have made, to confirm:

- A member can only modify/delete **their own** posts (edit by anyone else is a moderator tool).
- Reading never requires login. Posting does.
- Email is a barrier for this audience (many helpers have none; SMS costs money per user). Options:
  **(a)** email + password (standard, needs verification and reset flows), **(b)** chosen username +
  device-linked account (no verification cost, but no recovery if the phone is lost), **(c)** phone
  + SMS OTP (best UX, costs ~HK$0.10–0.30 per verification). My recommendation: **(b) for v1**,
  because it costs nothing and matches the app's existing device identity; add (a) when budget
  allows.

**Filipino / Indonesian.** Free, because the app already has the i18n layer, the four-language
field pattern and the translations. A forum's ~40 new UI strings are far cheaper than a platform's
~200,000.

---

## 6. Safety and moderation — the part that actually decides this

This audience is mostly women, many in situations where being identified carries real risk. A public
forum is a materially different risk surface from a vocabulary app, and this is where I would spend
the most care. Non-negotiables:

| Risk | Design answer |
|---|---|
| **An employer finding her posts** | Anonymous by default; a display name is never the real name; **no photos in v1**; a standing rule "never post your employer's name, address or schedule" shown where she types |
| **Harassment and pile-ons** | Pre-publish moderation (the Stories model): nothing is public until a moderator approves it. Post-publish moderation is too late for this audience |
| **Scams — job ads, lending, recruitment, trafficking** | A category for jobs is **not** offered in v1; a keyword/pattern flag list in the moderation queue, and a one-tap **Report** on every post |
| **Impersonation and sock-puppets** | One account per device in v1; rate limits per device; accounts never show email or phone |
| **Data minimisation (PDPO)** | Store display name + text only. Account deletion removes posts and account, keeps nothing linkable. Published content retained, takedown on request |
| **Moderator burnout** | One moderator (you) + a written policy + a documented escalation path. If this is not sustainable, the forum should not launch — this is the single most common failure mode of community sites, and it is an operational cost, not a code cost |
| **SEO downside** | User threads can be thin or spammy: noindex on paginated/user pages, canonical on topics, `Disallow` on search result URLs |

Estimated ongoing load: at low volume, **15–45 minutes a day** in the moderation queue.

---

## 7. Phased plan (with acceptance criteria)

Each phase is deployable on its own and leaves the app safe if we stop there.

### Phase 1 — Read-only forum channel (no accounts, no risk)
New `forum_topics` + `forum_posts` tables; a "Forum" channel inside Discover; server-rendered
topic pages; seeded topics (a handful of real, useful threads: day-off requests, market vocabulary,
Sunday routines) plus the moderation queue already wired for anything user-submitted.
**Acceptance:** every topic readable with no login, in all four languages, < 1.5 s first paint on a
mid-range Android, in the sitemap, and the channel is a tab inside Discover — never a seventh nav
tab. **~4–6 dev-days.**

### Phase 2 — Optional accounts + member posting
Accounts (§5 option b), then post / reply / edit-own / delete-own, each submission entering the
moderation queue before it is visible.
**Acceptance:** a helper with no account can read everything and cannot see a compose box; a member
can post, edit and delete only her own; every submission is invisible until approved; account
deletion removes her rows. **~8–12 dev-days — the high-risk phase** (auth done *correctly*:
rate limiting, session theft, deletion, and the "no recovery" trade-off must be explicit).

### Phase 3 — Moderation tooling
Report button, queue with keyword flags, ban device/account, takedown, and a written moderator
policy page.
**Acceptance:** every post carries a report target; a banned account cannot post; the queue shows
reporter history. **~3–5 dev-days.**

### Phase 4 — Optional extras (only if 1–3 are healthy)
Reactions instead of open comments, search, and notifications. Reactions keep the social signal
without a second moderation surface.

---

## 8. Cost estimate (HK$, assumptions stated)

Assumptions: AI-assisted build as in `COST-ESTIMATE.md`; one operator; Render free/starter tier
unchanged for Option B; third-party prices are **indicative and must be confirmed on the provider's
pricing page** before committing.

| Path | Build (one-time) | Monthly infra | Ongoing operator time |
|---|---|---|---|
| **Recommended — build in place (Phases 1–3)** | **~HK$0 cash**, 15–23 dev-days | **HK$0** | 15–45 min/day moderation |
| Phase 1 only (read-only) | ~4–6 dev-days | HK$0 | minimal |
| Self-host **Apache Answer** (SQLite, small VPS) | 3–5 days setup + theme/translation | ~HK$0–150 | 15–45 min/day + 1 day/month maintenance |
| Self-host **NodeBB** (+ Mongo or Redis) | 3–5 days + translation | ~HK$150–400 | as above |
| Self-host **Discourse** (+ Postgres + Redis, Docker only) | 3–5 days + Filipino translation project | ~HK$150–400 | as above, more |

The build-in-place path is not free — it costs **your moderation time every day, forever**, which is
the number that matters more than any of the others.

---

## 9. What would change my recommendation

- **A Filipino translation appears upstream** (a Discourse/NodeBB/Flarum/Answer `fil` locale) and you
  accept a second product in production → self-hosting becomes defensible.
- **Volume outgrows one moderator** → pre-publish moderation stops scaling; either the forum is
  volunteer-moderated or it should be closed to new threads. A forum that cannot be moderated is
  worse than no forum.
- **Render's single-disk SQLite becomes the bottleneck** (it will, eventually) → that is a database
  conversation, not a forum conversation, and it applies to the whole app.

## 10. What I need from you before building

1. **Confirm the auth model** (my recommendation: username + device link, no email, in v1).
2. **Confirm anonymous-by-default** with an optional display name per post.
3. **Confirm you will moderate daily** — if not, Phase 1 (read-only, curated topics) is where we
   stop, and that is a genuinely good outcome.
4. **Photos in v1?** My recommendation is no.
5. **Do you want the forum to be in-app only, or also public/SEO-visible?** (My recommendation:
   public — it is how helpers searching for "ask for a day off in Cantonese" would ever find it.)

---

## Status: **proposal only. Nothing here is built.** No code, schema or route has been changed for
this feature.
