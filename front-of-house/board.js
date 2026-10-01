// Front of House isometric board.
//
// Draws the lot, the placed objects, the sightline cone, the build cursor and the
// show-night crowd and lighting on one canvas. Props use the sprites in ./sprites
// when they have loaded, and fall back to the code-drawn boxes until then.

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

const FLOORS = {
  lot: { lot: '#2a2d34', lotAlt: '#2e3139', edge: '#23262c' },
  club: { lot: '#2c2428', lotAlt: '#34282e', edge: '#1c1618' },
  amphitheater: { lot: '#243028', lotAlt: '#2c3a2e', edge: '#1a241c' },
  festival: { lot: '#303626', lotAlt: '#38422c', edge: '#22281c' },
};

// Box colours and heights (in tile units) for each object type. Exported so the
// panel's palette swatches match the board.
export const LOOK = {
  stage: { top: '#3a3d45', side: '#1c1d21', front: '#141518', height: 0.5 },
  'pa-s': { top: '#4b4f5a', side: '#22242a', front: '#1a1b20', height: 1.4 },
  'pa-m': { top: '#5d6270', side: '#2a2c33', front: '#1f2026', height: 1.9 },
  lights: { top: '#9ca3af', side: '#6b7280', front: '#4b5563', height: 2.6, thin: true },
  bar: { top: '#f43f5e', side: '#a8263c', front: '#7f1d2e', height: 0.8 },
  restroom: { top: '#3b82f6', side: '#1d4ed8', front: '#1e3a8a', height: 1.3 },
  gate: { top: '#84cc16', side: '#4d7c0f', front: '#3f6212', height: 0.25 },
  exit: { top: '#ef4444', side: '#b91c1c', front: '#7f1d1d', height: 0.25 },
};

// Sprite width as a fraction of the footprint's on-screen width, and where the base sits.
const FIT = {
  stage: { w: 1.08, foot: 0.93 },
  'pa-s': { w: 0.78, foot: 0.97 },
  'pa-m': { w: 0.82, foot: 0.97 },
  lights: { w: 0.62, foot: 0.98 },
  bar: { w: 1.35, foot: 0.94 },
  restroom: { w: 0.72, foot: 0.97 },
  gate: { w: 1.15, foot: 0.96 },
  exit: { w: 1.05, foot: 0.96 },
};

const spriteImages = {};
const spriteListeners = new Set();

function pingSprites() {
  spriteListeners.forEach((fn) => fn());
}

if (typeof Image !== 'undefined') {
  for (const id of Object.keys(FIT)) {
    const img = new Image();
    img.onload = pingSprites;
    img.src = new URL(`./sprites/${id}.png`, import.meta.url).href;
    spriteImages[id] = img;
  }
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
  let facing = 0;
  let room = { w: D.GRID.w, h: D.GRID.h };

  function useRoom(next) {
    const w = next && next.w ? next.w : D.GRID.w;
    const h = next && next.h ? next.h : D.GRID.h;
    if (w === room.w && h === room.h) return;
    room = { w, h };
    crowdCache = { key: '', tiles: [] };
    resize();
  }

  function worldToView(x, y) {
    const W = room.w;
    const H = room.h;
    if (facing === 1) return [y, W - x];
    if (facing === 2) return [W - x, H - y];
    if (facing === 3) return [H - y, x];
    return [x, y];
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.max(280, Math.round(rect.width));
    const tw = Math.max(12, Math.floor((cssW - 24) / ((room.w + room.h) / 2)));
    const th = tw / 2;
    const cssH = Math.round(((room.w + room.h) * th) / 2 + th * 5);
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const diamondW = ((room.w + room.h) * tw) / 2;
    const gh = facing % 2 ? room.w : room.h;
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
    const W = room.w;
    const H = room.h;
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

  function drawSprite(o, alpha) {
    const img = spriteImages[o.type];
    if (!img || !img.complete || img.naturalWidth === 0) return false;
    const { w, h } = dims(o);
    const west = iso(o.x, o.y + h);
    const east = iso(o.x + w, o.y);
    const south = iso(o.x + w, o.y + h);
    const footW = Math.hypot(east[0] - west[0], east[1] - west[1]);
    const fit = FIT[o.type] || { w: 1, foot: 0.96 };
    const destW = footW * fit.w;
    const destH = destW * (img.naturalHeight / img.naturalWidth);
    const cx = (west[0] + east[0]) / 2;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, cx - destW / 2, south[1] - destH * fit.foot, destW, destH);
    ctx.restore();
    return true;
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
    const points = [];
    if (scene.crowd <= 0) return points;
    const tiles = crowdTiles(scene.objects, scene.clearSet, scene.pillars);
    const cap = scene.density || D.FLOOR_DENSITY;
    let remaining = Math.min(scene.crowd, 1600);
    for (let i = 0; i < tiles.length && remaining > 0; i += 1) {
      const t = tiles[i];
      const here = Math.min(cap, remaining);
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
      const src = [tower.x + 0.5, tower.y + 0.5, LOOK.lights.height];
      beam(src, at(Math.cos(t * 0.4) * 2, 4), FIXTURES.wash);
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
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, view.cssW, view.cssH);
    const floor = FLOORS[scene.floor] || FLOORS.lot;

    for (let y = 0; y < room.h; y += 1) {
      for (let x = 0; x < room.w; x += 1) {
        const edge = x === 0 || y === 0 || x === room.w - 1 || y === room.h - 1;
        fillDiamond(x, y, 1, 1, edge ? floor.edge : (x + y) % 2 ? floor.lot : floor.lotAlt);
        if (scene.showClear && scene.clearSet.has(`${x},${y}`)) fillDiamond(x, y, 1, 1, COLORS.clear);
        if (scene.showClear && scene.blockedSet && scene.blockedSet.has(`${x},${y}`)) fillDiamond(x, y, 1, 1, COLORS.blocked);
      }
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.grid;
    for (let i = 0; i <= room.w; i += 1) { ctx.beginPath(); ctx.moveTo(...iso(i, 0)); ctx.lineTo(...iso(i, room.h)); ctx.stroke(); }
    for (let j = 0; j <= room.h; j += 1) { ctx.beginPath(); ctx.moveTo(...iso(0, j)); ctx.lineTo(...iso(room.w, j)); ctx.stroke(); }
    if (!scene.floor || scene.floor === 'lot') {
      ctx.strokeStyle = COLORS.stall;
      for (let x = 3; x < room.w - 1; x += 3) {
        ctx.beginPath(); ctx.moveTo(...iso(x, room.h - 4)); ctx.lineTo(...iso(x, room.h - 1.4)); ctx.stroke();
      }
    }

    if (scene.objects.some((o) => o.type === 'fence')) {
      ctx.strokeStyle = COLORS.fence;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      diamond(0, 0, room.w, room.h, 0.35);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const points = crowdPoints(scene);
    drawCrowd(points, scene.t);

    const pillarLook = { top: '#5c534c', side: '#3f3833', front: '#2c2724' };
    const sorted = [
      ...scene.objects.filter((o) => !D.OBJECT_TYPES[o.type].kit).map((o) => ({ o, d: dims(o) })),
      ...(scene.pillars || []).map(([x, y]) => ({ o: { type: 'pillar', x, y, rot: 0 }, d: { w: 1, h: 1 } })),
    ].sort((p, q) => screenDepth(p.o.x, p.o.y, p.d.w, p.d.h) - screenDepth(q.o.x, q.o.y, q.d.w, q.d.h));
    for (const { o, d } of sorted) {
      if (o.type === 'pillar') {
        box(o.x, o.y, 1, 1, 2.4, pillarLook, 1);
        continue;
      }
      const look = LOOK[o.type];
      const flicker = scene.incident === 'pa-dropout' && D.OBJECT_TYPES[o.type].paTier && scene.t
        ? 0.35 + 0.65 * Math.abs(Math.sin(scene.t * 9)) : 1;
      if (!drawSprite(o, flicker)) box(o.x, o.y, d.w, d.h, look.height, look, flicker);
      if (o.type === 'stage') drawStageFacing(o);
    }

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

    if (scene.incident === 'pa-dropout') {
      const pa = scene.objects.find((o) => D.OBJECT_TYPES[o.type].paTier);
      if (pa) marker(pa.x + 0.5, pa.y + 0.5, LOOK[pa.type].height + 0.8);
    }
    if (scene.incident === 'gate-jam') {
      scene.objects.filter((o) => o.type === 'gate').forEach((g) => marker(g.x + 0.5, g.y + 0.5, 1.2));
    }

    if (scene.ghost) {
      const g = scene.ghost;
      const t = D.OBJECT_TYPES[g.type];
      if (t && !t.kit) {
        const d = dims(g);
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

  spriteListeners.add(() => { if (lastScene) draw(lastScene); });

  return { resize, draw, tileAt, turnView };
}
