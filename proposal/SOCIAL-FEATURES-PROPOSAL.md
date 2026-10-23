# Feature Proposal: Accounts, Social Sharing & Admin Moderation

**Date:** 2026-10-17
**Context:** Operator requested (a) swap Discover/Learn nav icons, (b) user login accounts,
(c) progress tracking with login, (d) sticker sharing, (e) ad hoc helper news with location and
photos, (f) content feedback, (g) CRUD for shared content, (h) quiz works both logged in and
anonymous, (i) admin moderation for helper news and stories.

---

## Part 1: What I did immediately

- ✅ **Nav icon swap** — Discover (🌏) and Learn (📖) positions swapped in `public/index.html`.
  Zero functional change; active-state logic is keyed on `data-view`, not DOM order.

---

## Part 2: The three conflicts

These are not blockers, but they are **forks**. Each one changes a decision that was explicitly
made and recorded in the project memory. I am flagging them so you choose knowingly.

### Conflict 1: "Learner = device identity, never an account"

**Current state:** A helper is identified by a device token (`public_id`). She never signs up,
never sets a password, and her progress lives on her phone. If she switches phones, she starts
fresh. This was a deliberate choice — "no sign-up" is the app's core promise.

**Your request:** Phone or email + password + display name.

**What this means:**
- A helper must now create an account before she can post news, share stickers, or track progress
  across devices.
- The "no sign-up, no cost, works offline" promise in your Facebook posts becomes "sign up to
  share" — a different product.
- You need email verification or SMS delivery (costs money, needs a provider like Twilio or
  SendGrid).
- You need a password-reset flow.
- You need to handle account deletion (GDPR / PDPO).

**Options:**
- **A. Keep device identity for learning, add OPTIONAL accounts for sharing.** She can learn
  anonymously forever. To post news or save progress across devices, she creates an account.
  This is the smallest change that satisfies your request.
- **B. Make accounts mandatory for everything.** Higher friction, but simpler data model.
- **C. Keep device identity, skip accounts entirely.** News posts are still anonymous (or use a
  chosen display name per post, no password). Progress stays per-device.

**My recommendation: A.** It preserves the "no sign-up to learn" promise while enabling the social
features you want.

---

### Conflict 2: "Feedback is anonymous by design"

**Current state:** The feedback button (💬) sends a message to the operator. The helper's name is
optional and defaults to empty. The operator cannot reply directly. This was deliberate — helpers
should not fear retaliation for honest feedback.

**Your request:** "Other users can give feedback immediately" on shared content.

**What this means:** Comments, likes, or reactions on news posts and stories. These are public
and attributed (or at least linked to an account). This is a social feature, not an operator
feedback channel.

**Options:**
- **A. Add public comments on stories/news.** Requires moderation (spam, abuse). Adds significant
  complexity.
- **B. Add simple "reactions" (👍 ❤️ 🙏) instead of text comments.** Less moderation burden, still
  gives feedback.
- **C. Keep feedback anonymous and operator-only, add a separate "report" button on shared content.**
  No social feedback, but users can flag bad content.

**My recommendation: B for stories/news, C for operator feedback.** Reactions are enough social
signal without opening a moderation nightmare.

---

### Conflict 3: "A story is anonymous unless she asks"

**Current state:** Stories in Discover are anonymous by default. The `display_name` column exists
but is empty unless the helper chooses to name herself. The name is dropped at write time — it is
not stored separately from the story.

**Your request:** Display name on shared content, separate from platform news.

**What this means:** Ad hoc news posts would carry a display name by default. This is the opposite
of the current privacy model.

**Options:**
- **A. Default anonymous, optional display name per post.** Same as stories now.
- **B. Default display name (from account), optional anonymous.** Requires accounts.
- **C. Platform news stays anonymous, ad hoc helper news uses display names.** Two different
  privacy rules for two different content types.

**My recommendation: A.** Let the helper choose per post. This is what stories already do.

---

## Part 3: Phased proposal

### Phase 1 — Ad hoc helper news (no accounts needed)

**What:** A new "Report" button inside Discover → News. Helpers can submit:
- What happened (text, up to 600 chars)
- Where (free text — "Central Sunday market" or "Victoria Park")
- When (auto-filled, editable)
- One photo (compressed to < 500KB)
- Display name (optional, defaults to anonymous)

**Admin:** New "Helper News" tab in admin. Pending → Approve / Reject / Edit.
**Public:** Approved posts appear in Discover → News, mixed with imported news, clearly labelled
"Reported by a helper."

**Why first:** It extends the existing stories moderation pipeline. No new auth system. Can ship
in a few days.

**Schema change:** New table `helper_reports` (or extend `posts` with a `source='helper'` column).

---

### Phase 2 — Optional accounts + cross-device progress

**What:** A "Save my progress" prompt after N quiz sessions. She can:
- Create account with email + password + display name
- OR skip forever and stay anonymous

**With account:**
- Progress syncs across devices (login on new phone = old progress)
- Can edit/delete her own stories and news reports
- Can download/share stickers she has earned

**Without account:**
- Everything works exactly as today
- Stories/news still allowed, but no edit/delete after posting

**Why second:** It requires the most code (auth flows, password reset, email verification) but
unlocks everything else.

**Schema change:**
- Extend `users` table (already has `role='learner'` placeholder) with `phone` field
- Link `users.learner_id` to existing `learners` row on first login
- Migration: existing device-based progress stays, optionally linked later

---

### Phase 3 — Reactions + sticker gallery

**What:**
- 👍 ❤️ 🙏 reactions on stories and helper news
- A "My Stickers" page where logged-in users can view and download earned stickers as images
- Share sticker to WhatsApp / Messenger (Web Share API)

**Why third:** It depends on Phase 2 accounts (you need to know who earned which sticker).

---

### Phase 4 — Admin moderation expansion

**What:**
- Admin can edit helper news posts before approving
- Admin can remove approved posts
- Admin can view reporter history (for pattern detection — spam, abuse)
- Admin can ban a reporter account

**Why last:** It depends on having enough content volume to matter.

---

## Part 4: Honest scope estimate

| Phase | Days | Risk |
|---|---|---|
| Phase 1 | 3–4 | Low — extends existing stories pipeline |
| Phase 2 | 8–12 | **High** — auth is easy, auth *correctly* (password reset, email delivery, rate limiting, account deletion) is not |
| Phase 3 | 3–4 | Low — UI work, no new backend concepts |
| Phase 4 | 2–3 | Low — admin UI |
| **Total** | **16–23 days** | |

This assumes I do all the work. If you have a developer, Phase 2 can parallelise (they do the
auth UI while I do the backend).

---

## Part 5: What I need from you

Before I write any code, answer these:

1. **Account model:** A (optional accounts for sharing), B (mandatory), or C (skip accounts)?
2. **Feedback model:** A (public comments), B (reactions only), or C (report button only)?
3. **Display name:** A (default anonymous per post), B (default named from account), or C (mixed)?
4. **Email or phone or both?** Email is free to send (Gmail SMTP). SMS costs money (~$0.05–0.10
   per message via Twilio). Email verification is standard; phone verification is stronger against
   fake accounts but costs more.
5. **Do you want me to start Phase 1 now** (ad hoc news, no accounts), or do you want to decide
   all phases first?

---

## Part 6: One more thing — the sticker request

"Download and share the sticker anytime" conflicts with how stickers currently work. Stickers are
**rewards** — you earn them by getting quiz answers right. "Download anytime" means either:

- (a) Stickers are freely downloadable from the start (no reward mechanism), OR
- (b) Logged-in users can download stickers they have **earned**

I wrote the proposal assuming (b) — download/share only stickers you have earned. If you meant
(a), tell me, because that changes the entire reward system.
