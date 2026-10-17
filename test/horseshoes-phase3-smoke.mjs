// Production smoke for solo AI, replay isolation, audio and responsive controls.
import { createRequire } from 'node:module';
import { startStaticServer } from './static-server.mjs';
const require = createRequire(import.meta.url);
const server = process.env.HORSESHOES_BASE_URL ? null : await startStaticServer();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const url = process.env.HORSESHOES_BASE_URL || `${server.origin}/horseshoes/`;
const output = process.env.HORSESHOES_OUTPUT || '/tmp/horseshoes-phase3-smoke';
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const results = [];
  try {
    for (const [width, height, touch] of [[1440,900,false],[375,812,true],[667,375,true],[3440,1440,false]]) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
      await context.addInitScript(() => {
        const NativeAudio = window.AudioContext;
        window.AudioContext = class extends NativeAudio {
          constructor(...args) { super(...args); window.__audioTestContext = this; }
          createAnalyser() { const node = super.createAnalyser(); this.__testAnalyser = node; return node; }
        };
        window.__startAudioCapture = () => {
          const ctx = window.__audioTestContext, destination = ctx.createMediaStreamDestination();
          ctx.__testAnalyser.connect(destination);
          const recorder = new MediaRecorder(destination.stream), chunks = [];
          recorder.ondataavailable = e => chunks.push(e.data);
          window.__finishAudioCapture = () => new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Audio capture timed out')), 15000);
            recorder.onerror = e => { clearTimeout(timeout); reject(e.error); };
            recorder.onstop = async () => {
              try {
              const buffer = await ctx.decodeAudioData(await new Blob(chunks).arrayBuffer());
              let sum = 0, count = 0;
              for (let c = 0; c < buffer.numberOfChannels; c++) for (const x of buffer.getChannelData(c)) { sum += x * x; count++; }
              ctx.__testAnalyser.disconnect(destination); destination.stream.getTracks().forEach(t => t.stop());
              clearTimeout(timeout); resolve(Math.sqrt(sum / count));
              } catch (error) { clearTimeout(timeout); reject(error); }
            };
            recorder.stop();
          });
          recorder.start();
        };
      });
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__horseshoes);
      await page.locator('#menu-resume').click();
      const state = () => page.evaluate(() => __horseshoes.getState());
      const press = async (selector) => {
        const open = await page.locator('#game-menu').evaluate(d => d.open);
        if (selector === '#settings-tab' && open) return;
        if (open && !await page.locator(selector).evaluate(e => !!e.closest('#game-menu'))) await page.locator('#menu-resume').click();
        if (selector.startsWith('[data-preset')) await page.locator('.menu-help').evaluate(e => e.open = true);
        await (touch ? page.locator(selector).tap() : page.locator(selector).click());
      };
      const range = async (id, value) => { await page.locator(id).fill(String(value)); await page.locator(id).dispatchEvent('input'); };
      const advance = (ms = 13000) => page.evaluate((ms) => advanceTime(ms), ms);
      for (const panel of ['play','settings','score']) {
        await press(`#${panel}-tab`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth));
      }
      await press('#settings-tab'); await press('#sound-button');
      await range('#volume', 35); assert.equal((await state()).audio.volume, 0.35);
      // Record actual output off the main thread so a slow raster cannot miss a short impact.
      await page.evaluate(() => __startAudioCapture());
      await press('#play-tab'); await press('#throw-button');
      // Natural-time throw exercises real audio scheduling and rest detection.
      let energy = 0;
      for (let i = 0; i < 100; i++) {
        await page.waitForTimeout(50); const s = await state(); energy = Math.max(energy, s.audio.energy);
        if (s.shoe.status === 'resting') break;
      }
      assert.equal((await state()).shoe.status, 'resting');
      energy = await page.evaluate(() => __finishAudioCapture());
      assert.ok((await state()).audio.played > 0); assert.ok(energy > 0);
      await page.evaluate(() => __horseshoes.stop());
      const stable = await state();
      await press('#replay-last'); await advance(500);
      assert.equal((await state()).replay.active, true);
      assert.deepEqual((await state()).match, stable.match);
      assert.deepEqual((await state()).shoes, stable.shoes);
      await page.locator('#replay-pause').focus(); await page.keyboard.press('Enter');
      const paused = (await state()).replay.time; await advance(500); assert.equal((await state()).replay.time, paused);
      await range('#replay-position', 70); assert.equal((await state()).replay.paused, true);
      await page.screenshot({ path: `${output}/${width}-replay.png` });
      await press('#replay-exit');
      assert.deepEqual((await state()).match, stable.match); assert.deepEqual((await state()).shoes, stable.shoes);
      await press('#replay-best'); await advance(14000); assert.equal((await state()).replay.paused, true); await press('#replay-exit');
      await press('#settings-tab'); await press('#sound-button'); await page.waitForTimeout(500);
      assert.equal((await state()).audio.enabled, false); assert.ok((await state()).audio.energy < 0.0001);
      await page.locator('#mode').selectOption('solo'); await page.locator('#restart-button').click();
      await range('#strength', 0); // Range remains in hidden play panel; next actions use visible controls.
      const difficulty = width === 375 ? 'easy' : 'normal';
      await press('#settings-tab'); await page.locator('#difficulty').selectOption(difficulty); await page.locator('#restart-button').click();
      await page.evaluate(() => { window.__testFrames = 0; const tick = () => { window.__testFrames++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      let attempts = 0, searches = [], throws = 0;
      while ((await state()).match.phase !== 'complete' && attempts++ < 180) {
        const s = await state(); assert.equal(s.ai.error, '');
        if (s.match.phase === 'inning') { await press('#next-button'); continue; }
        if (s.match.phase === 'ready' && s.match.player === 0) { await press('#throw-button'); throws++; }
        await advance();
        if ((await state()).ai.busy) {
          const frames = await page.evaluate(() => window.__testFrames);
          await page.waitForFunction(() => !__horseshoes.getState().ai.busy, { timeout: 20000 });
          assert.ok(await page.evaluate((f) => window.__testFrames > f, frames));
          const ai = (await state()).ai; assert.equal(ai.error, ''); searches.push(ai.metrics.milliseconds);
          assert.equal(ai.metrics.candidates, difficulty === 'easy' ? 6 : 12);
          throws++;
        }
      }
      const complete = await state(); assert.equal(complete.match.phase, 'complete'); assert.equal(complete.match.winner, 1);
      assert.ok(complete.match.scores[1] >= 21); assert.ok(searches.length >= 2);
      assert.match(await page.locator('#flight-readout').textContent(), /restart from Menu/);
      await page.screenshot({ path: `${output}/${width}-solo-complete.png` });
      await press('#settings-tab'); await press('#restart-button');
      assert.equal((await state()).replay.available, false); assert.deepEqual((await state()).match.scores, [0,0]);
      // Cancel in-flight search, then ensure no stale response throws into the new match.
      for (let i = 0; i < 2; i++) { await press('#throw-button'); await advance(); }
      assert.equal((await state()).ai.busy, true);
      await press('#settings-tab'); await press('#restart-button'); await page.waitForTimeout(1200);
      assert.equal((await state()).match.delivered, 0); assert.equal((await state()).ai.busy, false);
      assert.deepEqual(errors, []);
      results.push({ width, height, difficulty, throws, innings: complete.match.inning, score: complete.match.scores, searchMaxMs: Math.max(...searches), audioEnergy: energy, errors });
      await context.close();
    }
    // Optional-browser capability failure must not break local gameplay.
    const limited = await browser.newContext();
    await limited.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
    const p = await limited.newPage();
    await p.goto(url); await p.waitForFunction(() => window.__horseshoes);
     await p.locator('#sound-button').click();
    assert.equal(await p.evaluate(() => __horseshoes.getState().audio.unavailable), true);
    await p.locator('#menu-resume').click(); await p.locator('#throw-button').click();
    await p.evaluate(() => advanceTime(13000));
    assert.equal(await p.evaluate(() => __horseshoes.getState().match.delivered), 1);
    await limited.close();
    fs.writeFileSync(`${output}/report.json`, JSON.stringify({ url, results }, null, 2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); await server?.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
