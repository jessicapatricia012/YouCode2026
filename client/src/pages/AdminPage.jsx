import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import EventAddressLine from '../components/EventAddressLine.jsx';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '../eventTypes.js';
import { eventAddressDisplayLine, googleMapsUrlForEvent } from '../eventLocation.js';
import './AdminPage.css';

function formatWhen(iso) {
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

export default function AdminPage() {
  const { user, getAuthHeader, logout } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [removeConfirm, setRemoveConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/events', { headers: getAuthHeader() });
      if (r.status === 401) {
        setError('Session expired. Sign in again.');
        setEvents([]);
        return;
      }
      if (r.status === 403) {
        setError('You do not have access to this page.');
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
  }, [getAuthHeader]);

  useEffect(() => {
    load();
  }, [load]);

  async function performRemove(ev) {
    setRemovingId(ev.id);
    setError(null);
    try {
      const r = await fetch(`/api/admin/events/${ev.id}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      if (r.status === 404) {
        setError('That event was already removed or does not exist.');
        await load();
        return;
      }
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${r.status}`);
      }
      await load();
    } catch (err) {
      setError(err.message || 'Remove failed.');
    } finally {
      setRemovingId(null);
    }
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="admin-page">
      <header className="admin-page__top">
        <div>
          <p className="admin-page__eyebrow">ConnectBC · Administration</p>
          <h1 className="admin-page__title">Event moderation</h1>
          <p className="admin-page__lead">
            Review listings. <span className="admin-page__tag admin-page__tag--new">New</span> marks
            events posted in the last 72 hours. Removing hides an event from the map and notifies the
            organizer by email when SMTP is set on the server.
          </p>
        </div>
        <div className="admin-page__actions">
          <Link to="/" className="admin-page__btn admin-page__btn--ghost">
            Map
          </Link>
          <button
            type="button"
            className="admin-page__btn admin-page__btn--ghost"
            onClick={() => {
              logout();
              window.location.assign('/login');
            }}
          >
            Log out
          </button>
        </div>
      </header>

      {error && (
        <p className="admin-page__banner admin-page__banner--error" role="alert">
          {error}
        </p>
      )}

      <section className="admin-page__section">
        {loading ? (
          <p className="admin-page__muted">Loading…</p>
        ) : events.length === 0 ? (
          <p className="admin-page__muted">No events in the database.</p>
        ) : (
          <div className="admin-page__table-wrap">
            <table className="admin-page__table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Organization</th>
                  <th>Type</th>
                  <th>Posted</th>
                  <th>Starts</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr
                    key={ev.id}
                    className={ev.removedByAdminAt ? 'admin-page__row--removed' : ''}
                  >
                    <td>
                      <div className="admin-page__title-cell">
                        <span className="admin-page__event-title">{ev.title}</span>
                        <div className="admin-page__tags">
                          {ev.isNewForReview ? (
                            <span className="admin-page__tag admin-page__tag--new">New</span>
                          ) : null}
                          {ev.removedByAdminAt ? (
                            <span className="admin-page__tag admin-page__tag--removed">Removed</span>
                          ) : null}
                        </div>
                      </div>
                      {eventAddressDisplayLine(ev) || googleMapsUrlForEvent(ev) ? (
                        <EventAddressLine
                          ev={ev}
                          className="admin-page__address"
                          linkClassName="admin-page__address-link"
                        />
                      ) : (
                        <p className="admin-page__sub">—</p>
                      )}
                    </td>
                    <td>
                      <div className="admin-page__org-name">{ev.orgName}</div>
                      <a className="admin-page__org-email" href={`mailto:${ev.orgEmail}`}>
                        {ev.orgEmail}
                      </a>
                    </td>
                    <td>
                      <span
                        className="admin-page__type-badge"
                        style={{ background: EVENT_TYPE_COLORS[ev.type] ?? '#666' }}
                      >
                        {EVENT_TYPE_LABELS[ev.type] ?? ev.type}
                      </span>
                    </td>
                    <td>{formatWhen(ev.createdAt)}</td>
                    <td>{formatWhen(ev.startsAt)}</td>
                    <td>
                      {ev.removedByAdminAt ? (
                        <span className="admin-page__pill admin-page__pill--off">
                          Off map
                        </span>
                      ) : ev.isActive ? (
                        <span className="admin-page__pill admin-page__pill--on">Live</span>
                      ) : (
                        <span className="admin-page__pill admin-page__pill--off">Inactive</span>
                      )}
                    </td>
                    <td>
                      {ev.removedByAdminAt ? (
                        <span className="admin-page__muted">—</span>
                      ) : (
                        <button
                          type="button"
                          className="admin-page__remove-btn"
                          disabled={removingId === ev.id}
                          onClick={() => setRemoveConfirm(ev)}
                        >
                          {removingId === ev.id ? 'Removing…' : 'Remove'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!removeConfirm}
        title="Remove from public map?"
        description={
          removeConfirm
            ? `Remove “${removeConfirm.title}” from the public map? The organizer will be emailed if SMTP is configured.`
            : ''
        }
        cancelLabel="Keep listing"
        confirmLabel="Remove"
        confirmVariant="danger"
        onClose={() => setRemoveConfirm(null)}
        onConfirm={() => {
          if (!removeConfirm) return;
          const ev = removeConfirm;
          setRemoveConfirm(null);
          void performRemove(ev);
        }}
      />
    </div>
  );
}
