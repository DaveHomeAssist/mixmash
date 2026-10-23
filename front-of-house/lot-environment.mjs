// Authored static Lot surroundings. Decoration only: never included in picking or game state.
import * as T from './vendor/three/three.module.min.js';

export function createLotEnvironment(width, depth) {
  const group = new T.Group(); group.name = 'lot-surroundings';
  const geometries = [], materials = [], textures = [];
  const geometry = g => (geometries.push(g), g);
  const material = (color, options = {}) => { const m = new T.MeshBasicMaterial({ color, toneMapped: false, vertexColors: !options.map, ...options }); m.userData.dayColor = m.color.clone(); materials.push(m); return m; };
  // Fixed noise avoids canvas assets, network requests and frame-to-frame changes.
  const pixels = new Uint8Array(32 * 32 * 4);
  for (let i = 0; i < 1024; i++) { const v = 218 + ((i * 73 ^ i * 19 >>> 2) % 14); pixels.set([v, v, v, 255], i * 4); }
  pixels.set([255, 255, 255, 255], 0);
  const texture = new T.DataTexture(pixels, 32, 32); texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(160, 160); texture.magFilter = T.LinearFilter; texture.minFilter = T.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true; textures.push(texture);
  const grass = material(0x5f736a, { map: texture }), gravel = material(0x8c8980, { map: texture });
  const asphalt = material(0x444e55), paint = material(0xb4af91), concrete = material(0x8d8e88);
  const bark = material(0x4d4e47), foliage = material(0x3c5750), industry = material(0x52616b), metal = material(0x6d7779);
  // Static vertex tint preserves faceted depth without per-pixel lighting or tone mapping.
  function shaded(g) {
    const normal = g.attributes.normal, colors = [];
    for (let i = 0; i < normal.count; i++) {
      const shade = 0.65 + 0.35 * Math.max(0, normal.getX(i) * 0.35 + normal.getY(i) * 0.8 + normal.getZ(i) * 0.48);
      colors.push(shade, shade, shade);
    }
    g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); return g;
  }
  const box = geometry(shaded(new T.BoxGeometry(1, 1, 1)));
  const pieces = [];
  function block(mat, x, y, z, w, h, d, yaw = 0) {
    const pose = new T.Object3D(); pose.position.set(x, y, z); pose.scale.set(w, h, d); pose.rotation.y = yaw; pose.updateMatrix();
    pieces.push({ geometry: box, material: mat, matrix: pose.matrix.clone() });
  }
  // Rings avoid shading grass beneath gravel, or either surface beneath the playable floor.
  function groundRing(mat, w, d, holeW, holeD, height) {
    const shape = new T.Shape();
    shape.moveTo(-w / 2, -d / 2); shape.lineTo(w / 2, -d / 2); shape.lineTo(w / 2, d / 2); shape.lineTo(-w / 2, d / 2); shape.closePath();
    const hole = new T.Path();
    hole.moveTo(-holeW / 2, -holeD / 2); hole.lineTo(-holeW / 2, holeD / 2); hole.lineTo(holeW / 2, holeD / 2); hole.lineTo(holeW / 2, -holeD / 2); hole.closePath(); shape.holes.push(hole);
    const surface = geometry(new T.ShapeGeometry(shape)), uv = surface.attributes.uv, positions = surface.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (positions.getX(i) + w / 2) / w, (positions.getY(i) + d / 2) / d);
    const mesh = new T.Mesh(surface, mat); mesh.rotation.x = -Math.PI / 2; mesh.position.set(width / 2, height, depth / 2); mesh.updateMatrix(); pieces.push({ geometry: surface, material: mat, matrix: mesh.matrix.clone() });
  }
  groundRing(grass, 700, 700, width + 11.9, depth + 11.9, -0.12);
  groundRing(gravel, width + 12, depth + 12, width - 0.1, depth - 0.1, -0.095);
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
  const crowns = geometry(shaded(new T.IcosahedronGeometry(1, 0))), treePositions = [];
  for (let i = 0; i < 14; i++) {
    const side = i % 4, offset = 12 + Math.floor(i / 4) * 9;
    const x = side === 0 ? -offset : side === 1 ? width + offset : -12 + i * 4;
    const z = side === 2 ? -offset : side === 3 ? depth + offset + 5 : -10 + i * 3;
    const h = 2.6 + (i % 3) * 0.45;
    block(bark, x, h / 2 - 0.1, z, 0.25, h, 0.25); treePositions.push({ x, z, h });
  }
  const pose = new T.Object3D();
  treePositions.forEach(({ x, z, h }, i) => { pose.position.set(x, h + 0.4, z); pose.scale.set(1.4, 1.9, 1.3); pose.rotation.y = i; pose.updateMatrix(); pieces.push({ geometry: crowns, material: foliage, matrix: pose.matrix.clone() }); });
  // A low industrial horizon surrounds all orbit directions, softened by distance fog.
  for (let i = 0; i < 32; i++) {
    const a = i * Math.PI / 16, r = 95 + (i % 4) * 7;
    const x = width / 2 + Math.cos(a) * r, z = depth / 2 + Math.sin(a) * r;
    const h = 4 + (i * 7 % 5);
    block(industry, x, h / 2 - 0.1, z, 10 + i % 6, h, 7 + i % 4, -a);
    if (i % 5 === 0) block(industry, x + 2, h + 3, z, 1.1, 6, 1.1);
  }
  // All scenery is static: one vertex-colored draw avoids a draw call per material.
  const positions = [], colors = [], uvs = [];
  for (const piece of pieces) {
    const transformed = piece.geometry.index ? piece.geometry.toNonIndexed() : piece.geometry.clone();
    transformed.applyMatrix4(piece.matrix);
    const p = transformed.attributes.position, tint = transformed.attributes.color, uv = transformed.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      const base = piece.material.userData.dayColor;
      const baked = new T.Color(base.r * (tint?.getX(i) ?? 1), base.g * (tint?.getY(i) ?? 1), base.b * (tint?.getZ(i) ?? 1)).convertLinearToSRGB();
      colors.push(baked.r, baked.g, baked.b);
      // Untextured props sample a white texel; only the ground receives gravel grain.
      uvs.push(piece.material.map ? uv.getX(i) : 0.5 / 5120, piece.material.map ? uv.getY(i) : 0.5 / 5120);
    }
    transformed.dispose();
  }
  const settingGeometry = geometry(new T.BufferGeometry());
  settingGeometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  settingGeometry.setAttribute('environmentTint', new T.Float32BufferAttribute(colors, 3));
  settingGeometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  const settingMaterial = new T.ShaderMaterial({ toneMapped: false, fog: false,
    uniforms: { grain: { value: texture }, night: { value: 1 }, haze: { value: new T.Color() } },
    vertexShader: `attribute vec3 environmentTint; varying vec3 tint; varying vec2 grainUv; varying float depth;
      void main(){ tint=environmentTint; grainUv=uv*160.0; vec4 p=modelViewMatrix*vec4(position,1.0); depth=-p.z; gl_Position=projectionMatrix*p; }`,
    fragmentShader: `uniform sampler2D grain; uniform float night; uniform vec3 haze; varying vec3 tint; varying vec2 grainUv; varying float depth;
      void main(){ vec3 surface=tint*texture2D(grain,grainUv).rgb*night; gl_FragColor=vec4(mix(surface,haze,smoothstep(75.0,180.0,depth)),1.0); }`,
  });
  materials.push(settingMaterial);
  const setting = new T.Mesh(settingGeometry, settingMaterial); setting.name = 'lot-setting'; group.add(setting);
  const skyMaterial = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { top: { value: new T.Color(0x314b68) }, horizon: { value: new T.Color(0xc1a69a) }, bottom: { value: new T.Color(0x71827f) } },
    vertexShader: 'varying vec3 direction; void main(){ direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 direction; uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom;
      void main(){ float h=normalize(direction).y; vec3 color=h>0.0?mix(horizon,top,smoothstep(0.0,0.23,h)):mix(horizon,bottom,smoothstep(0.0,0.35,-h));
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  materials.push(skyMaterial);
  const sky = new T.Mesh(geometry(new T.SphereGeometry(480, 24, 12)), skyMaterial); sky.position.set(width / 2, 0, depth / 2); sky.renderOrder = 1; group.add(sky);
  const fog = new T.Fog(0xb4a6a0, 75, 180);
  let lastNight = null;
  function setNight(night) {
    if (lastNight === night) return;
    lastNight = night;
    for (const m of materials) if (m.userData.dayColor) m.color.copy(m.userData.dayColor).multiplyScalar(night ? 0.35 : 1);
    skyMaterial.uniforms.top.value.setHex(night ? 0x101e35 : 0x314b68);
    skyMaterial.uniforms.horizon.value.setHex(night ? 0x625c70 : 0xc1a69a);
    skyMaterial.uniforms.bottom.value.setHex(night ? 0x293e46 : 0x71827f);
    fog.color.setHex(night ? 0x34464f : 0xb4a6a0);
    settingMaterial.uniforms.night.value = night ? 0.6 : 1;
    settingMaterial.uniforms.haze.value.copy(fog.color).convertLinearToSRGB();
  }
  return { group, fog, setNight,
    info: () => ({ decorative: true, trees: treePositions.length, industrialBuildings: 32, batches: 2, fogNear: fog.near, fogFar: fog.far }),
    dispose: () => { group.children.forEach(mesh => { if (mesh.isInstancedMesh) mesh.dispose(); }); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); group.clear(); },
  };
}
