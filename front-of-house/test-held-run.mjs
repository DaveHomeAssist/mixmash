// Cancellation money is derived from source terms, never saved fee claims.
import test from 'node:test';import assert from 'node:assert/strict';
import {heldRunTerms,heldRunQuote} from './held-run.mjs';
const terms=(nights=3,ask=4000)=>({version:1,nights,ask});
test('two and three held nights quote only unplayed nights',()=>{
 assert.deepEqual(heldRunQuote(terms(2),1),{terms:terms(2),completed:1,remaining:1,feeEach:1000,penalty:1000});
 assert.equal(heldRunQuote(terms(),1).penalty,2000);assert.equal(heldRunQuote(terms(),2).penalty,1000);
 assert.equal(heldRunQuote(terms(),3).penalty,0);assert.equal(heldRunQuote(terms(),3).remaining,0);
});
test('fee rounds once per cancelled night and conserves integer cash',()=>{
 for(const [ask,fee] of [[0,0],[1,0],[2,1],[3,1],[5,1],[6,2],[3999,1000],[1e9,250000000]]){
  const q=heldRunQuote(terms(3,ask),1);assert.equal(q.feeEach,fee);assert.equal(q.penalty,2*fee);
  const signedCash=3000+9000,after=signedCash-q.penalty;assert.equal(signedCash-after,q.penalty);assert.ok(Number.isSafeInteger(after));
 }
});
test('source replay ignores supplied derived prices and leaves inputs unchanged',()=>{
 const raw={...terms(),penalty:-100,feeEach:0,rate:0,remaining:0};const before=structuredClone(raw);
 assert.deepEqual(heldRunTerms(raw),terms());assert.equal(heldRunQuote(raw,1).penalty,2000);assert.deepEqual(raw,before);
 const q=heldRunQuote(raw,1);q.terms.ask=0;assert.equal(heldRunQuote(raw,1).penalty,2000);
});
test('invalid source terms are refused explicitly',()=>{
 for(const raw of [null,[],{}, {...terms(),version:2},...[-1,0,1,4,2.5,'3',NaN].map(nights=>({...terms(),nights})),...[-1,0.5,1e9+1,Infinity,NaN,'4000',Number.MAX_SAFE_INTEGER].map(ask=>({...terms(),ask}))]){
  assert.throws(()=>heldRunTerms(raw),/Invalid held-run terms/);assert.throws(()=>heldRunQuote(raw,1),/Invalid held-run terms/);
 }
});
test('unfinished, out-of-run and malformed completed counts cannot quote cancellation',()=>{
 for(const completed of [-1,0,1.5,4,NaN,Infinity,'1',undefined])assert.throws(()=>heldRunQuote(terms(),completed),/Invalid completed-night count/);
});
