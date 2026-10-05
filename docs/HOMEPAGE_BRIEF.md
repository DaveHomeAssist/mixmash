# Homepage: playable festival poster

Approved October 5, 2026 by Dave. Planning owner: [Sprint Boards](SPRINT_BOARDS.md).

## Accepted decisions

- HOME-01 A: playable festival poster, light default and dark alternative.
- HOME-02 A: list Front of House as Early playable. Dave signed off the first playable for homepage promotion. Keep its noindex and sitemap exclusion.
- HOME-03 A: Pick for me suggests a playable title without launching it. Cut first if scope slips.
- Deliver directly to gh-pages after local checks and required CI; no pull request.
- Title: `MixMash Studio | Free Browser Games`.
- Catalog note: `Every game here is playable now. Each card shows how far along it is.`
- No em dashes in updated public copy.

## Problem, outcome and flow

The five-card page buries most games and omits the now-approved Front of House. Replace blanket save/control promises with game-specific evidence. Open Games, choose one of six tickets, launch directly or inspect details. All six titles and Play links fit at 1440×900 and 375×812. Short screens paginate; ultrawide uses a useful game preview. Games/Studio navigation moves to a bottom rail on phones. Details, browser history and focus return are preserved.

## Scope and order

Catalog manifest and copy first; layout and refreshed real gameplay artwork second; cache/navigation/metadata integration third; validation and direct publication fourth. Static HTML is generated from one catalog; links survive unavailable JavaScript. Light is the fresh default; explicit theme choice persists. Pick for me does not launch or play sound. No new runtime dependency.

## Data and exclusions

Only namespaced homepage preferences are added. Preserve game routes, save keys and API contracts. Record controls/players/saving evidence in [HOMEPAGE_EVIDENCE.md](HOMEPAGE_EVIDENCE.md). No game mechanics/camera changes, save migration, backend/hosting migration, PlayCards port, ROM distribution, analytics, account system or FOH search promotion.

## Acceptance

Six accurate native launch links. No document overflow at 320×256, 375×812, 844×390, 1440×900 and 3840×1080; explicit pagination on short screens. Keyboard focus, semantic navigation, Back/Forward, 200% zoom, both themes, reduced motion and readable contrast. Working access with scripts/storage unavailable. No game engine/WASM on homepage; initial transfer <=500 KB and previews <160 KB each. Actual pointer/keyboard launch past MIXMASH audio prompt and into gameplay; all other routes reach active play. Cache upgrades and hub use preserve game saves. Pass catalog, landing and required CI, then verify direct gh-pages delivery, Pages and live behavior. Physical-device/controller acceptance remains separate.

## Risks and recovery

Re-fetch concurrent game changes before publication. Record unrelated CI failures without weakening checks. A scoped hub revert restores the old page without touching player saves. Refresh the existing planning/board projection with actual delivery evidence.
