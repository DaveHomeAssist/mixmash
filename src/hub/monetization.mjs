/**
 * Revenue switches for the static homepage. Everything here ships OFF.
 *
 * Leave a value empty and the homepage renders nothing for it: no markup, no reserved space,
 * no third-party script and no network request. Fill one in, run `npm run hub:build`, and
 * commit the regenerated index.html. See docs/REVENUE_SETUP.md for what each switch does.
 */
export const monetization = {
  // A support page Dave already owns, e.g. https://ko-fi.com/<name>, https://www.patreon.com/<name>
  // or https://<name>.itch.io/. Must be https. Shows "Support MixMash" in the Studio view and footer.
  supportUrl: '',
  // Button label for the support link; keep it short.
  supportLabel: 'Support MixMash',
  // Google AdSense publisher ID (ca-pub- plus 16 digits) and one display ad unit slot ID (digits).
  // Both are required. Enabling also requires a root ads.txt with the same publisher ID.
  adsensePublisherId: '',
  adsenseSlotId: ''
};

const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

/** A support link is live only for a well-formed https URL. */
export function supportEnabled(config = monetization) {
  if (typeof config.supportUrl !== 'string' || !config.supportUrl) return false;
  try { return new URL(config.supportUrl).protocol === 'https:'; } catch { return false; }
}
/** Ads are live only with both a valid publisher ID and a numeric slot ID. */
export function adsEnabled(config = monetization) {
  return /^ca-pub-\d{16}$/.test(config.adsensePublisherId || '') && /^\d{6,12}$/.test(config.adsenseSlotId || '');
}
/** "Support MixMash" block for the Studio view. Empty string when disabled. */
export function supportBlock(config = monetization) {
  if (!supportEnabled(config)) return '';
  return `<div class="support-slot" data-support-slot><h3>Keep the games free.</h3><p>Every game here is free to play. If you enjoy one, you can chip in to support new games and updates.</p><a class="button primary" href="${escape(config.supportUrl)}" target="_blank" rel="noopener">${escape(config.supportLabel || 'Support MixMash')} <span aria-hidden="true">↗</span><span class="sr-only"> (external site)</span></a></div>`;
}
/** Compact footer link. Empty string when disabled. */
export function supportFooterLink(config = monetization) {
  if (!supportEnabled(config)) return '';
  return `<a class="support-link" data-support-slot href="${escape(config.supportUrl)}" target="_blank" rel="noopener">${escape(config.supportLabel || 'Support MixMash')}<span class="sr-only"> (external site)</span></a>`;
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
