import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = "/Users/daverobertson/Desktop/Code/brawlforge";
const OUTPUT_DIR = path.join(ROOT, "output/web-game/control-matrix");
const URL = process.argv[2] || "http://127.0.0.1:4173/index.html";

const SCREENSHOT_TARGETS = [
  { role: "p1", fighter: "deadmau5", check: "special", file: "p1-deadmau5-special.png" },
  { role: "p2", fighter: "skrillex", check: "shield", file: "p2-skrillex-shield.png" },
  { role: "cpu_p1", fighter: "marshmello", check: "special", file: "cpu-p1-marshmello-special.png" },
  { role: "cpu_p2", fighter: "daftpunk", check: "shield", file: "cpu-p2-daftpunk-shield.png" },
];
const ALL_TEST_KEYS = [
  "KeyA", "KeyD", "KeyW", "KeyS", "KeyJ", "Space", "KeyK", "KeyL",
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Numpad1", "Numpad2", "Numpad3",
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function makeResult(role, fighter, check, passed, details) {
  return { role, fighter, check, passed, details };
}

async function main() {
  ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const consoleErrors = [];
  const pageErrors = [];
  const screenshots = [];
  const capturedScreenshots = new Set();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({ type: msg.type(), text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push(String(err));
  });

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.render_game_to_text === "function");
  await page.mouse.click(200, 200);

  await page.evaluate(() => {
    if (!window.__codexOriginalUpdate) {
      window.__codexOriginalUpdate = update;
      update = function patchedRealtimeUpdate(dt) {
        if (window.__codexRealtimePaused) return;
        return window.__codexOriginalUpdate(dt);
      };
    }
    window.__codexRealtimePaused = true;

    window.__codexControlTest = {
      clearKeys() {
        for (const code of Object.keys(keys)) keys[code] = false;
      },
      restoreRandom() {
        if (window.__codexOriginalRandom) Math.random = window.__codexOriginalRandom;
      },
      setRandomConstant(value) {
        if (!window.__codexOriginalRandom) window.__codexOriginalRandom = Math.random;
        Math.random = () => value;
      },
      resetPlayer(p, cfg = {}) {
        p.x = cfg.x ?? 0;
        p.y = cfg.y ?? 200;
        p.vx = cfg.vx ?? 0;
        p.vy = cfg.vy ?? 0;
        p.facing = cfg.facing ?? 1;
        p.grounded = cfg.grounded ?? true;
        p.jumpsLeft = cfg.jumpsLeft ?? (p.def.maxJumps || MAX_JUMPS);
        p.damage = cfg.damage ?? 0;
        p.stocks = cfg.stocks ?? STARTING_STOCKS;
        p.score = cfg.score ?? 0;
        p.state = cfg.state ?? "idle";
        p.stateTimer = cfg.stateTimer ?? 0;
        p.attackData = cfg.attackData ?? null;
        p.attackFrame = cfg.attackFrame ?? 0;
        p.attackKey = cfg.attackKey ?? null;
        p.chargeFrames = cfg.chargeFrames ?? 0;
        p.charging = cfg.charging ?? false;
        p.hitRegistered = cfg.hitRegistered ?? false;
        p.shieldHP = cfg.shieldHP ?? 100;
        p.shieldActive = cfg.shieldActive ?? false;
        p.invincible = cfg.invincible ?? 0;
        p.dodgeCooldown = cfg.dodgeCooldown ?? 0;
        p.prevAttack = false;
        p.prevJump = false;
        p.prevSpecial = false;
        p.prevShield = false;
        p.inputBuffer.attack = 0;
        p.inputBuffer.jump = 0;
        p.runTimer = 0;
        p.moveDir = 0;
        p.grabTarget = cfg.grabTarget ?? -1;
        p.grabTimer = cfg.grabTimer ?? 0;
        p.usedAirDodge = false;
        p.specialFall = false;
        p.diActive = false;
        p.cpuState.actionTimer = 0;
        p.cpuState.currentInput = null;
        p.gamepadIndex = null;
      },
      resetMatch(cfg) {
        this.restoreRandom();
        this.clearKeys();
        state.matchType = cfg.matchType || "stock";
        state.selectedStage = cfg.stage || "finalDest";
        state.charSelectCursors[0].cpu = !!cfg.p1Cpu;
        state.charSelectCursors[0].cpuLevel = cfg.cpuLevel || 5;
        state.charSelectCursors[1].cpu = !!cfg.p2Cpu;
        state.charSelectCursors[1].cpuLevel = cfg.cpuLevel || 5;
        state.p1Fighter = cfg.p1Fighter;
        state.p2Fighter = cfg.p2Fighter;
        startMatch();
        particlePool.forEach((p) => { p.active = false; });
        state.hitstopFrames = 0;
        state.screenShake = { x: 0, y: 0, intensity: 0 };
        state.camera = { x: 0, y: 100, zoom: 1 };
        state.damageNumbers = [];
        state.frameCount = 0;
        this.resetPlayer(state.players[0], { x: -80, y: 200, facing: 1 });
        this.resetPlayer(state.players[1], { x: 80, y: 200, facing: -1 });
        render();
      },
      setScenario(cfg) {
        const target = state.players[cfg.targetSlot];
        const other = state.players[1 - cfg.targetSlot];
        this.clearKeys();
        this.resetPlayer(target, {
          x: cfg.targetX,
          y: cfg.targetY ?? 200,
          grounded: cfg.targetGrounded ?? true,
          facing: cfg.targetFacing ?? (cfg.targetX < cfg.otherX ? 1 : -1),
          jumpsLeft: cfg.targetJumpsLeft,
          state: cfg.targetState,
          stateTimer: cfg.targetStateTimer,
          attackData: cfg.targetAttackData,
          attackFrame: cfg.targetAttackFrame,
          attackKey: cfg.targetAttackKey,
          chargeFrames: cfg.targetChargeFrames,
          charging: cfg.targetCharging,
          hitRegistered: cfg.targetHitRegistered,
        });
        this.resetPlayer(other, {
          x: cfg.otherX,
          y: cfg.otherY ?? 200,
          grounded: cfg.otherGrounded ?? true,
          facing: cfg.otherFacing ?? (cfg.otherX < cfg.targetX ? 1 : -1),
          jumpsLeft: cfg.otherJumpsLeft,
          state: cfg.otherState,
          stateTimer: cfg.otherStateTimer,
          attackData: cfg.otherAttackData,
          attackFrame: cfg.otherAttackFrame,
          attackKey: cfg.otherAttackKey,
          chargeFrames: cfg.otherChargeFrames,
          charging: cfg.otherCharging,
          hitRegistered: cfg.otherHitRegistered,
        });
        render();
      },
      makeAttackData(slot, key) {
        const p = state.players[slot];
        return cloneAttackData(p.def.attacks[key]);
      },
      readState() {
        return JSON.parse(window.render_game_to_text());
      },
      manualAdvance(ms) {
        const steps = Math.max(1, Math.round(ms / (1000 / 60)));
        for (let i = 0; i < steps; i++) window.__codexOriginalUpdate(FIXED_STEP);
        render();
      },
    };
  });

  const fighterKeys = await page.evaluate(() => [...FIGHTER_KEYS]);
  const results = [];

  function dummyFor(fighter) {
    return fighter === fighterKeys[0] ? fighterKeys[1] : fighterKeys[0];
  }

  async function readState() {
    return page.evaluate(() => window.__codexControlTest.readState());
  }

  async function clearInputState() {
    await page.evaluate(() => window.__codexControlTest.clearKeys());
  }

  async function advance(ms) {
    await page.evaluate((value) => window.__codexControlTest.manualAdvance(value), ms);
  }

  async function holdKeys(keysToHold, holdMs, settleMs = 80) {
    for (const key of keysToHold) await page.keyboard.down(key);
    await advance(holdMs);
    for (const key of [...keysToHold].reverse()) await page.keyboard.up(key);
    await clearInputState();
    await advance(settleMs);
  }

  async function releaseAllKeys() {
    for (const key of [...ALL_TEST_KEYS].reverse()) {
      await page.keyboard.up(key).catch(() => {});
    }
    await clearInputState();
  }

  async function resetMatch(config) {
    await page.evaluate((cfg) => window.__codexControlTest.resetMatch(cfg), config);
    await clearInputState();
  }

  async function setScenario(config) {
    await page.evaluate((cfg) => window.__codexControlTest.setScenario(cfg), config);
    await clearInputState();
  }

  async function setRandomConstant(value) {
    await page.evaluate((v) => window.__codexControlTest.setRandomConstant(v), value);
  }

  async function restoreRandom() {
    await page.evaluate(() => window.__codexControlTest.restoreRandom());
  }

  async function maybeCapture(role, fighter, check, file) {
    const target = SCREENSHOT_TARGETS.find((item) => item.role === role && item.fighter === fighter && item.check === check);
    if (!target || capturedScreenshots.has(target.file)) return;
    const outPath = path.join(OUTPUT_DIR, target.file);
    await page.locator("canvas").screenshot({ path: outPath });
    capturedScreenshots.add(target.file);
    screenshots.push(outPath);
  }

  async function runCheck(role, fighter, check, fn) {
    try {
      const details = await fn();
      results.push(makeResult(role, fighter, check, true, details));
      await maybeCapture(role, fighter, check, details && details.screenshotFile);
    } catch (error) {
      const state = await readState().catch(() => null);
      results.push(makeResult(role, fighter, check, false, {
        message: error instanceof Error ? error.message : String(error),
        state,
      }));
    } finally {
      await releaseAllKeys();
    }
  }

  function expect(condition, message, details = {}) {
    if (!condition) {
      const err = new Error(message);
      err.details = details;
      throw err;
    }
  }

  async function verifyHumanRole({ fighter, slot, role, binds, includeAttack2 }) {
    const opponent = dummyFor(fighter);
    const matchConfig = slot === 0
      ? { p1Fighter: fighter, p2Fighter: opponent, p1Cpu: false, p2Cpu: false }
      : { p1Fighter: opponent, p2Fighter: fighter, p1Cpu: false, p2Cpu: false };
    const targetIdx = slot;
    const otherIdx = 1 - slot;

    await runCheck(role, fighter, "move_left", async () => {
      await resetMatch(matchConfig);
      await setScenario({ targetSlot: targetIdx, targetX: 0, otherX: 180 });
      const before = await readState();
      await holdKeys([binds.left], 220, 80);
      const after = await readState();
      const dx = after.players[targetIdx].x - before.players[targetIdx].x;
      expect(dx <= -20, `expected x to decrease by at least 20, saw ${dx}`);
      return { beforeX: before.players[targetIdx].x, afterX: after.players[targetIdx].x };
    });

    await runCheck(role, fighter, "move_right", async () => {
      await resetMatch(matchConfig);
      await setScenario({ targetSlot: targetIdx, targetX: 0, otherX: 180 });
      const before = await readState();
      await holdKeys([binds.right], 220, 80);
      const after = await readState();
      const dx = after.players[targetIdx].x - before.players[targetIdx].x;
      expect(dx >= 20, `expected x to increase by at least 20, saw ${dx}`);
      return { beforeX: before.players[targetIdx].x, afterX: after.players[targetIdx].x };
    });

    await runCheck(role, fighter, "jump", async () => {
      await resetMatch(matchConfig);
      await setScenario({ targetSlot: targetIdx, targetX: 0, otherX: 180 });
      await holdKeys([binds.up], 40, 220);
      const after = await readState();
      expect(after.players[targetIdx].y <= 170, `expected jump height above platform, saw y=${after.players[targetIdx].y}`);
      expect(after.players[targetIdx].grounded === false, "expected fighter to be airborne after jump");
      return { y: after.players[targetIdx].y, state: after.players[targetIdx].state };
    });

    await runCheck(role, fighter, "shield", async () => {
      await resetMatch(matchConfig);
      await setScenario({ targetSlot: targetIdx, targetX: 0, otherX: 180 });
      for (const key of [binds.shield]) await page.keyboard.down(key);
      await advance(100);
      const during = await readState();
      expect(during.players[targetIdx].state === "shield", `expected shield state, saw ${during.players[targetIdx].state}`);
      await page.keyboard.up(binds.shield);
      await clearInputState();
      await advance(60);
      return { state: during.players[targetIdx].state, shieldHP: during.players[targetIdx].shieldHP, screenshotFile: checkScreenshotFile(role, fighter, "shield") };
    });

    await runCheck(role, fighter, "spot_dodge", async () => {
      await resetMatch(matchConfig);
      await setScenario({ targetSlot: targetIdx, targetX: 0, otherX: 180 });
      for (const key of [binds.down, binds.shield]) await page.keyboard.down(key);
      await advance(140);
      const during = await readState();
      expect(during.players[targetIdx].state === "spotdodge", `expected spotdodge state, saw ${during.players[targetIdx].state}`);
      await page.keyboard.up(binds.shield);
      await page.keyboard.up(binds.down);
      await clearInputState();
      await advance(80);
      return { state: during.players[targetIdx].state };
    });

    await runCheck(role, fighter, "attack", async () => {
      await resetMatch(matchConfig);
      await setScenario({ targetSlot: targetIdx, targetX: -24, otherX: 24 });
      await holdKeys([binds.attack], 60, 420);
      const after = await readState();
      expect(after.players[otherIdx].damage > 0, `expected damage on opponent, saw ${after.players[otherIdx].damage}`);
      return { opponentDamage: after.players[otherIdx].damage };
    });

    if (includeAttack2) {
      await runCheck(role, fighter, "attack_alt", async () => {
        await resetMatch(matchConfig);
        await setScenario({ targetSlot: targetIdx, targetX: -24, otherX: 24 });
        await holdKeys([binds.attack2], 60, 420);
        const after = await readState();
        expect(after.players[otherIdx].damage > 0, `expected alt attack damage on opponent, saw ${after.players[otherIdx].damage}`);
        return { opponentDamage: after.players[otherIdx].damage };
      });
    }

    await runCheck(role, fighter, "special", async () => {
      await resetMatch(matchConfig);
      await setScenario({ targetSlot: targetIdx, targetX: -10, otherX: 14 });
      await holdKeys([binds.special], 60, 200);
      const after = await readState();
      const grabbing = after.players[targetIdx].state === "grabbing" && after.players[otherIdx].state === "grabbed";
      expect(grabbing || after.players[targetIdx].grabTarget === otherIdx, `expected grab connect, saw ${after.players[targetIdx].state}/${after.players[otherIdx].state}`);
      return {
        targetState: after.players[targetIdx].state,
        otherState: after.players[otherIdx].state,
        grabTarget: after.players[targetIdx].grabTarget,
        screenshotFile: checkScreenshotFile(role, fighter, "special"),
      };
    });
  }

  async function verifyCpuRole({ fighter, slot, role }) {
    const opponent = dummyFor(fighter);
    const matchConfig = slot === 0
      ? { p1Fighter: fighter, p2Fighter: opponent, p1Cpu: true, p2Cpu: false, cpuLevel: 5 }
      : { p1Fighter: opponent, p2Fighter: fighter, p1Cpu: false, p2Cpu: true, cpuLevel: 5 };
    const targetIdx = slot;
    const otherIdx = 1 - slot;

    await runCheck(role, fighter, "move", async () => {
      await resetMatch(matchConfig);
      await setRandomConstant(0.5);
      await setScenario({
        targetSlot: targetIdx,
        targetX: slot === 0 ? -220 : 220,
        otherX: slot === 0 ? 220 : -220,
      });
      const before = await readState();
      await advance(450);
      const after = await readState();
      const movedToward = slot === 0
        ? after.players[targetIdx].x > before.players[targetIdx].x + 20
        : after.players[targetIdx].x < before.players[targetIdx].x - 20;
      expect(movedToward, `expected CPU to approach opponent, saw ${before.players[targetIdx].x} -> ${after.players[targetIdx].x}`);
      return { beforeX: before.players[targetIdx].x, afterX: after.players[targetIdx].x };
    });

    await runCheck(role, fighter, "jump_recovery", async () => {
      await resetMatch(matchConfig);
      await setRandomConstant(0.5);
      await setScenario({
        targetSlot: targetIdx,
        targetX: slot === 0 ? -220 : 220,
        targetY: 320,
        targetGrounded: false,
        targetState: "fall",
        targetJumpsLeft: 2,
        otherX: slot === 0 ? 60 : -60,
      });
      const before = await readState();
      await advance(60);
      const after = await readState();
      expect(after.players[targetIdx].y < before.players[targetIdx].y, `expected recovery jump to reduce y, saw ${before.players[targetIdx].y} -> ${after.players[targetIdx].y}`);
      return { beforeY: before.players[targetIdx].y, afterY: after.players[targetIdx].y, state: after.players[targetIdx].state };
    });

    await runCheck(role, fighter, "attack", async () => {
      await resetMatch(matchConfig);
      await setRandomConstant(0.2);
      await setScenario({ targetSlot: targetIdx, targetX: -24, otherX: 24 });
      await advance(700);
      const after = await readState();
      expect(after.players[otherIdx].damage > 0, `expected CPU attack to deal damage, saw ${after.players[otherIdx].damage}`);
      return { opponentDamage: after.players[otherIdx].damage };
    });

    await runCheck(role, fighter, "special", async () => {
      await resetMatch(matchConfig);
      await setRandomConstant(0.75);
      await setScenario({ targetSlot: targetIdx, targetX: -10, otherX: 14 });
      await advance(220);
      const after = await readState();
      const grabConnected = (
        (after.players[targetIdx].state === "grabbing" && after.players[otherIdx].state === "grabbed") ||
        after.players[targetIdx].grabTarget === otherIdx ||
        (after.players[otherIdx].damage > 0 && after.players[otherIdx].state === "hitstun")
      );
      expect(grabConnected, `expected CPU grab or throw confirm, saw ${after.players[targetIdx].state}/${after.players[otherIdx].state}`);
      return {
        targetState: after.players[targetIdx].state,
        otherState: after.players[otherIdx].state,
        grabTarget: after.players[targetIdx].grabTarget,
        opponentDamage: after.players[otherIdx].damage,
        screenshotFile: checkScreenshotFile(role, fighter, "special"),
      };
    });

    await runCheck(role, fighter, "shield", async () => {
      await resetMatch(matchConfig);
      await setRandomConstant(0.0);
      const otherAttackData = await page.evaluate((idx) => window.__codexControlTest.makeAttackData(idx, "neutral"), otherIdx);
      await setScenario({
        targetSlot: targetIdx,
        targetX: -20,
        otherX: 20,
        otherState: "attack",
        otherAttackData,
        otherAttackFrame: Math.max(0, otherAttackData.startup - 2),
        otherAttackKey: "neutral",
        otherChargeFrames: 0,
        otherCharging: false,
        otherHitRegistered: false,
      });
      await advance(120);
      const after = await readState();
      expect(after.players[targetIdx].state === "shield", `expected CPU shield response, saw ${after.players[targetIdx].state}`);
      return {
        state: after.players[targetIdx].state,
        shieldHP: after.players[targetIdx].shieldHP,
        screenshotFile: checkScreenshotFile(role, fighter, "shield"),
      };
    });

    await restoreRandom();
  }

  function checkScreenshotFile(role, fighter, check) {
    const target = SCREENSHOT_TARGETS.find((item) => item.role === role && item.fighter === fighter && item.check === check);
    return target ? target.file : null;
  }

  const p1Binds = {
    left: "KeyA",
    right: "KeyD",
    up: "KeyW",
    down: "KeyS",
    attack: "KeyJ",
    attack2: "Space",
    special: "KeyK",
    shield: "KeyL",
  };
  const p2Binds = {
    left: "ArrowLeft",
    right: "ArrowRight",
    up: "ArrowUp",
    down: "ArrowDown",
    attack: "Numpad1",
    special: "Numpad2",
    shield: "Numpad3",
  };

  for (const fighter of fighterKeys) {
    await verifyHumanRole({ fighter, slot: 0, role: "p1", binds: p1Binds, includeAttack2: true });
    await verifyHumanRole({ fighter, slot: 1, role: "p2", binds: p2Binds, includeAttack2: false });
    await verifyCpuRole({ fighter, slot: 0, role: "cpu_p1" });
    await verifyCpuRole({ fighter, slot: 1, role: "cpu_p2" });
  }

  await restoreRandom();
  await clearInputState();

  const failed = results.filter((result) => !result.passed);
  const summary = {
    url: URL,
    fighters: fighterKeys,
    totalChecks: results.length,
    passedChecks: results.length - failed.length,
    failedChecks: failed.length,
    failures: failed,
    consoleErrors,
    pageErrors,
    screenshots,
    results,
  };

  const summaryPath = path.join(OUTPUT_DIR, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  await browser.close();

  if (failed.length || consoleErrors.length || pageErrors.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
