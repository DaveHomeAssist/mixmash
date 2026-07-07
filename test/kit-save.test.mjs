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
