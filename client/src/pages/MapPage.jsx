import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import EventMap from '../components/EventMap.jsx';
import FilterSidebar from '../components/FilterSidebar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { haversineKm } from '../geo.js';
import { RADIUS_SLIDER_STEPS_KM } from '../mapRadius.js';
import { EVENT_TYPE_ORDER } from '../eventTypes.js';

function typesQuery(includedTypes) {
  const all =
    includedTypes.length === EVENT_TYPE_ORDER.length &&
    EVENT_TYPE_ORDER.every((t) => includedTypes.includes(t));
  if (all) return '';
  if (includedTypes.length === 0) return null;
  return `?types=${includedTypes.map(encodeURIComponent).join(',')}`;
}

export default function MapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusEventId = (searchParams.get('event') || '').trim();

  const { user, logout, getAuthHeader } = useAuth();
  const [includedTypes, setIncludedTypes] = useState(() => [...EVENT_TYPE_ORDER]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [radiusStepIndex, setRadiusStepIndex] = useState(0);

  /** Skill-based recommendations for visitors (sidebar “For you”). */
  const [skillRecs, setSkillRecs] = useState({
    loading: false,
    needsSkills: false,
    events: [],
    profileSkills: [],
  });

  useEffect(() => {
    setIncludedTypes([...EVENT_TYPE_ORDER]);
  }, [user?.id]);

  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const { longitude, latitude } = pos.coords;
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
        setUserCoords({ lng: longitude, lat: latitude });
      },
      () => {
        /* denied or unavailable */
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300_000 }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userCoords) setRadiusStepIndex(0);
  }, [userCoords]);

  const queryKey = useMemo(() => {
    const q = typesQuery(includedTypes);
    if (q === null) return 'none';
    return q || 'all';
  }, [includedTypes]);

  useEffect(() => {
    if (queryKey === 'none') {
      setEvents([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    const path = queryKey === 'all' ? '/api/events' : `/api/events${queryKey}`;

    fetch(path)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setEvents(data.events ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load events. Is the API and database running?');
          setEvents([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryKey]);

  useEffect(() => {
    if (user?.role !== 'user') {
      setSkillRecs({
        loading: false,
        needsSkills: false,
        events: [],
        profileSkills: [],
      });
      return undefined;
    }

    const typesQ = typesQuery(includedTypes);
    if (typesQ === null) {
      setSkillRecs({
        loading: false,
        needsSkills: false,
        events: [],
        profileSkills: [],
      });
      return undefined;
    }

    let cancelled = false;
    setSkillRecs((s) => ({
      ...s,
      loading: true,
    }));

    const url =
      typesQ === ''
        ? '/api/volunteer/recommendations'
        : `/api/volunteer/recommendations${typesQ}`;

    fetch(url, { headers: getAuthHeader() })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setSkillRecs({
          loading: false,
          needsSkills: !!data.needsSkills,
          events: data.events ?? [],
          profileSkills: data.profileSkills ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) {
          setSkillRecs({
            loading: false,
            needsSkills: false,
            events: [],
            profileSkills: [],
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.role, includedTypes, getAuthHeader]);

  const pickSkillMatchEvent = useCallback(
    (id) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('event', id);
        return next;
      });
    },
    [setSearchParams]
  );

  const radiusLimitKm = RADIUS_SLIDER_STEPS_KM[radiusStepIndex] ?? null;

  const [radiusOverlayStepIndex, setRadiusOverlayStepIndex] = useState(null);

  const radiusKmForCircle = useMemo(() => {
    if (radiusOverlayStepIndex == null) return null;
    const km = RADIUS_SLIDER_STEPS_KM[radiusOverlayStepIndex];
    return typeof km === 'number' && km > 0 ? km : null;
  }, [radiusOverlayStepIndex]);

  const handleRadiusOverlayStart = useCallback((index) => {
    setRadiusOverlayStepIndex(index);
  }, []);

  const handleRadiusOverlayMove = useCallback((index) => {
    setRadiusOverlayStepIndex(index);
  }, []);

  const handleRadiusOverlayEnd = useCallback(() => {
    setRadiusOverlayStepIndex(null);
  }, []);

  const handleRadiusCommit = useCallback((index) => {
    setRadiusStepIndex(index);
    setRadiusOverlayStepIndex(null);
  }, []);

  const displayedEvents = useMemo(() => {
    let list =
      radiusLimitKm == null || !userCoords
        ? events
        : events.filter((ev) => {
            if (
              typeof ev.lat !== 'number' ||
              typeof ev.lng !== 'number' ||
              !Number.isFinite(ev.lat) ||
              !Number.isFinite(ev.lng)
            ) {
              return false;
            }
            return (
              haversineKm(userCoords.lat, userCoords.lng, ev.lat, ev.lng) <=
              radiusLimitKm
            );
          });
    if (focusEventId) {
      const focused = events.find((e) => e.id === focusEventId);
      if (focused && !list.some((e) => e.id === focusEventId)) {
        list = [...list, focused];
      }
    }
    return list;
  }, [events, radiusLimitKm, userCoords, focusEventId]);

  const onToggleType = useCallback((type) => {
    setIncludedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  const onSelectAll = useCallback(() => {
    setIncludedTypes([...EVENT_TYPE_ORDER]);
  }, []);

  const onSignup = useCallback(
    async (ev) => {
      const r = await fetch(`/api/events/${ev.id}/signups`, {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        /* Forbidden (e.g. organizer signup): never pop a dialog — UI already hides the button. */
        if (r.status === 403) return;
        const msg =
          data.error === 'full'
            ? 'This event is full.'
            : data.error === 'already_signed_up'
              ? 'You are already signed up for this event.'
              : r.status === 404
                ? 'Event not found.'
                : r.status === 401
                  ? 'Please sign in again.'
                  : data.message ||
                    (r.status === 400
                      ? 'Signup could not be completed. Check your details and try again.'
                      : `Signup failed (${r.status}).`);
        window.alert(msg);
        return;
      }
      setEvents((prev) =>
        prev.map((e) =>
          e.id === ev.id ? { ...e, spotsLeft: data.spotsLeft } : e
        )
      );
      setSkillRecs((prev) => ({
        ...prev,
        events: prev.events.map((e) =>
          e.id === ev.id ? { ...e, spotsLeft: data.spotsLeft } : e
        ),
      }));
    },
    [getAuthHeader]
  );

  return (
    <div className="app">
      <FilterSidebar
        includedTypes={includedTypes}
        onToggleType={onToggleType}
        onSelectAll={onSelectAll}
        radiusStepIndex={radiusStepIndex}
        onRadiusCommit={handleRadiusCommit}
        onRadiusOverlayStart={handleRadiusOverlayStart}
        onRadiusOverlayMove={handleRadiusOverlayMove}
        onRadiusOverlayEnd={handleRadiusOverlayEnd}
        hasUserLocation={!!userCoords}
        orgName={user?.name}
        userEmail={user?.email}
        userRole={user?.role}
        onLogout={logout}
        skillMatches={user?.role === 'user' ? skillRecs : null}
        onPickSkillMatch={pickSkillMatchEvent}
      />
      <EventMap
        events={displayedEvents}
        loading={loading}
        error={error}
        onSignup={onSignup}
        userCoords={userCoords}
        radiusKm={radiusKmForCircle}
        organizerCannotVolunteer={user?.role === 'organizer'}
        focusEventId={focusEventId || undefined}
        volunteerProfileSkillIds={
          user?.role === 'user' ? skillRecs.profileSkills ?? [] : undefined
        }
      />
    </div>
  );
}
