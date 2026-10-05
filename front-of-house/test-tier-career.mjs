// Full ordinary-career actions, replay and continued Festival play; no funded/unlocked fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import {runTierCareer} from './sim/tiers.mjs';

test('an earned career carries through every hold length and plays after completion',()=>{
 const first=runTierCareer(1);
 assert.equal(first.tiers.lot.reached,true);
 assert.equal(first.tiers.club.reached,true);assert.ok(first.tiers.club.nights>=5);
 assert.equal(first.tiers.amphitheater.reached,true);assert.ok(first.tiers.amphitheater.holds>=3);
 assert.ok(first.cancellations>=2);assert.equal(first.continued,true);
 assert.deepEqual(runTierCareer(1),first,'seeded career replay');
});
test('careless later-tier choices use the same genuinely earned Lot starting career',()=>{
 const careful=runTierCareer(1),careless=runTierCareer(1,false);
 assert.deepEqual(careless.tiers.lot,careful.tiers.lot);
 assert.equal(careless.tiers.club.reached,false);
 assert.ok(careless.tiers.club.nights>=5);
});
