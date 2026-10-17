# Equipment asset adapter guidance

Contract: [ECP-1.0 revision 1.0](../../docs/EQUIPMENT_PLATFORM_CONTRACT.md).
Instruction adoption date: 2026-10-17. This guidance adds no assets or gameplay.

## Ownership

Front of House consumes purpose-specific visual representations of equipment.
Its engine, scene snapshots, placement, economy, capacity, maintenance, acoustics,
collision and game balance retain their existing owners and saved state.
Generic equipment identity is separate from a game object, rental and placement.
Detailed inspection models and optimized game models can share equipment IDs
without sharing rendering code or simulation rules.

The [Lot model contract](LOT_SAMPLE.md) owns current representation dimensions,
logical footprints and authored geometry. Its provisional authoring scale is not
a physical venue measurement. Preserve current cameras, classic fallback, asset
ownership/disposal and save compatibility. Selection and visual inspection are
inert; imported geometry cannot change PA coverage or economy by implication.

## Released PA visual adapter

PR #168 implements the user-approved PA rig and equipment-card slice in 0.3.4
(cache v83). It adapts ZLX-15BT tops and EKX-15SP subs from producer revision
`ca438504fe5e09879d106e668529bd21b3d992f0`, representation revision 0.1.0.
`pa-models.mjs` supplies lightweight exterior geometry; the menu previews render
that same geometry. Small and medium PA keep their existing aggregate game IDs,
1x1 logical footprints, prices, power, coverage and ownership rules. Save schema
2 and engine/economy/save implementation remain unchanged.

The manifest records source hashes, dimensions, axes, pivot and component IDs.
An invisible picking envelope spans the rig's central gap without casting a
shadow or changing its logical footprint. Models are approximate reconstructions
at the existing provisional game scale, not physically calibrated inventory.

## Verification and remaining acceptance

Final source `494543314955a5f5f658364f244fca29526f1eab` passed required CI
39057828540, including paired renderer regression. PR #168 merged as
`8b5ae096bf1e35d16908e9de8331c1a9f39fbdf4`; Pages published that merge.
Dominic verified source bounds/IDs/picking, classic/3D settlement and reload,
seven equipment journeys, responsive cards and warmed-cache offline continuity.
The deployed runtime and imagery match source. No common engine or migration was
introduced. Keep source, CI, deployment, gameplay and human acceptance distinct.

Physical calibration, physical-device testing and human visual acceptance remain
open. Other MixMash games retain their own behavior and require an explicit
adapter before equipment integration.

## Lighting adapter — 0.3.5

The lighting slice adapts J-Six and Vertigo Tri LED procedural exteriors from
producer8a857717391e82b0518dd7d17dfbe06a34cbdb7a (definitions0.1.0).
The existing aggregate light tower retains its game identity, footprint, height
convention, rental and power/quality rules. These effect fixtures are visual
references, not physical-output equivalence or control capability claims.
Lighting cards and Build previews use the same geometry. Existing network-first
service-worker caching is retained without global publisher changes.
