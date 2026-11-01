/** The Pages artifact leaves out repository-only files and keeps every service-worker precache entry. */
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildSite, isPublished } from '../.github/scripts/build-pages-site.mjs';

test('repository-only files are not published', () => {
  for (const path of ['package.json', 'package-lock.json', 'vercel.json', 'README.md', 'AGENTS.md', 'CLAUDE.md', 'CHANGELOG.md', '.gitignore', '.github/workflows/ci.yml', 'test/landing-smoke.mjs', 'api/health.mjs']) {
    assert.equal(isPublished(path), false, path);
  }
  for (const path of ['index.html', '404.html', 'CNAME', 'sw.js', 'robots.txt', 'sitemap.xml', 'admin/index.html', 'admin/catalog.json', 'garden/index.html', 'docs/PLAYER_GUIDE.md', 'front-of-house/index.html']) {
    assert.equal(isPublished(path), true, path);
  }
});

test('the built site has the pages and none of the excluded files', async () => {
  const out = await mkdtemp(join(tmpdir(), 'mixmash-pages-'));
  try {
    const result = await buildSite(out);
    assert.ok(result.published > 100, 'site has its pages');
    const root = await readdir(out);
    for (const name of ['package.json', 'package-lock.json', 'vercel.json', 'README.md', 'AGENTS.md', 'CLAUDE.md', '.gitignore', '.github', 'test', 'api']) assert.ok(!root.includes(name), `${name} left out`);
    for (const name of ['index.html', 'CNAME', '.nojekyll', 'sw.js']) await stat(join(out, name));
  } finally { await rm(out, { recursive: true, force: true }); }
});
