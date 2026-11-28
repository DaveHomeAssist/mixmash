/**
 * MixKit report contract (quality operations, schema 1)
 *
 * One problem and evidence model for every MixMash game. Player reports sent
 * from a game, and findings written by an audit, both pass through this file:
 *
 *   validateReport(input)        -> { ok: true, report } | { ok: false, errors }
 *   toNotionProperties(report)   -> property payload for the studio issue backlog
 *
 * The browser client (src/kit/report.js) validates with it before sending, the
 * intake Worker (workers/report-intake) validates again before writing, and the
 * tests pin both ends to the same rules. Change the contract here, bump
 * REPORT_SCHEMA_VERSION when a change is not backward compatible, and keep the
 * Worker accepting the previous version until every game has shipped the new
 * client.
 *
 * Privacy: the contract carries no name, email, account or IP address. The
 * device line is a coarse browser and platform label, not a fingerprint.
 */

export const REPORT_SCHEMA_VERSION = 1;

/** Game ids as used in routes and data-game attributes, mapped to backlog labels. */
export const GAMES = Object.freeze({
  mixmash: 'MIXMASH',
  pitch: 'Pitch Riot',
  'hockey-havoc': 'Hockey Havoc',
  mars: 'MarsScape',
  garden: 'Garden OS',
  empires: 'Age of Dave',
  'front-of-house': 'Front of House',
  horseshoes: 'Horseshoes',
  hub: 'Studio Hub',
});

/** What the player is telling us. Maps to the backlog Type. */
export const KINDS = Object.freeze({
  problem: { type: 'Bug', label: 'Something went wrong' },
  idea: { type: 'Feature', label: 'I have an idea' },
});

/** Where it happened, in player words. Maps to the backlog Area (null leaves Area for triage). */
export const CATEGORIES = Object.freeze({
  controls: { area: 'Input & Controls', label: 'Controls' },
  touch: { area: 'Mobile & Touch', label: 'Touch or phone' },
  visuals: { area: 'Rendering & Assets', label: 'Graphics' },
  audio: { area: 'Audio', label: 'Sound' },
  saving: { area: 'Persistence & Recovery', label: 'Saving or progress' },
  gameplay: { area: 'Game Systems', label: 'Gameplay or rules' },
  menus: { area: 'UI & Accessibility', label: 'Menus or text' },
  other: { area: null, label: 'Something else' },
});

/** How much it hurts, in player words. Maps to the backlog Severity. */
export const IMPACTS = Object.freeze({
  blocks: { severity: 'High', label: 'I can’t keep playing' },
  hurts: { severity: 'Medium', label: 'It makes the game worse' },
  minor: { severity: 'Low', label: 'Small thing' },
});

/**
 * Who found it. Only `player` is accepted from the public intake endpoint;
 * the audit sources are written by audit tooling with the same mapping.
 */
export const SOURCES = Object.freeze({
  player: 'Player Report',
  'claude-audit': 'Claude Audit',
  'codex-audit': 'Codex Audit',
  'manual-test': 'Manual Test',
});

export const PUBLIC_SOURCES = Object.freeze(['player']);

export const LIMITS = Object.freeze({
  summaryMin: 5,
  summary: 280,
  steps: 1500,
  revision: 80,
  screenshotUrl: 500,
  page: 200,
  device: 200,
  viewport: 60,
  inputMode: 20,
  /** Largest request body the Worker reads, in bytes. */
  body: 8192,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// C0 controls except tab and newline, DEL, C1 controls, bidi overrides and zero-width marks.
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/g;

const own = (table, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key);

/** Trim, drop control characters, normalise line endings, collapse runs of blank lines. */
export function cleanText(value, { multiline = false } = {}) {
  if (typeof value !== 'string') return '';
  let text = value.replace(/\r\n?/g, '\n').replace(CONTROL, '');
  text = multiline
    ? text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    : text.replace(/\s+/g, ' ');
  return text.trim();
}

function field(errors, name, raw, max, { required = false, min = 0, multiline = false } = {}) {
  const text = cleanText(raw, { multiline });
  if (!text) {
    if (required) errors.push(`${name} is required`);
    return '';
  }
  if (text.length < min) errors.push(`${name} must be at least ${min} characters`);
  if (text.length > max) errors.push(`${name} must be at most ${max} characters`);
  return text;
}

function httpsUrl(errors, raw) {
  const text = cleanText(raw);
  if (!text) return '';
  if (text.length > LIMITS.screenshotUrl) {
    errors.push(`screenshotUrl must be at most ${LIMITS.screenshotUrl} characters`);
    return '';
  }
  let url;
  try { url = new URL(text); } catch { url = null; }
  if (!url || url.protocol !== 'https:' || url.username || url.password) {
    errors.push('screenshotUrl must be an https link');
    return '';
  }
  return url.href;
}

/**
 * Validate and normalise a report. Unknown top-level keys are rejected so a
 * typo in a client never silently drops evidence.
 *
 * options.sources: the sources this caller may submit (default: every source).
 */
export function validateReport(input, { sources = Object.keys(SOURCES) } = {}) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['report must be a JSON object'] };
  }
  const allowed = new Set(['schema', 'reportId', 'source', 'game', 'revision', 'kind', 'category', 'impact', 'summary', 'steps', 'screenshotUrl', 'context']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) errors.push(`unknown field ${key}`);

  if (input.schema !== REPORT_SCHEMA_VERSION) errors.push(`schema must be ${REPORT_SCHEMA_VERSION}`);
  if (typeof input.reportId !== 'string' || !UUID.test(input.reportId)) errors.push('reportId must be a UUID');
  if (!own(SOURCES, input.source) || !sources.includes(input.source)) errors.push('source is not accepted here');
  if (!own(GAMES, input.game)) errors.push('game is not a MixMash game');
  if (!own(KINDS, input.kind)) errors.push('kind must be problem or idea');
  if (!own(CATEGORIES, input.category)) errors.push('category is not recognised');
  if (!own(IMPACTS, input.impact)) errors.push('impact is not recognised');

  const summary = field(errors, 'summary', input.summary, LIMITS.summary, { required: true, min: LIMITS.summaryMin });
  const steps = field(errors, 'steps', input.steps, LIMITS.steps, { multiline: true });
  const revision = field(errors, 'revision', input.revision, LIMITS.revision, { required: true });
  const screenshotUrl = httpsUrl(errors, input.screenshotUrl);

  const ctx = input.context;
  let context = { page: '', device: '', viewport: '', inputMode: '' };
  if (ctx !== undefined) {
    if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) {
      errors.push('context must be an object');
    } else {
      for (const key of Object.keys(ctx)) if (!(key in context)) errors.push(`unknown context field ${key}`);
      context = {
        page: field(errors, 'context.page', ctx.page, LIMITS.page),
        device: field(errors, 'context.device', ctx.device, LIMITS.device),
        viewport: field(errors, 'context.viewport', ctx.viewport, LIMITS.viewport),
        inputMode: field(errors, 'context.inputMode', ctx.inputMode, LIMITS.inputMode),
      };
    }
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    report: {
      schema: REPORT_SCHEMA_VERSION,
      reportId: input.reportId.toLowerCase(),
      source: input.source,
      game: input.game,
      revision,
      kind: input.kind,
      category: input.category,
      impact: input.impact,
      summary,
      steps,
      screenshotUrl,
      context,
    },
  };
}

const richText = (content) => ({ rich_text: content ? [{ type: 'text', text: { content } }] : [] });
const select = (name) => ({ select: name ? { name } : null });

/**
 * Notion property payload for one validated report, using the property names
 * of the studio issue backlog. Rows land as Not started for triage.
 */
export function toNotionProperties(report) {
  const notes = [
    `${KINDS[report.kind].label}. Where: ${CATEGORIES[report.category].label}. Impact: ${IMPACTS[report.impact].label}.`,
    report.context.page ? `Page: ${report.context.page}` : '',
    report.context.inputMode ? `Input: ${report.context.inputMode}` : '',
    report.screenshotUrl ? 'Screenshot link came from the reporter and is unchecked.' : '',
    `Report schema ${report.schema}.`,
  ].filter(Boolean).join('\n');

  const properties = {
    Issue: { title: [{ type: 'text', text: { content: report.summary } }] },
    Status: { status: { name: 'Not started' } },
    Severity: select(IMPACTS[report.impact].severity),
    Type: select(KINDS[report.kind].type),
    Source: select(SOURCES[report.source]),
    Game: select(GAMES[report.game]),
    Revision: richText(report.revision),
    Steps: richText(report.steps),
    Device: richText(report.context.device),
    Viewport: richText(report.context.viewport),
    Screenshot: { url: report.screenshotUrl || null },
    'Report ID': richText(report.reportId),
    Notes: richText(notes),
  };
  const area = CATEGORIES[report.category].area;
  if (area) properties.Area = select(area);
  return properties;
}
