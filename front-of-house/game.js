// Front of House browser client: the five phase panels, the board, playback and saves.
//
// Every number shown comes from engine.mjs; this file only presents state and turns
// clicks and keys into engine actions (docs/RULES.md). Saves go through the shared
// MixKit store under SAVE_NAMESPACE and are validated with normalizeState on load.

import * as D from './data.mjs';
import {
  applyAction, artistFor, buzz, createGame, demand, evaluateVenue, findResponse, forecast,
  careerProgress, migrateSave, normalizeState, offersFor, presaleSplit, rollShow, settlementFor,
  showPreview, sightlineTiles, termsFor, upfrontFor, validateLayout,
} from './engine.mjs';
import { createBoard, LOOK } from './board.js';

const PLAY_SECONDS = 12; // show-night playback length up to curfew
const AFTER_SECONDS = 3; // playback after the incident is answered
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const PLACEABLE = ['stage', 'pa-s', 'pa-m', 'lights', 'bar', 'restroom', 'gate', 'exit'];
// Screen directions for each stage rotation (rotation 0 faces +y, the lower left on screen).
const FACING = ['the lower left', 'the upper left', 'the upper right', 'the lower right'];
const AD_LABELS = { flyers: 'Flyers and posters', social: 'Social ads', radio: 'Local radio' };
const PART_LABELS = { sound: 'Sound and light', sightlines: 'Sightlines', amenities: 'Bars and restrooms', flow: 'Entry flow', incident: 'Incident handling' };
const WEIGHTS = { sound: D.W_SOUND, sightlines: D.W_SIGHT, amenities: D.W_AMENITY, flow: D.W_FLOW, incident: D.W_INCIDENT };
const INCIDENT_TEXT = {
  rain: 'Rain rolls in as the doors open. Walk-up sales will suffer unless people have cover.',
  'pa-dropout': 'The PA cuts out in the middle of the set. The crowd is waiting.',
  'gate-jam': 'The entry gate jams and the line backs up down the block.',
};
const TIPS = {
  sound: `Sound and light scored lowest. Rent the medium PA for crowds over ${D.PA_COVERAGE.S}, and add the light tower.`,
  sightlines: 'Sightlines scored lowest. Keep bars, restrooms and the light tower out of the cone in front of the stage.',
  amenities: `Bars and restrooms scored lowest. Plan one bar for every ${D.BAR_RATIO} people and one restroom for every ${D.RESTROOM_RATIO}.`,
  flow: 'Entry flow scored lowest. Add a gate, or answer a gate jam by opening a second lane.',
  incident: 'The incident cost the most. A stronger response costs money up front but saves the night.',
};

const $ = (sel) => document.querySelector(sel);
const money = (n) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const adTotal = (ads) => D.AD_CHANNELS.reduce((s, c) => s + (ads[c] || 0), 0);
const label = (type) => D.OBJECT_TYPES[type].label;

const el = {
  panel: $('#panel'),
  canvas: $('#board'),
  boardStatus: $('#board-status'),
  cash: $('#meter-cash'),
  rep: $('#meter-rep'),
  rel: $('#meter-rel'),
  steps: [...document.querySelectorAll('.stepper li')],
  saveCode: $('#save-code'),
  saveStatus: $('#save-status'),
};

const store = window.MixKitSave
  ? window.MixKitSave.createSaveStore(D.SAVE_NAMESPACE, { version: D.SCHEMA_VERSION, migrate: (saved) => migrateSave(saved) })
  : null;

function freshSeed() {
  const a = new Uint32Array(1);
  if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
  else a[0] = Date.now();
  return (a[0] >>> 0) || 1;
}

function loadState() {
  let raw = null;
  try { raw = store ? store.load() : null; } catch { raw = null; }
  return raw ? normalizeState(migrateSave(raw), freshSeed()) : createGame(freshSeed());
}

let state = loadState();
const ui = {
  tool: 'stage', rot: 0, cursor: { x: 11, y: 6 }, hover: null, focused: false, showClear: true,
  mounted: null, play: null, raf: 0, sightKey: '', sight: { clear: new Set(), blocked: new Set() }, confirmNew: false,
};

function persist() {
  if (store) store.save(state);
}

function say(text, kind = 'info') {
  const msg = $('#msg');
  if (!msg) return;
  msg.className = `message ${kind}`;
  msg.textContent = text;
}

function act(action, { quiet = false } = {}) {
  const { state: next, error } = applyAction(state, action);
  if (error) {
    say(error, 'error');
    return false;
  }
  state = next;
  persist();
  if (!quiet) say('');
  render();
  return true;
}

function sight() {
  const key = JSON.stringify(state.venue.objects);
  if (key !== ui.sightKey) {
    ui.sightKey = key;
    ui.sight = sightlineTiles(state.venue);
  }
  return ui.sight;
}
const clearSet = () => sight().clear;

// ---------------------------------------------------------------------------
// Rendering

function render() {
  document.body.dataset.phase = state.phase;
  renderTop();
  if (ui.mounted !== state.phase) {
    ui.mounted = state.phase;
    mount();
  }
  update();
  draw();
}

function renderTop() {
  const artist = state.booking.artistId;
  el.cash.textContent = money(state.cash);
  el.rep.textContent = `${state.reputation.venue}/100`;
  el.rel.textContent = signed(state.reputation.artists[artist] || 0);
  const current = state.phase === 'done' ? 'settle' : state.phase;
  const order = ['book', 'build', 'promote', 'show', 'settle'];
  el.steps.forEach((li) => {
    const i = order.indexOf(li.dataset.step);
    li.classList.toggle('done', i < order.indexOf(current));
    if (li.dataset.step === current) li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');
  });
}

function mount() {
  const builders = { book: bookPanel, build: buildPanel, promote: promotePanel, show: showPanel, settle: settlePanel, done: donePanel };
  el.panel.innerHTML = builders[state.phase]();
  const heading = el.panel.querySelector('h2');
  if (heading) heading.setAttribute('tabindex', '-1');
  if (state.phase === 'show') startPlayback();
  else if (state.phase !== 'settle') endPlayback();
}

// After a step the player chose, move focus to the new panel's heading so screen
// readers announce where they are. Never steals focus on load.
function focusHeading() {
  const heading = el.panel.querySelector('h2');
  if (heading) heading.focus();
}

function update() {
  if (state.phase === 'build') updateBuild();
  if (state.phase === 'promote') updatePromote();
}

// ---------------------------------------------------------------------------
// Book

function bookPanel() {
  const offers = offersFor(state);
  const cards = offers.map((id) => {
    const a = artistFor(id);
    const rel = state.reputation.artists[id] || 0;
    const t = termsFor(id, rel);
    const lo = Math.round(a.drawMin * t.drawMult);
    const hi = Math.round(a.drawMax * t.drawMult);
    const mood = rel >= D.LOT_GOAL.loyalAct ? 'trusts you' : rel > 0 ? 'likes working with you'
      : rel === 0 ? 'has not worked with you yet' : rel > D.REL_DOOR_FLOOR ? 'remembers a small payout' : 'wants money up front';
    const doorNote = a.guaranteeOnly ? `${esc(a.name)} only plays for a guarantee.`
      : `${esc(a.name)} will only play for a guarantee after another short payout.`;
    return `
    <section class="card offer" aria-label="${esc(a.name)}">
      <p class="eyebrow">Offer · relationship ${signed(rel)}, ${mood}</p>
      <p class="artist-name">${esc(a.name)}</p>
      <p>${esc(a.genre)} · draws ${lo} to ${hi} people · usually plays at ${money(a.fairPrice)}</p>
      <p class="lede">Their ask: a ${money(t.ask)} guarantee${t.ask !== a.ask ? ` (${money(a.ask)} to a promoter they don't know)` : ''}.</p>
      <button type="button" class="choice" data-act="deal" data-deal="guarantee" data-artist="${id}">
        <strong>Pay the guarantee</strong>
        <span class="cost">${money(t.ask)}, paid before doors</span>
        <span>You keep every dollar after costs, and the act is happy however the night goes.</span>
      </button>
      <button type="button" class="choice" data-act="deal" data-deal="door" data-artist="${id}" ${t.doorOk ? '' : 'disabled'}>
        <strong>Offer a door deal</strong>
        <span class="cost">${Math.round(D.DOOR_SPLIT * 100)}% of ticket money after show costs, paid at settlement</span>
        <span>${t.doorOk ? `Cheaper on a slow night, but the act expected ${money(t.ask)} and will remember a small payout.` : doorNote}</span>
      </button>
    </section>`;
  }).join('');
  return `
    <p class="eyebrow">Show ${state.history.length + 1} · ${esc(D.VENUE_NAME)}</p>
    <h2>Book the act</h2>
    <p id="msg" class="message" aria-live="polite"></p>
    <p class="lede">${state.history.length ? 'Two acts want this date. Pick one and a deal.' : 'Your first night. Two acts want the date; Sodium Arcade is the safe first booking.'}</p>
    ${cards}`;
}

// ---------------------------------------------------------------------------
// Build

const COSTS = {
  stage: 'with the lot',
  'pa-s': money(D.PA_RENTAL.S),
  'pa-m': money(D.PA_RENTAL.M),
  lights: money(D.LIGHTS_RENTAL),
  bar: `${money(D.BAR_SETUP)} + ${D.BAR_STAFF_PER_BAR} staff`,
  restroom: money(D.RESTROOM_UNIT),
  gate: `${D.DOOR_STAFF_PER_GATE} door staff`,
  exit: 'free',
};

function buildPanel() {
  const options = PLACEABLE.map((type) => {
    const t = D.OBJECT_TYPES[type];
    const watts = t.watts ? ` · ${t.watts / 1000} kW` : '';
    return `<label><input type="radio" name="tool" value="${type}" data-input="tool" ${ui.tool === type ? 'checked' : ''} />
      <span class="swatch" style="background:${LOOK[type].top}"></span>
      <span>${esc(t.label)}<span class="meta">${t.w}×${t.h} · ${COSTS[type]}${watts}</span></span></label>`;
  }).join('');
  return `
    <p class="eyebrow">${esc(D.VENUE_NAME)} · ${D.GRID.w} × ${D.GRID.h} tiles</p>
    <h2>Build the lot</h2>
    <p class="lede">Pick an object, then click the tile for its top corner. You need a stage, a PA touching it, the fence, a gate and an exit.</p>
    <p id="msg" class="message" aria-live="polite"></p>
    <fieldset><legend>Object to place</legend><div class="palette">${options}</div></fieldset>
    <div class="row">
      <button type="button" data-act="rotate">Rotate (R) · <span id="rot-label"></span></button>
      <button type="button" data-act="fence" id="fence-btn"></button>
    </div>
    <label class="toggle"><input type="checkbox" data-input="clear" ${ui.showClear ? 'checked' : ''} /> Show sightlines (teal clear, red blocked)</label>
    <div class="row">
      <button type="button" data-act="starter">Use the suggested layout</button>
      <button type="button" data-act="clear-lot">Clear the lot</button>
    </div>
    <dl class="stats" id="venue-stats"></dl>
    <div id="venue-check"></div>
    <details><summary>Placed objects (<span id="obj-count">0</span>)</summary><ul class="objects" id="obj-list"></ul></details>
    <div class="actions">
      <button type="button" data-act="back">Back to booking</button>
      <button type="button" class="primary" data-act="confirm-build" id="confirm-build">Lock the layout</button>
    </div>`;
}

// The guarantee the booked act was quoted (R-19), or its base ask for a booking made before
// the Lot career.
function quotedAsk() {
  return state.booking.terms ? state.booking.terms.ask : artistFor(state.booking.artistId).ask;
}

function costsSoFar() {
  return upfrontFor(state) - (state.booking.deal === 'guarantee' ? quotedAsk() : 0) - adTotal(state.promotion.ads);
}

function updateBuild() {
  const v = evaluateVenue(state.venue);
  const limits = { permit: 'the permit', floor: 'floor space', exits: 'exits' };
  $('#venue-stats').innerHTML = `
    <div><dt>Capacity</dt><dd>${v.capacity} <span class="lede">(${limits[v.capacityLimit]})</span></dd></div>
    <div><dt>Power</dt><dd class="${v.watts > D.GENERATOR_WATTS * 0.9 ? 'warn' : ''}">${(v.watts / 1000).toFixed(1)} / ${D.GENERATOR_WATTS / 1000} kW</dd></div>
    <div><dt>Clear view</dt><dd>${v.clearTiles} tiles · fits ${v.clearTiles * D.FLOOR_DENSITY}</dd></div>
    <div><dt>View blocked</dt><dd class="${v.blockedTiles ? 'bad' : ''}">${v.blockedTiles} tiles</dd></div>
    <div><dt>Staff</dt><dd>${v.staff}</dd></div>
    <div><dt>Costs so far</dt><dd>${money(costsSoFar())}</dd></div>
    <div><dt>Cash</dt><dd>${money(state.cash)}</dd></div>`;
  const notes = [...v.missing, ...v.problems.map((p) => p.message)];
  $('#venue-check').innerHTML = notes.length
    ? `<ul class="checklist">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
    : '<p class="checklist ok">✓ The lot is ready for a show.</p>';
  $('#obj-count').textContent = String(state.venue.objects.length);
  $('#obj-list').innerHTML = state.venue.objects.map((o, i) => {
    const where = D.OBJECT_TYPES[o.type].kit ? 'around the lot' : `at ${o.x}, ${o.y}${o.type === 'stage' ? `, facing ${FACING[o.rot]}` : ''}`;
    return `<li><span>${esc(label(o.type))} ${where}</span><button type="button" data-act="remove" data-index="${i}" aria-label="Remove ${esc(label(o.type))} ${where}">Remove</button></li>`;
  }).join('');
  $('#rot-label').textContent = `faces ${FACING[ui.rot]}`;
  const fence = state.venue.objects.some((o) => o.type === 'fence');
  $('#fence-btn').textContent = fence ? 'Remove the fence kit' : `Add the fence kit (${money(D.FENCE_KIT)})`;
  $('#confirm-build').disabled = !v.ready;
}

function objectIndexAt(x, y) {
  for (let i = state.venue.objects.length - 1; i >= 0; i -= 1) {
    const o = state.venue.objects[i];
    if (D.OBJECT_TYPES[o.type].kit) continue;
    const t = D.OBJECT_TYPES[o.type];
    const w = o.rot % 2 ? t.h : t.w; const h = o.rot % 2 ? t.w : t.h;
    if (x >= o.x && x < o.x + w && y >= o.y && y < o.y + h) return i;
  }
  return -1;
}

function ghostAt(tile) {
  const ghost = { type: ui.tool, x: tile.x, y: tile.y, rot: ui.rot };
  const { problems } = validateLayout([...state.venue.objects, ghost]);
  return { ...ghost, valid: !problems.some((p) => p.index === state.venue.objects.length) };
}

function placeAt(tile) {
  if (state.phase !== 'build' || !tile) return;
  if (act({ type: 'place', object: { type: ui.tool, x: tile.x, y: tile.y, rot: ui.rot } }, { quiet: true })) {
    say(`Placed the ${label(ui.tool).toLowerCase()} at ${tile.x}, ${tile.y}.`);
  }
}

function removeAt(tile) {
  const i = objectIndexAt(tile.x, tile.y);
  if (i < 0) { say('Nothing to remove on that tile.'); return; }
  const type = state.venue.objects[i].type;
  if (act({ type: 'remove', index: i }, { quiet: true })) say(`Removed the ${label(type).toLowerCase()}.`);
}

function describeTile(tile) {
  const i = objectIndexAt(tile.x, tile.y);
  const k = `${tile.x},${tile.y}`;
  const what = i >= 0 ? label(state.venue.objects[i].type)
    : clearSet().has(k) ? 'open floor with a clear view'
      : sight().blocked.has(k) ? 'open floor, view of the stage blocked' : 'open floor';
  return `Tile ${tile.x}, ${tile.y}: ${what}.`;
}

// ---------------------------------------------------------------------------
// Promote

function promotePanel() {
  const sliders = D.AD_CHANNELS.map((c) => `
    <div class="slider">
      <label for="ad-${c}">${AD_LABELS[c]} <output id="ad-${c}-out" for="ad-${c}"></output></label>
      <input type="range" id="ad-${c}" min="0" max="${D.AD_SLIDER_MAX}" step="${D.AD_STEP}" data-input="ad" data-channel="${c}" />
    </div>`).join('');
  return `
    <p class="eyebrow">14 days out · ${esc(artistFor(state.booking.artistId).name)}</p>
    <h2>Promote the show</h2>
    <p class="lede">Set the ticket price and the ads. The band's real draw stays hidden; the forecast shows the range.</p>
    <p id="msg" class="message" aria-live="polite"></p>
    <div class="slider">
      <label for="price">Ticket price <output id="price-out" for="price"></output></label>
      <input type="range" id="price" min="${D.PRICE_MIN}" max="${D.PRICE_MAX}" step="1" data-input="price" />
    </div>
    <fieldset><legend>Ad spend</legend>${sliders}</fieldset>
    <dl class="stats" id="promo-stats"></dl>
    <figure>
      <svg id="presale" class="chart" viewBox="0 0 280 96" role="img" aria-labelledby="presale-cap"></svg>
      <figcaption id="presale-cap"></figcaption>
    </figure>
    <div class="actions">
      <button type="button" data-act="back">Back to the lot</button>
      <button type="button" class="primary" data-act="confirm-promo" id="confirm-promo">Open the doors</button>
    </div>`;
}

function updatePromote() {
  const p = state.promotion;
  const a = artistFor(state.booking.artistId);
  const price = $('#price');
  if (document.activeElement !== price) price.value = String(p.price);
  $('#price-out').textContent = money(p.price);
  for (const c of D.AD_CHANNELS) {
    const input = $(`#ad-${c}`);
    if (document.activeElement !== input) input.value = String(p.ads[c]);
    $(`#ad-${c}-out`).textContent = money(p.ads[c]);
  }
  const f = forecast(state);
  const upfront = upfrontFor(state);
  const short = upfront > state.cash;
  $('#promo-stats').innerHTML = `
    <div><dt>Forecast crowd</dt><dd>${f.low} to ${f.high} <span class="lede">of ${f.capacity}</span></dd></div>
    <div><dt>Buzz</dt><dd>×${buzz(p.ads).toFixed(2)}</dd></div>
    <div><dt>Ticket money</dt><dd>${money(f.low * p.price)} to ${money(f.high * p.price)}</dd></div>
    <div><dt>Ad spend</dt><dd>${money(adTotal(p.ads))}</dd></div>
    <div><dt>Due before doors</dt><dd class="${short ? 'bad' : ''}">${money(upfront)}</dd></div>
    <div><dt>Cash</dt><dd>${money(state.cash)}</dd></div>`;
  $('#confirm-promo').disabled = short;
  const doorOk = termsFor(state.booking.artistId, state.reputation.artists[state.booking.artistId]).doorOk;
  if (short) say(`This show needs ${money(upfront)} before doors and you have ${money(state.cash)}. Cut ads or rentals${state.booking.deal === 'guarantee' && doorOk ? ', or go back and offer a door deal' : ''}.`, 'error');
  else if ($('#msg').classList.contains('error') && $('#msg').textContent.startsWith('This show needs')) say('');

  // Presale chart: cumulative tickets sold over 14 days for the slowest and strongest draw.
  const totals = [a.drawMin, a.drawMax].map((draw) => {
    const dem = demand({ draw, price: p.price, fairPrice: a.fairPrice, ads: p.ads, venueRep: state.reputation.venue });
    return presaleSplit(dem, buzz(p.ads), f.capacity).presale;
  });
  const maxY = Math.max(1, f.capacity);
  const bars = [];
  for (let d = 1; d <= 14; d += 1) {
    const share = (d / 14) ** 1.6;
    const x = 8 + (d - 1) * 19;
    const hi = (totals[1] * share / maxY) * 80;
    const lo = (totals[0] * share / maxY) * 80;
    bars.push(`<rect x="${x}" y="${88 - hi}" width="14" height="${hi}" fill="rgba(0,240,255,0.25)" />`);
    bars.push(`<rect x="${x}" y="${88 - lo}" width="14" height="${lo}" fill="#00f0ff" />`);
  }
  $('#presale').innerHTML = `<line x1="4" y1="88" x2="276" y2="88" stroke="#475569" />${bars.join('')}`;
  $('#presale-cap').textContent = `Presales by show day: ${totals[0]} tickets on a slow draw, up to ${totals[1]} on a strong one. Walk-up sales come on the night.`;
}

// ---------------------------------------------------------------------------
// Show night

function showPanel() {
  return `
    <p class="eyebrow">Show night · ${esc(D.VENUE_NAME)}</p>
    <h2>Doors are open</h2>
    <p class="timecode" id="clock" aria-hidden="true">19:00</p>
    <p id="msg" class="message" aria-live="polite"></p>
    <ol class="feed" id="feed" aria-live="polite"></ol>
    <div id="incident-box"></div>
    <div class="actions"><button type="button" data-act="skip" id="skip-btn">Skip to the problem</button></div>`;
}

function feedLine(text) {
  const feed = $('#feed');
  if (!feed) return;
  const li = document.createElement('li');
  li.textContent = text;
  feed.appendChild(li);
}

function clock(p) {
  const minutes = 19 * 60 + Math.round(p * 240);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function startPlayback() {
  stopPlayback();
  const roll = rollShow(state.seed, state.booking.artistId);
  const preview = showPreview(state);
  ui.play = { start: performance.now(), at: roll.incidentAt, p: 0, beats: 0, preview: preview.attendance, after: null };
  feedLine(`Doors open. ${preview.presale} people already hold tickets.`);
  if (reduceMotion) {
    ui.play.p = roll.incidentAt;
    reachIncident();
    return;
  }
  loop();
}

function stopPlayback() {
  if (ui.raf) cancelAnimationFrame(ui.raf);
  ui.raf = 0;
}

// Leaving show night (signing the sheet mid wind-down, for one) finishes the
// crowd transition, so the board rests on the signed attendance.
function endPlayback() {
  stopPlayback();
  if (ui.play && ui.play.after) {
    ui.play.after.done = true;
    ui.play.p = 1;
  }
}

function loop() {
  ui.raf = requestAnimationFrame(() => {
    const play = ui.play;
    if (!play) return;
    if (state.phase === 'show' && !play.paused) {
      play.p = Math.min(play.at, (performance.now() - play.start) / 1000 / PLAY_SECONDS);
      const beats = [[0.15, 'Walk-up is buying at the gate.'], [0.3, `${artistFor(state.booking.artistId).name} take the stage.`]];
      while (play.beats < beats.length && play.p >= beats[play.beats][0]) { feedLine(beats[play.beats][1]); play.beats += 1; }
      const c = $('#clock'); if (c) c.textContent = clock(play.p);
      if (play.p >= play.at) reachIncident();
    }
    if (play.after) {
      const k = Math.min(1, (performance.now() - play.after.start) / 1000 / AFTER_SECONDS);
      play.p = play.at + (1 - play.at) * k;
      if (k >= 1) play.after.done = true;
    }
    draw();
    if (state.phase === 'show' || (play.after && !play.after.done)) loop();
    else ui.raf = 0;
  });
}

function reachIncident() {
  const play = ui.play;
  if (play.paused) return;
  play.paused = true;
  const c = $('#clock'); if (c) c.textContent = clock(play.p);
  const id = state.show.incidentId;
  const incident = D.INCIDENTS[id];
  feedLine(`${clock(play.p)}: ${incident.label}.`);
  const effect = (r) => {
    const bits = [];
    if (r.walkupMult !== undefined) bits.push(`keeps ${Math.round(r.walkupMult * 100)}% of walk-up sales`);
    if (r.flowMult !== undefined) bits.push(`entry flow drops to ${Math.round(r.flowMult * 100)}%`);
    bits.push(`handling score ${Math.round(r.score * 100)}`);
    return bits.join(' · ');
  };
  $('#incident-box').innerHTML = `
    <div class="incident" role="group" aria-labelledby="incident-title">
      <h3 id="incident-title">${esc(incident.label)}</h3>
      <p>${esc(INCIDENT_TEXT[id])}</p>
      ${incident.responses.map((r) => `
        <button type="button" class="choice" data-act="respond" data-response="${r.id}" ${r.cost > state.cash ? 'disabled' : ''}>
          <strong>${esc(r.label)}</strong>
          <span class="cost">${r.cost ? money(r.cost) : 'free'}${r.cost > state.cash ? ' · not enough cash' : ''}</span>
          <span>${effect(r)}</span>
        </button>`).join('')}
    </div>`;
  const skip = $('#skip-btn'); if (skip) skip.hidden = true;
  const first = el.panel.querySelector('[data-act="respond"]:not([disabled])');
  if (first) first.focus();
  draw();
}

function skipToIncident() {
  if (!ui.play || ui.play.paused) return;
  ui.play.p = ui.play.at;
  reachIncident();
}

function respond(responseId) {
  const play = ui.play;
  if (!act({ type: 'respond', responseId })) return;
  stopPlayback();
  if (play && !reduceMotion) {
    play.after = { start: performance.now(), done: false };
    loop();
  } else if (play) {
    play.p = 1;
  }
  focusHeading();
}

// ---------------------------------------------------------------------------
// Settle and done

function sheetHtml(r, { signed: done }) {
  const a = artistFor(state.booking.artistId);
  const v = evaluateVenue(state.venue);
  const deal = state.booking.deal;
  const response = findResponse(state.show.incidentId, state.show.responseId);
  const incident = D.INCIDENTS[state.show.incidentId];
  const cashAfter = done ? state.cash : state.cash + r.ticketGross + r.bar - (deal === 'door' ? r.artistPay : 0);
  const cashBefore = cashAfter - r.net;
  const cost = (n) => `<td class="num neg">${money(-n)}</td>`;
  const rows = [
    ['Lot lease and permit', 'Site', r.costs.lot + r.costs.permit],
    ['Fence kit', 'Site', r.costs.fence],
    [`PA rental (${v.paTier === 'M' ? 'medium' : 'small'})`, 'Audio', r.costs.pa],
    ['Light tower', 'Lighting', r.costs.lights],
    [`Bars (${v.bars})`, 'Hospitality', r.costs.bars],
    [`Restrooms (${v.restrooms})`, 'Site', r.costs.restrooms],
    [`Crew (${v.staff} staff)`, 'Labour', r.costs.staff],
    ['Ads', 'Promotion', r.costs.ads],
    [`Incident: ${response.label}`, incident.label, r.costs.incident],
  ];
  const pool = r.ticketGross - r.costs.total;
  const split = deal === 'door'
    ? `<p>Net ticket pool: ${money(r.ticketGross)} ticket gross − ${money(r.costs.total)} show costs = <strong>${money(Math.max(0, pool))}</strong>${pool < 0 ? ' (nothing to split)' : ''}</p>
       <p>Artist share: ${Math.round(D.DOOR_SPLIT * 100)}% of the pool = <strong>${money(r.artistPay)}</strong></p>`
    : `<p>Flat guarantee: <strong>${money(r.artistPay)}</strong>, paid before doors.</p>`;
  const parts = Object.keys(WEIGHTS).map((k) => {
    const pct = Math.round(r.parts[k] * 100);
    return `<div class="sat-row"><span>${PART_LABELS[k]}</span><span class="bar" aria-hidden="true"><span style="width:${pct}%"></span></span><span class="num">${pct}%</span></div>`;
  }).join('');
  const pass = r.result === 'pass';
  const tip = r.net < 0
    ? 'The night lost money. Try a door deal, a different ticket price, or fewer rentals.'
    : TIPS[r.weakest];
  return `
    <div class="sheet-head"><span><span class="live" aria-hidden="true"></span>SHOW SETTLEMENT · SHOW ${String(state.history.length + (done ? 0 : 1)).padStart(3, '0')} · LOT NIGHT</span><span>${clock(1)} CURFEW</span></div>
    <div class="meta-strip">
      <div><span class="meta-label">Headliner</span><span class="meta-val">${esc(a.name)}</span></div>
      <div><span class="meta-label">Venue</span><span class="meta-val">${esc(D.VENUE_NAME)}</span></div>
      <div><span class="meta-label">Deal</span><span class="meta-val hl">${deal === 'door' ? `Door (${Math.round(D.DOOR_SPLIT * 100)}%)` : 'Guarantee'}</span></div>
      <div><span class="meta-label">Attendance</span><span class="meta-val">${r.attendance} / ${v.capacity}</span></div>
      <div><span class="meta-label">Satisfaction</span><span class="meta-val score">${r.satisfaction}/100</span></div>
    </div>
    <div class="ledger">
      <div class="ledger-title">SECTION A · GROSS REVENUE</div>
      <table>
        <thead><tr><th scope="col">Source</th><th scope="col">Units</th><th scope="col" class="num">Total</th></tr></thead>
        <tbody>
          <tr><td>Tickets (presale and gate)</td><td>${r.attendance} × ${money(state.promotion.price)}</td><td class="num pos">${money(r.ticketGross)}</td></tr>
          <tr><td>Bar</td><td>${r.attendance} guests</td><td class="num pos">${money(r.bar)}</td></tr>
          <tr class="faint"><td>Merch</td><td>No merch tent yet</td><td class="num">$0</td></tr>
        </tbody>
        <tfoot><tr><td colspan="2">Total revenue</td><td class="num pos">${money(r.ticketGross + r.bar)}</td></tr></tfoot>
      </table>
    </div>
    <div class="ledger">
      <div class="ledger-title">SECTION B · PRODUCTION AND SITE COSTS</div>
      <table>
        <thead><tr><th scope="col">Line</th><th scope="col">Category</th><th scope="col" class="num">Total</th></tr></thead>
        <tbody>${rows.filter((row) => row[2] > 0).map((row) => `<tr><td>${esc(row[0])}</td><td>${esc(row[1])}</td>${cost(row[2])}</tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="2">Total show costs</td>${cost(r.costs.total)}</tr></tfoot>
      </table>
    </div>
    <div class="calc">
      <div class="ledger-title" style="padding:0;background:none;border:0">SECTION C · DEAL</div>
      ${split}
    </div>
    <div class="payouts">
      <div class="payout artist"><span class="meta-label">Artist payout</span><span class="amount">${money(r.artistPay)}</span>
        <p>${r.artistPay >= quotedAsk() ? 'Paid in full. The act leaves happy.' : `They expected ${money(quotedAsk())}.`}</p></div>
      <div class="payout promoter ${r.net < 0 ? 'loss' : ''}"><span class="meta-label">Promoter net</span><span class="amount">${money(r.net)}</span>
        <p>Revenue after every cost and the artist.</p></div>
    </div>
    <div>
      <h3>Crowd satisfaction ${r.satisfaction}/100</h3>
      <div class="meters-sat">${parts}</div>
    </div>
    <div class="outcomes">
      <div class="outcome"><span class="meta-label">Venue reputation</span><span class="stat ${r.repDelta >= 0 ? 'pos' : 'neg'}">${signed(r.repDelta)}</span></div>
      <div class="outcome"><span class="meta-label">Band relationship</span><span class="stat ${r.relDelta >= 0 ? 'pos' : 'neg'}">${signed(r.relDelta)}</span></div>
      <div class="outcome"><span class="meta-label">Cash on hand</span><span class="stat">${money(cashAfter)}</span><p class="lede">Started at ${money(cashBefore)}</p></div>
    </div>
    <div class="stamp-wrap">
      <span class="stamp ${pass ? 'pass' : 'retry'}">${pass ? 'Show settled' : 'Retry'}<small>${pass ? 'In the black, crowd happy' : r.net < 0 ? 'Net negative' : 'Crowd below 60'}</small></span>
    </div>
    <p class="tip"><strong>${pass ? 'For next time:' : 'Why it missed:'}</strong> ${esc(tip)}</p>`;
}

function settlePanel() {
  const r = settlementFor(state);
  return `
    <h2>Settlement</h2>
    <p id="msg" class="message" aria-live="polite"></p>
    ${sheetHtml(r, { signed: false })}
    <div class="actions"><button type="button" class="primary" data-act="accept">Sign the settlement</button></div>`;
}

function careerHtml() {
  const p = careerProgress(state);
  const row = (ok, text) => `<li class="${ok ? 'met' : ''}"><span aria-hidden="true">${ok ? '✓' : '○'}</span> ${text}</li>`;
  return `
    <section class="card career" aria-labelledby="career-title">
      <p class="eyebrow">Tier 1 · the Lot</p>
      <h3 id="career-title">${p.clubUnlocked ? 'The Club is unlocked' : 'Goal: unlock the Club'}</h3>
      <ul class="goal">
        ${row(p.met.sellouts, `Sell out the Lot (${D.PERMIT_CAP} people): ${p.sellouts} so far`)}
        ${row(p.met.venueRep, `Venue reputation ${D.LOT_GOAL.venueRep}: now ${p.venueRep}`)}
        ${row(p.met.cash, `${money(D.LOT_GOAL.cash)} in the bank: now ${money(p.cash)}`)}
        ${row(p.met.loyalAct, `An act that trusts you (relationship +${D.LOT_GOAL.loyalAct}): best is ${signed(p.loyalAct)}`)}
      </ul>
      <p class="hint">${p.clubUnlocked
        ? 'The Club opens in a later update. Until then, keep running shows on the Lot.'
        : 'A guarantee always builds trust. A door deal builds more when the act\'s share beats their ask, and sours them when it falls well short.'}</p>
    </section>`;
}

function donePanel() {
  const last = state.history[state.history.length - 1];
  const r = settlementFor(state);
  const pass = last && last.result === 'pass';
  const p = careerProgress(state);
  const history = state.history.slice().reverse().map((h) =>
    `<li>Show ${h.showId}: ${h.deal === 'door' ? 'door deal' : 'guarantee'} · ${h.attendance} people · ${money(h.net)} · ${h.result === 'pass' ? 'pass' : 'retry'}</li>`).join('');
  const next = p.canAffordAShow
    ? '<button type="button" class="primary" data-act="next">Book the next show</button>'
    : `<button type="button" class="primary" disabled>Book the next show</button>`;
  return `
    <h2>${pass ? 'A good night on the Lot' : 'A rough night'}</h2>
    <p id="msg" class="message" aria-live="polite"></p>
    <p class="lede">${pass
      ? 'The show made money and kept the crowd happy. Cash, reputation and every relationship carry into the next show.'
      : p.canAffordAShow
        ? 'The night lost money or left the crowd unhappy. The career goes on: cash, reputation and relationships carry over.'
        : `The acts on offer next need at least ${money(p.nextShowCost)} before doors, and you have ${money(state.cash)}. Start over to try again.`}</p>
    <div class="actions">
      <button type="button" data-act="retry">Start over</button>${next}
    </div>
    ${careerHtml()}
    ${r ? sheetHtml(r, { signed: true }) : ''}
    <details><summary>Show history (${state.history.length})</summary><ul class="history">${history}</ul></details>`;
}

// ---------------------------------------------------------------------------
// Board

const board = createBoard(el.canvas);

function crowdNow() {
  if (state.phase === 'show') {
    const play = ui.play;
    if (!play) return 0;
    return Math.round(play.preview * Math.min(1, play.p / 0.45));
  }
  if (state.phase === 'settle' || state.phase === 'done') {
    const r = settlementFor(state);
    const final = r ? r.attendance : 0;
    const play = ui.play;
    if (play && play.after && !play.after.done) {
      const k = (play.p - play.at) / Math.max(0.0001, 1 - play.at);
      return Math.round(play.preview + (final - play.preview) * k);
    }
    return final;
  }
  return 0;
}

function draw() {
  const night = ['show', 'settle', 'done'].includes(state.phase);
  const scene = {
    objects: state.venue.objects,
    clearSet: clearSet(),
    blockedSet: sight().blocked,
    showClear: state.phase === 'build' && ui.showClear,
    cursor: null,
    ghost: null,
    crowd: night ? crowdNow() : 0,
    incident: night && state.show ? state.show.incidentId : null,
    night,
    lightTower: state.venue.objects.some((o) => o.type === 'lights'),
    t: night && !reduceMotion && ui.raf ? performance.now() / 1000 : 0,
  };
  if (state.phase === 'settle' || state.phase === 'done') {
    if (state.show && state.show.incidentId !== 'rain') scene.incident = null;
  }
  if (state.phase === 'build') {
    const at = ui.hover || (ui.focused ? ui.cursor : null);
    if (at) {
      scene.cursor = at;
      scene.ghost = ghostAt(at);
    }
  }
  board.draw(scene);
}

function resizeBoard() {
  board.resize();
  draw();
}

el.canvas.addEventListener('pointermove', (e) => {
  if (state.phase !== 'build') return;
  const tile = board.tileAt(e.clientX, e.clientY);
  const key = tile ? `${tile.x},${tile.y}` : '';
  const old = ui.hover ? `${ui.hover.x},${ui.hover.y}` : '';
  if (key === old) return;
  ui.hover = tile;
  draw();
});
el.canvas.addEventListener('pointerleave', () => { ui.hover = null; draw(); });
el.canvas.addEventListener('click', (e) => {
  if (state.phase !== 'build') return;
  const tile = board.tileAt(e.clientX, e.clientY);
  if (!tile) return;
  ui.cursor = tile;
  if (e.shiftKey) removeAt(tile);
  else placeAt(tile);
});
el.canvas.addEventListener('contextmenu', (e) => {
  if (state.phase !== 'build') return;
  e.preventDefault();
  const tile = board.tileAt(e.clientX, e.clientY);
  if (tile) removeAt(tile);
});
el.canvas.addEventListener('focus', () => { ui.focused = true; draw(); });
el.canvas.addEventListener('blur', () => { ui.focused = false; draw(); });
el.canvas.addEventListener('keydown', (e) => {
  if (e.key === 'q' || e.key === 'Q') {
    e.preventDefault();
    const step = board.turnView();
    el.boardStatus.textContent = `View quarter ${step + 1} of 4. Props keep the original painted side.`;
    return;
  }
  if (state.phase !== 'build') return;
  const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  if (moves[e.key]) {
    e.preventDefault();
    ui.cursor = {
      x: Math.min(D.GRID.w - 1, Math.max(0, ui.cursor.x + moves[e.key][0])),
      y: Math.min(D.GRID.h - 1, Math.max(0, ui.cursor.y + moves[e.key][1])),
    };
    ui.hover = null;
    el.boardStatus.textContent = describeTile(ui.cursor);
    draw();
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    placeAt(ui.cursor);
    el.boardStatus.textContent = describeTile(ui.cursor);
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    removeAt(ui.cursor);
    el.boardStatus.textContent = describeTile(ui.cursor);
  } else if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    rotate();
  }
});

function rotate() {
  ui.rot = (ui.rot + 1) % 4;
  const r = $('#rot-label'); if (r) r.textContent = `faces ${FACING[ui.rot]}`;
  el.boardStatus.textContent = `Rotation: facing ${FACING[ui.rot]}.`;
  draw();
}

$('#turn-view').addEventListener('click', () => {
  const step = board.turnView();
  el.boardStatus.textContent = `View quarter ${step + 1} of 4. Props keep the original painted side.`;
});

// ---------------------------------------------------------------------------
// Panel events

el.panel.addEventListener('click', (e) => {
  const target = e.target.closest('[data-act]');
  if (!target || target.disabled) return;
  const a = target.dataset.act;
  if (a === 'deal') act({ type: 'chooseDeal', deal: target.dataset.deal, artistId: target.dataset.artist });
  else if (a === 'rotate') rotate();
  else if (a === 'fence') {
    const i = state.venue.objects.findIndex((o) => o.type === 'fence');
    if (i >= 0) act({ type: 'remove', index: i });
    else act({ type: 'place', object: { type: 'fence', x: 0, y: 0, rot: 0 } });
  } else if (a === 'starter') {
    if (act({ type: 'setLayout', objects: D.STARTER_LAYOUT }, { quiet: true })) say('Placed the suggested layout. Change anything you like.');
  } else if (a === 'clear-lot') {
    if (act({ type: 'setLayout', objects: [] }, { quiet: true })) say('Cleared the lot.');
  } else if (a === 'remove') {
    const i = Number(target.dataset.index);
    const type = state.venue.objects[i] && state.venue.objects[i].type;
    if (act({ type: 'remove', index: i }, { quiet: true }) && type) say(`Removed the ${label(type).toLowerCase()}.`);
  } else if (a === 'back') act({ type: 'back' });
  else if (a === 'confirm-build') act({ type: 'confirmBuild' });
  else if (a === 'confirm-promo') act({ type: 'confirmPromotion' });
  else if (a === 'skip') skipToIncident();
  else if (a === 'respond') respond(target.dataset.response);
  else if (a === 'accept') act({ type: 'acceptSettlement', at: new Date().toISOString() });
  else if (a === 'next') act({ type: 'nextShow' });
  else if (a === 'retry') act({ type: 'retry' });
  if (['deal', 'back', 'confirm-build', 'confirm-promo', 'accept', 'next', 'retry'].includes(a)) focusHeading();
});

el.panel.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.input === 'price') act({ type: 'setPromotion', price: Number(t.value) }, { quiet: true });
  else if (t.dataset.input === 'ad') act({ type: 'setPromotion', ads: { [t.dataset.channel]: Number(t.value) } }, { quiet: true });
});

el.panel.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.input === 'tool') {
    ui.tool = t.value;
    el.boardStatus.textContent = `Placing: ${label(ui.tool)}.`;
    draw();
  } else if (t.dataset.input === 'clear') {
    ui.showClear = t.checked;
    draw();
  }
});

// ---------------------------------------------------------------------------
// Save and load

function setSaveStatus(text) { el.saveStatus.textContent = text; }

document.querySelector('.savebar').addEventListener('click', (e) => {
  const target = e.target.closest('[data-save]');
  if (!target) return;
  const kind = target.dataset.save;
  if (kind === 'export') {
    const code = store ? store.exportCode() : null;
    el.saveCode.value = code || '';
    el.saveCode.select();
    setSaveStatus(code ? 'Copy this code to move your game to another browser.' : 'Nothing saved yet.');
  } else if (kind === 'import') {
    importCode(el.saveCode.value);
  } else if (kind === 'new') {
    if (!ui.confirmNew) {
      ui.confirmNew = true;
      target.textContent = 'Press again to erase this game';
      setSaveStatus('This erases the current game in this browser.');
      return;
    }
    ui.confirmNew = false;
    target.textContent = 'Start a new game';
    state = createGame(freshSeed());
    persist();
    stopPlayback();
    ui.play = null;
    ui.mounted = null;
    render();
    setSaveStatus('Started a new game.');
  }
});

// Checks the code before anything is written, so a bad code can't replace a good save.
// Codes from an older save version are converted with migrateSave (SAVE_FORMAT.md).
function importCode(code) {
  let parsed = null;
  try { parsed = JSON.parse(window.MixKitSave.decodeCode(String(code || '').trim())); } catch { parsed = null; }
  const schema = parsed && parsed.state ? parsed.state.schema : null;
  if (!parsed || parsed.ns !== D.SAVE_NAMESPACE || !Number.isInteger(schema) || schema < 1 || schema > D.SCHEMA_VERSION) {
    setSaveStatus("That code isn't a Front of House save. Nothing was changed.");
    return false;
  }
  state = normalizeState(migrateSave(parsed.state), freshSeed());
  persist();
  stopPlayback();
  ui.play = null;
  ui.mounted = null;
  render();
  setSaveStatus('Loaded the save code.');
  return true;
}

// ---------------------------------------------------------------------------
// Automation hooks (the MIXMASH and MarsScape convention)

window.render_game_to_text = () => {
  const v = evaluateVenue(state.venue);
  const r = settlementFor(state);
  return JSON.stringify({
    game: 'front-of-house',
    phase: state.phase,
    cash: state.cash,
    deal: state.booking.deal,
    artist: state.booking.artistId,
    offers: state.phase === 'book' ? offersFor(state) : null,
    career: (({ shows, sellouts, venueRep, loyalAct, goalMet, clubUnlocked, nextShowCost, canAffordAShow }) =>
      ({ shows, sellouts, venueRep, loyalAct, goalMet, clubUnlocked, nextShowCost, canAffordAShow }))(careerProgress(state)),
    venue: { objects: state.venue.objects.length, capacity: v.capacity, ready: v.ready, missing: v.missing },
    promotion: state.promotion,
    show: state.show,
    playback: ui.play ? { progress: Number(ui.play.p.toFixed(3)), paused: !!ui.play.paused } : null,
    crowd: crowdNow(),
    settlement: r ? { attendance: r.attendance, satisfaction: r.satisfaction, net: r.net, result: r.result } : null,
    history: state.history.length,
  });
};
window.__frontOfHouse = {
  state: () => JSON.parse(JSON.stringify(state)),
  act: (action) => act(action),
  skip: () => skipToIncident(),
  importCode,
};

// ---------------------------------------------------------------------------
// Boot

persist();
if ('ResizeObserver' in window) new ResizeObserver(resizeBoard).observe(el.canvas.parentElement);
else window.addEventListener('resize', resizeBoard);
board.resize();
render();
