import { EVENT_TYPE_LABELS } from './eventTypes.js';
import { SKILL_TAGS } from './skillTags.js';

export function eventMatchesMapSearch(ev, qLower) {
  if (!qLower) return true;
  const skillText = (ev.skillTags ?? [])
    .map((id) => SKILL_TAGS.find((t) => t.id === id)?.label ?? id)
    .join(' ');
  const hay = [
    ev.title,
    ev.orgName,
    ev.address,
    ev.city,
    ev.description,
    EVENT_TYPE_LABELS[ev.type],
    skillText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(qLower);
}

/** Matching events for map search dropdown (newest / stable order: by title). */
export function eventsMatchingMapSearch(events, query, limit = 20) {
  const q = String(query || '').trim().toLowerCase();
  if (!q || !Array.isArray(events)) return [];
  return events
    .filter((ev) => eventMatchesMapSearch(ev, q))
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' }))
    .slice(0, limit);
}
