// Static contract checks on the browser client. game.js cannot be imported under
// node (it touches `document` at module scope), so these read the source. They exist
// because both defects below passed every runtime test while being real regressions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(HERE, 'game.js'), 'utf8');
const html = readFileSync(join(HERE, 'index.html'), 'utf8');
const manifest = readFileSync(join(HERE, 'assets', 'manifest.json'), 'utf8');
const artSpec = readFileSync(join(HERE, 'art-spec.html'), 'utf8');

// Rebuild cleanPendingCommands from source so the real allowlist is exercised.
const start = source.indexOf('const COMMAND_FIELDS');
const end = source.indexOf('function labelCommand');
assert.ok(start > 0 && end > start, 'cleanPendingCommands should still be locatable');
const cleanPendingCommands = new Function(`${source.slice(start, end)}; return cleanPendingCommands;`)();

test('queued offline commands keep every field the authority needs', () => {
  // Review finding 3: the allowlist kept only a few string fields, so an offline
  // `deposit` replayed as BAD_ITEM and `plant` replayed against the wrong plot.
  const queued = [
    { id: 'c1', type: 'deposit', itemId: 'iron_ore', qty: 5 },
    { id: 'c2', type: 'withdraw', itemId: 'glass', qty: 12 },
    { id: 'c3', type: 'plant', plotIndex: 2, cropId: 'soy', useFertilizer: true },
    { id: 'c4', type: 'harvest', plotIndex: 1 },
    { id: 'c5', type: 'treat', plotIndex: 0 },
    { id: 'c6', type: 'overclock', on: false },
    { id: 'c7', type: 'ration', itemId: 'berries' },
    { id: 'c8', type: 'service', buildingId: 'solar' },
  ];
  assert.deepEqual(cleanPendingCommands(queued), queued, 'every payload survives a save/reload round trip');
});

test('plotIndex 0 and overclock-off survive, rather than being dropped as falsy', () => {
  const [treat] = cleanPendingCommands([{ id: 'a', type: 'treat', plotIndex: 0 }]);
  assert.equal(treat.plotIndex, 0);
  const [off] = cleanPendingCommands([{ id: 'b', type: 'overclock', on: false }]);
  assert.equal(off.on, false);
});

test('unknown and malformed command fields are still dropped', () => {
  const [clean] = cleanPendingCommands([
    { id: 'x', type: 'gather', nodeId: 'iron-north', evil: 'drop me', qty: 'not a number' },
  ]);
  assert.deepEqual(clean, { id: 'x', type: 'gather', nodeId: 'iron-north' });
  assert.deepEqual(cleanPendingCommands([{ type: 'gather' }]), [], 'a command with no id is dropped');
});

test('the sprite renderer is actually wired into the shipped client', () => {
  // Review finding 4: sprites.mjs existed and was tested, but nothing in the client
  // imported it — so the presentation work was not delivered to any player.
  assert.match(source, /spriteOrEmoji[^\n]+from '\.\/sprites\.mjs'/, 'client must import the renderer');
  const callSite = source.indexOf('spriteOrEmoji(', source.indexOf('function renderPack'));
  assert.ok(callSite > 0, 'renderPack must actually call it');
});

test('the canvas ImageBitmap pipeline and persisted fallback toggle are shipped', () => {
  assert.match(source, /import \{ SpriteBitmapCache \} from '\.\/sprite-canvas\.mjs'/);
  assert.match(source, /import \{ CommissionedArtCache \} from '\.\/commissioned-art\.mjs'/);
  assert.match(source, /spriteCache\.prime\(spriteIds\(\)\)/, 'all authored sprites prime during boot');
  assert.match(source, /commissionedCache\.loadAndPrime\(\)/, 'validated commissioned exports prime during boot');
  assert.match(html, /assets\/commissioned\/index\.json/, 'the generated commissioned index is preloaded with the game shell');
  assert.match(source, /commissionedCache\.draw\(ctx, 'terrain'/, 'commissioned terrain is in the playable renderer');
  assert.match(source, /commissionedCache\.draw\(ctx, 'resource'/, 'commissioned resources are in the playable renderer');
  assert.match(source, /commissionedCache\.draw\(ctx, 'building'/, 'commissioned buildings are in the playable renderer');
  assert.match(source, /commissionedCache\.draw\(ctx, 'actor', 'astronaut'/, 'commissioned astronaut art is in the playable renderer');
  assert.match(source, /spriteCache\.drawSprite\(ctx, node\.item/, 'nodes use the canvas sprite seam');
  assert.match(source, /spriteCache\.drawSprite\(ctx, 'astro'/, 'the actor uses the feet-anchored sprite seam');
  assert.match(source, /function drawStateTreatment\(/, 'renderer-owned state treatment backs missing state exports');
  assert.match(source, /marsscape\.pixelMode\.v1/, 'the renderer preference has an isolated storage key');
  assert.match(html, /id="pixelModeButton"[^>]+aria-pressed="true"/, 'the renderer toggle is a real control');
  assert.match(source, /\$\{spriteBitmapsReady\}\/\$\{spriteIds\(\)\.length\}/, 'boot telemetry must use the live registry count');
});

test('the unused settlement atlas no longer gates boot', () => {
  assert.doesNotMatch(html, /settlement-atlas/);
  assert.doesNotMatch(manifest, /settlementAtlas|settlement-atlas/);
});

test('the measured render-contract page is a deployable surface', () => {
  assert.match(artSpec, /2:1 dimetric, preserving the shipped board/);
  assert.match(artSpec, /id="specCanvas"/);
  assert.match(artSpec, /id="spriteCanvas"/);
  assert.match(artSpec, /src="\.\/art-spec\.js"/);
  assert.match(artSpec, /Render contract v3 · DEC-79 locked/);
  assert.match(artSpec, /id="spriteCanvas" width="940" height="540"/, 'the full 33-map proof must not be clipped');
});

test('the v3 storage keys are still read so a key bump cannot orphan a colony', () => {
  // Review finding 1: bumping both keys to v4 with no fallback abandoned existing
  // progress and minted a fresh session id.
  assert.match(source, /LEGACY_STORAGE_KEY = 'marsscape\.session\.v3'/);
  assert.match(source, /LEGACY_SESSION_KEY = 'marsscape\.sessionId\.v3'/);
  assert.ok(source.includes('localStorage.getItem(LEGACY_SESSION_KEY)'), 'the v3 session id must be adopted');
  assert.ok(source.includes('readEnvelopeAt(LEGACY_STORAGE_KEY)'), 'the v3 envelope must be read');
});

test('the client renders the state-dependent postgame nodes, not the static array', () => {
  // Codex review: renderMap, the canvas draw and the drone target list all iterated
  // the static NODES array, so the Expedition Beacon was never rendered — Exploration
  // could not be trained, and rich veins could not be discovered or assigned.
  assert.match(source, /function visibleNodes\(\)/, 'a dynamic node source must exist');
  assert.ok(source.includes('EXPEDITION_NODE'), 'the postgame beacon must be reachable client-side');

  // No render path may still filter the static array directly.
  const staticUses = [...source.matchAll(/\bNODES\.(filter|find)\(/g)];
  assert.deepEqual(staticUses.map((m) => m[0]), [],
    'every node lookup should go through visibleNodes()');
});
