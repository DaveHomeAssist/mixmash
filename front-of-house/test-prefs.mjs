// Device preferences (prefs.mjs): load, validation, size cap, clear and the legacy key fold.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from './prefs.mjs';
import * as D from './data.mjs';

function memoryStorage(initial = {}, { failWrites = false } = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { if (failWrites) throw new Error('QuotaExceededError'); data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
}

test('a fresh browser loads the defaults and writes nothing', () => {
  const storage = memoryStorage();
  const prefs = P.loadPrefs(storage);
  assert.deepEqual(prefs, P.defaultPrefs());
  assert.equal(prefs.v, P.PREFS_VERSION);
  assert.equal(prefs.view.renderer, null, 'the implicit 3D default is not an explicit choice');
  assert.equal(storage.data.size, 0);
  assert.deepEqual(P.loadPrefs(null), P.defaultPrefs(), 'no storage at all still plays');
  assert.deepEqual(P.loadPrefs({ getItem() { throw new Error('blocked'); } }), P.defaultPrefs());
});

test('the old renderer and theme keys fold into view on the first load', () => {
  const storage = memoryStorage({ [P.LEGACY_KEYS.renderer]: '2d', [P.LEGACY_KEYS.theme]: 'dark' });
  const prefs = P.loadPrefs(storage);
  assert.equal(prefs.view.renderer, '2d');
  assert.equal(prefs.view.theme, 'dark');
  assert.equal(P.savePrefs(storage, prefs), true);
  assert.equal(JSON.parse(storage.getItem(P.PREFS_KEY)).view.renderer, '2d');
  // The legacy keys keep being written for one release, so a rollback keeps the view.
  assert.equal(storage.getItem(P.LEGACY_KEYS.renderer), '2d');
  assert.equal(storage.getItem(P.LEGACY_KEYS.theme), 'dark');
  // Once the new key exists it wins over a stale legacy value.
  storage.setItem(P.LEGACY_KEYS.renderer, '3d');
  assert.equal(P.loadPrefs(storage).view.renderer, '2d');
  // Unknown legacy values are ignored.
  assert.equal(P.loadPrefs(memoryStorage({ [P.LEGACY_KEYS.renderer]: 'vr', [P.LEGACY_KEYS.theme]: 'neon' })).view.renderer, null);
});

test('validation keeps only the content tables own ids and valid values', () => {
  const raw = {
    v: 1, suggest: false,
    view: { renderer: '3d', theme: 'sepia' },
    hints: { legalTiles: 2, rendererSwitch: 99, pan: 1 },
    phone: { tabs: { build: 'Tools', show: 'Problem', promote: 'x'.repeat(41) } },
    rooms: { lot: { lastTool: 'exit', sightlines: false }, constructor: { lastTool: 'exit' }, club: { lastTool: 'laser' } },
    acts: {
      'sodium-arcade': { deal: 'guarantee', price: 18, ads: { flyers: 100, social: 50, radio: 0 } },
      constructor: { deal: 'door' },
      __proto__: { deal: 'door' },
      'salt-ledger': { deal: 'barter', price: 9, ads: { flyers: 30 } },
      'tin-relay': { price: 33, ads: { flyers: 25, tv: 50 } },
    },
    incidents: { rain: 'ponchos', 'pa-dropout': 'shout', toString: 'wait' },
    extra: { seed: 123, cash: 5000 },
  };
  const prefs = P.normalizePrefs(JSON.parse(JSON.stringify(raw)));
  assert.equal(prefs.suggest, false);
  assert.deepEqual(prefs.view, { renderer: '3d', theme: 'light' });
  assert.deepEqual(prefs.hints, { legalTiles: 2, rendererSwitch: 0 });
  assert.deepEqual(prefs.phone.tabs, { build: 'Tools' });
  assert.deepEqual(prefs.rooms, { lot: { lastTool: 'exit', sightlines: false } });
  assert.deepEqual(Object.keys(prefs.acts), ['sodium-arcade', 'tin-relay']);
  assert.deepEqual(prefs.acts['tin-relay'], { price: 33, ads: { flyers: 25, social: 0, radio: 0 } }, 'an unknown ad channel is ignored');
  assert.equal(P.normalizePrefs({ v: 1, acts: { 'tin-relay': { ads: { flyers: 30 } } } }).acts['tin-relay'], undefined, 'off-step ad spend is dropped');
  assert.deepEqual(prefs.incidents, { rain: 'ponchos' });
  assert.equal('extra' in prefs, false, 'no game state is carried');
  assert.deepEqual(P.normalizePrefs({ ...raw, v: 2 }), P.defaultPrefs(), 'an unknown version starts fresh');
  for (const junk of [null, 7, 'x', [], { v: '1' }]) assert.deepEqual(P.normalizePrefs(junk), P.defaultPrefs());
});

test('damaged or oversized stored text is discarded', () => {
  assert.deepEqual(P.loadPrefs(memoryStorage({ [P.PREFS_KEY]: '{not json' })), P.defaultPrefs());
  const huge = JSON.stringify({ v: 1, suggest: false, junk: 'x'.repeat(P.PREFS_HARD_LIMIT) });
  assert.equal(P.loadPrefs(memoryStorage({ [P.PREFS_KEY]: huge })).suggest, true);
});

test('the stored record stays under the size bound, dropping the oldest habits first', () => {
  let prefs = P.setView(P.defaultPrefs(), { renderer: '2d', theme: 'dark' });
  const artists = Object.keys(D.ARTISTS);
  for (const id of artists) prefs = P.rememberAct(prefs, id, { deal: 'guarantee', price: 39, ads: { flyers: 975, social: 975, radio: 975 } });
  for (const id of Object.keys(D.INCIDENTS)) prefs = P.rememberIncident(prefs, id, D.INCIDENTS[id].responses[0].id);
  assert.ok(Object.keys(prefs.acts).length <= P.MAX_ACTS);
  const text = P.serializePrefs(prefs);
  assert.ok(text.length <= P.PREFS_SOFT_LIMIT, `${text.length} bytes`);
  const stored = JSON.parse(text);
  assert.deepEqual(stored.view, { renderer: '2d', theme: 'dark' }, 'view choices are never trimmed');
  const kept = Object.keys(stored.acts);
  assert.equal(kept.at(-1), artists.at(-1), 'the most recent act is kept');
  // Least recently used order: remembering an act again moves it to the end.
  const again = P.rememberAct(prefs, kept[0], { deal: 'door' });
  assert.equal(Object.keys(again.acts).at(-1), kept[0]);
  assert.equal(again.acts[kept[0]].deal, 'door');
  assert.equal(again.acts[kept[0]].price, 39, 'a partial update keeps the other remembered values');
});

test('updates are pure, and turning suggestions off forgets habits but not the view', () => {
  const base = P.setView(P.defaultPrefs(), { theme: 'dark' });
  const before = JSON.stringify(base);
  const withAct = P.rememberAct(base, 'sodium-arcade', { deal: 'door', price: 15, ads: { flyers: 25, social: 0, radio: 0 } });
  const withIncident = P.rememberIncident(withAct, 'rain', 'canopy');
  const withRoom = P.rememberRoom(withIncident, 'lot', { lastTool: 'gate' });
  const withTab = P.rememberTab(withRoom, 'build', 'Tools');
  const hinted = P.bumpHint(P.bumpHint(P.bumpHint(P.bumpHint(withTab, 'legalTiles'), 'legalTiles'), 'legalTiles'), 'legalTiles');
  assert.equal(JSON.stringify(base), before);
  assert.equal(hinted.hints.legalTiles, P.HINT_CAP);
  assert.equal(P.rememberIncident(base, 'rain', 'not-a-response').incidents.rain, undefined);
  assert.equal(P.rememberTab(base, 'show', 'Problem').phone.tabs.show, undefined, 'Show tabs are never restored');
  const off = P.setSuggest(hinted, false);
  assert.equal(off.suggest, false);
  assert.deepEqual([off.acts, off.incidents, off.rooms], [{}, {}, {}]);
  assert.equal(off.view.theme, 'dark');
  assert.deepEqual(P.rememberAct(off, 'sodium-arcade', { deal: 'door' }).acts, {}, 'nothing is remembered while off');
  assert.deepEqual(P.rememberIncident(off, 'rain', 'canopy').incidents, {});
});

test('clear removes the key and the legacy keys, and leaves the career save alone', () => {
  const storage = memoryStorage({ [D.SAVE_NAMESPACE]: '{"ns":"front_of_house_v1"}' });
  P.savePrefs(storage, P.setView(P.defaultPrefs(), { renderer: '3d', theme: 'dark' }));
  assert.ok(storage.getItem(P.PREFS_KEY));
  assert.equal(P.clearPrefs(storage), true);
  for (const key of [P.PREFS_KEY, ...Object.values(P.LEGACY_KEYS)]) assert.equal(storage.getItem(key), null, key);
  assert.equal(storage.getItem(D.SAVE_NAMESPACE), '{"ns":"front_of_house_v1"}');
  assert.deepEqual(P.loadPrefs(storage), P.defaultPrefs());
});

test('a refused write reports false and changes nothing', () => {
  const storage = memoryStorage({}, { failWrites: true });
  assert.equal(P.savePrefs(storage, P.defaultPrefs()), false);
  assert.equal(P.savePrefs(null, P.defaultPrefs()), false);
  assert.equal(storage.data.size, 0);
});

test('the key is separate from the save namespace and the stored text holds no free text or time', () => {
  assert.notEqual(P.PREFS_KEY, D.SAVE_NAMESPACE);
  const prefs = P.rememberAct(P.defaultPrefs(), 'sodium-arcade', { deal: 'guarantee', price: 20, ads: { flyers: 0, social: 0, radio: 0 } });
  const text = P.serializePrefs(prefs);
  assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}|seed|cash|history/);
});
