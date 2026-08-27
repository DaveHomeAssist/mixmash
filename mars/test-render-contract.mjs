import test from 'node:test';
import assert from 'node:assert/strict';
import { RENDER_CONTRACT, assetId, assetPath, footprintCorners, footprintCornersFromCenter, projectGrid } from './render-contract.mjs';
import { SpriteBitmapCache, rasterizeSprite } from './sprite-canvas.mjs';
import { spriteIds } from './sprites.mjs';

test('the render contract locks the shipped 2:1 board geometry', () => {
  assert.equal(RENDER_CONTRACT.version, 3);
  assert.equal(RENDER_CONTRACT.decision, 'DEC-79');
  assert.equal(RENDER_CONTRACT.projection, '2:1 dimetric');
  assert.equal(RENDER_CONTRACT.tile.logicalWidth / RENDER_CONTRACT.tile.logicalHeight, 2);
  assert.equal(RENDER_CONTRACT.tile.drawnWidth, 66);
  assert.equal(RENDER_CONTRACT.tile.drawnHeight, 34);
  assert.deepEqual(projectGrid(1, 0), { x: 42, y: 21 });
  assert.deepEqual(projectGrid(0, 1), { x: -42, y: 21 });
});

test('every commissioned class has executable placement, lighting, and performance values', () => {
  for (const [name, spriteClass] of Object.entries(RENDER_CONTRACT.spriteClasses)) {
    assert.equal(Number.isFinite(spriteClass.screenOffsetX), true, `${name} has a horizontal ground offset`);
    assert.equal(Number.isFinite(spriteClass.screenOffsetY), true, `${name} has a vertical ground offset`);
  }
  assert.deepEqual(Object.keys(RENDER_CONTRACT.light.profiles), ['dawn', 'daylight', 'storm', 'night']);
  assert.equal(RENDER_CONTRACT.light.profiles.storm.outline, RENDER_CONTRACT.palette.parchment);
  assert.equal(RENDER_CONTRACT.performance.sampleFrames, 300);
  assert.equal(RENDER_CONTRACT.performance.p95FrameMs, 20);
});

test('multi-tile footprints remain deterministic in grid space', () => {
  assert.deepEqual(footprintCorners(2, 3, 2, 1), {
    north: { x: -42, y: 105 },
    east: { x: 42, y: 147 },
    south: { x: 0, y: 168 },
    west: { x: -84, y: 126 },
  });
  assert.deepEqual(footprintCornersFromCenter(3, 3.5, 2, 1), {
    north: { x: -42, y: 105 },
    east: { x: 42, y: 147 },
    south: { x: 0, y: 168 },
    west: { x: -84, y: 126 },
  });
});

test('manifest ids and filenames follow the locked naming contract', () => {
  assert.equal(assetId('building', 'solar_array', 'faulted', 2), 'sprite:building:solar_array:faulted:02');
  assert.equal(assetPath('building', 'solar_array', 'faulted', 2), 'sprites/building/solar_array__faulted__f02.png');
});

test('all 33 authored maps rasterize and prime into an ImageBitmap cache seam', async () => {
  const ids = spriteIds();
  assert.equal(ids.length, 33);
  for (const id of ids) {
    const raster = rasterizeSprite(id);
    assert.ok(raster.width > 0 && raster.height > 0, `${id} has dimensions`);
    assert.equal(raster.data.length, raster.width * raster.height * 4, `${id} has RGBA pixels`);
  }

  const cache = new SpriteBitmapCache(async (raster) => ({ id: raster.id }));
  assert.equal(await cache.prime(ids), 33);
  assert.equal(cache.size, 33);
});

test('drawSprite applies tile-centre and feet anchors and retains a fallback', async () => {
  const warnings = [];
  const cache = new SpriteBitmapCache(async (raster) => ({ id: raster.id }), { onWarning: (warning) => warnings.push(warning) });
  await cache.prime(['iron_ore', 'astro']);
  const calls = [];
  const context = {
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    save() {},
    restore() {},
    drawImage(...args) { calls.push(args); },
  };

  assert.equal(cache.drawSprite(context, 'iron_ore', 100, 80, { scale: 2 }), true);
  assert.deepEqual(calls[0].slice(1), [88, 70, 24, 20]);
  assert.equal(cache.drawSprite(context, 'astro', 100, 80, { scale: 2, anchor: 'feet' }), true);
  assert.deepEqual(calls[1].slice(1), [88, 44, 24, 36]);

  let fellBack = false;
  assert.equal(cache.drawSprite(context, 'missing', 0, 0, { fallback: () => { fellBack = true; } }), false);
  assert.equal(fellBack, true);
  assert.deepEqual(warnings.map((warning) => warning.code), ['SPRITE_MISSING']);
  cache.drawSprite(context, 'missing', 0, 0);
  assert.equal(warnings.length, 1, 'missing sprites warn once instead of flooding the console');
});

test('slow decode warns without bypassing the cached ImageBitmap path', async () => {
  const warnings = [];
  const cache = new SpriteBitmapCache(async (raster) => ({ id: raster.id }), {
    slowDecodeMs: -1,
    onWarning: (warning) => warnings.push(warning),
  });
  assert.equal(await cache.primeOne('astro'), true);
  assert.equal(cache.has('astro'), true);
  assert.equal(cache.size, 1);
  assert.deepEqual(warnings.map((warning) => warning.code), ['SPRITE_SLOW_DECODE']);
});
