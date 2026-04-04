import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import './VisitorPage.css';

export default function VisitorPage() {
  const { user, getAuthHeader } = useAuth();
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
        setProfile(data);
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
      } else {
        setMessage({ type: 'error', text: 'Failed to update profile.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Something went wrong.' });
    } finally {
      setSaving(false);
    }
  }

  function handleSkillChange(index, value) {
    const newSkills = [...profile.skills];
    newSkills[index] = value;
    setProfile({ ...profile, skills: newSkills });
  }

  function addSkill() {
    setProfile({ ...profile, skills: [...profile.skills, ''] });
  }

  function removeSkill(index) {
    const newSkills = profile.skills.filter((_, i) => i !== index);
    setProfile({ ...profile, skills: newSkills });
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
          <p>What skills do you have that could help with volunteering?</p>
          {profile.skills.map((skill, index) => (
            <div key={index} className="skill-input-group">
              <input
                type="text"
                value={skill}
                onChange={(e) => handleSkillChange(index, e.target.value)}
                placeholder="e.g., Cooking, Driving, First Aid"
              />
              <button type="button" onClick={() => removeSkill(index)} className="remove-btn">Remove</button>
            </div>
          ))}
          <button type="button" onClick={addSkill} className="add-btn">Add Skill</button>
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
              <button type="button" onClick={() => removeInterest(index)} className="remove-btn">Remove</button>
            </div>
          ))}
          <button type="button" onClick={addInterest} className="add-btn">Add Interest</button>
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
          <div className={`message message--${message.type}`}>
            {message.text}
          </div>
        )}

        <button type="submit" className="save-btn" disabled={saving}>
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}