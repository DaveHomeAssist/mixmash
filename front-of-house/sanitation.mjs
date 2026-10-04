// Finite restroom visits, stall condition and exclusive cleaning-worker replay.
import { loadServices, saveServices } from './services.mjs';
import { concessionsFor, foodTerms } from './concessions.mjs';

export const SANITATION = Object.freeze({ visitMinutes: 2, patience: 8, usesBeforeCleaning: 12, cleaningMinutes: 3, trailerStalls: 3 });
export function sanitationSpec(raw) {
  if (!raw || raw.version !== 1 || !Number.isSafeInteger(raw.portables) || raw.portables < 0 || raw.portables > 400) throw new TypeError('Invalid sanitation specification');
  for (const name of ['portableAccess', 'trailer', 'trailerAccess', 'utilities', 'cleaner']) {
    if (typeof raw[name] !== 'boolean') throw new TypeError(`Invalid sanitation ${name}`);
  }
  if (raw.portables + (raw.trailer ? SANITATION.trailerStalls : 0) > 400) throw new RangeError('Too many sanitation stalls');
  return { version: 1, portables: raw.portables, portableAccess: raw.portableAccess,
    trailer: raw.trailer, trailerAccess: raw.trailerAccess, utilities: raw.utilities, cleaner: raw.cleaner };
}

// Resolve the same admission/bar FIFO identities used by concessions. Optional
// food outcomes delay visits; the facility never duplicates a guest in that queue.
function visits(service, food) {
  const gate = [], bar = [], guests = [];
  let gateHead = 0, barHead = 0;
  for (const event of service.events) {
    const n = event.result?.count || 0;
    if (event.entity === 'gate' && event.cause === 'arrival') {
      for (let i = 0; i < n; i++) gate.push(`${event.id}:guest:${i}`);
    } else if (event.entity === 'gate' && event.cause === 'admission') {
      for (let i = 0; i < n; i++) {
        const guest = { id: gate[gateHead++], ordinal: guests.length, availableAt: null };
        guests.push(guest); bar.push(guest);
      }
    } else if (event.entity === 'gate' && event.action === 'expire') gateHead += n;
    else if (event.entity === 'bar' && (event.cause === 'service' || event.action === 'expire')) {
      for (let i = 0; i < n; i++) bar[barHead++].availableAt = event.minute;
    }
  }
  if (food) {
    const waiting = new Set(food.queue), outcomes = new Map();
    for (const e of food.events) if (['sale', 'patience', 'access', 'closed', 'stockout'].includes(e.cause)) outcomes.set(e.guestId, e.minute);
    for (const guest of guests) {
      if (waiting.has(guest.id)) guest.availableAt = null;
      else if (outcomes.has(guest.id)) guest.availableAt = outcomes.get(guest.id);
    }
  }
  return guests.map(g => ({ ...g, due: g.availableAt === null ? null : g.availableAt + 2 + g.ordinal % 4, status: 'pending' }));
}

export function sanitationFor(checkpoint, rawSpec, rawFood = null) {
  const spec = sanitationSpec(rawSpec), service = loadServices(checkpoint);
  const food = rawFood === null ? null : concessionsFor(checkpoint, rawFood);
  const guests = visits(service, food), byId = new Map(guests.map(g => [g.id, g]));
  const stalls = Array.from({ length: spec.portables + (spec.trailer ? SANITATION.trailerStalls : 0) }, (_, i) => ({
    id: i, type: i < spec.portables ? 'portable' : 'trailer',
    available: i < spec.portables ? spec.portableAccess : spec.trailerAccess && spec.utilities,
    uses: 0, visit: null, cleaningUntil: null,
  }));
  const queue = [], events = [], totals = { admitted: guests.length, requested: 0, served: 0, lost: 0, cleanings: 0,
    losses: { access: 0, patience: 0, closed: 0 } };
  let worker = null;
  const emit = (minute, cause, details) => events.push({ id: `${service.spec.id}:sanitation:${events.length + 1}`, minute, cause, ...details });
  const lose = (g, minute, cause) => { g.status = cause; totals.lost++; totals.losses[cause]++; emit(minute, cause, { guestId: g.id }); };
  for (let minute = 1; minute <= service.minute; minute++) {
    for (const stall of stalls) if (stall.visit?.completesAt === minute) {
      const g = byId.get(stall.visit.guestId); g.status = 'served'; totals.served++; stall.uses++;
      emit(minute, 'visit-complete', { guestId: g.id, stall: stall.id }); stall.visit = null;
    }
    if (worker?.completesAt === minute) {
      const stall = stalls[worker.stall]; stall.uses = 0; stall.cleaningUntil = null; totals.cleanings++;
      emit(minute, 'clean-complete', { stall: stall.id }); worker = null;
    }
    for (const g of guests) if (g.status === 'pending' && g.due === minute) {
      g.status = 'waiting'; totals.requested++; emit(minute, 'request', { guestId: g.id });
      if (!stalls.some(s => s.available)) lose(g, minute, 'access'); else queue.push(g);
    }
    // Admission ordinal is a stable tie-breaker for requests due together.
    queue.sort((a, b) => a.due - b.due || a.ordinal - b.ordinal);
    while (queue.length && minute - queue[0].due >= SANITATION.patience) lose(queue.shift(), minute, 'patience');
    if (spec.cleaner && !worker && minute + SANITATION.cleaningMinutes <= service.spec.closeAt) {
      const stall = stalls.find(s => s.available && s.uses >= SANITATION.usesBeforeCleaning && !s.visit);
      if (stall) {
        worker = { stall: stall.id, completesAt: minute + SANITATION.cleaningMinutes };
        stall.cleaningUntil = worker.completesAt; emit(minute, 'clean-start', { ...worker });
      }
    }
    if (minute + SANITATION.visitMinutes <= service.spec.closeAt) for (const stall of stalls) {
      if (!queue.length) break;
      if (!stall.available || stall.visit || stall.cleaningUntil !== null || stall.uses >= SANITATION.usesBeforeCleaning) continue;
      const g = queue.shift(); g.status = 'using';
      stall.visit = { guestId: g.id, completesAt: minute + SANITATION.visitMinutes };
      emit(minute, 'visit-start', { guestId: g.id, stall: stall.id, completesAt: stall.visit.completesAt });
    }
    if (minute === service.spec.closeAt) {
      while (queue.length) lose(queue.shift(), minute, 'closed');
      for (const g of guests) if (g.status === 'pending') { totals.requested++; lose(g, minute, 'closed'); }
    }
  }
  return { version: 1, spec, food: food ? foodTerms(food.terms.plan, food.terms.accessible) : null,
    services: saveServices(service), minute: service.minute, closed: service.minute === service.spec.closeAt,
    guests, stalls, worker, events, queue: queue.map(g => g.id),
    totals: { ...totals, waiting: queue.length, using: stalls.filter(s => s.visit).length,
      pending: guests.filter(g => g.status === 'pending').length,
      usableStalls: stalls.filter(s => s.available).length,
      dirtyStalls: stalls.filter(s => s.available && s.uses >= SANITATION.usesBeforeCleaning).length } };
}

export function saveSanitation(state) {
  return structuredClone({ version: 1, spec: state.spec, food: state.food, services: state.services });
}
export function loadSanitation(raw) {
  if (!raw || raw.version !== 1) throw new TypeError('Invalid sanitation checkpoint');
  return sanitationFor(raw.services, raw.spec, raw.food);
}
