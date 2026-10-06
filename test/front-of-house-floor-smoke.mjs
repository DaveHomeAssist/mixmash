// Classic floor cache: pixel/picking parity, invalidation, allocation failure and disposal.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';
import { startStaticServer, launchOptions } from './static-server.mjs';
const server = await startStaticServer();
const output = process.env.FRONT_OF_HOUSE_FLOOR_OUTPUT || await mkdtemp(join(tmpdir(), 'foh-floor-'));
await mkdir(output, { recursive: true });
const errors = [];
try {
  for (const type of [chromium, webkit]) {
    // Repeated readback otherwise switches Chromium from GPU to CPU raster midway.
    // Hold rasterization constant for exact pixels; full-client rails use normal contexts.
    const browser = await type.launch(type === chromium ? { ...launchOptions(), args: [...launchOptions().args, '--disable-accelerated-2d-canvas'] } : { headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
      page.on('pageerror', error => errors.push(error.message));
      let releaseSprites;
      const sprites = new Promise(resolve => { releaseSprites = resolve; });
      await page.route('**/sprites/*.png', async route => { await sprites; await route.continue(); });
      await page.route('**/__floor-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><link rel="icon" href="data:,"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{position:absolute;inset:0;width:100%;height:100%}#cached{z-index:1}</style><canvas id="cached"></canvas><canvas id="direct"></canvas>' }));
      await page.goto(`${server.origin}/__floor-test`);
      await page.evaluate(async () => {
        const { createBoard } = await import('/front-of-house/board.js');
        const D = await import('/front-of-house/data.mjs');
        window.factory = createBoard; window.venues = D.VENUES;
        window.boards = [createBoard(document.querySelector('#cached')), createBoard(document.querySelector('#direct'), { cacheFloor: false })];
        window.scene = { objects: structuredClone(D.STARTER_LAYOUT), grid: D.GRID, floor: 'lot', clearSet: new Set(['10,5', '11,5', '12,5', '13,5']), blockedSet: new Set(['10,6', '12,7']), showClear: true, crowd: 150, t: 0 };
        boards.forEach(board => board.resize());
        window.check = () => {
          boards.forEach(board => board.draw(scene));
          const pixels = ['cached', 'direct'].map(id => {
            const c = document.getElementById(id); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          });
          let different = 0, max = 0; const samples = [];
          for (let i = 0; i < pixels[0].length; i++) if (pixels[0][i] !== pixels[1][i]) { different++; max = Math.max(max, Math.abs(pixels[0][i] - pixels[1][i])); if (samples.length < 8) samples.push([i, pixels[0][i], pixels[1][i]]); }
          const diagnostics = boards.map(board => {
            const { floorCache, ...info } = board.info();
            const sample = board.clientOf(12.5, 8.5);
            return { info, tile: board.tileAt(sample.x, sample.y), object: board.objectAt(sample.x, sample.y), placement: board.placeOf(12.5, 8.5) };
          });
          return { different, max, samples, sameDiagnostics: JSON.stringify(diagnostics[0]) === JSON.stringify(diagnostics[1]), cache: boards[0].info().floorCache };
        };
      });
      const check = async label => {
        const result = await page.evaluate(() => check());
        if (result.different) console.log(label, result.samples);
        assert.equal(result.different, 0, `${type.name()} ${label}: ${result.different} channels differ (max ${result.max})`);
        assert.equal(result.sameDiagnostics, true, `${label}: picking/paint diagnostics`);
        return result.cache;
      };
      // Fractional tile capacity must not create extra guests in legacy scenes.
      const counts = await page.evaluate(() => {
        const serialize = () => JSON.stringify({ ...scene, clearSet: [...scene.clearSet], blockedSet: [...scene.blockedSet] });
        const original = serialize();
        const results = [];
        for (const density of [0.5, 0.8, 1, 1.5, 2, 3]) {
          for (const crowd of [0, 1, 2, 3, 149, 150, 151]) {
            boards.forEach(board => board.draw({ ...scene, density, crowd }));
            results.push({ density, crowd, dots: boards.map(board => board.info().crowd.length) });
          }
        }
        boards.forEach(board => board.draw(scene));
        return { results, unchanged: serialize() === original };
      });
      for (const { density, crowd, dots } of counts.results) {
        assert.deepEqual(dots, [crowd, crowd], `${type.name()} density ${density}: ${crowd} guests`);
      }
      assert.equal(counts.unchanged, true, 'crowd projection preserves scene input');
      const boxes = await check('pending sprites');
      assert.equal(await page.evaluate(() => boards[0].info().spritesReady), false);
      releaseSprites();
      await page.waitForFunction(() => boards.every(board => board.info().spritesReady));
      const ready = await check('loaded sprites');
      assert.equal(ready.builds, boxes.builds + 1);
      const repeated = await check('repeat'); assert.equal(repeated.builds, ready.builds); assert.equal(repeated.hits, ready.hits + 1);
      for (const id of ['lot', 'club', 'amphitheater', 'festival']) {
        await page.evaluate(id => { const v = venues[id]; scene = { ...scene, floor: id, grid: v.grid, pillars: v.pillars, objects: structuredClone(v.starter) }; }, id);
        for (let facing = 0; facing < 4; facing++) {
          await check(`${id} facing ${facing}`);
          await page.evaluate(() => { boards.forEach(board => board.turnView()); });
        }
      }
      for (const change of ['zoom', 'pan', 'safe', 'layout', 'food', 'pillar', 'clear', 'blocked', 'overlay']) {
        const before = await page.evaluate(() => boards[0].info().floorCache.builds);
        await page.evaluate(change => {
          if (change === 'zoom') boards.forEach(board => board.zoomTo(2));
          if (change === 'pan') boards.forEach(board => board.panBy(30, 20));
          if (change === 'safe') boards.forEach(board => { board.setClear({ x: 120, y: 100, w: 800, h: 600 }); board.resize(); });
          if (change === 'layout') scene.objects = scene.objects.filter(o => o.type !== 'fence');
          if (change === 'food') scene.objects.push({ type: 'food', x: 10, y: 10, rot: 0 });
          if (change === 'pillar') scene.pillars = [[9, 9]];
          if (change === 'clear') scene.clearSet.add('9,9');
          if (change === 'blocked') scene.blockedSet.add('10,9');
          if (change === 'overlay') scene.showClear = false;
        }, change);
        assert.ok((await check(change)).builds > before, `${change} invalidates`);
      }
      const stable = await page.evaluate(() => boards[0].info().floorCache.builds);
      for (const incident of ['rain', 'pa-dropout', 'gate-jam']) {
        await page.evaluate(incident => { scene = { ...scene, incident, night: true, lightTower: true, t: 1.25, crowd: 65, selection: scene.objects[0], cursor: { x: 10, y: 10 }, ghost: { type: 'bar', x: 8, y: 8, rot: 0, valid: true } }; }, incident);
        assert.equal((await check(incident)).builds, stable, 'dynamic inputs reuse the floor');
      }
      for (const viewport of [{ width: 1920, height: 1080 }, { width: 375, height: 812 }, { width: 2560, height: 720 }]) {
        await page.setViewportSize(viewport); await page.evaluate(() => boards.forEach(board => { board.setClear(null); board.resize(); }));
        const cache = await check(`resize ${viewport.width}`);
        const expectedDpr = viewport.width * viewport.height * 4 > 6e6 ? 1.5 : 2;
        assert.equal(cache.width, Math.round(viewport.width * expectedDpr)); assert.equal(cache.height, Math.round(viewport.height * expectedDpr));
      }
      await page.screenshot({ path: join(output, `${type.name()}-cached.png`) });
      const lifecycle = await page.evaluate(() => {
        boards[0].destroy(); const disposed = boards[0].info().floorCache;
        boards[1].destroy();
        boards[0] = factory(document.querySelector('#cached'));
        boards[1] = factory(document.querySelector('#direct'), { cacheFloor: false });
        boards.forEach(board => board.resize());
        const original = document.createElement;
        document.createElement = function (tag, ...args) { const element = original.call(this, tag, ...args); if (tag === 'canvas') element.getContext = () => null; return element; };
        let fallback;
        try { fallback = check(); } finally { document.createElement = original; }
        boards.forEach(board => board.destroy());
        return { disposed, fallback };
      });
      assert.equal(lifecycle.disposed.width, 0); assert.equal(lifecycle.disposed.height, 0);
      assert.equal(lifecycle.fallback.cache.failed, true); assert.equal(lifecycle.fallback.different, 0);
      console.log(`${type.name()}: exact cached/direct pixels, invalidation, dynamic reuse, DPR, fallback and disposal passed`);
    } finally { await browser.close(); }
  }
  assert.deepEqual(errors, []); console.log(`Screenshots: ${output}`);
} finally { await server.close(); }
