import { haversineKm } from './geo.js';

/** Google Maps URL: prefer coordinates, else search query from address fields. */
export function googleMapsUrlForEvent(ev) {
  const lat = Number(ev?.lat);
  const lng = Number(ev?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  const parts = [ev?.address, ev?.city, 'BC', 'Canada'].filter((p) => p && String(p).trim());
  if (parts.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}

/** Human-readable distance from user to event, or null if either side lacks coordinates. */
export function formatKmFromUser(userCoords, ev) {
  if (
    !userCoords ||
    typeof userCoords.lat !== 'number' ||
    typeof userCoords.lng !== 'number' ||
    !Number.isFinite(userCoords.lat) ||
    !Number.isFinite(userCoords.lng)
  ) {
    return null;
  }
  const lat = Number(ev?.lat);
  const lng = Number(ev?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const km = haversineKm(userCoords.lat, userCoords.lng, lat, lng);
  if (km < 1) return 'Less than 1 km away';
  if (km < 10) return `${km.toFixed(1)} km away`;
  if (km < 100) return `${Math.round(km)} km away`;
  return `${Math.round(km)} km away`;
}

export function eventAddressDisplayLine(ev) {
  return [ev?.address, ev?.city].filter(Boolean).join(', ') || '';
}
