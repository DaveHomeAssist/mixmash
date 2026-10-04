// Bounded itemized career cash journal with exact archived totals and monotonic event identity.
export const CAREER_LEDGER_ROWS = 128;
export const CAREER_CATEGORIES = Object.freeze(['acquisition', 'disposal', 'development', 'developmentRefund', 'showOpening', 'incident', 'settlement']);
const negative = new Set(['acquisition', 'development', 'incident']);
const positive = new Set(['disposal', 'developmentRefund', 'settlement']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const copy = value => structuredClone(value);
const zeroTotals = () => Object.fromEntries(CAREER_CATEGORIES.map(key => [key, 0]));
const integer = (value, label) => {
  if (!Number.isSafeInteger(value)) throw new TypeError(`Invalid ${label}`);
  return value;
};
const add = (a, b) => integer(a + b, 'cash total');
function amountFor(category, amount) {
  integer(amount, 'cash movement');
  if (negative.has(category) && amount > 0 || positive.has(category) && amount < 0) throw new TypeError('Invalid category cash direction');
  return amount;
}
function eventFor(raw) {
  if (!object(raw) || !CAREER_CATEGORIES.includes(raw.category) || !Number.isSafeInteger(raw.sequence) || raw.sequence < 1) throw new TypeError('Invalid journal event');
  if (typeof raw.reference !== 'string' || !/^[a-zA-Z0-9_:-]{1,96}$/.test(raw.reference)) throw new TypeError('Invalid journal reference');
  return { sequence: raw.sequence, category: raw.category, cashDelta: amountFor(raw.category, raw.cashDelta), reference: raw.reference };
}
function derive(state) {
  const totals = { ...state.archived.totals };
  for (const entry of state.entries) totals[entry.category] = add(totals[entry.category], entry.cashDelta);
  state.totals = totals;
  state.balance = Object.values(totals).reduce(add, state.openingCash);
  state.nextSequence = add(state.archived.through, state.entries.length + 1);
  return state;
}
export function createCareerLedger(cash) {
  return derive({ version: 1, openingCash: integer(cash, 'opening cash'), archived: { through: 0, totals: zeroTotals() }, entries: [] });
}
export function saveCareerLedger(state) {
  return copy({ version: 1, openingCash: state.openingCash, archived: state.archived, entries: state.entries });
}
export function loadCareerLedger(raw) {
  if (!object(raw) || raw.version !== 1 || !object(raw.archived) || !object(raw.archived.totals) || !Array.isArray(raw.entries) || raw.entries.length > CAREER_LEDGER_ROWS) throw new TypeError('Invalid career journal');
  const through = integer(raw.archived.through, 'archived sequence');
  if (through < 0) throw new TypeError('Invalid archived sequence');
  const totals = Object.fromEntries(CAREER_CATEGORIES.map(category => [category, amountFor(category, raw.archived.totals[category])]));
  if (!through && Object.values(totals).some(value => value !== 0)) throw new TypeError('Unexpected archived cash');
  if (through > 0 && raw.entries.length !== CAREER_LEDGER_ROWS) throw new TypeError('Incomplete compacted journal');
  const entries = raw.entries.map(eventFor);
  entries.forEach((entry, i) => { if (entry.sequence !== add(through, i + 1)) throw new TypeError('Journal sequence is not continuous'); });
  return derive({ version: 1, openingCash: integer(raw.openingCash, 'opening cash'), archived: { through, totals }, entries });
}
export function appendCareerLedger(state, rawEvent) {
  try {
    const event = eventFor(rawEvent), next = loadCareerLedger(saveCareerLedger(state));
    if (event.sequence <= next.archived.through) throw new Error('That journal event is archived; it cannot be replayed');
    const prior = next.entries.find(entry => entry.sequence === event.sequence);
    if (prior) {
      if (JSON.stringify(prior) !== JSON.stringify(event)) throw new Error('Journal sequence was already used for a different event');
      return { state: next, cashDelta: 0, error: null };
    }
    if (event.sequence !== next.nextSequence) throw new Error('Use the next journal sequence');
    next.entries.push(event);
    if (next.entries.length > CAREER_LEDGER_ROWS) {
      const archived = next.entries.shift();
      next.archived.through = archived.sequence;
      next.archived.totals[archived.category] = add(next.archived.totals[archived.category], archived.cashDelta);
    }
    derive(next);
    return { state: next, cashDelta: event.cashDelta, error: null };
  } catch (error) { return { state, cashDelta: 0, error: error.message }; }
}
