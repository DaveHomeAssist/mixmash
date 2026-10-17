// Anticipatory suggestions (front-of-house/docs/ANTICIPATORY_UX.md) in the real client, in 2D and
// 3D at desktop and phone sizes: the legal-tile outline, Pick Exit, remembered deals, prices,
// ads and responses, the device preferences key and its Forget button. Every suggestion is
// checked to leave cash, phase and the booked deal unchanged until the player presses something,
// and the HUD and phone sheet never scroll.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { launchOptions, startStaticServer, trackPageFailures } from './static-server.mjs';
import * as D from '../front-of-house/data.mjs';
import { PREFS_KEY, LEGACY_KEYS } from '../front-of-house/prefs.mjs';
import { createGame } from '../front-of-house/engine.mjs';

const server = await startStaticServer();
const base = process.env.FRONT_OF_HOUSE_BASE_URL || `${server.origin}/front-of-house/`;
const browser = await chromium.launch(launchOptions());
const ok = (name) => console.log(`ok ${name}`);

const fixedCareer = Buffer.from(JSON.stringify({ ns: D.SAVE_NAMESPACE, v: D.SCHEMA_VERSION, savedAt: 0, state: createGame(5) })).toString('base64');

// Exits limit capacity: the starter layout with one exit.
const oneExit = (() => {
  let kept = false;
  return D.STARTER_LAYOUT.filter((o) => o.type !== 'exit' || (!kept && (kept = true)));
})();

async function run({ three, width, height, phone }) {
  const tag = `${three ? '3D' : '2D'} ${width}x${height}`;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: phone, isMobile: phone, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = trackPageFailures(page, new URL(base).origin);
  await page.goto(`${base}?renderer=${three ? '3d' : '2d'}`);
  await page.waitForFunction(() => window.__frontOfHouse);
  // A fixed career seed, so every run meets the same offers and incident.
  await page.evaluate((code) => __frontOfHouse.importCode(code), fixedCareer);
  await page.evaluate(() => localStorage.removeItem('front_of_house_prefs'));
  if (three) await page.waitForFunction(() => __frontOfHouse.rendererStatus().active, null, { timeout: 30000 });
  const game = () => page.evaluate(() => __frontOfHouse.state());
  const prefs = () => page.evaluate(() => __frontOfHouse.prefs());
  const stored = () => page.evaluate((k) => localStorage.getItem(k), PREFS_KEY);
  const suggestions = () => page.evaluate(() => __frontOfHouse.suggestions());
  const press = (selector) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) throw new Error(`missing ${s}`); el.click(); }, selector);
  const key = (s) => ({ cash: s.cash, phase: s.phase, deal: s.booking.deal, artist: s.booking.artistId, objects: s.venue.objects.length, promotion: JSON.stringify(s.promotion) });
  // Rendering every suggestion of the phase must not change the game.
  async function inert(label) {
    const before = key(await game());
    await suggestions();
    await page.evaluate(() => window.render_game_to_text());
    assert.deepEqual(key(await game()), before, `${tag}: ${label} changed the game`);
  }
  // The corner HUD rule (docs/HUD.md section 11): the plates cover at most 2% of the lot at the fit.
  async function hudCover(label) {
    if (phone || three) return;
    const cover = await page.evaluate(([W, H]) => {
      const poly = [[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => window.__frontOfHouse.boardClientOf(x, y)).map((p) => [p.x, p.y]);
      const inPoly = (x, y) => poly.reduce((inside, [xi, yi], i) => {
        const [xj, yj] = poly[(i + poly.length - 1) % poly.length];
        return (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi ? !inside : inside;
      }, false);
      const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
      const lot = ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))) / 2;
      let covered = 0;
      for (const p of [...document.querySelectorAll('#panel .plate')].filter((p) => !p.hidden && p.getClientRects().length)) {
        const r = p.getBoundingClientRect();
        for (let y = r.top + 1; y < r.bottom; y += 2) for (let x = r.left + 1; x < r.right; x += 2) if (inPoly(x, y)) covered += 4;
      }
      return (covered / lot) * 100;
    }, [D.GRID.w, D.GRID.h]);
    assert.ok(cover <= 2, `${tag}: ${label}: the HUD covers ${cover.toFixed(2)}% of the lot (at most 2%)`);
  }
  async function noScroll(label) {
    const bad = await page.evaluate((isPhone) => {
      const root = document.scrollingElement;
      const out = [];
      if (root.scrollHeight > innerHeight + 1 || root.scrollWidth > innerWidth + 1) out.push(`document ${root.scrollWidth}x${root.scrollHeight}`);
      const visible = (el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
      const panels = [...document.querySelectorAll('#panel, #panel .plate, #panel [data-tab]:not(.tab-off)')].filter(visible);
      for (const el of panels) {
        const style = getComputedStyle(el);
        if (['auto', 'scroll'].includes(style.overflowY) && el.scrollHeight > el.clientHeight + 1) out.push(`${el.id || el.className} ${el.scrollHeight}>${el.clientHeight}`);
      }
      // Every visible control stays inside the window (a clipped sheet hides controls without scrolling).
      for (const el of document.querySelectorAll('#panel button, #panel input, #panel .hint-badge')) {
        if (!visible(el) || el.closest('.tab-off')) continue;
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1)) out.push(`${el.id || el.textContent.trim().slice(0, 24)} is outside the window`);
      }
      const panel = document.querySelector('#panel');
      if (panel.scrollHeight > panel.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(panel).overflowY)) out.push('panel scrolls');
      return out;
    }, phone);
    assert.deepEqual(bad, [], `${tag}: ${label} scrolls`);
  }

  // A fresh browser: the defaults, and nothing stored until the player chooses something.
  assert.equal(await stored(), null, `${tag}: no preferences written on load`);
  assert.equal((await prefs()).suggest, true);
  assert.equal(await page.locator('#suggest-toggle').getAttribute('aria-pressed'), 'true');
  await inert('Book');
  await noScroll('Book');

  // Book Sodium Arcade on a guarantee, then build with one exit so exits cap capacity.
  await press('[data-act="deal"][data-deal="guarantee"]');
  assert.equal((await game()).phase, 'build');
  await page.evaluate((objects) => __frontOfHouse.act({ type: 'setLayout', objects }), oneExit);
  await page.waitForSelector('#pick-exit', { state: 'attached' });
  await inert('Build with an exit cap');
  const beforePick = await game();
  assert.equal((await suggestions()).build.pickExit, true);
  if (phone) await press('[role="tab"][data-tab-name="Lot"]');
  await noScroll('Build readiness with Pick Exit');
  await hudCover('Build readiness with Pick Exit');
  if (!phone) {
    const box = await page.locator('#pick-exit').boundingBox();
    assert.ok(box.height >= 43.5, `${tag}: Pick Exit is a 44px target (${box.height})`);
  }
  await press('#pick-exit');
  const afterPick = await game();
  assert.equal((await page.evaluate(() => __frontOfHouse.buildTools())).tool, 'exit', `${tag}: Pick Exit picks the tool`);
  assert.deepEqual(key(afterPick), key(beforePick), `${tag}: Pick Exit places and charges nothing`);
  ok(`${tag}: Pick Exit picks the Exit tool without placing or paying`);

  // The legal-tile outline: every outlined tile is accepted by the engine; drawn by the active renderer.
  await page.waitForFunction(() => __frontOfHouse.board().legalTiles > 0);
  const legal = (await suggestions()).build.legalTiles;
  assert.ok(legal > 0, `${tag}: legal tiles computed`);
  assert.equal(await page.evaluate(() => __frontOfHouse.board().legalTiles), legal, `${tag}: the ${three ? '3D' : '2D'} board draws every legal tile`);
  assert.equal(await page.evaluate(() => __frontOfHouse.board().renderer), three ? 'three-webgl' : 'canvas-2d');
  assert.match(await page.locator('#board-status').innerText().catch(() => ''), /Outlined tiles accept it|^$/);
  await press('[data-act="select"]');
  assert.equal(await page.evaluate(() => __frontOfHouse.board().legalTiles), 0, `${tag}: Select clears the outline`);
  assert.equal(JSON.parse(await stored()).rooms.lot.lastTool, 'exit', `${tag}: last tool stored`);
  ok(`${tag}: ${legal} legal exit tiles outlined`);

  // Lock and promote: choose a price and ads, open the doors; the act's mix is remembered then.
  await page.evaluate((objects) => __frontOfHouse.act({ type: 'setLayout', objects }), D.STARTER_LAYOUT);
  await page.evaluate(() => __frontOfHouse.act({ type: 'confirmBuild' }));
  assert.equal((await game()).phase, 'promote');
  await inert('Promote');
  await noScroll('Promote');
  assert.equal(JSON.parse(await stored() || '{"acts":{}}').acts?.['sodium-arcade'], undefined, `${tag}: an unopened plan is not remembered`);
  await page.evaluate(() => __frontOfHouse.act({ type: 'setPromotion', price: 18, ads: { flyers: 100, social: 50, radio: 0 } }));
  await press('#confirm-promo');
  assert.equal((await game()).phase, 'show');
  assert.deepEqual(JSON.parse(await stored()).acts['sodium-arcade'], { deal: 'guarantee', price: 18, ads: { flyers: 100, social: 50, radio: 0 } });
  ok(`${tag}: deal, price and ads remembered at Open doors`);

  // Show: answer the incident; the response is remembered.
  await page.evaluate(() => __frontOfHouse.skip());
  await page.waitForSelector('#incident-box:not([hidden]) [data-act="respond"]:not([disabled])', { state: 'attached' });
  await inert('Incident card');
  const incident = (await game()).show.incidentId;
  const response = await page.evaluate(() => [...document.querySelectorAll('[data-act="respond"]:not([disabled])')].at(-1).dataset.response);
  await press(`[data-act="respond"][data-response="${response}"]`);
  assert.equal(JSON.parse(await stored()).incidents[incident], response);
  await page.waitForFunction(() => __frontOfHouse.state().phase === 'settle', null, { timeout: 30000 });
  await page.evaluate(() => document.querySelector('[data-act="accept"]').click());
  assert.equal((await game()).phase, 'done');

  // Done: the next-show preview reads the next offers without booking them.
  await page.waitForSelector('#next-preview', { state: 'attached' });
  await inert('Done preview');
  await noScroll('Done');
  const preview = (await suggestions()).next;
  assert.match(await page.locator('#next-preview').textContent(), new RegExp(preview[0].name));
  await press('[data-act="next"]');
  const book = await game();
  assert.equal(book.phase, 'book');
  assert.deepEqual(book.booking.deal, null);
  assert.deepEqual(preview.map((o) => o.artistId), await page.evaluate(() => JSON.parse(render_game_to_text()).offers));
  ok(`${tag}: next-show preview matches the offers it led to`);

  // Book: the remembered deal is marked, nothing is booked.
  await inert('Book badges');
  if (book.booking.artistId === 'sodium-arcade' || (await page.locator('[data-artist="sodium-arcade"]').count())) {
    const badge = page.locator('[data-act="deal"][data-artist="sodium-arcade"][data-deal="guarantee"] .hint-badge');
    assert.equal(await badge.count(), 1, `${tag}: Last time badge`);
    assert.equal(await badge.textContent(), 'Last time');
  }
  await noScroll('Book with badges');
  const rebook = (await page.locator('[data-act="deal"][data-artist="sodium-arcade"][data-deal="guarantee"]').count()) > 0;
  assert.ok(rebook, `${tag}: seed 5 offers Sodium Arcade again`);
  await press(rebook ? '[data-act="deal"][data-artist="sodium-arcade"][data-deal="guarantee"]' : '[data-act="deal"][data-deal="guarantee"]');
  const build = await game();
  assert.equal(build.phase, 'build');

  // FOH-QA-015: the booking confirmation is a board toast, so Build fits right after booking, and
  // 'nothing is paid' stays on Back.
  assert.match(await page.textContent('#board-status'), /^Booked Sodium Arcade on a \$\d+ guarantee\. Nothing is paid until the doors open; Back returns to booking\.$/, `${tag}: the booking toast confirms the act and deal`);
  assert.equal((await page.textContent('#msg')).trim(), '', `${tag}: the card plate holds no booking line`);
  assert.match(await page.getAttribute('[data-act="back"]', 'aria-label'), /Nothing is paid until you open the doors/, `${tag}: Back says nothing is paid yet`);
  await hudCover('Build right after booking');
  await noScroll('Build right after booking');
  ok(`${tag}: Build fits right after booking`);

  // Build entry: last night's weakest part, with a tool press that places nothing.
  const weakest = (await suggestions()).build.weakest;
  assert.equal(weakest.weakest, build.history.at(-1).weakest);
  await inert('Build weakest');
  if (phone) await press('[role="tab"][data-tab-name="Tools"]');
  assert.equal((await suggestions()).build.shown, true, `${tag}: the weakest line is shown on Build entry`);
  await noScroll('Build with the weakest line');
  await hudCover('Build with the weakest line');
  const offered = await page.evaluate(() => [...document.querySelectorAll('.tools-plate input[name="tool"]')].map((i) => i.value));
  const expected = weakest.tools.filter((t) => offered.includes(t)).slice(0, 2);
  assert.deepEqual((await suggestions()).build.ringed, expected, `${tag}: tools for the weakest part are ringed`);
  if (!phone) assert.match(await page.locator('#tool-info').innerText(), /Last night’s weakest:/);
  await inert('Build rings');
  await press('.tools-plate input[value="bar"]');
  assert.deepEqual((await suggestions()).build.ringed, ['bar'], `${tag}: the last used tool is ringed after a choice`);
  assert.equal((await game()).venue.objects.length, build.venue.objects.length, `${tag}: choosing a ringed tool places nothing`);
  await press('[data-act="select"]');

  // Promote again: Same as last time, applied only on a press, costs nothing.
  await page.evaluate(() => __frontOfHouse.act({ type: 'confirmBuild' }));
  const promote = await game();
  const hint = (await suggestions()).promote;
  if (hint) {
    await page.waitForSelector('[data-act="promo-repeat"]', { state: 'attached' });
    await inert('Promote repeat');
    await noScroll('Promote with Same as last time');
    assert.equal(await page.locator('#price-memory option').getAttribute('value'), '18', `${tag}: price tick at the remembered value`);
    await press('[data-act="promo-repeat"]');
    const applied = await game();
    assert.equal(applied.promotion.price, Math.min(18, D.PRICE_MAX));
    assert.deepEqual(applied.promotion.ads, { flyers: 100, social: 50, radio: 0 });
    assert.equal(applied.cash, promote.cash, `${tag}: Apply charges nothing`);
    assert.equal(applied.phase, 'promote', `${tag}: Apply does not open the doors`);
    ok(`${tag}: Same as last time pre-fills price and ads on a press`);
  } else {
    assert.equal(rebook, false, `${tag}: a rebooked act offers its last price and ads ${JSON.stringify({ prefs: await prefs(), promotion: promote.promotion, cash: promote.cash, phase: promote.phase, artist: promote.booking.artistId })}`);
  }

  // Suggestions off hides them; Forget removes the key and the legacy keys, never the save.
  await page.click('#menu-btn');
  await page.click('#suggest-toggle');
  assert.equal((await prefs()).suggest, false);
  assert.equal(await page.locator('[data-act="promo-repeat"]').count(), 0, `${tag}: no suggestion when off`);
  assert.deepEqual(JSON.parse(await stored()).acts, {});
  await page.click('#suggest-toggle');
  await page.click('#save-menu summary');
  const save = await page.evaluate((ns) => localStorage.getItem(ns), D.SAVE_NAMESPACE);
  await page.click('#forget-prefs');
  assert.equal(await stored(), null, `${tag}: Forget removes ${PREFS_KEY}`);
  for (const legacy of Object.values(LEGACY_KEYS)) assert.equal(await page.evaluate((k) => localStorage.getItem(k), legacy), null);
  assert.equal(await page.evaluate((ns) => localStorage.getItem(ns), D.SAVE_NAMESPACE), save, `${tag}: the career save is untouched`);
  assert.match(await page.locator('#save-status').innerText(), /Forgot suggestions/);
  ok(`${tag}: Forget clears preferences and keeps the game`);

  assert.deepEqual(errors, [], `${tag}: page errors`);
  await context.close();
}

try {
  for (const three of [false, true]) {
    await run({ three, width: 1440, height: 900, phone: false });
    await run({ three, width: 1024, height: 700, phone: false });
    await run({ three, width: 390, height: 844, phone: true });
  }
  console.log('front-of-house suggestions smoke passed');
} finally {
  await browser.close();
  await server.close();
}
