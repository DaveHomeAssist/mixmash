// Full native Chrome client diagnostics: actual 3D HUD, running show and fixed/moving camera repeats.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir, mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir, cpus, totalmem, platform, arch, release, loadavg } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer, trackPageFailures } from './static-server.mjs';
import { createGame, applyAction, liveIncidentMinute, showPreview, incidentAtFor, rollShow } from '../front-of-house/engine.mjs';
import { STARTER_LAYOUT, SAVE_NAMESPACE, SCHEMA_VERSION, VENUES } from '../front-of-house/data.mjs';
import { summarize, withDeadline } from '../front-of-house/tools/performance-stats.mjs';
const quick = process.argv.includes('--quick'), festival = process.argv.includes('--festival'), overviewHidden = process.argv.includes('--overview-hidden');
assert.ok(process.argv.slice(2).every(a => ['--quick', '--festival', '--overview-hidden'].includes(a)), 'Unknown diagnostic option');
assert.ok(!overviewHidden || festival, 'Overview comparison requires --festival');
const output = process.env.FRONT_OF_HOUSE_HUD_OUTPUT || await mkdtemp(join(tmpdir(), 'foh-hud-performance-'));
await mkdir(output, { recursive: true });
assert.equal((await readdir(output)).length, 0, 'Preserve previous measurements: output must be empty');
const hash = data => createHash('sha256').update(data).digest('hex');
const command = (name, args) => { try { return execFileSync(name, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return 'unknown'; } };
const actions = festival ? [{ type: 'chooseVenue', venueId: 'festival' }, { type: 'chooseDeal', deal: 'guarantee', artistId: 'paper-voltage', secondId: 'hollow-census', stagePolicy: 1 }, { type: 'setLayout', objects: VENUES.festival.starter }, { type: 'confirmBuild' }, { type: 'setPromotion', price: 20, ads: { flyers: 0, social: 150, radio: 150 } }, { type: 'confirmPromotion' }] : [{ type: 'chooseDeal', deal: 'door', artistId: 'sodium-arcade' }, { type: 'setLayout', objects: STARTER_LAYOUT }, { type: 'confirmBuild' }, { type: 'setPromotion', price: 20, ads: { flyers: 0, social: 150, radio: 150 }, services: true }, { type: 'confirmPromotion', flow: 1 }, { type: 'advanceLive', minute: 25 }];
const state = actions.reduce((s, a) => { const r = applyAction(s, a); assert.equal(r.error, null); return r.state; }, festival ? createGame(8, { mode: 'sandbox' }) : createGame(170));
if (festival) { assert.equal(showPreview(state).attendance, 6000); assert.equal(Math.round(6000 * Math.min(1, incidentAtFor(state.show.incidentId, rollShow(state.seed, state.booking.artistId).timing) / 0.45)), 1267); }
else assert.ok(liveIncidentMinute(state) > 70, 'Fixture must remain running through warmup and measurement');
const fixture = JSON.stringify({ actions, state }), saveCode = Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION, savedAt: 0, state })).toString('base64');
await writeFile(join(output, 'fixture.json'), fixture);
const sources = {};
for (const path of ['front-of-house/board.js', 'front-of-house/game.js', 'front-of-house/board-adapter.mjs', 'front-of-house/engine.mjs', 'front-of-house/data.mjs', 'front-of-house/services.mjs', 'front-of-house/room-profile.mjs', 'front-of-house/service-crowd.mjs', 'front-of-house/service-guests.mjs', 'front-of-house/index.html', 'front-of-house/styles.css', 'test/front-of-house-native-hud-performance.mjs']) sources[path] = hash(await readFile(new URL(`../${path}`, import.meta.url)));
for (const path of ['front-of-house/lot-renderer.mjs', 'front-of-house/lot-models.mjs', 'front-of-house/lot-camera.mjs', 'front-of-house/lot-presentation.mjs', 'front-of-house/lot-assets.json', 'package-lock.json']) sources[path] = hash(await readFile(new URL(`../${path}`, import.meta.url)));
if (festival) for (const path of ['front-of-house/site-map.mjs', 'front-of-house/site-map-geometry.mjs', 'front-of-house/stage-accounts.mjs', 'front-of-house/tools/performance-stats.mjs']) sources[path] = hash(await readFile(new URL(`../${path}`, import.meta.url)));
const report = {
  mode: quick ? 'harness validation only' : 'full HUD native 3D diagnostic', startedAt: new Date().toISOString(),
  source: { commit: command('git', ['rev-parse', 'HEAD']), dirty: command('git', ['status', '--porcelain']).length > 0, sha256: sources, variation: festival ? 'Paused Festival full client; overview-hidden changes only overview DOM visibility; engine and saved fixture unchanged.' : 'Native visible Chrome/full3D client; no runtime or save mutation.' },
  host: { platform: platform(), architecture: arch(), kernel: release(), model: command('sysctl', ['-n', 'hw.model']), cpu: cpus()[0]?.model, cpuCount: cpus().length, memoryBytes: totalmem(), osVersion: command('sw_vers', ['-productVersion']), osBuild: command('sw_vers', ['-buildVersion']), otherLoad: 'uncontrolled shared host; load averages recorded', physicalDisplay: 'actual native viewport, density and focus recorded per run; human acceptance not measured' },
  protocol: { venue: festival ? 'festival' : 'lot', overview: festival ? (overviewHidden ? 'hidden comparison' : 'visible') : 'not shown in Lot', viewport: null, requestedDpr: 'native', warmupMs: quick ? 1000 : 10000, measurementMs: quick ? 2000 : 30000, repeats: quick ? 1 : 3, reducedMotion: 'no-preference', headless: false, launchArgs: ['--use-angle=metal'], renderer: festival ? '3D Metal; actual paused Festival game/HUD; 6000 total attendance, 1267 visible arrivals, 180 representative guests' : '3D Metal; actual game/HUD/real one-minute-per-second show clock', camera: 'zoom2; fixed or ten-second middle-drag cycle around native viewport center,120px horizontal/70px vertical amplitude; actual pointermove handler', metrics: 'observed RAF cadence and long tasks; neither GPU completion nor isolated whole-client CPU duration', acceptance: 'descriptive only; no physical-device or statistical gate inferred' },
  fixtureSha256: hash(fixture), runs: [], errors: [],
};
const save = () => writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
await save();
const server = await startStaticServer(); let browser;
try {
  browser = await chromium.launch({ headless: false, channel: 'chrome', args: report.protocol.launchArgs }); report.browser = browser.version();
  for (let repeat = 1; repeat <= report.protocol.repeats; repeat++) for (const camera of ['fixed', 'moving']) {
    const record = { id: `${camera}-native3d-${repeat}`, camera, repeat, valid: false, loadBefore: loadavg() };
    report.runs.push(record); await save();
    const context = await browser.newContext({ viewport: null, reducedMotion: 'no-preference', serviceWorkers: 'block' });
    try {
      const page = await context.newPage(), errors = trackPageFailures(page, server.origin);
      await page.goto(`${server.origin}/front-of-house/?renderer=3d`); await page.waitForFunction(() => window.__frontOfHouse);
      const cdp = await context.newCDPSession(page), { windowId } = await cdp.send('Browser.getWindowForTarget');
      const available = await page.evaluate(() => ({ left: screen.availLeft, top: screen.availTop, width: screen.availWidth, height: screen.availHeight }));
      await cdp.send('Browser.setWindowBounds', { windowId, bounds: { ...available, windowState: 'normal' } });
      await page.bringToFront(); await page.waitForFunction(() => document.hasFocus()); await page.waitForTimeout(500);
      record.nativeWindow = await page.evaluate(() => ({ viewport: { width: innerWidth, height: innerHeight }, outer: { width: outerWidth, height: outerHeight }, screen: { width: screen.width, height: screen.height }, dpr: devicePixelRatio, focused: document.hasFocus(), visibility: document.visibilityState }));
      assert.equal(await page.evaluate(code => __frontOfHouse.importCode(code), saveCode), true);
      await page.waitForFunction(() => __frontOfHouse.rendererStatus().active);
      const loaded = await page.evaluate(() => __frontOfHouse.state()); assert.deepEqual(loaded, state, 'Import preserves exact canonical fixture');
      await page.evaluate(() => __frontOfHouse.boardZoom(2));
      if (festival) { await page.evaluate(() => __frontOfHouse.skip()); await page.waitForFunction(() => JSON.parse(render_game_to_text()).playback.paused && __frontOfHouse.siteMap().visible); await page.waitForTimeout(100); if (overviewHidden) await page.evaluate(() => { document.querySelector('#site-map').hidden = true; }); }
      else await page.selectOption('#live-speed', '1');
      record.initial = await page.evaluate(() => {
        const root = document.documentElement, board = __frontOfHouse.board(), c = document.querySelector('.lot-webgl');
        const gl = c.getContext('webgl2'), debug = gl.getExtension('WEBGL_debug_renderer_info'); const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        return { overview: __frontOfHouse.siteMap?.(), board, graphics: renderer, css: { width: c.getBoundingClientRect().width, height: c.getBoundingClientRect().height }, backing: [c.width, c.height], dpr: devicePixelRatio, pageFit: root.scrollWidth <= root.clientWidth && root.scrollHeight <= root.clientHeight, state: __frontOfHouse.state(), text: JSON.parse(render_game_to_text()) };
      });
      assert.equal(record.initial.pageFit, true); assert.equal(record.initial.board.renderer, 'three-webgl'); const requested = Math.max(1, Math.min(2, record.nativeWindow.dpr)); const expectedDpr = record.initial.css.width * record.initial.css.height * requested ** 2 > 6000000 ? Math.min(requested, 1.5) : requested; assert.equal(record.initial.board.dpr, expectedDpr); assert.match(record.initial.graphics, /ANGLE Metal Renderer: Apple M4/);
      await page.screenshot({ path: join(output, `${record.id}-before.png`) });
      if (!festival) await page.click('#live-play');
      if (camera === 'moving') { await page.mouse.move(record.nativeWindow.viewport.width / 2, record.nativeWindow.viewport.height / 2); await page.mouse.down({ button: 'middle' }); }
      const raw = await withDeadline(page.evaluate(async ({ warmupMs, measurementMs, camera, center }) => {
        const frames = [], violations = [], tasks = [];
        const invalid = event => violations.push({ type: event.type, at: performance.now() });
        document.addEventListener('visibilitychange', invalid); window.addEventListener('resize', invalid); window.addEventListener('blur', invalid); document.querySelector('.lot-webgl').addEventListener('webglcontextlost', invalid);
        const supported = PerformanceObserver.supportedEntryTypes.includes('longtask');
        const observer = supported ? new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))) : null;
        observer?.observe({ type: 'longtask' });
        const canvas = document.querySelector('#board');
        let previousCamera = __frontOfHouse.boardCamera(), movedFrames = 0;
        const move = t => {
          if (camera === 'moving') canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 4, button: -1, clientX: center.x + 120 * Math.sin(2 * Math.PI * t / 10000), clientY: center.y + 70 * Math.sin(4 * Math.PI * t / 10000) }));
          const current = __frontOfHouse.boardCamera();
          if (current.x !== previousCamera.x || current.y !== previousCamera.y) movedFrames++;
          previousCamera = current;
        };
        const warm = performance.now();
        await new Promise(resolve => { const frame = t => { move(t - warm); if (t - warm >= warmupMs) resolve(); else requestAnimationFrame(frame); }; requestAnimationFrame(frame); });
        let start, previous, end; movedFrames = 0; const overviewBefore = __frontOfHouse.siteMap?.();
        await new Promise(resolve => { const frame = t => {
          if (start === undefined) { start = previous = t; move(0); requestAnimationFrame(frame); return; }
          frames.push(t - previous); previous = t; move(t - start);
          if (t - start >= measurementMs) { end = t; resolve(); } else requestAnimationFrame(frame);
        }; requestAnimationFrame(frame); });
        await new Promise(resolve => setTimeout(resolve, 0));
        if (observer) { tasks.push(...observer.takeRecords().map(e => ({ start: e.startTime, duration: e.duration }))); observer.disconnect(); }
        document.removeEventListener('visibilitychange', invalid); window.removeEventListener('resize', invalid); window.removeEventListener('blur', invalid); document.querySelector('.lot-webgl').removeEventListener('webglcontextlost', invalid);
        return { overviewBefore, overviewAfter: __frontOfHouse.siteMap?.(), frames, start, end, movedFrames, violations, longTasksSupported: supported, longTasks: tasks.filter(e => e.start < end && e.start + e.duration > start), visibility: document.visibilityState, focus: document.hasFocus() };
      }, { ...report.protocol, camera, center: { x: record.nativeWindow.viewport.width / 2, y: record.nativeWindow.viewport.height / 2 } }), report.protocol.warmupMs + report.protocol.measurementMs + 30000);
      const rawBytes = JSON.stringify(raw); await writeFile(join(output, `${record.id}-raw.json`), rawBytes); record.rawSha256 = hash(rawBytes);
      if (camera === 'moving') await page.mouse.up({ button: 'middle' });
      assert.ok(camera === 'moving' ? raw.movedFrames > raw.frames.length * 0.95 : raw.movedFrames === 0, 'Verify real camera motion during the timed window');
      record.final = await page.evaluate(() => ({ state: __frontOfHouse.state(), text: JSON.parse(render_game_to_text()), board: __frontOfHouse.board() }));
      if (!festival) await page.click('#live-play');
      await page.screenshot({ path: join(output, `${record.id}-after.png`) });
      if (festival) {
        assert.equal(record.final.text.playback.paused, true); assert.deepEqual(record.final.state, state, 'Paused Festival fixture stays exact');
        assert.equal(raw.overviewBefore.visible, !overviewHidden); assert.equal(raw.overviewAfter.visible, !overviewHidden);
        const paints = raw.overviewAfter.draws - raw.overviewBefore.draws;
        assert.ok(!overviewHidden && camera === 'moving' ? paints > raw.frames.length * 0.95 : paints === 0, 'Verify overview repaint or reuse during the entire window');
        assert.equal(record.initial.board.representedAttendance, 1267); assert.equal(record.final.board.representedAttendance, 1267); assert.equal(record.final.board.representativeGuests, 180);
      } else {
        assert.equal(record.final.text.playback.paused, false, 'Clock must still be running at window end');
        assert.ok(record.final.state.show.services.minute - state.show.services.minute >= Math.floor((report.protocol.warmupMs + report.protocol.measurementMs) / 1000));
      }
      assert.deepEqual(raw.violations, []); assert.equal(raw.visibility, 'visible'); assert.equal(raw.focus, true); assert.equal(record.final.board.renderer, 'three-webgl'); assert.deepEqual(errors, []);
      Object.assign(record, { valid: true, movedFrames: raw.movedFrames, summary: summarize(raw.frames), observedCadenceHz: 1000 * raw.frames.length / (raw.end - raw.start), longTaskCount: raw.longTasks.length, rawSha256: hash(rawBytes), loadAfter: loadavg(), errors });
      console.log(`${record.id}: ${record.observedCadenceHz.toFixed(2)} Hz; ${record.summary.above50} intervals >50ms; ${festival ? 'paused Festival' : `minute ${record.final.state.show.services.minute}`}`);
    } catch (error) { record.error = error.stack; report.errors.push({ id: record.id, message: error.message }); throw error; }
    finally { await context.close(); await save(); }
  }
  report.finishedAt = new Date().toISOString(); await save(); console.log(`Report: ${output}`);
} catch (error) { report.failure = error.message; throw error; } finally { try { await browser?.close(); } finally { await server.close(); report.finishedAt = new Date().toISOString(); await save(); } }
