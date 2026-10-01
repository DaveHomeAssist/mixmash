// Front of House isometric board.
//
// Draws the lot, the placed objects, the sightline cone, the build cursor and the
// show-night crowd and lighting on one canvas. Props use the stand-in sprites in
// ./sprites once all of them have loaded, and the code-drawn boxes until then (and
// for a stage turned away from the viewer, which has no art).

import * as D from './data.mjs';
import { footprint } from './engine.mjs';

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
  lights: { box: { top: '#9ca3af', side: '#6b7280', front: '#4b5563', height: 2.6, thin: true }, sprite: { w: 0.62, foot: 0.98, lamp: 0.1 } },
  bar: { box: { top: '#f43f5e', side: '#a8263c', front: '#7f1d2e', height: 0.8 }, sprite: { w: 1.35, foot: 0.94 } },
  restroom: { box: { top: '#3b82f6', side: '#1d4ed8', front: '#1e3a8a', height: 1.3 }, sprite: { w: 0.72, foot: 0.97 } },
  gate: { box: { top: '#84cc16', side: '#4d7c0f', front: '#3f6212', height: 0.25 }, sprite: { w: 1.15, foot: 0.96 } },
  exit: { box: { top: '#ef4444', side: '#b91c1c', front: '#7f1d1d', height: 0.25 }, sprite: { w: 1.05, foot: 0.96 } },
};

// Box colours and heights, exported so the panel's palette swatches match the board.
export const LOOK = Object.fromEntries(Object.entries(PROPS).map(([id, p]) => [id, p.box]));

// The sprites switch on together, once every image has decoded, with one redraw.
const spriteImages = {};
const spriteListeners = new Set();
let spritesReady = false;

if (typeof Image !== 'undefined') {
  const loads = Object.keys(PROPS).map((id) => {
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

export function createBoard(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { tw: 32, th: 16, ox: 0, oy: 0, cssW: 0, cssH: 0, dpr: 1 };
  let crowdCache = { key: '', tiles: [] };
  let lastScene = null;
  let drawn = []; // the props drawn as sprites in the last frame, back to front
  let hits = []; // the same in final paint order, show-through repaints included, for clicks
  const stats = { spriteRedraws: 0, markers: [], washSource: null };
  let facing = 0;

  function worldToView(x, y) {
    const W = D.GRID.w;
    const H = D.GRID.h;
    if (facing === 1) return [y, W - x];
    if (facing === 2) return [W - x, H - y];
    if (facing === 3) return [H - y, x];
    return [x, y];
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.max(280, Math.round(rect.width));
    const tw = Math.max(12, Math.floor((cssW - 24) / ((D.GRID.w + D.GRID.h) / 2)));
    const th = tw / 2;
    const cssH = Math.round(((D.GRID.w + D.GRID.h) * th) / 2 + th * 5);
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const diamondW = ((D.GRID.w + D.GRID.h) * tw) / 2;
    const gh = facing % 2 ? D.GRID.w : D.GRID.h;
    view = {
      tw, th,
      ox: (cssW - diamondW) / 2 + (gh * tw) / 2,
      oy: th * 4, cssW, cssH, dpr,
    };
  }

  // Tile coordinates (x, y, height z in tiles) to screen coordinates.
  function iso(x, y, z = 0) {
    const [u, v] = worldToView(x, y);
    return [view.ox + ((u - v) * view.tw) / 2, view.oy + ((u + v) * view.th) / 2 - z * view.th];
  }

  function tileAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const a = (clientX - rect.left - view.ox) / (view.tw / 2);
    const b = (clientY - rect.top - view.oy) / (view.th / 2);
    const u = (a + b) / 2;
    const v = (b - a) / 2;
    const W = D.GRID.w;
    const H = D.GRID.h;
    let x = u;
    let y = v;
    if (facing === 1) { x = W - v; y = u; }
    else if (facing === 2) { x = W - u; y = H - v; }
    else if (facing === 3) { x = v; y = H - u; }
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
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

  function diamond(x, y, w, h, z = 0) {
    const p = [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + h, z), iso(x, y + h, z)];
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(p[i][0], p[i][1]);
    ctx.closePath();
  }

  function fillDiamond(x, y, w, h, color, z = 0) {
    diamond(x, y, w, h, z);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function quad(a, b, c, d, color) {
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.lineTo(...d); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
  }

  // An extruded box over a footprint: the two faces toward the viewer, then the top.
  function box(x, y, w, h, height, look, alpha = 1) {
    ctx.globalAlpha = alpha;
    const inset = look.thin ? 0.3 : 0.06;
    const x0 = x + inset; const y0 = y + inset; const w0 = w - inset * 2; const h0 = h - inset * 2;
    // The face toward +y (lower left on screen)
    quad(iso(x0, y0 + h0), iso(x0 + w0, y0 + h0), iso(x0 + w0, y0 + h0, height), iso(x0, y0 + h0, height), look.front);
    // The face toward +x (lower right on screen)
    quad(iso(x0 + w0, y0), iso(x0 + w0, y0 + h0), iso(x0 + w0, y0 + h0, height), iso(x0 + w0, y0, height), look.side);
    fillDiamond(x0, y0, w0, h0, look.top, height);
    ctx.globalAlpha = 1;
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

  // A point is behind a prop when, in view coordinates, it lies toward the far corner
  // from the prop's front edges; props are drawn over such points and before the rest.
  function behindProp(px, py, props) {
    const [pu, pv] = worldToView(px, py);
    return props.some(({ o, d }) => {
      const c = [worldToView(o.x, o.y), worldToView(o.x + d.w, o.y + d.h)];
      const u0 = Math.min(c[0][0], c[1][0]); const u1 = Math.max(c[0][0], c[1][0]);
      const v0 = Math.min(c[0][1], c[1][1]); const v1 = Math.max(c[0][1], c[1][1]);
      return pu < u1 && pv < v1 && !(pu >= u0 && pv >= v0);
    });
  }

  // A code-drawn box's outline on screen: the convex hull of its ground and top corners.
  function boxOutline(o, d) {
    const look = LOOK[o.type];
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
  function crowdTiles(objects, clearSet) {
    const key = JSON.stringify(objects);
    if (crowdCache.key === key) return crowdCache.tiles;
    const occupied = new Set();
    objects.forEach((o) => footprint(o).forEach(([x, y]) => occupied.add(`${x},${y}`)));
    const stage = objects.find((o) => o.type === 'stage');
    const [fx, fy] = stage ? stageFront(stage).front : [D.GRID.w / 2, 0];
    const tiles = [];
    for (let y = 0; y < D.GRID.h; y += 1) {
      for (let x = 0; x < D.GRID.w; x += 1) {
        if (occupied.has(`${x},${y}`)) continue;
        tiles.push({ x, y, rank: (clearSet.has(`${x},${y}`) ? 0 : 100) + Math.hypot(x + 0.5 - fx, y + 0.5 - fy) });
      }
    }
    tiles.sort((p, q) => p.rank - q.rank);
    crowdCache = { key, tiles };
    return tiles;
  }

  function crowdPoints(scene) {
    const points = [];
    if (scene.crowd <= 0) return points;
    const tiles = crowdTiles(scene.objects, scene.clearSet);
    let remaining = scene.crowd;
    for (let i = 0; i < tiles.length && remaining > 0; i += 1) {
      const t = tiles[i];
      const here = Math.min(D.FLOOR_DENSITY, remaining);
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
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.crowd[p.i % COLORS.crowd.length];
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
    const lit = scene.lightTower;
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
      beam([tower.x + 0.5, tower.y + 0.5, z], at(Math.cos(t * 0.4) * 2, 4), FIXTURES.wash);
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
    drawn = [];
    hits = [];
    stats.markers = [];
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, view.cssW, view.cssH);

    const sorted = scene.objects
      .filter((o) => !D.OBJECT_TYPES[o.type].kit)
      .map((o) => ({ o, d: dims(o) }))
      .sort((p, q) => screenDepth(p.o.x, p.o.y, p.d.w, p.d.h) - screenDepth(q.o.x, q.o.y, q.d.w, q.d.h));
    const overlay = (x, y) => {
      if (scene.showClear && scene.clearSet.has(`${x},${y}`)) fillDiamond(x, y, 1, 1, COLORS.clear);
      if (scene.showClear && scene.blockedSet && scene.blockedSet.has(`${x},${y}`)) fillDiamond(x, y, 1, 1, COLORS.blocked);
    };
    const frontTiles = [];

    for (let y = 0; y < D.GRID.h; y += 1) {
      for (let x = 0; x < D.GRID.w; x += 1) {
        const edge = x === 0 || y === 0 || x === D.GRID.w - 1 || y === D.GRID.h - 1;
        fillDiamond(x, y, 1, 1, edge ? COLORS.edge : (x + y) % 2 ? COLORS.lot : COLORS.lotAlt);
        // Sightline tiles in front of every prop are drawn after the props, so a sprite
        // that overhangs its footprint cannot hide them.
        if (behindProp(x + 0.5, y + 0.5, sorted)) overlay(x, y);
        else frontTiles.push([x, y]);
      }
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.grid;
    for (let i = 0; i <= D.GRID.w; i += 1) { ctx.beginPath(); ctx.moveTo(...iso(i, 0)); ctx.lineTo(...iso(i, D.GRID.h)); ctx.stroke(); }
    for (let j = 0; j <= D.GRID.h; j += 1) { ctx.beginPath(); ctx.moveTo(...iso(0, j)); ctx.lineTo(...iso(D.GRID.w, j)); ctx.stroke(); }
    // Faint painted parking stalls on the far rows.
    ctx.strokeStyle = COLORS.stall;
    for (let x = 3; x < D.GRID.w - 1; x += 3) {
      ctx.beginPath(); ctx.moveTo(...iso(x, D.GRID.h - 4)); ctx.lineTo(...iso(x, D.GRID.h - 1.4)); ctx.stroke();
    }

    if (scene.objects.some((o) => o.type === 'fence')) {
      ctx.strokeStyle = COLORS.fence;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      diamond(0, 0, D.GRID.w, D.GRID.h, 0.35);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // The crowd behind a prop is drawn first so the prop covers it; the crowd in front
    // of every prop is drawn after the props.
    const points = crowdPoints(scene);
    const front = [];
    const back = [];
    for (const p of points) (behindProp(p.x, p.y, sorted) ? back : front).push(p);
    drawCrowd(back, scene.t);

    const flickerOf = (o) => (scene.incident === 'pa-dropout' && D.OBJECT_TYPES[o.type].paTier && scene.t
      ? 0.35 + 0.65 * Math.abs(Math.sin(scene.t * 9)) : 1);
    const painted = [];
    for (const { o, d } of sorted) {
      const look = LOOK[o.type];
      const r = drawSprite(o, flickerOf(o));
      if (r) {
        drawn.push({ o, r });
        painted.push({ o, r });
      } else {
        box(o.x, o.y, d.w, d.h, look.height, look, flickerOf(o));
        painted.push({ o, poly: boxOutline(o, d) });
      }
      if (o.type === 'stage') drawStageFacing(o);
    }
    // A prop mostly hidden behind a taller sprite drawn after it (a PA behind the stage)
    // shows through at reduced strength, so the player can see what they rented.
    const reshown = [];
    drawn.forEach((a, i) => {
      const area = a.r.w * a.r.h;
      // Only a much taller sprite counts, so neighbours of one size (a restroom bank) never ghost.
      const covered = drawn.slice(i + 1).filter((b) => b.r.h > a.r.h * 1.5).reduce((sum, b) => {
        const w = Math.min(a.r.x + a.r.w, b.r.x + b.r.w) - Math.max(a.r.x, b.r.x);
        const h = Math.min(a.r.y + a.r.h, b.r.y + b.r.h) - Math.max(a.r.y, b.r.y);
        return sum + (w > 0 && h > 0 ? w * h : 0);
      }, 0);
      if (covered > area * 0.4) { drawSprite(a.o, 0.6 * flickerOf(a.o)); reshown.push(a); }
    });
    // Clicks follow the final paint order: a prop that shows through is on top.
    hits = [...painted, ...reshown];
    frontTiles.forEach(([x, y]) => overlay(x, y));
    drawCrowd(front, scene.t);

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
    if (scene.cursor) {
      diamond(scene.cursor.x, scene.cursor.y, 1, 1);
      ctx.strokeStyle = COLORS.cursor;
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

  // For tests and the smoke rail: what the last frame drew.
  function info() {
    return {
      spritesReady,
      facing,
      spriteRedraws: stats.spriteRedraws,
      drawn: drawn.map(({ o, r }) => ({ type: o.type, x: o.x, y: o.y, rot: o.rot, rect: r, top: zAbove(o, r.y) })),
      markers: stats.markers,
      washSource: stats.washSource,
      hitStack: hits.map(({ o, r, poly }) => ({ type: o.type, rect: r || null, poly: poly || null })),
    };
  }

  return { resize, draw, tileAt, turnView, objectAt, info, destroy: () => spriteListeners.delete(onSprites) };
}
