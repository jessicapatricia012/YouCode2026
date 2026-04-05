import {
  eventAddressDisplayLine,
  formatKmFromUser,
  googleMapsUrlForEvent,
} from '../eventLocation.js';

/**
 * Highlighted address linking to Google Maps.
 * Set showDistance + userCoords only where distance should appear (e.g. map pin popup).
 */
export default function EventAddressLine({
  ev,
  userCoords,
  showDistance = false,
  className = '',
  linkClassName = '',
  distanceClassName = '',
  onLinkClick,
}) {
  const line = eventAddressDisplayLine(ev);
  const href = googleMapsUrlForEvent(ev);
  if (!line && !href) return null;
  const km =
    showDistance && userCoords ? formatKmFromUser(userCoords, ev) : null;
  const label = line || 'Open in Google Maps';

  return (
    <p className={className}>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
          onClick={onLinkClick}
        >
          {label}
        </a>
      ) : (
        <span className={linkClassName}>{label}</span>
      )}
      {km ? (
        <span className={distanceClassName}>
          {' '}
          · {km}
        </span>
      ) : null}
    </p>
  );
}
