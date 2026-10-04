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
 for(const id of ['lot','club','festival','missing'])assert.throws(()=>roomProfileTerms({version:1},id),TypeError);
 assert.equal(roomProfileFor({id:'amphitheater'}),null);assert.equal(roomProfileFor({id:'festival',profile:{version:1}}),null);
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
