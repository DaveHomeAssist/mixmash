/** Responsive landing regression rail. Set LANDING_BASE_URL for deployed readback. */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, request } from 'playwright';
import { launchOptions, startStaticServer, trackPageFailures } from './static-server.mjs';

const server = process.env.LANDING_BASE_URL ? null : await startStaticServer();
const origin = process.env.LANDING_BASE_URL || server.origin;
const output = process.env.LANDING_SCREENSHOT_DIR || await mkdtemp(join(tmpdir(), 'mixmash-landing-'));
await mkdir(output, { recursive: true });
const browser = await chromium.launch(launchOptions());
const reports = [];
const routes = ['/play/', '/mars/', '/garden/', '/empires/', '/pitch/'];

try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    const touch = width < 768;
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1, serviceWorkers: 'block' });
    const page = await context.newPage();
    const failures = trackPageFailures(page, new URL(origin).origin);
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    // Load below-fold lazy images before full-page screenshots and asset checks.
    for (const image of await page.locator('.game-vis img').all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(img => img.decode());
    }
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));

    const layout = await page.evaluate(() => {
      const rect = el => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      };
      return {
        viewport: innerWidth, document: document.documentElement.scrollWidth,
        nav: [...document.querySelectorAll('.site-nav a')].map(el => ({ ...rect(el), label: el.textContent.trim() })),
        cards: [...document.querySelectorAll('.game-card')].map(rect),
        images: [...document.images].map(img => ({ src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0, alt: img.alt, width: img.width, height: img.height, loading: img.loading })),
        status: [...document.querySelectorAll('.game-status')].map(el => el.textContent),
        links: [...document.querySelectorAll('.play-link')].map(el => ({ href: new URL(el.href).pathname, name: el.getAttribute('aria-label'), text: el.textContent.trim() })),
      };
    });
    assert.equal(layout.viewport, width, 'viewport meta prevents mobile shrink-to-fit');
    assert.ok(layout.document <= width, `${width}: no horizontal overflow`);
    assert.equal(layout.cards.length, 5);
    assert.equal(layout.images.length, 5);
    assert.ok(layout.images.every(img => img.loaded && img.alt && img.width > 0 && img.height > 0));
    assert.ok(layout.images.slice(1).every(img => img.loading === 'lazy'));
    assert.deepEqual(layout.links.map(link => link.href), routes);
    assert.ok(layout.links.every(link => link.name.startsWith('Play ') && link.text === '▶ Play'));
    assert.deepEqual(layout.status, ['Released', 'In development', 'In development', 'In development', 'Released']);
    for (const link of layout.nav) {
      assert.ok(link.x >= 0 && link.right <= width, `${width}: ${link.label} fits`);
      assert.ok(link.width >= 44 && link.height >= 44, `${width}: ${link.label} touch target`);
    }
    const [, mars, garden, empires, pitch] = layout.cards;
    if (width >= 768) {
      assert.ok(layout.cards[0].width > mars.width * 1.9, 'MIXMASH spans the catalog');
      assert.equal(mars.y, garden.y, 'first supporting row is aligned');
      assert.equal(empires.y, pitch.y, 'second supporting row is aligned');
      assert.equal(mars.height, garden.height, 'balanced first row');
      assert.equal(empires.height, pitch.height, 'balanced second row');
    } else {
      assert.ok(layout.cards.every((card, i, cards) => i === 0 || card.y >= cards[i - 1].bottom), 'single-column cards do not overlap');
    }
    await page.screenshot({ path: join(output, `${width}-fold.png`) });
    await page.screenshot({ path: join(output, `${width}-full.png`), fullPage: true });

    // Real pointer/touch hit testing, with navigation intercepted to keep this
    // focused rail on the landing. Existing game smoke rails exercise runtimes.
    await page.evaluate(() => {
      window.landingClicks = [];
      document.addEventListener('click', event => {
        const link = event.target.closest('a');
        if (link) {
          window.landingClicks.push({ href: link.href, trusted: event.isTrusted });
          event.preventDefault();
        }
      });
    });
    const clickAt = async locator => {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      if (touch) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
    };
    for (let i = 0; i < routes.length; i++) {
      const card = page.locator('.game-card').nth(i);
      for (const area of ['.game-vis', '.game-name', '.game-desc']) {
        await clickAt(card.locator(area));
        const click = await page.evaluate(() => window.landingClicks.at(-1));
        assert.ok(click?.trusted, 'native input reached an anchor');
        assert.equal(new URL(click.href).pathname, routes[i], `${width}: ${area} launches ${routes[i]}`);
      }
    }
    for (const link of await page.locator('.info-link').all()) {
      const href = await link.getAttribute('href');
      await link.click();
      assert.equal(await page.evaluate(() => window.landingClicks.at(-1).href), new URL(href, origin).href, 'secondary link is not intercepted by card');
    }
    const external = await page.locator('a[href^="https://"]').evaluateAll(links => links.map(link => ({ text: link.textContent, marker: link.querySelector('.sr-only')?.textContent })));
    assert.ok(external.length >= 3 && external.every(link => link.text.includes('↗') && link.marker.includes('external')));

    // All visible controls meet the requested 44px minimum, not just the nav.
    const smallTargets = await page.locator('a').evaluateAll(links => links.filter(link => {
      const r = link.getBoundingClientRect();
      return r.width < 44 || r.height < 44;
    }).map(link => link.textContent));
    assert.deepEqual(smallTargets, []);

    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').getAttribute('class'), 'skip-link');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'games', 'skip link moves focus to the catalog');
    await page.goto(origin, { waitUntil: 'networkidle' });
    const expectedTabOrder = await page.locator('a').evaluateAll(links => links.map(el => el.getAttribute('aria-label') || el.textContent.trim()));
    const tabCount = expectedTabOrder.length;
    const tabNames = [];
    for (let i = 0; i < tabCount; i++) {
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => {
        const r = document.activeElement.getBoundingClientRect();
        return r.top >= -1 && r.bottom <= innerHeight + 1;
      });
      const focus = await page.evaluate(() => {
        const el = document.activeElement;
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return { tag: el.tagName, name: el.getAttribute('aria-label') || el.textContent.trim(), visible: el.matches(':focus-visible'), outline: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth), top: r.top, bottom: r.bottom, nav: !!el.closest('.site-nav'), skip: el.classList.contains('skip-link'), navBottom: document.querySelector('.site-nav').getBoundingClientRect().bottom };
      });
      assert.equal(focus.tag, 'A', 'only native links in the tab sequence');
      assert.ok(focus.visible && focus.outline === 'solid' && focus.outlineWidth >= 3, `${width}: authored focus for ${focus.name}`);
      assert.ok(focus.top >= -1 && focus.bottom <= 901, `${width}: focused target stays on screen: ${JSON.stringify(focus)}`);
      assert.ok(focus.nav || focus.skip || focus.top >= focus.navBottom, `${width}: sticky nav does not hide ${focus.name}`);
      tabNames.push(focus.name);
      if (focus.name === 'Play MIXMASH' && !touch) await page.screenshot({ path: join(output, `${width}-keyboard.png`) });
    }
    assert.deepEqual(tabNames, expectedTabOrder, 'Tab follows native document order');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator(':focus').innerText(), 'Brand Guide');

    const card = page.locator('.featured');
    await page.mouse.move(0, 0);
    await page.locator(':focus').evaluate(el => el.blur());
    assert.equal(await page.locator('.laser').evaluate(el => getComputedStyle(el).animationPlayState), 'paused');
    if (!touch) {
      await card.hover();
      await page.waitForTimeout(250);
      assert.equal(await page.locator('.laser').evaluate(el => getComputedStyle(el).animationPlayState), 'running');
      assert.notEqual(await card.evaluate(el => getComputedStyle(el).transform), 'none');
      await page.screenshot({ path: join(output, `${width}-hover.png`) });
    } else {
      assert.equal(await card.evaluate(el => getComputedStyle(el).transform), 'none', 'touch does not latch hover lift');
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.laser').evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.equal(await card.evaluate(el => getComputedStyle(el).transform), 'none');
    assert.equal(await card.evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).scrollBehavior), 'auto');

    const contrast = await page.evaluate(() => {
      const rgb = text => text.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = color => rgb(color).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      return ['.game-genre', '.game-desc', '.count', '.feedback-note', 'footer p', '.play-link', '.btn-primary', '.game-status'].map(selector => {
        const el = document.querySelector(selector);
        let background = el;
        while (getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)') background = background.parentElement;
        const a = lum(getComputedStyle(el).color), b = lum(getComputedStyle(background).backgroundColor);
        return { selector, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
      });
    });
    assert.ok(contrast.every(item => item.ratio >= 4.5), JSON.stringify(contrast));
    assert.deepEqual(failures, [], 'no landing runtime or same-origin load failures');
    if (width === 1440) {
      await page.locator('.featured .play-link').focus();
      await page.keyboard.press('Enter');
      await page.waitForURL('**/play/');
      assert.equal(await page.locator('#game').count(), 1, 'keyboard Play link reaches the real fighter');
    }
    reports.push({ width, touch, layout, tabNames, contrast, failures });
    console.log(`  ok  ${width}px: layout, imagery, card hit areas, 44px targets, keyboard, motion, contrast`);
    await context.close();
  }
  const assets = await Promise.all(['mixmash', 'mars', 'garden', 'empires', 'pitch'].map(async game => {
    const response = await request.newContext().then(async client => {
      try {
        const result = await client.get(new URL(`assets/previews/${game}.jpg`, origin).href);
        assert.ok(result.ok());
        assert.match(result.headers()['content-type'], /^image\/jpeg/);
        return (await result.body()).length;
      } finally { await client.dispose(); }
    });
    assert.ok(response < 160000, `${game}: preview stays under 160 KB`);
    return { game, bytes: response };
  }));
  assert.ok(assets.reduce((sum, asset) => sum + asset.bytes, 0) < 500000, 'combined previews under 500 KB');
  await writeFile(join(output, 'report.json'), JSON.stringify({ origin, reports, assets }, null, 2));
  console.log(`Landing smoke passed. Screenshots and evidence: ${output}`);
} finally {
  await browser.close();
  await server?.close();
}
