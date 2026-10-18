/**
 * Last-played marker for the MixMash hub. A game page includes
 *   <script src="/assets/last-game.js" data-game="<catalog id>" defer></script>
 * and this records localStorage mm.lastGame = {"slug": id, "t": ms} on load, so the
 * homepage can tag that game "Continue". It never reads or changes game saves.
 */
(function recordLastGame() {
  'use strict';
  try {
    var script = document.currentScript;
    var slug = script && script.getAttribute('data-game');
    if (!slug || !/^[a-z0-9-]{1,40}$/.test(slug)) return;
    localStorage.setItem('mm.lastGame', JSON.stringify({ slug: slug, t: Date.now() }));
  } catch (error) {
    // Private browsing or blocked storage: the game still plays; the hub just shows no tag.
  }
})();
