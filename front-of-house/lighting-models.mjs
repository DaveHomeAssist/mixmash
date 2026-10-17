// FOH exterior adapter for the equipment library's J-Six and Vertigo Tri LED.
// Fixture appearance is independent of the game's aggregate lighting rules.
export const LIGHTING_MODEL_REVISION = 'lighting-exterior-1';
export const LIGHTING_MODEL_SOURCE = Object.freeze({
  repository: 'DaveHomeAssist/fmp-suite', revision: '8a857717391e82b0518dd7d17dfbe06a34cbdb7a',
  models: ['models/assets/nnc-j-six-0.js', 'models/assets/nnc-vertigo-tri-led-0.js'],
  sourceHashes: {"nnc-j-six-0.js": "610db523519fa57f7a08629d010ce8e7662b33a3b170d481e6318b9309dc2c1e", "nnc-vertigo-tri-led-0.js": "681bbe4f7a0fa4bd4027481f9dde16207209ae444d2c311087a49fdc02385278"},
  definitions: ['nnc-j-six@0.1.0', 'nnc-vertigo-tri-led@0.1.0'],
  units: 'source millimetres converted to logical tiles', up: '+Y', forward: '+Z',
  pivot: 'footprint centre at ground',
  rights: 'Adapted project-authored procedural reconstruction; manufacturer names identify references, not endorsement.',
  calibration: 'Approximate fixture exteriors; tower retains the existing game height. Not a measured production rig.',
});

export function addLightingRig(group, part, metresPerTile) {
  if (!(metresPerTile > 0) || !Number.isFinite(metresPerTile)) throw new RangeError('Invalid lighting scale');
  const u = 1 / (1000 * metresPerTile);
  const add = (id, source, size, pos, color, form = 'box', metal = 0) => {
    const mesh = part(group, size.map(n => n*u), pos.map(n => n*u), color, metal, form, id);
    mesh.userData.componentId = id; mesh.userData.sourceComponentId = source;
    return mesh;
  };
  // Retain the established 2.8-tile tower height and 1x1 logical footprint.
  const top = 2800 * metresPerTile, fixtureY = top - 290;
  add('tower.base', null, [1400,160,1400], [0,80,0], 0x31363d);
  add('tower.mast', null, [110,top,110], [0,top/2,0], 0xb0b8bd, 'cylinder', .8);
  add('tower.crossbar', null, [1700,120,120], [0,top,0], 0xb0b8bd, 'rounded', .8);
  for (const [side,x] of [['left',-580],['right',580]]) {
    const y=fixtureY;
    add(`${side}.body`, 'jsix.base', [281,110,252], [x,y+63,0], 0x242a32, 'rounded');
    for (const s of [-1,1]) {
      add(`${side}.yoke.${s}`, 'jsix.base', [8,105,30], [x+s*139,y+128,-30], 0x363e49, 'rounded');
      const knob=add(`${side}.knob.${s}`, 'jsix.base', [30,14,30], [x+s*148,y+112,-30], 0x151b22, 'cylinder');knob.rotation.z=Math.PI/2;
    }
    add(`${side}.yoke.top`, 'jsix.base', [286,7,30], [x,y+179,-30], 0x363e49);
    add(`${side}.clamp`, null, [40,110,40], [x,y+235,-30], 0x929da7, 'rounded', .6);
    for (const [label,dx] of [['left',-75],['right',75]]) {
      const source=`jsix.pod.${label}`;
      const rim=add(`${side}.${label}.rim`,source,[98,10,98],[x+dx,y+62,129],0x8b959f,'cylinder',.6);rim.rotation.x=Math.PI/2;
      const lens=add(`${side}.${label}.lens`,source,[80,12,80],[x+dx,y+62,136],0x91bfd2,'cylinder',.3);lens.rotation.x=Math.PI/2;
    }
    add(`${side}.rear.panel`, 'jsix.io.power', [110,40,8], [x,y+55,-130], 0x12171d);
  }
  const y=fixtureY;
  add('centre.body','vert.body',[250,182,150],[0,y+106,-75],0x242a32,'rounded');
  for (const s of [-1,1]) add(`centre.yoke.${s}`,'vert.body',[8,184,38],[s*130,y+179,-70],0x363e49,'rounded');
  add('centre.yoke.top','vert.body',[268,8,38],[0,y+267,-70],0x363e49);
  // A pooled ellipsoid suggests the source's faceted dome; no beam or live control is implied.
  add('centre.dome','vert.dome.left',[137,119,79],[0,y+135,23],0x172737,'sphere',.35);
  for(const [i,x] of [-85,0,85].entries()) for(const [j,dy] of [-35,35].entries()) {
    add(`centre.lens.${i}.${j}`,x<0?'vert.dome.left':'vert.dome.right',[25,20,8],[x,y+135+dy,107-Math.abs(x)*.3],0x6d9bb8,'rounded',.4);
  }
  add('centre.rear.panel','vert.io.iec',[100,35,8],[0,y+60,-155],0x12171d);
  group.userData.equipmentRepresentation = {revision:LIGHTING_MODEL_REVISION,type:'lights'};
}
