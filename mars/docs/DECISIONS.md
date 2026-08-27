# MarsScape Decision Log

This file is the repository record for MarsScape product and production decisions that affect more than one implementation surface. Renderer measurements remain code-owned by `mars/render-contract.mjs`.

## DEC-79: Gate production art through a renderer-native golden slice

- Date: 2026-08-27
- Status: Accepted
- Owners: Dave Robertson / MarsScape
- Applies to: art direction, commissioned assets, sprite loading, validation, gameplay rendering, and promotional production order

### Context

The current MarsScape board is a 2:1 dimetric canvas renderer. Earlier art planning targeted a flat DOM renderer and left the final visual endpoint open. Canonical `gh-pages` has since shipped a render contract, 33 runtime pixel maps, a cached `ImageBitmap` draw seam, a Pixel Art toggle, and procedural fallback. PR #8 contains useful pre-pipeline rationale but conflicts with this newer state.

Bulk commissioning before the class canvases, anchors, footprints, state system, failure behavior, and in-renderer approval loop are locked would make a full batch vulnerable to projection and integration rework.

### Decision

1. Use full isometric pixel art for interactive board entities.
2. Keep elevated procedural rendering as the missing-asset and Pixel Art off fallback.
3. Keep painterly art beyond the board as horizon, sky, and distant ridges.
4. Derive export sizes, ground anchors, footprint origins, zoom, palette, lighting, state, and animation rules from render contract v2.
5. Require an automated validation report, footprint contact sheet, and visual-regression screenshots for commissioned exports.
6. Run one paid artist test before bulk production.
7. Approve the paid test and complete golden scene only inside MarsScape at 1.0 gameplay zoom.
8. Block production scaling until that approval is recorded.

### Required paid test

- Base-soil terrain tile.
- Habitat active and damaged variants.
- Astronaut functional animation.
- Blue crystal node.
- Renderer-ready PNG exports.
- Layered editable source files.

### Failure contract

| Failure | Required renderer or pipeline response |
| --- | --- |
| Missing sprite | Warn once and retain procedural or emoji fallback. |
| Invalid dimensions | Fail validation with actual and expected dimensions. |
| Invalid anchor | Flag footprint mismatch and block approval. |
| Broken animation | Load frame `01` statically and report the broken clip. |
| Slow decode | Warn and preserve the cached `ImageBitmap` path. |
| Missing editable source | Block final asset approval. |

### Consequences

- Existing runtime maps remain valid fallback/reference art but are not automatically final production anchors.
- Canonical asset states are blueprint, construction, active, disabled, and damaged.
- The artist contract and golden-slice manifest are versioned with the renderer.
- PR #8 is closed as superseded after its useful rationale is preserved in canonical docs.
- Production order is terrain/transitions, core buildings, resources/extraction, units/vehicles, construction/damage, props/decoration, advanced animation, then promotional paintings.

### Evidence and links

- `mars/render-contract.mjs`
- `mars/sprite-canvas.mjs`
- `mars/docs/ART_DIRECTION.md`
- `mars/docs/ART_ROADMAP.md`
- `mars/docs/ART_AUDIT.md`
- `mars/art/golden-slice.json`
- Historical review: `https://github.com/DaveHomeAssist/mixmash/pull/8`
