# SEO / Indexing Setup — mixmash.games

The site's technical SEO is complete: `robots.txt` allows all crawlers, `sitemap.xml`
is valid, and every route ships unique `<title>`/`description`/canonical/OpenGraph tags.
The **only** reason `mixmash.games` isn't in Google/Bing yet is that the domain has never
been submitted and has no inbound links, so crawlers have no path to discover it.

This is the one-time submission runbook to fix that.

## 1. Google Search Console (~5 min)

1. Go to https://search.google.com/search-console → **Add property** → **URL prefix** →
   `https://mixmash.games/`.
2. Choose the **HTML tag** verification method. Copy the token out of the tag it shows you
   (the `content="..."` value).
3. In [index.html](index.html), find the commented verification block under the canonical
   link, paste the token into `google-site-verification`, and **uncomment that line**.
4. Commit + push to `gh-pages`, wait for the deploy, then click **Verify** in the console.
5. Once verified: **Sitemaps** → submit `sitemap.xml`. Then **URL Inspection** →
   enter `https://mixmash.games/` → **Request Indexing** (repeat for `/play/` and `/mars/`).

## 2. Bing Webmaster Tools (~3 min)

1. Go to https://www.bing.com/webmasters → **Add site** → `https://mixmash.games/`.
   (You can also just **Import from Google Search Console** to skip re-verification.)
2. If verifying manually: copy the `msvalidate.01` token, paste it into the commented
   `msvalidate.01` tag in [index.html](index.html), uncomment, push.
3. Submit `sitemap.xml` under **Sitemaps**.

## 3. Seed discovery (backlinks)

Even after submission, a zero-backlink domain ranks slowly. Add at least one public link:

- Link `mixmash.games` from the portfolio site (`davehomeassist.github.io`) and the
  DB | Projects Notion registry row.
- Optionally submit the flagship game to browser-game directories (itch.io page, etc.).

## Canonical map (keep sitemap + canonicals in sync)

| URL | Indexable | Canonical target |
|---|---|---|
| `/` | yes | `/` (studio hub) |
| `/play/` | yes | `/play/` (MIXMASH game) |
| `/home.html` | no — canonicalized | `/play/` (marketing landing; consolidates to the game) |
| `/mars/` | yes | `/mars/` (trailing slash — matches served path) |
| `/garden/` | yes | `/garden/` |
| `/empires/` | yes | `/empires/` |

`home.html` is intentionally **not** in `sitemap.xml` because it canonicalizes to `/play/`.
