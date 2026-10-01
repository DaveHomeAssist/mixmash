// MixMash admin index: renders admin/catalog.json (written by
// admin/build-catalog.mjs) into a viewport-locked shell with one tab per game.
// Every node is built with h(); catalog text never passes through innerHTML.

const THEME_KEY = 'mixmash.admin.theme';
const OVERVIEW = 'overview';
const ALL = 'all';

const els = {
  tabs: document.getElementById('tabs'),
  rail: document.querySelector('.rail'),
  panels: document.getElementById('panels'),
  results: document.getElementById('results'),
  status: document.getElementById('status'),
  search: document.getElementById('search'),
  count: document.getElementById('search-count'),
  theme: document.getElementById('theme-toggle'),
  announcer: document.getElementById('announcer'),
};

const state = { data: null, active: OVERVIEW, filters: new Map(), query: '' };
const wide = window.matchMedia('(min-width: 1181px)');
const phone = window.matchMedia('(max-width: 720px)');

function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

const srOnly = (text) => h('span', { class: 'sr-only', text });
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function safely(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

function announce(message) {
  els.announcer.textContent = '';
  window.setTimeout(() => { els.announcer.textContent = message; }, 30);
}

// ---------- Theme ----------
function setTheme(theme, persist) {
  document.documentElement.setAttribute('data-theme', theme);
  els.theme.setAttribute('aria-pressed', String(theme === 'dark'));
  if (persist) safely(() => localStorage.setItem(THEME_KEY, theme));
}
els.theme.addEventListener('click', () => {
  setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
});
setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light', false);

// ---------- Data ----------
function prepare(catalog) {
  const projects = catalog.projects;
  const categories = catalog.categories;
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const filesByProject = new Map(projects.map((p) => [p.id, []]));
  for (const file of catalog.files) {
    filesByProject.get(file.project).push(file);
    file.haystack = [file.path, file.title, file.description, file.kind, categoryById.get(file.category).label, projectById.get(file.project).name]
      .filter(Boolean).join(' ').toLowerCase();
  }
  for (const project of projects) {
    for (const ref of project.references) ref.haystack = [ref.label, ref.note, ref.url, ref.kind, project.name].filter(Boolean).join(' ').toLowerCase();
    for (const cmd of project.commands) cmd.haystack = [cmd.name, cmd.description, project.name].join(' ').toLowerCase();
  }
  const fileByPath = new Map(catalog.files.map((f) => [f.path, f]));
  return { catalog, projects, categories, projectById, categoryById, filesByProject, fileByPath };
}

function countsByCategory(files) {
  const counts = new Map();
  for (const file of files) counts.set(file.category, (counts.get(file.category) || 0) + 1);
  return counts;
}

// ---------- Shared pieces ----------
function fileRow(file, { where = false } = {}) {
  const { categoryById } = state.data;
  const actions = h('div', { class: 'file-actions' });
  if (file.open) actions.append(h('a', { class: 'act', href: file.open }, 'Live', srOnly(` page for ${file.path}`)));
  actions.append(h('button', { type: 'button', class: 'act', dataset: { copy: file.path } },
    h('span', { class: 'act-label', text: 'Copy' }), srOnly(` path ${file.path}`)));
  return h('li', { class: 'file', dataset: { path: file.path } },
    h('span', { class: 'kind', 'aria-hidden': 'true', text: file.kind }),
    h('div', { class: 'file-body' },
      where ? h('span', { class: 'file-where', text: categoryById.get(file.category).label }) : null,
      h('a', { class: 'file-title', href: file.github, text: file.title }),
      h('code', { class: 'file-path', text: file.path }),
      file.description ? h('p', { class: 'file-desc', text: file.description }) : null),
    actions);
}

function pathLinks(paths) {
  return h('ul', { class: 'link-list' }, paths.map((path) => {
    const file = state.data.fileByPath.get(path);
    return h('li', {}, h('a', { href: file.github, text: file.title }), h('code', { text: path }));
  }));
}

function refItem(ref) {
  const label = ref.url ? h('a', { href: ref.url, text: ref.label }) : h('span', { class: 'ref-unlinked', text: ref.label });
  return h('li', { dataset: { ref: ref.label } }, label,
    h('span', { class: 'ref-meta' },
      h('span', { class: 'ref-kind', text: ref.kind }),
      ref.private ? h('span', { class: 'badge-private', text: 'Private' }) : null,
      ref.note ? h('span', { text: ref.note }) : null));
}

function commandItem(cmd) {
  return h('li', { class: 'cmd' },
    h('code', { text: cmd.name }),
    h('button', { type: 'button', class: 'act', dataset: { copy: cmd.name } }, h('span', { class: 'act-label', text: 'Copy' }), srOnly(` command ${cmd.name}`)),
    h('p', { text: cmd.description }));
}

function tab(id, name, meta, count) {
  return h('button', {
    type: 'button', role: 'tab', id: `tab-${id}`, class: 'tab', tabindex: '-1',
    'aria-controls': `panel-${id}`, 'aria-selected': 'false',
    'aria-label': `${name}, ${meta}, ${plural(count, 'file')}`,
    dataset: { project: id },
    onclick: () => selectTab(id),
  },
  h('span', { class: 'tab-led', 'aria-hidden': 'true' }),
  h('span', { class: 'tab-name', text: name }),
  h('span', { class: 'tab-meta', text: meta }),
  h('span', { class: 'tab-count', text: String(count) }));
}

function panelShell(id, name, head) {
  const body = h('div', { class: 'panel-body', tabindex: '0', role: 'region', 'aria-label': `${name} index` });
  const panel = h('section', { class: 'panel', role: 'tabpanel', id: `panel-${id}`, 'aria-labelledby': `tab-${id}`, dataset: { project: id }, hidden: true }, head, body);
  return { panel, body };
}

// ---------- Overview ----------
function renderOverview() {
  const { catalog, projects, categories, filesByProject } = state.data;
  const refCount = projects.reduce((n, p) => n + p.references.length, 0);
  const cmdCount = projects.reduce((n, p) => n + p.commands.length, 0);

  const head = h('header', { class: 'panel-head' },
    h('div', { class: 'head-row' },
      h('div', { class: 'head-title' },
        h('p', { class: 'kicker' }, h('span', { text: `${catalog.repo.owner}/${catalog.repo.name}` }), h('span', { text: `branch ${catalog.repo.branch}` })),
        h('h1', { class: 'panel-title', text: 'Support index' })),
      h('div', { class: 'head-actions' },
        h('p', { class: 'stat-line', id: 'overview-stats' },
          h('strong', { text: String(catalog.files.length) }), ' files · ',
          h('strong', { text: String(projects.length) }), ' projects · ',
          h('strong', { text: String(refCount) }), ' references · ',
          h('strong', { text: String(cmdCount) }), ' commands'),
        h('a', { class: 'button-link', href: catalog.repo.url, text: 'Repository' }))));

  const { panel, body } = panelShell(OVERVIEW, 'Overview', head);

  const cards = h('div', { class: 'overview-grid' }, projects.map((project) => {
    const files = filesByProject.get(project.id);
    const counts = countsByCategory(files);
    return h('article', { class: 'pcard', dataset: { project: project.id, card: project.id } },
      h('header', { class: 'pcard-head' },
        h('h2', { class: 'pcard-title', text: project.name }),
        h('span', { class: 'life', text: project.lifecycle })),
      h('p', { class: 'pcard-kind' }, project.kind, project.route ? [' · ', h('code', { text: project.route })] : null),
      h('p', { class: 'pcard-mix', 'aria-label': 'Files by category' },
        categories.filter((c) => counts.has(c.id)).map((c) => h('span', { class: 'mix-item', text: `${c.label} ${counts.get(c.id)}` }))),
      h('div', { class: 'pcard-start' },
        project.pinned.slice(0, 3).map((path) => {
          const file = state.data.fileByPath.get(path);
          return h('a', { href: file.github, title: path, text: file.title });
        })),
      h('button', { type: 'button', class: 'pcard-open', onclick: () => selectTab(project.id, { focus: true }) },
        `Open index · ${plural(files.length, 'file')}`, srOnly(` for ${project.name}`)));
  }));

  const totals = countsByCategory(catalog.files);
  const matrix = h('table', { class: 'matrix' },
    h('caption', { class: 'sr-only', text: 'Files by category and project' }),
    h('thead', {}, h('tr', {},
      h('th', { scope: 'col', text: 'Category' }),
      projects.map((p) => h('th', { scope: 'col', dataset: { project: p.id } }, h('span', { class: 'th-led', 'aria-hidden': 'true' }), p.name)),
      h('th', { scope: 'col', text: 'Total' }))),
    h('tbody', {}, categories.map((c) => h('tr', {},
      h('th', { scope: 'row', title: c.description, text: c.label }),
      projects.map((p) => {
        const n = countsByCategory(filesByProject.get(p.id)).get(c.id) || 0;
        return h('td', {}, n
          ? h('a', { href: `#${p.id}:${c.id}`, 'aria-label': `${p.name}: ${plural(n, `${c.label} file`)}`, text: String(n) })
          : h('span', { class: 'zero', 'aria-label': 'none', text: '·' }));
      }),
      h('td', { text: String(totals.get(c.id) || 0) })))),
    h('tfoot', {}, h('tr', {},
      h('th', { scope: 'row', text: 'All files' }),
      projects.map((p) => h('td', { text: String(filesByProject.get(p.id).length) })),
      h('td', { text: String(catalog.files.length) }))));

  body.append(
    cards,
    h('h2', { class: 'section-title' }, 'Files by category', h('small', { text: 'Select a number to open that slice.' })),
    h('div', { class: 'matrix-wrap', tabindex: '0', role: 'region', 'aria-label': 'Files by category and project' }, matrix),
    h('h2', { class: 'section-title' }, 'How this index works'),
    h('div', { class: 'notes' },
      h('div', { class: 'note' }, h('h3', { text: 'Generated from the tree' }),
        h('p', {}, 'Every tracked file appears exactly once, titled and summarised from its own heading or comment when the catalog is generated. Run ', h('code', { text: 'npm run admin:index' }), ' after adding, removing or renaming a file; ', h('code', { text: 'npm test' }), ' fails when the catalog and the tree disagree.')),
      h('div', { class: 'note' }, h('h3', { text: 'Status stays at its source' }),
        h('p', { text: 'Each game lists where its status is recorded (roadmaps, progress logs, decision logs, reports) instead of copying it here, so this page cannot go stale.' })),
      h('div', { class: 'note' }, h('h3', { text: 'Public, but not indexed' }),
        h('p', { text: 'Like every GitHub Pages route this page can be opened by anyone with the address. It is marked noindex, stays out of the sitemap, and never links local paths, Notion or private source; private repositories are labelled.' }))));
  return panel;
}

// ---------- Project panels ----------
function renderProject(project) {
  const { categories } = state.data;
  const files = state.data.filesByProject.get(project.id);
  const counts = countsByCategory(files);
  const present = categories.filter((c) => counts.has(c.id));

  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': `Filter ${project.name} files by category` },
    h('button', { type: 'button', class: 'chip', 'aria-pressed': 'true', dataset: { filter: ALL }, onclick: () => setFilter(project.id, ALL) },
      'All', h('span', { class: 'chip-count', text: String(files.length) })),
    present.map((c) => h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', dataset: { filter: c.id }, onclick: () => setFilter(project.id, c.id) },
      c.label, h('span', { class: 'chip-count', text: String(counts.get(c.id)) }))));

  const head = h('header', { class: 'panel-head' },
    h('div', { class: 'head-row' },
      h('div', { class: 'head-title' },
        h('p', { class: 'kicker' }, h('span', { text: project.kind }), h('span', { class: 'life', text: project.lifecycle })),
        h('h1', { class: 'panel-title', text: project.name })),
      h('div', { class: 'head-actions' },
        h('p', { class: 'stat-line' }, h('strong', { text: String(files.length) }), ' files · ', h('strong', { text: String(project.references.length) }), ' references'),
        project.route ? h('a', { class: 'button-link', href: project.route }, `Open ${project.route}`) : null)),
    chips);

  const { panel, body } = panelShell(project.id, project.name, head);

  const aside = h('aside', { class: 'aside', 'aria-label': `${project.name} references` },
    h('section', { class: 'box' }, h('h2', { class: 'box-title', text: 'About' }), h('p', { text: project.summary })),
    h('section', { class: 'box' }, h('h2', { class: 'box-title', text: 'Start here' }), pathLinks(project.pinned)),
    h('section', { class: 'box' }, h('h2', { class: 'box-title', text: 'Where status lives' }), pathLinks(project.statusSources)),
    h('section', { class: 'box', dataset: { box: 'references' } }, h('h2', { class: 'box-title', text: 'References' }),
      h('ul', { class: 'link-list' }, project.references.map(refItem))),
    project.commands.length
      ? h('details', { class: 'box', dataset: { box: 'commands' }, open: wide.matches },
        h('summary', {}, h('h2', { class: 'box-title', text: `Commands · ${project.commands.length}` })),
        h('ul', { class: 'cmd-list' }, project.commands.map(commandItem)))
      : null);

  const cats = h('div', { class: 'cats' }, present.map((c) => h('section', { class: 'cat', dataset: { category: c.id }, 'aria-labelledby': `cat-${project.id}-${c.id}` },
    h('header', { class: 'cat-head' },
      h('h2', { class: 'tape', id: `cat-${project.id}-${c.id}`, text: c.label }),
      h('span', { class: 'cat-count', text: plural(counts.get(c.id), 'file') })),
    h('p', { class: 'cat-desc', text: c.description }),
    h('ul', { class: 'files' }, files.filter((f) => f.category === c.id).map((f) => fileRow(f))))));

  body.append(h('div', { class: 'project-grid' }, aside, cats));
  return panel;
}

function setFilter(projectId, category, { updateHash = true } = {}) {
  const panel = document.getElementById(`panel-${projectId}`);
  if (!panel || projectId === OVERVIEW) return;
  const valid = category === ALL || panel.querySelector(`.cat[data-category="${CSS.escape(category)}"]`);
  const value = valid ? category : ALL;
  state.filters.set(projectId, value);
  for (const chip of panel.querySelectorAll('.chip')) chip.setAttribute('aria-pressed', String(chip.dataset.filter === value));
  for (const cat of panel.querySelectorAll('.cat')) cat.hidden = value !== ALL && cat.dataset.category !== value;
  panel.querySelector('.aside').hidden = value !== ALL;
  panel.querySelector('.panel-body').scrollTop = 0;
  if (updateHash && state.active === projectId) writeHash();
}

// ---------- Tabs ----------
function writeHash() {
  const filter = state.filters.get(state.active);
  const hash = `#${state.active}${filter && filter !== ALL ? `:${filter}` : ''}`;
  if (window.location.hash !== hash) history.replaceState(null, '', hash);
}

function selectTab(id, { focus = false, category = null } = {}) {
  if (!state.data) return;
  if (id !== OVERVIEW && !state.data.projectById.has(id)) id = OVERVIEW;
  if (state.query) clearSearch({ restore: false });
  state.active = id;
  for (const button of els.tabs.querySelectorAll('[role="tab"]')) {
    const selected = button.dataset.project === id;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
  for (const panel of els.panels.children) panel.hidden = panel.dataset.project !== id;
  els.panels.hidden = false;
  els.results.hidden = true;
  if (category) setFilter(id, category, { updateHash: false });
  const name = id === OVERVIEW ? 'Overview' : state.data.projectById.get(id).name;
  document.title = `${name} · MixMash Admin`;
  writeHash();
  const button = document.getElementById(`tab-${id}`);
  if (phone.matches) {
    // Keep the chosen tab visible in the bottom rail without scrolling the page.
    const left = button.offsetLeft - 8;
    const right = button.offsetLeft + button.offsetWidth + 8 - els.rail.clientWidth;
    if (els.rail.scrollLeft > left) els.rail.scrollLeft = left;
    else if (els.rail.scrollLeft < right) els.rail.scrollLeft = right;
  }
  if (focus) button.focus();
}

els.tabs.addEventListener('keydown', (event) => {
  const tabs = [...els.tabs.querySelectorAll('[role="tab"]')];
  const index = tabs.indexOf(document.activeElement);
  if (index < 0) return;
  const last = tabs.length - 1;
  const next = { ArrowDown: index + 1, ArrowRight: index + 1, ArrowUp: index - 1, ArrowLeft: index - 1, Home: 0, End: last }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  selectTab(tabs[(next + tabs.length) % tabs.length].dataset.project, { focus: true });
});

function syncOrientation() {
  els.tabs.setAttribute('aria-orientation', phone.matches ? 'horizontal' : 'vertical');
}
phone.addEventListener('change', syncOrientation);

function applyHash() {
  const [id, category] = decodeURIComponent(window.location.hash.slice(1)).split(':');
  selectTab(id || OVERVIEW, { category: category || (id && id !== OVERVIEW ? ALL : null) });
}
window.addEventListener('hashchange', applyHash);

// ---------- Search ----------
function renderResults(query) {
  const { projects, filesByProject } = state.data;
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (item) => tokens.every((t) => item.haystack.includes(t));
  let fileHits = 0;
  let otherHits = 0;
  const groups = [];
  for (const project of projects) {
    const files = filesByProject.get(project.id).filter(hit);
    const refs = project.references.filter(hit);
    const cmds = project.commands.filter(hit);
    if (!files.length && !refs.length && !cmds.length) continue;
    fileHits += files.length;
    otherHits += refs.length + cmds.length;
    groups.push(h('section', { class: 'result-group', dataset: { project: project.id }, 'aria-labelledby': `result-${project.id}` },
      h('header', { class: 'result-head' },
        h('span', { class: 'th-led', 'aria-hidden': 'true' }),
        h('h3', { id: `result-${project.id}`, text: project.name }),
        h('span', { class: 'cat-count', text: plural(files.length + refs.length + cmds.length, 'match', 'matches') })),
      files.length ? h('ul', { class: 'result-list' }, files.map((f) => fileRow(f, { where: true }))) : null,
      refs.length ? h('div', { class: 'box' }, h('h4', { class: 'box-title', text: 'References' }), h('ul', { class: 'link-list' }, refs.map(refItem))) : null,
      cmds.length ? h('div', { class: 'box' }, h('h4', { class: 'box-title', text: 'Commands' }), h('ul', { class: 'cmd-list' }, cmds.map(commandItem))) : null));
  }
  const total = fileHits + otherHits;
  const summary = total
    ? `${plural(fileHits, 'file')} and ${plural(otherHits, 'reference or command', 'references or commands')}`
    : 'No matches';
  const body = h('div', { class: 'panel-body', tabindex: '0', role: 'region', 'aria-label': 'Search results' },
    groups.length ? groups : h('div', { class: 'empty' },
      h('strong', { text: `Nothing matches “${query}”.` }),
      h('p', { text: 'Try part of a path (docs/, test-), a file type (json, md), a game name or a word from a description.' })));
  els.results.replaceChildren(
    h('header', { class: 'panel-head', dataset: { project: OVERVIEW } },
      h('p', { class: 'kicker', text: 'Search · every game' }),
      h('h1', { class: 'panel-title', id: 'results-title', text: total ? plural(total, 'match', 'matches') : 'No matches' })),
    body);
  els.results.dataset.files = String(fileHits);
  els.results.dataset.other = String(otherHits);
  els.count.textContent = `${summary} for “${query}”`;
}

function runSearch() {
  const query = els.search.value.trim();
  state.query = query;
  if (!query) { clearSearch(); return; }
  renderResults(query);
  els.panels.hidden = true;
  els.results.hidden = false;
}

function clearSearch({ restore = true } = {}) {
  state.query = '';
  els.search.value = '';
  els.count.textContent = '';
  els.results.hidden = true;
  els.results.replaceChildren();
  if (restore) els.panels.hidden = false;
}

let searchTimer = 0;
els.search.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(runSearch, 90);
});
els.search.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { window.clearTimeout(searchTimer); runSearch(); }
  if (event.key === 'Escape') {
    if (els.search.value) { event.preventDefault(); clearSearch(); } else els.search.blur();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
  event.preventDefault();
  els.search.focus();
});

// ---------- Copy ----------
document.addEventListener('click', async (event) => {
  const button = event.target instanceof Element ? event.target.closest('[data-copy]') : null;
  if (!button) return;
  const text = button.dataset.copy;
  const label = button.querySelector('.act-label');
  try {
    await navigator.clipboard.writeText(text);
    button.dataset.copied = 'true';
    if (label) label.textContent = 'Copied';
    announce(`Copied ${text}`);
    window.setTimeout(() => { delete button.dataset.copied; if (label) label.textContent = 'Copy'; }, 1500);
  } catch {
    announce(`Copy is unavailable here. The text is ${text}`);
  }
});

// ---------- Boot ----------
function render() {
  const { catalog, projects, filesByProject } = state.data;
  els.tabs.replaceChildren(
    tab(OVERVIEW, 'Overview', 'All games', catalog.files.length),
    ...projects.map((p) => tab(p.id, p.name, p.lifecycle, filesByProject.get(p.id).length)));
  els.rail.querySelector('.rail-foot')?.remove();
  els.rail.append(h('p', { class: 'rail-foot' }, `${plural(catalog.files.length, 'file')} indexed. Regenerate with `, h('code', { text: 'npm run admin:index' }), '.'));
  els.panels.replaceChildren(renderOverview(), ...projects.map(renderProject));
  syncOrientation();
}

function showError(error) {
  els.status.hidden = false;
  els.status.replaceChildren(
    h('p', { class: 'status-title', text: 'The index did not load' }),
    h('p', { text: `admin/catalog.json could not be read (${error.message}). Regenerate it with npm run admin:index, or try again.` }),
    h('button', { type: 'button', class: 'button-link', onclick: load, text: 'Try again' }));
  document.documentElement.dataset.ready = 'error';
}

async function load() {
  els.status.hidden = false;
  els.status.replaceChildren(h('p', { class: 'status-title', text: 'Loading the index…' }));
  try {
    const response = await fetch('catalog.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = prepare(await response.json());
    render();
    applyHash();
    els.status.hidden = true;
    document.documentElement.dataset.ready = 'true';
  } catch (error) {
    showError(error);
  }
}

load();
