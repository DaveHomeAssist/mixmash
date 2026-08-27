import { RENDER_CONTRACT, footprintCorners, projectGrid } from './render-contract.mjs';
import { SpriteBitmapCache } from './sprite-canvas.mjs';
import { spriteIds } from './sprites.mjs';

const specCanvas = document.querySelector('#specCanvas');
const spriteCanvas = document.querySelector('#spriteCanvas');
const specContext = specCanvas.getContext('2d');
const spriteContext = spriteCanvas.getContext('2d');
const bitmapStatus = document.querySelector('#bitmapStatus');
const spriteCache = new SpriteBitmapCache();

const overlayState = {
  measurements: true,
  anchors: true,
  footprints: true,
};

document.querySelector('#logicalTile').textContent = `${RENDER_CONTRACT.tile.logicalWidth} × ${RENDER_CONTRACT.tile.logicalHeight}`;
document.querySelector('#drawnTile').textContent = `${RENDER_CONTRACT.tile.drawnWidth} × ${RENDER_CONTRACT.tile.drawnHeight}`;
document.querySelector('#boardSize').textContent = `${RENDER_CONTRACT.board.columns} × ${RENDER_CONTRACT.board.rows}`;
document.querySelector('#contractVersion').textContent = `Render contract v${RENDER_CONTRACT.version} · ${RENDER_CONTRACT.decision} locked`;

for (const [name, color] of Object.entries(RENDER_CONTRACT.palette)) {
  const swatch = document.createElement('div');
  swatch.className = 'swatch';
  swatch.style.background = color;
  swatch.innerHTML = `<b>${name}</b><span>${color}</span>`;
  document.querySelector('#palette').append(swatch);
}

document.querySelector('#showMeasurements').addEventListener('change', (event) => {
  overlayState.measurements = event.target.checked;
  drawSpec();
});
document.querySelector('#showAnchors').addEventListener('change', (event) => {
  overlayState.anchors = event.target.checked;
  drawSpec();
});
document.querySelector('#showFootprints').addEventListener('change', (event) => {
  overlayState.footprints = event.target.checked;
  drawSpec();
});

function diamond(context, x, y, width, height) {
  context.beginPath();
  context.moveTo(x, y - height / 2);
  context.lineTo(x + width / 2, y);
  context.lineTo(x, y + height / 2);
  context.lineTo(x - width / 2, y);
  context.closePath();
}

function drawSpec() {
  const { board, tile } = RENDER_CONTRACT;
  specContext.clearRect(0, 0, specCanvas.width, specCanvas.height);
  const gradient = specContext.createLinearGradient(0, 0, 0, specCanvas.height);
  gradient.addColorStop(0, '#15211f');
  gradient.addColorStop(1, '#351a12');
  specContext.fillStyle = gradient;
  specContext.fillRect(0, 0, specCanvas.width, specCanvas.height);

  specContext.save();
  specContext.translate(board.originX, board.originY);
  for (let y = 0; y < board.rows; y += 1) {
    for (let x = 0; x < board.columns; x += 1) {
      const point = projectGrid(x, y);
      diamond(specContext, point.x, point.y, tile.logicalWidth, tile.logicalHeight);
      specContext.strokeStyle = '#9fe0f04f';
      specContext.setLineDash([3, 5]);
      specContext.stroke();
      diamond(specContext, point.x, point.y, tile.drawnWidth, tile.drawnHeight);
      specContext.setLineDash([]);
      specContext.fillStyle = (x + y) % 2 ? '#8f3f22' : '#b0603a';
      specContext.fill();
      specContext.strokeStyle = '#2a2118';
      specContext.stroke();
    }
  }

  if (overlayState.footprints) {
    drawFootprint(1, 1, 1, 1, '#d7a74c', '1×1');
    drawFootprint(5, 1, 2, 1, '#f2b285', '2×1');
    drawFootprint(4, 6, 2, 2, '#9fe0f0', '2×2');
  }
  if (overlayState.anchors) drawAnchors();
  if (overlayState.measurements) drawMeasurements();
  specContext.restore();

  specContext.fillStyle = '#f2ede6';
  specContext.font = '700 15px "Courier New", monospace';
  specContext.fillText(`2:1 DIMETRIC · CONTRACT V${RENDER_CONTRACT.version} · ${RENDER_CONTRACT.decision}`, 24, 32);
  specContext.fillStyle = '#bda985';
  specContext.font = '12px "Courier New", monospace';
  specContext.fillText('Solid: 66×34 terrain face · Dotted: 84×42 logical tile', 24, 52);
}

function drawFootprint(x, y, width, depth, color, label) {
  const corners = footprintCorners(x, y, width, depth);
  specContext.beginPath();
  specContext.moveTo(corners.north.x, corners.north.y);
  specContext.lineTo(corners.east.x, corners.east.y);
  specContext.lineTo(corners.south.x, corners.south.y);
  specContext.lineTo(corners.west.x, corners.west.y);
  specContext.closePath();
  specContext.strokeStyle = color;
  specContext.lineWidth = 3;
  specContext.stroke();
  specContext.fillStyle = color;
  specContext.font = '700 12px "Courier New", monospace';
  specContext.fillText(label, corners.north.x + 7, corners.north.y - 8);
  specContext.lineWidth = 1;
}

function cross(x, y, color) {
  specContext.strokeStyle = color;
  specContext.lineWidth = 2;
  specContext.beginPath();
  specContext.moveTo(x - 8, y);
  specContext.lineTo(x + 8, y);
  specContext.moveTo(x, y - 8);
  specContext.lineTo(x, y + 8);
  specContext.stroke();
  specContext.lineWidth = 1;
}

function drawAnchors() {
  const prop = projectGrid(3, 4);
  const actor = projectGrid(7, 5);
  cross(prop.x, prop.y, '#4db8d4');
  cross(actor.x, actor.y, '#f2ede6');
  specContext.fillStyle = '#4db8d4';
  specContext.font = '700 12px "Courier New", monospace';
  specContext.fillText('PROP: TILE CENTRE', prop.x - 66, prop.y - 16);
  specContext.fillStyle = '#f2ede6';
  specContext.fillText('ACTOR: FEET', actor.x - 42, actor.y - 16);
}

function drawMeasurements() {
  const origin = projectGrid(1, 8);
  const east = projectGrid(2, 8);
  const south = projectGrid(1, 9);
  specContext.strokeStyle = '#f2ede6';
  specContext.fillStyle = '#f2ede6';
  specContext.font = '12px "Courier New", monospace';
  specContext.beginPath();
  specContext.moveTo(origin.x, origin.y);
  specContext.lineTo(east.x, east.y);
  specContext.moveTo(origin.x, origin.y);
  specContext.lineTo(south.x, south.y);
  specContext.stroke();
  specContext.fillText('+42,+21', (origin.x + east.x) / 2 + 6, (origin.y + east.y) / 2);
  specContext.fillText('−42,+21', (origin.x + south.x) / 2 - 70, (origin.y + south.y) / 2);

  specContext.strokeStyle = '#d7a74c';
  specContext.beginPath();
  specContext.moveTo(250, 25);
  specContext.lineTo(305, 80);
  specContext.stroke();
  specContext.fillStyle = '#d7a74c';
  specContext.fillText('NW LIGHT → SE SHADOW', 178, 17);
}

async function drawSpriteProof() {
  const ids = spriteIds();
  const primed = await spriteCache.prime(ids);
  spriteContext.clearRect(0, 0, spriteCanvas.width, spriteCanvas.height);
  spriteContext.fillStyle = '#15100d';
  spriteContext.fillRect(0, 0, spriteCanvas.width, spriteCanvas.height);
  const cellWidth = spriteCanvas.width / 7;
  ids.forEach((id, index) => {
    const column = index % 7;
    const row = Math.floor(index / 7);
    const x = column * cellWidth + cellWidth / 2;
    const y = row * 105 + 64;
    spriteContext.fillStyle = '#2b2118';
    spriteContext.fillRect(column * cellWidth + 5, row * 105 + 5, cellWidth - 10, 95);
    spriteCache.drawSprite(spriteContext, id, x, y, { scale: 3, anchor: 'feet' });
    spriteContext.fillStyle = '#e5d2ad';
    spriteContext.font = '11px "Courier New", monospace';
    spriteContext.textAlign = 'center';
    spriteContext.fillText(id, x, row * 105 + 88);
  });
  spriteContext.textAlign = 'left';
  bitmapStatus.textContent = `${primed}/${ids.length} ImageBitmap sprites cached`;
  document.documentElement.dataset.spriteBitmaps = String(primed);
}

window.render_spec_to_text = () => JSON.stringify({
  contractVersion: RENDER_CONTRACT.version,
  projection: RENDER_CONTRACT.projection,
  logicalTile: [RENDER_CONTRACT.tile.logicalWidth, RENDER_CONTRACT.tile.logicalHeight],
  drawnTile: [RENDER_CONTRACT.tile.drawnWidth, RENDER_CONTRACT.tile.drawnHeight],
  propAnchor: RENDER_CONTRACT.anchors.prop,
  actorAnchor: RENDER_CONTRACT.anchors.actor,
  spriteBitmaps: spriteCache.size,
});

drawSpec();
drawSpriteProof();
