// Original cosmetic stage performers. No random source, simulation writes or saved state.
import * as T from './vendor/three/three.module.min.js';
import { OBJECT_TYPES } from './data.mjs';
import { bandLook } from './menu-art.mjs';

export function createPerformers() {
  const group = new T.Group(), material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .8 });
  const primitives = { box: new T.BoxGeometry(1, 1, 1), sphere: new T.SphereGeometry(1, 10, 7), cylinder: new T.CylinderGeometry(1, 1, 1, 12) };
  group.visible = false;
  let key = '', actors = [], artist = null, disposed = false;
  // Bake each performer and instrument into one vertex-colored mesh: at most five draws per stage.
  function musician(role, shirt, index) {
    const positions = [], normals = [], colors = [], transform = new T.Object3D(), color = new T.Color(), point = new T.Vector3(), normal = new T.Vector3(), normalMatrix = new T.Matrix3();
    const skin = [0xdba581, 0xa96e50, 0xe2bb98, 0x815443, 0xbd8a67][index % 5];
    function part(form, size, at, tint, rotation = [0, 0, 0]) {
      const geometry = primitives[form].toNonIndexed();
      transform.position.set(...at); transform.scale.set(...size); transform.rotation.set(...rotation); transform.updateMatrix(); normalMatrix.getNormalMatrix(transform.matrix); color.set(tint);
      for (let i = 0; i < geometry.attributes.position.count; i++) {
        point.fromBufferAttribute(geometry.attributes.position, i).applyMatrix4(transform.matrix); positions.push(...point.toArray());
        normal.fromBufferAttribute(geometry.attributes.normal, i).applyNormalMatrix(normalMatrix); normals.push(...normal.toArray()); colors.push(color.r, color.g, color.b);
      }
      geometry.dispose();
    }
    const box = (size, at, tint, rot) => part('box', size, at, tint, rot);
    const rod = (a, b, radius, tint) => {
      const start = new T.Vector3(...a), delta = new T.Vector3(...b).sub(start), q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.clone().normalize());
      part('cylinder', [radius, delta.length(), radius], start.addScaledVector(delta, .5).toArray(), tint, new T.Euler().setFromQuaternion(q).toArray().slice(0, 3));
    };
    box([.27, .31, .17], [0, .59, 0], shirt);
    part('sphere', [.071, .09, .069], [0, .82, 0], skin);
    part('sphere', [.075, .045, .073], [0, .88, -.008], index % 2 ? 0x5b3b29 : 0x25252b);
    for (const side of [-1, 1]) {
      rod([side * .06, .44, 0], [side * .09, .07, .025], .039, 0x29303c);
      box([.085, .055, .15], [side * .09, .028, .045], 0x171d24);
      const hand = role === 'voice' && side === 1 ? [.18, .77, .14] : [side * .13, .50, .23];
      rod([side * .14, .71, 0], [side * .19, .57, .1], .035, shirt);
      rod([side * .19, .57, .1], hand, .026, skin);
    }
    if (role === 'guitar' || role === 'bass') {
      part('sphere', [.14, .18, .045], [-.04, .47, .23], role === 'bass' ? 0x9bb5ac : 0xc88745);
      rod([0, .52, .24], [.32, .82, .24], .026, 0x916a48);
      rod([-.075, .40, .279], [.32, .82, .279], .004, 0xdad9c8);
      box([.075, .035, .016], [-.07, .42, .278], 0x282b30);
      rod([-.12, .73, .08], [.05, .39, .21], .014, 0x252327);
    } else if (role === 'keys') {
      box([.66, .07, .24], [0, .5, .32], 0x242e3c);
      box([.55, .016, .11], [0, .543, .38], 0xe4e3d6);
      for (let k = 0; k < 9; k++) box([.025, .023, .065], [-.24 + k * .06, .55, .35], 0x151b23);
      rod([-.23, 0, .32], [.23, .47, .32], .015, 0xa9afb8); rod([.23, 0, .32], [-.23, .47, .32], .015, 0xa9afb8);
    } else if (role === 'drums') {
      part('cylinder', [.25, .25, .25], [0, .25, .42], 0xa16c42, [Math.PI / 2, 0, 0]);
      part('cylinder', [.23, .012, .23], [0, .25, .555], 0xe2d7bd, [Math.PI / 2, 0, 0]);
      for (const side of [-1, 1]) {
        part('cylinder', [.13, .13, .13], [side * .23, .49, .28], 0x92613b);
        rod([side * .40, 0, .33], [side * .40, .7, .33], .012, 0xabb6bd);
        part('cylinder', [.20, .012, .20], [side * .4, .7, .33], 0xc9ae65);
        rod([side * .13, .50, .23], [side * .28, .65, .37], .008, 0xd5bc88);
      }
    } else {
      rod([.2, 0, .21], [.2, .79, .21], .012, 0xbac3cb);
      box([.23, .022, .17], [.2, .011, .21], 0x222a32);
      part('sphere', [.028, .045, .028], [.2, .81, .21], 0xd4d9da);
    }
    const geometry = new T.BufferGeometry();
    for (const [name, values] of Object.entries({ position: positions, normal: normals, color: colors })) geometry.setAttribute(name, new T.Float32BufferAttribute(values, 3));
    const mesh = new T.Mesh(geometry, material); mesh.name = role; mesh.castShadow = false; mesh.receiveShadow = true; return mesh;
  }
  function clear() { actors.forEach(mesh => mesh.geometry.dispose()); actors = []; group.clear(); }
  return { group,
    update(input, stage, motion) {
      if (disposed) return;
      const visible = !!input.performing && !!input.artistId && !!stage;
      group.visible = visible;
      if (!visible) return;
      const next = input.artistId;
      if (next !== key) {
        clear(); key = next; artist = next; const look = bandLook(next);
        actors = look.roles.map((role, i) => {
          const mesh = musician(role, i % 2 ? look.secondary : look.primary, i);
          mesh.userData.home = [(i - (look.roles.length - 1) / 2) * .95, .55, role === 'drums' ? -.65 : .45];
          mesh.position.set(...mesh.userData.home); group.add(mesh); return mesh;
        });
      }
      group.position.set(stage.x + (stage.rot % 2 ? OBJECT_TYPES.stage.h : OBJECT_TYPES.stage.w) / 2, 0, stage.y + (stage.rot % 2 ? OBJECT_TYPES.stage.w : OBJECT_TYPES.stage.h) / 2);
      group.rotation.y = -(stage.rot || 0) * Math.PI / 2;
      const t = motion && Number.isFinite(input.t) ? input.t : 0;
      actors.forEach((mesh, i) => { mesh.position.y = .55 + (t ? Math.sin(t * 2 + i) * .012 : 0); mesh.rotation.z = t ? Math.sin(t * 1.5 + i) * .025 : 0; });
    },
    info: () => ({ visible: group.visible, artist, count: group.visible ? actors.length : 0, roles: actors.map(mesh => mesh.name) }),
    dispose() { if (disposed) return; disposed = true; clear(); Object.values(primitives).forEach(g => g.dispose()); material.dispose(); },
  };
}
