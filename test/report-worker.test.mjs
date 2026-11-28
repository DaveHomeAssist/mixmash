// Report intake Worker (workers/report-intake): guards and the Notion write,
// with Notion and the rate limit bindings replaced by fakes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NOTION_API, NOTION_VERSION, handleRequest, isConfigured } from '../workers/report-intake/src/index.mjs';

const ORIGIN = 'https://mixmash.games';
const URL_REPORTS = 'https://intake.example.workers.dev/v1/reports';

const limiter = (allow = true) => ({ calls: [], async limit(opts) { this.calls.push(opts); return { success: allow }; } });

function env(overrides = {}) {
  return {
    NOTION_TOKEN: 'test-token',
    NOTION_DATABASE_ID: 'db123',
    ALLOWED_ORIGINS: 'https://mixmash.games,https://www.mixmash.games',
    CLIENT_LIMITER: limiter(),
    GLOBAL_LIMITER: limiter(),
    ...overrides,
  };
}

function fakeNotion({ existing = false, queryStatus = 200, createStatus = 200 } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    if (url.endsWith('/query')) return new Response(JSON.stringify({ results: existing ? [{ id: 'p1' }] : [] }), { status: queryStatus });
    return new Response(JSON.stringify({ id: 'new' }), { status: createStatus });
  };
  return { calls, fetch };
}

const report = () => ({
  schema: 1,
  reportId: '3f2b8c1e-9d4a-4e6b-8a1c-2b3d4e5f6a7b',
  source: 'player',
  game: 'pitch',
  revision: 'page modified 2026-11-28T19:00Z',
  kind: 'problem',
  category: 'controls',
  impact: 'hurts',
  summary: 'Sprint stops working after halftime',
  context: { page: '/pitch/', device: 'Chrome on Mac, no touch', viewport: '1280x720 @2x', inputMode: 'keyboard' },
});

function post(body, headers = {}) {
  return new Request(URL_REPORTS, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const quiet = { log() {} };

test('a valid report becomes one Notion row', async () => {
  const notion = fakeNotion();
  const response = await handleRequest(post(report()), env(), { fetch: notion.fetch, ...quiet });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.deepEqual(await response.json(), { ok: true, reportId: report().reportId });
  assert.equal(notion.calls.length, 2);
  const create = notion.calls[1];
  assert.equal(create.url, `${NOTION_API}/pages`);
  assert.equal(create.init.headers['Notion-Version'], NOTION_VERSION);
  assert.equal(create.init.headers.Authorization, 'Bearer test-token');
  assert.equal(create.body.parent.database_id, 'db123');
  assert.equal(create.body.properties.Game.select.name, 'Pitch Riot');
  assert.equal(create.body.properties.Source.select.name, 'Player Report');
});

test('a repeated report id is not written twice', async () => {
  const notion = fakeNotion({ existing: true });
  const response = await handleRequest(post(report()), env(), { fetch: notion.fetch, ...quiet });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).duplicate, true);
  assert.equal(notion.calls.length, 1);
});

test('other origins are refused before anything else runs', async () => {
  const notion = fakeNotion();
  const e = env();
  for (const origin of ['https://evil.example', 'https://mixmash.games.evil.example', '']) {
    const response = await handleRequest(post(report(), { Origin: origin }), e, { fetch: notion.fetch, ...quiet });
    assert.equal(response.status, 403, origin);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  assert.equal(notion.calls.length, 0);
  assert.equal(e.CLIENT_LIMITER.calls.length, 0);
});

test('preflight answers allowed origins only', async () => {
  const ok = await handleRequest(new Request(URL_REPORTS, { method: 'OPTIONS', headers: { Origin: ORIGIN } }), env());
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  const bad = await handleRequest(new Request(URL_REPORTS, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env());
  assert.equal(bad.status, 403);
});

test('an unconfigured Worker fails closed', async () => {
  const notion = fakeNotion();
  const response = await handleRequest(post(report()), env({ NOTION_TOKEN: '' }), { fetch: notion.fetch, ...quiet });
  assert.equal(response.status, 503);
  assert.equal(notion.calls.length, 0);
  assert.equal(isConfigured({}), false);
});

test('health reports configuration without secrets', async () => {
  const response = await handleRequest(new Request('https://intake.example.workers.dev/health'), env());
  const body = await response.json();
  assert.deepEqual(body, { ok: true, configured: true });
  assert.equal(JSON.stringify(body).includes('test-token'), false);
});

test('rate limits key on the client and on the whole endpoint', async () => {
  const e = env({ CLIENT_LIMITER: limiter(false) });
  const notion = fakeNotion();
  const response = await handleRequest(post(report()), e, { fetch: notion.fetch, ...quiet });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
  assert.deepEqual(e.CLIENT_LIMITER.calls, [{ key: '203.0.113.9' }]);
  assert.deepEqual(e.GLOBAL_LIMITER.calls, [{ key: 'all' }]);
  assert.equal(notion.calls.length, 0);
  const flood = await handleRequest(post(report()), env({ GLOBAL_LIMITER: limiter(false) }), { fetch: notion.fetch, ...quiet });
  assert.equal(flood.status, 429);
});

test('wrong method, type, size and JSON are refused', async () => {
  const notion = fakeNotion();
  const deps = { fetch: notion.fetch, ...quiet };
  const get = await handleRequest(new Request(URL_REPORTS, { headers: { Origin: ORIGIN } }), env(), deps);
  assert.equal(get.status, 405);
  assert.equal((await handleRequest(post(report(), { 'Content-Type': 'text/plain' }), env(), deps)).status, 415);
  assert.equal((await handleRequest(post('x'.repeat(9000)), env(), deps)).status, 413);
  assert.equal((await handleRequest(post('{not json'), env(), deps)).status, 400);
  assert.equal((await handleRequest(new Request('https://intake.example.workers.dev/other', { method: 'POST' }), env(), deps)).status, 404);
  assert.equal(notion.calls.length, 0);
});

test('contract errors come back, audit sources are refused', async () => {
  const notion = fakeNotion();
  const bad = { ...report(), source: 'claude-audit', summary: 'no' };
  const response = await handleRequest(post(bad), env(), { fetch: notion.fetch, ...quiet });
  assert.equal(response.status, 400);
  const { errors } = await response.json();
  assert.ok(errors.includes('source is not accepted here'));
  assert.ok(errors.includes('summary must be at least 5 characters'));
  assert.equal(notion.calls.length, 0);
});

test('a Notion failure is logged and not echoed', async () => {
  const logged = [];
  const notion = fakeNotion({ createStatus: 401 });
  const response = await handleRequest(post(report()), env(), { fetch: notion.fetch, log: (...a) => logged.push(a.join(' ')) });
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.error, 'intake_unavailable');
  assert.equal(JSON.stringify(body).includes('401'), false);
  assert.match(logged[0], /notion create 401/);
});
