/**
 * Content-Security-Policy for publisher-owned pages (the hub, its static pages and the game
 * wrappers this repo owns). GitHub Pages cannot send response headers, so the policy ships as a
 * <meta http-equiv> tag. `npm run hub:build` writes it; `npm run hub:check` refuses drift.
 *
 * Not covered here on purpose: empires/ (Empires executor), front-of-house/ (its own CSP), mars/
 * (its own CSP), admin/ (its own stricter CSP), and game code served inside wrapper iframes.
 *
 * Meta CSP limits: frame-ancestors, report-uri and sandbox are ignored in a meta tag, so
 * clickjacking protection still needs a header-capable host (see the PR notes on Cloudflare).
 */
import { createHash } from 'node:crypto';
import { analyticsEnabled, monetization } from './monetization.mjs';

export const CF_SCRIPT_ORIGIN = 'https://static.cloudflareinsights.com';
export const CF_CONNECT_ORIGIN = 'https://cloudflareinsights.com';
const FONT_CSS = 'https://fonts.googleapis.com';
const FONT_FILES = 'https://fonts.gstatic.com';

/**
 * Page -> what it loads beyond its own origin.
 * analytics: loads the Cloudflare Web Analytics beacon (hub head tag or /assets/analytics.js).
 * fonts: @imports Google Fonts. frames: allowed iframe sources.
 * optional: skip quietly when the file is absent (privacy/ lands with PR #192).
 */
export const CSP_PAGES = {
  'index.html': { analytics: true },
  'home.html': { fonts: true, frames: ["'self'"] },
  'brand.html': { fonts: true },
  '404.html': { fonts: true },
  'offline.html': {},
  'garden/index.html': { analytics: true, frames: ['https://davehomeassist.github.io'] },
  'privacy/index.html': { optional: true }
};

const EXECUTABLE = /^(|text\/javascript|application\/javascript|module)$/i;
/** sha256 sources for every inline executable <script> (JSON-LD and other data blocks are skipped). */
export function inlineScriptHashes(html) {
  const hashes = [];
  for (const [, attrs = '', body] of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    if (/\ssrc\s*=/i.test(attrs)) continue;
    const type = (attrs.match(/\stype\s*=\s*["']?([^"'\s>]+)/i) || [, ''])[1];
    if (!EXECUTABLE.test(type)) continue;
    const source = `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;
    if (!hashes.includes(source)) hashes.push(source);
  }
  return hashes;
}

/** The policy string for one page. Analytics origins go last so applyAnalyticsCsp stays a no-op. */
export function policyFor(html, page = {}, config = monetization) {
  const cf = page.analytics && analyticsEnabled(config);
  const directives = [
    ['default-src', "'self'"],
    ['script-src', "'self'", ...inlineScriptHashes(html), ...(cf ? [CF_SCRIPT_ORIGIN] : [])],
    ['style-src', "'self'", "'unsafe-inline'", ...(page.fonts ? [FONT_CSS] : [])],
    ['font-src', "'self'", ...(page.fonts ? [FONT_FILES] : [])],
    ['img-src', "'self'", 'data:', 'blob:'],
    ['connect-src', "'self'", ...(cf ? [CF_CONNECT_ORIGIN] : [])],
    ['media-src', "'self'", 'blob:'],
    ['frame-src', ...(page.frames?.length ? page.frames : ["'none'"])],
    ['worker-src', "'self'"],
    ['manifest-src', "'self'"],
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['form-action', "'self'"]
  ];
  return directives.map(parts => parts.join(' ')).join('; ');
}

const CSP_META = /<meta http-equiv="Content-Security-Policy" content="[^"]*">\n?/;
const REFERRER_META = '<meta name="referrer" content="strict-origin-when-cross-origin">';
/**
 * Writes (or rewrites) the CSP meta and a referrer meta directly after the viewport meta, so the
 * policy is parsed before any script or stylesheet. Idempotent.
 */
export function applyPageCsp(html, page = {}, config = monetization) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policyFor(html, page, config)}">`;
  if (CSP_META.test(html)) return html.replace(CSP_META, meta + '\n');
  const viewport = html.match(/<meta name="viewport"[^>]*>\n?/i);
  if (!viewport) throw new Error('Page has no viewport meta to anchor the CSP');
  const tags = [meta, ...(html.includes('<meta name="referrer"') ? [] : [REFERRER_META])].join('\n') + '\n';
  const at = viewport.index + viewport[0].length;
  return html.slice(0, at) + (viewport[0].endsWith('\n') ? '' : '\n') + tags + html.slice(at);
}
