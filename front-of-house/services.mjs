// Deterministic aggregate admission/bar service model. Experimental engine core;
// the live game keeps its existing doors model until integration is verified.
const VERSION = 1;
const copy = (value) => structuredClone(value);
const integer = (value, name, min = 0, max = 6000) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(`Invalid ${name}`);
  return value;
};
const count = (queue) => queue.reduce((total, cohort) => total + cohort.count, 0);

function specification(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !/^[a-zA-Z0-9_]{1,64}$/.test(raw.id)) throw new TypeError('Invalid service run ID');
  const spec = { id: raw.id };
  for (const [name, min, max] of [
    ['closeAt', 1, 240], ['gateRate', 0, 6000], ['barRate', 0, 6000],
    ['workerRate', 1, 6000], ['travelMinutes', 1, 60],
    ['gatePatience', 1, 240], ['barPatience', 1, 240],
    ['ticketPrice', 0, 10000], ['barNet', 0, 10000],
  ]) spec[name] = integer(raw[name], name, min, max);
  if (!Array.isArray(raw.arrivals) || raw.arrivals.length > 240) throw new TypeError('Invalid arrivals');
  spec.arrivals = raw.arrivals.map((row) => {
    if (!row || typeof row !== 'object') throw new TypeError('Invalid arrival cohort');
    return {
      minute: integer(row.minute, 'arrival minute', 1, spec.closeAt),
      prepaid: integer(row.prepaid ?? 0, 'prepaid'),
      walkup: integer(row.walkup ?? 0, 'walkup'),
    };
  }).sort((a, b) => a.minute - b.minute);
  integer(spec.arrivals.reduce((sum, row) => sum + row.prepaid + row.walkup, 0), 'total arrivals');
  return spec;
}

function event(s, cause, entity, result) {
  const action = cause === 'patience' || cause === 'closed' ? 'expire' : cause;
  s.events.push({ action, id: `${s.spec.id}:${s.events.length + 1}`, minute: s.minute, cause, entity, result });
}

export function createServices(raw) {
  const spec = specification(raw);
  const prepaid = spec.arrivals.reduce((sum, row) => sum + row.prepaid, 0);
  const s = {
    version: VERSION, spec, minute: 0, commands: [],
    worker: { station: 'bar', destination: null, arrivesAt: null },
    gate: [], bar: [],
    totals: { arrived: 0, admitted: 0, abandoned: 0, barServed: 0, barLost: 0,
      prepaidCash: prepaid * spec.ticketPrice, walkupCash: 0, refunds: 0, barCash: 0 },
    events: [],
  };
  if (prepaid) event(s, 'presale', 'tickets', { count: prepaid, cash: s.totals.prepaidCash });
  return s;
}

// Commands occur between minute steps. Rejected commands preserve the input.
export function assignServiceWorker(state, station) {
  if (station !== 'bar' && station !== 'gate') return { state, error: 'Choose bar or gate' };
  if (state.minute >= state.spec.closeAt) return { state, error: 'Services are closed' };
  if (state.worker.destination) return { state, error: 'Worker is in transit' };
  if (state.worker.station === station) return { state, error: 'Worker is already assigned there' };
  const s = copy(state);
  s.commands.push({ minute: s.minute, station });
  s.worker = { station: null, destination: station, arrivesAt: s.minute + s.spec.travelMinutes };
  event(s, 'transfer-start', 'worker', { destination: station, arrivesAt: s.worker.arrivesAt });
  return { state: s, error: null };
}

function expire(s, queue, station, closing = false) {
  const patience = station === 'gate' ? s.spec.gatePatience : s.spec.barPatience;
  while (queue.length && (closing || s.minute - queue[0].at >= patience)) {
    const cohort = queue.shift();
    if (station === 'gate') {
      s.totals.abandoned += cohort.count;
      const refund = cohort.kind === 'prepaid' ? cohort.count * s.spec.ticketPrice : 0;
      s.totals.refunds += refund;
      event(s, closing ? 'closed' : 'patience', station, { kind: cohort.kind, count: cohort.count, refund });
    } else {
      s.totals.barLost += cohort.count;
      event(s, closing ? 'closed' : 'patience', station, { count: cohort.count });
    }
  }
}

function serve(s, station, capacity) {
  const queue = s[station];
  while (capacity > 0 && queue.length) {
    const cohort = queue[0];
    const served = Math.min(capacity, cohort.count);
    capacity -= served;
    cohort.count -= served;
    if (station === 'gate') {
      s.totals.admitted += served;
      const cash = cohort.kind === 'walkup' ? served * s.spec.ticketPrice : 0;
      s.totals.walkupCash += cash;
      s.bar.push({ at: s.minute, count: served });
      event(s, 'admission', station, { kind: cohort.kind, count: served, cash });
    } else {
      const cash = served * s.spec.barNet;
      s.totals.barServed += served;
      s.totals.barCash += cash;
      event(s, 'service', station, { count: served, cash });
    }
    if (!cohort.count) queue.shift();
  }
}

export function advanceServices(state, targetMinute) {
  integer(targetMinute, 'target minute', state.minute, state.spec.closeAt);
  const s = copy(state);
  while (s.minute < targetMinute) {
    s.minute++;
    if (s.worker.destination && s.worker.arrivesAt === s.minute) {
      s.worker = { station: s.worker.destination, destination: null, arrivesAt: null };
      event(s, 'transfer-complete', 'worker', { station: s.worker.station });
    }
    for (const kind of ['prepaid', 'walkup']) {
      for (const row of s.spec.arrivals.filter((item) => item.minute === s.minute)) {
        if (!row[kind]) continue;
        s.gate.push({ at: s.minute, kind, count: row[kind] });
        s.totals.arrived += row[kind];
        event(s, 'arrival', 'gate', { kind, count: row[kind] });
      }
    }
    expire(s, s.gate, 'gate');
    expire(s, s.bar, 'bar');
    serve(s, 'gate', s.spec.gateRate + (s.worker.station === 'gate' ? s.spec.workerRate : 0));
    serve(s, 'bar', s.spec.barRate + (s.worker.station === 'bar' ? s.spec.workerRate : 0));
    if (s.minute === s.spec.closeAt) {
      expire(s, s.gate, 'gate', true);
      expire(s, s.bar, 'bar', true);
    }
  }
  return s;
}

export function serviceSummary(s) {
  const queue = (station) => {
    const rate = s.spec[`${station}Rate`] + (s.worker.station === station ? s.spec.workerRate : 0);
    const waiting = count(s[station]);
    return { waiting, oldestWait: waiting ? s.minute - s[station][0].at : 0,
      rate, estimatedMinutes: rate ? Math.ceil(waiting / rate) : (waiting ? null : 0) };
  };
  return { minute: s.minute, closed: s.minute === s.spec.closeAt, worker: copy(s.worker),
    gate: queue('gate'), bar: queue('bar'), ...s.totals,
    ticketCash: s.totals.prepaidCash + s.totals.walkupCash - s.totals.refunds,
    cash: s.totals.prepaidCash + s.totals.walkupCash - s.totals.refunds + s.totals.barCash };
}

export function saveServices(s) {
  return copy({ version: VERSION, spec: s.spec, minute: s.minute, commands: s.commands });
}

// Rebuild derived state rather than trusting balances or queue contents in a save.
export function loadServices(raw) {
  if (!raw || raw.version !== VERSION || !Array.isArray(raw.commands) || raw.commands.length > 240) {
    throw new TypeError('Invalid service checkpoint');
  }
  let s = createServices(raw.spec);
  const minute = integer(raw.minute, 'checkpoint minute', 0, s.spec.closeAt);
  for (const command of raw.commands) {
    if (!command || typeof command !== 'object') throw new TypeError('Invalid worker command');
    integer(command.minute, 'command minute', s.minute, minute);
    s = advanceServices(s, command.minute);
    const result = assignServiceWorker(s, command.station);
    if (result.error) throw new TypeError(`Invalid worker command: ${result.error}`);
    s = result.state;
  }
  return advanceServices(s, minute);
}
