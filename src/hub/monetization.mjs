/**
 * Revenue switches for the static homepage. Everything here ships OFF.
 *
 * Leave a value empty and the homepage renders nothing for it: no markup, no reserved space,
 * no third-party script and no network request. Fill one in, run `npm run hub:build`, and
 * commit the regenerated index.html. See docs/REVENUE_SETUP.md for what each switch does.
 */
export const monetization = {
  // Dave's Ko-fi page, exactly https://ko-fi.com/<name> (Dave's pick, Oct 19). An itch.io page
  // (https://<name>.itch.io/) is the planned second channel; any other https page also works.
  // Shows a "Keep the games free" tip block in the Studio view and a footer link.
  supportUrl: '',
  // Optional label override. Empty: "Support MixMash on Ko-fi" for Ko-fi, else "Support MixMash".
  supportLabel: '',
  // Google AdSense publisher ID (ca-pub- plus 16 digits) and one display ad unit slot ID (digits).
  // Both are required. Enabling also requires a root ads.txt with the same publisher ID.
  adsensePublisherId: '',
  adsenseSlotId: '',
  // Cloudflare Web Analytics site token (32 hex characters, from the JS snippet Cloudflare shows
  // after adding the site). Cookieless, so no consent banner. Loads the official beacon on the
  // homepage and every game wrapper page that includes /assets/analytics.js (not EMPIRES).
  cloudflareAnalyticsToken: '3aeddc4297384179a3dcb309314cb365'
};

const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const KOFI_HOSTS = new Set(['ko-fi.com', 'www.ko-fi.com']);
/** True when the URL is a Ko-fi page. */
export function isKofi(url) {
  try { return KOFI_HOSTS.has(new URL(url).hostname); } catch { return false; }
}
/**
 * A support link is live only for a well-formed https URL. A Ko-fi URL must name a page:
 * https://ko-fi.com/<name> with letters, digits or underscores, no query or fragment.
 */
export function supportEnabled(config = monetization) {
  if (typeof config.supportUrl !== 'string' || !config.supportUrl) return false;
  let url;
  try { url = new URL(config.supportUrl); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  if (KOFI_HOSTS.has(url.hostname)) return /^\/[A-Za-z0-9_]{1,64}\/?$/.test(url.pathname) && !url.search && !url.hash && !url.port;
  return true;
}
const supportLabel = config => config.supportLabel || (isKofi(config.supportUrl) ? 'Support MixMash on Ko-fi' : 'Support MixMash');
const supportCopy = config => isKofi(config.supportUrl)
  ? 'Every MixMash game is free to play, right in your browser. If one made your day, a tip on Ko-fi helps keep the site free and ad-light, and funds new games, stages and fighters.'
  : 'Every MixMash game is free to play, right in your browser. If one made your day, chipping in helps keep the site free and ad-light, and funds new games, stages and fighters.';
// Ko-fi takes one-off tips from guests (help.ko-fi.com: "No, an account is not needed to support you on Ko-fi!").
const supportNote = config => isKofi(config.supportUrl) ? 'One-off tips. No Ko-fi account needed.' : '';
/** Ads are live only with both a valid publisher ID and a numeric slot ID. */
export function adsEnabled(config = monetization) {
  return /^ca-pub-\d{16}$/.test(config.adsensePublisherId || '') && /^\d{6,12}$/.test(config.adsenseSlotId || '');
}
/** "Support MixMash" block for the Studio view. Empty string when disabled. */
export function supportBlock(config = monetization) {
  if (!supportEnabled(config)) return '';
  const note = supportNote(config);
  return `<div class="support-slot" data-support-slot><h3>Keep the games free</h3><p>${escape(supportCopy(config))}</p><a class="button primary" href="${escape(config.supportUrl)}" target="_blank" rel="noopener">${escape(supportLabel(config))} <span aria-hidden="true">↗</span><span class="sr-only"> (external site)</span></a>${note ? `<p class="support-note">${escape(note)}</p>` : ''}</div>`;
}
/** Compact footer link. Empty string when disabled. */
export function supportFooterLink(config = monetization) {
  if (!supportEnabled(config)) return '';
  return `<a class="support-link" data-support-slot href="${escape(config.supportUrl)}" target="_blank" rel="noopener">${escape(supportLabel(config))}<span class="sr-only"> (external site)</span></a>`;
}
/** Head script for AdSense. Empty string when disabled, so nothing third-party loads. */
export function adHead(config = monetization) {
  if (!adsEnabled(config)) return '';
  return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${escape(config.adsensePublisherId)}" crossorigin="anonymous"></script>`;
}
/**
 * One labelled ad unit in the Studio view, never in the game grid or inside a game. The container
 * reserves its height before the ad loads so nothing shifts (CLS-safe). Empty string when disabled.
 */
export function adBlock(config = monetization) {
  if (!adsEnabled(config)) return '';
  return `<aside class="ad-slot" data-ad-slot aria-label="Advertisement"><p class="ad-label">Advertisement</p><ins class="adsbygoogle" style="display:block;width:100%;height:250px" data-ad-client="${escape(config.adsensePublisherId)}" data-ad-slot="${escape(config.adsenseSlotId)}"></ins><script>(window.adsbygoogle = window.adsbygoogle || []).push({});</script></aside>`;
}

/** Cloudflare Web Analytics is live only for a 32-hex-character site token. */
export function analyticsEnabled(config = monetization) {
  return /^[0-9a-f]{32}$/i.test(config.cloudflareAnalyticsToken || '');
}
export const CF_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';
/** The official beacon tag for the static homepage head. Empty string when disabled. */
export function analyticsHead(config = monetization) {
  if (!analyticsEnabled(config)) return '';
  return `<script type="module" src="${CF_BEACON_SRC}" data-cf-beacon='${JSON.stringify({ token: config.cloudflareAnalyticsToken })}'></script>`;
}
/**
 * Body of the generated /assets/analytics.js, the shared include on game wrapper pages. Disabled, it
 * is a comment and requests nothing. Enabled, it appends the same official beacon tag to <head>.
 */
export function analyticsScript(config = monetization) {
  const header = '/* Generated by `npm run hub:build` from src/hub/monetization.mjs (cloudflareAnalyticsToken). Do not edit. */\n';
  if (!analyticsEnabled(config)) return header + '/* Analytics off: no token set, nothing loads. */\n';
  return header + `(function () {
  'use strict';
  if (document.querySelector('script[data-cf-beacon]')) return;
  var beacon = document.createElement('script');
  beacon.type = 'module';
  beacon.src = ${JSON.stringify(CF_BEACON_SRC)};
  beacon.setAttribute('data-cf-beacon', ${JSON.stringify(JSON.stringify({ token: config.cloudflareAnalyticsToken }))});
  document.head.appendChild(beacon);
})();
`;
}
/** Wrapper pages that include /assets/analytics.js. EMPIRES is excluded (separate owner). */
export const ANALYTICS_PAGES = ['play/index.html', 'mars/index.html', 'pitch/index.html', 'garden/index.html', 'front-of-house/index.html'];
const CSP_ADDITIONS = { 'script-src': 'https://static.cloudflareinsights.com', 'connect-src': 'https://cloudflareinsights.com' };
/**
 * Pages with a Content-Security-Policy meta get the beacon's two origins only while analytics is on;
 * turning it off removes them again. Pages without a CSP are returned unchanged.
 */
export function applyAnalyticsCsp(html, config = monetization) {
  return html.replace(/(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/, (all, open, policy, close) => {
    const directives = policy.split(';').map(part => part.trim()).filter(Boolean).map(part => {
      const [name, ...sources] = part.split(/\s+/);
      const extra = CSP_ADDITIONS[name];
      const kept = sources.filter(source => source !== extra);
      if (extra && analyticsEnabled(config)) kept.push(extra);
      return [name, ...kept].join(' ');
    });
    return open + directives.join('; ') + close;
  });
}
