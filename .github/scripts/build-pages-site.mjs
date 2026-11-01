#!/usr/bin/env node
/**
 * Assemble the public GitHub Pages site into a directory (default _site/) from the tracked tree,
 * leaving out repository-only files: build config, agent/maintainer notes, CI and tests.
 *
 *   node .github/scripts/build-pages-site.mjs [outDir]
 *
 * Used by .github/workflows/pages.yml once Pages is switched from "Deploy from a branch" to
 * "GitHub Actions". Until then the legacy gh-pages branch build keeps serving every file.
 * Exits non-zero if an excluded file slipped in or a service-worker precache entry is missing,
 * because a missing precache file makes the worker's install fail for every visitor.
 */
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Root files that are repository plumbing, not site. Root-level Markdown is matched separately. */
export const EXCLUDED_ROOT_FILES = new Set(['package.json', 'package-lock.json', 'vercel.json', '.gitignore']);
/** Directories that never belong on the public site: CI config, tests, Vercel function source. */
export const EXCLUDED_DIRS = ['.github/', 'test/', 'api/'];

/** True when a tracked path should be published. */
export function isPublished(path) {
  if (EXCLUDED_DIRS.some(dir => path.startsWith(dir))) return false;
  if (!path.includes('/')) {
    if (EXCLUDED_ROOT_FILES.has(path)) return false;
    if (/\.md$/i.test(path)) return false; // README, AGENTS, CLAUDE, CHANGELOG, ROADMAP, ...
  }
  return true;
}

/** Same-origin precache paths from sw.js, normalised to repo-relative files. */
export function precachePaths(swSource) {
  const block = swSource.match(/const PRECACHE = \[([\s\S]*?)\];/);
  if (!block) throw new Error('sw.js has no PRECACHE list');
  return [...block[1].matchAll(/'\.\/([^']*)'/g)].map(([, p]) => (p === '' || p.endsWith('/')) ? p + 'index.html' : p);
}

export async function buildSite(outDir, root = repoRoot) {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const published = files.filter(isPublished);
  await rm(outDir, { recursive: true, force: true });
  for (const file of published) {
    const target = join(outDir, file);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(root, file), target);
  }
  // Checks: nothing excluded leaked, and the offline worker can still install.
  const leaked = published.filter(f => !isPublished(f));
  if (leaked.length) throw new Error(`Excluded files in site: ${leaked.join(', ')}`);
  const missing = [];
  for (const path of precachePaths(await readFile(join(root, 'sw.js'), 'utf8'))) {
    try { await stat(join(outDir, path)); } catch { missing.push(path); }
  }
  if (missing.length) throw new Error(`sw.js precaches files missing from the site: ${missing.join(', ')}`);
  for (const required of ['index.html', '404.html', 'CNAME', 'sw.js', 'robots.txt']) await stat(join(outDir, required));
  return { published: published.length, excluded: files.length - published.length, excludedFiles: files.filter(f => !isPublished(f)) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outDir = resolve(process.argv[2] || join(repoRoot, '_site'));
  const result = await buildSite(outDir);
  const rootLevel = result.excludedFiles.filter(f => !f.includes('/'));
  console.log(`Pages site: ${result.published} files in ${outDir}; ${result.excluded} left out (root: ${rootLevel.join(', ')}; plus ${EXCLUDED_DIRS.join(', ')}).`);
}
