// Source-authored Lot samples. The dimensional reference is provisional, not field calibration.
import * as T from './vendor/three/three.module.min.js';
import { OBJECT_TYPES } from './data.mjs';

export const MODEL_REVISION = 'lot-sample-13';
export const FESTIVAL_SCENE = Object.freeze({ width: 52, depth: 24, annex: Object.freeze({ x: 40, y: 0, w: 12, h: 16 }), stage: Object.freeze({ x: 43, y: 1, w: 6, h: 3 }) });
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
  function profile(rings, radialSegments = 16, heightSegments = 8) {
    const geometry = new T.CylinderGeometry(0.5, 0.5, 1, radialSegments, heightSegments);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const upper = rings.findIndex(r => r[0] >= y);
      const b = rings[Math.max(0, upper)], a = rings[Math.max(0, upper - 1)];
      const t = b[0] === a[0] ? 0 : (y - a[0]) / (b[0] - a[0]);
      const radius = a[1] + (b[1] - a[1]) * t;
      positions.setXYZ(i, positions.getX(i) * radius * 2, y, positions.getZ(i) * radius * 2);
    }
    geometry.computeVertexNormals();
    return geometry;
  }
  const shape = {
    box: new T.BoxGeometry(1, 1, 1), sphere: new T.SphereGeometry(1, 16, 12),
    cylinder: new T.CylinderGeometry(0.5, 0.5, 1, 12),
    // The collar rises inside the neck; outer shoulders slope into the sleeve caps.
    torso: profile([[-0.5, 0.4], [-0.25, 0.36], [0.15, 0.46], [0.32, 0.5], [0.42, 0.31], [0.5, 0.12]], 24, 12),
    sleeve: profile([[-0.5, 0.42], [-0.25, 0.46], [0.1, 0.5], [0.3, 0.43], [0.45, 0.25], [0.5, 0.08]]),
    forearm: profile([[-0.5, 0.31], [-0.2, 0.4], [0.15, 0.49], [0.35, 0.5], [0.5, 0.43]]),
    thigh: profile([[-0.5, 0.39], [-0.2, 0.44], [0.2, 0.5], [0.5, 0.48]]),
    calf: profile([[-0.5, 0.34], [-0.1, 0.43], [0.2, 0.5], [0.5, 0.48]]),
    head: new T.SphereGeometry(1, 24, 16),
    hair: new T.SphereGeometry(1, 16, 12),
  };
  // Sculpt the shared head rather than adding draw calls for facial features.
  const headPositions = shape.head.attributes.position;
  for (let i = 0; i < headPositions.count; i++) {
    const x = headPositions.getX(i), y = headPositions.getY(i), z = headPositions.getZ(i);
    const jaw = y < 0 ? 1 + y * 0.18 : 1;
    const nose = z > 0 ? 0.24 * Math.exp(-((x / 0.2) ** 2) - (((y + 0.1) / 0.27) ** 2)) : 0;
    headPositions.setXYZ(i, x * jaw, y, z + nose);
  }
  shape.head.computeVertexNormals();
  const hairPositions = shape.hair.attributes.position;
  for (let i = 0; i < hairPositions.count; i++) {
    const x = hairPositions.getX(i), y = hairPositions.getY(i), z = hairPositions.getZ(i);
    // A higher front hairline and fuller back keep the face visible from FOH.
    hairPositions.setXYZ(i, x, y < 0 && z > 0 ? y * 0.35 : y, z);
  }
  shape.hair.computeVertexNormals();
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
  function surfaceMap(kind) {
    const width = 256, height = 128, data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const u = x / (width - 1), v = y / (height - 1);
      let shade = 255;
      if (kind === 'cloth') shade = 234 + ((x + (y % 2) * 2) % 4 < 2 ? 9 : 0) + (y % 4 < 2 ? 7 : 0);
      if (kind === 'hair') shade = 208 + Math.round(25 * (0.5 + 0.5 * Math.sin(x * 1.7 + Math.sin(y * 0.13))));
      if (kind === 'face') {
        // Sphere UV u=.25 faces +Z. Greyscale landmarks retain each skin palette.
        for (const eye of [0.198, 0.302]) {
          const dx = (u - eye) / 0.021, dy = (v - 0.56) / 0.021;
          if (dx * dx + dy * dy < 1) shade = 180;
          if (((u - eye) / 0.009) ** 2 + ((v - 0.56) / 0.018) ** 2 < 1) shade = 48;
          if (Math.abs(u - eye) < 0.024 && Math.abs(v - 0.607) < 0.008) shade = 105;
        }
        if (((u - 0.25) / 0.034) ** 2 + ((v - 0.375) / 0.008) ** 2 < 1) shade = 145;
      }
      data.set([shade, shade, shade, 255], (y * width + x) * 4);
    }
    const texture = new T.DataTexture(data, width, height); texture.name = `authored-${kind}`;
    texture.colorSpace = T.SRGBColorSpace; texture.minFilter = T.LinearMipmapLinearFilter;
    texture.magFilter = T.LinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true;
    textures.add(texture); return texture;
  }
  const surfaceMaps = { cloth: surfaceMap('cloth'), hair: surfaceMap('hair'), face: surfaceMap('face') };
  function material(color, metalness = 0, roughness = metalness > 0.5 ? 0.38 : 0.8, surface = 'grain') {
    const key = `${color}:${metalness}:${roughness}:${surface}`;
    if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, metalness, roughness, map: surface === 'skin' ? null : surfaceMaps[surface] || grain }));
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
    } else if (object.type === 'delay') {
      // One logical tower, including its support and speakers, stays inside one cell.
      b([0.9, 0.12, 0.9], [0, 0.06, 0], COLORS.steel, 0.3);
      for (const x of [-0.14, 0.14]) for (const z of [-0.14, 0.14]) {
        b([0.045, 3.72, 0.045], [x, 1.98, z], COLORS.aluminium, 0.7, 'cylinder');
      }
      for (const y of [0.5, 1.2, 1.9, 2.6, 3.3, 3.8]) {
        b([0.32, 0.035, 0.32], [0, y, 0], COLORS.aluminium, 0.7);
      }
      for (const y of [3.1, 3.47, 3.84]) {
        b([0.58, 0.32, 0.4], [0, y, 0.09], COLORS.fabric);
        b([0.51, 0.26, 0.018], [0, y, 0.3], 0x39424a, 0.25);
        for (const offset of [-0.075, 0, 0.075]) b([0.47, 0.012, 0.01], [0, y + offset, 0.315], 0x101419);
      }
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
    } else if (object.type === 'vip-deck') {
      // Touring hospitality reference: modular deck, guardrails, stairs and edge trim.
      b([w - 0.12, 0.15, h - 0.12], [0, 0.875, 0], COLORS.steel);
      for (const x of [-1.7, 0, 1.7]) for (const z of [-1.2, 1.2]) {
        b([0.12, 0.8, 0.12], [x, 0.4, z], COLORS.aluminium, 0.6);
        b([0.25, 0.05, 0.25], [x, 0.025, z], COLORS.steel);
      }
      for (let x = -1.8; x <= 1.81; x += 0.9) for (const z of [-1.38, 1.38]) {
        if (z > 0 && x > 0.8) continue;
        b([0.045, 0.65, 0.045], [x, 1.275, z], COLORS.aluminium, 0.7);
      }
      for (const z of [-1.38, 1.38]) for (const y of [1.25, 1.58]) b([z > 0 ? 2.5 : 3.7, 0.035, 0.035], [z > 0 ? -0.6 : 0, y, z], COLORS.aluminium, 0.7);
      for (const x of [-1.82, 1.82]) for (const y of [1.25, 1.58]) b([0.035, 0.035, 2.76], [x, y, 0], COLORS.aluminium, 0.7);
      for (let i = 0; i < 4; i++) b([0.7, (i + 1) * 0.22, 0.24], [1.23, (i + 1) * 0.11, 1.33 - i * 0.24], 0x5c636b, 0.3);
      for (let x = -1.5; x < 1.5; x += 0.75) b([0.012, 0.006, 2.7], [x, 0.952, 0], 0x8c959d);
    } else if (object.type === 'bus-compound') {
      // One representative coach and its working aisle, inside the reserved footprint.
      b([w - 0.08, 0.03, h - 0.08], [0, 0.015, 0], 0x454b4e);
      for (const z of [-1.4, 0.55]) b([5.65, 0.008, 0.04], [0, 0.034, z], 0xc6ae67);
      b([5.35, 1.12, 1.35], [0, 0.94, -0.45], 0x727e89, 0.5);
      b([5.1, 0.18, 1.25], [0, 1.59, -0.45], 0x929aa3, 0.5);
      b([4.9, 0.06, 1.1], [0, 1.71, -0.45], 0x4b565f, 0.4);
      for (const z of [-1.134, 0.234]) {
        for (let x = -2.24; x < 2.4; x += 0.59) b([0.51, 0.42, 0.016], [x, 1.23, z], 0x152b39, 0.35);
        for (let x = -1.9; x < 1.9; x += 0.95) b([0.88, 0.28, 0.02], [x, 0.66, z], 0x5b6671, 0.45);
        for (const x of [-1.9, -1.3, 1.8]) {
          const wheel = b([0.43, 0.12, 0.43], [x, 0.28, z], 0x14171b, 0, 'cylinder'); wheel.rotation.x = Math.PI / 2;
          const hub = b([0.2, 0.13, 0.2], [x, 0.28, z], COLORS.aluminium, 0.65, 'cylinder'); hub.rotation.x = Math.PI / 2;
        }
      }
      b([0.025, 0.55, 1.13], [2.68, 1.14, -0.45], 0x152b39, 0.35);
      for (const z of [-0.93, 0.03]) b([0.03, 0.12, 0.2], [2.685, 0.63, z], 0xe4e4bb);
      for (const x of [-2.8, 2.8]) for (const z of [-1.4, 1.4]) b([0.045, 0.62, 0.045], [x, 0.31, z], COLORS.aluminium, 0.7);
      b([5.6, 0.035, 0.035], [0, 0.6, 1.4], COLORS.aluminium, 0.7);
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
    const p = (size, pos, surface, form = 'cylinder') => {
      const mesh = part(g, size, pos, 0xffffff, 0, form, surface);
      const finish = form === 'head' ? 'face' : surface === 'clothing' || surface === 'trousers' ? 'cloth' : surface;
      mesh.material = material(0xffffff, 0, surface === 'skin' ? 0.62 : surface === 'hair' ? 0.72 : 0.9, finish);
      return mesh;
    };
    p([0.27, 0.32, 0.17], [0, 0.59, 0], 'clothing', 'torso');
    p([0.055, 0.05, 0.055], [0, 0.745, 0], 'skin');
    p([0.057, 0.065, 0.052], [0, 0.835, 0], 'skin', 'head');
    p([0.058, 0.026, 0.053], [0, 0.874, -0.005], 'hair', 'hair');
    const limb = (mesh, joint, side, pivot) => {
      mesh.userData.guestLimb = { joint, side, pivot };
      return mesh;
    };
    for (const side of [-1, 1]) {
      const x = side * 0.057, pivot = [x, 0.43, 0];
      limb(p([0.077, 0.2, 0.09], [x, 0.33, 0], 'trousers', 'thigh'), 'hip', side, pivot);
      limb(p([0.063, 0.18, 0.073], [x, 0.14, 0], 'trousers', 'calf'), 'hip', side, pivot);
      limb(p([0.075, 0.046, 0.13], [x, 0.023, 0.025], 'shoes', 'box'), 'hip', side, pivot);
    }
    for (const side of [-1, 1]) {
      const pivot = [side * 0.135, 0.715, 0];
      const arm = mesh => limb(mesh, 'shoulder', side, pivot);
      const sleeve = arm(p([0.084, 0.16, 0.084], [side * 0.125, 0.645, 0], 'clothing', 'sleeve')); sleeve.rotation.z = side * 0.12;
      arm(p([0.052, 0.19, 0.052], [side * 0.143, 0.475, 0.005], 'skin', 'forearm'));
      arm(p([0.026, 0.035, 0.022], [side * 0.148, 0.36, 0.008], 'skin', 'sphere'));
    }
    return g;
  }
  function room(venue) {
    const group = new T.Group();
    if (!['club', 'amphitheater', 'festival'].includes(venue.id)) return group;
    const { w, h } = venue.grid;
    const fixed = (id, size, position, color, metal = 0) => {
      const mesh = part(group, size, position, color, metal, 'box', id);
      mesh.userData.permanent = true;
      return mesh;
    };
    if (venue.id === 'club') {
      // Cutaway edges keep management views open; no roof or additional blocked floor cells.
      fixed('club-back-wall', [w, 3, 0.15], [w / 2, 1.5, -0.08], 0x625c63);
      for (const [id, x] of [['west', -0.08], ['east', w + 0.08]]) fixed(`club-${id}-cutaway`, [0.15, 0.3, h], [x, 0.15, h / 2], 0x625c63);
      for (const [x, y] of venue.pillars) {
        fixed(`club-pillar-${x}-${y}`, [1, 3, 1], [x + 0.5, 1.5, y + 0.5], 0x676b70);
        fixed(`club-pillar-base-${x}-${y}`, [1, 0.15, 1], [x + 0.5, 0.075, y + 0.5], 0x363b42);
      }
    } else if (venue.id === 'amphitheater') {
      // A cutaway acoustic-shell profile keeps the ground and plan view visible.
      const heights = [2, 2.5, 2.9, 3.2, 3.4, 3.2, 2.9, 2.5, 2];
      heights.forEach((height, i) => fixed(`shell-panel-${i}`, [0.98, height, 0.18], [w / 2 + i - 4, height / 2, -0.1], i % 2 ? 0xb9b29f : 0x9d988b));
      for (const [side, x] of [['west', w / 2 - 5], ['east', w / 2 + 5]]) fixed(`shell-${side}-wing`, [1, 1.2, 0.18], [x, 0.6, -0.1], 0x7b8072);
      // Illustrative floor bands distinguish seating from lawn without reserving tiles.
      for (let row = 0; row < 6; row++) for (const [side, x] of [['west', w / 2 - 4.75], ['east', w / 2 + 4.75]]) {
        const guide = fixed(`shell-seat-guide-${side}-${row}`, [7.5, 0.008, 0.22], [x, 0.004, 5 + row * 0.8], 0x858678);
        guide.userData.pickThrough = true; guide.castShadow = false;
      }
    }
    if (venue.id === 'festival') {
      const a = FESTIVAL_SCENE.annex, stage = FESTIVAL_SCENE.stage, cx = stage.x + stage.w / 2;
      const apron = fixed('festival-side-apron', [a.w, 0.016, a.h], [a.x + a.w / 2, -0.012, a.y + a.h / 2], 0x665e4b);
      apron.userData.pickThrough = true; apron.castShadow = false;
      fixed('festival-side-deck', [stage.w, 0.13, stage.h], [cx, 0.485, stage.y + stage.h / 2], COLORS.steel);
      fixed('festival-side-skirt', [stage.w, 0.42, 0.05], [cx, 0.21, stage.y + stage.h], COLORS.fabric);
      for (const x of [stage.x + 0.1, stage.x + stage.w - 0.1]) {
        fixed(`festival-side-support-${x}`, [0.12, 2.8, 0.12], [x, 1.4, stage.y + 0.1], COLORS.aluminium, 0.7);
        for (let box = 0; box < 3; box++) fixed(`festival-side-pa-${x}-${box}`, [0.55, 0.2, 0.4], [x, 1.8 + box * 0.22, stage.y + 0.5], 0x171b20);
      }
      fixed('festival-side-header', [stage.w, 0.15, 0.12], [cx, 2.85, stage.y + 0.1], COLORS.aluminium, 0.7);
      fixed('festival-side-backdrop', [stage.w - 0.3, 2.15, 0.04], [cx, 1.65, stage.y + 0.04], 0x365c63);
      // Permanent work and pathway marks do not enlarge the editable grid or permit.
      for (let y = 4; y < a.h; y += 2) {
        const path = fixed(`festival-side-path-${y}`, [0.7, 0.008, 0.12], [a.x + 0.7, 0.004, y], 0xb9ad86);
        path.userData.pickThrough = true; path.castShadow = false;
      }
      for (let x = 1; x < w; x += 4) fixed(`festival-back-banner-${x}`, [2.2, 0.7, 0.08], [x + 1.1, 1.7, -0.1], x % 8 === 1 ? 0x406f7a : 0x8a654c);
    }
    if (venue.housePa === 'M') {
      fixed(`${venue.id}-house-pa-suspension`, [w - 2, 0.12, 0.12], [w / 2, 2.95, 1.5], COLORS.steel, 0.6);
      for (const [side, x] of [['left', w / 2 - 4.5], ['right', w / 2 + 4.5]]) {
        for (let i = 0; i < 4; i++) {
          fixed(`${venue.id}-house-pa-${side}-${i}`, [0.6, 0.18, 0.4], [x, 2.2 + i * 0.2, 1.5], 0x171b20);
          fixed(`${venue.id}-house-pa-grille-${side}-${i}`, [0.53, 0.14, 0.015], [x, 2.2 + i * 0.2, 1.708], 0x39424a, 0.25);
        }
      }
    }
    return group;
  }
  function dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); geometries.clear(); materials.clear(); textures.clear(); }
  return { create, guest, room, material, dispose, counts: () => ({ geometries: geometries.size, materials: materials.size, textures: textures.size }) };
}
