/**
 * MixMash report intake Worker (quality operations pilot)
 *
 * Receives player reports from the static games on mixmash.games and writes
 * each one as a row in the studio issue backlog in Notion. The Notion token
 * lives only here, as a Worker secret; the public site never sees it.
 *
 *   POST /v1/reports   one report, JSON, validated by src/kit/report-schema.mjs
 *   OPTIONS            CORS preflight for allowed origins
 *   GET  /health       { ok, configured } with no secrets
 *
 * Guards, in order: method and path, origin allowlist, configuration present
 * (fails closed), per-client and global rate limits, content type, body size,
 * contract validation (player source only), duplicate report id, then the
 * Notion write. Notion errors are logged and never echoed to the client.
 *
 * Bindings and settings (see workers/report-intake/README.md):
 *   NOTION_TOKEN         secret, internal integration token
 *   NOTION_DATABASE_ID   secret, id of the issue backlog database
 *   ALLOWED_ORIGINS      var, comma separated origins (default mixmash.games)
 *   CLIENT_LIMITER       rate limit binding, per client
 *   GLOBAL_LIMITER       rate limit binding, whole endpoint
 *
 * No IP address, name or email is stored. The client IP is used only as the
 * rate limit key inside Cloudflare.
 */
import { LIMITS, PUBLIC_SOURCES, toNotionProperties, validateReport } from '../../../src/kit/report-schema.mjs';

export const NOTION_API = 'https://api.notion.com/v1';
export const NOTION_VERSION = '2022-06-28';
const DEFAULT_ORIGINS = 'https://mixmash.games,https://www.mixmash.games';

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS)
    .split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

export function isConfigured(env) {
  return Boolean(env.NOTION_TOKEN && env.NOTION_DATABASE_ID && env.CLIENT_LIMITER && env.GLOBAL_LIMITER);
}

async function readBody(request) {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > LIMITS.body) return { tooLarge: true };
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > LIMITS.body) return { tooLarge: true };
  return { text: new TextDecoder().decode(buffer) };
}

function notionHeaders(env) {
  return {
    Authorization: `Bearer ${env.NOTION_TOKEN}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

async function findExisting(env, reportId, fetchImpl) {
  const response = await fetchImpl(`${NOTION_API}/databases/${env.NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(env),
    body: JSON.stringify({ page_size: 1, filter: { property: 'Report ID', rich_text: { equals: reportId } } }),
  });
  if (!response.ok) throw new Error(`notion query ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.results) && data.results.length > 0;
}

async function createRow(env, report, fetchImpl) {
  const response = await fetchImpl(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: notionHeaders(env),
    body: JSON.stringify({ parent: { database_id: env.NOTION_DATABASE_ID }, properties: toNotionProperties(report) }),
  });
  if (!response.ok) throw new Error(`notion create ${response.status}`);
}

/**
 * The request handler, exported for tests. `deps.fetch` replaces the global
 * fetch so tests never reach Notion; `deps.log` replaces console.error.
 */
export async function handleRequest(request, env = {}, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const log = deps.log || ((...args) => console.error(...args));
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/health') {
    return json(200, { ok: true, configured: isConfigured(env) });
  }
  if (url.pathname !== '/v1/reports') return json(404, { ok: false, error: 'not_found' });

  const origin = (request.headers.get('Origin') || '').replace(/\/+$/, '');
  if (!origin || !allowedOrigins(env).includes(origin)) {
    return json(403, { ok: false, error: 'origin_not_allowed' });
  }
  const cors = corsHeaders(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' }, { ...cors, Allow: 'POST, OPTIONS' });

  if (!isConfigured(env)) {
    log('report-intake: missing NOTION_TOKEN, NOTION_DATABASE_ID or a rate limit binding');
    return json(503, { ok: false, error: 'intake_not_configured' }, cors);
  }

  const clientKey = request.headers.get('CF-Connecting-IP') || 'unknown';
  const [client, global] = await Promise.all([
    env.CLIENT_LIMITER.limit({ key: clientKey }),
    env.GLOBAL_LIMITER.limit({ key: 'all' }),
  ]);
  if (!client.success || !global.success) {
    return json(429, { ok: false, error: 'rate_limited' }, { ...cors, 'Retry-After': '60' });
  }

  const type = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!type.startsWith('application/json')) return json(415, { ok: false, error: 'json_required' }, cors);

  const body = await readBody(request);
  if (body.tooLarge) return json(413, { ok: false, error: 'too_large' }, cors);

  let input;
  try { input = JSON.parse(body.text); } catch { return json(400, { ok: false, errors: ['body is not valid JSON'] }, cors); }

  const result = validateReport(input, { sources: PUBLIC_SOURCES });
  if (!result.ok) return json(400, { ok: false, errors: result.errors }, cors);

  const { report } = result;
  try {
    if (await findExisting(env, report.reportId, fetchImpl)) {
      return json(200, { ok: true, reportId: report.reportId, duplicate: true }, cors);
    }
    await createRow(env, report, fetchImpl);
  } catch (error) {
    log('report-intake: notion write failed', report.reportId, String(error && error.message || error));
    return json(502, { ok: false, error: 'intake_unavailable', reportId: report.reportId }, cors);
  }
  return json(201, { ok: true, reportId: report.reportId }, cors);
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
