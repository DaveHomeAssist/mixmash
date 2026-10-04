// Source-authored Lot samples. The dimensional reference is provisional, not field calibration.
import * as T from './vendor/three/three.module.min.js';
import { OBJECT_TYPES } from './data.mjs';

export const MODEL_REVISION = 'lot-sample-4';
export const AUTHORING_REFERENCE = Object.freeze({
  metresPerTile: 2, status: 'provisional authoring convention; physical calibration pending',
  guestHeightMetres: 1.8, operatorEyeMetres: 1.66, stageDeckMetres: 1.1,
  barCounterMetres: 1.1, restroomHeightMetres: 2.3,
});
export const MODEL_METADATA = Object.freeze({
  author: 'Codex for Front of House', source: 'Procedural geometry and materials in lot-models.mjs',
  rights: 'Newly authored project content; Three.js MIT license retained separately',
  units: 'logical tiles using the provisional authoring reference', pivot: 'rotated footprint center at ground',
  forward: '+Z before rotation', acceptance: 'authored sample candidate; final art and physical review pending',
  materials: 'procedural grain, explicit roughness/metalness; no external imagery',
  reference: AUTHORING_REFERENCE,
});

const COLORS = { steel: 0x31363d, aluminium: 0xb0b8bd, fabric: 0x181b20, wood: 0x79654c, plastic: 0x456778, trim: 0xc5c9bf };
export function createLotModels() {
  const geometries = new Set(), materials = new Map(), textures = new Set();
  const shape = {
    box: new T.BoxGeometry(1, 1, 1), sphere: new T.SphereGeometry(1, 16, 12),
    cylinder: new T.CylinderGeometry(0.5, 0.5, 1, 12),
    torso: new T.CylinderGeometry(0.46, 0.38, 1, 12),
  };
  Object.values(shape).forEach(g => geometries.add(g));
  const pixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const at = (y * 64 + x) * 4;
    let seed = x + y * 64 + 1; seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b); seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
    const n = 220 + ((seed ^ (seed >>> 16)) >>> 0) % 36;
    pixels.set([n, n, n, 255], at);
  }
  const grain = new T.DataTexture(pixels, 64, 64); grain.colorSpace = T.SRGBColorSpace;
  grain.minFilter = T.LinearMipmapLinearFilter; grain.magFilter = T.LinearFilter; grain.generateMipmaps = true;
  grain.wrapS = grain.wrapT = T.RepeatWrapping; grain.repeat.set(4, 4); grain.needsUpdate = true; textures.add(grain);
  function material(color, metalness = 0, roughness = 0.8) {
    const key = `${color}:${metalness}:${roughness}`;
    if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, metalness, roughness, map: grain }));
    return materials.get(key);
  }
  function part(group, size, position, color, metal = 0, form = 'box', name = '') {
    const mesh = new T.Mesh(shape[form], material(color, metal));
    mesh.scale.set(...size); mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = name; group.add(mesh); return mesh;
  }
  function create(object) {
    const spec = OBJECT_TYPES[object.type];
    if (!spec || spec.kit) return null;
    const g = new T.Group(), w = spec.w, h = spec.h;
    const b = (size, position, color, metal = 0, form = 'box') => part(g, size, position, color, metal, form);
    if (object.type === 'stage') {
      b([w, 0.13, h], [0, 0.485, 0], COLORS.steel);
      for (const z of [-h / 2 + 0.025, h / 2 - 0.025]) b([w, 0.42, 0.04], [0, 0.21, z], COLORS.fabric);
      for (const x of [-w / 2 + 0.12, w / 2 - 0.12]) for (const z of [-h / 2 + 0.12, h / 2 - 0.12]) {
        b([0.09, 0.46, 0.09], [x, 0.23, z], COLORS.aluminium, 0.7, 'cylinder');
        b([0.2, 0.035, 0.2], [x, 0.025, z], COLORS.steel);
      }
      for (let x = -w / 2 + 1; x < w / 2; x++) b([0.012, 0.004, h], [x, 0.552, 0], 0x697078);
      for (let i = 0; i < 3; i++) b([0.55, (i + 1) * 0.14, 0.19], [w / 2 - 0.38, (i + 1) * 0.07, h / 2 - 0.13 - i * 0.2], COLORS.steel);
      // Back handrail and supports belong to the platform, not additional lighting capacity.
      for (let x = -w / 2 + 0.15; x <= w / 2 - 0.1; x += 1.9) b([0.035, 0.52, 0.035], [x, 0.81, -h / 2 + 0.08], COLORS.aluminium, 0.7, 'cylinder');
      b([w - 0.2, 0.035, 0.035], [0, 1.06, -h / 2 + 0.08], COLORS.aluminium, 0.7);
    } else if (object.type.startsWith('pa-')) {
      const medium = object.type === 'pa-m';
      b([0.6, 0.45, 0.52], [0, 0.225, 0], 0x171b20);
      b([0.54, 0.38, 0.015], [0, 0.225, 0.27], 0x39424a, 0.3);
      const boxes = medium ? 4 : 1;
      for (let i = 0; i < boxes; i++) {
        const y = 0.48 + i * 0.205;
        b([0.45, 0.19, 0.35], [0, y + 0.095, 0], 0x171b20);
        b([0.4, 0.16, 0.012], [0, y + 0.095, 0.181], 0x39424a, 0.25);
        for (let row = 0; row < 5; row++) b([0.38, 0.006, 0.006], [0, y + 0.035 + row * 0.027, 0.191], 0x101419);
        b([0.012, 0.1, 0.1], [0.232, y + 0.1, 0], COLORS.aluminium, 0.6);
      }
      b([0.11, 0.09, 0.02], [0, 0.22, -0.27], COLORS.aluminium, 0.6);
    } else if (object.type === 'bar') {
      b([w - 0.18, 0.48, 0.56], [0, 0.24, 0], COLORS.wood);
      b([w, 0.05, 0.7], [0, 0.525, 0], COLORS.steel, 0.2);
      for (const x of [-w / 2 + 0.14, 0, w / 2 - 0.14]) b([0.035, 0.5, 0.57], [x, 0.25, 0], COLORS.aluminium, 0.65);
      b([w - 0.3, 0.025, 0.025], [0, 0.14, 0.34], COLORS.aluminium, 0.7);
      for (const x of [-0.38, 0.1]) b([0.12, 0.09, 0.12], [x, 0.595, -0.12], 0xa6b5b2, 0.4, 'cylinder');
    } else if (object.type === 'food') {
      b([w - 0.14, 0.5, 0.55], [0, 0.25, 0], 0x32785e);
      b([w, 0.05, 0.65], [0, 0.525, 0.05], COLORS.aluminium, 0.4);
      for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) b([0.045, 1.1, 0.045], [x, 0.55, -0.22], COLORS.steel);
      b([w, 0.06, 0.8], [0, 1.08, 0], 0x5faf92);
      for (const x of [-0.5, 0, 0.5]) b([0.22, 0.025, 0.23], [x, 0.565, 0.08], 0xe5d8b6);
      b([0.5, 0.2, 0.02], [0, 0.85, -0.22], 0xe5d8b6);
    } else if (object.type === 'trailer') {
      // Three guest doors and a separate rear changing area; all within its footprint.
      b([2.85, 0.16, 1.8], [0, 0.15, 0], COLORS.steel, 0.4);
      b([2.75, 1.1, 1.55], [0, 0.78, -0.05], 0xb6a5c8);
      b([2.85, 0.09, 1.65], [0, 1.375, -0.05], 0xe4e2df, 0.3);
      for (const x of [-0.88, 0, 0.88]) {
        b([0.66, 0.95, 0.035], [x, 0.72, 0.74], 0x514164);
        b([0.16, 0.13, 0.015], [x, 1.02, 0.765], 0xe4e2df);
        b([0.025, 0.08, 0.035], [x + 0.24, 0.7, 0.77], COLORS.aluminium, 0.6);
      }
      b([0.7, 0.95, 0.035], [0.7, 0.72, -0.84], 0x806997);
      b([0.75, 0.12, 0.2], [-0.88, 0.12, 0.86], COLORS.aluminium, 0.6);
      for (const x of [-0.95, 0.95]) for (const z of [-0.62, 0.62]) b([0.28, 0.28, 0.16], [x, 0.14, z], 0x171b20, 0, 'sphere');
    } else if (object.type === 'restroom') {
      b([0.57, 1.04, 0.62], [0, 0.55, 0], COLORS.plastic);
      b([0.61, 0.08, 0.66], [0, 1.11, 0], COLORS.trim);
      b([0.45, 0.91, 0.018], [0, 0.51, 0.322], 0x537b8b);
      b([0.022, 0.1, 0.023], [0.17, 0.58, 0.34], COLORS.trim);
      for (let x = -0.19; x <= 0.2; x += 0.076) b([0.035, 0.05, 0.01], [x, 0.98, 0.326], 0x253a43);
      b([0.64, 0.06, 0.68], [0, 0.03, 0], COLORS.steel);
      b([0.12, 0.13, 0.014], [0, 0.79, 0.342], 0xd0d8cf);
      b([0.025, 0.06, 0.015], [0, 0.785, 0.352], 0x253a43);
      b([0.02, 0.02, 0.01], [0, 0.823, 0.357], 0x253a43, 0, 'sphere');
    } else if (object.type === 'lights') {
      b([0.7, 0.08, 0.7], [0, 0.04, 0], COLORS.steel);
      b([0.055, 2.8, 0.055], [0, 1.4, 0], COLORS.aluminium, 0.8, 'cylinder');
      b([0.85, 0.06, 0.06], [0, 2.8, 0], COLORS.aluminium, 0.8);
      for (const x of [-0.3, 0, 0.3]) b([0.17, 0.18, 0.22], [x, 2.69, 0], COLORS.steel);
    } else {
      const color = object.type === 'gate' ? 0x789b65 : 0xad554b;
      for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) b([0.055, 1.1, 0.055], [x, 0.55, 0], COLORS.aluminium, 0.6, 'cylinder');
      b([w, 0.17, 0.05], [0, 1.08, 0], color);
      b([0.36, 0.035, 0.015], [0, 1.08, 0.035], 0xf4f5e7);
    }
    const rot = object.rot || 0, rw = rot % 2 ? h : w, rh = rot % 2 ? w : h;
    g.rotation.y = -rot * Math.PI / 2; g.position.set(object.x + rw / 2, 0, object.y + rh / 2);
    return g;
  }
  function guest() {
    const g = new T.Group();
    const p = (size, pos, surface, form = 'cylinder') => part(g, size, pos, 0xffffff, 0, form, surface);
    p([0.23, 0.29, 0.14], [0, 0.575, 0], 'clothing', 'torso');
    p([0.055, 0.05, 0.055], [0, 0.745, 0], 'skin');
    p([0.057, 0.065, 0.052], [0, 0.835, 0], 'skin', 'sphere');
    p([0.058, 0.026, 0.053], [0, 0.874, -0.005], 'hair', 'sphere');
    for (const x of [-0.057, 0.057]) {
      p([0.077, 0.2, 0.09], [x, 0.33, 0], 'trousers');
      p([0.063, 0.18, 0.073], [x, 0.14, 0], 'trousers');
      p([0.075, 0.046, 0.13], [x, 0.023, 0.025], 'shoes', 'box');
    }
    for (const sign of [-1, 1]) {
      const sleeve = p([0.074, 0.15, 0.074], [sign * 0.135, 0.64, 0], 'clothing'); sleeve.rotation.z = sign * 0.12;
      p([0.05, 0.19, 0.05], [sign * 0.148, 0.475, 0.005], 'skin');
      p([0.026, 0.035, 0.022], [sign * 0.148, 0.36, 0.008], 'skin', 'sphere');
    }
    return g;
  }
  function dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); geometries.clear(); materials.clear(); textures.clear(); }
  return { create, guest, material, dispose, counts: () => ({ geometries: geometries.size, materials: materials.size, textures: textures.size }) };
}
