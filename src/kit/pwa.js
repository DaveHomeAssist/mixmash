/**
 * MixKit service worker registration (HUB-104)
 *
 * Kept separate from nav.js so the hub — which has its own header and does not
 * load the floating game nav — can still register the worker.
 *
 * Registration is skipped on non-secure origins (the API requires HTTPS or
 * localhost) and on file:// so local file previews don't throw.
 */
(function registerMixmashServiceWorker() {
  'use strict';

  if (!('serviceWorker' in navigator)) return;
  if (!window.isSecureContext) return;
  if (window.location.protocol === 'file:') return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(function (registration) {
        window.__mixmashSW = registration;
        // When a new worker takes over, the next navigation gets fresh assets;
        // no forced reload, which would be hostile mid-match.
        registration.addEventListener('updatefound', function () {
          var installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', function () {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('mixmash:update-ready'));
            }
          });
        });
      })
      .catch(function () {
        // A failed registration is not fatal — the site works online regardless.
      });
  });
})();
