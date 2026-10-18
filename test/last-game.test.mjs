/** assets/last-game.js records {slug, t} for the hub and never throws when storage is blocked. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../assets/last-game.js', import.meta.url), 'utf8');
function run(slug, storage) {
  const store = new Map();
  const localStorage = storage || { setItem: (key, value) => store.set(key, String(value)) };
  const document = { currentScript: { getAttribute: name => (name === 'data-game' ? slug : null) } };
  vm.runInNewContext(source, { document, localStorage, Date, JSON });
  return store;
}
test('records the declared game with a current timestamp', () => {
  const before = Date.now();
  const entry = JSON.parse(run('garden').get('mm.lastGame'));
  assert.equal(entry.slug, 'garden');
  assert.ok(entry.t >= before && entry.t <= Date.now());
});
test('ignores a missing or malformed slug', () => {
  for (const slug of [null, '', 'Bad Slug', '../x', 'a'.repeat(41)]) assert.equal(run(slug).size, 0, String(slug));
});
test('blocked storage does not throw', () => {
  assert.doesNotThrow(() => run('mars', { setItem() { throw new Error('QuotaExceededError'); } }));
});
test('every non-EMPIRES game route includes the marker with its catalog id', async () => {
  const { playableGames } = await import('../src/hub/catalog.mjs');
  for (const game of playableGames) {
    const page = await readFile(new URL(`..${game.route}index.html`, import.meta.url), 'utf8');
    const tag = `<script src="/assets/last-game.js" data-game="${game.id}" defer></script>`;
    if (game.id === 'empires') assert.ok(!page.includes('last-game.js'), 'EMPIRES is recorded from the hub instead');
    else assert.ok(page.includes(tag), `${game.route} includes ${tag}`);
  }
});
