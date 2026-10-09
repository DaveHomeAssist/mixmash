// Presentation-only Advisory desk. Readers never consume a draw or change a show.
import { artistFor, evaluateVenue, forecast, heldRunFor, liveAccessFor, liveServicesFor,
  offersFor, settlementFor, seatingPlanFor, stagePlanFor, termsFor, upfrontFor,
  venueSpec, equipmentPlanFor, sanitationPlanFor, festivalPolicyFor } from './engine.mjs';

const PARTS = { sound: 'Sound and light', sightlines: 'Sightlines', amenities: 'Bars and restrooms', flow: 'Entry flow', incident: 'Incident handling' };
const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const route = (target, label = 'Review') => ({ target, label });
const row = (label, value) => ({ label, value: String(value) });

// Mirror only public pre-door refusal evidence, in the engine's validation order.
// Never probe confirmPromotion: it would create a hidden incident in a copied state.
function doorReason(state, enabled) {
  const v = evaluateVenue(state.venue), policy = festivalPolicyFor(state);
  if (policy?.sponsorPrice !== undefined && state.promotion.price !== policy.sponsorPrice) return `Restore the sponsor ticket price of $${policy.sponsorPrice} before opening`;
  if (enabled && (state.venue.id !== 'lot' || !v.bars)) return 'Live services needs the Lot and a bar, without the doors snapshot';
  const access = state.venue.id === 'lot' && enabled ? liveAccessFor(state) : null;
  if (access && (!access.usableGates || !access.usableExits || !access.usableBars)) return 'Connect admission, a bar and an exit to the main audience floor before opening doors';
  if (state.promotion.foodPlan && (!enabled || access?.usableVendors !== 1)) return 'Food needs live services and one connected stall before doors';
  const equipment = equipmentPlanFor(state);
  if (equipment && !equipment.eligible) return 'The assigned asset needs a placed small PA before doors';
  const facilities = sanitationPlanFor(state);
  if (state.venue.objects.some(o => o.type === 'trailer') && !facilities) return 'Enable sanitation for the placed trailer before doors';
  if (facilities) {
    if (!enabled) return 'Sanitation needs the live Lot clock';
    if (!facilities.usableStalls) return 'Connect usable sanitation before doors; the trailer also needs utilities';
    if (facilities.terms.utilities && !facilities.terms.trailer) return 'Utilities need a placed trailer';
    if (facilities.terms.preference && !facilities.preference.available) return 'The optional changing area needs Sodium Arcade, a connected powered trailer and a cleaner';
  }
  const due = upfrontFor(state);
  return state.mode !== 'sandbox' && due > state.cash ? `This show needs $${due} before doors, but you have $${state.cash}` : null;
}

export function advisoryFor(state, { incidentPrompt = null, liveServicesEnabled = state.promotion.liveServices === true } = {}) {
  const phase = state.phase, v = evaluateVenue(state.venue), spec = venueSpec(state.venue);
  const pre = phase === 'build' || phase === 'promote';
  const finished = phase === 'settle' || phase === 'done';
  const result = finished ? settlementFor(state) : null;
  const service = phase === 'show' ? liveServicesFor(state) : null;
  const lock = phase === 'book' ? 'Choose an act and deal before production and ticket planning.'
    : pre ? null : 'Booking, layout and ticket terms are locked for this show. Review recorded terms; edits belong to the next booking.';
  const sections = {
    Ticketing: { title: 'Ticket planning', detail: 'Not available for this show yet. Set a price and promotion after locking the layout.', rows: [], action: route('phase', 'Review booking'), lock },
    Talent: { title: 'Artist and deal', detail: 'Review the available acts and their offered terms.', rows: [], action: route('deals', 'Review deal terms'), lock },
    Operations: { title: 'Production readiness', detail: 'Choose a booking, then build or adjust the venue.', rows: [], action: route('phase', 'Review booking'), lock },
  };
  const artist = artistFor(state.booking.artistId);
  if (phase === 'book') {
    sections.Talent.rows = [row('Available acts', offersFor(state).map(id => artistFor(id).name).join(' · '))];
  } else {
    const ask = state.booking.terms || termsFor(artist.id, state.reputation.artists[artist.id]);
    sections.Talent.rows = [row('Artist', artist.name), row('Deal', { guarantee: 'Guarantee', door: 'Door deal', sponsor: 'Sponsor' }[state.booking.deal]), row('Artist relationship', state.reputation.artists[artist.id] || 0)];
    sections.Talent.detail = pre ? 'These are the booked terms. Payment timing is separate from final promoter profit.' : 'Review the booked deal and payment timing; signing remains in settlement.';
    if (pre && state.booking.deal === 'guarantee') sections.Talent.rows.push(row('Main guarantee before doors', money(ask.ask)));
    if (heldRunFor(state)) { sections.Talent.action = route('held-run', 'Review held nights'); sections.Talent.detail += ' This booking includes held nights.'; }
  }
  if (pre) {
    const f = forecast(state);
    sections.Ticketing = { title: 'Forecast, not a promise', detail: 'The actual draw stays hidden. Review price and promotion before opening doors.',
      rows: [row('Forecast crowd', `${f.low} to ${f.high} of ${f.capacity}`), row(spec.seats ? 'Lawn price' : 'Ticket price', money(state.promotion.price)), ...(seatingPlanFor(state) ? [row('Seat price', money(state.promotion.seatPrice))] : [])],
      action: route(phase === 'promote' ? (stagePlanFor(state) ? 'stages' : seatingPlanFor(state) ? 'seating' : spec.id === 'club' ? 'ticketing' : 'phase') : 'phase', phase === 'promote' ? 'Review ticket planning' : 'Review current layout'),
      lock: phase === 'build' ? 'Price and promotion become editable after locking the layout.' : null };
    if (festivalPolicyFor(state)?.sponsorPrice !== undefined) {
      sections.Ticketing.lock = `The sponsor contract fixes the ticket price at ${money(festivalPolicyFor(state).sponsorPrice)}. Review the existing stage accounts.`;
      sections.Ticketing.detail = 'The actual draw stays hidden. Review the forecast and the booked sponsor terms.';
    }
    sections.Operations = { title: phase === 'build' ? (v.ready ? 'Layout ready to lock' : 'Layout needs attention') : 'Before doors',
      detail: phase === 'build' ? (v.missing[0] || v.problems[0]?.message || 'The layout meets the existing requirements. Review it before locking.') : (doorReason(state, liveServicesEnabled) || 'Review the current costs and settings before opening doors.'),
      rows: [row('Venue capacity', `${v.capacity} / ${spec.permit}`), row('Power planned', `${v.watts / 1000} / ${spec.watts / 1000} kW`), row('Due before doors', money(upfrontFor(state))), row('Cash on hand', money(state.cash))],
      action: route('phase', phase === 'build' ? 'Review layout' : 'Review doors controls'), lock: phase === 'promote' ? 'Layout is locked. Use the existing Back control to return to Build if a change is needed.' : null };
  }
  if (phase === 'show') {
    sections.Ticketing = { title: 'Current admissions', detail: service ? 'Observed admissions so far; these are not the final show totals.' : 'Not available for this show. Final attendance is reported in settlement.',
      rows: service ? [row('Minute', service.minute), row('Admitted so far', service.admitted), row('Waiting at admission', service.gate.waiting)] : [], action: route('phase', 'Review show'), lock };
    sections.Operations = { title: incidentPrompt ? 'Current decision' : service ? 'Current services' : 'Show in progress',
      detail: incidentPrompt || (service ? 'Live queue counts come from the current Lot clock.' : 'No live service evidence is available for this show. Review the current show controls.'),
      rows: service ? [row('Admission queue', service.gate.waiting), row('Bar queue', service.bar.waiting), row('Bar customers served', service.barServed)] : [], action: route('phase', incidentPrompt ? 'Review current decision' : 'Review show controls'), lock };
  }
  if (finished) {
    const target = route('settlement', phase === 'done' ? 'Review last settlement' : 'Review settlement');
    sections.Ticketing = { title: phase === 'done' ? 'Last show attendance' : 'Recorded attendance', detail: 'Actual result, not the earlier forecast.', rows: result ? [row('Attendance', `${result.attendance} / ${v.capacity}`), row('Ticket revenue', money(result.ticketGross))] : [], action: target, lock };
    sections.Talent = { ...sections.Talent, detail: phase === 'done' ? 'Last show. The settlement is signed and reopens read-only.' : 'Result awaiting signature. Review the payout in the existing settlement.', action: target, lock };
    sections.Operations = { title: result ? `Next priority: ${PARTS[result.weakest]}` : 'Result unavailable', detail: result ? 'Review the recorded weakest satisfaction dimension and its supporting receipt.' : 'Not available for this show; no result is inferred.',
      rows: result ? [row('Crowd satisfaction', `${result.satisfaction} / 100`), row(PARTS[result.weakest], `${Math.round(result.parts[result.weakest] * 100)}%`), row('Promoter result', money(result.net))] : [], action: target, lock };
    if (!result) for (const section of Object.values(sections)) { section.detail = 'Not available for this show. No result is inferred.'; section.action = null; section.rows = []; }
  }
  const blocked = phase === 'build' && !v.ready || phase === 'promote' && !!doorReason(state, liveServicesEnabled);
  const primary = finished || phase === 'show' || blocked ? 'Operations' : phase === 'book' ? 'Talent' : phase === 'build' ? 'Operations' : 'Ticketing';
  return { phase, venue: spec.name, previous: phase === 'done', priority: { category: primary, ...sections[primary] }, sections };
}
