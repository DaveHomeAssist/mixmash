// The admin index (mixmash.games/admin/) must list every tracked file exactly
// once, in the project and category the generator's rules assign today.
//
// CI regenerates the catalog before this runs, and the admin-index workflow
// commits it after each push to gh-pages, so here this guards the generator:
// coverage, classification, references and privacy. Locally, a failure after
// adding, removing or renaming a file means: run `npm run admin:index`.
// Titles and summaries are snapshots and are not compared.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_PATH, ROOT, classify, listFiles } from '../admin/build-catalog.mjs';
import { CATEGORIES, FILE_NOTES, PROJECTS } from '../admin/catalog-sources.mjs';

const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
const paths = catalog.files.map((file) => file.path);
const byPath = new Map(catalog.files.map((file) => [file.path, file]));
const REGENERATE = 'run `npm run admin:index` and commit admin/catalog.json';

// The page is public. These patterns must never reach it (the same rule the
// published Zelda2Mario projection follows).
const PRIVATE = /\/Users\/|\/Volumes\/|app\.notion\.com|notion\.so|github\.com\/DaveHomeAssist\/Zelda2MarioCoop/i;

test('admin catalog lists every tracked file exactly once', () => {
  assert.equal(new Set(paths).size, paths.length, 'no file is listed twice');
  const tree = listFiles(ROOT);
  const listed = new Set(paths);
  const files = new Set(tree);
  const missing = tree.filter((file) => !listed.has(file));
  const extra = paths.filter((file) => !files.has(file));
  assert.deepEqual(missing, [], `files missing from the admin index; ${REGENERATE}`);
  assert.deepEqual(extra, [], `admin index lists files that no longer exist; ${REGENERATE}`);
});

test('admin catalog classification matches the generator rules', () => {
  const drift = catalog.files
    .map((file) => ({ file, expected: classify(file.path) }))
    .filter(({ file, expected }) => file.project !== expected.project || file.category !== expected.category)
    .map(({ file, expected }) => `${file.path}: catalog ${file.project}/${file.category}, rules ${expected.project}/${expected.category}`);
  assert.deepEqual(drift, [], `classification drifted; ${REGENERATE}`);
});

test('admin catalog projects and categories are complete and known', () => {
  assert.equal(catalog.schemaVersion, 1);
  assert.deepEqual(catalog.projects.map((p) => p.id), PROJECTS.map((p) => p.id), 'project list matches catalog-sources.mjs');
  assert.deepEqual(catalog.categories.map((c) => c.id), CATEGORIES.map((c) => c.id), 'category list matches catalog-sources.mjs');
  const projectIds = new Set(PROJECTS.map((p) => p.id));
  const categoryIds = new Set(CATEGORIES.map((c) => c.id));
  for (const file of catalog.files) {
    assert.ok(projectIds.has(file.project), `${file.path}: known project`);
    assert.ok(categoryIds.has(file.category), `${file.path}: known category`);
    assert.ok(file.title?.trim(), `${file.path}: has a title`);
    assert.ok(file.description?.trim(), `${file.path}: has a description (add a note in admin/catalog-sources.mjs)`);
    assert.equal(file.github, `${catalog.repo.url}/blob/${catalog.repo.branch}/${file.path.split('/').map(encodeURIComponent).join('/')}`);
    if (file.open) assert.match(file.open, /^\/(?!\/)/, `${file.path}: live links stay on this site`);
  }
  for (const project of PROJECTS) {
    assert.ok(catalog.files.some((file) => file.project === project.id), `${project.id} has at least one file`);
  }
});

test('admin start-here, status and note paths exist in the catalog', () => {
  for (const project of catalog.projects) {
    for (const file of [...project.pinned, ...project.statusSources]) {
      assert.ok(byPath.has(file), `${project.id}: ${file} is a catalogued file`);
    }
  }
  const stale = Object.keys(FILE_NOTES).filter((file) => !byPath.has(file));
  assert.deepEqual(stale, [], 'every note in catalog-sources.mjs names a tracked file');
});

test('admin references are well formed and site routes resolve', () => {
  for (const project of catalog.projects) {
    assert.ok(project.references.length > 0, `${project.id} has references`);
    for (const ref of project.references) {
      assert.ok(ref.label && ref.kind, `${project.id}: reference has a label and kind`);
      if (ref.url === null) {
        assert.equal(ref.private, true, `${ref.label}: only a private reference may be unlinked`);
        assert.ok(ref.note, `${ref.label}: an unlinked reference explains why`);
        continue;
      }
      assert.match(ref.url, /^(https:\/\/|\/)/, `${ref.label}: https or a site path`);
      if (ref.url.startsWith('/')) {
        const local = ref.url === '/' ? 'index.html' : ref.url.endsWith('/') ? `${ref.url.slice(1)}index.html` : ref.url.slice(1);
        assert.ok(byPath.has(local), `${ref.label}: ${ref.url} is a page in this repo`);
      }
    }
    if (project.route) {
      const local = project.route === '/' ? 'index.html' : `${project.route.slice(1)}index.html`;
      assert.ok(byPath.has(local), `${project.id}: route ${project.route} is served from this repo`);
    }
  }
});

test('admin index stays public-safe', async () => {
  const surfaces = ['admin/catalog.json', 'admin/index.html', 'admin/app.js', 'admin/theme.js', 'admin/styles.css', 'admin/catalog-sources.mjs'];
  for (const file of surfaces) {
    const text = await readFile(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(text, PRIVATE, `${file} must not expose local paths, Notion or private source links`);
  }
  const page = await readFile(path.join(ROOT, 'admin/index.html'), 'utf8');
  assert.match(page, /<meta name="robots" content="noindex, nofollow">/, 'admin index is noindex');
  const sitemap = await readFile(path.join(ROOT, 'sitemap.xml'), 'utf8');
  assert.doesNotMatch(sitemap, /\/admin/, 'admin index stays out of the sitemap');
});
