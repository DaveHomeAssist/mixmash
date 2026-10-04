// Application-owned board facade: failure changes presentation, never the game or save.
import { createBoard } from './board.js';
import { createServiceLayout, projectServiceCrowd } from './service-crowd.mjs';

export function createBoardAdapter(canvas, { enabled = false, onStatus = () => {} } = {}) {
  const fallback = createBoard(canvas);
  let backend = null, layer = null, lastScene = null, clear = null, loading = null, destroyed = false;
  let serviceLayout = null, serviceLayoutKey = '';
  let reason = '', active = false, createRenderer = null, loadAttempt = 0, backendVenue = null;
  const supported = floor => ['lot', 'club', 'amphitheater', 'festival'].includes(floor);
  function sync() {
    active = !!(enabled && backend?.status().state === 'ready' && supported(lastScene?.floor) && backendVenue === lastScene.floor);
    canvas.classList.toggle('board-3d-input', active);
    if (layer) layer.hidden = !active;
    if (!active && lastScene) fallback.draw(lastScene);
    onStatus(status());
  }
  function status() {
    return { enabled, active, state: destroyed ? 'disposed' : loading ? 'loading' : active ? 'ready' : 'fallback',
      reason: reason || (enabled && lastScene?.floor && !supported(lastScene.floor) ? 'This room uses the classic view.' : ''),
      backend: backend?.status().state || null };
  }
  async function initialize() {
    if (destroyed || !enabled || loading || !supported(lastScene?.floor)) return loading;
    loading = Promise.resolve().then(async () => {
      try {
        if (!createRenderer) {
          const moduleURL = new URL('./lot-renderer.mjs', import.meta.url);
          if (loadAttempt) moduleURL.searchParams.set('retry', String(loadAttempt));
          loadAttempt += 1;
          createRenderer = (await import(moduleURL.href)).createLotRenderer;
        }
        if (destroyed || !enabled || !supported(lastScene?.floor)) return;
        backend?.destroy(); backend = null; backendVenue = lastScene.floor; layer?.remove();
        layer = document.createElement('canvas'); layer.className = 'lot-webgl'; layer.setAttribute('aria-hidden', 'true');
        canvas.before(layer);
        backend = createRenderer(layer, { venue: backendVenue, deferRendering: true, onStatus: s => {
          if (destroyed) return;
          reason = s.state === 'lost' || s.state === 'failed' ? '3D is unavailable. Your show is unchanged in the classic view.' : '';
          sync();
        } });
        backend.setClear(clear);
        if (supported(lastScene?.floor) && backendVenue === lastScene.floor) backend.draw(lastScene);
      } catch {
        backend?.destroy(); backend = null; layer?.remove(); layer = null;
        reason = '3D could not start. Your show is unchanged in the classic view.';
      } finally { loading = null; sync(); }
    });
    sync(); return loading;
  }
  function current() { return active ? backend : fallback; }
  function draw(scene) {
    if (destroyed) return;
    if (scene.services) {
      const key = JSON.stringify([scene.objects, scene.grid, !!scene.services.departure]);
      if (key !== serviceLayoutKey) { serviceLayout = createServiceLayout(scene.objects, scene.grid, scene.services.departure?.access); serviceLayoutKey = key; }
      scene = { ...scene, serviceCrowd: projectServiceCrowd(serviceLayout, scene.services, scene.serviceMinute, scene.serviceProgress) };
    }
    lastScene = scene;
    if (enabled && backend?.status().state === 'ready' && supported(scene.floor) && backendVenue === scene.floor) backend.draw(scene);
    sync();
    if (enabled && (!backend || backendVenue !== scene.floor) && supported(scene.floor) && !loading && !reason) void initialize();
  }
  function resize() { fallback.resize(); backend?.resize(); }
  function destroy() {
    if (destroyed) return;
    destroyed = true; backend?.destroy(); fallback.destroy(); layer?.remove(); canvas.classList.remove('board-3d-input'); active = false;
  }
  const api = { draw, resize, destroy, status,
    pickAt: (x, y) => active ? backend.pickAt(x, y) : { object: fallback.objectAt(x, y), blocked: false },
    setEnabled: (value) => { enabled = !!value; reason = ''; sync(); if (enabled && (!backend || backendVenue !== lastScene?.floor || backend.status().state === 'failed')) return initialize(); if (active && lastScene) backend.draw(lastScene); return Promise.resolve(); },
    retry: () => { enabled = true; reason = ''; return initialize(); },
    setClear: (rect) => { clear = rect; fallback.setClear(rect); backend?.setClear(rect); },
    info: () => ({ ...current().info(), renderer: active ? 'three-webgl' : 'canvas-2d', adapter: status(), serviceCrowd: lastScene?.serviceCrowd || null }),
    setCamera: (value) => active ? backend.setCamera(value) : null,
    preset: (name) => active ? backend.preset(name) : false,
    placeOf: (x, y) => active ? { renderer: 'three-webgl', ground: backend.clientOf(x, y) } : fallback.placeOf(x, y),
  };
  for (const name of ['tileAt', 'objectAt', 'zoomTo', 'zoomBy', 'camera', 'clientOf', 'panBy', 'follow', 'centerOn', 'turnView']) api[name] = (...args) => current()[name](...args);
  return api;
}
