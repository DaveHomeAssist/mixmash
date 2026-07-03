# MIXMASH — Production Roadmap

Adopted 2026-07-03. Governance model: every phase carries explicit **Definitions of Done (DoD)**, a lifecycle **Checkpoint**, **Verification Standards**, and **Smoke Test Requirements**.

> **Scope note:** this roadmap covers the MIXMASH fighter (`/play/`). Studio-hub concerns (mixmash.games homepage, other games) are tracked separately.

## Reality check (audited against code, 2026-07-03)

Adjustments discovered when this roadmap was checked against the actual build (`play/index.html`, 5,904 lines):

1. **HTTPS enforcement is infra, not code, and is already in flight.** DNS is live, GitHub Pages serves mixmash.games, the Let's Encrypt cert is provisioning, and enforcement flips automatically the moment it issues. Treat this Phase 1 item as ~done.
2. **Match option persistence already shipped.** `mixmash_opts` in localStorage persists volume, music on/off, hitbox display, stage hazards, and both players' control binds across sessions. The only unbuilt piece of that item is a background-track selector (no such option exists yet).
3. **SEO metadata layer shipped 2026-07-03** for the studio homepage, `/play/`, and `home.html` (description, canonical, Open Graph). Remaining: a real `og:image` social card (PNG — SVG favicons don't qualify), `robots.txt`, `sitemap.xml`.
4. **Stage count is 9 today** (Battlefield, Final Destination, Skybridge, Festival Stage, Tomorrowland, Ultra Miami, Burning Man, Coachella, EDC Las Vegas). Phase 2's "all 11 stages" DoD implies two new stages — treat that as part of the Phase 2 scope, not current fact.
5. **"Platform Rush" does not exist yet.** No single-player platformer mode, vinyl records, or "Deep Cuts" are in the code. The Phase 2 item is a build-from-scratch feature, not an expansion.
6. **`X-Frame-Options` cannot be set on GitHub Pages** — Pages doesn't allow custom response headers, and neither that header nor CSP `frame-ancestors` works via `<meta>`. Phase 3 options: (a) JS frame-busting (`if (top !== self)` guard, with a same-origin allowance so `home.html`'s embed keeps working), or (b) move hosting to Cloudflare Pages/Netlify where headers are configurable. Decide at Checkpoint Beta.
7. **There is no CI yet.** The repo is a served `gh-pages` branch with no package.json, test runner, or workflows. The Phase 1/2 verification standards that reference "CI script loops" require standing up a minimal test harness first (extract combat math into a testable module or run headless via jsdom/Playwright). This is the hidden first task of Phase 1.
8. **NaN guarding is thin: 4 `NaN`/`isFinite` references in ~5,900 lines.** The grounded-attack audit below is justified; knockback math has effectively no finite-number assertions today.

---

## Phase 1: Foundation & Infrastructure (next 30 days)

Critical logic stability, initial discoverability, structural web hardening.

| Item | Priority | Status |
|------|----------|--------|
| Security: Enforce HTTPS migration | High | 🔄 automated, cert provisioning now |
| Bug fix: sanitize grounded-attack calculations (NaN knockback) | High | Open — audit `FIGHTER_DEFS` attack cloning + knockback math; guarantee finite outputs so camera matrices and background gradients can't poison |
| SEO: core metadata & Open Graph layer | High | ✅ shipped 07-03 (remaining: og:image card, robots.txt, sitemap.xml) |
| UX: match option cache persistence | Medium | ✅ pre-existing (`mixmash_opts`); add background-track option if/when track selection ships |
| *(unlisted prerequisite)* Minimal test harness + CI workflow | High | Open — required by this phase's own verification standards |

**Definition of Done:** plain `http` requests force-redirect to `https` at the edge; the physics core runs with no `NaN` mutations in the runtime entity pool (guarded + asserted in tests).

**Checkpoint Alpha (Security & SEO Compliance):** production headers load securely; crawlers parse the metadata layer successfully.

**Verification standards:** automated HTML parsing checks assert the meta blocks exist; core math consistency validated in the CI loop.

**Smoke test:** build loads; the options window reads, changes, and writes state back to localStorage cleanly.

## Phase 2: Engine Depth & Presentation (months 2–3)

Combat-frame optimization, solo replay value, visual feedback balance.

| Item | Priority | Status |
|------|----------|--------|
| Feature: "Platform Rush" solo mode — procedural vinyl-record + hidden "Deep Cuts" placement over stage structures | Medium | Open — **new mode, built from scratch** (see reality check #5) |
| Graphics: alpha-blended venue haze particles (Festival Stage, EDC first) | Medium | Open |
| Bug fix: object pooling in the `checkHits()` collision loop — eliminate GC pauses during hit combos | High | Open |
| UX: auto-collapse P2 controls overlay in single-player (`renderControlsOverlay()`) | Medium | Open |

**Definition of Done:** platformer generation places nothing out of bounds on any stage (9 today; 11 if the two new stages land in this phase); multi-hit combos hold 60 FPS under load with zero GC stutters.

**Checkpoint Beta (Performance & Solo Play Stability):** zero memory-leak growth over a 45-minute continuous soak.

**Verification standards:** frame-timing audits hold delta processing within 16.67 ms ± 2 ms.

**Smoke test:** solo platform mode launches with correct bindings; collecting a record updates the score tracker immediately.

## Phase 3: Scale & Production Hardening (months 4–6)

Execution-parameter lockdown, accessibility structures, kinetic-math cleanup.

| Item | Priority | Status |
|------|----------|--------|
| Feature: Web Audio polyphony expansion — per-fighter oscillator sweeps/sequences | Low | Open |
| Security: frame anchoring | High | Open — **headers unavailable on Pages**; choose JS frame-guard vs. host migration at Checkpoint Beta (reality check #6) |
| SEO/a11y: off-screen mirror of match state (screen-reader + crawler accessible live region) | Low | Open |
| Graphics: decaying-linear camera shake anchored to attacker momentum (replace random jitter) | Low | Open |

**Definition of Done:** unauthorized cross-origin frame embeds are blocked (via the mechanism chosen at Checkpoint Beta); the text mirror updates in sync with the engine loop.

**Checkpoint Gamma (Release Readiness):** dependency review clean against production build scripts; zero parsing vulnerabilities reported.

**Verification standards:** security scan verifies origin protection under cross-site simulation; screen readers parse the mirror tree without layout errors.

**Smoke test:** Web Audio context launches from a standard click; oscillator scheduling processes cleanly; cross-site framing results in a clean drop.
