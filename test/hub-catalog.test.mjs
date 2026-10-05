/** Public catalog integrity and publication boundaries. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { playableGames, studio } from '../src/hub/catalog.mjs';
const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
test('the six browser games have real routes, bounded images and recorded claims', async () => {
  assert.deepEqual(playableGames.map(g => g.route), ['/play/', '/front-of-house/', '/pitch/', '/mars/', '/garden/', '/empires/']);
  assert.equal(new Set(playableGames.map(g => g.id)).size, playableGames.length);
  const evidence = await read('docs/HOMEPAGE_EVIDENCE.md');
  for (const game of playableGames) {
    assert.match(await read(`${game.route.slice(1)}index.html`), /<html/i);
    assert.ok((await stat(new URL(`assets/previews/${game.image}`, root))).size < 160000);
    assert.ok(evidence.includes(`## ${game.evidence}`), `${game.name}: evidence owner`);
    assert.ok(game.controls && game.players && game.saving && game.verified);
    assert.ok(!/[—]/.test(JSON.stringify(game)), `${game.name}: no em dash`);
  }
});
test('generated static catalog cannot drift and keeps the requested copy', async () => {
  execFileSync(process.execPath, ['src/hub/build.mjs', '--check'], { cwd: root, stdio: 'pipe' });
  const html = await read('index.html');
  assert.ok(html.includes(`<title>${studio.title}</title>`));
  assert.equal(studio.title, 'MixMash Studio | Free Browser Games');
  assert.equal(studio.note, 'Every game here is playable now. Each card shows how far along it is.');
  assert.ok(html.includes(studio.note));
  assert.ok(!/[—]|&mdash;|&#8212;/.test(html));
  assert.equal((html.match(/class="play-link"/g) || []).length, 6);
  assert.ok(!html.includes('/src/kit/pwa.js'), 'do not precache game runtimes during a first homepage visit');
});
test('FOH approval affects discovery only, not indexing or game saves', async () => {
  assert.match(await read('front-of-house/index.html'), /name="robots" content="noindex/);
  assert.ok(!(await read('sitemap.xml')).includes('/front-of-house/'));
  assert.match(await read('front-of-house/README.md'), /signed off the first playable for homepage promotion on 2026-10-05/);
  const script = await read('src/hub/app.js');
  assert.ok(!script.includes('localStorage.clear'));
  assert.ok(!script.includes('localStorage.removeItem'));
  const sw = await read('sw.js');
  for (const file of ['src/hub/style.css', 'src/hub/app.js', ...playableGames.map(g => `assets/previews/${g.image}`)]) assert.ok(sw.includes(`'./${file}'`));
});
