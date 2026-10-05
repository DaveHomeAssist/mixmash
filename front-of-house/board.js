// Front of House isometric board.
//
// Draws the lot, the placed objects, the sightline cone, the build cursor and the
// show-night crowd and lighting on one canvas. Props use the stand-in sprites in
// ./sprites once all of them have loaded, and the code-drawn boxes until then (and
// for a stage turned away from the viewer, which has no art).

import * as D from './data.mjs';
import { clipGround } from './site-map-geometry.mjs';
import { footprint } from './engine.mjs';
import { SERVICE_COLORS } from './service-crowd.mjs';

const COLORS = {
  lot: '#2a2d34',
  lotAlt: '#2e3139',
  edge: '#23262c',
  grid: 'rgba(255,255,255,0.045)',
  stall: 'rgba(241,245,249,0.10)',
  clear: 'rgba(6,182,212,0.18)',
  blocked: 'rgba(239,68,68,0.28)',
  fence: '#9ca3af',
  cursor: '#facc15',
  invalid: '#ef4444',
  crowd: ['#06b6d4', '#f43f5e', '#84cc16', '#fef08a', '#8b5cf6', '#f1f5f9'],
  rain: 'rgba(160,200,255,0.35)',
  night: 'rgba(11,15,25,0.74)',
};

const FLOORS = {
  lot: { lot: '#2a2d34', lotAlt: '#2e3139', edge: '#23262c' },
  club: { lot: '#2c2428', lotAlt: '#34282e', edge: '#1c1618' },
  amphitheater: { lot: '#243028', lotAlt: '#2c3a2e', edge: '#1a241c' },
  festival: { lot: '#303626', lotAlt: '#38422c', edge: '#22281c' },
};

// Every prop's geometry in one table: the interim render contract for the stand-in
// sprites until the one ART_DIRECTION.md asks for replaces it.
//   box     the code-drawn fallback: face colours and height in tiles.
//   sprite  the stand-in image: `w` is its width as a fraction of the footprint's
//           on-screen width, or `h` its height in the same unit (the PAs, so the
//           medium PA reads taller than the small one); `foot` is the fraction of the
//           image above its base point; `lamp` is the light tower's lamp head as a
//           fraction of the image height from the top.
// Markers and beams anchor to the drawn sprite, so they follow the art, not the box.
const PROPS = {
  stage: { box: { top: '#3a3d45', side: '#1c1d21', front: '#141518', height: 0.5 }, sprite: { w: 1.08, foot: 0.93 } },
  'pa-s': { box: { top: '#4b4f5a', side: '#22242a', front: '#1a1b20', height: 1.4 }, sprite: { h: 1.15, foot: 0.97 } },
  'pa-m': { box: { top: '#5d6270', side: '#2a2c33', front: '#1f2026', height: 1.9 }, sprite: { h: 1.55, foot: 0.97 } },
  'vip-deck': { box: { top: '#717580', side: '#444952', front: '#343b43', height: 1.6 } },
  'bus-compound': { box: { top: '#999fa8', side: '#515b69', front: '#252f3b', height: 1.8 } },
  delay: { box: { top: '#536271', side: '#344250', front: '#162532', height: 4, thin: true } },
  lights: { box: { top: '#9ca3af', side: '#6b7280', front: '#4b5563', height: 2.6, thin: true }, sprite: { w: 0.62, foot: 0.98, lamp: 0.1 } },
  bar: { box: { top: '#f43f5e', side: '#a8263c', front: '#7f1d2e', height: 0.8 }, sprite: { w: 1.35, foot: 0.94 } },
  trailer: { box: { top: '#b6a5c8', side: '#806997', front: '#514164', height: 1.4 } },
  food: { box: { top: '#5faf92', side: '#32785e', front: '#1f5742', height: 1.1 } },
  restroom: { box: { top: '#3b82f6', side: '#1d4ed8', front: '#1e3a8a', height: 1.3 }, sprite: { w: 0.72, foot: 0.97 } },
  gate: { box: { top: '#84cc16', side: '#4d7c0f', front: '#3f6212', height: 0.25 }, sprite: { w: 1.15, foot: 0.96 } },
  exit: { box: { top: '#ef4444', side: '#b91c1c', front: '#7f1d1d', height: 0.25 }, sprite: { w: 1.05, foot: 0.96 } },
};

// Box colours and heights, exported so the panel's palette swatches match the board.
export const LOOK = Object.fromEntries(Object.entries(PROPS).map(([id, p]) => [id, p.box]));
// Sprite fit per prop, exported for the asset manifest (docs/ASSETS.md, tools/docs.mjs).
export const SPRITE_FIT = Object.fromEntries(Object.entries(PROPS).filter(([, p]) => p.sprite).map(([id, p]) => [id, { ...p.sprite }]));
// A room's pillars are part of the building: always a code-drawn box, never placed or removed.
const PILLAR = { top: '#5c534c', side: '#3f3833', front: '#2c2724', height: 2.4 };
const lookOf = (o) => (o.type === 'pillar' ? PILLAR : LOOK[o.type]);

// The sprites switch on together, once every image has decoded, with one redraw.
const spriteImages = {};
const spriteListeners = new Set();
let spritesReady = false;

if (typeof Image !== 'undefined') {
  const loads = Object.keys(PROPS).filter(id => PROPS[id].sprite).map((id) => {
    const img = new Image();
    img.src = new URL(`./sprites/${id}.png`, import.meta.url).href;
    spriteImages[id] = img;
    return img.decode().catch(() => {}); // a sprite that fails to load keeps its box
  });
  Promise.all(loads).then(() => {
    spritesReady = true;
    spriteListeners.forEach((fn) => fn());
    spriteListeners.clear();
  });
}

// Alpha masks for hit-testing clicks against the drawn sprites, built on first use.
const spriteMasks = {};
function spriteMask(type) {
  if (spriteMasks[type]) return spriteMasks[type];
  const img = spriteImages[type];
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const mask = new Uint8Array(c.width * c.height);
  for (let i = 0; i < mask.length; i += 1) mask[i] = data[i * 4 + 3] > 32 ? 1 : 0;
  spriteMasks[type] = { w: c.width, h: c.height, mask };
  return spriteMasks[type];
}

const FIXTURES = {
  par: { r: 254, g: 240, b: 138, spread: 1.6, intensity: 0.55 },
  cyan: { r: 0, g: 240, b: 255, spread: 1.0, intensity: 0.6 },
  magenta: { r: 255, g: 0, b: 127, spread: 1.0, intensity: 0.55 },
  wash: { r: 139, g: 92, b: 246, spread: 2.6, intensity: 0.35 },
};

export function createBoard(canvas, { cacheFloor = true } = {}) {
  const ctx = canvas.getContext('2d');
  let view = { tw: 32, th: 16, ox: 0, oy: 0, cssW: 0, cssH: 0, dpr: 1, safe: { x: 0, y: 0, w: 0, h: 0 } };
  let clear = null; // the part of the canvas the HUD leaves clear (docs/HUD.md section 5), or the whole canvas
  let crowdCache = { key: '', tiles: [] };
  const floorCache = { canvas: null, context: null, key: null, tiles: null, builds: 0, hits: 0, failed: false };
  let lastScene = null;
  let drawn = []; // the props drawn as sprites in the last frame, back to front
  let hits = []; // every prop in final paint order, show-through repaints included, for clicks
  let layers = []; // the last frame's paint order, for placing ground points in it
  const stats = { spriteRedraws: 0, markers: [], washSource: null, crowd: [] };
  let facing = 0;
  let room = { w: D.GRID.w, h: D.GRID.h };
  // The camera (docs/HUD.md section 5): a zoom over the fit, and the world point held at
  // the canvas centre. At zoom 1 the lot is fit as it always was. The centre is kept in
  // world tiles, so a view turn or a resize keeps what the player was looking at.
  const ZOOMS = [1, 1.5, 2, 3];
  let cam = { zoom: 1, x: null, y: null };

  function useRoom(next) {
    const w = next && next.w ? next.w : D.GRID.w;
    const h = next && next.h ? next.h : D.GRID.h;
    if (w === room.w && h === room.h) return;
    room = { w, h };
    crowdCache = { key: '', tiles: [] };
    cam = { zoom: 1, x: null, y: null };
    resize();
  }

  function viewToWorld(u, v) {
    const W = room.w;
    const H = room.h;
    if (facing === 1) return [W - v, u];
    if (facing === 2) return [W - u, H - v];
    if (facing === 3) return [v, H - u];
    return [u, v];
  }

  // A canvas point to world tiles (floats), under the current view.
  function screenToWorld(px, py) {
    const a = (px - view.ox) / (view.tw / 2);
    const b = (py - view.oy) / (view.th / 2);
    return viewToWorld((a + b) / 2, (b - a) / 2);
  }

  // Headroom at the fit, in tile heights: above the back corner for tall props (the stage
  // and the light tower rise about 4 to 6), and below the front corner.
  const ABOVE = 3;
  const BELOW = 0.5;

  // The middle of the clear area: the camera holds its world point there.
  const middle = () => [view.safe.x + view.safe.w / 2, view.safe.y + view.safe.h / 2];

  // Sets the tile size and origin from the fit and the camera. The fit centres the lot,
  // with headroom for the tallest prop, in the clear area.
  function applyCamera() {
    const { fitTw, safe } = view;
    const wide = facing % 2 ? room.h : room.w;
    const deep = facing % 2 ? room.w : room.h;
    const fitTh = fitTw / 2;
    const tall = ((wide + deep) * fitTh) / 2 + fitTh * (ABOVE + BELOW);
    const fit = {
      tw: fitTw,
      th: fitTh,
      ox: safe.x + (safe.w - ((wide + deep) * fitTw) / 2) / 2 + (deep * fitTw) / 2,
      oy: safe.y + (safe.h - tall) / 2 + fitTh * ABOVE,
    };
    if (cam.zoom === 1) { Object.assign(view, fit); return; }
    const tw = fitTw * cam.zoom;
    const th = tw / 2;
    const [u, v] = worldToView(cam.x, cam.y);
    const [mx, my] = middle();
    Object.assign(view, { tw, th, ox: mx - ((u - v) * tw) / 2, oy: my - ((u + v) * th) / 2 });
  }

  // Keeps the centre on the lot, so the lot can't be panned out of the window.
  function clampCamera() {
    cam.x = Math.min(room.w, Math.max(0, cam.x));
    cam.y = Math.min(room.h, Math.max(0, cam.y));
  }

  function redraw() { if (lastScene) draw(lastScene); }

  // Zooms to one of ZOOMS, keeping the world point under (px, py) still. Without a point,
  // the middle of the clear area stays still. Returns the new zoom.
  function zoomTo(zoom, px, py) {
    if (px === undefined || py === undefined) [px, py] = middle();
    const next = ZOOMS.includes(zoom) ? zoom : 1;
    if (next === cam.zoom) return cam.zoom;
    const [wx, wy] = screenToWorld(px, py);
    cam.zoom = next;
    if (next === 1) {
      cam.x = null; cam.y = null;
    } else {
      const tw = view.fitTw * next;
      const [u, v] = worldToView(wx, wy);
      // The origin that puts (wx, wy) under the point, then the centre that origin gives.
      Object.assign(view, { tw, th: tw / 2, ox: px - ((u - v) * tw) / 2, oy: py - ((u + v) * tw) / 4 });
      [cam.x, cam.y] = screenToWorld(...middle());
      clampCamera();
    }
    applyCamera();
    redraw();
    return cam.zoom;
  }

  function zoomBy(steps, px, py) {
    const i = ZOOMS.indexOf(cam.zoom);
    return zoomTo(ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, i + steps))], px, py);
  }

  // Moves the picture by (dx, dy) canvas pixels. At the fit there is nothing to pan.
  function panBy(dx, dy) {
    if (cam.zoom === 1) return false;
    const [mx, my] = middle();
    [cam.x, cam.y] = screenToWorld(mx - dx, my - dy);
    clampCamera();
    applyCamera();
    redraw();
    return true;
  }

  // Pans just enough to keep a tile clear of the clear area's edges (the build cursor).
  function follow(x, y) {
    if (cam.zoom === 1) return;
    const [sx, sy] = iso(x + 0.5, y + 0.5);
    const { x: left, y: top, w, h } = view.safe;
    const mx = Math.min(view.tw * 1.5, w / 4);
    const my = Math.min(view.th * 3, h / 4);
    const dx = sx < left + mx ? left + mx - sx : sx > left + w - mx ? left + w - mx - sx : 0;
    const dy = sy < top + my ? top + my - sy : sy > top + h - my ? top + h - my - sy : 0;
    if (dx || dy) panBy(dx, dy);
  }

  function camera() {
    return { zoom: cam.zoom, x: cam.x, y: cam.y, zooms: ZOOMS.slice() };
  }

  function navigation() {
    const { x, y, w, h } = view.safe;
    return { width: room.w, depth: room.h, rotation: 45 - facing * 90, fixed: [], footprint: clipGround(room.w, room.h, [p => iso(p.x, p.y)[0] - x, p => x + w - iso(p.x, p.y)[0], p => iso(p.x, p.y)[1] - y, p => y + h - iso(p.x, p.y)[1]]) };
  }
  function panTo(x, y) { if (cam.zoom === 1 || !Number.isFinite(x) || !Number.isFinite(y)) return; cam.x = x; cam.y = y; clampCamera(); applyCamera(); redraw(); }

  // Put affected equipment in the clear centre, away from the docked HUD cards.
  function centerOn(x, y) {
    cam.zoom = 2;
    cam.x = x;
    cam.y = y;
    clampCamera();
    applyCamera();
    redraw();
  }

  // A world point to client coordinates, and back to a tile: for the smoke rail.
  function clientOf(x, y, z = 0) {
    const rect = canvas.getBoundingClientRect();
    const [sx, sy] = iso(x, y, z);
    const { x: left, y: top, w, h } = view.safe;
    return {
      x: rect.left + sx,
      y: rect.top + sy,
      inside: sx >= 0 && sy >= 0 && sx < view.cssW && sy < view.cssH,
      clear: sx >= left && sy >= top && sx <= left + w && sy <= top + h,
    };
  }

  function worldToView(x, y) {
    const W = room.w;
    const H = room.h;
    if (facing === 1) return [y, W - x];
    if (facing === 2) return [W - x, H - y];
    if (facing === 3) return [H - y, x];
    return [x, y];
  }

  // The clear area in canvas pixels: { x, y, w, h }, or null for the whole canvas. The
  // page sets it from the top strip and the panel; resize() applies it.
  function setClear(rect) {
    clear = rect ? { x: rect.x, y: rect.y, w: rect.w, h: rect.h } : null;
  }

  // The canvas fills its box (the whole window). The lot is fit, by width and by height,
  // into the clear area.
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(280, Math.round(rect.width));
    const cssH = Math.max(200, Math.round(rect.height));
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    // A full-window canvas at 2x passes 6 megapixels on big screens (docs/HUD.md section 6).
    if (cssW * cssH * dpr * dpr > 6e6) dpr = Math.min(dpr, 1.5);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const want = clear || { x: 0, y: 0, w: cssW, h: cssH };
    const x = Math.min(cssW - 1, Math.max(0, want.x));
    const y = Math.min(cssH - 1, Math.max(0, want.y));
    const safe = { x, y, w: Math.max(1, Math.min(cssW, want.x + want.w) - x), h: Math.max(1, Math.min(cssH, want.y + want.h) - y) };
    const span = (room.w + room.h) / 2;
    const tw = Math.max(12, Math.floor(Math.min((safe.w - 24) / span, (safe.h - 16) / (span / 2 + (ABOVE + BELOW) / 2))));
    view = { fitTw: tw, tw, th: tw / 2, ox: 0, oy: 0, cssW, cssH, dpr, safe };
    applyCamera();
  }

  // Tile coordinates (x, y, height z in tiles) to screen coordinates.
  function iso(x, y, z = 0) {
    const [u, v] = worldToView(x, y);
    return [view.ox + ((u - v) * view.tw) / 2, view.oy + ((u + v) * view.th) / 2 - z * view.th];
  }

  function tileAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    if (px < 0 || py < 0 || px >= view.cssW || py >= view.cssH) return null;
    const [wx, wy] = screenToWorld(px, py);
    const x = Math.floor(wx);
    const y = Math.floor(wy);
    if (x < 0 || y < 0 || x >= room.w || y >= room.h) return null;
    return { x, y };
  }

  function screenDepth(x, y, w, h) {
    const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    return Math.max(...corners.map(([cx, cy]) => {
      const [u, v] = worldToView(cx, cy);
      return u + v;
    }));
  }

  function turnView() {
    facing = (facing + 1) % 4;
    resize();
    if (lastScene) draw(lastScene);
    return facing;
  }

  function diamond(x, y, w, h, z = 0, g = ctx) {
    const p = [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + h, z), iso(x, y + h, z)];
    g.beginPath();
    g.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < 4; i += 1) g.lineTo(p[i][0], p[i][1]);
    g.closePath();
  }

  function fillDiamond(x, y, w, h, color, z = 0, g = ctx) {
    diamond(x, y, w, h, z, g);
    g.fillStyle = color;
    g.fill();
  }

  function quad(a, b, c, d, color) {
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.lineTo(...d); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
  }

  // The two side faces of a box that face the viewer in the current view, as [corner,
  // corner, outward normal]; the lower-left one on screen comes first.
  function visibleFaces(x0, y0, x1, y1) {
    const faces = [
      [[x0, y1], [x1, y1], [0, 1]], [[x1, y0], [x1, y1], [1, 0]],
      [[x0, y0], [x1, y0], [0, -1]], [[x0, y0], [x0, y1], [-1, 0]],
    ];
    const toView = ([nx, ny]) => {
      const a = worldToView(x0, y0); const b = worldToView(x0 + nx, y0 + ny);
      return [b[0] - a[0], b[1] - a[1]];
    };
    // Facing the viewer means the normal points down the screen (+u or +v in view terms).
    return faces.map((f) => ({ f, v: toView(f[2]) })).filter(({ v }) => v[0] + v[1] > 0)
      .sort((p, q) => q.v[1] - p.v[1]).map(({ f }) => f);
  }

  // An extruded box over a footprint: the two faces toward the viewer, then the top.
  function box(x, y, w, h, height, look, alpha = 1) {
    ctx.globalAlpha = alpha;
    const inset = look.thin ? 0.3 : 0.06;
    const x0 = x + inset; const y0 = y + inset; const x1 = x + w - inset; const y1 = y + h - inset;
    visibleFaces(x0, y0, x1, y1).forEach(([a, b], i) => {
      quad(iso(a[0], a[1]), iso(b[0], b[1]), iso(b[0], b[1], height), iso(a[0], a[1], height), i === 0 ? look.front : look.side);
    });
    fillDiamond(x0, y0, x1 - x0, y1 - y0, look.top, height);
    ctx.globalAlpha = 1;
  }

  function touringProp(o) {
    const spec = D.OBJECT_TYPES[o.type], { w, h } = dims(o), look = LOOK[o.type];
    if (o.type === 'vip-deck') {
      box(o.x, o.y, w, h, 0.95, look);
      ctx.save(); ctx.strokeStyle = '#bbc4cc'; ctx.lineWidth = 1.5;
      const corners = [[o.x + 0.12, o.y + 0.12], [o.x + w - 0.12, o.y + 0.12], [o.x + w - 0.12, o.y + h - 0.12], [o.x + 0.12, o.y + h - 0.12]];
      for (const [x, y] of corners) { ctx.beginPath(); ctx.moveTo(...iso(x, y, 0.95)); ctx.lineTo(...iso(x, y, 1.6)); ctx.stroke(); }
      ctx.beginPath(); corners.forEach(([x, y], i) => i ? ctx.lineTo(...iso(x, y, 1.6)) : ctx.moveTo(...iso(x, y, 1.6))); ctx.closePath(); ctx.stroke(); ctx.restore();
    } else {
      fillDiamond(o.x, o.y, w, h, '#464d4a', 0.03);
      const rotate = (u, v) => [[u, v], [spec.h - v, u], [spec.w - u, spec.h - v], [v, spec.w - u]][o.rot || 0];
      const corners = [[0.22, 0.22], [spec.w - 0.22, 1.82]].map(([u, v]) => rotate(u, v));
      const x = o.x + Math.min(...corners.map(p => p[0])), y = o.y + Math.min(...corners.map(p => p[1]));
      const bw = Math.abs(corners[1][0] - corners[0][0]), bh = Math.abs(corners[1][1] - corners[0][1]);
      box(x, y, bw, bh, 1.72, look);
      for (const [a, b] of visibleFaces(x + 0.06, y + 0.06, x + bw - 0.06, y + bh - 0.06)) {
        quad(iso(...a, 0.98), iso(...b, 0.98), iso(...b, 1.5), iso(...a, 1.5), '#193443');
        ctx.save(); ctx.strokeStyle = '#788694'; ctx.lineWidth = 1;
        for (let t = 0.16; t < 1; t += 0.16) { const px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t; ctx.beginPath(); ctx.moveTo(...iso(px, py, 0.98)); ctx.lineTo(...iso(px, py, 1.5)); ctx.stroke(); }
        ctx.restore();
      }
    }
    const [x, y] = iso(o.x + w / 2, o.y + h / 2, LOOK[o.type].height + 0.1);
    ctx.save(); ctx.fillStyle = '#f3ecce'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(o.type === 'vip-deck' ? 'VIP' : 'BUSES', x, y); ctx.restore();
  }

  function dims(o) {
    const t = D.OBJECT_TYPES[o.type];
    return o.rot % 2 ? { w: t.h, h: t.w } : { w: t.w, h: t.h };
  }

  function stageFront(stage) {
    const { w, h } = dims(stage);
    const facing = [[0, 1], [-1, 0], [0, -1], [1, 0]][stage.rot];
    const front = [
      [stage.x + w / 2, stage.y + h], [stage.x, stage.y + h / 2],
      [stage.x + w / 2, stage.y], [stage.x + w, stage.y + h / 2],
    ][stage.rot];
    return { facing, front, w: stage.rot % 2 ? h : w };
  }

  // The stand-ins are painted for one orientation on screen. What counts is how a prop
  // sits on screen: its own rotation less the view's quarter turns. A footprint a quarter
  // turn the other way is the same art mirrored; a stage that faces away from the viewer
  // has no art, so it keeps the code-drawn box with its facing arrow.
  function spriteMode(o) {
    const onScreen = (o.rot - facing + 4) % 4;
    if (o.type === 'stage') return onScreen === 0 ? 'sprite' : onScreen === 3 ? 'mirrored' : null;
    return onScreen % 2 ? 'mirrored' : 'sprite';
  }

  // Where a prop's sprite goes on screen, or null when it draws as a box.
  function spriteRect(o) {
    const img = spriteImages[o.type];
    const mode = spriteMode(o);
    if (!spritesReady || !mode || !img || img.naturalWidth === 0) return null;
    const { w, h } = dims(o);
    // The footprint's corners on screen, whichever way the view is turned.
    const corners = [iso(o.x, o.y), iso(o.x + w, o.y), iso(o.x + w, o.y + h), iso(o.x, o.y + h)];
    const left = Math.min(...corners.map((c) => c[0]));
    const right = Math.max(...corners.map((c) => c[0]));
    const bottom = Math.max(...corners.map((c) => c[1]));
    const footW = right - left;
    const fit = PROPS[o.type].sprite;
    const aspect = img.naturalHeight / img.naturalWidth;
    const destW = fit.h ? (footW * fit.h) / aspect : footW * fit.w;
    const destH = destW * aspect;
    const cx = (left + right) / 2;
    return { x: cx - destW / 2, y: bottom - destH * fit.foot, w: destW, h: destH, mirrored: mode === 'mirrored' };
  }

  function drawSprite(o, alpha) {
    const r = spriteRect(o);
    if (!r) return null;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = alpha;
    if (r.mirrored) {
      ctx.translate(r.x + r.w, r.y);
      ctx.scale(-1, 1);
      ctx.drawImage(spriteImages[o.type], 0, 0, r.w, r.h);
    } else {
      ctx.drawImage(spriteImages[o.type], r.x, r.y, r.w, r.h);
    }
    ctx.restore();
    return r;
  }

  // Height in tiles of a screen point above the ground at the prop's centre.
  function zAbove(o, screenY) {
    const { w, h } = dims(o);
    return (iso(o.x + w / 2, o.y + h / 2)[1] - screenY) / view.th;
  }

  // The top of a prop as drawn (sprite or box), in tiles above the ground.
  function topOf(o) {
    const hit = drawn.find((d) => d.o === o);
    return hit ? zAbove(o, hit.r.y) : PROPS[o.type].box.height;
  }

  // Where a ground point (a crowd dot, a sightline tile) goes in the paint order. Only
  // the layers whose drawn shape covers the point on screen matter. In view coordinates
  // the point is behind a prop when it lies toward the far corner from the prop's front
  // edges. The point is drawn right after the last covering layer it is in front of, so
  // a dot in front of the PA but behind the stage lands between the two. When the order
  // cannot honour both (in front of a later layer, behind an earlier one), behind wins.
  function placement(px, py, list) {
    const [pu, pv] = worldToView(px, py);
    const [sx, sy] = iso(px, py);
    const covering = [];
    list.forEach(({ o, d, g }, i) => {
      const covers = g.r
        ? sx >= g.r.x && sx < g.r.x + g.r.w && sy >= g.r.y && sy < g.r.y + g.r.h
        : insidePolygon(sx, sy, g.poly);
      if (!covers) return;
      const c = [worldToView(o.x, o.y), worldToView(o.x + d.w, o.y + d.h)];
      const u0 = Math.min(c[0][0], c[1][0]); const u1 = Math.max(c[0][0], c[1][0]);
      const v0 = Math.min(c[0][1], c[1][1]); const v1 = Math.max(c[0][1], c[1][1]);
      covering.push({ i, behind: pu < u1 && pv < v1 && !(pu >= u0 && pv >= v0) });
    });
    const firstBehind = Math.min(Infinity, ...covering.filter((c) => c.behind).map((c) => c.i));
    const slot = Math.max(-1, ...covering.filter((c) => !c.behind && c.i < firstBehind).map((c) => c.i));
    return { slot, covering };
  }

  // A code-drawn box's outline on screen: the convex hull of its ground and top corners.
  function boxOutline(o, d) {
    const look = lookOf(o);
    const inset = look.thin ? 0.3 : 0.06;
    const x0 = o.x + inset; const y0 = o.y + inset; const x1 = o.x + d.w - inset; const y1 = o.y + d.h - inset;
    const pts = [];
    for (const z of [0, look.height]) pts.push(iso(x0, y0, z), iso(x1, y0, z), iso(x1, y1, z), iso(x0, y1, z));
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const half = (list) => {
      const out = [];
      for (const q of list) {
        while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
        out.push(q);
      }
      out.pop();
      return out;
    };
    return [...half(pts), ...half([...pts].reverse())];
  }

  function insidePolygon(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
      const [xi, yi] = poly[i]; const [xj, yj] = poly[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // The prop under a screen point, front first in the final paint order: a sprite by its
  // opaque pixels, a code-drawn box by its outline.
  function objectAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    for (let i = hits.length - 1; i >= 0; i -= 1) {
      const { o, r, poly } = hits[i];
      if (poly) {
        if (insidePolygon(px, py, poly)) return o;
        continue;
      }
      if (px < r.x || py < r.y || px >= r.x + r.w || py >= r.y + r.h) continue;
      const m = spriteMask(o.type);
      let u = (px - r.x) / r.w;
      if (r.mirrored) u = 1 - u;
      const ix = Math.min(m.w - 1, Math.floor(u * m.w));
      const iy = Math.min(m.h - 1, Math.floor(((py - r.y) / r.h) * m.h));
      if (m.mask[iy * m.w + ix]) return o;
    }
    return null;
  }

  function drawStageFacing(o) {
    const { facing, front } = stageFront(o);
    const [sx, sy] = iso(front[0] - facing[0] * 1.2, front[1] - facing[1] * 1.2, LOOK.stage.height);
    const [tx, ty] = iso(front[0] + facing[0] * 0.4, front[1] + facing[1] * 0.4, LOOK.stage.height);
    ctx.strokeStyle = COLORS.cursor;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.beginPath(); ctx.arc(tx, ty, 3, 0, Math.PI * 2); ctx.fillStyle = COLORS.cursor; ctx.fill();
  }

  // Crowd placement: clear-view tiles nearest the stage fill first, about three people a tile.
  function crowdTiles(objects, clearSet, pillars) {
    const key = `${room.w}x${room.h}:${JSON.stringify(pillars || [])}:${JSON.stringify(objects)}`;
    if (crowdCache.key === key) return crowdCache.tiles;
    const occupied = new Set();
    objects.forEach((o) => footprint(o).forEach(([x, y]) => occupied.add(`${x},${y}`)));
    (pillars || []).forEach(([x, y]) => occupied.add(`${x},${y}`));
    const stage = objects.find((o) => o.type === 'stage');
    const [fx, fy] = stage ? stageFront(stage).front : [room.w / 2, 0];
    const tiles = [];
    for (let y = 0; y < room.h; y += 1) {
      for (let x = 0; x < room.w; x += 1) {
        if (occupied.has(`${x},${y}`)) continue;
        tiles.push({ x, y, rank: (clearSet.has(`${x},${y}`) ? 0 : 100) + Math.hypot(x + 0.5 - fx, y + 0.5 - fy) });
      }
    }
    tiles.sort((p, q) => p.rank - q.rank);
    crowdCache = { key, tiles };
    return tiles;
  }

  function crowdPoints(scene) {
    if (scene.serviceCrowd) return [...scene.serviceCrowd.actors, ...(scene.serviceCrowd.worker ? [scene.serviceCrowd.worker] : [])].map((p, i) => ({ ...p, i }));
    const points = [];
    if (scene.crowd <= 0) return points;
    const tiles = crowdTiles(scene.objects, scene.clearSet, scene.pillars);
    const cap = scene.density || D.FLOOR_DENSITY;
    let remaining = Math.min(scene.crowd, 1600);
    for (let i = 0; i < tiles.length && remaining > 0; i += 1) {
      const t = tiles[i];
      const here = Math.min(scene.services ? Math.floor((i + 1) * cap) - Math.floor(i * cap) : cap, remaining);
      remaining -= here;
      for (let k = 0; k < here; k += 1) {
        const jx = ((t.x * 7 + t.y * 13 + k * 5) % 10) / 14 + 0.15;
        const jy = ((t.x * 11 + t.y * 3 + k * 7) % 10) / 14 + 0.15;
        points.push({ x: t.x + jx, y: t.y + jy, i: t.x + t.y + k });
      }
    }
    return points;
  }

  function drawCrowd(points, t) {
    const r = Math.max(1.5, view.tw / 14);
    for (const p of points) {
      const bob = t ? Math.sin(t * 6 + p.i) * 0.06 : 0;
      const [px, py] = iso(p.x, p.y, 0.25 + bob);
      ctx.beginPath();
      ctx.arc(px, py, p.zone === 'worker' ? r * 1.6 : r, 0, Math.PI * 2);
      ctx.fillStyle = SERVICE_COLORS[p.zone] || COLORS.crowd[p.i % COLORS.crowd.length];
      ctx.fill();
    }
  }

  // Additive light: a cone from the fixture and an elliptical pool on the floor.
  function beam(source, target, fx) {
    const [sx, sy] = iso(source[0], source[1], source[2]);
    const [tx, ty] = iso(target[0], target[1], 0);
    const pool = fx.spread * view.tw * 0.7;
    const dx = tx - sx; const dy = ty - sy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len; const ny = dx / len;
    const rgba = (a) => `rgba(${fx.r},${fx.g},${fx.b},${a})`;

    const cone = ctx.createLinearGradient(sx, sy, tx, ty);
    cone.addColorStop(0, rgba(fx.intensity * 0.55));
    cone.addColorStop(0.7, rgba(fx.intensity * 0.18));
    cone.addColorStop(1, rgba(0));
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(sx + nx * 2, sy + ny * 2);
    ctx.lineTo(sx - nx * 2, sy - ny * 2);
    ctx.lineTo(tx - nx * pool * 0.7, ty - ny * pool * 0.35);
    ctx.lineTo(tx + nx * pool * 0.7, ty + ny * pool * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(1, 0.5);
    const splat = ctx.createRadialGradient(0, 0, 0, 0, 0, pool);
    splat.addColorStop(0, rgba(fx.intensity * 0.75));
    splat.addColorStop(0.45, rgba(fx.intensity * 0.3));
    splat.addColorStop(1, rgba(0));
    ctx.fillStyle = splat;
    ctx.beginPath(); ctx.arc(0, 0, pool, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 8);
    glow.addColorStop(0, `rgba(255,255,255,${fx.intensity})`);
    glow.addColorStop(1, rgba(0));
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill();
  }

  function drawLights(scene) {
    const stage = scene.objects.find((o) => o.type === 'stage');
    if (!stage) return;
    const { facing, front, w } = stageFront(stage);
    const perp = [-facing[1], facing[0]];
    const t = scene.t || 0;
    const at = (along, out, sway = 0) => [
      front[0] + perp[0] * (along + sway) + facing[0] * out,
      front[1] + perp[1] * (along + sway) + facing[1] * out,
    ];
    const rig = (along, height) => [front[0] + perp[0] * along - facing[0] * 0.4, front[1] + perp[1] * along - facing[1] * 0.4, height];
    const lit = scene.lightTower || scene.houseLights;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const parScale = lit ? 1 : 0.7;
    beam(rig(-w / 2 + 0.5, 3), at(-1.2, 2.5), { ...FIXTURES.par, intensity: FIXTURES.par.intensity * parScale });
    beam(rig(w / 2 - 0.5, 3), at(1.2, 2.5), { ...FIXTURES.par, intensity: FIXTURES.par.intensity * parScale });
    if (lit) {
      beam(rig(-1, 3.4), at(0, 5.5, Math.sin(t * 0.9) * 3), FIXTURES.cyan);
      beam(rig(1, 3.4), at(0, 5.5, Math.sin(t * 0.9 + Math.PI) * 3), FIXTURES.magenta);
      const tower = scene.objects.find((o) => o.type === 'lights');
      // The wash comes from the lamp head: on the sprite when one is drawn, else the box top.
      const drawnTower = drawn.find((d) => d.o === tower);
      const z = drawnTower ? zAbove(tower, drawnTower.r.y + drawnTower.r.h * PROPS.lights.sprite.lamp) : LOOK.lights.height;
      stats.washSource = z;
      beam(tower ? [tower.x + 0.5, tower.y + 0.5, z] : rig(0, z), at(Math.cos(t * 0.4) * 2, 4), FIXTURES.wash);
    }
    ctx.restore();
  }

  function marker(x, y, z) {
    const [px, py] = iso(x, y, z);
    ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.invalid; ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', px, py + 0.5);
  }

  // scene: { objects, clearSet, blockedSet, showClear, cursor, ghost, crowd, incident, night, lightTower, t }
  function draw(scene) {
    lastScene = scene;
    useRoom(scene.grid);
    drawn = [];
    hits = [];
    stats.markers = [];
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, view.cssW, view.cssH);
    const floor = FLOORS[scene.floor] || FLOORS.lot;

    // Each prop's drawn shape (sprite rectangle or box outline), known before anything is
    // drawn. A room's pillars are boxes in the same order.
    const sorted = [
      ...scene.objects.filter((o) => !D.OBJECT_TYPES[o.type].kit).map((o) => ({ o, d: dims(o) })),
      ...(scene.pillars || []).map(([x, y]) => ({ o: { type: 'pillar', x, y, rot: 0 }, d: { w: 1, h: 1 } })),
    ]
      .map(({ o, d }) => { const r = spriteRect(o); return { o, d, g: r ? { r } : { poly: boxOutline(o, d) } }; })
      .sort((p, q) => screenDepth(p.o.x, p.o.y, p.d.w, p.d.h) - screenDepth(q.o.x, q.o.y, q.d.w, q.d.h));
    // A sprite mostly hidden behind much taller sprites drawn after it (a PA behind the
    // stage) shows through at reduced strength, so the player can see what they rented.
    // The repaint comes right after the last of those sprites, so whatever stands in
    // front of it later in the order still covers it.
    const sprites = sorted.filter((p) => p.g.r);
    const repaintAfter = new Map();
    sprites.forEach((a, k) => {
      // Only rig PAs need show-through. Applying it to amenities makes a restroom
      // behind the bar look as though it is sitting on the counter.
      if (a.o.type !== 'pa-s' && a.o.type !== 'pa-m') return;
      const ra = a.g.r;
      let covered = 0;
      let last = null;
      for (const b of sprites.slice(k + 1)) {
        if (b.o.type !== 'stage') continue;
        // Only a much taller sprite counts, so neighbours of one size (a restroom bank) never ghost.
        if (b.g.r.h <= ra.h * 1.5) continue;
        const w = Math.min(ra.x + ra.w, b.g.r.x + b.g.r.w) - Math.max(ra.x, b.g.r.x);
        const h = Math.min(ra.y + ra.h, b.g.r.y + b.g.r.h) - Math.max(ra.y, b.g.r.y);
        if (w > 0 && h > 0) { covered += w * h; last = b; }
      }
      if (covered > ra.w * ra.h * 0.4) repaintAfter.set(last, [...(repaintAfter.get(last) || []), { ...a, repaint: true }]);
    });
    layers = sorted.flatMap((p) => [p, ...(repaintAfter.get(p) || [])]);
    // Sightline tiles and crowd dots go into the paint order by placement: slot -1 before
    // every layer, slot i right after layer i.
    let tilesAt = new Map();
    const crowdAt = new Map();
    const bucket = (map, slot, item) => { if (!map.has(slot)) map.set(slot, []); map.get(slot).push(item); };
    const overlay = (x, y, g = ctx) => {
      if (scene.showClear && scene.clearSet.has(`${x},${y}`)) fillDiamond(x, y, 1, 1, COLORS.clear, 0, g);
      if (scene.showClear && scene.blockedSet && scene.blockedSet.has(`${x},${y}`)) fillDiamond(x, y, 1, 1, COLORS.blocked, 0, g);
    };

    const paintFloor = (g) => {
      for (let y = 0; y < room.h; y += 1) {
        for (let x = 0; x < room.w; x += 1) {
          const edge = x === 0 || y === 0 || x === room.w - 1 || y === room.h - 1;
          fillDiamond(x, y, 1, 1, edge ? floor.edge : (x + y) % 2 ? floor.lot : floor.lotAlt, 0, g);
          // A sightline tile in front of a prop is drawn after it, so a sprite that
          // overhangs its footprint cannot hide the tile.
          const { slot } = placement(x + 0.5, y + 0.5, layers);
          if (slot < 0) overlay(x, y, g);
          else bucket(tilesAt, slot, [x, y]);
        }
      }
      g.lineWidth = 1;
      g.strokeStyle = COLORS.grid;
      for (let i = 0; i <= room.w; i += 1) { g.beginPath(); g.moveTo(...iso(i, 0)); g.lineTo(...iso(i, room.h)); g.stroke(); }
      for (let j = 0; j <= room.h; j += 1) { g.beginPath(); g.moveTo(...iso(0, j)); g.lineTo(...iso(room.w, j)); g.stroke(); }
      if (!scene.floor || scene.floor === 'lot') {
        g.strokeStyle = COLORS.stall;
        for (let x = 3; x < room.w - 1; x += 3) {
          g.beginPath(); g.moveTo(...iso(x, room.h - 4)); g.lineTo(...iso(x, room.h - 1.4)); g.stroke();
        }
      }

      if (scene.objects.some((o) => o.type === 'fence')) {
        g.strokeStyle = COLORS.fence;
        g.lineWidth = 2;
        g.setLineDash([4, 3]);
        diamond(0, 0, room.w, room.h, 0.35, g);
        g.stroke();
        g.setLineDash([]);
      }

    };
    // Cache only the base paint. Tiles in front of props retain their original slots.
    let copied = false;
    if (cacheFloor && !floorCache.failed) {
      const key = JSON.stringify([room, scene.floor, scene.objects, scene.pillars, spritesReady,
        scene.showClear, scene.showClear ? [...scene.clearSet] : null,
        scene.showClear && scene.blockedSet ? [...scene.blockedSet] : null,
        facing, view.tw, view.th, view.ox, view.oy, view.dpr, canvas.width, canvas.height]);
      try {
        if (!floorCache.canvas) {
          floorCache.canvas = document.createElement('canvas');
          floorCache.context = floorCache.canvas.getContext('2d');
          if (!floorCache.context) throw new Error('Floor canvas unavailable');
        }
        if (floorCache.key !== key) {
          const g = floorCache.context;
          // Assigning dimensions also resets context state left by the prior floor.
          floorCache.canvas.width = canvas.width;
          floorCache.canvas.height = canvas.height;
          g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
          paintFloor(g);
          floorCache.key = key;
          floorCache.tiles = tilesAt;
          floorCache.builds += 1;
        } else {
          tilesAt = floorCache.tiles;
          floorCache.hits += 1;
        }
        ctx.save();
        try {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalCompositeOperation = 'copy';
          ctx.drawImage(floorCache.canvas, 0, 0);
        } finally { ctx.restore(); }
        copied = true;
      } catch {
        // A backing/context allocation failure must not prevent play or picking.
        releaseFloor();
        floorCache.failed = true;
        tilesAt = new Map();
        ctx.clearRect(0, 0, view.cssW, view.cssH);
      }
    }
    if (!copied) paintFloor(ctx);

    // Each crowd dot is placed the same way, so the props it stands behind cover it and
    // the ones it stands in front of do not. A dot is in front when nothing covering it
    // is drawn after it.
    const points = crowdPoints(scene);
    stats.crowd = points.map((p) => {
      const { slot, covering } = placement(p.x, p.y, layers);
      bucket(crowdAt, slot, p);
      return { x: p.x, y: p.y, front: covering.every((c) => c.i <= slot) };
    });
    drawCrowd(crowdAt.get(-1) || [], scene.t);

    const flickerOf = (o) => (scene.incident === 'pa-dropout' && (D.OBJECT_TYPES[o.type] || {}).paTier && scene.t
      ? 0.35 + 0.65 * Math.abs(Math.sin(scene.t * 9)) : 1);
    // Clicks follow the same paint order: a prop that shows through is above the one hiding it.
    layers.forEach(({ o, d, g, repaint }, i) => {
      if (repaint) drawSprite(o, 0.6 * flickerOf(o));
      else if (g.r) { drawSprite(o, flickerOf(o)); drawn.push({ o, r: g.r }); }
      else if (D.OBJECT_TYPES[o.type]?.supportOnly) touringProp(o);
      else box(o.x, o.y, d.w, d.h, lookOf(o).height, lookOf(o), flickerOf(o));
      hits.push(g.r ? { o, d, r: g.r } : { o, d, poly: g.poly });
      if (o.type === 'stage' && !repaint) drawStageFacing(o);
      if (o.type === 'food' || o.type === 'trailer') {
        const [x, y] = iso(o.x + d.w / 2, o.y + d.h / 2, LOOK[o.type].height);
        ctx.save(); ctx.fillStyle = '#102b21'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(o.type === 'food' ? 'FOOD' : 'FACILITIES', x, y); ctx.restore();
      }
      (tilesAt.get(i) || []).forEach(([x, y]) => overlay(x, y));
      drawCrowd(crowdAt.get(i) || [], scene.t);
    });

    if (scene.night) {
      ctx.fillStyle = COLORS.night;
      ctx.fillRect(0, 0, view.cssW, view.cssH);
      drawLights(scene);
      // Phone screens in a busy crowd.
      if (points.length > 120) {
        ctx.fillStyle = 'rgba(241,245,249,0.85)';
        for (let i = 0; i < points.length; i += 9) {
          const p = points[i];
          const on = scene.t ? Math.sin(scene.t * 2 + p.i) > 0.3 : p.i % 2 === 0;
          if (!on) continue;
          const [px, py] = iso(p.x, p.y, 0.55);
          ctx.fillRect(px - 1, py - 1, 2, 2);
        }
      }
    }

    // Incident markers float just above the prop as drawn.
    const markAbove = (o) => {
      const z = topOf(o) + 0.5;
      stats.markers.push({ type: o.type, z, top: topOf(o) });
      marker(o.x + 0.5, o.y + 0.5, z);
    };
    if (scene.incident === 'pa-dropout') {
      const pa = scene.objects.find((o) => D.OBJECT_TYPES[o.type].paTier);
      if (pa) markAbove(pa);
    }
    if (scene.incident === 'gate-jam') {
      scene.objects.filter((o) => o.type === 'gate').forEach(markAbove);
    }

    if (scene.ghost) {
      const g = scene.ghost;
      const t = D.OBJECT_TYPES[g.type];
      if (t && !t.kit) {
        const d = dims(g);
        // The footprint itself, so the preview shows exactly which tiles it takes.
        fillDiamond(g.x, g.y, d.w, d.h, g.valid ? 'rgba(250,204,21,0.28)' : 'rgba(239,68,68,0.35)');
        if (!(g.valid && drawSprite(g, 0.45))) {
          const look = g.valid ? LOOK[g.type] : { top: COLORS.invalid, side: COLORS.invalid, front: COLORS.invalid };
          box(g.x, g.y, d.w, d.h, LOOK[g.type].height, look, 0.45);
        }
      }
    }
    if (scene.selection) {
      const selected = scene.selection;
      const d = dims(selected);
      diamond(selected.x, selected.y, d.w, d.h);
      ctx.strokeStyle = COLORS.cursor;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (scene.cursor) {
      diamond(scene.cursor.x, scene.cursor.y, 1, 1);
      ctx.strokeStyle = scene.cursorColor || COLORS.cursor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (scene.incident === 'rain') {
      ctx.strokeStyle = COLORS.rain;
      ctx.lineWidth = 1;
      const t = scene.t || 0;
      for (let i = 0; i < 90; i += 1) {
        const x = ((i * 97) % view.cssW + t * 40) % view.cssW;
        const y = ((i * 53) % view.cssH + t * 380) % view.cssH;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 10); ctx.stroke();
      }
    }
  }

  // One redraw when the sprites switch on; a board made after that needs none.
  const onSprites = () => { stats.spriteRedraws += 1; if (lastScene) draw(lastScene); };
  if (!spritesReady) spriteListeners.add(onSprites);

  function releaseFloor() {
    if (floorCache.canvas) { floorCache.canvas.width = 0; floorCache.canvas.height = 0; }
    floorCache.canvas = null;
    floorCache.context = null;
    floorCache.key = null;
    floorCache.tiles = null;
  }

  // For tests and the smoke rail: what the last frame drew.
  function info() {
    return {
      floorCache: { enabled: cacheFloor && !floorCache.failed, builds: floorCache.builds, hits: floorCache.hits,
        width: floorCache.canvas?.width || 0, height: floorCache.canvas?.height || 0, failed: floorCache.failed },
      spritesReady,
      facing,
      camera: camera(),
      view: { fitTw: view.fitTw, tw: view.tw, cssW: view.cssW, cssH: view.cssH, dpr: view.dpr, safe: { ...view.safe } },
      spriteRedraws: stats.spriteRedraws,
      drawn: drawn.map(({ o, r }) => ({ type: o.type, x: o.x, y: o.y, rot: o.rot, rect: r, top: zAbove(o, r.y) })),
      markers: stats.markers,
      washSource: stats.washSource,
      hitStack: hits.map(({ o, d, r, poly }) => {
        const faces = poly ? visibleFaces(o.x, o.y, o.x + d.w, o.y + d.h).map((f) => f[2]) : null;
        return { type: o.type, rect: r || null, poly: poly || null, faces };
      }),
      crowd: stats.crowd,
    };
  }

  // For tests: where a ground point falls in the last frame's paint order, as the props
  // covering it on screen that are drawn before it (after) and after it (before).
  function placeOf(x, y) {
    const { slot, covering } = placement(x, y, layers);
    const types = (list) => [...new Set(list.map((c) => layers[c.i].o.type))];
    return { after: types(covering.filter((c) => c.i <= slot)), before: types(covering.filter((c) => c.i > slot)) };
  }

  return {
    resize, setClear, draw, tileAt, turnView, objectAt, info, navigation, panTo, placeOf, zoomTo, zoomBy, panBy, follow, centerOn, camera, clientOf,
    destroy: () => { spriteListeners.delete(onSprites); releaseFloor(); },
  };
}
