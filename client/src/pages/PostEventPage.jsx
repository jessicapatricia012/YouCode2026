import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import SkillTagPicker from '../components/SkillTagPicker.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { EVENT_TYPE_LABELS, EVENT_TYPE_ORDER } from '../eventTypes.js';
import './PostEventPage.css';

export default function PostEventPage() {
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
  const [skillTags, setSkillTags] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

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
      /* suggest is best-effort */
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
    if (websiteUrl.trim()) {
      payload.websiteUrl = websiteUrl.trim();
    }
    if (skillTags.length > 0) {
      payload.skillTags = skillTags;
    }

    try {
      const r = await fetch('/api/events', {
        method: 'POST',
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
        setFormError('Only nonprofit organizers can post events.');
        return;
      }
      if (!r.ok) {
        setFormError(
          data.message ||
            (r.status === 422
              ? 'We could not place that location on the map. Check street and city, or try a larger nearby town.'
              : 'Could not create the event.')
        );
        return;
      }

      navigate('/dashboard', { replace: false, state: { postSuccess: true } });
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
          <h1 className="post-event__title">Post new event</h1>
          <p className="post-event__lead">
            Events appear on the public map after you publish. Use street + city (BC is added
            automatically). City may fill in when you leave the street field (OpenStreetMap, or
            Mapbox if configured).
          </p>
        </div>
        <Link to="/dashboard" className="post-event__back">
          ← Dashboard
        </Link>
      </header>

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

        <div className="post-event__field">
          <span className="post-event__label">Skills needed (optional)</span>
          <p className="post-event__hint post-event__hint--above">
            Tag this listing so volunteers with matching skills get recommendations.
          </p>
          <SkillTagPicker
            value={skillTags}
            onChange={setSkillTags}
            disabled={submitting}
            idPrefix="post-skill"
          />
        </div>

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
          <span className="post-event__label">Total spots available (optional)</span>
          <input
            type="number"
            className="post-event__input post-event__input--narrow"
            min={0}
            step={1}
            value={spotsTotal}
            onChange={(e) => setSpotsTotal(e.target.value)}
            placeholder="Default: 50"
            disabled={submitting}
          />
        </label>

        <div className="post-event__actions">
          <button
            type="submit"
            className="post-event__submit"
            disabled={submitting}
          >
            {submitting ? 'Publishing…' : 'Publish event'}
          </button>
          <Link to="/dashboard" className="post-event__cancel">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
