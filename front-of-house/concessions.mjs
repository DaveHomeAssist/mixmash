// Finite vendor demand and money reconstructed from authoritative service replay.
import { loadServices, saveServices } from './services.mjs';

export const FOOD_PLANS = Object.freeze({
  standard: Object.freeze({ price: 8, windows: 1, rate: 2, stock: 80 }),
  premium: Object.freeze({ price: 12, windows: 2, rate: 4, stock: 160 }),
});
export const FOOD_RULES = Object.freeze({ patience: 6, barSpend: 8, unitCost: 3, wagePerWindow: 80 });

export function foodTerms(plan = 'standard', accessible = true) {
  if (!Object.hasOwn(FOOD_PLANS, plan) || typeof accessible !== 'boolean') throw new TypeError('Invalid food terms');
  return { version: 1, plan, accessible };
}

function termsFrom(raw) {
  if (!raw || raw.version !== 1 || typeof raw.plan !== 'string' || typeof raw.accessible !== 'boolean') throw new TypeError('Invalid food terms version');
  return foodTerms(raw.plan, raw.accessible);
}

// The caller supplies the engine's validated service checkpoint. Never trust
// imported balances, queue contents or consumer budgets as financial authority.
export function concessionsFor(checkpoint, rawTerms) {
  const terms = termsFrom(rawTerms), plan = FOOD_PLANS[terms.plan];
  const service = loadServices(checkpoint), guests = [], events = [], gate = [], bar = [], queue = [];
  let gateHead = 0, barHead = 0, stock = plan.stock;
  const totals = { admitted: 0, interested: 0, declinedPrice: 0, declinedBudget: 0,
    requested: 0, served: 0, lost: 0, barSpend: 0, foodSpend: 0 };
  const emit = (guest, minute, cause, result = {}) => events.push({
    id: `${guest.id}:food:${cause}`, minute, entity: 'food', cause, guestId: guest.id, result,
  });
  const lose = (guest, minute, cause) => {
    guest.food = cause; totals.lost++; emit(guest, minute, cause);
  };
  const request = (guest, event, boughtDrink) => {
    if (!guest || guest.food !== 'bar') throw new Error('Inconsistent bar outcomes');
    if (boughtDrink) {
      guest.barSpend = FOOD_RULES.barSpend; guest.remaining -= guest.barSpend;
      totals.barSpend += guest.barSpend;
    }
    if (guest.ordinal % 2 !== 0) { guest.food = 'uninterested'; return; }
    totals.interested++;
    if (plan.price > (guest.ordinal % 4 === 0 ? 12 : 8)) {
      guest.food = 'declined-price'; totals.declinedPrice++; emit(guest, event.minute, guest.food); return;
    }
    if (guest.remaining < plan.price) {
      guest.food = 'declined-budget'; totals.declinedBudget++; emit(guest, event.minute, guest.food); return;
    }
    totals.requested++; guest.requestedAt = event.minute; guest.food = 'waiting';
    emit(guest, event.minute, 'request', { source: event.id, switched: !boughtDrink });
    if (!terms.accessible) lose(guest, event.minute, 'access');
    else if (!stock) lose(guest, event.minute, 'stockout');
    else queue.push(guest);
  };
  const byMinute = new Map();
  for (const event of service.events) {
    if (!byMinute.has(event.minute)) byMinute.set(event.minute, []);
    byMinute.get(event.minute).push(event);
  }
  for (let minute = 1; minute <= service.minute; minute++) {
    while (queue.length && minute - queue[0].requestedAt >= FOOD_RULES.patience) lose(queue.shift(), minute, 'patience');
    for (const event of byMinute.get(minute) || []) {
      const n = event.result?.count || 0;
      if (event.entity === 'gate' && event.cause === 'arrival') {
        for (let i = 0; i < n; i++) gate.push(`${event.id}:guest:${i}`);
      } else if (event.entity === 'gate' && event.cause === 'admission') {
        for (let i = 0; i < n; i++) {
          const id = gate[gateHead++], ordinal = guests.length;
          if (!id) throw new Error('Inconsistent admission outcomes');
          const budget = ordinal % 3 === 0 ? 16 : 24;
          const guest = { id, ordinal, budget, remaining: budget, barSpend: 0, foodSpend: 0, food: 'bar' };
          guests.push(guest); bar.push(guest); totals.admitted++;
        }
      } else if (event.entity === 'gate' && event.action === 'expire') gateHead += n;
      else if (event.entity === 'bar' && (event.cause === 'service' || event.action === 'expire')) {
        for (let i = 0; i < n; i++) request(bar[barHead++], event, event.cause === 'service');
      }
    }
    let available = terms.accessible ? plan.rate : 0;
    while (available-- > 0 && stock > 0 && queue.length) {
      const guest = queue.shift();
      guest.remaining -= plan.price; guest.foodSpend = plan.price; guest.food = 'served';
      stock--; totals.served++; totals.foodSpend += plan.price;
      emit(guest, minute, 'sale', { gross: plan.price, house: plan.price / 4 });
    }
    if (!stock || minute === service.spec.closeAt) {
      while (queue.length) lose(queue.shift(), minute, stock ? 'closed' : 'stockout');
    }
  }
  const vendorGross = totals.foodSpend, houseIncome = vendorGross / 4;
  const inventoryCost = plan.stock * FOOD_RULES.unitCost, wages = plan.windows * FOOD_RULES.wagePerWindow;
  return { version: 1, terms, minute: service.minute, closed: service.minute === service.spec.closeAt,
    services: saveServices(service), guests, events,
    queue: queue.map(g => g.id), stock,
    totals: { ...totals, waiting: queue.length, vendorGross, houseIncome,
      vendorReceipts: vendorGross - houseIncome, inventoryCost, wages,
      vendorProfit: vendorGross - houseIncome - inventoryCost - wages } };
}

export function saveConcessions(state) {
  return structuredClone({ version: 1, terms: state.terms, services: state.services });
}

export function loadConcessions(raw) {
  if (!raw || raw.version !== 1) throw new TypeError('Invalid concessions checkpoint');
  return concessionsFor(raw.services, raw.terms);
}
