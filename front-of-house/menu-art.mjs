// Original, code-authored concert illustrations. Decorative only; no game state or remote assets.
const acts = {
  'gravel-hymnal': ['#ccb477', '#667a62', 'folk', 2],
  'sodium-arcade': ['#f2ac62', '#819da7', 'rock', 4],
  'juniper-switchboard': ['#cf99b9', '#83ac89', 'soul', 5],
  'salt-ledger': ['#9cbec6', '#d69b70', 'rock', 3],
  'pallet-chorus': ['#bcb780', '#bc8a80', 'folk', 4],
  'tin-relay': ['#a2a3e0', '#71c8bb', 'electronic', 2],
  'gutter-census': ['#e78370', '#a799b8', 'rock', 5],
  'hollow-census': ['#c6b38d', '#88aba2', 'folk', 3],
  'amber-turnout': ['#edbd70', '#d286a2', 'soul', 4],
  'paper-voltage': ['#d7a8cf', '#8fa9d8', 'rock', 5],
  'north-kettle': ['#93bcbc', '#c7b486', 'folk', 5],
};
// Shared visual identity only; lineup size and roles never enter simulation state.
export function bandLook(artistId) {
  const [primary, secondary, genre, count] = acts[artistId] || acts['sodium-arcade'];
  return { primary, secondary, genre, roles: Array.from({ length: count }, (_, i) => genre === 'electronic' ? 'keys' : count > 2 && i === 0 ? 'drums' : i === Math.floor(count / 2) && genre === 'soul' ? 'voice' : i % 2 ? 'bass' : 'guitar') };
}
const skins = ['#dba581', '#a96e50', '#e2bb98', '#815443', '#bd8a67'];
function player(x, y, scale, color, index, role) {
  const instrument = role === 'drums' ? '<circle cy="23" r="23" fill="#c49372" stroke="#ddd6c0" stroke-width="3"/><circle cy="23" r="14" fill="#343e4e"/><path d="M-30 0v43m60-43v43M-42 0h24m-5-9l14 12m33-12L9 3" stroke="#dccbac" stroke-width="3"/>'
    : role === 'keys' ? '<path d="M-26 4h52v13h-52z" fill="#ddd6c0"/><path d="M-20 17l-5 27m45-27l5 27M-19 5v8m8-8v8m8-8v8m8-8v8m8-8v8" stroke="#292c34" stroke-width="3"/>'
    : role === 'voice' ? '<path d="M14-22v66m-10 0h20" stroke="#d9c9aa" stroke-width="2"/><rect x="9" y="-29" width="9" height="13" rx="4" fill="#ddd6c0"/><path d="M-8-5L13-23" stroke="#dba581" stroke-width="6" stroke-linecap="round"/>'
    : `<path d="M-17 5c-13 5-10 24 2 26 9 2 18-5 14-13L23-8l-5-5L-5 10c-3-8-7-8-12-5" fill="${role === 'bass' ? '#b9c4b9' : '#d6a25d'}" stroke="#282b31" stroke-width="2"/><circle cx="-10" cy="18" r="4" fill="#34313a"/><path d="M-13 21L24-12" stroke="#eee1c5" stroke-width="1.5"/>`;
  return `<g transform="translate(${x} ${y}) scale(${scale})"><ellipse cy="47" rx="27" ry="5" fill="#151d28" opacity=".45"/><path d="M-10 13l-5 30m23-30l9 30" stroke="#252b39" stroke-width="10" stroke-linecap="round"/><path d="M-16-17Q0-25 16-17l6 33h-43z" fill="${color}"/><path d="M-15-13l-9 23m39-23l12 20" stroke="${skins[index % skins.length]}" stroke-width="7" stroke-linecap="round"/><rect x="-4" y="-30" width="8" height="12" rx="3" fill="${skins[index % skins.length]}"/><ellipse cy="-40" rx="12" ry="15" fill="${skins[index % skins.length]}"/><path d="M-13-38Q-16-63 5-57q13 3 9 20l-5-12-19 3z" fill="${index % 2 ? '#3c3033' : '#252a34'}"/>${index % 3 === 0 ? '<path d="M-15-48h31M-9-48l2-13h15l4 13" stroke="#d8c7a6" stroke-width="4" fill="#675e51"/>' : ''}${instrument}</g>`;
}
export function performerSprite(artistId, index) {
  const look = bandLook(artistId), role = look.roles[index];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120">${player(50, 65, 1, index % 2 ? look.secondary : look.primary, index, role)}</svg>`;
}
export function bandArt(artistId, variant = '') {
  const [paper, ink, genre, count] = acts[artistId] || acts['sodium-arcade'];
  const people = Array.from({ length: count }, (_, i) => player(160 + (i - (count - 1) / 2) * 55, i % 2 ? 107 : 114, i % 2 ? .84 : .94, i % 2 ? ink : paper, i + Math.max(0, Object.keys(acts).indexOf(artistId)), genre === 'electronic' ? 'keys' : count > 2 && i === 0 ? 'drums' : i === Math.floor(count / 2) && genre === 'soul' ? 'voice' : i % 2 ? 'bass' : 'guitar')).join('');
  return `<svg class="band-art ${variant}" viewBox="0 0 320 170" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="170" fill="#242c3a"/><circle cx="243" cy="53" r="65" fill="${paper}" opacity=".23"/><path d="M0 126L115 0h43L34 151zM197 170L320 27v43l-80 100z" fill="${ink}" opacity=".25"/><path d="M0 17h320M0 153h320" stroke="${paper}" stroke-opacity=".4"/><path d="M18 25v111m284-111v111" stroke="${paper}" stroke-opacity=".2"/><ellipse cx="160" cy="156" rx="143" ry="9" fill="#151d28"/>${people}<path d="M0 165h320" stroke="${paper}" stroke-width="10"/></svg>`;
}
export function venueArt(id) {
  const shapes = {
    lot: '<path d="M0 52V30h32V17h36v35m138 0V23h24v-9h36v38" fill="#4d6270"/><path d="M93 51V19h84v32M85 18h100" stroke="#e5b77d" stroke-width="5"/><path d="M103 23l22 29m39-29l-21 29" stroke="#dcb170" stroke-width="7" opacity=".4"/>',
    club: '<path d="M42 58V8h186v50" fill="#536473"/><path d="M100 58V25h70v33" fill="#252c3b"/><path d="M90 18h90" stroke="#e2a5a0" stroke-width="5"/><path d="M55 20h23v13H55zm137 0h23v13h-23z" fill="#b7a780"/>',
    amphitheater: '<path d="M50 55a85 65 0 01170 0z" fill="#b6b1a0"/><path d="M69 55a66 48 0 01132 0z" fill="#737e80"/><path d="M90 55a45 32 0 0190 0z" fill="#303e4c"/><path d="M17 62h236" stroke="#d7b981" stroke-width="5"/>',
    festival: '<path d="M35 55V13h95v42m-102-42h109M181 55V27h56v28m-63-28h70" fill="none" stroke="#c2b5a0" stroke-width="4"/><path d="M42 18l28 37m50-37L90 55m98-23l17 24" stroke="#dba26e" stroke-width="8" opacity=".5"/><path d="M12 52V12l18 7-18 6m243 27V7l-17 8 17 7" fill="#b696b6" stroke="#b696b6" stroke-width="2"/>',
  };
  return `<svg class="venue-art" viewBox="0 0 270 68" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><rect width="270" height="68" fill="#283747"/><circle cx="230" cy="15" r="22" fill="#d1ab78" opacity=".35"/>${shapes[id] || shapes.lot}<path d="M0 60h270v8H0z" fill="#1e2935"/></svg>`;
}
