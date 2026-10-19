// Opening theatre: a disposable scene and timeline, never an engine action or save.
import { STARTER_LAYOUT } from './data.mjs';

const SEEN = 'front_of_house_intro_seen_v1';
export async function createOpening({ hasSave, enter, newGame, theme, replay = false }) {
  const root = document.createElement('section');
  root.className = 'opening'; root.setAttribute('aria-label', 'Front of House title screen');
  root.dataset.state = 'loading';
  root.innerHTML = `<canvas class="opening-board" aria-hidden="true"></canvas>
    <div class="opening-shade" aria-hidden="true"></div>
    <div class="opening-toolbar"><button type="button" data-intro="sound">Enable sound</button><button type="button" data-intro="theme">Dark controls</button><button type="button" data-intro="skip">Skip intro</button></div>
    <div class="opening-title"><p class="opening-kicker">MIXMASH STUDIO PRESENTS</p><h1><span>FRONT</span><span>OF HOUSE</span></h1><p class="opening-tape">Book. Build. Run the show.</p></div>
    <div class="opening-actions" hidden><button type="button" class="opening-primary" data-intro="enter">${hasSave ? 'Continue' : 'New game'}</button>${hasSave ? '<button type="button" data-intro="new">New game</button>' : ''}<button type="button" data-intro="replay">Replay intro</button></div>
    <p class="opening-caption" role="status">Preparing the lot…</p>`;
  document.body.append(root);
  const gameElements = [...document.body.children].filter(e => e !== root && !['SCRIPT', 'STYLE', 'LINK'].includes(e.tagName));
  const previous = gameElements.map(e => [e, e.inert]);
  previous.forEach(([e]) => { e.inert = true; });
  const inertWatch = new MutationObserver(records => {
    for (const record of records) for (const e of record.addedNodes) {
      if (e.nodeType === 1 && e !== root && !['SCRIPT', 'STYLE', 'LINK'].includes(e.tagName)) { previous.push([e, e.inert]); e.inert = true; }
    }
  });
  inertWatch.observe(document.body, { childList: true });
  const $ = s => root.querySelector(s), title = $('.opening-title'), actions = $('.opening-actions'), caption = $('.opening-caption');
  let canvas = $('canvas'), fallingBack = false;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const gsap = globalThis.gsap;
  if (!gsap) {
    inertWatch.disconnect(); root.remove(); previous.forEach(([e, inert]) => { e.inert = inert; }); enter();
    return { replay() {}, destroy() {}, info: () => ({ ready: false, reason: 'Opening animation unavailable' }) };
  }
  // Keep the authored eleven-second clock even on software WebGL startup frames.
  gsap.ticker.lagSmoothing(0);
  let renderer, timeline, ambient, audio, music, bed, disposed = false, ready = false, menu = false, last = -1, seen = false, soundEnabled = false;
  let time = { value: 0 }, lastDraw = 0;
  try { seen = localStorage.getItem(SEEN) === '1'; } catch { /* storage is optional */ }
  const muted = () => globalThis.__mixmashNav?.isMuted() ?? false;
  function syncSound() { $('[data-intro="sound"]').textContent = muted() ? 'Sound muted' : soundEnabled ? 'Mute sound' : 'Enable sound'; }
  function soundCue(kind) {
    if (!audio || audio.state !== 'running' || muted() || !soundEnabled) return;
    const now = audio.currentTime;
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = kind === 'music' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(kind === 'music' ? 55 : kind === 'scan' ? 880 : 130, now);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'scan' ? 660 : 38, now + 0.16);
    gain.gain.setValueAtTime(kind === 'music' ? 0.08 : 0.035, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    oscillator.connect(gain).connect(audio.destination); oscillator.start(now); oscillator.stop(now + 0.3);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  function speakCheck() {
    if (!soundEnabled || muted() || !globalThis.speechSynthesis || !globalThis.SpeechSynthesisUtterance) return;
    const line = new SpeechSynthesisUtterance('One. Two.'); line.volume = 0.25; line.rate = 0.85;
    speechSynthesis.speak(line);
  }
  function stopSound() { clearInterval(music); music = null; globalThis.speechSynthesis?.cancel(); if (audio && audio.state !== 'closed') void audio.suspend(); }
  async function enableSound() {
    if (soundEnabled && !muted()) { globalThis.__mixmashNav?.setMuted(true); stopSound(); syncSound(); return; }
    globalThis.__mixmashNav?.setMuted(false);
    try {
      audio ||= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
      await audio.resume(); soundEnabled = true;
      if (!bed) {
        const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate), data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.025;
        bed = audio.createBufferSource(); bed.buffer = buffer; bed.loop = true;
        const filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900;
        bed.connect(filter).connect(audio.destination); bed.start();
      }
      if (!music) music = setInterval(() => { if (!document.hidden && menu) soundCue('music'); }, 650);
    } catch { soundEnabled = false; }
    syncSound();
  }
  function frame(force = false) {
    if (!renderer || disposed || document.hidden) return;
    const t = time.value;
    root.dataset.seconds = String(Math.min(11, t).toFixed(2));
    if (!force && performance.now() - lastDraw < (menu ? 125 : 40)) return;
    lastDraw = performance.now();
    const crowd = Math.round(Math.max(0, Math.min(1, (t - 6) / 2)) * 120);
    const actors = Array.from({length: crowd}, (_, i) => {
      const progress = Math.max(0, Math.min(1, (t - 6 - i / 60) / 0.8));
      const x = 7 + ((i * 0.618034) % 1) * 11, y = 4.5 + ((i * 0.414214) % 1) * 7.5;
      return { x: 12.5 + (x - 12.5) * progress, y: 15 + (y - 15) * progress, moving: progress < 1, heading: Math.PI, zone: 'audience' };
    });
    const scene = { floor: 'lot', grid: { w: 24, h: 16 }, objects: STARTER_LAYOUT, crowd, serviceCrowd: {actors, totals: {audience: crowd}}, artistId: 'sodium-arcade', performing: t >= 8, night: true, lightTower: t >= 5, showGrid: false, t };
    renderer.draw(scene);
    renderer.openingPose?.(t);
    if (!media.matches) renderer.setCamera?.({ yaw: 30 + Math.min(1, Math.max(0, (t - 3.8) / 2.2)) * 22, pitch: 43, zoom: t < 3.8 ? 1.65 : 1.65 - Math.min(1, (t - 3.8) / 2.2) * 0.65 });
    const beat = t < 1.2 ? 0 : t < 3.8 ? 1 : t < 6 ? 2 : t < 8 ? 3 : t < 9 ? 4 : 5;
    if (beat !== last) {
      caption.textContent = ['An empty lot. A night to make.', 'Build the room.', 'Check the sound. Bring up the lights.', 'Open the gates.', 'This is your show.', ''][beat];
      last = beat;
    }
  }
  function finish({ focus = true } = {}) {
    if (disposed) return;
    ready = true;
    globalThis.speechSynthesis?.cancel();
    timeline?.pause(); menu = true; time.value = 11; frame(true);
    root.dataset.state = 'menu';
    gsap.set(title, { opacity: 1 }); gsap.set(title.querySelectorAll('h1 span'), { y: 0, opacity: 1 });
    gsap.set($('.opening-tape'), { opacity: 1 }); actions.hidden = false; caption.textContent = '';
    $('[data-intro="skip"]').hidden = true;
    try { localStorage.setItem(SEEN, '1'); } catch { /* menu remains usable */ }
    if (focus) $('[data-intro="enter"]').focus();
    ambient?.kill();
    if (!media.matches && renderer) ambient = gsap.to(time, { value: 1000, duration: 989, ease: 'none', onUpdate: () => frame() });
  }
  function play(full = true) {
    if (disposed || !ready) return;
    timeline?.kill(); ambient?.kill(); globalThis.speechSynthesis?.cancel();
    menu = false; last = -1; actions.hidden = true; time.value = 0; $('[data-intro="skip"]').hidden = false;
    root.dataset.state = 'playing';
    gsap.set(title, { opacity: 0 }); gsap.set(title.querySelectorAll('h1 span'), { y: 10, opacity: 0 }); gsap.set($('.opening-tape'), { opacity: 0 });
    if (media.matches || fallingBack) { finish(); return; }
    if (!full) {
      time.value = 11; frame(true); gsap.set(title.querySelectorAll('h1 span'), { y: 0, opacity: 1 });
      timeline = gsap.timeline({ onComplete: finish }); timeline.to(title, { opacity: 1, duration: 0.6 }); return;
    }
    timeline = gsap.timeline({ onComplete: finish });
    timeline.to(time, { value: 11, duration: 11, ease: 'none', onUpdate: () => frame() }, 0);
    for (let i = 0; i < STARTER_LAYOUT.length; i++) timeline.call(() => soundCue('case'), [], 1.2 + i * 0.12);
    timeline.call(speakCheck, [], 4.1).call(() => soundCue('scan'), [], 6).call(() => soundCue('music'), [], 8);
    timeline.set(title, { opacity: 1 }, 9).to(title.querySelectorAll('h1 span'), { y: 0, opacity: 1, duration: 0.2, stagger: 0.24, ease: 'power3.out' }, 9);
    timeline.call(() => soundCue('case'), [], 9).call(() => soundCue('case'), [], 9.24).to($('.opening-tape'), { opacity: 1, duration: 0.3 }, 9.7);
    $('[data-intro="skip"]').focus(); frame(true);
  }
  function teardown() {
    if (disposed) return;
    disposed = true; timeline?.kill(); ambient?.kill(); stopSound(); if (audio) void audio.close();
    renderer?.destroy(); observer.disconnect(); inertWatch.disconnect(); media.removeEventListener('change', motionChanged);
    window.removeEventListener('mixmash:mute', muteChanged); document.removeEventListener('visibilitychange', visibility);
    root.remove(); previous.forEach(([e, inert]) => { e.inert = inert; });
  }
  function leave(fresh = false) { teardown(); if (fresh && hasSave) newGame(); else enter(); }
  root.addEventListener('click', e => {
    const action = e.target.closest('[data-intro]')?.dataset.intro;
    if (action === 'skip') finish();
    if (action === 'enter') leave();
    if (action === 'new') leave(true);
    if (action === 'replay') { if (soundEnabled && !muted()) void audio?.resume(); play(); }
    if (action === 'sound') void enableSound();
    if (action === 'theme') { theme(); syncTheme(); }
  });
  root.addEventListener('keydown', e => {
    e.stopPropagation(); // Title controls must never reach the game's global Build shortcuts.
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
    if (e.key === 'Tab') {
      const buttons = [...root.querySelectorAll('button')].filter(b => !b.hidden && !b.closest('[hidden]'));
      const first = buttons[0], end = buttons.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
    }
  });
  root.addEventListener('keyup', e => e.stopPropagation());
  function syncTheme() { const dark = document.documentElement.dataset.theme === 'dark'; $('[data-intro="theme"]').textContent = dark ? 'Light controls' : 'Dark controls'; }
  function motionChanged() { if (media.matches) finish(); }
  function muteChanged() { if (muted()) globalThis.speechSynthesis?.cancel(); syncSound(); }
  function visibility() {
    if (document.hidden) { timeline?.pause(); ambient?.pause(); globalThis.speechSynthesis?.cancel(); if (audio) void audio.suspend(); }
    else { if (menu) ambient?.resume(); else timeline?.resume(); if (soundEnabled && !muted()) void audio?.resume(); }
  }
  const observer = new ResizeObserver(() => { renderer?.resize(); frame(true); }); observer.observe(root);
  media.addEventListener('change', motionChanged); window.addEventListener('mixmash:mute', muteChanged); document.addEventListener('visibilitychange', visibility);
  syncTheme(); syncSound();
  $('[data-intro="skip"]').focus();
  // Renderer failure must not strand the player on a loading screen.
  const fallbackTimer = setTimeout(() => { if (!ready) { ready = true; finish(); } }, 4000);
  async function installFallback() {
    if (disposed || fallingBack) return;
    fallingBack = true; renderer?.destroy();
    const replacement = canvas.cloneNode(); canvas.replaceWith(replacement); canvas = replacement;
    const { createBoard } = await import('./board.js');
    if (!disposed) { renderer = createBoard(canvas); finish({ focus: false }); }
  }
  try {
    const { createLotRenderer } = await import('./lot-renderer.mjs');
    if (!disposed) renderer = createLotRenderer(canvas, { pixelRatio: 1, deferRendering: true, onStatus: s => { if (['lost', 'failed'].includes(s.state)) void installFallback(); } });
  } catch {
    await installFallback();
  }
  clearTimeout(fallbackTimer);
  if (!disposed) { const alreadyReady = ready; ready = true; if (alreadyReady) finish({ focus: false }); else play(replay || !seen); }
  return { replay: () => play(), destroy: teardown, info: () => ({ ready, menu, time: time.value, reducedMotion: media.matches, renderer: renderer?.info().renderer }) };
}
