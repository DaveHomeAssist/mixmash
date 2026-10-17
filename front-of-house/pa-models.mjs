// FOH presentation adapter for the FMP ZLX-15BT / EKX-15SP equipment models.
// Approximate exterior geometry only; no manufacturer specification is a game rule.
export const PA_MODEL_REVISION = 'pa-exterior-1';
export const PA_MODEL_SOURCE = Object.freeze({
  repository: 'DaveHomeAssist/fmp-suite', revision: 'ca438504fe5e09879d106e668529bd21b3d992f0',
  models: ['models/assets/nnc-zlx-15bt-0.js', 'models/assets/nnc-ekx-15sp-0.js'],
  sourceHashes: {"nnc-zlx-15bt-0.js": "595598003298f99c5c9926b2693e61a727390e0fa4e7507787188cf0cd3568d4", "nnc-ekx-15sp-0.js": "c5bd41e5a87a5c3095ce887a128a6775327be2b0397b0d4c4c3116a7ee4e9c86"},
  definitions: ['nnc-zlx-15bt@0.1.0', 'nnc-ekx-15sp@0.1.0'],
  rights: 'Adapted project-authored procedural reconstruction; manufacturer names identify references, not endorsement.',
  units: 'source millimetres converted to logical tiles', up: '+Y', forward: '+Z', pivot: 'footprint centre at ground',
  calibration: 'Approximate reconstruction; physical verification pending',
});

// Shared primitive pool supplied by Lot models: no viewer, textures or per-instance renderer.
// Retain source cabinet dimensions and stable component IDs; omit hidden drivers and connector pins.
export function addPaRig(group, part, type, metresPerTile) {
  if (!['pa-s', 'pa-m'].includes(type)) throw new RangeError('Unsupported PA representation');
  if (!(metresPerTile > 0) || !Number.isFinite(metresPerTile)) throw new RangeError('Invalid PA scale');
  const unit = 1 / (1000 * metresPerTile), medium = type === 'pa-m';
  const add = (id, size, pos, color, form = 'box', metal = 0) => {
    const mesh = part(group, size.map(n => n * unit), pos.map(n => n * unit), color, metal, form, id);
    mesh.userData.componentId = id;
    mesh.userData.sourceComponentId = id.includes('.zlx.') ? 'zlx.cabinet' : id.includes('.ekx.') ? 'ekx.cabinet' : null;
    return mesh;
  };
  for (const [side, x] of [['left', -500], ['right', 500]]) {
    const subs = medium ? 2 : 1;
    for (let i = 0; i < subs; i++) {
      const y = i * 455, id = `${side}.sub${i + 1}.ekx`;
      add(`${id}.cabinet`, [530,455,551], [x,y+227.5,0], 0x25292d, 'rounded');
      add(`${id}.grille`, [480,405,8], [x,y+227.5,275], 0x41494e, 'rounded');
      for (const sx of [-1,1]) add(`${id}.handle.${sx}`, [14,60,130], [x+sx*266,y+273,20], 0x727a7e, 'rounded', .6);
      add(`${id}.panel`, [260,230,10], [x,y+240,-276], 0x111619, 'rounded');
      add(`${id}.badge`, [40,22,10], [x,y+65,282], 0xbdc6bf);
      for (const z of [-180,180]) for (const dx of [-195,195]) add(`${id}.foot.${dx}.${z}`, [55,14,60], [x+dx,y+7,z], 0x13171a);
    }
    const bottom = medium ? 1370 : 1170, id = `${side}.zlx`;
    add(`${side}.support`, [35,bottom-subs*455,35], [x,(bottom+subs*455)/2,0], 0x9ca5a7, 'cylinder', .7);
    add(`${id}.cabinet`, [426,685,383], [x,bottom+342.5,0], 0x25292d, 'rounded');
    add(`${id}.grille`, [366,615,6], [x,bottom+342.5,191], 0x465055, 'rounded');
    // The source woofer/horn arrangement is suggested through the grille, not exposed as an x-ray.
    const cone = add(`${id}.woofer`, [300,5,300], [x,bottom+250,197], 0x343c40, 'cylinder');
    cone.rotation.x = Math.PI / 2;
    add(`${id}.horn`, [230,110,5], [x,bottom+540,197], 0x313a3e, 'rounded');
    for (const sx of [-1,1]) add(`${id}.handle.${sx}`, [16,60,120], [x+sx*214,bottom+411,20], 0x111619, 'rounded');
    add(`${id}.handle.top`, [130,18,60], [x,bottom+693,-40], 0x14191c, 'rounded');
    add(`${id}.panel`, [260,230,10], [x,bottom+300,-192], 0x111619, 'rounded');
    add(`${id}.badge`, [40,22,10], [x,bottom+65,200], 0xbdc6bf);
  }
  group.userData.equipmentRepresentation = { revision: PA_MODEL_REVISION, type };
}
