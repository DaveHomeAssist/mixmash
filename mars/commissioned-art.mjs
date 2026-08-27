import { RENDER_CONTRACT, assetId } from './render-contract.mjs';

/* Generated index shape:
   {
     version, contractVersion, decision,
     assets: [{
       family, id, class, screenOffset?: { x, y },
       states: {
         active: { declaredFrames, frameMs, loop, frames: ['sprites/...f01.png'] }
       }
     }]
   }
   Frame paths are relative to index.json unless loadIndex receives baseUrl. */

export const COMMISSIONED_INDEX_VERSION = 1;
export const DEFAULT_COMMISSIONED_INDEX_URL = new URL('./assets/commissioned/index.json', import.meta.url);

export const COMMISSIONED_WARNING_CODES = Object.freeze({
  missing: 'COMMISSIONED_SPRITE_MISSING',
  decode: 'COMMISSIONED_DECODE_FAILED',
  dimensions: 'COMMISSIONED_INVALID_DIMENSIONS',
  slow: 'COMMISSIONED_SLOW_DECODE',
  brokenClip: 'COMMISSIONED_BROKEN_CLIP',
  stateFallback: 'COMMISSIONED_STATE_FALLBACK',
});

const CANONICAL_NAME = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

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

  const frames = source.frames.map((path) => (isRelativeFramePath(path) ? path : null));
  const broken = frames.length !== source.declaredFrames || frames.some((path) => path === null);
  return Object.freeze({
    name,
    declaredFrames: source.declaredFrames,
    frameMs: source.frameMs,
    loop: source.loop !== false,
    frames: Object.freeze(frames),
    broken,
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
  assertIndex(isObject(source.states) && Object.keys(source.states).length > 0, `${family}/${id} requires at least one state`);

  const states = new Map();
  for (const [stateName, stateSource] of Object.entries(source.states)) {
    states.set(stateName, normaliseState(stateName, stateSource));
  }

  return Object.freeze({
    key: commissionedAssetKey(family, id),
    family,
    id,
    className,
    spriteClass,
    anchor,
    states,
  });
}

function normaliseIndex(source, baseUrl) {
  assertIndex(isObject(source), 'root must be an object');
  assertIndex(source.version === COMMISSIONED_INDEX_VERSION, `version must be ${COMMISSIONED_INDEX_VERSION}`);
  assertIndex(source.contractVersion === RENDER_CONTRACT.version, `contractVersion must be ${RENDER_CONTRACT.version}`);
  assertIndex(source.decision === RENDER_CONTRACT.decision, `decision must be ${RENDER_CONTRACT.decision}`);
  assertIndex(Array.isArray(source.assets), 'assets must be an array');

  const assets = new Map();
  let states = 0;
  let frames = 0;
  let declaredFrames = 0;
  for (const sourceAsset of source.assets) {
    const asset = normaliseAsset(sourceAsset);
    assertIndex(!assets.has(asset.key), `duplicate asset ${asset.key}`);
    assets.set(asset.key, asset);
    states += asset.states.size;
    for (const state of asset.states.values()) {
      frames += state.frames.filter(Boolean).length;
      declaredFrames += state.declaredFrames;
    }
  }

  return Object.freeze({
    version: source.version,
    contractVersion: source.contractVersion,
    decision: source.decision,
    baseUrl,
    assets,
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
      indexedAssets: this.index?.counts.assets ?? 0,
      indexedStates: this.index?.counts.states ?? 0,
      indexedFrames: this.index?.counts.frames ?? 0,
      declaredFrames: this.index?.counts.declaredFrames ?? 0,
      cachedBitmaps: this.bitmaps.size,
      pendingBitmaps: this.pending.size,
      warningKeys: this.warned.size,
    };
  }

  clear() {
    this.generation += 1;
    for (const entry of this.bitmaps.values()) entry.bitmap?.close?.();
    this.index = null;
    this.bitmaps.clear();
    this.pending.clear();
    this.warned.clear();
    this.telemetry = initialTelemetry();
  }

  async loadIndex(source = DEFAULT_COMMISSIONED_INDEX_URL, options = {}) {
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

    const nextIndex = normaliseIndex(rawIndex, baseUrl);
    this.generation += 1;
    for (const entry of this.bitmaps.values()) entry.bitmap?.close?.();
    this.bitmaps.clear();
    this.pending.clear();
    this.warned.clear();
    this.index = nextIndex;
    this.telemetry = initialTelemetry();
    this.telemetry.indexLoads = 1;
    return { ...nextIndex.counts, baseUrl: nextIndex.baseUrl };
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
    const path = clip.frames[frameNumber - 1];
    if (!path) {
      this.recordWarning('missing', assetId(asset.family, asset.id, resolvedState, frameNumber), 'Frame is absent; procedural fallback retained.');
      return null;
    }

    return this.createFrameDescriptor(asset, requestedState, resolvedState, clip, frameNumber, path, reducedMotion);
  }

  createFrameDescriptor(asset, requestedState, resolvedState, clip, frameNumber, path, reducedMotion) {
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
      availableFrames: clip.frames.filter(Boolean).length,
      frameMs: clip.frameMs,
      loop: clip.loop,
      brokenClip: clip.broken,
      reducedMotion,
      path,
      url: new URL(path, this.index.baseUrl).href,
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
      ? new Set(options.assets.map((entry) => typeof entry === 'string' ? entry : commissionedAssetKey(entry.family, entry.id)))
      : null;
    const stateFilter = Array.isArray(options.states) ? new Set(options.states.map(requireCanonicalState)) : null;
    const reducedMotion = options.reducedMotion ?? this.prefersReducedMotion();
    const descriptors = [];

    for (const asset of this.index.assets.values()) {
      if (assetFilter && !assetFilter.has(asset.key)) continue;
      for (const [stateName, clip] of asset.states) {
        if (stateFilter && !stateFilter.has(stateName)) continue;
        if (clip.broken) {
          this.recordWarning('brokenClip', `${asset.key}:${stateName}`, 'Declared clip is incomplete; static frame 01 retained.');
        }
        const limit = reducedMotion || clip.broken ? 1 : clip.frames.length;
        for (let index = 0; index < limit; index += 1) {
          const path = clip.frames[index];
          if (!path) {
            this.recordWarning('missing', assetId(asset.family, asset.id, stateName, index + 1), 'Frame is absent; procedural fallback retained.');
            continue;
          }
          descriptors.push(this.createFrameDescriptor(asset, stateName, stateName, clip, index + 1, path, reducedMotion));
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
    if (this.pending.has(frame.cacheKey)) return this.pending.get(frame.cacheKey);
    if (!this.fetchImpl || !this.bitmapFactory) {
      this.recordWarning('decode', frame.cacheKey, 'Fetch or createImageBitmap is unavailable; procedural fallback retained.');
      return false;
    }

    const generation = this.generation;
    let request;
    request = this.fetchAndDecode(frame, generation)
      .finally(() => {
        if (this.pending.get(frame.cacheKey) === request) this.pending.delete(frame.cacheKey);
      });
    this.pending.set(frame.cacheKey, request);
    return request;
  }

  async fetchAndDecode(frame, generation) {
    this.telemetry.loadAttempts += 1;
    let response;
    try {
      response = await this.fetchImpl(frame.url);
    } catch (error) {
      this.recordWarning('decode', frame.cacheKey, `${error?.message || 'Fetch failed'}; procedural fallback retained.`);
      return false;
    }
    if (!response?.ok || typeof response.blob !== 'function') {
      this.recordWarning('missing', frame.cacheKey, `PNG returned ${response?.status ?? 'an invalid response'}; procedural fallback retained.`);
      return false;
    }

    try {
      const blob = await response.blob();
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
        );
        return false;
      }
      this.bitmaps.set(frame.cacheKey, { bitmap, frame });
      this.telemetry.loadedBitmaps += 1;
      if (decodeMs > this.slowDecodeMs) {
        this.recordWarning('slow', frame.cacheKey, `${Math.round(decodeMs)}ms; cached ImageBitmap path preserved.`);
      }
      return true;
    } catch (error) {
      this.recordWarning('decode', frame.cacheKey, `${error?.message || 'Decode failed'}; procedural fallback retained.`);
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

  recordWarning(kind, id, response) {
    const code = COMMISSIONED_WARNING_CODES[kind];
    const key = `${code}:${id}`;
    if (this.warned.has(key)) return false;
    this.warned.add(key);
    if (kind === 'missing') this.telemetry.missing += 1;
    if (kind === 'decode') this.telemetry.decodeFailures += 1;
    if (kind === 'dimensions') this.telemetry.invalidDimensions += 1;
    if (kind === 'slow') this.telemetry.slowDecodes += 1;
    if (kind === 'brokenClip') this.telemetry.brokenClips += 1;
    if (kind === 'stateFallback') this.telemetry.stateFallbacks += 1;
    this.onWarning({ code, id, response });
    return true;
  }
}
