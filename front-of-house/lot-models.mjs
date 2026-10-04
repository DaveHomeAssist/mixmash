// Independently authored dimensional samples, not accepted final realistic art.
// All sizes are provisional logical tile units; no external models or textures.
import * as T from './vendor/three/three.module.min.js';
import { OBJECT_TYPES } from './data.mjs';

export const MODEL_REVISION = 'lot-sample-1';
export const MODEL_METADATA = Object.freeze({
  author: 'Codex for Front of House', source: 'Procedural geometry in lot-models.mjs',
  rights: 'Newly authored project content; Three.js MIT license retained separately',
  units: 'logical tiles; physical calibration pending', pivot: 'rotated footprint center at ground',
  forward: '+Z before rotation', acceptance: 'technical sample only; final art review pending',
  materials: 'untextured roughness and metalness; no external imagery',
});

const COLORS = { steel: 0x31363d, aluminium: 0xb0b8bd, fabric: 0x181b20, wood: 0x79654c, plastic: 0x456778, trim: 0xc5c9bf };
export function createLotModels() {
  const geometries = new Set(), materials = new Map();
  const boxGeometry = new T.BoxGeometry(1, 1, 1); geometries.add(boxGeometry);
  const sphereGeometry = new T.SphereGeometry(1, 10, 8); geometries.add(sphereGeometry);
  function material(color, metalness = 0, roughness = 0.8) {
    const key = `${color}:${metalness}:${roughness}`;
    if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, metalness, roughness }));
    return materials.get(key);
  }
  function part(group, size, position, color, metal = 0, round = false) {
    const mesh = new T.Mesh(round ? sphereGeometry : boxGeometry, material(color, metal));
    mesh.scale.set(...size); mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  function create(object) {
    const spec = OBJECT_TYPES[object.type];
    if (!spec || spec.kit) return null;
    const g = new T.Group(), w = spec.w, h = spec.h;
    const b = (size, position, color, metal = 0) => part(g, size, position, color, metal);
    if (object.type === 'stage') {
      b([w, 0.18, h], [0, 0.48, 0], COLORS.steel);
      b([w, 0.36, 0.04], [0, 0.2, h / 2 - 0.02], COLORS.fabric);
      for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) for (const z of [-h / 2 + 0.2, h / 2 - 0.2]) b([0.12, 0.42, 0.12], [x, 0.21, z], COLORS.aluminium, 0.7);
      for (let x = -w / 2 + 1; x < w / 2; x += 1) b([0.015, 0.008, h], [x, 0.574, 0], 0x697078);
      b([0.7, 0.18, 0.35], [w / 2 - 0.6, 0.09, h / 2 - 0.2], COLORS.steel);
      b([0.7, 0.34, 0.25], [w / 2 - 0.6, 0.17, h / 2 - 0.48], COLORS.steel);
    } else if (object.type.startsWith('pa-')) {
      const tall = object.type === 'pa-m' ? 1.9 : 1.3;
      b([0.76, tall, 0.65], [0, tall / 2, 0], 0x171b20);
      b([0.67, tall - 0.12, 0.025], [0, tall / 2, 0.34], 0x39424a, 0.25);
      for (let y = 0.12; y < tall; y += 0.09) b([0.65, 0.015, 0.012], [0, y, 0.36], 0x13171b);
      b([0.18, 0.11, 0.03], [0, 0.25, -0.34], COLORS.aluminium, 0.6);
    } else if (object.type === 'bar') {
      b([w - 0.14, 0.77, h - 0.2], [0, 0.385, 0], COLORS.wood);
      b([w, 0.1, h], [0, 0.82, 0], COLORS.steel, 0.15);
      for (const x of [-w / 2 + 0.14, w / 2 - 0.14]) b([0.07, 0.77, h - 0.16], [x, 0.385, 0], COLORS.aluminium, 0.65);
      b([w - 0.3, 0.035, 0.035], [0, 0.17, h / 2 - 0.02], COLORS.aluminium, 0.7);
    } else if (object.type === 'restroom') {
      b([0.88, 1.55, 0.91], [0, 0.79, 0], COLORS.plastic);
      b([0.94, 0.1, 0.97], [0, 1.59, 0], COLORS.trim);
      b([0.68, 1.34, 0.025], [0, 0.72, 0.468], 0x537b8b);
      b([0.045, 0.16, 0.04], [0.25, 0.82, 0.475], COLORS.trim);
      for (let x = -0.3; x <= 0.3; x += 0.12) b([0.05, 0.08, 0.025], [x, 1.42, 0.48], 0x253a43);
      b([0.96, 0.08, 0.97], [0, 0.04, 0], COLORS.steel);
    } else if (object.type === 'lights') {
      b([0.7, 0.1, 0.7], [0, 0.05, 0], COLORS.steel);
      b([0.09, 2.8, 0.09], [0, 1.4, 0], COLORS.aluminium, 0.8);
      b([0.85, 0.08, 0.08], [0, 2.8, 0], COLORS.aluminium, 0.8);
      for (const x of [-0.3, 0, 0.3]) b([0.19, 0.2, 0.24], [x, 2.69, 0], COLORS.steel);
    } else {
      const color = object.type === 'gate' ? 0x789b65 : 0xad554b;
      for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) b([0.1, 1.15, 0.1], [x, 0.575, 0], COLORS.aluminium, 0.6);
      b([w, 0.25, 0.1], [0, 1.12, 0], color);
    }
    const rot = object.rot || 0, rw = rot % 2 ? h : w, rh = rot % 2 ? w : h;
    g.rotation.y = -rot * Math.PI / 2;
    g.position.set(object.x + rw / 2, 0, object.y + rh / 2);
    return g;
  }
  function guest() {
    const g = new T.Group();
    part(g, [0.27, 0.42, 0.18], [0, 0.64, 0], 0x697c86);
    part(g, [0.13, 0.16, 0.13], [0, 0.98, 0], 0xb48d75, 0, true);
    for (const x of [-0.08, 0.08]) { part(g, [0.085, 0.42, 0.1], [x, 0.24, 0], 0x303841); part(g, [0.1, 0.065, 0.18], [x, 0.04, 0.035], 0x171b20); }
    for (const x of [-0.19, 0.19]) part(g, [0.075, 0.37, 0.09], [x, 0.61, 0], 0xb48d75);
    return g;
  }
  function dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); geometries.clear(); materials.clear(); }
  return { create, guest, material, dispose, counts: () => ({ geometries: geometries.size, materials: materials.size }) };
}
