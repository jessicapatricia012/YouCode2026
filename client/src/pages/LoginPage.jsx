import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './LoginPage.css';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [role, setRole] = useState('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await login(email, password, role);
      navigate(from, { replace: true });
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
          <h1 className="login-card__title">Sign in</h1>
          <p className="login-card__subtitle">
            ConnectBC — sign in as a visitor to browse and join events, or as an organizer
            to post opportunities.
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </label>
          {formError && <p className="login-form__error">{formError}</p>}
          <button
            type="submit"
            className="login-form__submit"
            disabled={submitting}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-card__register-block">
          <p className="login-card__register-label">New to ConnectBC?</p>
          <Link
            to="/register"
            className="login-form__create-account login-form__create-account--block"
          >
            Create account
          </Link>
        </div>

        <p className="login-card__hint">
          Demo: visitor <code>visitor@bc.org</code> / organizer <code>organizer@bc.org</code>{' '}
          — password <code>demo123</code> for both (set{' '}
          <code>VISITOR_EMAIL</code>, <code>ORGANIZER_EMAIL</code>, <code>DEMO_PASSWORD</code> in{' '}
          <code>server/.env</code>). Legacy <code>DEMO_EMAIL</code> maps to the visitor account.
        </p>
      </div>
    </div>
  );
}
