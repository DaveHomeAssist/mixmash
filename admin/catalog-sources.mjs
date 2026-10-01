// Hand-authored inputs for the admin index (mixmash.games/admin/).
//
// build-catalog.mjs combines these with the repository's tracked file list to
// write admin/catalog.json. Everything here is structural: projects, the file
// taxonomy, references and notes for files whose own headings or comments do
// not describe them. Live status (test results, open reviews, phase progress)
// is never typed here; each project instead points at the files that own its
// status, so the index cannot drift into stale claims.
//
// The page is publicly reachable, like every route on GitHub Pages. Keep it
// public-safe: no local paths, no Notion links, and private repositories named
// but not linked where the published Zelda2Mario projection forbids it.

export const REPO = {
  owner: 'DaveHomeAssist',
  name: 'mixmash',
  branch: 'gh-pages',
  url: 'https://github.com/DaveHomeAssist/mixmash',
  site: 'https://mixmash.games',
};

// Ordered: this is the order categories appear on every project panel.
export const CATEGORIES = [
  { id: 'surface', label: 'Live pages', description: 'Routes and review surfaces served on mixmash.games.' },
  { id: 'docs', label: 'Design & reference', description: 'Design documents, manuals, guides, specifications and brand references.' },
  { id: 'decisions', label: 'Decisions & governance', description: 'Decision logs, agent rules and licensing.' },
  { id: 'planning', label: 'Roadmaps & logs', description: 'Roadmaps, sprint boards, changelogs and session progress logs.' },
  { id: 'evidence', label: 'Evidence & baselines', description: 'Generated reports, balance baselines, parity ledgers and frozen provenance.' },
  { id: 'art', label: 'Art & media', description: 'Images, previews, art specifications and asset indexes.' },
  { id: 'tests', label: 'Tests & QA', description: 'Unit tests, Playwright smoke rails and test fixtures.' },
  { id: 'tooling', label: 'Tooling & simulators', description: 'Validators, simulators, generators and ledger builders.' },
  { id: 'source', label: 'Source code', description: 'Game logic, clients, styles and shared runtime modules.' },
  { id: 'backend', label: 'Servers & API', description: 'The MarsScape authority server and its Vercel functions.' },
  { id: 'build', label: 'Compiled builds', description: 'Generated binaries copied in from another repository.' },
  { id: 'ops', label: 'Hosting, CI & config', description: 'CI, hosting, PWA, SEO and package configuration.' },
];

const gh = (path) => `${REPO.url}/${path}`;
const pr = (number, label) => ({ label: `PR #${number}: ${label}`, url: gh(`pull/${number}`), kind: 'pull request' });

// Ordered: this is the order of the project rail. `pinned` paths are shown as
// "Start here"; `statusSources` are where current status is recorded.
export const PROJECTS = [
  {
    id: 'mixmash',
    name: 'MIXMASH',
    kind: 'DJ platform fighter',
    lifecycle: 'Live',
    route: '/play/',
    summary: 'The flagship: a DJ-powered platform fighter on one static page. Combat math is canonical in src/combat.js; the shipped page keeps an inline copy that a parity test guards, and every public roster or arena count is tested against the catalog modules.',
    pinned: ['ROADMAP.md', 'docs/PLAYER_GUIDE.md', 'play/progress.md', 'src/combat.js'],
    statusSources: ['ROADMAP.md', 'play/progress.md', 'docs/SPRINT_BOARDS.md'],
    references: [
      { label: 'Play MIXMASH', url: '/play/', kind: 'live route' },
      { label: 'Marketing page', url: '/home.html', kind: 'live route' },
    ],
  },
  {
    id: 'mars',
    name: 'MarsScape',
    kind: 'Mars colony skiller',
    lifecycle: 'Live + API',
    route: '/mars/',
    summary: 'An isometric canvas client over a server-authoritative engine: Vercel functions with private Blob storage in production, Node and SQLite locally, and a signed offline mode. The DEC-79 pipeline gates commissioned art behind machine reports and a human receipt. It has diverged from the private marsscape repository; never copy one over the other.',
    pinned: ['mars/README.md', 'mars/docs/DECISIONS.md', 'mars/docs/ART_DIRECTION.md', 'mars/docs/MANUAL.md'],
    statusSources: ['mars/progress.md', 'mars/docs/ART_ROADMAP.md', 'mars/art/reports/art-validation.json', 'mars/parity/LEDGER.md'],
    references: [
      { label: 'Play MarsScape', url: '/mars/', kind: 'live route' },
      { label: 'Golden scene review', url: '/mars/golden-scene.html', kind: 'review surface' },
      { label: 'Render contract proof', url: '/mars/art-spec.html', kind: 'review surface' },
      { label: 'Authority API health', url: 'https://mixmash-marsscape-authority.vercel.app/api/health', kind: 'backend' },
      pr(11, 'DEC-79 paid-test candidate'),
      { label: 'marsscape source repository', url: 'https://github.com/DaveHomeAssist/marsscape', kind: 'repository', private: true, note: 'Independent single-file build; diverged from /mars/.' },
    ],
  },
  {
    id: 'front-of-house',
    name: 'Front of House',
    kind: 'Concert promotion management',
    lifecycle: 'Unlisted',
    route: '/front-of-house/',
    summary: 'A concert-promotion management game at the Lot tier: a pure rules engine, a balance simulator whose baseline CI checks for drift, and a full design-document set. The route is noindex with no hub card until Dave signs off the first playable.',
    pinned: ['front-of-house/README.md', 'front-of-house/docs/GDD.md', 'front-of-house/docs/RULES.md', 'front-of-house/ROADMAP.md'],
    statusSources: ['front-of-house/ROADMAP.md', 'front-of-house/progress.md', 'front-of-house/docs/DECISIONS.md'],
    references: [
      { label: 'Play Lot Night', url: '/front-of-house/', kind: 'live route', note: 'noindex; no hub card yet.' },
      pr(19, 'pre-production documents'),
      pr(20, 'rules engine and simulator'),
      pr(21, 'named Front of House'),
      pr(22, 'first playable'),
      pr(24, 'Phase 3, the Lot tier'),
      pr(25, 'Phase 4, a Lot career'),
      pr(26, 'Phase 4 verification'),
    ],
  },
  {
    id: 'pitch',
    name: 'PITCH RIOT',
    kind: 'Arcade soccer',
    lifecycle: 'Live',
    route: '/pitch/',
    summary: 'A self-contained arcade soccer game in one HTML file: one outfielder against a CPU, with a halftime cover-ops minigame that homages FIFA Pitch Crew. No build step and no backend.',
    pinned: ['pitch/index.html', 'docs/SPRINT_BOARDS.md'],
    statusSources: ['docs/SPRINT_BOARDS.md'],
    references: [
      { label: 'Play PITCH RIOT', url: '/pitch/', kind: 'live route' },
      pr(1, 'add PITCH RIOT'),
      { label: 'FIFA Pitch Crew', url: 'https://systembydave.com/fifa-pitch-crew/', kind: 'inspiration' },
      { label: 'system-by-dave repository', url: 'https://github.com/DaveHomeAssist/system-by-dave', kind: 'repository' },
    ],
  },
  {
    id: 'empires',
    name: 'EMPIRES',
    kind: 'RTS · Age of Dave',
    lifecycle: 'Live',
    route: '/empires/',
    summary: 'An Emscripten WebAssembly build of the private aoe2-clone C++/SDL RTS: seven civilisations, combat and an AI opponent, local skirmish only. Rebuild in aoe2-clone with tools/build_web.sh, then copy the generated loader and binary into empires/assets/.',
    pinned: ['empires/progress.md', 'empires/index.html', 'docs/SPRINT_BOARDS.md'],
    statusSources: ['empires/progress.md', 'docs/SPRINT_BOARDS.md'],
    references: [
      { label: 'Play EMPIRES', url: '/empires/', kind: 'live route' },
      { label: 'aoe2-clone source repository', url: 'https://github.com/DaveHomeAssist/aoe2-clone', kind: 'repository', private: true, note: 'Owns the C++ source and tools/build_web.sh.' },
    ],
  },
  {
    id: 'garden',
    name: 'Garden OS',
    kind: 'Story mode embed',
    lifecycle: 'Live embed',
    route: '/garden/',
    summary: 'A full-viewport iframe of the live Garden OS story mode, so it never drifts and needs no redeploy here. Gameplay issues belong in the garden-os repository.',
    pinned: ['garden/index.html', 'docs/rfc-004-garden-os-engine-specification.md'],
    statusSources: ['docs/SPRINT_BOARDS.md'],
    references: [
      { label: 'Play Garden OS', url: '/garden/', kind: 'live route' },
      { label: 'Upstream story mode', url: 'https://davehomeassist.github.io/garden-os/story-mode/', kind: 'live route' },
      { label: 'garden-os repository', url: 'https://github.com/DaveHomeAssist/garden-os', kind: 'repository' },
      { label: 'garden-os issues', url: 'https://github.com/DaveHomeAssist/garden-os/issues', kind: 'tracker', note: 'GD-101 to GD-105 were re-filed there as #38 to #42.' },
    ],
  },
  {
    id: 'zelda2mario',
    name: 'Zelda2MarioCoop',
    kind: 'NES co-op ROM hack',
    lifecycle: 'Status only',
    route: '/zelda2mario/',
    summary: 'A public, evidence-bound status ledger for the private Zelda2MarioCoop source project. The page is an exact copy of the source repository\'s generated dashboard. No ROM data or playable build is published.',
    pinned: ['zelda2mario/index.html', 'test/zelda2mario-smoke.mjs'],
    statusSources: ['zelda2mario/index.html'],
    references: [
      { label: 'Status ledger', url: '/zelda2mario/', kind: 'live route' },
      { label: 'Zelda2MarioCoop source repository', url: null, kind: 'repository', private: true, note: 'Private; deliberately not linked from public pages.' },
    ],
  },
  {
    id: 'playcards',
    name: 'PlayCards',
    kind: 'Java card games',
    lifecycle: 'Desktop only',
    route: null,
    summary: 'Dependency-free Java card games: a Swing Blackjack table, a console Blackjack mode and a Texas Hold\'em simulation over one shared state engine. Built with Ant from the NetBeans project; it is not served as a web game.',
    pinned: ['playcards/README.md', 'playcards/Changelog-Project-PlayCards.md', 'playcards/Sprint-Board-Graphics-UI.md'],
    statusSources: ['playcards/Changelog-Project-PlayCards.md', 'playcards/Sprint-Board-Graphics-UI.md'],
    references: [
      { label: 'PlayCards folder on GitHub', url: gh('tree/gh-pages/playcards'), kind: 'repository' },
    ],
    commands: [
      { name: 'ant clean test jar', description: 'Run the JUnit tests and build dist/PlayCards.jar.' },
      { name: 'java -jar dist/PlayCards.jar', description: 'Launch the Swing Blackjack table.' },
      { name: 'java -jar dist/PlayCards.jar --console', description: 'Play Blackjack in the terminal.' },
      { name: 'java -jar dist/PlayCards.jar --holdem 42', description: 'Run a reproducible Texas Hold\'em simulation (omit the seed for a random game).' },
    ],
  },
  {
    id: 'studio',
    name: 'Studio & hub',
    kind: 'Hub, platform and admin',
    lifecycle: 'Hub',
    route: '/',
    summary: 'The studio hub at mixmash.games: landing pages, the shared MixKit nav, save and PWA modules, the service worker, SEO files, CI, hosting configuration and this admin index. gh-pages is the live default branch, served by the legacy Pages build.',
    pinned: ['README.md', 'CHANGELOG.md', 'AGENTS.md', 'docs/SPRINT_BOARDS.md'],
    statusSources: ['CHANGELOG.md', 'progress.md', 'docs/SPRINT_BOARDS.md'],
    references: [
      { label: 'mixmash.games', url: '/', kind: 'live route' },
      { label: 'GitHub repository', url: REPO.url, kind: 'repository' },
      { label: 'CI runs', url: gh('actions/workflows/ci.yml'), kind: 'ci' },
      { label: 'Pages deployments', url: gh('deployments'), kind: 'deploy' },
      { label: 'Open pull requests', url: gh('pulls'), kind: 'tracker' },
      { label: 'Status naming standard', url: 'https://github.com/DaveHomeAssist/skills/blob/master/status-naming.md', kind: 'standard' },
    ],
  },
];

// npm scripts: which project each belongs to and what it does. A script that
// is missing here still appears under Studio, described by its command.
export const COMMAND_NOTES = {
  test: { project: 'studio', description: 'Every unit test in the repo with Node\'s built-in runner, including this index\'s coverage check.' },
  'vercel-build': { project: 'studio', description: 'Syntax-check the API, MarsScape server, Front of House client and admin scripts (what Vercel\'s build runs).' },
  'smoke:catalog': { project: 'studio', description: 'Playwright rail for /pitch/, /mars/, the /empires/ shell, the hub and the shared nav.' },
  'smoke:landing': { project: 'studio', description: 'Landing page at five widths: keyboard order, reduced motion, hit targets, contrast and screenshots.' },
  'smoke:admin': { project: 'studio', description: 'This admin index: no page scroll at six widths, themes, keyboard tabs, search, filters and privacy.' },
  'admin:index': { project: 'studio', description: 'Regenerate admin/catalog.json locally. The admin-index workflow does the same after every push to gh-pages.' },
  'smoke:play': { project: 'mixmash', description: 'Fighter resume, snapshot, Platform Rush, profile and share-link smoke rail.' },
  'smoke:zelda2mario': { project: 'zelda2mario', description: 'Status ledger scope, privacy, mobile and ultrawide layout, themes, keyboard tabs, filters and printing.' },
  'smoke:front-of-house': { project: 'front-of-house', description: 'Lot Night end to end: reload, save codes and version 1 conversion, keyboard building, reduced motion, phone width, contrast.' },
  'sim:front-of-house': { project: 'front-of-house', description: 'Regenerate docs/BALANCE_BASELINE.md. CI fails on drift or a FAIL verdict.' },
  'start:mars': { project: 'mars', description: 'Run the authority server locally with SQLite at http://localhost:8787/mars/.' },
  'art:index': { project: 'mars', description: 'Regenerate the commissioned-art runtime index from valid present frames.' },
  'art:validate': { project: 'mars', description: 'Validate DEC-79 assets and verify the runtime index and strict-report parity.' },
  'art:report': { project: 'mars', description: 'Refresh the normal, paid-test and full-golden machine reports.' },
  'art:contact-sheet': { project: 'mars', description: 'Regenerate the golden contact sheet. CI fails on drift.' },
  'art:visual': { project: 'mars', description: 'Capture game, fallback, contract, contact-sheet and golden-scene visual evidence.' },
  'art:approve': { project: 'mars', description: 'Strict paid-test machine gate: four assets, eight PNG exports, four layered sources.' },
  'art:approve:golden': { project: 'mars', description: 'Full-golden machine gate: 26 assets and 108 exports. Records no human approval.' },
  parity: { project: 'mars', description: 'Rebuild mars/parity/LEDGER.md from the frozen baseline, the live engine and mapping.json.' },
  sim: { project: 'mars', description: 'Headless balance simulator; writes mars/docs/BALANCE_BASELINE.md.' },
};

// Notes for files whose own heading or leading comment does not say what they
// are. Keys must be tracked paths; the coverage test rejects stale keys.
// `title` replaces the extracted title; `description` replaces the summary.
const preview = (game) => ({ description: `${game} gameplay preview on the landing page. Capture provenance is in assets/previews/README.md.` });
const vercelFn = (route, what) => ({ description: `Vercel function for ${route}: ${what} It delegates to the shared handler in mars/server.mjs.` });

export const FILE_NOTES = {
  // Studio root and hosting
  '.github/workflows/ci.yml': { title: 'CI workflow', description: 'Regenerates the admin catalog, then unit tests, syntax checks, art and balance drift gates and every Playwright rail. Runs on pull requests and on relevant pushes to gh-pages.' },
  '.github/workflows/admin-index.yml': { title: 'Admin index sync workflow', description: 'After every push to gh-pages, regenerates admin/catalog.json, commits it when files were added, removed or renamed, and requests a Pages build.' },
  '.gitignore': { description: 'Ignored paths: node_modules, MarsScape local data and output, Vercel state, local env files and art-validation scratch.' },
  '.nojekyll': { description: 'Tells GitHub Pages to serve files as-is, without Jekyll processing.' },
  '404.html': { description: 'Not-found page for every unknown path on mixmash.games.' },
  'AGENTS.md': { title: 'Agent rules', description: 'Rules for agents working in this repo: the one-string status naming format and how the admin index stays current and public-safe.' },
  'CNAME': { description: 'GitHub Pages custom-domain binding for mixmash.games.' },
  'LICENSE': { description: 'Repository license.' },
  'brand.html': { description: 'MIXMASH brand guide: Mainstage Neons colour tokens, type, components and voice.' },
  'favicon.svg': { description: 'Studio favicon used by every route.' },
  'manifest.webmanifest': { description: 'PWA manifest: name, icons, theme colours and start URL.' },
  'offline.html': { description: 'Offline fallback page the service worker serves when a navigation fails.' },
  'package-lock.json': { description: 'Locked dependency tree for npm ci.' },
  'package.json': { description: 'npm scripts for every unit test, smoke rail, art gate, simulator and this index; Playwright is the only dependency.' },
  'progress.md': { title: 'Studio progress log', description: 'Session log for hub-level work: the public roster and arena count correction, the landing polish and this admin index.' },
  'robots.txt': { description: 'Crawler rules and the sitemap pointer.' },
  'sitemap.xml': { description: 'Public URL list for search engines. The admin index and unlisted routes are deliberately absent.' },
  'vercel.json': { description: 'Vercel configuration for the MarsScape authority project: the www redirect and per-function time limits.' },
  'assets/og-card.png': { description: '1200 × 630 social sharing card for the studio pages.' },
  'assets/previews/empires.jpg': preview('EMPIRES'),
  'assets/previews/garden.jpg': preview('Garden OS'),
  'assets/previews/mars.jpg': preview('MarsScape'),
  'assets/previews/mixmash.jpg': preview('MIXMASH'),
  'assets/previews/pitch.jpg': preview('PITCH RIOT'),
  'src/kit/save.js': { description: 'MixKit save codes: encodes and decodes portable save strings that games can share.' },
  'test/kit-save.test.mjs': { description: 'Unit tests for MixKit save-code encoding, decoding and corrupt-input handling.' },
  'test/landing-smoke.mjs': { description: 'Playwright rail for the landing page at 320 to 1440 px: keyboard order, focus, reduced motion, hit targets, image budgets and contrast (smoke:landing).' },
  'test/static-server.mjs': { description: 'Shared static host, Chromium launch options and page-failure tracking used by every Playwright rail.' },

  // MIXMASH
  'play/core.js': { description: 'Shared browser and Node core (MixmashCore): seeds, share-link validation, CPU levels and active-match snapshot validation.' },
  'play/fighter-data.js': { description: 'Canonical fighter catalog (MixmashFighterData). Public roster counts are tested against it.' },
  'play/stage-data.js': { description: 'Canonical stage catalog (MixmashStageData). Public arena counts are tested against it.' },
  'play/input-data.js': { description: 'Default keyboard binding tables for both players.' },
  'play/mode-rules.js': { description: 'Mode rules module: Platform Rush and Quick Fight defaults.' },
  'play/snapshot-data.js': { description: 'Storage keys and the active-match snapshot schema.' },
  'ROADMAP.md': { description: 'Production roadmap for the /play/ fighter: decision gates D1 to D4 and upgrade slices P0 to P8, each with scope, status and verification.' },
  'test/combat.test.js': { description: 'Unit tests for the canonical knockback math in src/combat.js, including degenerate and NaN inputs.' },
  'play/progress.md': { title: 'MIXMASH progress log', description: 'Roadmap slices P0 to P8: controls, Training Lab, Platform Rush, the Encore pack, local progression, share links, async ghosts and modularisation.' },
  'test/play-core.test.mjs': { description: 'Unit tests for MixmashCore, loaded the way the browser loads it.' },
  'test/play-catalog.test.mjs': { description: 'Unit tests for the fighter and stage catalog modules.' },
  'test/play-system-modules.test.mjs': { description: 'Unit tests for the extracted input, mode-rules and snapshot modules.' },
  'test/play-resume-smoke.mjs': { description: 'Playwright rail for /play/: resume, snapshots, Platform Rush, profile and share links (smoke:play).' },

  // MarsScape
  'api/[...path].mjs': vercelFn('every other /api/ route', 'the catch-all.'),
  'api/health.mjs': vercelFn('GET /api/health', 'the authority API\'s liveness probe.'),
  'api/sessions.mjs': vercelFn('/api/sessions', 'creates server-authoritative sessions.'),
  'api/sessions/[sessionId].mjs': vercelFn('/api/sessions/:id', 'reads one session\'s state.'),
  'api/sessions/[sessionId]/commands.mjs': vercelFn('/api/sessions/:id/commands', 'applies gameplay commands such as gather, build, smelt, craft, research and startStorm.'),
  'mars/docs/ART_AUDIT.md': { description: 'Audit of every runtime sprite map and renderer surface, classifying each as fallback, reference or production art against the DEC-79 gates.' },
  'mars/docs/ART_DIRECTION.md': { description: 'The MarsScape art bible: renderer-native isometric pixel art, palette, lighting, states, animation and export rules, bound to the render contract.' },
  'mars/art-spec.css': { description: 'Styles for the render-contract proof page.' },
  'mars/art-spec.js': { description: 'Script for the render-contract proof page: projection, footprints and every cached sprite map.' },
  'mars/art/golden-scene.json': { description: 'The eight-beat golden-scene review script: terrain, beats and review checks.' },
  'mars/art/golden-slice.json': { description: 'DEC-79 golden-slice asset list, lighting profiles and export and source roots.' },
  'mars/art/reports/art-validation.json': { description: 'Strict machine report for the current commissioned-art state. CI fails if it drifts.' },
  'mars/art/reports/artist-test-approval.json': { description: 'Fail-closed paid-test approval report (four assets, eight exports). CI fails if it drifts.' },
  'mars/art/reports/golden-approval.json': { description: 'Fail-closed full-golden approval report (26 assets, 108 exports). CI fails if it drifts.' },
  'mars/art/reports/golden-contact-sheet.html': { description: 'Generated contact sheet of every golden-slice asset slot. CI fails if it drifts.' },
  'mars/art/validate-assets.mjs': { description: 'DEC-79 asset validator: PNG and layered-source integrity, runtime index generation, strict approval reports and the contact sheet (the art:* scripts).' },
  'mars/art/visual-regression.mjs': { description: 'Playwright visual evidence for the game, fallback, contract, contact sheet and golden scene (art:visual).' },
  'mars/assets/commissioned/index.json': { description: 'Generated runtime index of valid commissioned PNGs (art:index). The client loads commissioned art only through this file.' },
  'mars/assets/manifest.json': { description: 'Asset preload manifest and sprite contract for terrain and settlement art.' },
  'mars/assets/mars-terrain.svg': { description: 'Terrain artwork used by the MarsScape client.' },
  'mars/commissioned-art.mjs': { description: 'Commissioned-art runtime: fetches, SHA-256 verifies and caches indexed PNGs, falling back to code-owned and procedural art.' },
  'mars/docs/balance-baseline.json': { description: 'Machine-readable resource-rate baseline the simulator compares against.' },
  'mars/game.js': { description: 'Canvas isometric client: board rendering, panels, the authority API client and the signed offline mode.' },
  'mars/golden-scene.css': { description: 'Styles for the golden-scene review surface.' },
  'mars/golden-scene.js': { description: 'Golden-scene review surface: beat playback, condition ledger and the human approval receipt.' },
  'mars/package.json': { description: 'Package manifest for running the MarsScape authority server on its own.' },
  'mars/parity/baseline/PROVENANCE.json': { description: 'Provenance and checksums for the frozen MarsScape gameplay baseline, a preservation artifact.' },
  'mars/parity/mapping.json': { description: 'Curated mapping of baseline behaviours and save fields to their port status; input to the parity ledger.' },
  'mars/progress.md': { title: 'MarsScape progress log', description: 'Session log for the authority rebuild, audits, the render contract and the DEC-79 art pipeline.' },
  'mars/server.mjs': { description: 'Node authority server (SQLite locally) and the shared request handler the Vercel functions call: sessions, commands, request limits and write locks.' },
  'mars/sim/baseline.mjs': { description: 'Compares simulated resource rates with the committed balance baseline.' },
  'mars/sprite-canvas.mjs': { description: 'Rasterises sprite maps into cached bitmaps for the canvas renderer.' },
  'mars/styles.css': { description: 'Styles for the MarsScape client.' },
  'mars/test-api.mjs': { description: 'Authority API tests: sessions, commands, the trust model and request limits.' },
  'mars/test-art-assets.mjs': { description: 'Asset validator tests: PNG integrity, layered sources, symlink containment, reports and index parity.' },
  'mars/test-commissioned-art.mjs': { description: 'Commissioned-art runtime tests: hash verification, decoding, fallback and failure suppression.' },
  'mars/test-engine.mjs': { description: 'Engine rule tests: gathering, building, smelting, crafting, research, storms and gear stats.' },
  'mars/test-golden-scene.mjs': { description: 'Golden-scene ledger, receipt and review-surface tests.' },
  'mars/test-legacy-import.mjs': { description: 'Tests for importing legacy marsscape_v1 saves.' },
  'mars/test-render-contract.mjs': { description: 'Render contract geometry, footprint and asset-id tests.' },
  'mars/test-sim.mjs': { description: 'Balance baseline comparison tests.' },
  'mars/test-sprites.mjs': { description: 'Sprite registry tests.' },
  'mars/test-vercel-handler.mjs': { description: 'Vercel function handler tests against Blob-style storage.' },

  // Front of House
  'front-of-house/README.md': { description: 'Project overview: what the game is, where each document lives, how to run the engine tests and simulator, and how the name was chosen.' },
  'front-of-house/docs/ART_DIRECTION.md': { description: 'Art direction: the look, palette roles, type, the four career tiers and the conflicts to settle before any sprite work.' },
  'front-of-house/docs/GDD.md': { description: 'The canonical game design: career ladder, core loop, systems and the first playable, merged from both early drafts.' },
  'front-of-house/docs/SAVE_FORMAT.md': { description: 'Save schema (the player\'s choices and the seed, not computed results), save codes and the version 1 to version 2 migration.' },
  'front-of-house/progress.md': { title: 'Front of House progress log', description: 'Phase-by-phase session log from pre-production to the Lot career, with review fixes and the open sign-off TODO.' },
  'front-of-house/styles.css': { description: 'Styles for the Lot Night client.' },
  'front-of-house/test-engine.mjs': { description: 'Engine tests for the rules, actions, settlement, saves and migrations, including the worked example.' },
  'front-of-house/test/fixtures/save-v1.json': { description: 'Frozen schema version 1 save, kept to prove migration to the current format.' },
  'front-of-house/test/fixtures/save-v2.json': { description: 'Frozen schema version 2 save at the Lot scale, used by the engine tests.' },
  'test/front-of-house-smoke.mjs': { description: 'Playwright rail for Lot Night end to end: reload, save codes, keyboard building, reduced motion, phone width and contrast (smoke:front-of-house).' },

  // EMPIRES
  'empires/assets/aoe2-clone.js': { description: 'Emscripten loader generated by aoe2-clone\'s tools/build_web.sh. Replace it with a fresh build; never edit it by hand.' },
  'empires/assets/aoe2-clone.wasm': { description: 'Compiled WebAssembly game binary from the aoe2-clone C++/SDL source. Replace it only with a fresh build.' },
  'empires/assets/shell.js': { description: 'Page shell for the WASM build: byte-level download progress, Module setup and the start button that sends a synthetic Space key.' },
  'empires/progress.md': { title: 'EMPIRES progress log', description: 'Session log for restoring /empires/ as Age of Dave and replacing the prototype with the real aoe2-clone WASM build.' },

  // Garden OS
  'docs/rfc-004-garden-os-engine-specification.md': { description: 'RFC for a shared Garden OS engine: the specification, an architectural audit and the verified migration baseline.' },

  // Zelda2Mario  // Zelda2Mario
  'test/zelda2mario-smoke.mjs': { description: 'Playwright rail for the status ledger: scope, privacy, mobile and ultrawide layout, themes, keyboard tabs, filters and printing (smoke:zelda2mario).' },

  // PlayCards
  'playcards/src/playcards/PlayCards.java': { description: 'Entry point: opens the Swing table, or runs console Blackjack with --console and the Hold\'em simulation with --holdem [seed].' },
  'playcards/test/playcards/BlackjackGameTest.java': { description: 'Dependency-free tests for the BlackjackGame state engine: dealing, busts, wins, pushes and chip transfers.' },
  'playcards/test/playcards/BlackjackRulesTest.java': { description: 'Dependency-free Blackjack rules tests: ace scoring, natural blackjacks, pushes and input validation.' },
  'playcards/test/playcards/GameSnapshotTest.java': { description: 'Dependency-free tests for the immutable game snapshot through each player action and game over.' },
  'playcards/test/playcards/SwingPresentationTest.java': { description: 'Dependency-free headless Swing checks: table rendering, legal actions, card faces and player names.' },
  'playcards/Sprint-Board-Graphics-UI.md': { description: 'Sprint board for turning the functional Swing table into a clearer, more polished Blackjack experience.' },
  'playcards/.gitignore': { description: 'Ignores PlayCards build output.' },
  'playcards/build.xml': { description: 'Ant build file from the NetBeans project: clean, test and jar targets.' },
  'playcards/manifest.mf': { description: 'JAR manifest naming the main class.' },
  'playcards/nbproject/build-impl.xml': { description: 'NetBeans-generated Ant build implementation. Edit build.xml instead.' },
  'playcards/nbproject/genfiles.properties': { description: 'NetBeans-generated checksums for the build files.' },
  'playcards/nbproject/project.properties': { description: 'NetBeans project properties: source and test roots, main class and JDK level.' },
  'playcards/nbproject/project.xml': { description: 'NetBeans project descriptor.' },

  // Admin index
  'admin/catalog.json': { description: 'Generated by npm run admin:index; this page renders it. Do not edit it by hand.' },
  'admin/styles.css': { description: 'Styles for this admin index: light and dark themes, the project rail and the viewport-locked shell.' },
};
