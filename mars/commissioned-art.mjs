import { RENDER_CONTRACT, assetId } from './render-contract.mjs';

/* Generated index shape:
   {
     version, contractVersion, decision,
     assets: [{
       family, id, class, screenOffset?: { x, y },
       states: {
         active: {
           declaredFrames, frameMs, loop,
           frames: [{ path: 'sprites/...f01.png', sha256: '<exact PNG SHA-256>' }]
         }
       }
     }]
   }
   Frame paths are relative to index.json unless loadIndex receives baseUrl. */

export const COMMISSIONED_INDEX_VERSION = 2;
export const COMMISSIONED_RUNTIME_IDENTITY_SCHEMA = 'marsscape-runtime-assets/v2';
export const DEFAULT_COMMISSIONED_INDEX_URL = new URL('./assets/commissioned/index.json', import.meta.url);

export const COMMISSIONED_WARNING_CODES = Object.freeze({
  missing: 'COMMISSIONED_SPRITE_MISSING',
  decode: 'COMMISSIONED_DECODE_FAILED',
  dimensions: 'COMMISSIONED_INVALID_DIMENSIONS',
  integrity: 'COMMISSIONED_FRAME_INTEGRITY_MISMATCH',
  slow: 'COMMISSIONED_SLOW_DECODE',
  brokenClip: 'COMMISSIONED_BROKEN_CLIP',
  stateFallback: 'COMMISSIONED_STATE_FALLBACK',
});

const CANONICAL_NAME = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;

function defaultClock() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function defaultReducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

function requireCanonicalName(value, label) {
  if (typeof value !== 'string' || !CANONICAL_NAME.test(value)) {
    throw new TypeError(`${label} must be a lowercase snake_case identifier.`);
  }
  return value;
}

function requireCanonicalState(value) {
  if (!RENDER_CONTRACT.states.includes(value)) {
    throw new RangeError(`Unknown commissioned-art state: ${value}`);
  }
  return value;
}

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertIndex(condition, message) {
  if (!condition) throw new TypeError(`Invalid commissioned-art index: ${message}`);
}

export async function sha256Bytes(value) {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto SHA-256 is unavailable');
  const bytes = value instanceof ArrayBuffer
    ? value
    : ArrayBuffer.isView(value)
      ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
      : null;
  if (!bytes) throw new TypeError('sha256Bytes requires an ArrayBuffer or typed-array view');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Blob(blob) {
  if (!blob || typeof blob.arrayBuffer !== 'function') throw new TypeError('Fetched PNG is not a readable Blob');
  return sha256Bytes(await blob.arrayBuffer());
}

export async function runtimeAssetIdentityHash(assets) {
  if (!Array.isArray(assets)) throw new TypeError('runtimeAssetIdentityHash requires an ordered asset array');
  const payload = JSON.stringify({ schema: COMMISSIONED_RUNTIME_IDENTITY_SCHEMA, assets });
  return sha256Bytes(new TextEncoder().encode(payload));
}

function expectedAnchor(className, screenOffset) {
  const spriteClass = RENDER_CONTRACT.spriteClasses[className];
  const type = spriteClass.anchor;
  const groundKey = className === 'resource'
    ? 'node'
    : className === 'building'
      ? 'building'
      : className === 'actor' || className === 'rover'
        ? 'actor'
        : null;
  const ground = groundKey ? RENDER_CONTRACT.anchors.ground[groundKey] : null;
  if (screenOffset !== undefined) {
    assertIndex(
      isObject(screenOffset) && Number.isFinite(screenOffset.x) && Number.isFinite(screenOffset.y),
      `${className}.screenOffset must contain finite x and y values`,
    );
  }
  return Object.freeze({
    type,
    x: spriteClass.anchorX ?? 0.5,
    y: spriteClass.anchorY ?? (type === 'feet' ? 1 : 0.5),
    screenOffsetX: screenOffset?.x ?? spriteClass.screenOffsetX ?? ground?.screenOffsetX ?? 0,
    screenOffsetY: screenOffset?.y ?? spriteClass.screenOffsetY ?? ground?.screenOffsetY ?? 0,
  });
}

function anchorMatches(actual, expected) {
  if (!isObject(actual)) return false;
  return actual.type === expected.type
    && actual.x === expected.x
    && actual.y === expected.y
    && (actual.screenOffsetX === undefined || actual.screenOffsetX === expected.screenOffsetX)
    && (actual.screenOffsetY === undefined || actual.screenOffsetY === expected.screenOffsetY);
}

function isRelativeFramePath(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value.startsWith('/') || value.startsWith('\\') || /^[a-z][a-z\d+.-]*:/i.test(value)) return false;
  return !value.split(/[\\/]/).includes('..');
}

function normaliseState(name, source) {
  requireCanonicalState(name);
  assertIndex(isObject(source), `state ${name} must be an object`);
  assertIndex(Number.isInteger(source.declaredFrames) && source.declaredFrames > 0, `${name}.declaredFrames must be a positive integer`);
  assertIndex(Array.isArray(source.frames), `${name}.frames must be an array`);
  assertIndex(RENDER_CONTRACT.animation.allowedFrameMs.includes(source.frameMs), `${name}.frameMs must use the render contract cadence`);

  const frames = source.frames.map((frame, index) => {
    assertIndex(isObject(frame), `${name}.frames[${index}] must be an object`);
    assertIndex(isRelativeFramePath(frame.path), `${name}.frames[${index}].path must be a safe relative path`);
    assertIndex(SHA256_HEX.test(frame.sha256 || ''), `${name}.frames[${index}].sha256 must be a lowercase SHA-256 digest`);
    return Object.freeze({ path: frame.path, sha256: frame.sha256 });
  });
  const broken = frames.length !== source.declaredFrames;
  assertIndex(typeof source.loop === 'boolean', `${name}.loop must be a boolean`);
  const identity = Object.freeze({
    declaredFrames: source.declaredFrames,
    frameMs: source.frameMs,
    loop: source.loop,
    frames: Object.freeze(frames.map((frame) => Object.freeze({ path: frame.path, sha256: frame.sha256 }))),
  });
  return Object.freeze({
    name,
    declaredFrames: source.declaredFrames,
    frameMs: source.frameMs,
    loop: source.loop,
    frames: Object.freeze(frames),
    broken,
    identity,
  });
}

function normaliseAsset(source) {
  assertIndex(isObject(source), 'every asset must be an object');
  const family = requireCanonicalName(source.family, 'Asset family');
  const id = requireCanonicalName(source.id, 'Asset id');
  const className = requireCanonicalName(source.class, 'Asset class');
  const spriteClass = RENDER_CONTRACT.spriteClasses[className];
  assertIndex(Boolean(spriteClass), `${family}/${id} uses unknown class ${className}`);

  const anchor = expectedAnchor(className, source.screenOffset);
  if (source.anchor !== undefined) {
    assertIndex(anchorMatches(source.anchor, anchor), `${family}/${id} anchor does not match render contract v${RENDER_CONTRACT.version}`);
  }
  if (source.scale !== undefined) {
    assertIndex(source.scale === spriteClass.scale, `${family}/${id} scale does not match class ${className}`);
  }
  if (source.canvas !== undefined) {
    assertIndex(
      isObject(source.canvas)
        && source.canvas.width === spriteClass.canvasWidth
        && source.canvas.height === spriteClass.canvasHeight
        && source.canvas.scale === spriteClass.scale,
      `${family}/${id} canvas does not match class ${className}`,
    );
  }
  assertIndex(isObject(source.anchor), `${family}/${id} requires its canonical anchor`);
  assertIndex(isObject(source.screenOffset), `${family}/${id} requires its screen offset`);
  assertIndex(isObject(source.canvas), `${family}/${id} requires its canonical canvas`);
  assertIndex(
    isObject(source.footprint)
      && Number.isInteger(source.footprint.width)
      && source.footprint.width > 0
      && Number.isInteger(source.footprint.depth)
      && source.footprint.depth > 0
      && source.footprint.origin === 'centre',
    `${family}/${id} requires a positive centre-origin footprint`,
  );
  assertIndex(source.fallback === null || (typeof source.fallback === 'string' && source.fallback.length > 0), `${family}/${id}.fallback must be a non-empty string or null`);
  assertIndex(source.fallbackSprite === null || (typeof source.fallbackSprite === 'string' && source.fallbackSprite.length > 0), `${family}/${id}.fallbackSprite must be a non-empty string or null`);
  assertIndex(isObject(source.states) && Object.keys(source.states).length > 0, `${family}/${id} requires at least one state`);

  const states = new Map();
  const identityStates = {};
  for (const [stateName, stateSource] of Object.entries(source.states)) {
    const state = normaliseState(stateName, stateSource);
    states.set(stateName, state);
    identityStates[stateName] = state.identity;
  }

  const identity = Object.freeze({
    family,
    id,
    class: className,
    anchor: Object.freeze({ type: source.anchor.type, x: source.anchor.x, y: source.anchor.y }),
    screenOffset: Object.freeze({ x: source.screenOffset.x, y: source.screenOffset.y }),
    canvas: Object.freeze({ width: source.canvas.width, height: source.canvas.height, scale: source.canvas.scale }),
    footprint: Object.freeze({
      width: source.footprint.width,
      depth: source.footprint.depth,
      origin: source.footprint.origin,
    }),
    fallback: source.fallback,
    fallbackSprite: source.fallbackSprite,
    states: Object.freeze(identityStates),
  });

  return Object.freeze({
    key: commissionedAssetKey(family, id),
    family,
    id,
    className,
    spriteClass,
    anchor,
    states,
    identity,
  });
}

async function normaliseIndex(source, baseUrl) {
  assertIndex(isObject(source), 'root must be an object');
  assertIndex(source.version === COMMISSIONED_INDEX_VERSION, `version must be ${COMMISSIONED_INDEX_VERSION}`);
  assertIndex(source.runtimeIdentitySchema === COMMISSIONED_RUNTIME_IDENTITY_SCHEMA, `runtimeIdentitySchema must be ${COMMISSIONED_RUNTIME_IDENTITY_SCHEMA}`);
  assertIndex(source.contractVersion === RENDER_CONTRACT.version, `contractVersion must be ${RENDER_CONTRACT.version}`);
  assertIndex(source.decision === RENDER_CONTRACT.decision, `decision must be ${RENDER_CONTRACT.decision}`);
  assertIndex(source.scope === 'full' || source.scope === 'artist-test', 'scope must be full or artist-test');
  assertIndex(SHA256_HEX.test(source.runtimeAssetHash || ''), 'runtimeAssetHash must be a lowercase SHA-256 digest');
  assertIndex(isObject(source.runtimeAssetHashes), 'runtimeAssetHashes must be an object');
  assertIndex(SHA256_HEX.test(source.runtimeAssetHashes.full || ''), 'runtimeAssetHashes.full must be a lowercase SHA-256 digest');
  assertIndex(SHA256_HEX.test(source.runtimeAssetHashes['artist-test'] || ''), 'runtimeAssetHashes.artist-test must be a lowercase SHA-256 digest');
  assertIndex(Array.isArray(source.assets), 'assets must be an array');

  const assets = new Map();
  const identityAssets = [];
  let states = 0;
  let frames = 0;
  let declaredFrames = 0;
  for (const sourceAsset of source.assets) {
    const asset = normaliseAsset(sourceAsset);
    assertIndex(!assets.has(asset.key), `duplicate asset ${asset.key}`);
    assets.set(asset.key, asset);
    identityAssets.push(asset.identity);
    states += asset.states.size;
    for (const state of asset.states.values()) {
      frames += state.frames.length;
      declaredFrames += state.declaredFrames;
    }
  }

  const runtimeAssetHash = await runtimeAssetIdentityHash(identityAssets);
  assertIndex(runtimeAssetHash === source.runtimeAssetHash, `runtimeAssetHash ${source.runtimeAssetHash} does not match computed ${runtimeAssetHash}`);
  assertIndex(source.runtimeAssetHashes[source.scope] === runtimeAssetHash, `runtimeAssetHashes.${source.scope} does not match the computed runtime asset hash`);

  const metadata = Object.freeze({
    version: source.version,
    runtimeIdentitySchema: source.runtimeIdentitySchema,
    contractVersion: source.contractVersion,
    decision: source.decision,
    scope: source.scope,
    manifestHash: source.manifestHash,
    runtimeAssetHash,
    runtimeAssetHashes: Object.freeze({
      full: source.runtimeAssetHashes.full,
      'artist-test': source.runtimeAssetHashes['artist-test'],
    }),
    availableExports: source.availableExports,
    assets: Object.freeze(identityAssets),
    identityVerified: true,
  });

  return Object.freeze({
    version: source.version,
    contractVersion: source.contractVersion,
    decision: source.decision,
    baseUrl,
    assets,
    metadata,
    identityVerified: true,
    counts: Object.freeze({ assets: assets.size, states, frames, declaredFrames }),
  });
}

function urlDirectory(value) {
  return new URL('./', value).href;
}

function frameNumberAt(clip, timeMs, reducedMotion) {
  if (reducedMotion || clip.broken || clip.frames.length <= 1) return 1;
  const elapsedFrames = Math.floor(Math.max(0, timeMs) / clip.frameMs);
  return clip.loop
    ? (elapsedFrames % clip.frames.length) + 1
    : Math.min(elapsedFrames + 1, clip.frames.length);
}

function initialTelemetry() {
  return {
    indexLoads: 0,
    loadAttempts: 0,
    loadedBitmaps: 0,
    cacheHits: 0,
    missing: 0,
    decodeFailures: 0,
    integrityFailures: 0,
    invalidDimensions: 0,
    slowDecodes: 0,
    brokenClips: 0,
    stateFallbacks: 0,
    drawn: 0,
    fallbackDrawn: 0,
  };
}

export function commissionedAssetKey(family, id) {
  return `${requireCanonicalName(family, 'Asset family')}/${requireCanonicalName(id, 'Asset id')}`;
}

export class CommissionedArtCache {
  constructor(options = {}) {
    this.fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
    this.bitmapFactory = options.bitmapFactory || globalThis.createImageBitmap?.bind(globalThis);
    this.clock = typeof options.clock === 'function' ? options.clock : defaultClock;
    this.prefersReducedMotion = typeof options.prefersReducedMotion === 'function'
      ? options.prefersReducedMotion
      : defaultReducedMotion;
    this.slowDecodeMs = finiteNumber(options.slowDecodeMs, RENDER_CONTRACT.performance?.slowDecodeMs ?? 100);
    this.onWarning = typeof options.onWarning === 'function'
      ? options.onWarning
      : (warning) => console.warn(`[MarsScape commissioned art] ${warning.code}: ${warning.id}`);
    this.index = null;
    this.bitmaps = new Map();
    this.pending = new Map();
    this.failedFrames = new Set();
    this.frameFailures = new Map();
    this.warned = new Set();
    this.telemetry = initialTelemetry();
    this.generation = 0;
  }

  get size() {
    return this.bitmaps.size;
  }

  has(family, id, state) {
    const asset = this.index?.assets.get(commissionedAssetKey(family, id));
    if (!asset) return false;
    return state === undefined ? true : asset.states.has(requireCanonicalState(state));
  }

  getTelemetry() {
    return {
      ...this.telemetry,
      indexIdentityVerified: this.index?.identityVerified === true,
      indexedAssets: this.index?.counts.assets ?? 0,
      indexedStates: this.index?.counts.states ?? 0,
      indexedFrames: this.index?.counts.frames ?? 0,
      declaredFrames: this.index?.counts.declaredFrames ?? 0,
      cachedBitmaps: this.bitmaps.size,
      pendingBitmaps: this.pending.size,
      failedFrames: this.failedFrames.size,
      missingFrames: [...this.frameFailures.values()].filter((kind) => kind === 'missing').length,
      warningKeys: this.warned.size,
    };
  }

  getIndexMetadata() {
    return this.index?.metadata ?? null;
  }

  clear() {
    this.generation += 1;
    for (const entry of this.bitmaps.values()) entry.bitmap?.close?.();
    this.index = null;
    this.bitmaps.clear();
    this.pending.clear();
    this.failedFrames.clear();
    this.frameFailures.clear();
    this.warned.clear();
    this.telemetry = initialTelemetry();
  }

  async loadIndex(source = DEFAULT_COMMISSIONED_INDEX_URL, options = {}) {
    try {
      const injectedIndex = isObject(source) && !(source instanceof URL);
      assertIndex(Boolean(this.fetchImpl) || injectedIndex, 'fetch is unavailable for an index URL');
      let rawIndex;
      let baseUrl;

      if (isObject(source) && !(source instanceof URL)) {
        rawIndex = source;
        baseUrl = new URL(options.baseUrl || source.baseUrl || './assets/commissioned/', import.meta.url).href;
      } else {
        const indexUrl = new URL(String(source), options.documentBase || import.meta.url).href;
        const response = await this.fetchImpl(indexUrl);
        if (!response?.ok || typeof response.json !== 'function') {
          throw new Error(`Unable to load commissioned-art index: ${response?.status ?? 'invalid response'}`);
        }
        rawIndex = await response.json();
        baseUrl = new URL(options.baseUrl || rawIndex.baseUrl || urlDirectory(indexUrl), indexUrl).href;
      }

      const nextIndex = await normaliseIndex(rawIndex, baseUrl);
      this.generation += 1;
      for (const entry of this.bitmaps.values()) entry.bitmap?.close?.();
      this.bitmaps.clear();
      this.pending.clear();
      this.failedFrames.clear();
      this.frameFailures.clear();
      this.warned.clear();
      this.index = nextIndex;
      this.telemetry = initialTelemetry();
      this.telemetry.indexLoads = 1;
      return { ...nextIndex.counts, baseUrl: nextIndex.baseUrl };
    } catch (error) {
      this.clear();
      throw error;
    }
  }

  async loadAndPrime(source = DEFAULT_COMMISSIONED_INDEX_URL, options = {}) {
    const index = await this.loadIndex(source, options);
    const prime = await this.prime(options.prime || {});
    return { index, prime };
  }

  resolveFrame(family, id, options = {}) {
    const assetKey = commissionedAssetKey(family, id);
    const requestedState = requireCanonicalState(options.state || 'active');
    const asset = this.index?.assets.get(assetKey);
    if (!asset) {
      this.recordWarning('missing', assetKey, 'Procedural fallback retained.');
      return null;
    }

    const ladder = RENDER_CONTRACT.stateFallbacks[requestedState];
    const resolvedState = ladder.find((state) => asset.states.has(state));
    if (!resolvedState) {
      this.recordWarning('missing', `${assetKey}:${requestedState}`, 'No indexed state is available; procedural fallback retained.');
      return null;
    }
    if (resolvedState !== requestedState) {
      this.recordWarning('stateFallback', `${assetKey}:${requestedState}`, `Using ${resolvedState} through the DEC-79 state fallback ladder.`);
    }

    const clip = asset.states.get(resolvedState);
    if (clip.broken) {
      this.recordWarning('brokenClip', `${assetKey}:${resolvedState}`, 'Declared clip is incomplete; static frame 01 retained.');
    }
    const reducedMotion = options.reducedMotion ?? this.prefersReducedMotion();
    const timeMs = Number.isFinite(options.elapsedMs) ? options.elapsedMs : this.clock();
    const frameNumber = frameNumberAt(clip, timeMs, reducedMotion);
    const frameEntry = clip.frames[frameNumber - 1];
    if (!frameEntry) {
      this.recordWarning('missing', assetId(asset.family, asset.id, resolvedState, frameNumber), 'Frame is absent; procedural fallback retained.');
      return null;
    }

    return this.createFrameDescriptor(asset, requestedState, resolvedState, clip, frameNumber, frameEntry, reducedMotion);
  }

  createFrameDescriptor(asset, requestedState, resolvedState, clip, frameNumber, frameEntry, reducedMotion) {
    const spriteClass = asset.spriteClass;
    return Object.freeze({
      assetKey: asset.key,
      cacheKey: assetId(asset.family, asset.id, resolvedState, frameNumber),
      generation: this.generation,
      family: asset.family,
      id: asset.id,
      className: asset.className,
      requestedState,
      state: resolvedState,
      usedStateFallback: requestedState !== resolvedState,
      frame: frameNumber,
      declaredFrames: clip.declaredFrames,
      availableFrames: clip.frames.length,
      frameMs: clip.frameMs,
      loop: clip.loop,
      brokenClip: clip.broken,
      reducedMotion,
      path: frameEntry.path,
      sha256: frameEntry.sha256,
      url: new URL(frameEntry.path, this.index.baseUrl).href,
      sourceWidth: spriteClass.canvasWidth,
      sourceHeight: spriteClass.canvasHeight,
      scale: spriteClass.scale,
      drawWidth: spriteClass.canvasWidth * spriteClass.scale,
      drawHeight: spriteClass.canvasHeight * spriteClass.scale,
      anchor: asset.anchor,
      screenOffset: Object.freeze({ x: asset.anchor.screenOffsetX, y: asset.anchor.screenOffsetY }),
    });
  }

  descriptorsForPrime(options = {}) {
    assertIndex(Boolean(this.index), 'loadIndex() must run before prime()');
    const assetFilter = Array.isArray(options.assets)
      ? new Map(options.assets.map((entry) => {
        if (typeof entry === 'string') return [entry, null];
        const key = commissionedAssetKey(entry.family, entry.id);
        const states = Array.isArray(entry.states) ? new Set(entry.states.map(requireCanonicalState)) : null;
        return [key, states];
      }))
      : null;
    const stateFilter = Array.isArray(options.states) ? new Set(options.states.map(requireCanonicalState)) : null;
    const reducedMotion = options.reducedMotion ?? this.prefersReducedMotion();
    const recordWarnings = options.recordWarnings !== false;
    const descriptors = [];

    for (const asset of this.index.assets.values()) {
      if (assetFilter && !assetFilter.has(asset.key)) continue;
      const selectedAssetStates = assetFilter?.get(asset.key) || null;
      for (const [stateName, clip] of asset.states) {
        if (selectedAssetStates && !selectedAssetStates.has(stateName)) continue;
        if (stateFilter && !stateFilter.has(stateName)) continue;
        if (clip.broken && recordWarnings) {
          this.recordWarning('brokenClip', `${asset.key}:${stateName}`, 'Declared clip is incomplete; static frame 01 retained.');
        }
        const limit = reducedMotion || clip.broken ? 1 : clip.frames.length;
        for (let index = 0; index < limit; index += 1) {
          const frameEntry = clip.frames[index];
          if (!frameEntry) {
            if (recordWarnings) this.recordWarning('missing', assetId(asset.family, asset.id, stateName, index + 1), 'Frame is absent; procedural fallback retained.');
            continue;
          }
          descriptors.push(this.createFrameDescriptor(asset, stateName, stateName, clip, index + 1, frameEntry, reducedMotion));
        }
      }
    }
    return descriptors;
  }

  async prime(options = {}) {
    const descriptors = this.descriptorsForPrime(options);
    const results = await Promise.all(descriptors.map((frame) => this.loadFrame(frame)));
    const loaded = results.filter(Boolean).length;
    return { requested: descriptors.length, loaded, failed: descriptors.length - loaded };
  }

  getFrameCoverage(options = {}) {
    if (!this.index) {
      return Object.freeze({ expected: 0, cached: 0, pending: 0, failed: 0, missing: 0, complete: false });
    }
    const descriptors = this.descriptorsForPrime({ ...options, reducedMotion: false, recordWarnings: false });
    const keys = descriptors.map((frame) => frame.cacheKey);
    const cached = keys.filter((key) => this.bitmaps.has(key)).length;
    const pending = keys.filter((key) => this.pending.has(key)).length;
    const failed = keys.filter((key) => this.failedFrames.has(key)).length;
    const missing = keys.filter((key) => this.frameFailures.get(key) === 'missing').length;
    return Object.freeze({
      expected: keys.length,
      cached,
      pending,
      failed,
      missing,
      complete: keys.length > 0 && cached === keys.length && pending === 0 && failed === 0,
    });
  }

  async primeOne(family, id, options = {}) {
    const frame = this.resolveFrame(family, id, options);
    return frame ? this.loadFrame(frame) : false;
  }

  async loadFrame(frame) {
    if (!frame || frame.generation !== this.generation) return false;
    if (this.bitmaps.has(frame.cacheKey)) {
      this.telemetry.cacheHits += 1;
      return true;
    }
    if (this.failedFrames.has(frame.cacheKey)) return false;
    if (this.pending.has(frame.cacheKey)) return this.pending.get(frame.cacheKey);
    if (!this.fetchImpl || !this.bitmapFactory) {
      this.recordWarning('decode', frame.cacheKey, 'Fetch or createImageBitmap is unavailable; procedural fallback retained.');
      this.recordFrameFailure(frame.cacheKey, 'decode', frame.generation);
      return false;
    }

    const generation = this.generation;
    let request;
    request = this.fetchAndDecode(frame, generation)
      .then((loaded) => {
        if (!loaded) this.recordFrameFailure(frame.cacheKey, 'unknown', generation);
        return loaded;
      })
      .finally(() => {
        if (this.pending.get(frame.cacheKey) === request) this.pending.delete(frame.cacheKey);
      });
    this.pending.set(frame.cacheKey, request);
    return request;
  }

  async fetchAndDecode(frame, generation) {
    if (generation !== this.generation) return false;
    this.telemetry.loadAttempts += 1;
    let response;
    try {
      response = await this.fetchImpl(frame.url);
    } catch (error) {
      this.recordWarning('decode', frame.cacheKey, `${error?.message || 'Fetch failed'}; procedural fallback retained.`, generation);
      this.recordFrameFailure(frame.cacheKey, 'decode', generation);
      return false;
    }
    if (generation !== this.generation) return false;
    if (!response?.ok || typeof response.blob !== 'function') {
      this.recordWarning('missing', frame.cacheKey, `PNG returned ${response?.status ?? 'an invalid response'}; procedural fallback retained.`, generation);
      this.recordFrameFailure(frame.cacheKey, 'missing', generation);
      return false;
    }

    try {
      const blob = await response.blob();
      if (generation !== this.generation) return false;
      let actualSha256;
      try {
        actualSha256 = await sha256Blob(blob);
      } catch (error) {
        this.recordWarning('integrity', frame.cacheKey, `${error?.message || 'SHA-256 verification failed'}; procedural fallback retained.`, generation);
        this.recordFrameFailure(frame.cacheKey, 'integrity', generation);
        return false;
      }
      if (generation !== this.generation) return false;
      if (actualSha256 !== frame.sha256) {
        this.recordWarning(
          'integrity',
          frame.cacheKey,
          `Fetched PNG SHA-256 ${actualSha256}; expected ${frame.sha256}. Procedural fallback retained.`,
          generation,
        );
        this.recordFrameFailure(frame.cacheKey, 'integrity', generation);
        return false;
      }
      if (generation !== this.generation) return false;
      const decodeStartedAt = this.clock();
      const bitmap = await this.bitmapFactory(blob);
      const decodeMs = this.clock() - decodeStartedAt;
      if (generation !== this.generation) {
        bitmap?.close?.();
        return false;
      }
      if (bitmap?.width !== frame.sourceWidth || bitmap?.height !== frame.sourceHeight) {
        bitmap?.close?.();
        this.recordWarning(
          'dimensions',
          frame.cacheKey,
          `Decoded ${bitmap?.width ?? '?'}x${bitmap?.height ?? '?'}; expected ${frame.sourceWidth}x${frame.sourceHeight}. Procedural fallback retained.`,
          generation,
        );
        this.recordFrameFailure(frame.cacheKey, 'dimensions', generation);
        return false;
      }
      this.bitmaps.set(frame.cacheKey, { bitmap, frame });
      this.telemetry.loadedBitmaps += 1;
      if (decodeMs > this.slowDecodeMs) {
        this.recordWarning('slow', frame.cacheKey, `${Math.round(decodeMs)}ms; cached ImageBitmap path preserved.`, generation);
      }
      return true;
    } catch (error) {
      this.recordWarning('decode', frame.cacheKey, `${error?.message || 'Decode failed'}; procedural fallback retained.`, generation);
      this.recordFrameFailure(frame.cacheKey, 'decode', generation);
      return false;
    }
  }

  draw(context, family, id, x, y, options = {}) {
    if (!context || typeof context.drawImage !== 'function') {
      throw new TypeError('CommissionedArtCache.draw requires a CanvasRenderingContext2D-compatible object.');
    }
    const frame = this.resolveFrame(family, id, options);
    const entry = frame && this.bitmaps.get(frame.cacheKey);
    if (!entry) {
      if (frame) {
        void this.loadFrame(frame);
      }
      this.telemetry.fallbackDrawn += 1;
      if (typeof options.fallback === 'function') {
        options.fallback({ frame, reason: frame ? 'not-ready' : 'missing' });
      }
      return false;
    }

    const { anchor } = frame;
    const screenX = x + anchor.screenOffsetX;
    const screenY = y + anchor.screenOffsetY;
    const drawX = Math.round(screenX - frame.drawWidth * anchor.x);
    const drawY = Math.round(screenY - frame.drawHeight * anchor.y);
    const alpha = finiteNumber(options.alpha, 1);
    context.save?.();
    if (Number.isFinite(context.globalAlpha)) context.globalAlpha *= alpha;
    context.imageSmoothingEnabled = false;
    context.drawImage(entry.bitmap, drawX, drawY, frame.drawWidth, frame.drawHeight);
    context.restore?.();
    this.telemetry.drawn += 1;
    return true;
  }

  recordWarning(kind, id, response, generation = this.generation) {
    if (generation !== this.generation) return false;
    const code = COMMISSIONED_WARNING_CODES[kind];
    const key = `${code}:${id}`;
    if (this.warned.has(key)) return false;
    this.warned.add(key);
    if (kind === 'missing') this.telemetry.missing += 1;
    if (kind === 'decode') this.telemetry.decodeFailures += 1;
    if (kind === 'integrity') this.telemetry.integrityFailures += 1;
    if (kind === 'dimensions') this.telemetry.invalidDimensions += 1;
    if (kind === 'slow') this.telemetry.slowDecodes += 1;
    if (kind === 'brokenClip') this.telemetry.brokenClips += 1;
    if (kind === 'stateFallback') this.telemetry.stateFallbacks += 1;
    this.onWarning({ code, id, response });
    return true;
  }

  recordFrameFailure(cacheKey, kind, generation = this.generation) {
    if (generation !== this.generation) return false;
    this.failedFrames.add(cacheKey);
    if (!this.frameFailures.has(cacheKey) || kind !== 'unknown') this.frameFailures.set(cacheKey, kind);
    return true;
  }
}
