/**
 * Browser smoke rail for Front of House (/front-of-house/).
 *
 * Plays the first playable through its real interface (book, build with the
 * suggested layout, promote, show night, settle), then checks reload, keyboard
 * placement, save codes, the next show, the out-of-money stop and Start over, signing during the post-incident wind-down, reduced
 * motion, a phone-width layout and small-text contrast. Game state is read through `window.render_game_to_text()` and the
 * `window.__frontOfHouse` hook, so the assertions don't depend on markup details.
 *
 *   npm run smoke:front-of-house
 *   FRONT_OF_HOUSE_SCREENSHOT_DIR=... keeps the screenshots somewhere specific.
 */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { launchOptions, startStaticServer, trackPageFailures } from './static-server.mjs';
import {
  applyAction, cheapestShowCost, createGame, nextSeed, nextShowCost, offersFor, rollShow, settlementFor, showPreview, termsFor,
} from '../front-of-house/engine.mjs';
import {
  AD_STEP, ARTISTS, DEFAULT_ARTIST, INCIDENTS, PERMIT_CAP, REL_DOOR_FLOOR, SAVE_NAMESPACE, SCHEMA_VERSION, START_CASH, STARTER_LAYOUT,
} from '../front-of-house/data.mjs';
import { readFile } from 'node:fs/promises';

const server = await startStaticServer();
const url = `${server.origin}/front-of-house/`;
const output = process.env.FRONT_OF_HOUSE_SCREENSHOT_DIR || await mkdtemp(join(tmpdir(), 'front-of-house-smoke-'));
await mkdir(output, { recursive: true });
const browser = await chromium.launch(launchOptions());
const checks = [];
const ok = (name) => { checks.push(name); console.log(`  ok  ${name}`); };

async function open(context) {
  const page = await context.newPage();
  const failures = trackPageFailures(page, server.origin);
  await page.goto(url);
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
  return { page, failures };
}
const game = async (page) => JSON.parse(await page.evaluate(() => window.render_game_to_text()));

try {
  // 1. The full loop through the interface.
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const { page, failures } = await open(context);
  assert.equal((await game(page)).phase, 'book');
  await page.click('[data-deal="guarantee"]');
  assert.equal((await game(page)).phase, 'build');
  assert.equal(await page.isDisabled('[data-act="confirm-build"]'), true, 'an empty lot cannot be confirmed');
  await page.click('[data-act="starter"]');
  const built = await game(page);
  assert.equal(built.venue.ready, true);
  assert.equal(built.venue.capacity, PERMIT_CAP, 'the suggested layout fills the Lot permit');
  await page.screenshot({ path: join(output, 'build.png') });
  await page.click('[data-act="confirm-build"]');
  assert.equal((await game(page)).phase, 'promote');
  await page.focus('#price');
  await page.keyboard.press('ArrowRight');
  assert.equal((await game(page)).promotion.price, 21, 'the price slider drives the engine');
  await page.focus('#ad-social');
  await page.keyboard.press('ArrowRight');
  assert.equal((await game(page)).promotion.ads.social, AD_STEP);
  await page.click('[data-act="confirm-promo"]');
  assert.equal((await game(page)).phase, 'show');
  await page.click('[data-act="skip"]');
  await page.waitForSelector('[data-act="respond"]');
  await page.screenshot({ path: join(output, 'show.png') });
  await page.click('[data-act="respond"]:not([disabled])');
  const settling = await game(page);
  assert.equal(settling.phase, 'settle');
  assert.ok(settling.settlement && Number.isInteger(settling.settlement.net));
  const sheet = await page.textContent('#panel');
  assert.ok(sheet.includes('SECTION A') && sheet.includes('SECTION B') && sheet.includes('SECTION C'), 'the settlement sheet has its three sections');
  await page.screenshot({ path: join(output, 'settle.png'), fullPage: true });
  await page.click('[data-act="accept"]');
  const done = await game(page);
  assert.equal(done.phase, 'done');
  assert.equal(done.history, 1);
  assert.equal(done.cash, START_CASH + done.settlement.net, 'cash after settlement is the starting cash plus the net');
  ok('plays Book through Settle and the cash adds up');

  await page.reload();
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
  const reloaded = await game(page);
  assert.equal(reloaded.phase, 'done');
  assert.equal(reloaded.cash, done.cash);
  ok('the game survives a reload');

  // 2. Save codes: export, import elsewhere, and refuse a bad code without touching the save.
  await page.click('#save-menu summary');
  await page.click('[data-save="export"]');
  const code = await page.inputValue('#save-code');
  assert.ok(code.length > 20, 'a save code is shown');
  const other = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const { page: page2, failures: failures2 } = await open(other);
  await page2.click('#save-menu summary');
  await page2.fill('#save-code', Buffer.from('{"evil":true}').toString('base64'));
  await page2.click('[data-save="import"]');
  assert.match(await page2.textContent('#save-status'), /isn't a Front of House save/);
  assert.equal((await game(page2)).phase, 'book', 'a bad code changes nothing');
  await page2.fill('#save-code', code);
  await page2.click('[data-save="import"]');
  const imported = await game(page2);
  assert.equal(imported.phase, 'done');
  assert.equal(imported.cash, done.cash);
  const v1 = JSON.parse(await readFile(new URL('../front-of-house/test/fixtures/save-v1.json', import.meta.url), 'utf8'));
  await page2.fill('#save-code', Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: 1, savedAt: '2026-10-01T00:00:00.000Z', state: v1 })).toString('base64'));
  await page2.click('[data-save="import"]');
  const migrated = await game(page2);
  assert.equal(migrated.phase, 'book', 'a finished version 1 show moves on to the next show');
  assert.equal(migrated.cash, Math.round(v1.cash / 2), 'version 1 cash converts to the Lot scale');
  ok('save codes move a game, version 1 codes convert, and bad codes are refused');

  // The career carries on: the done screen shows the Lot goal, and the next show offers two acts.
  assert.ok(await page.isVisible('.career'), 'the done screen shows the goal that unlocks the Club');
  await page.click('[data-act="next"]');
  const nextShow = await game(page);
  assert.equal(nextShow.phase, 'book');
  assert.equal(nextShow.offers.length, 2);
  assert.equal(await page.locator('.offer').count(), 2, 'one card per offer');
  assert.equal(nextShow.cash, done.cash, 'cash carries into the next show');
  assert.equal(nextShow.career.shows, 1);
  ok('the next show offers two acts and carries the cash');

  // 3. Keyboard placement on the board.
  await page2.click('[data-save="new"]');
  await page2.click('[data-save="new"]');
  assert.equal((await game(page2)).phase, 'book');
  await page2.click('[data-deal="door"]');
  await page2.focus('#board');
  await page2.keyboard.press('ArrowUp');
  for (let i = 0; i < 6; i += 1) await page2.keyboard.press('ArrowUp');
  await page2.keyboard.press('Enter');
  const placed = await page2.evaluate(() => window.__frontOfHouse.state().venue.objects);
  assert.equal(placed.length, 1);
  assert.equal(placed[0].type, 'stage');
  assert.match(await page2.textContent('#board-status'), /Tile \d+, \d+: Stage/);
  await page2.keyboard.press('Delete');
  assert.equal((await page2.evaluate(() => window.__frontOfHouse.state().venue.objects)).length, 0);
  ok('the board places and removes objects from the keyboard');

  // Signing inside the three-second wind-down after the incident still leaves
  // the board on the signed crowd. Seed 1 rains, so the crowd the board shows
  // before the incident differs from the one that is signed.
  const RAIN_SEED = 1;
  let rehearsal = createGame(RAIN_SEED);
  for (const action of [{ type: 'chooseDeal', deal: 'door' }, { type: 'setLayout', objects: STARTER_LAYOUT }, { type: 'confirmBuild' }, { type: 'confirmPromotion' }]) {
    rehearsal = applyAction(rehearsal, action).state;
  }
  const previewCrowd = showPreview(rehearsal).attendance;
  rehearsal = applyAction(rehearsal, { type: 'respond', responseId: INCIDENTS[rehearsal.show.incidentId].responses.find((r) => r.cost <= rehearsal.cash).id }).state;
  assert.notEqual(settlementFor(rehearsal).attendance, previewCrowd, 'the pinned seed changes the crowd, so this check can catch a stale board');
  await page2.fill('#save-code', Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION, savedAt: 0, state: createGame(RAIN_SEED) })).toString('base64'));
  await page2.click('[data-save="import"]');
  await page2.click('[data-deal="door"]');
  await page2.click('[data-act="starter"]');
  await page2.click('[data-act="confirm-build"]');
  await page2.click('[data-act="confirm-promo"]');
  await page2.click('[data-act="skip"]');
  await page2.click('[data-act="respond"]:not([disabled])');
  await page2.click('[data-act="accept"]');
  await page2.waitForTimeout(150);
  const signedEarly = await game(page2);
  assert.equal(signedEarly.phase, 'done');
  assert.equal(signedEarly.crowd, signedEarly.settlement.attendance, 'the board crowd matches the signed attendance');
  ok('signing during the wind-down settles the board on the signed crowd');

  // When the next show's acts both want a guarantee (Juniper Switchboard and an act soured past the
  // door rule), the Done screen stops a player who could only afford a door deal, and says how much
  // the next show needs; Start over stays open.
  let career = null;
  for (let seed = 1; seed < 500 && !career; seed += 1) {
    let s = { ...createGame(seed), cash: 20000 };
    for (const action of [
      { type: 'chooseDeal', deal: 'guarantee', artistId: DEFAULT_ARTIST }, { type: 'setLayout', objects: STARTER_LAYOUT },
      { type: 'confirmBuild' }, { type: 'setPromotion', price: ARTISTS[DEFAULT_ARTIST].fairPrice }, { type: 'confirmPromotion' },
    ]) s = applyAction(s, action).state;
    s = applyAction(s, { type: 'respond', responseId: INCIDENTS[s.show.incidentId].responses[0].id }).state;
    s = applyAction(s, { type: 'acceptSettlement' }).state;
    if (offersFor({ seed: nextSeed(s.seed), history: s.history }).includes('juniper-switchboard')) career = s;
  }
  const soured = offersFor({ seed: nextSeed(career.seed), history: career.history }).find((id) => id !== 'juniper-switchboard');
  career = { ...career, reputation: { ...career.reputation, artists: { ...career.reputation.artists, [soured]: REL_DOOR_FLOOR } } };
  const need = nextShowCost(career);
  assert.ok(need > cheapestShowCost(), 'neither act on offer takes the door deal');
  const asCode = (state) => Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION, savedAt: 0, state })).toString('base64');
  await page2.fill('#save-code', asCode({ ...career, cash: need - 1 }));
  await page2.click('[data-save="import"]');
  assert.equal((await game(page2)).phase, 'done');
  assert.equal(await page2.isDisabled('#panel .actions .primary'), true, 'Book the next show is disabled');
  assert.ok((await page2.textContent('#panel .lede')).includes(`$${need.toLocaleString('en-US')}`), 'the Done screen names what the next show needs');
  await page2.fill('#save-code', asCode({ ...career, cash: need }));
  await page2.click('[data-save="import"]');
  await page2.click('[data-act="next"]');
  const pick = offersFor(await page2.evaluate(() => window.__frontOfHouse.state()))
    .find((id) => cheapestShowCost('guarantee', termsFor(id, career.reputation.artists[id]).ask) === need);
  await page2.click(`[data-deal="guarantee"][data-artist="${pick}"]`);
  await page2.click('[data-act="confirm-build"]');
  assert.equal(await page2.isDisabled('[data-act="confirm-promo"]'), true, 'the carried layout costs more than the cheapest show');
  const advice = await page2.textContent('#msg');
  assert.match(advice, /Cut ads or rentals/);
  assert.doesNotMatch(advice, /door deal/, 'no door deal is suggested to an act that refuses one');
  await page2.click('[data-act="back"]');
  await page2.click('[data-act="back"]');
  await page2.fill('#save-code', asCode({ ...career, cash: need - 1 }));
  await page2.click('[data-save="import"]');
  await page2.click('[data-act="retry"]');
  const restarted = await game(page2);
  assert.equal(restarted.phase, 'book');
  assert.equal(restarted.cash, START_CASH);
  assert.equal(restarted.career.shows, 0, 'Start over begins a new career');
  ok('an unaffordable next show is stopped on the Done screen with the amount it needs, and Start over stays open');

  // Sprites: they switch on with one redraw, follow rotation, keep the PA tiers apart,
  // let a PA behind the stage show through, anchor markers and beams to the art, and
  // a click on a tall prop's body finds that prop.
  const spritesCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const { page: page5, failures: failures5 } = await open(spritesCtx);
  await page5.waitForFunction(() => window.__frontOfHouse.board().spritesReady);
  const boardInfo = () => page5.evaluate(() => window.__frontOfHouse.board());
  assert.ok((await boardInfo()).spriteRedraws <= 1, 'one redraw when the sprites switch on');
  await page5.click('[data-deal="door"]');
  await page5.click('[data-act="starter"]');
  const drawnOf = (info, type) => info.drawn.find((d) => d.type === type);
  const layoutWith = (swap) => STARTER_LAYOUT.map((o) => swap[o.type] ? { ...o, ...swap[o.type] } : o);
  const setLayout = (objects) => page5.evaluate((o) => window.__frontOfHouse.act({ type: 'setLayout', objects: o }), objects);
  const snapshot = () => page5.evaluate(() => {
    const c = document.querySelector('#board');
    window.__snap = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  });
  const changedPixels = () => page5.evaluate(() => {
    const c = document.querySelector('#board');
    const now = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < now.length; i += 4) if (Math.abs(now[i] - window.__snap[i]) + Math.abs(now[i + 1] - window.__snap[i + 1]) + Math.abs(now[i + 2] - window.__snap[i + 2]) > 30) n += 1;
    return n;
  });
  const withM = await boardInfo();
  await snapshot();
  await setLayout(layoutWith({ 'pa-m': { type: 'pa-s' } }));
  const withS = await boardInfo();
  assert.ok(await changedPixels() > 400, 'swapping the PA behind the stage visibly changes the board');
  assert.ok(drawnOf(withM, 'pa-m').rect.h > drawnOf(withS, 'pa-s').rect.h * 1.2, 'the medium PA draws taller than the small one');
  for (const [rot, expected] of [[0, false], [3, true]]) {
    await setLayout([{ type: 'stage', x: 9, y: 5, rot }]);
    assert.equal(drawnOf(await boardInfo(), 'stage')?.rect.mirrored, expected, `stage rot ${rot} draws ${expected ? 'mirrored' : 'as drawn'}`);
  }
  for (const rot of [1, 2]) {
    await setLayout([{ type: 'stage', x: 9, y: 5, rot }]);
    assert.equal(drawnOf(await boardInfo(), 'stage'), undefined, `stage rot ${rot} faces away, so it keeps the code-drawn box`);
  }
  // The view turn: a stage at rot 0 sits a quarter turn the other way on screen after one
  // turn (mirrored), faces away after two (box), and is back as painted after four.
  await setLayout([{ type: 'stage', x: 9, y: 5, rot: 0 }]);
  const turns = [];
  const faceKey = (faces) => faces.map((n) => n.join(',')).sort().join(' ');
  for (let i = 0; i < 4; i += 1) {
    await page5.click('#turn-view');
    const info = await boardInfo();
    turns.push([info.facing, drawnOf(info, 'stage')?.rect.mirrored ?? 'box']);
    const asBox = info.hitStack.find((h) => h.type === 'stage' && h.faces);
    if (asBox) {
      // A box paints the two side faces that face the viewer in this view, not always +x and +y.
      const expected = { 2: [[0, -1], [-1, 0]], 3: [[1, 0], [0, -1]] }[info.facing];
      assert.equal(faceKey(asBox.faces), faceKey(expected), `view ${info.facing}: the stage box paints its viewer-facing sides`);
    }
  }
  assert.deepEqual(turns, [[1, true], [2, 'box'], [3, 'box'], [0, false]], 'the stage follows the view turn');
  await setLayout(STARTER_LAYOUT);
  const canvasBox = await page5.locator('#board').boundingBox();
  const objectsNow = () => page5.evaluate(() => window.__frontOfHouse.state().venue.objects);
  // The PA shows through the stage, so a click on the visible PA removes the PA.
  const paRect = drawnOf(await boardInfo(), 'pa-m').rect;
  await page5.mouse.click(canvasBox.x + paRect.x + paRect.w / 2, canvasBox.y + paRect.y + paRect.h / 2, { button: 'right' });
  assert.deepEqual((await objectsNow()).map((o) => o.type).sort(), STARTER_LAYOUT.map((o) => o.type).filter((t) => t !== 'pa-m').sort(), 'right-clicking the PA that shows through the stage removes the PA');
  // Shift+click on the light tower's lamp, above the ground grid, removes the tower.
  await setLayout(STARTER_LAYOUT);
  const towerRect = drawnOf(await boardInfo(), 'lights').rect;
  await page5.keyboard.down('Shift');
  await page5.mouse.click(canvasBox.x + towerRect.x + towerRect.w / 2, canvasBox.y + towerRect.y + towerRect.h * 0.06);
  await page5.keyboard.up('Shift');
  assert.equal((await objectsNow()).some((o) => o.type === 'lights'), false, 'Shift+clicking the lamp head removes the light tower');
  // After three view turns the stage faces away and is drawn as a box, painted over the
  // PA's sprite; a right-click where they overlap removes the stage, not the PA behind it.
  await setLayout(STARTER_LAYOUT);
  for (let i = 0; i < 3; i += 1) await page5.click('#turn-view');
  const stack = (await boardInfo()).hitStack;
  const stageAt = stack.findIndex((h) => h.type === 'stage');
  const paAt = stack.findIndex((h) => h.type === 'pa-m');
  assert.ok(stack[stageAt].poly && stageAt > paAt, 'the stage is a box painted after the PA in this view');
  const inPoly = (x, y, poly) => poly.reduce((inside, [xi, yi], i) => {
    const [xj, yj] = poly[(i + poly.length - 1) % poly.length];
    return (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi ? !inside : inside;
  }, false);
  const pr = stack[paAt].rect;
  // The overlap point nearest the PA sprite's centre, where the sprite is opaque.
  let overlap = null;
  let best = Infinity;
  for (let fy = 0.02; fy < 1; fy += 0.02) {
    for (let fx = 0.02; fx < 1; fx += 0.02) {
      const pt = [pr.x + pr.w * fx, pr.y + pr.h * fy];
      const dist = Math.hypot(fx - 0.5, fy - 0.5);
      if (dist < best && inPoly(pt[0], pt[1], stack[stageAt].poly)) { overlap = pt; best = dist; }
    }
  }
  assert.ok(overlap, 'the stage box overlaps the middle of the PA sprite');
  await page5.mouse.click(canvasBox.x + overlap[0], canvasBox.y + overlap[1], { button: 'right' });
  const types = (await objectsNow()).map((o) => o.type);
  assert.ok(!types.includes('stage') && types.includes('pa-m'), 'right-clicking the stage box over the PA removes the stage');
  await page5.click('#turn-view');
  assert.equal((await boardInfo()).facing, 0);
  await setLayout(STARTER_LAYOUT);
  const stageRect = drawnOf(await boardInfo(), 'stage').rect;
  const roof = { x: canvasBox.x + stageRect.x + stageRect.w / 2, y: canvasBox.y + stageRect.y + stageRect.h * 0.22 };
  await page5.mouse.click(roof.x, roof.y, { button: 'right' });
  const afterRemove = await page5.evaluate(() => window.__frontOfHouse.state().venue.objects);
  assert.equal(afterRemove.some((o) => o.type === 'stage'), false, 'right-clicking the stage roof removes the stage');
  assert.equal(afterRemove.length, STARTER_LAYOUT.length - 1, 'and nothing else');

  // A ground point in front of the PA but behind the stage, where both sprites cover it on
  // screen, is drawn between them: after the PA, before the stage.
  await setLayout([{ type: 'stage', x: 0, y: 1, rot: 0 }, { type: 'pa-m', x: 0, y: 0, rot: 0 }]);
  const between = await page5.evaluate(() => window.__frontOfHouse.boardPlace(1.2, 0.5));
  assert.ok(between.after.includes('pa-m') && between.before.includes('stage'), `a dot in front of the PA and behind the stage is drawn between them (${JSON.stringify(between)})`);

  let paSeed = 1;
  while (rollShow(paSeed, DEFAULT_ARTIST).incidentId !== 'pa-dropout') paSeed += 1;
  if (!(await page5.isVisible('#save-code'))) await page5.click('#save-menu summary');
  await page5.fill('#save-code', Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION, savedAt: 0, state: createGame(paSeed) })).toString('base64'));
  await page5.click('[data-save="import"]');
  await page5.click('[data-deal="door"]');
  await page5.click('[data-act="starter"]');
  await page5.click('[data-act="confirm-build"]');
  await page5.click('[data-act="confirm-promo"]');
  await page5.waitForSelector('[data-act="respond"]', { timeout: 2000 });
  const night = await boardInfo();
  const paMarker = night.markers.find((m) => m.type === 'pa-m');
  assert.ok(paMarker && paMarker.top > 2.5 && Math.abs(paMarker.z - paMarker.top - 0.5) < 1e-9, 'the PA-dropout marker sits above the drawn PA');
  assert.ok(night.washSource > 4, `the wash beam starts at the light tower's lamp head (z ${night.washSource})`);
  // Crowd right in front of the stage is drawn after it, even though those dots lie behind
  // props elsewhere on the lot (the restrooms, the gate, the far exit).
  const frontRow = night.crowd.filter((p) => Math.floor(p.x) === 11 && Math.floor(p.y) === 3);
  assert.ok(frontRow.length > 0 && frontRow.every((p) => p.front), 'the crowd in front of the stage is drawn in front of it');
  ok('sprites switch on once, follow rotation and PA tiers, anchor markers and beams, clicks find tall props, and ground points sit between overlapping props');

  // 4. Reduced motion goes straight to the incident.
  const calm = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const { page: page3, failures: failures3 } = await open(calm);
  await page3.click('[data-deal="door"]');
  await page3.click('[data-act="starter"]');
  await page3.click('[data-act="confirm-build"]');
  await page3.click('[data-act="confirm-promo"]');
  await page3.waitForSelector('[data-act="respond"]', { timeout: 2000 });
  ok('reduced motion skips the playback to the incident');

  // 5. Phone width and small-text contrast.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const { page: page4, failures: failures4 } = await open(phone);
  const overflow = await page4.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `no horizontal scroll at 390px (overflow ${overflow}px)`);
  await page4.screenshot({ path: join(output, 'phone.png'), fullPage: true });
  ok('fits a 390px phone without horizontal scrolling');

  const lowContrast = await page.evaluate(() => {
    const rgb = (v) => (v.match(/[\d.]+/g) || []).map(Number);
    const lum = (c) => c.slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const bad = [];
    for (const node of document.querySelectorAll('.lede, .eyebrow, .meta-label, .board-help, .tagline, .stats dt, .meters dt, .credit, figcaption')) {
      if (!node.getClientRects().length) continue;
      let p = node; let bg;
      while (p) { const c = rgb(getComputedStyle(p).backgroundColor); if (c.length === 3 || c[3] === 1) { bg = c; break; } p = p.parentElement; }
      const [hi, lo] = [lum(rgb(getComputedStyle(node).color)), lum(bg || [14, 17, 23])].sort((a, b) => b - a);
      const ratio = (hi + 0.05) / (lo + 0.05);
      if (ratio < 4.5) bad.push(`${node.className}: ${ratio.toFixed(2)}`);
    }
    return bad;
  });
  assert.deepEqual(lowContrast, [], 'small text meets 4.5:1');
  ok('small text meets the 4.5:1 contrast ratio');

  assert.deepEqual([...failures, ...failures2, ...failures3, ...failures4, ...failures5], [], 'no page errors, console errors or failed requests');
  ok('loads clean: no page errors, console errors or failed requests');

  await Promise.all([context, other, calm, phone, spritesCtx].map((c) => c.close()));
} finally {
  await browser.close();
  await server.close();
}

console.log(`\nfront-of-house smoke: ${checks.length} checks passed. Screenshots: ${output}`);
