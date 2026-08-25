import test from 'node:test';
import assert from 'node:assert/strict';
import { RENDER_CONTRACT, assetId, assetPath, footprintCorners, projectGrid } from './render-contract.mjs';
import { SpriteBitmapCache, rasterizeSprite } from './sprite-canvas.mjs';
import { spriteIds } from './sprites.mjs';

test('the render contract locks the shipped 2:1 board geometry', () => {
  assert.equal(RENDER_CONTRACT.projection, '2:1 dimetric');
  assert.equal(RENDER_CONTRACT.tile.logicalWidth / RENDER_CONTRACT.tile.logicalHeight, 2);
  assert.equal(RENDER_CONTRACT.tile.drawnWidth, 66);
  assert.equal(RENDER_CONTRACT.tile.drawnHeight, 34);
  assert.deepEqual(projectGrid(1, 0), { x: 42, y: 21 });
  assert.deepEqual(projectGrid(0, 1), { x: -42, y: 21 });
});

test('multi-tile footprints remain deterministic in grid space', () => {
  assert.deepEqual(footprintCorners(2, 3, 2, 1), {
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

test('all 13 authored maps rasterize and prime into an ImageBitmap cache seam', async () => {
  const ids = spriteIds();
  assert.equal(ids.length, 13);
  for (const id of ids) {
    const raster = rasterizeSprite(id);
    assert.ok(raster.width > 0 && raster.height > 0, `${id} has dimensions`);
    assert.equal(raster.data.length, raster.width * raster.height * 4, `${id} has RGBA pixels`);
  }

  const cache = new SpriteBitmapCache(async (raster) => ({ id: raster.id }));
  assert.equal(await cache.prime(ids), 13);
  assert.equal(cache.size, 13);
});

test('drawSprite applies tile-centre and feet anchors and retains a fallback', async () => {
  const cache = new SpriteBitmapCache(async (raster) => ({ id: raster.id }));
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
  assert.deepEqual(calls[1].slice(1), [88, 52, 24, 28]);

  let fellBack = false;
  assert.equal(cache.drawSprite(context, 'missing', 0, 0, { fallback: () => { fellBack = true; } }), false);
  assert.equal(fellBack, true);
});
