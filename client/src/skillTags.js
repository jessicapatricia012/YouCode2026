/**
 * Canonical volunteer / event skill tags. Keep server/src/skillTags.js in sync.
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

export function toggleSkillTag(selected, id) {
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  return [...selected, id];
}

export function normalizeSkillTagsClient(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? '').trim()).filter((id) => ALLOWED.has(id));
}
