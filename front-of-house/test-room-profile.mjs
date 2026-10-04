// Authored Amphitheater terrain, real line-of-sight, house rig and legacy career preservation.
import test from 'node:test';import assert from 'node:assert/strict';
import * as E from './engine.mjs';import * as D from './data.mjs';
import {roomProfileFor,roomProfileTerms,groundHeight,blocksView,roomSightlines} from './room-profile.mjs';
const profile=roomProfileFor({id:'amphitheater',profile:{version:1}});
const act=(s,a)=>{const r=E.applyAction(s,a);assert.equal(r.error,null,`${a.type}: ${r.error}`);if(r.state.cashJournal)assert.equal(E.careerLedgerFor(r.state).balance,r.state.cash);return r.state;};
function booking(marked=true,nights=1,deal='guarantee'){
 let s=act(E.createGame(8,{mode:'sandbox'}),{type:'enableEquipment'});s=act(s,{type:'chooseVenue',venueId:'amphitheater'});
 s=act(s,{type:'chooseDeal',artistId:E.offersFor(s)[0],deal,nights,seatingPolicy:1,...(nights>1?{runPolicy:1}:{}),...(marked?{roomPolicy:1}:{})});
 return act(s,{type:'setLayout',objects:D.AMP_STARTER});
}
const open=s=>act(act(s,{type:'confirmBuild'}),{type:'confirmPromotion'});
const finish=s=>act(s,{type:'respond',responseId:[...D.INCIDENTS[s.show.incidentId].responses].sort((a,b)=>b.score-a.score)[0].id});

test('room profile source is strict, versioned and ignores derived imported coverage',()=>{
 assert.deepEqual(roomProfileTerms({version:1,soundCapacity:1e9},'amphitheater'),{version:1});
 for(const raw of [null,[],{version:0},{version:2}])assert.throws(()=>roomProfileTerms(raw,'amphitheater'),TypeError);
 for(const id of ['lot','club','missing','toString','__proto__'])assert.throws(()=>roomProfileTerms({version:1},id),TypeError);
 assert.equal(roomProfileFor({id:'amphitheater'}),null);assert.equal(roomProfileFor({id:'toString',profile:{version:1}}),null);
 assert.ok(Object.isFrozen(profile));assert.ok(Object.isFrozen(profile.obstacleHeights));
});
test('lawn starts at row10 in fixed room coordinates and remains level across each row',()=>{
 assert.equal(groundHeight(profile,2,9),0);assert.equal(groundHeight(profile,27,10),0);
 assert.ok(Math.abs(groundHeight(profile,0,15)-0.9)<1e-12);assert.equal(groundHeight(profile,27,15),groundHeight(profile,0,15));
 assert.equal(groundHeight(profile,5,18),groundHeight(profile,5,16),'rear concourse is level');
 assert.equal(groundHeight(null,1,15),0);assert.throws(()=>groundHeight(profile,NaN,1),TypeError);
});
test('rising lawn sees over a low obstacle that blocks the same flat-room eye line',()=>{
 const flat={...profile,risePerTile:0},from={x:0.5,y:3,z:1.38},obstacle={x:0,y:9,w:1,h:1,height:1.15};
 const point=p=>({x:0.5,y:17.5,z:groundHeight(p,0.5,17.5)+p.eyeHeight});
 assert.equal(blocksView(flat,from,point(flat),obstacle),true);
 assert.equal(blocksView(profile,from,point(profile),obstacle),false);
 assert.equal(blocksView(profile,from,point(profile),{...obstacle,height:4}),true);
 assert.equal(blocksView(profile,from,point(profile),{...obstacle,x:2}),false);
 assert.equal(blocksView(profile,from,point(profile),{...obstacle,y:19}),false);
 assert.equal(blocksView(profile,from,point(profile),{...obstacle,height:0.55}),false);
 assert.throws(()=>blocksView(profile,from,point(profile),{...obstacle,w:0}),TypeError);
});
test('a tall block at the lawn break is found by exact footprint intersection',()=>{
 const from={x:0,y:3,z:1.38},to={x:10,y:17,z:2.09};
 const obstacle={x:4.99,y:9.99,w:0.02,h:0.02,height:3};
 assert.equal(blocksView(profile,from,to,obstacle),true);
 assert.equal(blocksView(profile,from,to,{...obstacle,x:4}),false);
});
test('all four stage directions change the viewing cone without moving the hill',()=>{
 for(let rot=0;rot<4;rot++){
  const venue={id:'amphitheater',profile:{version:1},objects:[{type:'stage',x:11,y:7,rot}]};
  const before=structuredClone(venue),r=E.sightlineTiles(venue),stats=E.evaluateVenue(venue);
  assert.ok(r.clear.size>0);assert.equal(r.clear.size,stats.clearTiles);assert.equal(r.blocked.size,stats.blockedTiles);
  const probes=['14,17','0,8','14,0','27,8'];assert.equal(r.clear.has(probes[rot]),true,`front at rotation${rot}`);
  assert.equal(r.clear.has(probes[(rot+2)%4]),false,`behind at rotation${rot}`);assert.deepEqual(venue,before);
  for(const key of r.clear){const[x,y]=key.split(',').map(Number);assert.ok(x>=0&&x<28&&y>=0&&y<18);assert.equal(r.blocked.has(key),false);}
 }
 assert.deepEqual(roomSightlines(profile,{grid:{w:2,h:2},occupied:new Set(),stage:null,obstacles:[]}),{clear:new Set(),blocked:new Set()});
 assert.throws(()=>roomSightlines(profile,{grid:{w:1000,h:1000},occupied:new Set(),stage:null,obstacles:[]}),TypeError);
});
test('marked house sound covers700, portable rigs replace it, and rent/capacity stay exact',()=>{
 const marked=booking(),legacy=booking(false),v=E.evaluateVenue(marked.venue),old=E.evaluateVenue(legacy.venue);
 assert.equal(v.soundCapacity,700);assert.equal(old.soundCapacity,undefined);assert.equal(v.capacity,old.capacity);
 assert.ok(v.clearTiles>old.clearTiles);assert.equal(E.upfrontFor(marked),E.upfrontFor(legacy));
 for(const[type,tier]of [['pa-s','S'],['pa-m','M']]){
  const s=act(marked,{type:'place',object:{type,x:10,y:0,rot:0}}),small=E.evaluateVenue(s.venue);
  assert.equal(small.soundCapacity,D.PA_COVERAGE[tier]);assert.equal(small.housePa,false);
  assert.equal(E.upfrontFor(s)-E.upfrontFor(marked),D.PA_RENTAL[tier]);
  const r=E.settlementFor(finish(open(s)));assert.ok(r.parts.sound<=D.PA_COVERAGE[tier]/r.attendance);
 }
 const owned=act(act(act(marked,{type:'back'}),{type:'equipment',command:{id:'shell_buy',kind:'buy',family:'small-pa'}}),{type:'chooseDeal',deal:'guarantee',artistId:marked.booking.artistId,seatingPolicy:1,roomPolicy:1});
 let s=act(owned,{type:'setLayout',objects:[...D.AMP_STARTER,{type:'pa-s',x:10,y:0,rot:0}]});s=act(s,{type:'assignEquipment',assetId:'pa_1'});
 const r=E.settlementFor(finish(open(s)));assert.equal(E.evaluateVenue(s.venue).soundCapacity,100);assert.equal(r.costs.pa,0);assert.equal(r.costs.equipmentOperation,20);
});
test('sound and slope improve marked show quality; legacy receipts remain exactly reproducible',()=>{
 const marked=booking(),legacy=booking(false),m=E.settlementFor(finish(open(marked))),l=E.settlementFor(finish(open(legacy)));
 assert.equal(m.parts.sound,1);assert.ok(m.parts.sightlines>l.parts.sightlines);assert.ok(m.satisfaction>l.satisfaction);
 assert.equal(m.attendance,l.attendance);assert.equal(m.ticketGross,l.ticketGross);assert.deepEqual(m.costs,l.costs);
 for(const s of [marked,legacy,open(marked),open(legacy),finish(open(marked)),finish(open(legacy))])assert.deepEqual(E.settlementFor(E.normalizeState(s)),E.settlementFor(s));
 assert.equal(E.normalizeState(legacy).venue.profile,undefined);
});
test('profile and each receipt survive a three-night hold; cash and final reputation move once',()=>{
 let s=open(booking(true,3)),cash=s.cash+E.upfrontFor(s),rep=s.reputation.venue,artist=s.booking.artistId,rel=s.reputation.artists[artist]||0,repSum=0,relSum=0,net=0;
 for(let night=1;night<=3;night++){
  assert.equal(s.show.night,night);assert.deepEqual(s.venue.profile,{version:1});s=finish(E.normalizeState(s));const r=E.settlementFor(s);
  repSum+=r.repDelta;relSum+=r.relDelta;net+=r.net;s=act(s,{type:'acceptSettlement'});assert.equal(s.cash,cash+net-(night<3?E.upfrontFor(s):0));
  if(night<3){assert.equal(s.reputation.venue,rep);assert.equal(s.reputation.artists[artist]||0,rel);}
 }
 assert.equal(s.phase,'done');assert.equal(s.history.length,3);assert.equal(s.reputation.venue,Math.max(0,Math.min(100,rep+repSum)));assert.equal(s.reputation.artists[artist],Math.max(-100,Math.min(100,rel+relSum)));
 assert.deepEqual(E.settlementFor(E.normalizeState(s)),E.settlementFor(s));assert.deepEqual(act(s,{type:'nextShow'}).venue.profile,{version:1});
});
test('bad optional profile recovery never rewrites paid cash/history and room changes clear it',()=>{
 const done=act(finish(open(booking())),{type:'acceptSettlement'});
 for(const profile of [{version:2},null,[],{version:'1'}]){const loaded=E.normalizeState({...done,venue:{...done.venue,profile}});assert.equal(loaded.cash,done.cash);assert.deepEqual(loaded.history,done.history);assert.equal(loaded.venue.profile,undefined);assert.match(loaded.roomNotice,/paid cash and history/);}
 const fresh=act(done,{type:'nextShow'}),lot=act(fresh,{type:'chooseVenue',venueId:'lot'});assert.equal(lot.venue.profile,undefined);
 const before=structuredClone(lot),r=E.applyAction(lot,{type:'chooseDeal',deal:'guarantee',roomPolicy:1});assert.match(r.error,/room profile/);assert.deepEqual(r.state,before);
});

function festival(marked=true,deal='guarantee'){
 let s=act(E.createGame(8,{mode:'sandbox'}),{type:'enableEquipment'});s=act(s,{type:'chooseVenue',venueId:'festival'});
 let artistId=E.offersFor(s)[0];
 if(deal==='door'){s.reputation.artists['salt-ledger']=20;while(!E.offersFor(s).includes('salt-ledger'))s.seed++;artistId='salt-ledger';}
 s=act(s,{type:'chooseDeal',artistId,secondId:'hollow-census',deal,stagePolicy:1,festivalPolicy:1,...(marked?{roomPolicy:1}:{})});
 return act(s,{type:'setLayout',objects:D.FEST_STARTER});
}
test('Festival profile is flat, immutable and has exact elevated sight rays',()=>{
 const p=roomProfileFor({id:'festival',profile:{version:1}});assert.ok(Object.isFrozen(p));assert.ok(Object.isFrozen(p.obstacleHeights));
 assert.deepEqual(roomProfileTerms({version:1,soundCapacity:6000,performerHeight:999},'festival'),{version:1});
 for(const y of [-20,0,10,23,100])assert.equal(groundHeight(p,20,y),0);
 const from={x:0.5,y:0,z:2.38},to={x:0.5,y:20,z:0.83},block={x:0,y:10,w:1,h:1,height:1.15};
 // The ray is1.5275 high at the far edge of this block.
 assert.equal(blocksView(p,from,to,block),false);assert.equal(blocksView(p,from,to,{...block,height:1.528}),true);
 for(let rot=0;rot<4;rot++){
  const venue={id:'festival',profile:{version:1},objects:[{type:'stage',x:17,y:10,rot}]},r=E.sightlineTiles(venue),v=E.evaluateVenue(venue);
  assert.ok(r.clear.size>0);assert.equal(v.clearTiles,r.clear.size);assert.equal(v.blockedTiles,r.blocked.size);
  const probes=['20,23','0,11','20,0','39,11'];assert.equal(r.clear.has(probes[rot]),true);assert.equal(r.clear.has(probes[(rot+2)%4]),false);
 }
});
test('Festival base sound covers3000 without extra cost or admission capacity; portable rigs replace it',()=>{
 const marked=festival(),legacy=festival(false),v=E.evaluateVenue(marked.venue),old=E.evaluateVenue(legacy.venue);
 assert.equal(v.soundCapacity,3000);assert.equal(v.capacity,6000);assert.equal(old.capacity,v.capacity);assert.equal(old.soundCapacity,undefined);
 assert.equal(E.upfrontFor(marked),E.upfrontFor(legacy));assert.ok(v.clearTiles>old.clearTiles);
 for(const[type,tier]of [['pa-s','S'],['pa-m','M']]){const portable=act(marked,{type:'place',object:{type,x:15,y:0,rot:0}});assert.equal(E.evaluateVenue(portable.venue).soundCapacity,D.PA_COVERAGE[tier]);assert.equal(E.upfrontFor(portable)-E.upfrontFor(marked),D.PA_RENTAL[tier]);}
 const full=E.settlementFor(finish(open(marked)));assert.equal(full.parts.sound,Math.min(1,3000/full.attendance));
 const dark=act(marked,{type:'setLayout',objects:D.FEST_STARTER.filter(o=>o.type!=='lights')}),unlit=E.settlementFor(finish(open(dark)));
 assert.equal(unlit.parts.sound,full.parts.sound*D.NO_LIGHTS_MULT);
});
test('Festival profiles conserve all three deal receipts, cash and replay while legacy stays unmarked',()=>{
 for(const deal of ['guarantee','sponsor','door']){
  const base=festival(false,deal),marked=festival(true,deal),legacy=E.settlementFor(finish(open(base))),result=E.settlementFor(finish(open(marked)));
  assert.equal(result.attendance,legacy.attendance);assert.equal(result.ticketGross,legacy.ticketGross);assert.deepEqual(result.costs,legacy.costs);assert.ok(result.satisfaction>=legacy.satisfaction);if(result.attendance>250)assert.ok(result.satisfaction>legacy.satisfaction);
  for(const booking of [base,marked]){
   const paid=open(booking),ended=finish(paid),r=E.settlementFor(ended),done=act(ended,{type:'acceptSettlement'});
   assert.equal(r.stageAccounts.main.attendance+r.stageAccounts.second.attendance,r.attendance);assert.equal(r.stageAccounts.net,r.net);assert.equal(done.cash,booking.cash+r.net);
   for(const state of [booking,paid,ended,done]){const copy=structuredClone(state),loaded=E.normalizeState(state);assert.deepEqual(state,copy);assert.deepEqual(E.settlementFor(loaded),E.settlementFor(state));assert.deepEqual(loaded.venue.profile,booking.venue.profile);}
   if(booking.venue.profile){const next=act(done,{type:'nextShow'});assert.deepEqual(next.venue.profile,{version:1});assert.equal(act(next,{type:'chooseVenue',venueId:'club'}).venue.profile,undefined);}
  }
 }
});
test('Festival invalid optional profiles preserve paid money and signed history',()=>{
 const done=act(finish(open(festival())),{type:'acceptSettlement'});
 for(const profile of [{version:2},{version:'1'},null,[]]){const loaded=E.normalizeState({...done,venue:{...done.venue,profile}});assert.equal(loaded.venue.profile,undefined);assert.equal(loaded.cash,done.cash);assert.deepEqual(loaded.history,done.history);assert.match(loaded.roomNotice,/paid cash and history/);}
 const loaded=E.normalizeState({...done,venue:{...done.venue,profile:{version:1,soundCapacity:1e9}}});assert.equal(E.evaluateVenue(loaded.venue).soundCapacity,3000);assert.deepEqual(E.settlementFor(loaded),E.settlementFor(done));
});

test('delay coverage uses exact radius, deterministic base allocation and a union without occupied cells',async()=>{
 const {delayCoverage}=await import('./room-profile.mjs');
 const input={grid:{w:5,h:3},occupied:new Set(['3,1']),front:[0.5,1.5],towers:[{x:3,y:1}],baseCapacity:1,density:1,capacity:20,range:1};
 const r=delayCoverage(input);assert.deepEqual([...r.base],['0,1']);assert.deepEqual([...r.added].sort(),['2,1','3,0','3,2','4,1']);assert.equal(r.soundCapacity,5);
 assert.deepEqual(delayCoverage({...input,towers:[...input.towers,...input.towers]}),r,'same coverage never stacks');
 assert.equal(delayCoverage({...input,capacity:3}).soundCapacity,3);assert.equal(delayCoverage({...input,capacity:0}).soundCapacity,1,'base supply does not shrink when permitted attendance is smaller');
 assert.equal(delayCoverage({...input,towers:[]}).soundCapacity,1);assert.equal(delayCoverage({...input,occupied:new Set(['0,1','1,0','1,1','1,2'])}).base.has('0,0'),true,'equal distances use row then column');
 for(const patch of [{range:0},{density:0},{towers:[{x:5,y:0}]},{towers:[{x:0,y:0},{x:1,y:0},{x:2,y:0}]},{front:[NaN,0]},{baseCapacity:-1}])assert.throws(()=>delayCoverage({...input,...patch}),TypeError);
});
const delays=[{type:'delay',x:8,y:16,rot:0},{type:'delay',x:30,y:16,rot:0}];
test('Festival towers obey geometry, power/count/room limits and only expand the house system',()=>{
 const base=festival(),put=objects=>act(base,{type:'setLayout',objects:[...D.FEST_STARTER,...objects]}),s=put(delays),v=E.evaluateVenue(s.venue),old=E.evaluateVenue(base.venue);
 assert.equal(v.delays,2);assert.equal(v.delayCost,1350);assert.equal(v.watts-old.watts,16000);assert.equal(v.openFloorTiles,old.openFloorTiles-2);assert.equal(v.capacity,old.capacity);assert.ok(v.soundCapacity>3000);assert.ok(v.soundCapacity<=v.capacity);assert.ok(v.delayTiles>0);assert.ok(v.blockedTiles>old.blockedTiles);
 for(let rot=0;rot<4;rot++)assert.equal(E.evaluateVenue(put(delays.map(o=>({...o,rot}))).venue).soundCapacity,v.soundCapacity);
 const portable=act(s,{type:'place',object:{type:'pa-s',x:15,y:0,rot:0}}),p=E.evaluateVenue(portable.venue);assert.equal(p.soundCapacity,100);assert.equal(p.delayTiles,0);assert.equal(p.delayActive,false);assert.equal(p.delayCost,1350);
 const unmarked={...s.venue};delete unmarked.profile;const u=E.evaluateVenue(unmarked);assert.equal(u.delayActive,false);assert.equal(u.delayCost,1350);assert.equal(u.soundCapacity,undefined);
 for(const id of ['lot','club','amphitheater'])assert.match(E.validateLayout(delays,{id}).problems[0].message,/only at the Festival/);
 assert.match(E.applyAction(s,{type:'place',object:{type:'delay',x:10,y:17,rot:0}}).error,/Only 2/);
 assert.match(E.applyAction(base,{type:'place',object:{type:'delay',x:40,y:0,rot:0}}).error,/does not fit/);
 assert.match(E.applyAction(s,{type:'place',object:delays[0]}).error,/overlaps/);
 const before=structuredClone(s);E.evaluateVenue(s.venue);assert.deepEqual(s,before);
});
test('delay production is charged once for all deals and survives paid reload with locked layouts',()=>{
 for(const deal of ['guarantee','sponsor','door']){
  const base=festival(true,deal),s=act(base,{type:'setLayout',objects:[...D.FEST_STARTER,...delays]});assert.equal(E.upfrontFor(s)-E.upfrontFor(base),1350);
  const paid=open(s);assert.match(E.applyAction(paid,{type:'setLayout',objects:D.FEST_STARTER}).error,/Build|build/);
  const ended=finish(paid),r=E.settlementFor(ended);assert.equal(r.costs.delays,1350);assert.equal(r.stageAccounts.main.production.delays,1350);assert.equal(r.stageAccounts.second.production.delays,undefined);
  assert.equal(r.costs.total,E.settlementFor(finish(open(base))).costs.total+1350);assert.equal(r.stageAccounts.costs,r.costs.total);assert.equal(Object.entries(r.costs).filter(([k])=>k!=='total').reduce((sum,[,n])=>sum+n,0),r.costs.total);
  const done=act(ended,{type:'acceptSettlement'});assert.equal(done.cash,s.cash+r.net);assert.equal(E.careerLedgerFor(done).balance,done.cash);
  for(const state of [s,paid,ended,done])assert.deepEqual(E.settlementFor(E.normalizeState(state)),E.settlementFor(state));
  let next=act(done,{type:'nextShow'});next=act(next,{type:'chooseVenue',venueId:'club'});next=E.normalizeState(next);next=act(next,{type:'chooseVenue',venueId:'festival'});assert.equal(next.venue.objects.filter(o=>o.type==='delay').length,2);assert.equal(next.venue.profile,undefined);
  next=act(next,{type:'chooseDeal',artistId:E.offersFor(next)[0],secondId:'hollow-census',deal:'guarantee',stagePolicy:1,festivalPolicy:1,roomPolicy:1});assert.equal(E.evaluateVenue(next.venue).delayActive,true);
 }
});
