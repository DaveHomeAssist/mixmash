import { palette, resolveSpriteId, spriteIds, spriteMap } from './sprites.mjs';

function hexToRgba(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [value >> 16, (value >> 8) & 255, value & 255, 255];
}

export function rasterizeSprite(id) {
  const resolvedId = resolveSpriteId(id);
  const rows = spriteMap(resolvedId);
  if (!rows) return null;
  const colors = palette();
  const width = rows[0].length;
  const height = rows.length;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const rgba = colors[rows[y][x]] ? hexToRgba(colors[rows[y][x]]) : [0, 0, 0, 0];
      data.set(rgba, (y * width + x) * 4);
    }
  }

  return { id: resolvedId, width, height, data };
}

async function createBrowserBitmap(raster) {
  if (typeof document === 'undefined' || typeof globalThis.createImageBitmap !== 'function') {
    throw new Error('ImageBitmap is unavailable');
  }
  const canvas = document.createElement('canvas');
  canvas.width = raster.width;
  canvas.height = raster.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  const imageData = context.createImageData(raster.width, raster.height);
  imageData.data.set(raster.data);
  context.putImageData(imageData, 0, 0);
  return globalThis.createImageBitmap(canvas);
}

export class SpriteBitmapCache {
  constructor(bitmapFactory = createBrowserBitmap, options = {}) {
    this.bitmapFactory = bitmapFactory;
    this.bitmaps = new Map();
    this.pending = new Map();
    this.slowDecodeMs = Number.isFinite(options.slowDecodeMs) ? options.slowDecodeMs : 100;
    this.onWarning = typeof options.onWarning === 'function'
      ? options.onWarning
      : (warning) => console.warn(`[MarsScape art] ${warning.code}: ${warning.id}`);
    this.warned = new Set();
  }

  get size() {
    return this.bitmaps.size;
  }

  has(id) {
    return this.bitmaps.has(resolveSpriteId(id));
  }

  async prime(ids = spriteIds()) {
    const results = await Promise.allSettled(ids.map((id) => this.primeOne(id)));
    return results.filter((result) => result.status === 'fulfilled' && result.value).length;
  }

  async primeOne(id) {
    const resolvedId = resolveSpriteId(id);
    if (this.bitmaps.has(resolvedId)) return true;
    if (this.pending.has(resolvedId)) return this.pending.get(resolvedId);
    const raster = rasterizeSprite(resolvedId);
    if (!raster) {
      this.warnOnce('SPRITE_MISSING', resolvedId, 'Procedural or emoji fallback retained.');
      return false;
    }
    const startedAt = Date.now();
    const request = this.bitmapFactory(raster)
      .then((bitmap) => {
        this.bitmaps.set(resolvedId, { bitmap, width: raster.width, height: raster.height });
        this.pending.delete(resolvedId);
        const decodeMs = Date.now() - startedAt;
        if (decodeMs > this.slowDecodeMs) {
          this.warnOnce('SPRITE_SLOW_DECODE', resolvedId, `${decodeMs}ms; cached ImageBitmap path preserved.`);
        }
        return true;
      })
      .catch((error) => {
        this.pending.delete(resolvedId);
        this.warnOnce('SPRITE_DECODE_FAILED', resolvedId, `${error?.message || 'Decode failed'}; procedural or emoji fallback retained.`);
        return false;
      });
    this.pending.set(resolvedId, request);
    return request;
  }

  drawSprite(context, id, x, y, options = {}) {
    const resolvedId = resolveSpriteId(id);
    const entry = this.bitmaps.get(resolvedId);
    if (!entry) {
      this.warnOnce('SPRITE_MISSING', resolvedId, 'Procedural or emoji fallback retained.');
      if (typeof options.fallback === 'function') options.fallback();
      return false;
    }

    const scale = Number.isFinite(options.scale) ? options.scale : 3;
    const width = entry.width * scale;
    const height = entry.height * scale;
    const anchor = options.anchor === 'feet' ? 'feet' : 'tile-centre';
    const drawX = Math.round(x - width / 2);
    const drawY = Math.round(anchor === 'feet' ? y - height : y - height / 2);

    context.save();
    context.globalAlpha *= Number.isFinite(options.alpha) ? options.alpha : 1;
    context.imageSmoothingEnabled = false;
    context.drawImage(entry.bitmap, drawX, drawY, width, height);
    context.restore();
    return true;
  }

  warnOnce(code, id, response) {
    const key = `${code}:${id}`;
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.onWarning({ code, id, response });
  }
}
