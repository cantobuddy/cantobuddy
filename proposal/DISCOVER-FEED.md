# Discover — the culture and news feed

**Built:** 14 October 2026
**Answers:** the request to "attract more users who visit regularly" with (1) a Hong Kong
culture section that is posted to regularly, and (2) a Hong Kong local-news section
translated to English.

**Status:** implemented and tested (61 assertions in `tools/posts-test.js`), and the whole
regression re-run green. Two things still need a human — see **What needs review** at the
end.

---

## What was decided, and why

Three choices were made before any code was written.

| Question | Choice | Why it matters |
|---|---|---|
| Where does the news come from? | **Public sources, summary + link** | Republishing a newspaper article — in any language — is copyright infringement. A translation is a *derivative work*, and the paper owns the original. |
| How are posts published? | **Automated from RSS** | The feed stays fresh without anyone remembering to post. |
| Where does it live in the app? | **One "Discover" tab** | The bottom nav already had five tabs; two more would break every label on a 360px phone. |

---

## The finding that shaped the news section

The request was "local news from HK local newspaper, translated to English". The obvious
implementation is *fetch Chinese news → machine-translate it*. **That is not what this
does**, and the reason is worth recording.

Both sources we are allowed to use **publish their own official English edition** of every
story, alongside the Chinese one:

| Source | English feed | Chinese feed |
|---|---|---|
| HK Government Press Releases (`info.gov.hk`) | `general_en.xml` | `general_zh.xml` |
| RTHK News — Local (`rthk.hk`) | `e_expressnews_elocal.xml` | `c_expressnews_clocal.xml` |

So "translated to English" is already done — **by the publisher, to a far higher standard
than a machine manages, with no API key and no cost.** A machine-translated headline about
a court case or a policy change is exactly the kind of text where a small error misinforms,
and the sources make that unnecessary.

`translate.js` still exists for the case that remains — a source that publishes **only** in
Chinese. It is keyed on an environment variable (`DEEPL_API_KEY` or
`GOOGLE_TRANSLATE_API_KEY`), and with no key configured an un-translated item is **skipped
and reported, never published** — a Chinese headline in the English feed is worse than a
missing story. Neither key is set on this deployment. That is a supported state, not a
broken one.

**A thing that did NOT work, and is worth knowing:** the English and Chinese feeds cannot be
paired. Both cover the same day's news, but they assign **different document ids** to the
same story (`P2026101400625` vs `P2026101400624`; RTHK `1873966` vs `1873974`), and the
order differs. So there is no way to attach the Chinese headline to its English item. The
Chinese feeds are recorded in `news.js` for provenance only.

---

## The copyright guard, in code

A feed item carries the **whole article** in its `<description>`. The importer throws that
away and keeps only:

- the headline,
- the first sentence or two, as a summary (hard-capped at 320 characters),
- the source's name and a link to the original.

The post's `body` columns are **never written for an imported item**, so there is no field a
full article could ever be stored in — and `tools/posts-test.js` asserts that, because the
guard has to survive a future edit by someone who has not read the comment.

Every imported card and page carries the source name and a "Read the full story" link, and
the article's structured data includes `isBasedOn` pointing at the original, so the source
keeps the credit and the traffic.

---

## What was added

**Data** — a `posts` table (`db.js`): one row per article, two channels over one shape
(`culture` | `news`), per-language `title` / `summary` / `body` × en/fil/zh/id, plus
attribution (`source_name`, `source_url`, `source_key`). `source_key` is uniquely indexed,
which is what makes re-running the importer idempotent.

**Importer** — `news.js` + `tools/fetch-news.js`. Fetches both sources, parses RSS with no
dependencies, builds summaries, and inserts. Never throws on one bad feed.

**API** — public `GET /api/posts` and `/api/posts/:slug` (published only); operator
`GET/POST/PUT/DELETE /api/admin/posts` and `POST /api/admin/posts/import`.

**Learner app** — a sixth bottom-nav tab, **Discover** (🌏), with two sub-tabs and an
article view. Per-language fields fall back to English. Bodies are sanitised against a tag
allowlist before they reach the DOM.

**Server-rendered pages** — `/discover` and `/discover/:slug` in **all four** language
trees, plus sitemap entries and a `robots.txt` allow. This is the part that brings new
people in: the app renders every view into `/`, so without these the whole feed would be
invisible to a search engine.

**Scheduling** — off by default. Set `NEWS_FETCH_INTERVAL_HOURS=6` to fetch on a timer, or
press **Fetch news now** in the admin. On a host that sleeps, the timer will not fire while
the instance is asleep — a Render Cron Job hitting the import endpoint is the reliable
version. (See *Open follow-ups*.)

---

## Adding a sixth tab, and a seventh, breaks tests that count them

Two UI suites assert the **learner** nav tab count and three assert the **admin** tab count.
Every one of them is a literal, and every one had to move:

| Suite | Assertion | Was | Now |
|---|---|---|---|
| `ui-feedback.js` | learner `.bottom-nav .nav-btn` count | 5 | 6 |
| `ui-feedback.js` | admin `.admin-tab` count | 6 | 7 |
| `ui-people.js` | admin `.admin-tab` count **and the tab order string** | 6 | 7 |
| `ui-reports.js` | admin `.admin-tab` count | 6 | 7 |

`ui-people.js` also compares the tab **order** as a joined string, so the new tab has to be
named there too (`…,feedback,posts`). `tools/nav-shot.js` — a diagnostic screenshot script
rather than a regression suite — carries the same count and would have reported a false
problem; it was updated for the same reason.

Neither nav can be widened on a phone: the learner bar is six tabs in a 390px bar (~65px
each) and the admin row is seven. The learner labels are held to one line by
`white-space: nowrap` on the caption, and `ui-feedback.js` asserts the *geometry* (no label
wraps or overflows) rather than the presence of the strings — a wrapped label is unreadable
while every translation is present and correct. The admin row wraps (`flex-wrap: wrap`), so
a seventh tab moves to a second line instead of spilling off screen, which is what the
spill checks in `ui-people.js` and `ui-reports.js` measure at 320/360/390px.

---

## A stale literal, caught for the third time

`tools/indonesian-test.js` and `tools/mandarin-sample-test.js` each compared the four
language trees in the sitemap by counting English URLs with a **hand-written list of route
families** — `/(learn|words|level|guide|privacy)/`. Adding `/discover` made English count
fewer pages than the three prefixed trees, and the failure reads as *"all four trees are the
same size → en=208 fil=214"*, i.e. it looks like a broken English tree rather than a stale
test.

This is the third time the same literal has gone stale (`/id`, then `/privacy`, now
`/discover`), so both suites now read `ROUTE_FAMILIES` **out of `seo.js`'s source text**
instead of writing it down. They read the file rather than `require` it because requiring
`seo.js` opens the real database, which a test has no business doing. `seo.js` exports the
constant as the single source of truth.

The lesson recorded in the project notes applies exactly here: **when a suite is green and
the outside world disagrees, the suite is a suspect.** Here the suite was red and the cause
was still the suite.

---

## What needs review

**1. The culture articles need a native check.** The five seeded culture posts are
machine-drafted English prose about Hong Kong household custom. This is the same rule the
38 expanded words followed, and it matters more here than anywhere: **a wrong etiquette
claim causes the exact awkwardness it was meant to prevent**, and the helper has no way to
know the app was wrong. They are written conservatively — every one says households differ
and to ask the family — but they still need a native Cantonese speaker, and ideally someone
who has worked in a Hong Kong household, to read them.

The five, by slug:

| Slug | Subject |
|---|---|
| `m-goi-and-do-ze-not-the-same` | 唔該 vs 多謝 |
| `the-altar-is-not-clutter` | 神枱 — do not move or tidy it |
| `have-you-eaten-is-a-greeting` | 食咗飯未 as a greeting |
| `lunar-new-year-at-home` | what changes at home; the no-sweeping rule |
| `mid-autumn-mooncakes` | mooncakes and the tin |

**2. The Filipino and Indonesian (and Chinese-body) translations are deliberately blank.**
English is complete; Simplified Chinese carries the title and summary; `fil`, `id` and the
Chinese body fall back to English. That is the same order used for the 38 words — **approve
the English first, then translate** — and translating four versions of a text nobody has
approved yet is wasted work.

Note the `zh` column is **Simplified**. The Cantonese terms inside the English (唔該, 食咗飯未)
stay in Traditional characters, because that is the Cantonese convention the vocabulary
library already uses. A Traditional gloss in a `_zh` field would be a bug.

---

## Open follow-ups

- **A reliable schedule.** The in-process timer does not fire on a sleeping instance. A
  Render Cron Job calling `POST /api/admin/posts/import` (with operator credentials) is the
  dependable version, and is a config change rather than a code one.
- **A translation provider**, if a Chinese-only source is ever wanted.
- **Images.** Posts are emoji only, matching the rest of the app. Real photography would
  help a news feed, and would be the first image upload in a codebase that deliberately has
  none — a separate decision.
- **The news channel is only as good as its sources.** Two public feeds is a start; more
  public bodies (Legislative Council, departments, the Hospital Authority) publish RSS and
  could be added by extending `SOURCES` in `news.js`.
