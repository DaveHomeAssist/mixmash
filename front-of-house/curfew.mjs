// Versioned outdoor set timing; minutes are elapsed from 19:00 doors.
import { SET_SCHEDULE } from './data.mjs';
export { SET_SCHEDULE };
export function curfewTerms(raw, venueId) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1
    || !['amphitheater', 'festival'].includes(venueId)) throw new TypeError('Invalid curfew terms');
  return { version: 1 };
}
export function setTiming({ incidentId = null, incidentAt = 1, responseId = null } = {}) {
  if (!Number.isFinite(incidentAt) || incidentAt < 0 || incidentAt > 1) throw new TypeError('Invalid incident time');
  const { start, close, extension } = SET_SCHEDULE;
  let end = close;
  const curtailed = incidentId === 'curfew' && responseId !== null;
  if (curtailed) {
    if (!['obey', 'appeal'].includes(responseId)) throw new TypeError('Invalid curfew response');
    end = Math.min(close, Math.max(start, Math.round(incidentAt * close)) + (responseId === 'appeal' ? extension : 0));
  }
  return { start, plannedEnd: close, end, played: end - start, lost: close - end,
    curtailed, walkupMult: end / close, barMult: (end - start) / (close - start) };
}
