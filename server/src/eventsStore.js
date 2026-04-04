import { eventsSeed } from './data/eventsSeed.js';

const ALLOWED_TYPES = new Set([
  'volunteer',
  'community',
  'donation_drive',
  'job',
  'fundraiser',
]);

function cloneEvents() {
  return eventsSeed.map((e) => ({ ...e }));
}

let events = cloneEvents();

export function resetEventsForTests() {
  events = cloneEvents();
}

export function listEvents(typesFilter) {
  if (!typesFilter?.length) return [...events];
  const set = new Set(typesFilter.filter((t) => ALLOWED_TYPES.has(t)));
  if (set.size === 0) return [...events];
  return events.filter((e) => set.has(e.type));
}

export function getEventById(id) {
  return events.find((e) => e.id === id) ?? null;
}

export function signupForEvent(id) {
  const ev = getEventById(id);
  if (!ev) return { ok: false, error: 'not_found' };
  if (ev.spotsLeft <= 0) return { ok: false, error: 'full' };
  ev.spotsLeft -= 1;
  return { ok: true, spotsLeft: ev.spotsLeft };
}

export function parseTypesQuery(raw) {
  if (raw == null || raw === '') return null;
  const parts = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : null;
}
