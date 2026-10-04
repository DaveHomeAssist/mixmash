// Cosmetic identities and paths reconstructed from authoritative service events.
// Nothing in this module changes a queue, a receipt or a saved checkpoint.
const pointKey = p => `${Math.floor(p.x)},${Math.floor(p.y)}`;
const outside = (p, grid) => p.x < 0 || p.y < 0 || p.x >= grid.w || p.y >= grid.h;
const same = (a, b) => a.x === b.x && a.y === b.y;

export function guestTimeline(events) {
  const guests = [], gate = [], bar = [];
  let gateHead = 0, barHead = 0;
  const move = (guest, zone, event) => {
    if (guest) guest.history.push({ zone, minute: event.minute, eventId: event.id, cause: event.cause });
  };
  for (const event of events) {
    const n = event.result?.count;
    if (!Number.isSafeInteger(n) || n < 0 || n > 6000) continue;
    if (event.cause === 'arrival' && event.entity === 'gate') {
      if (guests.length + n > 6000) throw new RangeError('Guest projection exceeds the service bound');
      for (let i = 0; i < n; i++) {
        const guest = { id: `${event.id}:guest:${i}`, history: [] };
        move(guest, 'gate', event); guests.push(guest); gate.push(guest);
      }
    } else if (event.cause === 'admission') {
      for (let i = 0; i < n; i++) { const guest = gate[gateHead++]; move(guest, 'bar', event); if (guest) bar.push(guest); }
    } else if (event.cause === 'service' && event.entity === 'bar') {
      for (let i = 0; i < n; i++) move(bar[barHead++], 'floor', event);
    } else if (event.action === 'expire') {
      for (let i = 0; i < n; i++) move(event.entity === 'gate' ? gate[gateHead++] : bar[barHead++], event.entity === 'gate' ? 'leaving' : 'floor', event);
    }
  }
  return guests;
}

function gridRoute(layout, start, end) {
  const open = new Set(layout.free.map(pointKey)), from = pointKey(start), to = pointKey(end);
  if (!open.has(from) || !open.has(to)) return null;
  const queue = [start], previous = new Map([[from, null]]);
  for (let i = 0; i < queue.length && !previous.has(to); i++) {
    const p = queue[i];
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const next = { x: p.x + dx, y: p.y + dy }, id = pointKey(next);
      if (open.has(id) && !previous.has(id)) { previous.set(id, p); queue.push(next); }
    }
  }
  if (!previous.has(to)) return null;
  const route = [];
  for (let p = end; p; p = previous.get(pointKey(p))) route.unshift(p);
  return route;
}

// Outside samples enter through the real gate; interior segments stay on free cells.
export function guestRoute(layout, start, end) {
  if (!start || !end) return null;
  const fromOutside = outside(start, layout.grid), toOutside = outside(end, layout.grid);
  if (fromOutside && toOutside) return [start, end];
  const interior = gridRoute(layout, fromOutside ? layout.gate : start, toOutside ? layout.gate : end);
  if (!interior || ((fromOutside || toOutside) && !layout.entry)) return null;
  return [ ...(fromOutside ? [start, layout.outsideGate, layout.entry] : []), ...interior,
    ...(toOutside ? [layout.entry, layout.outsideGate, end] : []) ];
}

export function alongGuestRoute(route, progress) {
  const lengths = route.slice(1).map((p, i) => Math.hypot(p.x - route[i].x, p.y - route[i].y));
  const total = lengths.reduce((a, b) => a + b, 0);
  let left = Math.max(0, Math.min(1, progress)) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i] && lengths[i] > 0) {
      const fraction = left / lengths[i], a = route[i], b = route[i + 1];
      return { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction, heading: Math.atan2(b.x - a.x, b.y - a.y), moving: progress > 0 && progress < 1 };
    }
    left -= lengths[i];
  }
  const end = route.at(-1), previous = route.at(-2) || end;
  return { x: end.x, y: end.y, heading: same(previous, end) ? Math.PI : Math.atan2(end.x - previous.x, end.y - previous.y), moving: false };
}

const atMinute = (guest, minute) => guest.history.filter(h => h.minute <= minute).at(-1);
const away = (p, layout, distance = 1) => layout.edge?.axis === 'x'
  ? { x: p.x, y: p.y + layout.edge.normal * distance }
  : { x: p.x + (layout.edge?.normal || 1) * distance, y: p.y };

export function guestFrame(layout, services, zoneProjection) {
  const guests = guestTimeline(services.events), minute = services.minute;
  const groups = (at) => Object.fromEntries(['gate', 'bar', 'floor'].map(zone => [zone, guests.filter(g => atMinute(g, at)?.zone === zone)]));
  const current = groups(minute), previous = groups(minute - 1);
  if (current.gate.length !== services.gate.waiting || current.bar.length !== services.bar.waiting || current.bar.length + current.floor.length !== services.admitted) {
    throw new Error('Guest events disagree with service counts');
  }
  const departed = guests.filter(g => { const h = g.history.at(-1); return h.zone === 'leaving' && h.minute === minute; });
  const leavingSlots = Math.min(12, departed.length);
  const old = zoneProjection(layout, { ...services, admitted: previous.bar.length + previous.floor.length, gate: { waiting: previous.gate.length }, bar: { waiting: previous.bar.length } }, services.minute, 180);
  const next = zoneProjection(layout, services, services.minute, 180 - leavingSlots);
  function bind(projection, zoneGuests) {
    const positions = new Map();
    for (const zone of ['gate', 'bar', 'floor']) {
      const samples = projection.actors.filter(a => a.zone === zone), candidates = zoneGuests[zone];
      samples.forEach((actor, i) => { const guest = candidates[Math.floor(i * candidates.length / samples.length)]; positions.set(guest.id, { ...actor, id: guest.id, guest }); });
    }
    return positions;
  }
  const prior = bind(old, previous), chosen = bind(next, current);
  for (let i = 0; i < leavingSlots; i++) {
    const guest = departed[Math.floor(i * departed.length / leavingSlots)], before = prior.get(guest.id) || layout.outsideGate;
    if (before) chosen.set(guest.id, { ...away(before, layout), id: guest.id, guest, zone: 'leaving' });
  }
  let unavailable = 0;
  const actors = [...chosen.values()].map(actor => {
    const { guest, ...target } = actor, history = guest.history.filter(h => h.minute === minute);
    const before = prior.get(guest.id);
    const oldZone = atMinute(guest, minute - 1)?.zone;
    // A newly selected sample uses its earlier zone anchor; no hidden agent state is saved.
    const start = before || (oldZone === 'bar' ? layout.bar : oldZone === 'floor' ? target : away(layout.outsideGate || target, layout));
    const waypoints = [start];
    for (const h of history) {
      if (h.zone === 'bar' && layout.gate && layout.bar) waypoints.push(layout.gate, layout.bar);
      else if (h.zone === 'floor' && layout.bar) waypoints.push(layout.bar);
    }
    waypoints.push(target);
    const route = [];
    for (let i = 1; i < waypoints.length; i++) {
      const segment = guestRoute(layout, waypoints[i - 1], waypoints[i]);
      if (!segment) { unavailable++; return { ...target, route: [target], events: history.map(h => h.eventId), routeUnavailable: true }; }
      route.push(...segment.filter((p, j) => !j || !same(p, segment[j - 1])));
    }
    return { ...target, route, events: history.map(h => h.eventId), routeUnavailable: false };
  });
  return { ...next, actors, leaving: departed.length, unavailable };
}
