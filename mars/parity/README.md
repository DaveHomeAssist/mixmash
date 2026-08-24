# MarsScape → mixmash/mars parity

This directory is the control system for porting MarsScape's gameplay into the
server-authoritative `mixmash/mars` engine without losing work.

## The position it enforces

| Authority | Repository | Status |
|---|---|---|
| Production shell, hosting, security | `mixmash/mars` | Keep |
| Gameplay design, balance, feature baseline | `marsscape` | **Remains authoritative** |
| Final unified canonical implementation | `mixmash/mars` | Only after parity gates pass |

`marsscape` must not be archived, redirected, or downgraded to "legacy" until every
feature carries an explicit `Ported`, `Intentionally Retired`, or `Deferred` disposition
and the ledger reaches 100%.

## Files

| File | Role |
|---|---|
| `baseline/data.js` | Verbatim frozen copy of `marsscape@ab073bc` `src/data.js`. Never edit. |
| `baseline/PROVENANCE.json` | Both known-good SHAs, the baseline checksum, and the preservation rules. |
| `mapping.json` | Explicit id correspondence + a disposition for every unported feature. Hand-maintained. |
| `build-ledger.mjs` | Generates `LEDGER.md`. Exits non-zero if any feature lacks a disposition. |
| `LEDGER.md` | Generated. The current parity state. |
| `parity.test.mjs` | Runs in `npm test`; keeps the ledger honest. |

## Why a mapping and not a diff

The two codebases use different id conventions — `c_frame`/`craft-frame`,
`fab`/`fabrication`, `iron1`/`iron-north`. A naive set diff would report a total
rewrite and hide real losses inside the noise. Parity is decided by `mapping.json`,
and `parity.test.mjs` checks the mapping from both directions: a MarsScape feature
with no engine counterpart shows as unported, and an engine id with no MarsScape
counterpart shows as an orphan.

## Workflow when porting a feature

1. Rebuild the feature in `mars/engine.mjs` as an engine command with authority
   persistence — this is a rebuild inside the server-authoritative architecture,
   never a file copy.
2. Add the id correspondence to `mapping.json` `rename` if the ids differ, and delete
   its `dispositions` entry.
3. Add a canonical test covering the behaviour.
4. Run `npm run parity` and commit the regenerated `LEDGER.md`.

To retire a feature instead, set its disposition to `Intentionally Retired` **with a
`reason`** — the ledger and tests reject retirement without one.

## Tagging the known-good SHAs

Both SHAs are recorded durably in `baseline/PROVENANCE.json`. To also place git tags:

```
git -C <mixmash>   tag -a marsscape-port/baseline -m 'pre-port mixmash' 43974c88386a4db53f3ab6c55293eeb6348786b8
git -C <marsscape> tag -a marsscape-port/baseline -m 'gameplay baseline v0.4.0' ab073bc89098101dd2ba51a2f41aae9ec047ebc8
```

These are left to run by hand: this branch's push scope is its own feature branch, and
tagging `marsscape` needs write access to that repository.

## Current state

Data parity 73/144. Behaviour parity 0/23. See `LEDGER.md` for the per-feature
breakdown and the wave each outstanding item belongs to.
