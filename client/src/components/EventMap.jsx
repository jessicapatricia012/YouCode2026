import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, NavigationControl, Popup, Source } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { geodesicCircleFeature } from '../geo.js';
import { EVENT_TYPE_COLORS } from '../eventTypes.js';
import { eventsMatchingMapSearch } from '../mapEventSearch.js';
import { SKILL_TAGS } from '../skillTags.js';

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

const RADIUS_FILL = '#214bb2';
const RADIUS_FILL_OPACITY = 0.1;
const RADIUS_LINE_OPACITY = 0.65;

export default function EventMap({
  events,
  loading,
  error,
  onSignup,
  userCoords,
  radiusKm,
  organizerCannotVolunteer = false,
  focusEventId,
  /** When set (volunteer), popup skill tags highlight ids that appear on this list. */
  volunteerProfileSkillIds,
  searchQuery = '',
  onSearchChange,
  onSearchPickEvent,
}) {
  const mapRef = useRef(null);
  const searchWrapRef = useRef(null);
  const lastFocusedIdRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [popupId, setPopupId] = useState(null);
  const [signupBusy, setSignupBusy] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  const searchMatches = useMemo(
    () => eventsMatchingMapSearch(events, searchQuery, 20),
    [events, searchQuery]
  );

  useEffect(() => {
    if (!onSearchChange || !searchQuery.trim()) {
      setSearchDropdownOpen(false);
    }
  }, [onSearchChange, searchQuery]);

  useEffect(() => {
    if (!onSearchChange) return;
    const onDocDown = (e) => {
      const el = searchWrapRef.current;
      if (!el || el.contains(e.target)) return;
      setSearchDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [onSearchChange]);

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

  const volunteerSkillSet = useMemo(() => {
    if (!Array.isArray(volunteerProfileSkillIds) || volunteerProfileSkillIds.length === 0) {
      return null;
    }
    return new Set(volunteerProfileSkillIds);
  }, [volunteerProfileSkillIds]);

  const popupSkillTagsOrdered = useMemo(() => {
    const tags = popupEvent?.skillTags;
    if (!Array.isArray(tags) || tags.length === 0) return [];
    if (!volunteerSkillSet) return [...tags];
    return [...tags].sort((a, b) => {
      const ma = volunteerSkillSet.has(a) ? 0 : 1;
      const mb = volunteerSkillSet.has(b) ? 0 : 1;
      if (ma !== mb) return ma - mb;
      return String(a).localeCompare(String(b));
    });
  }, [popupEvent, volunteerSkillSet]);

  const initialView = useMemo(
    () => ({
      longitude: -123.35,
      latitude: 49.35,
      zoom: 6.2,
    }),
    []
  );

  const radiusCircleGeoJson = useMemo(() => {
    if (
      radiusKm == null ||
      !userCoords ||
      typeof radiusKm !== 'number' ||
      !Number.isFinite(radiusKm) ||
      radiusKm <= 0
    ) {
      return null;
    }
    return {
      type: 'FeatureCollection',
      features: [geodesicCircleFeature(userCoords.lat, userCoords.lng, radiusKm)],
    };
  }, [radiusKm, userCoords]);

  useEffect(() => {
    if (!mapReady || !userCoords || focusEventId) return;
    const ref = mapRef.current;
    if (!ref) return;
    const map = typeof ref.getMap === 'function' ? ref.getMap() : ref;
    map?.flyTo?.({
      center: [userCoords.lng, userCoords.lat],
      zoom: 12,
      duration: 1400,
      essential: true,
    });
  }, [mapReady, userCoords, focusEventId]);

  useEffect(() => {
    lastFocusedIdRef.current = null;
  }, [focusEventId]);

  useEffect(() => {
    if (!focusEventId || !mapReady) return;
    const ev = events.find((e) => e.id === focusEventId);
    if (
      !ev ||
      typeof ev.lat !== 'number' ||
      typeof ev.lng !== 'number' ||
      !Number.isFinite(ev.lat) ||
      !Number.isFinite(ev.lng)
    ) {
      return;
    }
    if (lastFocusedIdRef.current === focusEventId) return;
    lastFocusedIdRef.current = focusEventId;
    const ref = mapRef.current;
    const map = ref && (typeof ref.getMap === 'function' ? ref.getMap() : ref);
    map?.flyTo?.({
      center: [ev.lng, ev.lat],
      zoom: 13,
      duration: 1200,
      essential: true,
    });
    setPopupId(focusEventId);
  }, [focusEventId, mapReady, events]);

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

  const searchTrimmed = searchQuery.trim();
  const showSearchDropdown =
    Boolean(onSearchPickEvent) &&
    Boolean(searchTrimmed) &&
    searchDropdownOpen;

  return (
    <div className="map-shell">
      {onSearchChange ? (
        <div className="map-search" role="search">
          <div className="map-search__inner" ref={searchWrapRef}>
            <span className="map-search__icon" aria-hidden>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <input
              type="search"
              className="map-search__input"
              placeholder="Search events, org, place, skills…"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setSearchDropdownOpen(true);
              }}
              onFocus={() => setSearchDropdownOpen(true)}
              aria-label="Search events on the map"
              aria-expanded={showSearchDropdown}
              aria-controls={showSearchDropdown ? 'map-search-suggestions' : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              spellCheck={false}
            />
            {searchTrimmed ? (
              <button
                type="button"
                className="map-search__clear"
                aria-label="Clear search"
                onClick={() => {
                  onSearchChange('');
                  setSearchDropdownOpen(false);
                }}
              >
                ×
              </button>
            ) : null}
            {showSearchDropdown ? (
              <div
                id="map-search-suggestions"
                className="map-search__dropdown"
                role="listbox"
                aria-label="Matching events"
              >
                {loading ? (
                  <div className="map-search__dropdown-status">Loading events…</div>
                ) : error ? (
                  <div className="map-search__dropdown-status map-search__dropdown-status--error">
                    {error}
                  </div>
                ) : searchMatches.length === 0 ? (
                  <div className="map-search__dropdown-status" role="status">
                    No events match “{searchTrimmed}”. Try another word or clear the search.
                  </div>
                ) : (
                  searchMatches.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      role="option"
                      className="map-search__dropdown-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onSearchPickEvent(ev.id);
                        setSearchDropdownOpen(false);
                      }}
                    >
                      <span className="map-search__dropdown-title">{ev.title}</span>
                      <span className="map-search__dropdown-sub">
                        {[ev.orgName, ev.city].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {loading && <div className="map-overlay">Loading events…</div>}
      {error && <div className="map-overlay map-overlay--error">{error}</div>}
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={initialView}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        reuseMaps
        onLoad={() => setMapReady(true)}
        onClick={() => setPopupId(null)}
      >
        <NavigationControl position="top-right" />
        {radiusCircleGeoJson ? (
          <Source id="connectbc-radius" type="geojson" data={radiusCircleGeoJson}>
            <Layer
              id="connectbc-radius-fill"
              type="fill"
              paint={{
                'fill-color': RADIUS_FILL,
                'fill-opacity': RADIUS_FILL_OPACITY,
              }}
            />
            <Layer
              id="connectbc-radius-line"
              type="line"
              paint={{
                'line-color': RADIUS_FILL,
                'line-width': 2,
                'line-opacity': RADIUS_LINE_OPACITY,
              }}
            />
          </Source>
        ) : null}
        {userCoords ? (
          <Marker
            longitude={userCoords.lng}
            latitude={userCoords.lat}
            anchor="center"
            onClick={(e) => e.originalEvent.stopPropagation()}
          >
            <div className="map-user-dot" role="img" aria-label="Your location" />
          </Marker>
        ) : null}
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
              {popupSkillTagsOrdered.length > 0 ? (
                <div className="map-popup__skill-tag-row" role="list" aria-label="Skills needed">
                  {popupSkillTagsOrdered.map((id) => {
                    const isMatch = volunteerSkillSet?.has(id) ?? false;
                    return (
                      <span
                        key={id}
                        className={`map-popup__skill-tag${isMatch ? ' map-popup__skill-tag--match' : ''}`}
                        role="listitem"
                        title={
                          volunteerSkillSet
                            ? isMatch
                              ? 'On your profile'
                              : 'Not on your profile'
                            : undefined
                        }
                      >
                        {SKILL_TAGS.find((t) => t.id === id)?.label ?? id}
                      </span>
                    );
                  })}
                </div>
              ) : null}
              {!organizerCannotVolunteer ? (
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
              ) : null}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
