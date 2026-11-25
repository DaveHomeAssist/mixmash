// Empires bundle integrity and exact service-worker cache fallback regression checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url));
const shell = read('empires/assets/shell.js').toString();
const worker = read('sw.js').toString();
const index = read('empires/index.html').toString();
const origin = 'https://example.test';
const pins = JSON.parse(shell.match(/var empiresAssets = (\{[\s\S]*?\n\});/)[1]);

function workerHarness({ network, entries = [], oldEntries = [], quota = false } = {}) {
  const listeners = {};
  const current = new Map(entries);
  const old = new Map(oldEntries);
  const match = (map, request, options = {}) => {
    const key = typeof request === 'string' ? new URL(request, origin).href : request.url;
    return [...map].find(([url]) => options.ignoreSearch
      ? url.split('?')[0] === key.split('?')[0] : url === key)?.[1];
  };
  const cache = {
    match: async (request, options) => match(current, request, options),
    put: async (request, response) => {
      if (quota) throw new Error('QuotaExceededError');
      current.set(request.url, response);
    },
  };
  const context = vm.createContext({
    URL,
    self: { location: { origin }, addEventListener: (name, fn) => { listeners[name] = fn; } },
    caches: {
      open: async () => cache,
      match: async (request, options) => match(current, request, options) || match(old, request, options),
    },
    fetch: network || (async () => { throw new Error('offline'); }),
  });
  vm.runInContext(worker, context);
  return {
    current,
    request(path, init) {
      const request = new Request(origin + path, init);
      let result;
      listeners.fetch({ request, respondWith: (promise) => { result = promise; } });
      return result;
    },
  };
}

function basicResponse(body) {
  return { ok: true, status: 200, type: 'basic', body, clone() { return basicResponse(body); } };
}

test('bootstrap and all three engine artifacts have exact content pins', () => {
  for (const [file, pin] of Object.entries(pins)) {
    const digest = createHash('sha256').update(read('empires/assets/' + file)).digest();
    assert.equal(pin.integrity, 'sha256-' + digest.toString('base64'));
    assert.equal(pin.url, './assets/' + file + '?sha256=' + digest.toString('hex'));
  }
  const digest = createHash('sha256').update(shell).digest();
  assert.ok(index.includes('shell.js?sha256=' + digest.toString('hex')));
  assert.ok(index.includes('integrity="sha256-' + digest.toString('base64') + '"'));
  assert.doesNotMatch(index, /<script[^>]+src="\.\/assets\/aoe2-clone\.js/);
  // This is the generated loader contract the shell relies on, not an engine edit.
  assert.match(read('empires/assets/aoe2-clone.js').toString(), /Module\["getPreloadedPackage"\]/);
});

for (const file of ['shell.js', 'aoe2-clone.js', 'aoe2-clone.wasm', 'aoe2-clone.data']) {
  test(file + ': offline fallback cannot cross content hashes or use a legacy entry', async () => {
    const path = '/empires/assets/' + file;
    const expected = basicResponse('matching bytes');
    const h = workerHarness({ entries: [
      [origin + path, basicResponse('legacy bytes')],
      [origin + path + '?sha256=old', basicResponse('old bytes')],
      [origin + path + '?sha256=current', expected],
    ] });
    assert.equal(await h.request(path + '?sha256=current'), expected);
    await assert.rejects(h.request(path + '?sha256=missing'), /offline/);
  });
}

test('Empires does not consult another cache generation', async () => {
  const path = '/empires/assets/aoe2-clone.wasm?sha256=current';
  const h = workerHarness({ oldEntries: [[origin + path, basicResponse('old cache')]] });
  await assert.rejects(h.request(path), /offline/);
});

test('network receives integrity metadata and stores the exact request', async () => {
  const pin = pins['aoe2-clone.wasm'];
  const path = '/empires/' + pin.url.slice(2);
  const response = basicResponse('verified bytes');
  const h = workerHarness({ network: async (request) => {
    assert.equal(request.integrity, pin.integrity);
    assert.equal(request.cache, 'no-cache');
    return response;
  } });
  assert.equal(await h.request(path, { integrity: pin.integrity, cache: 'no-cache' }), response);
  assert.equal(h.current.get(origin + path).body, 'verified bytes');
});

test('quota failure does not discard successful network bytes', async () => {
  const response = basicResponse('network');
  const h = workerHarness({ quota: true, network: async () => response });
  assert.equal(await h.request('/empires/assets/aoe2-clone.wasm?sha256=current'), response);
});

test('HTTP failure can use the exact cached asset but never cache an error page', async () => {
  const path = '/empires/assets/aoe2-clone.js?sha256=current';
  const response = basicResponse('cached');
  const h = workerHarness({ entries: [[origin + path, response]], network: async () => new Response('missing', { status: 404 }) });
  assert.equal(await h.request(path), response);
  await assert.rejects(h.request(path + 'different'), /404/);
  assert.equal(h.current.size, 1);
});

test('non-Empires fallback retains its existing ignoreSearch behavior', async () => {
  for (const path of ['/front-of-house/game.js', '/horseshoes/game.js', '/src/hub/app.js']) {
    const response = basicResponse('existing game');
    const h = workerHarness({ entries: [[origin + path + '?old=1', response]] });
    assert.equal(await h.request(path + '?new=2'), response);
  }
  const h = workerHarness();
  assert.equal(h.request('/api/sessions'), undefined);
  assert.equal(h.request('/empires/assets/aoe2-clone.js', { method: 'POST' }), undefined);
});

// Exercise real Fetch integrity enforcement against local HTTP responses. The
// DOM and WASM callback are stubbed; gameplay and browser SRI remain separate.
async function shellHarness(t, { corrupt, status = 200 } = {}) {
  const server = createServer((request, response) => {
    const file = new URL(request.url, origin).pathname.split('/').pop();
    const body = corrupt === file ? Buffer.from('a different build') : read('empires/assets/' + file);
    response.writeHead(status, { 'Content-Length': body.length });
    response.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const base = 'http://127.0.0.1:' + server.address().port + '/empires/';
  const elements = new Map();
  const scripts = [];
  const instantiated = [];
  let complete;
  const settled = new Promise((resolve) => { complete = resolve; });
  const context = vm.createContext({
    URLSearchParams, Uint8Array,
    console: { log() {}, error() { complete('error'); } },
    setTimeout() {},
    window: { location: { search: '?mapSize=large' }, addEventListener() {} },
    document: {
      addEventListener() {},
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { style: {}, textContent: '' });
        return elements.get(id);
      },
      createElement: () => ({}),
      body: { appendChild(script) { scripts.push(script); complete('script'); } },
    },
    fetch: (url, options) => fetch(new URL(url, base), options),
    WebAssembly: { instantiate: async (bytes) => {
      instantiated.push(Buffer.from(bytes));
      return { instance: 'verified instance', module: 'verified module' };
    } },
  });
  vm.runInContext(shell, context);
  return { context, scripts, elements, instantiated, settled };
}

test('verified data is supplied to the glue without an unverified second download', { timeout: 10000 }, async (t) => {
  const h = await shellHarness(t);
  assert.equal(await h.settled, 'script');
  assert.equal(h.scripts.length, 1);
  assert.equal(h.scripts[0].src, pins['aoe2-clone.js'].url);
  assert.equal(h.scripts[0].integrity, pins['aoe2-clone.js'].integrity);
  assert.equal(h.scripts[0].crossOrigin, 'anonymous');
  assert.deepEqual(Buffer.from(h.context.Module.getPreloadedPackage()), read('empires/assets/aoe2-clone.data'));
  assert.equal(h.context.Module.locateFile('aoe2-clone.data'), pins['aoe2-clone.data'].url);
  assert.equal(h.context.Module.arguments.join(' '), '--map-size large');
  await new Promise((resolve) => h.context.Module.instantiateWasm({}, resolve));
  assert.deepEqual(h.instantiated[0], read('empires/assets/aoe2-clone.wasm'));
});

test('wrong-generation sprite data prevents glue execution and shows recovery text', { timeout: 10000 }, async (t) => {
  const h = await shellHarness(t, { corrupt: 'aoe2-clone.data' });
  assert.equal(await h.settled, 'error');
  // The error logger runs before the recovery text is assigned in the same task.
  assert.equal(h.scripts.length, 0);
  assert.match(h.elements.get('loadbar-label').textContent, /Reconnect and reload/);
});

test('wrong-generation WASM never reaches instantiation', { timeout: 10000 }, async (t) => {
  const h = await shellHarness(t, { corrupt: 'aoe2-clone.wasm' });
  await h.settled;
  let failed;
  const failure = new Promise((resolve) => { failed = resolve; });
  h.context.console.error = failed;
  h.context.Module.instantiateWasm({}, () => assert.fail('must not instantiate mismatched WASM'));
  await failure;
  assert.equal(h.instantiated.length, 0);
  assert.match(h.elements.get('loadbar-label').textContent, /Reconnect and reload/);
});

test('HTTP error for data prevents glue execution', { timeout: 10000 }, async (t) => {
  const h = await shellHarness(t, { status: 404 });
  assert.equal(await h.settled, 'error');
  assert.equal(h.scripts.length, 0);
});
