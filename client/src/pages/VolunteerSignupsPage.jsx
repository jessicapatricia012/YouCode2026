import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '../eventTypes.js';
import './VolunteerSignupsPage.css';

function formatStartsAt(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function VolunteerSignupsPage() {
  const { user, getAuthHeader } = useAuth();
  const [signups, setSignups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/volunteer/signups', { headers: getAuthHeader() });
      const data = await r.json().catch(() => ({}));
      if (r.status === 403) {
        setError('This page is for volunteer accounts.');
        setSignups([]);
        return;
      }
      if (!r.ok) {
        setError(data.message || 'Could not load your signups.');
        setSignups([]);
        return;
      }
      const list = data.signups ?? [];
      list.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
      setSignups(list);
    } catch {
      setError('Could not load your signups. Is the API running?');
      setSignups([]);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    load();
  }, [load]);

  const empty = useMemo(() => !loading && !error && signups.length === 0, [loading, error, signups.length]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'user') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="volunteer-signups-page">
      <header className="volunteer-signups-page__header">
        <p className="volunteer-signups-page__eyebrow">ConnectBC · Volunteer</p>
        <h1 className="volunteer-signups-page__title">Your signups</h1>
        <p className="volunteer-signups-page__lead">
          Events you have registered for. Open one on the map to see details or get directions.
        </p>
        <nav className="volunteer-signups-page__nav">
          <Link to="/" className="volunteer-signups-page__nav-link">
            Map
          </Link>
          <span className="volunteer-signups-page__nav-sep" aria-hidden>
            ·
          </span>
          <Link to="/visitor" className="volunteer-signups-page__nav-link">
            Profile
          </Link>
        </nav>
      </header>

      {loading && <p className="volunteer-signups-page__muted">Loading…</p>}
      {error && (
        <p className="volunteer-signups-page__banner volunteer-signups-page__banner--error" role="alert">
          {error}
        </p>
      )}

      {empty && (
        <section className="volunteer-signups-page__panel">
          <p className="volunteer-signups-page__muted">
            You have not signed up for any events yet. Browse the map and join a listing that fits you.
          </p>
          <Link to="/" className="volunteer-signups-page__cta">
            Browse events
          </Link>
        </section>
      )}

      {!loading && !error && signups.length > 0 && (
        <ul className="volunteer-signups-page__list">
          {signups.map((s) => (
            <li key={s.signupId} className="volunteer-signups-page__card">
              <div className="volunteer-signups-page__card-top">
                <h2 className="volunteer-signups-page__card-title">{s.title}</h2>
                <span
                  className="volunteer-signups-page__type-badge"
                  style={{ background: EVENT_TYPE_COLORS[s.type] ?? '#666' }}
                >
                  {EVENT_TYPE_LABELS[s.type] ?? s.type}
                </span>
              </div>
              <p className="volunteer-signups-page__card-org">{s.orgName}</p>
              <p className="volunteer-signups-page__card-meta">
                {formatStartsAt(s.startsAt)}
                {s.city ? ` · ${s.city}` : ''}
                {s.spotsLeft > 0
                  ? ` · ${s.spotsLeft} spot${s.spotsLeft === 1 ? '' : 's'} left`
                  : ' · Full'}
              </p>
              <p className="volunteer-signups-page__card-signedup">
                You signed up {formatStartsAt(s.signedUpAt)}
              </p>
              <div className="volunteer-signups-page__card-status">
                {s.removedByAdminAt ? (
                  <span
                    className="volunteer-signups-page__pill volunteer-signups-page__pill--warn"
                    title="Removed from the public map by an administrator"
                  >
                    No longer listed publicly
                  </span>
                ) : !s.isActive ? (
                  <span className="volunteer-signups-page__pill volunteer-signups-page__pill--muted">
                    Organizer set inactive
                  </span>
                ) : null}
              </div>
              <Link
                to={`/?event=${encodeURIComponent(s.eventId)}`}
                className="volunteer-signups-page__card-action"
              >
                Open on map
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
