// Pure game access and normal-departure model. Occupancy and receipts belong to the engine.
import { OBJECT_TYPES, GUEST_FLOW } from './data.mjs';
const key = (x, y) => `${x},${y}`;
const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const integer = (value, name, max = 6000) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new RangeError(`Invalid ${name}`);
  return value;
};

export function lotAccess(objects, grid = { w: 24, h: 16 }) {
  const w = integer(grid.w, 'grid width', 100), h = integer(grid.h, 'grid height', 100);
  if (!w || !h || !Array.isArray(objects)) throw new TypeError('Invalid Lot layout');
  const blocked = new Set();
  for (const object of objects) {
    const type = OBJECT_TYPES[object.type];
    if (!type || !Number.isInteger(object.x) || !Number.isInteger(object.y)) throw new TypeError('Invalid Lot object');
    if (type.kit) continue;
    const [ow, oh] = object.rot % 2 ? [type.h, type.w] : [type.w, type.h];
    for (let y = object.y; y < object.y + oh; y++) for (let x = object.x; x < object.x + ow; x++) {
      if (x >= 0 && y >= 0 && x < w && y < h) blocked.add(key(x, y));
    }
  }
  const free = new Set();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!blocked.has(key(x, y))) free.add(key(x, y));
  const unseen = new Set(free), regions = [];
  while (unseen.size) {
    const first = unseen.values().next().value, cells = [first]; unseen.delete(first);
    for (let i = 0; i < cells.length; i++) {
      const [x, y] = cells[i].split(',').map(Number);
      for (const [dx, dy] of directions) {
        const id = key(x + dx, y + dy);
        if (unseen.delete(id)) cells.push(id);
      }
    }
    regions.push(cells);
  }
  regions.sort((a, b) => b.length - a.length);
  const main = new Set(regions[0] || []), root = regions[0]?.[0] || null;
  const previous = new Map(root ? [[root, null]] : []), queue = root ? [root] : [];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i].split(',').map(Number);
    for (const [dx, dy] of directions) {
      const id = key(x + dx, y + dy);
      if (main.has(id) && !previous.has(id)) { previous.set(id, queue[i]); queue.push(id); }
    }
  }
  const portals = objects.filter(o => o.type === 'gate' || o.type === 'exit').map(o => {
    const boundary = o.x === 0 || o.y === 0 || o.x === w - 1 || o.y === h - 1;
    const neighbor = boundary && directions.map(([dx, dy]) => key(o.x + dx, o.y + dy)).find(id => main.has(id));
    const route = [];
    if (neighbor) for (let id = neighbor; id; id = previous.get(id)) {
      const [x, y] = id.split(',').map(Number); route.unshift({ x: x + 0.5, y: y + 0.5 });
    }
    return { type: o.type, x: o.x, y: o.y, usable: !!neighbor, route,
      reason: neighbor ? null : boundary ? 'Disconnected from the main audience floor' : 'Not on the boundary' };
  });
  return { floorCells: [...main].map(id => { const [x, y] = id.split(',').map(Number); return { x, y }; }), floorTiles: main.size, disconnectedTiles: free.size - main.size,
    usableGates: portals.filter(p => p.type === 'gate' && p.usable).length,
    usableExits: portals.filter(p => p.type === 'exit' && p.usable).length, portals };
}

function checkpoint(raw) {
  if (!raw || raw.version !== 1) throw new TypeError('Invalid departure checkpoint');
  return { version: 1, admitted: integer(raw.admitted, 'admitted guests'),
    exits: integer(raw.exits, 'usable exits', 400), minute: integer(raw.minute, 'departure minute') };
}

export function createDeparture(admitted, exits) {
  return checkpoint({ version: 1, admitted, exits, minute: 0 });
}

export function departureSummary(raw) {
  const state = checkpoint(raw), rate = state.exits * GUEST_FLOW.exitRate;
  const departed = Math.min(state.admitted, state.minute * rate);
  const remaining = state.admitted - departed;
  const duration = rate ? Math.ceil(state.admitted / rate) : state.admitted ? null : 0;
  return { ...state, rate, departed, remaining, complete: remaining === 0,
    blocked: remaining > 0 && rate === 0, duration };
}

export function advanceDeparture(raw, minute) {
  const state = checkpoint(raw); integer(minute, 'departure target');
  if (minute < state.minute) throw new RangeError('Departure cannot move backwards');
  const duration = departureSummary(state).duration;
  return { ...state, minute: duration === null ? 0 : Math.min(duration, minute) };
}

export function departureEvents(raw) {
  const state = checkpoint(raw), events = [], rate = state.exits * GUEST_FLOW.exitRate;
  for (let minute = 1, remaining = state.admitted; minute <= state.minute && remaining && rate; minute++) {
    const count = Math.min(remaining, rate); remaining -= count;
    events.push({ action: 'departure', id: `departure:${minute}`, minute, cause: 'show-ended', entity: 'exit', result: { count } });
  }
  return events;
}

export function loadDeparture(raw) {
  const state = checkpoint(raw), normalized = advanceDeparture(createDeparture(state.admitted, state.exits), state.minute);
  if (normalized.minute !== state.minute) throw new TypeError('Departure checkpoint exceeds its duration');
  return normalized;
}
