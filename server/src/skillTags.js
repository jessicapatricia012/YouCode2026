/**
 * Canonical volunteer / event skill tags. Keep client/src/skillTags.js in sync.
 */
export const SKILL_TAGS = [
  { id: 'food_service', label: 'Food service & kitchen' },
  { id: 'driving', label: 'Driving & deliveries' },
  { id: 'first_aid', label: 'First aid & safety' },
  { id: 'childcare', label: 'Childcare & youth' },
  { id: 'elder_care', label: 'Seniors & accessibility support' },
  { id: 'outdoor', label: 'Outdoor & conservation' },
  { id: 'events_setup', label: 'Events setup & teardown' },
  { id: 'customer_service', label: 'Greeter & customer service' },
  { id: 'admin', label: 'Admin & data entry' },
  { id: 'fundraising', label: 'Fundraising & sales' },
  { id: 'trades', label: 'Trades & maintenance' },
  { id: 'technology', label: 'Technology & AV' },
  { id: 'language', label: 'Translation & language support' },
  { id: 'writing', label: 'Writing & communications' },
];

const ALLOWED = new Set(SKILL_TAGS.map((t) => t.id));

/** @param {unknown} raw */
export function normalizeSkillTags(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const x of raw) {
    const id = String(x ?? '').trim();
    if (ALLOWED.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

export function skillTagLabel(id) {
  return SKILL_TAGS.find((t) => t.id === id)?.label ?? id;
}
