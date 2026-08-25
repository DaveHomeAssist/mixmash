/* MarsScape sprite registry — ported from marsscape@ab073bc src/sprites.js.
   Sprites are hand-authored pixel maps rendered to crisp-edge SVG at runtime: zero
   image files, tiny, palette-driven, and DOM-free. A PNG sheet can be registered to
   override any id behind the same API, and `spriteOrEmoji` falls back to an emoji
   when neither exists — so a missing asset degrades instead of rendering nothing. */

const PAL = {
  k: '#2a2118', // outline
  w: '#e8e4dc', W: '#f7f4ee', // suit white + highlight
  c: '#4db8d4', C: '#9fe0f0', // crystal cyan + light
  r: '#b0603a', d: '#8f3f22', // rust + deep rust
  s: '#8f96a0', S: '#c8ccd2', g: '#5d646e', // steel + light + dark
  o: '#e2894a', O: '#f2b285', // copper + light
  b: '#6b4a33', B: '#96684a', // rock brown + light
  h: '#c4bcab', // suit shadow
  e: '#6fbf7a', E: '#3e7d54', // greenhouse glass + deep
  y: '#d7a74c', Y: '#f0d488', // gold + light gold
  p: '#8f5fc0', P: '#c39ae8', // rare-earth purple + light
  u: '#2f6f80', // solar panel deep teal
  n: '#1d3a44', // dark glass / window
  v: '#5a4a66', V: '#8d7c9c', // iridium violet-grey + light
};

const MAPS = {
  astro: [
    '............',
    '............',
    '......k.....',
    '....kkwkk...',
    '...knCCCnk..',
    '...knnnnnk..',
    '...kwwwhhk..',
    '.kkWWwwwwwk.',
    '.ksWwwwwwwk.',
    '.kswwrrrwwk.',
    '.kswwrrrwwk.',
    '.kkwwwwwwwk.',
    '...kwwkwwk..',
    '...kwk.kwk..',
    '...kwk.kwk..',
    '...kwk.kwk..',
    '...kkk.kkk..',
    '............',
  ],
  iron_ore: [
    '....kkkk....',
    '..kkBBBbk...',
    '.kBBcBBbbbk.',
    '.kBBBBbbbbk.',
    'kBBcBbbbcbbk',
    'kBBBbbbbbbbk',
    'kbBBbbcbbbbk',
    '.kbbbbbbbbk.',
    '..kbbbbbbk..',
    '...kkkkkk...',
  ],
  copper_ore: [
    '....kkkk....',
    '..kkOOOdk...',
    '.kOOdOOoook.',
    '.kOOOOooook.',
    'kOOdOoooodok',
    'kOOOoooooook',
    'koOOoodooook',
    '.kooooooook.',
    '..kooooook..',
    '...kkkkkk...',
  ],
  ice: [
    '.....kk.....',
    '....kCCk....',
    '....kCCk....',
    '...kCCCCk...',
    '..kCCcCCCk..',
    '..kcCCCCck..',
    '.kcCCCCCCck.',
    '.kccCCCCcck.',
    '..kccCCcck..',
    '...kcccck...',
    '....kcck....',
    '.....kk.....',
  ],
  iron_bar: [
    '..kkkkkkkk..',
    '.kSSSSSSSSk.',
    '.ksSSSSSSsk.',
    'kssssssssssk',
    'kssssssssssk',
    'kgssssssssgk',
    '.kggggggggk.',
    '..kkkkkkkk..',
  ],
  frame: [
    'kkkkkkkkkkkk',
    'kSssssssssSk',
    'kss......ssk',
    'kss......ssk',
    'kss......ssk',
    'kss......ssk',
    'kss......ssk',
    'kss......ssk',
    'kss......ssk',
    'kss......ssk',
    'kSssssssssSk',
    'kkkkkkkkkkkk',
  ],
  titanium_ore: [
    '....kkkk....',
    '..kkSSSsk...',
    '.kSSWSSssSk.',
    '.kSSSSWssSk.',
    'kSSWSssssWSk',
    'kSSSssssssSk',
    'ksSSssWsssSk',
    '.kssssssssk.',
    '..kssssssk..',
    '...kkkkkk...',
  ],
  copper_bar: [
    '..kkkkkkkk..',
    '.kOOOOOOOOk.',
    '.kOoOOOOook.',
    'kOoooooooook',
    'kOoooooooook',
    'kdoooooooodk',
    '.kddddddddk.',
    '..kkkkkkkk..',
  ],
  titanium_bar: [
    '..kkkkkkkk..',
    '.kSSSSSSSSk.',
    '.kWSSSSSWSk.',
    'kSSSSSSSSSSk',
    'kSSSSSSSSSSk',
    'kgSSSSSSSSgk',
    '.kggggggggk.',
    '..kkkkkkkk..',
  ],
  part: [
    '...kkkkkk...',
    '..kggggggk..',
    '.kgCCggCCgk.',
    '.kgCCggCCgk.',
    'kggggggggggk',
    'kgCggggggCgk',
    'kgCggggggCgk',
    '.kgggggggggk',
    '..kkkkkkkkk.',
  ],
  water: [
    '.....kk.....',
    '.....kk.....',
    '....kCCk....',
    '...kCCCCk...',
    '..kCCCCCCk..',
    '.kCcCCCCCck.',
    '.kcCCCCCCck.',
    '.kcCCCCCCck.',
    '..kccCCcck..',
    '...kkkkkk...',
  ],
  food: [
    '....kkkk....',
    '..kkBBBBkk..',
    '.kBBBbBBBBk.',
    'kBBBBBBbBBBk',
    'kBbBBBBBBBBk',
    'kBBBBBbBBBBk',
    '.kBBbBBBBBk.',
    '..kBBBBBBk..',
    '...kkkkkk...',
  ],
  fuel: [
    '..kkkkkkkk..',
    '.kgggggggggk',
    '.kgWWWWWWgk.',
    '.kgWccccWgk.',
    '.kgWccccWgk.',
    '.kgWccccWgk.',
    '.kgWWWWWWgk.',
    '.kgggggggggk',
    '..kkkkkkkk..',
  ],

  /* ---- board sprites: buildings (bld_*), node outcrops (node_*), and
     late-ore item icons. Generated from geometric primitives with the
     locked NW-light shading, then reviewed on the live board. ---- */
  bld_habitat: [
    '..........................',
    '..........................',
    '..........................',
    '..........................',
    '..........................',
    '.............k............',
    '.........kkkkwkkkk........',
    '........kWWwwwwwwwk.......',
    '.......knnnnnnnnnnnk......',
    '......kCCCCCCCCCCCCCk.....',
    '.....kccccccccccccccck....',
    '.....knnnnnnnnnnnnnnnk....',
    '....kWWwwwwnnnnwhhhhhhk...',
    '....kWWwwwwnccnhhhhhhhk...',
    '....kWwwwwwnccnhhhhhhhk...',
    '....kwwwwwwnccnhhhhhhhk...',
    '...kWwwwwwwnnnnhhhhhhhkk..',
    '....kBBBBBBBBBBBBBBBBk....',
    '..kkBBBBBBBBBBBBBBBBBBkk..',
    '.kkkkkkkkkkkkkkkkkkkkkkkk.',
  ],
  bld_depot: [
    '..........................',
    '..........................',
    '.............kk...........',
    '...........kkSSkk.........',
    '.........kkSSSSSSkk.......',
    '.......kkSSSSSSSSSSkk.....',
    '......kSSSSSSSSSSSSSSk....',
    '......kssSSSSSSSSSSggk....',
    '......kssssSSSSSSggggk....',
    '......kOsssssSSggggggk....',
    '....kkOOOOssssgggggggk....',
    '..kkOOOOOOOOssgggggggk....',
    '..koOOOOOOddyygggggggk....',
    '..koooOOddddssgggggkk.....',
    '..koooodddddssgggkk.......',
    '..kkooodddkkksgkk.........',
    '....kkodkk...kk...........',
    '......kk..................',
  ],
  bld_solar: [
    '............................',
    '.............kk.............',
    '...........kkcckk...........',
    '.........kkcccucckk.........',
    '.......kkcccucccucckk.......',
    '.....kkcccucccccccucckk.....',
    '...kkCccucccucccucccucckk...',
    '..kcccucccccccucccccccucck..',
    '..kuucccucccucccucccuccuuk..',
    '...kkuucccucccccccuccuukk...',
    '.....kkuucccucccuccuukk.....',
    '.......kkuucccuccuukk.......',
    '.........kkuuccuukk.........',
    '...........kuuuuk...........',
    '...........kBuuBk...........',
    '.........kkBBBBBBkk.........',
    '.......kkBBBBBBBBBBkk.......',
    '.....kkkkkkkkkkkkkkkkkk.....',
  ],
  bld_water: [
    '..................',
    '..................',
    '.........k........',
    '.....kkkkskkkk....',
    '....kSSSssssssk...',
    '...kSSSSSSsssssk..',
    '...kSSSSSSSSsssk..',
    '...kSSSSSSSSSSgk..',
    '...kSSSssSssgggk..',
    '...knnnnnnnnnnnk..',
    '...kCCCCCCCCCCCk..',
    '...kccccccccccck..',
    '...knnnnnnnnnnnk..',
    '...kSSSsssssgggk..',
    '...kSSSsssssgggk..',
    '...kSSSsssssggggk.',
    '...kSSSsssssggggk.',
    '...kSSSsssssgggk..',
    '...kSSSsssssggkk..',
    '....kBBBBBBBBk....',
    '..kkBBBBBBBBBBkk..',
    '.kBBBBBBBBBBBBBBk.',
    '.kbbBBBBBBBBBBbbk.',
    '.kkkkkkkkkkkkkkkk.',
  ],
  bld_machine: [
    '................kkk.......',
    '................kgk.......',
    '................ksk.......',
    '............kk..ksk.......',
    '..........kkSSkkssk.......',
    '........kkSSSSSSssk.......',
    '......kkSSSSSSSSSSSk......',
    '....kkSSSSSSSSSSSSSSkk....',
    '....ksSSSSSSSSSSSSSSgk....',
    '....ksssSSSSSSSSSSgggk....',
    '....kssOssSSSSSSgggggk....',
    '....kssoOOssSSgggggggk....',
    '....kssoooOssggggggggk....',
    '....kssoooossggngggggk....',
    '....kssoooossggggngggk....',
    '....kkssooossggnggggkk....',
    '......kkssossggggnkk......',
    '........kksssgggkk........',
    '..........kksgkk..........',
    '............kk............',
    '..........................',
  ],
  bld_greenhouse: [
    '..........................',
    '..........................',
    '.............k............',
    '........kkkkkekkkkk.......',
    '.......keeWeeeeWeeek......',
    '.....kkeeeWeeeeWeeeekk....',
    '....kWeeeeWeeeeWeeeeWEk...',
    '....kWeeeeWeeeeWeeeeWEk...',
    '...keWeeeeWeeeeWeeeEWEEk..',
    '...keWeeeeWeeeeWeeEEWEEk..',
    '...keWeeeeWeeeeWeEEEWEEk..',
    '..kkkkkkeeWeeeeWEEkkkkkk..',
    '........kBBBBBBBBk........',
    '......kkBBBBBBBBBBkk......',
    '....kkBBBBBBBBBBBBBBkk....',
    '..kkBBBBBBBBBBBBBBBBBBkk..',
    '.kkkkkkkkkkkkkkkkkkkkkkkk.',
  ],
  bld_lab: [
    '......kkkkk.............',
    '....kkccccckk...........',
    '...kCCCWWcccck..........',
    '...kCCCCCCccck..........',
    '....kkCCCCCkk...........',
    '......kCCkk.............',
    '.......kk...............',
    '.......kk...............',
    '.......kk..kk...........',
    '.......kgkkSSkk.........',
    '.......kSSSSSSSkk.......',
    '.....kkSSSSSSSSSSkk.....',
    '...kkSSSSSSSSSSSSSSkk...',
    '...ksSSSSSSSSSSSSSSgk...',
    '...ksssnnSSSSSCCSgggk...',
    '...ksssnnnSSSSSgCgggk...',
    '...ksssnnnsSSgggggggk...',
    '...ksssnnnssggggggggk...',
    '...ksssssnssggggggggk...',
    '...kkkkkkkkkkkkkkkkkk...',
  ],
  bld_reactor: [
    '....................',
    '........kkkk........',
    '......kksssskkk.....',
    '....kkWWwwwwwwwkk...',
    '....kWWWWWwwwwwwk...',
    '...kWWWWWWWWwwwwwk..',
    '...kWWWWWWWWWwwwwk..',
    '...kWWWWWWWWWWWwwk..',
    '...kyyyyyyyyyyyyyk..',
    '...kWWWWwwWwwwhhhk..',
    '...kWWWWwwwwwwhhhk..',
    '...kWWWWwwwwwwhhhk..',
    '...kWnnnnnnnnnnnhk..',
    '...kWCCCCCCCCCCChk..',
    '...kWccccccccccchk..',
    '...kWnnnnnnnnnnnhk..',
    '...kWWWWwwwwwwhhhk..',
    '...kWWWWwwwwwwhhhk..',
    '...kWWWWwwwwwwhhhk..',
    '...kWWWWwwwwwwhhhk..',
    '...kkWWWwwwwwwhkkk..',
    '.....kBBBBBBBBk.....',
    '...kkBBBBBBBBBBkk...',
    '.kkBBBBBBBBBBBBBBkk.',
    '.kbBBBBBBBBBBBBBBbk.',
    '.kkkkkkkkkkkkkkkkkk.',
  ],
  node_iron_ore: [
    '....................',
    '....................',
    '....................',
    '....................',
    '............k.......',
    '......k...kkrkk.....',
    '....kkrkkkrrrrdk....',
    '...krrrrddrrdddk....',
    '..kBrrdddbbbdBork...',
    '..kBbbdbbBBBBorrdk..',
    '.kbbbbbbBBBbbbrddbk.',
    '..kbbbbBbbbbbbbdbbbk',
    '..kkbbbbbbbbbbbbbbk.',
    '....kkkbkkkkkbkkkk..',
    '.......k.....k......',
  ],
  node_copper_ore: [
    '....................',
    '....................',
    '....................',
    '....................',
    '............k.......',
    '......k...kkOkk.....',
    '....kkOkkkOOOOok....',
    '...kOOOOooOOoook....',
    '..kBOOooobbboBYOk...',
    '..kBbbobbBBBBYOOok..',
    '.kbbbbbbBBBbbbOoobk.',
    '..kbbbbBbbbbbbbobbbk',
    '..kkbbbbbbbbbbbbbbk.',
    '....kkkbkkkkkbkkkk..',
    '.......k.....k......',
  ],
  node_titanium_ore: [
    '....................',
    '....................',
    '....................',
    '....................',
    '............k.......',
    '......k...kkSkk.....',
    '....kkSkkkSSSSsk....',
    '...kSSSSssSSsssk....',
    '..kBSSsssbbbsBWSk...',
    '..kBbbsbbBBBBWSSsk..',
    '.kbbbbbbBBBbbbSssbk.',
    '..kbbbbBbbbbbbbsbbbk',
    '..kkbbbbbbbbbbbbbbk.',
    '....kkkbkkkkkbkkkk..',
    '.......k.....k......',
  ],
  node_iridium_ore: [
    '....................',
    '....................',
    '....................',
    '....................',
    '............k.......',
    '......k...kkvkk.....',
    '....kkvkkkvvvvvk....',
    '...kvvvvvvvvvvvk....',
    '..ksvvvvvgggvsVvk...',
    '..ksggvggssssVvvvk..',
    '.kggggggsssgggvvvgk.',
    '..kggggsgggggggvgggk',
    '..kkggggggggggggggk.',
    '....kkkgkkkkkgkkkk..',
    '.......k.....k......',
  ],
  node_ice: [
    '....................',
    '....................',
    '............k.......',
    '............kk......',
    '...........kCk......',
    '......k....kCk......',
    '.....kk...kCCk......',
    '.....kck..kCcck..k..',
    '.....kCckkCCcck.kk..',
    '.....kCccCCCccckCk..',
    '.....kCccBCCccCCCk..',
    '...kkBCcbbbCcbbCck..',
    '..kBbbbbbbbbbbbbbbk.',
    '...kkbbbbbbbbbbbkk..',
    '.....kkkkkbkkkkk....',
    '..........k.........',
  ],
  node_silicate_ore: [
    '....................',
    '....................',
    '............k.......',
    '............kk......',
    '...........kYk......',
    '......k....kYk......',
    '.....kk...kYYk......',
    '.....kyk..kYyyk..k..',
    '.....kYykkYYyyk.kk..',
    '.....kYyyYYYyyykYk..',
    '.....kYyyBYYyyYYYk..',
    '...kkBYybbbYybbYyk..',
    '..kBbbbbbbbbbbbbbbk.',
    '...kkbbbbbbbbbbbkk..',
    '.....kkkkkbkkkkk....',
    '..........k.........',
  ],
  node_rare_ore: [
    '....................',
    '....................',
    '............k.......',
    '............kk......',
    '...........kPk......',
    '......k....kPk......',
    '.....kk...kPPk......',
    '.....kpk..kPppk..k..',
    '.....kPpkkPPppk.kk..',
    '.....kPppPPPpppkPk..',
    '.....kPppBPPppPPPk..',
    '...kkBPpbbbPpbbPpk..',
    '..kBbbbbbbbbbbbbbbk.',
    '...kkbbbbbbbbbbbkk..',
    '.....kkkkkbkkkkk....',
    '..........k.........',
  ],
  node_component: [
    '....................',
    '....................',
    '...............k....',
    '...............k....',
    '..............kk....',
    '...........kkkgk....',
    '...........kgoogk...',
    '........kk..koogk...',
    '......kkSsk.kgggk...',
    '....kkSsssbkgggk....',
    '...kSsssbbbbbbbbkk..',
    '..kBbsbbbbbbbbbbbbk.',
    '...kkbbbbbbbbbbbkk..',
    '.....kkkkkkkkkkk....',
  ],
  silicate_ore: [
    '............',
    '............',
    '.....k......',
    '...kkykk....',
    '..kYWyyyk...',
    '.kyyyyYYykk.',
    '..kyyYyyyyyk',
    '...kkykkykk.',
    '.....k..k...',
    '............',
  ],
  rare_ore: [
    '............',
    '............',
    '.....k......',
    '...kkpkk....',
    '..kPWpppk...',
    '.kppppPPpkk.',
    '..kppPpppppk',
    '...kkpkkpkk.',
    '.....k..k...',
    '............',
  ],
  iridium_ore: [
    '............',
    '............',
    '.....k......',
    '...kkvkk....',
    '..kVWvvvk...',
    '.kvvvvVVvkk.',
    '..kvvVvvvvvk',
    '...kkvkkvkk.',
    '.....k..k...',
    '............',
  ],
  geode: [
    '............',
    '......k.....',
    '...kkkBkkk..',
    '..kBBbbbbbk.',
    '..kBppppbbk.',
    '.kbbpPPpbbbk',
    '..kbppppbbk.',
    '..kbbbbbbbk.',
    '...kkkbkkk..',
    '......k.....',
  ],
};

/* ---------- sprite sheets (Workstream A2) ----------
   Register a PNG sheet (data URI or same-origin path) sliced into a grid; ids
   map to cells. spriteHTML then returns an <img> cropped to the cell via
   background-position, so A2's AI art drops in behind the exact same API. */
const SHEETS = {};   // id -> { url, sx, sy, cw, ch, sheetW, sheetH }
export function registerSheet(url, cols, rows, cw, ch, ids) {
  const sheetW = cols * cw, sheetH = rows * ch;
  ids.forEach((id, i) => {
    if (!id) return;
    SHEETS[id] = { url, sx: (i % cols) * cw, sy: Math.floor(i / cols) * ch, cw, ch, sheetW, sheetH };
  });
}
export function hasSheet(id) { return !!SHEETS[id]; }

/* Canonical ids the port renamed away from the sprite maps' original names. */
const ALIAS = { component: 'part', advanced_component: 'part', composite_frame: 'frame' };
export function resolveSpriteId(id) { return (MAPS[id] || SHEETS[id]) ? id : (ALIAS[id] || id); }

export function hasSprite(id) { const r = resolveSpriteId(id); return !!MAPS[r] || !!SHEETS[r]; }
export function spriteIds() { return Object.keys(MAPS); }
export function spriteMap(id) { return MAPS[resolveSpriteId(id)]; }
export function palette() { return PAL; }

/* Render a sprite: a registered sheet cell (A2 art) wins; otherwise a
   hand-authored pixel map rendered to crisp SVG. px = on-screen pixel scale. */
export function spriteHTML(id, px = 2) {
  id = resolveSpriteId(id);
  const sh = SHEETS[id];
  if (sh) {
    const s = px; // display each source pixel at px CSS px
    return `<span class="pspr sheet" style="width:${sh.cw * s}px;height:${sh.ch * s}px;` +
      `background-image:url(${sh.url});background-position:-${sh.sx * s}px -${sh.sy * s}px;` +
      `background-size:${sh.sheetW * s}px ${sh.sheetH * s}px;image-rendering:pixelated" aria-hidden="true"></span>`;
  }
  const rows = MAPS[id];
  if (!rows) return '';
  const h = rows.length, w = rows[0].length;
  let rects = '';
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    let x = 0;
    while (x < w) {
      const ch = row[x];
      const color = PAL[ch];
      if (!color) { x++; continue; }
      let run = 1;
      while (x + run < w && row[x + run] === ch) run++;
      rects += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${color}"/>`;
      x += run;
    }
  }
  return `<svg class="pspr" viewBox="0 0 ${w} ${h}" width="${w * px}" height="${h * px}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

/* ---------- emoji fallback ----------
   Every id the game asks for has a text fallback, so a sprite that fails to load (or
   was never authored) still renders something meaningful rather than an empty box. */
export const EMOJI = {
  astro: '\u{1F9D1}\u{200D}\u{1F680}', iron_ore: '\u{1FAA8}', copper_ore: '\u{1F7E4}',
  titanium_ore: '\u{2B1C}', silicate_ore: '\u{1F536}', rare_ore: '\u{1F7E3}',
  iridium_ore: '\u{26AB}', ice: '\u{1F9CA}', geode: '\u{1F48E}', water: '\u{1F4A7}',
  frame: '\u{1F532}', component: '\u{1F39B}', food: '\u{1F954}', fuel: '\u{1F50B}',
};

export function emojiFor(id) {
  return EMOJI[id] || '\u{2B1B}';
}

export function emojiHTML(id, px = 2) {
  return `<span class="pspr pspr-emoji" style="font-size:${px * 10}px;line-height:1" role="img" aria-hidden="true">${emojiFor(id)}</span>`;
}

/* Render a sprite if one exists, otherwise its emoji. This is what callers should
   use: it never returns an empty string. */
export function spriteOrEmoji(id, px = 2) {
  if (hasSprite(id)) return spriteHTML(id, px);
  return emojiHTML(id, px);
}
