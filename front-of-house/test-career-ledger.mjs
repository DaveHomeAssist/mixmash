// Cash journal conservation, bounded history, retry identity and hostile checkpoint tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareerLedger, appendCareerLedger, saveCareerLedger, loadCareerLedger, CAREER_LEDGER_ROWS } from './career-ledger.mjs';
const event=(sequence,category,cashDelta,reference='show_3_1')=>({sequence,category,cashDelta,reference});
const append=(s,category,delta,reference)=>{const r=appendCareerLedger(s,event(s.nextSequence,category,delta,reference));assert.equal(r.error,null);return r.state;};

test('opening cash plus separated capital, development and show movements reconciles exactly',()=>{
 let s=createCareerLedger(5000),expected=5000;
 const movements=[['acquisition',-1200],['development',-180],['showOpening',-1890],['incident',-100],['settlement',2450],['developmentRefund',90],['disposal',600]];
 for(const [category,delta] of movements){s=append(s,category,delta);expected+=delta;assert.equal(s.balance,expected);assert.equal(loadCareerLedger(saveCareerLedger(s)).balance,expected);}
 assert.equal(s.balance,4770);assert.equal(s.openingCash,5000);assert.equal(s.totals.acquisition,-1200);assert.equal(s.totals.showOpening,-1890);assert.equal(s.archived.through,0);
 assert.equal(append(s,'showOpening',300).balance,5070,'sponsor can credit cash when opening');
});

test('identical retained retries pay nothing and changed or out-of-order sequences are refused',()=>{
 const initial=createCareerLedger(5000), first=appendCareerLedger(initial,event(1,'acquisition',-1200,'pa_1'));
 assert.equal(first.cashDelta,-1200);assert.deepEqual(initial,createCareerLedger(5000));
 const retry=appendCareerLedger(first.state,event(1,'acquisition',-1200,'pa_1'));assert.equal(retry.cashDelta,0);assert.deepEqual(retry.state,first.state);
 for(const wrong of [event(1,'acquisition',-1000,'pa_1'),event(1,'disposal',600,'pa_1'),event(3,'disposal',600,'pa_1')]){
  const r=appendCareerLedger(first.state,wrong);assert.ok(r.error);assert.equal(r.cashDelta,0);assert.deepEqual(r.state,first.state);
 }
});

test('multiple compactions keep exact category totals, recent rows and uninterrupted recording',()=>{
 let s=createCareerLedger(1234),expected=1234;
 for(let i=0;i<CAREER_LEDGER_ROWS*4+7;i++){
  const delta=i%2?31:-20;s=append(s,i%2?'settlement':'showOpening',delta,`show_${i}_1`);expected+=delta;
  assert.equal(s.balance,expected);assert.ok(s.entries.length<=CAREER_LEDGER_ROWS);
  if(i%40===0)s=loadCareerLedger(saveCareerLedger(s));
 }
 assert.equal(s.entries.length,CAREER_LEDGER_ROWS);assert.equal(s.archived.through,CAREER_LEDGER_ROWS*3+7);
 assert.equal(s.entries[0].sequence,s.archived.through+1);assert.equal(s.nextSequence,CAREER_LEDGER_ROWS*4+8);
 assert.equal(s.balance,s.openingCash+Object.values(s.totals).reduce((a,b)=>a+b,0));
 const retry=appendCareerLedger(s,event(1,'showOpening',-20,'show_0_1'));
 assert.match(retry.error,/archived/);assert.equal(retry.cashDelta,0);assert.deepEqual(retry.state,s);
});

test('checkpoint source derives balance and sequence and exported copies cannot mutate it',()=>{
 const s=append(createCareerLedger(5000),'development',-120,'patch'),raw=saveCareerLedger(s);
 raw.balance=999999;raw.nextSequence=100;raw.totals={development:99999};raw.entries[0].label='injected';
 assert.deepEqual(loadCareerLedger(raw),s);
 raw.entries[0].cashDelta=-999;raw.archived.totals.development=-888;
 assert.equal(s.balance,4880);assert.equal(s.entries[0].cashDelta,-120);assert.equal(s.archived.totals.development,0);
});

test('invalid signs, missing fields, discontinuities, unsupported versions and oversized logs fail',()=>{
 const valid=saveCareerLedger(append(createCareerLedger(5000),'acquisition',-1200,'pa_1'));
 const variants=[null,{}, {...valid,version:2},{...valid,openingCash:1.5},{...valid,archived:{through:-1,totals:valid.archived.totals}},
 {...valid,archived:{through:1,totals:valid.archived.totals}}, {...valid,archived:{through:0,totals:{...valid.archived.totals,settlement:1}}},
 {...valid,archived:{through:0,totals:{}}}, {...valid,entries:[event(2,'incident',-100)]}, {...valid,entries:[event(1,'acquisition',100)]},
 {...valid,entries:[event(1,'disposal',-100)]}, {...valid,entries:[event(1,'unknown',1)]}, {...valid,entries:[event(1,'incident',-1,'bad reference')]},
 {...valid,entries:[event(1,'incident',-1),event(1,'incident',-1)]}, {...valid,entries:Array.from({length:CAREER_LEDGER_ROWS+1},(_,i)=>event(i+1,'settlement',1))}];
 for(const raw of variants)assert.throws(()=>loadCareerLedger(raw));
 for(const raw of [event(1,'incident',NaN),event(1,'settlement',Infinity),event(1.5,'incident',0),event(0,'incident',0)]){
  const state=createCareerLedger(5000),r=appendCareerLedger(state,raw);assert.ok(r.error);assert.equal(r.cashDelta,0);assert.deepEqual(r.state,state);
 }
});

test('unsafe totals cannot silently round a cash movement',()=>{
 const state=createCareerLedger(Number.MAX_SAFE_INTEGER);
 const r=appendCareerLedger(state,event(1,'settlement',1));assert.match(r.error,/cash total/);assert.equal(r.cashDelta,0);assert.deepEqual(r.state,state);
 assert.throws(()=>createCareerLedger(Number.MAX_SAFE_INTEGER+1),/opening cash/);
});
