// Optional Club presale policy and collection receipt; no career cash changes on replay.
export const TICKETING_RULES = Object.freeze({ shareGain: 0.2, maxShare: 0.9, feePercent: 4 });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`Invalid ticketing ${label}`);
  return value;
};
export function ticketingTerms(raw) {
  if (!object(raw) || raw.version !== 1 || !['direct', 'platform'].includes(raw.plan)) throw new TypeError('Invalid ticketing terms');
  return { version: 1, plan: raw.plan };
}
export function ticketingSplit(raw, { demand, baseShare, capacity }) {
  const terms = ticketingTerms(raw);
  if (typeof demand !== 'number' || !Number.isFinite(demand) || demand < 0 || demand > Number.MAX_SAFE_INTEGER) throw new TypeError('Invalid ticketing demand');
  if (typeof baseShare !== 'number' || !Number.isFinite(baseShare) || baseShare < 0 || baseShare > 1) throw new TypeError('Invalid ticketing share');
  integer(capacity, 'capacity');
  const total = integer(Math.round(demand), 'population');
  const share = terms.plan === 'platform' ? Math.max(baseShare, Math.min(TICKETING_RULES.maxShare, baseShare + TICKETING_RULES.shareGain)) : baseShare;
  const presale = Math.min(capacity, total, Math.round(demand * share));
  return { terms, share, presale, walkup: total - presale };
}
export function ticketingReceipt(raw, { presale, price }) {
  const terms = ticketingTerms(raw);
  integer(presale, 'presale'); integer(price, 'price');
  const gross = integer(presale * price, 'gross');
  // Quotient/remainder keeps percent rounding exact without overflowing gross * percent.
  const percent = terms.plan === 'platform' ? TICKETING_RULES.feePercent : 0;
  const fee = Math.floor(gross / 100) * percent + Math.round((gross % 100) * percent / 100);
  return { terms, presale, price, gross, fee, remitted: gross - fee };
}
