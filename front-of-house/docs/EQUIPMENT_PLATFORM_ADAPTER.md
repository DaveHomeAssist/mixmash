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

## Proposed reuse proof

One ZLX visual test prop with a detailed-reference link is the next bounded
candidate, not an implemented asset or approved gameplay change. It must not
silently replace the game's aggregate PA rental. Start from the existing
[feature brief and decision workflow](FEATURE_BRIEFS.md), pin source equipment
and representation revisions, and define the ID/selection adapter explicitly.
No common engine or migration is required.

## Next proof

Before sharing an asset, verify rights, hashes, axes, scale, pivots, bounds,
stable component mappings, picking and repeated-instance cost for this consumer.
Exercise valid, invalid and unknown references; preserve save/export/reload IDs,
inert selection and existing fallback. Use the normal release checks for any
runtime change. Keep source checks, CI, deployment, actual gameplay, physical
calibration and human visual acceptance separate.

At handoff record ECP revision, producer/consumer revisions, changed interfaces
and gaps. Instruction discovery is not an independent agent-loading receipt;
runtime reuse and physical acceptance remain pending. Other MixMash games keep
their own behavior and need an explicit adapter before equipment integration.
