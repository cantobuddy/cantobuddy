# CantoBuddy — Growing in the Filipino Community in Hong Kong

**Date:** 5 October 2026
**Audience:** ~200,000 Filipino domestic workers in Hong Kong
**Question:** how does this app become known among them?

---

## The short version

Do not run ads. This community is a **tight, high-trust, referral-driven diaspora
network** — ~200,000 people who mostly know each other, gather in the same few places
every Sunday, and coordinate in WhatsApp groups. Word of mouth is not one channel
here; it is the channel.

Two things follow:

1. **Make sharing work** — done, see below. A share now carries a picture, goes to
   WhatsApp in one tap, and is attributed so you can see which channel produced it.
2. **Be where the community already looks for Cantonese learning.** This is the part
   that needs a human. It is laid out in *Where to go*.

---

## The insight that should drive the whole plan

**Cantonese learning is already an organised activity in this community.**

The Filipino Hub — a community directory for Filipinos in HK — lists, as community
events:

- *Basic Cantonese Class*, Sung Wong Toi, 11:30 am
- *Cantonese in Professional Use 3 (BC-45)*, Kowloon, every Sunday, 3:00 pm

So the demand is not hypothetical, and the discovery layer is not a mystery: there is
an existing habit of *finding and attending* Cantonese instruction. Most of it is
Sunday-only, classroom-based, and in a fixed location.

**CantoBuddy's position is not "another Cantonese app". It is the thing that fills the
six days between classes** — free, in her pocket, offline-capable, in Filipino, and
using the vocabulary she actually needs for work. That is a complement to the classes,
not a competitor, which matters because it means the classes and their organisers are
potential allies rather than rivals.

**Say it that way everywhere.** "Free Cantonese practice for helpers in Hong Kong" is
weaker than "the practice that goes with your Sunday Cantonese class."

---

## What was built to make it spread

Growth code is only worth writing if the share is worth sending. Four changes:

**1. Shareable image card.** Text-only shares die in a busy group chat. The app now
renders a 1080×1080 PNG of any word — the Cantonese characters, the Jyutping, the
English and Filipino meanings, and the domain — using canvas, so there is no server
round-trip, no new dependency, and it works offline. Verified: 107 KB, correct
dimensions, not blank.

**2. WhatsApp, one tap.** A dedicated green button, because WhatsApp is where this
community actually talks and the OS share sheet buries it several taps deep on many
Android builds. One tap is the difference between a share happening and not.

**3. Referral attribution.** Every link a helper shares now carries her own code
(`?ref=`), and the device that opens it records her as its referrer. First-touch:
written once, never overwritten, so a later visit from a different link cannot steal
credit. Her code is a **one-way hash of her device id** — safe to publish, unlike the
device id itself, which controls her display name and her employer links. Verified
that a share from a `/join/<code>` page cannot leak an invitation.

**4. Word shares deep-link.** Sharing a word now links to `/words/thank-you` — a real
page with the meaning, pronunciation and related words — instead of dumping the
recipient on the home screen.

**How to read the results.** `/api/admin/referrers` returns counts by referrer:

| referrer | meaning |
|---|---|
| `7K3M9QZP` (8-char code) | a helper's own link — word of mouth |
| `sun` / `fbgroup` / `qr-central` | a channel tag you put on a link |
| `(direct)` | typed the domain or came from a search |

Counts only — no names, no device ids. Tag every link you put anywhere with `?ref=`,
and this table becomes the answer to "which channel is working".

---

## Where to go

Ranked by expected return per hour of effort.

### Tier 1 — where the community already looks for Cantonese learning

**Get CantoBuddy into The Filipino Hub.** `thefilipinohub.com` is the community's own
directory — businesses, services, events, community groups. It is where the Cantonese
classes are listed, which means it is where someone looking for Cantonese learning
already is. Two moves: submit CantoBuddy as a free service/resource, and contact them
about the classes they already list. **If you only do one thing, do this.**

**Partner with the existing class organisers.** They have the students; you have the
practice tool that keeps students between lessons. Offer it as the free homework app
for their class. This is the single highest-trust introduction available — a
recommendation from a teacher the community already trusts outperforms any post you
could write.

**Get listed in Filipino community directories and orgs.** FullPhils and similar
Filipino-HK organisations maintain member and resource lists. Free, permanent, and
they show up in searches.

### Tier 2 — community media

**The SUN HK** (`sunwebhk.com`) is the leading free Filipino newspaper in Hong Kong —
physically given away to Filipinos, with **Sun Radio HK**, a 24-hour online station
attached. This is the community's own press, and it covers exactly this kind of
community story. Pitch: *a free app that helps helpers learn Cantonese, built for
them, in Filipino*. Offer a QR code for print and a short interview for radio.

One placement here reaches more of the target audience than months of social posting.

### Tier 3 — TikTok

The strongest evidence in the research: an academic study opens by noting the *"immense
popularity of TikTok among the over 200,000 Filipino domestic workers in Hong Kong"*,
and the platform has been written up as the thing that connected this community during
the pandemic. For this audience TikTok is not optional.

What actually works, given the product:

- **One word per video, 15 seconds.** The card is already made — screen-record it with
  audio pronunciation. The hook writes itself: *"Ano ang 'thank you' sa Cantonese?"*
- **Job-real situations.** "What to say when the baby is crying", "how to ask your
  employer for a day off". This is the content nobody else makes, and it is the content
  that gets forwarded to a group chat.
- **Tagalog voice-over.** The whole differentiator is that this is in Filipino. Most
  Cantonese content is English-first.
- **Post consistently, not perfectly.** Volume beats production value on this platform.

### Tier 4 — physical presence, one Sunday a month

Every Sunday, thousands of Filipinas gather in **Central — Statue Square, Chater Road,
and around Worldwide House**. It is the largest regular concentration of the exact
target audience that exists.

A printed card with a QR code (`?ref=qr-central`) handed out, or a small banner where
helpers already queue, produces attributed, measurable installs. The QR code is the
whole trick: you will know exactly what that Sunday produced.

### Tier 5 — the employer loop (the channel competitors do not have)

Employers *want* their helper to speak Cantonese — it makes the household work. That
gives a second distribution path, from the other direction:

- The employer portal already exists. Rewrite `/portal` as a real landing page aimed at
  employers searching for "helper Cantonese" or "how can my helper learn Cantonese",
  and make it indexable (it is currently `noindex`).
- Employment agencies are a concentrated channel: the MWO-accredited list alone runs to
  **648 agencies**. Agencies recommend things to employers constantly. One agency that
  recommends CantoBuddy to every placement is worth more than any amount of posting.
- Employers telling *other employers* is how this compounds — and the app is free, so
  there is nothing to justify.

---

## Content that earns its own traffic

Community outreach creates spikes. Search traffic compounds. The SEO work now gives you
159 pages; the constraint is that they are built from 64 words.

The long-tail to write for is situational, not lexical:

- "What to say when the baby is crying (Cantonese)"
- "Cantonese phrases for cleaning and laundry"
- "How to ask your employer for a day off — Cantonese and Tagalog"
- "Cantonese for taking care of an elderly person"

Each one is a page a helper would actually search, phrased the way she would phrase it,
answering in Filipino. No general Cantonese resource covers these, because no general
Cantonese resource is written for this job.

---

## What to watch

| Metric | Where | Why |
|---|---|---|
| Referrer breakdown | `/api/admin/referrers` | which channel is actually working |
| Installs (PWA) vs visits | analytics | is it becoming an app she keeps, not a site she saw |
| Words practised per learner | Admin → Progress | did it get used, or just opened |
| Learners with an employer link | Admin → People | is the employer loop producing anything |

Pick **one** channel, tag it, run it for two weeks, and read the table. Do not run five
at once — you will not learn anything.

---

## First 30 days

**Week 1 — get listed.** Submit to The Filipino Hub. Email The SUN HK. Both are one-off
emails with permanent results.

**Week 2 — the classes.** Contact the Cantonese class organisers. Offer CantoBuddy as
free practice between lessons. This is the highest-trust lever available.

**Week 3 — TikTok.** Post 5 short word videos. One word each, Tagalog voice-over, the
card as the visual. Tag links with `?ref=tt`.

**Week 4 — one Sunday in Central.** Print 500 cards with a `?ref=qr-central` QR code.
Hand them out. Then read `/api/admin/referrers` and find out what a Sunday is worth.

Then do more of whatever won.

---

## What not to do

**Do not run paid ads yet.** The audience is small, tightly networked and
recommendation-driven. You will pay to reach people who would have heard about it from
a friend for free, and you will learn nothing about which channel actually works.

**Do not post and hope.** Every link you put anywhere gets a `?ref=` tag. Untagged
traffic is invisible traffic, and invisible traffic cannot be repeated.

**Do not lead with features.** "Jyutping romanisation" means nothing to her. "You can
say thank you to your amo by Friday" does.

**Do not treat the SEO work as growth.** It makes the site findable. It does not make
anyone want it. That is this document's job.

---

## Honest limits

Everything in Tier 1–5 needs a human with a phone and an email address — I cannot send
the emails or hand out the cards. What is now in place is the machinery that makes each
of those actions **measurable**, so the effort compounds instead of evaporating.

Two things need a decision from you:

1. **Who owns the TikTok account?** Consistent posting is the whole game there, and it
   needs one person.
2. **Should `/portal` become an indexable employer landing page?** It is a small change
   and it opens the one channel competitors do not have — but it makes a page public
   that is currently private, so it is your call.

And the brand risk from the SEO audit still stands: **`cantoboo.com`** is one character
away, in the same category, and currently outranks CantoBuddy for its own name.
Community presence helps here too — the more the name is attached to a specific,
trusted thing ("the one the Sunday class uses"), the less the collision costs.
