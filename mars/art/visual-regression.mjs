import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { pngDifference } from './validate-assets.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

function optionValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

async function waitForUrl(url, processHandle) {
  let lastError = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (processHandle.exitCode !== null) throw new Error(`MarsScape server exited with ${processHandle.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`MarsScape server did not become ready: ${lastError?.message || 'unknown error'}`);
}

async function startLocalServer(port) {
  const processHandle = spawn(process.execPath, ['mars/server.mjs'], {
    cwd: REPO_ROOT,
    env: { ...process.env, MARSSCAPE_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stderr = [];
  processHandle.stderr.on('data', (chunk) => stderr.push(String(chunk)));
  const url = `http://127.0.0.1:${port}/mars/`;
  try {
    await waitForUrl(url, processHandle);
  } catch (error) {
    processHandle.kill('SIGTERM');
    throw new Error(`${error.message}${stderr.length ? `\n${stderr.join('')}` : ''}`);
  }
  return { processHandle, url };
}

async function gameState(page) {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

function compareScreenshots(files, baselineDirectory, updateBaseline, maxDiff) {
  const comparisons = [];
  if (!baselineDirectory) return comparisons;
  mkdirSync(baselineDirectory, { recursive: true });
  for (const file of files) {
    const baseline = join(baselineDirectory, file.name);
    if (updateBaseline || !existsSync(baseline)) {
      if (!updateBaseline) {
        comparisons.push({ name: file.name, status: 'missing-baseline', ratio: null });
        continue;
      }
      copyFileSync(file.path, baseline);
      comparisons.push({ name: file.name, status: 'baseline-updated', ratio: 0 });
      continue;
    }
    const difference = pngDifference(readFileSync(baseline), readFileSync(file.path));
    comparisons.push({
      name: file.name,
      status: difference.compatible && difference.ratio <= maxDiff ? 'pass' : 'fail',
      ...difference,
    });
  }
  return comparisons;
}

const args = process.argv.slice(2);
const requestedUrl = optionValue(args, '--url');
const outputDirectory = resolve(optionValue(args, '--output', join(REPO_ROOT, '.art-validation', 'marsscape')));
const baselineValue = optionValue(args, '--baseline');
const baselineDirectory = baselineValue ? resolve(baselineValue) : null;
const updateBaseline = args.includes('--update-baseline');
const maxDiff = Number(optionValue(args, '--max-diff', '0.01'));
const port = Number(process.env.MARSSCAPE_ART_PORT || 8791);
let localServer = null;
let browser = null;

try {
  const gameUrl = requestedUrl || (localServer = await startLocalServer(port)).url;
  mkdirSync(outputDirectory, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(gameUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
  await page.locator('#startButton').click();
  await page.locator('#boot').waitFor({ state: 'hidden' });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });

  const initial = await gameState(page);
  if (initial.viewport.scale !== 1) throw new Error(`Expected normal gameplay zoom 1; received ${initial.viewport.scale}`);
  if (!initial.rendering.pixelMode || initial.rendering.spritesDrawn < 1) throw new Error('Pixel Art mode did not draw sprites');

  const files = [];
  const pixelPath = join(outputDirectory, 'mars-normal-pixel.png');
  await page.locator('#isoViewport').screenshot({ path: pixelPath, animations: 'disabled' });
  files.push({ name: 'mars-normal-pixel.png', path: pixelPath });

  await page.locator('#pixelModeButton').click();
  const procedural = await gameState(page);
  if (procedural.rendering.pixelMode || procedural.rendering.proceduralDrawn < 1) throw new Error('Procedural fallback mode did not draw fallback models');
  const proceduralPath = join(outputDirectory, 'mars-normal-procedural.png');
  await page.locator('#isoViewport').screenshot({ path: proceduralPath, animations: 'disabled' });
  files.push({ name: 'mars-normal-procedural.png', path: proceduralPath });

  const specPage = await context.newPage();
  specPage.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`art-spec: ${message.text()}`);
  });
  specPage.on('pageerror', (error) => consoleErrors.push(`art-spec: ${error.message}`));
  await specPage.goto(new URL('art-spec.html', gameUrl).href, { waitUntil: 'networkidle' });
  await specPage.waitForFunction(() => document.documentElement.dataset.spriteBitmaps === '33');
  const specState = JSON.parse(await specPage.evaluate(() => window.render_spec_to_text()));
  if (specState.contractVersion !== 2 || specState.spriteBitmaps !== 33) throw new Error('Art-spec contract or bitmap proof is stale');
  const specPath = join(outputDirectory, 'mars-art-spec.png');
  await specPage.screenshot({ path: specPath, fullPage: true, animations: 'disabled' });
  files.push({ name: 'mars-art-spec.png', path: specPath });

  const contactPage = await context.newPage();
  contactPage.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`contact-sheet: ${message.text()}`);
  });
  contactPage.on('pageerror', (error) => consoleErrors.push(`contact-sheet: ${error.message}`));
  await contactPage.goto(new URL('art/reports/golden-contact-sheet.html', gameUrl).href, { waitUntil: 'networkidle' });
  const contactCards = await contactPage.locator('main article').count();
  if (contactCards !== 26) throw new Error(`Expected 26 golden contact-sheet cards; received ${contactCards}`);
  if (await contactPage.locator('.anchor').count() !== 26 || await contactPage.locator('.footprint').count() !== 26) {
    throw new Error('Golden contact sheet is missing anchor or footprint overlays');
  }
  const contactPath = join(outputDirectory, 'mars-golden-contact-sheet.png');
  await contactPage.screenshot({ path: contactPath, fullPage: true, animations: 'disabled' });
  files.push({ name: 'mars-golden-contact-sheet.png', path: contactPath });

  const comparisons = compareScreenshots(files, baselineDirectory, updateBaseline, maxDiff);
  const failedComparisons = comparisons.filter((comparison) => comparison.status === 'fail');
  const report = {
    url: gameUrl,
    normalGameplayZoom: initial.viewport.scale,
    pixelRendering: initial.rendering,
    proceduralRendering: procedural.rendering,
    artSpec: specState,
    contactSheet: { cards: contactCards, anchors: 26, footprints: 26 },
    screenshots: files,
    comparisons,
    consoleErrors,
  };
  const reportPath = join(outputDirectory, 'visual-report.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`MarsScape visual regression: ${consoleErrors.length || failedComparisons.length ? 'FAIL' : 'PASS'}`);
  console.log(`Screenshots: ${outputDirectory}`);
  console.log(`Pixel sprites: ${initial.rendering.spritesDrawn}; procedural fallback: ${procedural.rendering.proceduralDrawn}; art-spec bitmaps: ${specState.spriteBitmaps}`);
  if (comparisons.length) console.log(`Comparisons: ${comparisons.map((item) => `${item.name}=${item.status}`).join(', ')}`);
  if (consoleErrors.length) console.log(`Console errors: ${consoleErrors.join(' | ')}`);
  if (consoleErrors.length || failedComparisons.length) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (localServer?.processHandle && localServer.processHandle.exitCode === null) localServer.processHandle.kill('SIGTERM');
}
