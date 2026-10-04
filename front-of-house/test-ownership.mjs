// Inventory authority preserves identity and capital cash through commands and reloads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnership, applyOwnership, saveOwnership, loadOwnership, OWNERSHIP_COMMAND_LIMIT } from './ownership.mjs';
const buy = (id='buy_1') => ({id,kind:'buy',family:'small-pa'});
const apply = (s,c,cash=5000) => {const r=applyOwnership(s,c,{cash});assert.equal(r.error,null);return r;};

test('buying creates one stable asset and returns only the new capital debit',()=>{
 const initial=createOwnership(), r=apply(initial,buy());
 assert.equal(r.cashDelta,-1200);assert.deepEqual(initial,createOwnership());
 assert.deepEqual(r.state.assets,[{id:'pa_1',family:'small-pa',purchase:1200}]);
 assert.equal(r.state.ledger[0].category,'acquisition');assert.equal(r.state.acquired,1200);
 assert.match(applyOwnership(r.state,buy('buy_2'),{cash:5000}).error,/already available/);
 for(const cash of [1199,-1,NaN,Infinity,1200.5])assert.match(applyOwnership(initial,buy(),{cash}).error,/cash/);
 assert.equal(apply(initial,buy(),1200).cashDelta,-1200);
});

test('identical transaction IDs are no-ops and mismatched retries cannot charge',()=>{
 const first=apply(createOwnership(),buy()), again=apply(first.state,buy(),0);
 assert.equal(again.cashDelta,0);assert.deepEqual(again.state,first.state);
 const reused=applyOwnership(first.state,{id:'buy_1',kind:'sell',assetId:'pa_1'});
 assert.match(reused.error,/different action/);assert.equal(reused.cashDelta,0);assert.deepEqual(reused.state,first.state);
});

test('sale removes one asset once and a rebuy cannot mint money or reuse identity',()=>{
 let r=apply(createOwnership(),buy()), cash=5000+r.cashDelta;
 r=apply(r.state,{id:'sell_1',kind:'sell',assetId:'pa_1'});cash+=r.cashDelta;
 assert.equal(r.cashDelta,600);assert.equal(r.state.assets.length,0);
 assert.equal(apply(r.state,{id:'sell_1',kind:'sell',assetId:'pa_1'}).cashDelta,0);
 assert.match(applyOwnership(r.state,{id:'sell_again',kind:'sell',assetId:'pa_1'}).error,/not owned/);
 r=apply(r.state,buy('buy_2'),cash);cash+=r.cashDelta;
 assert.equal(r.state.assets[0].id,'pa_2');assert.equal(cash,3200);
 assert.equal(r.state.acquired,2400);assert.equal(r.state.disposed,600);assert.equal(r.state.cashDelta,-1800);
 assert.equal(r.state.ledger.reduce((sum,e)=>sum+e.cashDelta,0),r.state.cashDelta);
});

test('checkpoints derive prices, identities and ledger without replay payments',()=>{
 const state=apply(createOwnership(),buy()).state, checkpoint=saveOwnership(state);
 checkpoint.commands[0].price=1;checkpoint.commands[0].cashDelta=9999;
 checkpoint.assets=[{id:'free'}];checkpoint.cashDelta=99999;checkpoint.ledger=[{cashDelta:99999}];
 const restored=loadOwnership(checkpoint);assert.deepEqual(restored,state);
 assert.equal(apply(restored,buy(),0).cashDelta,0);
 const exported=saveOwnership(restored);exported.commands[0].id='changed';assert.equal(restored.commands[0].id,'buy_1');
});

test('invalid families, identities, duplicate records and impossible sequences are refused',()=>{
 for(const raw of [null,{}, {version:2,commands:[]}, {version:1,commands:[buy(),buy()]},
  {version:1,commands:[{id:'x',kind:'buy',family:'house-pa'}]}, {version:1,commands:[{id:'x',kind:'sell',assetId:'pa_1'}]},
  {version:1,commands:[buy(),{id:'s',kind:'sell',assetId:'pa_2'}]}, {version:1,commands:[{...buy(),id:'bad id'}]},
  {version:1,commands:[buy(),buy('b2')]}])assert.throws(()=>loadOwnership(raw));
 const s=createOwnership();for(const c of [null,{}, {id:'x',kind:'deploy',assetId:'pa_1'}, {...buy(),family:'__proto__'}]){
  const r=applyOwnership(s,c,{cash:5000});assert.ok(r.error);assert.equal(r.cashDelta,0);assert.deepEqual(r.state,s);
 }
});

test('capital history bound preserves deduplication and explicit no-spend refusal',()=>{
 const commands=Array.from({length:OWNERSHIP_COMMAND_LIMIT},(_,i)=>i%2?{id:`s${i}`,kind:'sell',assetId:`pa_${(i+1)/2}`} : buy(`b${i}`));
 const state=loadOwnership({version:1,commands});assert.equal(state.assets.length,0);
 const refused=applyOwnership(state,buy('new'),{cash:5000});assert.match(refused.error,/history is full/);assert.equal(refused.cashDelta,0);assert.deepEqual(refused.state,state);
 assert.equal(apply(state,commands[0],0).cashDelta,0);
 assert.throws(()=>loadOwnership({version:1,commands:[...commands,buy('new')]}),/checkpoint/);
});
