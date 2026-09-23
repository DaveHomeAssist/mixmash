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
  ground.polygon([[42, 5], [73, 21], [42, 37], [11, 21]], P.soilDark);
  ground.polygon([[42, 5], [73, 21], [42, 34], [11, 21]], P.soil);
  ground.polygon([[42, 5], [70, 20], [43, 19], [18, 21]], P.rust);
  ground.polygon([[19, 21], [43, 20], [68, 22], [42, 33]], P.soil);
  ground.line(12, 20, 42, 5, P.copper);
  ground.line(13, 21, 40, 7, P.copperLight);
  ground.line(43, 6, 72, 21, P.rustDeep);
  ground.line(12, 22, 42, 37, P.soilDark);
  ground.line(43, 36, 72, 21, P.ink);

  // Broad, subdued mineral beds read as regolith when the same face is tiled.
  for (const [x,y,w,h,color] of [
    [34,12,9,2,P.soil],[41,11,6,1,P.rustDeep],
    [29,18,8,2,P.soilDark],[35,19,6,2,P.rust],
    [45,21,9,2,P.soilDark],[38,25,8,2,P.rust],
    [49,27,4,1,P.rustDeep],
  ]) detail.rect(x,y,w,h,color);
  detail.line(31,18,36,20,P.rustDeep);
  detail.line(46,22,52,24,P.rustDeep);
  detail.set(51,16,P.soilDark); detail.set(52,16,P.rustDeep);
  detail.set(28,22,P.rustDeep);

  rocks.polygon([[25,20],[27,18],[30,19],[31,21],[28,22],[26,22]],P.soilDark);
  rocks.rect(27,19,2,1,P.soil);
  rocks.set(26,20,P.rust);
  return [ground, detail, rocks];
})();

const crystal = (() => {
  const [soil, mineral, glint] = layers(20, 16, ['Regolith base', 'Crystal facets', 'Northwest highlights']);
  soil.polygon([[1,13],[4,11],[7,12],[10,11],[14,12],[18,12],[19,15],[1,15]],P.ink);
  soil.polygon([[2,13],[5,12],[8,13],[11,12],[16,13],[18,15],[2,15]],P.soilDark);
  soil.rect(2,13,3,1,P.rust); soil.rect(15,13,3,1,P.soil);
  soil.rect(5,14,3,1,P.soil); soil.rect(11,14,4,1,P.rust);
  for (const [x,y] of [[3,12],[7,14],[15,12],[17,14]]) soil.set(x,y,P.copper);

  mineral.polygon([[2,12],[3,8],[5,6],[7,8],[8,12],[6,13],[3,13]],P.ink);
  mineral.polygon([[3,11],[4,8],[5,7],[6,8],[7,11],[6,12],[4,12]],P.crystal);
  mineral.polygon([[6,11],[7,6],[10,2],[12,4],[14,10],[12,13],[8,13]],P.ink);
  mineral.polygon([[7,10],[8,6],[10,3],[11,5],[12,10],[11,12],[8,12]],P.crystal);
  mineral.polygon([[12,12],[13,8],[15,6],[17,8],[18,12],[16,13],[13,13]],P.ink);
  mineral.polygon([[13,11],[14,8],[15,7],[16,8],[17,11],[16,12],[14,12]],P.crystal);
  mineral.polygon([[8,12],[10,8],[11,10],[12,12]],P.glassLight);
  mineral.line(10,3,10,10,P.crystalLight);
  mineral.line(11,5,12,9,P.glassLight);
  mineral.line(5,7,5,11,P.crystalLight);
  mineral.line(15,7,15,11,P.crystalLight);
  mineral.rect(8,7,2,2,P.crystalLight);
  mineral.rect(14,9,2,1,P.crystalLight);
  glint.set(10,3,P.white); glint.set(9,5,P.white);
  glint.set(5,7,P.white); glint.set(15,7,P.white);
  return [soil,mineral,glint];
})();

function astronaut(frame) {
  const [body, visor, marks] = layers(12,18,['Suit and walking pose','Helmet visor','Mission markings']);
  const left = [3,4,4,3][frame], right = [7,7,6,7][frame];
  body.rect(3,1,6,6,P.ink); body.rect(4,1,4,5,P.suit);
  body.rect(4,1,3,1,P.white); body.set(8,2,P.shade);
  body.rect(3,7,6,6,P.ink); body.rect(4,7,4,5,P.suit);
  body.rect(4,7,2,3,P.white); body.rect(7,9,1,3,P.shade);
  body.rect(2,8+(frame===1?1:0),2,4,P.ink);
  body.rect(2,8+(frame===1?1:0),1,3,P.suit);
  body.rect(9,8+(frame===3?1:0),2,4,P.ink);
  body.rect(9,8+(frame===3?1:0),1,3,P.shade);
  body.rect(left,12,2,4,P.ink); body.rect(left,12,1,3,P.suit);
  body.rect(right,12,2,4,P.ink); body.rect(right,12,1,3,P.shade);
  body.rect(left-1,16,3,2,P.ink); body.rect(left,16,2,1,P.steel);
  body.rect(right,16,3,2,P.ink); body.rect(right,16,2,1,P.steelDark);

  visor.rect(3,3,6,4,P.ink);
  visor.rect(4,4,4,2,P.glass);
  visor.rect(4,4,2,1,P.glassLight);
  visor.set(4,4,P.crystalLight); visor.set(5,4,P.crystal);
  visor.set(7,5,P.glassLight);
  visor.rect(3,6,6,1,P.steelLight);
  marks.rect(2,3,1,3,P.copper); marks.rect(9,3,1,3,P.rust);
  marks.rect(9,7,2,4,P.steelDark); marks.set(10,8,P.copper);
  marks.rect(4,8,2,2,P.steelLight); marks.set(5,8,P.copper);
  marks.rect(5,11,2,1,P.steelDark);
  marks.set(left,14,P.rust); marks.set(right+1,14,P.copper);
  return [body,visor,marks];
}

function habitat(damaged) {
  const [shell, glazing, fixtures, damage] = layers(28,26,['Dome and structure','Glazing','Door and equipment','Damage details']);
  shell.polygon([[2,13],[6,10],[9,9],[11,5],[15,3],[19,5],[22,9],[25,12],[26,21],[23,24],[5,24],[1,21]],P.ink);
  shell.polygon([[3,13],[7,10],[10,9],[12,5],[15,4],[19,6],[22,10],[24,12],[25,21],[22,23],[5,23],[2,21]],P.steelDark);
  shell.polygon([[3,13],[7,10],[10,9],[12,5],[15,4],[19,6],[22,10],[20,14],[16,15],[11,14],[7,16],[3,18]],P.suit);
  shell.polygon([[4,12],[8,10],[11,9],[12,12],[9,14],[4,17]],P.white);
  shell.polygon([[18,6],[22,10],[24,13],[20,15],[17,12]],P.shade);
  shell.polygon([[3,18],[8,15],[12,17],[15,16],[24,14],[25,21],[22,23],[5,23],[2,21]],P.steel);
  shell.line(4,13,8,10,P.white); shell.line(11,7,15,4,P.white);
  shell.line(18,5,22,10,P.steelLight);
  shell.line(5,19,8,22,P.steelDark); shell.line(20,17,23,22,P.steelDark);
  shell.rect(4,22,4,2,P.ink); shell.rect(5,22,2,1,P.copper);
  shell.rect(20,22,4,2,P.ink); shell.rect(21,22,2,1,P.copper);

  // The dome, greenhouse wing, and dark door are distinct at gameplay scale.
  glazing.polygon([[10,8],[12,5],[16,4],[19,6],[21,9],[19,11],[12,11]],P.ink);
  glazing.polygon([[11,8],[13,6],[16,5],[18,6],[20,9],[18,10],[12,10]],P.glass);
  glazing.polygon([[12,7],[14,5],[16,5],[16,8],[13,9]],P.glassLight);
  glazing.line(12,8,14,6,P.crystalLight);
  glazing.set(14,6,P.white); glazing.set(18,7,P.glassLight);
  glazing.polygon([[2,14],[6,11],[10,12],[10,19],[4,20],[2,18]],P.ink);
  glazing.polygon([[3,14],[6,12],[9,13],[9,18],[4,19],[3,17]],P.glass);
  glazing.polygon([[4,15],[6,13],[8,14],[8,18],[4,18]],P.greenDark);
  glazing.rect(5,16,2,2,P.green); glazing.set(7,15,P.green);
  glazing.line(6,12,6,18,P.steelLight);
  glazing.line(3,15,9,15,P.steelLight);
  glazing.set(4,14,P.crystalLight);

  fixtures.rect(11,16,7,9,P.ink); fixtures.rect(12,17,5,7,P.steelLight);
  fixtures.rect(13,18,3,6,P.glass); fixtures.set(13,18,P.glassLight);
  fixtures.rect(12,24,6,1,P.steelDark); fixtures.rect(13,25,4,1,P.copper);
  fixtures.rect(19,16,3,7,P.ink); fixtures.rect(20,16,2,6,P.rust);
  fixtures.rect(22,15,3,8,P.ink); fixtures.rect(23,16,1,6,P.copper);
  fixtures.rect(20,17,1,2,P.copperLight); fixtures.set(23,17,P.copperLight);
  fixtures.line(10,13,14,15,P.steelLight);
  fixtures.line(17,14,22,13,P.steelLight);
  fixtures.rect(24,3,1,9,P.ink); fixtures.rect(24,2,1,2,P.steelLight);
  fixtures.rect(25,1,1,3,P.ink); fixtures.set(25,1,P.copper);
  fixtures.rect(8,20,2,1,P.rust); fixtures.set(18,20,P.rust);
  if (damaged) {
    damage.polygon([[20,10],[25,10],[27,14],[25,18],[22,17],[19,20],[17,15]],P.ink);
    damage.polygon([[21,11],[24,12],[25,14],[22,15],[20,18],[18,15]],P.steelDark);
    damage.line(18,9,15,12,P.ink); damage.line(15,12,12,11,P.ink);
    damage.line(10,14,7,17,P.ink); damage.rect(5,17,3,2,P.ink);
    damage.set(4,17,P.crystalLight); damage.set(8,16,P.crystalLight);
    damage.line(23,4,26,2,P.ink); damage.set(26,2,P.copper);
    damage.rect(22,19,4,2,P.ink); damage.rect(23,20,2,2,P.rustDeep);
    damage.set(20,16,P.copperLight); damage.set(19,17,P.rustDeep);
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
