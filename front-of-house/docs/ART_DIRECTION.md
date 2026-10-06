# Front of House Art Direction

**Status:** Historical direction accepted from Dave (2026-10-01, drafted with Gemini); retained for the existing renderer. CT-DEC-18 supersedes its future pixel-art production direction with more realistic 3D. Phase 1 is in `board.js`. As of 2026-10-01 the board also draws provisional prop sprites from `sprites/`; those files are a stand-in, not the pixel sheets in section 6. Phases 2 and 3 are not started. The feature order is in [`FUTURE.md`](FUTURE.md).
**Decisions:** [CT-DEC-02](DECISIONS.md#ct-dec-02-engine-and-art) (placeholder tiles drawn in code first; pixel art only after the loop is fun)

> **Before any sprite is commissioned**, write a render contract module (tile size, anchors, footprints, frame counts, timing, palette) and reconcile the open conflicts listed at the end of this document. MarsScape's DEC-79 is the reason: its art was planned against a renderer that had since changed.

## Relationship to the 3D prototype

**Updated 2026-10-04:** Dave accepted D2 B, more realistic 3D, in [CT-DEC-18](DECISIONS.md#ct-dec-18-realistic-3d-art-direction). This supersedes the pixel-sheet direction for the new renderer while preserving the existing game and this specification as historical reference. [CT-DEC-14](DECISIONS.md#ct-dec-14-expansion-sequence) keeps the Lot first; CT-DEC-15 keeps aggregate crowd services and CT-DEC-17 keeps the accepted performance model. Use [FB-01 and FB-02](FEATURE_BRIEFS.md) for a realistic Lot sample and renderer contract before asset expansion. Do not treat technical placeholders or archive screenshots as final art approval. D8 A is settled under [CT-DEC-19](DECISIONS.md#ct-dec-19-delegated-milestone-decisions): inventory provenance now, retain existing art during the prototype, then archive unused art after replacement acceptance. No existing art is deleted by this decision update.

## Realistic Lot sample specification

**Proposed sample under accepted CT-DEC-18, 2026-10-04.** This is a specification for one reviewable Oak St. Lot sample, not commissioned art or a shipped replacement. The [renderer contract](RENDER_CONTRACT.md) owns logical transforms and the [performance procedure](FEATURE_BRIEFS.md#performance-and-delivery-contract) owns measurement. Historical pixel-sheet sections below continue to describe the existing renderer only.

### One bounded sample

Use the production `STARTER_LAYOUT` as the placement reference. Author only the five subjects below; keep remaining boundary/exit/lighting context as clearly labeled technical placeholders. The representative guest is presentation only under CT-DEC-15. Do not import the prototype's vendor, queue, sanitation or economic constants. No logos, branded equipment or photographic textures without verified rights.

| Subject | Logical anchor and scale checks | Realistic material/detail target |
| --- | --- | --- |
| Stage | `(9,0)`, rot 0, 6 × 3 cells; test all four facings and front edge. Compare deck, rail/steps and guest proportions; record physical dimensions as provisional until calibrated | Supported deck with believable thickness, joints, black skirt and restrained wear; recognizable structure and safe-looking access silhouette. No implied structural certification |
| PA | `pa-m` at `(8,0)`, 1 × 1 cell, adjacent to stage; one engine rental remains one pickable object even if composed of multiple meshes | Coherent cabinet proportions, grille, rigging/support and connectors visible at close range; dark textured cabinet distinct from glossy hardware. Do not add a second logical PA or coverage bonus |
| Bar | `(1,8)`, 2 × 1 cells; counter height versus guest, service-facing side and unobstructed pick target | Practical counter, body panels, believable roughness and restrained scuffs; readable service silhouette from Wide. No new vendor economy |
| Restroom | Representative unit `(20,12)`, 1 × 1 cell; door/guest clearance, base contact and neighbor overlap tests | Molded plastic, door seam, handle, ventilation and legible generic symbol; appropriate roughness, no glossy toy finish. Additional existing units may instance this sample |
| Guest | One reference figure on a confirmed clear floor cell; center/feet at ground; explicitly record test position and height | Convincing anatomy and proportions, separate clothing/shoes/hair materials, ordinary inclusive presentation. Idle and walk/queue pose review; restrained movement and static reduced-motion pose. No individually saved AI |

Preserve footprint containment and pick geometry even when visual details overhang; record each overhang explicitly. Do not squeeze a reference model to a cell by arbitrary non-uniform scaling. The existing source's 2 m tile comment and archive dimensions need reconciliation, as described in the render contract. No accepted metre conversion or eye height is asserted here. Review stage/PA/guest and bar/restroom/guest side by side with a neutral scale reference and a table of measured dimensions, units, authoring scale, logical footprint and unresolved discrepancies.

### Representative pose candidate, 2026-10-04

Model revision11 added opposing hip/shoulder motion from existing service routes and a planted queue stance. Revision12 adds shared sculpted head/hair geometry and source-authored face/hair/fabric maps, while preserving sixteen guest part batches, palettes and movement rules. Reduced motion is static. Geometry checks preserve the authored joint attachments, ground contact and representative space; actual renderer captures distinguish walking frames and retain identical reduced-motion pixels. The current sample remains a technical candidate: the figures remain simplified candidates; final visual acceptance and physical calibration are separate.

### Review views and lighting

Freeze sample revision, asset digests, camera transforms, exposure/tone mapping, output dimensions, effective pixel ratio and lighting parameters for all eight combinations below. Save lossless captures and a short orbit recording as private review evidence until all redistribution rights are known. Use the actual renderer with HUD/selection context; a beauty render from another tool does not prove in-game quality.

| View | Daylight review | Show-lighting review |
| --- | --- | --- |
| Wide | Fit the entire Lot inside the HUD clear rectangle; check immediate stage/PA/bar/restroom recognition, silhouette separation, asphalt scale and visual hierarchy | Retain guest routes, exits and equipment readability under the show rig; check shadows and beams do not conceal selection/status |
| FOH | Calibrated operator eye position, facing the stage, unobstructed by tent roof; record position and height | PA/stage/performer composition, useful contrast and realistic light falloff; no compulsory camera motion |
| Stage | From the deck toward guests/services; show deck edge and one guest close enough for anatomy/material review | Check skin/clothing response, beam intersections and dark-material separation; no clipped white hotspots hiding detail |
| Plan | True top view, fixed heading; overlay authoritative footprints and stage facing | Confirm lighting changes do not obscure layout, pick targets or footprint boundaries |

Daylight uses a neutral key/sky fill, consistent shadows and exposure; show lighting uses the sample rig with declared colors, intensities and shadow settings. These are review conditions, not real-world photometric predictions. Include a neutral material swatch/contact sheet: asphalt, painted steel, aluminium, fabric, cabinet grille, molded plastic, skin and clothing. Check consistent texel density, roughness, normal direction, shadow acne, transparent sorting, clipping, LOD changes and ground contact at management and close views. Recheck yaw 37°/135°, zoom extremes, both orbit pitch bounds and reduced motion. Keep legible selection/focus/status cues in light and dark UI themes.

### Separate approval records

**Technical placeholder acceptance:** correct occupied cells/facing/picking; save and settlement parity; controls/lifecycle/fallback; reproducible performance evidence. Boxes and simplified figures may pass this gate. They do not pass realistic art acceptance.

**Dave's visual acceptance:** an explicit dated answer tied to the exact sample revision and asset digests, covering all five subjects, all eight view/light combinations, management/close-scale consistency, operator-eye FOH, a short orbit/animation review and reduced motion. Record requested changes and rejected views; silence, archive screenshots, test passes and this specification are not acceptance. Include author/tool/source/license and modification history for every mesh/material/texture/animation, retained license notices and permission for distribution. Unknown rights block that asset's inclusion. No purchases or commissions are authorized by this document.

**Device acceptance:** separately run the declared supported-device matrix and accepted targets after the realistic sample exists. Neither placeholder speed nor the software-rendered preflight diagnostics can approve final-art performance. Current status: the source-owned [lot-sample-15 candidate](LOT_SAMPLE.md) refines the guest anatomy, with bounds/provenance/digests in its manifest. Current-source browser, paired CI and hosted qualification pass through PR122 as recorded in [PERFORMANCE.md](PERFORMANCE.md#final-buffer-reuse-qualification-2026-10-05), separately from frozen model12 native evidence and the retained model13/model14/Intel rejections. It remains simplified at close range. Physical calibration, supported low-power/phone qualification and Dave's visual acceptance remain pending; measured CI regression limits and historical native-host results retain their source attribution; no archive assets are reused.

## 1. Visual pillars

1. **Golden-era tycoon tactility.** In the spirit of RollerCoaster Tycoon 2, SimCity 3000 and Theme Hospital: readable silhouettes and identifiable miniature objects on an isometric grid. Everything on the lot feels physical: road cases with latches, cable ramps with yellow stripes, generators with exhaust vents.
2. **Authentic backstage detail.** Real touring gear: black truss, steel barricades, yellow cable protectors, flight cases with stenciled labels, monitor wedges, ground-stacked line arrays. The board moves from a sunlit lot during load-in to beam work and LED glow during the headline set.
3. **Information at a glance.** Crowd density, sightline blockages, sound coverage and power should read without opening an overlay.

## 2. Palette

The code owns the exact values (`COLORS` and `PROPS` in `board.js`, whose box colours are exported as `LOOK`, and custom properties in `styles.css`). This table records the roles and starting values; if the two disagree, the code wins.

| Role | Starting values |
| --- | --- |
| Backstage industrial (base) | asphalt `#2A2D34`, flight-case laminate `#1C1D21`, aluminium truss `#9CA3AF`, safety yellow `#FACC15` |
| Audience and merch accents | festival teal `#06B6D4`, wristband coral `#F43F5E`, glowstick lime `#84CC16` |
| Stage light (show night) | tungsten warm white `#FEF08A` (3200K), cyan `#00F0FF`, magenta `#FF007F`, UV violet `#8B5CF6` |
| Night overlay | `#0B0F19` at 70 to 80% opacity |
| UI ("production desk") | desk `#0E1117`, sheet `#161A23`, panel `#1E2430`, panel alt `#131720`, borders `#2B3242` and `#475569`, text `#F1F5F9` and `#94A3B8`, accents cyan `#00F0FF`, green `#22C55E`, red `#EF4444`, amber `#F59E0B` |

**Accessibility adjustment:** the source's dim text colour (`#64748B`) fails WCAG AA for small text on the sheet colour, so small labels use `#94A3B8` instead.

## 3. Lighting phases

| Phase | Look |
| --- | --- |
| Book, Build, Promote | Neutral, low-contrast daylight so tiles, boundaries and placement markers are easy to read |
| Show night, Settle | The board darkens under the night overlay. Stage fixtures add light with additive blending (`globalCompositeOperation = 'lighter'`): volumetric cones from the rig and elliptical light pools on the floor. Fewer fixtures without the light tower, which matches the `NO_LIGHTS_MULT` rule. |

**Renderer pipeline** (from the source spec): pre-compute alpha falloff, project floor splats, draw the board geometry, draw the projected light cones, then switch to additive blending. Falloff is Gaussian-like from the lens to the floor. Fixture types: tungsten par (warm, wide, fixed), moving spot (cyan or magenta, narrow, sweeping), LED wash (violet, very wide). Positions use tile units with height in tiles; the source's mix of pixel and world units is not used.

**Reduced motion:** with `prefers-reduced-motion`, beams don't sweep, the crowd doesn't bob and rain is drawn still.

## 4. Assets

### Environment

Cracked asphalt lot tiles with faint painted parking stalls, concrete curbs, a chain-link perimeter with privacy scrim, plywood ground sheets on truck routes, and yellow cable runners from front of house to the stage.

### Staging and production

| Item | Lot tier look | Later tiers |
| --- | --- | --- |
| Stage | Mobile trailer stage, or modular risers on screw jacks with black skirts | Ground-supported box truss grid |
| PA (small) | Tripod point-source tops flanking the deck, subs under the skirt | |
| PA (medium) | Flown four-box line array hangs from stage corner towers, sub array out front | |
| FOH tent | A 10 by 10 ft pop-up with a console silhouette, road cases and an operator facing the stage | Planned with the FOH position (GDD section 6) |

### Crowd

Draw the crowd as a density field, not individual agents (CT-DEC-02):

| Attendance | Look |
| --- | --- |
| Up to 30% | Separate clusters of 2 or 3 people with idle head bobs |
| 30 to 75% | Continuous clusters with raised hands and cups |
| 75 to 100% | A packed sea of silhouettes, phone screens lit, bouncing in time |

### Incident markers

A red exclamation mark over a tripped generator, a broken-wave icon over a failing PA, and a bottleneck icon over a jammed gate.

## 5. Interface: the production desk

- Dark panels with 1px borders. Monospace for money, counts, dB and timecode; a clean sans-serif for everything else.
- **Fonts are not loaded from third parties.** The page's Content Security Policy allows fonts only from the site itself, so the stacks name JetBrains Mono, IBM Plex Mono and Inter first and fall back to the system's monospace and sans-serif. Self-host the fonts later if the fallback isn't good enough.
- A phase stepper across the top: Book › Build › Promote › Show › Settle.
- **The settlement sheet** follows a real day-of-show settlement: a meta strip (headliner, venue, deal, attendance, satisfaction); Section A, gross revenue; Section B, the deal reconciliation (the door split worked out step by step, or the guarantee); Section C, production and site expenses (lettered in reading order since 2026-10-05, so the Revenue tab reads A then B); an outcomes strip (reputation change, artist sentiment, cash after signing); and a rubber stamp, green for a pass ("Show settled") and red for a retry ("Net negative"). Every figure comes from the engine (`settlementFor`), never from the mockup.
- Interaction rules: no inline event handlers (the CSP blocks them); targets at least 44 by 44 px; visible focus; pass and retry stated in words as well as colour.
- **HUD layout** ([HUD.md](HUD.md), CT-DEC-12, accepted 2026-10-01): the board fills the window, and these panels float over it in the lot's empty corners on near-opaque backplates. The rules above stay.

## 6. Sprite sheet specifications (draft)

From Dave's concept sheets (2026-10-01): two sprite-sheet spec images and an "asset sheet" image. The asset sheet settles the projection and sizes; the rest is a draft until the render contract exists.

| Topic | Draft |
| --- | --- |
| Projection | Isometric 2:1 dimetric |
| Floor grid | 64 by 32 px diamonds; 1 tile is 32 px on the scale reference (1 unit = 1 tile) |
| Tile stamps | 32 by 32 px, used for modular crowd clusters |
| Object sprites | 64 by 64 px cells |
| Grid origin | 0,0 at the top left |
| Colour | Indexed palette, 16 colours per sheet, palette shifts for variants; slate-grey production background; all sprites pixel-aligned |
| Scale | 1.0, pixel-perfect; a 1x and a 2x set |
| File naming | `category_objectName_state_direction_frameIndex.png`, for example `obj_paStack_damage_NE_01.png` and `char_player_walk_E_04.png` |
| PA (ground-stacked line array, dual 18" subs) | 64 by 64 px; 3 states: pristine, LED status, blown and smoking; idle and damage in four isometric directions |
| Steel safety barricade | 32 by 32 px modular segment; 3 frames; 2 states |
| FOH sound tent | 10 by 10 ft pop-up marked "FOH" |
| Crew character | A live audio engineer: 8-frame walk loop in 4 isometric directions (south, east, north, west). This is crew, not a player avatar. |
| Crowd clusters | 32 by 32 tile stamps: bouncing, cheering with drinks, and phones lit neon blue, purple or pink |
| Par can flash | Idle (low), single flash, double flash and slow fade sequences, with a palette shift per gel |
| Damage states | Intact, cracked and sparking (shown on a road case) |

### Show-night key art

Dave's key art for a busy lot night sets the target mood for art Phase 3: a box-truss stage roof with a row of moving heads throwing cyan, magenta, amber and violet beams through haze; a packed crowd with phone screens up; a pop-up FOH tent with the engineer and console inside the crowd; a towed generator smoking from a fault; yellow cable protectors snaking from the generator to the stage and FOH; blue portable toilets in a row; steel barricades on the perimeter; dark trees and smoke at the edges. The first playable already matches the overlay, beams, phone screens and blue restrooms in code-drawn form.

### Prop sheet (real-world sizes)

Dave's prop sheet gives real dimensions. Convert at 1 tile = 2 m (`data.mjs`) when an object becomes placeable.

| Prop | States or variants | Size |
| --- | --- | --- |
| Towable diesel generator, 45 kVA | Operational; damaged and sputtering ("Fault") | 96 by 66 in (about 1.2 by 0.9 tiles) |
| Road trunks (amp rack, lighting, mic kit) and flight cases (audio snake, power distro, tools and spare) | Stenciled labels with weights | 20 by 14 by 12 in up to 36 by 18 by 10 in |
| Aluminium box truss | 10 ft and 5 ft sections, 20 in corner cube | 120, 60 and 20 by 20 by 20 in |
| Cardioid sub array | Forward and rear-cancelling, 3 by 18 in | |
| Line array on crank stands | 8-cabinet and 12-cabinet J-curve hangs | |
| 12 in floor monitor wedge | Two angles | 24 by 14 by 12 in |
| 5-channel rubber cable protector | Yellow and black | 39 by 20 by 3 in |
| Portable toilet | Pristine; out of order | |

The sheet and the key art label the generator with a real manufacturer's product name ("Whisper-Watt"). Use a fictional name in game (CT-DEC-03).

## 7. Production roadmap

| Phase | Scope | Method | Status |
| --- | --- | --- | --- |
| 1. First playable | Placeholder isometric blocks drawn in code, a night overlay, additive beams, density-field crowd dots, and the sightline overlay (teal clear, red blocked). Provisional prop sprites draw in front of the boxes when the files load | Canvas 2D, plus eight PNG stand-ins in `sprites/` | Blocks done. Sprites are a stand-in (2026-10-01), not this phase's pixel art |
| 2. Style anchor | Asphalt tiles (3 variations), mobile stage, PA stacks (S and M), barricade, pop-up FOH tent, generator, restroom bank, crowd cluster stamps, the audio engineer | Pixel-art sprite sheets (PNG) to the sizes in section 6 | Not started. Needs the render contract, then it replaces the stand-ins |
| 3. Showtime FX | Moving-head sweeps with alpha falloff, strobes, haze particles | Canvas blend modes and particle pools | Not started |

### Build-screen ideas from the build-phase mockup

The mockup shows a fuller Build screen than the first playable. Adopted now: the **sightline occlusion overlay** (blocked cone tiles in red, with a "View blocked" count). Candidates for later, each needing rules work first:

| Idea | Needs |
| --- | --- |
| Sound pressure map (dB rings from the PA) | A coverage rule beyond R-09's per-person PA coverage |
| FOH mix position tent | The FOH position from GDD section 6 ("later") |
| Cable runs with yellow cable ramps, a visible generator | Power runs as placed objects (terrain and power are "later" in the GDD) |
| Production budget bar, power grid meter, build tool row (select, place, move, remove, rotate) | UI only; the numbers already exist |
| Day, time and weather in the header | A calendar (deferred in the GDD) |
| Load-in gate and "No parking, event tow away" signage | Art only |

## 8. Open conflicts to settle before Phase 2

| Topic | Conflict |
| --- | --- |
| PA frames | 4 frames at 15 FPS in one sheet, 16 frames at 10 FPS in another |
| Walk cycle size | 32 by 64 px in one sheet, 16 by 64 px (5 frames) in another; the asset sheet settles 8 frames and 4 directions but not the cell size |
| Par can flash | 16 by 16 px per fixture at up to 60 FPS in one sheet; 24 by 64 px, 3 frames at 10 FPS in another |
| Garbled labels | Some labels in one sheet are unreadable ("Dims: 19", "Dims: 320", the "Pixel-Edge AA" note) |
| Tier ladder | **Settled (CT-DEC-09):** the career uses the image's four tiers, the Lot (50 to 150), the Club (150 to 600), the Amphitheater (600 to 2,500) and the Festival Grounds (2,500 to 25,000+), under "One venue. Endless nights." They replace the GDD's five. Phase 3 retuned the first playable to the Lot: permitted for 150. |
| Build mockup values | It shows a 72 kW generator and a $75,000 budget. Tier 1 is a 20 kW generator and $3,000 (`data.mjs`), so the mockup is layout direction only. Its title reads "Front of House Tycoon"; the name is Front of House (CT-DEC-06). |
| Settlement mockup numbers | The mockups show figures from a superseded draft (satisfaction 75, bar $1,125, net +$1,191, reputation +14, artist −32) or garbled values. The worked example in `RULES.md` gives 85, $638, +$671, +13 and −12. |
| Real company names | The source compares the sheet to a named ticketing company and the stage to a named manufacturer, and the generator carries a real product name. Those names stay out of the game (CT-DEC-03). |

The concept images (two sprite-sheet specs, the asset sheet, the build-phase mockup, the tier ladder, the show-night key art and the prop sheet) live in Dave's Gemini chat "Front of House Art Direction"; they are not in this repository.

### Festival delay technical prop (2026-10-04)

The delay tower introduced with FOH-V02b10 is independently authored in `board.js` as a thin, four-logical-unit code-drawn enclosure over its1×1 footprint. Palette glyph and geometry use no image or external asset. Source and runtime use are the repository code under the repository's existing terms. It is a provisional technical representation for placement/picking/occlusion and has no physical calibration or final visual acceptance. The unused legacy delay-tower library image remains unused.

### Festival touring reference and technical models (2026-10-04)

The supplied `imagine_images.zip` collection passed CRC/path checks:34 RGB JPEGs, including32 subjects corresponding visually to the prepared sprite library and two title images. Archive SHA-256:`0de7d345add3d1cc7981b2fa6750fc55fed9eb592805398149858313482f3793`. The provided sheet and inspected VIP deck/coach originals inform the new source-authored touring models. Numerical image similarity supports subject correspondence, not exact file identity or the processing history of the existing PNGs. No original JPEGs were imported; existing library files remain retained under D8 A.

The technical deck has a raised modular floor, supports, guardrails and stairs. The bus compound has one representative coach with glazing, wheels, lights and working aisle inside its reserved footprint. Both fit every rotated engine footprint. Materials and geometry are generated in project source, with no external image request. Classic uses explicitly labeled procedural representations; the dimensional view supports the existing full orbit and practical zoom. These are technical candidates, not final human art or physical-scale acceptance.

FOH-V02r4 gives the optional 3D preview its own source-authored four-unit mast, base and three-cabinet speaker cluster in `lot-models.mjs`. All rotations stay inside the existing one-cell footprint, and the complete tower is one selectable object. The manifest records this Festival-only prop under `venueAssets`, separately from the Lot samples. Procedural geometry and materials use no external image. The dimensions express the existing logical obstacle height, not a calibrated physical tower.


### Revision12 review evidence, 2026-10-05

The private review pack freezes source `b8bfe08fe110121c51dafb75eb8efda837e3353a`: all eight actual HUD/view/light captures, camera/state/file hashes, a67.4-second orbit/live-motion/reduced-motion recording, neutral guest close views and the eight material swatches. Day views show the starter layout in Build; Show views use the same layout with150 admitted guests paused at minute65. All eight stills were inspected and retain page containment and exact fixture state. The review records that nearby guests can obscure the eye-level FOH view; the crowd, faces and materials remain simplified. This is concrete candidate evidence, not Dave's final style acceptance. [Current native measurements](PERFORMANCE.md#refined-sample-full-client-native-measurement) retain their exact source and device boundaries.


### Model13 anatomy follow-up

The inspected model12 close view still had a barrel torso, flat shoulders, exposed cylindrical neck and tube limbs. CT-DEC-30/FOH-V01e shapes the shared chest/waist/shoulder silhouette and tapers limbs, preserving pose joints, height, instance count and gameplay. The existing eight-view review and physical/device/human boundaries continue to apply. Model12 native measurements retain their original source attribution; they do not qualify this geometry change.


### Distance detail, 2026-10-05

CT-DEC-31 keeps the refined anatomy in close views and preserves its authored contours and surfaces in distant geometry. Detail follows physical screen size with hysteresis, not frame rate or machine identity. Review both tiers, transition silhouettes, walking/queues and all camera presets; no guest may disappear or be duplicated. Native/device and final human style acceptance remain open.
