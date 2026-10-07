# Front of House Release Notes

Front of House uses its own early-playable `0.x` version line. Patch releases
carry compatible fixes. Minor releases add player-facing capability. Save schema
versions are a separate compatibility contract and change only when saved data
requires migration.

## 0.1.1 — 2026-10-07

- Makes the running Build expense easier to understand as **Show cost so far**,
  with its venue-and-equipment scope stated directly in the readout.
- Hides placement tiles outside Build in both the classic and 3D views so Show
  reads as an event rather than an editor.
- Guides the first booking toward the complete Suggested layout while keeping
  Build available for learning and changes.
- Keeps engine rules, balance, accounting and save schema 2 unchanged.

## 0.1.0 — 2026-10-07

This is the first explicitly numbered Front of House release, not the first
playable build or a 1.0 acceptance claim.

- Opens fresh sessions in the existing 3D venue view. A player who explicitly
  chooses 2D or 3D keeps that choice on later visits; 2D remains available.
- Preserves the application-owned classic fallback when WebGL, the renderer
  module or a supported 3D room is unavailable.
- Includes the delivered four-room career, live services, equipment, research,
  venue operations and the Summary/Ledger settlement design.
- Keeps save schema 2. No engine, balance, career, accounting or saved-game
  migration changes are part of this release.

Earlier deployments remain dated, unnumbered project history in
[`progress.md`](../progress.md) and the root [`CHANGELOG.md`](../../CHANGELOG.md).
Human art/camera/career acceptance, supported physical devices, venue
calibration and original-image rights remain open release gates.
