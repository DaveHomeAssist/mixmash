# RFC-004: Garden OS Engine Specification and Architectural Audit

TypeCode: RFC-004 / AUDIT-SYS
Date: 2026-07-06
Status: Draft specification captured from audit context; implementation not complete
Scope: mixmash.games/play/, mixmash.games/mars/, mixmash.games/garden/

## Current Repo Facts

Verified against this checkout on 2026-07-06:

- `/play/` is a static browser platform fighter in `play/index.html`.
- `/play/` persists options and active match resume snapshots through `localStorage`.
- `/play/` still runs the live game loop from `requestAnimationFrame`.
- `/mars/` has a shared JavaScript engine in `mars/engine.mjs`.
- `/mars/` has a Node authority API in `mars/server.mjs` and Vercel handlers under `api/`.
- `/mars/` signs canonical server session payloads with HMAC in `mars/server.mjs`.
- `/mars/` has browser fallback saves in `mars/game.js`, including WebCrypto HMAC and IndexedDB key storage.
- `/garden/` is currently a wrapper page that embeds the external Garden OS Story Mode URL.

These facts define the migration baseline. They do not prove that `/play/` or `/garden/`
already meet this RFC.

## Confirmed Decisions

### Server-Authoritative Event Ledger

Clients must not be trusted to submit full state. A browser client may predict and render
locally, but the backend owns session state, event ordering, idempotency, validation,
resource changes, authoritative ticks, and acknowledgements.

Client requests carry action envelopes. Server responses carry canonical acknowledgements,
state patches or snapshots, checksums, and server signatures.

### Tiered Persistence

Raw synchronous state writes to `localStorage` are not acceptable for high-frequency
runtime state.

Persistence tiers:

- Runtime loop: in-memory state only.
- Local durable cache: IndexedDB snapshots, journals, and outbound action queues.
- Small boot metadata: `localStorage` may hold only stable pointers and low-frequency
  user preferences.
- Backend: canonical session ledger and compacted snapshots.

### Fixed-Step Simulation

Simulation must not depend on the browser render cadence. Rendering may use
`requestAnimationFrame`, but authoritative logic and physics run on fixed ticks.

Target cadence:

- Physics: 120 Hz fixed sub-step.
- Game logic: 60 Hz fixed tick.
- Rendering: client-only interpolation and prediction.
- Worker boundary: physics and logic should be isolated from main-thread DOM and canvas work.

### Deterministic Merge Resolution

Grid and merge mechanics must use a multi-phase transaction pipeline per tick. The engine
must not let ad hoc component locking or render-frame timing double-trigger merges.

Required tick phases:

1. Collect validated intents.
2. Normalize intent order.
3. Reserve cells and entities.
4. Resolve spatial conflicts.
5. Apply state transforms.
6. Emit events.
7. Update checksums and journal cursors.

## Target Architecture

The target implementation is intentionally split between authoritative engine code and
predictive browser code.

```text
server/src/engine/
  contracts.ts
  ledger.ts
  reducer.ts
  simulation.ts
  grid.ts
  rng.ts
  snapshot.ts
  checksum.ts
  validation.ts

client/src/
  sync/
  storage/
  workers/
  render/
  input/
```

This repo does not currently contain those directories. Creating them requires choosing
the exact package and build integration for this static GitHub Pages plus Vercel setup.

## Core TypeScript Contracts

These contracts are the minimum target shape for future implementation. Game-specific
commands stay behind validators; the transport must not special-case a single game.

```ts
export type GameId = "play" | "mars" | "garden";
export type EntityId = string;
export type PlayerId = string;
export type SessionId = string;
export type ActionId = string;
export type Tick = number;

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface Vec2 {
  x: number;
  y: number;
}

export interface GridCell {
  x: number;
  y: number;
  terrain: string;
  occupants: EntityId[];
  locks: {
    reservedByActionId?: ActionId;
    reservedUntilTick?: Tick;
  };
  data: Record<string, JsonValue>;
}

export interface Entity {
  id: EntityId;
  type: string;
  ownerId?: PlayerId;
  position: Vec2;
  velocity?: Vec2;
  hp?: number;
  flags: string[];
  data: Record<string, JsonValue>;
  createdAtTick: Tick;
  updatedAtTick: Tick;
}

export interface GameState {
  gameId: GameId;
  version: number;
  sessionId: SessionId;
  tick: Tick;
  seed: string;
  rngState: string;
  entities: Record<EntityId, Entity>;
  grid?: {
    width: number;
    height: number;
    cells: GridCell[];
  };
  players: Record<PlayerId, Record<string, JsonValue>>;
  ledgerCursor: string;
  checksum: string;
  updatedAt: string;
}

export interface ActionEnvelope<TPayload extends Record<string, JsonValue> = Record<string, JsonValue>> {
  id: ActionId;
  sessionId: SessionId;
  gameId: GameId;
  playerId: PlayerId;
  clientSeq: number;
  clientSentAt: string;
  expectedTick?: Tick;
  type: string;
  payload: TPayload;
  idempotencyKey: string;
}

export interface ServerAck {
  actionId: ActionId;
  sessionId: SessionId;
  accepted: boolean;
  tick: Tick;
  stateVersion: number;
  checksum: string;
  authoritativePatch?: Record<string, JsonValue>;
  authoritativeSnapshotRef?: string;
  rejection?: {
    code: string;
    message: string;
  };
  serverTime: string;
  signature: string;
}
```

## Validation Rules

Every action envelope must pass these checks before reaching the reducer:

- Known session ID.
- Known game ID.
- Authenticated or otherwise valid player identity for the session.
- Unique idempotency key within the replay window.
- Monotonic client sequence per player, with bounded tolerance for retries.
- Payload size below the API limit.
- Command type allowed by the game validator.
- Payload schema valid for the command type.
- Expected tick not outside the accepted prediction window.
- No trusted client resource totals, entity totals, or full-state replacement.

Rejected actions must return a structured `ServerAck` with `accepted: false` and must not
advance canonical state.

## Event Ledger Rules

The ledger is append-only from the perspective of command processing.

Required fields per ledger entry:

- action envelope hash
- server receive time
- accepted or rejected status
- previous checksum
- next checksum
- emitted events
- reducer version
- snapshot reference when compaction occurs

Compaction may replace historical state material with a signed snapshot plus the remaining
journal suffix. It must not break replay verification.

## RNG Rule

Simulation RNG must be server-seeded and deterministic. The audit context calls for a
Split-Mix method, but this checkout has not implemented that target. Until the exact
integer width and serialization format are selected, RNG-dependent reducers must remain
behind deterministic tests.

Minimum requirements:

- No `Math.random()` inside authoritative reducers.
- RNG state serialized in `GameState`.
- Same seed plus same ledger produces the same checksum after replay.
- Parallel client/server replay over 120 frames produces identical checksums.

## Storage Rule

IndexedDB stores:

- latest verified snapshot
- optimistic client snapshot
- outbound action journal
- server acknowledgement journal
- compaction metadata

`localStorage` may store:

- session ID pointer
- selected settings
- last known snapshot ID

`localStorage` must not store high-frequency canonical game state as the primary durable
store for `/garden/` or future `/play/` engine work.

## Network Protocol

The protocol choice is intentionally unresolved. The audit context lists WebSockets versus
WebTransport as an open decision.

Selection criteria:

- Browser support.
- Hosting compatibility with the current GitHub Pages plus Vercel split.
- Ordered delivery needs.
- Reconnect and replay behavior.
- Cost and operational complexity.

Until this is decided, the engine API should depend on `ActionEnvelope` and `ServerAck`,
not on a transport-specific object.

## Migration Notes By Deployment

### `/play/`

Current risk:

- Static browser authority.
- High-frequency state in `localStorage` for resume.
- Main-thread render loop is tied to `requestAnimationFrame`.

Migration target:

- Extract deterministic combat and mode reducers.
- Move match commands into action envelopes.
- Keep canvas rendering predictive.
- Add checksum-based replay tests before any multiplayer or leaderboard work.

### `/mars/`

Current strength:

- Already has a server authority pattern.
- Already uses idempotent command IDs.
- Already signs canonical state responses.
- Already has local offline replay mechanics.

Migration target:

- Align Mars command envelopes with the RFC contract.
- Preserve existing API behavior until a versioned API migration exists.
- Add ledger and checksum concepts without breaking current saves.

### `/garden/`

Current risk:

- This repo currently embeds an external Garden OS deployment.
- The authoritative engine modules described here are not present in this checkout.

Migration target:

- Decide whether Garden OS engine code lives in this repo or remains owned by the external
  Garden OS repository.
- If moved here, implement the target `server/src/engine/` and `client/src/` layout behind
  tests before changing the public iframe route.

## Verification Matrix

Minimum tests for an implementation of this RFC:

| Area | Required proof |
| --- | --- |
| Idempotency | Duplicate action ID does not mutate state twice. |
| Replay | Same seed and ledger reconstructs the same checksum. |
| Tamper resistance | Client-submitted resource and entity totals are ignored or rejected. |
| Tick stability | 120-frame fixed-step replay is deterministic. |
| Merge pipeline | Two simultaneous merge intents cannot double-apply rewards. |
| Offline queue | Outbound IndexedDB journal replays exactly once after reconnect. |
| Quota handling | Snapshot and journal writes recover from quota failures without blocking render. |
| Transport retry | Replayed envelope returns the original acknowledgement. |

## Open Items

- Choose WebSockets or WebTransport for low-latency synchronization.
- Define the exact Split-Mix PRNG serialization format.
- Decide whether Garden OS engine modules live in this repo or the external Garden OS repo.
- Version the API before changing `/mars/` response shapes.
- Build a deterministic checksum implementation and test fixture.
- Add a migration plan for `/play/` away from static browser authority.
