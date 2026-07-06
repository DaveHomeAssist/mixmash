import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const tmp = await mkdtemp(join(tmpdir(), 'marsscape-api-'));
const port = 18_787 + Math.floor(Math.random() * 1000);
const dbFile = join(tmp, 'sessions.sqlite');
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('.', import.meta.url),
  env: {
    ...process.env,
    MARSSCAPE_PORT: String(port),
    MARSSCAPE_DB_FILE: dbFile,
    MARSSCAPE_SECRET: 'test-secret',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

after(async () => {
  if (server.exitCode === null && !server.killed) {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
  }
  await rm(tmp, { recursive: true, force: true });
});

test('authority API uses sqlite and ignores client-seeded resources', async () => {
  await waitForServer();
  const health = await jsonFetch('/api/health');
  assert.equal(health.ok, true);
  assert.equal(health.storage, 'sqlite');

  const sessionId = '11111111-1111-4111-8111-111111111111';
  const created = await jsonFetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      state: {
        meters: { oxygen: 9999, power: 9999 },
        inventory: { iron_ore: 999 },
      },
    }),
  });
  assert.equal(created.sessionId, sessionId);
  assert.equal(created.state.inventory.iron_ore, 0);
  assert.equal(created.state.meters.oxygen, 100);

  const gathered = await jsonFetch(`/api/sessions/${sessionId}/commands`, {
    method: 'POST',
    body: JSON.stringify({ id: 'api-cmd-1', type: 'gather', nodeId: 'iron-north' }),
  });
  assert.equal(gathered.state.inventory.iron_ore, 1);
  assert.equal(gathered.state.seq, 1);

  const duplicate = await jsonFetch(`/api/sessions/${sessionId}/commands`, {
    method: 'POST',
    body: JSON.stringify({ id: 'api-cmd-1', type: 'gather', nodeId: 'iron-north' }),
  });
  assert.equal(duplicate.state.inventory.iron_ore, 1);
  assert.equal(duplicate.state.seq, 1);

  await stat(dbFile);
});

async function waitForServer() {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Server exited before readiness: ${server.exitCode}`);
    }
    try {
      await jsonFetch('/api/health');
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('Server did not become ready');
}

async function jsonFetch(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `HTTP ${response.status}`);
  }
  return data;
}
