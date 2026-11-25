import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

async function loadKit() {
  const source = await readFile(new URL('../src/kit/save.js', import.meta.url), 'utf8');
  const sandbox = { Math, Number, String, RegExp, Object, Array, JSON, Date, Buffer, globalThis: null };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'src/kit/save.js' });
  return sandbox.MixKitSave;
}

test('save/load roundtrip wraps state in a namespaced envelope', async () => {
  const kit = await loadKit();
  const storage = fakeStorage();
  const store = kit.createSaveStore('mixmash_opts', { version: 2, storage });
  assert.equal(store.save({ volume: 0.5, musicOn: false }), true);
  const env = JSON.parse(storage.getItem('mixmash_opts'));
  assert.equal(env.ns, 'mixmash_opts');
  assert.equal(env.v, 2);
  assert.deepEqual(store.load(), { volume: 0.5, musicOn: false });
});

test('legacy raw JSON (pre-envelope) still loads', async () => {
  const kit = await loadKit();
  const storage = fakeStorage();
  storage.setItem('mixmash_opts', JSON.stringify({ volume: 1, hazardsOn: true }));
  const store = kit.createSaveStore('mixmash_opts', { storage });
  assert.deepEqual(store.load(), { volume: 1, hazardsOn: true });
});

test('export/import code roundtrip survives unicode', async () => {
  const kit = await loadKit();
  const a = fakeStorage();
  const b = fakeStorage();
  const src = kit.createSaveStore('marsscape_v1', { storage: a });
  src.save({ colony: 'Aurora Basé — 火星' });
  const code = src.exportCode();
  assert.ok(code);
  const dst = kit.createSaveStore('marsscape_v1', { storage: b });
  assert.deepEqual(dst.importCode(code), { colony: 'Aurora Basé — 火星' });
  assert.deepEqual(dst.load(), { colony: 'Aurora Basé — 火星' });
});

test('import rejects wrong namespace and garbage codes', async () => {
  const kit = await loadKit();
  const a = fakeStorage();
  const other = kit.createSaveStore('empires_v1', { storage: a });
  other.save({ gold: 9 });
  const code = other.exportCode();
  const store = kit.createSaveStore('mixmash_opts', { storage: fakeStorage() });
  assert.equal(store.importCode(code), null);
  assert.equal(store.importCode('not-base64!!'), null);
  assert.equal(store.load(), null);
});

test('migrate runs when stored version is older', async () => {
  const kit = await loadKit();
  const storage = fakeStorage();
  kit.createSaveStore('g', { version: 1, storage }).save({ hp: 10 });
  const v2 = kit.createSaveStore('g', {
    version: 2, storage,
    migrate: (s, from) => ({ ...s, shield: 0, migratedFrom: from }),
  });
  assert.deepEqual(v2.load(), { hp: 10, shield: 0, migratedFrom: 1 });
});

test('loadResult reports ok for a current envelope', async () => {
  const kit = await loadKit();
  const storage = fakeStorage();
  const store = kit.createSaveStore('g', { version: 2, storage });
  store.save({ gold: 40 });
  const result = store.loadResult();
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.state, { gold: 40 });
  assert.equal(result.version, 2);
  assert.deepEqual(store.load(), { gold: 40 });
});

test('a newer envelope is not returned as current and is not treated as empty', async () => {
  const kit = await loadKit();
  const storage = fakeStorage();
  kit.createSaveStore('g', { version: 3, storage }).save({ gold: 99999 });
  const store = kit.createSaveStore('g', { version: 2, storage });
  const result = store.loadResult();
  assert.equal(result.status, 'newer');
  assert.equal(result.state, null);
  assert.equal(result.version, 3);
  assert.notEqual(result.status, 'empty');
  assert.notEqual(result.status, 'ok');
  assert.equal(storage.getItem('g') !== null, true, 'the newer envelope stays in storage');
  assert.throws(() => store.load(), (err) => err && err.status === 'newer' && err.name === 'MixKitSaveError');
  // Callers that only check load() in a try/catch must still not see null.
  let caught = null;
  try { store.load(); } catch (e) { caught = e; }
  assert.ok(caught);
  assert.notEqual(caught, null);
  assert.notEqual(store.loadResult().status, 'empty');
});

test('corrupt JSON is a distinct status, not empty', async () => {
  const kit = await loadKit();
  const storage = fakeStorage();
  storage.setItem('g', '{not json');
  const store = kit.createSaveStore('g', { storage });
  const result = store.loadResult();
  assert.equal(result.status, 'corrupt');
  assert.equal(result.state, null);
  assert.notEqual(result.status, 'empty');
  assert.throws(() => store.load(), (err) => err && err.status === 'corrupt');
  assert.equal(storage.getItem('g'), '{not json');
});

test('a throwing migrate is corrupt, not empty, and does not return state', async () => {
  const kit = await loadKit();
  const storage = fakeStorage();
  kit.createSaveStore('g', { version: 1, storage }).save({ hp: 10 });
  const store = kit.createSaveStore('g', {
    version: 2,
    storage,
    migrate: () => { throw new Error('migrate failed'); },
  });
  const result = store.loadResult();
  assert.equal(result.status, 'corrupt');
  assert.equal(result.state, null);
  assert.notEqual(result.status, 'empty');
  assert.throws(() => store.load(), (err) => err && err.status === 'corrupt');
  assert.ok(storage.getItem('g'), 'the original envelope stays in storage');
});

test('legacy raw JSON still loads as ok, but a damaged envelope is not legacy', async () => {
  const kit = await loadKit();
  const storage = fakeStorage();
  storage.setItem('mixmash_opts', JSON.stringify({ volume: 1, hazardsOn: true }));
  const store = kit.createSaveStore('mixmash_opts', { storage });
  const legacy = store.loadResult();
  assert.equal(legacy.status, 'ok');
  assert.equal(legacy.legacy, true);
  assert.deepEqual(legacy.state, { volume: 1, hazardsOn: true });
  assert.deepEqual(store.load(), { volume: 1, hazardsOn: true });

  // Missing state, but marked as an envelope: corrupt, not raw state.
  storage.setItem('mixmash_opts', JSON.stringify({ ns: 'mixmash_opts', v: 1, savedAt: '2026-01-01T00:00:00.000Z' }));
  const damaged = store.loadResult();
  assert.equal(damaged.status, 'corrupt');
  assert.equal(damaged.state, null);
  assert.throws(() => store.load(), (err) => err && err.status === 'corrupt');

  // savedAt alone is enough to refuse the legacy fallback.
  storage.setItem('g', JSON.stringify({ savedAt: '2026-01-01T00:00:00.000Z', hp: 3 }));
  const marked = kit.createSaveStore('g', { storage }).loadResult();
  assert.equal(marked.status, 'corrupt');
});

test('empty storage is the only status that load() reports as null', async () => {
  const kit = await loadKit();
  const store = kit.createSaveStore('g', { storage: fakeStorage() });
  const result = store.loadResult();
  assert.equal(result.status, 'empty');
  assert.equal(result.state, null);
  assert.equal(store.load(), null);
});

test('importCode does not overwrite storage with a newer or corrupt code', async () => {
  const kit = await loadKit();
  const storage = fakeStorage();
  const current = kit.createSaveStore('g', { version: 2, storage });
  current.save({ gold: 10 });
  const newer = kit.createSaveStore('g', { version: 3, storage: fakeStorage() });
  newer.save({ gold: 99 });
  assert.equal(current.importCode(newer.exportCode()), null);
  assert.equal(current.importCodeResult(newer.exportCode()).status, 'newer');
  assert.deepEqual(current.load(), { gold: 10 });
  assert.equal(current.importCode('not-base64!!'), null);
  assert.equal(current.importCodeResult('not-base64!!').status, 'corrupt');
  assert.deepEqual(current.load(), { gold: 10 });
});
