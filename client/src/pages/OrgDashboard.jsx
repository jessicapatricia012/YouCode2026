import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '../eventTypes.js';
import { SKILL_TAGS } from '../skillTags.js';
import './OrgDashboard.css';

function skillLabel(id) {
  return SKILL_TAGS.find((t) => t.id === id)?.label ?? id;
}

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
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [signupModal, setSignupModal] = useState(null);
  const [signupsLoading, setSignupsLoading] = useState(false);
  const [signupsError, setSignupsError] = useState(null);
  const [signupsList, setSignupsList] = useState([]);
  const [signupsTotal, setSignupsTotal] = useState(0);
  const [profileViewUserId, setProfileViewUserId] = useState(null);
  const [volunteerProfile, setVolunteerProfile] = useState(null);
  const [volunteerProfileLoading, setVolunteerProfileLoading] = useState(false);
  const [volunteerProfileError, setVolunteerProfileError] = useState(null);

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
    setProfileViewUserId(null);
    setVolunteerProfile(null);
    setVolunteerProfileError(null);
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
    if (!signupModal || !profileViewUserId) {
      setVolunteerProfileLoading(false);
      return undefined;
    }
    let cancelled = false;
    setVolunteerProfile(null);
    setVolunteerProfileError(null);
    setVolunteerProfileLoading(true);

    (async () => {
      try {
        const r = await fetch(
          `/api/events/${signupModal.id}/volunteers/${profileViewUserId}/profile`,
          { headers: getAuthHeader() }
        );
        const data = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (r.status === 401) {
          setVolunteerProfileError('Session expired. Sign in again.');
          return;
        }
        if (!r.ok) {
          setVolunteerProfileError(data.message || 'Could not load profile.');
          return;
        }
        setVolunteerProfile(data);
      } catch {
        if (!cancelled) setVolunteerProfileError('Could not load profile.');
      } finally {
        if (!cancelled) setVolunteerProfileLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signupModal, profileViewUserId, getAuthHeader]);

  const closeSignupModal = useCallback(() => {
    setSignupModal(null);
    setProfileViewUserId(null);
    setVolunteerProfile(null);
    setVolunteerProfileError(null);
  }, []);

  useEffect(() => {
    if (!signupModal) return;
    function onKey(e) {
      if (e.key === 'Escape') closeSignupModal();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [signupModal, closeSignupModal]);

  const stats = useMemo(() => {
    const totalEvents = events.length;
    const totalSignups = events.reduce((sum, e) => sum + (e.signupCount ?? 0), 0);
    const activeEvents = events.filter((e) => e.isActive).length;
    return { totalEvents, totalSignups, activeEvents };
  }, [events]);

  async function performDeleteEvent(eventId) {
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
                            onClick={() => setDeleteConfirm({ eventId: ev.id, title: ev.title })}
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
                              onClick={() => setDeleteConfirm({ eventId: ev.id, title: ev.title })}
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
          onClick={closeSignupModal}
          onKeyDown={(e) => e.key === 'Escape' && closeSignupModal()}
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
                {profileViewUserId ? 'Volunteer profile' : 'Signups'}
              </h2>
              <button
                type="button"
                className="org-dashboard__modal-close"
                aria-label="Close"
                onClick={closeSignupModal}
              >
                ×
              </button>
            </div>
            <p className="org-dashboard__modal-event">{signupModal.title}</p>

            {profileViewUserId ? (
              <>
                <button
                  type="button"
                  className="org-dashboard__profile-back"
                  aria-label="Back to signups list for this event"
                  onClick={() => {
                    setProfileViewUserId(null);
                    setVolunteerProfile(null);
                    setVolunteerProfileError(null);
                  }}
                >
                  <span className="org-dashboard__profile-back-arrow" aria-hidden>
                    ←
                  </span>
                  All signups
                </button>
                {volunteerProfileLoading && (
                  <p className="org-dashboard__muted">Loading profile…</p>
                )}
                {volunteerProfileError && (
                  <p className="org-dashboard__modal-error">{volunteerProfileError}</p>
                )}
                {!volunteerProfileLoading && !volunteerProfileError && volunteerProfile && (
                  <div className="org-dashboard__volunteer-profile">
                    <p className="org-dashboard__volunteer-profile-line">
                      <span className="org-dashboard__volunteer-profile-label">Account name</span>
                      {volunteerProfile.displayName || '—'}
                    </p>
                    <p className="org-dashboard__volunteer-profile-line">
                      <span className="org-dashboard__volunteer-profile-label">Account email</span>
                      {volunteerProfile.email ? (
                        <a href={`mailto:${volunteerProfile.email}`}>{volunteerProfile.email}</a>
                      ) : (
                        '—'
                      )}
                    </p>
                    <div className="org-dashboard__volunteer-profile-block">
                      <span className="org-dashboard__volunteer-profile-label">Skills</span>
                      {Array.isArray(volunteerProfile.skills) &&
                      volunteerProfile.skills.length > 0 ? (
                        <div className="org-dashboard__skill-tags" role="list">
                          {volunteerProfile.skills.map((id) => (
                            <span key={id} className="org-dashboard__skill-tag" role="listitem">
                              {skillLabel(id)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="org-dashboard__muted org-dashboard__muted--inline">None listed</p>
                      )}
                    </div>
                    <div className="org-dashboard__volunteer-profile-block">
                      <span className="org-dashboard__volunteer-profile-label">Availability</span>
                      <p className="org-dashboard__volunteer-profile-text">
                        {volunteerProfile.availability?.trim() || '—'}
                      </p>
                    </div>
                    <div className="org-dashboard__volunteer-profile-block">
                      <span className="org-dashboard__volunteer-profile-label">Interests</span>
                      {Array.isArray(volunteerProfile.interests) &&
                      volunteerProfile.interests.filter(Boolean).length > 0 ? (
                        <ul className="org-dashboard__volunteer-list">
                          {volunteerProfile.interests.filter(Boolean).map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="org-dashboard__muted org-dashboard__muted--inline">—</p>
                      )}
                    </div>
                    <div className="org-dashboard__volunteer-profile-block">
                      <span className="org-dashboard__volunteer-profile-label">Experience</span>
                      <p className="org-dashboard__volunteer-profile-text">
                        {volunteerProfile.experience?.trim() || '—'}
                      </p>
                    </div>
                    <div className="org-dashboard__volunteer-profile-block">
                      <span className="org-dashboard__volunteer-profile-label">
                        Contact preferences
                      </span>
                      <p className="org-dashboard__volunteer-profile-text">
                        {volunteerProfile.contactPreferences?.trim() || '—'}
                      </p>
                    </div>
                    <div className="org-dashboard__volunteer-profile-block">
                      <span className="org-dashboard__volunteer-profile-label">Emergency contact</span>
                      <p className="org-dashboard__volunteer-profile-text">
                        {[volunteerProfile.emergencyContactName, volunteerProfile.emergencyContactPhone]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
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
                    <p className="org-dashboard__modal-footnote">
                      “View profile” is available when the signup email matches a volunteer account
                      (including signups from before accounts were linked on the server).
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
                              <th>Profile</th>
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
                                <td>
                                  {s.profileUserId || s.userId ? (
                                    <button
                                      type="button"
                                      className="org-dashboard__link-btn"
                                      onClick={() =>
                                        setProfileViewUserId(s.profileUserId || s.userId)
                                      }
                                    >
                                      View profile
                                    </button>
                                  ) : (
                                    <span className="org-dashboard__muted org-dashboard__muted--inline">
                                      —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete this event?"
        description={
          deleteConfirm
            ? `Delete “${deleteConfirm.title}”? This cannot be undone.`
            : ''
        }
        cancelLabel="Keep event"
        confirmLabel="Delete"
        confirmVariant="danger"
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (!deleteConfirm) return;
          const id = deleteConfirm.eventId;
          setDeleteConfirm(null);
          void performDeleteEvent(id);
        }}
      />
    </div>
  );
}
