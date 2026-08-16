import {
  BUILDINGS,
  CRAFT_RECIPES,
  EQUIP_SLOTS,
  EQUIP_TIERS,
  ITEMS,
  NODES,
  REGIONS,
  RESEARCH,
  ROVERS,
  SKILLS,
  SMELT_RECIPES,
  advanceState,
  applyCommand,
  createState,
  equipStats,
  levelForXp,
  publicState,
  sanitizeState,
} from './engine.mjs';

const STORAGE_KEY = 'marsscape.session.v3';
const SESSION_KEY = 'marsscape.sessionId.v3';
const ASSET_MANIFEST = './assets/manifest.json';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '']);
const API_BASE = resolveApiBase();
const TILE_W = 42;
const TILE_H = 21;
const CANVAS_W = 940;
const CANVAS_H = 620;
const CANVAS_ORIGIN_X = 470;
const CANVAS_ORIGIN_Y = 86;
const BOARD_SIZE = 11;

let state = createState();
let sessionId = getOrCreateSessionId();
let mode = 'checking';
let activeTab = 'skills';
let commandQueue = Promise.resolve();
let saveTimer = 0;
let pendingCommands = [];
let assetsReady = false;

const el = {
  appShell: document.querySelector('#appShell'),
  boot: document.querySelector('#boot'),
  bootStatus: document.querySelector('#bootStatus'),
  startButton: document.querySelector('#startButton'),
  authorityStatus: document.querySelector('#authorityStatus'),
  isoViewport: document.querySelector('#isoViewport'),
  isoBoard: document.querySelector('#isoBoard'),
  viewReset: document.querySelector('#viewReset'),
  panelBody: document.querySelector('#panelBody'),
  eventLog: document.querySelector('#eventLog'),
  actionReadout: document.querySelector('#actionReadout'),
  toastStack: document.querySelector('#toastStack'),
  oxygenMeter: document.querySelector('#oxygenMeter'),
  powerMeter: document.querySelector('#powerMeter'),
  oxygenValue: document.querySelector('#oxygenValue'),
  powerValue: document.querySelector('#powerValue'),
  oxygenBar: document.querySelector('#oxygenBar'),
  powerBar: document.querySelector('#powerBar'),
  solValue: document.querySelector('#solValue'),
  regionLabel: document.querySelector('#regionLabel'),
  tabs: document.querySelector('#tabs'),
  tickButton: document.querySelector('#tickButton'),
  exportButton: document.querySelector('#exportButton'),
  importButton: document.querySelector('#importButton'),
  resetButton: document.querySelector('#resetButton'),
};

class AssetLoader {
  constructor(manifestPath) {
    this.manifestUrl = new URL(manifestPath, window.location.href);
    this.assets = new Map();
  }

  async load() {
    const response = await fetch(this.manifestUrl, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Asset manifest failed (${response.status})`);
    const manifest = await response.json();
    const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
    await Promise.all(assets.map((asset) => this.loadAsset(asset)));
  }

  async loadAsset(asset) {
    if (!asset?.id || !asset?.src) throw new Error('Bad asset manifest entry');
    const url = new URL(asset.src, this.manifestUrl);
    if (asset.type === 'image') {
      const image = new Image();
      image.decoding = 'async';
      image.src = url.href;
      await image.decode().catch(() => new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      }));
      this.assets.set(asset.id, image);
      return;
    }
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Asset failed: ${asset.id}`);
    this.assets.set(asset.id, await response.text());
  }

  get(id) {
    return this.assets.get(id);
  }
}

class LocalEnvelopeSigner {
  constructor() {
    this.keyPromise = this.loadKey();
  }

  async sign(text) {
    const key = await this.keyPromise;
    const bytes = new TextEncoder().encode(text);
    const signature = await crypto.subtle.sign('HMAC', key, bytes);
    return base64Url(new Uint8Array(signature));
  }

  async verify(text, signature) {
    if (!signature || typeof signature !== 'string') return false;
    const key = await this.keyPromise;
    const bytes = new TextEncoder().encode(text);
    const raw = base64UrlToBytes(signature);
    return crypto.subtle.verify('HMAC', key, raw, bytes);
  }

  async loadKey() {
    if (!crypto.subtle) throw new Error('WebCrypto HMAC is unavailable');
    const stored = await this.readStoredKey().catch(() => null);
    if (stored) return stored;
    const key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    await this.writeStoredKey(key).catch(() => {});
    return key;
  }

  async openDb() {
    if (!window.indexedDB) return null;
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open('marsscape-secure-v1', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('keys');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async readStoredKey() {
    const db = await this.openDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readonly');
      const request = tx.objectStore('keys').get('local-envelope-hmac');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async writeStoredKey(key) {
    const db = await this.openDb();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite');
      tx.objectStore('keys').put(key, 'local-envelope-hmac');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
}

const assetLoader = new AssetLoader(ASSET_MANIFEST);
const localSigner = new LocalEnvelopeSigner();

boot();

function resolveApiBase() {
  const configured = document.querySelector('meta[name="marsscape-api-base"]')?.content?.trim();
  if (configured && !LOCAL_HOSTS.has(window.location.hostname)) {
    return new URL(configured, window.location.href);
  }
  return new URL('api/', window.location.href);
}

async function boot() {
  setBootStatus('Preloading terrain and colony assets...');
  try {
    await assetLoader.load();
    assetsReady = true;
    setBootStatus('Assets ready. Checking colony authority...');
  } catch (error) {
    assetsReady = false;
    setBootStatus('Asset preload failed. Canvas fallback active.');
  }

  const local = await readLocalEnvelope();
  if (local?.state) {
    state = sanitizeState(local.state);
    pendingCommands = Array.isArray(local.pendingCommands) ? local.pendingCommands.slice(0, 80) : [];
  }
  render();
  try {
    const payload = await apiPost('sessions', { sessionId, state });
    applyServerPayload(payload);
    mode = 'online';
    setBootStatus('Authority online. Server state loaded.');
    await flushPendingCommands();
  } catch (error) {
    mode = 'offline';
    setBootStatus('Authority unavailable. Running local offline mode.');
  }
  render();
  wireEvents();
  exposeTestHooks();
  setInterval(reconnectIfNeeded, 10_000);
}

function wireEvents() {
  el.startButton.addEventListener('click', startGame);
  el.tabs.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-tab]');
    if (!button) return;
    activeTab = button.dataset.tab;
    render();
  });
  el.tabs.addEventListener('keydown', handleTabKeys);
  setupViewportControls();
  el.tickButton.addEventListener('click', () => enqueueCommand('tick'));
  el.exportButton.addEventListener('click', exportSave);
  el.importButton.addEventListener('click', importSave);
  el.resetButton.addEventListener('click', () => {
    if (window.confirm('Reset this MarsScape session?')) enqueueCommand('reset');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveLocalSoon(true);
  });
}

// MS-105: pinch/drag/wheel navigation for the isometric colony map.
const MIN_VIEW_SCALE = 0.5;
const MAX_VIEW_SCALE = 2.5;
const MAX_PAN_PX = 900;
const DRAG_THRESHOLD_PX = 6;

const viewTransform = { scale: 1, x: 0, y: 0 };
const activePointers = new Map();
let pinchStartDistance = 0;
let pinchStartScale = 1;
let panStart = null;
let viewportDragged = false;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function applyViewTransform() {
  if (!el.isoBoard) return;
  el.isoBoard.style.setProperty('--user-scale', String(viewTransform.scale));
  el.isoBoard.style.setProperty('--pan-x', `${viewTransform.x}px`);
  el.isoBoard.style.setProperty('--pan-y', `${viewTransform.y}px`);
  const moved = viewTransform.scale !== 1 || viewTransform.x !== 0 || viewTransform.y !== 0;
  if (el.viewReset) el.viewReset.hidden = !moved;
}

function setViewScale(nextScale) {
  viewTransform.scale = clamp(nextScale, MIN_VIEW_SCALE, MAX_VIEW_SCALE);
  applyViewTransform();
}

function panView(dx, dy) {
  viewTransform.x = clamp(viewTransform.x + dx, -MAX_PAN_PX, MAX_PAN_PX);
  viewTransform.y = clamp(viewTransform.y + dy, -MAX_PAN_PX, MAX_PAN_PX);
  applyViewTransform();
}

function resetView() {
  viewTransform.scale = 1;
  viewTransform.x = 0;
  viewTransform.y = 0;
  applyViewTransform();
}

function pointerDistance() {
  const [a, b] = [...activePointers.values()];
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function setupViewportControls() {
  const viewport = el.isoViewport;
  if (!viewport) return;

  viewport.addEventListener('pointerdown', (event) => {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size === 1) {
      panStart = { x: event.clientX, y: event.clientY };
      viewportDragged = false;
    } else if (activePointers.size === 2) {
      pinchStartDistance = pointerDistance();
      pinchStartScale = viewTransform.scale;
      panStart = null;
    }
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size >= 2) {
      const distance = pointerDistance();
      if (pinchStartDistance > 0 && distance > 0) {
        setViewScale(pinchStartScale * (distance / pinchStartDistance));
        viewportDragged = true;
      }
      return;
    }

    if (!panStart) return;
    const dx = event.clientX - panStart.x;
    const dy = event.clientY - panStart.y;
    if (!viewportDragged && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    viewportDragged = true;
    panStart = { x: event.clientX, y: event.clientY };
    panView(dx, dy);
    try { viewport.setPointerCapture(event.pointerId); } catch { /* capture is best-effort */ }
  });

  const endPointer = (event) => {
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) pinchStartDistance = 0;
    if (activePointers.size === 0) panStart = null;
  };
  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);
  viewport.addEventListener('pointerleave', endPointer);

  // A drag that ends over a map piece must not also fire that piece's gather command.
  viewport.addEventListener('click', (event) => {
    if (!viewportDragged) return;
    event.preventDefault();
    event.stopPropagation();
    viewportDragged = false;
  }, true);

  viewport.addEventListener('wheel', (event) => {
    event.preventDefault();
    setViewScale(viewTransform.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12));
  }, { passive: false });

  viewport.addEventListener('dblclick', resetView);
  if (el.viewReset) el.viewReset.addEventListener('click', resetView);
  applyViewTransform();
}

function handleTabKeys(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const buttons = [...el.tabs.querySelectorAll('button[data-tab]')];
  const index = buttons.findIndex((button) => button.dataset.tab === activeTab);
  let next = index;
  if (event.key === 'ArrowLeft') next = index <= 0 ? buttons.length - 1 : index - 1;
  if (event.key === 'ArrowRight') next = index >= buttons.length - 1 ? 0 : index + 1;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = buttons.length - 1;
  event.preventDefault();
  activeTab = buttons[next].dataset.tab;
  render();
  buttons[next].focus();
}

function startGame() {
  el.boot.classList.add('hide');
  el.appShell.inert = false;
  el.appShell.removeAttribute('aria-hidden');
  setTimeout(() => {
    el.boot.style.display = 'none';
    document.querySelector('#colony')?.focus();
  }, 360);
}

function enqueueCommand(type, payload = {}) {
  const command = { id: crypto.randomUUID(), type, ...payload };
  el.actionReadout.textContent = `Processing ${labelCommand(type)}...`;
  commandQueue = commandQueue
    .then(() => runCommand(command))
    .catch((error) => {
      showToast('Command blocked', error.message || 'The command could not be applied.');
      el.actionReadout.textContent = 'Command blocked';
    })
    .finally(() => render());
}

async function runCommand(command) {
  if (mode === 'online') {
    try {
      const payload = await apiPost(`sessions/${encodeURIComponent(sessionId)}/commands`, command);
      applyServerPayload(payload);
      el.actionReadout.textContent = 'Authority confirmed';
      saveLocalSoon(true);
      return;
    } catch (error) {
      mode = 'offline';
      showToast('Authority offline', 'Local fallback is active until the API returns.');
    }
  }
  const result = applyCommand(state, command);
  state = publicState(result.state);
  pendingCommands.push(command);
  el.actionReadout.textContent = 'Local command applied';
  saveLocalSoon();
}

async function flushPendingCommands() {
  if (mode !== 'online' || pendingCommands.length === 0) return;
  const queue = [...pendingCommands];
  pendingCommands = [];
  for (let index = 0; index < queue.length; index += 1) {
    try {
      const payload = await apiPost(`sessions/${encodeURIComponent(sessionId)}/commands`, queue[index]);
      applyServerPayload(payload);
    } catch (error) {
      pendingCommands = queue.slice(index);
      mode = 'offline';
      throw error;
    }
  }
  showToast('Offline queue synced', `${queue.length} queued command${queue.length === 1 ? '' : 's'} reconciled.`);
  saveLocalSoon(true);
}

async function reconnectIfNeeded() {
  if (mode === 'online') return;
  try {
    const payload = await apiPost('sessions', { sessionId, state });
    applyServerPayload(payload);
    mode = 'online';
    await flushPendingCommands();
    render();
  } catch {
    mode = 'offline';
  }
}

function render() {
  state = publicState(state);
  renderStatus();
  renderMap();
  renderPanel();
  renderLog();
  saveLocalSoon();
}

function renderStatus() {
  const oxygen = Math.round(state.meters.oxygen);
  const power = Math.round(state.meters.power);
  el.oxygenValue.textContent = `${oxygen}%`;
  el.powerValue.textContent = `${power}%`;
  el.oxygenBar.style.width = `${oxygen}%`;
  el.powerBar.style.width = `${power}%`;
  el.oxygenMeter.setAttribute('aria-valuenow', String(oxygen));
  el.powerMeter.setAttribute('aria-valuenow', String(power));
  el.solValue.textContent = String(state.sol);
  el.regionLabel.textContent = REGIONS[state.currentRegion]?.name || 'Landing Basin';
  el.authorityStatus.textContent = mode === 'online' ? `Server authority: ${sessionId.slice(0, 8)}` : 'Offline local fallback';
  el.authorityStatus.style.color = mode === 'online' ? 'var(--green)' : 'var(--ochre)';
  for (const button of el.tabs.querySelectorAll('button')) {
    const selected = button.dataset.tab === activeTab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected) el.panelBody.setAttribute('aria-labelledby', button.id);
  }
}

function nodeInCurrentRegion(node) {
  return (node.regionId || 'landing_basin') === state.currentRegion;
}

function renderMap() {
  const fragments = [];
  fragments.push(`<canvas class="terrain-canvas" width="${CANVAS_W}" height="${CANVAS_H}" aria-hidden="true"></canvas>`);
  for (const node of NODES.filter(nodeInCurrentRegion)) fragments.push(renderNode(node));
  // Buildings live only at the Landing Basin — hidden (and, server-side, rejected)
  // while away, same as MarsScape v0.4.0.
  if (state.currentRegion === 'landing_basin') {
    for (const building of BUILDINGS) fragments.push(renderBuilding(building));
  }
  const player = iso(state.player.x, state.player.y);
  fragments.push(`<span class="player-marker" style="left:${player.x}px;top:${player.y}px" aria-hidden="true"></span>`);
  el.isoBoard.innerHTML = fragments.join('');
  drawTerrain(el.isoBoard.querySelector('.terrain-canvas'));
  el.isoBoard.querySelectorAll('[data-command]').forEach((button) => {
    button.addEventListener('click', () => {
      if (isInputBlocked()) return;
      const type = button.dataset.command;
      if (type === 'gather') enqueueCommand('gather', { nodeId: button.dataset.id });
      if (type === 'service') enqueueCommand('service', { buildingId: button.dataset.id });
      if (type === 'build') {
        activeTab = 'build';
        render();
      }
    });
  });
}

function renderNode(node) {
  const nodeState = state.nodes[node.id] || {};
  const locked = node.requiresBuilding && !state.built[node.requiresBuilding];
  const depleted = nodeState.charges <= 0 || nodeState.cooldownUntil > Date.now();
  const pos = iso(node.x, node.y);
  const maxCharges = Math.max(1, node.charges);
  const remainingCharges = Math.max(0, Math.min(maxCharges, Number.isFinite(nodeState.charges) ? nodeState.charges : maxCharges));
  const label = locked
    ? `${node.name} locked`
    : depleted
      ? `${node.name} respawning`
      : `Gather ${node.name}, ${remainingCharges} of ${maxCharges} charges left`;
  return `
    <button class="map-piece node ${locked ? 'locked' : ''} ${depleted ? 'depleted' : ''}"
      type="button"
      data-command="gather"
      data-id="${node.id}"
      style="left:${pos.x}px;top:${pos.y}px;--node-color:${ITEMS[node.item].color}"
      ${locked || depleted ? 'disabled' : ''}
      aria-label="${escapeHtml(label)}">
      <span class="model"></span>
      <span class="label">${escapeHtml(node.name)}</span>
      ${renderNodeCharges(node, nodeState, locked, depleted)}
    </button>`;
}

// MS-102: an animated fill bar for remaining node health, replacing the old block glyphs.
function renderNodeCharges(node, nodeState, locked, depleted) {
  const max = Math.max(1, node.charges);
  const remaining = Math.max(0, Math.min(max, Number.isFinite(nodeState.charges) ? nodeState.charges : max));
  const pct = locked || depleted ? 0 : Math.round((remaining / max) * 100);
  const stateLabel = locked ? 'locked' : depleted ? 'respawn' : `${remaining}/${max}`;
  const tone = pct > 60 ? 'high' : pct > 25 ? 'mid' : 'low';
  return `
      <span class="charges" aria-hidden="true">
        <span class="charge-track"><i class="charge-fill ${tone}" style="width:${pct}%"></i></span>
        <span class="charge-count">${stateLabel}</span>
      </span>`;
}

function renderBuilding(building) {
  const online = !!state.built[building.id];
  const pos = iso(building.x, building.y);
  return `
    <button class="map-piece building ${online ? 'online' : 'ghost'}"
      type="button"
      data-command="${online ? 'service' : 'build'}"
      data-id="${building.id}"
      data-model="${building.model}"
      style="left:${pos.x}px;top:${pos.y}px"
      aria-label="${online ? 'Service' : 'Plan'} ${escapeHtml(building.name)}">
      <span class="model"></span>
      <span class="label">${escapeHtml(building.name)}</span>
    </button>`;
}

function renderPanel() {
  const renderers = { skills: renderSkills, pack: renderPack, build: renderBuild, forge: renderForge, research: renderResearch, travel: renderTravel };
  el.panelBody.innerHTML = renderers[activeTab]();
  el.panelBody.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'build') enqueueCommand('build', { buildingId: button.dataset.id });
      if (action === 'smelt') enqueueCommand('smelt', { recipeId: button.dataset.id });
      if (action === 'craft') enqueueCommand('craft', { recipeId: button.dataset.id });
      if (action === 'research') enqueueCommand('research', { projectId: button.dataset.id });
      if (action === 'purify') enqueueCommand('purify');
      if (action === 'plant') enqueueCommand('plant');
      if (action === 'harvest') enqueueCommand('harvest');
      if (action === 'ration') enqueueCommand('ration');
      if (action === 'storm') enqueueCommand('startStorm');
      if (action === 'travel') enqueueCommand('travel', { destRegion: button.dataset.id });
    });
  });
  wireSkillRows();
}

// MS-103: tapping a skill row toggles the same detail the hover tooltip shows.
function wireSkillRows() {
  el.panelBody.querySelectorAll('.skill-row--expandable').forEach((row) => {
    const detail = document.getElementById(row.getAttribute('aria-controls'));
    if (!detail) return;
    const toggle = () => {
      const open = detail.hidden;
      detail.hidden = !open;
      row.setAttribute('aria-expanded', String(open));
    };
    row.addEventListener('click', toggle);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });
  });
}

// MS-103: levelForXp is level = floor(sqrt(xp) / 5) + 1, so the XP floor for a level
// is 25 * (level - 1)^2. Level 99 is the cap, where there is no "next" target.
const MAX_SKILL_LEVEL = 99;

function xpForLevel(level) {
  return 25 * Math.pow(Math.max(1, level) - 1, 2);
}

function skillProgress(xp) {
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  const level = levelForXp(safeXp);
  if (level >= MAX_SKILL_LEVEL) {
    return { xp: safeXp, level, nextLevel: null, nextLevelXp: null, xpToNext: 0, percent: 100 };
  }
  const floorXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = Math.max(1, nextLevelXp - floorXp);
  return {
    xp: safeXp,
    level,
    nextLevel: level + 1,
    nextLevelXp,
    xpToNext: Math.max(0, nextLevelXp - safeXp),
    percent: Math.max(0, Math.min(100, Math.round(((safeXp - floorXp) / span) * 100))),
  };
}

// Gear modifiers that actually change this skill's outcomes in the engine.
// `speed` and `geode` are defined on equipment but not yet consumed by any
// engine rule, so they are deliberately not advertised here.
function skillModifiers(skillId) {
  const stats = equipStats(state);
  const mods = [];
  if (['mining', 'water'].includes(skillId) && stats.crit > 0) {
    mods.push(`+${stats.crit}% chance of a bonus unit per gather`);
  }
  if (skillId === 'survival' && stats.o2 > 0) {
    mods.push(`+${stats.o2}% suit O2 efficiency`);
  }
  if (['mining', 'water'].includes(skillId) && stats.pack > 0) {
    mods.push(`+${stats.pack} pack capacity (${40 + stats.pack} total)`);
  }
  return mods;
}

function skillTooltip(skillId, skill) {
  const progress = skillProgress((state.skills[skillId] || {}).xp);
  const lines = [`${skill.name} — level ${progress.level}`, `XP: ${progress.xp.toLocaleString()}`];
  if (progress.nextLevel) {
    lines.push(`Next: level ${progress.nextLevel} at ${progress.nextLevelXp.toLocaleString()} XP (${progress.xpToNext.toLocaleString()} to go)`);
  } else {
    lines.push('Level cap reached');
  }
  const mods = skillModifiers(skillId);
  lines.push(mods.length ? `Gear: ${mods.join('; ')}` : 'Gear: no equipped modifiers affect this skill');
  return lines.join('\n');
}

function renderSkills() {
  const skills = Object.entries(SKILLS).map(([id, skill]) => {
    const progress = skillProgress((state.skills[id] || {}).xp);
    const detailId = `skill-detail-${id}`;
    const nextLine = progress.nextLevel
      ? `${progress.xpToNext.toLocaleString()} XP to level ${progress.nextLevel} (target ${progress.nextLevelXp.toLocaleString()})`
      : 'Level cap reached';
    const mods = skillModifiers(id);
    return `<div class="skill-row skill-row--expandable" tabindex="0" role="button" aria-expanded="false" aria-controls="${detailId}" title="${escapeHtml(skillTooltip(id, skill))}" data-skill="${id}">
      <span>${escapeHtml(skill.name)} L${progress.level}</span>
      <span class="skill-bar"><i style="width:${progress.percent}%;background:${skill.accent}"></i></span>
      <b>${progress.xp}</b>
    </div>
    <div class="skill-detail" id="${detailId}" hidden>
      <p>${escapeHtml(nextLine)}</p>
      <p>${escapeHtml(mods.length ? `Gear: ${mods.join(' · ')}` : 'Gear: no equipped modifiers affect this skill.')}</p>
    </div>`;
  }).join('');
  const storm = state.storm.status === 'ready'
    ? '<div class="card"><h3>Great Storm Ready</h3><p>Start only with strong reserves. O2 and Power must stay above 50%.</p><button data-action="storm">Begin Great Storm</button></div>'
    : '';
  return `<div class="card"><h3>Colonist Skills</h3><p>Every confirmed server command trains a skill. Current pickaxe: ${escapeHtml(state.gear.pickaxe)}.</p><div class="skill-list">${skills}</div></div>${storm}`;
}

function renderPack() {
  const slots = Object.entries(ITEMS).map(([id, item]) => `<div class="slot"><span>${escapeHtml(item.short)}</span><b>${state.inventory[id] || 0}</b></div>`).join('');
  const stats = equipStats(state);
  const equipRows = EQUIP_SLOTS.map((slot) => `<div class="skill-row"><span>${escapeHtml(capitalize(slot))}</span><b>${state.equip[slot] ? escapeHtml(capitalize(state.equip[slot])) : 'empty'}</b></div>`).join('');
  const statLine = `O2 efficiency +${stats.o2}% · quality chance +${stats.crit}% · pack capacity +${stats.pack} — craft gear at the Forge`;
  return `<div class="card"><h3>Field Pack</h3><p>Server state owns resource totals when authority is online.</p><div class="inventory-grid">${slots}</div></div><div class="card"><h3>Equipment</h3><p>${statLine}</p><div class="skill-list">${equipRows}</div></div><div class="card"><h3>Field Actions</h3><button data-action="purify" ${!state.built.water ? 'disabled' : ''}>Purify Ice to Water</button><button data-action="plant" ${!state.built.greenhouse || state.farm.plantedAt && !state.farm.ready ? 'disabled' : ''}>Plant Greenhouse Crop</button><button data-action="harvest" ${!state.farm.ready ? 'disabled' : ''}>Harvest Food</button><button data-action="ration" ${(state.inventory.food || 0) < 1 ? 'disabled' : ''}>Ration Food</button></div>`;
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function renderBuild() {
  return BUILDINGS.map((building) => {
    const online = !!state.built[building.id];
    return `<div class="card"><h3>${escapeHtml(building.name)}</h3><p>${escapeHtml(building.description)}</p>${renderCost(building.cost)}<button data-action="build" data-id="${building.id}" ${online || !canAfford(building.cost) ? 'disabled' : ''}>${online ? 'Online' : 'Build'}</button></div>`;
  }).join('');
}

function renderForge() {
  const smelt = SMELT_RECIPES.map((recipe) => `<div class="card"><h3>${escapeHtml(recipe.name)}</h3>${renderCost(recipe.input)}<button data-action="smelt" data-id="${recipe.id}" ${!canAfford(recipe.input) ? 'disabled' : ''}>Smelt</button></div>`).join('');
  const craft = CRAFT_RECIPES.map((recipe) => {
    const gated = recipe.lvl && (state.skills.fabrication?.level || 1) < recipe.lvl;
    const desc = recipe.description ? `<p>${escapeHtml(recipe.description)}</p>` : '';
    const lvlNote = recipe.lvl ? `<p class="muted">Requires Fabrication ${recipe.lvl}.</p>` : '';
    return `<div class="card"><h3>${escapeHtml(recipe.name)}</h3>${desc}${lvlNote}${renderCost(recipe.input)}<button data-action="craft" data-id="${recipe.id}" ${!canAfford(recipe.input) || gated ? 'disabled' : ''}>Fabricate</button></div>`;
  }).join('');
  return `<div class="card"><h3>Smelting</h3><p>Bars consume power and train Fabrication.</p></div>${smelt}<div class="card"><h3>Crafting</h3></div>${craft}`;
}

function renderResearch() {
  return RESEARCH.map((project) => {
    const done = !!state.research[project.id];
    return `<div class="card"><h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.description)}</p>${renderCost(project.input)}<button data-action="research" data-id="${project.id}" ${done || !state.built.lab || !canAfford(project.input) ? 'disabled' : ''}>${done ? 'Researched' : 'Research'}</button></div>`;
  }).join('');
}

const TRAVEL_FUEL_COST = 1;

function renderTravel() {
  if (state.travel) {
    const region = REGIONS[state.travel.destRegion];
    const remainingMs = Math.max(0, state.travel.arrivalAt - Date.now());
    return `<div class="card"><h3>En Route</h3><p>Driving to ${escapeHtml(region?.name || state.travel.destRegion)} — arriving in about ${Math.ceil(remainingMs / 1000)}s.</p></div>`;
  }
  const rover = ROVERS[state.rover];
  const pilotLevel = state.skills.piloting?.level || 1;
  const cards = Object.entries(REGIONS).map(([id, region]) => {
    if (id === state.currentRegion) {
      return `<div class="card"><h3>${escapeHtml(region.name)}</h3><p>You are here.</p></div>`;
    }
    const gateOk = !region.gate || pilotLevel >= region.gate.lvl;
    const gateText = region.gate && !gateOk ? `Requires ${escapeHtml(SKILLS[region.gate.skill].name)} ${region.gate.lvl}.` : '';
    const hasFuel = (state.inventory.fuel || 0) >= TRAVEL_FUEL_COST;
    const eta = region.home ? 0 : previewTravelMs(region);
    return `<div class="card"><h3>${escapeHtml(region.name)}</h3>${gateText ? `<p>${gateText}</p>` : `<p>${Math.round(eta / 1000)}s by ${escapeHtml(rover.name)} · ${TRAVEL_FUEL_COST} Fuel Cell</p>`}<button data-action="travel" data-id="${id}" ${!gateOk || !hasFuel ? 'disabled' : ''}>Drive here</button></div>`;
  }).join('');
  return `<div class="card"><h3>Rover</h3><p>${escapeHtml(rover.name)} · Piloting L${pilotLevel} · ${state.inventory.fuel || 0} Fuel Cells in the pack.</p></div>${cards}`;
}

// Client-side preview only — the server (engine.mjs travelDurationMs) is authoritative
// and recomputes this itself when the travel command is applied.
function previewTravelMs(region) {
  const roverMult = ROVERS[state.rover]?.mult ?? 1;
  const pilotCut = Math.floor((state.skills.piloting?.level || 1) / 8);
  const ticks = Math.max(4, Math.round(region.baseTravelTicks * roverMult) - pilotCut);
  return ticks * 600;
}

function renderCost(cost) {
  const entries = Object.entries(cost || {});
  if (!entries.length) return '<div class="cost-list"><span class="pill ok">Prebuilt</span></div>';
  return `<div class="cost-list">${entries.map(([id, qty]) => `<span class="pill ${(state.inventory[id] || 0) >= qty ? 'ok' : 'no'}">${qty} ${escapeHtml(ITEMS[id].name)}</span>`).join('')}</div>`;
}

function renderLog() {
  el.eventLog.innerHTML = state.events.map((event) => `<p class="${event.tone}">${escapeHtml(event.text)}</p>`).join('');
}

function canAfford(cost = {}) {
  return Object.entries(cost).every(([id, qty]) => (state.inventory[id] || 0) >= qty);
}

function iso(x, y) {
  return { x: (x - y) * TILE_W, y: (x + y) * TILE_H };
}

function drawTerrain(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const texture = assetsReady ? assetLoader.get('terrain') : null;
  if (texture) {
    const pattern = ctx.createPattern(texture, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.globalAlpha = 0.14;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = 1;
    }
  }

  ctx.save();
  ctx.translate(CANVAS_ORIGIN_X, CANVAS_ORIGIN_Y);
  drawBoardShadow(ctx);
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      drawTile(ctx, x, y);
    }
  }
  for (const node of NODES.filter(nodeInCurrentRegion)) drawNodeModel(ctx, node);
  if (state.currentRegion === 'landing_basin') {
    for (const building of BUILDINGS) drawBuildingModel(ctx, building);
  }
  drawPlayerModel(ctx);
  drawBoardEdge(ctx);
  ctx.restore();
}

function drawBoardShadow(ctx) {
  const north = iso(0, 0);
  const east = iso(BOARD_SIZE - 1, 0);
  const south = iso(BOARD_SIZE - 1, BOARD_SIZE - 1);
  const west = iso(0, BOARD_SIZE - 1);
  ctx.beginPath();
  ctx.moveTo(north.x, north.y + 18);
  ctx.lineTo(east.x + 39, east.y + 24);
  ctx.lineTo(south.x, south.y + 54);
  ctx.lineTo(west.x - 39, west.y + 24);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fill();
}

function drawTile(ctx, x, y) {
  const pos = iso(x, y);
  const variant = hash2(x, y);
  const fills = ['#8e3f27', '#a64f2c', '#b96535', '#7d3929', '#c4783e'];
  const fill = fills[variant % fills.length];
  diamond(ctx, pos.x, pos.y, 66, 34);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = variant % 4 === 0 ? '#d89155' : '#5f2d20';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  diamond(ctx, pos.x - 1, pos.y - 4, 45, 20);
  ctx.fillStyle = variant % 2 ? 'rgba(255, 218, 141, 0.13)' : 'rgba(33, 18, 13, 0.18)';
  ctx.fill();

  if (variant % 6 === 0) {
    ctx.beginPath();
    ctx.arc(pos.x + 8, pos.y + 2, 2, 0, Math.PI * 2);
    ctx.arc(pos.x - 12, pos.y + 7, 1.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(39, 21, 15, 0.36)';
    ctx.fill();
  }
}

function drawNodeShadow(ctx, node) {
  const pos = iso(node.x, node.y);
  const nodeState = state.nodes[node.id] || {};
  const locked = node.requiresBuilding && !state.built[node.requiresBuilding];
  const depleted = nodeState.charges <= 0 || nodeState.cooldownUntil > Date.now();
  diamond(ctx, pos.x, pos.y + 7, 48, 20);
  ctx.fillStyle = locked || depleted ? 'rgba(0, 0, 0, 0.16)' : 'rgba(18, 12, 10, 0.38)';
  ctx.fill();
}

function drawNodeModel(ctx, node) {
  drawNodeShadow(ctx, node);
  const pos = iso(node.x, node.y);
  const nodeState = state.nodes[node.id] || {};
  const locked = node.requiresBuilding && !state.built[node.requiresBuilding];
  const depleted = nodeState.charges <= 0 || nodeState.cooldownUntil > Date.now();
  ctx.save();
  ctx.globalAlpha = locked || depleted ? 0.34 : 1;
  const color = ITEMS[node.item]?.color || '#d6d0c4';
  ctx.beginPath();
  ctx.moveTo(pos.x - 18, pos.y - 3);
  ctx.lineTo(pos.x - 5, pos.y - 23);
  ctx.lineTo(pos.x + 19, pos.y - 18);
  ctx.lineTo(pos.x + 28, pos.y + 3);
  ctx.lineTo(pos.x + 9, pos.y + 14);
  ctx.lineTo(pos.x - 15, pos.y + 10);
  ctx.closePath();
  ctx.fillStyle = '#423024';
  ctx.fill();
  ctx.strokeStyle = '#18100c';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pos.x - 4, pos.y - 15);
  ctx.lineTo(pos.x + 13, pos.y - 12);
  ctx.lineTo(pos.x + 19, pos.y + 1);
  ctx.lineTo(pos.x + 4, pos.y + 7);
  ctx.lineTo(pos.x - 8, pos.y + 4);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha *= 0.4;
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y - 11);
  ctx.lineTo(pos.x + 13, pos.y - 8);
  ctx.strokeStyle = '#fff0c4';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function drawBuildingPad(ctx, building) {
  const pos = iso(building.x, building.y);
  const online = !!state.built[building.id];
  diamond(ctx, pos.x, pos.y + 5, 78, 34);
  ctx.fillStyle = online ? 'rgba(76, 156, 151, 0.18)' : 'rgba(230, 197, 129, 0.08)';
  ctx.fill();
  ctx.strokeStyle = online ? 'rgba(117, 213, 203, 0.46)' : 'rgba(229, 188, 116, 0.28)';
  ctx.stroke();
}

function drawBuildingModel(ctx, building) {
  drawBuildingPad(ctx, building);
  const pos = iso(building.x, building.y);
  const online = !!state.built[building.id];
  ctx.save();
  ctx.globalAlpha = online ? 1 : 0.36;
  const palette = {
    dome: ['#d8c39d', '#796449', '#2e5560'],
    array: ['#66b5bf', '#285c68', '#16313c'],
    tower: ['#b8d4d6', '#5e7674', '#2f4545'],
    foundry: ['#a06f49', '#463224', '#e09a4c'],
    glass: ['#b6edda', '#4a937b', '#2e5548'],
    scope: ['#d8c39d', '#554536', '#81d2d3'],
    reactor: ['#d8d4bd', '#5d5143', '#63c7e1'],
  }[building.model] || ['#d8c39d', '#796449', '#2e5560'];

  if (building.model === 'array') {
    drawPrism(ctx, pos.x - 18, pos.y - 26, 74, 18, palette[0], palette[1]);
    ctx.strokeStyle = palette[2];
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(pos.x - 44 + i * 18, pos.y - 26 + i * 1);
      ctx.lineTo(pos.x + 14 + i * 18, pos.y - 42 + i * 1);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (building.model === 'glass') {
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y - 18, 27, 18, 0, Math.PI, 0);
    ctx.lineTo(pos.x + 27, pos.y + 5);
    ctx.quadraticCurveTo(pos.x, pos.y + 18, pos.x - 27, pos.y + 5);
    ctx.closePath();
    ctx.fillStyle = palette[0];
    ctx.fill();
    ctx.strokeStyle = '#173c37';
    ctx.stroke();
    ctx.restore();
    return;
  }

  const height = building.model === 'reactor' || building.model === 'tower' ? 44 : 34;
  drawPrism(ctx, pos.x, pos.y - height / 2, 50, height, palette[0], palette[1]);
  ctx.fillStyle = palette[2];
  ctx.fillRect(pos.x - 9, pos.y - height / 2 + 12, 18, 12);
  ctx.strokeStyle = '#18100c';
  ctx.strokeRect(pos.x - 9, pos.y - height / 2 + 12, 18, 12);
  if (building.model === 'reactor' && online) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - 27, 14, 0, Math.PI * 2);
    ctx.strokeStyle = '#63c7e1';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

function drawPrism(ctx, x, y, width, height, light, dark) {
  const half = width / 2;
  ctx.beginPath();
  ctx.moveTo(x, y - height / 2);
  ctx.lineTo(x + half, y - height / 2 + 16);
  ctx.lineTo(x + half, y + height / 2);
  ctx.lineTo(x, y + height / 2 + 16);
  ctx.lineTo(x - half, y + height / 2);
  ctx.lineTo(x - half, y - height / 2 + 16);
  ctx.closePath();
  ctx.fillStyle = light;
  ctx.fill();
  ctx.strokeStyle = '#1a100c';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + half, y - height / 2 + 16);
  ctx.lineTo(x + half, y + height / 2);
  ctx.lineTo(x, y + height / 2 + 16);
  ctx.lineTo(x, y - height / 2);
  ctx.closePath();
  ctx.fillStyle = dark;
  ctx.globalAlpha *= 0.82;
  ctx.fill();
  ctx.globalAlpha = Math.min(1, ctx.globalAlpha / 0.82);
}

function drawPlayerModel(ctx) {
  const pos = iso(state.player.x, state.player.y);
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + 8, 15, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#efe9d4';
  ctx.strokeStyle = '#172d31';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(pos.x - 10, pos.y - 29, 20, 30, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#173a44';
  ctx.fillRect(pos.x - 7, pos.y - 24, 14, 7);
  ctx.fillStyle = '#79d6df';
  ctx.fillRect(pos.x - 5, pos.y - 22, 10, 3);
  ctx.restore();
}

function drawBoardEdge(ctx) {
  for (let i = 0; i < BOARD_SIZE; i += 1) {
    const west = iso(0, i);
    const south = iso(i, BOARD_SIZE - 1);
    drawRim(ctx, west.x - 33, west.y, west.x, west.y + 17, west.x, west.y + 26, west.x - 33, west.y + 10);
    drawRim(ctx, south.x, south.y + 17, south.x + 33, south.y, south.x + 33, south.y + 10, south.x, south.y + 27);
  }
}

function drawRim(ctx, x1, y1, x2, y2, x3, y3, x4, y4) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fillStyle = '#4d2118';
  ctx.fill();
}

function diamond(ctx, x, y, width, height) {
  ctx.beginPath();
  ctx.moveTo(x, y - height / 2);
  ctx.lineTo(x + width / 2, y);
  ctx.lineTo(x, y + height / 2);
  ctx.lineTo(x - width / 2, y);
  ctx.closePath();
}

function hash2(x, y) {
  return Math.abs(Math.imul(x + 31, 73856093) ^ Math.imul(y + 17, 19349663));
}

async function apiPost(path, body) {
  const response = await fetch(new URL(path, API_BASE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `API request failed (${response.status})`);
  }
  return data;
}

function applyServerPayload(payload) {
  if (!payload?.state) throw new Error('Authority returned no state');
  sessionId = payload.sessionId || sessionId;
  state = publicState(payload.state);
  localStorage.setItem(SESSION_KEY, sessionId);
  saveLocalSoon(true, payload.signature);
}

function saveLocalSoon(immediate = false, signature = '') {
  clearTimeout(saveTimer);
  const write = () => writeLocalEnvelope(signature).catch(() => {
    showToast('Save skipped', 'Local save signing failed. Server authority still owns online progress.');
  });
  if (immediate) return write();
  else {
    saveTimer = setTimeout(() => {
      if (window.requestIdleCallback) window.requestIdleCallback(write, { timeout: 1000 });
      else window.setTimeout(write, 250);
    }, 900);
  }
  return undefined;
}

async function writeLocalEnvelope(signature = '') {
  const envelope = {
    sessionId,
    mode,
    signature,
    savedAt: Date.now(),
    state: sanitizeState(state),
    pendingCommands: cleanPendingCommands(pendingCommands),
    hmacVersion: 1,
  };
  const payload = localEnvelopePayload(envelope);
  envelope.localHmac = await localSigner.sign(payload);
  envelope.checksum = checksum(payload);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

async function readLocalEnvelope() {
  try {
    const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!envelope?.state) return null;
    if (!(await verifyLocalEnvelope(envelope))) return null;
    return envelope;
  } catch {
    return null;
  }
}

async function exportSave() {
  await saveLocalSoon(true);
  const data = localStorage.getItem(STORAGE_KEY) || '';
  window.prompt('Copy this MarsScape save envelope:', btoa(unescape(encodeURIComponent(data))));
}

// MS-104: validate the pasted code in stages so a malformed paste reports what is
// actually wrong instead of dropping the player into a half-parsed game state.
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function validateSaveCode(raw) {
  const trimmed = String(raw ?? '').trim().replace(/\s+/g, '');
  if (!trimmed) return { ok: false, reason: 'That paste was empty. Copy the full save code from Export Save.' };
  if (!BASE64_PATTERN.test(trimmed) || trimmed.length % 4 !== 0) {
    return { ok: false, reason: 'That code is not valid base64. It was probably truncated or line-wrapped on the way over.' };
  }

  let decoded;
  try {
    decoded = decodeURIComponent(escape(atob(trimmed)));
  } catch {
    return { ok: false, reason: 'That code could not be decoded. Copy it again without adding or removing characters.' };
  }

  let envelope;
  try {
    envelope = JSON.parse(decoded);
  } catch {
    return { ok: false, reason: 'The decoded save is not valid JSON. The code is corrupted.' };
  }

  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return { ok: false, reason: 'The decoded save is not a MarsScape envelope.' };
  }
  if (!envelope.state || typeof envelope.state !== 'object' || Array.isArray(envelope.state)) {
    return { ok: false, reason: 'That envelope has no colony state in it.' };
  }
  if (typeof envelope.localHmac !== 'string' || !envelope.localHmac) {
    return { ok: false, reason: 'That envelope is unsigned, so it cannot be trusted.' };
  }
  return { ok: true, envelope };
}

async function importSave() {
  const raw = window.prompt('Paste a MarsScape save envelope:');
  if (raw === null) return;

  const validation = validateSaveCode(raw);
  if (!validation.ok) {
    window.alert(`Import failed\n\n${validation.reason}`);
    showToast('Import failed', validation.reason);
    return;
  }

  const { envelope } = validation;
  try {
    if (!(await verifyLocalEnvelope(envelope))) {
      throw new Error('Unsigned or tampered envelope');
    }
    state = publicState(sanitizeState(envelope.state));
    sessionId = envelope.sessionId || getOrCreateSessionId(true);
    mode = 'offline';
    saveLocalSoon(true);
    render();
    showToast('Save imported', 'Imported locally. Authority will reconcile when the API is available.');
  } catch {
    const reason = 'That save was signed by another browser, or its contents were changed after signing.';
    window.alert(`Import failed\n\n${reason}`);
    showToast('Import failed', reason);
  }
}

function getOrCreateSessionId(force = false) {
  if (!force) {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
  }
  const next = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, next);
  return next;
}

async function verifyLocalEnvelope(envelope) {
  const payload = localEnvelopePayload(envelope);
  if (envelope.localHmac) return localSigner.verify(payload, envelope.localHmac);
  return !!envelope.checksum && envelope.checksum === checksum(payload);
}

function localEnvelopePayload(envelope) {
  return JSON.stringify({
    sessionId: typeof envelope.sessionId === 'string' ? envelope.sessionId : '',
    mode: typeof envelope.mode === 'string' ? envelope.mode : '',
    signature: typeof envelope.signature === 'string' ? envelope.signature : '',
    state: sanitizeState(envelope.state),
    pendingCommands: cleanPendingCommands(envelope.pendingCommands),
  });
}

function cleanPendingCommands(commands) {
  if (!Array.isArray(commands)) return [];
  return commands.slice(-80).map((command) => {
    if (!command || typeof command !== 'object') return null;
    const clean = {};
    for (const [key, value] of Object.entries(command)) {
      if (['id', 'type', 'nodeId', 'buildingId', 'recipeId', 'projectId', 'destRegion'].includes(key) && typeof value === 'string') {
        clean[key] = value.slice(0, 80);
      }
    }
    return clean.id && clean.type ? clean : null;
  }).filter(Boolean);
}

function labelCommand(type) {
  return type.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`);
}

function isInputBlocked() {
  return el.appShell.inert || el.appShell.getAttribute('aria-hidden') === 'true';
}

function setBootStatus(text) {
  el.bootStatus.textContent = text;
}

function showToast(title, message) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.innerHTML = `<b>${escapeHtml(title)}</b><span>${escapeHtml(message)}</span>`;
  el.toastStack.appendChild(node);
  setTimeout(() => node.remove(), 4500);
}

function checksum(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlToBytes(value) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function exposeTestHooks() {
  if (!LOCAL_HOSTS.has(window.location.hostname)) return;
  window.render_game_to_text = () => JSON.stringify({
    mode,
    coordinates: 'isometric board, x east, y south, origin top corner',
    sol: state.sol,
    meters: state.meters,
    player: state.player,
    inventory: state.inventory,
    built: state.built,
    currentRegion: state.currentRegion,
    rover: state.rover,
    travel: state.travel,
    equip: state.equip,
    activeTab,
    events: state.events.slice(0, 5),
    viewport: { ...viewTransform },
    skills: Object.fromEntries(Object.keys(SKILLS).map((id) => [id, skillProgress((state.skills[id] || {}).xp)])),
  });
  window.validateSaveCode = validateSaveCode;
  window.advanceTime = (ms = 5000) => {
    state = publicState(advanceState({ ...state, lastTickAt: state.lastTickAt - ms }, Date.now()));
    render();
    return window.render_game_to_text();
  };
}
