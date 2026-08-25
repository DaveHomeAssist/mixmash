/* MarsScape render contract.
   Art and renderer code import this module instead of repeating projection math.
   Contract changes require an explicit version bump and regenerated assets. */

export const RENDER_CONTRACT_VERSION = 1;

export const RENDER_CONTRACT = Object.freeze({
  version: RENDER_CONTRACT_VERSION,
  projection: '2:1 dimetric',
  board: Object.freeze({
    columns: 11,
    rows: 11,
    canvasWidth: 940,
    canvasHeight: 620,
    originX: 470,
    originY: 86,
  }),
  tile: Object.freeze({
    stepX: 42,
    stepY: 21,
    logicalWidth: 84,
    logicalHeight: 42,
    drawnWidth: 66,
    drawnHeight: 34,
  }),
  anchors: Object.freeze({
    prop: 'tile-centre',
    actor: 'feet',
  }),
  light: Object.freeze({
    source: 'northwest',
    shadow: 'southeast',
    screenVector: Object.freeze({ x: 1, y: 1 }),
  }),
  palette: Object.freeze({
    outline: '#2a2118',
    suit: '#e8e4dc',
    highlight: '#f7f4ee',
    crystal: '#4db8d4',
    crystalLight: '#9fe0f0',
    rust: '#b0603a',
    rustDeep: '#8f3f22',
    steel: '#8f96a0',
    steelLight: '#c8ccd2',
    steelDark: '#5d646e',
    copper: '#e2894a',
    copperLight: '#f2b285',
    regolith: '#96684a',
    regolithDark: '#6b4a33',
    parchment: '#f2ede6',
  }),
  naming: Object.freeze({
    idPattern: 'sprite:<family>:<id>:<state>:<frame>',
    filePattern: 'sprites/<family>/<id>__<state>__f<frame>.png',
    rules: 'lowercase snake_case ids; two-digit one-based frame numbers',
  }),
});

export function projectGrid(x, y) {
  return {
    x: (x - y) * RENDER_CONTRACT.tile.stepX,
    y: (x + y) * RENDER_CONTRACT.tile.stepY,
  };
}

export function footprintCorners(x, y, width = 1, depth = 1) {
  const north = projectGrid(x, y);
  const east = projectGrid(x + width, y);
  const south = projectGrid(x + width, y + depth);
  const west = projectGrid(x, y + depth);
  return { north, east, south, west };
}

export function assetId(family, id, state = 'built', frame = 1) {
  const paddedFrame = String(frame).padStart(2, '0');
  return `sprite:${family}:${id}:${state}:${paddedFrame}`;
}

export function assetPath(family, id, state = 'built', frame = 1) {
  const paddedFrame = String(frame).padStart(2, '0');
  return `sprites/${family}/${id}__${state}__f${paddedFrame}.png`;
}
