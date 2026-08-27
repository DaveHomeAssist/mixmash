/* MarsScape render contract.
   Art and renderer code import this module instead of repeating projection math.
   Contract changes require an explicit version bump and regenerated assets. */

export const RENDER_CONTRACT_VERSION = 2;

export const RENDER_CONTRACT = Object.freeze({
  version: RENDER_CONTRACT_VERSION,
  decision: 'DEC-79',
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
    ground: Object.freeze({
      node: Object.freeze({ type: 'feet', x: 0.5, y: 1, screenOffsetX: 0, screenOffsetY: 12 }),
      building: Object.freeze({ type: 'feet', x: 0.5, y: 1, screenOffsetX: 0, screenOffsetY: 18 }),
      actor: Object.freeze({ type: 'feet', x: 0.5, y: 1, screenOffsetX: 0, screenOffsetY: 4 }),
    }),
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
    suitShadow: '#c4bcab',
    greenhouse: '#6fbf7a',
    greenhouseDeep: '#3e7d54',
    gold: '#d7a74c',
    goldLight: '#f0d488',
    rareEarth: '#8f5fc0',
    rareEarthLight: '#c39ae8',
    panelDeep: '#2f6f80',
    windowDark: '#1d3a44',
    iridium: '#5a4a66',
    iridiumLight: '#8d7c9c',
  }),
  pixelDensity: Object.freeze({
    sourcePixel: 1,
    gameplayScale: 3,
    normalGameplayZoom: 1,
    minViewportZoom: 0.5,
    maxViewportZoom: 2.5,
    imageSmoothing: false,
  }),
  spriteClasses: Object.freeze({
    terrain: Object.freeze({ canvasWidth: 84, canvasHeight: 42, scale: 1, anchor: 'tile-centre', footprintWidth: 1, footprintDepth: 1 }),
    terrain_edge: Object.freeze({ canvasWidth: 84, canvasHeight: 68, scale: 1, anchor: 'tile-centre', footprintWidth: 1, footprintDepth: 1 }),
    item: Object.freeze({ canvasWidth: 12, canvasHeight: 12, scale: 3, anchor: 'centre', footprintWidth: 0, footprintDepth: 0 }),
    resource: Object.freeze({ canvasWidth: 20, canvasHeight: 16, scale: 3, anchor: 'feet', footprintWidth: 1, footprintDepth: 1 }),
    actor: Object.freeze({ canvasWidth: 12, canvasHeight: 18, scale: 3, anchor: 'feet', footprintWidth: 1, footprintDepth: 1 }),
    rover: Object.freeze({ canvasWidth: 24, canvasHeight: 16, scale: 3, anchor: 'feet', footprintWidth: 1, footprintDepth: 1 }),
    building: Object.freeze({ canvasWidth: 28, canvasHeight: 26, scale: 3, anchor: 'feet', footprintWidth: 1, footprintDepth: 1 }),
    infrastructure: Object.freeze({ canvasWidth: 28, canvasHeight: 14, scale: 3, anchor: 'feet', footprintWidth: 1, footprintDepth: 1 }),
    prop: Object.freeze({ canvasWidth: 16, canvasHeight: 16, scale: 3, anchor: 'feet', footprintWidth: 1, footprintDepth: 1 }),
    effect: Object.freeze({ canvasWidth: 28, canvasHeight: 26, scale: 3, anchor: 'feet', footprintWidth: 1, footprintDepth: 1 }),
  }),
  states: Object.freeze(['blueprint', 'construction', 'active', 'disabled', 'damaged']),
  stateFallbacks: Object.freeze({
    blueprint: Object.freeze(['blueprint', 'active']),
    construction: Object.freeze(['construction', 'blueprint', 'active']),
    active: Object.freeze(['active']),
    disabled: Object.freeze(['disabled', 'active']),
    damaged: Object.freeze(['damaged', 'disabled', 'active']),
  }),
  animation: Object.freeze({
    engineTickMs: 600,
    allowedFrameMs: Object.freeze([100, 150, 200, 300, 600]),
    clips: Object.freeze({
      idle: Object.freeze({ frames: 4, frameMs: 150, loop: true }),
      travel: Object.freeze({ frames: 6, frameMs: 100, loop: true }),
      functional: Object.freeze({ frames: 4, frameMs: 150, loop: true }),
      damage: Object.freeze({ frames: 3, frameMs: 200, loop: false }),
      effect: Object.freeze({ frames: 6, frameMs: 100, loop: false }),
    }),
  }),
  export: Object.freeze({
    format: 'png',
    colorSpace: 'sRGB',
    bitDepth: 8,
    colorType: 'rgba',
    alpha: 'straight',
    background: 'transparent',
    editableExtensions: Object.freeze(['aseprite', 'kra', 'psd']),
  }),
  accessibility: Object.freeze({
    normalTextContrast: 4.5,
    largeTextContrast: 3,
    nonTextContrast: 3,
    entitySilhouetteContrast: 3,
    reducedMotionRequired: true,
    colorAloneForbidden: true,
  }),
  naming: Object.freeze({
    idPattern: 'sprite:<family>:<id>:<state>:<frame>',
    filePattern: 'sprites/<family>/<id>__<state>__f<frame>.png',
    rules: 'lowercase snake_case ids; canonical state names; two-digit one-based frame numbers',
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

export function footprintCornersFromCenter(x, y, width = 1, depth = 1) {
  return footprintCorners(x - width / 2, y - depth / 2, width, depth);
}

export function assetId(family, id, state = 'active', frame = 1) {
  const paddedFrame = String(frame).padStart(2, '0');
  return `sprite:${family}:${id}:${state}:${paddedFrame}`;
}

export function assetPath(family, id, state = 'active', frame = 1) {
  const paddedFrame = String(frame).padStart(2, '0');
  return `sprites/${family}/${id}__${state}__f${paddedFrame}.png`;
}
