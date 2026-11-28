// Report contract (src/kit/report-schema.mjs): one problem and evidence model
// for player reports and audit findings.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES, GAMES, IMPACTS, KINDS, LIMITS, PUBLIC_SOURCES, REPORT_SCHEMA_VERSION, SOURCES,
  cleanText, toNotionProperties, validateReport,
} from '../src/kit/report-schema.mjs';
import { games as HUB_GAMES } from '../src/hub/catalog.mjs';

const base = () => ({
  schema: REPORT_SCHEMA_VERSION,
  reportId: '3F2B8C1E-9D4A-4E6B-8A1C-2B3D4E5F6A7B',
  source: 'player',
  game: 'pitch',
  revision: 'page modified 2026-11-28T19:00Z',
  kind: 'problem',
  category: 'controls',
  impact: 'blocks',
  summary: '  Sprint   stops working after halftime  ',
  steps: 'Played first half\r\n\r\n\r\n\r\nPressed shift after the show',
  screenshotUrl: 'https://example.com/shot.png',
  context: { page: '/pitch/', device: 'Chrome on Mac, no touch', viewport: '1280x720 @2x', inputMode: 'keyboard' },
});

test('a complete player report validates and normalises', () => {
  const result = validateReport(base(), { sources: PUBLIC_SOURCES });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.report.reportId, '3f2b8c1e-9d4a-4e6b-8a1c-2b3d4e5f6a7b');
  assert.equal(result.report.summary, 'Sprint stops working after halftime');
  assert.equal(result.report.steps, 'Played first half\n\nPressed shift after the show');
});

test('summary, revision and the id are required', () => {
  const input = base();
  input.summary = 'hey';
  delete input.revision;
  input.reportId = 'not-a-uuid';
  const result = validateReport(input);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('summary must be at least 5 characters'));
  assert.ok(result.errors.includes('revision is required'));
  assert.ok(result.errors.includes('reportId must be a UUID'));
});

test('length limits hold after cleaning', () => {
  const input = base();
  input.summary = 'x'.repeat(LIMITS.summary + 1);
  assert.ok(validateReport(input).errors.includes(`summary must be at most ${LIMITS.summary} characters`));
  input.summary = 'x'.repeat(LIMITS.summary);
  assert.equal(validateReport(input).ok, true);
});

test('unknown fields and unknown enum values are rejected, not dropped', () => {
  const input = base();
  input.email = 'someone@example.com';
  input.context.ip = '203.0.113.9';
  input.game = 'tetris';
  input.impact = 'catastrophic';
  const { errors } = validateReport(input);
  assert.ok(errors.includes('unknown field email'));
  assert.ok(errors.includes('unknown context field ip'));
  assert.ok(errors.includes('game is not a MixMash game'));
  assert.ok(errors.includes('impact is not recognised'));
});

test('prototype keys never count as known values', () => {
  const input = base();
  input.game = 'constructor';
  input.category = '__proto__';
  const { errors } = validateReport(input);
  assert.ok(errors.includes('game is not a MixMash game'));
  assert.ok(errors.includes('category is not recognised'));
});

test('the public endpoint accepts player reports only', () => {
  const input = base();
  input.source = 'claude-audit';
  assert.ok(validateReport(input, { sources: PUBLIC_SOURCES }).errors.includes('source is not accepted here'));
  assert.equal(validateReport(input).ok, true, 'audit tooling may submit audit sources');
});

test('screenshot links must be plain https', () => {
  for (const bad of ['http://example.com/a.png', 'javascript:alert(1)', 'https://user:pw@example.com/a.png', 'not a url']) {
    const input = base();
    input.screenshotUrl = bad;
    assert.ok(validateReport(input).errors.includes('screenshotUrl must be an https link'), bad);
  }
  const input = base();
  input.screenshotUrl = '';
  assert.equal(validateReport(input).report.screenshotUrl, '');
});

test('cleanText strips control and bidi characters', () => {
  assert.equal(cleanText('a\u0000b‮c​d'), 'abcd');
  assert.equal(cleanText('one\ntwo', { multiline: false }), 'one two');
  assert.equal(cleanText(42), '');
});

test('every published hub game has a contract id', () => {
  for (const game of HUB_GAMES) assert.ok(game.id in GAMES, `${game.id} missing from report GAMES`);
});

test('Notion mapping matches the issue backlog fields', () => {
  const { report } = validateReport(base());
  const props = toNotionProperties(report);
  assert.equal(props.Issue.title[0].text.content, 'Sprint stops working after halftime');
  assert.deepEqual(props.Status, { status: { name: 'Not started' } });
  assert.equal(props.Severity.select.name, IMPACTS.blocks.severity);
  assert.equal(props.Type.select.name, KINDS.problem.type);
  assert.equal(props.Source.select.name, SOURCES.player);
  assert.equal(props.Game.select.name, 'Pitch Riot');
  assert.equal(props.Area.select.name, CATEGORIES.controls.area);
  assert.equal(props.Screenshot.url, 'https://example.com/shot.png');
  assert.equal(props['Report ID'].rich_text[0].text.content, report.reportId);
  assert.match(props.Notes.rich_text[0].text.content, /unchecked/);
});

test('Notion mapping leaves Area for triage and empty fields empty', () => {
  const input = base();
  input.category = 'other';
  input.steps = '';
  input.screenshotUrl = '';
  const props = toNotionProperties(validateReport(input).report);
  assert.equal('Area' in props, false);
  assert.deepEqual(props.Steps, { rich_text: [] });
  assert.equal(props.Screenshot.url, null);
});
