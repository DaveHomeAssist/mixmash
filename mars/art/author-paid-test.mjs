// Reproducible DEC-79 paid-test candidate. The source art is drawn in independent
// layers, then exported both as native Aseprite documents and flat runtime PNGs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';

const root = new URL('../', import.meta.url).pathname;
const P = {
  ink: '#2a2118', white: '#f7f4ee', suit: '#e8e4dc', shade: '#c4bcab',
  steel: '#8f96a0', steelLight: '#c8ccd2', steelDark: '#5d646e',
  rust: '#b0603a', rustDeep: '#8f3f22', copper: '#e2894a', copperLight: '#f2b285',
  soil: '#96684a', soilDark: '#6b4a33', crystal: '#4db8d4', crystalLight: '#9fe0f0',
  glass: '#1d3a44', glassLight: '#2f6f80', green: '#6fbf7a', greenDark: '#3e7d54',
};

function rgba(hex, alpha = 255) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >>> 16) & 255, (n >>> 8) & 255, n & 255, alpha];
}

class Layer {
  constructor(name, width, height) {
    this.name = name;
    this.width = width;
    this.height = height;
    this.pixels = Buffer.alloc(width * height * 4);
  }
  set(x, y, color) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    const c = rgba(color);
    for (let j = 0; j < 4; j += 1) this.pixels[i + j] = c[j];
  }
  rect(x, y, w, h, color) {
    for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) this.set(xx, yy, color);
  }
  line(x1, y1, x2, y2, color) {
    const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
    let error = dx - dy;
    while (true) {
      this.set(x1, y1, color);
      if (x1 === x2 && y1 === y2) break;
      const twice = error * 2;
      if (twice > -dy) { error -= dy; x1 += sx; }
      if (twice < dx) { error += dx; y1 += sy; }
    }
  }
  polygon(points, color) {
    const minY = Math.max(0, Math.min(...points.map(p => p[1])));
    const maxY = Math.min(this.height - 1, Math.max(...points.map(p => p[1])));
    for (let y = minY; y <= maxY; y += 1) {
      const xs = [];
      for (let i = 0; i < points.length; i += 1) {
        const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
        if (y1 === y2 || y < Math.min(y1, y2) || y >= Math.max(y1, y2)) continue;
        xs.push(x1 + (y + 0.5 - y1) * (x2 - x1) / (y2 - y1));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.ceil(xs[i]); x < xs[i + 1]; x += 1) this.set(x, y, color);
      }
    }
  }
}

function layers(width, height, names) { return names.map(name => new Layer(name, width, height)); }
function composite(parts) {
  const out = Buffer.alloc(parts[0].pixels.length);
  for (const part of parts) {
    for (let i = 0; i < out.length; i += 4) {
      if (part.pixels[i + 3]) part.pixels.copy(out, i, i, i + 4);
    }
  }
  return out;
}

const terrain = (() => {
  const [ground, detail, rocks] = layers(84, 42, ['Regolith face', 'Soil clusters', 'Embedded stones']);
  ground.polygon([[42, 4], [75, 21], [42, 38], [9, 21]], P.ink);
  ground.polygon([[42, 5], [73, 21], [42, 37], [11, 21]], P.soil);
  ground.polygon([[42, 5], [73, 21], [42, 22], [11, 21]], P.rust);
  ground.line(12, 20, 42, 5, P.copper);
  ground.line(13, 21, 42, 6, P.copperLight);
  ground.line(12, 22, 42, 36, P.soilDark);
  ground.line(42, 36, 72, 21, P.soilDark);
  for (const [x, y, w] of [[27,14,4],[46,12,3],[58,21,4],[31,26,3],[48,29,3]]) {
    detail.rect(x, y, w, 1, P.rustDeep);
    detail.rect(x + 1, y - 1, Math.max(1, w - 2), 1, P.soil);
  }
  for (const [x, y] of [[25,19],[51,25]]) {
    rocks.rect(x-1,y,3,2,P.soilDark);
    rocks.set(x,y-1,P.soil);
  }
  return [ground, detail, rocks];
})();

const crystal = (() => {
  const [soil, mineral, glint] = layers(20, 16, ['Regolith base', 'Crystal facets', 'Northwest highlights']);
  soil.polygon([[2,13],[5,11],[8,13],[12,11],[17,12],[19,15],[1,15]],P.ink);
  soil.polygon([[3,13],[6,12],[8,14],[12,12],[17,13],[18,15],[2,15]],P.soilDark);
  soil.rect(3,13,3,1,P.soil);
  soil.rect(14,13,3,1,P.rust);
  soil.rect(6,15,9,1,P.soilDark);
  for (const [x,top,bottom,width] of [[4,7,13,4],[8,2,13,5],[13,6,13,4]]) {
    mineral.polygon([[x,top+2],[x+2,top],[x+width,top+2],[x+width-1,bottom],[x+1,bottom]],P.ink);
    mineral.polygon([[x+1,top+2],[x+2,top+1],[x+width-1,top+2],[x+width-2,bottom-1],[x+1,bottom-1]],P.crystal);
    mineral.line(x+2,top+2,x+2,bottom-3,P.crystalLight);
    mineral.line(x+width-2,top+4,x+width-2,bottom-2,P.glassLight);
    glint.set(x+2,top+1,P.white);
  }
  return [soil,mineral,glint];
})();

function astronaut(frame) {
  const [body, visor, marks] = layers(12,18,['Suit and walking pose','Helmet visor','Mission markings']);
  const left = [3,4,4,3][frame], right = [7,7,6,7][frame];
  body.rect(3,2,6,5,P.ink); body.rect(4,2,4,4,P.suit); body.rect(4,2,3,1,P.white);
  body.rect(4,7,5,6,P.ink); body.rect(5,7,3,5,P.suit); body.rect(5,8,2,2,P.white);
  body.rect(2,8+(frame===1?1:0),2,4,P.ink); body.rect(3,8+(frame===1?1:0),1,3,P.shade);
  body.rect(9,8+(frame===3?1:0),2,4,P.ink); body.rect(9,8+(frame===3?1:0),1,3,P.suit);
  body.rect(left,12,2,4,P.ink); body.rect(left,12,1,3,P.suit);
  body.rect(right,12,2,4,P.ink); body.rect(right,12,1,3,P.shade);
  body.rect(left-1,16,3,2,P.ink); body.rect(left,16,2,1,P.steelDark);
  body.rect(right,16,3,2,P.ink); body.rect(right,16,2,1,P.steel);
  visor.rect(4,4,5,2,P.ink); visor.rect(5,4,3,1,P.glassLight); visor.rect(5,5,3,1,P.glass);
  visor.set(5,4,P.crystalLight);
  marks.rect(8,8,2,3,P.steelDark); marks.set(8,8,P.copper);
  marks.rect(5,10,2,1,P.rust); marks.set(4,7,P.copper);
  return [body,visor,marks];
}

function habitat(damaged) {
  const [shell, glazing, fixtures, damage] = layers(28,26,['Dome and structure','Glazing','Door and equipment','Damage details']);
  shell.polygon([[8,5],[12,3],[18,3],[22,6],[25,11],[26,19],[23,23],[5,23],[2,19],[3,12]],P.ink);
  shell.polygon([[8,6],[13,4],[18,4],[21,7],[24,12],[25,19],[22,22],[6,22],[3,19],[4,12]],P.steelDark);
  shell.polygon([[8,6],[13,4],[18,4],[21,7],[22,12],[17,16],[4,17],[4,12]],P.suit);
  shell.line(5,11,9,6,P.white); shell.line(9,6,13,4,P.white);
  shell.line(5,18,8,22,P.steel); shell.line(18,16,23,21,P.steel);
  shell.rect(5,21,3,2,P.copper); shell.rect(20,21,3,2,P.copper);
  glazing.polygon([[9,7],[12,5],[18,5],[20,8],[18,10],[11,10]],P.ink);
  glazing.polygon([[10,7],[13,6],[17,6],[19,8],[17,9],[11,9]],P.glassLight);
  glazing.line(11,7,13,6,P.crystalLight); glazing.line(14,6,15,6,P.crystalLight);
  glazing.polygon([[4,13],[8,11],[10,13],[10,18],[5,19],[4,17]],P.ink);
  glazing.polygon([[5,13],[8,12],[9,13],[9,17],[5,18]],P.glassLight);
  glazing.rect(6,15,2,2,P.greenDark); glazing.set(6,15,P.green);
  fixtures.rect(11,16,6,8,P.ink); fixtures.rect(12,17,4,6,P.steelDark);
  fixtures.rect(13,18,2,5,P.glass); fixtures.rect(12,23,5,1,P.copper);
  fixtures.rect(11,24,7,1,P.ink); fixtures.rect(12,25,5,1,P.copper);
  fixtures.rect(22,15,3,6,P.ink); fixtures.rect(23,16,2,4,P.rust);
  fixtures.rect(23,3,1,9,P.ink); fixtures.set(23,3,P.copperLight);
  fixtures.rect(7,19,3,1,P.rust); fixtures.rect(18,19,3,1,P.rust);
  if (damaged) {
    damage.polygon([[20,11],[25,11],[26,17],[23,16],[21,19],[18,16]],P.ink);
    damage.polygon([[21,12],[24,12],[24,15],[22,15],[20,17],[19,16]],P.steelDark);
    damage.line(18,10,14,13,P.ink); damage.line(14,13,11,12,P.ink);
    damage.line(10,14,7,17,P.ink); damage.rect(5,16,2,2,P.ink);
    damage.line(23,4,25,2,P.ink); damage.set(25,2,P.copper);
    damage.rect(24,19,2,2,P.ink); damage.set(25,19,P.rustDeep);
  }
  return [shell,glazing,fixtures,damage];
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i=0;i<8;i+=1) crc = (crc>>>1) ^ ((crc&1)?0xedb88320:0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type,data) {
  const name=Buffer.from(type); const size=Buffer.alloc(4); size.writeUInt32BE(data.length);
  const checksum=Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name,data])));
  return Buffer.concat([size,name,data,checksum]);
}
function png(width,height,pixels) {
  const header=Buffer.alloc(13); header.writeUInt32BE(width,0); header.writeUInt32BE(height,4); header[8]=8; header[9]=6;
  const rows=Buffer.alloc(height*(1+width*4));
  for(let y=0;y<height;y+=1) pixels.copy(rows,y*(1+width*4)+1,y*width*4,(y+1)*width*4);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),pngChunk('IDAT',deflateSync(rows)),pngChunk('IEND',Buffer.alloc(0))]);
}
function chunk(type,data) {
  const out=Buffer.alloc(6); out.writeUInt32LE(6+data.length,0); out.writeUInt16LE(type,4);
  return Buffer.concat([out,data]);
}
function aseprite(width,height,layerNames,frames,durations) {
  const encodedFrames=frames.map((parts,frameIndex)=>{
    const chunks=[];
    if(frameIndex===0) for(const name of layerNames) {
      const bytes=Buffer.from(name); const data=Buffer.alloc(18+bytes.length);
      data.writeUInt16LE(3,0); data.writeUInt16LE(0,2); data.writeUInt16LE(width,6); data.writeUInt16LE(height,8);
      data[12]=255; data.writeUInt16LE(bytes.length,16); bytes.copy(data,18);
      chunks.push(chunk(0x2004,data));
    }
    parts.forEach((part,index)=>{
      const data=Buffer.alloc(20); data.writeUInt16LE(index,0); data[6]=255; data.writeUInt16LE(2,7);
      data.writeUInt16LE(width,16); data.writeUInt16LE(height,18);
      chunks.push(chunk(0x2005,Buffer.concat([data,deflateSync(part.pixels)])));
    });
    const frame=Buffer.alloc(16); frame.writeUInt32LE(16+chunks.reduce((n,c)=>n+c.length,0),0);
    frame.writeUInt16LE(0xf1fa,4); frame.writeUInt16LE(chunks.length,6);
    frame.writeUInt16LE(durations[frameIndex],8); frame.writeUInt32LE(chunks.length,12);
    return Buffer.concat([frame,...chunks]);
  });
  const header=Buffer.alloc(128); header.writeUInt32LE(128+encodedFrames.reduce((n,f)=>n+f.length,0),0);
  header.writeUInt16LE(0xa5e0,4); header.writeUInt16LE(encodedFrames.length,6);
  header.writeUInt16LE(width,8); header.writeUInt16LE(height,10); header.writeUInt16LE(32,12);
  header.writeUInt32LE(1,14); header.writeUInt16LE(durations[0],16);
  header[32]=255; header[34]=1; header[35]=1;
  return Buffer.concat([header,...encodedFrames]);
}

const assets=[
  {family:'terrain',id:'base_soil',size:[84,42],states:[['active',[terrain]]],names:terrain.map(p=>p.name),durations:[600]},
  {family:'resource',id:'blue_crystal',size:[20,16],states:[['active',[crystal]]],names:crystal.map(p=>p.name),durations:[600]},
  {family:'actor',id:'astronaut',size:[12,18],states:[['active',[0,1,2,3].map(astronaut)]],names:astronaut(0).map(p=>p.name),durations:[150,150,150,150]},
  {family:'building',id:'habitat',size:[28,26],states:[['active',[habitat(false)]],['damaged',[habitat(true)]]],names:habitat(false).map(p=>p.name),durations:[600,600]},
];
for(const asset of assets) {
  const [width,height]=asset.size; const frames=[];
  for(const [state,partsList] of asset.states) {
    for(let i=0;i<partsList.length;i+=1) {
      const relative=`assets/commissioned/sprites/${asset.family}/${asset.id}__${state}__f${String(i+1).padStart(2,'0')}.png`;
      const path=join(root,relative); mkdirSync(dirname(path),{recursive:true});
      writeFileSync(path,png(width,height,composite(partsList[i])));
      frames.push(partsList[i]);
    }
  }
  const source=join(root,`art/sources/${asset.family}/${asset.id}.aseprite`);
  mkdirSync(dirname(source),{recursive:true});
  writeFileSync(source,aseprite(width,height,asset.names,frames,asset.durations));
}
