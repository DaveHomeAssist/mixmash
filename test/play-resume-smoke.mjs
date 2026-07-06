import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const port = 19_300 + Math.floor(Math.random() * 1_000);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    if (path.endsWith('/')) path += 'index.html';

    const filePath = normalize(join(root, path.replace(/^\/+/, '')));
    if (!filePath.startsWith(root)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    const info = await stat(filePath);
    const finalPath = info.isDirectory() ? join(filePath, 'index.html') : filePath;
    const body = await readFile(finalPath);
    response.writeHead(200, { 'Content-Type': contentTypes[extname(finalPath)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage();
  const errors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto(`http://127.0.0.1:${port}/play/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(250);

  async function step(frames) {
    for (let i = 0; i < frames; i++) {
      await page.evaluate(() => {
        if (typeof window.advanceTime === 'function') window.advanceTime(1000 / 60);
      });
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
  }

  async function press(key, frames = 2) {
    await page.keyboard.down(key);
    await step(frames);
    await page.keyboard.up(key);
    await step(4);
  }

  function readState() {
    return page.evaluate(() => JSON.parse(window.render_game_to_text()));
  }

  await press('Enter');
  await press('Enter');
  await press('Enter');
  await press('Enter');
  await step(90);

  const beforeReload = await readState();
  assert.equal(beforeReload.mode, 'playing');
  assert.equal(beforeReload.snapshotAvailable, true);
  assert.equal(beforeReload.players.length, 2);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(250);

  const afterReload = await readState();
  assert.equal(afterReload.mode, 'title');
  assert.equal(afterReload.snapshotAvailable, true);

  await press('KeyR');
  await step(15);

  const afterResume = await readState();
  assert.equal(afterResume.mode, 'playing');
  assert.equal(afterResume.snapshotAvailable, true);
  assert.equal(afterResume.players.length, 2);
  assert.ok(afterResume.frame >= beforeReload.frame, 'resume should continue from the saved frame');
  assert.deepEqual(errors, []);
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
