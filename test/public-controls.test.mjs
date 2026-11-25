// Public control tables must match the shipped default binds.
//
// play/input-data.js is the source of truth for fighter keys. home.html (the
// hub "Game guide") and docs/PLAYER_GUIDE.md both drifted from those defaults
// once already. This test binds the listed keys back to the registry so a
// bind change fails here instead of shipping a stale guide.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');

const CODE_LABELS = {
  KeyA: ['A'],
  KeyD: ['D'],
  KeyW: ['W'],
  KeyS: ['S'],
  KeyJ: ['J'],
  KeyK: ['K'],
  KeyL: ['L'],
  Space: ['Space'],
  ArrowLeft: ['←', 'Left'],
  ArrowRight: ['→', 'Right'],
  ArrowUp: ['↑'],
  ArrowDown: ['↓'],
  Numpad1: ['Num 1', 'Numpad 1'],
  Numpad2: ['Num 2', 'Numpad 2'],
  Numpad3: ['Num 3', 'Numpad 3'],
};

const STALE_HOME_STRINGS = [
  'Festival Main Stage',
  'Underground Club',
  'Digital Arena',
  'Sunset Set',
  'Zoner / Control',
];

async function loadInputData() {
  const sandbox = { globalThis: null };
  sandbox.globalThis = sandbox;
  const source = await readFile(path.join(ROOT, 'play/input-data.js'), 'utf8');
  vm.runInNewContext(source, sandbox, { filename: 'play/input-data.js' });
  return sandbox.MixmashInputData;
}

function labelsFor(code) {
  const labels = CODE_LABELS[code];
  assert.ok(labels, `no display labels registered for ${code}`);
  return labels;
}

function section(source, startRe, endRe) {
  const start = source.search(startRe);
  assert.ok(start >= 0, `missing section ${startRe}`);
  const from = source.slice(start);
  const firstLine = from.indexOf('\n');
  const rest = firstLine === -1 ? '' : from.slice(firstLine + 1);
  const end = rest.search(endRe);
  return end === -1 ? from : from.slice(0, firstLine + 1 + end);
}

function assertLabelPresent(text, code, where) {
  const missing = labelsFor(code).filter((label) => !text.includes(label));
  assert.ok(
    missing.length < labelsFor(code).length,
    `${where} is missing a label for ${code} (tried ${labelsFor(code).join(', ')})`,
  );
}

test('home.html and the player guide list the shipped default binds', async () => {
  const input = await loadInputData();
  const home = await readFile(path.join(ROOT, 'home.html'), 'utf8');
  const guide = await readFile(path.join(ROOT, 'docs/PLAYER_GUIDE.md'), 'utf8');

  const p1Binds = input.DEFAULT_P1_BINDS;
  const p2Binds = input.DEFAULT_P2_BINDS;
  const homeControls = section(home, /<section id="controls">/, /<section id="play">/);
  const homeHints = section(home, /<div class="game-hints">/, /<\/section>/);
  const guideControls = section(guide, /^## Controls/m, /^## Shortcuts/m);
  const guideShortcuts = section(guide, /^## Shortcuts/m, /^## /m);

  for (const [action, code] of Object.entries(p1Binds)) {
    assertLabelPresent(homeControls, code, `home.html controls (P1 ${action})`);
    assertLabelPresent(guideControls, code, `PLAYER_GUIDE.md controls (P1 ${action})`);
  }
  for (const [action, code] of Object.entries(p2Binds)) {
    assertLabelPresent(homeControls, code, `home.html controls (P2 ${action})`);
    assertLabelPresent(guideControls, code, `PLAYER_GUIDE.md controls (P2 ${action})`);
  }

  // Special is still a grounded grab; both surfaces should say so.
  assert.match(homeControls, /Special \(grab\)/);
  assert.match(guideControls, /Special \(grab\)/);

  // Drop In hints must not still call F or period an attack key.
  assert.match(homeHints, />J</);
  assert.match(homeHints, />Space</);
  assert.match(homeHints, />\?</);
  assert.doesNotMatch(homeHints, />F</);
  assert.doesNotMatch(homeHints, />\.</);

  // Shortcuts added with the #194 set must appear in both guides.
  for (const key of ['P', 'Esc', '?', 'H', 'M', 'F', 'O', 'Q', 'R']) {
    assert.ok(homeControls.includes(`>${key}<`) || homeControls.includes(`\`${key}\``), `home.html shortcuts mention ${key}`);
    assert.ok(guideShortcuts.includes(`\`${key}\``), `PLAYER_GUIDE.md shortcuts mention ${key}`);
  }
  assert.match(homeControls, /Platform Rush/);
  assert.match(guide, /## Platform Rush/);

  for (const stale of STALE_HOME_STRINGS) {
    assert.ok(!home.includes(stale), `home.html still has stale copy: ${stale}`);
  }
});
