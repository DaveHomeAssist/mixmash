// Lot, Club, amphitheater and Festival preview WebGL backend. Scene snapshots are presentation inputs, never simulation authority.
import * as T from './vendor/three/three.module.min.js';
import { createLotCamera, LOT_ZOOMS } from './lot-camera.mjs';
import { createLotModels, MODEL_REVISION, MODEL_METADATA, FESTIVAL_SCENE } from './lot-models.mjs';
import { createLotPresentation, stageRepresentatives } from './lot-presentation.mjs';
import { OBJECT_TYPES, VENUES } from './data.mjs';

export function createLotRenderer(canvas, { onStatus = () => {}, pixelRatio = null, reducedMotion = null, deferRendering = false, venue = 'lot' } = {}) {
  if (!['lot', 'club', 'amphitheater', 'festival'].includes(venue)) throw new Error('Unsupported 3D preview room');
  const spec = VENUES[venue], { w: width, h: depth } = spec.grid;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping;
  const festival = venue === 'festival', camera = createLotCamera(festival ? { width: FESTIVAL_SCENE.width, depth: FESTIVAL_SCENE.depth } : { width, depth }), models = createLotModels(), world = new T.Scene();
  const props = new T.Group(), overlays = new T.Group(), presentation = createLotPresentation(models, { width, depth, pillars: spec.pillars, indoor: venue === 'club' }), room = models.room(spec);
  const sidePresentation = festival ? createLotPresentation(models, { width: FESTIVAL_SCENE.annex.w, depth: FESTIVAL_SCENE.annex.h, indoor: true }) : null;
  if (sidePresentation) sidePresentation.group.position.x = FESTIVAL_SCENE.annex.x;
  let stageAudience = null;
  const media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  let motion = reducedMotion === null ? !media?.matches : !reducedMotion;
  const floorGeometry = new T.PlaneGeometry(width, depth), floorMaterial = models.material(venue === 'club' ? 0x4b4040 : venue === 'amphitheater' ? 0x354532 : 0x373b3c, 0, 0.97).clone();
  const floorMap = floorMaterial.map.clone(); floorMap.repeat.set(width * 2, depth * 2); floorMap.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); floorMap.needsUpdate = true; floorMaterial.map = floorMap;
  const floor = new T.Mesh(floorGeometry, floorMaterial); floor.rotation.x = -Math.PI / 2; floor.position.set(width / 2, -0.01, depth / 2); floor.receiveShadow = true;
  const sky = new T.HemisphereLight(0xdce9ff, 0x343a35, 2.2);
  const sun = new T.DirectionalLight(0xffefd8, 3); sun.position.set(5, 28, 15); sun.target.position.set(12, 0, 8);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 }); sun.shadow.bias = -0.0005;
  const stageLight = new T.PointLight(0x54b9ff, 60, 22, 2); stageLight.position.set(12, 3, 3);
  world.add(floor, room, props, presentation.group, overlays, sky, sun, sun.target, stageLight);
  if (sidePresentation) { world.add(sidePresentation.group); sun.position.set(19, 32, 27); sun.target.position.set(26, 0, 12); Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, far: 120 }); }
  let state = 'ready', reason = '', lastScene = null, clear = null, layoutKey = '', overlayKey = '', paused = false, disposed = false;
  let objects = [], pickables = [], objectHeights = [];
  let shadowKey = '', shadowUpdates = 0, renderedFrames = 0;
  let requestedDpr = 1, densityMedia = null, renderFrame = 0;
  const ownedOverlayMaterials = new Map();

  function report(next, detail = '') { state = next; reason = detail; onStatus({ state, reason }); }
  function density() { const value = pixelRatio ?? globalThis.devicePixelRatio; return Number.isFinite(value) && value > 0 ? value : 1; }
  function bounds() { const r = canvas.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
  function overlayMaterial(color, opacity) {
    const key = `${color}:${opacity}`;
    if (!ownedOverlayMaterials.has(key)) ownedOverlayMaterials.set(key, new T.MeshBasicMaterial({ color, opacity, transparent: opacity < 1, depthWrite: false, side: T.DoubleSide }));
    return ownedOverlayMaterials.get(key);
  }
  function clearOverlays() { for (const child of [...overlays.children]) { child.geometry.dispose(); overlays.remove(child); } }
  function cell(x, y, w, h, color, opacity = 0.25) {
    const mesh = new T.Mesh(new T.PlaneGeometry(w, h), overlayMaterial(color, opacity));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x + w / 2, 0.025, y + h / 2); overlays.add(mesh);
  }
  function outline(o, color) {
    const spec = OBJECT_TYPES[o.type] || { w: 1, h: 1 }, w = o.rot % 2 ? spec.h : spec.w, h = o.rot % 2 ? spec.w : spec.h;
    const t = 0.06; cell(o.x, o.y, w, t, color, 1); cell(o.x, o.y + h - t, w, t, color, 1); cell(o.x, o.y, t, h, color, 1); cell(o.x + w - t, o.y, t, h, color, 1);
  }
  function rebuildObjects(input) {
    props.clear(); pickables = []; objectHeights = []; objects = input.map(o => ({ ...o }));
    objects.forEach((o, index) => {
      const group = models.create(o); if (!group) return;
      group.traverse(mesh => { if (mesh.isMesh) { mesh.userData.objectIndex = index; pickables.push(mesh); } }); props.add(group);
      objectHeights[index] = new T.Box3().setFromObject(group).max.y;
    });
    const stage = objects.find(o => o.type === 'stage'); camera.setStage(stage);
    if (stage) { const spec = OBJECT_TYPES.stage; stageLight.position.set(stage.x + (stage.rot % 2 ? spec.h : spec.w) / 2, 2.8, stage.y + (stage.rot % 2 ? spec.w : spec.h) / 2); }
  }
  function render() {
    if (disposed || paused || state !== 'ready' || globalThis.document?.hidden) return;
    if (!deferRendering) { renderNow(); return; }
    if (!renderFrame) renderFrame = requestAnimationFrame(renderNow);
  }
  function cancelRender() { if (renderFrame) cancelAnimationFrame(renderFrame); renderFrame = 0; }
  function renderNow() {
    renderFrame = 0;
    if (disposed || paused || state !== 'ready' || globalThis.document?.hidden) return;
    // Some browser density changes update media matches without delivering a change event.
    if (pixelRatio === null && density() !== requestedDpr) { resize(); return; }
    try {
      const updateShadow = renderer.shadowMap.needsUpdate;
      renderer.render(world, camera.camera); renderedFrames++;
      if (updateShadow) shadowUpdates++;
    } catch (error) { report('failed', error.message); }
  }
  function draw(input) {
    if (disposed) return;
    if (input.floor && input.floor !== venue) throw new Error('Scene does not match this preview room');
    lastScene = input;
    const key = JSON.stringify(input.objects || []);
    if (key !== layoutKey) { rebuildObjects(input.objects || []); layoutKey = key; }
    stageAudience = festival ? stageRepresentatives(input.crowd, input.stageAudience) : null;
    presentation.update(stageAudience ? { ...input, crowd: stageAudience.displayed.main } : input, objects, objectHeights, motion, stageAudience?.representatives.main);
    if (sidePresentation) sidePresentation.update({ ...input, crowd: stageAudience.displayed.second, incident: input.incident === 'rain' ? 'rain' : null, showClear: false }, [{ type: 'stage', x: 3, y: 1, rot: 0 }], [0.55], motion, stageAudience.representatives.second);
    // Track the actual instance buffers, including a lone worker and paused queue changes.
    const casters = [...presentation.group.children, ...(sidePresentation?.group.children || [])].filter(mesh => mesh.isInstancedMesh && mesh.castShadow);
    const nextShadow = JSON.stringify([key, ...casters.map(mesh => [mesh.count, mesh.count ? mesh.instanceMatrix.version : 0])]);
    if (nextShadow !== shadowKey) { renderer.shadowMap.needsUpdate = true; shadowKey = nextShadow; }
    const nextOverlay = JSON.stringify([key, input.showClear, [...(input.clearSet || [])], [...(input.blockedSet || [])], input.cursor, input.cursorColor, input.selection, input.ghost]);
    if (nextOverlay !== overlayKey) {
      clearOverlays();
      if (input.showClear) {
        for (const s of input.clearSet || []) { const [x, y] = s.split(',').map(Number); cell(x, y, 1, 1, 0x31bec2, 0.2); }
        for (const s of input.blockedSet || []) { const [x, y] = s.split(',').map(Number); cell(x, y, 1, 1, 0xf17e72, 0.35); }
      }
      if (input.selection) outline(input.selection, 0xfacc15);
      if (input.ghost) outline(input.ghost, input.ghost.valid ? 0x79d4a2 : 0xf26d63);
      if (input.cursor) outline({ ...input.cursor, rot: 0 }, input.cursorColor || 0xffffff);
      overlayKey = nextOverlay;
    }
    const night = !!input.night;
    world.background = new T.Color(venue === 'club' ? (night ? 0x15121d : 0x55515a) : (night ? 0x111923 : 0x85949d));
    sky.intensity = night ? 1.15 : 2.2; sun.intensity = night ? 0.7 : 3; stageLight.intensity = night && input.lightTower ? 60 : 0;
    render();
  }
  function resize() {
    if (disposed) return;
    const r = bounds(), width = Math.max(1, r.w), height = Math.max(1, r.h);
    const changed = requestedDpr !== density(); requestedDpr = density();
    let dpr = Math.min(2, Math.max(1, requestedDpr));
    if (width * height * dpr * dpr > 6000000) dpr = Math.min(dpr, 1.5);
    if (renderer.getPixelRatio() !== dpr) renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false); camera.resize(r, clear);
    if (changed) watchDensity();
    render();
  }
  function watchDensity() {
    densityMedia?.removeEventListener('change', densityChanged);
    if (disposed || pixelRatio !== null) return;
    const dpr = globalThis.devicePixelRatio;
    densityMedia = globalThis.matchMedia?.(`(resolution: ${Number.isFinite(dpr) && dpr > 0 ? dpr : 1}dppx)`);
    densityMedia?.addEventListener('change', densityChanged);
  }
  function densityChanged() { if (disposed) return; watchDensity(); resize(); }
  function pickAt(x, y) {
    if (disposed || state !== 'ready') return { object: null, blocked: false };
    world.updateMatrixWorld(true);
    const hits = camera.ray(x, y).intersectObjects([...pickables, ...room.children.filter(mesh => !mesh.userData.pickThrough)], false);
    const hit = hits.sort((a, b) => a.distance - b.distance || a.object.userData.objectIndex - b.object.userData.objectIndex)[0];
    return { object: hit && !hit.object.userData.permanent ? { ...objects[hit.object.userData.objectIndex] } : null, blocked: !!hit?.object.userData.permanent };
  }
  function contextLost(event) { event.preventDefault(); cancelRender(); report('lost', 'WebGL context lost; retain the current game and use the fallback board.'); }
  function contextRestored() { if (disposed) return; renderer.shadowMap.needsUpdate = true; report('ready'); resize(); if (lastScene) draw(lastScene); }
  function visibility() { if (globalThis.document?.hidden) cancelRender(); else render(); }
  function motionChanged() { if (reducedMotion === null) { motion = !media?.matches; if (lastScene) draw(lastScene); } }
  media?.addEventListener('change', motionChanged);
  canvas.addEventListener('webglcontextlost', contextLost); canvas.addEventListener('webglcontextrestored', contextRestored);
  globalThis.document?.addEventListener('visibilitychange', visibility);
  function destroy() {
    if (disposed) return;
    disposed = true; cancelRender();
    canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored); globalThis.document?.removeEventListener('visibilitychange', visibility);
    media?.removeEventListener('change', motionChanged); densityMedia?.removeEventListener('change', densityChanged); densityMedia = null; presentation.dispose(); sidePresentation?.dispose();
    clearOverlays(); ownedOverlayMaterials.forEach(m => m.dispose()); ownedOverlayMaterials.clear(); models.dispose(); floorGeometry.dispose(); floorMaterial.dispose(); floorMap.dispose(); sun.shadow.dispose(); renderer.dispose(); world.clear(); objects = []; pickables = []; lastScene = null; report('disposed');
  }
  resize(); watchDensity();
  return {
    draw, resize, pickAt, objectAt: (x, y) => pickAt(x, y).object, destroy,
    setClear: (value) => { clear = value; resize(); },
    camera: () => camera.info(),
    navigation: () => ({ ...camera.navigation(), fixed: festival ? [{ ...FESTIVAL_SCENE.annex, kind: 'ground' }, { ...FESTIVAL_SCENE.stage, kind: 'stage' }] : [] }),
    panTo: (x, y) => { camera.panTo(x, y); render(); },
    setCamera: (value) => { const c = camera.setCamera(value); render(); return c; },
    preset: (name) => { if (name === 'side' && festival) { camera.setCamera({ x: 46, y: 7, zoom: 2, yaw: 0, pitch: 48 }); render(); return true; } const ok = camera.preset(name); render(); return ok; },
    clientOf: (x, y, z = 0) => camera.project(x, y, z),
    tileAt: (x, y) => { const tile = camera.tileAt(x, y); return tile && tile.x < width && tile.y < depth ? tile : null; },
    zoomTo: (z, x, y) => { const result = camera.zoomTo(z, x, y); render(); return result; },
    zoomBy: (steps, x, y) => {
      const current = camera.info().zoom;
      if (!Number.isFinite(steps) || !steps) return current;
      const stops = steps > 0 ? LOT_ZOOMS.filter(z => z > current) : [...LOT_ZOOMS].reverse().filter(z => z < current);
      const next = stops[Math.min(stops.length - 1, Math.abs(Math.trunc(steps)) - 1)] ?? (steps > 0 ? 3 : 1);
      const result = camera.zoomTo(next, x, y); render(); return result;
    },
    panBy: (x, y) => { const result = camera.panBy(x, y); render(); return result; },
    centerOn: (x, y) => { camera.setCamera({ x, y, zoom: 2 }); render(); },
    follow: (x, y) => { const p = camera.project(x + 0.5, y + 0.5); if (!p.clear) { camera.setCamera({ x, y }); render(); } },
    turnView: () => { const yaw = camera.info().yaw + 90; camera.setCamera({ yaw }); render(); return Math.floor(((yaw % 360) + 360) % 360 / 90); },
    pause: () => { paused = true; cancelRender(); }, resume: () => { paused = false; render(); },
    status: () => ({ state, reason }),
    info: () => ({ renderer: 'three-webgl', venue, grid: { ...spec.grid }, presentationExtent: festival ? { w: FESTIVAL_SCENE.width, h: FESTIVAL_SCENE.depth } : { ...spec.grid }, secondaryStage: festival ? { booked: !!lastScene?.secondaryStage?.booked, artist: lastScene?.secondaryStage?.artist || null, audience: stageAudience, presentation: sidePresentation.info() } : null, permanent: room.children.filter(mesh => !mesh.userData.pickThrough).map(mesh => mesh.name), seatingGuides: spec.seats ? { capacity: spec.seats, illustrative: true, ids: room.children.filter(mesh => mesh.userData.pickThrough).map(mesh => mesh.name) } : null, revision: MODEL_REVISION, provenance: MODEL_METADATA, camera: camera.info(), status: state, objects: objects.map(o => ({ ...o })), representativeGuests: presentation.info().representativeGuests + (sidePresentation?.info().representativeGuests || 0), presentation: presentation.info(), motion, representedAttendance: lastScene?.crowd || 0, resources: { ...renderer.info.memory }, modelResources: models.counts(), requestedDpr, dpr: renderer.getPixelRatio(), backing: { width: canvas.width, height: canvas.height }, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, renderedFrames, shadowUpdates, deferredRendering: deferRendering, pendingRender: !!renderFrame }),
  };
}
