// Browser smoke rail for the admin index (mixmash.games/admin/).
//
// Checks, at six widths from 320 px to a 32:9 ultrawide: light by default even
// when the OS prefers dark, no page scroll on any tab, side rail on desktop and
// bottom rail on phones, every catalogued file rendered once, readable contrast
// in both themes, keyboard tabs, category filters, deep links, search and
// privacy. Screenshots and report.json go to the temporary directory printed at
// exit (or ADMIN_SCREENSHOT_DIR). For live readback:
//   ADMIN_BASE_URL=https://mixmash.games/admin/ npm run smoke:admin
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer, launchOptions, trackPageFailures } from './static-server.mjs';

const server = process.env.ADMIN_BASE_URL ? null : await startStaticServer();
const url = process.env.ADMIN_BASE_URL || `${server.origin}/admin/`;
const output = process.env.ADMIN_SCREENSHOT_DIR || await mkdtemp(join(tmpdir(), 'admin-smoke-'));
await mkdir(output, { recursive: true });
const browser = await chromium.launch(launchOptions());
const PRIVATE = /\/Users\/|\/Volumes\/|app\.notion\.com|notion\.so|github\.com\/DaveHomeAssist\/Zelda2MarioCoop/i;
const READABLE = ['.tab-name', '.tab-meta', '.tab-count', '.brand-sub', '.kicker', '.stat-line', '.chip', '.tape', '.cat-count', '.cat-desc', '.file-title', '.file-path', '.file-desc', '.act', '.mix-item', '.pcard-kind', '.box-title', '.box p', '.link-list code', '.ref-meta', '.note p', '.search input'];
const results = [];

async function assertReadable(page, label) {
  const failures = await page.evaluate((selectors) => {
    const rgb = (value) => (value.match(/[\d.]+/g) || []).map(Number);
    const lum = (color) => color.slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const out = [];
    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) {
        if (!node.getClientRects().length || node.closest('[hidden]')) continue;
        let parent = node;
        let background;
        while (parent) {
          const color = rgb(getComputedStyle(parent).backgroundColor);
          if (color.length === 3 || color[3] === 1) { background = color; break; }
          parent = parent.parentElement;
        }
        if (!background) background = [255, 255, 255];
        const [high, low] = [lum(rgb(getComputedStyle(node).color)), lum(background)].sort((a, b) => b - a);
        const ratio = (high + 0.05) / (low + 0.05);
        if (ratio < 4.5) out.push({ selector, text: node.textContent.trim().slice(0, 40), ratio: Number(ratio.toFixed(2)) });
      }
    }
    return out.slice(0, 10);
  }, READABLE);
  assert.deepEqual(failures, [], `${label}: text meets 4.5:1 contrast`);
}

async function assertFits(page, width, height, label) {
  const box = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollTop: document.scrollingElement.scrollTop,
    clipped: [...document.querySelectorAll('.topbar > *, .brand, .panel:not([hidden]) .head-row > *, .panel:not([hidden]) .chips, .results:not([hidden]) .panel-head > *')]
      .filter((node) => node.getClientRects().length)
      .map((node) => { const r = node.getBoundingClientRect(); return { cls: node.className, left: r.left, right: r.right }; })
      .filter((r) => r.left < -1 || r.right > innerWidth + 1),
  }));
  assert.ok(box.scrollHeight <= box.clientHeight, `${label}: page does not scroll vertically (${box.scrollHeight} > ${box.clientHeight})`);
  assert.ok(box.scrollWidth <= box.clientWidth, `${label}: page does not scroll horizontally (${box.scrollWidth} > ${box.clientWidth})`);
  assert.equal(box.scrollTop, 0, `${label}: document never scrolled`);
  assert.deepEqual(box.clipped, [], `${label}: header content fits the viewport`);
  assert.equal(box.clientWidth, width);
  assert.ok(box.clientHeight <= height);
}

try {
  for (const [width, height] of [[320, 740], [375, 812], [390, 844], [768, 1024], [1440, 900], [2560, 720]]) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'dark', reducedMotion: 'reduce', serviceWorkers: 'block' });
    if (!process.env.ADMIN_BASE_URL) await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();
    const failures = trackPageFailures(page, new URL(url).origin);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    const catalog = await page.evaluate(() => fetch('catalog.json').then((r) => r.json()));
    const projects = catalog.projects;
    const filesFor = (id) => catalog.files.filter((file) => file.project === id);

    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light', 'light by default even when the OS prefers dark');
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
    assert.doesNotMatch(await page.content(), PRIVATE, 'no local paths, Notion or private source links');
    assert.equal(await page.locator('[role="tab"]').count(), projects.length + 1);
    assert.equal(await page.locator('[role="tab"][tabindex="0"]').count(), 1);
    assert.equal(await page.locator('.panels .file').count(), catalog.files.length, 'every catalogued file is rendered once');
    assert.equal(await page.locator('.pcard').count(), projects.length);
    const titleLinks = await page.locator('.panels .file-title').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
    assert.ok(titleLinks.every((href) => href.startsWith(`${catalog.repo.url}/blob/${catalog.repo.branch}/`)), 'file titles open the GitHub source view');

    const rail = await page.locator('.rail').boundingBox();
    if (width <= 720) {
      assert.ok(rail.y + rail.height >= height - 1 && rail.y > height / 2, `${width}: bottom rail on phones`);
      assert.equal(await page.locator('#tabs').getAttribute('aria-orientation'), 'horizontal');
    } else {
      assert.ok(rail.x === 0 && rail.height > height / 2, `${width}: side rail on wider screens`);
      assert.equal(await page.locator('#tabs').getAttribute('aria-orientation'), 'vertical');
    }

    await assertFits(page, width, height, `${width} overview`);
    await assertReadable(page, `${width} overview light`);
    if (width >= 1900) {
      const columns = await page.locator('.overview-grid').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length);
      assert.ok(columns >= 5, `ultrawide overview uses the width (${columns} columns)`);
    }
    await page.screenshot({ path: join(output, `${width}-overview-light.png`) });

    // Every tab fits the viewport, scrolls only inside its own body, and shows
    // exactly that project's files.
    for (const project of projects) {
      await page.locator(`#tab-${project.id}`).click();
      const panel = page.locator(`#panel-${project.id}`);
      assert.equal(await page.locator('[role="tabpanel"]:visible').count(), 1);
      assert.equal(await panel.isVisible(), true);
      assert.equal(await panel.locator('.file').count(), filesFor(project.id).length, `${project.id}: all of its files`);
      assert.equal(await panel.locator('.panel-body').evaluate((node) => getComputedStyle(node).overflowY), 'auto');
      assert.equal(await page.evaluate(() => window.location.hash), `#${project.id}`);
      await assertFits(page, width, height, `${width} ${project.id}`);
    }
    if (width >= 1900) {
      await page.locator('#tab-mars').click();
      const columns = await page.locator('#panel-mars .cats').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length);
      assert.ok(columns >= 3, `ultrawide project view adds category columns (${columns})`);
    }
    await page.locator('#tab-mars').click();
    await assertReadable(page, `${width} mars light`);
    await page.screenshot({ path: join(output, `${width}-mars-light.png`) });

    await page.locator('#theme-toggle').click();
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark', 'dark choice persists');
    assert.equal(await page.locator('#theme-toggle').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#tab-mars').getAttribute('aria-selected'), 'true', 'hash restores the tab after reload');
    await assertReadable(page, `${width} mars dark`);
    await page.screenshot({ path: join(output, `${width}-mars-dark.png`) });
    await page.locator('#tab-overview').click();
    await assertReadable(page, `${width} overview dark`);
    await page.screenshot({ path: join(output, `${width}-overview-dark.png`) });
    await page.locator('#theme-toggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');

    if (width === 1440 || width === 375) {
      // Keyboard tabs: arrows move and select, Home and End jump, focus is visible.
      await page.locator('#tab-overview').focus();
      await page.keyboard.press(width === 375 ? 'ArrowRight' : 'ArrowDown');
      assert.equal(await page.locator(':focus').getAttribute('id'), `tab-${projects[0].id}`);
      assert.equal(await page.locator(`#tab-${projects[0].id}`).getAttribute('aria-selected'), 'true');
      await page.keyboard.press('End');
      assert.equal(await page.locator(':focus').getAttribute('id'), `tab-${projects.at(-1).id}`);
      await page.keyboard.press('Home');
      assert.equal(await page.locator(':focus').getAttribute('id'), 'tab-overview');
      await page.keyboard.press('ArrowUp');
      assert.equal(await page.locator(':focus').getAttribute('id'), `tab-${projects.at(-1).id}`, 'arrows wrap');
      assert.ok(await page.locator(':focus').evaluate((node) => getComputedStyle(node).outlineStyle === 'solid'), 'focus is visible');

      // The category matrix opens a filtered slice.
      await page.locator('#tab-overview').click();
      await page.locator('a[href="#mars:docs"]').click();
      await page.waitForFunction(() => document.getElementById('tab-mars').getAttribute('aria-selected') === 'true');
      assert.equal(await page.evaluate(() => window.location.hash), '#mars:docs');
      assert.equal(await page.locator('#panel-mars .cat:visible').count(), 1);
      assert.equal(await page.locator('#panel-mars .file:visible').count(), filesFor('mars').filter((f) => f.category === 'docs').length);
      assert.equal(await page.locator('#panel-mars .chip[aria-pressed="true"]').getAttribute('data-filter'), 'docs');
      await assertFits(page, width, height, `${width} mars docs filter`);

      // Chips filter; All restores everything and the side column.
      await page.locator('#panel-mars .chip[data-filter="tests"]').click();
      assert.equal(await page.locator('#panel-mars .file:visible').count(), filesFor('mars').filter((f) => f.category === 'tests').length);
      assert.equal(await page.locator('#panel-mars .aside').isVisible(), false);
      await page.locator('#panel-mars .chip[data-filter="all"]').click();
      assert.equal(await page.locator('#panel-mars .file:visible').count(), filesFor('mars').length);
      assert.equal(await page.locator('#panel-mars .aside').isVisible(), true);
      assert.equal(await page.evaluate(() => window.location.hash), '#mars');

      // Search spans every game; Escape returns to the tab.
      await page.locator('body').click({ position: { x: 1, y: height - 1 } }).catch(() => {});
      await page.locator('#tab-mars').focus();
      await page.keyboard.press('/');
      assert.equal(await page.locator(':focus').getAttribute('id'), 'search', '/ focuses search');
      await page.keyboard.type('decision');
      await page.waitForFunction(() => !document.getElementById('results').hidden);
      const expected = await page.evaluate((query) => fetch('catalog.json').then((r) => r.json()).then((c) => {
        const cat = new Map(c.categories.map((x) => [x.id, x.label]));
        const proj = new Map(c.projects.map((x) => [x.id, x.name]));
        return c.files.filter((f) => [f.path, f.title, f.description, f.kind, cat.get(f.category), proj.get(f.project)].join(' ').toLowerCase().includes(query)).map((f) => f.path).sort();
      }), 'decision');
      const shown = (await page.locator('#results .file').evaluateAll((nodes) => nodes.map((node) => node.dataset.path))).sort();
      assert.deepEqual(shown, expected, 'search shows exactly the matching files');
      for (const path of ['mars/docs/DECISIONS.md', 'front-of-house/docs/DECISIONS.md']) assert.ok(shown.includes(path), `search finds ${path}`);
      assert.equal(await page.locator('#panels').isVisible(), false);
      await assertFits(page, width, height, `${width} search`);
      await assertReadable(page, `${width} search`);
      await page.screenshot({ path: join(output, `${width}-search.png`) });
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#results').isVisible(), false);
      assert.equal(await page.locator('#panel-mars').isVisible(), true);
      await page.locator('#search').fill('zzqqxx');
      await page.locator('#search').press('Enter');
      assert.ok((await page.locator('#results .empty').textContent()).includes('zzqqxx'), 'empty search state');
      await page.locator('#search').press('Escape');

      // References: private repos are labelled, the private Zelda2MarioCoop source is not linked.
      await page.locator('#tab-zelda2mario').click();
      const unlinked = page.locator('#panel-zelda2mario .ref-unlinked');
      assert.equal(await unlinked.count(), 1);
      assert.ok((await page.locator('#panel-zelda2mario [data-box="references"]').textContent()).includes('Private'));

      // Copy puts the path on the clipboard.
      if (!process.env.ADMIN_BASE_URL) {
        const first = page.locator('#panel-zelda2mario .file').first();
        await first.locator('[data-copy]').click();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await first.getAttribute('data-path'));
        assert.equal(await first.locator('.act-label').textContent(), 'Copied');
      }

      // Deep links and unknown hashes.
      await page.goto(`${url}#front-of-house:docs`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
      assert.equal(await page.locator('#tab-front-of-house').getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#panel-front-of-house .chip[aria-pressed="true"]').getAttribute('data-filter'), 'docs');
      await page.goto(`${url}#not-a-game`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
      assert.equal(await page.locator('#tab-overview').getAttribute('aria-selected'), 'true');

      // The skip link is the first stop and reaches the index.
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.className), 'skip-link');
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'stage');
    }

    assert.deepEqual(failures, [], `${width}: no page errors or same-origin request failures`);
    results.push({ width, height, files: catalog.files.length, projects: projects.length });
    await context.close();
  }
  await writeFile(join(output, 'report.json'), `${JSON.stringify({ url, results }, null, 2)}\n`);
  console.log(`admin smoke passed at ${results.length} widths; evidence in ${output}`);
} finally {
  await browser.close();
  await server?.close();
}
