import test from 'node:test';
import assert from 'node:assert/strict';
import { RENDER_CONTRACT, assetPath } from './render-contract.mjs';
import {
  COMMISSIONED_INDEX_VERSION,
  COMMISSIONED_WARNING_CODES,
  CommissionedArtCache,
  commissionedAssetKey,
} from './commissioned-art.mjs';

function framePaths(family, id, state, count) {
  return Array.from({ length: count }, (_, index) => assetPath(family, id, state, index + 1));
}

function clip(state, options = {}) {
  const declaredFrames = options.declaredFrames ?? options.frames ?? 1;
  const availableFrames = options.availableFrames ?? declaredFrames;
  return [state, {
    declaredFrames,
    frameMs: options.frameMs ?? 600,
    loop: options.loop ?? true,
    frames: options.paths || framePaths(options.family || 'building', options.id || 'habitat', state, availableFrames),
  }];
}

function indexFixture(options = {}) {
  const family = options.family || 'building';
  const id = options.id || 'habitat';
  const className = options.className || 'building';
  const spriteClass = RENDER_CONTRACT.spriteClasses[className];
  const states = options.states || Object.fromEntries([
    clip('active', { family, id }),
  ]);
  return {
    version: COMMISSIONED_INDEX_VERSION,
    contractVersion: RENDER_CONTRACT.version,
    decision: RENDER_CONTRACT.decision,
    assets: [{
      family,
      id,
      class: className,
      anchor: {
        type: spriteClass.anchor,
        x: spriteClass.anchorX ?? 0.5,
        y: spriteClass.anchorY ?? (spriteClass.anchor === 'feet' ? 1 : 0.5),
      },
      screenOffset: { x: spriteClass.screenOffsetX ?? 0, y: spriteClass.screenOffsetY ?? 0 },
      canvas: { width: spriteClass.canvasWidth, height: spriteClass.canvasHeight, scale: spriteClass.scale },
      states,
      ...(options.asset || {}),
    }],
  };
}

function bitmapFor(className = 'building', overrides = {}) {
  const spriteClass = RENDER_CONTRACT.spriteClasses[className];
  return {
    width: spriteClass.canvasWidth,
    height: spriteClass.canvasHeight,
    ...overrides,
  };
}

function pngResponse(blob = { kind: 'png-blob' }) {
  return {
    ok: true,
    status: 200,
    async blob() { return blob; },
  };
}

function warningCollector() {
  const warnings = [];
  return { warnings, onWarning: (warning) => warnings.push(warning) };
}

test('an injected v1 index resolves canonical ids, contract geometry, and state fallbacks', async () => {
  const collected = warningCollector();
  const cache = new CommissionedArtCache({
    fetchImpl: async () => pngResponse(),
    bitmapFactory: async () => bitmapFor(),
    onWarning: collected.onWarning,
    prefersReducedMotion: () => false,
  });
  const index = indexFixture({ asset: { screenOffset: { x: 2, y: 19 } } });
  const info = await cache.loadIndex(index, { baseUrl: 'https://assets.test/mars/assets/commissioned/' });

  assert.equal(commissionedAssetKey('building', 'habitat'), 'building/habitat');
  assert.deepEqual(info, {
    assets: 1,
    states: 1,
    frames: 1,
    declaredFrames: 1,
    baseUrl: 'https://assets.test/mars/assets/commissioned/',
  });
  assert.equal(cache.has('building', 'habitat'), true);
  assert.equal(cache.has('building', 'habitat', 'damaged'), false);

  const frame = cache.resolveFrame('building', 'habitat', { state: 'damaged', elapsedMs: 999 });
  assert.equal(frame.requestedState, 'damaged');
  assert.equal(frame.state, 'active');
  assert.equal(frame.usedStateFallback, true);
  assert.equal(frame.frame, 1);
  assert.equal(frame.url, 'https://assets.test/mars/assets/commissioned/sprites/building/habitat__active__f01.png');
  assert.deepEqual(frame.anchor, {
    type: RENDER_CONTRACT.spriteClasses.building.anchor,
    x: RENDER_CONTRACT.spriteClasses.building.anchorX ?? 0.5,
    y: RENDER_CONTRACT.spriteClasses.building.anchorY ?? 1,
    screenOffsetX: 2,
    screenOffsetY: 19,
  });
  assert.equal(frame.scale, RENDER_CONTRACT.spriteClasses.building.scale);
  assert.equal(frame.sourceWidth, RENDER_CONTRACT.spriteClasses.building.canvasWidth);
  assert.equal(frame.sourceHeight, RENDER_CONTRACT.spriteClasses.building.canvasHeight);
  assert.deepEqual(collected.warnings.map((warning) => warning.code), [COMMISSIONED_WARNING_CODES.stateFallback]);
  assert.equal(cache.getTelemetry().stateFallbacks, 1);
  assert.throws(() => commissionedAssetKey('Building', 'habitat'), /lowercase snake_case/);
  assert.throws(() => cache.resolveFrame('building', 'habitat', { state: 'faulted' }), /Unknown commissioned-art state/);
});

test('a fetched index derives relative frame URLs from the index location', async () => {
  const urls = [];
  const index = indexFixture();
  const cache = new CommissionedArtCache({
    fetchImpl: async (url) => {
      urls.push(url);
      return { ok: true, status: 200, async json() { return index; } };
    },
    bitmapFactory: async () => bitmapFor(),
    onWarning() {},
  });

  await cache.loadIndex('https://cdn.test/mars/assets/commissioned/index.json');
  const frame = cache.resolveFrame('building', 'habitat', { elapsedMs: 0 });
  assert.deepEqual(urls, ['https://cdn.test/mars/assets/commissioned/index.json']);
  assert.equal(frame.url, 'https://cdn.test/mars/assets/commissioned/sprites/building/habitat__active__f01.png');
});

test('animation selection loops, clamps, and honors reduced motion with frame 01', async () => {
  const active = clip('active', { frames: 4, frameMs: 150 });
  const damaged = clip('damaged', { frames: 3, frameMs: 200, loop: false });
  const cache = new CommissionedArtCache({ onWarning() {}, prefersReducedMotion: () => false });
  await cache.loadIndex(indexFixture({ states: Object.fromEntries([active, damaged]) }));

  assert.equal(cache.resolveFrame('building', 'habitat', { elapsedMs: 0 }).frame, 1);
  assert.equal(cache.resolveFrame('building', 'habitat', { elapsedMs: 150 }).frame, 2);
  assert.equal(cache.resolveFrame('building', 'habitat', { elapsedMs: 599 }).frame, 4);
  assert.equal(cache.resolveFrame('building', 'habitat', { elapsedMs: 600 }).frame, 1);
  assert.equal(cache.resolveFrame('building', 'habitat', { state: 'damaged', elapsedMs: 999 }).frame, 3);
  const reduced = cache.resolveFrame('building', 'habitat', { elapsedMs: 599, reducedMotion: true });
  assert.equal(reduced.frame, 1);
  assert.equal(reduced.reducedMotion, true);
});

test('a broken declared clip warns once and primes only its safe frame 01', async () => {
  const collected = warningCollector();
  const fetched = [];
  const states = Object.fromEntries([
    clip('active', { declaredFrames: 4, availableFrames: 2, frameMs: 150 }),
  ]);
  const cache = new CommissionedArtCache({
    fetchImpl: async (url) => {
      fetched.push(url);
      return pngResponse();
    },
    bitmapFactory: async () => bitmapFor(),
    onWarning: collected.onWarning,
    prefersReducedMotion: () => false,
  });
  await cache.loadIndex(indexFixture({ states }), { baseUrl: 'https://assets.test/' });

  const first = cache.resolveFrame('building', 'habitat', { elapsedMs: 450 });
  const second = cache.resolveFrame('building', 'habitat', { elapsedMs: 300 });
  assert.equal(first.frame, 1);
  assert.equal(second.frame, 1);
  assert.equal(first.brokenClip, true);
  const result = await cache.prime();
  assert.deepEqual(result, { requested: 1, loaded: 1, failed: 0 });
  assert.deepEqual(fetched, ['https://assets.test/sprites/building/habitat__active__f01.png']);
  assert.deepEqual(collected.warnings.map((warning) => warning.code), [COMMISSIONED_WARNING_CODES.brokenClip]);
  assert.equal(cache.getTelemetry().brokenClips, 1);
});

test('concurrent frame requests deduplicate fetch, Blob, and createImageBitmap work', async () => {
  let releaseFetch;
  let fetchCalls = 0;
  let bitmapCalls = 0;
  const blob = { kind: 'dedupe-blob' };
  const cache = new CommissionedArtCache({
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Promise((resolve) => { releaseFetch = () => resolve(pngResponse(blob)); });
    },
    bitmapFactory: async (received) => {
      bitmapCalls += 1;
      assert.equal(received, blob);
      return bitmapFor();
    },
    onWarning() {},
  });
  await cache.loadIndex(indexFixture());

  const first = cache.primeOne('building', 'habitat', { elapsedMs: 0 });
  const second = cache.primeOne('building', 'habitat', { elapsedMs: 0 });
  await Promise.resolve();
  assert.equal(fetchCalls, 1);
  assert.equal(cache.getTelemetry().pendingBitmaps, 1);
  releaseFetch();
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(bitmapCalls, 1);
  assert.equal(cache.size, 1);
  assert.equal(cache.getTelemetry().loadedBitmaps, 1);
  assert.equal(cache.getTelemetry().pendingBitmaps, 0);
});

test('an index reload closes a late bitmap instead of caching stale commissioned art', async () => {
  let releaseBitmap;
  let closed = 0;
  const cache = new CommissionedArtCache({
    fetchImpl: async () => pngResponse(),
    bitmapFactory: async () => new Promise((resolve) => {
      releaseBitmap = () => resolve(bitmapFor('building', { close() { closed += 1; } }));
    }),
    onWarning() {},
  });
  await cache.loadIndex(indexFixture());
  const staleRequest = cache.primeOne('building', 'habitat', { elapsedMs: 0 });
  await new Promise((resolve) => setImmediate(resolve));
  await cache.loadIndex(indexFixture());
  releaseBitmap();

  assert.equal(await staleRequest, false);
  assert.equal(closed, 1);
  assert.equal(cache.size, 0);
  assert.equal(cache.getTelemetry().pendingBitmaps, 0);
});

test('draw applies the explicit anchor, screen offset, class scale, and fallback callback', async () => {
  const collected = warningCollector();
  const cache = new CommissionedArtCache({
    fetchImpl: async () => pngResponse(),
    bitmapFactory: async () => bitmapFor(),
    onWarning: collected.onWarning,
  });
  await cache.loadIndex(indexFixture({ asset: { screenOffset: { x: 2, y: 19 } } }));
  assert.equal(await cache.primeOne('building', 'habitat', { elapsedMs: 0 }), true);

  const calls = [];
  const context = {
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    save() {},
    restore() {},
    drawImage(...args) { calls.push(args); },
  };
  assert.equal(cache.draw(context, 'building', 'habitat', 100, 80, { elapsedMs: 0, alpha: 0.5 }), true);
  const width = RENDER_CONTRACT.spriteClasses.building.canvasWidth * RENDER_CONTRACT.spriteClasses.building.scale;
  const height = RENDER_CONTRACT.spriteClasses.building.canvasHeight * RENDER_CONTRACT.spriteClasses.building.scale;
  assert.deepEqual(calls[0].slice(1), [Math.round(102 - width / 2), 99 - height, width, height]);
  assert.equal(context.imageSmoothingEnabled, false);
  assert.equal(context.globalAlpha, 0.5);

  const fallbacks = [];
  assert.equal(cache.draw(context, 'building', 'missing', 0, 0, { fallback: (detail) => fallbacks.push(detail) }), false);
  assert.equal(cache.draw(context, 'building', 'missing', 0, 0, { fallback: (detail) => fallbacks.push(detail) }), false);
  assert.deepEqual(fallbacks.map((detail) => detail.reason), ['missing', 'missing']);
  assert.equal(collected.warnings.filter((warning) => warning.code === COMMISSIONED_WARNING_CODES.missing).length, 1);
  assert.equal(cache.getTelemetry().drawn, 1);
  assert.equal(cache.getTelemetry().fallbackDrawn, 2);
});

test('an unprimed draw falls back immediately, warms asynchronously, then draws', async () => {
  const cache = new CommissionedArtCache({
    fetchImpl: async () => pngResponse(),
    bitmapFactory: async () => bitmapFor(),
    onWarning() {},
  });
  await cache.loadIndex(indexFixture());
  const context = { globalAlpha: 1, save() {}, restore() {}, drawImage() {} };
  let fallbackReason;
  assert.equal(cache.draw(context, 'building', 'habitat', 0, 0, {
    elapsedMs: 0,
    fallback: ({ reason }) => { fallbackReason = reason; },
  }), false);
  assert.equal(fallbackReason, 'not-ready');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cache.draw(context, 'building', 'habitat', 0, 0, { elapsedMs: 0 }), true);
});

test('invalid runtime dimensions are rejected, closed, and warned once', async () => {
  const collected = warningCollector();
  let closed = 0;
  const cache = new CommissionedArtCache({
    fetchImpl: async () => pngResponse(),
    bitmapFactory: async () => bitmapFor('building', {
      width: RENDER_CONTRACT.spriteClasses.building.canvasWidth - 1,
      close() { closed += 1; },
    }),
    onWarning: collected.onWarning,
  });
  await cache.loadIndex(indexFixture());

  assert.equal(await cache.primeOne('building', 'habitat', { elapsedMs: 0 }), false);
  assert.equal(await cache.primeOne('building', 'habitat', { elapsedMs: 0 }), false);
  assert.equal(cache.size, 0);
  assert.equal(closed, 2);
  assert.equal(collected.warnings.filter((warning) => warning.code === COMMISSIONED_WARNING_CODES.dimensions).length, 1);
  assert.equal(cache.getTelemetry().invalidDimensions, 1);
  assert.equal(cache.getTelemetry().loadAttempts, 2);
});

test('missing and failed decodes warn once while slow decodes remain cached', async () => {
  const missingWarnings = warningCollector();
  const missing = new CommissionedArtCache({
    fetchImpl: async () => ({ ok: false, status: 404 }),
    bitmapFactory: async () => bitmapFor(),
    onWarning: missingWarnings.onWarning,
  });
  await missing.loadIndex(indexFixture());
  assert.equal(await missing.primeOne('building', 'habitat', { elapsedMs: 0 }), false);
  assert.equal(await missing.primeOne('building', 'habitat', { elapsedMs: 0 }), false);
  assert.equal(missingWarnings.warnings.filter((warning) => warning.code === COMMISSIONED_WARNING_CODES.missing).length, 1);
  assert.equal(missing.getTelemetry().missing, 1);

  const decodeWarnings = warningCollector();
  const decode = new CommissionedArtCache({
    fetchImpl: async () => pngResponse(),
    bitmapFactory: async () => { throw new Error('corrupt PNG'); },
    onWarning: decodeWarnings.onWarning,
  });
  await decode.loadIndex(indexFixture());
  assert.equal(await decode.primeOne('building', 'habitat', { elapsedMs: 0 }), false);
  assert.equal(await decode.primeOne('building', 'habitat', { elapsedMs: 0 }), false);
  assert.equal(decodeWarnings.warnings.filter((warning) => warning.code === COMMISSIONED_WARNING_CODES.decode).length, 1);
  assert.equal(decode.getTelemetry().decodeFailures, 1);

  const slowWarnings = warningCollector();
  const slow = new CommissionedArtCache({
    fetchImpl: async () => pngResponse(),
    bitmapFactory: async () => bitmapFor(),
    slowDecodeMs: -1,
    onWarning: slowWarnings.onWarning,
  });
  await slow.loadIndex(indexFixture());
  assert.equal(await slow.primeOne('building', 'habitat', { elapsedMs: 0 }), true);
  assert.equal(slow.size, 1);
  assert.equal(slowWarnings.warnings.filter((warning) => warning.code === COMMISSIONED_WARNING_CODES.slow).length, 1);
  assert.equal(slow.getTelemetry().slowDecodes, 1);
});

test('index validation rejects contract drift, duplicate ids, and invalid anchors', async () => {
  const cache = new CommissionedArtCache({ onWarning() {} });
  const drifted = indexFixture();
  drifted.contractVersion = RENDER_CONTRACT.version + 1;
  await assert.rejects(cache.loadIndex(drifted), /contractVersion/);

  const duplicate = indexFixture();
  duplicate.assets.push(structuredClone(duplicate.assets[0]));
  await assert.rejects(cache.loadIndex(duplicate), /duplicate asset/);

  const invalidAnchor = indexFixture({ asset: {
    anchor: { type: 'feet', x: 0, y: 0, screenOffsetX: 0, screenOffsetY: 0 },
  } });
  await assert.rejects(cache.loadIndex(invalidAnchor), /anchor does not match/);

  const invalidCanvas = indexFixture();
  invalidCanvas.assets[0].canvas.width -= 1;
  await assert.rejects(cache.loadIndex(invalidCanvas), /canvas does not match/);
});
