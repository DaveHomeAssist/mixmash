<!-- Ported verbatim from marsscape@ab073bc docs/ART_DIRECTION.md.
     The gameplay port tracked features, not documents, so this was left behind in a
     repository that now only serves a relocation notice. It is preserved here as the
     record of the intended look.

     IMPORTANT: the asset manifest below (node 24x24, building 48x32, flat facings) was
     written for the old flat DOM renderer. The engine now draws a 2:1 isometric canvas
     board, so those sizes and facings are superseded. Treat this document as the style
     reference and ART_ROADMAP.md as the spec and running order. -->

# MarsScape Art Direction — Workstream A

*Target: the concept-art look — painted Mars vistas, chunky pixel-art actors and items, stone-and-brass UI chrome, RS-style information density. This doc is the asset manifest and the production pipeline.*

## 1. The look, in five rules

1. **Painted world, pixel actors.** Backdrops are painterly (AI-generated, per region); everything interactive — astronaut, nodes, buildings, items — is crisp pixel art that pops against the paint.
2. **The mockup palette:** rust oranges (`#b0603a` family, already our CSS vars), deep leather browns for UI panels, parchment text (`#f2ede6`), steel greys for machines, and **cyan-blue crystal** (`#4db8d4`/`#9fe0f0`) as the accent that makes ore glitter. Reuse the existing CSS custom properties — the game's palette was already right.
3. **Chunky and readable.** Item icons read at 24px. Sprites use bold outlines (`#2a2118`, not pure black) and 2–3 shades per material. No dithering at small sizes.
4. **UI chrome is architecture.** Panels get 9-slice stone/metal frames with riveted corners; meters become orbs (HP-red, O2-cyan, power-amber, credits-gold); tabs get carved icon buttons.
5. **Emoji is the permanent fallback.** Pixel mode is a renderer toggle. Game logic never knows which mode is on; any missing sprite falls back to the emoji. Nothing ever breaks for want of art.

## 2. Pipeline (proven on Garden OS story mode)

1. **Generate sheets** — AI image generation, one themed sheet per batch (e.g. "16×16 pixel art item icons, Mars mining game, rust/steel/cyan palette, dark outline, transparent background, 8×8 grid"). Consistency trick: include the palette hexes and 2–3 already-final sprites in the prompt as style anchors.
2. **Slice** — `slice-sprites.py` pattern from the Garden OS pipeline: cut the grid, name by manifest order, emit PNGs.
3. **Manifest** — `src/sprites.js` maps `id → asset`. During bootstrap (stage A1) assets are hand-authored pixel maps rendered to SVG at runtime (zero image files, tiny, crisp). As AI sheets land (A2+), ids switch to PNG data URIs or sheet coordinates — the registry API doesn't change.
4. **Budgets** — single-file build stays ≤1.5MB. If A4 backdrops push past that, the site deploy switches to the multi-asset build (`vite build` without singlefile) and the one-file build keeps runtime-SVG sprites only.

## 3. Asset manifest

### Stage A1 — vertical slice (hand-authored pixel maps, in-engine now)
| id | Size | Notes |
|---|---|---|
| `astro` | 12×14 | White suit, cyan visor, rust accents; idle pose |
| `iron_ore` | 12×10 | Grey-brown chunk, blue crystal glints (per mockup) |
| `copper_ore` | 12×10 | Orange-brown chunk |
| `ice` | 12×12 | Cyan crystal cluster |
| `iron_bar` | 12×8 | Steel ingot |
| `frame` | 12×12 | Riveted structural square |

**A2 loader shipped (v0.4.0):** `registerSheet(url, cols, rows, cw, ch, ids)` in `sprites.js` maps a PNG sheet's grid cells to ids; `spriteHTML` renders a background-cropped `<span>` from a registered sheet, else falls back to the hand-authored pixel map, else emoji — one API, three tiers. Hand-authored coverage now spans 13 sprites (astro + iron/copper/titanium ore, iron/copper/titanium bar, ice, part, water, food, frame, fuel). Remaining A2 work is **generating the AI sheets** and calling `registerSheet` on them (no code changes to call sites).

### Stage A2 — full coverage (AI sheets)
- **Items (11 + Phase 1 additions ≈ 40):** every `ITEMS` entry at 16×16.
- **Nodes (5 kinds + rich variants):** 24×24 — iron/copper/titanium veins, ice deposit, expedition beacon.
- **Buildings (7 + outposts):** 48×32 sprites replacing the BSVG silhouettes; ghost (planned) variants = desaturated + dashed frame, generated in CSS.
- **Astronaut animation:** idle (2f), walk (4f), mine (4f), and a mining-laser variant for late picks.
- **Drones, puffs, storm particles:** 16×16, 2–4 frames each.

### Stage A3 — UI chrome
- 9-slice panel frame (stone + brass corners), 48×48 source.
- Orbs: 28×28 — health (P3), O2, power, credits (P4) with fill masks.
- Tab icons: 20×20 × 8 (skills, pack, colony, forge, log, map, combat, settings).
- Pixel display font (self-hosted woff2; body text stays DM Sans for readability).

### Stage A4 — the scene
- One painted backdrop per region (6), ~1536×640, plus 2 parallax ridge layers each.
- Day/dusk tint layers; storm wash stays procedural CSS.

## 4. Engine seam (what A1 builds)

- `src/sprites.js`: `SPRITES` registry, `hasSprite(id)`, `spriteHTML(id, px)` — returns crisp-edge SVG from pixel maps today, `<img>` from PNGs tomorrow. Same call sites either way.
- Pixel mode is a persisted UI preference (its own localStorage key — **not** in the save schema, no migration needed), toggled from the footer, applied by the renderer at: player suit, node discs, inventory slots.
- Rollout: A1 ships toggle-off by default. A2 flips the default once coverage is total.
