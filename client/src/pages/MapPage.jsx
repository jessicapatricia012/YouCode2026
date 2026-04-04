import { useCallback, useEffect, useMemo, useState } from 'react';
import EventMap from '../components/EventMap.jsx';
import FilterSidebar from '../components/FilterSidebar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
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
  const { user, logout, getAuthHeader } = useAuth();
  const [includedTypes, setIncludedTypes] = useState(() => [...EVENT_TYPE_ORDER]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

    fetch(path, { headers: getAuthHeader() })
      .then((r) => {
        if (r.status === 401) throw new Error('session');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setEvents(data.events ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          if (err.message === 'session') {
            setError('Your session expired. Sign in again.');
          } else {
            setError('Could not load events. Is the API and database running?');
          }
          setEvents([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryKey, getAuthHeader]);

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
        const msg =
          data.error === 'full'
            ? 'This event is full.'
            : r.status === 404
              ? 'Event not found.'
              : r.status === 401
                ? 'Please sign in again.'
                : 'Signup failed.';
        window.alert(msg);
        return;
      }
      setEvents((prev) =>
        prev.map((e) =>
          e.id === ev.id ? { ...e, spotsLeft: data.spotsLeft } : e
        )
      );
    },
    [getAuthHeader]
  );

  return (
    <div className="app">
      <FilterSidebar
        includedTypes={includedTypes}
        onToggleType={onToggleType}
        onSelectAll={onSelectAll}
        orgName={user?.name}
        userEmail={user?.email}
        onLogout={logout}
      />
      <EventMap
        events={events}
        loading={loading}
        error={error}
        onSignup={onSignup}
      />
    </div>
  );
}
