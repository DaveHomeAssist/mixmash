// Seats and lawn have conserved capacity, separate sales and weighted value satisfaction.
import test from 'node:test';import assert from 'node:assert/strict';
import {seatingTerms,seatingSales,seatingSatisfaction} from './seating.mjs';
const terms={version:1},base={capacity:700,seats:400,potential:700,lawnPrice:40,seatPrice:50,fairPrice:40,presaleShare:0.4};
const sale=extra=>seatingSales(terms,{...base,...extra});
test('fair-price zones conserve the common potential, capacity and exact receipts',()=>{
 const s=sale();assert.equal(s.seats.potential,400);assert.equal(s.lawn.potential,300);assert.equal(s.attendance,700);assert.equal(s.ticketGross,32000);
 assert.equal(s.seats.presale,160);assert.equal(s.lawn.presale,120);assert.equal(s.seats.capacity+s.lawn.capacity,s.capacity);assert.equal(s.seats.gross+s.lawn.gross,s.ticketGross);
 for(const potential of [0,1,2,37,699,701,1000]){const q=sale({potential});assert.equal(q.seats.potential+q.lawn.potential,potential);assert.ok(q.attendance<=q.capacity);assert.equal(q.presale+q.walkup,q.attendance);}
});
test('each price changes only its own demand and cannot refill the other zone',()=>{
 const normal=sale(),seatHigh=sale({seatPrice:80}),lawnHigh=sale({lawnPrice:80});
 assert.ok(seatHigh.seats.attendance<normal.seats.attendance);assert.deepEqual(seatHigh.lawn,normal.lawn);
 assert.ok(lawnHigh.lawn.attendance<normal.lawn.attendance);assert.deepEqual(lawnHigh.seats,normal.seats);
 assert.ok(seatHigh.attendance<normal.attendance);assert.ok(lawnHigh.attendance<normal.attendance);
});
test('walkup losses preserve paid presales and cannot oversell either zone',()=>{
 for(const potential of [0,100,700,10000])for(const presaleShare of [0,0.4,1])for(const walkupMult of [0,0.5,1]){
  const s=sale({potential,presaleShare,walkupMult});for(const z of [s.seats,s.lawn]){assert.ok(z.attendance>=z.presale);assert.ok(z.attendance<=z.capacity);assert.equal(z.gross,z.attendance*z.price);if(walkupMult===0)assert.equal(z.attendance,z.presale);}
 }
});
test('zero or constrained zone capacity is explicit and never creates audience',()=>{
 assert.equal(sale({capacity:0}).attendance,0);assert.equal(sale({capacity:0}).ticketGross,0);
 assert.equal(sale({seats:0}).seats.attendance,0);assert.equal(sale({seats:0}).lawn.attendance,700);
 assert.equal(sale({capacity:200}).lawn.attendance,0);assert.equal(sale({capacity:200}).seats.attendance,200);
 assert.equal(sale({lawnPrice:0,seatPrice:0}).ticketGross,0);
});
test('zone value scores differ and only attended zones weight the final score',()=>{
 const s=sale({seatPrice:80}),r=seatingSatisfaction(s,80);assert.equal(r.seats,74);assert.equal(r.lawn,80);assert.equal(r.combined,Math.round((74*s.seats.attendance+80*s.lawn.attendance)/s.attendance));
 assert.equal(seatingSatisfaction(sale({seats:0,seatPrice:80}),80).combined,80);
 assert.equal(seatingSatisfaction(sale({potential:0}),80).combined,80);assert.equal(seatingSatisfaction(sale({seatPrice:1,lawnPrice:1}),80).combined,80);
 assert.equal(seatingSatisfaction(sale({seatPrice:1000000}),5).seats,0);
});
test('source policy ignores derived fields and rejects malformed or unbounded inputs',()=>{
 assert.deepEqual(seatingTerms({...terms,fee:100,seatFairPrice:1}),terms);const before=structuredClone(base);seatingSales(terms,base);assert.deepEqual(base,before);
 for(const raw of [null,[],{}, {version:2}])assert.throws(()=>seatingSales(raw,base),/Invalid seating/);
 for(const [key,values] of Object.entries({capacity:[-1,0.5,1e9+1],seats:[-1,NaN],potential:[-1,Infinity,1e9+1],lawnPrice:[-1,1.5,1e6+1],seatPrice:[-1,'50'],fairPrice:[0,Infinity],presaleShare:[-0.1,1.1],walkupMult:[-1,1.1]}))for(const value of values)assert.throws(()=>sale({[key]:value}),/Invalid seating/);
 const large=sale({capacity:1e9,seats:5e8,potential:1e9,lawnPrice:1e6,seatPrice:1e6});assert.ok(Number.isSafeInteger(large.ticketGross));
});
