/**
 * MixMash service worker (HUB-104)
 *
 * Strategy: network-first for every same-origin GET, with the cache as an
 * offline fallback. Fresh content therefore always wins while the player is
 * online — a cache-first worker on a static host is how a site gets stuck
 * serving a build nobody can flush.
 *
 * The precache list is the shell of each game (page + its own scripts/styles),
 * not the whole repo. Big binaries like the EMPIRES .wasm are cached lazily on
 * first successful fetch rather than force-installed.
 */

const VERSION = 'v3';
const CACHE = `mixmash-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './404.html',
  './offline.html',
  './favicon.svg',
  './manifest.webmanifest',
  './src/kit/nav.js',
  './src/kit/save.js',
  './play/',
  './play/index.html',
  './play/core.js',
  './play/stage-data.js',
  './play/fighter-data.js',
  './play/input-data.js',
  './play/mode-rules.js',
  './play/snapshot-data.js',
  './pitch/',
  './pitch/index.html',
  './mars/',
  './mars/index.html',
  './mars/styles.css',
  './mars/game.js',
  './mars/engine.mjs',
  './mars/render-contract.mjs',
  './mars/sprites.mjs',
  './mars/sprite-canvas.mjs',
  './mars/commissioned-art.mjs',
  './mars/assets/manifest.json',
  './mars/assets/mars-terrain.svg',
  './mars/assets/commissioned/index.json',
  './mars/golden-scene.html',
  './mars/golden-scene.css',
  './mars/golden-scene.js',
  './mars/art/golden-slice.json',
  './mars/art/golden-scene.json',
  './mars/art/reports/artist-test-approval.json',
  './mars/art/reports/golden-approval.json',
  './garden/',
  './garden/index.html',
  './empires/',
  './empires/index.html',
  './empires/assets/shell.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll() is all-or-nothing; one 404 would abort the whole install, so
    // each entry is cached independently and failures are tolerated.
    await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => (name === CACHE ? null : caches.delete(name))));
    await self.clients.claim();
  })());
});

function isCacheable(response) {
  return response && response.status === 200 && response.type === 'basic';
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // never touch third-party traffic
  if (url.pathname.startsWith('/api/')) return;      // authority calls must not be cached

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (isCacheable(response)) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const offline = await caches.match('./offline.html');
        if (offline) return offline;
      }
      throw error;
    }
  })());
});

// Lets a page force an update without a reload dance.
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
