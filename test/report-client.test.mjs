// Report client helpers (src/kit/report.js): context, revision, report build
// and send, with no browser and no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, collectContext, describeDevice, failureMessage, resolveRevision, sendReport } from '../src/kit/report.js';

const UUID = '3f2b8c1e-9d4a-4e6b-8a1c-2b3d4e5f6a7b';

test('device labels stay coarse', () => {
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
  assert.equal(describeDevice({ userAgent: mac, maxTouchPoints: 0 }), 'Safari on Mac, no touch');
  assert.equal(describeDevice({ userAgent: mac, maxTouchPoints: 5 }), 'Safari on iPad, touch');
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
  assert.equal(describeDevice({ userAgent: android, maxTouchPoints: 5 }, () => ({ matches: true })), 'Chrome on Android, coarse pointer');
  const label = describeDevice({ userAgent: android });
  assert.equal(/\d{2,}/.test(label), false, 'no version numbers in the label');
});

test('context reads page, viewport and input mode', () => {
  const win = {
    location: { pathname: '/pitch/' },
    navigator: { userAgent: 'Firefox/120.0 Windows', maxTouchPoints: 0 },
    innerWidth: 1280.4, innerHeight: 719.6, devicePixelRatio: 1.25,
    document: { documentElement: { getAttribute: (name) => (name === 'data-input-mode' ? 'keyboard' : null) } },
  };
  assert.deepEqual(collectContext(win), { page: '/pitch/', device: 'Firefox on Windows, no touch', viewport: '1280x720 @1.25x', inputMode: 'keyboard' });
});

test('revision prefers the declared build, then Last-Modified', () => {
  assert.equal(resolveRevision(' 6afc534 ', ''), '6afc534');
  assert.equal(resolveRevision('', '11/28/2026 19:04:05'), `page modified ${new Date('11/28/2026 19:04:05').toISOString().slice(0, 16)}Z`);
  assert.equal(resolveRevision('', 'garbage'), 'unknown build');
});

test('an idea skips impact and validates against the contract', () => {
  const result = buildReport(
    { kind: 'idea', category: 'gameplay', impact: 'blocks', summary: 'Add a penalty shootout mode', steps: '', screenshotUrl: '' },
    { game: 'pitch', revision: 'r1', context: { page: '/pitch/', device: 'd', viewport: 'v', inputMode: '' }, reportId: UUID },
  );
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.report.impact, 'minor');
  assert.equal(result.report.source, 'player');
});

test('a short summary fails before anything is sent', () => {
  const result = buildReport({ kind: 'problem', category: 'controls', impact: 'hurts', summary: 'bad' },
    { game: 'pitch', revision: 'r1', context: {}, reportId: UUID });
  assert.equal(result.ok, false);
});

test('send posts JSON without credentials and reads the answer', async () => {
  let seen;
  const fetchImpl = async (url, init) => { seen = { url, init }; return new Response(JSON.stringify({ ok: true, reportId: UUID }), { status: 201 }); };
  const result = await sendReport('https://intake.example/v1/reports', { reportId: UUID }, fetchImpl);
  assert.deepEqual(result, { ok: true, status: 201, duplicate: false, errors: [] });
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.credentials, 'omit');
  assert.equal(seen.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(seen.init.body), { reportId: UUID });
});

test('send never throws on network failure or timeout', async () => {
  const down = await sendReport('https://intake.example/v1/reports', {}, async () => { throw new TypeError('offline'); });
  assert.deepEqual(down, { ok: false, status: 0, errors: [] });
  const slow = (url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
  const timedOut = await sendReport('https://intake.example/v1/reports', {}, slow, 20);
  assert.equal(timedOut.status, 0);
});

test('failure lines keep the player in the form', () => {
  assert.match(failureMessage({ status: 0 }), /still here/);
  assert.match(failureMessage({ status: 429 }), /minute/);
  assert.match(failureMessage({ status: 400 }), /didn/);
  assert.match(failureMessage({ status: 502 }), /trouble/);
});
