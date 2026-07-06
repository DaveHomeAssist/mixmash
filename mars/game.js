import {
  BUILDINGS,
  CRAFT_RECIPES,
  ITEMS,
  NODES,
  RESEARCH,
  SKILLS,
  SMELT_RECIPES,
  advanceState,
  applyCommand,
  createState,
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
  isoBoard: document.querySelector('#isoBoard'),
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
  el.authorityStatus.textContent = mode === 'online' ? `Server authority: ${sessionId.slice(0, 8)}` : 'Offline local fallback';
  el.authorityStatus.style.color = mode === 'online' ? 'var(--green)' : 'var(--ochre)';
  for (const button of el.tabs.querySelectorAll('button')) {
    const selected = button.dataset.tab === activeTab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected) el.panelBody.setAttribute('aria-labelledby', button.id);
  }
}

function renderMap() {
  const fragments = [];
  fragments.push(`<canvas class="terrain-canvas" width="${CANVAS_W}" height="${CANVAS_H}" aria-hidden="true"></canvas>`);
  for (const node of NODES) fragments.push(renderNode(node));
  for (const building of BUILDINGS) fragments.push(renderBuilding(building));
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
  const label = locked ? `${node.name} locked` : depleted ? `${node.name} respawning` : `Gather ${node.name}`;
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
      <span class="charges">${locked ? 'locked' : depleted ? 'respawn' : '■'.repeat(Math.max(1, nodeState.charges || node.charges))}</span>
    </button>`;
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
  const renderers = { skills: renderSkills, pack: renderPack, build: renderBuild, forge: renderForge, research: renderResearch };
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
    });
  });
}

function renderSkills() {
  const skills = Object.entries(SKILLS).map(([id, skill]) => {
    const current = state.skills[id] || { xp: 0, level: 1 };
    const progress = Math.min(100, Math.round((Math.sqrt(current.xp) % 5) * 20));
    return `<div class="skill-row"><span>${escapeHtml(skill.name)} L${current.level}</span><span class="skill-bar"><i style="width:${progress}%;background:${skill.accent}"></i></span><b>${current.xp}</b></div>`;
  }).join('');
  const storm = state.storm.status === 'ready'
    ? '<div class="card"><h3>Great Storm Ready</h3><p>Start only with strong reserves. O2 and Power must stay above 50%.</p><button data-action="storm">Begin Great Storm</button></div>'
    : '';
  return `<div class="card"><h3>Colonist Skills</h3><p>Every confirmed server command trains a skill. Current pickaxe: ${escapeHtml(state.gear.pickaxe)}.</p><div class="skill-list">${skills}</div></div>${storm}`;
}

function renderPack() {
  const slots = Object.entries(ITEMS).map(([id, item]) => `<div class="slot"><span>${escapeHtml(item.short)}</span><b>${state.inventory[id] || 0}</b></div>`).join('');
  return `<div class="card"><h3>Field Pack</h3><p>Server state owns resource totals when authority is online.</p><div class="inventory-grid">${slots}</div></div><div class="card"><h3>Field Actions</h3><button data-action="purify" ${!state.built.water ? 'disabled' : ''}>Purify Ice to Water</button><button data-action="plant" ${!state.built.greenhouse || state.farm.plantedAt && !state.farm.ready ? 'disabled' : ''}>Plant Greenhouse Crop</button><button data-action="harvest" ${!state.farm.ready ? 'disabled' : ''}>Harvest Food</button><button data-action="ration" ${(state.inventory.food || 0) < 1 ? 'disabled' : ''}>Ration Food</button></div>`;
}

function renderBuild() {
  return BUILDINGS.map((building) => {
    const online = !!state.built[building.id];
    return `<div class="card"><h3>${escapeHtml(building.name)}</h3><p>${escapeHtml(building.description)}</p>${renderCost(building.cost)}<button data-action="build" data-id="${building.id}" ${online || !canAfford(building.cost) ? 'disabled' : ''}>${online ? 'Online' : 'Build'}</button></div>`;
  }).join('');
}

function renderForge() {
  const smelt = SMELT_RECIPES.map((recipe) => `<div class="card"><h3>${escapeHtml(recipe.name)}</h3>${renderCost(recipe.input)}<button data-action="smelt" data-id="${recipe.id}" ${!canAfford(recipe.input) ? 'disabled' : ''}>Smelt</button></div>`).join('');
  const craft = CRAFT_RECIPES.map((recipe) => `<div class="card"><h3>${escapeHtml(recipe.name)}</h3>${renderCost(recipe.input)}<button data-action="craft" data-id="${recipe.id}" ${!canAfford(recipe.input) ? 'disabled' : ''}>Fabricate</button></div>`).join('');
  return `<div class="card"><h3>Smelting</h3><p>Bars consume power and train Fabrication.</p></div>${smelt}<div class="card"><h3>Crafting</h3></div>${craft}`;
}

function renderResearch() {
  return RESEARCH.map((project) => {
    const done = !!state.research[project.id];
    return `<div class="card"><h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.description)}</p>${renderCost(project.input)}<button data-action="research" data-id="${project.id}" ${done || !state.built.lab || !canAfford(project.input) ? 'disabled' : ''}>${done ? 'Researched' : 'Research'}</button></div>`;
  }).join('');
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
  for (const node of NODES) drawNodeModel(ctx, node);
  for (const building of BUILDINGS) drawBuildingModel(ctx, building);
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

async function importSave() {
  const raw = window.prompt('Paste a MarsScape save envelope:');
  if (!raw) return;
  try {
    const envelope = JSON.parse(decodeURIComponent(escape(atob(raw.trim()))));
    if (!envelope?.state) throw new Error('Missing state');
    if (!(await verifyLocalEnvelope(envelope))) throw new Error('Unsigned or tampered envelope');
    state = publicState(envelope.state);
    sessionId = envelope.sessionId || getOrCreateSessionId(true);
    mode = 'offline';
    saveLocalSoon(true);
    render();
    showToast('Save imported', 'Imported locally. Authority will reconcile when the API is available.');
  } catch {
    showToast('Import failed', 'That save envelope was unsigned, tampered with, or signed by another browser.');
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
      if (['id', 'type', 'nodeId', 'buildingId', 'recipeId', 'projectId'].includes(key) && typeof value === 'string') {
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
    activeTab,
    events: state.events.slice(0, 5),
  });
  window.advanceTime = (ms = 5000) => {
    state = publicState(advanceState({ ...state, lastTickAt: state.lastTickAt - ms }, Date.now()));
    render();
    return window.render_game_to_text();
  };
}
