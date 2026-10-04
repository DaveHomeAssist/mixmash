// Versioned held-run terms and exact remaining-night cancellation quotes.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function heldRunTerms(raw) {
  if (!object(raw) || raw.version !== 1 || ![2, 3].includes(raw.nights)
    || !Number.isSafeInteger(raw.ask) || raw.ask < 0 || raw.ask > 1e9) {
    throw new TypeError('Invalid held-run terms');
  }
  return { version: 1, nights: raw.nights, ask: raw.ask };
}
export function heldRunQuote(raw, completed) {
  const terms = heldRunTerms(raw);
  if (!Number.isSafeInteger(completed) || completed < 1 || completed > terms.nights) {
    throw new TypeError('Invalid completed-night count');
  }
  const remaining = terms.nights - completed;
  const feeEach = Math.round(terms.ask / 4);
  return { terms, completed, remaining, feeEach, penalty: remaining * feeEach };
}
