import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './LoginPage.css';

function destinationAfterAuth(role) {
  return role === 'organizer' ? '/organize' : '/';
}

export default function RegisterPage() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('user');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card login-card--loading">Loading…</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={destinationAfterAuth(user.role)} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (password !== confirm) {
      setFormError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await register(name, email, password, role);
      navigate(destinationAfterAuth(created.role), { replace: true });
    } catch (err) {
      setFormError(err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  const nameLabel = role === 'organizer' ? 'Organization name' : 'Your name';
  const namePlaceholder =
    role === 'organizer' ? 'Your nonprofit name' : 'First and last name';

  return (
    <div className="login-page">
      <div className="login-card">
        <header className="login-card__header">
          <h1 className="login-card__title">Create account</h1>
          <p className="login-card__subtitle">
            Choose whether you&apos;re signing up to volunteer/browse or to represent a nonprofit.
            Sign-in later uses the same screen for everyone.
          </p>
        </header>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span className="login-field__label">Account type</span>
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              aria-label="Account type"
            >
              <option value="user">Volunteer / browser</option>
              <option value="organizer">Nonprofit organizer</option>
            </select>
          </label>
          <label className="login-field">
            <span className="login-field__label">{nameLabel}</span>
            <input
              type="text"
              name="name"
              autoComplete={role === 'organizer' ? 'organization' : 'name'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={namePlaceholder}
            />
          </label>
          <label className="login-field">
            <span className="login-field__label">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@email.com"
            />
          </label>
          <label className="login-field">
            <span className="login-field__label">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </label>
          <label className="login-field">
            <span className="login-field__label">Confirm password</span>
            <input
              type="password"
              name="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              placeholder="Repeat password"
            />
          </label>
          {formError && <p className="login-form__error">{formError}</p>}
          <button
            type="submit"
            className="login-form__submit"
            disabled={submitting}
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="login-card__switch">
          <span>Already have an account?</span>
          <Link to="/login" className="login-card__switch-link">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
