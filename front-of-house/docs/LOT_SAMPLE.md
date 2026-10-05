# Lot sample candidate

Revision `lot-sample-14`, 2026-10-05. The [generated manifest](../lot-assets.json) records eleven base samples, three Festival props and three room assemblies, authoring provenance, measured visual bounds, logical footprints, opaque pick surfaces and SHA-256 content/source digests. This candidate advances the [realistic sample specification](ART_DIRECTION.md#realistic-lot-sample-specification); it is not final visual or physical acceptance.

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

Guests use reusable instanced body parts with varied clothing/skin/hair palettes. The renderer displays at most 180 representatives and reports the actual represented attendance separately. Geometry occupies unbuilt logical floor cells. Counts come from the scene snapshot, and idle sway never updates simulation. Changing the operating system's reduced-motion preference freezes cosmetic motion immediately while retaining every incident cue. The deployed aggregate operations model supplies admission, service routes, queues and departures. Moving actors use opposing hip/shoulder poses; queued actors retain planted feet. These visual poses do not advance service or simulate individuals.

All meshes, procedural face/hair/fabric maps, grain, materials and cosmetic motion are newly authored project code. The retained Three.js MIT license covers the renderer dependency. There are no archive assets, external textures, branded models, purchased content or commissions. Geometry and textures have explicit ownership and disposal. The manifest is reproducible with `npm run assets:front-of-house`; CI runs `npm run check:front-of-house-assets`.

## Verification and acceptance boundary

Camera/model tests check occupied bounds and stage orientation for all four rotations, reference heights, stage-relative eye positions, arbitrary-yaw ground picks, HUD framing and bounded orbit. The backend browser test adds perimeter presence/openings, incident anchors, representative/attendance separation, constant draw calls across crowd counts, live reduced motion, all eight view/light captures, exact context-restoration pixels and 20 disposal cycles. The actual game test retains gesture, fallback, reload and full-settlement parity coverage.

Close views now include a shaped jaw and nose, forward-facing eye/brow/mouth landmarks, a higher front hairline and source-authored hair/fabric detail. Metals use a smoother surface response than cloth; skin avoids the coarse equipment grain. The guest retains sixteen shared part batches. Four owned mipmapped textures are allocated once per model set. Walking and queue poses shipped in PR119. The figures remain simplified sample candidates; this refinement does not establish photorealism or final realistic-style acceptance. Measured CI regression limits are implemented under CT-DEC-21, with available native-host results documented in PERFORMANCE.md. Supported physical devices, sustained full-HUD targets and human visual/camera acceptance remain separate. Keep the classic view as the default until the full renderer gates pass.


## Model13 anatomy candidate

FOH-V01e refines the shared clothed torso with a waist, chest and sloping shoulder/collar line, rounds the sleeve caps and tapers forearms and trouser legs. The reference height and existing hip/shoulder pivots remain fixed. Sixteen part batches and four owned textures remain; geometry is shared across all representatives. This is a bounded silhouette refinement, not physical calibration or final realistic-art acceptance. Current-source browser, performance, CI and hosted evidence must qualify this revision separately from the retained model12 native report.

Model14 retains the authored anatomy contours and radial detail while indexing the contour rings directly. Model13 failed paired crowd timing; model14 qualification remains pending in PERFORMANCE.md.
