import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync, inflateSync } from 'node:zlib';
import { RENDER_CONTRACT, assetPath, footprintCornersFromCenter } from '../render-contract.mjs';
import { spriteHTML } from '../sprites.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MANIFEST_PATH = join(HERE, 'golden-slice.json');
export const DEFAULT_MARS_ROOT = dirname(HERE);
export const DEFAULT_RUNTIME_INDEX_PATH = join(DEFAULT_MARS_ROOT, 'assets', 'commissioned', 'index.json');
export const APPROVAL_REPORT_FILENAMES = Object.freeze({
  'artist-test': 'artist-test-approval.json',
  full: 'golden-approval.json',
});
export const ART_SCOPES = Object.freeze(['full', 'artist-test']);
export const RUNTIME_INDEX_VERSION = 2;
export const RUNTIME_IDENTITY_SCHEMA = 'marsscape-runtime-assets/v2';
const ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const FILE_PATTERN = /^sprites\/[a-z0-9]+(?:_[a-z0-9]+)*\/[a-z0-9]+(?:_[a-z0-9]+)*__[a-z0-9]+(?:_[a-z0-9]+)*__f\d{2}\.png$/;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_EDITABLE_SOURCE_BYTES = 32 * 1024 * 1024;
const MAX_EMBEDDED_PAYLOAD_BYTES = 16 * 1024 * 1024;
const MAX_KRA_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_KRA_DECODED_TILE_BYTES = 64 * 1024 * 1024;
const MAX_KRA_XML_NODES = 100000;
const MAX_NATIVE_DECODED_BYTES = 32 * 1024 * 1024;
const MAX_COMMISSIONED_PNG_BYTES = 4 * 1024 * 1024;
const MAX_PNG_COMPRESSED_BYTES = 2 * 1024 * 1024;
const COMMISSIONED_PNG_LIMITS = Object.freeze({
  fileBytes: MAX_COMMISSIONED_PNG_BYTES,
  compressedBytes: MAX_PNG_COMPRESSED_BYTES,
  decodedBytes: MAX_EMBEDDED_PAYLOAD_BYTES,
});
const VISUAL_DIFF_PNG_LIMITS = Object.freeze({
  fileBytes: 32 * 1024 * 1024,
  compressedBytes: 32 * 1024 * 1024,
  decodedBytes: 64 * 1024 * 1024,
});
const EDITABLE_VALIDATORS = Object.freeze({
  aseprite: validateAsepriteSource,
  kra: validateKraSource,
  psd: validatePsdSource,
});

function requireBytes(buffer, offset, length, label) {
  if (!Buffer.isBuffer(buffer) || offset < 0 || length < 0 || offset + length > buffer.length) {
    throw new Error(`${label} is truncated`);
  }
}

function validateAsepriteSource(buffer, expectedCanvas = null) {
  requireBytes(buffer, 0, 128, 'Aseprite header');
  if (buffer.readUInt32LE(0) !== buffer.length) throw new Error('Aseprite file-size header does not match the document');
  if (buffer.readUInt16LE(4) !== 0xa5e0) throw new Error('Aseprite header magic is invalid');
  const frameCount = buffer.readUInt16LE(6);
  const width = buffer.readUInt16LE(8);
  const height = buffer.readUInt16LE(10);
  const depth = buffer.readUInt16LE(12);
  if (!frameCount || frameCount > 10000 || !width || !height || width > 8192 || height > 8192 || ![8, 16, 32].includes(depth)) {
    throw new Error('Aseprite header must declare frames, dimensions, and a supported colour depth');
  }
  if (expectedCanvas && (width !== expectedCanvas.width || height !== expectedCanvas.height)) {
    throw new Error(`editable canvas is ${width}x${height}; expected ${expectedCanvas.width}x${expectedCanvas.height}`);
  }

  const layerTypes = [];
  const cels = new Map();
  let decodedCelBytes = 0;
  let frameOffset = 128;
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    requireBytes(buffer, frameOffset, 16, `Aseprite frame ${frameIndex + 1} header`);
    const frameSize = buffer.readUInt32LE(frameOffset);
    if (frameSize < 16) throw new Error(`Aseprite frame ${frameIndex + 1} size is invalid`);
    const frameEnd = frameOffset + frameSize;
    requireBytes(buffer, frameOffset, frameSize, `Aseprite frame ${frameIndex + 1}`);
    if (buffer.readUInt16LE(frameOffset + 4) !== 0xf1fa) throw new Error(`Aseprite frame ${frameIndex + 1} magic is invalid`);
    const oldChunkCount = buffer.readUInt16LE(frameOffset + 6);
    const newChunkCount = buffer.readUInt32LE(frameOffset + 12);
    const chunkCount = newChunkCount || oldChunkCount;
    if (!chunkCount || (oldChunkCount === 0xffff && !newChunkCount)) {
      throw new Error(`Aseprite frame ${frameIndex + 1} does not declare chunks`);
    }

    let chunkOffset = frameOffset + 16;
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
      requireBytes(buffer, chunkOffset, 6, `Aseprite frame ${frameIndex + 1} chunk ${chunkIndex + 1}`);
      const chunkSize = buffer.readUInt32LE(chunkOffset);
      if (chunkSize < 6 || chunkOffset + chunkSize > frameEnd) {
        throw new Error(`Aseprite frame ${frameIndex + 1} chunk ${chunkIndex + 1} size is invalid`);
      }
      const chunkType = buffer.readUInt16LE(chunkOffset + 4);
      const dataOffset = chunkOffset + 6;
      const dataLength = chunkSize - 6;

      if (chunkType === 0x2004) {
        if (frameIndex !== 0) throw new Error('Aseprite layer chunks must be declared in the first frame');
        requireBytes(buffer, dataOffset, 18, 'Aseprite layer chunk');
        const layerType = buffer.readUInt16LE(dataOffset + 2);
        if (layerType > 2) throw new Error(`Aseprite layer type ${layerType} is invalid`);
        const nameLength = buffer.readUInt16LE(dataOffset + 16);
        if (!nameLength || 18 + nameLength > dataLength) throw new Error('Aseprite layer name is missing or truncated');
        layerTypes.push(layerType);
      } else if (chunkType === 0x2005) {
        requireBytes(buffer, dataOffset, 18, 'Aseprite cel chunk');
        const layerIndex = buffer.readUInt16LE(dataOffset);
        const celType = buffer.readUInt16LE(dataOffset + 7);
        if (celType > 3) throw new Error(`Aseprite cel type ${celType} is invalid`);
        const celKey = `${frameIndex}:${layerIndex}`;
        if (cels.has(celKey)) throw new Error(`Aseprite frame ${frameIndex + 1} repeats a cel for layer ${layerIndex}`);
        const cel = { frameIndex, layerIndex, type: celType, linkedFrame: null, hasPixels: false };
        if (celType === 0 || celType === 2) {
          requireBytes(buffer, dataOffset + 16, 4, 'Aseprite image cel dimensions');
          const celWidth = buffer.readUInt16LE(dataOffset + 16);
          const celHeight = buffer.readUInt16LE(dataOffset + 18);
          if (!celWidth || !celHeight) throw new Error('Aseprite image cel dimensions are invalid');
          const pixelBytes = (depth / 8) * celWidth * celHeight;
          if (!Number.isSafeInteger(pixelBytes) || pixelBytes > MAX_EMBEDDED_PAYLOAD_BYTES) throw new Error('Aseprite image cel exceeds validation limits');
          decodedCelBytes += pixelBytes;
          if (!Number.isSafeInteger(decodedCelBytes) || decodedCelBytes > MAX_NATIVE_DECODED_BYTES) throw new Error('Aseprite cels exceed the aggregate decoded-output limit');
          const payload = buffer.subarray(dataOffset + 20, chunkOffset + chunkSize);
          if (celType === 0 && payload.length !== pixelBytes) throw new Error('Aseprite raw cel pixel data is incomplete');
          if (celType === 2) {
            if (!payload.length) throw new Error('Aseprite compressed cel pixel data is missing');
            let inflated;
            try {
              inflated = inflateSync(payload, { maxOutputLength: pixelBytes });
            } catch {
              throw new Error('Aseprite compressed cel pixel data is invalid');
            }
            if (inflated.length !== pixelBytes) throw new Error('Aseprite compressed cel pixel data has the wrong size');
          }
          cel.hasPixels = true;
        } else if (celType === 1) {
          requireBytes(buffer, dataOffset + 16, 2, 'Aseprite linked cel');
          cel.linkedFrame = buffer.readUInt16LE(dataOffset + 16);
          if (cel.linkedFrame >= frameCount) throw new Error('Aseprite linked cel references an invalid frame');
        } else {
          throw new Error('Aseprite tilemap cels are not usable sprite-source pixel payloads');
        }
        cels.set(celKey, cel);
      }
      chunkOffset += chunkSize;
    }
    if (chunkOffset !== frameEnd) throw new Error(`Aseprite frame ${frameIndex + 1} chunk sizes do not fill the frame`);
    frameOffset = frameEnd;
  }

  if (frameOffset !== buffer.length) throw new Error('Aseprite document has trailing or unparsed frame data');
  if (!layerTypes.some((type) => type === 0)) throw new Error('Aseprite document has no editable image layer');
  for (const cel of cels.values()) {
    if (cel.layerIndex >= layerTypes.length || layerTypes[cel.layerIndex] !== 0) {
      throw new Error(`Aseprite cel references layer ${cel.layerIndex}, which is not an editable image layer`);
    }
  }
  const resolved = new Set();
  const resolving = new Set();
  const resolveCel = (key) => {
    if (resolved.has(key)) return true;
    if (resolving.has(key)) throw new Error('Aseprite linked cels contain a cycle');
    const cel = cels.get(key);
    if (!cel) throw new Error('Aseprite linked cel does not resolve to pixel data');
    if (cel.hasPixels) {
      resolved.add(key);
      return true;
    }
    if (cel.type !== 1) throw new Error('Aseprite cel does not contain usable pixel data');
    resolving.add(key);
    resolveCel(`${cel.linkedFrame}:${cel.layerIndex}`);
    resolving.delete(key);
    resolved.add(key);
    return true;
  };
  for (const key of cels.keys()) resolveCel(key);
  if (![...cels.values()].some((cel) => cel.hasPixels)) throw new Error('Aseprite document has no real pixel payload');
  return { width, height, depth, layers: layerTypes.length, cels: cels.size };
}

function readPsdSection(buffer, offset, label) {
  requireBytes(buffer, offset, 4, `${label} length`);
  const length = buffer.readUInt32BE(offset);
  const start = offset + 4;
  requireBytes(buffer, start, length, label);
  return { start, end: start + length, length };
}

function validatePackBitsRow(buffer, expectedBytes, label) {
  let offset = 0;
  let outputBytes = 0;
  while (offset < buffer.length) {
    const control = buffer.readInt8(offset);
    offset += 1;
    if (control >= 0) {
      const count = control + 1;
      requireBytes(buffer, offset, count, label);
      offset += count;
      outputBytes += count;
    } else if (control >= -127) {
      requireBytes(buffer, offset, 1, label);
      offset += 1;
      outputBytes += 1 - control;
    }
    if (outputBytes > expectedBytes) throw new Error(`${label} expands beyond its row width`);
  }
  if (outputBytes !== expectedBytes) throw new Error(`${label} expands to ${outputBytes} bytes; expected ${expectedBytes}`);
}

function validatePsdPixelData(buffer, offset, length, rowBytes, rows, label, decodedBudget) {
  requireBytes(buffer, offset, length, label);
  if (length < 2) throw new Error(`${label} is missing pixel data`);
  if (!rowBytes || !rows) {
    if (length !== 2 || buffer.readUInt16BE(offset) > 3) throw new Error(`${label} has invalid empty pixel data`);
    return;
  }
  const expectedBytes = rowBytes * rows;
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes > MAX_EMBEDDED_PAYLOAD_BYTES) throw new Error(`${label} exceeds validation limits`);
  if (expectedBytes > decodedBudget.remaining) throw new Error(`${label} exceeds the aggregate decoded-output limit`);
  decodedBudget.remaining -= expectedBytes;
  const compression = buffer.readUInt16BE(offset);
  const payload = buffer.subarray(offset + 2, offset + length);
  if (compression === 0) {
    if (payload.length !== expectedBytes) throw new Error(`${label} raw payload is ${payload.length} bytes; expected ${expectedBytes}`);
  } else if (compression === 1) {
    const tableBytes = rows * 2;
    requireBytes(payload, 0, tableBytes, `${label} RLE row table`);
    let rowOffset = tableBytes;
    for (let row = 0; row < rows; row += 1) {
      const compressedRowBytes = payload.readUInt16BE(row * 2);
      requireBytes(payload, rowOffset, compressedRowBytes, `${label} RLE row ${row + 1}`);
      validatePackBitsRow(payload.subarray(rowOffset, rowOffset + compressedRowBytes), rowBytes, `${label} RLE row ${row + 1}`);
      rowOffset += compressedRowBytes;
    }
    if (rowOffset !== payload.length) throw new Error(`${label} RLE payload has trailing bytes`);
  } else if (compression === 2 || compression === 3) {
    let inflated;
    try {
      inflated = inflateSync(payload, { maxOutputLength: expectedBytes });
    } catch {
      throw new Error(`${label} ZIP payload cannot be decompressed`);
    }
    if (inflated.length !== expectedBytes) throw new Error(`${label} ZIP payload expands to ${inflated.length} bytes; expected ${expectedBytes}`);
  } else throw new Error(`${label} compression ${compression} is invalid`);
}

function validatePsdSource(buffer) {
  requireBytes(buffer, 0, 26, 'PSD header');
  if (buffer.toString('ascii', 0, 4) !== '8BPS' || buffer.readUInt16BE(4) !== 1) throw new Error('PSD header signature or version is invalid');
  if (!buffer.subarray(6, 12).equals(Buffer.alloc(6))) throw new Error('PSD reserved header bytes are invalid');
  const channels = buffer.readUInt16BE(12);
  const height = buffer.readUInt32BE(14);
  const width = buffer.readUInt32BE(18);
  const depth = buffer.readUInt16BE(22);
  const colorMode = buffer.readUInt16BE(24);
  if (channels < 1 || channels > 56 || !width || !height || width > 300000 || height > 300000) {
    throw new Error('PSD header dimensions or channel count is invalid');
  }
  if (![1, 8, 16, 32].includes(depth) || colorMode > 9) throw new Error('PSD header depth or colour mode is invalid');

  const colorData = readPsdSection(buffer, 26, 'PSD colour-mode data');
  const resources = readPsdSection(buffer, colorData.end, 'PSD image resources');
  const layerMask = readPsdSection(buffer, resources.end, 'PSD layer and mask information');
  if (layerMask.length < 10) throw new Error('PSD layer and mask section is missing');
  const layerInfo = readPsdSection(buffer, layerMask.start, 'PSD layer information');
  if (layerInfo.end > layerMask.end || layerInfo.length < 2) throw new Error('PSD layer information is outside its section');
  const signedLayerCount = buffer.readInt16BE(layerInfo.start);
  const layerCount = Math.abs(signedLayerCount);
  if (!layerCount || layerCount > 10000) throw new Error('PSD document has no editable layers');

  let recordOffset = layerInfo.start + 2;
  const channelEntries = [];
  const decodedBudget = { remaining: MAX_NATIVE_DECODED_BYTES };
  let layerWithPixelData = false;
  for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
    requireBytes(buffer, recordOffset, 18, `PSD layer ${layerIndex + 1} record`);
    const top = buffer.readInt32BE(recordOffset);
    const left = buffer.readInt32BE(recordOffset + 4);
    const bottom = buffer.readInt32BE(recordOffset + 8);
    const right = buffer.readInt32BE(recordOffset + 12);
    const layerWidth = right - left;
    const layerHeight = bottom - top;
    if (layerWidth < 0 || layerHeight < 0 || layerWidth > 300000 || layerHeight > 300000) throw new Error(`PSD layer ${layerIndex + 1} bounds are invalid`);
    const layerChannels = buffer.readUInt16BE(recordOffset + 16);
    if (layerChannels > 56) throw new Error(`PSD layer ${layerIndex + 1} channel count is invalid`);
    if (bottom > top && right > left && layerChannels > 0) layerWithPixelData = true;
    recordOffset += 18;
    requireBytes(buffer, recordOffset, layerChannels * 6, `PSD layer ${layerIndex + 1} channel records`);
    const layerChannelEntries = [];
    for (let channel = 0; channel < layerChannels; channel += 1) {
      const id = buffer.readInt16BE(recordOffset);
      const channelLength = buffer.readUInt32BE(recordOffset + 2);
      if (channelLength < 2) throw new Error(`PSD layer ${layerIndex + 1} channel ${channel + 1} data is missing`);
      layerChannelEntries.push({ id, length: channelLength, width: layerWidth, height: layerHeight, layerIndex, channel });
      recordOffset += 6;
    }
    requireBytes(buffer, recordOffset, 16, `PSD layer ${layerIndex + 1} blend record`);
    if (buffer.toString('ascii', recordOffset, recordOffset + 4) !== '8BIM') throw new Error(`PSD layer ${layerIndex + 1} blend signature is invalid`);
    recordOffset += 12;
    const extraLength = buffer.readUInt32BE(recordOffset);
    recordOffset += 4;
    const extraEnd = recordOffset + extraLength;
    if (extraEnd > layerInfo.end) throw new Error(`PSD layer ${layerIndex + 1} extra data is truncated`);
    const mask = readPsdSection(buffer, recordOffset, `PSD layer ${layerIndex + 1} mask data`);
    if (layerChannelEntries.some((entry) => entry.id === -2 || entry.id === -3)) {
      if (mask.length < 16) throw new Error(`PSD layer ${layerIndex + 1} mask channel has no mask bounds`);
      const maskTop = buffer.readInt32BE(mask.start);
      const maskLeft = buffer.readInt32BE(mask.start + 4);
      const maskBottom = buffer.readInt32BE(mask.start + 8);
      const maskRight = buffer.readInt32BE(mask.start + 12);
      const maskWidth = maskRight - maskLeft;
      const maskHeight = maskBottom - maskTop;
      if (maskWidth < 0 || maskHeight < 0 || maskWidth > 300000 || maskHeight > 300000) throw new Error(`PSD layer ${layerIndex + 1} mask bounds are invalid`);
      for (const entry of layerChannelEntries) {
        if (entry.id === -2 || entry.id === -3) {
          entry.width = maskWidth;
          entry.height = maskHeight;
        }
      }
    }
    const ranges = readPsdSection(buffer, mask.end, `PSD layer ${layerIndex + 1} blending ranges`);
    if (ranges.end >= extraEnd) throw new Error(`PSD layer ${layerIndex + 1} name is missing`);
    const nameLength = buffer[ranges.end];
    const paddedNameLength = (nameLength + 1 + 3) & ~3;
    if (ranges.end + paddedNameLength > extraEnd) throw new Error(`PSD layer ${layerIndex + 1} name is truncated`);
    channelEntries.push(...layerChannelEntries);
    recordOffset = extraEnd;
  }
  if (!layerWithPixelData) throw new Error('PSD document has no editable layer with pixel bounds and channel data');

  for (const entry of channelEntries) {
    const label = `PSD layer ${entry.layerIndex + 1} channel ${entry.channel + 1} image data`;
    const rowBytes = Math.ceil((entry.width * depth) / 8);
    validatePsdPixelData(buffer, recordOffset, entry.length, rowBytes, entry.height, label, decodedBudget);
    recordOffset += entry.length;
  }
  if (recordOffset > layerInfo.end) throw new Error('PSD layer channel data exceeds the layer information section');

  if (layerInfo.end < layerMask.end) {
    const globalMask = readPsdSection(buffer, layerInfo.end, 'PSD global layer mask');
    if (globalMask.end > layerMask.end) throw new Error('PSD global layer mask exceeds its section');
  }
  validatePsdPixelData(
    buffer,
    layerMask.end,
    buffer.length - layerMask.end,
    Math.ceil((width * depth) / 8),
    height * channels,
    'PSD composite image data',
    decodedBudget,
  );
  return { width, height, depth, layers: layerCount };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipEntries(buffer) {
  requireBytes(buffer, 0, 22, 'KRA ZIP container');
  if (buffer.length > MAX_EDITABLE_SOURCE_BYTES) throw new Error('KRA ZIP source exceeds the validation limit');
  let eocdOffset = -1;
  const searchStart = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      const commentLength = buffer.readUInt16LE(offset + 20);
      if (offset + 22 + commentLength === buffer.length) {
        eocdOffset = offset;
        break;
      }
    }
  }
  if (eocdOffset < 0) throw new Error('KRA ZIP end-of-directory record is missing');
  if (buffer.readUInt16LE(eocdOffset + 4) || buffer.readUInt16LE(eocdOffset + 6)) throw new Error('KRA ZIP multi-disk archives are unsupported');
  const diskEntries = buffer.readUInt16LE(eocdOffset + 8);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (!entryCount || entryCount !== diskEntries || entryCount > 10000) throw new Error('KRA ZIP entry count is invalid');
  if (centralOffset + centralSize !== eocdOffset) throw new Error('KRA ZIP central directory bounds are invalid');

  const centralEntries = [];
  const names = new Set();
  let centralCursor = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < entryCount; index += 1) {
    requireBytes(buffer, centralCursor, 46, `KRA ZIP central entry ${index + 1}`);
    if (buffer.readUInt32LE(centralCursor) !== 0x02014b50) throw new Error(`KRA ZIP central entry ${index + 1} signature is invalid`);
    const flags = buffer.readUInt16LE(centralCursor + 8);
    const method = buffer.readUInt16LE(centralCursor + 10);
    const expectedCrc = buffer.readUInt32LE(centralCursor + 16);
    const compressedSize = buffer.readUInt32LE(centralCursor + 20);
    const uncompressedSize = buffer.readUInt32LE(centralCursor + 24);
    const nameLength = buffer.readUInt16LE(centralCursor + 28);
    const extraLength = buffer.readUInt16LE(centralCursor + 30);
    const commentLength = buffer.readUInt16LE(centralCursor + 32);
    const localOffset = buffer.readUInt32LE(centralCursor + 42);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) throw new Error('KRA ZIP64 archives are unsupported');
    if (compressedSize > MAX_EMBEDDED_PAYLOAD_BYTES || uncompressedSize > MAX_EMBEDDED_PAYLOAD_BYTES) throw new Error('KRA ZIP member exceeds the validation limit');
    totalUncompressed += uncompressedSize;
    if (!Number.isSafeInteger(totalUncompressed) || totalUncompressed > MAX_KRA_TOTAL_BYTES) throw new Error('KRA ZIP expands beyond the validation limit');
    requireBytes(buffer, centralCursor + 46, nameLength + extraLength + commentLength, `KRA ZIP central entry ${index + 1} metadata`);
    const name = buffer.toString('utf8', centralCursor + 46, centralCursor + 46 + nameLength);
    if (!name || name.includes('\ufffd') || name.includes('\\') || name.startsWith('/') || name.split('/').includes('..') || names.has(name)) {
      throw new Error(`KRA ZIP member name ${name || '(empty)'} is invalid`);
    }
    if (flags & 1 || ![0, 8].includes(method)) throw new Error(`KRA ZIP member ${name} uses unsupported encryption or compression`);
    names.add(name);
    centralEntries.push({ name, flags, method, expectedCrc, compressedSize, uncompressedSize, localOffset });
    centralCursor += 46 + nameLength + extraLength + commentLength;
  }
  if (centralCursor !== eocdOffset) throw new Error('KRA ZIP central directory size does not match its entries');

  const entries = new Map();
  const order = [];
  for (const entry of centralEntries) {
    const { name, flags, method, expectedCrc, compressedSize, uncompressedSize, localOffset } = entry;
    requireBytes(buffer, localOffset, 30, `KRA ZIP local entry ${name}`);
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`KRA ZIP local entry ${name} signature is invalid`);
    const localFlags = buffer.readUInt16LE(localOffset + 6);
    const localMethod = buffer.readUInt16LE(localOffset + 8);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    requireBytes(buffer, localOffset + 30, localNameLength + localExtraLength, `KRA ZIP local entry ${name} metadata`);
    const localName = buffer.toString('utf8', localOffset + 30, localOffset + 30 + localNameLength);
    if (localName !== name || localMethod !== method || localFlags !== flags) throw new Error(`KRA ZIP local entry ${name} disagrees with the central directory`);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    requireBytes(buffer, dataOffset, compressedSize, `KRA ZIP member ${name}`);
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    let data;
    try {
      data = method === 0
        ? Buffer.from(compressed)
        : inflateRawSync(compressed, { maxOutputLength: Math.max(1, uncompressedSize) });
    } catch {
      throw new Error(`KRA ZIP member ${name} cannot be decompressed`);
    }
    if (data.length !== uncompressedSize || crc32(data) !== expectedCrc) throw new Error(`KRA ZIP member ${name} size or checksum is invalid`);
    entries.set(name, { data, method });
    order.push(name);
  }
  return { entries, order };
}

function validatePngContainer(buffer, label) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 45 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${label} is not a PNG`);
  let offset = 8;
  let hasHeader = false;
  let hasImageData = false;
  let hasEnd = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > buffer.length) throw new Error(`${label} has a truncated ${type || 'unknown'} chunk`);
    if (type === 'IHDR') {
      if (hasHeader || length !== 13 || !buffer.readUInt32BE(offset + 8) || !buffer.readUInt32BE(offset + 12)) throw new Error(`${label} has an invalid IHDR chunk`);
      hasHeader = true;
    } else if (type === 'IDAT') hasImageData = true;
    else if (type === 'IEND') {
      if (length !== 0 || end !== buffer.length) throw new Error(`${label} has an invalid IEND chunk`);
      hasEnd = true;
      break;
    }
    offset = end;
  }
  if (!hasHeader || !hasImageData || !hasEnd) throw new Error(`${label} is missing required PNG chunks`);
}

function decodeXmlEntities(value) {
  let output = '';
  let offset = 0;
  while (offset < value.length) {
    const ampersand = value.indexOf('&', offset);
    if (ampersand < 0) return output + value.slice(offset);
    output += value.slice(offset, ampersand);
    const semicolon = value.indexOf(';', ampersand + 1);
    if (semicolon < 0) throw new Error('KRA maindoc.xml contains an unterminated entity reference');
    const entity = value.slice(ampersand, semicolon + 1);
    const name = value.slice(ampersand + 1, semicolon);
    const named = { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"' }[name];
    if (named) output += named;
    else {
    const numeric = /^#(\d+)$/.exec(name) || /^#x([\da-f]+)$/i.exec(name);
    if (!numeric) throw new Error(`KRA maindoc.xml uses unsupported entity ${entity}`);
    const codePoint = Number.parseInt(numeric[1], name[1] === 'x' ? 16 : 10);
    const validXmlCharacter = codePoint === 0x9 || codePoint === 0xa || codePoint === 0xd
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    if (!Number.isSafeInteger(codePoint) || !validXmlCharacter) {
      throw new Error(`KRA maindoc.xml uses invalid character entity ${entity}`);
    }
      output += String.fromCodePoint(codePoint);
    }
    offset = semicolon + 1;
  }
  return output;
}

function validateRawXmlCharacters(value, label, options = {}) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    const valid = codePoint === 0x9 || codePoint === 0xa || codePoint === 0xd
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    if (!valid) throw new Error(`KRA maindoc.xml contains an XML-1.0-disallowed character in ${label}`);
  }
  if (options.attribute && value.includes('<')) throw new Error(`KRA maindoc.xml contains raw < in ${label}`);
  if (options.text && value.includes(']]>')) throw new Error('KRA maindoc.xml contains raw ]]> outside CDATA');
}

function parseXmlTag(content) {
  let offset = 0;
  const skipSpace = () => { while (/\s/.test(content[offset] || '')) offset += 1; };
  skipSpace();
  const name = /^[A-Za-z_:][\w:.-]*/.exec(content.slice(offset))?.[0];
  if (!name) throw new Error('KRA maindoc.xml contains a malformed tag');
  offset += name.length;
  const attributes = {};
  while (offset < content.length) {
    skipSpace();
    if (offset === content.length) break;
    const attribute = /^[A-Za-z_:][\w:.-]*/.exec(content.slice(offset))?.[0];
    if (!attribute || Object.hasOwn(attributes, attribute)) throw new Error('KRA maindoc.xml contains malformed or duplicate attributes');
    offset += attribute.length;
    skipSpace();
    if (content[offset] !== '=') throw new Error('KRA maindoc.xml contains an unassigned attribute');
    offset += 1;
    skipSpace();
    const quote = content[offset];
    if (quote !== '"' && quote !== "'") throw new Error('KRA maindoc.xml attribute values must be quoted');
    const end = content.indexOf(quote, offset + 1);
    if (end < 0) throw new Error('KRA maindoc.xml contains an unterminated attribute');
    const rawValue = content.slice(offset + 1, end);
    validateRawXmlCharacters(rawValue, `attribute ${attribute}`, { attribute: true });
    attributes[attribute] = decodeXmlEntities(rawValue);
    offset = end + 1;
  }
  return { name, attributes, children: [] };
}

function parseKraXml(xml) {
  validateRawXmlCharacters(xml, 'document');
  if (xml.includes('\0') || /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('KRA maindoc.xml cannot contain DTDs or entity declarations');
  const stack = [];
  let root = null;
  let offset = 0;
  let nodes = 0;
  let sawDeclaration = false;
  while (offset < xml.length) {
    const open = xml.indexOf('<', offset);
    if (open < 0) {
      const trailingText = xml.slice(offset);
      if (!stack.length && trailingText.trim()) throw new Error('KRA maindoc.xml has text outside its root element');
      if (stack.length) {
        validateRawXmlCharacters(trailingText, 'element text', { text: true });
        decodeXmlEntities(trailingText);
      }
      break;
    }
    const text = xml.slice(offset, open);
    if (!stack.length && text.trim()) throw new Error('KRA maindoc.xml has text outside its root element');
    if (stack.length) {
      validateRawXmlCharacters(text, 'element text', { text: true });
      decodeXmlEntities(text);
    }
    if (xml.startsWith('<!--', open)) {
      const end = xml.indexOf('-->', open + 4);
      if (end < 0 || xml.slice(open + 4, end).includes('--')) throw new Error('KRA maindoc.xml contains a malformed comment');
      offset = end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', open)) {
      if (!stack.length) throw new Error('KRA maindoc.xml has CDATA outside its root element');
      const end = xml.indexOf(']]>', open + 9);
      if (end < 0) throw new Error('KRA maindoc.xml contains unterminated CDATA');
      offset = end + 3;
      continue;
    }
    if (xml.startsWith('<?', open)) {
      const end = xml.indexOf('?>', open + 2);
      if (end < 0 || sawDeclaration || root || stack.length || !/^<\?xml\s[^?]*\?>$/.test(xml.slice(open, end + 2))) throw new Error('KRA maindoc.xml contains an invalid processing instruction');
      sawDeclaration = true;
      offset = end + 2;
      continue;
    }
    let close = open + 1;
    let quote = null;
    for (; close < xml.length; close += 1) {
      const character = xml[close];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'") quote = character;
      else if (character === '>') break;
    }
    if (close >= xml.length) throw new Error('KRA maindoc.xml contains an unterminated tag');
    let content = xml.slice(open + 1, close).trim();
    if (!content || content.startsWith('!')) throw new Error('KRA maindoc.xml contains unsupported markup');
    if (content.startsWith('/')) {
      const closingName = content.slice(1).trim();
      if (!/^[A-Za-z_:][\w:.-]*$/.test(closingName) || stack.pop()?.name !== closingName) throw new Error('KRA maindoc.xml has malformed nesting');
    } else {
      const selfClosing = content.endsWith('/');
      if (selfClosing) content = content.slice(0, -1).trimEnd();
      const node = parseXmlTag(content);
      nodes += 1;
      if (nodes > MAX_KRA_XML_NODES) throw new Error('KRA maindoc.xml exceeds the structural node limit');
      if (stack.length) stack.at(-1).children.push(node);
      else if (root) throw new Error('KRA maindoc.xml has multiple root elements');
      else root = node;
      if (!selfClosing) stack.push(node);
    }
    offset = close + 1;
  }
  if (stack.length || !root) throw new Error('KRA maindoc.xml has malformed nesting');
  return root;
}

function inflateLzf(buffer, expectedBytes, label) {
  const output = Buffer.alloc(expectedBytes);
  let inputOffset = 0;
  let outputOffset = 0;
  while (inputOffset < buffer.length) {
    const control = buffer[inputOffset];
    inputOffset += 1;
    if (control < 32) {
      const length = control + 1;
      requireBytes(buffer, inputOffset, length, label);
      if (outputOffset + length > expectedBytes) throw new Error(`${label} expands beyond the tile size`);
      buffer.copy(output, outputOffset, inputOffset, inputOffset + length);
      inputOffset += length;
      outputOffset += length;
    } else {
      let length = control >> 5;
      let reference = outputOffset - ((control & 0x1f) << 8) - 1;
      if (length === 7) {
        requireBytes(buffer, inputOffset, 1, label);
        length += buffer[inputOffset];
        inputOffset += 1;
      }
      requireBytes(buffer, inputOffset, 1, label);
      reference -= buffer[inputOffset];
      inputOffset += 1;
      length += 2;
      if (reference < 0 || outputOffset + length > expectedBytes) throw new Error(`${label} has an invalid back-reference`);
      for (let index = 0; index < length; index += 1) output[outputOffset++] = output[reference++];
    }
  }
  if (outputOffset !== expectedBytes) throw new Error(`${label} expands to ${outputOffset} bytes; expected ${expectedBytes}`);
  return output;
}

function validateKritaLayerData(buffer, label, decodedBudget) {
  const lines = [];
  let offset = 0;
  for (let index = 0; index < 5; index += 1) {
    const end = buffer.indexOf(10, offset);
    if (end < 0 || end - offset > 64) throw new Error(`${label} has a truncated tile header`);
    lines.push(buffer.toString('ascii', offset, end));
    offset = end + 1;
  }
  if (lines[0] !== 'VERSION 2' || lines[1] !== 'TILEWIDTH 64' || lines[2] !== 'TILEHEIGHT 64') {
    throw new Error(`${label} has an unsupported tile header`);
  }
  const pixelSizeMatch = /^PIXELSIZE ([1-9]\d*)$/.exec(lines[3]);
  const tileCountMatch = /^DATA (0|[1-9]\d*)$/.exec(lines[4]);
  if (!pixelSizeMatch || !tileCountMatch) throw new Error(`${label} tile metadata is invalid`);
  const pixelSize = Number(pixelSizeMatch[1]);
  const tileCount = Number(tileCountMatch[1]);
  if (pixelSize > 64 || tileCount > 100000) throw new Error(`${label} tile metadata exceeds validation limits`);
  const expectedTileBytes = 64 * 64 * pixelSize;
  const decodedBytes = expectedTileBytes * tileCount;
  if (!Number.isSafeInteger(decodedBytes) || decodedBytes > decodedBudget.remaining) {
    throw new Error(`${label} exceeds the aggregate decoded tile-output limit`);
  }
  decodedBudget.remaining -= decodedBytes;
  for (let tile = 0; tile < tileCount; tile += 1) {
    const lineEnd = buffer.indexOf(10, offset);
    if (lineEnd < 0 || lineEnd - offset > 128) throw new Error(`${label} tile ${tile + 1} record is truncated`);
    const record = buffer.toString('ascii', offset, lineEnd);
    const match = /^(-?\d+),(-?\d+),(NONE|LZF),(\d+)$/.exec(record);
    if (!match) throw new Error(`${label} tile ${tile + 1} record is invalid`);
    if (!Number.isSafeInteger(Number(match[1])) || !Number.isSafeInteger(Number(match[2]))) throw new Error(`${label} tile ${tile + 1} coordinates are invalid`);
    const length = Number(match[4]);
    if (!length || !Number.isSafeInteger(length)) throw new Error(`${label} tile ${tile + 1} size is invalid`);
    offset = lineEnd + 1;
    requireBytes(buffer, offset, length, `${label} tile ${tile + 1} data`);
    const tileData = buffer.subarray(offset, offset + length);
    if (match[3] === 'NONE') {
      if (tileData.length !== expectedTileBytes) throw new Error(`${label} tile ${tile + 1} raw payload is ${tileData.length} bytes; expected ${expectedTileBytes}`);
    } else {
      if (tileData.length < 2) throw new Error(`${label} tile ${tile + 1} LZF payload is missing`);
      const marker = tileData[0];
      if (marker === 0) {
        if (tileData.length - 1 !== expectedTileBytes) throw new Error(`${label} tile ${tile + 1} LZF raw payload has the wrong size`);
      } else if (marker === 1) inflateLzf(tileData.subarray(1), expectedTileBytes, `${label} tile ${tile + 1} LZF payload`);
      else throw new Error(`${label} tile ${tile + 1} LZF marker ${marker} is invalid`);
    }
    offset += length;
  }
  if (offset !== buffer.length) throw new Error(`${label} has trailing or undeclared tile data`);
  return { pixelSize, tileCount };
}

function validateKraSource(buffer) {
  const { entries, order } = zipEntries(buffer);
  const mimetype = entries.get('mimetype');
  if (order[0] !== 'mimetype' || !mimetype || mimetype.method !== 0 || mimetype.data.toString('ascii') !== 'application/x-krita') {
    throw new Error('KRA mimetype must be the first, stored application/x-krita member');
  }
  const document = entries.get('maindoc.xml');
  const merged = entries.get('mergedimage.png');
  const preview = entries.get('preview.png');
  if (!document?.data.length) throw new Error('KRA maindoc.xml is missing');
  if (!merged?.data.length || !preview?.data.length) throw new Error('KRA mergedimage.png or preview.png is missing');
  if (document.data.length > 16 * 1024 * 1024) throw new Error('KRA maindoc.xml exceeds the validation limit');
  validatePngContainer(merged.data, 'KRA mergedimage.png');
  validatePngContainer(preview.data, 'KRA preview.png');

  const xml = document.data.toString('utf8');
  if (xml.includes('\ufffd')) throw new Error('KRA maindoc.xml is not valid UTF-8');
  const root = parseKraXml(xml);
  if (root.name !== 'DOC') throw new Error('KRA maindoc.xml root must be DOC');
  const images = root.children.filter((node) => node.name === 'IMAGE');
  if (images.length !== 1) throw new Error('KRA maindoc.xml must contain exactly one IMAGE record');
  const imageNode = images[0];
  const image = imageNode.attributes;
  const imageName = image.name;
  if (!imageName || imageName.includes('/') || imageName.includes('\\') || imageName === '..') throw new Error('KRA IMAGE name cannot identify layer storage');
  const width = Number(image.width);
  const height = Number(image.height);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 300000 || height > 300000) {
    throw new Error('KRA IMAGE dimensions are invalid');
  }
  const layerRoots = imageNode.children.filter((node) => node.name === 'layers');
  if (layerRoots.length !== 1) throw new Error('KRA IMAGE must contain exactly one layers hierarchy');
  const layers = [];
  const visitLayers = (node, insideLayers = false) => {
    const nowInsideLayers = insideLayers || node.name === 'layers';
    if (node.name === 'layer' && nowInsideLayers && node.attributes.nodetype === 'paintlayer') layers.push(node.attributes);
    for (const child of node.children) visitLayers(child, nowInsideLayers);
  };
  visitLayers(layerRoots[0], true);
  if (!layers.length) throw new Error('KRA document has no editable paint layer');
  let layersWithTiles = 0;
  const decodedBudget = { remaining: MAX_KRA_DECODED_TILE_BYTES };
  for (const [index, layer] of layers.entries()) {
    if (!layer.filename || !/^[A-Za-z0-9._-]+$/.test(layer.filename) || layer.filename === '..') {
      throw new Error(`KRA paint layer ${index + 1} has an invalid data filename`);
    }
    const layerPath = `${imageName}/layers/${layer.filename}`;
    const layerData = entries.get(layerPath)?.data;
    const defaultPixel = entries.get(`${layerPath}.defaultpixel`)?.data;
    if (!layerData?.length) throw new Error(`KRA paint layer data ${layerPath} is missing`);
    const { pixelSize, tileCount } = validateKritaLayerData(layerData, `KRA paint layer data ${layerPath}`, decodedBudget);
    if (!defaultPixel || defaultPixel.length !== pixelSize) throw new Error(`KRA paint layer default pixel ${layerPath}.defaultpixel is missing or invalid`);
    if (tileCount > 0) layersWithTiles += 1;
  }
  if (!layersWithTiles) throw new Error('KRA document has no editable paint layer with tile data');
  return { width, height, layers: layers.length };
}

function pathContainsSymlink(root, file) {
  const parts = relative(root, file).split(sep).filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = join(current, part);
    if (lstatSync(current).isSymbolicLink()) return true;
  }
  return false;
}

function inspectEditableSource(file, extension, expectedCanvas = null, marsRoot = null) {
  if (!EDITABLE_VALIDATORS[extension]) return { valid: false, reason: `.${extension || '(none)'} is not a supported editable format` };
  try {
    if (!file) return { valid: false, missing: true, reason: 'the declared file does not exist' };
    let linkStats;
    try {
      linkStats = lstatSync(file);
    } catch (error) {
      if (error?.code === 'ENOENT') return { valid: false, missing: true, reason: 'the declared file does not exist' };
      throw error;
    }
    if (linkStats.isSymbolicLink()) return { valid: false, reason: 'editable-source symlinks are not allowed' };
    if (!statSync(file).isFile()) return { valid: false, reason: 'the declared source is not a file' };
    if (marsRoot) {
      const resolvedRoot = realpathSync(marsRoot);
      const resolvedFile = realpathSync(file);
      if (pathContainsSymlink(marsRoot, file)) return { valid: false, reason: 'editable-source paths cannot traverse symlinks' };
      if (resolvedFile !== resolvedRoot && !resolvedFile.startsWith(`${resolvedRoot}${sep}`)) {
        return { valid: false, reason: 'editable source resolves outside the Mars root' };
      }
    }
    const stats = statSync(file);
    if (stats.size > MAX_EDITABLE_SOURCE_BYTES) return { valid: false, reason: `editable source exceeds the ${MAX_EDITABLE_SOURCE_BYTES}-byte validation limit` };
    const buffer = readFileSync(file);
    const metadata = EDITABLE_VALIDATORS[extension](buffer, expectedCanvas);
    if (expectedCanvas && (metadata.width !== expectedCanvas.width || metadata.height !== expectedCanvas.height)) {
      throw new Error(`editable canvas is ${metadata.width}x${metadata.height}; expected ${expectedCanvas.width}x${expectedCanvas.height}`);
    }
    return { valid: true, buffer, metadata };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : 'the editable document is invalid' };
  }
}

export function loadArtManifest(path = DEFAULT_MANIFEST_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function artManifestHash(manifest) {
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
}

function inspectCommissionedPng(file, expectedCanvas, marsRoot, exportRoot) {
  try {
    if (!file) return { valid: false, missing: true, reason: 'the declared export path is unsafe' };
    let fileStats;
    try {
      fileStats = lstatSync(file);
    } catch (error) {
      if (error?.code === 'ENOENT') return { valid: false, missing: true, reason: 'the declared export does not exist' };
      throw error;
    }
    if (fileStats.isSymbolicLink()) return { valid: false, containment: true, reason: 'commissioned-export symlinks are not allowed' };
    if (!fileStats.isFile()) return { valid: false, reason: 'the declared export is not a file' };
    const resolvedMarsRoot = realpathSync(marsRoot);
    const resolvedExportRoot = realpathSync(exportRoot);
    const resolvedFile = realpathSync(file);
    if (pathContainsSymlink(marsRoot, file)) return { valid: false, containment: true, reason: 'commissioned-export paths cannot traverse symlinks' };
    if (resolvedExportRoot !== resolvedMarsRoot && !resolvedExportRoot.startsWith(`${resolvedMarsRoot}${sep}`)) {
      return { valid: false, containment: true, reason: 'commissioned export root resolves outside the Mars root' };
    }
    if (resolvedFile !== resolvedExportRoot && !resolvedFile.startsWith(`${resolvedExportRoot}${sep}`)) {
      return { valid: false, containment: true, reason: 'commissioned export resolves outside its export root' };
    }
    if (fileStats.size > MAX_COMMISSIONED_PNG_BYTES) return { valid: false, reason: `PNG exceeds the ${MAX_COMMISSIONED_PNG_BYTES}-byte file limit` };
    const buffer = readFileSync(file);
    return { valid: true, buffer, png: decodePng(buffer, expectedCanvas, COMMISSIONED_PNG_LIMITS) };
  } catch (error) {
    return {
      valid: false,
      code: error?.code,
      reason: error instanceof Error ? error.message : 'the commissioned PNG is invalid',
    };
  }
}

export function artPackageDigests(manifest, options = {}) {
  const marsRoot = resolve(options.marsRoot || DEFAULT_MARS_ROOT);
  const scope = options.scope || 'full';
  const exportRoot = safePath(marsRoot, manifest?.exportRoot);
  const exports = [];
  const editableSources = [];

  for (const asset of selectAssets(manifest, scope)) {
    for (const state of asset.states || []) {
      if (!Number.isInteger(state.frames) || state.frames < 1) continue;
      for (let frame = 1; frame <= state.frames; frame += 1) {
        const path = assetPath(asset.family, asset.id, state.name, frame);
        const file = exportRoot ? safePath(exportRoot, path) : null;
        const spriteClass = RENDER_CONTRACT.spriteClasses[asset.class];
        const inspection = spriteClass && exportRoot
          ? inspectCommissionedPng(file, { width: spriteClass.canvasWidth, height: spriteClass.canvasHeight }, marsRoot, exportRoot)
          : { valid: false };
        exports.push({ path, sha256: inspection.valid ? createHash('sha256').update(inspection.buffer).digest('hex') : null });
      }
    }
    const path = asset.editableSource || '';
    const extension = extname(path).slice(1).toLowerCase();
    const file = RENDER_CONTRACT.export.editableExtensions.includes(extension) ? safePath(marsRoot, path) : null;
    const spriteClass = RENDER_CONTRACT.spriteClasses[asset.class];
    const inspection = inspectEditableSource(file, extension, spriteClass ? {
      width: spriteClass.canvasWidth,
      height: spriteClass.canvasHeight,
    } : null, marsRoot);
    editableSources.push({
      path,
      sha256: inspection.valid ? createHash('sha256').update(inspection.buffer).digest('hex') : null,
    });
  }

  exports.sort((left, right) => left.path.localeCompare(right.path));
  editableSources.sort((left, right) => left.path.localeCompare(right.path));
  const runtimeIndex = generateRuntimeIndex(manifest, { marsRoot, scope });
  const runtimeAssetHash = runtimeIndex.runtimeAssetHash;
  const packageHash = createHash('sha256')
    .update(JSON.stringify({ runtimeIdentitySchema: RUNTIME_IDENTITY_SCHEMA, runtimeAssetHash, exports, editableSources }))
    .digest('hex');
  return {
    algorithm: 'SHA-256',
    runtimeIdentitySchema: RUNTIME_IDENTITY_SCHEMA,
    scope,
    complete: exports.length > 0
      && editableSources.length > 0
      && exports.every((entry) => entry.sha256)
      && editableSources.every((entry) => entry.sha256),
    runtimeAssetHash,
    packageHash,
    exports,
    editableSources,
  };
}

function selectAssets(manifest, scope = 'full') {
  const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
  if (scope === 'full') return assets;
  if (scope !== 'artist-test') return [];
  return assets
    .filter((asset) => asset.artistTest)
    .map((asset) => {
      const names = new Set(Array.isArray(asset.artistTestStates) ? asset.artistTestStates : []);
      return { ...asset, states: asset.states.filter((state) => names.has(state.name)) };
    });
}

function allDeclaredExports(manifest) {
  return new Set((manifest?.assets || []).flatMap((asset) => (asset.states || []).flatMap((state) => (
    Number.isInteger(state.frames)
      ? Array.from({ length: state.frames }, (_, index) => assetPath(asset.family, asset.id, state.name, index + 1))
      : []
  ))));
}

function safePath(root, value) {
  if (typeof value !== 'string' || !value || isAbsolute(value)) return null;
  const target = resolve(root, value);
  return target === root || target.startsWith(`${root}${sep}`) ? target : null;
}

function addIssue(target, code, asset, message, response) {
  target.push({ code, asset: asset ? `${asset.family}:${asset.id}` : null, message, response });
}

function expectedAnchor(spriteClass) {
  if (spriteClass.anchor === 'feet') return { type: 'feet', x: 0.5, y: 1 };
  return { type: spriteClass.anchor, x: 0.5, y: 0.5 };
}

function matchesAnchor(actual, expected) {
  if (!actual) return true;
  return actual.type === expected.type && actual.x === expected.x && actual.y === expected.y;
}

function listPngFiles(root) {
  if (!existsSync(root) || lstatSync(root).isSymbolicLink()) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory).sort()) {
      const path = join(directory, entry);
      const stats = lstatSync(path);
      if (stats.isSymbolicLink()) continue;
      if (stats.isDirectory()) visit(path);
      else if (stats.isFile() && extname(entry).toLowerCase() === '.png') files.push(path);
    }
  };
  visit(root);
  return files;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function decodePng(buffer, expectedCanvas = null, limits = VISUAL_DIFF_PNG_LIMITS) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Not a PNG file');
  }
  if (buffer.length > limits.fileBytes) throw new Error(`PNG exceeds the ${limits.fileBytes}-byte file limit`);

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let compressionMethod = -1;
  let filterMethod = -1;
  let interlace = -1;
  let sawHeader = false;
  let sawEnd = false;
  let compressedBytes = 0;
  const idat = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) throw new Error(`Truncated PNG chunk ${type}`);
    const data = buffer.subarray(dataStart, dataEnd);
    const expectedCrc = buffer.readUInt32BE(dataEnd);
    const actualCrc = crc32(buffer.subarray(offset + 4, dataEnd));
    if (actualCrc !== expectedCrc) throw new Error(`PNG chunk ${type} has an invalid CRC`);
    if (!sawHeader && type !== 'IHDR') throw new Error('PNG IHDR must be the first chunk');
    if (type === 'IHDR') {
      if (sawHeader || length !== 13) throw new Error('PNG IHDR is duplicate or invalid');
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      compressionMethod = data[10];
      filterMethod = data[11];
      interlace = data[12];
      sawHeader = true;
      if (expectedCanvas && (width !== expectedCanvas.width || height !== expectedCanvas.height)) {
        const error = new Error(`PNG is ${width}x${height}; expected ${expectedCanvas.width}x${expectedCanvas.height}`);
        error.code = 'INVALID_DIMENSIONS';
        throw error;
      }
    } else if (type === 'IDAT') {
      compressedBytes += length;
      if (!Number.isSafeInteger(compressedBytes) || compressedBytes > limits.compressedBytes) throw new Error('PNG compressed image data exceeds the validation limit');
      idat.push(data);
    } else if (type === 'IEND') {
      if (length !== 0 || dataEnd + 4 !== buffer.length) throw new Error('PNG IEND is invalid or followed by trailing data');
      sawEnd = true;
      break;
    }
    offset = dataEnd + 4;
  }

  if (!sawHeader || !sawEnd || !width || !height || !idat.length) throw new Error('PNG is missing IHDR, IDAT, or IEND data');
  if (bitDepth !== 8 || colorType !== 6 || compressionMethod !== 0 || filterMethod !== 0 || interlace !== 0) {
    throw new Error(`Expected non-interlaced 8-bit RGBA PNG with standard compression/filter methods; received bitDepth=${bitDepth}, colorType=${colorType}, compression=${compressionMethod}, filter=${filterMethod}, interlace=${interlace}`);
  }

  const bytesPerPixel = 4;
  const rowBytes = width * bytesPerPixel;
  const expectedLength = height * (rowBytes + 1);
  const pixelBytes = width * height * bytesPerPixel;
  if (!Number.isSafeInteger(rowBytes) || !Number.isSafeInteger(expectedLength) || !Number.isSafeInteger(pixelBytes)
    || expectedLength > limits.decodedBytes || pixelBytes > limits.decodedBytes) throw new Error('PNG decoded image data exceeds the validation limit');
  const compressed = Buffer.concat(idat, compressedBytes);
  let result;
  try {
    result = inflateSync(compressed, { info: true, maxOutputLength: expectedLength });
  } catch {
    throw new Error('PNG compressed image data is invalid or exceeds its decoded size');
  }
  const inflated = result.buffer;
  if (result.engine.bytesWritten !== compressed.length) throw new Error('PNG compressed image data contains trailing bytes');
  if (inflated.length !== expectedLength) throw new Error(`Unexpected PNG data length ${inflated.length}; expected ${expectedLength}`);

  const pixels = Buffer.alloc(pixelBytes);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rowOffset = y * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[sourceOffset + x];
      const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0;
      const above = y > 0 ? pixels[rowOffset + x - rowBytes] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? pixels[rowOffset + x - rowBytes - bytesPerPixel] : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + above;
      else if (filter === 3) value = raw + Math.floor((left + above) / 2);
      else if (filter === 4) value = raw + paeth(left, above, upperLeft);
      else throw new Error(`Unsupported PNG filter ${filter}`);
      pixels[rowOffset + x] = value & 255;
    }
    sourceOffset += rowBytes;
  }

  let transparentPixels = 0;
  let visiblePixels = 0;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 255) transparentPixels += 1;
    if (pixels[index] > 0) visiblePixels += 1;
  }

  return { width, height, bitDepth, colorType, pixels, transparentPixels, visiblePixels };
}

export function pngDifference(leftBuffer, rightBuffer) {
  const left = decodePng(leftBuffer);
  const right = decodePng(rightBuffer);
  if (left.width !== right.width || left.height !== right.height) {
    return { compatible: false, width: [left.width, right.width], height: [left.height, right.height], changedPixels: null, ratio: 1 };
  }
  let changedPixels = 0;
  const pixelCount = left.width * left.height;
  for (let index = 0; index < left.pixels.length; index += 4) {
    if (
      left.pixels[index] !== right.pixels[index]
      || left.pixels[index + 1] !== right.pixels[index + 1]
      || left.pixels[index + 2] !== right.pixels[index + 2]
      || left.pixels[index + 3] !== right.pixels[index + 3]
    ) changedPixels += 1;
  }
  return { compatible: true, width: left.width, height: left.height, changedPixels, ratio: changedPixels / pixelCount };
}

export function validateArtManifest(manifest, options = {}) {
  const marsRoot = resolve(options.marsRoot || DEFAULT_MARS_ROOT);
  const approval = !!options.approval;
  const scope = options.scope || 'full';
  const errors = [];
  const warnings = [];
  const assets = selectAssets(manifest, scope);
  const expectedFiles = new Set();
  const declaredFiles = allDeclaredExports(manifest);
  let presentExports = 0;
  let missingExports = 0;
  let editableSources = 0;

  if (!ART_SCOPES.includes(scope)) {
    addIssue(errors, 'INVALID_SCOPE', null, `Unknown validation scope ${scope}.`, `Use one of: ${ART_SCOPES.join(', ')}.`);
  }

  if (manifest?.contractVersion !== RENDER_CONTRACT.version) {
    addIssue(errors, 'CONTRACT_VERSION', null, `Manifest contract ${manifest?.contractVersion} does not match renderer contract ${RENDER_CONTRACT.version}.`, 'Regenerate or migrate the manifest.');
  }
  if (manifest?.decision !== RENDER_CONTRACT.decision) {
    addIssue(errors, 'DECISION_LINK', null, `Manifest decision ${manifest?.decision || 'missing'} does not match ${RENDER_CONTRACT.decision}.`, 'Link the active renderer decision.');
  }
  if (!assets.length) addIssue(errors, 'EMPTY_MANIFEST', null, `No art assets are declared for scope ${scope}.`, 'Declare the required assets and state subset.');

  const exportRoot = safePath(marsRoot, manifest?.exportRoot);
  if (!exportRoot) addIssue(errors, 'EXPORT_ROOT', null, 'exportRoot must be a safe relative path.', 'Use a path beneath mars/.');

  for (const asset of assets) {
    if (!ID_PATTERN.test(asset?.family || '') || !ID_PATTERN.test(asset?.id || '')) {
      addIssue(errors, 'INVALID_ID', asset, 'Family and id must use lowercase snake_case.', 'Rename the asset and every export.');
      continue;
    }
    const spriteClass = RENDER_CONTRACT.spriteClasses[asset.class];
    if (!spriteClass) {
      addIssue(errors, 'INVALID_CLASS', asset, `Unknown sprite class ${asset.class}.`, 'Use a class from render-contract.mjs.');
      continue;
    }

    const anchor = expectedAnchor(spriteClass);
    if (!matchesAnchor(asset.anchor, anchor)) {
      addIssue(errors, 'INVALID_ANCHOR', asset, `Anchor ${JSON.stringify(asset.anchor)} does not match ${JSON.stringify(anchor)}.`, 'Flag footprint mismatch and block approval.');
    }

    const footprint = asset.footprint;
    if (
      !footprint
      || !Number.isInteger(footprint.width)
      || !Number.isInteger(footprint.depth)
      || footprint.width < 1
      || footprint.depth < 1
      || footprint.origin !== 'centre'
    ) {
      addIssue(errors, 'INVALID_FOOTPRINT', asset, `Footprint ${JSON.stringify(footprint)} is invalid.`, 'Use positive integer cells with centre origin and review the overlay.');
    }

    const states = Array.isArray(asset.states) ? asset.states : [];
    if (!states.length) addIssue(errors, 'MISSING_STATES', asset, 'No states are declared.', 'Declare at least the active state.');
    for (const state of states) {
      if (!RENDER_CONTRACT.states.includes(state?.name)) {
        addIssue(errors, 'INVALID_STATE', asset, `Unknown state ${state?.name}.`, 'Use a canonical state name.');
        continue;
      }
      if (!Number.isInteger(state.frames) || state.frames < 1 || state.frames > 99) {
        addIssue(errors, 'INVALID_FRAMES', asset, `Frame count ${state.frames} is invalid for ${state.name}.`, 'Use one to 99 frames.');
        continue;
      }
      if (!RENDER_CONTRACT.animation.allowedFrameMs.includes(state.frameMs)) {
        addIssue(errors, 'INVALID_TIMING', asset, `Frame time ${state.frameMs}ms is not allowed for ${state.name}.`, `Use ${RENDER_CONTRACT.animation.allowedFrameMs.join(', ')}ms.`);
      }

      let firstFramePresent = false;
      let missingInClip = 0;
      for (let frame = 1; frame <= state.frames; frame += 1) {
        const relativeExport = assetPath(asset.family, asset.id, state.name, frame);
        expectedFiles.add(relativeExport);
        const file = exportRoot ? safePath(exportRoot, relativeExport) : null;
        const inspection = exportRoot
          ? inspectCommissionedPng(file, { width: spriteClass.canvasWidth, height: spriteClass.canvasHeight }, marsRoot, exportRoot)
          : { valid: false, missing: true, reason: 'the export root is unsafe' };
        if (inspection.missing) {
          missingExports += 1;
          missingInClip += 1;
          const target = approval ? errors : warnings;
          addIssue(target, 'MISSING_SPRITE', asset, `${relativeExport} is missing.`, `Render ${asset.fallback || 'procedural or emoji fallback'} and log a warning.`);
          continue;
        }

        presentExports += 1;
        if (frame === 1) firstFramePresent = true;
        try {
          if (!inspection.valid) {
            const error = new Error(inspection.reason);
            error.code = inspection.code || (inspection.containment ? 'INVALID_EXPORT_PATH' : 'INVALID_PNG');
            throw error;
          }
          const png = inspection.png;
          if (!png.transparentPixels || !png.visiblePixels) {
            addIssue(errors, 'INVALID_TRANSPARENCY', asset, `${relativeExport} must contain visible pixels and transparent pixels.`, 'Export straight-alpha RGBA on a transparent background.');
          }
        } catch (error) {
          const code = error.code === 'INVALID_DIMENSIONS' ? 'INVALID_DIMENSIONS' : error.code === 'INVALID_EXPORT_PATH' ? 'INVALID_EXPORT_PATH' : 'INVALID_PNG';
          const response = code === 'INVALID_DIMENSIONS'
            ? 'Fail validation and re-export without scaling or cropping.'
            : code === 'INVALID_EXPORT_PATH' ? 'Use a regular file beneath the commissioned export root.' : 'Export a non-interlaced 8-bit RGBA PNG.';
          addIssue(errors, code, asset, `${relativeExport}: ${error.message}`, response);
        }
      }

      if (state.frames > 1 && missingInClip > 0) {
        const target = approval ? errors : warnings;
        addIssue(
          target,
          'BROKEN_ANIMATION',
          asset,
          `${state.name} is missing ${missingInClip} of ${state.frames} frames.`,
          firstFramePresent ? 'Load static frame 01 safely and report the broken clip.' : `Use ${asset.fallback || 'procedural fallback'} because frame 01 is absent.`,
        );
      }
    }

    const sourcePath = asset.editableSource || '';
    const source = safePath(marsRoot, sourcePath);
    const extension = extname(asset.editableSource || '').slice(1).toLowerCase();
    const extensionSupported = RENDER_CONTRACT.export.editableExtensions.includes(extension);
    const inspection = source && extensionSupported
      ? inspectEditableSource(source, extension, { width: spriteClass.canvasWidth, height: spriteClass.canvasHeight }, marsRoot)
      : { valid: false, missing: !sourcePath || (source && !existsSync(source)), reason: !source ? 'the source path is missing or unsafe' : `.${extension || '(none)'} is not supported` };
    if (inspection.valid) editableSources += 1;
    else {
      const target = approval ? errors : warnings;
      const code = inspection.missing ? 'MISSING_EDITABLE_SOURCE' : 'INVALID_EDITABLE_SOURCE';
      const message = code === 'MISSING_EDITABLE_SOURCE'
        ? `${sourcePath || 'Editable source path'} is missing.`
        : `${sourcePath || 'Editable source path'} is not a structurally valid layered source: ${inspection.reason}.`;
      const response = code === 'MISSING_EDITABLE_SOURCE'
        ? 'Provide the declared editable source; block final asset approval.'
        : 'Replace it with a structurally valid layered .aseprite, .kra, or .psd document; block final asset approval.';
      addIssue(target, code, asset, message, response);
    }
  }

  if (exportRoot) {
    for (const file of listPngFiles(exportRoot)) {
      const relativeFile = relative(exportRoot, file).split(sep).join('/');
      if (!FILE_PATTERN.test(relativeFile)) {
        addIssue(errors, 'INVALID_FILENAME', null, `${relativeFile} does not match the naming contract.`, 'Rename to family/id__state__fNN.png.');
      } else if (!expectedFiles.has(relativeFile) && !declaredFiles.has(relativeFile)) {
        addIssue(warnings, 'UNLISTED_EXPORT', null, `${relativeFile} is not declared in the golden manifest.`, 'Declare it or remove it from the approval package.');
      }
    }
  }

  const expectedExports = expectedFiles.size;
  return {
    passed: errors.length === 0,
    approval,
    scope,
    contractVersion: RENDER_CONTRACT.version,
    decision: RENDER_CONTRACT.decision,
    manifestHash: artManifestHash(manifest),
    approvalReady: approval && errors.length === 0 && warnings.length === 0,
    counts: {
      assets: assets.length,
      expectedExports,
      presentExports,
      missingExports,
      editableSources,
      errors: errors.length,
      warnings: warnings.length,
    },
    errors,
    warnings,
  };
}

function runtimeLoop(asset, state) {
  if (state.frames <= 1) return false;
  if (asset.class === 'effect' || state.name === 'damaged') return false;
  return true;
}

function buildRuntimeAssets(manifest, marsRoot, scope) {
  const exportRoot = safePath(marsRoot, manifest?.exportRoot);
  const assets = [];
  let availableExports = 0;

  if (exportRoot && ART_SCOPES.includes(scope)) {
    for (const asset of selectAssets(manifest, scope)) {
      const spriteClass = RENDER_CONTRACT.spriteClasses[asset.class];
      if (!spriteClass) continue;
      const states = {};
      for (const state of asset.states || []) {
        if (!RENDER_CONTRACT.states.includes(state.name) || !Number.isInteger(state.frames) || state.frames < 1) continue;
        const frames = [];
        for (let frame = 1; frame <= state.frames; frame += 1) {
          const relativeExport = assetPath(asset.family, asset.id, state.name, frame);
          const file = safePath(exportRoot, relativeExport);
          const inspection = inspectCommissionedPng(
            file,
            { width: spriteClass.canvasWidth, height: spriteClass.canvasHeight },
            marsRoot,
            exportRoot,
          );
          if (inspection.valid && inspection.png.transparentPixels > 0 && inspection.png.visiblePixels > 0) {
            const frameEntry = { path: relativeExport, sha256: createHash('sha256').update(inspection.buffer).digest('hex') };
            frames.push(frameEntry);
          }
        }
        // Frame 01 is the only safe broken-clip fallback. Never index a later
        // frame when the first frame is absent or invalid.
        const firstFrame = assetPath(asset.family, asset.id, state.name, 1);
        if (frames[0]?.path !== firstFrame) continue;
        availableExports += frames.length;
        states[state.name] = {
          declaredFrames: state.frames,
          frameMs: state.frameMs,
          loop: runtimeLoop(asset, state),
          frames,
        };
      }
      if (!Object.keys(states).length) continue;
      assets.push({
        family: asset.family,
        id: asset.id,
        class: asset.class,
        anchor: expectedAnchor(spriteClass),
        screenOffset: { x: spriteClass.screenOffsetX || 0, y: spriteClass.screenOffsetY || 0 },
        canvas: { width: spriteClass.canvasWidth, height: spriteClass.canvasHeight, scale: spriteClass.scale },
        footprint: asset.footprint,
        fallback: asset.fallback || null,
        fallbackSprite: asset.fallbackSprite || null,
        states,
      });
    }
  }
  return { assets, availableExports };
}

function runtimeAssetIdentityHash(assets) {
  return createHash('sha256')
    .update(JSON.stringify({ schema: RUNTIME_IDENTITY_SCHEMA, assets }))
    .digest('hex');
}

export function generateRuntimeIndex(manifest, options = {}) {
  const marsRoot = resolve(options.marsRoot || DEFAULT_MARS_ROOT);
  const scope = options.scope || 'full';
  const full = buildRuntimeAssets(manifest, marsRoot, 'full');
  const artistTest = buildRuntimeAssets(manifest, marsRoot, 'artist-test');
  const selected = scope === 'artist-test' ? artistTest : scope === 'full' ? full : { assets: [], availableExports: 0 };
  const fullHash = runtimeAssetIdentityHash(full.assets);
  const artistTestHash = runtimeAssetIdentityHash(artistTest.assets);
  const selectedHash = scope === 'artist-test' ? artistTestHash : scope === 'full' ? fullHash : runtimeAssetIdentityHash([]);

  return {
    version: RUNTIME_INDEX_VERSION,
    runtimeIdentitySchema: RUNTIME_IDENTITY_SCHEMA,
    contractVersion: RENDER_CONTRACT.version,
    decision: RENDER_CONTRACT.decision,
    scope,
    manifestHash: artManifestHash(manifest),
    runtimeAssetHash: selectedHash,
    runtimeAssetHashes: {
      full: fullHash,
      'artist-test': artistTestHash,
    },
    availableExports: selected.availableExports,
    assets: selected.assets,
  };
}

export function serializeRuntimeIndex(index) {
  return `${JSON.stringify(index, null, 2)}\n`;
}

export function writeRuntimeIndex(manifest, outputPath = DEFAULT_RUNTIME_INDEX_PATH, options = {}) {
  const index = generateRuntimeIndex(manifest, options);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serializeRuntimeIndex(index));
  return index;
}

export function verifyRuntimeIndex(manifest, indexPath = DEFAULT_RUNTIME_INDEX_PATH, options = {}) {
  const expected = serializeRuntimeIndex(generateRuntimeIndex(manifest, options));
  if (!existsSync(indexPath)) {
    return { passed: false, reason: 'missing', expected, actual: null };
  }
  const actual = readFileSync(indexPath, 'utf8');
  return { passed: actual === expected, reason: actual === expected ? null : 'stale', expected, actual };
}

function conciseIndexVerification(verification) {
  return verification
    ? { passed: verification.passed === true, reason: verification.reason || null }
    : undefined;
}

export function reportDocument(report, options = {}) {
  const runtimeIndex = options.runtimeIndex;
  const indexVerification = conciseIndexVerification(options.indexVerification);
  const artifactDigests = options.artifactDigests;
  const machineReady = report.approval === true
    && report.approvalReady === true
    && indexVerification?.passed === true
    && artifactDigests?.complete === true;
  return {
    reportVersion: 1,
    ...report,
    machineReady,
    ...(artifactDigests ? { artifactDigests } : {}),
    ...(runtimeIndex ? { runtimeIndex: { assets: runtimeIndex.assets.length, availableExports: runtimeIndex.availableExports } } : {}),
    ...(indexVerification ? { indexVerification } : {}),
  };
}

export function serializeReportDocument(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function buildApprovalReportDocuments(manifest, options = {}) {
  const marsRoot = resolve(options.marsRoot || DEFAULT_MARS_ROOT);
  const runtimeIndexPath = resolve(options.runtimeIndexPath || join(marsRoot, 'assets', 'commissioned', 'index.json'));
  const indexVerification = options.indexVerification || verifyRuntimeIndex(manifest, runtimeIndexPath, { marsRoot, scope: 'full' });
  const documents = {};
  for (const scope of ['artist-test', 'full']) {
    documents[scope] = reportDocument(
      validateArtManifest(manifest, { marsRoot, approval: true, scope }),
      { indexVerification, artifactDigests: artPackageDigests(manifest, { marsRoot, scope }) },
    );
  }
  return documents;
}

export function writeApprovalReports(manifest, outputDirectory, options = {}) {
  const documents = buildApprovalReportDocuments(manifest, options);
  mkdirSync(outputDirectory, { recursive: true });
  for (const [scope, filename] of Object.entries(APPROVAL_REPORT_FILENAMES)) {
    writeFileSync(join(outputDirectory, filename), serializeReportDocument(documents[scope]));
  }
  return documents;
}

export function verifyApprovalReports(manifest, outputDirectory, options = {}) {
  const documents = buildApprovalReportDocuments(manifest, options);
  const reports = {};
  let passed = true;
  for (const [scope, filename] of Object.entries(APPROVAL_REPORT_FILENAMES)) {
    const path = join(outputDirectory, filename);
    const expected = serializeReportDocument(documents[scope]);
    const actual = existsSync(path) ? readFileSync(path, 'utf8') : null;
    const current = actual === expected;
    reports[scope] = { passed: current, reason: actual === null ? 'missing' : current ? null : 'stale' };
    if (!current) passed = false;
  }
  return { passed, reports };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function firstExpectedExport(asset) {
  const preferred = asset.states.find((state) => state.name === 'active') || asset.states[0];
  return assetPath(asset.family, asset.id, preferred.name, 1);
}

function contactGeometry(asset, spriteClass) {
  const center = { x: 130, y: 112 };
  const corners = footprintCornersFromCenter(0, 0, asset.footprint.width, asset.footprint.depth);
  const points = ['north', 'east', 'south', 'west']
    .map((key) => `${center.x + corners[key].x},${center.y + corners[key].y}`)
    .join(' ');
  const anchor = expectedAnchor(spriteClass);
  const screenOffset = {
    x: spriteClass.screenOffsetX || 0,
    y: spriteClass.screenOffsetY || 0,
  };
  return { center, points, anchor, screenOffset };
}

function previewMarkup(asset, manifest, marsRoot, outputDirectory) {
  const spriteClass = RENDER_CONTRACT.spriteClasses[asset.class];
  const expected = firstExpectedExport(asset);
  const root = safePath(marsRoot, manifest.exportRoot);
  const file = root && safePath(root, expected);
  const image = file && existsSync(file)
    ? `<img src="${escapeHtml(relative(outputDirectory, file).split(sep).join('/'))}" alt="" />`
    : asset.fallbackSprite
      ? `<div class="fallback">${spriteHTML(asset.fallbackSprite, 3)}</div>`
      : '<div class="missing">PROCEDURAL<br />FALLBACK</div>';
  const geometry = contactGeometry(asset, spriteClass);
  return `<div class="preview">
      <svg class="footprint" viewBox="0 0 260 190" aria-hidden="true">
        <polygon points="${geometry.points}" />
        <line class="offset-line" x1="${geometry.center.x}" y1="${geometry.center.y}" x2="${geometry.center.x + geometry.screenOffset.x}" y2="${geometry.center.y + geometry.screenOffset.y}" />
        <circle class="ground-point" cx="${geometry.center.x}" cy="${geometry.center.y}" r="4" />
      </svg>
      <div class="asset-box" style="width:${spriteClass.canvasWidth * spriteClass.scale}px;height:${spriteClass.canvasHeight * spriteClass.scale}px;left:${geometry.center.x + geometry.screenOffset.x}px;top:${geometry.center.y + geometry.screenOffset.y}px;--anchor-x:${geometry.anchor.x * 100}%;--anchor-y:${geometry.anchor.y * 100}%;--anchor-shift-x:${-geometry.anchor.x * 100}%;--anchor-shift-y:${-geometry.anchor.y * 100}%">
        ${image}
        <span class="anchor" title="${escapeHtml(geometry.anchor.type)} anchor"></span>
      </div>
    </div>`;
}

export function generateContactSheet(manifest, outputPath, options = {}) {
  const marsRoot = resolve(options.marsRoot || DEFAULT_MARS_ROOT);
  const report = options.report || validateArtManifest(manifest, { marsRoot });
  const outputDirectory = dirname(outputPath);
  const cards = manifest.assets.map((asset) => {
    const spriteClass = RENDER_CONTRACT.spriteClasses[asset.class];
    const states = asset.states.map((state) => `${state.name} ${state.frames}f/${state.frameMs}ms`).join(' | ');
    return `<article>
      <header><span>${escapeHtml(asset.category)}</span><strong>${escapeHtml(asset.id)}</strong></header>
      ${previewMarkup(asset, manifest, marsRoot, outputDirectory)}
      <p>${spriteClass.canvasWidth}x${spriteClass.canvasHeight} source | ${spriteClass.scale}x gameplay | ${escapeHtml(spriteClass.anchor)}</p>
      <p>Footprint ${asset.footprint.width}x${asset.footprint.depth} from ${escapeHtml(asset.footprint.origin)} | ground offset (${spriteClass.screenOffsetX || 0},${spriteClass.screenOffsetY || 0})</p>
      <small>${escapeHtml(states)}</small>
      <code>${escapeHtml(firstExpectedExport(asset))}</code>
    </article>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MarsScape DEC-79 Golden Contact Sheet</title>
  <style>
    :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background:#15100d; color:#f2ede6; }
    body { margin:0; padding:24px; }
    h1 { margin:0 0 8px; }
    .summary { color:#c4bcab; margin:0 0 24px; }
    main { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:16px; }
    article { min-width:0; padding:14px; border:1px solid #6b4a33; background:#211812; }
    header { display:flex; justify-content:space-between; gap:12px; margin-bottom:12px; color:#9fe0f0; }
    header strong { color:#f2ede6; }
    .preview { position:relative; height:190px; overflow:hidden; background:linear-gradient(160deg,#1d3a44,#6b4a33); image-rendering:pixelated; }
    .asset-box { position:absolute; z-index:2; display:grid; place-items:center; transform:translate(var(--anchor-shift-x),var(--anchor-shift-y)); }
    .preview img, .fallback { position:relative; z-index:2; max-width:100%; max-height:100%; image-rendering:pixelated; }
    .footprint { position:absolute; inset:0; z-index:1; width:100%; height:100%; opacity:.84; }
    .footprint polygon { fill:#4db8d422; stroke:#9fe0f0; stroke-width:2; stroke-dasharray:4 3; }
    .footprint .offset-line { stroke:#f0d488; stroke-width:2; }
    .footprint .ground-point { fill:#15100d; stroke:#9fe0f0; stroke-width:2; }
    .anchor { position:absolute; z-index:3; left:var(--anchor-x); top:var(--anchor-y); width:12px; height:12px; border:2px solid #f0d488; border-radius:50%; transform:translate(-50%,-50%); }
    .anchor::before, .anchor::after { content:""; position:absolute; background:#f0d488; }
    .anchor::before { width:18px; height:1px; left:-3px; top:5px; }
    .anchor::after { width:1px; height:18px; left:5px; top:-3px; }
    .missing { position:relative; z-index:2; padding:8px; border:1px solid #d7a74c; color:#f0d488; text-align:center; }
    p, small, code { display:block; overflow-wrap:anywhere; }
    p { margin:10px 0 0; color:#c4bcab; font-size:12px; }
    small { margin-top:8px; color:#9fe0f0; }
    code { margin-top:8px; color:#f2b285; font-size:11px; }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation:none!important; transition:none!important; } }
  </style>
</head>
<body>
  <h1>MarsScape DEC-79 Golden Contact Sheet</h1>
  <p class="summary">Contract v${manifest.contractVersion} | ${report.counts.assets} assets | ${report.counts.presentExports}/${report.counts.expectedExports} exports present | ${report.counts.missingExports} procedural fallbacks expected</p>
  <main>${cards}</main>
</body>
</html>`;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html);
  return { outputPath, bytes: Buffer.byteLength(html), cards: manifest.assets.length };
}

function optionValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function printIssues(label, issues) {
  if (!issues.length) return;
  console.log(`${label} (${issues.length})`);
  for (const issue of issues.slice(0, 20)) {
    console.log(`- ${issue.code}${issue.asset ? ` ${issue.asset}` : ''}: ${issue.message} Response: ${issue.response}`);
  }
  if (issues.length > 20) console.log(`- ... ${issues.length - 20} more`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const manifestPath = resolve(optionValue(args, '--manifest', DEFAULT_MANIFEST_PATH));
  const marsRoot = resolve(optionValue(args, '--mars-root', DEFAULT_MARS_ROOT));
  const approval = args.includes('--approval');
  const scope = optionValue(args, '--scope', 'full');
  const manifest = loadArtManifest(manifestPath);
  const report = validateArtManifest(manifest, { marsRoot, approval, scope });
  const contactSheet = optionValue(args, '--contact-sheet');
  if (contactSheet) generateContactSheet(manifest, resolve(contactSheet), { marsRoot, report });
  const runtimeIndexPath = optionValue(args, '--runtime-index');
  let runtimeIndex = null;
  if (runtimeIndexPath) runtimeIndex = writeRuntimeIndex(manifest, resolve(runtimeIndexPath), { marsRoot, scope: 'full' });
  const verifyIndexPath = optionValue(args, '--verify-runtime-index');
  const indexVerification = verifyIndexPath
    ? verifyRuntimeIndex(manifest, resolve(verifyIndexPath), { marsRoot, scope: 'full' })
    : null;
  const approvalReportsPath = optionValue(args, '--approval-reports');
  const approvalReports = approvalReportsPath
    ? writeApprovalReports(manifest, resolve(approvalReportsPath), {
      marsRoot,
      runtimeIndexPath: verifyIndexPath ? resolve(verifyIndexPath) : join(marsRoot, 'assets', 'commissioned', 'index.json'),
      indexVerification,
    })
    : null;
  const verifyApprovalReportsPath = optionValue(args, '--verify-approval-reports');
  const approvalReportVerification = verifyApprovalReportsPath
    ? verifyApprovalReports(manifest, resolve(verifyApprovalReportsPath), {
      marsRoot,
      runtimeIndexPath: verifyIndexPath ? resolve(verifyIndexPath) : join(marsRoot, 'assets', 'commissioned', 'index.json'),
      indexVerification,
    })
    : null;
  const reportPath = optionValue(args, '--report');
  if (reportPath) {
    const output = resolve(reportPath);
    mkdirSync(dirname(output), { recursive: true });
    const artifactDigests = approval ? artPackageDigests(manifest, { marsRoot, scope }) : null;
    writeFileSync(output, serializeReportDocument(reportDocument(report, { runtimeIndex, indexVerification, artifactDigests })));
  }
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`MarsScape art validation: ${report.passed ? 'PASS' : 'FAIL'}`);
    console.log(`Scope: ${scope}; contract v${report.contractVersion}; manifest ${report.manifestHash.slice(0, 12)}`);
    console.log(JSON.stringify(report.counts));
    printIssues('Errors', report.errors);
    printIssues('Warnings', report.warnings);
    if (contactSheet) console.log(`Contact sheet: ${resolve(contactSheet)}`);
    if (runtimeIndexPath) console.log(`Runtime index: ${resolve(runtimeIndexPath)} (${runtimeIndex.assets.length} assets; ${runtimeIndex.availableExports} exports)`);
    if (indexVerification) console.log(`Runtime index verification: ${indexVerification.passed ? 'PASS' : `FAIL (${indexVerification.reason})`}`);
    if (approvalReportsPath) console.log(`Approval reports: ${resolve(approvalReportsPath)} (${Object.keys(approvalReports).length} scopes)`);
    if (approvalReportVerification) console.log(`Approval report verification: ${approvalReportVerification.passed ? 'PASS' : 'FAIL'}`);
    if (reportPath) console.log(`Report: ${resolve(reportPath)}`);
  }
  if (
    !report.passed
    || (approval && !report.approvalReady)
    || (indexVerification && !indexVerification.passed)
    || (approvalReportVerification && !approvalReportVerification.passed)
  ) process.exitCode = 1;
}
