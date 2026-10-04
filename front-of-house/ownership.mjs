// Replayable one-family inventory and capital movements; placement belongs to the career adapter.
import { OWNED_EQUIPMENT } from './data.mjs';
export const OWNERSHIP_COMMAND_LIMIT = 512;
const copy = value => structuredClone(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_:-]{1,64}$/.test(value);

export function createOwnership() {
  return { version: 1, commands: [], assets: [], nextSerial: 1, ledger: [], acquired: 0, disposed: 0, cashDelta: 0 };
}

function commandFor(raw) {
  if (!object(raw) || !identifier(raw.id)) throw new TypeError('Invalid capital transaction ID');
  if (raw.kind === 'buy' && Object.hasOwn(OWNED_EQUIPMENT, raw.family)) return { id: raw.id, kind: 'buy', family: raw.family };
  if (raw.kind === 'sell' && identifier(raw.assetId)) return { id: raw.id, kind: 'sell', assetId: raw.assetId };
  throw new TypeError('Invalid equipment purchase or sale');
}

function transition(state, command) {
  let asset, delta;
  if (command.kind === 'buy') {
    if (state.assets.length) throw new Error('One owned small PA is already available');
    const rule = OWNED_EQUIPMENT[command.family];
    asset = { id: `pa_${state.nextSerial++}`, family: command.family, purchase: rule.purchase };
    state.assets.push(asset); delta = -rule.purchase; state.acquired += rule.purchase;
  } else {
    asset = state.assets.find(a => a.id === command.assetId);
    if (!asset) throw new Error('That asset is not owned');
    delta = OWNED_EQUIPMENT[asset.family].resale;
    state.assets = []; state.disposed += delta;
  }
  state.ledger.push({ id: command.id, assetId: asset.id, category: command.kind === 'buy' ? 'acquisition' : 'disposal', cashDelta: delta });
  state.commands.push(command); state.cashDelta += delta; return delta;
}

export function saveOwnership(state) {
  return copy({ version: 1, commands: state.commands });
}

export function loadOwnership(raw) {
  if (!object(raw) || raw.version !== 1 || !Array.isArray(raw.commands) || raw.commands.length > OWNERSHIP_COMMAND_LIMIT) throw new TypeError('Invalid equipment checkpoint');
  const state = createOwnership(), used = new Set();
  for (const rawCommand of raw.commands) {
    const command = commandFor(rawCommand);
    if (used.has(command.id)) throw new TypeError('Duplicate capital transaction ID');
    used.add(command.id); transition(state, command);
  }
  return state;
}

// Return only this command's cash movement; replay/import never pays it again.
export function applyOwnership(state, rawCommand, { cash = 0 } = {}) {
  try {
    const command = commandFor(rawCommand), next = loadOwnership(saveOwnership(state));
    const prior = next.commands.find(c => c.id === command.id);
    if (prior) {
      if (JSON.stringify(prior) !== JSON.stringify(command)) throw new Error('Capital transaction ID was already used for a different action');
      return { state: next, cashDelta: 0, error: null };
    }
    if (next.commands.length >= OWNERSHIP_COMMAND_LIMIT) throw new Error('Equipment transaction history is full; new purchases and sales are unavailable');
    if (command.kind === 'buy' && (!Number.isSafeInteger(cash) || cash < OWNED_EQUIPMENT[command.family].purchase)) throw new Error('Not enough cash to buy this equipment');
    const cashDelta = transition(next, command);
    return { state: next, cashDelta, error: null };
  } catch (error) { return { state, cashDelta: 0, error: error.message }; }
}
