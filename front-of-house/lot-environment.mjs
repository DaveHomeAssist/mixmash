// Authored static Lot surroundings. Decoration only: never included in picking or game state.
import * as T from './vendor/three/three.module.min.js';

export function createLotEnvironment(width, depth) {
  const group = new T.Group(); group.name = 'lot-surroundings';
  const geometries = [], materials = [], textures = [];
  const geometry = g => (geometries.push(g), g);
  const material = (color, options = {}) => { const m = new T.MeshStandardMaterial({ color, roughness: 1, ...options }); materials.push(m); return m; };
  // Fixed noise avoids canvas assets, network requests and frame-to-frame changes.
  const pixels = new Uint8Array(32 * 32 * 4);
  for (let i = 0; i < 1024; i++) { const v = 218 + ((i * 73 ^ i * 19 >>> 2) % 14); pixels.set([v, v, v, 255], i * 4); }
  const texture = new T.DataTexture(pixels, 32, 32); texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(160, 160); texture.magFilter = T.LinearFilter; texture.minFilter = T.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true; textures.push(texture);
  const grass = material(0x5f736a, { map: texture }), gravel = material(0x8c8980, { map: texture });
  const asphalt = material(0x444e55), paint = material(0xb4af91), concrete = material(0x8d8e88);
  const bark = material(0x4d4e47), foliage = material(0x3c5750), industry = material(0x52616b), metal = material(0x6d7779);
  const box = geometry(new T.BoxGeometry(1, 1, 1));
  const batches = new Map();
  function block(mat, x, y, z, w, h, d, yaw = 0) {
    if (!batches.has(mat)) batches.set(mat, []);
    const pose = new T.Object3D(); pose.position.set(x, y, z); pose.scale.set(w, h, d); pose.rotation.y = yaw; pose.updateMatrix();
    batches.get(mat).push(pose.matrix.clone());
  }
  block(grass, width / 2, -0.22, depth / 2, 700, 0.2, 700);
  block(gravel, width / 2, -0.105, depth / 2, width + 12, 0.02, depth + 12);
  // Service road passes the entrance side; the loading apron connects behind the stage.
  block(asphalt, width / 2, -0.075, depth + 9, 170, 0.025, 5);
  for (let x = -64; x < 90; x += 8) block(paint, x, -0.056, depth + 9, 3, 0.008, 0.09);
  block(concrete, width - 1, -0.07, -7, 13, 0.025, 8);
  block(gravel, width + 6, -0.08, -1, 3, 0.02, 15);
  for (let i = 0; i < 3; i++) {
    block(metal, width - 6 + i * 4, 0.6, -8.5, 2.8, 1.4, 3);
    block(paint, width - 6 + i * 4, -0.05, -4, 0.08, 0.01, 3);
  }
  // Trees stay well outside the fence and never cast shadows into the buildable lot.
  const crowns = geometry(new T.IcosahedronGeometry(1, 0)), treePositions = [];
  for (let i = 0; i < 14; i++) {
    const side = i % 4, offset = 12 + Math.floor(i / 4) * 9;
    const x = side === 0 ? -offset : side === 1 ? width + offset : -12 + i * 4;
    const z = side === 2 ? -offset : side === 3 ? depth + offset + 5 : -10 + i * 3;
    const h = 2.6 + (i % 3) * 0.45;
    block(bark, x, h / 2 - 0.1, z, 0.25, h, 0.25); treePositions.push({ x, z, h });
  }
  const trees = new T.InstancedMesh(crowns, foliage, treePositions.length), pose = new T.Object3D();
  treePositions.forEach(({ x, z, h }, i) => { pose.position.set(x, h + 0.4, z); pose.scale.set(1.4, 1.9, 1.3); pose.rotation.y = i; pose.updateMatrix(); trees.setMatrixAt(i, pose.matrix); });
  group.add(trees);
  // A low industrial horizon surrounds all orbit directions, softened by distance fog.
  for (let i = 0; i < 32; i++) {
    const a = i * Math.PI / 16, r = 95 + (i % 4) * 7;
    const x = width / 2 + Math.cos(a) * r, z = depth / 2 + Math.sin(a) * r;
    const h = 4 + (i * 7 % 5);
    block(industry, x, h / 2 - 0.1, z, 10 + i % 6, h, 7 + i % 4, -a);
    if (i % 5 === 0) block(industry, x + 2, h + 3, z, 1.1, 6, 1.1);
  }
  for (const [mat, matrices] of batches) {
    const mesh = new T.InstancedMesh(box, mat, matrices.length); matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.receiveShadow = false; mesh.castShadow = false; group.add(mesh);
  }
  const skyMaterial = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new T.Color(0x314b68) }, horizon: { value: new T.Color(0xc1a69a) }, bottom: { value: new T.Color(0x71827f) } },
    vertexShader: 'varying vec3 direction; void main(){ direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 direction; uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom;
      void main(){ float h=normalize(direction).y; vec3 color=h>0.0?mix(horizon,top,smoothstep(0.0,0.23,h)):mix(horizon,bottom,smoothstep(0.0,0.35,-h));
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  materials.push(skyMaterial);
  const sky = new T.Mesh(geometry(new T.SphereGeometry(480, 24, 12)), skyMaterial); sky.position.set(width / 2, 0, depth / 2); sky.renderOrder = -1; group.add(sky);
  const fog = new T.Fog(0xb4a6a0, 75, 180);
  function setNight(night) {
    skyMaterial.uniforms.top.value.setHex(night ? 0x101e35 : 0x314b68);
    skyMaterial.uniforms.horizon.value.setHex(night ? 0x625c70 : 0xc1a69a);
    skyMaterial.uniforms.bottom.value.setHex(night ? 0x293e46 : 0x71827f);
    fog.color.setHex(night ? 0x34464f : 0xb4a6a0);
  }
  return { group, fog, setNight,
    info: () => ({ decorative: true, trees: treePositions.length, industrialBuildings: 32, batches: batches.size + 2, fogNear: fog.near, fogFar: fog.far }),
    dispose: () => { group.children.forEach(mesh => { if (mesh.isInstancedMesh) mesh.dispose(); }); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); group.clear(); },
  };
}
