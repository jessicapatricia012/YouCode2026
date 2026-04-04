import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SkillTagPicker from '../components/SkillTagPicker.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { normalizeSkillTagsClient, SKILL_TAGS } from '../skillTags.js';
import './VisitorPage.css';

function formatStartsAt(iso) {
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

export default function VisitorPage() {
  const { getAuthHeader } = useAuth();
  const [profile, setProfile] = useState({
    skills: [],
    availability: '',
    interests: [],
    experience: '',
    contactPreferences: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [recs, setRecs] = useState(null);
  const [recsLoading, setRecsLoading] = useState(false);

  const loadRecommendations = useCallback(async () => {
    setRecsLoading(true);
    try {
      const r = await fetch('/api/volunteer/recommendations', {
        headers: getAuthHeader(),
      });
      if (r.ok) setRecs(await r.json());
    } catch {
      /* ignore */
    } finally {
      setRecsLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (!loading) loadRecommendations();
  }, [loading, loadRecommendations]);

  async function fetchProfile() {
    try {
      const r = await fetch('/api/volunteer/profile', {
        headers: getAuthHeader(),
      });
      if (r.ok) {
        const data = await r.json();
        setProfile({
          ...data,
          skills: normalizeSkillTagsClient(data.skills ?? []),
        });
      } else {
        console.error('Failed to fetch profile');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const r = await fetch('/api/volunteer/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(profile),
      });
      if (r.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        await loadRecommendations();
      } else {
        setMessage({ type: 'error', text: 'Failed to update profile.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Something went wrong.' });
    } finally {
      setSaving(false);
    }
  }

  function handleInterestChange(index, value) {
    const newInterests = [...profile.interests];
    newInterests[index] = value;
    setProfile({ ...profile, interests: newInterests });
  }

  function addInterest() {
    setProfile({ ...profile, interests: [...profile.interests, ''] });
  }

  function removeInterest(index) {
    const newInterests = profile.interests.filter((_, i) => i !== index);
    setProfile({ ...profile, interests: newInterests });
  }

  if (loading) {
    return <div className="visitor-page">Loading profile…</div>;
  }

  return (
    <div className="visitor-page">
      <header className="visitor-header">
        <h1>Volunteer Profile</h1>
        <p>Help us match you with the right opportunities by sharing your skills and availability.</p>
      </header>

      <form className="visitor-form" onSubmit={handleSubmit}>
        <section className="form-section">
          <h2>Skills</h2>
          <p>Choose tags that match what you can offer — we&apos;ll suggest events that need them.</p>
          <SkillTagPicker
            value={profile.skills}
            onChange={(skills) => setProfile({ ...profile, skills })}
            disabled={saving}
            idPrefix="visitor-skill"
          />
          <p className="visitor-page__rec-hint">
            Save your profile to refresh recommendations below.
          </p>
        </section>

        <section className="form-section visitor-page__recommendations">
          <h2>Recommended for you</h2>
          {recsLoading && <p className="visitor-page__rec-muted">Loading suggestions…</p>}
          {!recsLoading && recs?.needsSkills && (
            <p className="visitor-page__rec-muted">
              Add at least one skill tag above to see matching events.
            </p>
          )}
          {!recsLoading && recs && !recs.needsSkills && recs.events.length === 0 && (
            <p className="visitor-page__rec-muted">
              No upcoming events match your skills yet. Check back later or try the map.
            </p>
          )}
          {!recsLoading && recs && !recs.needsSkills && recs.events.length > 0 && (
            <ul className="visitor-page__rec-list">
              {recs.events.map((ev) => (
                <li key={ev.id} className="visitor-page__rec-card">
                  <h3 className="visitor-page__rec-title">{ev.title}</h3>
                  <p className="visitor-page__rec-org">{ev.orgName}</p>
                  <p className="visitor-page__rec-meta">
                    {formatStartsAt(ev.startsAt)}
                    {ev.spotsLeft > 0
                      ? ` · ${ev.spotsLeft} spot${ev.spotsLeft === 1 ? '' : 's'} left`
                      : ' · Full'}
                  </p>
                  {ev.skillMatchCount > 0 && (
                    <p className="visitor-page__rec-match">
                      {ev.skillMatchCount} matching skill{ev.skillMatchCount === 1 ? '' : 's'}
                    </p>
                  )}
                  {ev.skillTags?.length > 0 && (
                    <p className="visitor-page__rec-tags">
                      {ev.skillTags
                        .map((id) => SKILL_TAGS.find((t) => t.id === id)?.label ?? id)
                        .join(' · ')}
                    </p>
                  )}
                  <Link to="/" className="visitor-page__rec-map-link">
                    Open map
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="form-section">
          <h2>Availability</h2>
          <p>When are you typically available to volunteer?</p>
          <textarea
            value={profile.availability}
            onChange={(e) => setProfile({ ...profile, availability: e.target.value })}
            placeholder="e.g., Weekends, Evenings, Weekdays after 5 PM"
            rows={3}
          />
        </section>

        <section className="form-section">
          <h2>Interests</h2>
          <p>What types of volunteering are you interested in?</p>
          {profile.interests.map((interest, index) => (
            <div key={index} className="interest-input-group">
              <input
                type="text"
                value={interest}
                onChange={(e) => handleInterestChange(index, e.target.value)}
                placeholder="e.g., Community, Environment, Education"
              />
              <button type="button" onClick={() => removeInterest(index)} className="remove-btn">
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={addInterest} className="add-btn">
            Add Interest
          </button>
        </section>

        <section className="form-section">
          <h2>Experience</h2>
          <p>Describe any previous volunteer experience you have.</p>
          <textarea
            value={profile.experience}
            onChange={(e) => setProfile({ ...profile, experience: e.target.value })}
            placeholder="Share your volunteer history..."
            rows={4}
          />
        </section>

        <section className="form-section">
          <h2>Contact Preferences</h2>
          <p>How would you prefer to be contacted about opportunities?</p>
          <input
            type="text"
            value={profile.contactPreferences}
            onChange={(e) => setProfile({ ...profile, contactPreferences: e.target.value })}
            placeholder="e.g., Email, Phone, Text"
          />
        </section>

        <section className="form-section">
          <h2>Emergency Contact</h2>
          <p>Optional: Provide emergency contact information.</p>
          <input
            type="text"
            value={profile.emergencyContactName}
            onChange={(e) => setProfile({ ...profile, emergencyContactName: e.target.value })}
            placeholder="Name"
          />
          <input
            type="tel"
            value={profile.emergencyContactPhone}
            onChange={(e) => setProfile({ ...profile, emergencyContactPhone: e.target.value })}
            placeholder="Phone number"
          />
        </section>

        {message && (
          <div className={`message message--${message.type}`}>{message.text}</div>
        )}

        <button type="submit" className="save-btn" disabled={saving}>
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
