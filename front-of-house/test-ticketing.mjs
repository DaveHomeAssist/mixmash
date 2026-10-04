// Ticketing conserves demand and money without claiming career integration.
import test from 'node:test';import assert from 'node:assert/strict';
import {ticketingTerms,ticketingSplit,ticketingReceipt} from './ticketing.mjs';
const direct={version:1,plan:'direct'},platform={version:1,plan:'platform'};
const split=(terms,over={})=>ticketingSplit(terms,{demand:100,baseShare:0.4,capacity:150,...over});
test('direct preserves the original split and platform exchanges presale protection for collection fees',()=>{
 const a=split(direct),b=split(platform);assert.equal(a.presale,40);assert.equal(a.walkup,60);assert.equal(b.presale,60);assert.equal(b.walkup,40);
 const ra=ticketingReceipt(direct,{presale:40,price:20}),rb=ticketingReceipt(platform,{presale:60,price:20});assert.equal(ra.fee,0);assert.equal(rb.fee,48);assert.equal(rb.remitted,1152);
 const cash=(s,r,walkupMult)=>s.presale*20+Math.round(s.walkup*walkupMult)*20-r.fee;
 assert.equal(cash(a,ra,1),2000);assert.equal(cash(b,rb,1),1952);
 assert.equal(cash(a,ra,0.5),1400);assert.equal(cash(b,rb,0.5),1552);
});
test('shares and capacity conserve integer populations even when demand exceeds the permit',()=>{
 for(const terms of [direct,platform])for(const demand of [0,0.49,0.5,1,99.5,500.5])for(const capacity of [0,1,70,500]){
  const s=split(terms,{demand,capacity});assert.equal(s.presale+s.walkup,Math.round(demand));assert.ok(s.presale<=capacity);assert.ok(s.walkup>=0);
 }
 assert.equal(split(platform,{baseShare:0.8}).share,0.9);assert.equal(split(platform,{baseShare:0.95}).share,0.95,'an already higher source share never decreases');
});
test('collection rounding is whole-dollar, bounded and exactly conserved',()=>{
 for(const price of [0,1,10,13,20,50])for(const presale of [0,1,2,3,100,360])for(const terms of [direct,platform]){
  const r=ticketingReceipt(terms,{presale,price});assert.equal(r.remitted+r.fee,r.gross);assert.equal(r.gross,presale*price);assert.equal(r.fee,terms.plan==='platform'?Math.round(r.gross*0.04):0);
 }
 assert.equal(ticketingReceipt(platform,{presale:1,price:12}).fee,0);assert.equal(ticketingReceipt(platform,{presale:1,price:13}).fee,1);
 const max=ticketingReceipt(platform,{presale:1,price:Number.MAX_SAFE_INTEGER});assert.equal(max.fee,360287970189640);assert.equal(max.remitted+max.fee,max.gross);
});
test('terms replay ignores derived values, is isolated and never mutates source input',()=>{
 const raw={...platform,feePercent:0,maxShare:1,fee:-999};const before=structuredClone(raw),terms=ticketingTerms(raw);assert.deepEqual(terms,platform);terms.plan='direct';assert.deepEqual(raw,before);
 assert.equal(ticketingReceipt(raw,{presale:100,price:20}).fee,80);assert.deepEqual(raw,before);
});
test('unknown policy and malformed or unsafe amounts fail explicitly',()=>{
 for(const raw of [null,{},[],{version:2,plan:'direct'},{version:1,plan:'free'}])assert.throws(()=>ticketingTerms(raw),/terms/);
 for(const demand of [-1,NaN,Infinity,'100'])assert.throws(()=>split(platform,{demand}),/demand/);
 for(const baseShare of [-1,1.1,NaN,'0.4'])assert.throws(()=>split(platform,{baseShare}),/share/);
 for(const capacity of [-1,0.5,Infinity,'100'])assert.throws(()=>split(platform,{capacity}),/capacity/);
 for(const [presale,price]of [[-1,20],[1.5,20],[1,NaN],[1,-1],[1,'20'],[2,Number.MAX_SAFE_INTEGER]])assert.throws(()=>ticketingReceipt(platform,{presale,price}),/ticketing/);
});
