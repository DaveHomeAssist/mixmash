import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FRONT_OF_HOUSE_RELEASE as release } from '../front-of-house/version.mjs';
import * as D from '../front-of-house/data.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Front of House release metadata stays aligned with runtime and cache', async () => {
  const [page, worker, notes] = await Promise.all([
    read('front-of-house/index.html'),
    read('sw.js'),
    read('front-of-house/docs/RELEASE_NOTES.md'),
  ]);
  assert.match(release.version, /^0\.\d+\.\d+$/);
  assert.equal(release.saveSchema, D.SCHEMA_VERSION);
  assert.match(worker, new RegExp(`const VERSION = '${release.cache}'`));
  assert.match(worker, /\.\/front-of-house\/version\.mjs/);
  assert.match(page, /id="game-version"/);
  assert.match(page, /\.\/docs\/RELEASE_NOTES\.md/);
  assert.match(notes, new RegExp(`## ${release.version} — ${release.date}`));
});
