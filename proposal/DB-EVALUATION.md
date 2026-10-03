# CantoBuddy 2.0 — Database Route Evaluation

**Prepared:** 3 October 2026 · **Revised:** 4 October 2026
**Constraint given:** *"I don't spend more on database at this moment"*
**Status:** Recommendation revised — **$0 extra spend, no new vendors**

---

## 1. Your constraint, and what it changes

You don't want to add a database bill. That is a reasonable line to draw, and it is **completely compatible with everything in the proposal** — a real database does not have to cost anything.

But it does change the recommendation. When cost was one factor among several, I leaned toward Supabase because it hands you authentication. With cost as the binding constraint, a better option comes forward: **SQLite, using the disk you already pay for.**

**Current spend: $7.00/mo Render Starter + $0.25/mo disk = $7.25/mo.**
The recommendation below leaves that **unchanged**. It does not add a single cent.

---

## 2. The $0 options, honestly compared

| | **SQLite on your existing disk** | **Supabase Free** | Neon Free | Render Postgres Free |
|---|---|---|---|---|
| **Extra cost** | **$0** | **$0** | **$0** | $0 for 30 days |
| **New vendor to manage** | **none** | 1 | 1 | none |
| **New dependencies** | **none** | SDK | driver | driver |
| **Real SQL** | ✅ | ✅ | ✅ | ✅ |
| **Auth included** | ❌ build it | ✅ yes | ❌ | ❌ |
| **Survives idle periods** | ✅ | ❌ pauses after 7 days | ⚠️ cold starts | ✅ |
| **Backups** | ✅ built in, you schedule | ❌ **none on free** | ⚠️ limited | ❌ none |
| **Data limits** | your disk (1 GB) | 500 MB | 0.5 GB | 1 GB |
| **Viable?** | ✅ **Recommended** | ✅ Good alternative | ⚠️ | ❌ **Expires in 30 days, deletes data** |

Note what is *not* in this table: nothing costs money. **Every viable option is $0.** The question is only *which free option is least risky for you*.

---

## 3. Recommended: SQLite on the disk you already have

### It is genuinely free, and genuinely nothing new

SQLite is a database that lives in a single file. Your app already has a **persistent disk mounted at `/data`** — bought for `db.json`, already paid for, already working. Moving from a JSON file to a SQLite file on that same disk adds:

- **$0** to the monthly bill
- **0** new accounts, vendors, dashboards or passwords
- **0** new npm dependencies

### It needs no new dependency — verified, not assumed

Node.js has had a **built-in SQLite module since v22.5**, and I confirmed on your actual Node version (`v22.22.2`) that `node:sqlite` loads **without any flag** and exposes `DatabaseSync`, `StatementSync` and `backup`. So this is a change to the data layer only — `package.json` stays exactly as it is today, with just `express` and `express-session`.

I also ran the three things Phase 1 actually depends on, against your Node build:

| Test | Result |
|---|---|
| Upsert on `session_id` (`ON CONFLICT … DO UPDATE`) | ✅ 2 saves of one session collapsed to **1 row** — the exact bug we fixed in the JSON store, now enforced by the database itself |
| Relationship join (employer → helper → progress) | ✅ returned the correct aggregated score |
| Backup (`backup()` **and** `VACUUM INTO`) | ✅ both produced consistent single-file snapshots, 5/5 rows intact |

### Why this is the right fit now

**It solves the real problems.** Phase 1 needs concurrent-safe writes, relationships, and queries. SQLite with WAL mode gives all three: proper transactions, real foreign keys, real `JOIN`s, and a schema the database enforces rather than the application hoping. The `session_id` uniqueness that we had to hand-code becomes a database constraint.

**It removes the failure modes that free Postgres tiers bring.** No 7-day inactivity pause, no 30-day expiry, no cold starts, no quota that silently stops writes. Your data sits on infrastructure you already control and already understand.

**It keeps the upgrade path open.** It is plain SQL. Moving to Postgres later — when there is revenue to justify it — is a schema port and a data copy, not a rewrite.

**It matches your scale.** Render's Starter instance is 0.5 CPU / 512 MB RAM. SQLite on that comfortably serves thousands of learners. You would hit other limits long before the database.

### The honest downsides

- **You build the authentication.** Supabase would hand you sign-up, login and password reset. Here we build them with `express-session` (already in your stack) and a password-hashing library. That is real work, and it is the most security-sensitive code in the project — but it is a well-trodden path, and it is testable.
- **One server, no horizontal scaling.** Fine now; it becomes a real question only at a scale you are nowhere near.
- **Backups are your job.** More on this below — it matters.
- **`node:sqlite` is marked experimental.** That means the API *could* change in a future Node release; it does **not** mean it is unreliable. We use a tiny, stable surface (`DatabaseSync`, `prepare`, `run`, `all`, `get`, `exec`). We should pin the Docker image to an exact version (`node:22.22-alpine` rather than `node:22-alpine`) so nothing shifts underneath you unexpectedly.

---

## 4. Backups — the one thing not to skip

**Free tiers generally do not include backups, and this project has already lost learner progress once.** Whatever route you choose, backups are on us. With SQLite this is unusually cheap to solve properly:

- `backup()` and `VACUUM INTO` both produce a **consistent single-file snapshot** while the app keeps running — verified above. (Important: with WAL mode you must not simply copy the `.db` file; you would miss recent writes. Use one of these two methods.)
- A nightly job takes a snapshot and **copies it off the disk**. A copy on the same disk is not a backup — it dies with the disk.
- A free destination: commit the snapshot to a **private GitHub repository**, or push it to a free object store. Either costs nothing.

**Treat this as part of Phase 1, not a nice-to-have.** It is the difference between a bad afternoon and losing Jeanilyn's progress again.

---

## 5. The alternative: Supabase Free ($0)

Still completely free, and still a good product. **Choose it if you would rather not build authentication yourself** — it gives you sign-up, login, sessions, password reset, Row Level Security and file storage out of the box, which is a large chunk of Phase 1.

What you take on in exchange:

- **A second vendor.** Another console, another account, another set of credentials, another thing that can break at 11pm.
- **A 7-day inactivity pause.** Solvable with a free uptime ping, but it is a new failure mode that does not exist with SQLite.
- **No backups on the free tier.** You would still need your own dump routine.
- **500 MB ceiling.** Distant at your scale, but it is a ceiling.
- **Email limits.** Supabase's built-in email sender is for testing only; production password-reset mail needs your own SMTP provider anyway — so it does not fully remove the email problem.

It is a legitimate choice. It is simply *more new things to manage*, in exchange for less code to write.

---

## 6. Ruled out

**Render Postgres Free** — expires after **30 days** and permanently deletes your data, with no backups and no grace period. It is a trial, not a tier. Not viable. The paid tier (~$7/mo) is a fine product, but it is exactly the extra spend you ruled out.

**Neon Free** — free and good, but no auth and scale-to-zero cold starts, which is the wrong behaviour on a cheap Android phone over mobile data.

**WorkBuddy Cloud Service** — attractive on paper, but it enforces an **exact origin match** and only serves the WorkBuddy-published domain. CantoBuddy is live on Render at `cantobuddy.com`, so its calls would fail. Using it means abandoning your current deployment entirely.

**Staying on the JSON file** — not viable. A single file cannot serve concurrent writers safely (two learners finishing a quiz at the same moment can lose data), has no relationships, no query engine and no audit trail. It has done its job and should be retired in Phase 1.

---

## 7. Recommendation

> **Move from `db.json` to SQLite on the existing `/data` disk.**
> **Extra monthly cost: $0. New vendors: none. New dependencies: none.**
>
> Pin the Docker image to `node:22.22-alpine`. Add a nightly snapshot with an off-disk copy in Phase 1. Revisit Postgres only when there is revenue that justifies it — the migration is a port, not a rewrite.

**If you would rather trade $0 for less code to write, Supabase Free is the alternative** — also $0, but it adds a vendor, a pause risk, and no backups.

**Either way, this decision should not hold up Phase 1.** Both are free, both are SQL, and the dataset is small enough that switching later is an afternoon's work.

---

## 8. Still worth settling

**Are you operating as a sole trader or a limited company?** Unrelated to the database, but it affects your personal liability and how you sign up for these services. (It used to matter for donations too — donations have since been removed from the plan, so only the liability and sign-up angles remain.) Easier to decide before the accounts exist than after.
