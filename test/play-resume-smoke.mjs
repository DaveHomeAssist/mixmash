import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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
  const screenshotDir = join(tmpdir(), `mixmash-play-smoke-${process.pid}`);
  await mkdir(screenshotDir, { recursive: true });

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));

  const playUrl = `http://127.0.0.1:${port}/play/`;
  await page.goto(playUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(250);
  await page.evaluate(() => localStorage.setItem('mixmash_profile', '{broken profile json'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(250);

  async function step(frames) {
    await page.evaluate((frameCount) => {
      if (typeof window.advanceTime === 'function') window.advanceTime(frameCount * (1000 / 60));
    }, frames);
    await page.evaluate(() => new Promise(requestAnimationFrame));
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

  async function screenshot(name) {
    await page.screenshot({ path: join(screenshotDir, name), fullPage: true });
  }

  const title = await readState();
  assert.equal(title.mode, 'title');
  assert.equal(title.titleActions.quickFight, 'KeyQ');
  assert.equal(title.titleActions.menu, 'KeyO');
  assert.equal(title.quickFightSetup.p1Cpu, false);
  assert.equal(title.quickFightSetup.p2Cpu, true);
  assert.equal(title.contentPack.stages, 11);
  assert.equal(title.contentPack.fighters, 14);
  assert.deepEqual(title.contentPack.encoreStages, ['printworks', 'electricForest']);
  assert.deepEqual(title.contentPack.encoreFighters, ['flume', 'zomboy']);
  assert.equal(title.contentPack.musicCues.includes('warehouse'), true);
  assert.equal(title.contentPack.musicCues.includes('forest'), true);
  assert.equal(title.security.frameGuard.checked, true);
  assert.equal(title.security.frameGuard.framed, false);
  assert.equal(title.security.frameGuard.action, 'top-level');
  assert.equal(title.profile.version, 1);
  assert.equal(title.profile.matchCount, 0);
  assert.equal(title.profile.challenges.length, 4);
  await screenshot('01-title.png');

  await press('KeyO');
  const menuState = await readState();
  assert.equal(menuState.mode, 'title');
  assert.equal(menuState.domMenu.open, true);
  assert.equal(menuState.domMenu.activeTab, 'onboarding');
  assert.equal(menuState.domMenu.focusTrapActive, true);
  assert.equal(menuState.domMenu.canvasCaptured, true);
  assert.ok(menuState.domMenu.pauseEventCount >= 1);
  await screenshot('02-dom-menu-onboarding.png');

  await page.click('#tab-controls');
  await page.click('.rebind-button[data-player="P1"][data-action="LEFT"]');
  await page.keyboard.press('KeyZ');
  await step(6);
  const rebound = await readState();
  const storedConfig = await page.evaluate(() => JSON.parse(localStorage.getItem('mixmash_config_v1')));
  assert.equal(storedConfig.controls.key_bindings.P1_LEFT, 'KeyZ');
  assert.equal(rebound.config.controls.bindingCount >= 14, true);
  await page.click('#menu-reset-controls');
  await step(4);

  await page.click('#tab-audio');
  await page.evaluate(() => {
    const sfx = document.getElementById('audio-sfx');
    const track = document.getElementById('audio-track');
    const mute = document.getElementById('audio-mute-blur');
    sfx.value = '55';
    sfx.dispatchEvent(new Event('input', { bubbles: true }));
    track.value = 'neon';
    track.dispatchEvent(new Event('change', { bubbles: true }));
    mute.checked = false;
    mute.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await step(4);
  const audioConfigured = await readState();
  assert.equal(audioConfigured.config.audio.sfx_volume, 0.55);
  assert.equal(audioConfigured.config.audio.track_selection_id, 'neon');
  assert.equal(audioConfigured.config.audio.mute_on_blur, false);
  await screenshot('03-dom-menu-audio.png');

  await page.click('#tab-progress');
  const progressMenu = await readState();
  assert.equal(progressMenu.domMenu.activeTab, 'progress');
  assert.equal(progressMenu.profile.matchCount, 0);

  await press('Escape');
  assert.equal((await readState()).mode, 'title');

  await press('KeyQ');
  await step(90);

  const beforeReload = await readState();
  assert.equal(beforeReload.mode, 'playing');
  assert.equal(beforeReload.snapshotAvailable, true);
  assert.equal(beforeReload.players.length, 2);
  assert.equal(beforeReload.players[0].controlType, 'human');
  assert.equal(beforeReload.players[1].controlType, 'cpu');
  assert.equal(beforeReload.quickFightSetup.p2Cpu, true);
  const storedQuickFight = await page.evaluate(() => JSON.parse(localStorage.getItem('mixmash_quick_fight_setup')));
  assert.equal(storedQuickFight.p1Cpu, false);
  assert.equal(storedQuickFight.p2Cpu, true);
  await screenshot('04-quick-fight-playing.png');

  await press('KeyO');
  const openedDuringPlay = await readState();
  assert.equal(openedDuringPlay.domMenu.open, true);
  assert.equal(openedDuringPlay.mode, 'paused');
  const frameBeforeMenu = openedDuringPlay.frame;
  await step(60);
  const pausedByMenu = await readState();
  assert.equal(pausedByMenu.domMenu.open, true);
  assert.equal(pausedByMenu.mode, 'paused');
  assert.equal(pausedByMenu.domMenu.pausedReturnMode, 'playing');
  assert.equal(pausedByMenu.frame, frameBeforeMenu);
  await screenshot('05-dom-menu-paused-game.png');

  await press('Escape');
  const resumedFromMenu = await readState();
  assert.equal(resumedFromMenu.domMenu.open, false);
  assert.equal(resumedFromMenu.mode, 'playing');
  assert.ok(resumedFromMenu.domMenu.resumeEventCount >= 2);

  await press('KeyP');
  const paused = await readState();
  assert.equal(paused.mode, 'paused');
  assert.equal(paused.snapshotAvailable, true);

  await press('KeyP');
  const resumedByPause = await readState();
  assert.equal(resumedByPause.mode, 'playing');

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

  await press('Escape');
  const afterReset = await readState();
  assert.equal(afterReset.mode, 'title');
  assert.equal(afterReset.snapshotAvailable, false);
  assert.equal(afterReset.titleActions.resume, null);

  await press('KeyO');
  await page.click('#menu-sandbox');
  await step(30);
  const sandbox = await readState();
  assert.equal(sandbox.mode, 'training');
  assert.equal(sandbox.matchType, 'training');
  assert.equal(sandbox.players[0].controlType, 'human');
  assert.equal(sandbox.players[1].controlType, 'cpu');
  assert.equal(sandbox.options.showHitboxes, true);
  assert.equal(sandbox.training.players.length, 2);

  await page.evaluate(() => {
    const [p1, p2] = state.players;
    p1.x = -20;
    p1.y = 100;
    p1.vx = 0;
    p1.vy = 0;
    p1.grounded = true;
    p1.facing = 1;
    p1.state = 'idle';
    p1.attackData = null;
    p1.hitRegistered = false;

    p2.x = 10;
    p2.y = 100;
    p2.vx = 0;
    p2.vy = 0;
    p2.grounded = true;
    p2.facing = -1;
    p2.state = 'idle';
    p2.attackData = null;
    p2.hitRegistered = false;
    p2.invincible = 0;
    p2.damage = 0;
    p2.controlType = 'human';
  });
  await press('KeyJ');
  await step(10);

  const trainingHit = await readState();
  assert.equal(trainingHit.mode, 'training');
  assert.ok(trainingHit.training.recentHitEvents.length >= 1);
  const latestHit = trainingHit.training.recentHitEvents[0];
  assert.equal(latestHit.type, 'hit');
  assert.equal(latestHit.attacker.idx, 0);
  assert.equal(latestHit.target.idx, 1);
  assert.ok(latestHit.damage > 0);
  assert.ok(latestHit.knockback > 0);
  assert.equal(Number.isFinite(latestHit.launch.vx), true);
  assert.equal(Number.isFinite(latestHit.launch.vy), true);
  assert.ok(trainingHit.training.players[1].damage > 0);
  assert.ok(trainingHit.training.players[1].hitstunFrames > 0);
  assert.deepEqual(trainingHit.combat.recentHitEvents[0], latestHit);
  assert.equal(Number.isFinite(trainingHit.combat.screenShake.vectorX), true);
  assert.equal(Number.isFinite(trainingHit.combat.screenShake.vectorY), true);
  await screenshot('06-training-lab-hit.png');

  await press('Escape');
  const afterTrainingExit = await readState();
  assert.equal(afterTrainingExit.mode, 'title');
  assert.equal(afterTrainingExit.snapshotAvailable, false);

  await page.evaluate(() => {
    options.hazardsOn = true;
    state.selectedStage = 'printworks';
    state.p1Fighter = 'flume';
    state.p2Fighter = 'zomboy';
    state.matchType = 'stock';
    state.charSelectCursors = [
      { pos: FIGHTER_KEYS.indexOf('flume'), confirmed: false, cpu: false, cpuLevel: 3 },
      { pos: FIGHTER_KEYS.indexOf('zomboy'), confirmed: false, cpu: true, cpuLevel: 3 },
    ];
    startMatch();
    const p2 = state.players[1];
    p2.stocks = 1;
    p2.x = BLAST.right + 80;
    p2.y = 0;
    p2.vx = 700;
    p2.vy = -40;
    checkBlastZones();
  });
  await step(110);
  const stockProgress = await readState();
  assert.equal(stockProgress.mode, 'results');
  assert.equal(stockProgress.profile.matchCount, 1);
  assert.equal(stockProgress.profile.wins, 1);
  assert.ok(stockProgress.profile.kos >= 1);
  assert.equal(stockProgress.profile.favoriteFighter, 'flume');
  assert.equal(stockProgress.profile.challenges.find((challenge) => challenge.id === 'first_match').completed, true);
  assert.equal(stockProgress.profile.challenges.find((challenge) => challenge.id === 'first_win').completed, true);
  assert.equal(stockProgress.profile.challenges.find((challenge) => challenge.id === 'encore_explorer').completed, true);
  await screenshot('07-local-profile-stock-result.png');

  await press('Escape');
  assert.equal((await readState()).mode, 'title');

  await press('Enter');
  assert.equal((await readState()).mode, 'charselect');
  await press('Enter');
  assert.equal((await readState()).mode, 'stageselect');
  await press('Enter');
  let modeSelect = await readState();
  assert.equal(modeSelect.mode, 'modeselect');
  for (let i = 0; i < 6 && modeSelect.modeSelect.selected !== 'rush'; i++) {
    await press('ArrowDown');
    modeSelect = await readState();
  }
  assert.equal(modeSelect.modeSelect.selected, 'rush');
  await press('Enter');
  await step(30);

  let rush = await readState();
  assert.equal(rush.mode, 'playing');
  assert.equal(rush.matchType, 'rush');
  assert.equal(rush.players[0].controlType, 'human');
  assert.equal(rush.players[1].state, 'dead');
  assert.equal(rush.platformRush.recordsCollected, 0);
  assert.equal(rush.platformRush.totalRecords, 8);
  assert.equal(rush.platformRush.totalDeepCuts, 2);
  assert.equal(rush.platformRush.collectibles.length, 10);
  assert.equal(rush.platformRush.placement.unreachableCount, 0);
  assert.equal(rush.platformRush.collectibles.every((item) => item.reachable), true);
  assert.equal(rush.platformRush.allStagePlacement.length, 11);
  assert.equal(rush.platformRush.allStagePlacement.every((report) => report.unreachableCount === 0), true);
  await screenshot('08-platform-rush-start.png');

  async function collectRushItem(type) {
    const item = await page.evaluate((itemType) => {
      const target = state.platformRush.collectibles.find((candidate) => !candidate.collected && candidate.type === itemType);
      if (!target) return null;
      const player = state.players[0];
      player.x = target.x;
      player.y = target.y + player.h * 0.45;
      player.vx = 0;
      player.vy = 0;
      player.state = 'idle';
      player.grounded = true;
      player.invincible = 0;
      return { id: target.id, type: target.type };
    }, type);
    assert.ok(item, `missing rush item ${type}`);
    await step(3);
    return readState();
  }

  rush = await collectRushItem('record');
  assert.equal(rush.platformRush.recordsCollected, 1);
  assert.ok(rush.platformRush.score >= 100);
  assert.equal(rush.platformRush.collectibles.find((item) => item.id === 'record-1').collected, true);

  const beforeDeepCut = rush.platformRush;
  rush = await collectRushItem('deepCut');
  assert.equal(rush.platformRush.deepCutsCollected, beforeDeepCut.deepCutsCollected + 1);
  assert.ok(rush.platformRush.recordsCollected >= 1);
  assert.ok(rush.platformRush.score >= 450);
  assert.equal(rush.platformRush.collectibles.some((item) => item.type === 'deepCut' && item.collected), true);
  const rushBeforePause = rush;
  await page.evaluate(() => {
    const player = state.players[0];
    const spawn = currentStage.spawns[0];
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.state = 'idle';
    player.grounded = false;
  });

  await press('KeyP');
  const rushPaused = await readState();
  assert.equal(rushPaused.mode, 'paused');
  assert.equal(rushPaused.snapshotAvailable, true);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(250);
  const rushReloaded = await readState();
  assert.equal(rushReloaded.mode, 'title');
  assert.equal(rushReloaded.snapshotAvailable, true);
  await press('KeyR');
  await step(10);
  rush = await readState();
  assert.equal(rush.mode, 'paused');
  assert.equal(rush.matchType, 'rush');
  assert.equal(rush.platformRush.recordsCollected, rushBeforePause.platformRush.recordsCollected);
  assert.equal(rush.platformRush.deepCutsCollected, rushBeforePause.platformRush.deepCutsCollected);
  assert.equal(rush.platformRush.score, rushBeforePause.platformRush.score);
  await press('KeyP');
  rush = await readState();
  assert.equal(rush.mode, 'playing');
  assert.equal(rush.matchType, 'rush');

  await press('KeyR');
  await step(10);
  rush = await readState();
  assert.equal(rush.matchType, 'rush');
  assert.equal(rush.platformRush.score, 0);
  assert.equal(rush.platformRush.recordsCollected, 0);
  assert.equal(rush.platformRush.deepCutsCollected, 0);
  assert.equal(rush.platformRush.collectibles.every((item) => !item.collected), true);

  for (let i = 0; i < 12; i++) {
    rush = await readState();
    if (rush.mode === 'results') break;
    await page.evaluate(() => {
      const target = state.platformRush.collectibles.find((candidate) => !candidate.collected);
      if (!target) return;
      const player = state.players[0];
      player.x = target.x;
      player.y = target.y + player.h * 0.45;
      player.vx = 0;
      player.vy = 0;
      player.state = 'idle';
      player.grounded = true;
      player.invincible = 0;
    });
    await step(3);
  }
  const rushResults = await readState();
  assert.equal(rushResults.mode, 'results');
  assert.equal(rushResults.matchType, 'rush');
  assert.equal(rushResults.snapshotAvailable, false);
  assert.equal(rushResults.platformRush.finished, true);
  assert.equal(rushResults.platformRush.resultReason, 'complete');
  assert.equal(rushResults.platformRush.remaining, 0);
  assert.equal(rushResults.platformRush.recordsCollected, rushResults.platformRush.totalRecords);
  assert.equal(rushResults.platformRush.deepCutsCollected, rushResults.platformRush.totalDeepCuts);
  assert.equal(rushResults.profile.platformRushCompletions, 1);
  assert.equal(rushResults.profile.platformRushGhostCount >= 1, true);
  assert.equal(rushResults.profile.challenges.find((challenge) => challenge.id === 'rush_complete').completed, true);
  assert.ok(rushResults.profile.bestPlatformRush);
  assert.equal(rushResults.profile.bestPlatformRush.stage, rushResults.stage);
  await screenshot('09-platform-rush-results.png');

  await press('Enter');
  await step(10);
  const rushRestartedFromResults = await readState();
  assert.equal(rushRestartedFromResults.mode, 'playing');
  assert.equal(rushRestartedFromResults.matchType, 'rush');
  assert.equal(rushRestartedFromResults.platformRush.score, 0);
  assert.equal(rushRestartedFromResults.onlinePrototype.decision, 'async-local-ghost');
  assert.equal(rushRestartedFromResults.onlinePrototype.networked, false);
  assert.equal(rushRestartedFromResults.onlinePrototype.ghost.available, true);
  assert.ok(rushRestartedFromResults.onlinePrototype.ghost.samples > 0);

  await press('Escape');
  assert.equal((await readState()).mode, 'title');

  async function launchEncoreMatch(stageKey, p1Fighter, p2Fighter, hazardsOn = true) {
    await page.evaluate(({ stageKey, p1Fighter, p2Fighter, hazardsOn }) => {
      options.hazardsOn = hazardsOn;
      state.selectedStage = stageKey;
      state.p1Fighter = p1Fighter;
      state.p2Fighter = p2Fighter;
      state.matchType = 'stock';
      state.charSelectCursors = [
        { pos: FIGHTER_KEYS.indexOf(p1Fighter), confirmed: false, cpu: false, cpuLevel: 3 },
        { pos: FIGHTER_KEYS.indexOf(p2Fighter), confirmed: false, cpu: true, cpuLevel: 3 },
      ];
      startMatch();
    }, { stageKey, p1Fighter, p2Fighter, hazardsOn });
    await step(30);
    return readState();
  }

  const runeMatch = await launchEncoreMatch('printworks', 'flume', 'zomboy', true);
  assert.equal(runeMatch.mode, 'playing');
  assert.equal(runeMatch.stage, 'printworks');
  assert.equal(runeMatch.players[0].fighter, 'flume');
  assert.equal(runeMatch.players[1].fighter, 'zomboy');
  assert.equal(runeMatch.options.hazardsOn, true);
  await screenshot('10-encore-printworks.png');

  const crystalMatch = await launchEncoreMatch('electricForest', 'zomboy', 'flume', true);
  assert.equal(crystalMatch.mode, 'playing');
  assert.equal(crystalMatch.stage, 'electricForest');
  assert.equal(crystalMatch.players[0].fighter, 'zomboy');
  assert.equal(crystalMatch.players[1].fighter, 'flume');
  await screenshot('11-encore-electric-forest.png');

  const movingHazard = await page.evaluate(() => {
    options.hazardsOn = true;
    state.selectedStage = 'printworks';
    state.p1Fighter = 'flume';
    state.p2Fighter = 'zomboy';
    state.matchType = 'stock';
    state.charSelectCursors = [
      { pos: FIGHTER_KEYS.indexOf('flume'), confirmed: false, cpu: false, cpuLevel: 3 },
      { pos: FIGHTER_KEYS.indexOf('zomboy'), confirmed: false, cpu: true, cpuLevel: 3 },
    ];
    startMatch();
    const moving = currentStage.platforms.filter(platform => platform.moving);
    const before = moving.map(platform => ({ x: platform.x, y: platform.y }));
    window.advanceTime(1000);
    const after = moving.map(platform => ({ x: platform.x, y: platform.y }));
    return { before, after, hazardsOn: state.hazardsOn };
  });
  assert.equal(movingHazard.hazardsOn, true);
  assert.equal(movingHazard.before.length >= 2, true);
  assert.equal(movingHazard.after.some((platform, index) => Math.abs(platform.x - movingHazard.before[index].x) > 0.5 || Math.abs(platform.y - movingHazard.before[index].y) > 0.5), true);

  const staticHazard = await page.evaluate(() => {
    options.hazardsOn = false;
    state.selectedStage = 'electricForest';
    state.p1Fighter = 'zomboy';
    state.p2Fighter = 'flume';
    state.matchType = 'stock';
    state.charSelectCursors = [
      { pos: FIGHTER_KEYS.indexOf('zomboy'), confirmed: false, cpu: false, cpuLevel: 3 },
      { pos: FIGHTER_KEYS.indexOf('flume'), confirmed: false, cpu: true, cpuLevel: 3 },
    ];
    startMatch();
    const moving = currentStage.platforms.filter(platform => platform.moving);
    const before = moving.map(platform => ({ x: platform.x, y: platform.y }));
    window.advanceTime(1000);
    const after = moving.map(platform => ({ x: platform.x, y: platform.y }));
    options.hazardsOn = true;
    return { before, after, hazardsOn: state.hazardsOn };
  });
  assert.equal(staticHazard.hazardsOn, false);
  assert.equal(staticHazard.before.length >= 2, true);
  assert.equal(staticHazard.after.every((platform, index) => Math.abs(platform.x - staticHazard.before[index].x) < 0.01 && Math.abs(platform.y - staticHazard.before[index].y) < 0.01), true);

  await press('Escape');
  assert.equal((await readState()).mode, 'title');

  await press('KeyO');
  await page.click('#tab-progress');
  const profileBeforeReset = await readState();
  assert.equal(profileBeforeReset.domMenu.activeTab, 'progress');
  assert.equal(profileBeforeReset.profile.matchCount >= 1, true);
  assert.equal(profileBeforeReset.profile.platformRushCompletions, 1);
  await screenshot('12-progress-profile.png');
  page.once('dialog', (dialog) => dialog.accept());
  await page.click('#menu-reset-profile');
  await step(4);
  const profileAfterReset = await readState();
  assert.equal(profileAfterReset.profile.matchCount, 0);
  assert.equal(profileAfterReset.profile.wins, 0);
  assert.equal(profileAfterReset.profile.kos, 0);
  assert.equal(profileAfterReset.profile.platformRushCompletions, 0);
  assert.equal(profileAfterReset.profile.challenges.every((challenge) => !challenge.completed), true);
  await screenshot('13-progress-reset.png');
  await press('Escape');
  assert.equal((await readState()).mode, 'title');

  await page.goto(`${playUrl}?mix=1&p1=nope&p2=bad&stage=missing&mode=unknown&hazards=maybe&seed=bad%20seed`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(250);
  const malformedShare = await readState();
  assert.equal(malformedShare.mode, 'title');
  assert.equal(malformedShare.quickFightSetup.p1Fighter, 'deadmau5');
  assert.equal(malformedShare.quickFightSetup.p2Fighter, 'skrillex');
  assert.equal(malformedShare.quickFightSetup.selectedStage, 'battlefield');
  assert.equal(malformedShare.quickFightSetup.matchType, 'stock');
  assert.equal(malformedShare.share.platformRushSeedId, null);

  await page.goto(`${playUrl}?mix=1&p1=flume&p2=zomboy&stage=electricForest&mode=stock&p1cpu=0&p2cpu=1&p1level=3&p2level=5&hazards=0&seed=party_42`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(250);
  const presetShare = await readState();
  assert.equal(presetShare.mode, 'title');
  assert.equal(presetShare.quickFightSetup.p1Fighter, 'flume');
  assert.equal(presetShare.quickFightSetup.p2Fighter, 'zomboy');
  assert.equal(presetShare.quickFightSetup.selectedStage, 'electricForest');
  assert.equal(presetShare.quickFightSetup.p2CpuLevel, 5);
  assert.equal(presetShare.options.hazardsOn, false);
  assert.equal(presetShare.share.platformRushSeedId, 'party_42');
  assert.equal(presetShare.share.matchUrl.includes('mix=1'), true);
  assert.equal(presetShare.share.matchUrl.includes('stage=electricForest'), true);
  await press('KeyQ');
  await step(20);
  const presetMatch = await readState();
  assert.equal(presetMatch.mode, 'playing');
  assert.equal(presetMatch.stage, 'electricForest');
  assert.equal(presetMatch.players[0].fighter, 'flume');
  assert.equal(presetMatch.players[1].fighter, 'zomboy');
  assert.equal(presetMatch.options.hazardsOn, false);
  await press('Escape');
  assert.equal((await readState()).mode, 'title');

  const challengeUrl = `${playUrl}?mix=1&p1=flume&p2=zomboy&stage=printworks&mode=rush&p1cpu=0&p2cpu=1&hazards=1&seed=daily_test&start=1`;
  await page.goto(challengeUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(250);
  await step(20);
  const challengeA = await readState();
  assert.equal(challengeA.mode, 'playing');
  assert.equal(challengeA.matchType, 'rush');
  assert.equal(challengeA.stage, 'printworks');
  assert.equal(challengeA.share.platformRushSeedId, 'daily_test');
  assert.equal(challengeA.snapshotAvailable, true);
  const challengePositionsA = challengeA.platformRush.collectibles.map((item) => [item.id, item.x, item.y]);
  await page.goto(challengeUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(250);
  await step(20);
  const challengeB = await readState();
  assert.equal(challengeB.mode, 'playing');
  assert.equal(challengeB.matchType, 'rush');
  assert.deepEqual(challengeB.platformRush.collectibles.map((item) => [item.id, item.x, item.y]), challengePositionsA);
  await screenshot('14-share-challenge.png');
  await press('Escape');
  assert.equal((await readState()).mode, 'title');
  assert.deepEqual(errors, []);
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
