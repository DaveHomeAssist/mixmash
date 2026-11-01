/** Publisher pages ship a meta CSP that matches src/hub/csp.mjs and allows what each page loads. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CSP_PAGES, CF_CONNECT_ORIGIN, CF_SCRIPT_ORIGIN, applyPageCsp, inlineScriptHashes } from '../src/hub/csp.mjs';
import { analyticsEnabled } from '../src/hub/monetization.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const pages = Object.entries(CSP_PAGES).filter(([, options]) => !options.optional);
const policyOf = html => html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/)?.[1];
const directive = (policy, name) => policy.split(';').map(s => s.trim()).find(s => s.startsWith(name + ' '))?.split(/\s+/).slice(1) || [];

test('every publisher page carries exactly the generated CSP, before any script or stylesheet', async () => {
  for (const [path, options] of pages) {
    const html = await read(path);
    assert.equal(html.match(/http-equiv="Content-Security-Policy"/g)?.length, 1, `${path}: one CSP meta`);
    assert.equal(applyPageCsp(html, options), html, `${path}: CSP drift, run npm run hub:build`);
    const at = html.indexOf('http-equiv="Content-Security-Policy"');
    for (const marker of ['<script', '<link rel="stylesheet"', '<style']) {
      const first = html.indexOf(marker);
      if (first !== -1) assert.ok(at < first, `${path}: CSP precedes ${marker}`);
    }
    assert.match(html, /<meta name="referrer" content="strict-origin-when-cross-origin">/, `${path}: referrer policy`);
  }
});

test('scripts stay locked: no unsafe-inline or unsafe-eval scripts, no inline handlers, every inline script hashed', async () => {
  for (const [path] of pages) {
    const html = await read(path);
    const scripts = directive(policyOf(html), 'script-src');
    assert.ok(!scripts.includes("'unsafe-inline'") && !scripts.includes("'unsafe-eval'"), `${path}: script-src stays strict`);
    for (const hash of inlineScriptHashes(html)) assert.ok(scripts.includes(hash), `${path}: ${hash} allowed`);
    assert.doesNotMatch(html, /<[a-z][^>]*\son[a-z]+\s*=\s*["']/i, `${path}: inline event handler would be blocked`);
    assert.deepEqual(directive(policyOf(html), 'object-src'), ["'none'"]);
  }
});

test('analytics pages allow the Cloudflare beacon; framing pages allow exactly their iframe origins', async () => {
  for (const [path, options] of pages) {
    const html = await read(path), policy = policyOf(html);
    const on = Boolean(options.analytics && analyticsEnabled());
    assert.equal(directive(policy, 'script-src').includes(CF_SCRIPT_ORIGIN), on, `${path}: beacon script origin`);
    assert.equal(directive(policy, 'connect-src').includes(CF_CONNECT_ORIGIN), on, `${path}: beacon connect origin`);
    const frames = directive(policy, 'frame-src');
    for (const [, src] of html.matchAll(/<iframe[^>]*\ssrc="(https?:[^"]+)"/g)) {
      assert.ok(frames.includes(new URL(src).origin), `${path}: frame-src allows ${new URL(src).origin}`);
    }
    if (/@import url\('https:\/\/fonts\.googleapis\.com/.test(html)) assert.ok(directive(policy, 'font-src').includes('https://fonts.gstatic.com'), `${path}: fonts`);
  }
});
