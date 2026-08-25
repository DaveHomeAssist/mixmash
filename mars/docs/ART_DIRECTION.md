# MarsScape Art Direction

MarsScape uses a painted Mars world with crisp pixel actors, props, items, and interface accents. The renderer contract is code-owned by `mars/render-contract.mjs` and is visible at `/mars/art-spec.html`. If this document and the module differ, the module is authoritative.

## Locked visual rules

1. **Projection:** 2:1 dimetric. Grid steps are 42 px horizontally and 21 px vertically per axis.
2. **Tile geometry:** a logical tile is 84 × 42 px. The shipped terrain face is an inset 66 × 34 px diamond.
3. **Anchors:** props use tile centre. Actors use bottom-centre feet. Multi-tile buildings declare width × depth and anchor to the footprint centre.
4. **Light:** one global northwest key light. Cast shadows fall southeast. Do not mirror highlights per asset.
5. **Readability:** bold `#2a2118` outlines, two or three shades per material, no dithering at item-icon size, transparent background, no baked drop shadow.
6. **Fallback:** pixel sprites are a renderer preference. Missing or disabled art always falls back to the procedural board and emoji item icon; game logic never depends on art coverage.

## Palette lock

| Role | Hex |
|---|---|
| Outline | `#2a2118` |
| Suit / highlight | `#e8e4dc` / `#f7f4ee` |
| Crystal / crystal light | `#4db8d4` / `#9fe0f0` |
| Rust / deep rust | `#b0603a` / `#8f3f22` |
| Steel light / mid / dark | `#c8ccd2` / `#8f96a0` / `#5d646e` |
| Copper / copper light | `#e2894a` / `#f2b285` |
| Regolith / dark regolith | `#96684a` / `#6b4a33` |
| Parchment | `#f2ede6` |

Every generation prompt must repeat these hex values and include two approved anchors from the same material family. Never mix material families on one generation sheet.

## Asset manifest contract

- ID: `sprite:<family>:<id>:<state>:<frame>`
- File: `sprites/<family>/<id>__<state>__f<frame>.png`
- IDs: lowercase `snake_case`
- Frames: two-digit and one-based (`01`, `02`, …)
- Format: transparent PNG, exact pixel dimensions in manifest metadata
- States: `built`, `ghost`, `faulted` for buildings; animation-specific states for actors

Examples:

- `sprite:actor:astronaut:idle:01` → `sprites/actor/astronaut__idle__f01.png`
- `sprite:building:solar_array:faulted:02` → `sprites/building/solar_array__faulted__f02.png`
- `sprite:item:iron_bar:default:01` → `sprites/item/iron_bar__default__f01.png`

## Production sizes

| Family | Source size | Anchor |
|---|---:|---|
| Item icon | 16 × 16 | centre |
| Node | 24 × 24 | tile centre |
| Actor | 24 × 32 per frame | feet |
| 1 × 1 building | 48 × 48 maximum | tile centre |
| 2 × 1 building | 84 × 56 maximum | footprint centre |
| UI tab icon | 20 × 20 | centre |
| Panel 9-slice source | 48 × 48 | n/a |

## Review loop

New work is reviewed on the real board at native and 2× scale next to shipped anchors. A near-match is a rejection, not a new style branch. Accepted anchors are versioned and then referenced by every later prompt in that family.
