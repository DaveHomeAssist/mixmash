# Lot sample candidate

Revision `lot-sample-2`, 2026-10-04. The [generated manifest](../lot-assets.json) records nine source-owned samples, authoring provenance, measured visual bounds, logical footprints, opaque pick surfaces and SHA-256 content/source digests. This candidate advances the [realistic sample specification](ART_DIRECTION.md#realistic-lot-sample-specification); it is not final visual or physical acceptance.

## One consistent authoring reference

The existing two-metres-per-tile source comment is now an explicit **provisional authoring convention**, not a field measurement or a change to game rules. The logical grid, saved positions, occupied cells and economy remain identical. Models are authored directly from their part dimensions; no third-party model is stretched into a tile.

| Reference | Authored dimension | Meaning |
| --- | --- | --- |
| Guest | 1.8 m standing height | Reference anatomy/proportions; cosmetic representatives only |
| Operator eye | 1.66 m | FOH eye above ground; Stage eye adds deck height |
| Stage deck | 1.1 m high | Existing 6 × 3-cell platform; supported deck, skirt, joints, stairs and back rail |
| Bar counter | 1.1 m high | Existing 2 × 1-cell service object; framed counter, panels and foot rail |
| Restroom | 2.3 m overall height | Existing 1 × 1-cell object; body, door, handle, ventilation and generic sign |
| PA | Measured in manifest | One logical rental represented by a sub/base and cabinet stack; no added coverage |

FOH and Stage use explicit eye and target positions derived from the current stage footprint and facing, including moved/rotated stages. Leaving those presets restores the bounded orbit model. `authoredEye` diagnostics expose the exact pose. Physical calibration against a real venue and final camera/art review remain pending.

## Scene cues and ownership

The visible perimeter exists only when the authoritative layout includes the fence kit. Entry/exit cells open the perimeter; decorative wire geometry cannot intercept equipment picking. Grid lines and sight overlays remain separate. PA, gate and curfew markers follow the corresponding current objects. Rain is cosmetic and does not trigger an incident or alter attendance.

Guests use reusable instanced body parts with varied clothing/skin/hair palettes. The renderer displays at most 180 representatives and reports the actual represented attendance separately. Geometry occupies unbuilt logical floor cells. Counts come from the scene snapshot, and idle sway never updates simulation. Changing the operating system's reduced-motion preference freezes cosmetic motion immediately while retaining every incident cue. Admission, bar queues, service movement and departures still belong to the later operations model; these standing representatives do not pretend to implement them.

All meshes, procedural grain, materials and simple motion are newly authored project code. The retained Three.js MIT license covers the renderer dependency. There are no archive assets, external textures, branded models, purchased content or commissions. Geometry and textures have explicit ownership and disposal. The manifest is reproducible with `npm run assets:front-of-house`; CI runs `npm run check:front-of-house-assets`.

## Verification and acceptance boundary

Camera/model tests check occupied bounds and stage orientation for all four rotations, reference heights, stage-relative eye positions, arbitrary-yaw ground picks, HUD framing and bounded orbit. The backend browser test adds perimeter presence/openings, incident anchors, representative/attendance separation, constant draw calls across crowd counts, live reduced motion, all eight view/light captures, exact context-restoration pixels and 20 disposal cycles. The actual game test retains gesture, fallback, reload and full-settlement parity coverage.

Visual inspection removed coarse texture aliasing and overly dominant perimeter lines. The sample remains simplified: convincing close-up faces/hair, richer materials, walking/queue poses, atmosphere and the complete realistic style review still need work. Statistical performance acceptance, physical devices and human visual/camera acceptance have not been established by these tests. Keep the classic view as the default until the full renderer gates pass.
