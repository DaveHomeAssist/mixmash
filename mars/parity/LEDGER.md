# MarsScape → mixmash/mars parity ledger

<!-- GENERATED FILE — do not edit by hand. Run: node mars/parity/build-ledger.mjs -->

`marsscape` remains **authoritative for gameplay** until every row below reads `Ported`
or carries an approved retirement. It must not be archived, redirected, or relabelled
legacy before then.

| | |
|---|---|
| Baseline | `DaveHomeAssist/marsscape` @ `ab073bc89098` (v0.4.0) |
| Target | `DaveHomeAssist/mixmash` @ `43974c88386a` (engine v3) |
| Data parity | **144/144** (100.0%) |
| Behaviour parity | **19/23** (82.6%) |
| Dispositioned | **100%** — every feature accounted for |

## Summary by domain

| Domain | Ported | Total | Gap |
|---|---:|---:|---:|
| Items | 27 | 27 | 0 |
| Skills | 10 | 10 | 0 |
| Resource nodes | 17 | 17 | 0 |
| Buildings | 8 | 8 | 0 |
| Smelting recipes | 6 | 6 | 0 |
| Crafting recipes | 37 | 37 | 0 |
| Research projects | 20 | 20 | 0 |
| Crops | 5 | 5 | 0 |
| Objectives | 14 | 14 | 0 |
| **Data total** | **144** | **144** | **0** |

## Remaining work by wave

| Wave | Items outstanding |
|---|---:|
| 1 · Foundations | 1 |
| 7 · Presentation | 2 |
| 8 · Cutover | 1 |

## Behaviour contract

| Behaviour | Status | Wave | Note |
|---|---|---|---|
| Exact RuneScape XP curve (99 = 13,034,431 xp) | Ported | 1 · Foundations |  |
| 600 ms action tick | Ported | 1 · Foundations |  |
| 60-second sol (100 ticks) | Ported | 1 · Foundations |  |
| Headless balance simulator + DoD verdicts | Deferred | 1 · Foundations | sim/simulate.mjs in marsscape; 5/5 verdicts PASS at v0.4.0. |
| Ore/ice ladders with in-tier quality crits | Ported | 2 · Economy |  |
| Geode rolls from scanner stat | Ported | 2 · Economy |  |
| Colony Depot (bank) with deposit/withdraw/depositAll | Ported | 3 · Storage |  |
| True inventory slots — stacks fill slots, full pack blocks gathering | Ported | 3 · Storage |  |
| Drone delivery contract + droneCap from Robotics | Ported | 3 · Storage |  |
| 3 gated research tiers (RESEARCH_TIER_REQ) | Ported | 4 · Progression |  |
| Permanent research unlock effects | Ported | 4 · Progression |  |
| Building tiers I-III | Ported | 5 · Colony depth |  |
| Overclock toggle (Engineering 25) with fault risk | Ported | 5 · Colony depth |  |
| Fault servicing (clears the greenhouse soft-lock) | Ported | 5 · Colony depth |  |
| 3 farm plots with per-plot crop state | Ported | 5 · Colony depth |  |
| Crop disease pauses growth (never kills) + fertilizer | Ported | 5 · Colony depth |  |
| 14 objectives with completion awards | Ported | 6 · Journey |  |
| Great Storm parity (250 ticks, 25-tick phases) | Ported | 6 · Journey |  |
| Victory + New Expedition+ postgame | Ported | 6 · Journey |  |
| Exploration expeditions (EXPED) and rich veins | Ported | 6 · Journey |  |
| Sprite-sheet loader with emoji fallback (13 sprites) | Deferred | 7 · Presentation |  |
| Player-facing manual (docs/MANUAL.md) | Deferred | 7 · Presentation |  |
| marsscape_v1 legacy save importer with quarantine + preview | Deferred | 8 · Cutover |  |

## Data contract

### Items — 27/27

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `iron_ore` | `iron_ore` | Ported | — |
| `copper_ore` | `copper_ore` | Ported | — |
| `titanium_ore` | `titanium_ore` | Ported | — |
| `silicate_ore` | `silicate_ore` | Ported | — |
| `rare_ore` | `rare_ore` | Ported | — |
| `iridium_ore` | `iridium_ore` | Ported | — |
| `ice` | `ice` | Ported | — |
| `geode` | `geode` | Ported | — |
| `iron_bar` | `iron_bar` | Ported | — |
| `copper_bar` | `copper_bar` | Ported | — |
| `titanium_bar` | `titanium_bar` | Ported | — |
| `glass` | `glass` | Ported | — |
| `alloy` | `alloy` | Ported | — |
| `iridium_bar` | `iridium_bar` | Ported | — |
| `water` | `water` | Ported | — |
| `frame` | `frame` | Ported | — |
| `frame2` | `composite_frame` | Ported | — |
| `part` | `component` | Ported | — |
| `part2` | `advanced_component` | Ported | — |
| `insulation` | `insulation` | Ported | — |
| `fertilizer` | `fertilizer` | Ported | — |
| `food` | `food` | Ported | — |
| `soy` | `soy` | Ported | — |
| `algae` | `algae` | Ported | — |
| `berries` | `berries` | Ported | — |
| `genefruit` | `genefruit` | Ported | — |
| `fuel` | `fuel` | Ported | — |

### Skills — 10/10

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `mining` | `mining` | Ported | — |
| `water` | `water` | Ported | — |
| `fab` | `fabrication` | Ported | — |
| `eng` | `engineering` | Ported | — |
| `agri` | `agriculture` | Ported | — |
| `robotics` | `robotics` | Ported | — |
| `explore` | `exploration` | Ported | — |
| `research` | `research` | Ported | — |
| `piloting` | `piloting` | Ported | — |
| `survival` | `survival` | Ported | — |

### Resource nodes — 17/17

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `iron1` | `iron-north` | Ported | — |
| `iron2` | `iron-south` | Ported | — |
| `iron3` | `iron-east` | Ported | — |
| `cop1` | `copper-ridge` | Ported | — |
| `cop2` | `copper-basin` | Ported | — |
| `ice1` | `ice-pocket` | Ported | — |
| `ice2` | `ice-scarp` | Ported | — |
| `perma1` | `permafrost-bed` | Ported | — |
| `brine1` | `brine-well` | Ported | — |
| `tita1` | `titanium-vein` | Ported | — |
| `silica1` | `silicate-bed-north` | Ported | — |
| `silica2` | `silicate-bed-west` | Ported | — |
| `rare1` | `rare-earth-seam` | Ported | — |
| `irid1` | `iridium-lode` | Ported | — |
| `dune_iron` | `dune-iron-scree` | Ported | — |
| `dune_wreck` | `dune-wreck-site` | Ported | — |
| `dune_silica` | `dune-silicate-dunes` | Ported | — |

### Buildings — 8/8

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `habitat` | `habitat` | Ported | — |
| `depot` | `depot` | Ported | — |
| `solar` | `solar` | Ported | — |
| `water` | `water` | Ported | — |
| `machine` | `machine` | Ported | — |
| `green` | `greenhouse` | Ported | — |
| `lab` | `lab` | Ported | — |
| `reactor` | `reactor` | Ported | — |

### Smelting recipes — 6/6

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `s_iron` | `smelt-iron` | Ported | — |
| `s_copper` | `smelt-copper` | Ported | — |
| `s_tita` | `smelt-titanium` | Ported | — |
| `s_glass` | `smelt-glass` | Ported | — |
| `s_alloy` | `smelt-alloy` | Ported | — |
| `s_irid` | `smelt-iridium` | Ported | — |

### Crafting recipes — 37/37

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `c_frame` | `craft-frame` | Ported | — |
| `c_part` | `craft-component` | Ported | — |
| `c_frame2` | `craft-composite-frame` | Ported | — |
| `c_part2` | `craft-advanced-component` | Ported | — |
| `c_insulation` | `craft-insulation` | Ported | — |
| `c_fert` | `craft-fertilizer` | Ported | — |
| `c_steel` | `craft-steel-pick` | Ported | — |
| `c_titapick` | `craft-titanium-pick` | Ported | — |
| `c_laser` | `craft-laser-pick` | Ported | — |
| `c_drone` | `craft-mining-drone` | Ported | — |
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

### Research projects — 20/20

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `drills` | `drills` | Ported | — |
| `scrub` | `scrubbers` | Ported | — |
| `loaders` | `loaders` | Ported | — |
| `laser_optics` | `laser_optics` | Ported | — |
| `grow_lights` | `grow_lights` | Ported | — |
| `survey_markers` | `survey_markers` | Ported | — |
| `deep_drilling` | `deep_drilling` | Ported | — |
| `cryo_insulation` | `cryo_insulation` | Ported | — |
| `fertilizer_synth` | `fertilizer_synth` | Ported | — |
| `grid_buffers` | `grid_buffers` | Ported | — |
| `cargo_frame` | `cargo_frame` | Ported | — |
| `drone_tuning` | `drone_tuning` | Ported | — |
| `thermal_recyclers` | `thermal_recyclers` | Ported | — |
| `iridium_refining` | `iridium_refining` | Ported | — |
| `quality_assay` | `quality_assay` | Ported | — |
| `automation_core` | `automation_core` | Ported | — |
| `xeno_agronomy` | `xeno_agronomy` | Ported | — |
| `orbital_uplink` | `orbital_uplink` | Ported | — |
| `alloy_tempering` | `alloy_tempering` | Ported | — |
| `emergency_protocols` | `emergency_protocols` | Ported | — |

### Crops — 5/5

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `potato` | `potato` | Ported | — |
| `soy` | `soy` | Ported | — |
| `algae` | `algae` | Ported | — |
| `berries` | `berries` | Ported | — |
| `genefruit` | `genefruit` | Ported | — |

### Objectives — 14/14

| MarsScape id | Canonical id | Status | Wave |
|---|---|---|---|
| `q1` | `obj-mine-iron` | Ported | — |
| `q2` | `obj-smelt-iron` | Ported | — |
| `q3` | `obj-craft-frames` | Ported | — |
| `q4` | `obj-build-solar` | Ported | — |
| `q5` | `obj-extract-ice` | Ported | — |
| `q6` | `obj-build-water` | Ported | — |
| `q7` | `obj-build-machine` | Ported | — |
| `q8` | `obj-smelt-titanium` | Ported | — |
| `q9` | `obj-build-greenhouse` | Ported | — |
| `q10` | `obj-harvest-crops` | Ported | — |
| `q11` | `obj-build-lab` | Ported | — |
| `q12` | `obj-research-any` | Ported | — |
| `q13` | `obj-build-reactor` | Ported | — |
| `q14` | `obj-endure-storm` | Ported | — |

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
| Data parity 100% (144/144) | PASS |
| Behaviour parity 100% (19/23) | NOT MET |
| mixmash baseline suite stays green (50 tests) | manual |
| MarsScape behavioural contract represented (97 tests) | manual |
| Balance simulator passes every XP/hour and source/sink verdict | manual |
| Real legacy save fixtures migrate with no loss | manual |
| `marsscape` intact until this ledger reaches 100% | manual |
