// Front of House browser client: the five phase panels, the board, playback and saves.
//
// Every number shown comes from engine.mjs; this file only presents state and turns
// clicks and keys into engine actions (docs/RULES.md). Saves go through the shared
// MixKit store under SAVE_NAMESPACE and are validated with normalizeState on load.

import * as D from './data.mjs';
import {
  applyAction, artistFor, buzz, createGame, demand, doorRushPilot, evaluateVenue, findResponse, forecast, incidentAtFor, setTimeFor, festivalSupportFor, stageOpenersFor, stagePlanFor, stageForecastFor, festivalPolicyFor,
  careerProgress, migrateSave, normalizeState, offersFor, presaleSplit, rollShow, settlementFor, liveServicesFor, liveIncidentMinute, liveArrivalPlan, liveAccessFor, liveEndMinute,
  settlementPayout, sanitationPlanFor, equipmentFor, equipmentPlanFor, careerLedgerFor, heldRunFor, seatingPlanFor, seatingForecastFor, ticketingPlanFor, ticketingForecastFor, researchFor, researchEffectsFor, researchNightFor, showPreview, sightlineTiles, termsFor, upfrontFor, validatePlacement, venueSpec,
} from './engine.mjs';
import { heldRunQuote } from './held-run.mjs';
import { roomProfileFor } from './room-profile.mjs';
import { OWNERSHIP_COMMAND_LIMIT } from './ownership.mjs';
import { RESEARCH_COMMAND_LIMIT, researchRefundFor } from './research.mjs';
import { LOOK } from './board.js';
import { createSiteMap } from './site-map.mjs';
import { createBoardAdapter } from './board-adapter.mjs';
import { binding, matches } from './controls.mjs';

const PLAY_SECONDS = 12; // show-night playback length up to curfew
const AFTER_SECONDS = 3; // playback after the incident is answered
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const liveServicesPilot = new URLSearchParams(window.location.search).get('live-services') === '1';
const lotNightSlice = new URLSearchParams(window.location.search).get('night-slice') === '1';
const PLACEABLE = ['stage', 'pa-s', 'pa-m', 'lights', 'bar', 'restroom', 'gate', 'exit', 'food', 'trailer', 'delay', 'vip-deck', 'bus-compound'];
// Screen directions for each stage rotation (rotation 0 faces +y, the lower left on screen).
const FACING = ['the lower left', 'the upper left', 'the upper right', 'the lower right'];
const AD_LABELS = { flyers: 'Flyers and posters', social: 'Social ads', radio: 'Local radio' };
const PART_LABELS = { sound: 'Sound and light', sightlines: 'Sightlines', amenities: 'Bars and restrooms', flow: 'Entry flow', incident: 'Incident handling' };
const WEIGHTS = { sound: D.W_SOUND, sightlines: D.W_SIGHT, amenities: D.W_AMENITY, flow: D.W_FLOW, incident: D.W_INCIDENT };
const INCIDENT_TEXT = {
  rain: 'Rain rolls in as the doors open. Walk-up sales will suffer unless people have cover.',
  'pa-dropout': 'The PA cuts out in the middle of the set. The crowd is waiting.',
  'gate-jam': 'The entry gate jams and the line backs up down the block.',
  curfew: 'The venue has reached curfew. Decide how to end the set.',
};
// Consequences describe the existing responses; they do not invent repair times or new rules.
const RESPONSE_TEXT = {
  rain: { 'ride-out': 'No cover', ponchos: 'Personal cover', canopy: 'Shared shelter' },
  'pa-dropout': { wait: 'The crowd waits through the dropout', 'backup-amp': 'Restore sound with the backup' },
  'gate-jam': { 'ride-out': 'Queue backs up', 'second-lane': 'Restore entry flow' },
  curfew: { obey: 'Set ends early', appeal: 'Finish the song' },
};
const TIPS = {
  sound: 'Sound and light scored lowest. Check room coverage and lighting before renting extra gear.',
  sightlines: 'Sightlines scored lowest. Keep bars, restrooms and the light tower out of the cone in front of the stage.',
  amenities: `Bars and restrooms scored lowest. Plan one bar for every ${D.BAR_RATIO} people and one restroom for every ${D.RESTROOM_RATIO}.`,
  flow: 'Entry flow scored lowest. Add a gate, or answer a gate jam by opening a second lane.',
  incident: 'Incident handling scored lowest. Compare the response cost, crowd result and act payout.',
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
  topbar: $('.topbar'),
  menu: $('#menu'),
  menuBtn: $('#menu-btn'),
  fullscreen: $('#fullscreen'),
  win: $('#win'),
  winTitle: $('#win-title'),
  winBody: $('#win-body'),
  winFoot: $('#win-foot'),
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
  tool: 'select', placeTool: 'stage', selection: null, dozing: false, rot: 0, cursor: { x: 11, y: 6 }, hover: null, focused: false, showClear: true,
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

// Build undo and redo: a copy of the layout before each change, kept in memory only, so a
// reload or leaving Build starts with none. Undo applies the copy through the engine's own
// setLayout, which checks it like any other layout. A bulldozer drag is one step.
const HISTORY_LIMIT = 50;
const LAYOUT_ACTIONS = ['place', 'remove', 'setLayout'];
const history = { undo: [], redo: [], restoring: false, drag: null };
const copyLayout = (objects) => objects.map((o) => ({ ...o }));

function resetHistory() {
  ui.selection = null;
  ui.tool = 'select';
  history.undo = [];
  history.redo = [];
  history.drag = null;
}

function recordLayout(objects) {
  if (history.drag && history.drag.recorded) return;
  history.undo.push(copyLayout(objects));
  if (history.undo.length > HISTORY_LIMIT) history.undo.shift();
  history.redo = [];
  if (history.drag) history.drag.recorded = true;
}

function stepHistory(from, to, done, none) {
  if (state.phase !== 'build') return;
  if (!from.length) { say(none); return; }
  const current = copyLayout(state.venue.objects);
  const pressed = document.activeElement;
  history.restoring = true;
  const ok = act({ type: 'setLayout', objects: from[from.length - 1] }, { quiet: true });
  history.restoring = false;
  if (!ok) return;
  from.pop();
  to.push(current);
  say(done);
  updateBuild();
  // A button that just emptied its list is disabled; keep keyboard focus on its partner.
  if (pressed && pressed.disabled && (pressed.id === 'undo-btn' || pressed.id === 'redo-btn')) {
    const partner = $(pressed.id === 'undo-btn' ? '#redo-btn' : '#undo-btn');
    if (partner && !partner.disabled) partner.focus();
  }
}
const undoLayout = () => stepHistory(history.undo, history.redo, 'Undid the last change to the layout.', 'Nothing to undo.');
const redoLayout = () => stepHistory(history.redo, history.undo, 'Redid the change to the layout.', 'Nothing to redo.');

function act(action, { quiet = false } = {}) {
  const before = state;
  const { state: next, error } = applyAction(state, action);
  if (error) {
    say(error, 'error');
    return false;
  }
  if (next.phase !== before.phase) resetHistory();
  else if (before.phase === 'build' && !history.restoring && LAYOUT_ACTIONS.includes(action.type)) recordLayout(before.venue.objects);
  if (LAYOUT_ACTIONS.includes(action.type)) {
    ui.selection = null;
    if (win.kind === 'selection') closeWindow();
  }
  state = next;
  persist();
  if (!quiet) say('');
  render();
  return true;
}

function sight() {
  const key = JSON.stringify([state.venue.id, state.venue.profile || null, state.venue.objects]);
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
  if (state.show?.serviceRecovered && state.phase !== 'show') say('Recovered an invalid service timeline. Recorded career cash and signed history were retained.', 'error');
  draw();
}

function renderTop() {
  $('#stages-menu').hidden = state.venue.id !== 'festival' && !state.stagesNotice;
  $('#seating-menu').hidden = !(seatingPlanFor(state) || state.seatingNotice || roomProfileFor(state.venue) || state.roomNotice || state.supportNotice || festivalSupportFor(state.venue) || state.venue.objects.some(o => o.type === 'delay'));
  $('#seating-menu').textContent = state.venue.id !== 'amphitheater' ? 'Sound and views' : 'Seats and lawn';
  $('#held-run-menu').hidden = !(state.booking.run || state.show?.run || state.runNotice);
  $('#ticketing-menu').hidden = state.venue.id !== 'club';
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

// Build and Show float their controls in the lot's empty corners; the other phases use a
// sheet on the right (docs/HUD.md sections 3 and 4).
const HUD_PHASES = ['build', 'show'];

function mount() {
  const builders = { book: bookPanel, build: buildPanel, promote: promotePanel, show: showPanel, settle: settlePanel, done: donePanel };
  const html = builders[state.phase]();
  const hud = HUD_PHASES.includes(state.phase);
  document.body.dataset.layout = hud ? 'hud' : 'sheet';
  el.panel.innerHTML = hud ? html : `<div class="plate at-sheet">${html}</div>`;
  setSheetSize('peek');
  closeWindow({ focus: false });
  const heading = el.panel.querySelector('h2');
  if (heading) heading.setAttribute('tabindex', '-1');
  if (state.phase === 'settle') openSettlement($('#open-settlement'));
  syncTabs(el.panel, state.phase);
  if (state.phase === 'show') startPlayback();
  else if (state.phase !== 'settle') endPlayback();
  queueLayout();
}

// After a step the player chose, move focus to the new panel's heading so screen
// readers announce where they are. Never steals focus on load.
function focusHeading() {
  if (!el.win.hidden) { el.winTitle.focus(); return; }
  const heading = el.panel.querySelector('h2');
  if (heading) heading.focus();
}

function update() {
  if (state.phase === 'build') updateBuild();
  if (state.phase === 'promote') updatePromote();
  if (state.phase === 'show' && state.show.services) updateLiveServices();
}

// ---------------------------------------------------------------------------
// Book

// What each deal means. The Book sheet shows these under the deal buttons on the first show
// only; after that they are one click away in the deals window (docs/HUD.md decision 10).
const DEAL_HELP = {
  guarantee: 'Pay the agreed amount before doors. Keep every dollar left after costs. The act is happy however the night goes.',
  door: `The act gets ${Math.round(D.DOOR_SPLIT * 100)}% of tickets after show costs. Pay at settlement. Cheaper on a slow night. An act that expected its ask remembers a small payout.`,
  sponsor: `A sponsor pays ${money(D.SPONSOR_PAY)} before doors. Tickets stay at the usual price. You still pay the act's ask. Broadcast adds income if the grounds are big enough.`,
};

function dealHelpHtml() {
  const spec = venueSpec(state.venue), outdoor = ['amphitheater','festival'].includes(spec.id);
  const paragraphs = text => `<p>${esc(text).replaceAll('. ', '.</p><p>')}</p>`;
  return `
    <section ${outdoor ? 'data-tab="Guarantee" data-always-tabs' : ''}><h3>Pay the guarantee</h3>${paragraphs(DEAL_HELP.guarantee)}</section>
    <section ${outdoor ? 'data-tab="Door"' : ''}><h3>Offer a door deal</h3>${paragraphs(`${DEAL_HELP.door} Some acts refuse door deals when trust is low. Some only play for a guarantee.`)}</section>
    ${spec.sponsor ? `<section data-tab="Sponsor"><h3>Take a sponsor</h3>${paragraphs(DEAL_HELP.sponsor)}</section>` : ''}
    ${spec.id === 'festival' ? `<section data-tab="Rider"><h3>Touring requirements</h3><p>Place one VIP deck and one bus compound before doors.</p><p>Deck: ${money(D.FESTIVAL_SUPPORT.vipDeck)}, 4×3 tiles, 2kW.</p><p>Buses: ${money(D.FESTIVAL_SUPPORT.busCompound)}, 6×3 tiles, 6kW.</p><p>Shared site rentals, paid once at opening.</p><p>No additional tickets or income bonus.</p></section>` : ''}
    ${['amphitheater','festival'].includes(spec.id) ? '<section data-tab="Curfew"><h3>Set time</h3><p>Doors 19:00. Set 20:12 to 23:00.</p><p>A noise curfew can end the set early.</p><p>End now for free, or pay $400 for five more minutes.</p><p>Closing early reduces walk-ups and bar income.</p><p>Presales and the quoted guarantee stay paid.</p></section>' : ''}`;
}

function bookPanel() {
  const spec = venueSpec(state.venue);
  const offers = offersFor(state);
  // The first show of a career (or the wet lot) teaches; Sandbox and later shows don't.
  const teach = state.history.length === 0 && state.mode !== 'sandbox';
  const rooms = D.VENUE_ORDER.map((id) => {
    const v = D.VENUES[id];
    const open = id === 'lot' || state.mode === 'sandbox' || state.unlocks[id];
    const on = state.venue.id === id;
    return `<button type="button" data-act="venue" data-venue="${id}" ${on ? 'class="primary"' : ''} ${open ? '' : 'disabled'}>${esc(v.name)}${open ? '' : ' <small>(locked)</small>'}</button>`;
  }).join('');
  const nights = spec.nights.length > 1 ? `<div class="row tight nights">${spec.nights.map((n) =>
    `<button type="button" data-act="nights" data-nights="${n}" ${(state.booking.nights || 1) === n ? 'class="primary"' : ''}>${n} night${n > 1 ? 's' : ''}</button>`).join('')}</div>` : '';
  const cards = offers.map((id) => {
    const a = artistFor(id);
    const rel = state.reputation.artists[id] || 0;
    const t = termsFor(id, rel);
    const lo = Math.round(a.drawMin * t.drawMult);
    const hi = Math.round(a.drawMax * t.drawMult);
    const mood = rel >= D.LOT_GOAL.loyalAct ? 'trusts you' : rel > 0 ? 'likes working with you'
      : rel === 0 ? 'new to you' : rel > D.REL_DOOR_FLOOR ? 'remembers a short payout' : 'wants money up front';
    const doorNote = a.guaranteeOnly ? `${esc(a.name)} only plays for a guarantee.`
      : `${esc(a.name)} will only play for a guarantee after another short payout.`;
    const eligible = stageOpenersFor(state);
    const opener = spec.secondStage ? (eligible.includes(state.booking.secondId) ? state.booking.secondId : eligible[0]) : null;
    const extra = opener ? ` data-second="${opener}"` : '';
    const deal = (kind, title, cost, note, disabled = false) => `
      <button type="button" class="choice" data-act="deal" data-deal="${kind}" data-artist="${id}" ${disabled || (spec.secondStage && (!opener || opener === id)) ? 'disabled' : ''}${extra}>
        <span class="choice-head"><strong>${title}</strong> <span class="cost">${cost}</span></span>
        ${note ? `<span class="choice-text">${note}</span>` : ''}
      </button>`;
    return `
    <section class="card offer" aria-label="${esc(a.name)}" data-tab="${esc(a.name)}">
      <p class="eyebrow">Relationship ${signed(rel)} · ${mood}</p>
      <p class="artist-name">${esc(a.name)}</p>
      <p class="facts">${esc(a.genre)} · draws ${lo} to ${hi} · usually ${money(a.fairPrice)}</p>
      <p class="lede">Asks ${money(t.ask)}${t.ask !== a.ask ? ` (${money(a.ask)} to a promoter they don't know)` : ''}.${spec.id === 'amphitheater' ? ' Seats and lawn sell separately. Shell rig included.' : spec.id === 'festival' ? ` Main sound included. Touring rentals: ${money(D.FESTIVAL_SUPPORT.vipDeck + D.FESTIVAL_SUPPORT.busCompound)}.` : spec.id === 'club' ? ' House PA and lights included.' : ''}</p>
      ${spec.id === 'amphitheater' && state.booking.nights > 1 ? `<p class="lede">Cancel after a night: ${money(Math.round(t.ask/4))} for each unplayed night (25% of ask).</p>` : ''}
      ${opener === id ? '<p class="lede">Selected for side stage. Choose another side act first.</p>' : opener ? `<p class="lede">Side: ${esc(artistFor(opener).name)} · door deal.</p>` : spec.secondStage ? '<p class="lede">No side act accepts a door deal. Choose another venue.</p>' : ''}
      ${deal('guarantee', 'Guarantee', `${money(t.ask)} up front`, teach ? 'Paid before doors. You keep the rest, and the act is happy either way.' : '')}
      ${deal('door', 'Door deal', `${Math.round(D.DOOR_SPLIT * 100)}% of the net`, !t.doorOk ? doorNote : teach ? `Cheaper on a slow night, but they expect ${money(t.ask)}.` : '', !t.doorOk)}
      ${spec.sponsor ? deal('sponsor', 'Sponsor', `+${money(D.SPONSOR_PAY)}`, `Tickets fixed at ${money(a.fairPrice)}.`) : ''}
    </section>`;
  }).join('');
  return `
    <div class="sheet-top">
      <div>
        <p class="eyebrow">Show ${state.history.length + 1} · ${esc(spec.name)}</p>
        <h2>Book the act</h2>
      </div>
      <button type="button" class="info-btn" data-act="deal-help" aria-label="How the deals work">ⓘ Deals</button>
      ${spec.secondStage ? '<button type="button" class="info-btn" data-act="stages-open" id="stage-bill">Stage bill</button>' : ''}
    </div>
    <p id="msg" class="message" aria-live="polite"></p>
    <div class="rooms">${rooms}</div>
    ${nights}
    <p class="lede">${spec.secondStage ? 'One site ticket; both stage budgets. Choose a main act and deal.' : teach && spec.id === 'lot' ? 'Your first night. Two acts want the date; Sodium Arcade is the safe first booking.' : 'Two acts want this date. Pick one and a deal.'}</p>
    <div class="offers">${cards}</div>`;
}

// ---------------------------------------------------------------------------
// Build

const COSTS = {
  stage: 'with the lot',
  'vip-deck': money(D.FESTIVAL_SUPPORT.vipDeck),
  'bus-compound': money(D.FESTIVAL_SUPPORT.busCompound),
  'pa-s': money(D.PA_RENTAL.S),
  'pa-m': money(D.PA_RENTAL.M),
  lights: money(D.LIGHTS_RENTAL),
  bar: `${money(D.BAR_SETUP)} + ${D.BAR_STAFF_PER_BAR} staff`,
  delay: `${money(D.FESTIVAL_DELAYS.rental + D.FESTIVAL_DELAYS.operator)} including operator`,
  trailer: `${money(D.SANITATION_COSTS.trailer)} + optional cleaner/utilities`,
  food: 'Vendor supplies staff and power',
  restroom: money(D.RESTROOM_UNIT),
  gate: `${D.DOOR_STAFF_PER_GATE} door staff`,
  exit: 'free',
};

// Short names for the tool tiles; the full label, size and cost are read out with each.
const SHORT = { stage: 'Stage', 'pa-s': 'PA S', 'pa-m': 'PA M', lights: 'Lights', bar: 'Bar', restroom: 'Toilet', gate: 'Gate', exit: 'Exit', food: 'Food', trailer: 'Trailer', delay: 'Delay', 'vip-deck': 'VIP deck', 'bus-compound': 'Buses' };
// The rotation as an arrow on screen, in FACING order.
const ARROWS = ['↙', '↖', '↗', '↘'];

function toolFacts(type) {
  const t = D.OBJECT_TYPES[type];
  return `${t.w}×${t.h} · ${COSTS[type]}${t.watts ? ` · ${t.watts / 1000} kW` : ''}`;
}

// The Build HUD: the phase card top left, the lot's readouts top right, the tools bottom
// left and the actions bottom right, all clear of the lot at the fit.
function buildPanel() {
  const spec = venueSpec(state.venue);
  const where = spec.id === 'lot' ? 'lot' : 'room';
  const tiles = PLACEABLE.map((type, i) => {
    const t = D.OBJECT_TYPES[type];
    if (t.lotOnly && spec.id !== 'lot' || t.festivalOnly && spec.id !== 'festival' || t.supportOnly && !festivalSupportFor(state.venue)) return '';
    const shortcut = type === 'trailer' ? 'T' : type === 'delay' ? 'D' : type === 'vip-deck' ? 'V' : type === 'bus-compound' ? 'U' : i + 1;
    return `<label class="tile" title="${esc(t.label)} · ${esc(toolFacts(type))} · key ${shortcut}">
        <input type="radio" name="tool" value="${type}" data-input="tool" ${ui.tool === type ? 'checked' : ''} />
        <span class="tile-key" aria-hidden="true">${shortcut}</span>
        ${['food', 'trailer', 'delay', 'vip-deck', 'bus-compound'].includes(type) ? '<span class="food-icon" aria-hidden="true">▱</span>' : `<img src="./sprites/${type}.png" alt="" decoding="async" />`}
        <span class="tile-name" aria-hidden="true">${SHORT[type]}</span>
        <span class="sr-only">${esc(t.label)}, ${esc(toolFacts(type))}, key ${shortcut}</span>
      </label>`;
  }).join('');
  return `
    <div class="plate at-tl card-plate">
      <p class="eyebrow">${esc(spec.name)} · ${spec.grid.w} × ${spec.grid.h} tiles</p>
      <h2>Build the ${where}</h2>
      <p class="hint" id="tool-info"></p>
      <p id="msg" class="message" aria-live="polite"></p>
    </div>
    <div class="plate at-tr status-plate" role="group" aria-label="The ${where}" data-tab="${where === 'lot' ? 'Lot' : 'Room'}">
      <dl class="readouts" id="venue-stats"></dl>
      <div id="venue-check"></div>
      <div class="row tight">
        <button type="button" data-act="fence" id="fence-btn"></button>
        <label class="toggle"><input type="checkbox" data-input="clear" ${ui.showClear ? 'checked' : ''} /> Sightlines</label>
        <button type="button" data-act="lot-details" id="details-btn">Details <span class="count" id="obj-count">0</span></button>
      </div>
    </div>
    <div class="plate at-bl tools-plate" role="group" aria-label="Object to place" data-tab="Tools">
      <div class="tiles"><button type="button" class="tile" data-act="select" id="select-btn" aria-pressed="false" title="Select · Escape cancels placement"><span class="tile-glyph" aria-hidden="true">↖</span><span class="tile-name">Select</span></button>${tiles}
        <button type="button" class="tile" data-act="bulldoze" id="doze-btn" aria-pressed="false" title="Bulldoze · key ${binding('bulldoze').keysLabel}">
          <span class="tile-key" aria-hidden="true">${binding('bulldoze').keysLabel}</span><span class="tile-glyph" aria-hidden="true">✕</span><span class="tile-name">Remove</span>
        </button>
        <button type="button" class="tile" data-act="rotate" title="Rotate · key ${binding('rotate').keysLabel}">
          <span class="tile-key" aria-hidden="true">${binding('rotate').keysLabel}</span><span class="tile-glyph" id="rot-glyph" aria-hidden="true">${ARROWS[ui.rot]}</span><span class="tile-name" aria-hidden="true">Rotate</span>
          <span class="sr-only">Rotate, <span id="rot-label"></span></span>
        </button>
        <button type="button" class="tile" data-act="undo" id="undo-btn" title="Undo · ${binding('undo').keysLabel}" disabled>
          <span class="tile-glyph" aria-hidden="true">↶</span><span class="tile-name">Undo</span>
        </button>
        <button type="button" class="tile" data-act="redo" id="redo-btn" title="Redo · ${binding('redo').keysLabel}" disabled>
          <span class="tile-glyph" aria-hidden="true">↷</span><span class="tile-name">Redo</span>
        </button>
      </div>
    </div>
    <div class="plate at-br actions-plate" data-tab="Actions">
      <div class="row tight">
        <button type="button" data-act="starter">Suggested layout</button>
        <button type="button" data-act="clear-lot" aria-label="Clear the ${where}">Clear</button>
      </div>
      <div class="row tight">
        <button type="button" data-act="back" aria-label="Back to booking">Back</button>
        <button type="button" class="primary" data-act="confirm-build" id="confirm-build">Lock the layout</button>
      </div>
    </div>`;
}

// The guarantee the booked act was quoted (R-19), or its base ask for a booking made before
// the Lot career.
function quotedAsk() {
  return state.booking.terms ? state.booking.terms.ask : artistFor(state.booking.artistId).ask;
}

function costsSoFar() {
  const deal = state.booking.deal;
  const artistDue = deal === 'guarantee' || deal === 'sponsor' ? quotedAsk() : 0;
  const sponsor = deal === 'sponsor' ? D.SPONSOR_PAY : 0;
  return upfrontFor(state) - artistDue - adTotal(state.promotion.ads) + sponsor;
}

function updateBuild() {
  const v = evaluateVenue(state.venue);
  const spec = venueSpec(state.venue);
  const wattsCap = spec.watts;
  const density = spec.density || D.FLOOR_DENSITY;
  const limits = { permit: 'permit', floor: 'floor space', exits: 'exits' };
  const load = Math.min(100, Math.round((v.watts / wattsCap) * 100));
  $('#venue-stats').innerHTML = `
    <div><dt>Capacity</dt><dd>${v.capacity} <small>${limits[v.capacityLimit]}</small></dd></div>
    <div><dt>Power</dt><dd class="${v.watts > wattsCap * 0.9 ? 'warn' : ''}">${(v.watts / 1000).toFixed(1)} / ${wattsCap / 1000} kW</dd>
      <span class="bar" aria-hidden="true"><span style="width:${load}%"></span></span></div>
    <div><dt>Clear view</dt><dd>${v.clearTiles} <small>fits ${Math.floor(v.clearTiles * density)}</small></dd></div>
    <div><dt>View blocked</dt><dd class="${v.blockedTiles ? 'bad' : ''}">${v.blockedTiles} tiles</dd></div>
    <div><dt>Staff</dt><dd>${v.staff}</dd></div>
    <div><dt>Costs so far</dt><dd>${money(costsSoFar())}</dd></div>`;
  const notes = [...v.missing, ...v.problems.map((p) => p.message)];
  $('#venue-check').innerHTML = notes.length
    ? `<p class="checklist"><span>${esc(notes[0])}.</span>${notes.length > 1 ? ` <span class="more">${notes.length - 1} more in Details.</span>` : ''}</p>`
    : roomProfileFor(state.venue) ? `<p class="checklist ${v.soundCapacity < v.capacity ? 'warn' : 'ok'}">Ready · ${v.housePa ? esc(roomProfileFor(state.venue).label) : 'portable PA'} for ${v.soundCapacity} people.</p>`
    : `<p class="checklist ok">✓ The ${spec.id === 'lot' ? 'lot' : 'room'} is ready for a show.</p>`;
  $('#obj-count').textContent = String(state.venue.objects.length);
  $('#details-btn').setAttribute('aria-label', `Details: readiness and the ${state.venue.objects.length} placed objects`);
  $('#rot-label').textContent = `faces ${FACING[ui.rot]}`;
  $('#rot-glyph').textContent = ARROWS[ui.rot];
  const fence = state.venue.objects.some((o) => o.type === 'fence');
  const fenceBtn = $('#fence-btn');
  fenceBtn.textContent = fence ? 'Fence ✓' : `Fence +${money(D.FENCE_KIT)}`;
  fenceBtn.setAttribute('aria-label', fence ? 'Remove the fence kit' : `Add the fence kit, ${money(D.FENCE_KIT)}`);
  fenceBtn.setAttribute('aria-pressed', fence ? 'true' : 'false');
  $('#confirm-build').disabled = !v.ready;
  $('#undo-btn').disabled = !history.undo.length;
  $('#redo-btn').disabled = !history.redo.length;
  const dozing = ui.tool === 'bulldoze';
  const doze = $('#doze-btn');
  doze.classList.toggle('on', dozing);
  doze.setAttribute('aria-pressed', dozing ? 'true' : 'false');
  const selecting = ui.tool === 'select';
  $('#select-btn').setAttribute('aria-pressed', String(selecting));
  $('#select-btn').classList.toggle('on', selecting);
  $('#tool-info').textContent = selecting ? 'Select: click an object to inspect it. Choose a tool to place; Escape returns here.' : dozing
    ? 'Bulldozing: click or drag across anything you want gone. B places again.'
    : `Placing the ${label(ui.tool).toLowerCase()}: ${toolFacts(ui.tool)}${ui.tool === 'stage' ? `, facing ${FACING[ui.rot]}` : ''}. Click a tile for its top corner.`;
  if (win.kind === 'lot') refreshWindow(lotDetailsHtml());
}

// The Details window: everything the lot still needs, and every placed object by type, with
// a remove button each (the keyboard path to remove an object by name).
function lotDetailsHtml() {
  const v = evaluateVenue(state.venue);
  const notes = [...v.missing, ...v.problems.map((p) => p.message)];
  const groups = new Map();
  state.venue.objects.forEach((o, i) => {
    if (!groups.has(o.type)) groups.set(o.type, []);
    groups.get(o.type).push({ o, i });
  });
  const place = (o) => (D.OBJECT_TYPES[o.type].kit ? 'around the lot' : `${o.x}, ${o.y}${o.type === 'stage' ? `, facing ${FACING[o.rot]}` : ''}`);
  const rows = [...groups].map(([type, list]) => `
      <li><span class="obj-name">${esc(label(type))} <span class="count">×${list.length}</span></span>
        <span class="obj-places">${list.map(({ o, i }) => `<button type="button" class="chip" data-act="remove" data-index="${i}" aria-label="Remove the ${esc(label(type).toLowerCase())} at ${place(o)}">${place(o)} ✕</button>`).join('')}</span></li>`).join('');
  return `
    <section aria-labelledby="ready-title">
      <h3 id="ready-title">Readiness</h3>
      ${notes.length ? `<ul class="checklist">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '<p class="checklist ok">✓ Ready for a show.</p>'}
      ${roomProfileFor(state.venue) || state.venue.objects.some(o => o.type === 'delay') ? '<button data-act="room-open">Sound and views</button>' : ''}
      ${state.roomNotice ? `<p role="status">${esc(state.roomNotice)}</p>` : ''}${state.supportNotice ? `<p role="status">${esc(state.supportNotice)}</p>` : ''}
    </section>
    <section aria-labelledby="placed-title">
      <h3 id="placed-title">Placed objects (${state.venue.objects.length})</h3>
      ${rows ? `<ul class="obj-groups">${rows}</ul>` : '<p class="lede">Nothing is placed yet.</p>'}
    </section>`;
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

function selectTool() {
  ui.tool = 'select';
  ui.selection = null;
  ui.dozing = false;
  history.drag = null;
  document.querySelectorAll('input[name="tool"]').forEach((input) => { input.checked = false; });
  el.boardStatus.textContent = 'Select an object to inspect it. Nothing will be placed.';
  updateBuild();
  draw();
}

function inspectAt(tile) {
  const index = objectIndexAt(tile.x, tile.y);
  ui.selection = index >= 0 ? index : null;
  ui.cursor = tile;
  draw();
  if (index < 0) { el.boardStatus.textContent = describeTile(tile); return; }
  const object = state.venue.objects[index];
  openWindow('selection', label(object.type),
    '<p class="lede">Tile ' + object.x + ', ' + object.y + ' · ' + esc(toolFacts(object.type)) + '</p>' +
    '<p>Removal can be undone while you remain in Build.</p>', el.canvas,
    { foot: '<button type="button" data-act="remove-selected">Remove object</button><button type="button" class="primary" data-win="close">Done</button>' });
}

function ghostAt(tile) {
  const ghost = { type: ui.tool, x: tile.x, y: tile.y, rot: ui.rot };
  const { problems } = validatePlacement([...state.venue.objects, ghost], state.venue);
  return { ...ghost, valid: !problems.some((p) => p.index === state.venue.objects.length) };
}

function placeAt(tile) {
  if (state.phase !== 'build' || !tile) return;
  if (ui.tool === 'select') { inspectAt(tile); return; }
  if (ui.tool === 'bulldoze') { doze(tile); return; }
  if (act({ type: 'place', object: { type: ui.tool, x: tile.x, y: tile.y, rot: ui.rot } }, { quiet: true })) {
    say(`Placed the ${label(ui.tool).toLowerCase()} at ${tile.x}, ${tile.y}.`);
  }
}

function doze(tile) {
  if (!tile) return;
  ui.cursor = tile;
  const i = objectIndexAt(tile.x, tile.y);
  if (i < 0) return;
  const type = state.venue.objects[i].type;
  if (act({ type: 'remove', index: i }, { quiet: true })) say(`Bulldozed the ${label(type).toLowerCase()}.`);
}

function toggleBulldoze() {
  ui.selection = null;
  if (ui.tool === 'bulldoze') ui.tool = ui.placeTool || 'stage';
  else {
    if (ui.tool !== 'bulldoze') ui.placeTool = ui.tool;
    ui.tool = 'bulldoze';
  }
  document.querySelectorAll('input[name="tool"]').forEach((input) => { input.checked = input.value === ui.tool; });
  el.boardStatus.textContent = ui.tool === 'bulldoze'
    ? 'Bulldozer. Click or drag across an object to remove it. B places again. The fence kit stays on its button.'
    : ui.tool === 'select' ? 'Select an object to inspect it.' : `Placing: ${label(ui.tool)}.`;
  if (state.phase === 'build') updateBuild();
  draw();
}

// Removal by pointer goes to the prop drawn under the pointer (a tall sprite rises well
// above its footprint), and to the ground tile when no prop is there.
function targetAt(e) {
  const { object: hit, blocked } = board.pickAt(e.clientX, e.clientY);
  if (blocked) return null;
  return hit ? { x: hit.x, y: hit.y } : board.tileAt(e.clientX, e.clientY);
}

function removeUnder(e) {
  const tile = targetAt(e);
  if (tile) removeAt(tile);
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
  const spec = venueSpec(state.venue);
  const sponsorPrice = festivalPolicyFor(state)?.sponsorPrice;
  const priceMax = spec.priceMax || D.PRICE_MAX;
  const sliders = D.AD_CHANNELS.map((c) => `
    <div class="slider">
      <label for="ad-${c}">${AD_LABELS[c]} <output id="ad-${c}-out" for="ad-${c}"></output></label>
      <input type="range" id="ad-${c}" min="0" max="${D.AD_SLIDER_MAX}" step="${D.AD_STEP}" data-input="ad" data-channel="${c}" />
    </div>`).join('');
  const seats = spec.seats ? `
    <div class="slider">
      <label for="seat-price">Seat price <output id="seat-out" for="seat-price"></output></label>
      <input type="range" id="seat-price" min="${D.PRICE_MIN}" max="${priceMax}" step="1" data-input="seat" />
    </div>
    <p class="lede">${seatingPlanFor(state) ? 'Each zone sells independently.' : `${spec.seats} seats sell first, then the lawn at the lawn price.`}</p>` : '';
  return `
    <p class="eyebrow">14 days out · ${esc(artistFor(state.booking.artistId).name)} · ${esc(spec.name)}</p>
    <h2>Promote the show</h2>
    <p class="lede">${sponsorPrice !== undefined ? 'The sponsor fixes ticket price. Set the ads and check the forecast.' : 'Set the price and the ads. The forecast shows the likely range.'}</p>
    <p id="msg" class="message" aria-live="polite"></p>
    <div class="cols">
      <div class="col" data-tab="Price and ads">
        <div class="slider">
          <label for="price">${sponsorPrice !== undefined ? 'Sponsor ticket price' : spec.seats ? 'Lawn price' : 'Ticket price'} <output id="price-out" for="price"></output></label>
          <input type="range" id="price" min="${D.PRICE_MIN}" max="${priceMax}" step="1" data-input="price" ${sponsorPrice !== undefined ? 'disabled' : ''} />
        </div>
        ${seats}
        <fieldset><legend>Ad spend</legend>${sliders}</fieldset>
      </div>
      <div class="col">
        <dl class="stats" id="promo-stats" data-tab="Forecast"></dl>
        <figure data-tab="Presales">
          <svg id="presale" class="chart" viewBox="0 0 280 96" role="img" aria-labelledby="presale-cap"></svg>
          <figcaption id="presale-cap"></figcaption>
        </figure>
      </div>
    </div>
    <div class="actions">
      <button type="button" data-act="back">Back to Build</button>
      ${spec.id === 'lot' ? '<button type="button" data-act="live-settings" id="live-settings">Live services: Off</button>' : ''}
      ${seatingPlanFor(state) ? '<button type="button" data-act="seating-open" id="seating-settings">Seats and lawn</button>' : ''}
      ${stagePlanFor(state) ? '<button type="button" data-act="stages-open" id="stage-settings">Stage accounts</button>' : ''}
      ${spec.id === 'club' ? '<button type="button" data-act="ticketing-open" id="ticketing-settings">Ticketing: Direct</button>' : ''}
      ${spec.id === 'lot' ? '<button type="button" data-act="food-settings" id="food-settings">Facilities</button>' : ''}
      <button type="button" class="primary" data-act="confirm-promo" id="confirm-promo">Open doors</button>
    </div>`;
}

function updatePromote() {
  const p = state.promotion;
  const settings = $('#live-settings');
  if (settings) settings.textContent = `Live services: ${(p.liveServices ?? liveServicesPilot) ? 'On' : 'Off'}`;
  const ticketingSettings = $('#ticketing-settings');
  if (ticketingSettings) ticketingSettings.textContent = `Ticketing: ${ticketingPlanFor(state)?.plan === 'platform' ? 'Platform' : 'Direct'}`;
  const foodSettings = $('#food-settings');
  if (foodSettings) foodSettings.textContent = 'Facilities';
  const a = artistFor(state.booking.artistId);
  const price = $('#price');
  if (document.activeElement !== price) price.value = String(p.price);
  $('#price-out').textContent = money(p.price);
  const seat = $('#seat-price');
  if (seat) {
    if (document.activeElement !== seat) seat.value = String(p.seatPrice || p.price);
    $('#seat-out').textContent = money(p.seatPrice || p.price);
  }
  for (const c of D.AD_CHANNELS) {
    const input = $(`#ad-${c}`);
    if (document.activeElement !== input) input.value = String(p.ads[c]);
    $(`#ad-${c}-out`).textContent = money(p.ads[c]);
  }
  const f = forecast(state);
  const seatingQuote = seatingForecastFor(state), stageQuote = stageForecastFor(state);
  const lowTickets = stageQuote?.ticketGross.low ?? seatingQuote?.low.ticketGross ?? f.low * p.price;
  const highTickets = stageQuote?.ticketGross.high ?? seatingQuote?.high.ticketGross ?? f.high * p.price;
  const upfront = upfrontFor(state);
  const short = state.mode !== 'sandbox' && upfront > state.cash;
  $('#promo-stats').innerHTML = `
    <div><dt>Forecast crowd</dt><dd>${f.low} to ${f.high} <span class="lede">of ${f.capacity}</span></dd></div>
    <div><dt>Buzz</dt><dd>×${buzz(p.ads).toFixed(2)}</dd></div>
    <div><dt>Ticket money</dt><dd>${money(lowTickets)} to ${money(highTickets)}</dd></div>
    <div><dt>Ad spend</dt><dd>${money(adTotal(p.ads))}</dd></div>
    <div><dt>Due before doors</dt><dd class="${short ? 'bad' : ''}">${money(upfront)}</dd></div>`;
  $('#confirm-promo').disabled = short;
  const doorOk = termsFor(state.booking.artistId, state.reputation.artists[state.booking.artistId]).doorOk;
  if (short) say(`This show needs ${money(upfront)} before doors and you have ${money(state.cash)}. Cut ads or rentals${state.booking.deal === 'guarantee' && doorOk ? ', or go back and offer a door deal' : ''}.`, 'error');
  else if ($('#msg').classList.contains('error') && $('#msg').textContent.startsWith('This show needs')) say('');

  // Presale chart: cumulative tickets sold over 14 days for the slowest and strongest draw.
  const totals = [a.drawMin, a.drawMax].map((draw) => {
    const dem = demand({ draw, price: p.price, fairPrice: a.fairPrice, ads: p.ads, venueRep: state.reputation.venue });
    return presaleSplit(dem, buzz(p.ads), f.capacity).presale;
  });
  if (seatingQuote) { totals[0] = seatingQuote.low.presale; totals[1] = seatingQuote.high.presale; }
  if (stageQuote) { totals[0] = stageQuote.presale.low; totals[1] = stageQuote.presale.high; }
  const ticketingQuote = ticketingForecastFor(state);
  if (ticketingQuote) { totals[0] = ticketingQuote.low.presale; totals[1] = ticketingQuote.high.presale; }
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

// The Show HUD: the clock top left, the incident top right when it comes, the event feed
// bottom left and the crowd bottom right.
function showPanel() {
  if (state.show.services) return liveServicesPanel();
  return `
    <div class="plate at-tl card-plate">
      <p class="eyebrow">Show night · ${esc(venueSpec(state.venue).name)}</p>
      <h2>Show night</h2>
      <p class="timecode" id="clock" aria-label="Show clock">19:00</p>
      <p class="show-status" id="show-status"></p>
      <p id="msg" class="message" aria-live="polite"></p>
    </div>
    <div class="plate at-tr incident-plate" id="incident-box" data-tab="Problem" hidden></div>
    <div class="plate at-bl feed-plate" data-tab="Night"><ol class="feed" id="feed" aria-live="polite"></ol></div>
    <div class="plate at-br actions-plate" data-tab="Night">
      <div class="row">
        <p class="crowd-now"><span class="meta-label">In the ${venueSpec(state.venue).id === 'lot' ? 'lot' : 'room'}</span> <span id="crowd-now">0</span></p>
        <button type="button" data-act="locate-incident" id="locate-incident" hidden>Locate equipment</button>
      </div>
      <p class="hint" id="rush-now" hidden></p>
      <button type="button" data-act="skip" id="skip-btn">Skip to the problem</button>
    </div>`;
}

function facilitySettings() {
  const access = liveAccessFor(state), terms = state.promotion.sanitation;
  return `<section data-tab="Food" data-always-tabs>
    <label>Contract <select id="food-plan" data-input="food-plan"><option value="">Off</option><option value="standard">Standard · $8 meals</option><option value="premium">Premium · $12 meals</option></select></label>
    <p>Standard: 80 meals, one window, 2/min. Premium: 160 meals, two windows, 4/min.</p>
    <p>House earns 25% of sales. Vendor pays stock and wages; artist pay is unchanged. Guests have limited budgets and some decline higher prices.</p>
    <p>Needs live services and one connected Food stall. Connected: ${access.usableVendors}. Terms lock at doors.</p></section>
    <section data-tab="Sanitation" data-always-tabs class="facility-options">
    <label><input id="sanitation-enabled" data-input="sanitation" type="checkbox" ${terms ? 'checked' : ''}> Run sanitation visits</label>
    <label><input id="sanitation-cleaner" data-input="sanitation" type="checkbox" ${terms?.cleaner ? 'checked' : ''}> Dedicated cleaner · $80</label>
    <label><input id="sanitation-utilities" data-input="sanitation" type="checkbox" ${terms?.utilities ? 'checked' : ''}> Trailer utilities · $60</label>
    <p id="sanitation-quote" aria-live="polite"></p>
    <p class="hint">Trailer rental $240; three stalls need utilities. Connected portables work without utilities. Visits take 2m; after 12 uses a stall needs 3m cleaning. Missed visits lower amenities. Costs enter the door deal deduction basis.</p></section>
    <section data-tab="Artist" data-always-tabs class="facility-options">
    <h3>Optional quiet changing area</h3>
    <label><input id="sanitation-preference" data-input="sanitation" type="checkbox" ${terms?.preference ? 'checked' : ''}> Accept Sodium Arcade’s preference</label>
    <p id="sanitation-artist" aria-live="polite"></p>
    <p>Requires sanitation, a connected trailer, utilities and a cleaner. The changing area is separate from the three guest stalls.</p>
    <p>Fulfillment adds up to 2 relationship points within the existing limit. No change to artist pay. Leaving this unchecked declines without penalty. Terms lock at doors.</p></section>`;
}

function updateFacilitySettings() {
  const plan = sanitationPlanFor(state), access = liveAccessFor(state), placed = evaluateVenue(state.venue);
  for (const id of ['sanitation-cleaner', 'sanitation-utilities', 'sanitation-preference']) $('#' + id).disabled = !plan;
  $('#sanitation-quote').textContent = plan ? `${plan.usableStalls} usable stalls · ${access.restrooms.length}/${placed.restrooms} connected portables. Production total ${money(plan.cost)} before doors${plan.terms.trailer ? ' (includes $240 trailer)' : ''}.` : 'Off. Existing restroom capacity scoring applies. Enable live services for this trial.';
  $('#sanitation-artist').textContent = !plan ? 'Enable sanitation first.' : plan.preference.available ? `Package ready · preference ${plan.terms.preference ? 'accepted' : 'declined'}.` : 'Package not ready. Complete the requirements before accepting; otherwise opening doors is refused.';
}

function sanitationDetails(s, minute) {
  const t = s.totals;
  const worker = !s.terms.cleaner ? 'Not hired' : s.worker ? `Stall ${s.worker.stall + 1} · ${s.worker.completesAt - Math.min(minute, D.LIVE_SERVICES.closeAt)}m left` : 'No cleaning in progress';
  return `<dl class="live-readouts"><div><dt>Usable / dirty stalls</dt><dd>${t.usableStalls} / ${t.dirtyStalls}</dd></div>
    <div><dt>Waiting / in use</dt><dd>${t.waiting} / ${t.using}</dd></div><div><dt>Served / missed visits</dt><dd>${t.served} / ${t.lost}</dd></div>
    <div><dt>Completed cleanings</dt><dd>${t.cleanings}</dd></div><div><dt>Cleaner</dt><dd>${worker}</dd></div>
    <div><dt>Trailer / cleaner / utilities</dt><dd>${money(s.charges.trailer)} / ${money(s.charges.cleaner)} / ${money(s.charges.utilities)}</dd></div>
    <div><dt>Paid portables / package</dt><dd>${money(s.placedPortables * D.RESTROOM_UNIT)} / ${money(s.cost)}</dd></div><div><dt>Changing area preference</dt><dd>${!s.preference.accepted ? 'Declined · no penalty' : s.preference.fulfilled ? 'Fulfilled · up to +2 relationship' : 'Unfulfilled · no benefit'}</dd></div></dl>
    <p class="hint">Purple guests are waiting or using facilities. Eight-minute patience; missed visits reduce amenities, not attendance. Costs were paid before doors. Normal departure still follows closing.</p>`;
}

function foodDetails(food) {
  const t = food.totals;
  return `<dl class="live-readouts"><div><dt>Plan / stock left</dt><dd>${esc(food.terms.plan)} / ${food.stock}</dd></div>
    <div><dt>Food requests</dt><dd>${t.requested}</dd></div><div><dt>Waiting / served / lost</dt><dd>${t.waiting} / ${t.served} / ${t.lost}</dd></div>
    <div><dt>Price / budget declined</dt><dd>${t.declinedPrice} / ${t.declinedBudget}</dd></div>
    <div><dt>Vendor gross sales</dt><dd>${money(t.vendorGross)}</dd></div><div><dt>House income (25%)</dt><dd>${money(t.houseIncome)}</dd></div>
    <div><dt>Vendor stock / wages</dt><dd>${money(t.inventoryCost)} / ${money(t.wages)}</dd></div><div><dt>Vendor profit</dt><dd>${money(t.vendorProfit)}</dd></div></dl>
    <p class="hint">Only the house share reaches career cash, once at settlement. Green guests are waiting for food. Six-minute patience; stock and closing limit sales.</p>`;
}

function liveServicesPanel() {
  return `
    <div class="plate at-tl card-plate">
      <p class="eyebrow">Live services · ${esc(venueSpec(state.venue).name)}</p>
      <h2>Run the show</h2><p class="timecode" id="clock" aria-label="Show clock"></p>
      <p class="show-status" id="show-status"></p><p id="msg" class="message" aria-live="polite"></p>
    </div>
    <div class="plate at-tr incident-plate" id="incident-box" data-tab="Problem" hidden></div>
    <div class="plate at-bl status-plate" data-tab="Services">
      <div class="food-heading"><h3 id="live-heading">Service pressure</h3>${state.show.food ? '<button type="button" data-act="food-receipt">Food</button>' : ''}${state.show.sanitation ? '<button type="button" data-act="sanitation-receipt">Facilities</button>' : ''}</div><dl class="live-readouts" id="live-queues"></dl>
      <p class="hint" id="live-hint">Wait estimates use current staffing; new arrivals can change them.</p>
      <p class="hint" id="live-money"></p>
    </div>
    <div class="plate at-br actions-plate live-controls" data-tab="Controls">
      <p class="hint" id="live-worker" aria-live="polite"></p>
      <div class="row"><button data-act="live-worker" data-station="gate">Help admission</button><button data-act="live-worker" data-station="bar">Return to bar</button></div>
      <div class="row"><button data-act="live-play" id="live-play">Play</button><button data-act="live-step">+5 min</button><button data-act="live-next">Next event</button></div>
      <label>Clock speed <select id="live-speed" data-input="live-speed"><option value="1">1×</option><option value="4">4×</option><option value="12">12×</option></select></label>
      <p class="hint"><span id="crowd-now">0</span> <span id="crowd-label">admitted</span> · samples ≤180.</p>
      <button data-act="locate-incident" id="locate-incident" hidden>Locate equipment</button>
    </div>`;
}

function updateLiveServices() {
  ui.services = liveServicesFor(state, { events: true });
  const r = ui.services, play = ui.play;
  if (!r || !play) return;
  $('#live-hint').hidden = !!(r.food || r.sanitation);
  if (win.kind === 'food-receipt' && r.food) el.winBody.innerHTML = foodDetails(r.food);
  if (win.kind === 'sanitation-receipt' && r.sanitation) el.winBody.innerHTML = sanitationDetails(r.sanitation, r.minute);
  play.p = r.minute / D.LIVE_SERVICES.closeAt;
  $('#clock').textContent = clock(play.p);
  $('#show-status').textContent = r.departure?.active ? `${play.paused ? 'Paused' : 'Running'} · ${r.inside} inside · ${r.departed} departed` : `${play.paused ? 'Paused' : 'Running'} · ${r.admitted} admitted · ${r.abandoned} left the queue`;
  const row = (name, v) => `<div><dt>${name}</dt><dd>${v}</dd></div>`;
  const queue = q => `${q.waiting} queued · oldest ${q.oldestWait}m`;
  const wait = q => q.estimatedMinutes === null ? 'unavailable' : q.estimatedMinutes + 'm';
  $('#live-queues').innerHTML = row('Admission', queue(r.gate)) + row('Bar', queue(r.bar)) + row('Rate per minute', `Gate ${r.gate.rate} · Bar ${r.bar.rate}`) + row('Wait estimate', `Gate ${wait(r.gate)} · Bar ${wait(r.bar)}`) + row('Bar requests', `${r.barServed} served · ${r.barLost} lost`);
  $('#live-heading').textContent = r.departure?.active ? 'Normal departure' : 'Service pressure';
  $('#live-hint').textContent = r.departure?.active ? 'Service is closed. Guests leave through connected exits; receipts are unchanged.' : 'Wait estimates use current staffing; new arrivals can change them.';
  if (r.departure?.active) $('#live-queues').innerHTML = row('Still inside', r.inside) + row('Departed', r.departed) + row('Usable exits', r.departure.exits) + row('Per minute', r.departure.rate) + row('Time remaining', r.departure.blocked ? 'Route blocked' : `${r.departure.duration - r.departure.minute}m`);
  $('#live-money').textContent = `Held ticket receipts ${money(r.ticketCash)} (refunds ${money(r.refunds)}) · Bar ${money(r.barCash)}. Paid to the career at settlement.`;
  $('#live-worker').textContent = r.departure?.active ? 'Service staff are finished. Connected exits set the departure rate.' : r.worker.destination ? `Travelling to ${r.worker.destination === 'gate' ? 'admission' : 'the bar'} · ${r.worker.arrivesAt - r.minute}m left. No service in transit.` : `Worker at ${r.worker.station === 'gate' ? 'admission' : 'the bar'} · transfer takes ${D.LIVE_SERVICES.travelMinutes}m.`;
  for (const b of el.panel.querySelectorAll('[data-act="live-worker"]')) b.disabled = r.serviceClosed || !!r.worker.destination || b.dataset.station === r.worker.station;
  $('[data-act="live-worker"]').parentElement.hidden = !!r.serviceClosed;
  if (r.departure?.active) $('#locate-incident').hidden = true;
  const waiting = !state.show.responseId && r.minute >= liveIncidentMinute(state);
  $('#live-play').textContent = play.paused ? 'Play' : 'Pause';
  $('[data-act="live-next"]').textContent = r.departure?.active ? 'Finish departure' : state.show.responseId ? 'Close show' : 'Next event';
  for (const b of el.panel.querySelectorAll('[data-act="live-play"], [data-act="live-step"], [data-act="live-next"]')) b.disabled = waiting;
  $('#live-speed').value = String(play.speed);
  $('#crowd-now').textContent = r.inside ?? r.admitted;
  $('#crowd-label').textContent = r.departure ? 'inside' : 'admitted';
  if (state.show.serviceRecovered) say('Recovered an invalid service timeline. Paid costs and career cash were retained.', 'error');
  if (waiting && $('#incident-box').hidden) { play.paused = false; reachIncident(); }
}

function stepLive(minute) {
  const play = ui.play;
  if (!play?.live || state.phase !== 'show') return;
  act({ type: 'advanceLive', minute: Math.min(liveEndMinute(state), minute) }, { quiet: true });
  if (state.phase === 'show' && !state.show.responseId && ui.services.minute >= liveIncidentMinute(state)) {
    play.paused = true;
    $('#live-play').textContent = 'Play';
  }
}

// The feed keeps its last four lines on screen.
const FEED_LINES = 4;

function feedLine(text) {
  const feed = $('#feed');
  if (!feed) return;
  const li = document.createElement('li');
  li.textContent = text;
  feed.appendChild(li);
  while (feed.children.length > FEED_LINES) feed.firstElementChild.remove();
}

function clock(p) {
  const minutes = 19 * 60 + Math.round(p * 240);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function startPlayback() {
  stopPlayback();
  if (state.show.services) {
    ui.play = { live: true, paused: true, p: state.show.services.minute / D.LIVE_SERVICES.closeAt,
      at: liveIncidentMinute(state) / D.LIVE_SERVICES.closeAt, speed: 1, last: performance.now() };
    updateLiveServices();
    return;
  }
  // Each night of a run rolls from its own seed, as incidentFor does (R-11a).
  const night = state.show && state.show.night > 1 ? state.show.night : 1;
  const roll = rollShow(night > 1 ? ((state.seed ^ night) >>> 0) : state.seed, state.booking.artistId);
  const preview = showPreview(state);
  // The incident shown is the room's (incidentFor), so time it by that incident's window.
  const at = state.show ? incidentAtFor(state.show.incidentId, roll.timing) : roll.incidentAt;
  ui.play = { start: performance.now(), at, p: 0, beats: 0, preview: preview.attendance, after: null };
  $('#show-status').textContent = `Crowd outlook ${preview.satisfaction}/100 · before incidents`;
  feedLine(`Doors open. ${preview.presale} people already hold tickets.`);
  if (state.show && state.show.pilotCrew === null) { reachDoorsChoice(); return; }
  if (state.show && (state.show.pilotCrew === 'bar' || state.show.pilotCrew === 'gate')) {
    const r = preview.doorRush;
    const rush = $('#rush-now');
    if (rush && r) { rush.hidden = false; rush.textContent = `Projected rush: ${r.waiting} queued · ${r.lostWalkups} leave · Bar cap: ${r.barCapacity}`; }
  }
  if (reduceMotion) {
    ui.play.p = at;
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
    ui.play.p = ui.play.end ?? 1;
  }
}

function loop() {
  ui.raf = requestAnimationFrame(() => {
    const play = ui.play;
    if (!play) return;
    if (play.live) {
      if (state.phase === 'show' && !play.paused) {
        const now = performance.now(), minutes = Math.floor((now - play.last) * play.speed / 1000);
        if (minutes > 0) { play.last += minutes * 1000 / play.speed; stepLive(ui.services.minute + minutes); }
      }
      draw();
      if (state.phase === 'show' && !play.paused) loop();
      return;
    }
    if (state.phase === 'show' && !play.paused) {
      play.p = Math.min(play.at, (performance.now() - play.start) / 1000 / PLAY_SECONDS);
      const beats = [[0.15, 'Walk-up is buying at the gate.'], [D.ACT_ON_STAGE_AT, `${artistFor(state.booking.artistId).name} take the stage.`]];
      while (play.beats < beats.length && play.p >= beats[play.beats][0]) { feedLine(beats[play.beats][1]); play.beats += 1; }
      const c = $('#clock'); if (c) c.textContent = clock(play.p);
      if (play.p >= play.at) reachIncident();
    }
    if (play.after) {
      const k = Math.min(1, (performance.now() - play.after.start) / 1000 / AFTER_SECONDS);
      play.p = play.at + ((play.end ?? 1) - play.at) * k;
      play.after.progress = k;
      if (k >= 1) play.after.done = true;
    }
    draw();
    if (state.phase === 'show' || (play.after && !play.after.done)) loop();
    else ui.raf = 0;
  });
}

function reachDoorsChoice() {
  const play = ui.play;
  play.paused = true;
  $('#show-status').textContent = 'Paused · choose the doors crew';
  setSheetSize('peek');
  const v = evaluateVenue(state.venue);
  const preview = showPreview(state);
  const keep = doorRushPilot(v, preview.attendance, preview.presale, 'bar');
  const move = doorRushPilot(v, preview.attendance, preview.presale, 'gate');
  const box = $('#incident-box');
  box.innerHTML = `
    <div class="incident" role="group" aria-labelledby="incident-title">
      <h3 id="incident-title">Doors rush: where should one bar worker go?</h3>
      <p>Projected rush, before an incident: ticket holders wait, while some walk-ups leave a long line.</p>
      <button type="button" class="choice" data-act="choose-crew" data-choice="bar">
        <span class="choice-head"><strong>Keep bar service</strong><span class="cost">free</span></span>
        <span class="choice-effect">${keep.waiting} waiting; ${keep.lostWalkups} walk-ups leave · bar serves up to ${keep.barCapacity}</span>
      </button>
      <button type="button" class="choice" data-act="choose-crew" data-choice="gate">
        <span class="choice-head"><strong>Help at admission</strong><span class="cost">free</span></span>
        <span class="choice-effect">${move.waiting} waiting; ${move.lostWalkups} walk-ups leave · bar serves up to ${move.barCapacity}</span>
      </button>
    </div>`;
  box.hidden = false;
  syncTabs(el.panel, 'show', 'Problem');
  const skip = $('#skip-btn'); if (skip) skip.hidden = true;
  box.querySelector('[data-act="choose-crew"]').focus();
  draw();
}

function chooseDoorCrew(choice) {
  const play = ui.play;
  if (!play || !act({ type: 'chooseDoorCrew', choice })) return;
  const r = showPreview(state).doorRush;
  play.preview = showPreview(state).attendance;
  $('#show-status').textContent = `Crowd outlook ${showPreview(state).satisfaction}/100 · before incidents`;
  feedLine(`Projected doors rush: ${r.waiting} in line after ${D.LOT_PILOT_RUSH_MINUTES} minutes; ${r.lostWalkups} walk-ups may leave. Bar can serve ${r.barCapacity}.`);
  const box = $('#incident-box'); if (box) box.hidden = true;
  const rush = $('#rush-now');
  if (rush) { rush.hidden = false; rush.textContent = `Projected rush: ${r.waiting} queued · ${r.lostWalkups} leave · Bar cap: ${r.barCapacity}`; }
  syncTabs(el.panel, 'show', 'Night');
  play.paused = false;
  const skip = $('#skip-btn'); if (skip) { skip.hidden = false; skip.focus(); }
  if (reduceMotion) { play.p = play.at; reachIncident(); }
  else { play.start = performance.now(); loop(); }
}

function reachIncident() {
  const play = ui.play;
  if (play.paused) return;
  play.paused = true;
  $('#show-status').textContent = 'Paused · incident response needed';
  setSheetSize('peek');
  const c = $('#clock'); if (c) c.textContent = clock(play.p);
  const id = state.show.incidentId;
  const incident = D.INCIDENTS[id];
  feedLine(`${clock(play.p)}: ${incident.label}.`);
  const effect = (r) => {
    const bits = [];
    const time = id === 'curfew' ? setTimeFor(state, r.id) : null;
    if (time) bits.push(`Ends ${clock(time.end / 240)}`);
    else if (r.walkupMult !== undefined) bits.push(`walk-ups ${Math.round(r.walkupMult * 100)}%`);
    if (r.flowMult !== undefined) bits.push(`entry flow ${Math.round(r.flowMult * 100)}%`);
    bits.unshift(RESPONSE_TEXT[id]?.[r.id] || 'Respond to the incident.');
    if (id === 'pa-dropout' && r.id === 'backup-amp' && researchEffectsFor(state).patchScore) bits.push('Patch standards: 95% response');
    return bits.join(' · ');
  };
  const box = $('#incident-box');
  box.innerHTML = `
    <div class="incident" role="group" aria-labelledby="incident-title">
      <h3 id="incident-title">${esc(incident.label)}</h3>
      <p>${esc(INCIDENT_TEXT[id] || incident.label)}</p>
      ${incident.responses.map((r) => `
        <button type="button" class="choice" data-act="respond" data-response="${r.id}" ${r.cost > state.cash ? 'disabled' : ''}>
          <span class="choice-head"><strong>${esc(r.label)}</strong> <span class="cost">${r.cost ? money(r.cost) : 'free'}${r.cost > state.cash ? ' · not enough cash' : ''}</span></span>
          <span class="choice-effect">${effect(r)}</span>
        </button>`).join('')}
    </div>`;
  // Rain affects the whole venue; the other incidents have a specific piece of equipment.
  const affected = incidentObject();
  const locate = $('#locate-incident');
  locate.hidden = !affected;
  locate.textContent = id === 'pa-dropout' ? 'Locate PA' : id === 'gate-jam' ? 'Locate gate' : 'Locate stage';
  box.hidden = false;
  syncTabs(el.panel, 'show', 'Problem');
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

function incidentObject() {
  const id = state.show?.incidentId;
  const types = id === 'pa-dropout' ? ['pa-s', 'pa-m'] : id === 'gate-jam' ? ['gate'] : id === 'curfew' ? ['stage'] : [];
  return state.venue.objects.find((o) => types.includes(o.type))
    || (id === 'pa-dropout' && venueSpec(state.venue).housePa ? state.venue.objects.find((o) => o.type === 'stage') : null);
}

function locateIncident() {
  const object = incidentObject();
  if (!object || state.phase !== 'show' || !ui.play?.paused) return;
  const t = D.OBJECT_TYPES[object.type];
  board.centerOn(object.x + t.w / 2, object.y + t.h / 2);
  updateZoomButtons();
  el.boardStatus.textContent = `${label(object.type)} at ${object.x}, ${object.y}. Incident response still required.`;
}

function respond(responseId) {
  const play = ui.play;
  if (!act({ type: 'respond', responseId })) return;
  stopPlayback();
  if (play?.live) {
    play.paused = true;
    const box = $('#incident-box'); if (box) box.hidden = true;
    if (state.phase === 'show') { syncTabs(el.panel, 'show', 'Controls'); updateLiveServices(); $('#live-play').focus(); }
    return;
  }
  if (play) play.end = (setTimeFor(state)?.end ?? 240) / 240;
  if (play && !reduceMotion) {
    play.after = { start: performance.now(), done: false, progress: 0 };
    loop();
  } else if (play) {
    play.p = play.end ?? 1;
  }
  focusHeading();
}

// ---------------------------------------------------------------------------
// Settle and done

// The settlement sheet in three columns (revenue and the deal; costs; the crowd and what
// carries over), with the stamp and the tip kept apart for the window's footer.
function sheetParts(r, { signed: done }) {
  const a = artistFor(state.booking.artistId);
  const v = evaluateVenue(state.venue);
  const deal = state.booking.deal;
  const response = findResponse(state.show.incidentId, state.show.responseId);
  const incident = D.INCIDENTS[state.show.incidentId];
  const cashAfter = done ? (state.history.at(-1)?.cashAfter ?? state.cash) : state.cash + settlementPayout(r, deal);
  const cashBefore = cashAfter - r.net + (done && state.show?.cancelled ? heldRunFor(state).penalty : 0);
  const cost = (n) => `<td class="num neg">${money(-n)}</td>`;
  const rows = [
    ['Lot lease and permit', 'Site', r.costs.lot + r.costs.permit],
    ['Fence kit', 'Site', r.costs.fence],
    ...(r.costs.vipDeck ? [['VIP deck', 'Touring', r.costs.vipDeck]] : []),
    ...(r.costs.busCompound ? [['Bus compound', 'Touring', r.costs.busCompound]] : []),
    r.equipment ? ['Owned PA operation', 'Audio', r.costs.equipmentOperation] : [`PA rental (${v.paTier === 'M' ? 'medium' : 'small'})`, 'Audio', r.costs.pa],
    ['Light tower', 'Lighting', r.costs.lights],
    ...(r.costs.delays ? [[`Delays + operators (${v.delays})`, 'Main stage', r.costs.delays]] : []),
    [`Bars (${v.bars})`, 'Hospitality', r.costs.bars],
    r.facilities ? ['Facilities', 'Sanitation', r.costs.restrooms + r.costs.facilities] : [`Restrooms (${v.restrooms})`, 'Site', r.costs.restrooms],
    [`Crew (${v.staff} staff)`, 'Labour', r.costs.staff],
    ...(r.stageAccounts ? [['Main production crew (2)', 'Main stage', r.costs.mainCrew], ['Side PA, lights and crew', 'Side stage', r.costs.secondProduction]] : []),
    ['Ads', 'Promotion', r.costs.ads],
    [`Incident: ${response.label}`, incident.label, r.costs.incident],
  ];
  const pool = r.stageAccounts ? r.stageAccounts.main.artistBasis : r.ticketGross - r.costs.total;
  const split = deal === 'door'
    ? `<p>${r.stageAccounts ? `Main stage eligible ticket balance: <strong>${money(pool)}</strong>` : `Net ticket pool: ${money(r.ticketGross)} ticket gross − ${money(r.costs.total)} show costs = <strong>${money(Math.max(0, pool))}</strong>${pool < 0 ? ' (nothing to split)' : ''}`}</p>
       <p>Artist share: ${Math.round(D.DOOR_SPLIT * 100)}% of the pool = <strong>${money(r.artistPay)}</strong></p>`
    : `<p>Flat guarantee: <strong>${money(r.artistPay)}</strong>, paid before doors.</p>`;
  const parts = Object.keys(WEIGHTS).map((k) => {
    const pct = Math.round(r.parts[k] * 100);
    return `<div class="sat-row"><span>${PART_LABELS[k]}</span><span class="bar" aria-hidden="true"><span style="width:${pct}%"></span></span><span class="num">${pct}%</span></div>`;
  }).join('');
  const pass = r.result === 'pass';
  const tip = r.net < 0
    ? 'The night lost money. Try a door deal, a different ticket price, or fewer rentals.'
    : r.weakest === 'sound' && roomProfileFor(state.venue)
      ? 'Use the included house system and lights. A placed portable PA replaces the house sound capacity.' : TIPS[r.weakest];
  const head = `
    <div class="sheet-head"><span><span class="live" aria-hidden="true"></span>SHOW SETTLEMENT · SHOW ${String(state.history.length + (done ? 0 : 1)).padStart(3, '0')}</span><span>${r.setTime || state.curfewNotice ? `<button class="receipt-link" data-act="set-time">${r.setTime ? `${clock(r.setTime.end / D.SET_SCHEDULE.close)} SET ENDED` : 'SET TIME UNAVAILABLE'}</button>` : `${clock(1)} CURFEW`}</span></div>
    <div class="meta-strip">
      <div><span class="meta-label">Headliner</span><span class="meta-val">${esc(a.name)}</span></div>
      <div><span class="meta-label">Venue</span><span class="meta-val">${esc(venueSpec(state.venue).name)}</span></div>
      <div><span class="meta-label">Deal</span><span class="meta-val hl">${deal === 'door' ? `Door (${Math.round(D.DOOR_SPLIT * 100)}%)` : deal === 'sponsor' ? 'Sponsor' : 'Guarantee'}</span></div>
      <div><span class="meta-label">Attendance</span><span class="meta-val">${r.attendance} / ${v.capacity}</span></div>
      <div><span class="meta-label">Satisfaction</span><span class="meta-val score">${r.satisfaction}/100</span></div>
    </div>`;
  const serviceReceipts = r.services ? `<p class="hint">Prepaid ${money(r.services.prepaidCash)} + walk-ups ${money(r.services.walkupCash)} − refunds ${money(r.services.refunds)} = ${money(r.ticketGross)} ticket receipts. ${r.services.cancelledWalkups} future walk-ups cancelled; ${r.services.abandoned} guests left admission.</p>` : '';
  const revenue = `
    <div class="ledger">
      <div class="ledger-title">SECTION A · GROSS REVENUE</div>
      <table>
        <thead><tr><th scope="col">Source</th><th scope="col">Units</th><th scope="col" class="num">Total</th></tr></thead>
        <tbody>
          <tr><td>${r.stageAccounts ? '<button class="receipt-link" data-act="stages-open">Site tickets</button>' : r.seating ? '<button class="receipt-link" data-act="seating-open">Seats and lawn</button>' : 'Tickets (presale and gate)'}</td><td>${r.seated ? `${r.seated} seats × ${money(r.seatPrice)}, ${r.attendance - r.seated} lawn × ${money(r.stageAccounts?.sales.price ?? r.seating?.lawn.price ?? state.promotion.price)}` : `${r.attendance} × ${money(r.stageAccounts?.sales.price ?? r.seating?.lawn.price ?? state.promotion.price)}`}</td><td class="num pos">${money(r.ticketGross)}</td></tr>
          ${r.ticketing ? `<tr><td><button class="receipt-link" data-act="ticketing-open">Ticket collection</button></td><td>${r.ticketing.terms.plan === 'platform' ? '4% of presales' : 'Direct'}</td><td class="num neg">${money(-r.ticketing.fee)}</td></tr>` : ''}
          <tr><td>Bar</td><td>${r.services ? `${r.services.barServed} served · ${r.services.barLost} lost` : `${r.attendance} guests`}</td><td class="num pos">${money(r.bar)}</td></tr>
          ${r.sponsor ? `<tr><td>Sponsor</td><td>Site deal</td><td class="num pos">${money(r.sponsor)}</td></tr>` : ''}
          ${r.broadcast ? `<tr><td>Broadcast</td><td>${r.attendance} viewers</td><td class="num pos">${money(r.broadcast)}</td></tr>` : ''}
          ${r.second ? `<tr><td>${esc(r.second.name)} (second stage)</td><td>${r.second.attendance} people</td><td class="num pos">${money(r.second.cash)}</td></tr>` : ''}
          ${r.food ? `<tr><td><button class="receipt-link" data-act="food-receipt">Food</button></td><td>25% house share</td><td class="num pos">${money(r.foodIncome)}</td></tr>` : '<tr class="faint"><td>Merch</td><td>No merch tent yet</td><td class="num">$0</td></tr>'}
        </tbody>
        <tfoot><tr><td colspan="2">${r.ticketing ? 'After collection' : 'Total revenue'}</td><td class="num pos">${money(r.ticketGross + r.bar + (r.foodIncome || 0) + (r.sponsor || 0) + (r.broadcast || 0) + (r.second ? r.second.cash : 0) - (r.ticketing?.fee || 0))}</td></tr></tfoot>
      </table>
    </div>`;
  const productionCategory = category => ['Audio','Lighting','Main stage','Side stage'].includes(category);
  const costs = `
    <div class="ledger">
      <div class="ledger-title">SECTION B · PRODUCTION AND SITE COSTS</div>
      ${(r.costs.delays || r.costs.vipDeck || r.costs.busCompound) ? '<div class="actions" role="group" aria-label="Cost categories"><button data-act="cost-page" data-cost="site" aria-pressed="true">Site</button><button data-act="cost-page" data-cost="production" aria-pressed="false">Production</button>' + ((r.costs.vipDeck || r.costs.busCompound) ? '<button data-act="cost-page" data-cost="touring" aria-pressed="false">Rider</button>' : '') + '</div>' : ''}
      <table>
        <thead><tr><th scope="col">Line</th><th scope="col">Category</th><th scope="col" class="num">Total</th></tr></thead>
        <tbody>${rows.filter((row) => row[2] > 0).map((row) => `<tr${(r.costs.delays || r.costs.vipDeck || r.costs.busCompound) ? ` data-cost-group="${row[1] === 'Touring' ? 'touring' : productionCategory(row[1]) ? 'production' : 'site'}"${productionCategory(row[1]) || row[1] === 'Touring' ? ' hidden' : ''}` : ''}><td>${row[0] === 'Facilities' ? '<button class="receipt-link" data-act="sanitation-receipt">Facilities</button>' : esc(row[0])}</td><td>${esc(row[1])}</td>${cost(row[2])}</tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="2">Total show costs</td>${cost(r.costs.total)}</tr></tfoot>
      </table>
    </div>`;
  const dealPart = `
    <div class="calc">
      <div class="ledger-title" style="padding:0;background:none;border:0">SECTION C · DEAL</div>
      ${split}${r.stageAccounts ? `<p>Side artist: ${money(r.stageAccounts.second.artistPay)}, withheld at signing.</p><button data-act="stages-open">Stage accounts</button>` : ''}
    </div>`;
  const payouts = `
    <div class="payouts" data-tab="Payout">
      <div class="payout artist"><span class="meta-label">${r.stageAccounts ? 'Both artist payouts' : 'Artist payout'}</span><span class="amount">${money(r.artistTotal ?? r.artistPay)}</span>
        <p>${r.stageAccounts ? `Main ${money(r.artistPay)} · Side ${money(r.stageAccounts.second.artistPay)}` : r.artistPay >= quotedAsk() ? 'Paid in full. The act leaves happy.' : `They expected ${money(quotedAsk())}.`}</p></div>
      <div class="payout promoter ${r.net < 0 ? 'loss' : ''}"><span class="meta-label">Promoter net</span><span class="amount">${money(r.net)}</span>
        <p>${r.doorRush ? `${r.doorRush.waiting} queued · ${r.doorRush.lostWalkups} left · bar cap ${r.doorRush.barCapacity}.` : 'Revenue after every cost and the artist.'}</p></div>
    </div>`;
  const crowd = `
    <div data-tab="Crowd">
      <h3>Crowd satisfaction ${r.satisfaction}/100</h3>
      <div class="meters-sat">${parts}</div>${r.seating ? `<p class="hint">Shared quality ${r.seating.sharedSatisfaction}/100. Seat value ${r.seating.scores.seats}; lawn value ${r.seating.scores.lawn}. Attendance weights the final score.</p>` : ''}${serviceReceipts}
    </div>
    <div class="outcomes" data-tab="Payout">
      <div class="outcome"><span class="meta-label">Venue reputation</span><span class="stat ${r.repDelta >= 0 ? 'pos' : 'neg'}">${signed(r.repDelta)}</span></div>
      <div class="outcome"><span class="meta-label">Band relationship</span><span class="stat ${r.relDelta >= 0 ? 'pos' : 'neg'}">${signed(r.relDelta)}</span></div>
      <div class="outcome"><span class="meta-label">${done && state.history.at(-1)?.cashAfter !== undefined ? 'Cash after signing' : 'Cash on hand'}</span><span class="stat">${money(cashAfter)}</span><p class="lede">${done && state.history.at(-1)?.cashAfter === undefined ? 'Historical cash not recorded' : `Started at ${money(cashBefore)}`}</p></div>
    </div>`;
  return {
    body: `${head}
      <div class="sheet-cols">
        ${r.services || r.ticketing || r.seating || r.stageAccounts ? `<div class="sheet-col"><div data-tab="Revenue">${revenue}</div><div data-tab="Deal">${dealPart}</div></div>` : `<div class="sheet-col" data-tab="Revenue">${revenue}${dealPart}</div>`}
        <div class="sheet-col" data-tab="Costs">${costs}</div>
        <div class="sheet-col">${payouts}${crowd}</div>
      </div>`,
    foot: `
      <span class="stamp ${pass ? 'pass' : 'retry'}">${pass ? 'Show settled' : 'Retry'}<small>${pass ? 'In the black, crowd happy' : r.net < 0 ? 'Net negative' : 'Crowd below 60'}</small></span>
      <p class="tip"><strong>${pass ? 'For next time:' : 'Why it missed:'}</strong> ${esc(tip)}</p>`,
  };
}

function setTimeHtml(time) {
  const field = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  if (!time) return `<p role="status">${esc(state.curfewNotice || 'Original set rules apply.')}</p><button data-act="food-back">Back to settlement</button>`;
  return `<section data-tab="Time"><h3>Set time</h3><dl class="live-readouts">${field('Started',clock(time.start / 240))}${field('Ended',clock(time.end / 240))}${field('Played',`${time.played} minutes`)}${field('Lost',`${time.lost} minutes`)}</dl><p>Planned end 23:00.</p><p>Walk-ups use elapsed admission time.</p><p>Bar income uses the played set share.</p><p>Presales and guarantees stay paid.</p>${state.curfewNotice ? `<p role="status">${esc(state.curfewNotice)}</p>` : ''}<button data-act="food-back">Back to settlement</button></section>`;
}

// The settlement window: the sheet, with the stamp, the tip and the signature in its footer
// (docs/HUD.md decision 9). Signed, it is the read-only copy the Done screen reopens.
function openSettlement(opener, { signed: done = false } = {}) {
  const r = settlementFor(state);
  if (!r) return;
  const { body, foot } = sheetParts(r, { signed: done });
  const run = heldRunFor(state);
  const action = !done && run?.remaining ? '<button type="button" class="primary" data-act="held-run-open">Choose next night</button>'
    : done ? (state.show?.cancelled ? '<button data-act="held-run-open">Cancellation receipt</button>' : '') : '<button type="button" class="primary" data-act="accept">Sign the settlement</button>';
  openWindow('settlement', done ? 'Last settlement' : 'Settlement', body, opener, {
    wide: true,
    foot: `${foot}${action}`,
  });
}

// The Settle sheet is a short summary; the sheet itself opens in its own window.
function settlePanel() {
  const r = settlementFor(state);
  return `
    <p class="eyebrow">${r.setTime ? `Set ended ${clock(r.setTime.end / 240)}` : 'Curfew'} · ${esc(venueSpec(state.venue).name)}</p>
    <h2>Settlement</h2>
    <p id="msg" class="message" aria-live="polite"></p>
    <p class="lede">${r.attendance} people came. The promoter's net is <strong class="${r.net < 0 ? 'neg' : 'pos'}">${money(r.net)}</strong>.</p>
    <div class="actions"><button type="button" class="primary" data-act="open-settlement" id="open-settlement">Open the settlement</button></div>`;
}

function careerHtml() {
  const p = careerProgress(state);
  const spec = venueSpec(state.venue);
  const row = (ok, text) => `<li class="${ok ? 'met' : ''}"><span aria-hidden="true">${ok ? '✓' : '○'}</span> ${text}</li>`;
  const club = p.tier.club;
  const amp = p.tier.amphitheater;
  const fest = p.tier.festival;
  const clubName = D.VENUES.club.name;
  const ampName = D.VENUES.amphitheater.name;
  const festName = D.VENUES.festival.name;
  const block = spec.id === 'club'
    ? `${row(club.sellouts >= club.goal.sellouts, `Sell out ${clubName} (${D.VENUES.club.permit}): ${club.sellouts}`)}
       ${row(p.venueRep >= club.goal.venueRep, `Reputation ${club.goal.venueRep}: now ${p.venueRep}`)}
       ${row(p.cash >= club.goal.cash, `${money(club.goal.cash)} banked: ${money(p.cash)}`)}
       ${row(club.loyalAct >= club.goal.loyalAct, `A hall act at +${club.goal.loyalAct}: best ${signed(club.loyalAct)}`)}`
    : spec.id === 'amphitheater'
      ? `${row(amp.sellouts >= amp.goal.sellouts, `Sell out ${ampName} (${D.VENUES.amphitheater.permit}): ${amp.sellouts}`)}
         ${row(p.venueRep >= amp.goal.venueRep, `Reputation ${amp.goal.venueRep}: now ${p.venueRep}`)}
         ${row(p.cash >= amp.goal.cash, `${money(amp.goal.cash)} banked: ${money(p.cash)}`)}
         ${row(amp.loyalAct >= amp.goal.loyalAct, `A shell act at +${amp.goal.loyalAct}: best ${signed(amp.loyalAct)}`)}`
      : spec.id === 'festival'
        ? `${row(fest.attendance >= fest.goal.attendance, `A day of ${fest.goal.attendance}: best ${fest.attendance}`)}
           ${row(p.cash >= fest.goal.cash, `${money(fest.goal.cash)} banked: ${money(p.cash)}`)}
           ${row(fest.loyalAct >= fest.goal.loyalAct, `A grounds act at +${fest.goal.loyalAct}: best ${signed(fest.loyalAct)}`)}`
        : `${row(p.met.sellouts, `Sell out the Lot (${D.PERMIT_CAP} people): ${p.sellouts} so far`)}
           ${row(p.met.venueRep, `Venue reputation ${D.LOT_GOAL.venueRep}: now ${p.venueRep}`)}
           ${row(p.met.cash, `${money(D.LOT_GOAL.cash)} in the bank: now ${money(p.cash)}`)}
           ${row(p.met.loyalAct, `An act that trusts you (relationship +${D.LOT_GOAL.loyalAct}): best is ${signed(p.loyalAct)}`)}`;
  const title = p.complete ? 'The career is complete' : p.festivalUnlocked ? `${festName} is open` : p.amphitheaterUnlocked ? `${ampName} is open` : p.clubUnlocked ? `${clubName} is open` : `Goal: unlock ${clubName}`;
  return `
    <section class="card career" aria-labelledby="career-title">
      <p class="eyebrow">Tier ${spec.tier} · ${esc(spec.name)}</p>
      <h3 id="career-title">${title}</h3>
      <ul class="goal">${block}</ul>
      <p class="hint">${p.clubUnlocked ? 'Book the next show, then pick the room on the Book screen.' : 'A guarantee builds trust. A door deal builds more when the share beats the ask.'}</p>
    </section>`;
}

function donePanel() {
  const last = state.history[state.history.length - 1];
  const r = settlementFor(state);
  const pass = last && last.result === 'pass';
  const p = careerProgress(state);
  const needsVenue = state.venue.id === 'festival' && !stageOpenersFor(state).length;
  const next = needsVenue
    ? '<button type="button" class="primary" data-act="next">Choose another venue</button>'
    : p.canAffordAShow
    ? '<button type="button" class="primary" data-act="next">Book the next show</button>'
    : `<button type="button" class="primary" disabled>Book the next show</button>`;
  const result = last ? `Show ${last.showId}${last.night > 1 ? ` night ${last.night}` : ''}: ${last.deal === 'door' ? 'door deal' : last.deal === 'sponsor' ? 'sponsor' : 'guarantee'} · ${last.attendance} people · net ${money(last.net)} · ${last.result === 'pass' ? 'pass' : 'retry'}` : '';
  return `
    <h2>${pass ? `A good night at ${esc(venueSpec(state.venue).name)}` : 'A rough night'}</h2>
    <p id="msg" class="message" aria-live="polite"></p>
    <p class="lede">${needsVenue ? 'No side act accepts a door deal. Return to booking and choose another venue; cash and history carry over.' : pass
      ? 'The show made money and kept the crowd happy. Cash, reputation and every relationship carry into the next show.'
      : p.canAffordAShow
        ? 'The night lost money or left the crowd unhappy. The career goes on: cash, reputation and relationships carry over.'
        : `Basic next show, no ads: ${money(p.nextShowCost)}. Cash: ${money(state.cash)}. Kept rentals can cost more. Start over to try again.`}</p>
    <div class="actions">
      <button type="button" data-act="retry">Start over</button>${next}
    </div>
    ${careerHtml()}
    ${result ? `<p class="result-line">${esc(result)}</p>` : ''}
    <div class="row tight">
      <button type="button" data-act="last-sheet" ${r ? '' : 'disabled'}>Last settlement</button>
      <button type="button" data-act="history">Show history (${state.history.length})</button>
      <button type="button" data-act="development">Development</button>
    </div>`;
}

const DEPARTMENT_NAMES = { production: 'Production', guestServices: 'Guest services', admissions: 'Admissions', venueOperations: 'Venue operations' };
const DEVELOPMENT_BENEFITS = {
  patch: 'Backup amp response improves from 80% to 95%. Still needs a PA and the $100 response.',
  service: 'The transferable worker serves one extra bar guest per minute while at the bar. Requires the live Lot clock.',
  admission: 'Each connected gate admits one extra guest per minute. Requires the live Lot clock; capacity stays fixed.',
};

function openDevelopment(opener) {
  const r = researchFor(state), editable = ['book', 'done'].includes(state.phase);
  if (!r) {
    const allowed = editable && (state.history.length > 0 || state.mode === 'sandbox');
    openWindow('development', 'Development', `<p>Learn Patch standards, Service training and Admission lanes. One project at a time, advanced by eligible signed nights.</p>
      <p>${state.mode === 'sandbox' ? 'Sandbox enables all three projects free.' : 'Starting pays from career cash. Experience is earned from future shows; past shows are not counted.'}</p>
      <p>${allowed ? 'Enable between bookings, then choose a project. Development is optional.' : 'Settle your first show, then return here between bookings.'}</p>
      <button data-act="research-enable" ${allowed ? '' : 'disabled'}>Enable development</button>`, opener);
    return;
  }
  const frozen = researchEffectsFor(state).learned, full = r.commands.length >= RESEARCH_COMMAND_LIMIT;
  const pages = Object.entries(D.RESEARCH_PROJECTS).map(([id,rule]) => {
    const project = r.projects[id], xp = r.experience[rule.department], available = editable && !full;
    const button = (kind,label,enabled) => `<button data-act="research-command" data-command="${kind}" data-project="${id}" ${available && enabled ? '' : 'disabled'}>${label}</button>`;
    const actions = project.status === 'available' ? button('start',`Start · ${money(rule.cost)}`,!r.active && state.cash >= rule.cost)
      : project.status === 'active' ? button('pause','Pause',true) + button('cancel',`Cancel · refund ${money(researchRefundFor(r,id))}`,true)
      : project.status === 'paused' ? button('resume','Resume · free',!r.active) + button('cancel',`Cancel · refund ${money(researchRefundFor(r,id))}`,true) : '';
    return `<section data-tab="${id === 'patch' ? 'Patch' : id === 'service' ? 'Service' : 'Admission'}" data-always-tabs>
      <h3>${rule.label}</h3><p>${DEVELOPMENT_BENEFITS[id]}</p>
      <dl class="live-readouts"><div><dt>Status</dt><dd>${project.status}</dd></div><div><dt>${DEPARTMENT_NAMES[rule.department]} experience</dt><dd>${xp} / ${rule.experience} required</dd></div>
      <div><dt>Eligible nights</dt><dd>${project.progress} / ${rule.nights}</dd></div><div><dt>Cost</dt><dd>${money(rule.cost)}</dd></div></dl>
      <p class="hint">${project.status === 'researched' ? frozen.includes(id) ? 'Included in this booking. Equipment and live-service requirements still apply.' : 'Learned. Included when you book your next show.' : `Progress requires a signed night with ${id === 'patch' ? 'an audience and PA' : id === 'service' ? 'actual live bar service' : 'actual live admission'}. Experience is cumulative, never spent.`}</p>
      <div class="actions">${actions}</div>${project.status === 'available' && state.cash < rule.cost ? '<p>Not enough career cash.</p>' : ''}</section>`;
  }).join('');
  const night = researchNightFor(state), recorded = night && r.settledNights.includes(night.id);
  const receipt = night ? `<p class="hint">${recorded ? 'Recorded for this night' : 'On signing this night'}: ${Object.entries(night.departments).filter(([,yes])=>yes).map(([id])=>DEPARTMENT_NAMES[id]+' +1').join(', ') || 'no eligible experience'}.</p>` : '';
  const ledger = `<section data-tab="Ledger" data-always-tabs><h3>Development ledger</h3><dl class="live-readouts">
    <div><dt>Paid for research</dt><dd>${money(r.spent)}</dd></div><div><dt>Cancellation refunds</dt><dd>${money(r.refunded)}</dd></div><div><dt>Net development cost</dt><dd>${money(r.spent-r.refunded)}</dd></div>
    ${Object.entries(r.experience).map(([id,xp])=>`<div><dt>${DEPARTMENT_NAMES[id]} experience</dt><dd>${xp}</dd></div>`).join('')}</dl>
    <p class="hint">Separate from show costs and artist deductions. Loading never pays or refunds again. Cancelling refunds only unfinished eligible nights.</p>${receipt}</section>`;
  openWindow('development', 'Development', `<p class="development-summary">Cash ${money(state.cash)} · Active: ${r.active ? D.RESEARCH_PROJECTS[r.active].label : 'none'}</p>
    ${state.researchNotice ? `<p role="status">${esc(state.researchNotice)}</p>` : ''}${full ? '<p>History is full. Shows can still settle; new development is unavailable.</p>' : ''}
    ${!editable ? '<p class="hint">Booked knowledge is fixed. Change projects between bookings.</p>' : ''}${pages}${ledger}`, opener);
}

function openStages(opener) {
  const terms = stagePlanFor(state), editable = state.phase === 'book' && state.venue.id === 'festival';
  const policy = festivalPolicyFor(state);
  const eligible = stageOpenersFor(state), selected = eligible.includes(state.booking.secondId) ? state.booking.secondId : eligible[0];
  const result = settlementFor(state), receipt = result?.stageAccounts, quote = terms && state.phase === 'promote' ? stageForecastFor(state) : null;
  const field = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const bill = `<section data-tab="Bill" data-always-tabs><h3>The Festival bill</h3>${editable ? eligible.length ? `
    <div class="stage-choice"><label for="stage-side-select">Side stage act</label><select id="stage-side-select">${eligible.map(id => `<option value="${id}" ${selected === id ? 'selected' : ''}>${esc(artistFor(id).name)}</option>`).join('')}</select></div>
    <button data-act="stage-select">Use this act</button><p>Selection is free. Book the main act next.</p><p>The side act gets 70% of its eligible ticket balance.</p>`
    : '<p>No side act accepts a door deal.</p><p>Choose another venue to rebuild relationships.</p>'
    : terms ? `<p>Main: ${esc(artistFor(state.booking.artistId).name)}</p><p>Side: ${esc(artistFor(state.booking.secondId).name)}</p><p>Both acts are fixed for this booking.</p>` : '<p>Original stage rules apply to this saved show.</p>'}
    ${editable ? `<p>Earlier-tier headliners need relationship +${D.FEST_HEADLINE_RELATIONSHIP}.</p>` : policy?.sponsorPrice !== undefined ? `<p>Sponsor tickets stay at ${money(policy.sponsorPrice)}.</p>` : ''}
    ${state.stagesNotice ? `<p role="status">${esc(state.stagesNotice)}</p>` : ''}</section>`;
  const stages = [['main','Main',state.booking.artistId],['second','Side',state.booking.secondId]].map(([id, label, artistId]) => {
    const a = receipt?.[id], range = quote?.[id];
    const content = a ? `<p>${esc(artistFor(artistId).name)}</p><dl class="live-readouts">
      ${field('Audience',`${a.attendance} / ${a.capacity}`)}${field('Ticket allocation',money(a.ticketGross))}${field('Own production',money(a.production.total))}${a.production.delays ? field('Included delay deployment',money(a.production.delays)) : ''}
      ${field('Allocated site cost',money(a.allocatedSiteCost))}${field('Artist ticket basis',money(a.artistBasis))}${field('Artist payment',money(a.artistPay))}${field('Stage balance',money(a.net))}</dl>
      <p>Artist relationship ${signed(id === 'main' ? result.relDelta : result.secondRelDelta)} on signing.</p>`
      : range ? `<p>${esc(artistFor(artistId).name)}</p><dl class="live-readouts">${field('Likely audience',`${range.low} to ${range.high}`)}</dl><p>Published draw ranges only.</p><p>Actual stage receipts follow the show.</p>`
      : '<p>Forecasts open in Promote.</p><p>Actual receipts follow the show.</p>';
    return `<section data-tab="${label}" data-always-tabs><h3>${label} stage</h3>${content}</section>`;
  }).join('');
  const cashAfter = receipt ? state.phase === 'done' ? state.history.at(-1)?.cashAfter ?? state.cash : state.cash + settlementPayout(result, state.booking.deal) : null;
  const site = receipt ? `<dl class="live-readouts">
    ${field('One site audience',receipt.sales.attendance)}${field('Ticket income',money(receipt.sales.ticketGross))}${field('Bar income',money(receipt.bar))}
    ${field('Sponsor income',money(receipt.sponsor))}${field('Broadcast income',money(receipt.broadcast))}${field('Both artist payments',money(receipt.artistPay))}
    ${field('Production and site costs',money(receipt.costs))}${field('Site net',money(receipt.net))}</dl>`
    : quote ? `<dl class="live-readouts">${field('Site capacity',quote.capacity)}${field('Likely attendance',`${quote.attendance.low} to ${quote.attendance.high}`)}${field('Opening cost',money(upfrontFor(state)))}</dl><p>Bar and broadcast are paid once per site.</p>` : '<p>Site forecasts open in Promote.</p><p>Cash receipts follow the show.</p>';
  openWindow('stages','Stage accounts',`<p class="development-summary">Two stages · one paid audience</p>${bill}${stages}${roomProfileHtml()}
    <section data-tab="Site" data-always-tabs><h3>Whole site</h3>${site}</section>
    <section data-tab="Cash" data-always-tabs><h3>Cash movements</h3>${receipt ? `<dl class="live-readouts">${field('Cash before the day',money(cashAfter-receipt.net))}${field('Opening outflow',money(receipt.upfront))}
      ${field('Response paid',money(receipt.siteCosts.incident))}${field('Signing income',money(settlementPayout(result,state.booking.deal)))}${field('Cash after signing',money(cashAfter))}</dl><p>Response costs were already paid.</p>` : '<p>Cash receipts follow the show.</p>'}${receipt ? '<button data-act="food-back">Back to settlement</button>' : ''}</section>
    <section data-tab="Rules" data-always-tabs><h3>One ticket per guest</h3><p>The main act sets site demand.</p><p>The side act redistributes that audience.</p><p>Each stage pays its own production.</p><p>Shared site costs divide by attendance.</p><p>Empty shows divide costs by capacity.</p><p>Each door act gets 70% of its own positive balance.</p><p>Stage ranges are separate bounds.</p><p>Site quality uses the shared show model.</p></section>`,opener);
}

function roomProfileHtml() {
  const profile = roomProfileFor(state.venue);
  const v = evaluateVenue(state.venue), field = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const support = festivalSupportFor(state.venue) || v.vipDecks || v.busCompounds || state.supportNotice ? `<section data-tab="Rider" data-always-tabs><h3>Touring support</h3><dl class="live-readouts">${field('VIP deck', `${v.vipDecks || 0} / 1 · ${money(v.vipDeckCost || 0)}`)}${field('Bus compound', `${v.busCompounds || 0} / 1 · ${money(v.busCompoundCost || 0)}`)}</dl><p>Both required before doors on new bookings.</p><p>Deck 4×3 · 2kW. Buses 6×3 · 6kW.</p><p>Move and rotate them in Build.</p><p>They use floor space and block views.</p><p>Shared rentals; no extra ticket income.</p>${state.supportNotice ? `<p role="status">${esc(state.supportNotice)}</p>` : ''}</section>` : '';
  if (!profile) return (v.delays ? `<section data-tab="Room" data-always-tabs><h3>Original room rules</h3><dl class="live-readouts">${field('Delay towers',v.delays)}${field('Delay deployment',money(v.delayCost))}</dl><p>Delays need the Festival room profile.</p><p>Rental and operators still cost money.</p><p>New bookings include the profile.</p></section>` : '') + support;
  return `<section data-tab="Room" data-always-tabs><h3>${state.venue.id === 'festival' ? 'Festival sound and views' : profile.houseLights ? 'House sound and lights' : 'Shell sound and slope'}</h3><dl class="live-readouts">
    ${field('System', v.housePa ? profile.label : 'Portable PA')}${field('Sound capacity', `${v.soundCapacity} people`)}
    ${field('Room capacity', `${v.capacity} people`)}${field('Clear-view tiles', v.clearTiles)}${field('Blocked-view tiles', v.blockedTiles)}</dl>
    <p>The house system is included in rent. A placed PA replaces it.</p>${profile.houseLights ? '<p>House lights are included. Pillars still block views.</p>' : '<p>Lights are still needed for full sound-and-light quality.</p>'}
    ${state.venue.id === 'festival' ? '<p>Flat ground; raised main stage. Tall objects block views.</p><p>Main rig covers half the permit. Shared site quality.</p>' : profile.houseLights ? '' : '<p>The lawn rises behind the seats. Higher ground sees over low objects; tall objects can still block views.</p>'}</section>
    ${profile.houseLights ? `<section data-tab="Lighting" data-always-tabs><h3>Included house lights</h3><dl class="live-readouts">${field('House lighting', 'Included')}${field('Extra towers', v.rentedLights)}${field('Extra rental', money(v.rentedLights ? D.LIGHTS_RENTAL : 0))}</dl><p>An optional tower costs ${money(D.LIGHTS_RENTAL)} and draws 8kW.</p><p>It adds no extra quality bonus.</p><p>The 60kW budget covers placed equipment.</p></section>` : ''}
    ${state.venue.id === 'festival' ? `<section data-tab="Delay" data-always-tabs><h3>Delay coverage</h3><dl class="live-readouts">${field('Delay towers',v.delays || 0)}${field('Extra covered tiles',v.delayTiles || 0)}${field('Delay deployment',money(v.delayCost || 0))}</dl><p>Place up to two towers in Build.</p><p>Each costs ${money(D.FESTIVAL_DELAYS.rental + D.FESTIVAL_DELAYS.operator)}, operator included.</p><p>Overlaps count once.</p><p>Extra supply stops at room capacity.</p><p>${v.delays && !v.delayActive ? 'Inactive: use the house PA and room profile.' : 'Uses the house PA and room profile.'}</p></section>` : ''}${support}`;
}

function openSeating(opener) {
  const terms = seatingPlanFor(state);
  if (!terms) { openWindow('seating', 'Room profile', roomProfileHtml() || `<p>${esc(state.roomNotice || state.seatingNotice || 'Original seat sales rules apply to this booking.')}</p>`, opener); return; }
  const quote = state.phase === 'promote' ? seatingForecastFor(state) : null, result = settlementFor(state);
  const field = (label,value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const zones = [['seats','Seats'],['lawn','Lawn']].map(([id,label]) => {
    const actual = result?.seating?.[id], low = quote?.low[id], high = quote?.high[id];
    const content = actual ? `<dl class="live-readouts">${field('Capacity',actual.capacity)}${field('Ticket price',money(actual.price))}${field('Tickets sold',actual.attendance)}${field('Ticket receipts',money(actual.gross))}${field('Value satisfaction',`${result.seating.scores[id]}/100`)}</dl><p>Shared show quality: ${result.seating.sharedSatisfaction}/100.</p><p>This zone's price can lower its value score.</p>`
      : quote ? `<dl class="live-readouts">${field('Capacity',low.capacity)}${field('Ticket price',money(low.price))}${field('Likely tickets',`${low.attendance} to ${high.attendance}`)}${field('Presale tickets',`${low.presale} to ${high.presale}`)}${field('Ticket gross before incidents',`${money(low.gross)} to ${money(high.gross)}`)}</dl><p>Public draw range only. Later incidents can reduce walk-ups.</p>`
      : '<p>Forecasts are available in Promote. Actual zone receipts appear after the night.</p>';
    return `<section data-tab="${label}" data-always-tabs><h3>${label} sales</h3>${content}</section>`;
  }).join('');
  openWindow('seating', 'Seats and lawn', `<p class="development-summary">Separate sales · one settlement</p>${zones}${roomProfileHtml()}
    <section data-tab="Rules" data-always-tabs><h3>Price and value</h3>${state.seatingNotice ? `<p role="status">${esc(state.seatingNotice)}</p>` : ''}
      ${state.roomNotice ? `<p role="status">${esc(state.roomNotice)}</p>` : ''}${state.supportNotice ? `<p role="status">${esc(state.supportNotice)}</p>` : ''}
      <p>Audience splits by zone capacity.</p><p>Each price changes its own demand. Unsold places do not transfer.</p>
      <p>Fair value is the act's usual price on lawn, plus ${money(10)} for seats.</p>
      <p>Above fair value, each extra fair-price multiple costs 10 satisfaction points.</p><p>The penalty stops at 20. Discounts add no points.</p>
      <p>Actual attendance weights both zone scores. Prices stay fixed after doors.</p>
      ${result ? '<button data-act="food-back">Back to settlement</button>' : ''}</section>`, opener);
}

function openHeldRun(opener) {
  const q = heldRunFor(state), terms = q?.terms;
  if (!terms) { openWindow('held-run', 'Held nights', `<p>${esc(state.runNotice || 'No held-run cancellation terms recorded.')}</p>`, opener); return; }
  const settled = state.phase === 'settle', cancelled = state.phase === 'done' && state.show?.cancelled;
  const result = settled ? settlementFor(state) : null;
  const signing = result ? state.cash + settlementPayout(result, state.booking.deal) : null;
  const opening = settled ? upfrontFor(state) : null;
  const canContinue = settled && q.remaining > 0 && (state.mode === 'sandbox' || signing >= opening);
  const field = (label,value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const locked = '<p>Finish the current night to choose. A completed run cannot be signed again.</p>';
  const receipt = cancelled ? `<dl class="live-readouts">${field('Completed nights',q.completed)}${field('Cancelled nights',q.remaining)}${field('Cancellation paid',money(q.penalty))}${field('Cash after signing',money(state.history.at(-1)?.cashAfter ?? state.cash))}</dl><p>The completed show keeps its earnings. No next-night opening was charged.</p>`
    : '<p>No cancellation has been signed for this run.</p>';
  openWindow('held-run', 'Held nights', `<p class="development-summary">${terms.nights} nights · ${money(terms.ask)} nightly ask</p>
    <section data-tab="Terms" data-always-tabs><h3>Ending a hold early</h3>${state.runNotice ? `<p role="status">${esc(state.runNotice)}</p>` : ''}
      <p>After a night, cancel the rest for ${money(q.feeEach)} each.</p><p>That is 25% of the booked ask, rounded per night.</p>
      <p>Completed nights keep earnings and reputation.</p><p>The cancellation expense never reduces the completed artist deal.</p>
      <p>Terms stay fixed after doors. Unplayed nights earn no money or progress.</p></section>
    <section data-tab="Continue" data-always-tabs><h3>Play the next night</h3>${settled && q.remaining ? `<dl class="live-readouts">${field('Cash after this show',money(signing))}${field('Next night opening',money(opening))}${field('Cash after opening',money(signing-opening))}</dl>
      <p>${canContinue ? 'Sign this show and pay the next opening once. The booked terms remain fixed.' : 'There is not enough cash to open the next night. Open Cancel to end the hold with its quoted fee.'}</p>
      <button data-act="held-run-sign" ${canContinue?'':'disabled'}>Sign and open night ${q.completed+1}</button>` : locked}</section>
    <section data-tab="Cancel" data-always-tabs><h3>End the hold</h3>${settled && q.remaining ? `<dl class="live-readouts">${field('Unplayed nights',q.remaining)}${field('Cash after this show',money(signing))}${field('Cancellation fee',money(q.penalty))}${field('Cash after cancellation',money(signing-q.penalty))}</dl>
      <p>No next-night opening is charged.${signing-q.penalty<0 ? ' This leaves debt; starting over may be necessary.' : ''}</p>
      <button data-act="held-run-sign" data-cancel="true">Sign and cancel ${q.remaining} night${q.remaining===1?'':'s'}</button>` : locked}</section>
    <section data-tab="Receipt" data-always-tabs><h3>Cancellation receipt</h3>${receipt}${['settle','done'].includes(state.phase)?'<button data-act="food-back">Back to settlement</button>':''}</section>`, opener);
}

function openTicketing(opener) {
  if (state.venue.id !== 'club') return;
  const terms = ticketingPlanFor(state) || { version: 1, plan: 'direct' };
  const editable = state.phase === 'promote', quote = ticketingForecastFor(state), result = settlementFor(state);
  const receipt = result?.ticketing, field = (label,value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const receiptBody = receipt ? `<dl class="live-readouts">${field('Presale tickets',receipt.presale)}${field('Presale gross',money(receipt.gross))}${field('Collection fee',money(receipt.fee))}${field('Presales after collection',money(receipt.remitted))}${field('All ticket cash after collection',money(result.ticketGross-receipt.fee))}</dl>
    <p>Fee withheld once at signing. Excluded from artist production deductions and opening cash.</p>`
    : `<p>${result ? 'No optional ticketing contract was recorded for this show. Original direct-sale rules apply.' : 'The actual receipt is available after the show. Forecasts are not guaranteed sales.'}</p>`;
  openWindow('ticketing', 'Club ticketing', `<p class="development-summary">${terms.plan === 'platform' ? 'Ticket platform · 4% of presales' : 'Direct · no collection fee'}</p>
    <section data-tab="Plan" data-always-tabs><h3>Choose how to sell</h3>
      ${state.ticketingNotice ? `<p role="status">${esc(state.ticketingNotice)}</p>` : ''}
      <p>Direct keeps the usual presale share, free. Platform raises it by 20 percentage points, up to 90%.</p>
      <p>Platform retains 4% of presale gross, rounded once per show. Demand and capacity do not increase.</p>
      <div class="actions capital-actions"><button data-act="ticketing-plan" data-plan="direct" aria-pressed="${terms.plan==='direct'}" ${editable&&terms.plan!=='direct'?'':'disabled'}>Use Direct</button><button data-act="ticketing-plan" data-plan="platform" aria-pressed="${terms.plan==='platform'}" ${editable&&terms.plan!=='platform'?'':'disabled'}>Use Platform</button></div>
      <p class="hint">${editable ? 'Changing this choice costs nothing now. Doors lock it for this show.' : 'Change the plan in Promote, before doors. This show keeps its agreed terms.'}</p></section>
    <section data-tab="Forecast" data-always-tabs><h3>Before incidents</h3>
      ${editable ? `<dl class="live-readouts">${field('Presale tickets',`${quote.low.presale} to ${quote.high.presale}`)}${field('Collection fee',`${money(quote.low.fee)} to ${money(quote.high.fee)}`)}${field('Presales after collection',`${money(quote.low.remitted)} to ${money(quote.high.remitted)}`)}</dl>
      <p>Range uses the act's published draw, booked terms, ads and available capacity. It cannot predict the night's incident.</p>` : '<p>Forecasts are shown in Promote. Open Receipt for the completed show.</p>'}
      <p class="hint">Direct earns more when the extra presale protection is unused. Platform can help when later walk-ups are lost.</p></section>
    <section data-tab="Receipt" data-always-tabs><h3>Ticket collection</h3>${receiptBody}
      ${result ? '<button data-act="food-back">Back to settlement</button>' : ''}</section>`, opener);
}

const CASH_LABELS = { acquisition: 'Equipment purchases', disposal: 'Equipment sales', development: 'Development', developmentRefund: 'Development refunds', showOpening: 'Show opening', incident: 'Incident responses', settlement: 'Settlements', cancellation: 'Held-night cancellation' };
function cashReference(entry) {
  if (entry.reference.startsWith('show_')) {
    const [,seed,night] = entry.reference.split('_');
    const signed = state.history.find(h => h.seed === Number(seed) && h.night === Number(night));
    return signed ? `Show ${signed.showId} · night ${night}` : `Current show · night ${night}`;
  }
  if (entry.reference.startsWith('research_')) return D.RESEARCH_PROJECTS[entry.reference.split('_')[1]]?.label || 'Development';
  return 'Career equipment';
}
let equipmentPage = 0;
// Short windows page ordinary content instead of turning the dialog into a scroll area.
function paginateCompactWindow(step = 0) {
  if (!['equipment', 'ticketing', 'held-run', 'seating', 'stages', 'set-time', 'deals'].includes(win.kind) || innerHeight > 560) return;
  el.winBody.scrollTop = 0;
  const panel = el.winBody.querySelector('[data-tab]:not(.tab-off)') || el.winBody;
  if (!panel._compactAtoms) {
    for (const list of [...panel.children].filter(e => e.matches('dl,ol'))) {
      const parts = [...list.children].map(child => { const part = list.cloneNode(false); part.append(child); return part; });
      list.replaceWith(...parts);
    }
    panel._compactAtoms = [...panel.children].filter(e => !e.matches('.tabbar, .development-summary'));
  }
  const atoms = panel._compactAtoms;
  atoms.forEach(e => { e.hidden = false; });
  const bottom = el.winBody.getBoundingClientRect().bottom - parseFloat(getComputedStyle(el.winBody).paddingBottom);
  const height = bottom - (panel === el.winBody ? el.winBody.getBoundingClientRect().top + parseFloat(getComputedStyle(el.winBody).paddingTop) : panel.getBoundingClientRect().top);
  const pages = [[]]; let used = 0;
  for (const atom of atoms) {
    const style = getComputedStyle(atom), size = atom.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
    if (used && used + size > height) { pages.push([]); used = 0; }
    pages.at(-1).push(atom); used += size;
  }
  panel._compactPage = Math.min(pages.length - 1, Math.max(0, (panel._compactPage || 0) + step));
  atoms.forEach(e => { e.hidden = !pages[panel._compactPage].includes(e); });
  el.winFoot.innerHTML = `<button data-act="window-part" data-step="-1" ${panel._compactPage ? '' : 'disabled'}>Back</button><span>Part ${panel._compactPage+1} / ${pages.length}</span><button data-act="window-part" data-step="1" ${panel._compactPage+1<pages.length ? '' : 'disabled'}>More</button>`;
}

function openEquipment(opener) {
  const owned = equipmentFor(state), editable = ['book', 'done'].includes(state.phase);
  if (!owned) {
    const allowed = editable && (state.history.length > 0 || state.mode === 'sandbox');
    openWindow('equipment', 'Equipment', `<p>Buy one small PA, then assign it to a placed small system in Build. Rentals and house rigs remain available.</p>
      <p>Purchase $1,200 · resale $600 · operation $20 per assigned night. Buying does not place equipment.</p>
      <p>${allowed ? 'Enable to open a cash journal at your current balance. Earlier shows stay in Show history.' : 'Settle your first show, then return between bookings.'}</p>
      <button data-act="equipment-enable" ${allowed ? '' : 'disabled'}>Enable equipment</button>`, opener);
    return;
  }
  const asset = owned.assets[0], rule = D.OWNED_EQUIPMENT['small-pa'], journal = careerLedgerFor(state);
  const plan = equipmentPlanFor(state), venue = evaluateVenue(state.venue), full = owned.commands.length >= OWNERSHIP_COMMAND_LIMIT;
  const canAssign = state.phase === 'build' && state.booking.equipment && asset && !venue.housePa && venue.paTier === 'S';
  const id = `capital_${Date.now()}_${owned.commands.length}`;
  const pages = Math.max(1, Math.ceil(journal.entries.length / 3));
  equipmentPage = Math.min(Math.max(0, equipmentPage), pages - 1);
  const entries = journal.entries.slice().reverse().slice(equipmentPage * 3, equipmentPage * 3 + 3);
  const field = (label, value) => `<div><dt>${label}</dt><dd>${money(value)}</dd></div>`;
  openWindow('equipment', 'Equipment', `<p class="development-summary">Cash ${money(state.cash)} · ${asset ? '1 small PA owned' : 'No owned PA'}</p>
    <section data-tab="Asset" data-always-tabs><h3>Small PA</h3>
      ${state.equipmentNotice ? `<p role="status">${esc(state.equipmentNotice)}</p>` : ''}
      <dl class="live-readouts">${field('Purchase',rule.purchase)}${field('Resale',rule.resale)}${field('Operation / assigned night',rule.operation)}</dl>
      <p>${asset ? 'Owned. Assign in Build to replace the small PA rental.' : 'Buying pays once from career cash. It does not place or assign the PA.'}</p>
      <p class="hint">Capital is separate from show costs and artist deductions. House and medium systems cannot use this asset.</p>
      <div class="actions capital-actions"><button data-act="equipment-capital" data-command="buy" data-transaction="${id}" ${editable && !full && !asset && state.cash >= rule.purchase ? '' : 'disabled'}>Buy for ${money(rule.purchase)}</button><button data-act="equipment-capital" data-command="sell" data-transaction="${id}" ${editable && !full && asset ? '' : 'disabled'}>Sell for ${money(rule.resale)}</button></div>
      <p class="hint">${full ? 'Equipment transaction history is full.' : !editable ? 'Buy and sell between bookings.' : !asset && state.cash < rule.purchase ? 'Not enough cash. Rental remains available.' : 'Closing this quote costs nothing.'}</p></section>
    <section data-tab="Deploy" data-always-tabs><h3>This show</h3>
      <p>${plan ? `Owned PA assigned · ${money(plan.cost)} operation per night.` : venue.housePa ? 'House PA included with this room.' : 'PA rental applies until an owned unit is assigned.'}</p>
      <p>${state.phase === 'build' ? canAssign ? 'The placed small PA can use your owned unit.' : 'Buy between bookings and place a small PA before assigning it.' : 'Assignment is available in Build. Doors lock it for the full run.'}</p>
      <div class="actions"><button data-act="equipment-assign" data-owned="yes" ${canAssign && !plan ? '' : 'disabled'}>Use owned PA</button>
      <button data-act="equipment-assign" data-owned="no" ${state.phase === 'build' && plan ? '' : 'disabled'}>Return to rental</button></div>
      <p class="hint">Power, staff, placement and capacity rules still apply. An unused owned PA has no nightly charge.</p></section>
    <section data-tab="Cash" data-always-tabs><h3>Cash reconciliation</h3>
      <dl class="live-readouts">${field('Opening cash',journal.openingCash)}${Object.entries(journal.totals).map(([key,value])=>field(CASH_LABELS[key],value)).join('')}${field('Available cash',journal.balance)}</dl>
      <p class="hint">Opening plus all movements equals available cash. Show opening includes any sponsor credit.</p></section>
    <section data-tab="History" data-always-tabs><h3>Cash movements</h3>
      <ol class="equipment-events">${entries.map(e=>`<li>${e.sequence}. ${CASH_LABELS[e.category]} · <strong>${money(e.cashDelta)}</strong><small>${esc(cashReference(e))}</small></li>`).join('') || '<li>No movements since the opening balance.</li>'}</ol>
      <div class="actions"><button data-act="equipment-page" data-step="-1" ${equipmentPage ? '' : 'disabled'}>Newer</button><span>Page ${equipmentPage+1} / ${pages}</span><button data-act="equipment-page" data-step="1" ${equipmentPage+1<pages ? '' : 'disabled'}>Older</button></div>
      <p class="hint">${journal.archived.through ? `${journal.archived.through} earlier movements retained in Cash totals; the latest128 have itemized rows.` : 'Only movements since equipment enablement are itemized.'} Loading never pays again.</p></section>`, opener);
}

function historyHtml() {
  return `<ul class="history">${state.history.slice().reverse().map((h) => {
    const cancelled = h.runCancellation ? heldRunQuote(h.runCancellation.terms, h.runCancellation.completed) : null;
    return `<li>Show ${h.showId}${h.night > 1 ? ` night ${h.night}` : ''}: ${h.deal === 'door' ? 'door deal' : h.deal === 'sponsor' ? 'sponsor' : 'guarantee'} · ${D.VENUES[h.venueId] ? D.VENUES[h.venueId].name : 'Oak St. Lot'} · ${h.attendance} people · ${money(h.net)} · ${h.result === 'pass' ? 'pass' : 'retry'}${cancelled ? `<p>Cancelled ${cancelled.remaining} remaining night${cancelled.remaining===1?'':'s'} · ${money(cancelled.penalty)} separate fee · cash after signing ${h.cashAfter === undefined ? 'not recorded' : money(h.cashAfter)}</p>` : ''}</li>`;
  }).join('')}</ul>`;
}

// ---------------------------------------------------------------------------
// Board

let rendererStatusKey = '';
const classicBoardHelp = $('#board-help').textContent;
let mapRefreshQueued = false;
const board = createBoardAdapter(el.canvas, {
  onView: () => { if (!mapRefreshQueued) { mapRefreshQueued = true; queueMicrotask(() => { mapRefreshQueued = false; siteMap.refresh(); }); } },
  enabled: new URLSearchParams(location.search).get('renderer') === '3d',
  onStatus: updateRendererStatus,
});
const siteMap = createSiteMap($('#site-map'), board, draw);

function updateRendererStatus(status) {
  const note = $('#renderer-status');
  const message = status.reason || (status.state === 'loading' ? 'Opening 3D…' : status.active ? '3D room preview. Camera and art are still being tested.' : 'Classic view.');
  if (note && note.textContent !== message) note.textContent = message;
  const toggle = $('[data-act="renderer-toggle"]');
  if (toggle) { toggle.textContent = status.enabled ? 'Use classic view' : 'Try 3D preview'; toggle.setAttribute('aria-pressed', String(status.enabled)); }
  document.querySelectorAll('[data-camera-preset], [data-camera-orbit]').forEach(button => { button.disabled = !status.active; });
  const help = status.active ? 'Select: tap to inspect, drag to orbit. Place: tap to place; dragging only previews. Two fingers pan and pinch; a middle-button drag pans. Camera controls are in the menu.' : classicBoardHelp;
  if ($('#board-help').textContent !== help) $('#board-help').textContent = help;
  const key = status.state + ':' + status.reason;
  if (key !== rendererStatusKey && status.reason) { cancelLotGesture(); el.boardStatus.textContent = status.reason; }
  if (key !== rendererStatusKey && status.active && rendererStatusKey.startsWith('fallback:')) el.boardStatus.textContent = '3D view restored. Your show is unchanged.';
  rendererStatusKey = key;
}

function openCamera(opener) {
  openWindow('camera', 'Camera', `<p id="renderer-status" class="lede" aria-live="polite"></p>
    <div class="row"><button type="button" data-act="renderer-toggle">Try 3D preview</button><button type="button" data-act="renderer-retry">Retry 3D</button></div>
    <div class="lot-camera-controls" role="group" aria-label="3D camera presets">${['wide', 'foh', 'stage', 'plan'].map(p => `<button type="button" data-camera-preset="${p}">${p === 'foh' ? 'FOH' : p[0].toUpperCase() + p.slice(1)}</button>`).join('')}${state.venue.id === 'festival' ? '<button type="button" data-camera-preset="side">Side stage</button>' : ''}</div>
    <div class="lot-camera-controls" role="group" aria-label="Orbit camera"><button type="button" data-camera-orbit="left">Orbit left</button><button type="button" data-camera-orbit="right">Orbit right</button><button type="button" data-camera-orbit="up">Look down</button><button type="button" data-camera-orbit="down">Look forward</button></div>
    <button type="button" data-act="camera-mode" aria-pressed="${!!ui.cameraMode}">Drag camera while placing: ${ui.cameraMode ? 'on' : 'off'}</button>
    <p class="hint">Select: tap to inspect, drag to orbit. Two fingers pan and pinch. FOH and Stage use provisional authored eye heights.</p>`, el.menuBtn);
  updateRendererStatus(board.status());
}

function crowdNow() {
  if (state.show?.flow && state.phase !== 'show') return liveServicesFor(state)?.inside || 0;
  if (state.phase === 'show') {
    if (state.show.services) return ui.services?.inside ?? ui.services?.admitted ?? 0;
    const play = ui.play;
    if (!play) return 0;
    return Math.round(play.preview * Math.min(1, play.p / 0.45));
  }
  if (state.phase === 'settle' || state.phase === 'done') {
    const r = settlementFor(state);
    const final = r ? r.attendance : 0;
    const play = ui.play;
    if (play && play.after && !play.after.done) {
      const k = play.after.progress ?? 0;
      return Math.round(play.preview + (final - play.preview) * k);
    }
    return final;
  }
  return 0;
}

let stageAudienceSource = null, stageAudienceSnapshot = null;
function stageAudienceForScene() {
  if (state.venue.id !== 'festival' || !state.show) return null;
  if (stageAudienceSource !== state) {
    const sales = (settlementFor(state) || showPreview(state))?.stageAccounts?.sales;
    stageAudienceSnapshot = sales ? { main: sales.main.attendance, second: sales.second.attendance } : null;
    stageAudienceSource = state;
  }
  return stageAudienceSnapshot;
}

function draw() {
  const services = state.show?.services ? (state.phase === 'show' ? ui.services : liveServicesFor(state, { events: true })) : null;
  const night = ['show', 'settle', 'done'].includes(state.phase);
  const scene = {
    objects: state.venue.objects,
    grid: state.venue.grid,
    floor: state.venue.id,
    pillars: venueSpec(state.venue).pillars,
    density: venueSpec(state.venue).density || D.FLOOR_DENSITY,
    clearSet: clearSet(),
    blockedSet: sight().blocked,
    showClear: state.phase === 'build' && ui.showClear,
    cursor: null,
    ghost: null,
    selection: state.phase === 'build' && ui.selection !== null ? state.venue.objects[ui.selection] : null,
    crowd: night ? crowdNow() : 0,
    ...(state.venue.id === 'festival' ? { stageAudience: night ? stageAudienceForScene() : null, secondaryStage: { booked: !!state.booking.secondId, artist: state.booking.secondId ? artistFor(state.booking.secondId).name : null } } : {}),
    serviceProgress: state.phase === 'show' && !reduceMotion && ui.play?.live && !ui.play.paused ? Math.min(1, Math.max(0, (performance.now() - ui.play.last) * ui.play.speed / 1000)) : 1,
    serviceMinute: services ? services.minute + (state.phase === 'show' && !reduceMotion && ui.play?.live && !ui.play.paused ? Math.min(0.999, Math.max(0, (performance.now() - ui.play.last) * ui.play.speed / 1000)) : 0) : 0,
    services,
    incident: night && state.show && (!state.show.services || state.show.services.minute >= liveIncidentMinute(state)) ? state.show.incidentId : null,
    night,
    lightTower: state.venue.objects.some((o) => o.type === 'lights'),
    houseLights: !!roomProfileFor(state.venue)?.houseLights,
    t: night && !reduceMotion && ui.raf && (!ui.play?.live || !ui.play.paused) ? performance.now() / 1000 : 0,
  };
  if (state.phase === 'settle' || state.phase === 'done') {
    if (state.show && state.show.incidentId !== 'rain') scene.incident = null;
  }
  if (state.phase === 'build') {
    const at = ui.hover || (ui.focused ? ui.cursor : null);
    if (at) {
      scene.cursor = at;
      scene.cursorColor = ui.tool === 'bulldoze' ? '#ef4444' : null;
      if (ui.tool !== 'bulldoze' && ui.tool !== 'select') scene.ghost = ghostAt(at);
    }
  }
  el.canvas.style.cursor = state.phase === 'build' && ui.tool === 'bulldoze' ? 'crosshair' : '';
  board.draw(scene);
  siteMap.update(scene);
  const worker = $('#live-worker');
  if (worker) worker.title = board.info().serviceCrowd?.diagnostic || '';
  updateZoomButtons();
  const crowd = $('#crowd-now');
  if (crowd) crowd.textContent = String(crowdNow());
}

// The page never scrolls (docs/HUD.md): the canvas fills the window, and the lot is fit
// into the part the top strip and the panel leave clear. On a phone the panel is a sheet
// across the bottom, so the clear part is above it.
let laidOut = '';
function layoutBoard() {
  const root = document.documentElement.style;
  const nav = window.__mixmashNav && window.__mixmashNav.element;
  if (nav) root.setProperty('--nav-room', `${Math.ceil(nav.getBoundingClientRect().right) + 12}px`);
  const strip = Math.ceil(el.topbar.getBoundingClientRect().bottom);
  root.setProperty('--strip-h', `${strip}px`);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const phone = window.matchMedia('(max-width: 680px)').matches;
  const side = el.panel.querySelector('.at-sheet');
  let clear = { x: 0, y: strip, w: width, h: height - strip };
  let bottom = 0;
  if (phone) {
    const top = el.panel.getBoundingClientRect().top;
    bottom = Math.max(0, Math.round(height - top));
    clear = { x: 0, y: strip, w: width, h: Math.max(120, top - strip) };
  } else if (side) {
    clear = { x: 0, y: strip, w: Math.max(240, side.getBoundingClientRect().left), h: height - strip };
  }
  root.setProperty('--board-bottom', `${bottom}px`);
  root.setProperty('--clear-cx', `${Math.round(clear.x + clear.w / 2)}px`);
  root.setProperty('--clear-w', `${Math.round(clear.w)}px`);
  siteMap.layout();
  const key = [width, height, clear.x, clear.y, clear.w, clear.h].join();
  if (key === laidOut) return;
  laidOut = key;
  board.setClear(clear);
  board.resize();
  draw();
}

let statusTimer = 0;
new MutationObserver(() => {
  el.boardStatus.classList.remove('quiet');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => el.boardStatus.classList.add('quiet'), 5000);
}).observe(el.boardStatus, { childList: true, characterData: true, subtree: true });

// Resize callbacks wait a frame, so laying out never loops inside one.
let layoutQueued = false;
function queueLayout() {
  if (layoutQueued) return;
  layoutQueued = true;
  requestAnimationFrame(() => { layoutQueued = false; layoutBoard(); });
}

// The camera (docs/HUD.md section 5). Zoom keeps the point under the pointer still;
// the status line says how to move a zoomed view.
function zoomStep(steps, px, py) {
  const before = board.camera().zoom;
  const zoom = board.zoomBy(steps, px, py);
  if (zoom !== before) showZoom(zoom);
}

function showZoom(zoom) {
  el.boardStatus.textContent = zoom === 1
    ? 'Zoom: the whole lot.'
    : `Zoom ${zoom}x. Shift and the arrow keys, or a middle-button drag, move the view. 0 shows the whole lot.`;
  updateZoomButtons();
}

function updateZoomButtons() {
  const { zoom, zooms } = board.camera();
  $('#zoom-out').disabled = zoom === zooms[0];
  $('#zoom-fit').disabled = zoom === zooms[0];
  $('#zoom-in').disabled = zoom === zooms[zooms.length - 1];
}

// The 3D gesture owner consumes pointer events before legacy placement handlers.
const lotPointers = new Map();
let lotGesture = null;
let swallowLotClick = false;
// A touch click can target a dialog opened by pointerup, outside the canvas.
// Consume that gesture's click; a new press must still work on any UI control.
document.addEventListener('pointerdown', () => { swallowLotClick = false; }, true);
document.addEventListener('click', (event) => {
  if (!swallowLotClick || event.detail === 0) return;
  swallowLotClick = false;
  event.preventDefault(); event.stopImmediatePropagation();
}, true);
function cancelLotGesture() {
  lotPointers.clear(); lotGesture = null; ui.dozing = false; ui.pan = null; history.drag = null;
}
function pairGeometry() {
  const [a, b] = [...lotPointers.values()];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
}
el.canvas.addEventListener('pointerdown', (event) => {
  if (!board.status().active) { swallowLotClick = false; return; }
  swallowLotClick = true;
  event.preventDefault(); event.stopImmediatePropagation();
  if (!el.win.hidden || !el.menu.hidden || ![0, 1].includes(event.button)) return;
  lotPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (lotPointers.size === 1) lotGesture = { x: event.clientX, y: event.clientY, moved: false, multi: false, button: event.button };
  else if (lotGesture) { lotGesture.multi = true; lotGesture.moved = true; }
  try { el.canvas.setPointerCapture(event.pointerId); } catch { cancelLotGesture(); }
}, true);
el.canvas.addEventListener('pointermove', (event) => {
  if (!board.status().active || !lotPointers.has(event.pointerId) || !lotGesture) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const previous = lotPointers.get(event.pointerId), before = lotPointers.size > 1 ? pairGeometry() : null;
  lotPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (before) {
    const after = pairGeometry(), rect = el.canvas.getBoundingClientRect();
    board.panBy(after.x - before.x, after.y - before.y);
    board.zoomTo(board.camera().zoom * after.distance / before.distance, after.x - rect.left, after.y - rect.top);
    updateZoomButtons(); return;
  }
  if (Math.hypot(event.clientX - lotGesture.x, event.clientY - lotGesture.y) > 6) lotGesture.moved = true;
  if (!lotGesture.moved) return;
  const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
  if (lotGesture.button === 1) board.panBy(dx, dy);
  else if (lotGesture.multi || ui.cameraMode || ui.tool === 'select' || state.phase !== 'build') {
    const camera = board.camera(); board.setCamera({ yaw: camera.yaw - dx * 0.35, pitch: camera.pitch + dy * 0.25 });
  } else { ui.hover = board.tileAt(event.clientX, event.clientY); draw(); }
}, true);
el.canvas.addEventListener('pointerup', (event) => {
  if (!board.status().active || !lotPointers.has(event.pointerId)) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const tap = lotPointers.size === 1 && lotGesture && !lotGesture.moved && !lotGesture.multi && lotGesture.button === 0;
  lotPointers.delete(event.pointerId);
  if (!lotPointers.size) cancelLotGesture();
  if (el.canvas.hasPointerCapture(event.pointerId)) el.canvas.releasePointerCapture(event.pointerId);
  if (tap && state.phase === 'build' && el.win.hidden && el.menu.hidden) {
    const tile = ui.tool === 'select' || ui.tool === 'bulldoze' ? targetAt(event) : board.tileAt(event.clientX, event.clientY);
    if (tile) { ui.cursor = tile; placeAt(tile); }
  }
}, true);
for (const name of ['pointercancel', 'lostpointercapture']) el.canvas.addEventListener(name, () => { if (board.status().active) cancelLotGesture(); }, true);
for (const name of ['click', 'contextmenu']) el.canvas.addEventListener(name, (event) => { if (board.status().active || swallowLotClick) { event.preventDefault(); event.stopImmediatePropagation(); if (name === 'click') swallowLotClick = false; } }, true);

el.canvas.addEventListener('pointerdown', (e) => {
  const pan = e.button === 1 || (e.button === 0 && state.phase !== 'build');
  if (pan && board.camera().zoom !== 1) {
    e.preventDefault();
    ui.pan = { x: e.clientX, y: e.clientY };
    try { el.canvas.setPointerCapture(e.pointerId); } catch { /* the drag still works inside the canvas */ }
    return;
  }
  if (state.phase !== 'build' || ui.tool !== 'bulldoze' || e.button !== 0) return;
  ui.dozing = true;
  history.drag = { recorded: false };
  try { el.canvas.setPointerCapture(e.pointerId); } catch { /* the drag still works inside the canvas */ }
  doze(targetAt(e));
});
// The drag's undo step stays open through the click that follows pointerup in the same task.
const endDrag = () => { ui.dozing = false; ui.pan = null; setTimeout(() => { history.drag = null; }, 0); };
el.canvas.addEventListener('pointerup', endDrag);
el.canvas.addEventListener('pointercancel', endDrag);
// A middle-button press would start the browser's autoscroll instead of a pan.
el.canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
el.canvas.addEventListener('pointermove', (e) => {
  if (ui.pan) {
    board.panBy(e.clientX - ui.pan.x, e.clientY - ui.pan.y);
    ui.pan = { x: e.clientX, y: e.clientY };
    return;
  }
  if (state.phase !== 'build') return;
  const tile = board.tileAt(e.clientX, e.clientY);
  if (ui.dozing) doze(targetAt(e));
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
  if (tile) ui.cursor = tile;
  // Removal hit-tests the sprites first: a tall prop's top can sit above the ground grid.
  if (e.shiftKey) removeUnder(e);
  else if (ui.tool === 'select') { const target = targetAt(e); if (target) inspectAt(target); }
  else if (tile) placeAt(tile);
});
el.canvas.addEventListener('contextmenu', (e) => {
  if (state.phase !== 'build') return;
  e.preventDefault();
  removeUnder(e);
});
// The page doesn't scroll, so the wheel zooms about the pointer (docs/HUD.md decision 3).
// Line and page deltas (Firefox's wheel) are scaled to pixels.
el.canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  ui.wheel = (ui.wheel || 0) + e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
  if (Math.abs(ui.wheel) < 40) return;
  const rect = el.canvas.getBoundingClientRect();
  zoomStep(ui.wheel < 0 ? 1 : -1, e.clientX - rect.left, e.clientY - rect.top);
  ui.wheel = 0;
}, { passive: false });
el.canvas.addEventListener('focus', () => { ui.focused = true; draw(); });
el.canvas.addEventListener('blur', () => { ui.focused = false; draw(); });
// Keys on the board come from the binding table (controls.mjs); the conditions that are not
// about the key itself (zoomed, the phase) stay here.
el.canvas.addEventListener('keydown', (e) => {
  if (matches('turn-view', e)) {
    e.preventDefault();
    const step = board.turnView();
    el.boardStatus.textContent = board.status().active ? `3D view: ${Math.round(board.camera().yaw)} degrees.` : `View quarter ${step + 1} of 4. Props keep the original painted side.`;
    return;
  }
  if (matches('zoom-in', e)) { e.preventDefault(); zoomStep(1); return; }
  if (matches('zoom-out', e)) { e.preventDefault(); zoomStep(-1); return; }
  if (matches('zoom-fit', e)) { e.preventDefault(); zoomStep(-board.camera().zooms.length); return; }
  const pans = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [1, 0], ArrowRight: [-1, 0] };
  if (matches('pan', e) && board.camera().zoom !== 1) {
    e.preventDefault();
    if (board.panBy(pans[e.key][0] * 80, pans[e.key][1] * 80)) el.boardStatus.textContent = 'Moved the view.';
    return;
  }
  if (state.phase !== 'build') return;
  const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  if (matches('move-cursor', e)) {
    e.preventDefault();
    const g = state.venue.grid;
    ui.cursor = {
      x: Math.min(g.w - 1, Math.max(0, ui.cursor.x + moves[e.key][0])),
      y: Math.min(g.h - 1, Math.max(0, ui.cursor.y + moves[e.key][1])),
    };
    ui.hover = null;
    board.follow(ui.cursor.x, ui.cursor.y);
    el.boardStatus.textContent = describeTile(ui.cursor);
    draw();
  } else if (matches('place', e)) {
    e.preventDefault();
    placeAt(ui.cursor);
    el.boardStatus.textContent = describeTile(ui.cursor);
  } else if (matches('remove', e)) {
    e.preventDefault();
    removeAt(ui.cursor);
    el.boardStatus.textContent = describeTile(ui.cursor);
  } else if (matches('rotate', e)) {
    e.preventDefault();
    rotate();
  } else if (matches('bulldoze', e)) {
    e.preventDefault();
    toggleBulldoze();
  }
});

function rotate() {
  ui.rot = (ui.rot + 1) % 4;
  const r = $('#rot-label'); if (r) r.textContent = `faces ${FACING[ui.rot]}`;
  const g = $('#rot-glyph'); if (g) g.textContent = ARROWS[ui.rot];
  el.boardStatus.textContent = `Rotation: facing ${FACING[ui.rot]}.`;
  draw();
}

el.win.addEventListener('click', event => {
  const preset = event.target.closest('[data-camera-preset]'), orbit = event.target.closest('[data-camera-orbit]');
  if (preset && !preset.disabled) board.preset(preset.dataset.cameraPreset);
  if (orbit && !orbit.disabled) {
    const c = board.camera(), direction = orbit.dataset.cameraOrbit;
    board.setCamera({ yaw: c.yaw + (direction === 'left' ? -15 : direction === 'right' ? 15 : 0), pitch: c.pitch + (direction === 'up' ? 10 : direction === 'down' ? -10 : 0) });
  }
  if (preset || orbit) updateZoomButtons();
});

$('#zoom-in').addEventListener('click', () => zoomStep(1));
$('#zoom-out').addEventListener('click', () => zoomStep(-1));
$('#zoom-fit').addEventListener('click', () => zoomStep(-board.camera().zooms.length));
$('#turn-view').addEventListener('click', () => {
  const step = board.turnView();
  el.boardStatus.textContent = board.status().active ? `3D view: ${Math.round(board.camera().yaw)} degrees.` : `View quarter ${step + 1} of 4. Props keep the original painted side.`;
});

// ---------------------------------------------------------------------------
// Panel events

function onAct(e) {
  const target = e.target.closest('[data-act]');
  if (!target || target.disabled) return;
  const a = target.dataset.act;
  if (a === 'stages-open') { openStages(target); return; }
  if (a === 'stage-select') {
    ui.mounted = null;
    if (act({ type: 'chooseSideAct', artistId: $('#stage-side-select').value })) { openStages($('#stage-bill')); $('#stage-side-select')?.focus(); }
    return;
  }
  if (a === 'seating-open') { openSeating(target); return; }
  if (a === 'cost-page') { const ledger = target.closest('.ledger'); ledger.querySelectorAll('[data-cost-group]').forEach(row => { row.hidden = row.dataset.costGroup !== target.dataset.cost; }); ledger.querySelectorAll('[data-act="cost-page"]').forEach(button => button.setAttribute('aria-pressed', String(button === target))); return; }
  if (a === 'room-open') { openSeating(target); $('#win [data-tab-name="Room"]')?.click(); return; }
  if (a === 'held-run-open') { openHeldRun(target); return; }
  if (a === 'held-run-sign') {
    if (act({ type: 'acceptSettlement', cancelRemaining: target.dataset.cancel === 'true', at: new Date().toISOString() })) { closeWindow(); focusHeading(); }
    return;
  }
  if (a === 'ticketing-open') { openTicketing(target); return; }
  if (a === 'ticketing-plan') {
    if (act({ type: 'setPromotion', ticketing: { version: 1, plan: target.dataset.plan } })) { openTicketing($('#ticketing-settings')); el.winBody.querySelector('[role=tab][aria-selected=true]')?.focus(); }
    return;
  }
  if (a === 'equipment-open') { equipmentPage = 0; openEquipment(target); return; }
  if (a === 'window-part') { paginateCompactWindow(Number(target.dataset.step)); const button = el.winFoot.querySelector(`[data-step="${target.dataset.step}"]`); (button.disabled ? el.winFoot.querySelector('button:not(:disabled)') : button)?.focus(); return; }
  if (a === 'equipment-page') { equipmentPage += Number(target.dataset.step); openEquipment(el.menuBtn); el.winBody.querySelector('[role=tab][aria-selected=true]')?.focus(); return; }
  if (['equipment-enable', 'equipment-capital', 'equipment-assign'].includes(a)) {
    const action = a === 'equipment-enable' ? { type: 'enableEquipment' }
      : a === 'equipment-assign' ? { type: 'assignEquipment', assetId: target.dataset.owned === 'yes' ? equipmentFor(state).assets[0]?.id : null }
      : { type: 'equipment', command: { id: target.dataset.transaction, kind: target.dataset.command, family: 'small-pa', assetId: equipmentFor(state).assets[0]?.id } };
    if (act(action)) { equipmentPage = 0; openEquipment(el.menuBtn); el.winBody.querySelector('[role=tab][aria-selected=true]')?.focus(); }
    return;
  }
  if (a === 'development') { openDevelopment(target); return; }
  if (a === 'research-enable' || a === 'research-command') {
    if (act(a === 'research-enable' ? {type:'enableResearch'} : {type:'research',command:{kind:target.dataset.command,project:target.dataset.project}})) {
      openDevelopment(el.menuBtn); el.winBody.querySelector('[role=tab][aria-selected=true]')?.focus();
    }
    return;
  }
  if (a === 'camera-open') { openCamera(target); return; }
  if (a === 'renderer-toggle') { cancelLotGesture(); void board.setEnabled(!board.status().enabled); return; }
  if (a === 'renderer-retry') { cancelLotGesture(); void board.retry(); return; }
  if (a === 'camera-mode') { ui.cameraMode = !ui.cameraMode; target.setAttribute('aria-pressed', String(ui.cameraMode)); target.textContent = `Drag camera while placing: ${ui.cameraMode ? 'on' : 'off'}`; return; }
  if (a === 'deal') act({ type: 'chooseDeal', deal: target.dataset.deal, artistId: target.dataset.artist, secondId: target.dataset.second, nights: state.booking.nights || 1, ...(state.venue.id === 'festival' ? { stagePolicy: 1, festivalPolicy: 1, roomPolicy: 1, curfewPolicy: 1, supportPolicy: 1 } : {}), ...(state.venue.id === 'club' ? { roomPolicy: 1 } : {}), ...(state.venue.id === 'amphitheater' ? { seatingPolicy: 1, roomPolicy: 1, curfewPolicy: 1 } : {}), ...(state.venue.id === 'amphitheater' && state.booking.nights > 1 ? { runPolicy: 1 } : {}) });
  else if (a === 'venue' || a === 'nights') {
    // The Book panel lists the room's own acts and nights, so it is rebuilt; focus
    // returns to the button that was pressed.
    const again = `[data-act="${a}"][data-${a}="${target.dataset[a]}"]`;
    ui.mounted = null;
    if (a === 'venue') act({ type: 'chooseVenue', venueId: target.dataset.venue });
    else { state.booking.nights = Number(target.dataset.nights); delete state.booking.run; render(); }
    const button = el.panel.querySelector(again);
    if (button) button.focus();
  }
  else if (a === 'mode') {
    // A new game erases this one, so a game with any progress asks for a second press.
    const mode = target.dataset.mode;
    if ((state.history.length || state.phase !== 'book') && ui.confirmMode !== mode) {
      resetModeButtons();
      ui.confirmMode = mode;
      target.textContent = 'Press again to erase this game';
      return;
    }
    resetModeButtons();
    state = mode === 'career' ? createGame(state.seed) : createGame(state.seed, { mode, scenario: 'wet-lot' });
    resetHistory();
    ui.mounted = null;
    persist();
    render();
    setMenu(false);
  }
  else if (a === 'rotate') rotate();
  else if (a === 'locate-incident') locateIncident();
  else if (a === 'lot-details') openWindow('lot', 'Lot details', lotDetailsHtml(), target);
  else if (a === 'deal-help') openWindow('deals', 'Deal terms', dealHelpHtml(), target);
  else if (a === 'set-time') openWindow('set-time', 'Set time', setTimeHtml(setTimeFor(state)), target);
  else if (a === 'open-settlement') openSettlement(target);
  else if (a === 'last-sheet') openSettlement(target, { signed: true });
  else if (a === 'history') openWindow('history', `Show history (${state.history.length})`, historyHtml(), target, { scrolls: true });
  else if (a === 'select') selectTool();
  else if (a === 'bulldoze') toggleBulldoze();
  else if (a === 'undo') undoLayout();
  else if (a === 'redo') redoLayout();
  else if (a === 'fence') {
    const i = state.venue.objects.findIndex((o) => o.type === 'fence');
    if (i >= 0) act({ type: 'remove', index: i });
    else act({ type: 'place', object: { type: 'fence', x: 0, y: 0, rot: 0 } });
  } else if (a === 'starter') {
    if (act({ type: 'setLayout', objects: [...venueSpec(state.venue).starter.filter(o => !roomProfileFor(state.venue)?.houseLights || o.type !== 'lights'), ...(festivalSupportFor(state.venue) ? D.FESTIVAL_SUPPORT_LAYOUT : [])] }, { quiet: true })) say('Placed the suggested layout. Change anything you like.');
  } else if (a === 'clear-lot') {
    if (!state.venue.objects.length) { say('The lot is already clear.'); return; }
    openWindow('clear', 'Clear the layout?', '<p>Remove all ' + state.venue.objects.length + ' placed objects? Undo can restore this layout while you remain in Build.</p>', target,
      { foot: '<button type="button" data-win="close">Cancel</button><button type="button" class="primary" data-act="confirm-clear">Clear all objects</button>' });
  } else if (a === 'confirm-clear' && win.kind === 'clear' && state.phase === 'build') {
    closeWindow();
    if (act({ type: 'setLayout', objects: [] }, { quiet: true })) say('Cleared the lot. Undo restores the layout.');
  } else if (a === 'remove-selected' && win.kind === 'selection' && state.phase === 'build') {
    const index = ui.selection;
    closeWindow();
    if (index !== null && state.venue.objects[index]) act({ type: 'remove', index });
  } else if (a === 'remove') {
    const i = Number(target.dataset.index);
    const type = state.venue.objects[i] && state.venue.objects[i].type;
    if (act({ type: 'remove', index: i }, { quiet: true }) && type) say(`Removed the ${label(type).toLowerCase()}.`);
  } else if (a === 'back') act({ type: 'back' });
  else if (a === 'confirm-build') act({ type: 'confirmBuild' });
  else if (a === 'confirm-promo') { const services = state.venue.id === 'lot' && (state.promotion.liveServices ?? liveServicesPilot); act({ type: 'confirmPromotion', services, ...(services ? { flow: 1 } : {}), pilot: lotNightSlice && !services }); }
  else if (a === 'skip') skipToIncident();
  else if (a === 'live-settings' && state.phase === 'promote') {
    const access = liveAccessFor(state), placed = evaluateVenue(state.venue);
    openWindow('live-settings', 'Live services trial', `<label class="live-optin"><input id="live-services" type="checkbox" data-input="services" ${(state.promotion.liveServices ?? liveServicesPilot) ? 'checked' : ''} /> Run live arrivals and bar queues</label>
      <p>Move one bar worker to admission and back. Served demand, lost sales and ticket refunds change this show's settlement. Requires a bar.</p><p>Connected gates ${access.usableGates}/${placed.gates} · exits ${access.usableExits}/${placed.exits} · bars ${access.usableBars}/${placed.bars}. Keep a path to the main floor. After service closes, finish guest departure before settlement.</p>
      <p>${liveArrivalPlan(state).label} over ${liveArrivalPlan(state).minutes} minutes. The clock starts paused; your choice is saved with this show.</p><p>Blue: admission queue. Gold: bar queue. Orange: worker. Grey: departing admission guests. Up to 180 guest samples illustrate the totals; bar customers are already admitted.</p>`, target, { foot: '<button data-win="close">Done</button>' });
  }
  else if (a === 'food-settings' && state.phase === 'promote') {
    openWindow('food-settings', 'Facilities', facilitySettings(), target, { foot: '<button data-win="close">Done</button>' });
    $('#food-plan').value = state.promotion.foodPlan || '';
    updateFacilitySettings();
  }
  else if (a === 'sanitation-receipt') {
    const service = liveServicesFor(state);
    if (service?.sanitation) openWindow('sanitation-receipt', 'Facilities', sanitationDetails(service.sanitation, service.minute), target, { foot: state.phase === 'settle' || state.phase === 'done' ? '<button data-act="food-back">Back to settlement</button>' : '<button data-win="close">Done</button>' });
  }
  else if (a === 'food-receipt') {
    const food = liveServicesFor(state)?.food;
    if (food) openWindow('food-receipt', 'Food vendor', foodDetails(food), target, { foot: state.phase === 'settle' || state.phase === 'done' ? '<button data-act="food-back">Back to settlement</button>' : '<button data-win="close">Done</button>' });
  }
  else if (a === 'food-back') openSettlement($('#open-settlement'), { signed: state.phase === 'done' });
  else if (a === 'live-worker') act({ type: 'assignLiveWorker', station: target.dataset.station });
  else if (a === 'live-play' && ui.play?.live) { stopPlayback(); ui.play.paused = !ui.play.paused; ui.play.last = performance.now(); updateLiveServices(); if (!ui.play.paused) loop(); }
  else if (a === 'live-step') stepLive(ui.services.minute + 5);
  else if (a === 'live-next') stepLive(ui.services.departure?.active ? liveEndMinute(state) : state.show.responseId ? D.LIVE_SERVICES.closeAt : liveIncidentMinute(state));
  else if (a === 'choose-crew') chooseDoorCrew(target.dataset.choice);
  else if (a === 'respond') respond(target.dataset.response);
  else if (a === 'accept') act({ type: 'acceptSettlement', at: new Date().toISOString() });
  else if (a === 'next') act({ type: 'nextShow' });
  else if (a === 'retry') act({ type: 'retry' });
  if (['deal', 'back', 'confirm-build', 'confirm-promo', 'accept', 'next', 'retry'].includes(a)) focusHeading();
}
el.panel.addEventListener('click', onAct);
el.win.addEventListener('click', (e) => {
  if (e.target === el.win || e.target.closest('[data-win="close"]')) { closeWindow(); return; }
  onAct(e);
});

el.panel.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.input === 'price') act({ type: 'setPromotion', price: Number(t.value) }, { quiet: true });
  else if (t.dataset.input === 'seat') act({ type: 'setPromotion', seatPrice: Number(t.value) }, { quiet: true });
  else if (t.dataset.input === 'ad') act({ type: 'setPromotion', ads: { [t.dataset.channel]: Number(t.value) } }, { quiet: true });
});

el.win.addEventListener('change', e => {
  if (e.target.dataset.input === 'services') act({ type: 'setPromotion', services: e.target.checked }, { quiet: true });
  else if (e.target.dataset.input === 'food-plan') act({ type: 'setPromotion', foodPlan: e.target.value || null }, { quiet: true });
  else if (e.target.dataset.input === 'sanitation') {
    const enabled = $('#sanitation-enabled').checked;
    const sanitation = enabled ? { version: 1, cleaner: $('#sanitation-cleaner').checked,
      utilities: $('#sanitation-utilities').checked, preference: $('#sanitation-preference').checked } : null;
    act({ type: 'setPromotion', sanitation }, { quiet: true }); updateFacilitySettings();
  }
});

el.panel.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.input === 'services') act({ type: 'setPromotion', services: t.checked }, { quiet: true });
  else if (t.dataset.input === 'live-speed' && ui.play?.live) { ui.play.speed = Number(t.value); ui.play.last = performance.now(); }
  else if (t.dataset.input === 'tool') pickTool(t.value);
  else if (t.dataset.input === 'clear') {
    ui.showClear = t.checked;
    draw();
  }
});

function pickTool(type) {
  ui.selection = null;
  ui.tool = type;
  ui.placeTool = type;
  document.querySelectorAll('input[name="tool"]').forEach((input) => { input.checked = input.value === type; });
  el.boardStatus.textContent = `Placing: ${label(type)}.`;
  updateBuild();
  draw();
}

// ---------------------------------------------------------------------------
// Phone tabs (docs/HUD.md decision 12): on a narrow screen the groups marked data-tab share
// one space, one tab at a time, so the bottom sheet and the windows never scroll. On wider
// screens every group shows and the tab bar is removed.

const phoneQuery = window.matchMedia('(max-width: 680px)');
const shortWindowQuery = window.matchMedia('(max-height: 760px)');
ui.tabs = {};

function setSheetSize(size) {
  document.body.dataset.sheetSize = size;
  const hud = HUD_PHASES.includes(state.phase);
  const collapsed = phoneQuery.matches && hud && size === 'collapsed';
  el.panel.inert = collapsed;
  $('#sheet-controls').hidden = !hud;
  $('#sheet-expand').setAttribute('aria-expanded', String(size === 'expanded'));
  $('#sheet-expand').setAttribute('aria-label', size === 'expanded' ? 'Reduce controls' : 'Expand controls');
  $('#sheet-collapse').setAttribute('aria-expanded', String(!collapsed));
  $('#sheet-collapse').setAttribute('aria-label', collapsed ? 'Show controls' : 'Hide controls');
  $('#sheet-expand').textContent = size === 'expanded' ? '↙' : '↗';
  $('#sheet-collapse').textContent = collapsed ? '↑' : '↓';
  queueLayout();
}

$('#sheet-expand').addEventListener('click', () => setSheetSize(document.body.dataset.sheetSize === 'expanded' ? 'peek' : 'expanded'));
$('#sheet-collapse').addEventListener('click', () => setSheetSize(document.body.dataset.sheetSize === 'collapsed' ? 'peek' : 'collapsed'));
// Only the handle owns the gesture, so a slider, tab or board drag cannot resize the sheet.
let sheetStart = null;
$('#sheet-grip').addEventListener('touchstart', (event) => event.preventDefault(), { passive: false });
$('#sheet-grip').addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch' || !event.isPrimary) return;
  sheetStart = event.clientY;
  event.currentTarget.setPointerCapture(event.pointerId);
});
$('#sheet-grip').addEventListener('pointerup', (event) => {
  if (sheetStart === null || !event.isPrimary) return;
  const delta = event.clientY - sheetStart;
  sheetStart = null;
  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  if (Math.abs(delta) < 35) return;
  setSheetSize(delta < 0 ? 'expanded' : 'collapsed');
});
$('#sheet-grip').addEventListener('pointercancel', () => { sheetStart = null; });

function syncTabs(root, key, pick) {
  const old = root.querySelector(':scope > .tabbar, .tabbar');
  if (old) old.remove();
  const all = [...root.querySelectorAll('[data-tab]')];
  all.forEach((g) => { g.classList.remove('tab-off'); g.removeAttribute('role'); g.removeAttribute('aria-labelledby'); });
  const groups = all.filter((g) => !g.hidden);
  const names = [...new Set(groups.map((g) => g.dataset.tab))];
  const compactSettlement = root === el.winBody && win.kind === 'settlement' && shortWindowQuery.matches;
  if ((!phoneQuery.matches && !compactSettlement && !root.querySelector('[data-always-tabs]')) || names.length < 2) return;
  if (pick) ui.tabs[key] = pick;
  const current = names.includes(ui.tabs[key]) ? ui.tabs[key] : names[0];
  const bar = document.createElement('div');
  bar.className = 'tabbar';
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', 'Sections');
  names.forEach((name, i) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = `tab-${key.replace(/\W/g, '-')}-${i}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(name === current));
    tab.tabIndex = name === current ? 0 : -1;
    tab.dataset.tabName = name;
    tab.textContent = name;
    bar.append(tab);
    groups.filter((g) => g.dataset.tab === name).forEach((g) => {
      g.setAttribute('role', 'tabpanel');
      g.setAttribute('aria-labelledby', tab.id);
      g.classList.toggle('tab-off', name !== current);
    });
  });
  bar.addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (!tab) return;
    syncTabs(root, key, tab.dataset.tabName);
    const again = root.querySelector(`.tabbar [data-tab-name="${CSS.escape(tab.dataset.tabName)}"]`);
    if (again) again.focus();
  });
  bar.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = names.indexOf(current);
    const next = names[(i + (e.key === 'ArrowRight' ? 1 : names.length - 1)) % names.length];
    syncTabs(root, key, next);
    const again = root.querySelector(`.tabbar [data-tab-name="${CSS.escape(next)}"]`);
    if (again) again.focus();
  });
  const first = groups[0];
  (first.parentElement === root ? first : first.parentElement).before(bar);
  if (root === el.winBody && ['equipment', 'ticketing', 'held-run', 'seating', 'stages', 'set-time', 'deals'].includes(win.kind)) paginateCompactWindow();
}

shortWindowQuery.addEventListener('change', () => {
  if (!el.win.hidden) syncTabs(el.winBody, `win:${win.kind}`);
});
phoneQuery.addEventListener('change', () => {
  setSheetSize('peek');
  syncTabs(el.panel, state.phase);
  if (!el.win.hidden) syncTabs(el.winBody, `win:${win.kind}`);
});

// ---------------------------------------------------------------------------
// Windows: a document the player opens on purpose, over the dimmed board. Escape, the
// Close button or a click outside closes it, and focus goes back to what opened it.

const win = { kind: null, opener: null };
window.addEventListener('resize', () => {
  if (el.win.hidden) return;
  if (win.kind === 'equipment') openEquipment(win.opener);
  if (win.kind === 'ticketing') openTicketing(win.opener);
  if (win.kind === 'held-run') openHeldRun(win.opener);
  if (win.kind === 'seating') openSeating(win.opener);
  if (win.kind === 'stages') openStages(win.opener);
  if (win.kind === 'set-time') openWindow('set-time', 'Set time', setTimeHtml(setTimeFor(state)), win.opener);
  if (win.kind === 'deals') openWindow('deals', 'Deal terms', dealHelpHtml(), win.opener);
});

// wide: the settlement's three columns. scrolls: only show history may scroll (decision 11).
function openWindow(kind, title, html, opener, { foot = '', wide = false, scrolls = false } = {}) {
  cancelLotGesture();
  setMenu(false, { focus: false });
  win.kind = kind;
  win.opener = opener || document.activeElement;
  el.winTitle.textContent = title;
  el.winBody.innerHTML = html;
  if (['equipment', 'ticketing', 'held-run', 'seating', 'stages', 'set-time', 'deals'].includes(kind) && innerHeight <= 560) foot = '<button disabled>Back</button><span>Part 1</span><button>More</button>';
  el.winFoot.innerHTML = foot;
  el.winFoot.hidden = !foot;
  el.win.dataset.kind = kind;
  el.win.classList.toggle('wide', wide);
  el.win.classList.toggle('scrolls', scrolls);
  el.win.hidden = false;
  el.winBody.scrollTop = 0;
  syncTabs(el.winBody, `win:${kind}`);
  if (['equipment', 'ticketing', 'held-run', 'seating', 'stages', 'set-time', 'deals'].includes(kind)) paginateCompactWindow();
  (el.winFoot.querySelector('.primary') || el.win.querySelector('[data-win="close"]')).focus();
}

// Redraws an open window after a change, keeping focus on the same control when it remains.
function refreshWindow(html) {
  const active = document.activeElement;
  const key = active && el.win.contains(active) && active.dataset.index !== undefined ? Number(active.dataset.index) : null;
  el.winBody.innerHTML = html;
  if (key === null) return;
  const chips = [...el.winBody.querySelectorAll('[data-act="remove"]')];
  const next = chips.find((c) => Number(c.dataset.index) >= key) || chips[chips.length - 1];
  (next || el.win.querySelector('[data-win="close"]')).focus();
}

function closeWindow({ focus = true } = {}) {
  if (el.win.hidden) return;
  el.win.hidden = true;
  win.kind = null;
  el.winBody.innerHTML = '';
  el.winFoot.innerHTML = '';
  if (focus && win.opener && document.contains(win.opener)) win.opener.focus();
  win.opener = null;
}

// ---------------------------------------------------------------------------
// The menu: full screen, the source link, the keys, save and load, the credit.

function resetModeButtons() {
  ui.confirmMode = null;
  el.menu.querySelectorAll('[data-act="mode"]').forEach((b) => { b.textContent = b.dataset.label; });
}

function setMenu(open, { focus = true } = {}) {
  if (open === !el.menu.hidden) return;
  if (!open) resetModeButtons();
  if (open) cancelLotGesture();
  el.menu.hidden = !open;
  el.menuBtn.setAttribute('aria-expanded', String(open));
  if (!focus) return;
  if (open) el.fullscreen.focus();
  else el.menuBtn.focus();
}

el.menuBtn.addEventListener('click', () => setMenu(el.menu.hidden));
el.menu.addEventListener('click', onAct);
$('#mode-note').textContent = `Career climbs from the ${D.VENUES.lot.name}. Sandbox opens every room with ${money(D.SANDBOX_CASH)}. Wet lot: rain is coming, the suggested layout is set, and you have ${money(D.SCENARIO_CASH)}.`;
$('#menu-close').addEventListener('click', () => setMenu(false));
const typing = (target) => !!target.closest('textarea, select, input:not([type="radio"]):not([type="checkbox"]):not([type="button"])');
// Keys anywhere on the page come from the binding table (controls.mjs). An open window takes
// only Escape and its own Tab loop.
document.addEventListener('keydown', (e) => {
  if (!el.win.hidden) {
    if (matches('close', e)) { e.preventDefault(); closeWindow(); return; }
    if (e.key === 'Tab') {
      const stops = [...el.win.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled])')].filter(e => e.getClientRects().length && e.tabIndex >= 0);
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    return;
  }
  if (matches('close', e) && !el.menu.hidden) { e.preventDefault(); setMenu(false); return; }
  if (matches('menu', e) && !e.target.closest('input, textarea, select')) { e.preventDefault(); setMenu(el.menu.hidden); return; }
  if (state.phase !== 'build' || !el.menu.hidden || typing(e.target)) return;
  if (matches('close', e)) { e.preventDefault(); selectTool(); return; }
  if (matches('pick-tool', e)) {
    e.preventDefault();
    const tool = e.key.toLowerCase() === 't' ? 'trailer' : e.key.toLowerCase() === 'd' ? 'delay' : e.key.toLowerCase() === 'v' ? 'vip-deck' : e.key.toLowerCase() === 'u' ? 'bus-compound' : PLACEABLE[Number(e.key) - 1];
    const type = D.OBJECT_TYPES[tool];
    if ((!type.lotOnly || state.venue.id === 'lot') && (!type.festivalOnly || state.venue.id === 'festival') && (!type.supportOnly || festivalSupportFor(state.venue))) pickTool(tool);
  } else if (matches('undo', e)) {
    e.preventDefault();
    undoLayout();
  } else if (matches('redo', e)) {
    e.preventDefault();
    redoLayout();
  }
});
document.addEventListener('pointerdown', (e) => {
  if (!el.menu.hidden && !el.menu.contains(e.target) && !el.menuBtn.contains(e.target)) setMenu(false, { focus: false });
});

function syncFullscreen() {
  const on = !!document.fullscreenElement;
  el.fullscreen.setAttribute('aria-pressed', String(on));
  el.fullscreen.textContent = on ? 'Leave full screen' : 'Full screen';
}
if (!document.documentElement.requestFullscreen) el.fullscreen.hidden = true;
el.fullscreen.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => { /* the browser said no */ });
});
document.addEventListener('fullscreenchange', syncFullscreen);

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
    resetHistory();
    persist();
    stopPlayback();
    ui.play = null;
    ui.mounted = null;
    render();
    setSaveStatus('Started a new game.');
    setMenu(false);
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
  resetHistory();
  persist();
  stopPlayback();
  ui.play = null;
  ui.mounted = null;
  render();
  setSaveStatus('Loaded the save code.');
  setMenu(false, { focus: !el.menu.hidden });
  return true;
}

// ---------------------------------------------------------------------------
// Automation hooks (the MIXMASH and MarsScape convention)

window.render_game_to_text = () => {
  const held = heldRunFor(state);
  const serviceView = board.info().serviceCrowd;
  const v = evaluateVenue(state.venue);
  const r = settlementFor(state);
  return JSON.stringify({
    game: 'front-of-house',
    phase: state.phase,
    build: state.phase === 'build' ? {
      tool: ui.tool, selected: ui.selection === null ? null : state.venue.objects[ui.selection], cursor: ui.cursor,
      coordinates: 'logical tiles; origin at grid minimum; x right, y toward stage front at rotation 0',
      dialog: win.kind, undo: history.undo.length, redo: history.redo.length,
    } : null,
    cash: state.cash,
    deal: state.booking.deal,
    artist: state.booking.artistId,
    offers: state.phase === 'book' ? offersFor(state) : null,
    career: (({ shows, sellouts, venueRep, loyalAct, goalMet, clubUnlocked, nextShowCost, canAffordAShow }) =>
      ({ shows, sellouts, venueRep, loyalAct, goalMet, clubUnlocked, nextShowCost, canAffordAShow }))(careerProgress(state)),
    venue: { objects: state.venue.objects.length, capacity: v.capacity, ready: v.ready, missing: v.missing },
    touring: festivalSupportFor(state.venue) || v.vipDecks || v.busCompounds ? { version: state.venue.support?.version ?? null, vipDecks: v.vipDecks, busCompounds: v.busCompounds, cost: v.vipDeckCost + v.busCompoundCost, notice: state.supportNotice || null } : null,
    room: roomProfileFor(state.venue) || v.delays ? { version: state.venue.profile?.version ?? null, house: v.housePa, ...(v.houseLights ? { houseLights: true, rentedLights: v.rentedLights } : {}), soundCapacity: v.soundCapacity ?? D.PA_COVERAGE[v.paTier] ?? 0, ...(v.delays ? { delays: v.delays, delayTiles: v.delayTiles, delayCost: v.delayCost, delayActive: v.delayActive } : {}), clearTiles: v.clearTiles, blockedTiles: v.blockedTiles, overlayClearTiles: sight().clear.size, overlayBlockedTiles: sight().blocked.size, notice: state.roomNotice || null } : null,
    promotion: state.promotion,
    show: state.show,
    setTime: setTimeFor(state),
    playback: ui.play ? { progress: Number(ui.play.p.toFixed(3)), paused: !!ui.play.paused } : null,
    crowd: crowdNow(),
    services: liveServicesFor(state),
    serviceView: serviceView ? { coordinates: 'logical tiles; admission samples outside the grid', totals: serviceView.totals, shown: serviceView.shown, worker: serviceView.worker, representative: serviceView.representative, transitions: serviceView.transitions, diagnostic: serviceView.diagnostic } : null,
    stages: state.venue.id === 'festival' ? { terms: stagePlanFor(state), bookingPolicy: festivalPolicyFor(state), eligibleOpeners: state.phase === 'book' ? stageOpenersFor(state) : null, forecast: state.phase === 'promote' ? stageForecastFor(state) : null, receipt: r?.stageAccounts || null, notice: state.stagesNotice || null } : null,
    seating: seatingPlanFor(state) ? { terms: seatingPlanFor(state), forecast: state.phase === 'promote' ? seatingForecastFor(state) : null, receipt: r?.seating || null, notice: state.seatingNotice || null } : null,
    heldRun: held ? { terms: held.terms, feeEach: held.feeEach, completedNights: state.show ? state.show.night - (['settle', 'done'].includes(state.phase) ? 0 : 1) : 0, cancellationAfterCurrentNight: state.show ? { remaining: held.remaining, penalty: held.penalty } : null, cancelled: state.show?.cancelled === true, notice: state.runNotice || null } : null,
    ticketing: state.venue.id === 'club' ? { terms: ticketingPlanFor(state), forecast: state.phase === 'promote' ? ticketingForecastFor(state) : null, receipt: r?.ticketing || null, notice: state.ticketingNotice || null } : null,
    equipment: state.equipment ? { assets: equipmentFor(state).assets, deployment: equipmentPlanFor(state), journal: careerLedgerFor(state), notice: state.equipmentNotice || null } : null,
    development: state.research ? { ...researchFor(state), booked: researchEffectsFor(state).learned } : null,
    settlement: r ? { attendance: r.attendance, satisfaction: r.satisfaction, net: r.net, result: r.result, doorRush: r.doorRush } : null,
    history: state.history.length,
  });
};
window.__frontOfHouse = {
  state: () => JSON.parse(JSON.stringify(state)),
  act: (action) => act(action),
  skip: () => skipToIncident(),
  importCode,
  buildTools: () => ({ tool: ui.tool, selection: ui.selection, undo: history.undo.length, redo: history.redo.length }),
  board: () => board.info(),
  rendererStatus: () => board.status(),
  siteMap: () => siteMap.info(),
  rendererRetry: () => board.retry(),
  boardCamera: (value) => value ? board.setCamera(value) : board.camera(),
  boardPreset: (name) => board.preset(name),
  boardPlace: (x, y) => board.placeOf(x, y),
  boardZoom: (zoom, px, py) => board.zoomTo(zoom, px, py),
  boardClientOf: (x, y, z) => board.clientOf(x, y, z),
  boardTileAt: (clientX, clientY) => board.tileAt(clientX, clientY),
};

// ---------------------------------------------------------------------------
// Boot

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#theme-toggle').setAttribute('aria-pressed', String(theme === 'dark'));
  try { localStorage.setItem('front_of_house_theme', theme); } catch { /* Play remains available without storage. */ }
}
let savedTheme = 'light';
try { if (localStorage.getItem('front_of_house_theme') === 'dark') savedTheme = 'dark'; } catch { /* Use the default. */ }
setTheme(savedTheme);
$('#theme-toggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

persist();
window.addEventListener('resize', queueLayout);
if ('ResizeObserver' in window) {
  const watch = new ResizeObserver(queueLayout);
  watch.observe(el.topbar);
  watch.observe(el.panel);
}
// The shared nav is built when the document finishes parsing; the strip makes room for it.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queueLayout, { once: true });
layoutBoard();
render();
