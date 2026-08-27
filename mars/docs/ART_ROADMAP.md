# MarsScape Art Roadmap

DEC-79 resolves the endpoint: full isometric pixel art on the playable board, elevated procedural fallback, and painted art limited to the horizon beyond the board. The old PR #8 endpoint decision is no longer open.

## Current gate status

| Phase | Status | Evidence or blocker |
| --- | --- | --- |
| 0. Render contract | Complete | `render-contract.mjs` v2 and `/mars/art-spec.html`. |
| 1. Canvas sprite pipeline | Complete | 33 runtime maps, cached `ImageBitmap`, Pixel Art toggle, procedural and emoji fallback. |
| 2. Audit and production contract | Complete | `ART_AUDIT.md`, `ART_DIRECTION.md`, and DEC-79. |
| 3. Golden vertical slice specification | Complete | `mars/art/golden-slice.json` and generated contact sheet. |
| 4. Asset validation pipeline | Complete when CI and browser checks pass | Filename, PNG, alpha, anchor, footprint, animation, missing asset, source, contact-sheet, and screenshot tooling. |
| 5. Paid artist test | Blocked on artist deliverables | No paid test package exists in the repository yet. |
| 6. Golden scene approval | Blocked on Phase 5 | Approval must occur inside MarsScape at 1.0 gameplay zoom. |
| 7. Production scale | Not started | Starts only after Phase 6 approval. |

## Golden vertical slice

The machine-readable checklist is `mars/art/golden-slice.json`. It contains exact class canvases, state exports, animation metadata, editable-source expectations, and fallback IDs.

### Required assets

| Category | Assets |
| --- | --- |
| Terrain | Base soil, rocky soil, edge, cliff/slope, disturbed ground |
| Buildings | Habitat, solar array, extractor, storage |
| Units | Astronaut, rover |
| Infrastructure | Pipe, power cable, junction, path light |
| Resources | Blue crystal, common ore |
| Props | Crate, beacon, antenna, debris |
| States | Blueprint, construction, active, disabled, damaged |
| Effects | Dust, selection, power glow, warning, repair |
| Lighting | Dawn, daylight, storm, night |

### Golden scene sequence

1. Land at the outpost in daylight.
2. Survey the site with the astronaut and rover readable against base and rocky soil.
3. Place the solar-array blueprint with footprint and anchor overlays enabled.
4. Show construction, connect the power cable and junction, then enter active state.
5. Activate the extractor on the blue crystal node.
6. Dispatch the rover across the terrain edge and path-light route.
7. Enter the storm lighting profile; disable power and show warning without color-only status.
8. Show damaged solar and extractor states.
9. Repair at sunrise and return both systems to active state with repair and power-glow effects.

## Golden scene acceptance

Every line below requires current evidence at normal gameplay zoom:

- Anchors land on the declared ground contact.
- Footprint overlays match visible occupancy and do not collide with adjacent hit targets.
- Astronaut, rover, buildings, resources, infrastructure, and props remain distinguishable without labels.
- Human, rover, door, building, node, and tile scale relationships match the art bible.
- Northwest light and southeast cast-shadow ownership remain consistent in all four lighting profiles.
- Blueprint, construction, active, disabled, and damaged states remain distinguishable without hue alone.
- Broken animations show frame `01` safely.
- Pixel Art off restores procedural rendering and logs no gameplay error.
- Missing commissioned sprites warn once and retain the procedural or emoji fallback.
- The cached `ImageBitmap` path remains in use, including after a slow decode warning.
- Normal-zoom frame delivery shows no material regression against the recorded procedural baseline.
- Reduced-motion mode uses static frames and keeps selection, warning, and repair state legible.

## Paid artist test

The first paid package is deliberately small:

| Deliverable | Required evidence |
| --- | --- |
| One base-soil terrain tile | Exact 84 x 42 canvas with the 66 x 34 face aligned. |
| Habitat | Active and damaged exports on the 28 x 26 source canvas. |
| Astronaut | Active four-frame 150 ms functional clip on the 12 x 18 source canvas. |
| Blue crystal node | Active export on the 20 x 16 source canvas. |
| Damaged-state variant | Must change silhouette or detail, not only hue or opacity. |
| Short functional animation | Complete metadata and a safe `f01` static fallback. |
| Editable sources | Layered `.aseprite`, `.kra`, or `.psd` files for every paid asset. |
| Renderer-ready exports | All naming, PNG, alpha, dimension, anchor, and footprint checks pass. |

Pass condition: Dave approves every deliverable inside MarsScape at 1.0 gameplay zoom. Contact-sheet approval alone is insufficient.

## Validation commands

```bash
npm run art:validate
npm run art:contact-sheet
npm run art:visual
npm run art:approve
```

`art:validate` allows planned assets to be missing and reports the required fallback. `art:approve` is strict and fails on any missing export, broken clip, or absent editable source.

## Production order after approval

1. Terrain and transitions.
2. Core buildings.
3. Resources and extraction.
4. Units and vehicles.
5. Construction and damage states.
6. Props and decoration.
7. Advanced animation.
8. Promotional paintings.

No bulk asset batch starts before the golden scene is approved. A rejected batch returns to the paid-test scope or contract; it does not create a second style branch.

## PR #8 reconciliation

PR #8 was a useful historical analysis written before the canvas sprite pipeline and board-art overhaul landed. Retained rationale:

- The 42 x 21 axis step is not the 66 x 34 drawn face.
- Flat DOM-era sprite sizes were unsafe for the isometric renderer.
- Full isometric pixel art is the lowest-integration-risk production endpoint.
- Contact-sheet and in-engine review are required for consistency.

Superseded claims:

- The endpoint decision is no longer open; DEC-79 resolves it.
- The canvas sprite seam is no longer missing.
- The runtime registry contains 33 maps, not 13.
- `settlement-atlas.svg` no longer gates boot.
- Existing 24 x 24 node and 48 x 32 building targets are replaced by renderer-derived class canvases.

PR #8 must not be merged over these canonical documents. Close it as superseded after the DEC-79 commit is present on `gh-pages`.
