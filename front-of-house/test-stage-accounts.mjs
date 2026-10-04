// Festival stages conserve site guests and reconcile production, artists and cash.
import test from 'node:test';
import assert from 'node:assert/strict';
import { festivalTerms, festivalSales, festivalProduction, festivalSettlement } from './stage-accounts.mjs';
import { SPONSOR_PAY, BROADCAST_PER_HEAD } from './data.mjs';
const terms = { version: 1 };
const audience = { capacity: 100, secondCapacity: 40, demand: 100, mainDraw: 60, secondDraw: 40, price: 100, presaleShare: 0.4 };
const rig = { paTier: 'M', housePa: true, lights: false };
const siteCosts = { rental: 500, permit: 100, fence: 100, staff: 100, bars: 50, restrooms: 50, ads: 0, incident: 100 };
const input = { audience, rig, siteCosts, mainAsk: 2000, mainDeal: 'door', bar: 200, broadcast: false };
const sale = extra => festivalSales(terms, { ...audience, ...extra });
const sheet = extra => festivalSettlement(terms, { ...input, ...extra });
function conserved(s) {
  assert.equal(s.main.attendance + s.second.attendance, s.attendance);
  assert.equal(s.main.presale + s.second.presale, s.presale);
  assert.equal(s.main.walkup + s.second.walkup, s.walkup);
  assert.equal(s.presale + s.walkup, s.attendance);
  assert.equal(s.main.ticketGross + s.second.ticketGross, s.ticketGross);
  assert.equal(s.ticketGross, s.attendance * s.price);
  assert.ok(s.attendance <= s.capacity);
  for (const z of [s.main, s.second]) { assert.ok(z.attendance <= z.capacity); assert.ok(z.presale <= z.attendance); assert.ok(z.walkup >= 0); }
}
function reconciles(r) {
  assert.equal(r.payout - r.upfront, r.net);
  assert.equal(r.main.net + r.second.net + r.bar + r.sponsor + r.broadcast, r.net);
  assert.equal(r.sales.ticketGross + r.bar + r.sponsor + r.broadcast - r.costs - r.artistPay, r.net);
  assert.equal(r.main.allocatedSiteCost + r.second.allocatedSiteCost, r.sharedTotal);
  assert.equal(r.main.production.total + r.second.production.total + r.sharedTotal, r.costs);
}
test('one site admission allocates exact tickets and presales to two stages', () => {
  const s = sale(); conserved(s);
  assert.deepEqual([s.main.attendance, s.second.attendance, s.main.presale, s.second.presale, s.ticketGross], [60, 40, 24, 16, 10000]);
  assert.equal(sale({ secondDraw: 1000 }).attendance, s.attendance, 'a second act cannot create ticket sales');
});
test('stage limits redistribute crowd without exceeding the common permit', () => {
  for (const capacity of [0, 1, 37, 100, 200]) for (const secondCapacity of [0, 1, 40, 500])
    for (const demand of [0, 1, 99, 10000]) for (const mainDraw of [0, 60, 1000]) for (const secondDraw of [0, 40, 1000]) {
      const s = sale({ capacity, secondCapacity, demand, mainDraw, secondDraw }); conserved(s); assert.equal(s.attendance, Math.min(capacity, demand));
    }
});
test('walk-up loss preserves prepaid guests and cannot manufacture replacement guests', () => {
  for (const presaleShare of [0, 0.4, 1]) for (const walkupMult of [0, 0.25, 0.5, 1]) for (const demand of [0, 1, 75, 1000]) {
    const s = sale({ presaleShare, walkupMult, demand }); conserved(s);
    assert.equal(s.presale, sale({ presaleShare, demand }).presale);
    if (!walkupMult) assert.equal(s.attendance, s.presale);
  }
});
test('each stage pays real production while shared expenses stay at the site', () => {
  const p = festivalProduction(terms, rig);
  assert.deepEqual(p, { main: { pa: 0, lights: 0, crew: 150, total: 150 }, second: { pa: 450, lights: 175, crew: 150, total: 775 }, total: 925 });
  assert.equal(festivalProduction(terms, { ...rig, housePa: false, lights: true }).main.total, 775);
  assert.equal(festivalProduction(terms, { ...rig, paTier: 'S', housePa: false }).main.pa, 200);
});
test('hand-calculated door settlements charge both stages and reconcile opening/signing cash', () => {
  const r = sheet(); reconciles(r);
  assert.equal(r.main.allocatedSiteCost, 600); assert.equal(r.second.allocatedSiteCost, 400);
  assert.equal(r.main.artistBasis, 5250); assert.equal(r.main.artistPay, 3675);
  assert.equal(r.second.artistBasis, 2825); assert.equal(r.second.artistPay, 1978);
  assert.equal(r.main.net, 1575); assert.equal(r.second.net, 847);
  assert.equal(r.upfront, 1825); assert.equal(r.payout, 4447); assert.equal(r.net, 2622);
});
test('main guarantees are paid once, with side door pay withheld at signing', () => {
  const r = sheet({ mainDeal: 'guarantee' }); reconciles(r);
  assert.equal(r.main.artistPay, 2000); assert.equal(r.second.artistPay, 1978);
  assert.equal(r.upfront, 3825); assert.equal(r.payout, 8122); assert.equal(r.net, 4297);
});
test('sponsor and broadcast are single site lines outside both ticket bases', () => {
  const a = sheet({ mainDeal: 'guarantee' }), b = sheet({ mainDeal: 'sponsor', broadcast: true }); reconciles(b);
  assert.equal(b.main.artistBasis, a.main.artistBasis); assert.equal(b.second.artistPay, a.second.artistPay);
  assert.equal(b.sponsor, SPONSOR_PAY); assert.equal(b.broadcast, 100 * BROADCAST_PER_HEAD);
  assert.equal(b.upfront, a.upfront - SPONSOR_PAY); assert.equal(b.payout, a.payout + b.broadcast);
  assert.equal(b.net, a.net + SPONSOR_PAY + b.broadcast);
});
test('empty and free shows retain production, guarantees and exact loss accounting', () => {
  for (const extra of [{ demand: 0 }, { capacity: 0 }, { price: 0 }]) for (const mainDeal of ['door', 'guarantee', 'sponsor']) {
    const r = sheet({ audience: { ...audience, ...extra }, mainDeal, bar: 0 }); reconciles(r);
    assert.equal(r.sales.ticketGross, 0); assert.equal(r.second.artistPay, 0);
    assert.equal(r.main.artistPay, mainDeal === 'door' ? 0 : 2000);
    assert.equal(r.costs, 1925);
  }
  assert.equal(sheet({ audience: { ...audience, demand: 0 } }).second.allocatedSiteCost, 400);
});
test('odd dollar allocations and bounded large receipts conserve every dollar', () => {
  for (const capacity of [1, 3, 99, 1e6]) for (const secondCapacity of [0, 1, 40, 500000]) {
    const r = sheet({ audience: { ...audience, capacity, secondCapacity, demand: 1e9, price: 1e6 }, siteCosts: { ...siteCosts, rental: 1e12, ads: 1 } });
    conserved(r.sales); reconciles(r); assert.ok(Number.isSafeInteger(r.net));
  }
});
test('source normalization ignores imported totals, stays deterministic and never mutates inputs', () => {
  const before = structuredClone(input); assert.deepEqual(festivalTerms({ version: 1, net: 99999 }), terms);
  assert.deepEqual(sheet(), sheet()); assert.deepEqual(input, before);
  assert.deepEqual(festivalSettlement({ version: 1, sponsor: 9999 }, { ...input, net: 1e6, artistPay: 0 }), sheet());
});
test('unknown policy and unsafe source values fail explicitly', () => {
  for (const raw of [null, [], {}, { version: 2 }]) assert.throws(() => festivalSales(raw, audience), /Invalid Festival/);
  for (const key of ['capacity', 'secondCapacity', 'demand', 'mainDraw', 'secondDraw', 'price']) for (const value of [-1, 0.5, NaN, Infinity, '1', 1e13]) assert.throws(() => sale({ [key]: value }), /Invalid Festival/);
  for (const key of ['presaleShare', 'walkupMult']) for (const value of [-1, 1.1, NaN, Infinity, '1']) assert.throws(() => sale({ [key]: value }), /Invalid Festival/);
  for (const extra of [{ mainDeal: 'free' }, { mainAsk: -1 }, { bar: NaN }, { broadcast: 1 }, { rig: { ...rig, lights: 1 } }, { rig: { ...rig, housePa: null } }, { rig: { ...rig, paTier: 'L' } }, { siteCosts: {} }, { siteCosts: { ...siteCosts, incident: -1 } }]) assert.throws(() => sheet(extra), /Invalid Festival/);
});
