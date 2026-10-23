# CantoBuddy — SEO Audit & Fix

**Site:** https://cantobuddy.com
**Date:** 5 October 2026
**Scope:** Technical SEO for the learner app (Node/Express on Render, behind Cloudflare).

---

## Verdict

The site had **one indexable page containing about 200 words of marketing copy**, and
**zero of its 64 Cantonese words were reachable by a crawler**. The product's entire
value — the vocabulary — was invisible to search engines.

That is now fixed: **159 indexable pages**, all server-rendered, in two languages.

The remaining problem is no longer technical. It is that 64 words is a thin content
base, and the brand competes with a near-identical name. See *What's still missing*.

---

## How this was tested

Nothing below is inferred from reading code alone. Every claim was verified against
the live site or a local instance:

```bash
curl -sI -L https://cantobuddy.com                     # headers, host variants
curl -s https://cantobuddy.com | grep -c 'nei5 hou2'   # is content in the HTML?
curl -sI https://cantobuddy.com/sitemap.xml            # 404 at the time
node tools/seo-shot.js http://127.0.0.1:4123           # headless DOM + visual check
node tools/security-test.js                            # 31 passed, 0 failed
```

---

## Critical findings

### C1 — No content in the HTML (the fatal one)

```
$ curl -s https://cantobuddy.com | grep -cE 'nei5 hou2|多謝|jyutping'
0
```

The learner app is a single-page app. `public/index.html` ships the header, the hero
headline and three level cards. Every word, every Jyutping reading, every Filipino
translation arrives afterwards from `/api/vocabulary` and is injected by `app.js`.

A crawler that fetches `/` receives a shell. There is nothing to rank.

### C2 — The API holding the content was blocked from crawling

`robots.txt` contained `Disallow: /api/`. Combined with C1, that closed the last door:
the content existed only in a JSON endpoint that crawlers were explicitly told to skip.

### C3 — Every view collapsed to a single URL

`navigate()` swaps views client-side without touching the URL, and `app.js` actively
rewrites back to `/` via `history.replaceState`. Home, Browse, Quiz, Progress and Share
all live at `/`. Categories, levels and individual words had **no URL at all** — so even
if the content had been rendered, there was no page to rank.

### C4 — No canonical tag, and a duplicate host serving the same site

```
$ curl -sI https://cantobuddy.onrender.com
HTTP/1.1 200 OK          ← identical content, no redirect, no canonical
```

`www` correctly 301s to the apex, but the Render origin host answers 200 with a
byte-identical page and no `rel=canonical` anywhere to consolidate the two. Whatever
signal the site earns was being split between two hosts.

### C5 — No sitemap

`/sitemap.xml` returned `Cannot GET /sitemap.xml`. Nothing told a search engine that
any page existed.

### C6 — No structured data

No JSON-LD anywhere. Nothing declared the site as an educational resource, named the
audience (Filipino domestic helpers), or marked up the vocabulary as terms with
pronunciations.

### C7 — No social preview, despite a Share button

The app has a deliberate Share feature in the header. Sharing it produced a bare link:
no `og:title`, `og:description` or `og:image`.

### C8 — Zero brand visibility, against a near-identical competitor

Searching for the brand returns competitors, not CantoBuddy:

| Result | Note |
|---|---|
| **cantoboo.com** | "Learn Hong Kong Cantonese for Beginners" — near-identical name, same niche |
| CantoDuck (App Store) | Cantonese app for families |
| learn-cantonese.com, cantonese.ca | Established general resources |

`CantoBoo` is a genuine brand-confusion risk, not just a ranking one. The `.com` is held
and the name is one character from yours in the same category.

### C9 — Process risk: the live site runs uncommitted code

`git status` on branch `phase-1-2` shows 16 modified files and no commit since
`fa2a7e2`. The deployed site is built from this working tree, so **there is no clean
restore point** for it. Worth resolving before the next deploy.

---

## What was built

A server-rendered SEO layer (`seo.js`) that renders the same SQLite content as plain
crawlable HTML, mounted from `server.js`. The SPA is untouched — `/` still serves
`public/index.html`, and every new page links back into the app.

### Routes

| Route | Pages | What it is |
|---|---|---|
| `/learn` | 1 | Hub: all 11 categories + 3 levels |
| `/learn/:category` | 11 | One category, all its words in a table |
| `/words/:word` | 64 | One word: characters, Jyutping, meaning, related words |
| `/level/:n` | 3 | One level, all its words |
| `/fil/...` | 79 | Filipino mirror of all of the above |
| `/sitemap.xml` | — | 159 URLs, generated from live data |
| `/robots.txt` | — | Now generated from code, declares the sitemap |

**Total: 159 indexable URLs** (up from 1), each with a unique title, meta description,
canonical, Open Graph and Twitter tags, breadcrumbs and JSON-LD.

### Also fixed

- **Canonical on `/`** pointing at `https://cantobuddy.com/` — resolves C4.
- **OG/Twitter tags on `/`** — the Share button now produces a real preview card.
- **JSON-LD on `/`**: `EducationalOrganization` + `WebApplication`, declaring the
  audience and that it is free.
- **`hreflang`** linking every English page to its Filipino counterpart and back.
- **Crawlable footer** on the SPA with real `<a href>` links into the content layer —
  the SPA's own navigation is JS-only, so this is the only path a crawler has from `/`.
- **`public/robots.txt` deleted**; `robots.txt` is now generated by `seo.js` so it can
  never drift from the routes that actually exist.
- **Unknown slugs return a real 404**, not a soft 200 — otherwise Google would index
  unlimited junk URLs.

### Structured data emitted

`EducationalOrganization`, `WebApplication`, `CollectionPage`, `LearningResource`,
`DefinedTerm`, `BreadcrumbList`.

---

## Verification

Local instance, 64 words / 11 categories:

```
/                              200     /fil                           301 → /fil/learn
/learn                         200     /fil/learn                     200
/learn/greetings               200     /fil/learn/greetings           200
/words/thank-you               200     /fil/words/thank-you           200
/level/1                       200     /fil/level/3                   200
/sitemap.xml                   200     /robots.txt                    200
/learn/does-not-exist          404     /words/nope                    404
```

| Check | Result |
|---|---|
| Cantonese + Jyutping present in raw HTML | ✅ (was 0) |
| Unique `<title>` per page | ✅ |
| Exactly one `<h1>` per page | ✅ (caught and fixed a missing `h1` on word pages) |
| JSON-LD parses on every route | ✅ 7/7 routes |
| Sitemap well-formed, no duplicates | ✅ 159 URLs, 477 `xhtml:link` |
| `hreflang` reciprocal | ✅ |
| `/api/`, `/admin*` still blocked | ✅ `X-Robots-Tag: noindex, nofollow` intact |
| SPA at `/` unbroken | ✅ visual + DOM check |
| Existing test suite | ✅ 31 passed, 0 failed |

Screenshots in `ui-preview/seo-*.png`.

---

## What's still missing

Ranked by impact.

### 1. Deploy it, then submit to Google Search Console — do this first

Nothing above helps until it is live and submitted. The old `robots.txt` also told
Google to skip `/api/`; make sure the new one is being served before requesting a
re-crawl.

### 2. Content depth is now the binding constraint

159 pages is a real structure, but it is built from **64 words**. Word pages like
`/words/thank-you` will not outrank established resources on their own.

The honest lever here is more content, not more markup. The niche is genuinely
underserved and specific — *"how do you say X in Cantonese"* for household and elder-care
situations, phrased for a Filipino helper. Situational phrase pages ("asking your
employer for a day off", "what to say when the baby is crying") would target queries
that no general Cantonese resource covers, and the audience is already defined.

### 3. Decide whether the employer portal should be indexable

`/portal` is currently `noindex, nofollow`, and it is linked publicly from the header.
If employer-side queries ("hire a helper who speaks Cantonese", "Cantonese for
employers in Hong Kong") are worth targeting, that page should be rewritten as a real
landing page and made indexable. If it stays a private tool, leave it — but the current
state (publicly linked, deliberately unindexable) is worth a conscious decision.

### 4. Off-page: own the brand

Technical fixes will not resolve the `CantoBoo` collision. What helps: a consistent
brand string everywhere, an app-store listing, and profiles on the platforms this
audience actually uses. Note that brand searches currently return a competitor, so
brand-name queries are being lost regardless of technical health.

### 5. Close the restore-point gap (C9)

Commit the working tree before deploying. See the `establish-production-restore-point`
approach.

---

## Files changed

| File | Change |
|---|---|
| `seo.js` | **New.** Server-rendered content pages, sitemap, robots, JSON-LD. |
| `server.js` | Mounts the SEO layer; requires `seo.js`. |
| `public/index.html` | Canonical, OG/Twitter, JSON-LD, crawlable footer. |
| `public/styles.css` | Footer styles (existing design tokens). |
| `public/i18n.js` | `footer.*` keys for both languages. |
| `public/robots.txt` | **Deleted** — now generated by `seo.js`. |
| `tools/seo-shot.js` | **New.** Headless visual + DOM verification of the SEO pages. |
| `ui-preview/seo-*.png` | Verification screenshots. |

### Deploy checklist

```bash
git add -A && git commit -m "SEO: server-rendered content pages, sitemap, canonical, structured data"
npm run deploy
curl -s https://cantobuddy.com/sitemap.xml | head        # expect XML, not a 404
curl -s https://cantobuddy.com/robots.txt                # expect the Sitemap line
curl -s https://cantobuddy.com/words/thank-you | grep 多謝   # expect a match
```

Then submit `https://cantobuddy.com/sitemap.xml` in Google Search Console.
