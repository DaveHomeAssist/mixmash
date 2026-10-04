// Front of House key bindings: the one table both key handlers in game.js read, the list
// the menu shows (index.html, "Keys and mouse") and what test-engine.mjs checks for clashes.
//
// scope 'board': handled only while the board canvas has focus. Its key events then reach the
//   page handler too, so a board key and a page key in the same phase must never overlap.
// scope 'page': handled anywhere on the page, but not while a window is open (only Escape
//   reaches a window) and not while a text field has focus.
// phases: the phases in which the binding acts, or 'all'.
// combos: each { keys, ctrl, meta, alt, shift }. keys are KeyboardEvent.key values; a modifier
//   left out matches either state, true requires it held and false requires it released.
// overrides: bindings this one takes precedence over where both match (it is checked first).
// keysLabel and label: the menu's list, word for word.

const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export const BINDINGS = [
  // Anywhere on the board
  { id: 'turn-view', scope: 'board', phases: 'all', combos: [{ keys: ['q', 'Q'] }],
    keysLabel: 'Q', label: 'Turn the view a quarter' },
  { id: 'zoom-in', scope: 'board', phases: 'all', combos: [{ keys: ['=', '+'] }],
    keysLabel: '+', label: 'Zoom in' },
  { id: 'zoom-out', scope: 'board', phases: 'all', combos: [{ keys: ['-', '_'] }],
    keysLabel: '−', label: 'Zoom out' },
  { id: 'zoom-fit', scope: 'board', phases: 'all', combos: [{ keys: ['0'] }],
    keysLabel: '0', label: 'Show the whole lot' },
  { id: 'pan', scope: 'board', phases: 'all', combos: [{ keys: ARROWS, shift: true }], overrides: ['move-cursor'],
    keysLabel: 'Shift + arrows', label: 'Move a zoomed view' },
  // Anywhere on the page
  { id: 'close', scope: 'page', phases: 'all', combos: [{ keys: ['Escape'] }],
    keysLabel: 'Esc', label: 'Close a window/menu, or cancel the Build tool' },
  { id: 'menu', scope: 'page', phases: 'all', combos: [{ keys: ['?'] }],
    keysLabel: '?', label: 'Open or close this menu' },
  // Build, on the board
  { id: 'move-cursor', scope: 'board', phases: ['build'], combos: [{ keys: ARROWS }],
    keysLabel: 'Arrows', label: 'Move the build cursor' },
  { id: 'place', scope: 'board', phases: ['build'], combos: [{ keys: ['Enter', ' '] }],
    keysLabel: 'Enter or Space', label: 'Place an object or inspect in Select' },
  { id: 'remove', scope: 'board', phases: ['build'], combos: [{ keys: ['Delete', 'Backspace'] }],
    keysLabel: 'Delete', label: 'Remove the object under the cursor' },
  { id: 'rotate', scope: 'board', phases: ['build'], combos: [{ keys: ['r', 'R'] }],
    keysLabel: 'R', label: 'Rotate the next object' },
  { id: 'bulldoze', scope: 'board', phases: ['build'], combos: [{ keys: ['b', 'B'] }],
    keysLabel: 'B', label: 'Bulldozer on or off' },
  // Build, anywhere on the page
  { id: 'pick-tool', scope: 'page', phases: ['build'],
    combos: [{ keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], ctrl: false, meta: false, alt: false }],
    keysLabel: '1 to 9', label: 'Pick an object, in the order of the tiles' },
  { id: 'undo', scope: 'page', phases: ['build'],
    combos: [{ keys: ['z', 'Z'], ctrl: true, alt: false, shift: false }, { keys: ['z', 'Z'], meta: true, alt: false, shift: false }],
    keysLabel: 'Ctrl+Z or ⌘Z', label: 'Undo the last change to the layout' },
  { id: 'redo', scope: 'page', phases: ['build'],
    combos: [
      { keys: ['z', 'Z'], ctrl: true, alt: false, shift: true },
      { keys: ['z', 'Z'], meta: true, alt: false, shift: true },
      { keys: ['y', 'Y'], ctrl: true, meta: false, alt: false, shift: false },
    ],
    keysLabel: 'Ctrl+Shift+Z, Ctrl+Y or ⌘⇧Z', label: 'Redo a change you undid' },
];

const BY_ID = new Map(BINDINGS.map((b) => [b.id, b]));

export function binding(id) {
  const b = BY_ID.get(id);
  if (!b) throw new Error(`No key binding named ${id}`);
  return b;
}

const MODS = ['ctrl', 'meta', 'alt', 'shift'];

function comboMatches(combo, e) {
  if (!combo.keys.includes(e.key)) return false;
  return MODS.every((m) => combo[m] === undefined || combo[m] === !!e[`${m}Key`]);
}

// True when the key event is one of the binding's combos (phase and scope are the caller's).
export function matches(id, e) {
  return binding(id).combos.some((combo) => comboMatches(combo, e));
}

const phasesOverlap = (a, b) => a === 'all' || b === 'all' || a.some((p) => b.includes(p));
const modsCompatible = (a, b) => MODS.every((m) => a[m] === undefined || b[m] === undefined || a[m] === b[m]);

// Every pair of bindings that one key press could trigger together, unless one of them
// declares that it overrides the other. A board key also reaches the page handler, so the
// two scopes are checked against each other.
export function clashes(bindings = BINDINGS) {
  const found = [];
  for (let i = 0; i < bindings.length; i += 1) {
    for (let j = i + 1; j < bindings.length; j += 1) {
      const a = bindings[i];
      const b = bindings[j];
      if ((a.overrides || []).includes(b.id) || (b.overrides || []).includes(a.id)) continue;
      if (!phasesOverlap(a.phases, b.phases)) continue;
      for (const ca of a.combos) {
        for (const cb of b.combos) {
          const shared = ca.keys.filter((k) => cb.keys.includes(k));
          if (shared.length && modsCompatible(ca, cb)) found.push(`${a.id} and ${b.id} share ${shared.map((k) => JSON.stringify(k)).join(', ')}`);
        }
      }
    }
  }
  return found;
}

// Keys a page must leave to the browser: Tab moves focus, the function keys belong to the
// browser and the operating system, and Ctrl or Cmd with W, T, N or L close or open tabs and
// windows or jump to the address bar.
export function reservedKeys(bindings = BINDINGS) {
  const found = [];
  for (const b of bindings) {
    for (const combo of b.combos) {
      for (const key of combo.keys) {
        const primary = combo.ctrl === true || combo.meta === true;
        if (key === 'Tab' || /^F([1-9]|1[0-2])$/.test(key) || (primary && /^[wtnlWTNL]$/.test(key))) found.push(`${b.id} uses ${key}`);
      }
    }
  }
  return found;
}
