# Revenue setup — mixmash.games

All revenue hooks ship **off**. Nothing below loads, renders or reserves space until Dave supplies
the value. Each switch lives in [`src/hub/monetization.mjs`](../src/hub/monetization.mjs); after
editing it run `npm run hub:build`, then `npm test` and `npm run smoke:landing`, and commit the
regenerated `index.html`.

| Switch | Value Dave supplies | What turning it on does |
|---|---|---|
| `supportUrl` | An existing https page he owns: Ko-fi, Patreon, Buy Me a Coffee, or an itch.io creator/game page | Adds a "Keep the games free" block with a **Support MixMash** button to the Studio view and a footer link. No script, no tracking. |
| `adsensePublisherId` + `adsenseSlotId` | AdSense publisher ID (`ca-pub-` + 16 digits) and one display ad unit ID, from an approved AdSense account | Loads the AdSense script on the homepage only and shows one labelled ad unit in the Studio view, in a container that reserves 274px so nothing shifts. Never inside a game or the game grid. |
| `ads.txt` (root file) | Same publisher ID | Required by AdSense once ads are on: `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`. Do not create it before a real ID exists. |

## Not built yet (needs a choice first)

- **Analytics.** No analytics script is on the site. A cookieless option (Plausible, GoatCounter or
  Cloudflare Web Analytics) would measure which game cards convert to plays without a consent banner;
  Google Analytics 4 would also need a consent banner for EU visitors. Needs Dave's pick and account.
- **Ads with EU/UK traffic.** AdSense requires a certified consent management platform for EEA/UK
  visitors; Google's own CMP is configured inside AdSense.

## Already live (no account needed)

- Per-page titles, descriptions, canonicals, Open Graph/Twitter cards with a 1200×630 gameplay card
  per game (`assets/og/`), JSON-LD, `sitemap.xml` and `robots.txt`. See [SEO_SETUP.md](../SEO_SETUP.md).
- **Share** buttons on the Studio view and every game's detail view: native share sheet where
  available, otherwise copy-link.
