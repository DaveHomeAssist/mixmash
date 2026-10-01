#!/usr/bin/env node
// Builds admin/catalog.json, the data behind mixmash.games/admin/.
//
// Every tracked file in the repo is listed exactly once, assigned to a project
// and a category by the rules below, and described by its own Markdown
// heading, HTML <title> and meta description, or leading code comment. Notes
// in catalog-sources.mjs fill in files that do not describe themselves.
//
//   npm run admin:index
//
// The admin-index workflow runs this after every push to gh-pages and commits
// the result when it changed, and CI runs it before the tests. Running it in a
// branch keeps a pull request's catalog diff complete.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATEGORIES, COMMAND_NOTES, FILE_NOTES, PROJECTS, REPO } from './catalog-sources.mjs';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const CATALOG_PATH = path.join(ROOT, 'admin', 'catalog.json');

const PREVIEW_PROJECTS = { mixmash: 'mixmash', mars: 'mars', empires: 'empires', garden: 'garden', pitch: 'pitch' };

// First match wins; anything unmatched belongs to the studio hub.
const PROJECT_RULES = [
  [/^admin\//, 'studio'],
  [/^(api|mars)\//, 'mars'],
  [/^front-of-house\//, 'front-of-house'],
  [/^play\//, 'mixmash'],
  [/^playcards\//, 'playcards'],
  [/^pitch\//, 'pitch'],
  [/^empires\//, 'empires'],
  [/^garden\//, 'garden'],
  [/^zelda2mario\//, 'zelda2mario'],
  [/^(src\/combat\.js|ROADMAP\.md|docs\/PLAYER_GUIDE\.md)$/, 'mixmash'],
  [/^docs\/rfc-\d+-garden-os/, 'garden'],
  [/^test\/(combat|play-|public-counts)/, 'mixmash'],
  [/^test\/zelda2mario-/, 'zelda2mario'],
  [/^test\/front-of-house-/, 'front-of-house'],
];

const OPS_FILES = new Set([
  '.gitignore', '.nojekyll', 'CNAME', 'robots.txt', 'sitemap.xml', 'sw.js', 'manifest.webmanifest',
  'package.json', 'package-lock.json', 'vercel.json',
  'playcards/.gitignore', 'playcards/build.xml', 'playcards/manifest.mf',
]);

// First match wins; anything unmatched is source code.
const CATEGORY_RULES = [
  [(p) => /^test\//.test(p) || /(^|\/)test-[^/]+\.mjs$/.test(p) || /\.test\.m?js$/.test(p) || /(^|\/)test\//.test(p), 'tests'],
  [(p) => /(^|\/)DECISIONS\.md$/.test(p) || p === 'AGENTS.md' || p === 'LICENSE', 'decisions'],
  [(p) => /(^|\/)(ROADMAP|ART_ROADMAP|CHANGELOG|SPRINT_BOARDS|progress)\.md$/.test(p) || /^playcards\/(Changelog|Sprint-Board)/.test(p), 'planning'],
  [(p) => /BALANCE_BASELINE\.md$|balance-baseline\.json$/.test(p) || /^mars\/art\/reports\//.test(p) || /^mars\/parity\/(LEDGER\.md|mapping\.json|baseline\/)/.test(p), 'evidence'],
  [(p) => /\/sim\/[^/]+\.mjs$/.test(p) || /^mars\/art\/[^/]+\.mjs$/.test(p) || p === 'mars/parity/build-ledger.mjs' || /^admin\/(build-catalog\.mjs|catalog-sources\.mjs|catalog\.json)$/.test(p), 'tooling'],
  [(p) => /^empires\/assets\/aoe2-clone\.(js|wasm)$/.test(p), 'build'],
  [(p) => /^api\//.test(p) || p === 'mars/server.mjs' || p === 'mars/package.json', 'backend'],
  [(p) => /\.(png|jpe?g|gif|webp|svg)$/.test(p) || /^mars\/assets\/.+\.json$/.test(p) || /^mars\/art\/golden-(scene|slice)\.json$/.test(p) || /^mars\/(render-contract|sprites)\.mjs$/.test(p), 'art'],
  [(p) => /^\.github\//.test(p) || OPS_FILES.has(p) || /^playcards\/nbproject\//.test(p), 'ops'],
  [(p) => p === 'brand.html', 'docs'],
  [(p) => /\.html$/.test(p), 'surface'],
  [(p) => /\.md$/.test(p), 'docs'],
];

export function classify(file) {
  let project = 'studio';
  const preview = file.match(/^assets\/previews\/([a-z]+)\.(jpe?g|png)$/);
  if (preview && PREVIEW_PROJECTS[preview[1]]) project = PREVIEW_PROJECTS[preview[1]];
  else for (const [pattern, id] of PROJECT_RULES) if (pattern.test(file)) { project = id; break; }
  let category = 'source';
  for (const [test, id] of CATEGORY_RULES) if (test(file)) { category = id; break; }
  return { project, category };
}

/** Tracked and new (not ignored) files that exist on disk, sorted. */
export function listFiles(root = ROOT) {
  const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
  return [...new Set(out.split('\0').filter(Boolean))].filter((file) => existsSync(path.join(root, file))).sort();
}

const KINDS = { md: 'MD', html: 'HTML', js: 'JS', mjs: 'MJS', css: 'CSS', json: 'JSON', webmanifest: 'JSON', png: 'PNG', jpg: 'JPG', jpeg: 'JPG', svg: 'SVG', wasm: 'WASM', java: 'JAVA', xml: 'XML', yml: 'YAML', yaml: 'YAML', mf: 'MF', properties: 'PROPS', txt: 'TXT' };

function kindOf(file) {
  const base = path.basename(file);
  if (base.startsWith('.') && !base.slice(1).includes('.')) return 'CFG';
  const ext = path.extname(base).slice(1).toLowerCase();
  return KINDS[ext] || 'TXT';
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', middot: '·', hellip: '…', rarr: '→' };
const decode = (text) => text.replace(/&(#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? m));

function clean(text) {
  return decode(text)
    .replace(/\{@(?:code|link|linkplain)\s+(?:[\w.]+\.)?([^}]+)\}/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[\s(])[*_]([^*_]+)[*_](?=[\s).,;:]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarise(text, max = 220) {
  const value = clean(text);
  if (value.length <= max) return value;
  const sentence = value.slice(0, max).match(/^(.+?[.!?])\s/);
  if (sentence && sentence[1].length >= 60) return sentence[1];
  return `${value.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

function fromMarkdown(text) {
  let title = null;
  let paragraph = [];
  let inFence = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('```')) { inFence = !inFence; if (paragraph.length) break; continue; }
    if (inFence) continue;
    if (!title && /^# /.test(line)) { title = clean(line.slice(2)); continue; }
    const prose = line && !/^(#|\||<|!\[|---|\*\*\*|[-*+] |\d+\. |>)/.test(line) && !/^[A-Z][\w /&()-]{0,40}:(\s|$)/.test(clean(line)) && !/^Original prompt:/i.test(line);
    if (prose) { paragraph.push(line); continue; }
    // A paragraph that only introduces a list ("Authority order:") says little.
    if (paragraph.length && /:$/.test(paragraph.at(-1))) { paragraph = []; continue; }
    if (paragraph.length) break;
  }
  if (paragraph.length && /:$/.test(paragraph.at(-1))) paragraph = [];
  return { title, description: paragraph.length ? summarise(paragraph.join(' ')) : null };
}

function fromHtml(text) {
  const title = text.match(/<title>([^<]*)<\/title>/i)?.[1];
  const meta = text.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1];
  return { title: title ? clean(title) : null, description: meta ? summarise(meta) : null };
}

function fromComment(text) {
  const lines = text.replace(/^#!.*\n/, '').split('\n');
  let i = 0;
  while (i < lines.length && (/^\s*$/.test(lines[i]) || /^\s*(package|import)\s[^;{]*;?\s*$/.test(lines[i]) || /^\s*'use strict';?\s*$/.test(lines[i]))) i += 1;
  const collected = [];
  const first = lines[i]?.trim() ?? '';
  if (first.startsWith('//')) {
    for (; i < lines.length && lines[i].trim().startsWith('//'); i += 1) collected.push(lines[i].trim().replace(/^\/\/+\s?/, ''));
  } else if (first.startsWith('/*')) {
    for (; i < lines.length; i += 1) {
      const line = lines[i].trim();
      collected.push(line.replace(/^\/\*+\s?/, '').replace(/\*+\/\s*$/, '').replace(/^\*\s?/, ''));
      if (line.includes('*/')) break;
    }
  }
  const paragraphs = [[]];
  for (const line of collected) {
    if (/^@/.test(line.trim())) break;
    if (line.trim()) paragraphs.at(-1).push(line.trim());
    else if (paragraphs.at(-1).length) paragraphs.push([]);
  }
  const [lead = '', next = ''] = paragraphs.map((p) => p.join(' '));
  // A heading-like first line ("MixKit global nav (HUB-102)") reads better with
  // the paragraph that follows it.
  const summary = lead && lead.length < 60 && next ? `${lead.replace(/[.:]?$/, '.')} ${next}` : lead;
  return { title: null, description: summary ? summarise(summary) : null };
}

function describe(root, file) {
  const ext = path.extname(file).toLowerCase();
  let found = { title: null, description: null };
  if (['.md', '.html', '.js', '.mjs', '.css', '.java'].includes(ext)) {
    const text = readFileSync(path.join(root, file), 'utf8');
    found = ext === '.md' ? fromMarkdown(text) : ext === '.html' ? fromHtml(text) : fromComment(text);
  }
  // Images cannot describe themselves; say where they live so an art drop
  // needs no hand-written note.
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(ext)) found.description = `${path.basename(file, ext)} image in ${path.dirname(file)}/.`;
  const note = FILE_NOTES[file] || {};
  return {
    title: note.title || found.title || path.basename(file),
    description: note.description || found.description || null,
  };
}

const encodePath = (file) => file.split('/').map(encodeURIComponent).join('/');

function links(file) {
  const github = `${REPO.url}/blob/${REPO.branch}/${encodePath(file)}`;
  let open = null;
  if (/\.html$/.test(file)) open = file === 'index.html' ? '/' : file.endsWith('/index.html') ? `/${encodePath(file.slice(0, -'index.html'.length))}` : `/${encodePath(file)}`;
  else if (/\.(png|jpe?g|gif|webp|svg)$/.test(file)) open = `/${encodePath(file)}`;
  return { github, open };
}

function commandsFor(root) {
  const scripts = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts || {};
  return Object.keys(scripts).map((script) => {
    const note = COMMAND_NOTES[script] || {};
    return {
      project: note.project || 'studio',
      name: script === 'test' ? 'npm test' : `npm run ${script}`,
      description: note.description || scripts[script],
    };
  });
}

export function buildCatalog({ root = ROOT, files = listFiles(root) } = {}) {
  const projectOrder = new Map(PROJECTS.map((p, i) => [p.id, i]));
  const categoryOrder = new Map(CATEGORIES.map((c, i) => [c.id, i]));
  const categoryLabel = new Map(CATEGORIES.map((c) => [c.id, c.label]));
  const entries = files.map((file) => {
    const entry = { path: file, ...classify(file), kind: kindOf(file), ...describe(root, file), ...links(file) };
    // Anything still undescribed is named by its category and folder, so a new
    // file never needs a note before it can be indexed.
    if (!entry.description) {
      const dir = path.dirname(file);
      entry.description = `${categoryLabel.get(entry.category)} file ${dir === '.' ? 'at the repository root' : `in ${dir}/`}.`;
    }
    return entry;
  });
  entries.sort((a, b) => projectOrder.get(a.project) - projectOrder.get(b.project)
    || categoryOrder.get(a.category) - categoryOrder.get(b.category)
    || a.path.localeCompare(b.path));
  const commands = commandsFor(root);
  return {
    schemaVersion: 1,
    generator: 'admin/build-catalog.mjs',
    repo: REPO,
    categories: CATEGORIES,
    projects: PROJECTS.map(({ commands: extra = [], ...project }) => ({
      ...project,
      route: project.route ?? null,
      references: project.references.map((ref) => ({ private: false, note: null, ...ref })),
      commands: [...commands.filter((c) => c.project === project.id).map(({ project: _, ...c }) => c), ...extra],
    })),
    files: entries,
  };
}

export function serialise(catalog) {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const catalog = buildCatalog();
  writeFileSync(CATALOG_PATH, serialise(catalog));
  const missing = catalog.files.filter((f) => !f.description).map((f) => f.path);
  console.log(`admin/catalog.json: ${catalog.files.length} files across ${catalog.projects.length} projects.`);
  if (missing.length) console.log(`No description for ${missing.length}: ${missing.join(', ')}`);
}
