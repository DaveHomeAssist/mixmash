import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyCommand, createState, publicState, sanitizeState } from './engine.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || process.env.MARSSCAPE_PORT || 8787);
const DB_FILE = process.env.MARSSCAPE_DB_FILE || join(ROOT, '.data', 'sessions.sqlite');
const LEGACY_DATA_FILE = process.env.MARSSCAPE_DATA_FILE || join(ROOT, '.data', 'sessions.json');
const SECRET = process.env.MARSSCAPE_SECRET || randomBytes(32).toString('hex');
const ALLOW_ORIGIN = process.env.MARSSCAPE_ALLOW_ORIGIN || '';
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 160;

let storePromise;
const rateBuckets = new Map();

const server = createServer(async (request, response) => {
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
      return handleApi(request, response, api, requestId);
    }
    return serveStatic(response, url.pathname);
  } catch (error) {
    const status = Number(error.status || error.statusCode || 500);
    const code = error.code || 'INTERNAL_ERROR';
    const message = status >= 500 ? 'Unexpected server error' : error.message;
    return sendJson(response, status, problem(code, message, requestId));
  }
});

server.listen(PORT, () => {
  console.log(`MarsScape authority listening on http://localhost:${PORT}`);
  if (!process.env.MARSSCAPE_SECRET) {
    console.warn('MARSSCAPE_SECRET is not set; using a per-process development secret.');
  }
});

async function handleApi(request, response, apiPath, requestId) {
  if (request.method === 'GET' && apiPath === '/health') {
    const store = await getSessionStore();
    return sendJson(response, 200, {
      ok: true,
      service: 'marsscape-authority',
      storage: store.kind,
      time: new Date().toISOString(),
    });
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

  const sessionMatch = apiPath.match(/^\/sessions\/([a-f0-9-]{36})(?:\/commands)?$/i);
  if (!sessionMatch) {
    return sendJson(response, 404, problem('NOT_FOUND', 'Endpoint not found', requestId));
  }

  const sessionId = sessionMatch[1];
  const store = await getSessionStore();
  const record = await store.get(sessionId);
  if (!record) {
    return sendJson(response, 404, problem('SESSION_NOT_FOUND', 'Session not found', requestId));
  }

  if (request.method === 'GET' && apiPath === `/sessions/${sessionId}`) {
    return sendSession(response, sessionId, record.state);
  }

  if (request.method === 'POST' && apiPath === `/sessions/${sessionId}/commands`) {
    const command = await readJson(request);
    const result = applyCommand(record.state, command);
    record.state = result.state;
    record.updatedAt = Date.now();
    await store.set(sessionId, record);
    return sendSession(response, sessionId, record.state, result.events);
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
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 256_000) {
      const error = new Error('Request body too large');
      error.status = 413;
      error.code = 'BODY_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Malformed JSON body');
    error.status = 400;
    error.code = 'BAD_JSON';
    throw error;
  }
}

async function getSessionStore() {
  if (!storePromise) storePromise = openSessionStore();
  return storePromise;
}

async function openSessionStore() {
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
  const select = db.prepare('SELECT state_json, created_at, updated_at FROM sessions WHERE id = ?');
  const upsert = db.prepare(`
    INSERT INTO sessions (id, state_json, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
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
      };
    },
    async set(sessionId, record) {
      const createdAt = Number(record.createdAt || Date.now());
      const updatedAt = Number(record.updatedAt || Date.now());
      upsert.run(sessionId, JSON.stringify(sanitizeState(record.state)), createdAt, updatedAt);
    },
  };
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
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'");
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
  const ip = request.socket.remoteAddress || 'unknown';
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
