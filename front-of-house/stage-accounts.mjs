// Versioned Festival admissions, stage production and shared-site cash accounting.
import { PA_RENTAL, LIGHTS_RENTAL, STAFF_RATE, DOOR_SPLIT, SPONSOR_PAY, BROADCAST_PER_HEAD, FESTIVAL_DELAYS } from './data.mjs';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const whole = (value, label, max = 1e12) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new TypeError(`Invalid Festival ${label}`);
  return value;
};
const flag = (value, label) => {
  if (typeof value !== 'boolean') throw new TypeError(`Invalid Festival ${label}`);
  return value;
};
const fraction = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new TypeError(`Invalid Festival ${label}`);
  return value;
};
// Round an integer allocation once, without losing precision at large cash values.
const share = (total, weight, all) => all ? Number((2n * BigInt(total) * BigInt(weight) + BigInt(all)) / (2n * BigInt(all))) : 0;
export function festivalTerms(raw) {
  if (!object(raw) || raw.version !== 1) throw new TypeError('Invalid Festival terms');
  return { version: 1 };
}
export function festivalSales(raw, input) {
  const terms = festivalTerms(raw);
  if (!object(input)) throw new TypeError('Invalid Festival audience');
  const capacity = whole(input.capacity, 'capacity', 1e6);
  const secondCapacity = Math.min(capacity, whole(input.secondCapacity, 'side capacity', 1e6));
  const mainCapacity = capacity - secondCapacity;
  const demand = whole(input.demand, 'demand', 1e9);
  const mainDraw = whole(input.mainDraw, 'main draw', 1e9), secondDraw = whole(input.secondDraw, 'side draw', 1e9);
  const price = whole(input.price, 'price', 1e6);
  const presale = Math.min(capacity, Math.round(demand * fraction(input.presaleShare, 'presale share')));
  const walkup = Math.min(capacity - presale, Math.round((demand - presale) * fraction(input.walkupMult ?? 1, 'walkup multiplier')));
  const attendance = presale + walkup;
  const desired = mainDraw + secondDraw ? share(attendance, secondDraw, mainDraw + secondDraw) : share(attendance, secondCapacity, capacity);
  const sideCount = Math.max(attendance - mainCapacity, Math.min(secondCapacity, desired));
  const sidePresale = share(presale, sideCount, attendance);
  const stage = (id, cap, count, paid) => ({ id, capacity: cap, attendance: count, presale: paid, walkup: count - paid, ticketGross: count * price });
  const main = stage('main', mainCapacity, attendance - sideCount, presale - sidePresale);
  const second = stage('second', secondCapacity, sideCount, sidePresale);
  return { terms, capacity, demand, price, attendance, presale, walkup, main, second, ticketGross: main.ticketGross + second.ticketGross };
}
export function festivalProduction(raw, rig) {
  festivalTerms(raw);
  if (!object(rig) || ![null, 'S', 'M'].includes(rig.paTier)) throw new TypeError('Invalid Festival PA');
  const housePa = flag(rig.housePa, 'house PA'), lights = flag(rig.lights, 'lights');
  const owned = rig.equipmentOperation !== undefined;
  const main = { pa: owned || housePa || !rig.paTier ? 0 : PA_RENTAL[rig.paTier], lights: lights ? LIGHTS_RENTAL : 0, crew: 2 * STAFF_RATE,
    ...(owned ? { equipmentOperation: whole(rig.equipmentOperation, 'equipment operation') } : {}) };
  if (rig.delays !== undefined) { const count = whole(rig.delays, 'delay count', 2); if (count) main.delays = count * (FESTIVAL_DELAYS.rental + FESTIVAL_DELAYS.operator); }
  const second = { pa: PA_RENTAL.M, lights: LIGHTS_RENTAL, crew: 2 * STAFF_RATE };
  for (const stage of [main, second]) stage.total = Object.values(stage).reduce((sum, value) => sum + value, 0);
  return { main, second, total: main.total + second.total };
}
export function festivalSettlement(raw, input) {
  const terms = festivalTerms(raw);
  if (!object(input) || !object(input.siteCosts)) throw new TypeError('Invalid Festival settlement');
  const sales = festivalSales(terms, input.audience), production = festivalProduction(terms, input.rig);
  const mainAsk = whole(input.mainAsk, 'main ask');
  if (!['door', 'guarantee', 'sponsor'].includes(input.mainDeal)) throw new TypeError('Invalid Festival main deal');
  const bar = whole(input.bar, 'bar income');
  const broadcast = flag(input.broadcast, 'broadcast') ? sales.attendance * BROADCAST_PER_HEAD : 0;
  const sponsor = input.mainDeal === 'sponsor' ? SPONSOR_PAY : 0;
  const siteCosts = Object.fromEntries(['rental', 'permit', 'fence', 'staff', 'bars', 'restrooms', 'ads', 'incident'].map(key => [key, whole(input.siteCosts[key], `site ${key}`)]));
  const sharedTotal = Object.values(siteCosts).reduce((sum, value) => sum + value, 0);
  const sideAllocation = sales.attendance ? share(sharedTotal, sales.second.attendance, sales.attendance)
    : share(sharedTotal, sales.second.capacity, sales.capacity);
  const account = (sale, costs, allocatedSiteCost, deal, ask) => {
    const artistBasis = Math.max(0, sale.ticketGross - costs.total - allocatedSiteCost);
    const artistPay = deal === 'door' ? share(artistBasis, Math.round(DOOR_SPLIT * 100), 100) : ask;
    return { ...sale, production: costs, allocatedSiteCost, deal, artistBasis, artistPay,
      net: sale.ticketGross - costs.total - allocatedSiteCost - artistPay };
  };
  const main = account(sales.main, production.main, sharedTotal - sideAllocation, input.mainDeal, mainAsk);
  const second = account(sales.second, production.second, sideAllocation, 'door', 0);
  const artistPay = main.artistPay + second.artistPay;
  const costs = sharedTotal + production.total;
  const net = main.net + second.net + bar + sponsor + broadcast;
  const guarantee = input.mainDeal === 'door' ? 0 : main.artistPay;
  const upfront = costs - siteCosts.incident + guarantee - sponsor;
  const payout = sales.ticketGross + bar + broadcast - (artistPay - guarantee) - siteCosts.incident;
  return { terms, sales, production, siteCosts, sharedTotal, main, second, costs, artistPay, bar, sponsor, broadcast, upfront, payout, net };
}
