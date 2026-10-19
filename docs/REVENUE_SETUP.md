# Revenue setup — mixmash.games

All revenue hooks ship **off**. Nothing below loads, renders or reserves space until Dave supplies
the value. Each switch lives in [`src/hub/monetization.mjs`](../src/hub/monetization.mjs); after
editing it run `npm run hub:build`, then `npm test` and `npm run smoke:landing`, and commit the
regenerated `index.html`.

## Dave's decisions (Oct 19, 2026)

- **Support: Ko-fi now**, itch.io creator page later as a second channel.
- **Analytics: Cloudflare Web Analytics** (free, cookieless, no consent banner).
- **Ads: only after there is traffic data.** AdSense stays off and there is no `ads.txt`.
- Switch MIXMASH to fictional DJ/festival names before submitting to game portals (separate task).

| Switch | Value Dave supplies | What turning it on does |
|---|---|---|
| `supportUrl` | His Ko-fi page, exactly `https://ko-fi.com/<name>` (letters, digits, underscores; no `?` or `#`). Later: an itch.io page (`https://<name>.itch.io/`). | Adds a "Keep the games free" block with a **Support MixMash on Ko-fi** button to the Studio view and a footer link. Plain link, opens Ko-fi in a new tab. No script, no tracking. A malformed Ko-fi URL renders nothing. |
| `cloudflareAnalyticsToken` | The 32-character hex site token from Cloudflare Web Analytics | Puts the official beacon (`static.cloudflareinsights.com/beacon.min.js`) on the homepage and on every game wrapper page (`/play/`, `/mars/`, `/pitch/`, `/garden/`, `/front-of-house/`) via the shared `/assets/analytics.js`. Adds the two Cloudflare origins to the CSP on `/mars/` and `/front-of-house/` only while on. Not on EMPIRES. Cookieless, no banner. |
| `adsensePublisherId` + `adsenseSlotId` | **Leave empty for now.** AdSense publisher ID (`ca-pub-` + 16 digits) and one display ad unit ID | Loads the AdSense script on the homepage only and shows one labelled ad unit in the Studio view, in a container that reserves 274px so nothing shifts. Never inside a game or the game grid. |
| `ads.txt` (root file) | Same publisher ID, later | Required by AdSense once ads are on: `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`. Do not create it before a real ID exists. |

While a value is empty nothing renders, and no third-party request is made. `/assets/analytics.js`
is then a comment-only file. The service worker never touches third-party requests, so it does not
cache or block the beacon.

## Turn on Ko-fi

1. **Dave:** go to <https://ko-fi.com>, click **Start a page** (or sign in), and pick a page name;
   that becomes `https://ko-fi.com/<name>`. Under **Settings → Payments**, connect Stripe or PayPal
   so tips can be received. Set a display name and a short "about" (free browser games by MixMash
   Studio). Send the page URL to the MixMash bot.
2. **Bot:** in `src/hub/monetization.mjs` set `supportUrl: 'https://ko-fi.com/<name>'`, run
   `npm run hub:build`, then `npm test` and `npm run smoke:landing`, and commit `index.html` with the
   config change. Verify the Studio view and footer on mixmash.games show **Support MixMash on Ko-fi**.

## Turn on Cloudflare Web Analytics

mixmash.games is served by GitHub Pages, so use the JS-snippet setup (no DNS or proxy change needed).

1. **Dave:** sign in or sign up (free) at <https://dash.cloudflare.com>. Open **Analytics & Logs →
   Web Analytics → Add a site**, enter `mixmash.games` as the hostname, and choose **Manual setup /
   JS snippet** (not "Enable with Cloudflare", which needs the domain proxied through Cloudflare).
   Cloudflare shows a snippet containing `data-cf-beacon='{"token": "…"}'`. Send the token value
   (32 hex characters) to the MixMash bot. It is a public site identifier, not a secret.
2. **Bot:** set `cloudflareAnalyticsToken: '<token>'`, run `npm run hub:build`, then `npm test`
   and `npm run smoke:landing`. Commit `index.html`, `assets/analytics.js`, `mars/index.html` and
   `front-of-house/index.html` (CSP lines only) with the config change.
3. **Check:** load mixmash.games and one game page; within a few minutes visits appear under Web
   Analytics in the Cloudflare dashboard.

## Later

- **itch.io**: when the creator page exists, either swap `supportUrl` to it or add a second link (not built yet).
- **Ads**: revisit once Cloudflare shows real traffic. AdSense requires a certified consent
  management platform for EEA/UK visitors; Google's own CMP is configured inside AdSense.

## Already live (no account needed)

- Per-page titles, descriptions, canonicals, Open Graph/Twitter cards with a 1200×630 gameplay card
  per game (`assets/og/`), JSON-LD, `sitemap.xml` and `robots.txt`. See [SEO_SETUP.md](../SEO_SETUP.md).
- **Share** buttons on the Studio view and every game's detail view: native share sheet where
  available, otherwise copy-link.
