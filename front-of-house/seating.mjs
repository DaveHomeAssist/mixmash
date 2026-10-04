// Versioned independent seat/lawn demand, whole-dollar receipts and value satisfaction.
import { PRICE_BASE, PRICE_SLOPE, PRICE_FLOOR, PRICE_CEIL } from './data.mjs';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const whole = (n, label, max = 1e9) => {
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new TypeError(`Invalid seating ${label}`);
  return n;
};
const finite = (n, label, lo, hi) => {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < lo || n > hi) throw new TypeError(`Invalid seating ${label}`);
  return n;
};
export function seatingTerms(raw) {
  if (!object(raw) || raw.version !== 1) throw new TypeError('Invalid seating terms');
  return { version: 1 };
}
export function seatingContract(raw) {
  const terms = seatingTerms(raw);
  return { ...terms, lawnPrice: whole(raw.lawnPrice, 'lawn price', 1e6), seatPrice: whole(raw.seatPrice, 'seat price', 1e6) };
}
export function seatingSales(raw, inputs) {
  const terms = seatingTerms(raw);
  if (!object(inputs)) throw new TypeError('Invalid seating inputs');
  const capacity = whole(inputs.capacity, 'capacity'), seats = Math.min(capacity, whole(inputs.seats, 'seats'));
  const potential = whole(Math.round(finite(inputs.potential, 'potential', 0, 1e9)), 'potential');
  const lawnPrice = whole(inputs.lawnPrice, 'lawn price', 1e6), seatPrice = whole(inputs.seatPrice, 'seat price', 1e6);
  const fairPrice = whole(inputs.fairPrice, 'fair price', 1e6);
  if (!fairPrice) throw new TypeError('Invalid seating fair price');
  const share = finite(inputs.presaleShare, 'presale share', 0, 1);
  const walkupMult = finite(inputs.walkupMult ?? 1, 'walkup multiplier', 0, 1);
  const seatPotential = capacity ? Math.round(potential * (seats / capacity)) : 0;
  function zone(id, cap, audience, price, fair) {
    const factor = clamp(PRICE_BASE - PRICE_SLOPE * price / fair, PRICE_FLOOR, PRICE_CEIL);
    const demand = Math.round(audience * factor);
    const presale = Math.min(cap, demand, Math.round(demand * share));
    const walkupDemand = demand - presale, walkup = Math.min(cap - presale, Math.round(walkupDemand * walkupMult));
    const attendance = presale + walkup, gross = whole(attendance * price, 'gross', Number.MAX_SAFE_INTEGER);
    return { id, capacity: cap, potential: audience, price, fairPrice: fair, demand, presale, walkupDemand, walkup, attendance, gross };
  }
  const seated = zone('seats', seats, seatPotential, seatPrice, fairPrice + 10);
  const lawn = zone('lawn', capacity - seats, capacity ? potential - seatPotential : 0, lawnPrice, fairPrice);
  return { terms, capacity, potential: capacity ? potential : 0, seats: seated, lawn,
    demand: seated.demand + lawn.demand, presale: seated.presale + lawn.presale,
    walkupDemand: seated.walkupDemand + lawn.walkupDemand, walkup: seated.walkup + lawn.walkup,
    attendance: seated.attendance + lawn.attendance, ticketGross: whole(seated.gross + lawn.gross, 'gross', Number.MAX_SAFE_INTEGER) };
}
export function seatingSatisfaction(sales, sharedScore) {
  finite(sharedScore, 'shared satisfaction', 0, 100);
  if (!object(sales)) throw new TypeError('Invalid seating sales');
  function score(zone) {
    if (!object(zone)) throw new TypeError('Invalid seating zone');
    whole(zone.attendance, 'attendance');whole(zone.price, 'price', 1e6);
    finite(zone.fairPrice, 'zone fair price', 1, 1e6 + 10);
    return Math.round(clamp(sharedScore - Math.min(20, 10 * Math.max(0, zone.price / zone.fairPrice - 1)), 0, 100));
  }
  const seats = score(sales.seats), lawn = score(sales.lawn), count = sales.seats.attendance + sales.lawn.attendance;
  return { seats, lawn, combined: count ? Math.round((seats * sales.seats.attendance + lawn * sales.lawn.attendance) / count) : Math.round(sharedScore) };
}
