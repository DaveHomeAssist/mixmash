// Suggestions (anticipate.mjs) read state and never commit money or choices.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from './anticipate.mjs';
import * as P from './prefs.mjs';
import * as E from './engine.mjs';
import * as D from './data.mjs';

const act = (s, a) => { const r = E.applyAction(s, a); assert.equal(r.error, null, `${a.type}: ${r.error}`); return r.state; };
function freeze(s) { Object.values(s).forEach(v => { if (v && typeof v === 'object') freeze(v); }); return Object.freeze(s); }
const dealAction = (id, deal) => ({ type: 'chooseDeal', artistId: id, deal });

function lotPhases(seed = 11) {
  const states = [];
  let s = E.createGame(seed); states.push(s);
  s = act(s, { type: 'chooseDeal', artistId: E.offersFor(s)[0], deal: 'guarantee' }); states.push(s);
  s = act(s, { type: 'setLayout', objects: D.STARTER_LAYOUT });
  s = act(s, { type: 'confirmBuild' }); states.push(s);
  s = act(s, { type: 'confirmPromotion' }); states.push(s);
  s = act(s, { type: 'respond', responseId: D.INCIDENTS[s.show.incidentId].responses[0].id }); states.push(s);
  s = act(s, { type: 'acceptSettlement', at: '2026-10-17T12:00:00.000Z' }); states.push(s);
  s = act(s, { type: 'nextShow' }); states.push(s);
  s = act(s, { type: 'chooseDeal', artistId: E.offersFor(s)[0], deal: 'guarantee' }); states.push(s);
  s = act(s, { type: 'confirmBuild' }); states.push(s);
  return states;
}

const busyPrefs = () => {
  let p = P.defaultPrefs();
  for (const id of Object.keys(D.ARTISTS)) p = P.rememberAct(p, id, { deal: 'door', price: 12, ads: { flyers: 100, social: 25, radio: 0 } });
  for (const id of Object.keys(D.INCIDENTS)) p = P.rememberIncident(p, id, D.INCIDENTS[id].responses.at(-1).id);
  return P.rememberRoom(p, 'lot', { lastTool: 'exit' });
};

test('every suggestion reads every phase without changing state, cash, phase or the booked deal', () => {
  const prefs = busyPrefs();
  for (const s of lotPhases()) {
    const before = JSON.stringify(s); freeze(s);
    const reads = [
      A.bookSuggestions(s, prefs, dealAction), A.buildSuggestion(s, prefs), A.promoteSuggestion(s, prefs),
      A.incidentSuggestion(s, prefs), A.nextShowPreview(s), A.legalTiles(s.venue, 'exit'), A.legalTiles(s.venue, 'pa-s'),
    ];
    assert.equal(JSON.stringify(s), before, `${s.phase} unchanged`);
    assert.deepEqual([A.bookSuggestions(s, prefs, dealAction), A.promoteSuggestion(s, prefs)], [reads[0], reads[2]], 'repeatable');
  }
});

test('Book marks the remembered deal and a short guarantee without disabling anything', () => {
  const s0 = E.createGame(3);
  const prefs = P.rememberAct(P.defaultPrefs(), E.offersFor(s0)[0], { deal: 'door' });
  const hints = A.bookSuggestions(s0, prefs, dealAction);
  assert.equal(hints.length, E.offersFor(s0).length);
  const first = hints[0];
  assert.equal(first.lastDeal, E.termsFor(first.artistId, 0).doorOk ? 'door' : null);
  // A guarantee larger than the cash is reported as short; the door deal fits.
  const poor = { ...s0, cash: 100 };
  const hint = A.bookSuggestions(poor, P.defaultPrefs(), dealAction).find((h) => h.short.door !== undefined);
  assert.ok(hint.short.guarantee > 0);
  assert.equal(hint.highlightDoor, hint.short.door === 0);
  assert.deepEqual(A.bookSuggestions(s0, P.setSuggest(prefs, false), dealAction).map((h) => h.lastDeal), hints.map(() => null));
});

test('Build names last night\u2019s weakest part only once a show is signed', () => {
  const states = lotPhases();
  const firstBuild = states.find((s) => s.phase === 'build');
  assert.equal(A.buildSuggestion(firstBuild, P.defaultPrefs()), null);
  const secondBuild = states.filter((s) => s.phase === 'build').at(-1);
  const hint = A.buildSuggestion(secondBuild, P.defaultPrefs());
  assert.equal(hint.weakest, secondBuild.history.at(-1).weakest);
  assert.deepEqual(hint.tools, A.WEAKEST_TOOLS[hint.weakest]);
  assert.equal(A.buildSuggestion(secondBuild, P.setSuggest(P.defaultPrefs(), false)), null);
});

test('Promote repeats the last mix only when it changes something and the doors stay affordable', () => {
  const promote = lotPhases().filter((s) => s.phase === 'promote').at(-1);
  const id = promote.booking.artistId;
  const prefs = P.rememberAct(P.defaultPrefs(), id, { price: 99, ads: { flyers: 50, social: 25, radio: 0 } });
  const hint = A.promoteSuggestion(promote, prefs);
  assert.equal(hint.price, D.PRICE_MAX, 'clamped to the room ceiling');
  assert.deepEqual(hint.ads, { flyers: 50, social: 25, radio: 0 });
  assert.equal(hint.adTotal, 75);
  const applied = act(promote, { type: 'setPromotion', price: hint.price, ads: hint.ads });
  assert.equal(applied.cash, promote.cash, 'applying costs nothing before doors');
  assert.equal(A.promoteSuggestion(applied, prefs), null, 'nothing to suggest once it matches');
  const broke = { ...promote, cash: E.upfrontFor(promote) };
  assert.equal(A.promoteSuggestion(broke, P.rememberAct(P.defaultPrefs(), id, { ads: { flyers: 1000, social: 1000, radio: 1000 } })), null, 'a mix that would leave the doors short is hidden');
});

test('the incident memory and the next-show preview use only the player\u2019s own record and public offers', () => {
  const states = lotPhases();
  const show = states.find((s) => s.phase === 'show');
  const response = D.INCIDENTS[show.show.incidentId].responses.at(-1).id;
  assert.equal(A.incidentSuggestion(show, P.rememberIncident(P.defaultPrefs(), show.show.incidentId, response)), response);
  assert.equal(A.incidentSuggestion(show, P.defaultPrefs()), null);
  const done = states.find((s) => s.phase === 'done');
  const preview = A.nextShowPreview(done);
  const next = act(done, { type: 'nextShow' });
  assert.deepEqual(preview.map((o) => o.artistId), E.offersFor(next));
  assert.deepEqual(preview.map((o) => o.ask), E.offersFor(next).map((id) => E.termsFor(id, next.reputation.artists[id] || 0).ask));
});

test('legal tiles match the engine\u2019s own placement check', () => {
  const build = lotPhases().find((s) => s.phase === 'build' && s.venue.objects.length === 0) || act(act(E.createGame(5), { type: 'chooseDeal', deal: 'door' }), { type: 'setLayout', objects: [] });
  const layout = act(build, { type: 'setLayout', objects: D.STARTER_LAYOUT });
  const { w, h } = layout.venue.grid;
  const tiles = A.legalTiles(layout.venue, 'exit');
  assert.ok(tiles.size > 0);
  for (const key of tiles) {
    const [x, y] = key.split(',').map(Number);
    assert.ok(x === 0 || y === 0 || x === w - 1 || y === h - 1, `${key} is on the edge`);
    assert.equal(E.applyAction(layout, { type: 'place', object: { type: 'exit', x, y, rot: 0 } }).error, null, key);
  }
  assert.notEqual(E.applyAction(layout, { type: 'place', object: { type: 'exit', x: 5, y: 5, rot: 0 } }).error, null);
  assert.equal(A.legalTiles(layout.venue, 'bar').size, 0, 'free-placement tools get no overlay');
  assert.ok(A.hasPlacementRule('gate') && A.hasPlacementRule('pa-m') && !A.hasPlacementRule('restroom'));
});
