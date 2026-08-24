# MarsScape → mixmash/mars parity ledger

<!-- GENERATED FILE — do not edit by hand. Run: node mars/parity/build-ledger.mjs -->

`marsscape` remains **authoritative for gameplay** until every row below reads `Ported`
or carries an approved retirement. It must not be archived, redirected, or relabelled
legacy before then.

| | |
|---|---|
| Baseline | `DaveHomeAssist/marsscape` @ `ab073bc89098` (v0.4.0) |
| Target | `DaveHomeAssist/mixmash` @ `43974c88386a` (engine v3) |
| Data parity | **73/144** (50.7%) |
| Behaviour parity | **0/23** (0.0%) |
| Dispositioned | **100%** — every feature accounted for |

## Summary by domain

| Domain | Ported | Total | Gap |
|---|---:|---:|---:|
| Items | 12 | 27 | 15 |
| Skills | 8 | 10 | 2 |
| Resource nodes | 9 | 17 | 8 |
| Buildings | 7 | 8 | 1 |
| Smelting recipes | 3 | 6 | 3 |
| Crafting recipes | 31 | 37 | 6 |
| Research projects | 3 | 20 | 17 |
| Crops | 0 | 5 | 5 |
| Objectives | 0 | 14 | 14 |
| **Data total** | **73** | **144** | **71** |

## Remaining work by wave

| Wave | Items outstanding |
|---|---:|
| 1 · Foundations | 4 |
| 2 · Economy | 25 |
| 3 · Storage | 4 |
| 4 · Progression | 19 |
| 5 · Colony depth | 18 |
| 6 · Journey | 21 |
| 7 · Presentation | 2 |
| 8 · Cutover | 1 |

## Behaviour contract

| Behaviour | Status | Wave | Note |
|---|---|---|---|
| Exact RuneScape XP curve (99 = 13,034,431 xp) | Deferred | 1 · Foundations | engine.mjs uses sqrt(xp)/5+1, reaching 99 at 240,100 xp — a 54x compression of the whole arc. |
| 600 ms action tick | Deferred | 1 · Foundations | engine.mjs ticks at 5000 ms. Travel already compensates with a 600 ms constant; the rest does not. |
| 60-second sol (100 ticks) | Deferred | 1 · Foundations |  |
| Headless balance simulator + DoD verdicts | Deferred | 1 · Foundations | sim/simulate.mjs in marsscape; 5/5 verdicts PASS at v0.4.0. |
| Ore/ice ladders with in-tier quality crits | Deferred | 2 · Economy |  |
| Geode rolls from scanner stat | Deferred | 2 · Economy | engine.mjs has a geode stat but no geode item or roll. |
| Colony Depot (bank) with deposit/withdraw/depositAll | Deferred | 3 · Storage |  |
| True inventory slots — stacks fill slots, full pack blocks gathering | Deferred | 3 · Storage | engine.mjs caps per-item quantity at 999 instead of modelling slots. |
| Drone delivery contract + droneCap from Robotics | Deferred | 3 · Storage |  |
| 3 gated research tiers (RESEARCH_TIER_REQ) | Deferred | 4 · Progression |  |
| Permanent research unlock effects | Deferred | 4 · Progression | engine.mjs stores research booleans; the effects are largely unwired. |
| Building tiers I-III | Deferred | 5 · Colony depth |  |
| Overclock toggle (Engineering 25) with fault risk | Deferred | 5 · Colony depth |  |
| Fault servicing (clears the greenhouse soft-lock) | Deferred | 5 · Colony depth |  |
| 3 farm plots with per-plot crop state | Deferred | 5 · Colony depth | engine.mjs has a single {plantedAt, ready} farm object. |
| Crop disease pauses growth (never kills) + fertilizer | Deferred | 5 · Colony depth |  |
| 14 objectives with completion awards | Deferred | 6 · Journey |  |
| Great Storm parity (250 ticks, 25-tick phases) | Partial | 6 · Journey | engine.mjs has a storm with phases; totals and failure/victory handling need parity checking. |
| Victory + New Expedition+ postgame | Deferred | 6 · Journey |  |
| Exploration expeditions (EXPED) and rich veins | Deferred | 6 · Journey |  |
| Sprite-sheet loader with emoji fallback (13 sprites) | Deferred | 7 · Presentation |  |
| Player-facing manual (docs/MANUAL.md) | Deferred | 7 · Presentation |  |
| marsscape_v1 legacy save importer with quarantine + preview | Deferred | 8 · Cutover |  |

## Data contract

### Items — 12/27

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `iron_ore` | `iron_ore` | Ported | — |
| `copper_ore` | `copper_ore` | Ported | — |
| `titanium_ore` | `titanium_ore` | Ported | — |
| `silicate_ore` | — | Deferred | 2 · Economy |
| `rare_ore` | — | Deferred | 2 · Economy |
| `iridium_ore` | — | Deferred | 2 · Economy |
| `ice` | `ice` | Ported | — |
| `geode` | — | Deferred | 2 · Economy |
| `iron_bar` | `iron_bar` | Ported | — |
| `copper_bar` | `copper_bar` | Ported | — |
| `titanium_bar` | `titanium_bar` | Ported | — |
| `glass` | — | Deferred | 2 · Economy |
| `alloy` | — | Deferred | 2 · Economy |
| `iridium_bar` | — | Deferred | 2 · Economy |
| `water` | `water` | Ported | — |
| `frame` | `frame` | Ported | — |
| `frame2` | — | Deferred | 2 · Economy |
| `part` | `component` | Ported | — |
| `part2` | — | Deferred | 2 · Economy |
| `insulation` | — | Deferred | 5 · Colony depth |
| `fertilizer` | — | Deferred | 5 · Colony depth |
| `food` | `food` | Ported | — |
| `soy` | — | Deferred | 5 · Colony depth |
| `algae` | — | Deferred | 5 · Colony depth |
| `berries` | — | Deferred | 5 · Colony depth |
| `genefruit` | — | Deferred | 5 · Colony depth |
| `fuel` | `fuel` | Ported | — |

### Skills — 8/10

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `mining` | `mining` | Ported | — |
| `water` | `water` | Ported | — |
| `fab` | `fabrication` | Ported | — |
| `eng` | `engineering` | Ported | — |
| `agri` | `agriculture` | Ported | — |
| `robotics` | — | Deferred | 6 · Journey |
| `explore` | — | Deferred | 6 · Journey |
| `research` | `research` | Ported | — |
| `piloting` | `piloting` | Ported | — |
| `survival` | `survival` | Ported | — |

### Resource nodes — 9/17

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `iron1` | `iron-north` | Ported | — |
| `iron2` | `iron-south` | Ported | — |
| `iron3` | — | Deferred | 2 · Economy |
| `cop1` | `copper-ridge` | Ported | — |
| `cop2` | `copper-basin` | Ported | — |
| `ice1` | `ice-pocket` | Ported | — |
| `ice2` | `ice-scarp` | Ported | — |
| `perma1` | — | Deferred | 2 · Economy |
| `brine1` | — | Deferred | 2 · Economy |
| `tita1` | `titanium-vein` | Ported | — |
| `silica1` | — | Deferred | 2 · Economy |
| `silica2` | — | Deferred | 2 · Economy |
| `rare1` | — | Deferred | 2 · Economy |
| `irid1` | — | Deferred | 2 · Economy |
| `dune_iron` | `dune-iron-scree` | Ported | — |
| `dune_wreck` | `dune-wreck-site` | Ported | — |
| `dune_silica` | — | Deferred | 2 · Economy |

### Buildings — 7/8

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `habitat` | `habitat` | Ported | — |
| `depot` | — | Deferred | 3 · Storage |
| `solar` | `solar` | Ported | — |
| `water` | `water` | Ported | — |
| `machine` | `machine` | Ported | — |
| `green` | `greenhouse` | Ported | — |
| `lab` | `lab` | Ported | — |
| `reactor` | `reactor` | Ported | — |

### Smelting recipes — 3/6

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `s_iron` | `smelt-iron` | Ported | — |
| `s_copper` | `smelt-copper` | Ported | — |
| `s_tita` | `smelt-titanium` | Ported | — |
| `s_glass` | — | Deferred | 2 · Economy |
| `s_alloy` | — | Deferred | 2 · Economy |
| `s_irid` | — | Deferred | 2 · Economy |

### Crafting recipes — 31/37

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `c_frame` | `craft-frame` | Ported | — |
| `c_part` | `craft-component` | Ported | — |
| `c_frame2` | — | Deferred | 2 · Economy |
| `c_part2` | — | Deferred | 2 · Economy |
| `c_insulation` | — | Deferred | 5 · Colony depth |
| `c_fert` | — | Deferred | 5 · Colony depth |
| `c_steel` | `craft-steel-pick` | Ported | — |
| `c_titapick` | `craft-titanium-pick` | Ported | — |
| `c_laser` | — | Deferred | 2 · Economy |
| `c_drone` | — | Deferred | 6 · Journey |
| `c_fuel` | `craft-fuel-cell` | Ported | — |
| `c_rover2` | `craft-rover-2` | Ported | — |
| `c_rover3` | `craft-rover-3` | Ported | — |
| `c_canvas_suit` | `craft-equip-canvas-suit` | Ported | — |
| `c_canvas_helmet` | `craft-equip-canvas-helmet` | Ported | — |
| `c_canvas_gloves` | `craft-equip-canvas-gloves` | Ported | — |
| `c_canvas_boots` | `craft-equip-canvas-boots` | Ported | — |
| `c_canvas_scanner` | `craft-equip-canvas-scanner` | Ported | — |
| `c_canvas_backpack` | `craft-equip-canvas-backpack` | Ported | — |
| `c_steel_suit` | `craft-equip-steel-suit` | Ported | — |
| `c_steel_helmet` | `craft-equip-steel-helmet` | Ported | — |
| `c_steel_gloves` | `craft-equip-steel-gloves` | Ported | — |
| `c_steel_boots` | `craft-equip-steel-boots` | Ported | — |
| `c_steel_scanner` | `craft-equip-steel-scanner` | Ported | — |
| `c_steel_backpack` | `craft-equip-steel-backpack` | Ported | — |
| `c_titan_suit` | `craft-equip-titan-suit` | Ported | — |
| `c_titan_helmet` | `craft-equip-titan-helmet` | Ported | — |
| `c_titan_gloves` | `craft-equip-titan-gloves` | Ported | — |
| `c_titan_boots` | `craft-equip-titan-boots` | Ported | — |
| `c_titan_scanner` | `craft-equip-titan-scanner` | Ported | — |
| `c_titan_backpack` | `craft-equip-titan-backpack` | Ported | — |
| `c_composite_suit` | `craft-equip-composite-suit` | Ported | — |
| `c_composite_helmet` | `craft-equip-composite-helmet` | Ported | — |
| `c_composite_gloves` | `craft-equip-composite-gloves` | Ported | — |
| `c_composite_boots` | `craft-equip-composite-boots` | Ported | — |
| `c_composite_scanner` | `craft-equip-composite-scanner` | Ported | — |
| `c_composite_backpack` | `craft-equip-composite-backpack` | Ported | — |

### Research projects — 3/20

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `drills` | `drills` | Ported | — |
| `scrub` | `scrubbers` | Ported | — |
| `loaders` | `loaders` | Ported | — |
| `laser_optics` | — | Deferred | 4 · Progression |
| `grow_lights` | — | Deferred | 4 · Progression |
| `survey_markers` | — | Deferred | 4 · Progression |
| `deep_drilling` | — | Deferred | 4 · Progression |
| `cryo_insulation` | — | Deferred | 4 · Progression |
| `fertilizer_synth` | — | Deferred | 4 · Progression |
| `grid_buffers` | — | Deferred | 4 · Progression |
| `cargo_frame` | — | Deferred | 4 · Progression |
| `drone_tuning` | — | Deferred | 4 · Progression |
| `thermal_recyclers` | — | Deferred | 4 · Progression |
| `iridium_refining` | — | Deferred | 4 · Progression |
| `quality_assay` | — | Deferred | 4 · Progression |
| `automation_core` | — | Deferred | 4 · Progression |
| `xeno_agronomy` | — | Deferred | 4 · Progression |
| `orbital_uplink` | — | Deferred | 4 · Progression |
| `alloy_tempering` | — | Deferred | 4 · Progression |
| `emergency_protocols` | — | Deferred | 4 · Progression |

### Crops — 0/5

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `potato` | — | Deferred | 5 · Colony depth |
| `soy` | — | Deferred | 5 · Colony depth |
| `algae` | — | Deferred | 5 · Colony depth |
| `berries` | — | Deferred | 5 · Colony depth |
| `genefruit` | — | Deferred | 5 · Colony depth |

### Objectives — 0/14

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `q1` | — | Deferred | 6 · Journey |
| `q2` | — | Deferred | 6 · Journey |
| `q3` | — | Deferred | 6 · Journey |
| `q4` | — | Deferred | 6 · Journey |
| `q5` | — | Deferred | 6 · Journey |
| `q6` | — | Deferred | 6 · Journey |
| `q7` | — | Deferred | 6 · Journey |
| `q8` | — | Deferred | 6 · Journey |
| `q9` | — | Deferred | 6 · Journey |
| `q10` | — | Deferred | 6 · Journey |
| `q11` | — | Deferred | 6 · Journey |
| `q12` | — | Deferred | 6 · Journey |
| `q13` | — | Deferred | 6 · Journey |
| `q14` | — | Deferred | 6 · Journey |

## Save migration contract

Legacy key: `marsscape_v1`. Old marsscape save (SAVE_KEY "marsscape_v1", SAVE_VERSION 4) -> canonical mixmash state. Unsupported values must be quarantined and reported, never silently discarded.

| Legacy field | Canonical mapping |
|---|---|
| `v` | legacyVersion (namespaced) |
| `inv` | inventory |
| `bank` | bank (restored canonical) |
| `fab` | skills.fabrication |
| `eng` | skills.engineering |
| `agri` | skills.agriculture |
| `part` | inventory.component |
| `green` | built.greenhouse |
| `region` | currentRegion |
| `finalStorm` | storm (canonical storm state) |
| `victory` | postgame.victory |
| `postgame` | postgame |
| `drones` | postgame.drones |
| `extraNodes` | postgame.extraNodes |

- Accept a marsscape_v1 export once, preview the conversion before committing it.
- Create a server-owned session from the converted state; never trust client totals.
- Preserve the original save verbatim for rollback.
- Quarantine and report unmapped fields; do not drop them.

## Acceptance gates

| Gate | Status |
|---|---|
| All data features dispositioned | PASS |
| Data parity 100% (73/144) | NOT MET |
| Behaviour parity 100% (0/23) | NOT MET |
| mixmash baseline suite stays green (50 tests) | manual |
| MarsScape behavioural contract represented (97 tests) | manual |
| Balance simulator passes every XP/hour and source/sink verdict | manual |
| Real legacy save fixtures migrate with no loss | manual |
| `marsscape` intact until this ledger reaches 100% | manual |
