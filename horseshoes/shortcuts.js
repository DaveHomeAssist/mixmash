// Backyard Horseshoes shortcut layer and juice: a sidecar to the generated build, never a bundle patch.
// Adds P / Esc pause (opens the Menu), M mute, ? / H help, and gamepad play. Existing keys are unchanged:
// Space/Enter throw, arrows aim and strength, 1-3 arc, Q/T delivery, C camera, F fullscreen, D guides,
// R back to live play from a replay. Typing, focused controls and Ctrl/Alt/Cmd combinations are never intercepted.
(() => {
  const $ = (selector) => document.querySelector(selector);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ROWS = [
    ['Throw', ['Space', 'Enter'], ['A']],
    ['Aim left / right', ['\u2190', '\u2192'], ['D-pad \u2190 \u2192']],
    ['Strength up / down', ['\u2191', '\u2193'], ['D-pad \u2191 \u2193']],
    ['Arc low / normal / high', ['1', '2', '3'], ['LB', 'RB']],
    ['Delivery flip / turn', ['Q', 'T'], ['X']],
    ['Camera view', ['C'], ['Y']],
    ['Back to live play (replay)', ['R'], ['B']],
    ['Pause / Menu', ['P', 'Esc'], ['Start']],
    ['Mute / unmute', ['M'], []],
    ['Fullscreen', ['F'], []],
    ['Physics guides', ['D'], []],
    ['Shortcuts (this sheet)', ['?', 'H'], ['Back / Select']],
  ];
  const kbd = (keys) => keys.length ? keys.map((k) => `<kbd>${k}</kbd>`).join(' ') : '<span aria-label="None">\u00b7</span>';
  const help = document.createElement('dialog');
  help.className = 'hs-help';
  help.id = 'shortcut-help';
  help.setAttribute('aria-labelledby', 'hs-help-title');
  help.innerHTML = `<div class="hs-help-top"><h2 id="hs-help-title">Shortcuts</h2><button type="button" id="hs-help-close">Close <kbd>Esc</kbd></button></div>
<table><thead><tr><th scope="col">Action</th><th scope="col">Keyboard</th><th scope="col">Gamepad</th></tr></thead><tbody>
${ROWS.map(([label, keys, pad]) => `<tr><th scope="row">${label}</th><td>${kbd(keys)}</td><td>${kbd(pad)}</td></tr>`).join('')}
</tbody></table>
<p>Drag to orbit and wheel or pinch to zoom. Keys defer to a focused control, and the Menu pauses physics, AI and replay.</p>`;
  const toast = document.createElement('div');
  toast.className = 'hs-toast';
  toast.setAttribute('aria-hidden', 'true');
  let toastTimer = 0;
  function say(text) {
    const live = $('#announcement');
    if (live) live.textContent = text;
    toast.textContent = text;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 1400);
  }
  let helpReturn = null;
  function openHelp() {
    if (help.open) return;
    helpReturn = document.activeElement;
    help.showModal();
    $('#hs-help-close')?.focus();
  }
  function closeHelp() { if (help.open) help.close(); }
  function toggleHelp() { help.open ? closeHelp() : openHelp(); }
  const menu = () => $('#game-menu');
  function toggleMenu() {
    const dialog = menu();
    if (!dialog) return;
    if (dialog.open) dialog.dispatchEvent(new Event('cancel', { cancelable: true })); // the game's own resume path
    else $('#settings-tab')?.click();
  }
  function toggleMute() {
    const button = $('#sound-button');
    if (!button || /unavailable/i.test(button.textContent)) { say('Sound is unavailable'); return; }
    button.click();
    setTimeout(() => say(/on/i.test(button.textContent.replace(/^Sound:\s*/i, '')) ? 'Sound on (M)' : 'Sound muted (M)'), 60);
  }
  const typing = (target) => !!target?.closest?.('input,select,textarea,[contenteditable=""],[contenteditable="true"]');
  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat || typing(event.target)) return;
    const key = (event.key || '').toLowerCase();
    if (event.key === '?' || (key === 'h' && !event.shiftKey)) { event.preventDefault(); toggleHelp(); return; }
    if (help.open) return; // the help dialog closes itself on Esc
    if (event.shiftKey) return;
    if (event.code === 'KeyM') { event.preventDefault(); toggleMute(); return; }
    const menuOpen = !!menu()?.open;
    if (event.code === 'KeyP' || (event.code === 'Escape' && !menuOpen)) { event.preventDefault(); toggleMenu(); }
  });
  // Gamepad: polled only while a pad is connected. Directional input reuses the game's own arrow-key handling.
  const PAD = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, back: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
  let prev = {};
  let frame = 0;
  let repeatAt = 0;
  const sendKey = (code, key = code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true }));
  const clickIf = (selector) => { const el = $(selector); if (el && !el.disabled) el.click(); };
  function poll() {
    frame = 0;
    const pads = [...(navigator.getGamepads?.() || [])].filter(Boolean);
    if (!pads.length) return;
    const now = performance.now();
    const down = {};
    for (const pad of pads) {
      for (const [name, index] of Object.entries(PAD)) if (pad.buttons[index]?.pressed) down[name] = true;
      const [x = 0, y = 0] = pad.axes;
      if (x < -0.5) down.left = true;
      if (x > 0.5) down.right = true;
      if (y < -0.5) down.up = true;
      if (y > 0.5) down.down = true;
    }
    const edge = (name) => down[name] && !prev[name];
    if (edge('back')) toggleHelp();
    if (edge('start')) { closeHelp(); toggleMenu(); }
    if (edge('b')) { if (help.open) closeHelp(); else if (menu()?.open) toggleMenu(); else sendKey('KeyR', 'r'); }
    if (!help.open && !menu()?.open) {
      if (edge('a')) clickIf('#throw-button');
      if (edge('y')) clickIf('#camera-button');
      if (edge('x')) {
        const turn = $('#style-buttons button[aria-pressed="true"]')?.textContent?.trim().toLowerCase() === 'turn';
        sendKey(turn ? 'KeyQ' : 'KeyT', turn ? 'q' : 't');
      }
      if (edge('lb')) sendKey('Digit1', '1');
      if (edge('rb')) sendKey('Digit3', '3');
      const dirs = [['left', 'ArrowLeft'], ['right', 'ArrowRight'], ['up', 'ArrowUp'], ['down', 'ArrowDown']];
      for (const [name, code] of dirs) {
        if (!down[name]) continue;
        if (edge(name) || now >= repeatAt) { sendKey(code); repeatAt = now + (edge(name) ? 320 : 60); }
      }
    }
    prev = down;
    frame = requestAnimationFrame(poll);
  }
  window.addEventListener('gamepadconnected', () => { if (!frame) frame = requestAnimationFrame(poll); });
  // Juice: score and feedback pops when the game updates them (presentation only).
  function pop(el, cls) {
    if (!el || reduceMotion.matches) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  const watched = new WeakSet();
  function watch() {
    for (const [selector, cls] of [['#score-one', 'hs-pop'], ['#score-two', 'hs-pop'], ['#throw-feedback', 'hs-feedback']]) {
      const el = $(selector);
      if (!el || watched.has(el)) continue;
      watched.add(el);
      let last = el.textContent;
      new MutationObserver(() => { if (el.textContent !== last) { last = el.textContent; pop(el, cls); } })
        .observe(el, { childList: true, characterData: true, subtree: true });
    }
  }
  function mount() {
    document.body.append(help, toast);
    $('#hs-help-close').addEventListener('click', closeHelp);
    help.addEventListener('click', (event) => { if (event.target === help) closeHelp(); });
    help.addEventListener('close', () => { if (helpReturn?.isConnected) helpReturn.focus(); helpReturn = null; });
    watch();
    new MutationObserver(watch).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
