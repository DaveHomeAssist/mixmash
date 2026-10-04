/**
 * MixKit mobile and tablet touch rail (Mobile & Tablet Fix program, Phase 1).
 *
 *   npm run smoke:mobile
 *   SMOKE_BASE_URL=https://mixmash.games/ npm run smoke:mobile     # live readback
 *   SMOKE_CHROMIUM_CHANNEL=chrome npm run smoke:mobile              # local: installed Chrome
 *
 * Every row below runs at the same 12 configs, with real touch emulation
 * (hasTouch + isMobile): WebKit for the iPhone and iPad sizes, Chromium with an
 * Android user agent for 360x800, each in both orientations.
 *
 * LATER PHASES EXTEND THIS FILE, they do not add rails:
 *   - add a config to CONFIGS or a game to GAMES,
 *   - push a check onto GAME_CHECKS (runs once per game per config on the loaded
 *     page) or KIT_CHECKS (runs once per config on a blank page with the kit),
 *   - when a fix lands, delete its EXPECTED_FAIL entry. A check that is listed
 *     as expected-to-fail but passes is reported as XPASS (a failure with
 *     SMOKE_STRICT_XPASS=1), so a stale entry cannot hide forever.
 *
 * Statuses: pass, fail, xfail (expected-to-fail, cites the audit finding or
 * issue it waits on), xpass, n/a. Only `fail` (and `xpass` when strict) exits
 * non-zero. An expected-fail never weakens the assertion: the check still runs
 * and still has to fail.
 *
 * SMOKE_WEBKIT_EXECUTABLE points at another WebKit build if the managed one is not installed.
 *
 * Environment: SMOKE_BASE_URL, SMOKE_CHROMIUM_CHANNEL, SMOKE_WEBKIT_EXECUTABLE, SMOKE_REPORT_DIR,
 * SMOKE_ENGINE=webkit|chromium, SMOKE_CONFIGS=<id substring>,
 * SMOKE_GAMES=<comma ids>, SMOKE_STRICT_XPASS=1.
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, webkit } from 'playwright';
import { startStaticServer } from './static-server.mjs';

// --- the 12 configs ---------------------------------------------------------------
// `insets` simulate the device safe areas (a headless browser reports none): they
// are applied through the --safe-* custom properties MixKit reads.
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36';

function pair(name, engine, width, height, dpr, insets, extra = {}) {
  return [
    { id: `${name}-${width}x${height}-portrait`, engine, width, height, dpr, insets: insets.portrait, ...extra },
    { id: `${name}-${height}x${width}-landscape`, engine, width: height, height: width, dpr, insets: insets.landscape, ...extra },
  ];
}

export const CONFIGS = [
  ...pair('iphone', 'webkit', 390, 844, 3, { portrait: { top: 47, right: 0, bottom: 34, left: 0 }, landscape: { top: 0, right: 47, bottom: 21, left: 47 } }),
  ...pair('iphone-max', 'webkit', 430, 932, 3, { portrait: { top: 59, right: 0, bottom: 34, left: 0 }, landscape: { top: 0, right: 59, bottom: 21, left: 59 } }),
  ...pair('ipad', 'webkit', 768, 1024, 2, { portrait: { top: 24, right: 0, bottom: 20, left: 0 }, landscape: { top: 24, right: 0, bottom: 20, left: 0 } }),
  ...pair('ipad-air', 'webkit', 820, 1180, 2, { portrait: { top: 24, right: 0, bottom: 20, left: 0 }, landscape: { top: 24, right: 0, bottom: 20, left: 0 } }),
  ...pair('ipad-pro', 'webkit', 1024, 1366, 2, { portrait: { top: 24, right: 0, bottom: 20, left: 0 }, landscape: { top: 24, right: 0, bottom: 20, left: 0 } }),
  ...pair('android', 'chromium', 360, 800, 3, { portrait: { top: 28, right: 0, bottom: 0, left: 0 }, landscape: { top: 0, right: 28, bottom: 0, left: 28 } }, { userAgent: ANDROID_UA }),
];

// --- the rows: every game hosted on or linked from mixmash.games ---------------------
// Full Cover Ops lives in DaveHomeAssist/system-by-dave; it joins this table in Phase 5.
export const GAMES = [
  // The hub is a long-form landing page that scrolls by design (audit checkpoint 1 is green for it);
  // it keeps the no-horizontal-overflow check and skips the no-vertical-scroll one.
  { id: 'hub', name: 'Hub', path: '/', nav: false, scrollsVertically: true },
  { id: 'play', name: 'MIXMASH', path: '/play/', nav: true },
  {
    id: 'mars', name: 'MarsScape', path: '/mars/', nav: true,
    // On boot MarsScape stores an offline HMAC CryptoKey in IndexedDB. Automation WebKit builds wedge
    // their main thread on that (a keychain lookup), so WebKit runs without IndexedDB; the game then keeps
    // the key in memory, which changes nothing this rail measures.
    async prepare(context, config) {
      if (config.engine === 'webkit') await context.addInitScript(() => { try { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); } catch { /* keep going */ } });
    },
    // The board sits behind the boot dialog; a touch on Start Expedition opens it.
    async begin(page) {
      await page.waitForFunction(() => { const b = document.getElementById('startButton'); return b && !b.disabled && b.getBoundingClientRect().width > 0; }, null, { timeout: 20000 });
      const box = await page.locator('#startButton').boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForFunction(() => !document.getElementById('appShell').hasAttribute('inert'), null, { timeout: 15000 });
      await sleep(500);
    },
  },
  { id: 'garden', name: 'Garden OS', path: '/garden/', nav: true },
  {
    id: 'empires', name: 'Age of Dave', path: '/empires/', nav: true,
    // The first-visit controls guide and start hint appear once the WebAssembly engine has loaded.
    async ready(page) {
      await page.waitForFunction(() => { const h = document.getElementById('start-hint'); return h && getComputedStyle(h).display !== 'none'; }, null, { timeout: 30000 });
      await sleep(1000); // the guide fades in
    },
  },
  { id: 'pitch', name: 'Pitch Riot', path: '/pitch/', nav: true },
  { id: 'front-of-house', name: 'Front of House', path: '/front-of-house/', nav: true },
];

// --- expected failures --------------------------------------------------------------
// One entry per (game, check), optionally limited to some configs. `finding` must
// cite the audit finding (AUD | MixMash Studio | Mobile & Tablet Audit | 2026-10-03)
// or an existing GitHub issue, and the phase that fixes it.
// `partial: true` means the finding shows at some configs and not others (a layout that only
// breaks at some sizes): a pass at the other configs is then ordinary, not an XPASS.
const AUDIT = 'AUD | MixMash Studio | Mobile & Tablet Audit | 2026-10-03';
export const EXPECTED_FAIL = [
  {
    game: 'play', check: 'targets-game', partial: true,
    finding: `${AUDIT}, P0 1 (MIXMASH has no touch path from the title; the 38 px "Tap to start audio" button is its only touch target) and coverage grid MIXMASH checkpoint 3 (touch, failing). Fixed in Phase 2.`,
  },
  {
    game: 'empires', check: 'targets-game', partial: true,
    finding: `${AUDIT}, P0 4 (Age of Dave is not playable by touch; its start button and first-visit controls guide use 38 px buttons). Fixed in Phase 4.`,
  },
  {
    game: 'pitch', check: 'targets-game',
    finding: `${AUDIT}, coverage grid Pitch Riot checkpoint 3 (touch, at risk) with P0 3 (the menu overlay); the difficulty and length buttons are 42 px. Phase 2 moves the menu onto the kit overlay rules.`,
  },
  {
    game: 'front-of-house', check: 'targets-game',
    finding: `${AUDIT}, coverage grid Front of House checkpoint 3 (touch, partial); the "Oak St. Lot" and "How the deals work" buttons are 40 px. Phase 3b covers the Book and Promote phone sheet.`,
  },
  {
    game: 'mars', check: 'targets-playing', partial: true,
    finding: `${AUDIT}, P1 MarsScape (map nodes 35x31 px on phones in portrait, skill rows 29 px, Reset view 27 px). Fixed in Phase 3b.`,
  },
];

// --- helpers --------------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (n) => Math.round(n * 10) / 10;

function expectedFailFor(gameId, checkId, config) {
  return EXPECTED_FAIL.find((entry) => entry.game === gameId && entry.check === checkId
    && (!entry.configs || entry.configs.some((part) => config.id.includes(part)))) || null;
}

function ok(detail = '') { return { ok: true, detail }; }
function bad(detail) { return { ok: false, detail }; }

async function setInsets(page, insets) {
  await page.evaluate((i) => {
    const root = document.documentElement.style;
    root.setProperty('--safe-top', `${i.top}px`);
    root.setProperty('--safe-right', `${i.right}px`);
    root.setProperty('--safe-bottom', `${i.bottom}px`);
    root.setProperty('--safe-left', `${i.left}px`);
  }, insets);
}

async function clearInsets(page) {
  await page.evaluate(() => {
    const root = document.documentElement.style;
    for (const side of ['top', 'right', 'bottom', 'left']) root.removeProperty(`--safe-${side}`);
  });
}

// Interactive, visible, hit-testable elements outside the shared nav, from one frame.
function collectTargets() {
  const SELECTOR = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[role=switch],[role=slider],[tabindex]:not([tabindex="-1"]),[onclick]';
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const out = [];
  for (const el of document.querySelectorAll(SELECTOR)) {
    if (el.closest('.mixnav, .mixkit-rotate')) continue;
    if (el.disabled || el.getAttribute('aria-hidden') === 'true') continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none' || parseFloat(cs.opacity) === 0) continue;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue; // screen-reader-only controls
    if (r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) continue; // not on screen
    if (el.tagName === 'A' && cs.display === 'inline') continue; // inline text links: WCAG 2.5.8 exemption
    const cx = Math.min(Math.max(r.left + r.width / 2, 0), vw - 1);
    const cy = Math.min(Math.max(r.top + r.height / 2, 0), vh - 1);
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) continue; // covered by something else
    out.push({
      tag: el.tagName.toLowerCase(),
      label: (el.getAttribute('aria-label') || el.textContent || el.id || el.className || '').toString().trim().replace(/\s+/g, ' ').slice(0, 28),
      width: Math.round(r.width * 10) / 10,
      height: Math.round(r.height * 10) / 10,
    });
  }
  return out;
}

// Same-origin frames only: a cross-origin frame (Garden OS's embedded build) is another repository's
// code and can change without this repo changing, which would make this rail flaky.
async function framesTargets(page) {
  const all = [];
  const origin = new URL(page.url()).origin;
  for (const frame of page.frames()) {
    try {
      if (new URL(frame.url()).origin !== origin) continue;
      const found = await frame.evaluate(collectTargets);
      const where = frame === page.mainFrame() ? '' : 'iframe ';
      for (const item of found) all.push({ ...item, label: `${where}${item.label}` });
    } catch { /* a frame that navigated or is cross-origin and gone */ }
  }
  return all;
}

// --- game checks: run on each game's loaded page ----------------------------------------
export const GAME_CHECKS = [
  {
    id: 'no-vscroll',
    title: 'the page never scrolls vertically',
    async run({ page, game }) {
      if (game.scrollsVertically) return { na: true };
      const m = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight }));
      return m.sh <= m.ch + 1 ? ok(`${m.sh}/${m.ch}`) : bad(`scrollHeight ${m.sh} > clientHeight ${m.ch}`);
    },
  },
  {
    id: 'no-hscroll',
    title: 'no horizontal overflow',
    async run({ page }) {
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body ? document.body.scrollWidth : 0 }));
      return m.sw <= m.cw + 1 && m.bw <= m.cw + 1 ? ok(`${m.sw}/${m.cw}`) : bad(`scrollWidth ${m.sw}, body ${m.bw} > clientWidth ${m.cw}`);
    },
  },
  {
    id: 'targets-nav',
    title: 'shared nav controls are at least 44x44 (collapsed and open)',
    async run({ page, game }) {
      if (!game.nav) return { na: true };
      const has = await page.evaluate(() => !!window.__mixmashNav);
      if (!has) return bad('window.__mixmashNav missing');
      const measure = () => page.evaluate(() => [...document.querySelectorAll('.mixnav a, .mixnav button')].map((el) => {
        const r = el.getBoundingClientRect();
        return { label: el.getAttribute('aria-label') || el.title || el.textContent.trim(), w: r.width, h: r.height, shown: r.width > 0 && r.height > 0 };
      }).filter((c) => c.shown));
      const small = [];
      let count = 0;
      for (const state of ['collapse', 'expand']) {
        await page.evaluate((s) => window.__mixmashNav[s](), state);
        const controls = await measure();
        count += controls.length;
        if (controls.length === 0) return bad(`no visible nav control after ${state}`);
        for (const c of controls) if (c.w < 43.5 || c.h < 43.5) small.push(`${c.label} ${round(c.w)}x${round(c.h)}`);
      }
      return small.length ? bad(small.join('; ')) : ok(`${count} measurements`);
    },
  },
  {
    id: 'nav-safe-area',
    title: 'shared nav stays clear of the device safe-area insets (collapsed and open)',
    async run({ page, game, config }) {
      if (!game.nav) return { na: true };
      await setInsets(page, config.insets);
      try {
        const problems = [];
        for (const state of ['collapse', 'expand']) {
          await page.evaluate((s) => window.__mixmashNav[s](), state);
          const rects = await page.evaluate(() => [...document.querySelectorAll('.mixnav a, .mixnav button')].map((el) => {
            const r = el.getBoundingClientRect();
            return { label: el.getAttribute('aria-label') || el.title, l: r.left, t: r.top, r: r.right, b: r.bottom, shown: r.width > 0 && r.height > 0 };
          }).filter((c) => c.shown).concat([{ vw: innerWidth, vh: innerHeight }]));
          const { vw, vh } = rects.pop();
          const i = config.insets;
          for (const c of rects) {
            if (c.l < i.left - 0.5 || c.t < i.top - 0.5 || c.r > vw - i.right + 0.5 || c.b > vh - i.bottom + 0.5) {
              problems.push(`${state}: ${c.label} [${round(c.l)},${round(c.t)},${round(c.r)},${round(c.b)}] in ${vw}x${vh} with insets ${i.top}/${i.right}/${i.bottom}/${i.left}`);
            }
          }
        }
        return problems.length ? bad(problems.slice(0, 3).join('; ')) : ok();
      } finally {
        await clearInsets(page);
      }
    },
  },
  {
    id: 'targets-game',
    title: 'every other visible interactive target is at least 44x44',
    async run({ page }) {
      const targets = await framesTargets(page);
      const small = targets.filter((t) => t.width < 43.5 || t.height < 43.5);
      if (!small.length) return ok(`${targets.length} targets`);
      const detail = `${small.length} of ${targets.length} under 44px: ${small.slice(0, 6).map((t) => `${t.tag} "${t.label}" ${t.width}x${t.height}`).join('; ')}`;
      return { ok: false, detail, offenders: small };
    },
  },
];

GAME_CHECKS.push({
  id: 'targets-playing',
  title: 'after touching through to the play surface, every visible interactive target is at least 44x44',
  async run({ page, game }) {
    if (!game.begin) return { na: true };
    await game.begin(page);
    const targets = await framesTargets(page);
    const small = targets.filter((t) => t.width < 43.5 || t.height < 43.5);
    if (!small.length) return ok(`${targets.length} targets`);
    const detail = `${small.length} of ${targets.length} under 44px: ${small.slice(0, 6).map((t) => `${t.tag} "${t.label}" ${t.width}x${t.height}`).join('; ')}`;
    return { ok: false, detail, offenders: small };
  },
});

// --- kit checks: run once per config on a blank page that loads the whole kit ---------------
async function loadKit(page, origin, { navAttrs = {} } = {}) {
  await page.goto(`${origin}/offline.html`, { waitUntil: 'load' });
  await page.evaluate(() => {
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;padding:0;background:#06060E;color:#F0F0F8';
  });
  await page.addStyleTag({ url: `${origin}/src/kit/viewport.css` });
  const load = (src, attrs) => page.evaluate(({ src: url, attrs: extra }) => new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = url;
    for (const [k, v] of Object.entries(extra || {})) el.setAttribute(k, v);
    el.onload = resolve;
    el.onerror = () => reject(new Error(`failed to load ${url}`));
    document.head.appendChild(el);
  }), { src, attrs });
  // nav.js first: it must wrap AudioContext before anything creates one.
  await load(`${origin}/src/kit/nav.js`, navAttrs);
  for (const name of ['input', 'lifecycle', 'stage']) await load(`${origin}/src/kit/${name}.js`);
}

function contrastScript() {
  // WCAG contrast of the handle's glyph against its alpha-composited background,
  // worst case over a white and a black page behind it.
  const parse = (value) => {
    const m = value.match(/rgba?\(([^)]+)\)/);
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const channel = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const lum = ({ r, g, b }) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const el = document.querySelector('.mixnav-handle');
  const cs = getComputedStyle(el);
  const fg = parse(cs.color);
  const bg = parse(cs.backgroundColor);
  const over = (under) => ({ r: bg.r * bg.a + under * (1 - bg.a), g: bg.g * bg.a + under * (1 - bg.a), b: bg.b * bg.a + under * (1 - bg.a) });
  return Math.min(ratio(fg, over(255)), ratio(fg, over(0)));
}

export const KIT_CHECKS = [
  {
    id: 'kit-viewport',
    title: 'viewport.css: locked root, 100dvh stage, safe-area variables, overlays that scroll',
    async run({ page, origin, config }) {
      await loadKit(page, origin);
      await setInsets(page, config.insets);
      const r = await page.evaluate(() => {
        const out = {};
        const html = getComputedStyle(document.documentElement);
        out.htmlOverflow = html.overflow;
        out.bodyOverflow = getComputedStyle(document.body).overflow;
        out.overscroll = CSS.supports('overscroll-behavior', 'none') ? html.overscrollBehaviorY : 'unsupported';
        const stage = document.createElement('div');
        stage.className = 'mixkit-stage';
        stage.innerHTML = '<div id="inner" style="width:100%;height:100%;background:#123"></div>';
        document.body.appendChild(stage);
        out.stageHeight = stage.getBoundingClientRect().height;
        out.innerHeight = window.innerHeight;
        const inner = stage.querySelector('#inner').getBoundingClientRect();
        out.inner = { l: inner.left, t: inner.top, r: window.innerWidth - inner.right, b: window.innerHeight - inner.bottom };
        stage.remove();

        const make = (childHeight) => {
          const overlay = document.createElement('div');
          overlay.className = 'mixkit-overlay';
          overlay.innerHTML = `<div class="card" style="width:260px;height:${childHeight}px;background:#345"></div>`;
          document.body.appendChild(overlay);
          return overlay;
        };
        const tall = make(Math.round(window.innerHeight * 1.7));
        const card = tall.querySelector('.card');
        tall.scrollTop = 0;
        out.tallOverflows = tall.scrollHeight > tall.clientHeight;
        out.tallTopReachable = card.getBoundingClientRect().top >= -0.5;
        tall.scrollTop = tall.scrollHeight;
        out.tallBottomReachable = card.getBoundingClientRect().bottom <= window.innerHeight + 0.5;
        tall.remove();
        const short = make(100);
        const c2 = short.querySelector('.card').getBoundingClientRect();
        out.shortCentered = Math.abs((c2.top + c2.bottom) / 2 - window.innerHeight / 2) <= 24;
        short.remove();
        out.pageScroll = { sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight };
        return out;
      });
      const i = config.insets;
      const problems = [];
      if (r.htmlOverflow !== 'hidden' || r.bodyOverflow !== 'hidden') problems.push(`root overflow ${r.htmlOverflow}/${r.bodyOverflow}`);
      if (r.overscroll !== 'none' && r.overscroll !== 'unsupported') problems.push(`overscroll-behavior ${r.overscroll}`);
      if (Math.abs(r.stageHeight - r.innerHeight) > 1) problems.push(`stage ${r.stageHeight} != innerHeight ${r.innerHeight}`);
      if (Math.abs(r.inner.t - i.top) > 1 || Math.abs(r.inner.b - i.bottom) > 1 || Math.abs(r.inner.l - i.left) > 1 || Math.abs(r.inner.r - i.right) > 1) {
        problems.push(`stage content box is not the safe area: ${JSON.stringify(r.inner)} vs ${JSON.stringify(i)}`);
      }
      if (!r.tallOverflows) problems.push('tall overlay did not scroll');
      if (!r.tallTopReachable) problems.push('tall overlay clips its top');
      if (!r.tallBottomReachable) problems.push('tall overlay clips its bottom');
      if (!r.shortCentered) problems.push('short overlay is not centered');
      if (r.pageScroll.sh > r.pageScroll.ch + 1) problems.push(`page scrolls ${r.pageScroll.sh}/${r.pageScroll.ch}`);
      return problems.length ? bad(problems.join('; ')) : ok(`overscroll ${r.overscroll}`);
    },
  },
  {
    id: 'kit-input',
    title: 'input.js: touch capability, modality events, tap, long-press and two-finger pan',
    async run({ page, origin }) {
      await loadKit(page, origin);
      await page.evaluate(() => {
        const pad = document.createElement('div');
        pad.id = 'pad';
        pad.style.cssText = 'position:fixed;left:20px;top:120px;width:220px;height:220px;background:#234';
        document.body.appendChild(pad);
        window.__log = [];
        window.__modes = [];
        window.addEventListener('mixkit:input-mode', (e) => window.__modes.push(e.detail.mode));
        MixKit.input.gestures(pad, {
          onTap: (d) => window.__log.push(`tap:${d.pointerType}`),
          onSecondary: (d) => window.__log.push(`secondary:${d.source}`),
          onPanStart: () => window.__log.push('panStart'),
          onPan: (d) => window.__log.push(`pan:${Math.round(d.totalDx)},${Math.round(d.totalDy)}`),
          onPanEnd: () => window.__log.push('panEnd'),
        }, { longPressMs: 300 });
      });
      const problems = [];
      const cap = await page.evaluate(() => ({ capable: MixKit.input.touchCapable(), mode: MixKit.input.mode(), attr: document.documentElement.getAttribute('data-input-mode') }));
      if (!cap.capable) problems.push('touchCapable() is false under touch emulation');
      if (cap.mode !== 'touch') problems.push(`initial mode ${cap.mode}`);

      // A long-press and a two-finger pan from synthetic pointer events (both engines).
      const synthetic = await page.evaluate(async () => {
        const pad = document.getElementById('pad');
        const fire = (type, id, x, y) => pad.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 7, clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true }));
        window.__log.length = 0;
        fire('pointerdown', 7, 100, 200);
        await new Promise((r) => setTimeout(r, 450));
        fire('pointerup', 7, 100, 200);
        const afterLong = window.__log.slice();
        window.__log.length = 0;
        fire('pointerdown', 8, 80, 160);
        fire('pointerdown', 9, 160, 160);
        fire('pointermove', 8, 90, 180);
        fire('pointermove', 9, 170, 180);
        fire('pointerup', 8, 90, 180);
        fire('pointerup', 9, 170, 180);
        const afterPan = window.__log.slice();
        window.__log.length = 0;
        pad.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', clientX: 50, clientY: 150, button: 0, bubbles: true }));
        pad.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'mouse', clientX: 50, clientY: 150, button: 0, bubbles: true }));
        return { afterLong, afterPan, afterMouse: window.__log.slice(), modes: window.__modes.slice() };
      });
      if (!synthetic.afterLong.includes('secondary:long-press')) problems.push(`long-press log ${JSON.stringify(synthetic.afterLong)}`);
      if (synthetic.afterLong.some((e) => e.startsWith('tap'))) problems.push('long-press also fired a tap');
      if (synthetic.afterPan[0] !== 'panStart' || synthetic.afterPan.at(-1) !== 'panEnd' || !synthetic.afterPan.includes('pan:10,20')) {
        problems.push(`two-finger pan log ${JSON.stringify(synthetic.afterPan)}`);
      }
      if (!synthetic.afterMouse.includes('tap:mouse')) problems.push(`mouse tap log ${JSON.stringify(synthetic.afterMouse)}`);
      if (!synthetic.modes.includes('mouse')) problems.push(`no mouse input-mode event ${JSON.stringify(synthetic.modes)}`);
      const attr = await page.evaluate(() => document.documentElement.getAttribute('data-input-mode'));
      if (attr !== 'mouse') problems.push(`data-input-mode ${attr}`);
      return problems.length ? bad(problems.join('; ')) : ok();
    },
  },
  {
    id: 'kit-input-tap',
    title: 'input.js: a real touch tap reaches onTap',
    async run({ page, origin }) {
      await loadKit(page, origin);
      await page.evaluate(() => {
        const pad = document.createElement('div');
        pad.style.cssText = 'position:fixed;left:20px;top:120px;width:220px;height:220px;background:#234';
        document.body.appendChild(pad);
        window.__taps = [];
        MixKit.input.gestures(pad, { onTap: (d) => window.__taps.push(d.pointerType) });
      });
      await page.touchscreen.tap(130, 230);
      await sleep(80);
      const taps = await page.evaluate(() => window.__taps);
      return taps.length === 1 && taps[0] === 'touch' ? ok() : bad(`taps ${JSON.stringify(taps)}`);
    },
  },
  {
    id: 'kit-lifecycle',
    title: 'lifecycle.js: hide pauses once and suspends audio, show resumes only what it suspended, Mute All wins',
    async run({ page, origin }) {
      await loadKit(page, origin);
      await page.touchscreen.tap(60, 400); // user activation for the AudioContext
      const result = await page.evaluate(async () => {
        const settle = (ctx, want) => new Promise((resolve) => {
          const started = Date.now();
          const poll = () => (ctx.state === want || Date.now() - started > 800 ? resolve(ctx.state) : setTimeout(poll, 25));
          poll();
        });
        const events = [];
        window.addEventListener('mixkit:pause', (e) => events.push(`pause:${e.detail.reason}`));
        window.addEventListener('mixkit:resume', (e) => events.push(`resume:${e.detail.reason}`));
        const hidden = (value) => {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
          document.dispatchEvent(new Event('visibilitychange'));
        };
        const Ctor = window.AudioContext || window.webkitAudioContext;
        const ctx = Ctor ? new Ctor() : null;
        if (ctx) { try { await ctx.resume(); } catch { /* policy */ } }
        const unlocked = ctx ? (await settle(ctx, 'running')) === 'running' : false;
        const tracked = ctx ? window.__mixmashNav.audioContexts.includes(ctx) : true;

        hidden(true);
        window.dispatchEvent(new Event('blur')); // overlapping reason
        const whileHidden = ctx ? await settle(ctx, 'suspended') : null;
        const pausedOnce = events.filter((e) => e.startsWith('pause')).length;
        hidden(false);
        window.dispatchEvent(new Event('focus'));
        const afterShow = ctx ? await settle(ctx, 'running') : null;
        const cycle = events.slice();
        if (!ctx) return { noAudio: true, pausedOnce, cycle, unlocked, tracked };

        // A context the player muted stays suspended through a hide and show.
        window.__mixmashNav.setMuted(true);
        await settle(ctx, 'suspended');
        hidden(true);
        hidden(false);
        const mutedAfter = await settle(ctx, 'running');
        window.__mixmashNav.setMuted(false);
        const unmuted = await settle(ctx, 'running');
        return { unlocked, tracked, whileHidden, afterShow, pausedOnce, cycle, mutedAfter, unmuted, finalState: ctx.state };
      });
      const problems = [];
      if (!result.tracked) problems.push('nav.js did not track the AudioContext');
      if (result.pausedOnce !== 1) problems.push(`pause fired ${result.pausedOnce} times`);
      if (JSON.stringify(result.cycle) !== JSON.stringify(['pause:hidden', 'resume:blur'])) problems.push(`events ${JSON.stringify(result.cycle)}`);
      if (result.unlocked) {
        if (result.whileHidden !== 'suspended') problems.push(`audio ${result.whileHidden} while hidden`);
        if (result.afterShow !== 'running') problems.push(`audio ${result.afterShow} after show`);
        if (result.mutedAfter === 'running') problems.push('muted audio was resumed by lifecycle');
        if (result.unmuted !== 'running') problems.push(`audio ${result.unmuted} after unmute`);
      }
      const note = result.noAudio ? 'this engine has no AudioContext, so audio suspension is not exercised here'
        : result.unlocked ? 'audio suspend/resume verified'
          : 'engine kept the AudioContext locked, so suspend/resume is asserted by events only (audio unlock stays a real-device check)';
      return problems.length ? bad(problems.join('; ')) : ok(note);
    },
  },
  {
    id: 'kit-stage',
    title: 'stage.js: fit inside the safe area at the base aspect, DPR backing store, one rotate prompt',
    async run({ page, origin, config }) {
      await loadKit(page, origin);
      await setInsets(page, config.insets);
      const portrait = config.height > config.width;
      const setup = await page.evaluate(() => {
        const stageEl = document.createElement('div');
        stageEl.className = 'mixkit-stage';
        const canvas = document.createElement('canvas');
        stageEl.appendChild(canvas);
        document.body.appendChild(stageEl);
        window.__fits = [];
        window.addEventListener('mixkit:stage-fit', (e) => window.__fits.push(e.detail.rotatePrompt));
        window.__stage = MixKit.stage.attach(canvas, { width: 960, height: 540, container: stageEl, orientation: 'landscape' });
        const info = window.__stage.info();
        const r = canvas.getBoundingClientRect();
        const prompt = document.querySelector('.mixkit-rotate');
        return {
          info, rect: { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height },
          canvas: { w: canvas.width, h: canvas.height, touchAction: canvas.style.touchAction },
          vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio,
          promptShown: !!prompt && !prompt.hidden,
        };
      });
      const problems = [];
      const i = config.insets;
      const { rect, vw, vh } = setup;
      if (rect.l < i.left - 0.5 || rect.t < i.top - 0.5 || rect.r > vw - i.right + 0.5 || rect.b > vh - i.bottom + 0.5) {
        problems.push(`canvas outside the safe area: ${JSON.stringify(rect)} in ${vw}x${vh}`);
      }
      if (Math.abs(rect.w / rect.h - 960 / 540) > 0.02) problems.push(`aspect ${round(rect.w / rect.h)}`);
      const expectedDpr = Math.min(setup.dpr, 2);
      if (Math.abs(setup.canvas.w - Math.round(rect.w * expectedDpr)) > 1) problems.push(`backing ${setup.canvas.w} for css ${round(rect.w)} at dpr ${setup.dpr} (cap 2)`);
      if (setup.canvas.touchAction !== 'none') problems.push(`touch-action ${setup.canvas.touchAction}`);
      // A landscape game: prompt in portrait (the fitted canvas is under 50% of the screen), none in landscape.
      if (setup.promptShown !== portrait) problems.push(`rotate prompt ${setup.promptShown ? 'shown' : 'hidden'} in ${portrait ? 'portrait' : 'landscape'} (fill ${round(setup.info.fillRatio)})`);

      // The cap is configurable.
      const capped = await page.evaluate(() => { window.__stage.setDprCap(3); const i = window.__stage.info(); return { dpr: i.dpr, w: i.backingWidth, css: i.cssWidth }; });
      if (setup.dpr >= 3 && capped.w !== Math.round(capped.css * 3)) problems.push(`dprCap 3 gave ${capped.w} for css ${capped.css}`);
      await page.evaluate(() => window.__stage.setDprCap(2));

      if (portrait) {
        // Dismiss with a real touch tap; it must stay dismissed after a refit.
        const button = await page.evaluate(() => {
          const b = document.querySelector('[data-mixkit-rotate-dismiss]').getBoundingClientRect();
          return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height };
        });
        if (button.w < 43.5 || button.h < 43.5) problems.push(`dismiss button ${round(button.w)}x${round(button.h)}`);
        await page.touchscreen.tap(button.x, button.y);
        await sleep(60);
        const afterDismiss = await page.evaluate(() => { window.__stage.fit(); return !document.querySelector('.mixkit-rotate').hidden; });
        if (afterDismiss) problems.push('rotate prompt came back after Continue anyway');
      }
      return problems.length ? bad(problems.join('; ')) : ok(`fill ${round(setup.info.fillRatio)}`);
    },
  },
  {
    id: 'kit-nav',
    title: 'nav.js: one 44px handle when idle, 44px controls, safe-area slots, contrast, fullscreen detection',
    async run({ page, origin, config }) {
      await loadKit(page, origin);
      const problems = [];
      const state = () => page.evaluate(() => document.querySelector('.mixnav').getAttribute('data-state'));
      const box = (selector) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, selector);

      if ((await state()) !== 'expanded') problems.push('nav does not start open');
      // Idle: the open bar collapses to one handle on its own.
      await page.waitForFunction(() => document.querySelector('.mixnav').getAttribute('data-state') === 'collapsed', null, { timeout: 8000 })
        .catch(() => problems.push('nav never collapsed on its own'));
      const visible = await page.evaluate(() => [...document.querySelectorAll('.mixnav a, .mixnav button')].filter((el) => el.getBoundingClientRect().width > 0).length);
      if (visible !== 1) problems.push(`${visible} controls visible while collapsed (want 1 handle)`);
      const handle = await box('.mixnav-handle');
      if (handle.w < 43.5 || handle.h < 43.5) problems.push(`handle ${round(handle.w)}x${round(handle.h)}`);
      const ratio = await page.evaluate(`(${contrastScript.toString()})()`);
      if (ratio < 4.5) problems.push(`handle contrast ${round(ratio)}:1`);

      // A real touch tap opens it; every control is 44px; Mute All works by touch.
      await page.touchscreen.tap(handle.x, handle.y);
      await sleep(80);
      if ((await state()) !== 'expanded') problems.push('tapping the handle did not open the bar');
      const controls = await page.evaluate(() => [...document.querySelectorAll('.mixnav a, .mixnav button')].map((el) => {
        const r = el.getBoundingClientRect();
        return { label: el.getAttribute('aria-label') || el.title, w: r.width, h: r.height, shown: r.width > 0 };
      }).filter((c) => c.shown));
      for (const c of controls) if (c.w < 43.5 || c.h < 43.5) problems.push(`${c.label} ${round(c.w)}x${round(c.h)}`);
      const mute = await box('.mixnav button[aria-pressed][title*="udio"]');
      await page.touchscreen.tap(mute.x, mute.y);
      await sleep(80);
      const muted = await page.evaluate(() => window.__mixmashNav.isMuted());
      if (!muted) problems.push('touching Mute All did not mute');
      const mute2 = await box('.mixnav button[aria-pressed][title*="udio"]');
      await page.touchscreen.tap(mute2.x, mute2.y);
      await sleep(80);
      if (await page.evaluate(() => window.__mixmashNav.isMuted())) problems.push('second tap did not unmute');

      // Fullscreen is offered only where the API exists.
      const fs = await page.evaluate(() => {
        const b = document.querySelector('.mixnav button[title*="fullscreen"]');
        return { hidden: b.hidden || b.getBoundingClientRect().width === 0, api: !!document.documentElement.requestFullscreen };
      });
      if (fs.hidden === fs.api) problems.push(`fullscreen button ${fs.hidden ? 'hidden' : 'shown'} but API ${fs.api ? 'present' : 'missing'}`);

      // Slots stay clear of the insets in both states, and offsets move the bar.
      await setInsets(page, config.insets);
      const i = config.insets;
      for (const slot of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
        await page.evaluate((s) => window.__mixmashNav.setSlot(s), slot);
        for (const mode of ['collapse', 'expand']) {
          await page.evaluate((m) => window.__mixmashNav[m](), mode);
          const r = await page.evaluate(() => {
            const b = document.querySelector('.mixnav').getBoundingClientRect();
            return { l: b.left, t: b.top, r: b.right, b: b.bottom, vw: innerWidth, vh: innerHeight };
          });
          if (r.l < i.left - 0.5 || r.t < i.top - 0.5 || r.r > r.vw - i.right + 0.5 || r.b > r.vh - i.bottom + 0.5) {
            problems.push(`${slot}/${mode} outside the safe area [${round(r.l)},${round(r.t)},${round(r.r)},${round(r.b)}]`);
          }
          const right = slot.endsWith('right');
          const bottom = slot.startsWith('bottom');
          const nearX = right ? r.vw - i.right - r.r : r.l - i.left;
          const nearY = bottom ? r.vh - i.bottom - r.b : r.t - i.top;
          if (Math.abs(nearX - 12) > 1.5 || Math.abs(nearY - 12) > 1.5) problems.push(`${slot}/${mode} is ${round(nearX)}/${round(nearY)}px from its corner (want 12)`);
        }
      }
      await page.evaluate(() => { window.__mixmashNav.setSlot('top-left', { top: 56 }); window.__mixmashNav.collapse(); });
      const shifted = await box('.mixnav');
      if (Math.abs(shifted.t - (i.top + 12 + 56)) > 1.5) problems.push(`slot offset top 56 put the bar at ${round(shifted.t)}`);
      await page.evaluate(() => window.__mixmashNav.setSlot('top-left'));

      // A page that reserves room for the full bar can opt out of collapsing.
      await page.evaluate(() => { window.__mixmashNav.setCollapsible(false); });
      const open = await page.evaluate(() => ({ state: document.querySelector('.mixnav').getAttribute('data-state'), handle: document.querySelector('.mixnav-handle').getBoundingClientRect().width }));
      if (open.state !== 'expanded' || open.handle !== 0) problems.push(`non-collapsible bar: ${JSON.stringify(open)}`);
      await clearInsets(page);
      return problems.length ? bad(problems.slice(0, 5).join('; ')) : ok(`contrast ${round(ratio)}:1`);
    },
  },
];

// --- runner -------------------------------------------------------------------------------
async function launch(engine) {
  if (engine === 'webkit') {
    const options = { headless: true };
    if (process.env.SMOKE_WEBKIT_EXECUTABLE) options.executablePath = process.env.SMOKE_WEBKIT_EXECUTABLE;
    return webkit.launch(options);
  }
  const options = { headless: true };
  if (process.env.SMOKE_CHROMIUM_CHANNEL) {
    // An installed Chrome has a real GPU path; software GL would only slow it down.
    options.channel = process.env.SMOKE_CHROMIUM_CHANNEL;
  } else {
    // Playwright's headless shell has no GPU, so give WebGL pages (Age of Dave, Garden OS) software GL.
    options.args = ['--use-gl=angle', '--use-angle=swiftshader'];
    if (process.env.PW_EXECUTABLE_PATH) options.executablePath = process.env.PW_EXECUTABLE_PATH;
  }
  return chromium.launch(options);
}

function contextOptions(config) {
  const options = {
    viewport: { width: config.width, height: config.height },
    screen: { width: config.width, height: config.height },
    deviceScaleFactor: config.dpr,
    hasTouch: true,
    isMobile: true,
    serviceWorkers: 'block',
  };
  if (config.userAgent) options.userAgent = config.userAgent;
  return options;
}

function classify(rowId, check, config, outcome) {
  if (outcome.na) return { status: 'n/a', detail: '' };
  const expected = expectedFailFor(rowId, check.id, config);
  if (outcome.ok) {
    if (!expected) return { status: 'pass', detail: outcome.detail };
    return expected.partial
      ? { status: 'pass', detail: `${outcome.detail} (the finding does not show at this config)` }
      : { status: 'xpass', detail: outcome.detail, finding: expected.finding };
  }
  return expected ? { status: 'xfail', detail: outcome.detail, finding: expected.finding, offenders: outcome.offenders } : { status: 'fail', detail: outcome.detail, offenders: outcome.offenders };
}

const verbose = process.env.SMOKE_VERBOSE === '1';
const trace = (...args) => { if (verbose) console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...args); };

// A check that hangs (a wedged page) must fail, not stall the whole run.
const CHECK_TIMEOUT_MS = 60000;
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runCheck(check, ctx, rowId) {
  try {
    trace(`  ${ctx.config.id} ${rowId} ${check.id} ...`);
    const outcome = await withTimeout(check.run(ctx), CHECK_TIMEOUT_MS, check.id);
    return classify(rowId, check, ctx.config, outcome);
  } catch (error) {
    return classify(rowId, check, ctx.config, bad(`threw: ${String(error && error.message || error).split('\n')[0]}`));
  }
}

export async function run({ baseUrl, engines, configFilter, gameIds, reportDir } = {}) {
  for (const entry of EXPECTED_FAIL) {
    if (!entry.finding || !entry.game || !entry.check) throw new Error(`EXPECTED_FAIL entry needs game, check and finding: ${JSON.stringify(entry)}`);
  }
  const server = baseUrl ? null : await startStaticServer();
  const origin = (baseUrl || server.origin).replace(/\/+$/, '');
  const results = [];
  const browsers = {};
  const configs = CONFIGS.filter((c) => (!engines || engines.includes(c.engine)) && (!configFilter || c.id.includes(configFilter)));
  const games = GAMES.filter((g) => !gameIds || gameIds.includes(g.id));
  // Each game and each kit check gets its own browser context: storage never leaks between rows
  // (the mute key, IndexedDB), and the context is what gets closed. Closing a bare page can hang
  // when the WebKit build and the Playwright library are a version apart.
  const withPage = async (config, fn, prepare) => {
    const context = await browsers[config.engine].newContext(contextOptions(config));
    context.setDefaultTimeout(20000);
    try {
      if (prepare) await prepare(context, config);
      return await fn(await context.newPage());
    } finally {
      await withTimeout(context.close(), 15000, 'context.close').catch(() => {});
    }
  };

  try {
    for (const config of configs) {
      browsers[config.engine] ||= await launch(config.engine);
      const started = Date.now();
      const mark = results.length;
      for (const game of games) {
        trace(`${config.id} ${game.id}: opening`);
        await withPage(config, async (page) => {
          try {
            await page.goto(`${origin}${game.path}`, { waitUntil: 'load', timeout: 30000 });
            await sleep(700);
            if (game.ready) await withTimeout(game.ready(page), 35000, 'ready').catch((error) => trace(`${game.id}: ready hook gave up (${error.message})`));
            // A wedged page (a blocked main thread) fails once, fast, instead of timing out every check.
            const alive = await withTimeout(page.evaluate(() => 1), 20000, 'liveness').catch(() => false);
            if (!alive) {
              results.push({ config: config.id, row: game.id, check: 'responsive', status: 'fail', detail: 'the page stopped answering after load (main thread blocked)' });
              return;
            }
            for (const check of GAME_CHECKS) {
              const result = await runCheck(check, { page, config, game, origin }, game.id);
              results.push({ config: config.id, row: game.id, check: check.id, ...result });
            }
          } catch (error) {
            results.push({ config: config.id, row: game.id, check: 'load', status: 'fail', detail: `could not load ${game.path}: ${String(error.message).split('\n')[0]}` });
          }
        }, game.prepare);
      }
      if (!gameIds || gameIds.includes('kit')) {
        for (const check of KIT_CHECKS) {
          await withPage(config, async (page) => {
            const result = await runCheck(check, { page, config, origin, game: { id: 'kit' } }, 'kit');
            results.push({ config: config.id, row: 'kit', check: check.id, ...result });
          });
        }
      }
      const mine = results.slice(mark);
      const tally = ['pass', 'xfail', 'xpass', 'fail', 'n/a'].map((k) => `${k} ${mine.filter((r) => r.status === k).length}`).join(', ');
      console.log(`  ${config.id} (${config.engine}): ${tally} in ${Math.round((Date.now() - started) / 1000)}s`);
    }
  } finally {
    for (const browser of Object.values(browsers)) await browser.close().catch(() => {});
    if (server) await server.close();
  }

  const dir = reportDir || await mkdtemp(join(tmpdir(), 'mixmash-mobile-'));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'report.json'), `${JSON.stringify({ origin, results }, null, 2)}\n`);
  return { origin, results, dir };
}

export function summarize(results) {
  const rows = [...new Set(results.map((r) => r.row))];
  const configs = [...new Set(results.map((r) => r.config))];
  const cell = (row, config) => {
    const subset = results.filter((r) => r.row === row && r.config === config);
    if (subset.some((r) => r.status === 'fail')) return 'FAIL';
    if (subset.some((r) => r.status === 'xpass')) return 'xpass';
    if (subset.some((r) => r.status === 'xfail')) return 'xfail';
    if (subset.every((r) => r.status === 'n/a')) return 'n/a';
    return 'pass';
  };
  return { rows, configs, cell };
}

async function main() {
  const baseUrl = process.env.SMOKE_BASE_URL || '';
  const { origin, results, dir } = await run({
    baseUrl,
    engines: process.env.SMOKE_ENGINE ? [process.env.SMOKE_ENGINE] : undefined,
    configFilter: process.env.SMOKE_CONFIGS || '',
    gameIds: process.env.SMOKE_GAMES ? process.env.SMOKE_GAMES.split(',') : undefined,
    reportDir: process.env.SMOKE_REPORT_DIR,
  });

  const strict = process.env.SMOKE_STRICT_XPASS === '1';
  const { rows, configs, cell } = summarize(results);
  console.log(`\nmobile touch rail against ${origin}\n`);
  const width = Math.max(...configs.map((c) => c.length)) + 2;
  console.log(`${'config'.padEnd(width)}${rows.map((r) => r.padEnd(15)).join('')}`);
  for (const config of configs) console.log(`${config.padEnd(width)}${rows.map((r) => cell(r, config).padEnd(15)).join('')}`);

  const counts = {};
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  console.log(`\n${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join('  ')}`);

  const failures = results.filter((r) => r.status === 'fail' || (strict && r.status === 'xpass'));
  const xpass = results.filter((r) => r.status === 'xpass');
  if (xpass.length && !strict) {
    console.log('\nXPASS (expected to fail but passed; remove the EXPECTED_FAIL entry):');
    for (const r of xpass) console.log(`  ${r.config} ${r.row} ${r.check}: ${r.finding}`);
  }
  if (failures.length) {
    console.log('\nFAILURES:');
    for (const r of failures) console.log(`  ${r.config} ${r.row} ${r.check}: ${r.status === 'xpass' ? `XPASS ${r.finding}` : r.detail}`);
  }
  console.log(`\nreport: ${join(dir, 'report.json')}`);
  if (failures.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
