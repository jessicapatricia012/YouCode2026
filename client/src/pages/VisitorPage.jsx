import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SkillTagPicker from '../components/SkillTagPicker.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { normalizeSkillTagsClient } from '../skillTags.js';
import './VisitorPage.css';

export default function VisitorPage() {
  const navigate = useNavigate();
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

  useEffect(() => {
    fetchProfile();
  }, []);

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
        // Navigate back to map after successful save
        setTimeout(() => navigate('/'), 1500);
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
        <p className="visitor-header__matches">
          <Link to="/" className="visitor-header__matches-link">
            Open the map — the sidebar “For you” section lists events that fit your skills; tap one to
            show its pin.
          </Link>
        </p>
      </header>

      <form className="visitor-form" onSubmit={handleSubmit}>
        <section className="form-section">
          <h2>Skills</h2>
          <p>
            Choose tags that match what you can offer. On the map, use the sidebar “For you” section
            (see link above) to open events that need these skills.
          </p>
          <SkillTagPicker
            value={profile.skills}
            onChange={(skills) => setProfile({ ...profile, skills })}
            disabled={saving}
            idPrefix="visitor-skill"
          />
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

        <div className="visitor-form__actions">
          <button
            type="button"
            className="visitor-form__cancel-btn"
            onClick={() => navigate('/')}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className="visitor-form__submit-btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
