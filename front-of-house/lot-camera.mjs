// Logical-unit perspective camera. Presentation only: never reads or writes a save.
import { clipGround } from './site-map-geometry.mjs';
import { OBJECT_TYPES } from './data.mjs';
import { AUTHORING_REFERENCE } from './lot-models.mjs';
import { PerspectiveCamera, Vector2, Vector3, Raycaster, Plane, Matrix4 } from './vendor/three/three.module.min.js';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const finite = (n, fallback) => Number.isFinite(n) ? n : fallback;
const radians = (degrees) => degrees * Math.PI / 180;
export const LOT_ZOOMS = Object.freeze([1, 1.5, 2, 3]);

export function createLotCamera({ width = 24, depth = 16 } = {}) {
  const camera = new PerspectiveCamera(42, 1, 0.05, 1000);
  const raycaster = new Raycaster();
  const ground = new Plane(new Vector3(0, 1, 0), 0);
  const state = { yaw: 45, pitch: 48, zoom: 1, x: width / 2, y: depth / 2, preset: 'wide' };
  let rect = { x: 0, y: 0, w: 1, h: 1 };
  let safe = { x: 0, y: 0, w: 1, h: 1 };
  let distance = 40;
  let fitted = null;
  let stage = { x: 12, y: 1.5, rot: 0, w: 6, h: 3 };
  let authoredEye = null;

  function project(x, y, height = 0) {
    const p = new Vector3(x, height, y).project(camera);
    const sx = (p.x + 1) * rect.w / 2;
    const sy = (1 - p.y) * rect.h / 2;
    return { x: rect.x + sx, y: rect.y + sy,
      inside: sx >= 0 && sy >= 0 && sx <= rect.w && sy <= rect.h,
      clear: sx >= safe.x && sy >= safe.y && sx <= safe.x + safe.w && sy <= safe.y + safe.h,
      visible: p.z >= -1 && p.z <= 1 };
  }

  function pose(d) {
    const yaw = radians(state.yaw), pitch = radians(state.pitch);
    const target = new Vector3(state.x, 0, state.y);
    camera.zoom = 1;
    camera.position.set(target.x + d * Math.cos(pitch) * Math.sin(yaw), d * Math.sin(pitch), target.z + d * Math.cos(pitch) * Math.cos(yaw));
    camera.up.set(0, state.pitch === 90 ? 0 : 1, state.pitch === 90 ? -1 : 0);
    if (state.preset === 'foh' || state.preset === 'stage') {
      const [fx, fz] = [[0, 1], [-1, 0], [0, -1], [1, 0]][stage.rot];
      const eyeHeight = AUTHORING_REFERENCE.operatorEyeMetres / AUTHORING_REFERENCE.metresPerTile;
      const deck = AUTHORING_REFERENCE.stageDeckMetres / AUTHORING_REFERENCE.metresPerTile;
      const dx = state.x - width / 2, dz = state.y - depth / 2;
      const front = (stage.rot % 2 ? stage.w : stage.h) / 2;
      if (state.preset === 'foh') {
        camera.position.set(stage.x + fx * (front + 7.5) + dx, eyeHeight, stage.y + fz * (front + 7.5) + dz);
        target.set(stage.x + dx, deck + 0.4, stage.y + dz);
      } else {
        camera.position.set(stage.x - fx * 0.5 + dx, deck + eyeHeight, stage.y - fz * 0.5 + dz);
        target.set(stage.x + fx * 8 + dx, 0.65, stage.y + fz * 8 + dz);
      }
      authoredEye = { position: camera.position.toArray(), target: target.toArray(), reference: 'provisional authored scale' };
      camera.zoom = state.zoom;
    } else authoredEye = null;
    camera.lookAt(target);
    camera.aspect = rect.w / rect.h;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    // Shift the optical center into the free HUD rectangle without changing CSS coordinates.
    camera.projectionMatrix.elements[8] = -(2 * (safe.x + safe.w / 2) / rect.w - 1);
    camera.projectionMatrix.elements[9] = -(1 - 2 * (safe.y + safe.h / 2) / rect.h);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld(true);
  }

  function apply() {
    if (state.preset === 'foh' || state.preset === 'stage') { pose(1); distance = camera.position.distanceTo(new Vector3(...authoredEye.target)); return; }
    // Fit the whole logical volume, including tall props, then apply bounded zoom.
    // Fit uses the actual safe rectangle at the current yaw and pitch, not a fixed aspect guess.
    // Pan and zoom do not change the centered volume fit. Keep its projection inputs explicit.
    const fitKey = [width, depth, state.yaw, state.pitch, rect.x, rect.y, rect.w, rect.h, safe.x, safe.y, safe.w, safe.h, camera.fov, camera.near, camera.far, camera.filmGauge, camera.filmOffset].join(',');
    if (fitted?.key !== fitKey) {
      const x = state.x, y = state.y;
      state.x = width / 2; state.y = depth / 2;
      const fits = (d) => {
        pose(d);
        return [0, width].every(a => [0, depth].every(b => [0, 3.5].every(h => {
          const p = project(a, b, h);
          return p.visible && p.x >= rect.x + safe.x + safe.w * 0.04 && p.x <= rect.x + safe.x + safe.w * 0.96 && p.y >= rect.y + safe.y + safe.h * 0.04 && p.y <= rect.y + safe.y + safe.h * 0.96;
        })));
      };
      let lo = 4, hi = 500;
      for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
      state.x = x; state.y = y;
      fitted = { key: fitKey, distance: hi };
    }
    distance = fitted.distance / state.zoom;
    pose(distance);
  }

  function setCamera(next = {}) {
    state.yaw = ((finite(next.yaw, state.yaw) % 360) + 360) % 360;
    state.pitch = clamp(finite(next.pitch, state.pitch === 90 ? 85 : state.pitch), 15, 85);
    state.zoom = clamp(finite(next.zoom, state.zoom), 1, 3);
    state.x = clamp(finite(next.x, state.x), 0, width);
    state.y = clamp(finite(next.y, state.y), 0, depth);
    state.preset = 'orbit';
    apply();
    return info();
  }

  function resize(bounds, clear = null) {
    rect = { x: finite(bounds.x, 0), y: finite(bounds.y, 0), w: Math.max(1, finite(bounds.w, 1)), h: Math.max(1, finite(bounds.h, 1)) };
    const c = clear || { x: 0, y: 0, w: rect.w, h: rect.h };
    const x = clamp(finite(c.x, 0), 0, rect.w - 1), y = clamp(finite(c.y, 0), 0, rect.h - 1);
    safe = { x, y, w: clamp(finite(c.w, rect.w), 1, rect.w - x), h: clamp(finite(c.h, rect.h), 1, rect.h - y) };
    apply();
  }

  function ray(clientX, clientY) {
    raycaster.setFromCamera(new Vector2((clientX - rect.x) / rect.w * 2 - 1, 1 - (clientY - rect.y) / rect.h * 2), camera);
    return raycaster;
  }
  function groundAt(clientX, clientY) {
    const p = ray(clientX, clientY).ray.intersectPlane(ground, new Vector3());
    return p ? { x: p.x, y: p.z } : null;
  }
  function tileAt(clientX, clientY) {
    const p = groundAt(clientX, clientY);
    return p && p.x >= 0 && p.y >= 0 && p.x < width && p.y < depth ? { x: Math.floor(p.x), y: Math.floor(p.y) } : null;
  }
  function zoomTo(zoom, px = rect.w / 2, py = rect.h / 2) {
    const before = groundAt(rect.x + px, rect.y + py);
    state.zoom = clamp(finite(zoom, state.zoom), 1, 3);
    if (state.zoom === 1) { state.x = width / 2; state.y = depth / 2; }
    apply();
    const after = groundAt(rect.x + px, rect.y + py);
    if (state.zoom !== 1 && before && after) {
      state.x = clamp(state.x + before.x - after.x, 0, width);
      state.y = clamp(state.y + before.y - after.y, 0, depth);
      apply();
    }
    return state.zoom;
  }
  function panBy(dx, dy) {
    const cx = rect.x + safe.x + safe.w / 2, cy = rect.y + safe.y + safe.h / 2;
    const a = groundAt(cx, cy), b = groundAt(cx + dx, cy + dy);
    if (!a || !b) return false;
    state.x = clamp(state.x + a.x - b.x, 0, width); state.y = clamp(state.y + a.y - b.y, 0, depth); apply(); return true;
  }
  function preset(name) {
    if (!['wide', 'foh', 'stage', 'plan'].includes(name)) return false;
    Object.assign(state, { x: width / 2, y: depth / 2, zoom: 1, yaw: 0, pitch: 48, preset: name });
    // Authored eye positions use the documented provisional scale; field calibration remains pending.
    if (name === 'wide') state.yaw = 45;
    if (name === 'foh') Object.assign(state, { pitch: 15, yaw: (360 - stage.rot * 90) % 360 });
    if (name === 'stage') Object.assign(state, { yaw: (540 - stage.rot * 90) % 360, pitch: 20 });
    if (name === 'plan') state.pitch = 90;
    apply(); return true;
  }
  function info() { return { ...state, authoredEye: authoredEye ? structuredClone(authoredEye) : null, zooms: [...LOT_ZOOMS], distance, safe: { ...safe }, viewport: { ...rect } }; }
  function navigation() {
    const m = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements;
    const component = row => p => m[row] * p.x + m[8 + row] * p.y + m[12 + row];
    const x = component(0), y = component(1), z = component(2), w = component(3);
    const left = 2 * safe.x / rect.w - 1, right = 2 * (safe.x + safe.w) / rect.w - 1;
    const top = 1 - 2 * safe.y / rect.h, bottom = 1 - 2 * (safe.y + safe.h) / rect.h;
    return { width, depth, rotation: state.yaw, footprint: clipGround(width, depth, [p => x(p) - left * w(p), p => right * w(p) - x(p), p => y(p) - bottom * w(p), p => top * w(p) - y(p), p => z(p) + w(p), p => w(p) - z(p), p => w(p) - 1e-8]) };
  }
  function panTo(x, y) { state.x = clamp(finite(x, state.x), 0, width); state.y = clamp(finite(y, state.y), 0, depth); apply(); }
  function setStage(object) {
    if (!object) return;
    const rot = object.rot || 0, spec = OBJECT_TYPES.stage, w = rot % 2 ? spec.h : spec.w, h = rot % 2 ? spec.w : spec.h;
    stage = { x: object.x + w / 2, y: object.y + h / 2, rot, w, h }; apply();
  }
  apply();
  return { setStage, navigation, panTo, camera, resize, setCamera, preset, project, ray, groundAt, tileAt, zoomTo, panBy, info };
}
