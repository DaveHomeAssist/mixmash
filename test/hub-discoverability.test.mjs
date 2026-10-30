/** Search/share metadata, sitemap, structured data, share controls and disabled revenue slots. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, access } from 'node:fs/promises';
import { games, playableGames } from '../src/hub/catalog.mjs';
import { monetization, supportEnabled, adsEnabled, supportBlock, supportFooterLink, adHead, adBlock } from '../src/hub/monetization.mjs';
const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const exists = file => access(new URL(file, root)).then(() => true, () => false);
const SITE = 'https://mixmash.games';
// Pages this repo owns the head of. EMPIRES and Front of House heads belong to other lanes.
const pages = [
  { file: 'index.html', url: `${SITE}/`, id: null },
  { file: 'play/index.html', url: `${SITE}/play/`, id: 'mixmash' },
  { file: 'pitch/index.html', url: `${SITE}/pitch/`, id: 'pitch' },
  { file: 'mars/index.html', url: `${SITE}/mars/`, id: 'mars' },
  { file: 'garden/index.html', url: `${SITE}/garden/`, id: 'garden' }
];
const meta = (html, key) => html.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`))?.[1];
const canonical = html => html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
const ldBlocks = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
async function imageSize(file) {
  const data = await readFile(new URL(file, root));
  if (data.subarray(1, 4).toString() === 'PNG') return [data.readUInt32BE(16), data.readUInt32BE(20)];
  for (let i = 2; i < data.length;) {
    const marker = data[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) return [data.readUInt16BE(i + 7), data.readUInt16BE(i + 5)];
    i += 2 + data.readUInt16BE(i + 2);
  }
  throw new Error(`${file}: no image size`);
}
test('every owned indexable page has a unique title, description, canonical and full share card', async () => {
  const titles = new Set();
  for (const page of pages) {
    const html = await read(page.file);
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    assert.ok(title && !titles.has(title), `${page.file}: unique title`); titles.add(title);
    assert.ok(meta(html, 'description')?.length >= 50, `${page.file}: description`);
    assert.equal(canonical(html), page.url, `${page.file}: canonical`);
    assert.equal(meta(html, 'og:url'), page.url, `${page.file}: og:url matches canonical`);
    for (const key of ['og:type', 'og:title', 'og:description', 'og:image:alt', 'twitter:title', 'twitter:description']) assert.ok(meta(html, key), `${page.file}: ${key}`);
    assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
    const image = meta(html, 'og:image');
    assert.equal(meta(html, 'twitter:image'), image, `${page.file}: one share image`);
    assert.ok(image.startsWith(`${SITE}/assets/`), `${page.file}: share image is on this domain`);
    assert.deepEqual(await imageSize(image.slice(SITE.length + 1)), [1200, 630], `${page.file}: 1200x630 share image`);
    assert.equal(meta(html, 'og:image:width'), '1200'); assert.equal(meta(html, 'og:image:height'), '630');
    if (page.id) assert.equal(image, `${SITE}/assets/og/${page.id}.jpg`, `${page.file}: game-specific card`);
  }
});
test('each playable game has a generated 1200x630 card', async () => {
  for (const game of playableGames) assert.deepEqual(await imageSize(`assets/og/${game.id}.jpg`), [1200, 630], game.id);
});
test('structured data parses and repeats catalog facts only', async () => {
  const [hub] = ldBlocks(await read('index.html'));
  const graph = hub['@graph'];
  assert.equal(hub['@context'], 'https://schema.org');
  assert.deepEqual(graph.map(node => node['@type']), ['WebSite', 'Organization', 'ItemList']);
  const items = graph[2].itemListElement.map(entry => entry.item);
  assert.deepEqual(items.map(item => [item.name, item.url, item.description, item.genre]), playableGames.map(g => [g.name, `${SITE}${g.route}`, g.description, g.genre]));
  for (const item of items) assert.equal(item.offers.price, '0');
  for (const page of pages.filter(page => page.id)) {
    const game = games.find(g => g.id === page.id);
    const blocks = ldBlocks(await read(page.file));
    assert.equal(blocks.length, 1, `${page.file}: one JSON-LD block`);
    assert.equal(blocks[0]['@type'], 'VideoGame');
    assert.deepEqual([blocks[0].name, blocks[0].url, blocks[0].description], [game.name, page.url, game.description], `${page.file}: catalog facts`);
  }
});
test('sitemap and robots agree with canonicals and keep noindex pages out', async () => {
  const sitemap = await read('sitemap.xml');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.equal(new Set(locs).size, locs.length, 'no duplicate entries');
  for (const page of pages) assert.ok(locs.includes(page.url), `${page.url} in sitemap`);
  for (const loc of locs) {
    assert.ok(loc.startsWith(`${SITE}/`));
    const path = loc.slice(SITE.length + 1);
    const file = !path || path.endsWith('/') ? `${path}index.html` : path;
    assert.ok(await exists(file), `${loc}: served file exists`);
    const html = await read(file);
    assert.doesNotMatch(html, /name="robots" content="noindex/, `${loc}: indexable`);
    // EMPIRES' canonical (no trailing slash) is owned by the EMPIRES lane; see SEO_SETUP.md.
    if (!path.startsWith('empires/')) assert.equal(canonical(html), loc, `${loc}: canonical matches sitemap`);
    assert.match(sitemap.match(new RegExp(`<loc>${loc.replace(/[.?]/g, '\\$&')}</loc>\\s*<lastmod>(\\d{4}-\\d{2}-\\d{2})</lastmod>`))?.[1] || '', /^2026-/);
  }
  for (const hidden of ['/front-of-house/', '/horseshoes/', '/admin', '/home.html']) assert.ok(!sitemap.includes(hidden), `${hidden} stays out`);
  const robots = await read('robots.txt');
  assert.match(robots, /^User-agent: \*$/m); assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, new RegExp(`^Sitemap: ${SITE}/sitemap.xml$`, 'm'));
});
test('share controls exist for the studio and every game, hidden until JavaScript wires them', async () => {
  const html = await read('index.html');
  const buttons = [...html.matchAll(/<button class="button share-button"[^>]*>/g)].map(m => m[0]);
  assert.equal(buttons.length, playableGames.length + 1);
  for (const button of buttons) assert.match(button, / hidden>$/);
  assert.ok(buttons.some(b => b.includes(`data-share-url="${SITE}/"`)));
  for (const game of playableGames) assert.ok(buttons.some(b => b.includes(`data-share-url="${SITE}${game.route}"`) && b.includes(`aria-label="Share ${game.name}"`)), game.id);
  const app = await read('src/hub/app.js');
  assert.match(app, /navigator\.share/); assert.match(app, /navigator\.clipboard\.writeText/);
});
test('Ko-fi support on, ads off; analytics is the only third-party script', async () => {
  assert.equal(monetization.supportUrl, 'https://ko-fi.com/avbydave'); assert.equal(monetization.adsensePublisherId, ''); assert.equal(monetization.adsenseSlotId, '');
  assert.equal(supportEnabled(), true); assert.equal(adsEnabled(), false);
  assert.equal(adHead() + adBlock(), '');
  const html = await read('index.html');
  for (const marker of ['data-ad-slot', 'adsbygoogle', 'googlesyndication', 'patreon']) assert.ok(!html.includes(marker), `homepage has no ${marker}`);
  assert.equal((html.match(/data-support-slot/g) || []).length, 2, 'Ko-fi block and footer link');
  assert.ok(!/<script[^>]+ko-fi/i.test(html), 'Ko-fi is a plain link, no Ko-fi script or widget');
  const external = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]).filter(src => /^https?:/.test(src));
  assert.deepEqual(external, ['https://static.cloudflareinsights.com/beacon.min.js'], 'only the Cloudflare analytics beacon');
  assert.ok(html.includes(`data-cf-beacon='{"token":"3aeddc4297384179a3dcb309314cb365"}'`), 'homepage carries the live analytics token');
  assert.equal(await exists('ads.txt'), false, 'no ads.txt until a real publisher ID exists');
});
test('revenue slots render only for well-formed values', () => {
  const on = { supportUrl: 'https://ko-fi.com/example', supportLabel: 'Support MixMash', adsensePublisherId: 'ca-pub-1234567890123456', adsenseSlotId: '1234567890' };
  assert.match(supportBlock(on), /href="https:\/\/ko-fi\.com\/example" target="_blank" rel="noopener"/);
  assert.match(supportFooterLink(on), /data-support-slot/);
  assert.match(adHead(on), /adsbygoogle\.js\?client=ca-pub-1234567890123456"/);
  assert.match(adBlock(on), /data-ad-slot="1234567890"/);
  assert.match(adBlock(on), /aria-label="Advertisement"/);
  for (const bad of [{ supportUrl: 'http://ko-fi.com/x' }, { supportUrl: 'javascript:alert(1)' }, { supportUrl: 'not a url' }]) assert.equal(supportBlock(bad), '', JSON.stringify(bad));
  for (const bad of [{ adsensePublisherId: 'pub-1234567890123456', adsenseSlotId: '1234567890' }, { adsensePublisherId: 'ca-pub-1234567890123456', adsenseSlotId: '' }, { adsensePublisherId: 'ca-pub-123"><script>', adsenseSlotId: '1' }]) assert.equal(adHead(bad) + adBlock(bad), '', JSON.stringify(bad));
  assert.ok(!supportBlock({ supportUrl: 'https://x.example/"><script>' }).includes('"><script>'), 'support URL is escaped');
});
test('Privacy note (PRIV-03): linked from the homepage footer and Studio view, names the analytics, studio contact only', async () => {
  const html = await read('index.html');
  assert.match(html, /<footer class="site-footer">[^]*<a class="privacy-link" href="\/privacy\/">Privacy<\/a>[^]*<\/footer>/, 'footer links the privacy note');
  assert.match(html, /<div class="studio-links">[^]*href="\/privacy\/">Privacy<\/a>/, 'Studio view links it too (the footer is hidden on phones)');
  const note = await read('privacy/index.html');
  assert.equal(canonical(note), `${SITE}/privacy/`);
  assert.ok(note.includes('Last updated October 30, 2026'), 'dated');
  assert.ok(note.includes('Cloudflare Web Analytics'), 'names the analytics in use');
  assert.ok(note.includes('mailto:avbydave@gmail.com'), 'studio contact');
  assert.ok(!/daverobertson/i.test(note), 'never a personal address');
  assert.ok(!/<script[^>]+src=/i.test(note), 'the note itself loads no scripts');
  assert.ok((await read('sitemap.xml')).includes(`<loc>${SITE}/privacy/</loc>`), 'in the sitemap');
});
