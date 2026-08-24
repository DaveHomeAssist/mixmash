import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyCommand, createState, publicState, sanitizeState } from './engine.mjs';
import { convertLegacySave, LegacyImportError } from './legacy-import.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = Number(process.env.PORT || process.env.MARSSCAPE_PORT || 8787);
const DB_FILE = process.env.MARSSCAPE_DB_FILE || join(ROOT, '.data', 'sessions.sqlite');
const LEGACY_DATA_FILE = process.env.MARSSCAPE_DATA_FILE || join(ROOT, '.data', 'sessions.json');
const SECRET = process.env.MARSSCAPE_SECRET || randomBytes(32).toString('hex');
const ALLOW_ORIGIN = process.env.MARSSCAPE_ALLOW_ORIGIN || '';
const PUBLIC_API_ORIGIN = process.env.MARSSCAPE_PUBLIC_API_ORIGIN || 'https://mixmash-marsscape-authority.vercel.app';
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 160;
const STORAGE_TIMEOUT_MS = 8000;
const SESSION_LOCK_TIMEOUT_MS = 7000;
const SESSION_LOCK_STALE_MS = 15_000;
const BODY_TIMEOUT_MS = 5000;

let storePromise;
const rateBuckets = new Map();

export function createMarsscapeServer(options = {}) {
  return createServer((request, response) => handleNodeRequest(request, response, options));
}

export async function handleNodeRequest(request, response, options = {}) {
  const requestId = randomUUID();
  try {
    setSecurityHeaders(response);
    if (request.method === 'OPTIONS') return send(response, 204);

    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const api = normalizeApiPath(url.pathname);
    if (api) {
      if (!rateLimit(request)) {
        return sendJson(response, 429, problem('RATE_LIMITED', 'Too many requests', requestId));
      }
      return await handleApi(request, response, api, requestId);
    }
    if (options.serveStaticFiles === false) {
      return sendJson(response, 404, problem('NOT_FOUND', 'Endpoint not found', requestId));
    }
    return await serveStatic(response, url.pathname);
  } catch (error) {
    const status = Number(error.status || error.statusCode || 500);
    const code = error.code || 'INTERNAL_ERROR';
    const message = status >= 500 ? 'Unexpected server error' : error.message;
    return sendJson(response, status, problem(code, message, requestId));
  }
}

if (isMainModule()) {
  const server = createMarsscapeServer();
  server.listen(DEFAULT_PORT, () => {
    console.log(`MarsScape authority listening on http://localhost:${DEFAULT_PORT}`);
    if (!process.env.MARSSCAPE_SECRET) {
      console.warn('MARSSCAPE_SECRET is not set; using a per-process development secret.');
    }
  });
}

async function handleApi(request, response, apiPath, requestId) {
  if ((request.method === 'GET' || request.method === 'HEAD') && apiPath === '/health') {
    const store = await getSessionStore();
    const health = {
      ok: true,
      service: 'marsscape-authority',
      storage: store.kind,
      time: new Date().toISOString(),
    };
    return request.method === 'HEAD' ? send(response, 200) : sendJson(response, 200, health);
  }

  if (request.method === 'POST' && apiPath === '/sessions') {
    const body = await readJson(request);
    const sessionId = validSessionId(body.sessionId) ? body.sessionId : randomUUID();
    const store = await getSessionStore();
    let record = await store.get(sessionId);
    if (!record) {
      const now = Date.now();
      record = {
        state: createState(now),
        createdAt: now,
        updatedAt: now,
      };
      await store.set(sessionId, record);
    }
    return sendSession(response, sessionId, record.state);
  }

  // Legacy MarsScape import. Two-step by design: a preview never writes anything, and
  // only an explicit `commit` creates a server-owned session. The original save is
  // stored alongside the converted state so an import is always reversible.
  if (request.method === 'POST' && apiPath === '/sessions/import') {
    const body = await readJson(request);
    let converted;
    try {
      converted = convertLegacySave(body.legacySave, Date.now());
    } catch (error) {
      if (error instanceof LegacyImportError) {
        return sendJson(response, 422, problem(error.code, error.message, requestId));
      }
      throw error;
    }
    const { state, report } = converted;
    if (!body.commit) {
      return sendJson(response, 200, { preview: true, report: publicReport(report), state: publicState(state) });
    }
    const store = await getSessionStore();
    const sessionId = randomUUID();
    const now = Date.now();
    await store.set(sessionId, {
      state,
      createdAt: now,
      updatedAt: now,
      legacyOriginal: report.original,
    });
    return sendJson(response, 201, {
      preview: false,
      sessionId,
      report: publicReport(report),
      state: publicState(state),
    });
  }

  const sessionMatch = apiPath.match(/^\/sessions\/([a-f0-9-]{36})(?:\/commands)?$/i);
  if (!sessionMatch) {
    return sendJson(response, 404, problem('NOT_FOUND', 'Endpoint not found', requestId));
  }

  const sessionId = sessionMatch[1];
  const store = await getSessionStore();

  if (request.method === 'GET' && apiPath === `/sessions/${sessionId}`) {
    const record = await store.get(sessionId);
    if (!record) {
      return sendJson(response, 404, problem('SESSION_NOT_FOUND', 'Session not found', requestId));
    }
    return sendSession(response, sessionId, record.state);
  }

  if (request.method === 'POST' && apiPath === `/sessions/${sessionId}/commands`) {
    const command = await readJson(request);
    const output = await withSessionLock(store, sessionId, async () => {
      let record = await store.get(sessionId);
      if (!record) {
        const now = Date.now();
        record = {
          state: createState(now),
          createdAt: now,
          updatedAt: now,
        };
      }
      const result = applyCommand(record.state, command);
      record.state = result.state;
      record.updatedAt = Date.now();
      await store.set(sessionId, record);
      return { record, result };
    });
    return sendSession(response, sessionId, output.record.state, output.result.events);
  }

  return sendJson(response, 405, problem('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
}

async function sendSession(response, sessionId, state, events = []) {
  const canonical = publicState(state);
  const signature = signSession(sessionId, canonical);
  response.setHeader('ETag', `"${signature.slice(0, 32)}"`);
  return sendJson(response, 200, { sessionId, state: canonical, signature, events });
}

function signSession(sessionId, state) {
  return createHmac('sha256', SECRET)
    .update(sessionId)
    .update('\n')
    .update(JSON.stringify(sanitizeState(state)))
    .digest('base64url');
}

export function verifySignature(sessionId, state, signature) {
  if (!signature || typeof signature !== 'string') return false;
  const expected = Buffer.from(signSession(sessionId, state));
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function serveStatic(response, pathname) {
  const cleanPath = staticPath(pathname);
  const filePath = cleanPath.endsWith('/') ? join(ROOT, 'index.html') : join(ROOT, cleanPath);
  const safePath = normalize(filePath);
  if (!safePath.startsWith(ROOT)) return send(response, 403, 'Forbidden');

  try {
    const info = await stat(safePath);
    const finalPath = info.isDirectory() ? join(safePath, 'index.html') : safePath;
    const body = await readFile(finalPath);
    response.setHeader('Content-Type', contentType(finalPath));
    response.setHeader('Cache-Control', finalPath.endsWith('.html') ? 'no-cache' : 'public, max-age=300');
    return send(response, 200, body);
  } catch {
    const body = await readFile(join(ROOT, 'index.html'));
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache');
    return send(response, 200, body);
  }
}

function staticPath(pathname) {
  let path = decodeURIComponent(pathname);
  for (const prefix of ['/mars/', '/marsscape/']) {
    if (path.startsWith(prefix)) path = `/${path.slice(prefix.length)}`;
  }
  if (path === '/mars' || path === '/marsscape') path = '/';
  return path === '/' ? '/' : path.replace(/^\/+/, '');
}

function normalizeApiPath(pathname) {
  if (pathname === '/api') return '/';
  if (pathname.startsWith('/api/')) return pathname.slice(4);
  const marker = '/api/';
  const index = pathname.indexOf(marker);
  if (index === -1) return '';
  return pathname.slice(index + 4);
}

async function readJson(request) {
  const contentType = String(request.headers['content-type'] || '').toLowerCase();
  if (contentType && !contentType.includes('application/json')) {
    request.resume();
    throw httpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/json for request bodies');
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    const timer = setTimeout(() => {
      fail(httpError(408, 'BODY_TIMEOUT', 'Request body timed out'));
      request.destroy();
    }, BODY_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timer);
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('error', onError);
      request.off('aborted', onAborted);
    }

    function fail(error) {
      if (done) return;
      done = true;
      cleanup();
      reject(error);
    }

    function onData(chunk) {
      size += chunk.length;
      if (size > 256_000) {
        fail(httpError(413, 'BODY_TOO_LARGE', 'Request body too large'));
        request.destroy();
        return;
      }
      chunks.push(Buffer.from(chunk));
    }

    function onEnd() {
      if (done) return;
      done = true;
      cleanup();
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(httpError(400, 'BAD_JSON', 'Malformed JSON body'));
      }
    }

    function onError() {
      fail(httpError(400, 'BODY_READ_ERROR', 'Request body could not be read'));
    }

    function onAborted() {
      fail(httpError(400, 'BODY_ABORTED', 'Request body was aborted'));
    }

    request.on('data', onData);
    request.on('end', onEnd);
    request.on('error', onError);
    request.on('aborted', onAborted);
  });
}

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function getSessionStore() {
  if (!storePromise) storePromise = openSessionStore();
  return storePromise;
}

async function withSessionLock(store, sessionId, callback) {
  if (!store.withSessionLock) return callback();
  return store.withSessionLock(sessionId, callback);
}

async function openSessionStore() {
  if (process.env.MARSSCAPE_STORAGE === 'blob' || process.env.VERCEL) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const error = new Error('BLOB_READ_WRITE_TOKEN is required for Vercel Blob storage');
      error.status = 503;
      error.code = 'STORAGE_UNAVAILABLE';
      throw error;
    }
    return createBlobStore();
  }

  await mkdir(dirname(DB_FILE), { recursive: true });
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(DB_FILE);
    db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_updated_at_idx ON sessions(updated_at);
    `);
    await migrateLegacyJsonStore(db);
    return createSqliteStore(db);
  } catch (error) {
    console.warn(`SQLite unavailable; using legacy JSON store. ${error.message}`);
    return createJsonStore();
  }
}

function createSqliteStore(db) {
  // A legacy import is only reversible if the original save is actually stored, so
  // the column is part of the record rather than something the handler passes and
  // the adapter quietly drops.
  try { db.exec('ALTER TABLE sessions ADD COLUMN legacy_original TEXT'); } catch { /* already present */ }
  const select = db.prepare('SELECT state_json, created_at, updated_at, legacy_original FROM sessions WHERE id = ?');
  const upsert = db.prepare(`
    INSERT INTO sessions (id, state_json, created_at, updated_at, legacy_original)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      state_json = excluded.state_json,
      updated_at = excluded.updated_at,
      legacy_original = COALESCE(excluded.legacy_original, sessions.legacy_original)
  `);
  return {
    kind: 'sqlite',
    async get(sessionId) {
      const row = select.get(sessionId);
      if (!row) return null;
      return {
        state: sanitizeState(JSON.parse(row.state_json)),
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
        legacyOriginal: row.legacy_original ?? null,
      };
    },
    async set(sessionId, record) {
      const createdAt = Number(record.createdAt || Date.now());
      const updatedAt = Number(record.updatedAt || Date.now());
      upsert.run(sessionId, JSON.stringify(sanitizeState(record.state)), createdAt, updatedAt,
        record.legacyOriginal ?? null);
    },
  };
}

async function createBlobStore() {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = parseBlobStoreId(blobToken);
  const client = createBlobClient(blobToken, storeId);
  return {
    kind: 'vercel-blob',
    async get(sessionId) {
      const record = await client.getJson(blobPath(sessionId));
      if (!record?.state) return null;
      return {
        state: sanitizeState(record.state),
        createdAt: Number(record.createdAt || Date.now()),
        updatedAt: Number(record.updatedAt || Date.now()),
        legacyOriginal: record.legacyOriginal ?? null,
      };
    },
    async set(sessionId, record) {
      const payload = {
        state: sanitizeState(record.state),
        createdAt: Number(record.createdAt || Date.now()),
        updatedAt: Number(record.updatedAt || Date.now()),
        legacyOriginal: record.legacyOriginal ?? null,
      };
      await client.putJson(blobPath(sessionId), payload, { allowOverwrite: true });
    },
    async withSessionLock(sessionId, callback) {
      return withBlobSessionLock(client, sessionId, callback);
    },
  };
}

async function withBlobSessionLock(client, sessionId, callback) {
  const owner = randomUUID();
  const path = lockPath(sessionId);
  const deadline = Date.now() + SESSION_LOCK_TIMEOUT_MS;
  let locked = false;

  while (!locked) {
    try {
      await client.putJson(path, { owner, createdAt: Date.now() }, { allowOverwrite: false });
      locked = true;
    } catch (error) {
      await clearStaleBlobLock(client, path);
      if (Date.now() >= deadline) {
        const lockError = new Error('Session is busy. Retry the command.');
        lockError.status = 503;
        lockError.code = 'SESSION_BUSY';
        throw lockError;
      }
      await sleep(80 + Math.floor(Math.random() * 90));
    }
  }

  try {
    return await callback();
  } finally {
    const lock = await client.getJson(path).catch(() => null);
    if (lock?.owner === owner) {
      await client.del(path).catch(() => {});
    }
  }
}

async function clearStaleBlobLock(client, path) {
  const lock = await client.getJson(path).catch(() => null);
  if (!lock?.createdAt || Date.now() - Number(lock.createdAt) < SESSION_LOCK_STALE_MS) return;
  await client.del(path).catch(() => {});
}

async function withStorageTimeout(operation) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STORAGE_TIMEOUT_MS);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function blobPath(sessionId) {
  return `sessions/${sessionId}.json`;
}

function lockPath(sessionId) {
  return `locks/${sessionId}.json`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseBlobStoreId(token) {
  const storeId = String(token || '').split('_')[3] || '';
  if (!storeId) {
    const error = new Error('BLOB_READ_WRITE_TOKEN is malformed');
    error.status = 503;
    error.code = 'STORAGE_UNAVAILABLE';
    throw error;
  }
  return storeId;
}

function createBlobClient(token, storeId) {
  return {
    async getJson(path) {
      const response = await withStorageTimeout((abortSignal) => fetch(blobUrl(storeId, path), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        signal: abortSignal,
      }));
      if (response.status === 404) return null;
      if (!response.ok) throw blobError(response.status, `Blob get failed (${response.status})`);
      return response.json();
    },
    async putJson(path, payload, { allowOverwrite }) {
      const response = await blobApiFetch(token, storeId, `/?${new URLSearchParams({ pathname: path })}`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-vercel-blob-access': 'private',
          'x-add-random-suffix': '0',
          'x-allow-overwrite': allowOverwrite ? '1' : '0',
          'x-content-type': 'application/json; charset=utf-8',
          'x-cache-control-max-age': '60',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw blobError(response.status, `Blob put failed (${response.status})`);
    },
    async del(path) {
      const response = await blobApiFetch(token, storeId, '/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ urls: [blobUrl(storeId, path)] }),
      });
      if (!response.ok && response.status !== 404) throw blobError(response.status, `Blob delete failed (${response.status})`);
    },
  };
}

async function blobApiFetch(token, storeId, path, init) {
  return withStorageTimeout((abortSignal) => fetch(`https://vercel.com/api/blob${path}`, {
    ...init,
    headers: {
      'x-api-blob-request-id': `${storeId}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      'x-vercel-blob-store-id': storeId,
      'x-api-blob-request-attempt': '0',
      'x-api-version': '12',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
    signal: abortSignal,
  }));
}

function blobUrl(storeId, path) {
  return `https://${storeId}.private.blob.vercel-storage.com/${path}`;
}

function blobError(status, message) {
  const error = new Error(message);
  error.status = status === 409 || status === 412 ? 423 : 503;
  error.code = status === 409 || status === 412 ? 'SESSION_BUSY' : 'STORAGE_UNAVAILABLE';
  return error;
}

async function migrateLegacyJsonStore(db) {
  try {
    const text = await readFile(LEGACY_DATA_FILE, 'utf8');
    const legacy = JSON.parse(text);
    if (!legacy.sessions || typeof legacy.sessions !== 'object') return;
    const existing = db.prepare('SELECT COUNT(*) AS count FROM sessions').get();
    if (Number(existing.count) > 0) return;
    const insert = db.prepare('INSERT OR IGNORE INTO sessions (id, state_json, created_at, updated_at) VALUES (?, ?, ?, ?)');
    const migrate = db.transaction((sessions) => {
      for (const [sessionId, record] of Object.entries(sessions)) {
        if (!validSessionId(sessionId) || !record?.state) continue;
        const createdAt = Number(record.createdAt || Date.now());
        const updatedAt = Number(record.updatedAt || Date.now());
        insert.run(sessionId, JSON.stringify(sanitizeState(record.state)), createdAt, updatedAt);
      }
    });
    migrate(legacy.sessions);
  } catch {
    // No legacy file is expected for fresh deployments.
  }
}

async function createJsonStore() {
  let data = await readFile(LEGACY_DATA_FILE, 'utf8')
    .then((text) => JSON.parse(text))
    .catch(() => ({ sessions: {} }));
  if (!data.sessions || typeof data.sessions !== 'object') data = { sessions: {} };
  return {
    kind: 'json-fallback',
    async get(sessionId) {
      const record = data.sessions[sessionId];
      if (!record) return null;
      return {
        state: sanitizeState(record.state),
        createdAt: Number(record.createdAt || Date.now()),
        updatedAt: Number(record.updatedAt || Date.now()),
      };
    },
    async set(sessionId, record) {
      data.sessions[sessionId] = {
        state: sanitizeState(record.state),
        createdAt: Number(record.createdAt || Date.now()),
        updatedAt: Number(record.updatedAt || Date.now()),
      };
      await mkdir(dirname(LEGACY_DATA_FILE), { recursive: true });
      await writeFile(LEGACY_DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    },
  };
}

function setSecurityHeaders(response) {
  response.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${PUBLIC_API_ORIGIN}; object-src 'none'; base-uri 'self'; form-action 'self'`);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  if (ALLOW_ORIGIN) {
    response.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-Match');
    response.setHeader('Vary', 'Origin');
  }
}

function rateLimit(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(ip) || { resetAt: now + RATE_WINDOW_MS, count: 0 };
  if (bucket.resetAt <= now) {
    bucket.resetAt = now + RATE_WINDOW_MS;
    bucket.count = 0;
  }
  bucket.count += 1;
  rateBuckets.set(ip, bucket);
  return bucket.count <= RATE_LIMIT;
}

// The raw original stays server-side; the client gets the decision record only.
function publicReport(report) {
  return {
    legacyVersion: report.legacyVersion,
    summary: report.summary,
    notes: report.notes,
    quarantine: report.quarantine,
    quarantinedCount: report.quarantine.length,
    originalBytes: report.original.length,
  };
}

function problem(code, message, requestId) {
  return { error: { code, message, requestId } };
}

function validSessionId(value) {
  return typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value);
}

function sendJson(response, status, body) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  return send(response, status, `${JSON.stringify(body)}\n`);
}

function send(response, status, body = '') {
  response.statusCode = status;
  response.end(body);
}

function contentType(filePath) {
  const ext = extname(filePath);
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
  }[ext] || 'application/octet-stream';
}

function isMainModule() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}
