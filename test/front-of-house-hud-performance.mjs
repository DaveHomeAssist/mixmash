// Full client diagnostics: identical live-show saves with direct/cached classic floors.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir, mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir, cpus, totalmem, platform, arch, release, loadavg } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer, trackPageFailures } from './static-server.mjs';
import { createGame, applyAction, liveIncidentMinute } from '../front-of-house/engine.mjs';
import { STARTER_LAYOUT, SAVE_NAMESPACE, SCHEMA_VERSION } from '../front-of-house/data.mjs';
import { summarize, withDeadline } from '../front-of-house/tools/performance-stats.mjs';
const quick = process.argv.includes('--quick');
assert.ok(process.argv.slice(2).every(a => a === '--quick'), 'Only --quick is supported');
const output = process.env.FRONT_OF_HOUSE_HUD_OUTPUT || await mkdtemp(join(tmpdir(), 'foh-hud-performance-'));
await mkdir(output, { recursive: true });
assert.equal((await readdir(output)).length, 0, 'Preserve previous measurements: output must be empty');
const hash = data => createHash('sha256').update(data).digest('hex');
const command = (name, args) => { try { return execFileSync(name, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return 'unknown'; } };
const actions = [{ type: 'chooseDeal', deal: 'door', artistId: 'sodium-arcade' }, { type: 'setLayout', objects: STARTER_LAYOUT }, { type: 'confirmBuild' }, { type: 'setPromotion', price: 20, ads: { flyers: 0, social: 150, radio: 150 }, services: true }, { type: 'confirmPromotion' }, { type: 'advanceLive', minute: 25 }];
const state = actions.reduce((s, a) => { const r = applyAction(s, a); assert.equal(r.error, null); return r.state; }, createGame(170));
assert.ok(liveIncidentMinute(state) > 70, 'Fixture must remain running through warmup and measurement');
const fixture = JSON.stringify({ actions, state }), saveCode = Buffer.from(JSON.stringify({ ns: SAVE_NAMESPACE, v: SCHEMA_VERSION, savedAt: 0, state })).toString('base64');
await writeFile(join(output, 'fixture.json'), fixture);
const boardSource = await readFile(new URL('../front-of-house/board.js', import.meta.url), 'utf8');
assert.ok(boardSource.includes('cacheFloor = true'), 'Direct control must use the supported cache option');
const directSource = boardSource.replace('cacheFloor = true', 'cacheFloor = false');
const sources = {};
for (const path of ['front-of-house/board.js', 'front-of-house/game.js', 'front-of-house/board-adapter.mjs', 'front-of-house/engine.mjs', 'front-of-house/data.mjs', 'front-of-house/services.mjs', 'front-of-house/service-crowd.mjs', 'front-of-house/service-guests.mjs', 'front-of-house/index.html', 'front-of-house/styles.css', 'test/front-of-house-hud-performance.mjs']) sources[path] = hash(await readFile(new URL(`../${path}`, import.meta.url)));
const report = {
  mode: quick ? 'harness validation only' : 'full HUD classic floor comparison', startedAt: new Date().toISOString(),
  source: { commit: command('git', ['rev-parse', 'HEAD']), dirty: command('git', ['status', '--porcelain']).length > 0, sha256: sources, directControlSha256: hash(directSource), directControl: 'Only the createBoard cacheFloor default is changed to false through a browser route; no source or save mutation.' },
  host: { platform: platform(), architecture: arch(), kernel: release(), model: command('sysctl', ['-n', 'hw.model']), cpu: cpus()[0]?.model, cpuCount: cpus().length, memoryBytes: totalmem(), osVersion: command('sw_vers', ['-productVersion']), osBuild: command('sw_vers', ['-buildVersion']), otherLoad: 'uncontrolled shared host; load averages recorded', physicalDisplay: 'not measured' },
  protocol: { viewport: { width: 1920, height: 1080 }, requestedDpr: 2, warmupMs: quick ? 1000 : 10000, measurementMs: quick ? 2000 : 30000, repeats: quick ? 1 : 3, reducedMotion: 'no-preference', headless: true, launchArgs: ['--use-angle=metal'], renderer: 'classic Canvas 2D; actual game/HUD/real one-minute-per-second show clock', camera: 'zoom 2; fixed or a ten-second middle-drag cycle, x=960+120 sin(2pi t/10), y=540+70 sin(4pi t/10), through the actual pointermove handler', metrics: 'observed RAF cadence and long tasks; neither GPU completion nor isolated whole-client CPU duration', acceptance: 'descriptive only; no physical-device or statistical gate inferred' },
  fixtureSha256: hash(fixture), runs: [], errors: [],
};
const save = () => writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
await save();
const server = await startStaticServer(), browser = await chromium.launch({ headless: true, args: report.protocol.launchArgs });
report.browser = browser.version();
try {
  for (let repeat = 1; repeat <= report.protocol.repeats; repeat++) for (const camera of ['fixed', 'moving']) for (const cache of repeat % 2 ? ['direct', 'cached'] : ['cached', 'direct']) {
    const record = { id: `${camera}-${cache}-${repeat}`, camera, cache, repeat, valid: false, loadBefore: loadavg() };
    report.runs.push(record); await save();
    const context = await browser.newContext({ viewport: report.protocol.viewport, deviceScaleFactor: 2, reducedMotion: 'no-preference', serviceWorkers: 'block' });
    try {
      const page = await context.newPage(), errors = trackPageFailures(page, server.origin);
      if (cache === 'direct') await page.route('**/front-of-house/board.js', route => route.fulfill({ contentType: 'text/javascript', body: directSource }));
      await page.goto(`${server.origin}/front-of-house/`); await page.waitForFunction(() => window.__frontOfHouse);
      assert.equal(await page.evaluate(code => __frontOfHouse.importCode(code), saveCode), true);
      await page.waitForFunction(() => __frontOfHouse.board().spritesReady);
      const loaded = await page.evaluate(() => __frontOfHouse.state()); assert.deepEqual(loaded, state, 'Import preserves exact canonical fixture');
      await page.evaluate(() => __frontOfHouse.boardZoom(2));
      await page.selectOption('#live-speed', '1');
      record.initial = await page.evaluate(() => {
        const root = document.documentElement, board = __frontOfHouse.board(), c = document.querySelector('#board');
        return { board, backing: [c.width, c.height], dpr: devicePixelRatio, pageFit: root.scrollWidth <= root.clientWidth && root.scrollHeight <= root.clientHeight, state: __frontOfHouse.state(), text: JSON.parse(render_game_to_text()) };
      });
      assert.equal(record.initial.pageFit, true); assert.equal(record.initial.board.view.dpr, 1.5); assert.equal(record.initial.board.floorCache.enabled, cache === 'cached');
      await page.screenshot({ path: join(output, `${record.id}-before.png`) });
      await page.click('#live-play');
      if (camera === 'moving') { await page.mouse.move(960, 540); await page.mouse.down({ button: 'middle' }); }
      const raw = await withDeadline(page.evaluate(async ({ warmupMs, measurementMs, camera }) => {
        const frames = [], violations = [], tasks = [];
        const invalid = event => violations.push({ type: event.type, at: performance.now() });
        document.addEventListener('visibilitychange', invalid); window.addEventListener('resize', invalid);
        const supported = PerformanceObserver.supportedEntryTypes.includes('longtask');
        const observer = supported ? new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))) : null;
        observer?.observe({ type: 'longtask' });
        const canvas = document.querySelector('#board');
        let previousCamera = __frontOfHouse.boardCamera(), movedFrames = 0;
        const move = t => {
          if (camera === 'moving') canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 4, button: -1, clientX: 960 + 120 * Math.sin(2 * Math.PI * t / 10000), clientY: 540 + 70 * Math.sin(4 * Math.PI * t / 10000) }));
          const current = __frontOfHouse.boardCamera();
          if (current.x !== previousCamera.x || current.y !== previousCamera.y) movedFrames++;
          previousCamera = current;
        };
        const warm = performance.now();
        await new Promise(resolve => { const frame = t => { move(t - warm); if (t - warm >= warmupMs) resolve(); else requestAnimationFrame(frame); }; requestAnimationFrame(frame); });
        let start, previous, end; movedFrames = 0;
        await new Promise(resolve => { const frame = t => {
          if (start === undefined) { start = previous = t; move(0); requestAnimationFrame(frame); return; }
          frames.push(t - previous); previous = t; move(t - start);
          if (t - start >= measurementMs) { end = t; resolve(); } else requestAnimationFrame(frame);
        }; requestAnimationFrame(frame); });
        await new Promise(resolve => setTimeout(resolve, 0));
        if (observer) { tasks.push(...observer.takeRecords().map(e => ({ start: e.startTime, duration: e.duration }))); observer.disconnect(); }
        document.removeEventListener('visibilitychange', invalid); window.removeEventListener('resize', invalid);
        return { frames, start, end, movedFrames, violations, longTasksSupported: supported, longTasks: tasks.filter(e => e.start < end && e.start + e.duration > start), visibility: document.visibilityState };
      }, { ...report.protocol, camera }), report.protocol.warmupMs + report.protocol.measurementMs + 30000);
      if (camera === 'moving') await page.mouse.up({ button: 'middle' });
      assert.ok(camera === 'moving' ? raw.movedFrames > raw.frames.length * 0.95 : raw.movedFrames === 0, 'Verify real camera motion during the timed window');
      record.final = await page.evaluate(() => ({ state: __frontOfHouse.state(), text: JSON.parse(render_game_to_text()), board: __frontOfHouse.board() }));
      await page.click('#live-play');
      await page.screenshot({ path: join(output, `${record.id}-after.png`) });
      assert.equal(record.final.text.playback.paused, false, 'Clock must still be running at window end');
      assert.ok(record.final.state.show.services.minute - state.show.services.minute >= Math.floor((report.protocol.warmupMs + report.protocol.measurementMs) / 1000));
      assert.deepEqual(raw.violations, []); assert.equal(raw.visibility, 'visible'); assert.deepEqual(errors, []);
      const rawBytes = JSON.stringify(raw); await writeFile(join(output, `${record.id}-raw.json`), rawBytes);
      Object.assign(record, { valid: true, movedFrames: raw.movedFrames, summary: summarize(raw.frames), observedCadenceHz: 1000 * raw.frames.length / (raw.end - raw.start), longTaskCount: raw.longTasks.length, rawSha256: hash(rawBytes), loadAfter: loadavg(), errors });
      console.log(`${record.id}: ${record.observedCadenceHz.toFixed(2)} Hz; ${record.summary.above50} intervals >50ms; minute ${record.final.state.show.services.minute}`);
    } catch (error) { record.error = error.stack; report.errors.push({ id: record.id, message: error.message }); throw error; }
    finally { await context.close(); await save(); }
  }
  report.finishedAt = new Date().toISOString(); await save(); console.log(`Report: ${output}`);
} finally { await browser.close(); await server.close(); }
