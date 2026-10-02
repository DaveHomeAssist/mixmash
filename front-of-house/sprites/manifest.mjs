// Front of House asset register: what each image in sprites/ is, where it came from, and
// whether it is final. Hand-maintained.
//
// `npm run docs:front-of-house` reads this file, measures every image, and writes
// docs/ASSETS.md. The build fails if an image in sprites/ is missing here, if an entry
// here has no file, or if a board sprite has no prop in board.js. So adding, renaming or
// removing an image means editing this file in the same change.
//
// `source` says where the file came from as far as the repository records it. "Not
// recorded" is an honest gap, listed in docs/KNOWN_ISSUES.md, not a placeholder to fill
// with a guess.

export const STATUS = {
  'stand-in': 'Drawn by the board now. Provisional: replaced by the style-anchor pixel sheets (ART_DIRECTION.md, FUTURE.md Art).',
  library: 'In the repository but drawn by nothing. Kept for later tiers; not wired into any rule.',
  final: 'Approved art. Nothing is final yet.',
};

// The eight props the board draws over each object footprint (board.js PROPS).
// Keys are OBJECT_TYPES ids in data.mjs and file names in sprites/.
export const BOARD_SPRITES = {
  stage: { subject: 'Truss-roof stage with deck and stairs', status: 'stand-in', added: '252833b', source: 'Not recorded' },
  'pa-s': { subject: 'Small PA: one cabinet on a stand', status: 'stand-in', added: '252833b', source: 'Not recorded' },
  'pa-m': { subject: 'Medium PA: stacked cabinets', status: 'stand-in', added: '252833b', source: 'Not recorded' },
  lights: { subject: 'Light tower on a mast', status: 'stand-in', added: '252833b', source: 'Not recorded' },
  bar: { subject: 'Bar trailer with taps', status: 'stand-in', added: '252833b', source: 'Not recorded' },
  restroom: { subject: 'Portable restroom unit', status: 'stand-in', added: '252833b', source: 'Not recorded' },
  gate: { subject: 'Entry gate with turnstile', status: 'stand-in', added: '252833b', source: 'Not recorded' },
  exit: { subject: 'Exit arch with arrow sign', status: 'stand-in', added: '252833b', source: 'Not recorded' },
};

// sprites/library/: 32 high-detail props added in one commit for later tiers. `use` names
// the FUTURE.md system or tier a prop would first serve; it is a suggestion, not a decision.
export const LIBRARY = {
  backline: { subject: 'Guitar amp head on a 4×4 cabinet', use: 'Stage dressing' },
  barricade: { subject: 'Steel crowd barrier section', use: 'Crowd control (Amphitheater and up)' },
  'cable-ramp': { subject: 'Yellow-lidded cable ramp', use: 'Terrain, cable, generator as objects (Festival)' },
  'camera-riser': { subject: 'Camera on a scaffold riser', use: 'Sponsorship and broadcast (Festival)' },
  cart: { subject: 'Utility golf cart', use: 'Site dressing (Festival)' },
  cooler: { subject: 'Rolling ice chest with bottles', use: 'Bar or green room dressing' },
  'crank-pa': { subject: 'Line array on a crank stand', use: 'House rig or PA tier' },
  'crowd-cheer': { subject: 'Group of four cheering fans', use: 'Crowd stamps (style anchor)' },
  'crowd-phones': { subject: 'Group of four fans holding phones up', use: 'Crowd stamps (style anchor)' },
  'delay-tower': { subject: 'Speakers flown in a truss delay tower', use: 'Sound coverage for large sites (Festival)' },
  distro: { subject: 'Power distribution rack with cable', use: 'Terrain, cable, generator as objects (Festival)' },
  drums: { subject: 'Drum kit on a riser', use: 'Stage dressing' },
  engineer: { subject: 'Crew member in headphones', use: 'Crew skills (after the Club plays)' },
  'flight-case': { subject: 'Two stacked road cases', use: 'Load-in and owning gear (Amphitheater)' },
  'foh-tent': { subject: 'FOH mix tent with desk and racks', use: 'FOH mix position' },
  followspot: { subject: 'Followspot on a tripod', use: 'Lighting tier' },
  'generator-fault': { subject: 'Worn generator trailer leaking smoke', use: 'Incident state (power failure)' },
  generator: { subject: 'Generator trailer', use: 'Terrain, cable, generator as objects (Festival)' },
  'green-room': { subject: 'Lit canvas tent with seating', use: 'Backstage space' },
  hazer: { subject: 'Hazer with fluid bottle', use: 'Showtime FX' },
  'led-wall': { subject: 'LED video wall on a truss base', use: 'Production upgrade (Amphitheater and up)' },
  lift: { subject: 'Scissor lift', use: 'Load-in and rigging' },
  medic: { subject: 'First-aid tent', use: 'Site services (Festival)' },
  merch: { subject: 'Merch table with shirts', use: 'Merch split (Club)' },
  'par-bar': { subject: 'Four PAR cans on a stand', use: 'Lighting tier' },
  snake: { subject: 'Multicore cable drum', use: 'Pro-mode paperwork (input lists), not scheduled' },
  sub: { subject: 'Tall subwoofer cabinet', use: 'PA tier' },
  'tour-bus': { subject: 'Tour bus', use: 'Artist arrival and backstage' },
  truss: { subject: 'Box-truss corner section', use: 'Stage and rigging' },
  'vip-deck': { subject: 'Raised deck with rail and stairs', use: 'Capacity zones (Amphitheater)' },
  water: { subject: 'Water station with cups', use: 'Site services' },
  wedge: { subject: 'Pair of floor monitor wedges', use: 'Stage dressing' },
};
export const LIBRARY_ADDED = '5b40552';

// Things on the board with no image file: drawn in code by board.js every frame.
export const CODE_DRAWN = [
  { name: 'Lot floor and grid', where: 'board.js', note: 'Tinted per room (FLOORS); the four venue looks are not drawn yet' },
  { name: 'Object boxes', where: 'board.js PROPS[].box, exported as LOOK', note: 'Fallback when a sprite fails, and the only art for a stage facing away from the viewer' },
  { name: 'Room pillars', where: 'board.js PILLAR', note: 'Part of the building; never placed or removed' },
  { name: 'Sightline overlay', where: 'board.js', note: 'Teal clear-view tiles, red blocked tiles (R-03)' },
  { name: 'Cursor and build ghost', where: 'board.js', note: 'Shows the footprint and whether the tile is legal' },
  { name: 'Night overlay and additive beams', where: 'board.js', note: 'Show night only; beams follow the drawn light tower' },
  { name: 'Crowd dots', where: 'board.js', note: 'A density field, not people; the crowd stamps in the library would replace them' },
  { name: 'Incident markers', where: 'board.js', note: 'Anchored to the drawn PA, gate or stage' },
];

// Files outside sprites/ that the page or the documents use.
export const OTHER_ASSETS = [
  { path: '../favicon.svg', kind: 'Icon', note: 'Shared MixMash Studio favicon' },
  { path: '/manifest.webmanifest', kind: 'PWA manifest', note: 'Shared studio manifest' },
  { path: 'docs/hud/hud-build.jpg', kind: 'Mockup', note: 'HUD.md mockup, Build' },
  { path: 'docs/hud/hud-show.jpg', kind: 'Mockup', note: 'HUD.md mockup, Show' },
  { path: 'docs/hud/hud-settle.jpg', kind: 'Mockup', note: 'HUD.md mockup, Settle' },
  { path: 'docs/hud/hud-phone.jpg', kind: 'Mockup', note: 'HUD.md mockup, phone' },
];

// Sound. The header's "Mute All" is the shared studio nav; this game plays no sound yet.
export const AUDIO = [];
