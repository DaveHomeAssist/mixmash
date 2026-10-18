// Presentation-only references to the existing equipment models; no game state or rules.
import { OBJECT_TYPES } from './data.mjs';
export const EQUIPMENT_CARD_TYPES = Object.freeze(Object.keys(OBJECT_TYPES).filter(type => !OBJECT_TYPES[type].kit));
export const SITE_CARD_TYPES = Object.freeze(EQUIPMENT_CARD_TYPES.filter(type => !['pa-s', 'pa-m', 'lights'].includes(type)));
const ROLES = Object.freeze({ stage: 'Performance platform', delay: 'Festival speaker support', 'vip-deck': 'Raised guest viewing', 'bus-compound': 'Touring support area', bar: 'Drinks service', 'bar-tent': 'Covered drinks service', food: 'Food service', trailer: 'Sanitation facilities', restroom: 'Guest amenities', 'restroom-block': 'Grouped guest amenities', gate: 'Guest arrival', exit: 'Guest egress' });
export function equipmentCardInfo(type) {
  if (!EQUIPMENT_CARD_TYPES.includes(type)) return null;
  const spec = OBJECT_TYPES[type];
  const venues = spec.festivalOnly ? ['festival'] : spec.lotOnly ? ['lot'] : spec.venues || ['lot', 'club', 'amphitheater', 'festival'];
  return { type, role: ROLES[type] || 'Production equipment', label: spec.label, image: `./assets/equipment/${type}.png`, footprint: [spec.w, spec.h], watts: spec.watts,
    venues, source: type.startsWith('pa-') ? 'ZLX tops · EKX subs' : type === 'lights' ? 'J-Six · Vertigo Tri LED' : 'Front of House equipment model' };
}
