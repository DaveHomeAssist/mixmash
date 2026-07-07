(function attachMixmashInputData(global) {
  const DEFAULT_P1_BINDS = Object.freeze({
    left: 'KeyA',
    right: 'KeyD',
    up: 'KeyW',
    down: 'KeyS',
    attack: 'KeyJ',
    attack2: 'Space',
    special: 'KeyK',
    shield: 'KeyL',
  });

  const DEFAULT_P2_BINDS = Object.freeze({
    left: 'ArrowLeft',
    right: 'ArrowRight',
    up: 'ArrowUp',
    down: 'ArrowDown',
    attack: 'Numpad1',
    special: 'Numpad2',
    shield: 'Numpad3',
  });

  const CONTROL_BINDING_ROWS = Object.freeze([
    { id: 'LEFT', label: 'Move Left', action: 'left', p1Default: DEFAULT_P1_BINDS.left, p2Default: DEFAULT_P2_BINDS.left, fallback: 'Left Arrow' },
    { id: 'RIGHT', label: 'Move Right', action: 'right', p1Default: DEFAULT_P1_BINDS.right, p2Default: DEFAULT_P2_BINDS.right, fallback: 'Right Arrow' },
    { id: 'UP', label: 'Jump / Aim Up', action: 'up', p1Default: DEFAULT_P1_BINDS.up, p2Default: DEFAULT_P2_BINDS.up, fallback: 'Gamepad A' },
    { id: 'DOWN', label: 'Drop / Aim Down', action: 'down', p1Default: DEFAULT_P1_BINDS.down, p2Default: DEFAULT_P2_BINDS.down, fallback: 'Down Arrow' },
    { id: 'ATTACK', label: 'Attack / Activate', action: 'attack', p1Default: DEFAULT_P1_BINDS.attack, p2Default: DEFAULT_P2_BINDS.attack, fallback: 'Space' },
    { id: 'SPECIAL', label: 'Special / Utility', action: 'special', p1Default: DEFAULT_P1_BINDS.special, p2Default: DEFAULT_P2_BINDS.special, fallback: 'Gamepad Y' },
    { id: 'SHIELD', label: 'Shield / Guard', action: 'shield', p1Default: DEFAULT_P1_BINDS.shield, p2Default: DEFAULT_P2_BINDS.shield, fallback: 'Gamepad R' },
  ].map(Object.freeze));

  const CONTROL_ACTIONS = Object.freeze(['left', 'right', 'up', 'down', 'attack', 'special', 'shield']);

  function createDefaultKeyBindings() {
    const keyBindings = {};
    for (const row of CONTROL_BINDING_ROWS) {
      keyBindings[`P1_${row.id}`] = row.p1Default;
      keyBindings[`P2_${row.id}`] = row.p2Default;
    }
    return keyBindings;
  }

  global.MixmashInputData = Object.freeze({
    DEFAULT_P1_BINDS,
    DEFAULT_P2_BINDS,
    CONTROL_BINDING_ROWS,
    CONTROL_ACTIONS,
    createDefaultKeyBindings,
  });
})(globalThis);
