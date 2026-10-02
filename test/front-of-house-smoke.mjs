/**
 * Browser smoke rail for Front of House (/front-of-house/).
 *
 * Plays the first playable through its real interface (book, build with the
 * suggested layout, promote, show night, settle), then checks reload, keyboard
 * placement, save codes, the next show, the out-of-money stop and Start over, signing during the post-incident wind-down, reduced
 * motion, a phone-width layout, the Career, Sandbox and Wet lot buttons, the room and nights choice, the board camera, the
 * no-scroll layout and the menu, the Build and Show corner HUD, the sheets and windows, the phone tabs, and small-text contrast. Game state is read through `window.render_game_to_text()` and the
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
  AD_STEP, ARTISTS, DEFAULT_ARTIST, GRID, INCIDENTS, PERMIT_CAP, REL_DOOR_FLOOR, SANDBOX_CASH, SAVE_NAMESPACE, SCENARIO_CASH, SCHEMA_VERSION, START_CASH,
  STARTER_LAYOUT,
} from '../front-of-house/data.mjs';
import { readFile } from 'node:fs/promises';

const server = await startStaticServer();
const url = process.env.FRONT_OF_HOUSE_BASE_URL || `${server.origin}/front-of-house/`;
const appOrigin = new URL(url).origin;
const output = process.env.FRONT_OF_HOUSE_SCREENSHOT_DIR || await mkdtemp(join(tmpdir(), 'front-of-house-smoke-'));
await mkdir(output, { recursive: true });
const browser = await chromium.launch(launchOptions());
const checks = [];
const ok = (name) => { checks.push(name); console.log(`  ok  ${name}`); };

async function open(context) {
  const page = await context.newPage();
  const failures = trackPageFailures(page, appOrigin);
  await page.goto(url);
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
  return { page, failures };
}
const game = async (page) => JSON.parse(await page.evaluate(() => window.render_game_to_text()));
// Save and load live in the menu. Loading a good code closes it; a bad code leaves it open.
async function openSaves(page) {
  if (await page.isHidden('#menu')) await page.click('#menu-btn');
  if (!(await page.isVisible('#save-code'))) await page.click('#save-menu summary');
}
async function loadCode(page, code) {
  await openSaves(page);
  await page.fill('#save-code', code);
  await page.click('[data-save="import"]');
}

// The page never scrolls (docs/HUD.md step 2). At every desktop size the canvas fills the
// window, the document has nothing to scroll, the panel fits on screen (it scrolls inside
// itself), and the whole lot is fit clear of the top strip and the panel.
const DESKTOP = [[1024, 700], [1024, 768], [1280, 800], [1440, 900], [1920, 1080]];
async function resizeTo(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.waitForFunction(([w, h]) => {
    const { view } = window.__frontOfHouse.board();
    return view.cssW === w && view.cssH === h;
  }, [width, height]);
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}
const measureLayout = (page) => page.evaluate(([W, H]) => {
  const d = document.documentElement;
  const { view } = window.__frontOfHouse.board();
  const corners = [[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => window.__frontOfHouse.boardClientOf(x, y));
  const panel = document.querySelector('#panel').getBoundingClientRect();
  return {
    scroll: [d.scrollWidth - innerWidth, d.scrollHeight - innerHeight, scrollX, scrollY],
    canvas: [view.cssW, view.cssH],
    clear: view.safe,
    lotClear: corners.every((c) => c.clear),
    panelOnScreen: panel.top >= 0 && panel.bottom <= innerHeight + 0.5 && panel.right <= innerWidth + 0.5,
    scrolling: [
      ...[...document.querySelectorAll('#panel .plate')].filter((p) => !p.hidden && p.getClientRects().length && p.scrollHeight > p.clientHeight + 1)
        .map((p) => `${p.className}: ${p.scrollHeight} in ${p.clientHeight}`),
      ...(() => {
        const win = document.querySelector('#win');
        const body = document.querySelector('#win-body');
        return !win.hidden && !win.classList.contains('scrolls') && body.scrollHeight > body.clientHeight + 1 ? [`window ${win.dataset.kind}: ${body.scrollHeight} in ${body.clientHeight}`] : [];
      })(),
    ],
  };
}, [GRID.w, GRID.h]);
// The corner HUD in Build and Show (docs/HUD.md steps 3 and 11): at the fit the lot covers at
// least 30% of the window (35% at 1280x800 and 1440x900), the plates cover no more than 2% of
// the lot, no plate scrolls or leaves the window, and the top strip fits.
const measureHud = (page) => page.evaluate(([W, H]) => {
  const poly = [[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => window.__frontOfHouse.boardClientOf(x, y)).map((p) => [p.x, p.y]);
  const inPoly = (x, y) => poly.reduce((inside, [xi, yi], i) => {
    const [xj, yj] = poly[(i + poly.length - 1) % poly.length];
    return (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi ? !inside : inside;
  }, false);
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const lot = ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))) / 2;
  let covered = 0;
  const plates = [...document.querySelectorAll('#panel .plate')].filter((p) => !p.hidden && p.getClientRects().length);
  const bad = [];
  for (const p of plates) {
    const r = p.getBoundingClientRect();
    for (let y = r.top + 1; y < r.bottom; y += 2) for (let x = r.left + 1; x < r.right; x += 2) if (inPoly(x, y)) covered += 4;
    if (p.scrollHeight > p.clientHeight + 1) bad.push(`${p.className} scrolls`);
    if (r.left < 0 || r.right > innerWidth || r.bottom > innerHeight) bad.push(`${p.className} leaves the window`);
  }
  const strip = document.querySelector('.topbar');
  const stripRight = Math.max(...[...strip.children].map((c) => c.getBoundingClientRect().right));
  if (stripRight > innerWidth) bad.push(`the strip overflows by ${Math.round(stripRight - innerWidth)}px`);
  return { share: (lot / (innerWidth * innerHeight)) * 100, cover: (covered / lot) * 100, plates: plates.length, bad };
}, [GRID.w, GRID.h]);

async function checkNoScroll(page, phase) {
  const back = page.viewportSize();
  for (const [width, height] of DESKTOP) {
    await resizeTo(page, width, height);
    const m = await measureLayout(page);
    const at = `${phase} at ${width}x${height}`;
    assert.deepEqual(m.scroll, [0, 0, 0, 0], `${at}: the page doesn't scroll`);
    assert.deepEqual(m.canvas, [width, height], `${at}: the board fills the window`);
    assert.ok(m.lotClear, `${at}: the lot is fit clear of the strip and the panel (${JSON.stringify(m.clear)})`);
    assert.ok(m.panelOnScreen, `${at}: the panel fits on screen`);
    assert.deepEqual(m.scrolling, [], `${at}: no panel or window scrolls`);
    if (phase === 'build' || phase === 'show') {
      const hud = await measureHud(page);
      const target = (width === 1280 && height === 800) || (width === 1440 && height === 900) ? 35 : 30;
      assert.ok(hud.plates >= 3, `${at}: the HUD has its corner plates`);
      assert.ok(hud.share >= target, `${at}: the lot covers ${hud.share.toFixed(1)}% of the window (at least ${target}%)`);
      assert.ok(hud.cover <= 2, `${at}: the HUD covers ${hud.cover.toFixed(2)}% of the lot (at most 2%)`);
      assert.deepEqual(hud.bad, [], `${at}: no plate scrolls or leaves the window, and the strip fits`);
    }
  }
  await resizeTo(page, back.width, back.height);
}

try {
  // 1. The full loop through the interface.
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const { page, failures } = await open(context);
  assert.equal((await game(page)).phase, 'book');
  await checkNoScroll(page, 'book');
  await page.click('[data-deal="guarantee"]');
  assert.equal((await game(page)).phase, 'build');
  assert.equal(await page.isDisabled('[data-act="confirm-build"]'), true, 'an empty lot cannot be confirmed');
  await page.click('[data-act="starter"]');
  const built = await game(page);
  assert.equal(built.venue.ready, true);
  assert.equal(built.venue.capacity, PERMIT_CAP, 'the suggested layout fills the Lot permit');
  await checkNoScroll(page, 'build');
  await page.screenshot({ path: join(output, 'build.png') });
  await page.click('[data-act="confirm-build"]');
  assert.equal((await game(page)).phase, 'promote');
  await checkNoScroll(page, 'promote');
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
  await checkNoScroll(page, 'show');
  await page.screenshot({ path: join(output, 'show.png') });
  await page.click('[data-act="respond"]:not([disabled])');
  const settling = await game(page);
  assert.equal(settling.phase, 'settle');
  assert.ok(settling.settlement && Number.isInteger(settling.settlement.net));
  assert.equal(await page.isVisible('#win'), true, 'the settlement opens in its own window');
  const sheet = await page.textContent('#win');
  assert.ok(sheet.includes('SECTION A') && sheet.includes('SECTION B') && sheet.includes('SECTION C'), 'the settlement sheet has its three sections');
  await checkNoScroll(page, 'settle');
  await page.screenshot({ path: join(output, 'settle.png') });
  await page.click('[data-act="accept"]');
  const done = await game(page);
  assert.equal(done.phase, 'done');
  assert.equal(done.history, 1);
  assert.equal(done.cash, START_CASH + done.settlement.net, 'cash after settlement is the starting cash plus the net');
  await checkNoScroll(page, 'done');
  ok('plays Book through Settle and the cash adds up');
  ok('the page never scrolls: in every phase at 1024x700 to 1920x1080 the board fills the window, the lot is fit clear of the strip and the panel, and no panel or window scrolls');
  ok('in Build and Show the lot covers at least 30% of the window (35% at 1280x800 and 1440x900), the corner HUD covers at most 2% of it, and no plate scrolls');

  await page.reload();
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
  const reloaded = await game(page);
  assert.equal(reloaded.phase, 'done');
  assert.equal(reloaded.cash, done.cash);
  ok('the game survives a reload');

  // 2. Save codes: export, import elsewhere, and refuse a bad code without touching the save.
  await openSaves(page);
  await page.click('[data-save="export"]');
  const code = await page.inputValue('#save-code');
  assert.ok(code.length > 20, 'a save code is shown');
  assert.equal(await page.getAttribute('#menu-btn', 'aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.isHidden('#menu'), true, 'Escape closes the menu');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'menu-btn', 'focus goes back to the menu button');
  await page.focus('#board');
  await page.keyboard.press('?');
  assert.equal(await page.isVisible('#menu'), true, '? opens the menu');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'fullscreen', 'focus moves into the menu');
  assert.ok((await page.textContent('#board-help')).includes('mouse wheel'), 'the keys help is in the menu');
  await page.mouse.click(300, 400);
  assert.equal(await page.isHidden('#menu'), true, 'a click outside closes the menu');
  ok('the menu opens from its button and ?, holds the keys and the saves, and closes with Escape or a click outside');
  const other = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const { page: page2, failures: failures2 } = await open(other);
  await loadCode(page2, Buffer.from('{"evil":true}').toString('base64'));
  assert.match(await page2.textContent('#save-status'), /isn't a Front of House save/);
  assert.equal((await game(page2)).phase, 'book', 'a bad code changes nothing');
  await loadCode(page2, code);
  const imported = await game(page2);
  assert.equal(imported.phase, 'done');
  assert.equal(imported.cash, done.cash);
  const v1 = JSON.parse(await readFile(new URL('../front-of-house/test/fixtures/save-v1.json', import.meta.url), 'utf8'));
  await loadCode(page2, Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: 1, savedAt: '2026-10-01T00:00:00.000Z', state: v1 })).toString('base64'));
  const migrated = await game(page2);
  assert.equal(migrated.phase, 'book', 'a finished version 1 show moves on to the next show');
  assert.equal(migrated.cash, Math.round(v1.cash / 2), 'version 1 cash converts to the Lot scale');
  ok('save codes move a game, version 1 codes convert, and bad codes are refused');

  // The career carries on: the done screen shows the Lot goal, and the next show offers two acts.
  assert.ok(await page.isVisible('.career'), 'the done screen shows the goal that unlocks the Club');
  await page.click('[data-act="last-sheet"]');
  assert.ok((await page.textContent('#win')).includes('SECTION B'), 'Last settlement reopens the signed sheet');
  assert.equal(await page.locator('#win [data-act="accept"]').count(), 0, 'a signed sheet has nothing to sign');
  await page.keyboard.press('Escape');
  await page.click('[data-act="history"]');
  assert.equal(await page.locator('#win .history li').count(), 1, 'the history window lists the show');
  await page.keyboard.press('Escape');
  ok('the Done sheet opens the last settlement and the show history in their own windows');
  await page.click('[data-act="next"]');
  const nextShow = await game(page);
  assert.equal(nextShow.phase, 'book');
  assert.equal(nextShow.offers.length, 2);
  assert.equal(await page.locator('.offer').count(), 2, 'one card per offer');
  assert.equal(nextShow.cash, done.cash, 'cash carries into the next show');
  assert.equal(nextShow.career.shows, 1);
  assert.equal(await page.locator('#panel .choice-text').count() <= 2, true, 'after the first show the deal explanations are gone, apart from a refusal note');
  await page.click('[data-act="deal-help"]');
  assert.ok((await page.textContent('#win')).includes('Offer a door deal'), 'the Deals window explains the deals');
  await page.keyboard.press('Escape');
  ok('the next show offers two acts and carries the cash, and the deals are explained one click away');

  // 3. Keyboard placement on the board.
  await openSaves(page2);
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

  // Keys 1 to 8 pick a tool; the Details window lists every placed object and removes one by name.
  const checkedTool = () => page2.evaluate(() => document.querySelector('input[name="tool"]:checked').value);
  await page2.keyboard.press('3');
  assert.equal(await checkedTool(), 'pa-m', '3 picks the medium PA');
  await page2.keyboard.press('8');
  assert.equal(await checkedTool(), 'exit', '8 picks the exit');
  await page2.keyboard.press('1');
  assert.equal(await checkedTool(), 'stage');
  await page2.click('[data-act="starter"]');
  await page2.click('[data-act="lot-details"]');
  assert.equal(await page2.isVisible('#win'), true, 'Details opens a window');
  const chips = await page2.locator('#win [data-act="remove"]').count();
  assert.equal(chips, STARTER_LAYOUT.length, 'one remove button per placed object');
  await page2.locator('#win [data-act="remove"]').first().click();
  assert.equal((await page2.evaluate(() => window.__frontOfHouse.state().venue.objects)).length, STARTER_LAYOUT.length - 1, 'a remove button in the window removes that object');
  assert.equal(await page2.locator('#win [data-act="remove"]').count(), STARTER_LAYOUT.length - 1, 'the window updates');
  assert.ok(await page2.evaluate(() => document.querySelector('#win').contains(document.activeElement)), 'focus stays in the window');
  await page2.keyboard.press('Escape');
  assert.equal(await page2.isHidden('#win'), true, 'Escape closes the window');
  assert.equal(await page2.evaluate(() => document.activeElement.id), 'details-btn', 'focus returns to Details');
  ok('keys 1 to 8 pick a tool, and the Details window removes a placed object by name');

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
  await loadCode(page2, Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION, savedAt: 0, state: createGame(RAIN_SEED) })).toString('base64'));
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
  await loadCode(page2, asCode({ ...career, cash: need - 1 }));
  assert.equal((await game(page2)).phase, 'done');
  assert.equal(await page2.isDisabled('#panel .actions .primary'), true, 'Book the next show is disabled');
  assert.ok((await page2.textContent('#panel .lede')).includes(`$${need.toLocaleString('en-US')}`), 'the Done screen names what the next show needs');
  await loadCode(page2, asCode({ ...career, cash: need }));
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
  await loadCode(page2, asCode({ ...career, cash: need - 1 }));
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
  // The overlap point nearest the PA sprite's centre, where the sprite is opaque. It sits at
  // least 2 px inside the stage box, since mouse events land on whole pixels.
  const wellInside = ([x, y]) => [[0, 0], [-2, -2], [2, -2], [-2, 2], [2, 2]].every(([dx, dy]) => inPoly(x + dx, y + dy, stack[stageAt].poly));
  let overlap = null;
  let best = Infinity;
  for (let fy = 0.02; fy < 1; fy += 0.02) {
    for (let fx = 0.02; fx < 1; fx += 0.02) {
      const pt = [pr.x + pr.w * fx, pr.y + pr.h * fy];
      const dist = Math.hypot(fx - 0.5, fy - 0.5);
      if (dist < best && wellInside(pt)) { overlap = pt; best = dist; }
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

  // The camera (HUD step 1): zoom by keys and buttons, every on-screen tile maps back to
  // itself at every zoom and view turn, panning is clamped to the lot, a turn keeps the
  // zoom, and a zoomed click still finds the prop under it.
  await setLayout(STARTER_LAYOUT);
  const cam = async () => (await boardInfo()).camera;
  await page5.focus('#board');
  await page5.keyboard.press('=');
  assert.equal((await cam()).zoom, 1.5, '= zooms in');
  await page5.keyboard.press('0');
  assert.equal((await cam()).zoom, 1, '0 shows the whole lot');
  assert.ok(await page5.isDisabled('#zoom-out') && await page5.isDisabled('#zoom-fit'), 'zoom out and fit are off at the whole lot');
  await page5.click('#zoom-in');
  await page5.click('#zoom-in');
  assert.equal((await cam()).zoom, 2, 'the zoom-in button steps 1.5 then 2');
  await page5.click('#zoom-out');
  assert.equal((await cam()).zoom, 1.5, 'the zoom-out button steps back');
  await page5.click('#zoom-fit');
  assert.equal((await cam()).zoom, 1, 'the fit button shows the whole lot');
  for (let turn = 0; turn < 4; turn += 1) {
    for (const zoom of [1, 1.5, 2, 3]) {
      await page5.evaluate((z) => window.__frontOfHouse.boardZoom(z), zoom);
      const trip = await page5.evaluate(() => {
        const h = window.__frontOfHouse;
        let ok = 0; let wrong = 0;
        for (let y = 0; y < 16; y += 1) {
          for (let x = 0; x < 24; x += 1) {
            const c = h.boardClientOf(x + 0.5, y + 0.5);
            if (!c.inside) continue;
            const t = h.boardTileAt(c.x, c.y);
            if (t && t.x === x && t.y === y) ok += 1; else wrong += 1;
          }
        }
        return { ok, wrong };
      });
      assert.ok(trip.ok > 0 && trip.wrong === 0, `view ${turn}, zoom ${zoom}: every on-screen tile maps back to itself (${JSON.stringify(trip)})`);
    }
    await page5.click('#turn-view');
  }
  await page5.evaluate(() => window.__frontOfHouse.boardZoom(2));
  const centred = await cam();
  await page5.focus('#board');
  await page5.keyboard.press('Shift+ArrowRight');
  const nudged = await cam();
  assert.ok(nudged.x !== centred.x || nudged.y !== centred.y, 'Shift and an arrow key move a zoomed view');
  const boardBox = await page5.locator('#board').boundingBox();
  await page5.mouse.move(boardBox.x + boardBox.width / 2, boardBox.y + boardBox.height / 2);
  await page5.mouse.down({ button: 'middle' });
  await page5.mouse.move(boardBox.x + boardBox.width / 2 - 90, boardBox.y + boardBox.height / 2 - 40, { steps: 5 });
  await page5.mouse.up({ button: 'middle' });
  const dragged = await cam();
  assert.ok(dragged.x !== nudged.x || dragged.y !== nudged.y, 'a middle-button drag moves a zoomed view');
  for (let i = 0; i < 40; i += 1) await page5.keyboard.press('Shift+ArrowLeft');
  const pinned = await cam();
  assert.ok(pinned.x >= 0 && pinned.x <= 24 && pinned.y >= 0 && pinned.y <= 16, `the view stops at the lot (${JSON.stringify(pinned)})`);
  await page5.click('#turn-view');
  const turned = await cam();
  assert.deepEqual([turned.zoom, turned.x, turned.y], [pinned.zoom, pinned.x, pinned.y], 'a view turn keeps the zoom and the centre');
  for (let i = 0; i < 3; i += 1) await page5.click('#turn-view');
  await page5.evaluate(() => { window.__frontOfHouse.boardZoom(1); window.__frontOfHouse.boardZoom(3); });
  const beforeFollow = await cam();
  await page5.focus('#board');
  for (let i = 0; i < 14; i += 1) await page5.keyboard.press('ArrowRight');
  const afterFollow = await cam();
  assert.ok(afterFollow.x !== beforeFollow.x || afterFollow.y !== beforeFollow.y, 'the camera follows the build cursor');
  await page5.evaluate(() => window.__frontOfHouse.boardZoom(1));
  const under = { x: boardBox.x + boardBox.width * 0.35, y: boardBox.y + boardBox.height * 0.55 };
  const tileBefore = await page5.evaluate(([x, y]) => window.__frontOfHouse.boardTileAt(x, y), [under.x, under.y]);
  await page5.mouse.move(under.x, under.y);
  await page5.keyboard.down('Control');
  await page5.mouse.wheel(0, -120);
  await page5.keyboard.up('Control');
  assert.equal((await cam()).zoom, 1.5, 'Ctrl and the wheel zoom in');
  assert.deepEqual(await page5.evaluate(([x, y]) => window.__frontOfHouse.boardTileAt(x, y), [under.x, under.y]), tileBefore, 'the tile under the pointer stays put');
  await page5.mouse.wheel(0, -120);
  assert.equal((await cam()).zoom, 2, 'the plain wheel zooms too, since the page never scrolls');
  assert.deepEqual(await page5.evaluate(([x, y]) => window.__frontOfHouse.boardTileAt(x, y), [under.x, under.y]), tileBefore, 'the tile under the pointer still stays put');
  assert.equal(await page5.evaluate(() => scrollY), 0, 'the wheel never scrolls the page');
  // Zoom about the stage, as a player would, so it stays clear of the corner plates.
  const fitStage = drawnOf(await boardInfo(), 'stage').rect;
  await page5.evaluate(([x, y]) => window.__frontOfHouse.boardZoom(2, x, y), [fitStage.x + fitStage.w / 2, fitStage.y + fitStage.h * 0.6]);
  const zoomedStage = drawnOf(await boardInfo(), 'stage').rect;
  const stagePoint = [boardBox.x + zoomedStage.x + zoomedStage.w / 2, boardBox.y + zoomedStage.y + zoomedStage.h * 0.6];
  assert.equal(await page5.evaluate(([x, y]) => document.elementFromPoint(x, y).id, stagePoint), 'board', 'the zoomed stage is on the open board');
  await page5.mouse.click(stagePoint[0], stagePoint[1], { button: 'right' });
  const leftAfterZoomedClick = await objectsNow();
  assert.ok(!leftAfterZoomedClick.some((o) => o.type === 'stage') && leftAfterZoomedClick.length === STARTER_LAYOUT.length - 1, 'a right-click on the zoomed stage removes only the stage');
  await page5.evaluate(() => window.__frontOfHouse.boardZoom(1));
  ok('the camera zooms, pans, follows the cursor, turns, and keeps tiles and clicks exact at every zoom');

  let paSeed = 1;
  while (rollShow(paSeed, DEFAULT_ARTIST).incidentId !== 'pa-dropout') paSeed += 1;
  await loadCode(page5, Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION, savedAt: 0, state: createGame(paSeed) })).toString('base64'));
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
  const onPhone = await measureLayout(page4);
  assert.deepEqual(onPhone.scroll, [0, 0, 0, 0], 'the page does not scroll on a phone either');
  // Book is a document, so on a phone its sheet takes the height under the strip (HUD.md
  // section 8); the board keeps 45% of the height in Build and Show, checked below.
  const sheetBox = await page4.evaluate(() => {
    const p = document.querySelector('#panel');
    const r = p.getBoundingClientRect();
    return { left: r.left, bottom: r.bottom, scrolls: p.scrollHeight > p.clientHeight };
  });
  assert.ok(sheetBox.left === 0 && Math.abs(sheetBox.bottom - 844) < 1 && !sheetBox.scrolls, `the phase panel is a bottom sheet that doesn't scroll (${JSON.stringify(sheetBox)})`);
  await page4.screenshot({ path: join(output, 'phone.png') });
  ok('fits a 390px phone with no page scroll, the board on top and the panel in a bottom sheet');

  // Phone tabs (docs/HUD.md decision 12): a whole show at 390x844, where every tab of the
  // sheet and of the settlement window fits without scrolling, and Build and Show keep the
  // board at 45% of the height or more.
  const phoneFlow = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const { page: page7, failures: failures7 } = await open(phoneFlow);
  const tabsFit = async (phase, { board = false } = {}) => {
    for (const root of ['#panel', '#win-body']) {
      if (root === '#win-body' && await page7.isHidden('#win')) continue;
      const names = await page7.locator(`${root} .tabbar [role="tab"]`).allTextContents();
      for (const name of names.length ? names : [null]) {
        if (name) await page7.locator(`${root} .tabbar [role="tab"]`, { hasText: name }).first().click();
        const fit = await page7.evaluate((r) => { const e = document.querySelector(r); return [e.scrollHeight, e.clientHeight]; }, root);
        assert.ok(fit[0] <= fit[1] + 1, `${phase}${name ? `, tab ${name}` : ''}: ${root} fits on the phone (${fit[0]} in ${fit[1]})`);
      }
      if (names.length) await page7.locator(`${root} .tabbar [role="tab"]`).first().click();
    }
    if (board) {
      const share = await page7.evaluate(() => window.__frontOfHouse.board().view.safe.h / innerHeight);
      assert.ok(share >= 0.45, `${phase}: the board takes ${(share * 100).toFixed(0)}% of the phone's height`);
    }
  };
  await tabsFit('Book');
  assert.equal(await page7.locator('#panel .tabbar [role="tab"]').count(), 2, 'one tab per act on the phone');
  await page7.locator('[data-deal="guarantee"]:visible').first().click();
  await page7.locator('#panel .tabbar [role="tab"]', { hasText: 'Actions' }).click();
  await page7.click('[data-act="starter"]');
  await tabsFit('Build', { board: true });
  await page7.locator('#panel .tabbar [role="tab"]', { hasText: 'Actions' }).click();
  await page7.click('[data-act="confirm-build"]');
  await tabsFit('Promote');
  await page7.click('[data-act="confirm-promo"]');
  await page7.waitForSelector('[data-act="respond"]');
  assert.equal(await page7.getAttribute('#panel .tabbar [aria-selected="true"]', 'data-tab-name'), 'Problem', 'the incident brings its tab forward');
  await tabsFit('Show', { board: true });
  await page7.locator('#panel .tabbar [role="tab"]', { hasText: 'Problem' }).click();
  await page7.locator('[data-act="respond"]:visible:not([disabled])').first().click();
  await tabsFit('Settle');
  await page7.click('[data-act="accept"]');
  await tabsFit('Done');
  await page7.setViewportSize({ width: 1280, height: 900 });
  await page7.waitForFunction(() => !document.querySelector('.tabbar'));
  assert.equal(await page7.isVisible('.career'), true, 'a wider window drops the tabs and shows every group');
  ok('on a phone every tab of the sheet and the settlement fits without scrolling, the incident brings its tab forward, and Build and Show keep the board at 45% or more');

  // The mode buttons start a new game, redraw the page at once and save it.
  const shownCash = async () => Number((await page4.textContent('#meter-cash')).replace(/[^\d]/g, ''));
  const newGame = async (mode) => {
    if (await page4.isHidden('#menu')) await page4.click('#menu-btn');
    await page4.click(`[data-act="mode"][data-mode="${mode}"]`);
  };
  for (const [mode, cash] of [['sandbox', SANDBOX_CASH], ['scenario', SCENARIO_CASH], ['career', START_CASH]]) {
    await newGame(mode);
    assert.equal(await shownCash(), cash, `${mode} redraws the cash meter at once`);
    await page4.reload();
    await page4.waitForFunction(() => typeof window.render_game_to_text === 'function');
    assert.equal((await game(page4)).cash, cash, `${mode} is saved across a reload`);
  }
  // A game with progress asks before a mode button erases it.
  await page4.click('[data-deal="guarantee"]');
  await newGame('sandbox');
  assert.equal((await game(page4)).phase, 'build', 'the first press on a game in progress changes nothing');
  assert.match(await page4.textContent('[data-act="mode"][data-mode="sandbox"]'), /Press again/);
  await page4.click('[data-act="mode"][data-mode="sandbox"]');
  assert.equal((await game(page4)).cash, SANDBOX_CASH, 'the second press starts the new game');
  ok('the Career, Sandbox and Wet lot buttons in the menu redraw the page and save the new game, and ask first when a game is under way');

  // Choosing a room redraws the Book panel with that room's acts and nights, so a deal books.
  const dealArtists = () => page4.locator('[data-act="deal"]').evaluateAll((els) => [...new Set(els.map((e) => e.dataset.artist))]);
  for (const venue of ['club', 'amphitheater', 'lot']) {
    await page4.click(`[data-act="venue"][data-venue="${venue}"]`);
    assert.deepEqual(await dealArtists(), (await game(page4)).offers, `${venue} lists its own acts`);
    assert.equal(await page4.getAttribute(`[data-act="venue"][data-venue="${venue}"]`, 'class'), 'primary', `${venue} shows as chosen`);
  }
  await page4.click('[data-act="venue"][data-venue="amphitheater"]');
  await page4.click('[data-act="nights"][data-nights="2"]');
  assert.equal(await page4.getAttribute('[data-act="nights"][data-nights="2"]', 'class'), 'primary', 'two nights shows as chosen');
  assert.equal(await page4.evaluate(() => document.activeElement && document.activeElement.dataset.nights), '2', 'focus stays on the nights button');
  await page4.click('[data-act="deal"]:not([disabled])');
  assert.equal((await game(page4)).phase, 'build', 'a deal in the chosen room books');
  ok('choosing a room or the nights redraws the Book panel, and a deal there books');

  const small = await browser.newContext({ viewport: { width: 1024, height: 700 }, reducedMotion: 'reduce' });
  const { page: page6, failures: failures6 } = await open(small);
  await page6.click('#menu-btn');
  await page6.click('[data-act="mode"][data-mode="sandbox"]');
  const sheetFits = async (what) => assert.deepEqual((await measureLayout(page6)).scrolling, [], `${what} fits at 1024x700 without scrolling`);
  for (const venue of ['lot', 'club', 'amphitheater', 'festival']) {
    await page6.click(`[data-act="venue"][data-venue="${venue}"]`);
    await sheetFits(`Book at ${venue}`);
    if (venue === 'amphitheater' || venue === 'festival') {
      await page6.click('[data-act="deal"][data-deal="guarantee"]');
      await page6.click('[data-act="starter"]');
      await page6.click('[data-act="confirm-build"]');
      await sheetFits(`Promote at ${venue}`);
      await page6.click('[data-act="back"]');
      await page6.click('[data-act="back"]');
    }
  }
  ok('every room\'s Book sheet, and Promote with seats or a sponsor, fit at 1024x700 without scrolling');

  const lowContrast = await page.evaluate(() => {
    const rgb = (v) => (v.match(/[\d.]+/g) || []).map(Number);
    const lum = (c) => c.slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const bad = [];
    for (const node of document.querySelectorAll('.lede, .eyebrow, .meta-label, .board-help, .tagline, .stats dt, .meters dt, .credit, figcaption, .readouts dt, .readouts small, .hint, .tile-key, .choice-effect, .choice-text, .result-line')) {
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

  // Opt-in Lot doors pilot: one extra decision, saved before and after selection, and no HUD scroll.
  const pilotDesktop = await browser.newContext({ viewport: { width: 1024, height: 700 }, reducedMotion: 'reduce' });
  const pilotPage = await pilotDesktop.newPage();
  const pilotFailures = trackPageFailures(pilotPage, appOrigin);
  await pilotPage.goto(`${url}?night-slice=1`);
  await pilotPage.waitForFunction(() => typeof window.render_game_to_text === 'function');
  await pilotPage.click('[data-deal="guarantee"]');
  await pilotPage.click('[data-act="starter"]');
  await pilotPage.click('[data-act="confirm-build"]');
  await pilotPage.click('[data-act="confirm-promo"]');
  await pilotPage.waitForSelector('[data-act="choose-crew"]');
  assert.equal((await game(pilotPage)).show.pilotCrew, null);
  await checkNoScroll(pilotPage, 'show');
  await pilotPage.reload();
  await pilotPage.waitForSelector('[data-act="choose-crew"]');
  assert.equal((await game(pilotPage)).show.pilotCrew, null, 'reload preserves the unanswered doors choice');
  await pilotPage.click('[data-act="choose-crew"][data-choice="bar"]');
  assert.equal((await game(pilotPage)).show.pilotCrew, 'bar');
  await pilotPage.waitForSelector('[data-act="respond"]');
  await checkNoScroll(pilotPage, 'show');
  await pilotPage.click('[data-act="respond"]:not([disabled])');
  assert.ok((await game(pilotPage)).settlement.doorRush, 'the settlement includes the rush outcome');
  assert.match(await pilotPage.textContent('#win'), /queued · \d+ left · bar cap/);
  await checkNoScroll(pilotPage, 'settle');
  ok('the opt-in Lot doors choice survives reload, changes the settlement, and fits the desktop HUD');

  const pilotPhone = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const pilotMobile = await pilotPhone.newPage();
  const pilotPhoneFailures = trackPageFailures(pilotMobile, appOrigin);
  await pilotMobile.goto(`${url}?night-slice=1`);
  await pilotMobile.waitForFunction(() => typeof window.render_game_to_text === 'function');
  await pilotMobile.locator('[data-deal="guarantee"]:visible').first().click();
  await pilotMobile.locator('#panel .tabbar [role="tab"]', { hasText: 'Actions' }).click();
  await pilotMobile.click('[data-act="starter"]');
  await pilotMobile.click('[data-act="confirm-build"]');
  await pilotMobile.click('[data-act="confirm-promo"]');
  await pilotMobile.waitForSelector('[data-act="choose-crew"]');
  assert.equal(await pilotMobile.getAttribute('#panel .tabbar [aria-selected="true"]', 'data-tab-name'), 'Problem');
  const pilotTabFit = await pilotMobile.evaluate(() => {
    const p = document.querySelector('#panel');
    return { scroll: p.scrollHeight - p.clientHeight, board: window.__frontOfHouse.board().view.safe.h / innerHeight };
  });
  assert.ok(pilotTabFit.scroll <= 1 && pilotTabFit.board >= 0.45, 'phone doors choice fits without scrolling or shrinking the board');
  await pilotMobile.click('[data-act="choose-crew"][data-choice="gate"]');
  await pilotMobile.waitForSelector('[data-act="respond"]');
  assert.equal((await game(pilotMobile)).show.pilotCrew, 'gate');
  await pilotMobile.click('[data-act="respond"]:visible:not([disabled])');
  await pilotMobile.locator('#win-body .tabbar [role="tab"]', { hasText: 'Crowd' }).click();
  const crowdFit = await pilotMobile.evaluate(() => {
    const body = document.querySelector('#win-body'); return body.scrollHeight - body.clientHeight;
  });
  assert.ok(crowdFit <= 1, 'the extra settlement explanation fits the phone Crowd tab');
  ok('the phone doors choice and settlement fit in the existing tabs without scrolling');

  // Review refinements: stable sheet controls, incident priority and equipment location.
  const review = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce', hasTouch: true });
  const { page: hud, failures: reviewFailures } = await open(review);
  assert.equal(await hud.getAttribute('html', 'data-theme'), 'light', 'controls default to light');
  await hud.click('#menu-btn');
  await hud.click('#theme-toggle');
  await hud.reload();
  await hud.waitForFunction(() => !!window.__frontOfHouse);
  assert.equal(await hud.getAttribute('html', 'data-theme'), 'dark', 'dark controls persist through reload');
  const save = (s) => Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION, savedAt: 0, state: s })).toString('base64');
  await loadCode(hud, save(createGame(paSeed)));
  await hud.locator('[data-deal="guarantee"]:visible').first().click();
  await hud.locator('#panel [role="tab"]', { hasText: 'Actions' }).click();
  await hud.click('[data-act="starter"]');
  await hud.click('#sheet-collapse');
  assert.equal(await hud.locator('#panel').evaluate((p) => p.inert), true, 'hidden controls leave keyboard navigation');
  await hud.waitForFunction(() => window.__frontOfHouse.board().view.safe.h / innerHeight > 0.8);
  await hud.click('#sheet-collapse');
  assert.equal(await hud.locator('#panel').evaluate((p) => p.inert), false, 'show controls restores keyboard access');
  await hud.click('#sheet-expand');
  assert.equal(await hud.getAttribute('body', 'data-sheet-size'), 'expanded');
  await hud.click('#sheet-expand');
  assert.equal(await hud.getAttribute('body', 'data-sheet-size'), 'peek');
  const touch = await review.newCDPSession(hud);
  const handle = await hud.locator('#sheet-expand').boundingBox();
  const x = handle.x + handle.width / 2;
  const y = handle.y + handle.height / 2;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 70 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await hud.waitForFunction(() => document.body.dataset.sheetSize === 'expanded');
  await hud.locator('#sheet-expand').tap();
  assert.equal(await hud.getAttribute('body', 'data-sheet-size'), 'peek', 'a swipe does not block the next tap');
  await touch.detach();
  await hud.screenshot({ path: join(output, 'review-phone-build.png') });
  await hud.click('[data-act="confirm-build"]');
  await hud.click('[data-act="confirm-promo"]');
  await hud.waitForSelector('[data-act="respond"]');
  assert.equal(await hud.isVisible('#skip-btn'), false, 'incident responses take priority over skipping');
  assert.match(await hud.textContent('#show-status'), /Paused.*response needed/);
  assert.doesNotMatch(await hud.textContent('#incident-box'), /handling|score/i, 'choices explain consequences without a raw handling score');
  await hud.click('#sheet-collapse');
  await resizeTo(hud, 1440, 900);
  assert.equal(await hud.locator('#panel').evaluate((p) => p.inert), false, 'desktop restores controls after phone collapse');
  await hud.click('#locate-incident');
  assert.equal((await game(hud)).playback.paused, true, 'locating equipment does not resolve the incident');
  const located = await hud.evaluate(() => {
    const s = window.__frontOfHouse.state();
    const o = s.venue.objects.find((p) => p.type === 'pa-s' || p.type === 'pa-m');
    const point = window.__frontOfHouse.boardClientOf(o.x + 0.5, o.y + 0.5);
    return { clear: point.clear, target: document.elementFromPoint(point.x, point.y)?.id, zoom: window.__frontOfHouse.board().camera.zoom };
  });
  assert.deepEqual(located, { clear: true, target: 'board', zoom: 2 }, 'Locate PA centres equipment on the unobstructed board');
  await hud.screenshot({ path: join(output, 'review-show-locate.png') });
  await hud.click('#zoom-fit');
  await checkNoScroll(hud, 'show');
  await resizeTo(hud, 2560, 720);
  assert.deepEqual((await measureLayout(hud)).scroll, [0, 0, 0, 0], 'ultrawide keeps a viewport shell');
  await resizeTo(hud, 375, 812);
  await hud.locator('#panel [role="tab"]', { hasText: 'Problem' }).click();
  assert.deepEqual((await measureLayout(hud)).scrolling, [], 'the paused Show controls fit at 375px');
  await hud.screenshot({ path: join(output, 'review-phone-show.png') });
  await hud.locator('[data-act="respond"]:visible:not([disabled])').first().click();
  assert.equal((await game(hud)).phase, 'settle', 'the located incident still completes through the real response control');
  await hud.click('[data-act="accept"]');
  await hud.click('#menu-btn');
  await hud.click('[data-act="mode"][data-mode="scenario"]');
  await hud.click('[data-act="mode"][data-mode="scenario"]');
  await hud.locator('[data-deal="guarantee"]:visible').first().click();
  await hud.locator('#panel [role="tab"]', { hasText: 'Actions' }).click();
  await hud.click('[data-act="confirm-build"]');
  await hud.click('[data-act="confirm-promo"]');
  await hud.waitForSelector('[data-act="respond"]');
  assert.equal(await hud.locator('[data-act="respond"][disabled]').count(), 2, 'the wet lot leaves both paid rain choices unaffordable');
  const rainFit = await hud.evaluate(() => {
    const p = document.querySelector('#panel');
    return { overflow: p.scrollHeight - p.clientHeight, board: window.__frontOfHouse.board().view.safe.h / innerHeight };
  });
  assert.ok(rainFit.overflow <= 1 && rainFit.board >= 0.45, `unaffordable rain choices fit at 375px: ${JSON.stringify(rainFit)}`);
  await hud.screenshot({ path: join(output, 'review-phone-rain.png') });
  await review.close();
  ok('phone sheet controls, theme persistence, honest incident status, equipment location and ultrawide layout');

  assert.deepEqual([...failures, ...failures2, ...failures3, ...failures4, ...failures5, ...failures6, ...failures7, ...pilotFailures, ...pilotPhoneFailures, ...reviewFailures], [], 'no page errors, console errors or failed requests');
  ok('loads clean: no page errors, console errors or failed requests');

  await Promise.all([context, other, calm, phone, spritesCtx, small, phoneFlow, pilotDesktop, pilotPhone].map((c) => c.close()));
} finally {
  await browser.close();
  await server.close();
}

console.log(`\nfront-of-house smoke: ${checks.length} checks passed. Screenshots: ${output}`);
