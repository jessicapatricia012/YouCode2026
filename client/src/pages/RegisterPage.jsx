import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './LoginPage.css';

export default function RegisterPage() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('user');
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
    return <Navigate to="/" replace />;
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
      await register(email, password, role);
      navigate('/', { replace: true });
    } catch (err) {
      setFormError(err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <header className="login-card__header">
          <h1 className="login-card__title">Create account</h1>
          <p className="login-card__subtitle">
            Join ConnectBC as a visitor or organizer. You’ll be signed in right away.
          </p>
        </header>

        <div className="login-role" role="group" aria-label="Account type">
          <button
            type="button"
            className={`login-role__btn ${role === 'user' ? 'login-role__btn--active' : ''}`}
            onClick={() => setRole('user')}
          >
            Visitor
            <span className="login-role__hint">Browse &amp; sign up</span>
          </button>
          <button
            type="button"
            className={`login-role__btn ${role === 'organizer' ? 'login-role__btn--active' : ''}`}
            onClick={() => setRole('organizer')}
          >
            Organizer
            <span className="login-role__hint">Post opportunities</span>
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span className="login-field__label">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={
                role === 'organizer'
                  ? 'organizer@yournonprofit.org'
                  : 'you@email.com'
              }
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
