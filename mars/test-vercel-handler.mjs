import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = await mkdtemp(join(tmpdir(), 'marsscape-handler-'));
const port = 20_787 + Math.floor(Math.random() * 1000);

process.env.MARSSCAPE_DB_FILE = join(tmp, 'sessions.sqlite');
process.env.MARSSCAPE_SECRET = 'handler-test-secret';
delete process.env.MARSSCAPE_STORAGE;
delete process.env.VERCEL;
delete process.env.BLOB_READ_WRITE_TOKEN;

const { handleNodeRequest } = await import(`./server.mjs?handler-test=${Date.now()}`);
const server = createServer((request, response) => handleNodeRequest(request, response, { serveStaticFiles: false }));

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(tmp, { recursive: true, force: true });
});

test('node-compatible Vercel handler ends success, CORS preflight, and error responses', async () => {
  const health = await jsonFetch('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.ok, true);
  assert.equal(health.data.storage, 'sqlite');

  const preflight = await fetch(`http://127.0.0.1:${port}/api/sessions`, { method: 'OPTIONS' });
  assert.equal(preflight.status, 204);
  await preflight.text();

  const invalid = await jsonFetch('/api/sessions', { method: 'POST', body: '{' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.data.error.code, 'BAD_JSON');

  const wrongType = await fetch(`http://127.0.0.1:${port}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'session=bad',
  });
  assert.equal(wrongType.status, 415);
  assert.equal((await wrongType.json()).error.code, 'UNSUPPORTED_MEDIA_TYPE');

  const notFound = await jsonFetch('/not-api');
  assert.equal(notFound.status, 404);
  assert.equal(notFound.data.error.code, 'NOT_FOUND');

  const sessionId = '22222222-2222-4222-8222-222222222222';
  const created = await jsonFetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
  assert.equal(created.status, 200);
  assert.equal(created.data.sessionId, sessionId);

  const methodBlocked = await jsonFetch(`/api/sessions/${sessionId}`, { method: 'PUT' });
  assert.equal(methodBlocked.status, 405);
  assert.equal(methodBlocked.data.error.code, 'METHOD_NOT_ALLOWED');
});

test('blob storage mode fails closed when token is missing', async () => {
  const failPort = port + 3000;
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: {
      ...process.env,
      MARSSCAPE_PORT: String(failPort),
      MARSSCAPE_STORAGE: 'blob',
      MARSSCAPE_SECRET: 'handler-test-secret',
      BLOB_READ_WRITE_TOKEN: '',
    },
    stdio: ['ignore', 'ignore', 'ignore'],
  });

  try {
    const response = await waitForJson(failPort, '/api/health', 503);
    assert.equal(response.error.code, 'STORAGE_UNAVAILABLE');
  } finally {
    if (child.exitCode === null && !child.killed) {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve));
    }
  }
});

async function jsonFetch(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...options,
  });
  return {
    status: response.status,
    data: await response.json(),
  };
}

async function waitForJson(targetPort, path, expectedStatus) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${targetPort}${path}`, {
        headers: { Accept: 'application/json' },
      });
      if (response.status === expectedStatus) return response.json();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Server did not return ${expectedStatus}`);
}
