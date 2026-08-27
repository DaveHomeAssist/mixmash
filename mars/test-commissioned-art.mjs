import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { RENDER_CONTRACT, assetPath } from './render-contract.mjs';
import {
  COMMISSIONED_INDEX_VERSION,
  COMMISSIONED_RUNTIME_IDENTITY_SCHEMA,
  COMMISSIONED_WARNING_CODES,
  CommissionedArtCache,
  commissionedAssetKey,
} from './commissioned-art.mjs';

const PNG_BYTES = Buffer.from('MarsScape commissioned PNG fixture bytes');
const PNG_SHA256 = createHash('sha256').update(PNG_BYTES).digest('hex');

function frameEntries(family, id, state, count) {
  return Array.from({ length: count }, (_, index) => ({
    path: assetPath(family, id, state, index + 1),
    sha256: PNG_SHA256,
  }));
}

function clip(state, options = {}) {
  const declaredFrames = options.declaredFrames ?? options.frames ?? 1;
  const availableFrames = options.availableFrames ?? declaredFrames;
  return [state, {
    declaredFrames,
    frameMs: options.frameMs ?? 600,
    loop: options.loop ?? true,
    frames: options.entries || frameEntries(options.family || 'building', options.id || 'habitat', state, availableFrames),
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
  const index = {
    version: COMMISSIONED_INDEX_VERSION,
    runtimeIdentitySchema: COMMISSIONED_RUNTIME_IDENTITY_SCHEMA,
    contractVersion: RENDER_CONTRACT.version,
    decision: RENDER_CONTRACT.decision,
    scope: 'full',
    manifestHash: '0'.repeat(64),
    runtimeAssetHash: null,
    runtimeAssetHashes: { full: null, 'artist-test': null },
    availableExports: Object.values(states).reduce((total, state) => total + state.frames.length, 0),
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
      footprint: { width: 1, depth: 1, origin: 'centre' },
      fallback: `procedural:${className}`,
      fallbackSprite: null,
      states,
      ...(options.asset || {}),
    }],
  };
  const runtimeAssetHash = createHash('sha256')
    .update(JSON.stringify({ schema: COMMISSIONED_RUNTIME_IDENTITY_SCHEMA, assets: index.assets }))
    .digest('hex');
  index.runtimeAssetHash = runtimeAssetHash;
  index.runtimeAssetHashes.full = runtimeAssetHash;
  index.runtimeAssetHashes['artist-test'] = runtimeAssetHash;
  return index;
}

function bitmapFor(className = 'building', overrides = {}) {
  const spriteClass = RENDER_CONTRACT.spriteClasses[className];
  return {
    width: spriteClass.canvasWidth,
    height: spriteClass.canvasHeight,
    ...overrides,
  };
}

function pngBlob(bytes = PNG_BYTES) {
  return new Blob([bytes], { type: 'image/png' });
}

function pngResponse(blob = pngBlob()) {
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

test('an injected v2 index resolves immutable hashed frames, contract geometry, and state fallbacks', async () => {
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
  assert.equal(frame.sha256, PNG_SHA256);
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

test('runtime index v2 independently hashes complete ordered metadata before acceptance', async () => {
  const baseline = indexFixture();
  const cache = new CommissionedArtCache({ onWarning() {} });
  await cache.loadIndex(baseline);
  const metadata = cache.getIndexMetadata();
  assert.equal(metadata.identityVerified, true);
  assert.equal(metadata.runtimeIdentitySchema, COMMISSIONED_RUNTIME_IDENTITY_SCHEMA);
  assert.equal(metadata.runtimeAssetHash, baseline.runtimeAssetHash);
  assert.deepEqual(metadata.assets, baseline.assets);
  assert.equal(cache.getTelemetry().indexIdentityVerified, true);

  for (const [label, mutate] of [
    ['screenOffset', (index) => { index.assets[0].screenOffset.x += 1; }],
    ['frameMs', (index) => { index.assets[0].states.active.frameMs = 150; }],
    ['loop', (index) => { index.assets[0].states.active.loop = !index.assets[0].states.active.loop; }],
  ]) {
    const drifted = indexFixture();
    mutate(drifted);
    await assert.rejects(
      cache.loadIndex(drifted),
      /runtimeAssetHash .* does not match computed/,
      `${label} drift with a retained hash is rejected`,
    );
    assert.equal(cache.getIndexMetadata(), null, `${label} drift fails closed instead of retaining stale metadata`);
    assert.equal(cache.getTelemetry().indexIdentityVerified, false);
  }

  const missingSchema = indexFixture();
  delete missingSchema.runtimeIdentitySchema;
  await assert.rejects(cache.loadIndex(missingSchema), /runtimeIdentitySchema/);
  const missingHash = indexFixture();
  delete missingHash.runtimeAssetHash;
  await assert.rejects(cache.loadIndex(missingHash), /runtimeAssetHash must be a lowercase SHA-256 digest/);
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
  const blob = pngBlob();
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
  let markBitmapStarted;
  let closed = 0;
  let bitmapCalls = 0;
  const bitmapStarted = new Promise((resolve) => { markBitmapStarted = resolve; });
  const cache = new CommissionedArtCache({
    fetchImpl: async () => pngResponse(),
    bitmapFactory: async () => {
      bitmapCalls += 1;
      if (bitmapCalls > 1) return bitmapFor();
      return new Promise((resolve) => {
        releaseBitmap = () => resolve(bitmapFor('building', { close() { closed += 1; } }));
        markBitmapStarted();
      });
    },
    onWarning() {},
  });
  await cache.loadIndex(indexFixture());
  const staleRequest = cache.primeOne('building', 'habitat', { elapsedMs: 0 });
  await bitmapStarted;
  await cache.loadIndex(indexFixture());
  releaseBitmap();

  assert.equal(await staleRequest, false);
  assert.equal(closed, 1);
  assert.equal(cache.size, 0);
  assert.equal(cache.getTelemetry().pendingBitmaps, 0);
  assert.equal(cache.getTelemetry().failedFrames, 0, 'a stale generation cannot poison the current frame key');
  assert.equal(await cache.primeOne('building', 'habitat', { elapsedMs: 0 }), true);
  assert.equal(bitmapCalls, 2, 'the reloaded generation is allowed a fresh decode');
});

test('late stale fetch rejection cannot poison the reloaded generation telemetry or retry', async () => {
  const collected = warningCollector();
  let rejectStaleFetch;
  let fetchCalls = 0;
  const cache = new CommissionedArtCache({
    fetchImpl: async () => {
      fetchCalls += 1;
      if (fetchCalls === 1) return new Promise((resolve, reject) => { rejectStaleFetch = reject; });
      return pngResponse();
    },
    bitmapFactory: async () => bitmapFor(),
    onWarning: collected.onWarning,
  });
  const index = indexFixture();
  await cache.loadIndex(index);
  const staleRequest = cache.primeOne('building', 'habitat', { elapsedMs: 0 });
  await Promise.resolve();
  await cache.loadIndex(index);
  rejectStaleFetch(new Error('late stale network failure'));

  assert.equal(await staleRequest, false);
  assert.equal(cache.getTelemetry().decodeFailures, 0);
  assert.equal(cache.getTelemetry().failedFrames, 0);
  assert.equal(collected.warnings.length, 0);
  assert.equal(await cache.primeOne('building', 'habitat', { elapsedMs: 0 }), true);
  assert.equal(fetchCalls, 2, 'the current generation gets a clean fetch after the stale rejection');
});

test('late stale SHA mismatch cannot poison the reloaded generation telemetry or retry', async () => {
  const collected = warningCollector();
  let releaseStaleBytes;
  let markHashStarted;
  let fetchCalls = 0;
  const hashStarted = new Promise((resolve) => { markHashStarted = resolve; });
  const staleBlob = {
    arrayBuffer() {
      markHashStarted();
      return new Promise((resolve) => { releaseStaleBytes = () => resolve(Buffer.from('late stale tampered bytes')); });
    },
  };
  const cache = new CommissionedArtCache({
    fetchImpl: async () => {
      fetchCalls += 1;
      return fetchCalls === 1 ? pngResponse(staleBlob) : pngResponse();
    },
    bitmapFactory: async () => bitmapFor(),
    onWarning: collected.onWarning,
  });
  const index = indexFixture();
  await cache.loadIndex(index);
  const staleRequest = cache.primeOne('building', 'habitat', { elapsedMs: 0 });
  await hashStarted;
  await cache.loadIndex(index);
  releaseStaleBytes();

  assert.equal(await staleRequest, false);
  assert.equal(cache.getTelemetry().integrityFailures, 0);
  assert.equal(cache.getTelemetry().failedFrames, 0);
  assert.equal(collected.warnings.length, 0);
  assert.equal(await cache.primeOne('building', 'habitat', { elapsedMs: 0 }), true);
  assert.equal(fetchCalls, 2, 'the current generation decodes after the stale hash failure');
});

test('late stale decode rejection cannot poison the reloaded generation telemetry or retry', async () => {
  const collected = warningCollector();
  let rejectStaleDecode;
  let markDecodeStarted;
  let bitmapCalls = 0;
  const decodeStarted = new Promise((resolve) => { markDecodeStarted = resolve; });
  const cache = new CommissionedArtCache({
    fetchImpl: async () => pngResponse(),
    bitmapFactory: async () => {
      bitmapCalls += 1;
      if (bitmapCalls === 1) {
        markDecodeStarted();
        return new Promise((resolve, reject) => { rejectStaleDecode = reject; });
      }
      return bitmapFor();
    },
    onWarning: collected.onWarning,
  });
  const index = indexFixture();
  await cache.loadIndex(index);
  const staleRequest = cache.primeOne('building', 'habitat', { elapsedMs: 0 });
  await decodeStarted;
  await cache.loadIndex(index);
  rejectStaleDecode(new Error('late stale decode failure'));

  assert.equal(await staleRequest, false);
  assert.equal(cache.getTelemetry().decodeFailures, 0);
  assert.equal(cache.getTelemetry().failedFrames, 0);
  assert.equal(collected.warnings.length, 0);
  assert.equal(await cache.primeOne('building', 'habitat', { elapsedMs: 0 }), true);
  assert.equal(bitmapCalls, 2, 'the current generation decodes after the stale decoder rejection');
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
  await cache.primeOne('building', 'habitat', { elapsedMs: 0 });
  assert.equal(cache.draw(context, 'building', 'habitat', 0, 0, { elapsedMs: 0 }), true);
});

test('invalid runtime dimensions are rejected, closed, and warned once', async () => {
  const collected = warningCollector();
  let closed = 0;
  let fetchCalls = 0;
  let bitmapCalls = 0;
  const cache = new CommissionedArtCache({
    fetchImpl: async () => {
      fetchCalls += 1;
      return pngResponse();
    },
    bitmapFactory: async () => {
      bitmapCalls += 1;
      return bitmapFor('building', {
        width: RENDER_CONTRACT.spriteClasses.building.canvasWidth - 1,
        close() { closed += 1; },
      });
    },
    onWarning: collected.onWarning,
  });
  await cache.loadIndex(indexFixture());

  assert.equal(await cache.primeOne('building', 'habitat', { elapsedMs: 0 }), false);
  assert.equal(await cache.primeOne('building', 'habitat', { elapsedMs: 0 }), false);
  assert.equal(cache.size, 0);
  assert.equal(closed, 1);
  assert.equal(fetchCalls, 1);
  assert.equal(bitmapCalls, 1);
  assert.equal(collected.warnings.filter((warning) => warning.code === COMMISSIONED_WARNING_CODES.dimensions).length, 1);
  assert.equal(cache.getTelemetry().invalidDimensions, 1);
  assert.equal(cache.getTelemetry().loadAttempts, 1);
  assert.equal(cache.getTelemetry().failedFrames, 1);
});

test('fetched PNG bytes must match the immutable index SHA before ImageBitmap acceptance', async () => {
  const collected = warningCollector();
  let bitmapCalls = 0;
  let fetchCalls = 0;
  const cache = new CommissionedArtCache({
    fetchImpl: async () => {
      fetchCalls += 1;
      return pngResponse(pngBlob('tampered commissioned PNG bytes'));
    },
    bitmapFactory: async () => {
      bitmapCalls += 1;
      return bitmapFor();
    },
    onWarning: collected.onWarning,
  });
  await cache.loadIndex(indexFixture());

  assert.equal(await cache.primeOne('building', 'habitat', { elapsedMs: 0 }), false);
  assert.equal(await cache.primeOne('building', 'habitat', { elapsedMs: 0 }), false);
  const context = { globalAlpha: 1, save() {}, restore() {}, drawImage() {} };
  for (let frame = 0; frame < 20; frame += 1) {
    assert.equal(cache.draw(context, 'building', 'habitat', 0, 0, { elapsedMs: frame * 16 }), false);
  }
  await Promise.resolve();
  assert.equal(bitmapCalls, 0, 'hash mismatch is rejected before createImageBitmap');
  assert.equal(fetchCalls, 1, 'a persistent hash mismatch is not refetched on later draw frames');
  assert.equal(cache.size, 0);
  assert.equal(cache.getTelemetry().integrityFailures, 1);
  assert.equal(cache.getTelemetry().failedFrames, 1);
  assert.equal(collected.warnings.filter((warning) => warning.code === COMMISSIONED_WARNING_CODES.integrity).length, 1);
});

test('missing and failed decodes warn once while slow decodes remain cached', async () => {
  const missingWarnings = warningCollector();
  let missingFetches = 0;
  const missing = new CommissionedArtCache({
    fetchImpl: async () => {
      missingFetches += 1;
      return { ok: false, status: 404 };
    },
    bitmapFactory: async () => bitmapFor(),
    onWarning: missingWarnings.onWarning,
  });
  await missing.loadIndex(indexFixture());
  assert.equal(await missing.primeOne('building', 'habitat', { elapsedMs: 0 }), false);
  assert.equal(await missing.primeOne('building', 'habitat', { elapsedMs: 0 }), false);
  assert.equal(missingWarnings.warnings.filter((warning) => warning.code === COMMISSIONED_WARNING_CODES.missing).length, 1);
  assert.equal(missing.getTelemetry().missing, 1);
  assert.equal(missing.getTelemetry().failedFrames, 1);
  assert.equal(missingFetches, 1);

  const decodeWarnings = warningCollector();
  let decodeFetches = 0;
  let decodeAttempts = 0;
  const decode = new CommissionedArtCache({
    fetchImpl: async () => {
      decodeFetches += 1;
      return pngResponse();
    },
    bitmapFactory: async () => {
      decodeAttempts += 1;
      throw new Error('corrupt PNG');
    },
    onWarning: decodeWarnings.onWarning,
  });
  await decode.loadIndex(indexFixture());
  assert.equal(await decode.primeOne('building', 'habitat', { elapsedMs: 0 }), false);
  assert.equal(await decode.primeOne('building', 'habitat', { elapsedMs: 0 }), false);
  assert.equal(decodeWarnings.warnings.filter((warning) => warning.code === COMMISSIONED_WARNING_CODES.decode).length, 1);
  assert.equal(decode.getTelemetry().decodeFailures, 1);
  assert.equal(decode.getTelemetry().failedFrames, 1);
  assert.equal(decodeFetches, 1);
  assert.equal(decodeAttempts, 1);

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
  assert.equal(slow.getTelemetry().failedFrames, 0);
  assert.equal(slowWarnings.warnings.filter((warning) => warning.code === COMMISSIONED_WARNING_CODES.slow).length, 1);
  assert.equal(slow.getTelemetry().slowDecodes, 1);
});

test('exact scoped frame coverage fails when a noncurrent frame is missing and resets on index reload', async () => {
  const states = Object.fromEntries([
    clip('active', { frames: 2, frameMs: 150 }),
  ]);
  let frameTwoMissing = true;
  let frameTwoFetches = 0;
  const cache = new CommissionedArtCache({
    fetchImpl: async (url) => {
      if (url.endsWith('__f02.png')) {
        frameTwoFetches += 1;
        if (frameTwoMissing) return { ok: false, status: 404 };
      }
      return pngResponse();
    },
    bitmapFactory: async () => bitmapFor(),
    onWarning() {},
    prefersReducedMotion: () => true,
  });
  const index = indexFixture({ states });
  const selection = [{ family: 'building', id: 'habitat', states: ['active'] }];
  await cache.loadIndex(index, { baseUrl: 'https://assets.test/' });

  assert.deepEqual(await cache.prime({ assets: selection, reducedMotion: false }), {
    requested: 2,
    loaded: 1,
    failed: 1,
  });
  assert.deepEqual(cache.getFrameCoverage({ assets: selection }), {
    expected: 2,
    cached: 1,
    pending: 0,
    failed: 1,
    missing: 1,
    complete: false,
  });
  assert.equal(cache.getTelemetry().missingFrames, 1);
  const context = { globalAlpha: 1, save() {}, restore() {}, drawImage() {} };
  assert.equal(
    cache.draw(context, 'building', 'habitat', 0, 0, { elapsedMs: 0, reducedMotion: false }),
    true,
    'visible frame 01 can render but does not make the complete clip approval-ready',
  );
  assert.equal(frameTwoFetches, 1, 'the missing noncurrent frame is not retried on subsequent coverage checks');

  frameTwoMissing = false;
  await cache.loadIndex(index, { baseUrl: 'https://assets.test/' });
  assert.deepEqual(await cache.prime({ assets: selection, reducedMotion: false }), {
    requested: 2,
    loaded: 2,
    failed: 0,
  });
  assert.deepEqual(cache.getFrameCoverage({ assets: selection }), {
    expected: 2,
    cached: 2,
    pending: 0,
    failed: 0,
    missing: 0,
    complete: true,
  });
  assert.equal(frameTwoFetches, 2, 'a new index generation permits the formerly missing frame to retry');
});

test('loading a new index generation clears failed-frame sentinels and permits retry', async () => {
  let tampered = true;
  let fetchCalls = 0;
  let bitmapCalls = 0;
  const cache = new CommissionedArtCache({
    fetchImpl: async () => {
      fetchCalls += 1;
      return pngResponse(tampered ? pngBlob('tampered generation') : pngBlob());
    },
    bitmapFactory: async () => {
      bitmapCalls += 1;
      return bitmapFor();
    },
    onWarning() {},
  });
  const index = indexFixture();
  await cache.loadIndex(index);

  assert.equal(await cache.primeOne('building', 'habitat', { elapsedMs: 0 }), false);
  assert.equal(await cache.primeOne('building', 'habitat', { elapsedMs: 0 }), false);
  assert.equal(fetchCalls, 1);
  assert.equal(cache.getTelemetry().failedFrames, 1);

  tampered = false;
  await cache.loadIndex(index);
  assert.equal(cache.getTelemetry().failedFrames, 0);
  assert.equal(await cache.primeOne('building', 'habitat', { elapsedMs: 0 }), true);
  assert.equal(fetchCalls, 2, 'the new index generation gets exactly one fresh fetch');
  assert.equal(bitmapCalls, 1);
  assert.equal(cache.getTelemetry().failedFrames, 0);
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

  const missingFrameHash = indexFixture();
  delete missingFrameHash.assets[0].states.active.frames[0].sha256;
  await assert.rejects(cache.loadIndex(missingFrameHash), /sha256 must be a lowercase SHA-256 digest/);
});
