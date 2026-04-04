import { useCallback, useMemo, useState } from 'react';
import Map, { Marker, NavigationControl, Popup } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { EVENT_TYPE_COLORS } from '../eventTypes.js';

const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

function formatEventDate(iso) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function EventMap({ events, loading, error, onSignup }) {
  const [popupId, setPopupId] = useState(null);
  const [signupBusy, setSignupBusy] = useState(false);

  const mappableEvents = useMemo(
    () =>
      events.filter(
        (ev) =>
          typeof ev.lat === 'number' &&
          typeof ev.lng === 'number' &&
          Number.isFinite(ev.lat) &&
          Number.isFinite(ev.lng)
      ),
    [events]
  );

  const popupEvent = useMemo(
    () => (popupId ? events.find((e) => e.id === popupId) ?? null : null),
    [events, popupId]
  );

  const initialView = useMemo(
    () => ({
      longitude: -123.35,
      latitude: 49.35,
      zoom: 6.2,
    }),
    []
  );

  const handleSignup = useCallback(async () => {
    if (!popupEvent) return;
    setSignupBusy(true);
    try {
      await onSignup?.(popupEvent);
    } finally {
      setSignupBusy(false);
    }
  }, [onSignup, popupEvent]);

  if (!token) {
    return (
      <div className="map-shell map-shell--message">
        <p>
          Add <code>VITE_MAPBOX_ACCESS_TOKEN</code> to <code>client/.env</code> and restart Vite.
        </p>
      </div>
    );
  }

  return (
    <div className="map-shell">
      {loading && <div className="map-overlay">Loading events…</div>}
      {error && <div className="map-overlay map-overlay--error">{error}</div>}
      <Map
        mapboxAccessToken={token}
        initialViewState={initialView}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        reuseMaps
        onClick={() => setPopupId(null)}
      >
        <NavigationControl position="top-right" />
        {mappableEvents.map((ev) => {
          const color = EVENT_TYPE_COLORS[ev.type] ?? '#666';
          return (
            <Marker
              key={ev.id}
              longitude={ev.lng}
              latitude={ev.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setPopupId(ev.id);
              }}
            >
              <button
                type="button"
                className="map-pin"
                style={{ background: color }}
                aria-label={ev.title}
              />
            </Marker>
          );
        })}
        {popupEvent && (
          <Popup
            longitude={popupEvent.lng}
            latitude={popupEvent.lat}
            anchor="top"
            onClose={() => setPopupId(null)}
            closeOnClick={false}
            maxWidth="320px"
          >
            <div className="map-popup">
              <h3 className="map-popup__title">{popupEvent.title}</h3>
              <p className="map-popup__org">{popupEvent.orgName}</p>
              <p className="map-popup__meta">
                {[popupEvent.address, popupEvent.city].filter(Boolean).join(', ') || '—'}
              </p>
              <p className="map-popup__meta">{formatEventDate(popupEvent.startsAt)}</p>
              <p className="map-popup__meta">
                {popupEvent.spotsLeft > 0
                  ? `${popupEvent.spotsLeft} spot${popupEvent.spotsLeft === 1 ? '' : 's'} left`
                  : 'Full'}
              </p>
              {popupEvent.websiteUrl ? (
                <p className="map-popup__meta">
                  <a
                    href={popupEvent.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="map-popup__link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Event website →
                  </a>
                </p>
              ) : null}
              <button
                type="button"
                className="map-popup__cta"
                disabled={popupEvent.spotsLeft <= 0 || signupBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSignup();
                }}
              >
                {signupBusy ? 'Signing up…' : "I'm in"}
              </button>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
