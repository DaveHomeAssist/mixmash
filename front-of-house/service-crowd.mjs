// Presentation-only service zones shared by the classic and 3D Lot views.
// Samples never supply attendance, service capacity, transactions or saved state.
import { OBJECT_TYPES, LIVE_SERVICES } from './data.mjs';
import { guestFrame, alongGuestRoute } from './service-guests.mjs';

export const SERVICE_COLORS = { gate: '#58b8da', bar: '#e8b84a', worker: '#ff875f', leaving: '#b7c0ca' };
const key = (p) => `${p.x},${p.y}`;
const center = (p) => ({ x: p.x + 0.5, y: p.y + 0.5 });
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const count = n => Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;

export function createServiceLayout(objects, grid = { w: 24, h: 16 }) {
  const occupied = new Set();
  for (const o of objects) {
    const spec = OBJECT_TYPES[o.type];
    if (!spec || spec.kit) continue;
    const w = o.rot % 2 ? spec.h : spec.w, h = o.rot % 2 ? spec.w : spec.h;
    for (let y = o.y; y < o.y + h; y++) for (let x = o.x; x < o.x + w; x++) occupied.add(key({ x, y }));
  }
  const free = [];
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) if (!occupied.has(key({ x, y }))) free.push({ x, y });
  const near = target => [...free].sort((a, b) => distance(a, target) - distance(b, target) || a.y - b.y || a.x - b.x);
  const gate = objects.find(o => o.type === 'gate'), bar = objects.find(o => o.type === 'bar');
  const gateCell = gate && near(gate)[0], barCell = bar && near(bar)[0];
  const stage = objects.find(o => o.type === 'stage') || { x: grid.w / 2, y: 0 };
  const reserved = new Set([barCell, gateCell].filter(Boolean).map(key));
  const floor = near(stage).filter(p => !reserved.has(key(p))), barCells = bar ? near(bar).filter(p => !reserved.has(key(p))) : [];
  const route = [];
  if (barCell && gateCell) {
    const previous = new Map([[key(barCell), null]]), queue = [barCell], open = new Set(free.map(key));
    for (let i = 0; i < queue.length && !previous.has(key(gateCell)); i++) {
      const p = queue[i];
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const next = { x: p.x + dx, y: p.y + dy }, id = key(next);
        if (open.has(id) && !previous.has(id)) { previous.set(id, p); queue.push(next); }
      }
    }
    if (previous.has(key(gateCell))) for (let p = gateCell; p; p = previous.get(key(p))) route.unshift(center(p));
  }
  const edge = gate ? [
    { distance: gate.y, axis: 'x', at: -0.25, normal: -1 },
    { distance: grid.h - 1 - gate.y, axis: 'x', at: grid.h + 0.25, normal: 1 },
    { distance: gate.x, axis: 'y', at: -0.25, normal: -1 },
    { distance: grid.w - 1 - gate.x, axis: 'y', at: grid.w + 0.25, normal: 1 },
  ].sort((a, b) => a.distance - b.distance)[0] : null;
  const entry = gate ? center(gate) : null;
  const outsideGate = entry && edge ? (edge.axis === 'x' ? { x: entry.x, y: edge.at } : { x: edge.at, y: entry.y }) : null;
  return { free: free.map(center), entry, outsideGate, floor, barCells, route, gate: gateCell ? center(gateCell) : null,
    bar: barCell ? center(barCell) : null, edge, grid: { ...grid },
    diagnostic: !gate || !bar ? 'A service location is missing.' : !route.length ? 'No visual worker route; service rules are unchanged.' : null };
}

// Proportional samples with a visible representative for every nonempty zone.
function samples(totals, limit) {
  const sizes = Object.values(totals), result = sizes.map(n => n ? 1 : 0);
  let remaining = Math.max(0, limit - result.reduce((a, b) => a + b, 0));
  const total = sizes.reduce((a, b) => a + b, 0);
  while (remaining && result.some((n, i) => n < sizes[i])) {
    let best = -1, score = -Infinity;
    sizes.forEach((n, i) => { const gap = n / Math.max(1, total) * limit - result[i]; if (result[i] < n && gap > score) { score = gap; best = i; } });
    result[best]++; remaining--;
  }
  return Object.fromEntries(Object.keys(totals).map((name, i) => [name, result[i]]));
}

function zoneProjection(layout, services, visualMinute = services.minute, limit = 180) {
  const admitted = count(services.admitted), bar = Math.min(admitted, count(services.bar?.waiting));
  const totals = { gate: count(services.gate?.waiting), bar, floor: admitted - bar };
  const wanted = samples(totals, limit), actors = [], used = new Set();
  for (let i = 0; i < Math.min(wanted.bar, layout.barCells.length); i++) {
    const p = layout.barCells[i]; used.add(key(p)); actors.push({ ...center(p), id: `bar:${i}`, zone: 'bar' });
  }
  const floor = layout.floor.filter(p => !used.has(key(p)));
  for (let i = 0; i < Math.min(wanted.floor, floor.length); i++) actors.push({ ...center(floor[i]), id: `floor:${i}`, zone: 'floor' });
  if (layout.edge) for (let i = 0; i < Math.min(40, wanted.gate); i++) {
    const { axis, at, normal } = layout.edge, length = axis === 'x' ? layout.grid.w : layout.grid.h;
    const along = 0.5 + (i % length), across = at + normal * Math.floor(i / length) * 0.3;
    actors.push({ x: axis === 'x' ? along : across, y: axis === 'x' ? across : along, id: `gate:${i}`, zone: 'gate' });
  }
  let worker = null;
  if (services.worker?.destination) {
    const route = services.worker.destination === 'gate' ? layout.route : [...layout.route].reverse();
    const elapsed = Math.max(0, Math.min(LIVE_SERVICES.travelMinutes, visualMinute - (services.worker.arrivesAt - LIVE_SERVICES.travelMinutes)));
    if (route.length) {
      const position = elapsed / LIVE_SERVICES.travelMinutes * (route.length - 1), i = Math.floor(position), a = route[i], b = route[Math.min(i + 1, route.length - 1)];
      worker = { x: a.x + (b.x - a.x) * (position - i), y: a.y + (b.y - a.y) * (position - i) };
    } else worker = layout[services.worker.destination === 'gate' ? 'bar' : 'gate'];
  } else worker = layout[services.worker?.station];
  const shown = Object.fromEntries(Object.keys(totals).map(zone => [zone, actors.filter(a => a.zone === zone).length]));
  return { actors, worker: worker ? { ...worker, id: 'worker', zone: 'worker' } : null, totals, shown,
    representative: Object.keys(totals).some(zone => totals[zone] !== shown[zone]), diagnostic: layout.diagnostic };
}

const frames = new WeakMap();
export function projectServiceCrowd(layout, services, visualMinute = services.minute, progress = 1) {
  const base = zoneProjection(layout, services, visualMinute);
  if (!services.events) return base;
  let cached = frames.get(services);
  if (!cached || cached.layout !== layout) {
    cached = { layout, frame: guestFrame(layout, services, zoneProjection) };
    frames.set(services, cached);
  }
  const frame = cached.frame, fraction = Math.max(0, Math.min(1, progress));
  const actors = frame.actors.filter(a => a.zone !== 'leaving' || fraction < 1).map(({ route, ...actor }) => ({ ...actor, ...alongGuestRoute(route, fraction) }));
  return { ...base, actors, shown: frame.shown, representative: frame.representative,
    diagnostic: base.diagnostic || (frame.unavailable ? 'Some guest routes are unavailable; service counts are unchanged.' : null),
    transitions: { minute: services.minute, progress: fraction, recordedDepartures: frame.leaving, departingSamples: actors.filter(a => a.zone === 'leaving').length, unavailable: frame.unavailable } };
}
