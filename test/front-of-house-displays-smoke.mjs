// Manual actual-display density proof with isolated Chrome storage; requires attached DPR1 and DPR2 displays.
import assert from 'node:assert/strict';
import { mkdir, writeFile, mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { startStaticServer, repoRoot } from './static-server.mjs';
import { createGame, applyAction } from '../front-of-house/engine.mjs';
import { STARTER_LAYOUT, SAVE_NAMESPACE, SCHEMA_VERSION } from '../front-of-house/data.mjs';

const output = process.env.FRONT_OF_HOUSE_DISPLAY_OUTPUT || await mkdtemp(join(tmpdir(), 'foh-displays-'));
await mkdir(output, { recursive: true });
if ((await readdir(output)).length) throw new Error('Output directory must be empty; preserve prior display checks');
let state = createGame(170);
for (const action of [{ type: 'chooseDeal', deal: 'door', artistId: 'sodium-arcade' }, { type: 'setLayout', objects: STARTER_LAYOUT }]) {
  const result = applyAction(state, action); assert.equal(result.error, null); state = result.state;
}
const code = Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION, savedAt: 0, state })).toString('base64');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const report = {
  startedAt: new Date().toISOString(), source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
  harnessSha256: hash(await readFile(new URL(import.meta.url))),
  scope: 'Actual display-density transitions in the isolated full client; not human acceptance', records: [], errors: [],
};
const server = await startStaticServer();
let browser;
try {
  browser = await chromium.launch({ headless: false, channel: 'chrome', args: ['--use-angle=metal'] }); report.browser = browser.version();
  const context = await browser.newContext({ viewport: null, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  const cdp = await context.newCDPSession(page), { targetInfo } = await cdp.send('Target.getTargetInfo');
  // Permission belongs only to this temporary context and loopback origin, never the user's profile.
  await cdp.send('Browser.setPermission', { permission: { name: 'window-management' }, setting: 'granted', origin: server.origin, browserContextId: targetInfo.browserContextId });
  await page.goto(`${server.origin}/front-of-house/?renderer=3d`); await page.waitForFunction(() => window.__frontOfHouse);
  await page.evaluate(save => __frontOfHouse.importCode(save), code); await page.waitForFunction(() => __frontOfHouse.rendererStatus().active);
  const displays = await page.evaluate(async () => {
    const details = await getScreenDetails();
    return details.screens.map(s => ({ left: s.availLeft, top: s.availTop, width: s.availWidth, height: s.availHeight, dpr: s.devicePixelRatio }));
  });
  report.displays = displays;
  const low = displays.find(display => display.dpr === 1), high = displays.find(display => display.dpr === 2);
  assert.ok(low && high, 'Need actual attached displays at density1 and2');
  const width = Math.min(1000, low.width - 40, high.width - 40), height = Math.min(700, low.height - 40, high.height - 40);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  const before = await page.evaluate(() => JSON.stringify(__frontOfHouse.state())); report.stateSha256 = hash(before);
  for (const [index, display] of [low, high, low].entries()) {
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { left: display.left + 20, top: display.top + 20, width, height, windowState: 'normal' } });
    await page.bringToFront();
    // No device metrics override and no direct renderer resize call: observe the actual window move.
    await page.waitForFunction(dpr => {
      const canvas = document.querySelector('.lot-webgl'), rect = canvas.getBoundingClientRect();
      return devicePixelRatio === dpr && canvas.width === Math.floor(rect.width * dpr) && canvas.height === Math.floor(rect.height * dpr) && __frontOfHouse.rendererStatus().active;
    }, display.dpr);
    const value = await page.evaluate(() => {
      const canvas = document.querySelector('.lot-webgl'), rect = canvas.getBoundingClientRect(), picks = [];
      for (const yaw of [37, 135]) {
        __frontOfHouse.boardCamera({ yaw, pitch: 48, zoom: 1 });
        const point = __frontOfHouse.boardClientOf(12.5, 8.5); picks.push(__frontOfHouse.boardTileAt(point.x, point.y));
      }
      return {
        dpr: devicePixelRatio, viewport: { width: innerWidth, height: innerHeight }, backing: { width: canvas.width, height: canvas.height },
        css: { width: rect.width, height: rect.height }, screen: { left: screen.availLeft, top: screen.availTop, width: screen.width, height: screen.height },
        focus: document.hasFocus(), visible: document.visibilityState, state: JSON.stringify(__frontOfHouse.state()), picks,
        pageFit: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight,
      };
    });
    assert.equal(value.state, before); delete value.state;
    assert.deepEqual(value.picks, [{ x: 12, y: 8 }, { x: 12, y: 8 }]);
    assert.equal(value.focus, true); assert.equal(value.visible, 'visible'); assert.equal(value.pageFit, true);
    report.records.push(value); await page.screenshot({ path: join(output, `display-${index}.png`) });
  }
  assert.deepEqual(report.records[0].viewport, report.records[1].viewport, 'CSS viewport stays fixed across actual density change');
  assert.deepEqual(report.records[0].viewport, report.records[2].viewport); assert.deepEqual(report.errors, []);
  report.passed = true;
  console.log(`Actual attached displays: DPR1 → DPR2 → DPR1, fixed CSS viewport, backing/picking/state preservation passed. Evidence: ${output}`);
} catch (error) { report.failure = error.message; throw error; }
finally {
  report.finishedAt = new Date().toISOString();
  try { await browser?.close(); } finally { await server.close(); await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2)); }
}
