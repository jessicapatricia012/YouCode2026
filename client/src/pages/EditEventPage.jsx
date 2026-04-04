import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { isoToDatetimeLocalValue } from '../datetimeLocal.js';
import { EVENT_TYPE_LABELS, EVENT_TYPE_ORDER } from '../eventTypes.js';
import './PostEventPage.css';

export default function EditEventPage() {
  const { id } = useParams();
  const { user, getAuthHeader } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [type, setType] = useState('volunteer');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [spotsTotal, setSpotsTotal] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  const [loadingEvent, setLoadingEvent] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const loadEvent = useCallback(async () => {
    if (!id) return;
    setLoadingEvent(true);
    setLoadError(null);
    try {
      const r = await fetch(`/api/events/${id}`, { headers: getAuthHeader() });
      if (r.status === 401) {
        setLoadError('Session expired. Please sign in again.');
        return;
      }
      if (r.status === 404) {
        setLoadError('This event was not found or does not belong to your organization.');
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const ev = await r.json();
      if (!('isActive' in ev)) {
        setLoadError('This event does not belong to your organization.');
        return;
      }
      setTitle(ev.title ?? '');
      setType(ev.type ?? 'volunteer');
      setDescription(ev.description ?? '');
      setAddress(ev.address ?? '');
      setCity(ev.city ?? '');
      setStartsAt(isoToDatetimeLocalValue(ev.startsAt));
      setEndsAt(isoToDatetimeLocalValue(ev.endsAt));
      setSpotsTotal(String(ev.spotsTotal ?? ''));
      setWebsiteUrl(ev.websiteUrl ?? '');
    } catch {
      setLoadError('Could not load this event. Is the API running?');
    } finally {
      setLoadingEvent(false);
    }
  }, [id, getAuthHeader]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'organizer') {
    return <Navigate to="/" replace />;
  }

  async function handleStreetBlur() {
    const line = address.trim();
    if (line.length < 4 || city.trim()) return;
    try {
      const r = await fetch(
        `/api/geocode/suggest?line=${encodeURIComponent(line)}`,
        { headers: getAuthHeader() }
      );
      if (!r.ok) return;
      const d = await r.json().catch(() => ({}));
      if (d.city) setCity(d.city);
    } catch {
      /* best-effort */
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    if (spotsTotal.trim() !== '') {
      const n = Number(spotsTotal);
      if (!Number.isInteger(n) || n < 0) {
        setFormError('Spots must be a whole number zero or greater.');
        setSubmitting(false);
        return;
      }
    }

    const payload = {
      title: title.trim(),
      type,
      description: description.trim(),
      address: address.trim(),
      city: city.trim(),
      startsAt: new Date(startsAt).toISOString(),
    };
    if (endsAt.trim()) {
      payload.endsAt = new Date(endsAt).toISOString();
    }
    if (spotsTotal.trim() !== '') {
      payload.spotsTotal = Number(spotsTotal);
    }
    payload.websiteUrl = websiteUrl.trim();

    try {
      const r = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));

      if (r.status === 401) {
        setFormError('Session expired. Please sign in again.');
        return;
      }
      if (r.status === 403) {
        setFormError('You cannot update this event.');
        return;
      }
      if (r.status === 404) {
        setFormError('Event was removed or not found.');
        return;
      }
      if (!r.ok) {
        setFormError(
          data.message ||
            (r.status === 422
              ? 'We could not place that location on the map. Check street and city, or try a larger nearby town.'
              : 'Could not save changes.')
        );
        return;
      }

      navigate('/dashboard', { replace: false, state: { editSuccess: true } });
    } catch {
      setFormError('Network error. Is the API running?');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="post-event">
      <header className="post-event__header">
        <div>
          <p className="post-event__eyebrow">ConnectBC · Organizer</p>
          <h1 className="post-event__title">Edit event</h1>
          <p className="post-event__lead">
            Update street and city (BC is added for the map). Changing either re-geocodes on save.
            City may auto-fill from the street field (OpenStreetMap, or Mapbox if configured).
          </p>
        </div>
        <Link to="/dashboard" className="post-event__back">
          ← Dashboard
        </Link>
      </header>

      {loadingEvent && <p className="post-event__loading">Loading event…</p>}

      {!loadingEvent && loadError && (
        <div className="post-event__form">
          <p className="post-event__banner post-event__banner--error" role="alert">
            {loadError}
          </p>
          <Link to="/dashboard" className="post-event__cancel">
            Back to dashboard
          </Link>
        </div>
      )}

      {!loadingEvent && !loadError && (
        <form className="post-event__form" onSubmit={handleSubmit}>
          {formError && (
            <p className="post-event__banner post-event__banner--error" role="alert">
              {formError}
            </p>
          )}

          <label className="post-event__field">
            <span className="post-event__label">Event title</span>
            <input
              type="text"
              className="post-event__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={500}
              autoComplete="off"
              disabled={submitting}
            />
          </label>

          <label className="post-event__field">
            <span className="post-event__label">Event type</span>
            <select
              className="post-event__input"
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={submitting}
            >
              {EVENT_TYPE_ORDER.map((key) => (
                <option key={key} value={key}>
                  {EVENT_TYPE_LABELS[key]}
                </option>
              ))}
            </select>
          </label>

          <label className="post-event__field">
            <span className="post-event__label">Description</span>
            <textarea
              className="post-event__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              disabled={submitting}
            />
          </label>

          <label className="post-event__field">
            <span className="post-event__label">Street address</span>
            <input
              type="text"
              className="post-event__input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={handleStreetBlur}
              required
              placeholder="e.g. 8345 Winston St"
              autoComplete="street-address"
              disabled={submitting}
            />
          </label>

          <label className="post-event__field">
            <span className="post-event__label">City</span>
            <input
              type="text"
              className="post-event__input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              placeholder="e.g. Burnaby"
              autoComplete="address-level2"
              disabled={submitting}
            />
            <span className="post-event__hint">BC only — province is added for the map pin.</span>
          </label>

          <label className="post-event__field">
            <span className="post-event__label">Event website (optional)</span>
            <input
              type="text"
              className="post-event__input"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://… or yoursite.org/event"
              autoComplete="url"
              inputMode="url"
              disabled={submitting}
            />
          </label>

          <div className="post-event__row">
            <label className="post-event__field post-event__field--half">
              <span className="post-event__label">Start date &amp; time</span>
              <input
                type="datetime-local"
                className="post-event__input"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
                disabled={submitting}
              />
            </label>
            <label className="post-event__field post-event__field--half">
              <span className="post-event__label">End date &amp; time (optional)</span>
              <input
                type="datetime-local"
                className="post-event__input"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                disabled={submitting}
              />
            </label>
          </div>

          <label className="post-event__field">
            <span className="post-event__label">Total spots available</span>
            <input
              type="number"
              className="post-event__input post-event__input--narrow"
              min={0}
              step={1}
              value={spotsTotal}
              onChange={(e) => setSpotsTotal(e.target.value)}
              disabled={submitting}
            />
          </label>

          <div className="post-event__actions">
            <button
              type="submit"
              className="post-event__submit"
              disabled={submitting}
            >
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
            <Link to="/dashboard" className="post-event__cancel">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
