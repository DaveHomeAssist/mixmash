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

  const commandCreated = await jsonFetch('/api/sessions/33333333-3333-4333-8333-333333333333/commands', {
    method: 'POST',
    body: JSON.stringify({ id: 'api-cmd-bootstrap', type: 'gather', nodeId: 'iron-north' }),
  });
  assert.equal(commandCreated.state.inventory.iron_ore, 1);
  assert.equal(commandCreated.state.seq, 1);

  await stat(dbFile);
});

test('travel command round-trips through the real HTTP authority server', async () => {
  await waitForServer();
  const sessionId = '22222222-2222-4222-8222-222222222222';
  await jsonFetch('/api/sessions', { method: 'POST', body: JSON.stringify({ sessionId }) });

  // No fuel yet — the new command type must reach the engine and come back as a
  // structured GameError over real HTTP, not a 500 or an unrecognized-route failure.
  await assertRejects(
    () => jsonFetch(`/api/sessions/${sessionId}/commands`, {
      method: 'POST',
      body: JSON.stringify({ id: 'api-travel-1', type: 'travel', destRegion: 'dune_sea' }),
    }),
    /Need 1 Fuel/,
  );
});

async function assertRejects(fn, pattern) {
  try {
    await fn();
  } catch (error) {
    assert.match(error.message, pattern);
    return;
  }
  throw new Error('Expected the request to be rejected');
}

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

test('legacy import previews without writing, then commits a server-owned session', async () => {
  await waitForServer();
  const legacy = JSON.stringify({
    v: 4,
    sol: 12,
    skills: { mining: { xp: 100_000 }, fab: { xp: 50_000 } },
    inv: { iron_ore: 7, part: 3, voidglass: 1 },
    bank: { iron_bar: 90 },
    built: { habitat: true, green: true },
    research: { scrub: true },
    quest: 6,
  });

  // 1. preview: reports the conversion and writes nothing
  const preview = await jsonFetch('/api/sessions/import', {
    method: 'POST',
    body: JSON.stringify({ legacySave: legacy }),
  });
  assert.equal(preview.preview, true);
  assert.equal(preview.sessionId, undefined, 'a preview must not create a session');
  assert.equal(preview.report.quarantinedCount, 1, 'the unknown item is reported');
  assert.equal(preview.report.quarantine[0].path, 'inv.voidglass');
  assert.ok(preview.report.originalBytes > 0, 'the original is retained server-side');
  assert.equal(preview.report.original, undefined, 'the raw save is not echoed back');
  assert.equal(preview.state.inventory.component, 3, 'renames are applied in the preview');

  // 2. commit: creates the session and it is readable afterwards
  const committed = await jsonFetch('/api/sessions/import', {
    method: 'POST',
    body: JSON.stringify({ legacySave: legacy, commit: true }),
  });
  assert.equal(committed.preview, false);
  assert.match(committed.sessionId, /^[a-f0-9-]{36}$/);
  assert.equal(committed.state.built.greenhouse, true);
  assert.equal(committed.state.research.scrubbers, true);
  assert.equal(committed.state.objective, 6);

  const readBack = await jsonFetch(`/api/sessions/${committed.sessionId}`);
  assert.equal(readBack.state.bank.iron_bar, 90, 'banked resources survive the round trip');
  assert.equal(readBack.state.inventory.iron_ore, 7);

  // Review finding 2: the handler attached `legacyOriginal` but both store adapters
  // dropped it, so the promised rollback artefact never reached storage. Check the
  // database directly rather than trusting the 201.
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(dbFile);
  try {
    const row = db.prepare('SELECT legacy_original FROM sessions WHERE id = ?').get(committed.sessionId);
    assert.ok(row, 'the imported session is in the database');
    assert.ok(row.legacy_original, 'the rollback original is persisted, not dropped by the adapter');
    assert.deepEqual(JSON.parse(row.legacy_original), JSON.parse(legacy), 'and it round-trips to the original save');
  } finally {
    db.close();
  }
});

test('a junk legacy save is refused with a reason, not a 500', async () => {
  await waitForServer();
  const response = await fetch(`http://127.0.0.1:${port}/api/sessions/import`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ legacySave: 'this is not a save' }),
  });
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.error.code, 'UNREADABLE');
  assert.match(body.error.message, /MarsScape save/i);
});
