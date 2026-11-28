/**
 * MixKit problem report (quality operations pilot)
 *
 * An in-game "Report a problem" form that sends one report, shaped by
 * src/kit/report-schema.mjs, to the MixMash report intake Worker. Load it as a
 * module after the game's markup:
 *
 *   <button data-report-open hidden>Report a problem</button>
 *   <script type="module" src="../src/kit/report.js" data-mixkit-report
 *           data-game="pitch" data-endpoint="https://…/v1/reports"></script>
 *
 * Nothing shows until data-endpoint is set: with no endpoint the triggers stay
 * hidden and MixKit.report.enabled is false, so a game can ship the markup
 * before the Worker exists. data-revision names the build; without it the
 * report carries the page's Last-Modified time from the host.
 *
 * The open dialog stops key events from reaching the game, so typing a space
 * or WASD never moves a player, and Escape closes the form instead of
 * resuming play. The game decides when to offer the form (Pitch Riot offers it
 * from Pause and Full Time, where play is already stopped).
 *
 *   MixKit.report.enabled      boolean
 *   MixKit.report.open()       opens the form (no-op when disabled)
 */
import { CATEGORIES, IMPACTS, KINDS, LIMITS, REPORT_SCHEMA_VERSION, validateReport } from './report-schema.mjs';

const SEND_TIMEOUT_MS = 10000;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Coarse device label: browser family, platform and pointer. Not a fingerprint. */
export function describeDevice(nav = {}, matchMedia) {
  const ua = String(nav.userAgent || '');
  const brand = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /CriOS\/|Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Other browser';
  const platform = /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && Number(nav.maxTouchPoints) > 1) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Macintosh|Mac OS X/.test(ua) ? 'Mac'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'other platform';
  let pointer = Number(nav.maxTouchPoints) > 0 ? 'touch' : 'no touch';
  try {
    if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) pointer = 'coarse pointer';
  } catch { /* matchMedia unavailable */ }
  return `${brand} on ${platform}, ${pointer}`;
}

/** Context the player does not type: page, device, viewport and input mode. */
export function collectContext(win) {
  const doc = win.document || {};
  const root = doc.documentElement;
  const dpr = Number(win.devicePixelRatio) || 1;
  return {
    page: String((win.location && win.location.pathname) || '').slice(0, LIMITS.page),
    device: describeDevice(win.navigator, win.matchMedia && win.matchMedia.bind(win)).slice(0, LIMITS.device),
    viewport: `${Math.round(win.innerWidth || 0)}x${Math.round(win.innerHeight || 0)} @${Math.round(dpr * 100) / 100}x`,
    inputMode: String((root && root.getAttribute && root.getAttribute('data-input-mode')) || '').slice(0, LIMITS.inputMode),
  };
}

/** A revision label: the declared one, else the host's Last-Modified time for the page. */
export function resolveRevision(declared, lastModified) {
  const named = String(declared || '').trim();
  if (named) return named.slice(0, LIMITS.revision);
  const when = new Date(lastModified || '');
  return Number.isNaN(when.getTime()) ? 'unknown build' : `page modified ${when.toISOString().slice(0, 16)}Z`;
}

/** Build a contract report from the form's values. Returns validateReport's result. */
export function buildReport(values, { game, revision, context, reportId }) {
  const kind = values.kind === 'idea' ? 'idea' : 'problem';
  return validateReport({
    schema: REPORT_SCHEMA_VERSION,
    reportId,
    source: 'player',
    game,
    revision,
    kind,
    category: values.category,
    impact: kind === 'idea' ? 'minor' : values.impact,
    summary: values.summary,
    steps: values.steps,
    screenshotUrl: values.screenshotUrl,
    context,
  }, { sources: ['player'] });
}

/** POST one report. Resolves { ok, status, duplicate?, errors? }; never throws. */
export async function sendReport(endpoint, report, fetchImpl = fetch, timeoutMs = SEND_TIMEOUT_MS) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      signal: controller ? controller.signal : undefined,
    });
    let body = {};
    try { body = await response.json(); } catch { body = {}; }
    return { ok: response.ok && body.ok === true, status: response.status, duplicate: Boolean(body.duplicate), errors: body.errors || [] };
  } catch {
    return { ok: false, status: 0, errors: [] };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Player-facing line for a failed send. */
export function failureMessage(result) {
  if (result.status === 0) return 'Couldn’t reach the report service. Check your connection and try again. Your text is still here.';
  if (result.status === 429) return 'Too many reports in a row. Wait a minute, then send again.';
  if (result.status === 400) return 'Something in the form didn’t fit. Shorten the text and try again.';
  return 'The report service is having trouble right now. Try again in a little while.';
}

function newReportId(win) {
  if (win.crypto && typeof win.crypto.randomUUID === 'function') return win.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  win.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const STYLE = `
.mixkit-report{border:0;padding:0;margin:auto;width:min(520px,calc(100vw - 24px));max-height:calc(100dvh - 24px);
  border-radius:16px;background:var(--mixkit-report-bg);color:var(--mixkit-report-fg);
  box-shadow:0 20px 60px rgba(0,0,0,.55);font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;
  --mixkit-report-bg:#14141f;--mixkit-report-fg:#f0f0f8;--mixkit-report-muted:#a6a6c4;--mixkit-report-line:#33334d;
  --mixkit-report-field:#0b0b14;--mixkit-report-accent:#ffe23d;--mixkit-report-accent-fg:#14141f;--mixkit-report-bad:#ff8a8a;--mixkit-report-good:#5dffa5}
@media (prefers-color-scheme: light){.mixkit-report{--mixkit-report-bg:#ffffff;--mixkit-report-fg:#16161f;--mixkit-report-muted:#56566e;
  --mixkit-report-line:#d4d4e2;--mixkit-report-field:#f5f5fa;--mixkit-report-accent:#1f3bd6;--mixkit-report-accent-fg:#ffffff;--mixkit-report-bad:#b3261e;--mixkit-report-good:#1b7a3e}}
.mixkit-report::backdrop{background:rgba(0,0,0,.6)}
.mixkit-report form{display:flex;flex-direction:column;gap:12px;padding:20px;max-height:inherit;overflow:auto;box-sizing:border-box}
.mixkit-report h2{margin:0;font-size:1.25rem}
.mixkit-report fieldset{border:0;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.mixkit-report legend,.mixkit-report label.mixkit-report-label{display:block;font-weight:600;margin-bottom:6px;width:100%}
.mixkit-report .mixkit-report-choice{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;border:1px solid var(--mixkit-report-line);border-radius:10px;cursor:pointer}
.mixkit-report input[type=radio]{width:20px;height:20px;margin:0;accent-color:var(--mixkit-report-accent)}
.mixkit-report select,.mixkit-report textarea,.mixkit-report input[type=url]{width:100%;box-sizing:border-box;min-height:44px;padding:10px 12px;
  border:1px solid var(--mixkit-report-line);border-radius:10px;background:var(--mixkit-report-field);color:inherit;font:inherit}
.mixkit-report textarea{resize:vertical}
.mixkit-report .mixkit-report-hint{margin:0;color:var(--mixkit-report-muted);font-size:.85rem}
.mixkit-report .mixkit-report-trap{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}
.mixkit-report .mixkit-report-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
.mixkit-report button{min-height:44px;min-width:44px;padding:0 18px;border-radius:10px;font:inherit;font-weight:700;cursor:pointer;border:1px solid var(--mixkit-report-line);background:transparent;color:inherit}
.mixkit-report button[type=submit]{background:var(--mixkit-report-accent);color:var(--mixkit-report-accent-fg);border-color:transparent}
.mixkit-report button:disabled{opacity:.6;cursor:progress}
.mixkit-report :focus-visible{outline:3px solid var(--mixkit-report-accent);outline-offset:2px}
.mixkit-report [data-status]{margin:0;min-height:1.4em}
.mixkit-report [data-status=bad]{color:var(--mixkit-report-bad)}
.mixkit-report [data-status=good]{color:var(--mixkit-report-good)}
`;

const options = (table) => Object.entries(table).map(([value, item]) => `<option value="${value}">${item.label}</option>`).join('');
const radios = (name, table, checked) => Object.entries(table).map(([value, item]) =>
  `<label class="mixkit-report-choice"><input type="radio" name="${name}" value="${value}"${value === checked ? ' checked' : ''}> ${item.label}</label>`).join('');

function buildDialog(doc) {
  const dialog = doc.createElement('dialog');
  dialog.className = 'mixkit-report';
  dialog.setAttribute('aria-labelledby', 'mixkit-report-title');
  dialog.innerHTML = `
<form method="dialog" novalidate>
  <h2 id="mixkit-report-title">Report a problem</h2>
  <fieldset><legend>What is this?</legend>${radios('kind', KINDS, 'problem')}</fieldset>
  <div><label class="mixkit-report-label" for="mixkit-report-category">Where did it happen?</label>
    <select id="mixkit-report-category" name="category">${options(CATEGORIES)}</select></div>
  <fieldset data-impact><legend>How bad is it?</legend>${radios('impact', IMPACTS, 'hurts')}</fieldset>
  <div><label class="mixkit-report-label" for="mixkit-report-summary">What happened?</label>
    <textarea id="mixkit-report-summary" name="summary" rows="3" maxlength="${LIMITS.summary}" required></textarea></div>
  <div><label class="mixkit-report-label" for="mixkit-report-steps">What were you doing just before? (optional)</label>
    <textarea id="mixkit-report-steps" name="steps" rows="3" maxlength="${LIMITS.steps}"></textarea></div>
  <div><label class="mixkit-report-label" for="mixkit-report-shot">Screenshot or video link (optional)</label>
    <input id="mixkit-report-shot" name="screenshotUrl" type="url" inputmode="url" placeholder="https://" maxlength="${LIMITS.screenshotUrl}"></div>
  <div class="mixkit-report-trap" aria-hidden="true"><label>Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label></div>
  <p class="mixkit-report-hint">Sent with your report: the game, its build, this page, your browser and device type, and your screen size. No name, email or account.</p>
  <p data-status role="status" aria-live="polite"></p>
  <div class="mixkit-report-actions">
    <button type="button" data-cancel>Cancel</button>
    <button type="submit">Send report</button>
  </div>
</form>`;
  return dialog;
}

function mount(win) {
  const doc = win.document;
  const script = doc.querySelector('script[data-mixkit-report]');
  const MixKit = win.MixKit = win.MixKit || {};
  if (MixKit.report) return;
  const api = { enabled: false, open() {} };
  MixKit.report = api;
  if (!script) return;

  const override = LOCAL_HOSTS.has(win.location.hostname) ? win.__MIXKIT_REPORT_ENDPOINT__ : '';
  const endpoint = String(override || script.getAttribute('data-endpoint') || '').trim();
  const game = script.getAttribute('data-game') || '';
  if (!endpoint || !/^https?:\/\//.test(endpoint)) return;

  const style = doc.createElement('style');
  style.textContent = STYLE;
  doc.head.appendChild(style);

  const dialog = buildDialog(doc);
  doc.body.appendChild(dialog);
  const form = dialog.querySelector('form');
  const status = dialog.querySelector('[data-status]');
  const submit = form.querySelector('button[type=submit]');
  const impact = dialog.querySelector('[data-impact]');
  let returnFocus = null;
  let reportId = newReportId(win);

  const setStatus = (text, tone) => { status.textContent = text; status.setAttribute('data-status', tone || ''); };
  const syncKind = () => { impact.hidden = form.elements.kind.value === 'idea'; };

  // Keys typed in the form belong to the form, never to the game underneath.
  for (const type of ['keydown', 'keyup', 'keypress']) dialog.addEventListener(type, (e) => e.stopPropagation());
  form.addEventListener('change', syncKind);
  dialog.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (returnFocus && returnFocus.focus) returnFocus.focus(); });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.elements.website.value) { setStatus('Thanks, your report was sent.', 'good'); return; }
    const result = buildReport({
      kind: form.elements.kind.value,
      category: form.elements.category.value,
      impact: form.elements.impact.value,
      summary: form.elements.summary.value,
      steps: form.elements.steps.value,
      screenshotUrl: form.elements.screenshotUrl.value,
    }, {
      game,
      revision: resolveRevision(script.getAttribute('data-revision'), doc.lastModified),
      context: collectContext(win),
      reportId,
    });
    if (!result.ok) {
      const needsSummary = result.errors.some((e) => e.startsWith('summary'));
      const badLink = result.errors.some((e) => e.startsWith('screenshotUrl'));
      setStatus(needsSummary ? `Tell us what happened in at least ${LIMITS.summaryMin} characters.`
        : badLink ? 'The link needs to start with https://.' : 'Something in the form didn’t fit. Check it and try again.', 'bad');
      return;
    }
    submit.disabled = true;
    setStatus('Sending…');
    const sent = await sendReport(endpoint, result.report);
    submit.disabled = false;
    if (sent.ok) {
      setStatus('Thanks, your report was sent.', 'good');
      form.reset();
      syncKind();
      reportId = newReportId(win);
      win.setTimeout(() => { if (dialog.open) dialog.close(); }, 1400);
    } else {
      setStatus(failureMessage(sent), 'bad');
    }
  });

  api.enabled = true;
  api.open = () => {
    if (dialog.open) return;
    returnFocus = doc.activeElement;
    setStatus('');
    syncKind();
    dialog.showModal();
    form.elements.summary.focus();
  };
  for (const trigger of doc.querySelectorAll('[data-report-open]')) {
    trigger.hidden = false;
    trigger.addEventListener('click', () => api.open());
  }
}

if (typeof window !== 'undefined' && window.document) mount(window);
