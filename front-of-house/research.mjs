// Three-project development authority: replayable progress and separate cash deltas.
import { RESEARCH_PROJECTS } from './data.mjs';
export const RESEARCH_DEPARTMENTS = Object.freeze(['production', 'guestServices', 'admissions', 'venueOperations']);
export const RESEARCH_COMMAND_LIMIT = 2048;
const ids = Object.keys(RESEARCH_PROJECTS), copy = value => structuredClone(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function createResearch(mode = 'career') {
  if (!['career', 'scenario', 'sandbox'].includes(mode)) throw new TypeError('Invalid research mode');
  return { version: 1, mode, commands: [], active: null, settledNights: [],
    experience: Object.fromEntries(RESEARCH_DEPARTMENTS.map(id => [id, 0])),
    projects: Object.fromEntries(ids.map(id => [id, { status: mode === 'sandbox' ? 'researched' : RESEARCH_PROJECTS[id].experience ? 'locked' : 'available', progress: mode === 'sandbox' ? RESEARCH_PROJECTS[id].nights : 0 }])),
    learned: mode === 'sandbox' ? [...ids] : [], ledger: [], spent: 0, refunded: 0 };
}

function commandFor(raw) {
  if (!object(raw)) throw new TypeError('Invalid research command');
  if (raw.kind === 'night') {
    if (typeof raw.id !== 'string' || !/^[a-zA-Z0-9_:-]{1,96}$/.test(raw.id)) throw new TypeError('Invalid research night ID');
    if (!object(raw.departments) || RESEARCH_DEPARTMENTS.some(id => typeof raw.departments[id] !== 'boolean')) throw new TypeError('Invalid department eligibility');
    return { kind: 'night', id: raw.id, departments: Object.fromEntries(RESEARCH_DEPARTMENTS.map(id => [id, raw.departments[id]])) };
  }
  if (!['start', 'pause', 'resume', 'cancel'].includes(raw.kind) || !Object.hasOwn(RESEARCH_PROJECTS, raw.project)) throw new TypeError('Invalid research project action');
  return { kind: raw.kind, project: raw.project };
}

function refresh(state) {
  for (const id of ids) {
    const project = state.projects[id], rule = RESEARCH_PROJECTS[id];
    if (['locked', 'available'].includes(project.status)) project.status = state.experience[rule.department] >= rule.experience ? 'available' : 'locked';
  }
  state.learned = ids.filter(id => state.projects[id].status === 'researched');
}

function transition(state, command) {
  let delta = 0;
  if (command.kind === 'night') {
    if (state.settledNights.includes(command.id)) throw new Error('Research night is already recorded');
    state.settledNights.push(command.id);
    for (const department of RESEARCH_DEPARTMENTS) if (command.departments[department]) state.experience[department]++;
    if (state.active) {
      const id = state.active, project = state.projects[id], rule = RESEARCH_PROJECTS[id];
      if (command.departments[rule.department] && ++project.progress === rule.nights) {
        project.status = 'researched'; state.active = null;
      }
    }
  } else {
    const id = command.project, project = state.projects[id], rule = RESEARCH_PROJECTS[id];
    if (command.kind === 'start') {
      if (project.status === 'researched') throw new Error('Project is already researched');
      if (project.status !== 'available') throw new Error(project.status === 'locked' ? `Requires ${rule.experience} ${rule.department} experience` : 'Project has already started');
      if (state.active) throw new Error('The development slot is occupied');
      project.status = 'active'; project.progress = 0; state.active = id; delta = -rule.cost;
    } else if (command.kind === 'pause') {
      if (state.active !== id || project.status !== 'active') throw new Error('Only an active project can pause');
      project.status = 'paused'; state.active = null;
    } else if (command.kind === 'resume') {
      if (project.status !== 'paused') throw new Error('Only a paused project can resume');
      if (state.active) throw new Error('The development slot is occupied');
      project.status = 'active'; state.active = id;
    } else {
      if (!['active', 'paused'].includes(project.status)) throw new Error('Only unfinished research can be cancelled');
      delta = Math.floor(rule.cost * (rule.nights - project.progress) / rule.nights);
      if (state.active === id) state.active = null;
      project.status = 'available'; project.progress = 0;
    }
  }
  if (delta) {
    state.ledger.push({ id: `research:${state.commands.length + 1}`, project: command.project,
      kind: delta < 0 ? 'development' : 'refund', cashDelta: delta });
    if (delta < 0) state.spent -= delta; else state.refunded += delta;
  }
  state.commands.push(command); refresh(state); return delta;
}

export function saveResearch(state) {
  return copy({ version: 1, mode: state.mode, commands: state.commands });
}

export function loadResearch(raw) {
  if (!object(raw) || raw.version !== 1 || !['career', 'scenario', 'sandbox'].includes(raw.mode) || !Array.isArray(raw.commands) || raw.commands.length > RESEARCH_COMMAND_LIMIT) throw new TypeError('Invalid research checkpoint');
  const state = createResearch(raw.mode);
  for (const rawCommand of raw.commands) transition(state, commandFor(rawCommand));
  return state;
}

// The career adapter applies only this command's delta. Loading pays/refunds nothing.
export function applyResearch(state, rawCommand, { cash = 0 } = {}) {
  try {
    const command = commandFor(rawCommand), next = loadResearch(saveResearch(state));
    if (command.kind === 'night' && next.settledNights.includes(command.id)) return { state: next, cashDelta: 0, error: null };
    if (next.commands.length >= RESEARCH_COMMAND_LIMIT) throw new Error('Research history is full; no new development command was applied');
    if (command.kind === 'start' && next.projects[command.project].status === 'available' && !next.active && (!Number.isSafeInteger(cash) || cash < RESEARCH_PROJECTS[command.project].cost)) throw new Error('Not enough cash for this development project');
    const cashDelta = transition(next, command);
    return { state: next, cashDelta, error: null };
  } catch (error) { return { state, cashDelta: 0, error: error.message }; }
}

export function researchRefundFor(state, id) {
  if (!Object.hasOwn(RESEARCH_PROJECTS, id)) throw new TypeError('Invalid research project');
  const clean = loadResearch(saveResearch(state)), project = clean.projects[id], rule = RESEARCH_PROJECTS[id];
  return ['active', 'paused'].includes(project.status) ? Math.floor(rule.cost * (rule.nights - project.progress) / rule.nights) : 0;
}
