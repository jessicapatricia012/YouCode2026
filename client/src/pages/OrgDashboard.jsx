import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '../eventTypes.js';
import './OrgDashboard.css';

function formatEventDate(iso) {
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

function formatSignupDate(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-CA', {
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

export default function OrgDashboard() {
  const { user, getAuthHeader, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [signupModal, setSignupModal] = useState(null);
  const [signupsLoading, setSignupsLoading] = useState(false);
  const [signupsError, setSignupsError] = useState(null);
  const [signupsList, setSignupsList] = useState([]);
  const [signupsTotal, setSignupsTotal] = useState(0);

  const orgId = user?.id;

  const loadEvents = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/orgs/${orgId}/events`, {
        headers: getAuthHeader(),
      });
      if (r.status === 401) {
        setError('Session expired. Please sign in again.');
        setEvents([]);
        return;
      }
      if (r.status === 403) {
        setError('You do not have access to this dashboard.');
        setEvents([]);
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setEvents(data.events ?? []);
    } catch {
      setError('Could not load events. Is the API running?');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, getAuthHeader]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const s = location.state;
    if (s?.postSuccess) {
      setSuccessMsg('Event posted successfully.');
      navigate(location.pathname, { replace: true, state: {} });
    } else if (s?.editSuccess) {
      setSuccessMsg('Event updated successfully.');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!signupModal) return;
    let cancelled = false;
    setSignupsLoading(true);
    setSignupsError(null);
    setSignupsList([]);
    setSignupsTotal(0);

    (async () => {
      try {
        const r = await fetch(`/api/events/${signupModal.id}/signups`, {
          headers: getAuthHeader(),
        });
        const data = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (r.status === 401) {
          setSignupsError('Session expired. Sign in again.');
          return;
        }
        if (!r.ok) {
          setSignupsError(data.message || 'Could not load signups.');
          return;
        }
        setSignupsList(data.signups ?? []);
        setSignupsTotal(data.total ?? (data.signups?.length ?? 0));
      } catch {
        if (!cancelled) setSignupsError('Could not load signups.');
      } finally {
        if (!cancelled) setSignupsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signupModal, getAuthHeader]);

  useEffect(() => {
    if (!signupModal) return;
    function onKey(e) {
      if (e.key === 'Escape') setSignupModal(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [signupModal]);

  const stats = useMemo(() => {
    const totalEvents = events.length;
    const totalSignups = events.reduce((sum, e) => sum + (e.signupCount ?? 0), 0);
    const activeEvents = events.filter((e) => e.isActive).length;
    return { totalEvents, totalSignups, activeEvents };
  }, [events]);

  async function handleDelete(eventId, title) {
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    setDeletingId(eventId);
    setError(null);
    try {
      const r = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      if (r.status === 404) {
        setError('Event was already removed.');
        await loadEvents();
        return;
      }
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${r.status}`);
      }
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (err) {
      setError(err.message || 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'organizer') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="org-dashboard">
      <header className="org-dashboard__top">
        <div>
          <p className="org-dashboard__eyebrow">ConnectBC · Organizer</p>
          <h1 className="org-dashboard__title">Welcome, {user.name}</h1>
          <p className="org-dashboard__email">{user.email}</p>
        </div>
        <div className="org-dashboard__top-actions">
          <Link to="/" className="org-dashboard__btn org-dashboard__btn--ghost">
            Browse map
          </Link>
          <Link to="/post" className="org-dashboard__btn org-dashboard__btn--primary">
            Post new event
          </Link>
          <button
            type="button"
            className="org-dashboard__btn org-dashboard__btn--ghost"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            Log out
          </button>
        </div>
      </header>

      <section className="org-dashboard__stats" aria-label="Summary statistics">
        <div className="org-dashboard__stat">
          <span className="org-dashboard__stat-value">{stats.totalEvents}</span>
          <span className="org-dashboard__stat-label">Events posted</span>
        </div>
        <div className="org-dashboard__stat">
          <span className="org-dashboard__stat-value">{stats.totalSignups}</span>
          <span className="org-dashboard__stat-label">Signups received</span>
        </div>
        <div className="org-dashboard__stat">
          <span className="org-dashboard__stat-value">{stats.activeEvents}</span>
          <span className="org-dashboard__stat-label">Active events</span>
        </div>
      </section>

      {successMsg && (
        <p className="org-dashboard__banner org-dashboard__banner--success">{successMsg}</p>
      )}
      {error && <p className="org-dashboard__banner org-dashboard__banner--error">{error}</p>}

      <section className="org-dashboard__section">
        <h2 className="org-dashboard__section-title">Your events</h2>
        <p className="org-dashboard__map-hint">
          The public map lists <strong>active</strong> events only. Inactive rows stay on your
          dashboard but are hidden from visitors.
        </p>
        {loading ? (
          <p className="org-dashboard__muted">Loading…</p>
        ) : events.length === 0 ? (
          <p className="org-dashboard__muted">
            No events yet.{' '}
            <Link to="/post">Post your first event</Link>.
          </p>
        ) : (
          <div className="org-dashboard__table-wrap">
            <table className="org-dashboard__table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Spots</th>
                  <th>Active</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <button
                        type="button"
                        className="org-dashboard__title-btn"
                        onClick={() =>
                          setSignupModal({ id: ev.id, title: ev.title })
                        }
                      >
                        {ev.title}
                      </button>
                    </td>
                    <td>
                      <span
                        className="org-dashboard__badge"
                        style={{
                          background: EVENT_TYPE_COLORS[ev.type] ?? '#666',
                        }}
                      >
                        {EVENT_TYPE_LABELS[ev.type] ?? ev.type}
                      </span>
                    </td>
                    <td>{formatEventDate(ev.startsAt)}</td>
                    <td>
                      {ev.spotsTaken} / {ev.spotsTotal}
                    </td>
                    <td>
                      {ev.removedByAdminAt ? (
                        <span
                          className="org-dashboard__pill org-dashboard__pill--warn"
                          title="Removed from the public map by an administrator"
                        >
                          Moderated
                        </span>
                      ) : (
                        <span
                          className={
                            ev.isActive
                              ? 'org-dashboard__pill org-dashboard__pill--on'
                              : 'org-dashboard__pill org-dashboard__pill--off'
                          }
                        >
                          {ev.isActive ? 'Yes' : 'No'}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="org-dashboard__row-actions">
                        {ev.removedByAdminAt ? (
                          <button
                            type="button"
                            className="org-dashboard__link-btn org-dashboard__link-btn--danger"
                            disabled={deletingId === ev.id}
                            onClick={() => handleDelete(ev.id, ev.title)}
                          >
                            {deletingId === ev.id ? 'Deleting…' : 'Delete'}
                          </button>
                        ) : (
                          <>
                            <Link
                              to={`/edit/${ev.id}`}
                              className="org-dashboard__link-btn"
                            >
                              Edit
                            </Link>
                            <button
                              type="button"
                              className="org-dashboard__link-btn org-dashboard__link-btn--danger"
                              disabled={deletingId === ev.id}
                              onClick={() => handleDelete(ev.id, ev.title)}
                            >
                              {deletingId === ev.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {signupModal && (
        <div
          className="org-dashboard__modal-backdrop"
          onClick={() => setSignupModal(null)}
          onKeyDown={(e) => e.key === 'Escape' && setSignupModal(null)}
          role="presentation"
        >
          <div
            className="org-dashboard__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="org-dashboard-signups-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="org-dashboard__modal-head">
              <h2 id="org-dashboard-signups-title" className="org-dashboard__modal-title">
                Signups
              </h2>
              <button
                type="button"
                className="org-dashboard__modal-close"
                aria-label="Close"
                onClick={() => setSignupModal(null)}
              >
                ×
              </button>
            </div>
            <p className="org-dashboard__modal-event">{signupModal.title}</p>
            {signupsLoading && (
              <p className="org-dashboard__muted">Loading signups…</p>
            )}
            {signupsError && (
              <p className="org-dashboard__modal-error">{signupsError}</p>
            )}
            {!signupsLoading && !signupsError && (
              <>
                <p className="org-dashboard__modal-count">
                  Total: <strong>{signupsTotal}</strong>
                </p>
                {signupsList.length === 0 ? (
                  <p className="org-dashboard__muted">No signups yet.</p>
                ) : (
                  <div className="org-dashboard__modal-table-wrap">
                    <table className="org-dashboard__modal-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Signed up</th>
                        </tr>
                      </thead>
                      <tbody>
                        {signupsList.map((s) => (
                          <tr key={s.id}>
                            <td>{s.name}</td>
                            <td>
                              <a href={`mailto:${s.email}`}>{s.email}</a>
                            </td>
                            <td>{formatSignupDate(s.signedUpAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
