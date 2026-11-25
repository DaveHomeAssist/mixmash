// Save guard (inspectSave and backupSave in engine.mjs): unreadable saves are classified, never loaded, and backed up
// without replacing an earlier backup (docs/SAVE_FORMAT.md, Unreadable saves).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { backupSave, BACKUP_SUFFIX, createGame, inspectSave, migrateSave, normalizeState } from './engine.mjs';
import * as D from './data.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./test/fixtures/${name}`, import.meta.url), 'utf8'));
const options = (overrides = {}) => ({ namespace: D.SAVE_NAMESPACE, schema: D.SCHEMA_VERSION, migrate: migrateSave, normalize: normalizeState, seed: 7, ...overrides });
const envelope = (state, v = D.SCHEMA_VERSION, ns = D.SAVE_NAMESPACE) => JSON.stringify({ ns, v, savedAt: '2026-11-25T00:00:00.000Z', state });

function memoryStorage(initial = {}, { failWrites = false } = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { if (failWrites) throw new Error('QuotaExceededError'); data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
}

test('nothing stored is empty', () => {
  for (const text of [null, undefined, '']) assert.equal(inspectSave(text, options()).status, 'empty');
});

test('a current save loads as ok, unchanged by the guard', () => {
  const game = createGame(42);
  game.cash = 1234;
  const result = inspectSave(envelope(game), options());
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.state, normalizeState(game, 7));
});

test('a version 1 save still converts and loads', () => {
  const v1 = fixture('save-v1.json');
  const state = v1.state ?? v1;
  const result = inspectSave(envelope(state, 1), options());
  assert.equal(result.status, 'ok');
  assert.equal(result.state.schema, D.SCHEMA_VERSION);
});

test('a save from a newer version is reported as newer, by schema or by envelope', () => {
  const newer = { ...createGame(1), schema: D.SCHEMA_VERSION + 1, cash: 99999 };
  assert.equal(inspectSave(envelope(newer, D.SCHEMA_VERSION + 1), options()).status, 'newer');
  assert.equal(inspectSave(envelope(newer, D.SCHEMA_VERSION), options()).status, 'newer');
  assert.equal(inspectSave(envelope(createGame(1), D.SCHEMA_VERSION + 1), options()).status, 'newer');
  assert.equal(inspectSave(JSON.stringify(newer), options()).status, 'newer', 'legacy unwrapped state');
});

test('damaged saves are corrupt, never empty', () => {
  for (const text of ['{not json', '"text"', '[1,2]', 'null', envelope({ cash: 5 }), envelope({ schema: 'two' }), envelope({ schema: 0 }), envelope(createGame(1), 2, 'other_game')]) {
    assert.equal(inspectSave(text, options()).status, 'corrupt', text.slice(0, 40));
  }
});

test('a migration that throws or stops short is failed', () => {
  const v1 = { ...createGame(1), schema: 1 };
  assert.equal(inspectSave(envelope(v1, 1), options({ migrate: () => { throw new Error('boom'); } })).status, 'failed');
  assert.equal(inspectSave(envelope(v1, 1), options({ migrate: (s) => s })).status, 'failed');
});

test('normalizeState throwing is failed, not a crash', () => {
  const result = inspectSave(envelope(createGame(3)), options({ normalize: () => { throw new TypeError('bad venue'); } }));
  assert.equal(result.status, 'failed');
  assert.match(result.reason, /bad venue/);
});

test('backups keep the raw text and never replace an earlier, different backup', () => {
  const storage = memoryStorage();
  const key = D.SAVE_NAMESPACE + BACKUP_SUFFIX;
  assert.equal(backupSave(storage, D.SAVE_NAMESPACE, 'first', 1), key);
  assert.equal(storage.getItem(key), 'first');
  assert.equal(backupSave(storage, D.SAVE_NAMESPACE, 'first', 2), key, 'the same text reuses its backup');
  assert.equal(backupSave(storage, D.SAVE_NAMESPACE, 'second', 3), `${key}.3`);
  assert.equal(storage.getItem(key), 'first');
  assert.equal(storage.getItem(`${key}.3`), 'second');
  assert.equal(backupSave(storage, D.SAVE_NAMESPACE, 'second', 3), `${key}.3`);
});

test('a refused backup reports null and writes nothing', () => {
  const storage = memoryStorage({}, { failWrites: true });
  assert.equal(backupSave(storage, D.SAVE_NAMESPACE, 'text'), null);
  assert.equal(backupSave(null, D.SAVE_NAMESPACE, 'text'), null);
  assert.equal(storage.data.size, 0);
});
test('a damaged envelope is corrupt, never legacy raw state (same rule as the kit loadResult)', () => {
  const state = createGame(4);
  assert.equal(inspectSave(JSON.stringify({ savedAt: '2026-11-25T00:00:00.000Z', ...state }), options()).status, 'corrupt');
  assert.equal(inspectSave(JSON.stringify({ v: D.SCHEMA_VERSION, state, schema: 2 }), options()).status, 'corrupt');
  assert.equal(inspectSave(JSON.stringify({ ns: D.SAVE_NAMESPACE, v: D.SCHEMA_VERSION }), options()).status, 'corrupt');
  assert.equal(inspectSave(JSON.stringify(state), options()).status, 'ok', 'a raw legacy state still loads');
});
