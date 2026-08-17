/**
 * Browser smoke rail for the rest of the catalog: /pitch/, /mars/, the
 * /empires/ shell, and the hub. `smoke:play` already covers /play/.
 *
 * Every assertion here goes through a hook the page exposes on purpose
 * (`window.__pitch`, `window.validateSaveCode`, `window.__empiresTelemetry`),
 * so this suite tests behaviour rather than markup that will churn.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { launchOptions, startStaticServer, trackPageFailures } from './static-server.mjs';

const { origin, close } = await startStaticServer();

const checks = [];
function record(name) {
  checks.push(name);
  console.log(`  ok  ${name}`);
}

let browser;
try {
  browser = await chromium.launch(launchOptions());

  const desktop = { viewport: { width: 1280, height: 800 } };
  const mobile = {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  };

  // MarsScape calls its authority API, which a static file server does not
  // serve. The game is built to fall back to offline mode when that call fails,
  // so those 404s are expected here and are not asset regressions.
  const IGNORED_REQUESTS = [/\/api\//];

  async function open(path, contextOptions = desktop) {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    const failures = trackPageFailures(page, origin, { ignore: IGNORED_REQUESTS });
    await page.goto(`${origin}${path}`, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    return { context, page, failures };
  }

  // ---------------------------------------------------------------- /pitch/
  {
    const { context, page, failures } = await open('/pitch/?debug');
    assert.deepEqual(failures, [], '/pitch/ must load without page or same-origin request errors');
    record('/pitch/ loads clean');

    // PR-102: master, SFX, and music are independent buses.
    await page.fill('#vol-slider', '40');
    await page.fill('#sfx-slider', '20');
    await page.fill('#music-slider', '10');
    const mix = await page.evaluate(() => ({
      master: window.__pitch.audio.volume,
      sfx: window.__pitch.audio.sfxVolume,
      music: window.__pitch.audio.musicVolume,
    }));
    assert.ok(Math.abs(mix.master - 0.4) < 0.01, 'master slider drives master volume');
    assert.ok(Math.abs(mix.sfx - 0.2) < 0.01, 'sfx slider drives the sfx bus');
    assert.ok(Math.abs(mix.music - 0.1) < 0.01, 'music slider drives the music bus');
    record('PR-102 master/SFX/music sliders are independent');

    await page.click('#mute-btn');
    assert.equal(await page.evaluate(() => window.__pitch.audio.muted), true, 'mute engages');
    await page.click('#mute-btn');
    assert.equal(await page.evaluate(() => window.__pitch.audio.muted), false, 'mute releases');
    record('PR-102 mute toggles both ways');

    // Music cue follows match state.
    await page.click('#kickoff-btn');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__pitch.music.cue), 'match', 'kick off starts the match bed');
    assert.ok(await page.evaluate(() => window.__pitch.music.timer > 0), 'the music scheduler is running');
    record('music bed starts on kick off');

    // Muting must not tear the scheduler down, or unmuting mid-match would
    // leave the bed permanently silent with nothing to restart it. The control
    // itself lives on the pre-match screen and is hidden now, so invoke its real
    // handler via .click() rather than a user-visible click.
    await page.evaluate(() => document.getElementById('mute-btn').click());
    await page.waitForTimeout(120);
    const whileMuted = await page.evaluate(() => ({
      muted: window.__pitch.audio.muted,
      timer: window.__pitch.music.timer,
      cue: window.__pitch.music.cue,
    }));
    assert.equal(whileMuted.muted, true, 'mute engaged');
    assert.ok(whileMuted.timer > 0, 'the music scheduler survives a mute');
    assert.equal(whileMuted.cue, 'match', 'the cue is retained through a mute');
    await page.evaluate(() => document.getElementById('mute-btn').click());
    record('music survives a mute/unmute round trip');

    // PR-103: the guide holds the show clock for its full duration.
    await page.evaluate(() => window.__pitch.startHalftime());
    await page.waitForTimeout(200);
    const armed = await page.evaluate(() => ({
      guide: window.__pitch.game.htGuide,
      clock: window.__pitch.game.htClock,
      max: window.__pitch.HT_GUIDE_SECONDS,
      cue: window.__pitch.music.cue,
    }));
    assert.equal(armed.max, 3, 'the guide is a 3 second beat');
    assert.ok(armed.guide > 0 && armed.guide <= 3, 'the guide is counting down');
    assert.equal(armed.clock, 26, 'the show clock is held while the guide plays');
    assert.equal(armed.cue, 'halftime', 'halftime swaps the music cue');
    record('PR-103 guide arms and freezes the show clock');

    // Wait on the condition, not the clock: the loop clamps dt to 0.1s per
    // frame, so on a slow headless renderer 3s of game time takes longer than
    // 3s of wall time and a fixed sleep would flake.
    await page.waitForFunction(() => window.__pitch.game.htGuide === 0, null, { timeout: 20_000 });
    await page.waitForFunction(() => window.__pitch.game.htClock < 26, null, { timeout: 20_000 });
    record('PR-103 show resumes after the guide');

    assert.ok(await page.evaluate(() => !!window.__pitch.pad), 'PR-105 gamepad state exists');
    record('PR-105 gamepad state wired');
    await context.close();
  }

  // ------------------------------------------------------ /pitch/ on mobile
  {
    const { context, page } = await open('/pitch/?debug', mobile);
    const geometry = await page.evaluate(() => {
      document.getElementById('touch').classList.add('on');
      const box = (id) => {
        const rect = document.getElementById(id).getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
      };
      return { shoot: box('btn-shoot'), sprint: box('btn-sprint'), vh: window.innerHeight, vw: window.innerWidth };
    });
    // PR-101: the cluster must stay in the bottom band, clear of the scoreboard.
    assert.ok(geometry.shoot.top > geometry.vh * 0.6, 'shoot button stays in the lower band');
    assert.ok(geometry.sprint.top > geometry.vh * 0.6, 'sprint button stays in the lower band');
    assert.ok(geometry.shoot.bottom <= geometry.vh, 'shoot button is inside the viewport');
    assert.ok(geometry.sprint.right < geometry.shoot.left, 'sprint and shoot do not overlap');
    record('PR-101 touch cluster is clear of the HUD and self-consistent');
    await context.close();
  }

  // ----------------------------------------------------------------- /mars/
  {
    const { context, page, failures } = await open('/mars/');
    assert.deepEqual(failures, [], '/mars/ must load without page or same-origin request errors');
    record('/mars/ loads clean');

    await page.click('#startButton');
    await page.waitForTimeout(1200);

    assert.ok(await page.locator('.charge-track').count() > 0, 'MS-102 charge bars render');
    record('MS-102 node depletion bars render');

    const tooltip = await page.locator('.skill-row--expandable').first().getAttribute('title');
    assert.match(tooltip, /XP:/, 'MS-103 tooltip carries current XP');
    assert.match(tooltip, /Next: level/, 'MS-103 tooltip carries the next-level target');
    await page.locator('.skill-row--expandable').first().click();
    assert.equal(await page.locator('.skill-detail').first().isVisible(), true, 'MS-103 tap expands the detail');
    record('MS-103 skill tooltips and tap-expand work');

    // MS-104: every malformed shape must be rejected before any state is applied.
    const validation = await page.evaluate(() => {
      const check = window.validateSaveCode;
      return {
        empty: check('').ok,
        notBase64: check('!!!not base64!!!').ok,
        badJson: check(btoa('this is not json')).ok,
        noState: check(btoa(JSON.stringify({ hello: 1 }))).ok,
        unsigned: check(btoa(JSON.stringify({ state: {} }))).ok,
      };
    });
    for (const [shape, accepted] of Object.entries(validation)) {
      assert.equal(accepted, false, `MS-104 must reject the "${shape}" save code`);
    }
    record('MS-104 save import rejects every malformed shape');

    // MS-105: wheel zoom moves the view transform.
    const scale = await page.evaluate(() => {
      const viewport = document.getElementById('isoViewport');
      const rect = viewport.getBoundingClientRect();
      viewport.dispatchEvent(new WheelEvent('wheel', {
        deltaY: -120, bubbles: true, cancelable: true,
        clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2,
      }));
      return getComputedStyle(document.getElementById('isoBoard')).getPropertyValue('--user-scale').trim();
    });
    assert.ok(Number.parseFloat(scale) > 1, 'MS-105 wheel zoom updates --user-scale');
    record('MS-105 map zoom responds');
    await context.close();
  }

  // ---------------------------------------------------------- /mars/ mobile
  {
    const { context, page } = await open('/mars/', mobile);
    await page.click('#startButton');
    await page.waitForTimeout(900);
    const layout = await page.evaluate(() => ({
      vw: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      meters: [...document.querySelectorAll('.meter, .sol-card')]
        .map((el) => el.getBoundingClientRect().right),
      buttons: [...document.querySelectorAll('.footer-actions button')]
        .map((el) => ({ right: el.getBoundingClientRect().right, height: el.getBoundingClientRect().height })),
    }));
    assert.ok(layout.scrollWidth <= layout.vw + 1, 'MS-101 no horizontal overflow at 390px');
    for (const right of layout.meters) {
      assert.ok(right <= layout.vw + 1, 'MS-101 stat cards fit the viewport');
    }
    for (const button of layout.buttons) {
      assert.ok(button.right <= layout.vw + 1, 'MS-101 footer buttons fit the viewport');
      assert.ok(button.height >= 40, 'MS-101 footer buttons keep a thumb-sized target');
    }
    record('MS-101 mobile layout fits a 390px viewport');
    await context.close();
  }

  // -------------------------------------------------------------- /empires/
  {
    const { context, page } = await open('/empires/');
    const capabilities = await page.evaluate(() => window.__empiresCapabilities);
    assert.ok(capabilities, 'EM-104 capability probe ran');
    assert.equal(capabilities.wasm, true, 'EM-104 detects WebAssembly on Chromium');
    assert.equal(capabilities.simd, true, 'EM-104 SIMD probe is not a false negative on Chromium');
    assert.ok(capabilities.webgl, 'EM-104 detects a WebGL context');
    record('EM-104 capability probe reports accurately');

    await page.keyboard.press('F3');
    await page.waitForTimeout(700);
    assert.equal(await page.locator('#telemetry').isVisible(), true, 'EM-103 F3 shows the overlay');
    assert.match(await page.locator('#telemetry').textContent(), /FPS/, 'EM-103 overlay reports FPS');
    await page.keyboard.press('F3');
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#telemetry').isVisible(), false, 'EM-103 F3 hides it again');
    record('EM-103 telemetry overlay toggles');

    const opened = await page.evaluate(() => {
      window.__empiresShortcuts.open();
      return document.getElementById('shortcuts').classList.contains('is-open');
    });
    assert.equal(opened, true, 'EM-102 shortcut guide opens');
    assert.ok(await page.evaluate(() => !!window.__empiresAudio), 'EM-105 audio tracker installed');
    record('EM-102 guide opens and EM-105 audio tracker is installed');
    await context.close();
  }

  // ------------------------------------------------------------ hub + nav
  {
    const { context, page } = await open('/');
    assert.equal(await page.locator('link[rel="manifest"]').count(), 1, 'HUB-104 manifest is linked');
    const atRest = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.game-card .laser')).animationPlayState);
    assert.equal(atRest, 'paused', 'HUB-103 card loops are paused at rest');
    await page.locator('.game-card').first().hover();
    await page.waitForTimeout(200);
    const hovered = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.game-card .laser')).animationPlayState);
    assert.equal(hovered, 'running', 'HUB-103 card loops run on hover');
    record('HUB-103/104 hub previews and manifest');
    await context.close();
  }

  for (const path of ['/play/', '/mars/', '/pitch/', '/garden/', '/empires/']) {
    const { context, page } = await open(path);
    const nav = await page.evaluate(() => {
      const bar = document.querySelector('.mixnav');
      if (!bar) return null;
      return {
        controls: bar.querySelectorAll('a, button').length,
        api: !!window.__mixmashNav,
      };
    });
    assert.ok(nav, `HUB-102 nav is present on ${path}`);
    assert.equal(nav.controls, 4, `HUB-102 nav has all four controls on ${path}`);
    assert.equal(nav.api, true, `HUB-102 nav API is exposed on ${path}`);
    await context.close();
  }
  record('HUB-102 shared nav is present on every game path');

  console.log(`\ncatalog smoke: ${checks.length} checks passed`);
} finally {
  if (browser) await browser.close();
  await close();
}
