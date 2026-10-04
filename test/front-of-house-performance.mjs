// Reproducible renderer-only diagnostics. Raw samples stay in a caller-owned private output directory.
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile, mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir, platform, arch, release, totalmem, cpus, loadavg } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer, launchOptions } from './static-server.mjs';
import { summarize, withDeadline } from '../front-of-house/tools/performance-stats.mjs';
import { createGame, applyAction, showPreview, venueSpec, sightlineTiles } from '../front-of-house/engine.mjs';
import { STARTER_LAYOUT, FLOOR_DENSITY } from '../front-of-house/data.mjs';

const args = process.argv.slice(2), quick = args.includes('--quick'), gpu = args.includes('--gpu=metal') ? 'metal' : args.includes('--gpu=default') ? 'default' : 'software';
for (const arg of args) if (!['--quick', '--gpu=default', '--gpu=software', '--gpu=metal', '--dpr=2', '--large-viewports', '--native-chrome'].includes(arg)) throw new Error(`Unknown argument: ${arg}`);
const nativeChrome = args.includes('--native-chrome');
if (nativeChrome && (args.includes('--dpr=2') || args.includes('--large-viewports'))) throw new Error('Native Chrome uses the actual display density and available desktop size');
const requestedDpr = args.includes('--dpr=2') ? 2 : 1;
const viewports = nativeChrome ? [null] : args.includes('--large-viewports') ? [[1920, 1080], [375, 812], [5120, 1440]] : [[1440, 900], [375, 812], [2560, 720]];
const output = process.env.FRONT_OF_HOUSE_PERF_OUTPUT || await mkdtemp(join(tmpdir(), 'foh-performance-'));
await mkdir(output, { recursive: true });
if ((await readdir(output)).length) throw new Error('Output directory must be empty; choose a new directory to preserve previous attempts');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const command = (name, args) => { try { return execFileSync(name, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return 'unknown'; } };
const actions = [{ type: 'chooseDeal', deal: 'door', artistId: 'sodium-arcade' }];
const step = (s, a) => { const r = applyAction(s, a); assert.equal(r.error, null); return r.state; };
const empty = step(createGame(170), actions[0]);
const showActions = [...actions, { type: 'setLayout', objects: STARTER_LAYOUT }, { type: 'confirmBuild' }, { type: 'setPromotion', price: 20, ads: { flyers: 0, social: 150, radio: 150 } }, { type: 'confirmPromotion' }];
const crowded = showActions.reduce(step, createGame(170));
function fixture(state, actions) {
  const spec = venueSpec(state.venue), sight = sightlineTiles(state.venue), night = state.phase === 'show';
  return { state, actions, scene: { objects: state.venue.objects, grid: state.venue.grid, floor: state.venue.id, pillars: spec.pillars, density: spec.density || FLOOR_DENSITY, clearSet: [...sight.clear], blockedSet: [...sight.blocked], showClear: false, cursor: null, ghost: null, selection: null, crowd: night ? showPreview(state).attendance : 0, incident: night ? state.show.incidentId : null, night, lightTower: state.venue.objects.some(o => o.type === 'lights'), t: 0 } };
}
const fixtures = { empty: fixture(empty, actions), crowd: fixture(crowded, showActions) };
assert.equal(fixtures.crowd.scene.crowd, 150, 'Changed engine fixture requires explicit baseline review');
assert.equal(fixtures.crowd.scene.incident, 'pa-dropout');
const sources = {};
for (const path of ['package-lock.json', 'front-of-house/lot-assets.json', 'front-of-house/engine.mjs', 'front-of-house/data.mjs', 'front-of-house/lot-camera.mjs', 'front-of-house/lot-models.mjs', 'front-of-house/lot-renderer.mjs', 'front-of-house/lot-presentation.mjs', 'front-of-house/tools/performance-stats.mjs', 'test/front-of-house-performance.mjs']) sources[path] = hash(await readFile(new URL(`../${path}`, import.meta.url)));
const options = gpu === 'software' ? launchOptions() : { headless: true, args: gpu === 'metal' ? ['--use-angle=metal'] : [] };
if (nativeChrome) Object.assign(options, { headless: false, channel: 'chrome' });
const report = {
  mode: quick ? 'harness validation only' : 'renderer diagnostic baseline', startedAt: new Date().toISOString(),
  source: { commit: command('git', ['rev-parse', 'HEAD']), dirty: command('git', ['status', '--porcelain']).length > 0, sha256: sources },
  ci: process.env.GITHUB_ACTIONS === 'true' ? { provider: 'github-actions', runnerClass: process.env.FOH_PERF_RUNNER_CLASS || 'unknown', os: process.env.RUNNER_OS || 'unknown', architecture: process.env.RUNNER_ARCH || 'unknown', image: process.env.ImageOS || 'unknown', imageVersion: process.env.ImageVersion || 'unknown', runId: process.env.GITHUB_RUN_ID || 'unknown', attempt: process.env.GITHUB_RUN_ATTEMPT || 'unknown' } : null,
  host: { platform: platform(), architecture: arch(), kernel: release(), model: platform() === 'darwin' ? command('sysctl', ['-n', 'hw.model']) : 'unknown', cpu: cpus()[0]?.model || 'unknown', cpuCount: cpus().length, memoryBytes: totalmem(), osVersion: platform() === 'darwin' ? command('sw_vers', ['-productVersion']) : 'unknown', osBuild: platform() === 'darwin' ? command('sw_vers', ['-buildVersion']) : 'unknown', power: platform() === 'darwin' ? command('pmset', ['-g', 'batt']).split('\n')[0] : 'unknown', lowPower: platform() === 'darwin' ? command('pmset', ['-g', 'custom']).split('\n').filter(s => s.includes('lowpowermode')).map(s => s.trim()) : 'unknown', displayRefresh: 'unknown', thermal: 'unknown', otherHostLoad: 'uncontrolled; load averages recorded per run' },
  protocol: { layer: 'isolated renderer; excludes full game and HUD', warmupMs: quick ? 1000 : 10000, measurementMs: quick ? 2000 : 30000, repeats: quick ? 1 : 3, requestedDpr: nativeChrome ? 'native' : requestedDpr, viewports, headless: !nativeChrome, requestedBackend: gpu, launchArgs: options.args || [], reducedMotion: 'no-preference', shadows: '1024 PCFSoft', antialias: true, adaptiveQuality: false, gpuTimestampMs: 'unavailable', acceptance: 'descriptive only; no device or statistical pass limits inferred' },
  fixtureSha256: {}, runs: [], errors: [],
};
for (const [name, value] of Object.entries(fixtures)) { const bytes = JSON.stringify(value); report.fixtureSha256[name] = hash(bytes); await writeFile(join(output, `${name}-fixture.json`), bytes); }
const save = () => writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
await save();
const server = await startStaticServer();
let browser;
try {
  browser = await chromium.launch(options); report.browser = browser.version();
  for (const viewport of viewports) for (const [sceneName, input] of Object.entries(fixtures)) for (let repeat = 1; repeat <= report.protocol.repeats; repeat++) {
    const id = `${viewport ? viewport.join('x') : 'native'}-${sceneName}-${repeat}`, record = { id, viewport: viewport ? { width: viewport[0], height: viewport[1] } : null, sceneName, repeat, loadBefore: loadavg(), valid: false };
    report.runs.push(record); await save();
    const context = await browser.newContext({ ...(nativeChrome ? { viewport: null } : { viewport: { width: viewport[0], height: viewport[1] }, deviceScaleFactor: requestedDpr }), reducedMotion: 'no-preference', serviceWorkers: 'block' }), page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    try {
      await page.route('**/__lot-performance', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><link rel="icon" href="data:,"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block;width:100%;height:100%}</style></head><body><canvas></canvas></body></html>' }));
      const coldStart = performance.now(); await page.goto(`${server.origin}/__lot-performance`);
      if (nativeChrome) {
        const session = await context.newCDPSession(page), { windowId } = await session.send('Browser.getWindowForTarget');
        const available = await page.evaluate(() => ({ left: screen.availLeft, top: screen.availTop, width: screen.availWidth, height: screen.availHeight }));
        await session.send('Browser.setWindowBounds', { windowId, bounds: { ...available, windowState: 'normal' } });
        await page.bringToFront(); await page.waitForFunction(() => document.hasFocus()); await page.waitForTimeout(500);
        record.nativeWindow = await page.evaluate(() => ({ viewport: { width: innerWidth, height: innerHeight }, outer: { width: outerWidth, height: outerHeight }, screen: { width: screen.width, height: screen.height, availWidth: screen.availWidth, availHeight: screen.availHeight }, dpr: devicePixelRatio, focused: document.hasFocus(), visibility: document.visibilityState }));
        record.viewport = record.nativeWindow.viewport;
      }
      record.environment = await page.evaluate(async scene => {
        const { createLotRenderer } = await import('/front-of-house/lot-renderer.mjs');
        window.cameraAt = (await import('/front-of-house/tools/performance-stats.mjs')).cameraAt;
        window.canvas = document.querySelector('canvas'); window.backend = createLotRenderer(canvas); window.input = scene;
        backend.draw(scene); backend.preset('wide');
        const gl = canvas.getContext('webgl2'), debug = gl.getExtension('WEBGL_debug_renderer_info'), renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        return { browserDpr: devicePixelRatio, effectiveDpr: backend.info().dpr, backing: { width: canvas.width, height: canvas.height }, renderer, vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), graphics: /swiftshader|llvmpipe|software/i.test(renderer) ? 'software' : /ANGLE Metal Renderer: Apple/.test(renderer) ? 'Apple hardware via Metal' : 'unverified hardware backend', visibility: document.visibilityState, quality: backend.info(), gpuTimersAvailable: !!gl.getExtension('EXT_disjoint_timer_query_webgl2') };
      }, input.scene);
      record.coldLoadMs = performance.now() - coldStart;
      // Screenshots and diagnostics are outside the warm-up / timed sample window.
      await page.screenshot({ path: join(output, `${id}.png`) });
      const raw = await withDeadline(page.evaluate(async ({ warmupMs, measurementMs, headless }) => {
        const violations = [], tasks = [], frames = [], submissions = [], before = JSON.stringify(input);
        const invalid = event => violations.push({ type: event.type, at: performance.now() });
        document.addEventListener('visibilitychange', invalid); window.addEventListener('resize', invalid); if (!headless) window.addEventListener('blur', invalid); canvas.addEventListener('webglcontextlost', invalid);
        let observer = null;
        const longTasksSupported = PerformanceObserver.supportedEntryTypes.includes('longtask');
        if (longTasksSupported) { observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))); observer.observe({ type: 'longtask' }); }
        const update = seconds => { backend.pause(); backend.setCamera(cameraAt(seconds)); backend.draw({ ...input, t: seconds }); backend.resume(); };
        const warmStart = performance.now();
        await new Promise(resolve => { function warm(t) { update(((t - warmStart) / 1000) % 30); if (t - warmStart >= warmupMs) resolve(); else requestAnimationFrame(warm); } requestAnimationFrame(warm); });
        backend.setCamera(cameraAt(0));
        let start = null, previous = null, end = null;
        await new Promise(resolve => { function frame(t) {
          if (start === null) { start = t; previous = t; update(0); requestAnimationFrame(frame); return; }
          frames.push(t - previous); previous = t;
          const cpuStart = performance.now(); update((t - start) / 1000); submissions.push(performance.now() - cpuStart);
          if (t - start >= measurementMs) { end = t; resolve(); } else requestAnimationFrame(frame);
        } requestAnimationFrame(frame); });
        await new Promise(resolve => setTimeout(resolve, 0));
        if (observer) { tasks.push(...observer.takeRecords().map(e => ({ start: e.startTime, duration: e.duration }))); observer.disconnect(); }
        document.removeEventListener('visibilitychange', invalid); window.removeEventListener('resize', invalid); if (!headless) window.removeEventListener('blur', invalid); canvas.removeEventListener('webglcontextlost', invalid);
        const unchanged = before === JSON.stringify(input), status = backend.status(), quality = backend.info();
        return { start, end, frames, submissions, longTasksSupported, longTasks: tasks.filter(e => e.start < end && e.start + e.duration > start), violations, unchanged, status, quality, finalVisibility: document.visibilityState, finalFocus: document.hasFocus() };
      }, report.protocol), report.protocol.warmupMs + report.protocol.measurementMs + 60000);
      await writeFile(join(output, `${id}-raw.json`), JSON.stringify(raw));
      record.rawSha256 = hash(JSON.stringify(raw)); record.frame = summarize(raw.frames); record.cpuSubmission = summarize(raw.submissions);
      record.cadenceFps = 1000 / record.frame.meanMs; record.elapsedMs = raw.end - raw.start;
      record.longTasks = raw.longTasksSupported ? { count: raw.longTasks.length, fullDurationMs: raw.longTasks.reduce((sum, t) => sum + t.duration, 0) } : 'unavailable';
      record.violations = raw.violations; record.finalQuality = raw.quality;
      record.valid = !errors.length && !raw.violations.length && raw.unchanged && raw.status.state === 'ready' && raw.finalVisibility === 'visible' && (report.protocol.headless || raw.finalFocus) && raw.end - raw.start >= report.protocol.measurementMs;
      if (!record.valid) record.failure = 'Invalid timing window, renderer/state failure or browser error; raw samples retained';
      await page.evaluate(() => backend.destroy());
    } catch (error) { record.failure = error.message; if (!record.rawSha256) record.rawUnavailable = 'Timing window did not complete; no complete raw sample returned'; }
    finally { record.errors = errors; record.loadAfter = loadavg(); await context.close(); await save(); }
    console.log(JSON.stringify({ id, valid: record.valid, fps: record.cadenceFps, frameP95: record.frame?.p95Ms, cpuP95: record.cpuSubmission?.p95Ms, failure: record.failure }));
  }
} catch (error) { report.errors.push(error.message); throw error; }
finally {
  try { await browser?.close(); } finally { await server.close(); report.finishedAt = new Date().toISOString(); await save(); }
}
assert.ok(report.runs.every(r => r.valid), 'Invalid runs retained in report; investigate before interpreting results');
console.log(`Saved ${report.runs.length} ${report.mode} runs to ${output}`);
