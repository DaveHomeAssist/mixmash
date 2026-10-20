import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)));

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
};

/**
 * Serves the repo as a static site on an ephemeral loopback port, the same way
 * GitHub Pages does. Returns { origin, close }.
 */
export async function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      let path = decodeURIComponent(url.pathname);
      if (path === '/') path = '/index.html';
      if (path.endsWith('/')) path += 'index.html';

      const filePath = normalize(join(repoRoot, path.replace(/^\/+/, '')));
      if (!filePath.startsWith(repoRoot)) {
        response.writeHead(403).end('Forbidden');
        return;
      }

      const info = await stat(filePath);
      const finalPath = info.isDirectory() ? join(filePath, 'index.html') : filePath;
      const body = await readFile(finalPath);
      response.writeHead(200, {
        'Content-Type': contentTypes[extname(finalPath)] || 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/**
 * Chromium launch options. CI uses Playwright's own managed download; sandboxes
 * that only have a system Chromium can point at it with PW_EXECUTABLE_PATH.
 */
export function launchOptions() {
  const options = { headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] };
  if (process.env.PW_EXECUTABLE_PATH) options.executablePath = process.env.PW_EXECUTABLE_PATH;
  return options;
}

/**
 * Collects page errors and *same-origin* request failures. Cross-origin misses
 * (web fonts on a sandboxed runner, for instance) are not this suite's problem
 * and would otherwise make the rail flaky. Cloudflare Web Analytics is also
 * ignored: the beacon is expected on production, but on localhost the RUM POST
 * fails CORS (Cloudflare only allows the registered hostname), which floods the
 * console without meaning the page itself is broken.
 */
export function trackPageFailures(page, origin, { ignore = [] } = {}) {
  const failures = [];
  // Localhost CORS from the Cloudflare beacon (Chromium names the host; WebKit
  // often only says "Access-Control-Allow-Origin" / "access control checks").
  const analyticsNoise = text => /cloudflareinsights\.com|cdn-cgi\/rum|Access-Control-Allow-Origin|access control checks/i.test(text);
  const ignored = (url) => ignore.some((pattern) => pattern.test(url)) || /cloudflareinsights\.com/i.test(url);
  page.on('pageerror', (error) => {
    if (analyticsNoise(String(error))) return;
    failures.push(`pageerror: ${error}`);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // "Failed to load resource" is reported without a URL; the requestfailed
    // handler below is the precise signal, so skip the vague duplicate.
    if (/Failed to load resource/i.test(text)) return;
    if (analyticsNoise(text)) return;
    failures.push(`console: ${text}`);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.startsWith(origin) && !ignored(url)) {
      failures.push(`request: ${url} (${request.failure()?.errorText})`);
    }
  });
  // A same-origin 404/500 is a *completed* request as far as Playwright is
  // concerned, so it never reaches requestfailed — and the console's "Failed to
  // load resource" line is filtered above. Without this listener a page missing
  // a script or stylesheet would still assert "loads clean".
  page.on('response', (response) => {
    const url = response.url();
    if (!url.startsWith(origin) || ignored(url)) return;
    if (response.status() >= 400) {
      failures.push(`response: ${url} (HTTP ${response.status()})`);
    }
  });
  return failures;
}

/**
 * Answers the Cloudflare Web Analytics beacon with an empty script and the RUM
 * endpoint with 204, for smokes that collect every console error themselves.
 * On localhost the real RUM POST fails CORS (Cloudflare only allows
 * mixmash.games) and smokes must not depend on a third-party network.
 * `target` is a Playwright page or browser context.
 */
export async function stubCloudflareAnalytics(target) {
  await target.route(/^https:\/\/static\.cloudflareinsights\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '' }));
  await target.route(/^https:\/\/cloudflareinsights\.com\//, (route) => route.fulfill({ status: 204, body: '' }));
}
