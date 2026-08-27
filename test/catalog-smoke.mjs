/**
 * Browser smoke rail for the rest of the catalog: /pitch/, /mars/, the
 * /empires/ shell, and the hub. `smoke:play` already covers /play/.
 *
 * Every assertion here goes through a hook the page exposes on purpose
 * (`window.__pitch`, `window.validateSaveCode`, `window.__empiresTelemetry`),
 * so this suite tests behaviour rather than markup that will churn.
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { assetPath, RENDER_CONTRACT } from '../mars/render-contract.mjs';
import {
  loadArtManifest,
  writeApprovalReports,
  writeRuntimeIndex,
} from '../mars/art/validate-assets.mjs';
import { spriteIds } from '../mars/sprites.mjs';
import { launchOptions, startStaticServer, trackPageFailures } from './static-server.mjs';

const { origin, close } = await startStaticServer();

const checks = [];
const temporaryFixtureRoots = new Set();
function record(name) {
  checks.push(name);
  console.log(`  ok  ${name}`);
}

function syntheticAsepriteSource(width, height) {
  const layerName = Buffer.from('Synthetic layer', 'utf8');
  const layerData = Buffer.alloc(18 + layerName.length);
  layerData.writeUInt16LE(1, 0);
  layerData.writeUInt16LE(0, 2);
  layerData.writeUInt16LE(width, 6);
  layerData.writeUInt16LE(height, 8);
  layerData[12] = 255;
  layerData.writeUInt16LE(layerName.length, 16);
  layerName.copy(layerData, 18);
  const layerChunk = Buffer.alloc(6 + layerData.length);
  layerChunk.writeUInt32LE(layerChunk.length, 0);
  layerChunk.writeUInt16LE(0x2004, 4);
  layerData.copy(layerChunk, 6);

  const celData = Buffer.alloc(24);
  celData[6] = 255;
  celData.writeUInt16LE(0, 7);
  celData.writeUInt16LE(1, 16);
  celData.writeUInt16LE(1, 18);
  celData.set([77, 184, 212, 255], 20);
  const celChunk = Buffer.alloc(6 + celData.length);
  celChunk.writeUInt32LE(celChunk.length, 0);
  celChunk.writeUInt16LE(0x2005, 4);
  celData.copy(celChunk, 6);

  const frameSize = 16 + layerChunk.length + celChunk.length;
  const header = Buffer.alloc(128);
  header.writeUInt32LE(128 + frameSize, 0);
  header.writeUInt16LE(0xa5e0, 4);
  header.writeUInt16LE(1, 6);
  header.writeUInt16LE(width, 8);
  header.writeUInt16LE(height, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(1, 14);
  header.writeUInt16LE(100, 18);
  header[34] = 1;
  header[35] = 1;
  header.writeUInt16LE(width, 36);
  header.writeUInt16LE(height, 38);
  const frame = Buffer.alloc(16);
  frame.writeUInt32LE(frameSize, 0);
  frame.writeUInt16LE(0xf1fa, 4);
  frame.writeUInt16LE(0xffff, 6);
  frame.writeUInt16LE(100, 8);
  frame.writeUInt32LE(2, 12);
  return Buffer.concat([header, frame, layerChunk, celChunk]);
}

async function installSyntheticApprovalFixture(page, scope = 'artist-test') {
  const fixtureRoot = mkdtempSync(join(tmpdir(), `mars-${scope}-approval-browser-`));
  temporaryFixtureRoots.add(fixtureRoot);
  const manifest = loadArtManifest();
  const pngBySize = new Map();
  const spriteBodies = new Map();
  const withheldSprites = new Set();

  const assets = scope === 'full'
    ? manifest.assets
    : manifest.assets.filter((candidate) => candidate.artistTest);
  for (const asset of assets) {
    const spriteClass = RENDER_CONTRACT.spriteClasses[asset.class];
    const selectedStates = scope === 'full'
      ? new Set(asset.states.map((candidate) => candidate.name))
      : new Set(asset.artistTestStates);
    const sizeKey = `${spriteClass.canvasWidth}x${spriteClass.canvasHeight}`;
    if (!pngBySize.has(sizeKey)) {
      const dataUrl = await page.evaluate(({ width, height }) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, width, height);
        context.fillStyle = '#4db8d4';
        context.fillRect(1, 1, Math.max(1, width - 2), Math.max(1, height - 2));
        return canvas.toDataURL('image/png');
      }, { width: spriteClass.canvasWidth, height: spriteClass.canvasHeight });
      pngBySize.set(sizeKey, Buffer.from(dataUrl.split(',')[1], 'base64'));
    }
    for (const assetState of asset.states.filter((candidate) => selectedStates.has(candidate.name))) {
      for (let frame = 1; frame <= assetState.frames; frame += 1) {
        const relativePath = assetPath(asset.family, asset.id, assetState.name, frame);
        const body = pngBySize.get(sizeKey);
        const exportPath = join(fixtureRoot, manifest.exportRoot, relativePath);
        mkdirSync(dirname(exportPath), { recursive: true });
        writeFileSync(exportPath, body);
        spriteBodies.set(relativePath, body);
      }
    }
    const sourcePath = join(fixtureRoot, asset.editableSource);
    mkdirSync(dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, syntheticAsepriteSource(spriteClass.canvasWidth, spriteClass.canvasHeight));
  }

  const runtimeIndexPath = join(fixtureRoot, 'assets', 'commissioned', 'index.json');
  const runtimeIndex = writeRuntimeIndex(manifest, runtimeIndexPath, { marsRoot: fixtureRoot });
  const reports = writeApprovalReports(manifest, join(fixtureRoot, 'art', 'reports'), {
    marsRoot: fixtureRoot,
    runtimeIndexPath,
  });
  assert.equal(reports['artist-test'].machineReady, true, 'synthetic fixture reaches the real paid-test machine gate');
  assert.equal(reports.full.machineReady, scope === 'full', 'only the explicit full synthetic fixture reaches the golden machine gate');

  await page.route('**/mars/assets/commissioned/index.json', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(runtimeIndex),
  }));
  await page.route('**/mars/art/reports/artist-test-approval.json', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(reports['artist-test']),
  }));
  await page.route('**/mars/art/reports/golden-approval.json', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(reports.full),
  }));
  await page.route('**/mars/assets/commissioned/sprites/**', (route) => {
    const marker = '/mars/assets/commissioned/';
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const relativePath = pathname.split(marker)[1] || '';
    if (withheldSprites.has(relativePath)) {
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'synthetic missing commissioned frame' });
    }
    const body = spriteBodies.get(relativePath);
    return body
      ? route.fulfill({ status: 200, contentType: 'image/png', body })
      : route.abort('failed');
  });

  return {
    manifest,
    reports,
    runtimeIndex,
    tamperSprite(relativePath) {
      const body = spriteBodies.get(relativePath);
      assert.ok(body, `synthetic sprite ${relativePath} exists before tampering`);
      spriteBodies.set(relativePath, Buffer.concat([body, Buffer.from([0])]));
    },
    withholdSprite(relativePath) {
      assert.ok(spriteBodies.has(relativePath), `synthetic sprite ${relativePath} exists before withholding`);
      withheldSprites.add(relativePath);
    },
    cleanup: () => {
      rmSync(fixtureRoot, { recursive: true, force: true });
      temporaryFixtureRoots.delete(fixtureRoot);
    },
  };
}

async function closeSyntheticFixture(context, fixture) {
  try {
    await context.close();
  } finally {
    fixture?.cleanup();
  }
}

function cleanupRemainingSyntheticFixtures() {
  let firstError = null;
  for (const fixtureRoot of [...temporaryFixtureRoots]) {
    try {
      rmSync(fixtureRoot, { recursive: true, force: true });
    } catch (error) {
      firstError ||= error;
    } finally {
      temporaryFixtureRoots.delete(fixtureRoot);
    }
  }
  if (firstError) throw firstError;
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

    const pixelBoard = await page.locator('#isoBoard').evaluate((board) => ({
      mode: board.dataset.renderMode,
      sprites: Number(board.dataset.spritesDrawn),
      bitmaps: Number(board.dataset.spriteBitmaps),
    }));
    assert.equal(pixelBoard.mode, 'pixel', 'pixel art is the default renderer');
    assert.equal(
      pixelBoard.bitmaps,
      spriteIds().length,
      'all registered sprites are cached as ImageBitmap assets',
    );
    assert.ok(pixelBoard.sprites > 0, 'supported board entities render through drawSprite');
    record('MarsScape board renders cached ImageBitmap sprites');

    await page.click('#pixelModeButton');
    const proceduralBoard = await page.locator('#isoBoard').evaluate((board) => ({
      mode: board.dataset.renderMode,
      sprites: Number(board.dataset.spritesDrawn),
      procedural: Number(board.dataset.proceduralDrawn),
    }));
    assert.equal(proceduralBoard.mode, 'procedural', 'the toggle switches renderers');
    assert.equal(proceduralBoard.sprites, 0, 'pixel sprites leave the board when disabled');
    assert.ok(proceduralBoard.procedural > 0, 'procedural fallback renders the board entities');
    await page.click('#pixelModeButton');
    assert.equal(await page.locator('#pixelModeButton').getAttribute('aria-pressed'), 'true');
    record('MarsScape pixel toggle preserves the procedural fallback');

    assert.ok(await page.locator('.charge-track').count() > 0, 'MS-102 charge bars render');
    record('MS-102 node depletion bars render');

    const tooltip = await page.locator('.skill-row--expandable').first().getAttribute('title');
    assert.match(tooltip, /XP:/, 'MS-103 tooltip carries current XP');
    assert.match(tooltip, /Next: level/, 'MS-103 tooltip carries the next-level target');
    await page.locator('.skill-row--expandable').first().click();
    assert.equal(await page.locator('.skill-detail').first().isVisible(), true, 'MS-103 tap expands the detail');
    record('MS-103 skill tooltips and tap-expand work');

    await page.click('[data-tab="pack"]');
    assert.ok(await page.locator('.inventory-grid .pspr').count() > 0, 'the production inventory renders the sprite registry');
    record('MarsScape sprites are integrated into the production pack UI');

    const cleanedCommands = await page.evaluate(() => window.__marsTest.cleanPendingCommands([
      { id: 'plant-1', type: 'plant', plotIndex: 2, cropId: 'soy', useFertilizer: true, ignored: 'drop-me' },
      { id: 'deposit-1', type: 'deposit', itemId: 'iron_ore', qty: 7 },
      { id: 'clock-1', type: 'overclock', on: false },
    ]));
    assert.deepEqual(cleanedCommands, [
      { id: 'plant-1', type: 'plant', plotIndex: 2, cropId: 'soy', useFertilizer: true },
      { id: 'deposit-1', type: 'deposit', itemId: 'iron_ore', qty: 7 },
      { id: 'clock-1', type: 'overclock', on: false },
    ], 'offline commands retain every command-specific payload field');
    record('offline queue persistence retains command payloads');

    await page.evaluate(async () => {
      const { createState } = await import('/mars/engine.mjs');
      const next = createState(Date.now());
      next.postgame = true;
      next.built.depot = true;
      next.drones = [{ nodeId: null, t: 0 }];
      next.extraNodes = [{
        id: 'rich-vein-1', name: 'Rich Vein 1', item: 'titanium_ore',
        xp: 120, hard: 6, lvl: 25, yieldBase: 2, x: 2, y: 1,
      }];
      window.__marsTest.setState(next);
    });
    assert.equal(await page.locator('[data-command="gather"][data-id="expedition-beacon"]').count(), 1, 'postgame beacon renders on the map');
    assert.equal(await page.locator('[data-command="gather"][data-id="rich-vein-1"]').count(), 1, 'discovered rich vein renders on the map');
    await page.click('[data-tab="depot"]');
    assert.equal(await page.locator('[data-action="deployDrone"][data-id="expedition-beacon"]').count(), 1, 'postgame beacon is a drone target');
    assert.equal(await page.locator('[data-action="deployDrone"][data-id="rich-vein-1"]').count(), 1, 'discovered rich vein is a drone target');
    record('dynamic postgame nodes render on the map and in drone targeting');

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

    const legacySessionId = '44444444-4444-4444-8444-444444444444';
    await page.evaluate(async (legacyId) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('marsscape-secure-v1', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const key = await new Promise((resolve, reject) => {
        const request = db.transaction('keys', 'readonly').objectStore('keys').get('local-envelope-hmac');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      const state = {
        version: 3,
        seq: 17,
        inventory: { iron_ore: 9 },
        farm: { plantedAt: Date.now() - 45_000, ready: false },
      };
      const pendingCommands = [{ id: 'legacy-gather', type: 'gather', nodeId: 'iron-north' }];
      const payload = JSON.stringify({ sessionId: legacyId, mode: 'offline', signature: '', state, pendingCommands });
      const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
      let binary = '';
      for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte);
      const localHmac = btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
      localStorage.setItem('marsscape.sessionId.v3', legacyId);
      localStorage.setItem('marsscape.session.v3', JSON.stringify({
        sessionId: legacyId, mode: 'offline', signature: '', state, pendingCommands,
        hmacVersion: 1, localHmac,
      }));
      localStorage.setItem('marsscape.sessionId.v4', '55555555-5555-4555-8555-555555555555');
      localStorage.removeItem('marsscape.session.v4');
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function blockOldPageSave(key, value) {
        if (key === 'marsscape.session.v4' || key === 'marsscape.sessionId.v4') return;
        return setItem.call(this, key, value);
      };
    }, legacySessionId);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => localStorage.getItem('marsscape.session.v4'));
    const migrated = await page.evaluate(() => ({
      sessionId: localStorage.getItem('marsscape.sessionId.v4'),
      envelope: JSON.parse(localStorage.getItem('marsscape.session.v4')),
    }));
    assert.equal(migrated.sessionId, legacySessionId, 'v3 authority identity replaces an orphaned v4 id');
    assert.equal(migrated.envelope.state.version, 4, 'v3 state is rewritten as a v4 envelope');
    assert.equal(migrated.envelope.state.seq, 17, 'v3 progression survives migration');
    assert.equal(migrated.envelope.state.inventory.iron_ore, 9, 'v3 resources survive migration');
    assert.equal(migrated.envelope.state.farm.plots[0].crop, 'potato', 'v3 greenhouse progress survives migration');
    assert.equal(migrated.envelope.pendingCommands[0].nodeId, 'iron-north', 'v3 queued commands survive migration');
    record('signed v3 session and save envelopes migrate without resetting progression');
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

  // ------------------------------------------------------- /mars/art-spec.html
  {
    const { context, page, failures } = await open('/mars/art-spec.html');
    assert.deepEqual(failures, [], '/mars/art-spec.html must load without page or same-origin request errors');
    const registeredSpriteCount = spriteIds().length;
    await page.waitForFunction(
      (expected) => Number(document.documentElement.dataset.spriteBitmaps) === expected,
      registeredSpriteCount,
    );
    const contract = await page.evaluate(() => JSON.parse(window.render_spec_to_text()));
    assert.equal(contract.projection, '2:1 dimetric');
    assert.deepEqual(contract.logicalTile, [84, 42]);
    assert.deepEqual(contract.drawnTile, [66, 34]);
    assert.equal(contract.spriteBitmaps, registeredSpriteCount);
    record('MarsScape render-contract page proves geometry and bitmap cache');
    await context.close();
  }

  // --------------------------------------------------- /mars/golden-scene.html
  {
    const { context, page, failures } = await open('/mars/golden-scene.html');
    await page.waitForFunction(() => typeof window.render_golden_scene_to_text === 'function');
    assert.deepEqual(failures, [], '/mars/golden-scene.html must load without page or same-origin request errors');
    const review = await page.evaluate(() => JSON.parse(window.render_golden_scene_to_text()));
    assert.equal(review.contract.version, 3);
    assert.equal(review.contract.decision, 'DEC-79');
    assert.equal(await page.locator('[data-beat-index]').count(), 8);
    assert.equal(review.view.zoom, 1);
    assert.equal(review.approval.reviewSurface.status, 'valid');
    assert.match(review.approval.reviewSurface.hash, /^[a-f0-9]{64}$/);
    assert.deepEqual(
      review.approval.reviewSurface.resources.map((resource) => resource.path),
      [
        'golden-scene.html',
        'golden-scene.css',
        'golden-scene.js',
        'art/golden-scene.json',
        'art/golden-slice.json',
        'render-contract.mjs',
        'commissioned-art.mjs',
        'sprite-canvas.mjs',
        'sprites.mjs',
        '../src/kit/nav.js',
      ],
      'review-surface digest covers the exact deployed renderer resources',
    );
    assert.equal(review.approval.status, 'blocked');
    assert.equal(await page.locator('#recordApproval').isDisabled(), true, 'machine evidence cannot self-approve the golden scene');
    assert.equal(await page.locator('#reviewChecklist input[name="reviewCriterion"]:disabled').count(), 7, 'human checks stay disabled without a valid commissioned context');
    assert.deepEqual(
      await page.locator('#approvalBlockerList li').allTextContents(),
      review.approval.reasons,
      'every approval blocker is exposed in stable semantic markup',
    );
    const idleLiveRegionMutations = await page.evaluate(async () => {
      const ids = ['sceneStatus', 'reviewContextStatus', 'approvalEvidenceStatus', 'approvalGateStatus', 'approvalReceiptStatus', 'warningTelemetry'];
      const counts = Object.fromEntries(ids.map((id) => [id, 0]));
      const observers = ids.map((id) => {
        const observer = new MutationObserver((records) => { counts[id] += records.length; });
        observer.observe(document.getElementById(id), { childList: true, characterData: true, subtree: true });
        return observer;
      });
      await new Promise((resolve) => setTimeout(resolve, 600));
      for (const observer of observers) observer.disconnect();
      return counts;
    });
    assert.deepEqual(
      idleLiveRegionMutations,
      {
        sceneStatus: 0,
        reviewContextStatus: 0,
        approvalEvidenceStatus: 0,
        approvalGateStatus: 0,
        approvalReceiptStatus: 0,
        warningTelemetry: 0,
      },
      'idle animation frames do not churn live regions',
    );
    await page.locator('#reviewAnchors').evaluate((input) => {
      input.disabled = false;
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const staleCheck = await page.evaluate(() => JSON.parse(window.render_golden_scene_to_text()));
    assert.deepEqual(staleCheck.approval.humanChecks.completed, [], 'an out-of-context programmatic check cannot qualify');
    assert.equal(await page.locator('#reviewAnchors').isDisabled(), true, 'the invalidated check returns to fail-closed');
    await page.evaluate(() => window.__goldenScene.setScope('artist-test'));
    assert.equal(await page.locator('#sequencePanel').isHidden(), true, 'artist-test scope hides golden-sequence navigation');
    assert.equal(await page.locator('#playbackBar').isHidden(), true, 'artist-test scope hides sequence playback');
    assert.match(await page.locator('#goldenCanvas').getAttribute('aria-label'), /paid artist test matrix/i);
    assert.match(await page.locator('#recordApproval').textContent(), /paid artist test/i);
    const bodyOrder = await page.evaluate(() => [...document.body.children].map((element) => element.classList.contains('mixnav') ? 'mixnav' : element.classList.contains('skip-link') ? 'skip-link' : element.tagName.toLowerCase()));
    assert.deepEqual(bodyOrder.slice(0, 3), ['skip-link', 'mixnav', 'header'], 'visual navigation and DOM focus order agree');
    await page.locator('.skip-link').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.closest('.mixnav') !== null), true, 'Tab moves from the skip link into the visible shared navigation');
    await page.evaluate(() => window.__goldenScene.setRenderMode('procedural'));
    const fallback = await page.evaluate(() => JSON.parse(window.render_golden_scene_to_text()));
    assert.ok(fallback.telemetry.frameSources.procedural > 0, 'forced procedural mode draws a safe fallback scene');
    record('MarsScape golden scene is renderer-backed and approval fails closed');
    await context.close();
  }

  // ------------------------------- review-surface hashing unavailable path
  // A digest resource outage must block approval without taking down the
  // renderer or its procedural fallback.
  {
    const context = await browser.newContext(desktop);
    const page = await context.newPage();
    try {
      await page.route('**/mars/golden-scene.css', (route) => (
        route.request().resourceType() === 'fetch'
          ? route.fulfill({ status: 503, contentType: 'text/plain', body: 'synthetic review-surface outage' })
          : route.continue()
      ));
      await page.goto(`${origin}/mars/golden-scene.html?synthetic-review-surface-outage=1`, { waitUntil: 'load' });
      await page.waitForFunction(() => JSON.parse(window.render_golden_scene_to_text()).ready === true);
      const unavailable = await page.evaluate(() => JSON.parse(window.render_golden_scene_to_text()));
      assert.equal(unavailable.error, null, 'review-surface hashing outage is not a renderer-fatal error');
      assert.equal(unavailable.approval.reviewSurface.status, 'unavailable');
      assert.equal(unavailable.approval.reviewSurface.hash, null);
      assert.match(unavailable.approval.reviewSurface.reasons[0], /golden-scene\.css returned HTTP 503/);
      assert.equal(unavailable.approval.canRecord, false);
      assert.ok(unavailable.approval.reasons.some((reason) => /Review-surface integrity is unavailable/.test(reason)));
      assert.ok(unavailable.telemetry.frameSources.requested > 0, 'scene rendering continues while approval is blocked');
      assert.ok(unavailable.entities.length > 0, 'renderer still describes the visible scene');
      assert.equal(await page.locator('#recordApproval').isDisabled(), true);
      record('MarsScape retains rendering and blocks approval when review-surface hashing is unavailable');
    } finally {
      await context.close();
    }
  }

  // --------------------------- commissioned PNG byte-integrity mismatch path
  // The report and index remain internally valid, but one served Blob differs
  // from its immutable v2 frame digest. It must never enter ImageBitmap cache
  // or contribute commissioned review evidence.
  {
    const context = await browser.newContext(desktop);
    const page = await context.newPage();
    let fixture;
    try {
      fixture = await installSyntheticApprovalFixture(page, 'artist-test');
      fixture.tamperSprite(assetPath('terrain', 'base_soil', 'active', 1));
      const failures = trackPageFailures(page, origin, { ignore: IGNORED_REQUESTS });
      await page.goto(`${origin}/mars/golden-scene.html?synthetic-integrity-mismatch=1`, { waitUntil: 'load' });
      await page.waitForFunction(() => JSON.parse(window.render_golden_scene_to_text()).ready === true);
      await page.evaluate(() => window.__goldenScene.setScope('artist-test'));
      await page.waitForFunction(() => window.__goldenScene.getTelemetry().cache.integrityFailures > 0);

      const mismatch = await page.evaluate(() => JSON.parse(window.render_golden_scene_to_text()));
      assert.equal(mismatch.approval.evidence.valid, true, 'strict reports stay valid independently of served-byte verification');
      assert.equal(mismatch.telemetry.cache.integrityFailures, 1, 'a repeated bad frame emits one deduplicated integrity failure');
      assert.ok(mismatch.telemetry.frameSources.commissioned < mismatch.telemetry.frameSources.requested, 'digest-mismatched bytes never count as commissioned');
      assert.ok(mismatch.telemetry.frameSources.legacy + mismatch.telemetry.frameSources.procedural > 0, 'digest mismatch renders through a safe fallback');
      assert.equal(mismatch.approval.canRecord, false);
      assert.equal(await page.locator('#recordApproval').isDisabled(), true);
      assert.equal(await page.evaluate(() => window.__goldenScene.getApprovalReceipt()), null);
      assert.equal(
        mismatch.telemetry.warnings.filter((warning) => warning.code === 'COMMISSIONED_FRAME_INTEGRITY_MISMATCH').length,
        1,
        'runtime warning identifies the exact byte-integrity failure once',
      );
      assert.deepEqual(failures, [], 'integrity mismatch falls back without browser or request failures');
      record('MarsScape rejects commissioned PNG bytes that do not match runtime index v2');
    } finally {
      await closeSyntheticFixture(context, fixture);
    }
  }

  // ----------------------- incomplete scoped commissioned-frame cache path
  // Frame 01 remains visible and valid, but another indexed animation frame
  // is unavailable. Approval must judge the complete scoped package rather
  // than granting coverage from only the frame currently on canvas.
  {
    const context = await browser.newContext(desktop);
    const page = await context.newPage();
    let fixture;
    try {
      fixture = await installSyntheticApprovalFixture(page, 'artist-test');
      const missingFrame = assetPath('actor', 'astronaut', 'active', 4);
      fixture.withholdSprite(missingFrame);
      const missingFrameRequest = /\/mars\/assets\/commissioned\/sprites\/actor\/astronaut__active__f04\.png$/;
      const failures = trackPageFailures(page, origin, { ignore: [...IGNORED_REQUESTS, missingFrameRequest] });
      await page.goto(`${origin}/mars/golden-scene.html?synthetic-missing-noncurrent-frame=1`, { waitUntil: 'load' });
      await page.waitForFunction(() => JSON.parse(window.render_golden_scene_to_text()).ready === true);
      await page.evaluate(() => {
        window.__goldenScene.setScope('artist-test');
        window.advanceTime(0);
      });

      const frameOne = await page.evaluate(() => JSON.parse(window.render_golden_scene_to_text()));
      assert.equal(frameOne.approval.evidence.valid, true, 'strict generated evidence remains valid independently of the served 404');
      assert.deepEqual(frameOne.approval.packageQuality, {
        requiredFrames: 8,
        indexedFrames: 8,
        cachedFrames: 7,
        pendingFrames: 0,
        failedFrames: 1,
        missingFrames: 1,
        complete: false,
      });
      assert.equal(frameOne.telemetry.frameSources.commissioned, frameOne.telemetry.frameSources.requested, 'visible frame 01 still uses commissioned art');
      assert.equal(frameOne.telemetry.frameSources.legacy, 0);
      assert.equal(frameOne.telemetry.frameSources.procedural, 0);
      assert.equal(frameOne.approval.coverage.conditions.commissionedMatrixAt1x.completed, false, 'a visible commissioned frame cannot earn matrix credit for an incomplete scoped cache');
      assert.equal(frameOne.approval.coverage.conditions.functionalAnimationAt1x.completedMs, 0);
      assert.equal(frameOne.approval.performance.samples, 0, 'an incomplete scoped cache earns no performance samples');
      assert.equal(frameOne.approval.canRecord, false);
      assert.ok(frameOne.approval.reasons.some((reason) => /Commissioned package cache is incomplete: 7\/8 scoped frames cached; 1 failed \(1 missing\), 0 pending/.test(reason)));
      assert.equal(frameOne.telemetry.cache.failedFrames, 1);
      assert.equal(frameOne.telemetry.cache.missingFrames, 1);
      assert.equal(await page.locator('#reviewChecklist input[type="checkbox"]:disabled').count(), 7);
      await page.locator('#recordApproval').evaluate((button) => button.click());
      assert.equal(await page.evaluate(() => window.__goldenScene.getApprovalReceipt()), null, 'incomplete scoped cache cannot create a receipt');

      await page.evaluate(() => window.advanceTime(450));
      const missingVisible = await page.evaluate(() => JSON.parse(window.render_golden_scene_to_text()));
      assert.ok(missingVisible.telemetry.frameSources.commissioned < missingVisible.telemetry.frameSources.requested, 'the missing frame does not count as commissioned when its animation time is visible');
      assert.ok(missingVisible.telemetry.frameSources.legacy + missingVisible.telemetry.frameSources.procedural > 0, 'the missing frame retains safe renderer fallback');
      assert.ok(missingVisible.entities.length > 0, 'the scene remains renderable after the missing frame becomes current');
      assert.equal(missingVisible.approval.packageQuality.complete, false);
      assert.deepEqual(failures, [], 'the deliberate, quarantined 404 causes no unrelated browser failures');
      record('MarsScape blocks all approval credit when any scoped indexed frame is unavailable');
    } finally {
      await closeSyntheticFixture(context, fixture);
    }
  }

  // ---------------------- runtime index ordered-metadata identity mismatch
  // Renderer metadata is part of the immutable v2 identity. Retaining the old
  // declared hashes after changing any render-affecting field must discard the
  // commissioned index before a frame can earn approval credit.
  {
    const context = await browser.newContext(desktop);
    const page = await context.newPage();
    let fixture;
    try {
      fixture = await installSyntheticApprovalFixture(page, 'artist-test');
      const asset = fixture.runtimeIndex.assets[0];
      const firstState = Object.values(asset.states)[0];
      asset.screenOffset.x += 1;
      firstState.frameMs = firstState.frameMs === 150 ? 200 : 150;
      firstState.loop = !firstState.loop;
      const failures = trackPageFailures(page, origin, { ignore: IGNORED_REQUESTS });
      await page.goto(`${origin}/mars/golden-scene.html?synthetic-runtime-index-drift=1`, { waitUntil: 'load' });
      await page.waitForFunction(() => JSON.parse(window.render_golden_scene_to_text()).ready === true);
      await page.evaluate(() => window.__goldenScene.setScope('artist-test'));

      const drifted = await page.evaluate(() => JSON.parse(window.render_golden_scene_to_text()));
      assert.equal(drifted.telemetry.cache.indexIdentityVerified, false);
      assert.equal(drifted.telemetry.cache.indexedAssets, 0, 'mismatched ordered metadata is not retained as a commissioned index');
      assert.equal(drifted.telemetry.frameSources.commissioned, 0, 'mismatched index metadata earns no commissioned frame credit');
      assert.ok(drifted.telemetry.frameSources.legacy + drifted.telemetry.frameSources.procedural > 0, 'renderer remains available through safe fallbacks');
      assert.equal(drifted.approval.canRecord, false);
      assert.equal(await page.locator('#recordApproval').isDisabled(), true);
      assert.ok(drifted.approval.reasons.some((reason) => /Runtime index has no manifest hash/.test(reason)), 'approval exposes the discarded runtime index as a blocker');
      assert.deepEqual(failures, [], 'runtime-index identity rejection preserves a clean fallback browser path');
      record('MarsScape independently rejects stale runtime hashes after screen offset, timing, and loop drift');
    } finally {
      await closeSyntheticFixture(context, fixture);
    }
  }

  let syntheticArtistReceiptStorage = null;

  // ----------------------------------------- synthetic paid-test ready path
  // This fixture proves the approval state machine, browser bitmap path, and
  // receipt persistence only. Its generated PNGs and synthetic native sources
  // are temporary test inputs and are never evidence of paid-art completion.
  {
    const context = await browser.newContext(desktop);
    const page = await context.newPage();
    let fixture;
    try {
      fixture = await installSyntheticApprovalFixture(page, 'artist-test');
      const failures = trackPageFailures(page, origin, { ignore: IGNORED_REQUESTS });
      await page.goto(`${origin}/mars/golden-scene.html?synthetic-artist-approval=1`, { waitUntil: 'load' });
      await page.waitForFunction(() => JSON.parse(window.render_golden_scene_to_text()).ready === true);
      await page.evaluate(() => window.__goldenScene.setScope('artist-test'));
      await page.waitForFunction(() => {
        const state = JSON.parse(window.render_golden_scene_to_text());
        return state.view.scope === 'artist-test'
          && state.approval.evidence.valid === true
          && state.telemetry.frameSources.commissioned > 0;
      });

      const initial = await page.evaluate(() => JSON.parse(window.render_golden_scene_to_text()));
      assert.deepEqual(initial.approval.requirements, {
        assets: 4,
        readyAssets: 4,
        requiredExports: 8,
        indexedExports: 8,
      });
      assert.equal(initial.telemetry.frameSources.commissioned, initial.telemetry.frameSources.requested, 'synthetic fixture uses the production commissioned bitmap path');
      assert.equal(initial.telemetry.frameSources.legacy, 0);
      assert.equal(initial.telemetry.frameSources.procedural, 0);
      assert.equal(initial.approval.reviewSurface.status, 'valid');
      assert.match(initial.approval.reviewSurface.hash, /^[a-f0-9]{64}$/);
      assert.equal(await page.locator('#reviewChecklist input[name="reviewCriterion"]:enabled').count(), 7, 'valid commissioned evidence enables all human checks');

      await page.evaluate(() => {
        for (let frame = 0; frame < 320; frame += 1) window.advanceTime(1000 / 60);
      });
      const qualified = await page.evaluate(() => window.__goldenScene.getApprovalStatus());
      assert.equal(qualified.coverage.contract, 'artist-test-review-conditions/v2');
      assert.equal(qualified.coverage.packageContext.packageHash, fixture.reports['artist-test'].artifactDigests.packageHash);
      assert.equal(qualified.coverage.packageContext.reviewSurfaceHash, initial.approval.reviewSurface.hash);
      assert.equal(qualified.coverage.conditions.commissionedMatrixAt1x.completed, true);
      assert.equal(qualified.coverage.conditions.functionalAnimationAt1x.completed, true);
      assert.ok(qualified.coverage.conditions.functionalAnimationAt1x.completedMs >= 600);
      assert.equal(qualified.coverage.complete, true);
      assert.equal(qualified.performance.samples, 300);
      assert.equal(qualified.performance.pass, true);

      await page.locator('#reviewAnchors').evaluate((input) => { input.value = 'tampered'; });
      await page.evaluate(() => window.__goldenScene.setMode('commissioned'));
      const domTampered = await page.evaluate(() => window.__goldenScene.getApprovalStatus());
      assert.equal(domTampered.canRecord, false, 'tampered checklist DOM blocks approval recording');
      assert.ok(domTampered.reasons.some((reason) => /seven canonical DEC-79 human-check IDs/.test(reason)));
      assert.equal(await page.locator('#reviewChecklist input[type="checkbox"]:disabled').count(), 7);
      await page.locator('#recordApproval').evaluate((button) => button.click());
      assert.equal(await page.evaluate(() => window.__goldenScene.getApprovalReceipt()), null);
      await page.locator('#reviewAnchors').evaluate((input) => { input.value = 'anchors'; });
      await page.evaluate(() => window.__goldenScene.setMode('auto'));
      assert.equal(await page.locator('#reviewChecklist input[name="reviewCriterion"]:enabled').count(), 7, 'restoring the exact immutable DOM contract re-enables review');

      for (const checkbox of await page.locator('#reviewChecklist input[name="reviewCriterion"]').all()) {
        await checkbox.check();
      }
      assert.equal((await page.evaluate(() => window.__goldenScene.getApprovalStatus())).canRecord, true);
      assert.equal(await page.locator('#recordApproval').isEnabled(), true);

      await page.evaluate(() => window.__goldenScene.setZoom(0.5));
      const invalidated = await page.evaluate(() => window.__goldenScene.getApprovalStatus());
      assert.deepEqual(invalidated.humanChecks.completed, [], 'changing review context invalidates prior attestations');
      assert.equal(await page.locator('#reviewChecklist input[name="reviewCriterion"]:disabled').count(), 7);
      assert.equal(await page.locator('#reviewChecklist input[name="reviewCriterion"]:checked').count(), 0);
      assert.equal(await page.locator('#recordApproval').isDisabled(), true);

      await page.evaluate(() => window.__goldenScene.setZoom(1));
      assert.equal(await page.locator('#reviewChecklist input[name="reviewCriterion"]:enabled').count(), 7);
      assert.equal((await page.evaluate(() => window.__goldenScene.getApprovalStatus())).humanChecks.completed.length, 0, 'returning to 1.0x does not restore stale attestations');
      for (const checkbox of await page.locator('#reviewChecklist input[name="reviewCriterion"]').all()) {
        await checkbox.check();
      }
      await page.locator('#recordApproval').click();
      await page.waitForFunction(() => window.__goldenScene.getApprovalReceipt() !== null);

      const receipt = await page.evaluate(() => window.__goldenScene.getApprovalReceipt());
      assert.equal(receipt.schema, 'marsscape-art-approval-receipt/v3');
      assert.equal(receipt.scope, 'artist-test');
      assert.equal(receipt.manifestHash, fixture.runtimeIndex.manifestHash);
      assert.equal(receipt.packageHash, fixture.reports['artist-test'].artifactDigests.packageHash);
      assert.equal(receipt.runtimeAssetHash, fixture.reports['artist-test'].artifactDigests.runtimeAssetHash);
      assert.equal(receipt.reviewSurfaceHash, initial.approval.reviewSurface.hash);
      assert.equal(receipt.rendererReview.reviewSurface.hash, receipt.reviewSurfaceHash);
      assert.equal(receipt.rendererReview.conditionLedger.packageContext.reviewSurfaceHash, receipt.reviewSurfaceHash);
      assert.equal(receipt.rendererReview.conditionLedger.complete, true);
      assert.equal(receipt.rendererReview.performance.pass, true);
      assert.equal(receipt.humanReview.attested, true);
      assert.equal(receipt.humanReview.checks.length, 7);
      assert.equal(receipt.approval.authentication, 'external-git-review-required');
      assert.equal(receipt.integrityDigest.algorithm, 'SHA-256');
      assert.equal(receipt.integrityDigest.purpose, 'client-integrity-only-not-authentication');
      assert.equal(receipt.integrityDigest.authenticated, false);
      assert.match(receipt.integrityDigest.value, /^[a-f0-9]{64}$/);
      const stored = await page.evaluate(() => Object.entries(localStorage)
        .filter(([key]) => key.startsWith('marsscape.dec79.approval.v3:artist-test:'))
        .map(([key, value]) => ({ key, value, receipt: JSON.parse(value) })));
      assert.equal(stored.length, 1);
      assert.equal(stored[0].receipt.receiptId, receipt.receiptId);
      assert.ok(stored[0].key.endsWith(`:${receipt.reviewSurfaceHash}`), 'storage identity includes the review-surface digest');
      syntheticArtistReceiptStorage = { key: stored[0].key, value: stored[0].value };
      assert.equal(await page.locator('#downloadApprovalReceipt').isVisible(), true);
      assert.match(await page.locator('#downloadApprovalReceipt').getAttribute('href'), /^blob:/);

      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => JSON.parse(window.render_golden_scene_to_text()).ready === true);
      await page.evaluate(() => window.__goldenScene.setScope('artist-test'));
      await page.waitForFunction((receiptId) => window.__goldenScene.getApprovalReceipt()?.receiptId === receiptId, receipt.receiptId);
      const restored = await page.evaluate(() => window.__goldenScene.getApprovalReceipt());
      assert.equal(restored.receiptId, receipt.receiptId, 'integrity-bound receipt survives a same-package, same-surface reload');
      assert.equal(restored.integrityDigest.value, receipt.integrityDigest.value);
      assert.equal(await page.locator('#downloadApprovalReceipt').isVisible(), true, 'receipt download is restored after verification');

      await page.route('**/src/kit/nav.js', async (route) => {
        const response = await route.fetch();
        const body = await response.body();
        await route.fulfill({
          response,
          body: Buffer.concat([body, Buffer.from('\n/* synthetic nav review-surface drift */\n')]),
        });
      });
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => JSON.parse(window.render_golden_scene_to_text()).ready === true);
      await page.evaluate(() => window.__goldenScene.setScope('artist-test'));
      const drifted = await page.evaluate(() => JSON.parse(window.render_golden_scene_to_text()));
      assert.equal(drifted.approval.reviewSurface.status, 'valid');
      assert.notEqual(drifted.approval.reviewSurface.hash, receipt.reviewSurfaceHash, 'executed navigation dependency drift changes review-surface identity');
      assert.equal(await page.evaluate(() => window.__goldenScene.getApprovalReceipt()), null, 'renderer drift invalidates the stored receipt');
      assert.equal(drifted.approval.coverage.complete, false, 'renderer drift starts a fresh condition ledger');
      assert.equal(drifted.approval.coverage.packageContext.reviewSurfaceHash, drifted.approval.reviewSurface.hash);

      await page.unroute('**/src/kit/nav.js');
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => JSON.parse(window.render_golden_scene_to_text()).ready === true);
      await page.evaluate(() => window.__goldenScene.setScope('artist-test'));
      await page.waitForFunction((receiptId) => window.__goldenScene.getApprovalReceipt()?.receiptId === receiptId, receipt.receiptId);
      await page.route('**/mars/art/golden-slice.json', async (route) => {
        const response = await route.fetch();
        const manifest = JSON.parse((await response.body()).toString('utf8'));
        manifest.assets[0].editableSource = 'art/sources/terrain/stale_manifest_bypass.aseprite';
        await route.fulfill({ response, body: JSON.stringify(manifest) });
      });
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => JSON.parse(window.render_golden_scene_to_text()).ready === true);
      await page.evaluate(() => window.__goldenScene.setScope('artist-test'));
      const manifestDrifted = await page.evaluate(() => JSON.parse(window.render_golden_scene_to_text()));
      assert.equal(manifestDrifted.telemetry.cache.indexIdentityVerified, false, 'stale index manifest identity is discarded');
      assert.equal(manifestDrifted.telemetry.frameSources.commissioned, 0, 'stale manifest metadata earns no commissioned credit');
      assert.ok(manifestDrifted.telemetry.frameSources.legacy + manifestDrifted.telemetry.frameSources.procedural > 0, 'manifest drift retains fallback rendering');
      assert.equal(manifestDrifted.approval.canRecord, false);
      assert.equal(await page.evaluate(() => window.__goldenScene.getApprovalReceipt()), null, 'manifest metadata drift invalidates the stored receipt');
      assert.ok(manifestDrifted.approval.reasons.some((reason) => /Runtime index has no manifest hash/.test(reason)), 'approval exposes the discarded stale-manifest index as a blocker');
      assert.deepEqual(failures, [], 'synthetic positive approval path loads without browser or same-origin request failures');
      record('MarsScape paid-test approval binds checklist, package, manifest, and every executed review-surface dependency');
    } finally {
      await closeSyntheticFixture(context, fixture);
    }
  }

  // ---------------------------- stored receipt + checklist DOM tamper path
  // Seed the valid receipt from the prior context, pause the module until the
  // parsed checklist is altered, then prove reload verification fails closed.
  {
    assert.ok(syntheticArtistReceiptStorage, 'paid-test rail captured a v3 receipt for stored-verification proof');
    const context = await browser.newContext(desktop);
    await context.addInitScript(({ expectedOrigin, key, value }) => {
      if (location.origin === expectedOrigin) localStorage.setItem(key, value);
    }, { expectedOrigin: origin, ...syntheticArtistReceiptStorage });
    const page = await context.newPage();
    let fixture;
    let releaseModule = () => {};
    try {
      fixture = await installSyntheticApprovalFixture(page, 'artist-test');
      let modulePaused = false;
      await page.route('**/mars/golden-scene.js', async (route) => {
        if (!modulePaused && route.request().resourceType() === 'script') {
          modulePaused = true;
          await new Promise((resolve) => { releaseModule = resolve; });
        }
        await route.continue();
      });
      const navigation = page.goto(`${origin}/mars/golden-scene.html?synthetic-stored-dom-tamper=1`, { waitUntil: 'load' });
      await page.locator('#reviewAnchors').waitFor({ state: 'attached' });
      await page.locator('#reviewAnchors').evaluate((input) => { input.value = 'tampered'; });
      releaseModule();
      await navigation;
      await page.waitForFunction(() => JSON.parse(window.render_golden_scene_to_text()).ready === true);
      await page.evaluate(() => window.__goldenScene.setScope('artist-test'));

      const rejected = await page.evaluate(() => JSON.parse(window.render_golden_scene_to_text()));
      assert.equal(await page.evaluate(() => window.__goldenScene.getApprovalReceipt()), null, 'stored receipt is rejected when deployed checklist DOM is altered');
      assert.equal(rejected.approval.canRecord, false);
      assert.ok(rejected.approval.reasons.some((reason) => /seven canonical DEC-79 human-check IDs/.test(reason)));
      assert.ok(rejected.telemetry.warnings.some((warning) => warning.code === 'APPROVAL_RECEIPT_INVALID'));
      assert.equal(await page.locator('#reviewChecklist input[type="checkbox"]:disabled').count(), 7);
      record('MarsScape rejects stored receipts when canonical human-check DOM is tampered');
    } finally {
      releaseModule();
      await closeSyntheticFixture(context, fixture);
    }
  }

  // -------------------------------------- synthetic full-golden ledger path
  // Like the paid-test fixture above, this is temporary state-machine proof.
  // It must never be treated as commissioned art or human approval evidence.
  {
    const context = await browser.newContext(desktop);
    const page = await context.newPage();
    let fixture;
    try {
      fixture = await installSyntheticApprovalFixture(page, 'full');
      const failures = trackPageFailures(page, origin, { ignore: IGNORED_REQUESTS });
      await page.goto(`${origin}/mars/golden-scene.html?synthetic-golden-approval=1`, { waitUntil: 'load' });
      await page.waitForFunction(() => {
        const state = JSON.parse(window.render_golden_scene_to_text());
        return state.ready === true
          && state.approval.evidence.valid === true
          && state.telemetry.frameSources.commissioned > 0;
      });

      const initial = await page.evaluate(() => JSON.parse(window.render_golden_scene_to_text()));
      assert.deepEqual(initial.approval.requirements, {
        assets: 26,
        readyAssets: 26,
        requiredExports: 108,
        indexedExports: 108,
      });
      assert.equal(initial.telemetry.frameSources.commissioned, initial.telemetry.frameSources.requested);
      assert.equal(initial.telemetry.frameSources.legacy, 0);
      assert.equal(initial.telemetry.frameSources.procedural, 0);
      assert.equal(initial.approval.reviewSurface.status, 'valid');
      assert.match(initial.approval.reviewSurface.hash, /^[a-f0-9]{64}$/);

      await page.evaluate(() => {
        window.__goldenScene.setZoom(1);
        window.__goldenScene.setLighting('daylight');
        window.__goldenScene.setBeat('dust_storm');
      });
      const wrongLighting = await page.evaluate(() => window.__goldenScene.getApprovalStatus());
      const stormTuple = 'dust_storm@1.0x#storm';
      assert.ok(wrongLighting.coverage.beatZooms.missing.includes(stormTuple), 'wrong lighting cannot credit the canonical storm tuple');
      assert.ok(!wrongLighting.coverage.beatZooms.completed.includes(stormTuple));

      const beats = wrongLighting.coverage.requiredBeats;
      await page.evaluate(({ beatIds, zooms }) => {
        const review = window.__goldenScene;
        review.setLighting('auto');
        for (const zoom of zooms) {
          review.setZoom(zoom);
          for (const beat of beatIds) review.setBeat(beat);
        }
        review.setZoom(1);
        review.setBeat('land_at_outpost');
        review.setMode('procedural');
        review.setMode('auto');
        review.setReducedMotion(true);
        review.setReducedMotion(false);
        for (let frame = 0; frame < 320; frame += 1) window.advanceTime(1000 / 60);
      }, { beatIds: beats, zooms: [0.5, 1, 2.5] });

      const qualified = await page.evaluate(() => window.__goldenScene.getApprovalStatus());
      assert.equal(qualified.coverage.contract, 'golden-scene-review-conditions/v3');
      assert.equal(qualified.coverage.packageContext.packageHash, fixture.reports.full.artifactDigests.packageHash);
      assert.equal(qualified.coverage.packageContext.reviewSurfaceHash, initial.approval.reviewSurface.hash);
      assert.equal(qualified.coverage.beatZooms.tupleSchema, 'beat@zoom#canonical-lighting/v1');
      assert.equal(qualified.coverage.beatZooms.completedCount, 24);
      assert.equal(qualified.coverage.beatZooms.missing.length, 0);
      assert.equal(qualified.coverage.lightingProfiles.completedCount, 4);
      assert.equal(qualified.coverage.lightingProfiles.missing.length, 0);
      assert.equal(qualified.coverage.proceduralFallbackAt1x.completed, true);
      assert.equal(qualified.coverage.reducedMotionCommissionedAt1x.completed, true);
      assert.equal(qualified.coverage.complete, true);
      assert.equal(qualified.performance.samples, 300);
      assert.equal(qualified.performance.pass, true);
      assert.equal(await page.locator('#reviewChecklist input[name="reviewCriterion"]:enabled').count(), 7);

      for (const checkbox of await page.locator('#reviewChecklist input[name="reviewCriterion"]').all()) {
        await checkbox.check();
      }
      assert.equal((await page.evaluate(() => window.__goldenScene.getApprovalStatus())).canRecord, true);
      await page.locator('#recordApproval').click();
      await page.waitForFunction(() => window.__goldenScene.getApprovalReceipt() !== null);
      const receipt = await page.evaluate(() => window.__goldenScene.getApprovalReceipt());
      assert.equal(receipt.schema, 'marsscape-art-approval-receipt/v3');
      assert.equal(receipt.scope, 'full');
      assert.equal(receipt.reviewSurfaceHash, initial.approval.reviewSurface.hash);
      assert.equal(receipt.rendererReview.reviewSurface.hash, receipt.reviewSurfaceHash);
      assert.equal(receipt.rendererReview.conditionLedger.contract, 'golden-scene-review-conditions/v3');
      assert.equal(receipt.rendererReview.conditionLedger.packageContext.reviewSurfaceHash, receipt.reviewSurfaceHash);
      assert.equal(receipt.rendererReview.conditionLedger.complete, true);
      assert.equal(receipt.rendererReview.conditionLedger.beatZooms.completedCount, 24);
      assert.equal(receipt.rendererReview.performance.pass, true);
      assert.equal(receipt.humanReview.attested, true);
      assert.equal(receipt.approval.authentication, 'external-git-review-required');
      assert.equal(receipt.integrityDigest.purpose, 'client-integrity-only-not-authentication');
      assert.equal(receipt.integrityDigest.authenticated, false);
      assert.match(receipt.integrityDigest.value, /^[a-f0-9]{64}$/);

      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => JSON.parse(window.render_golden_scene_to_text()).ready === true);
      await page.waitForFunction((receiptId) => window.__goldenScene.getApprovalReceipt()?.receiptId === receiptId, receipt.receiptId);
      const restored = await page.evaluate(() => window.__goldenScene.getApprovalReceipt());
      assert.equal(restored.receiptId, receipt.receiptId, 'full-golden v3 receipt verifies on same-package, same-surface reload');
      assert.equal(restored.integrityDigest.value, receipt.integrityDigest.value);
      assert.deepEqual(failures, [], 'synthetic full-golden path loads without browser or same-origin request failures');
      record('MarsScape full-golden ledger rejects wrong lighting and verifies every required condition');
    } finally {
      await closeSyntheticFixture(context, fixture);
    }
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

  for (const path of ['/play/', '/mars/', '/mars/golden-scene.html', '/pitch/', '/garden/', '/empires/']) {
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
  try {
    if (browser) await browser.close();
  } finally {
    try {
      cleanupRemainingSyntheticFixtures();
    } finally {
      await close();
    }
  }
}
