import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './LoginPage.css';

function destinationAfterAuth(fromState, role) {
  const from = fromState?.from?.pathname;
  if (from && from !== '/login' && from !== '/register') return from;
  return role === 'organizer' ? '/dashboard' : '/visitor';
}

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
    return <Navigate to={destinationAfterAuth(location.state, user.role)} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const loggedIn = await login(email, password);
      navigate(destinationAfterAuth(location.state, loggedIn.role), { replace: true });
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
            One sign-in for ConnectBC. After you log in, visitors browse the map; organizers get
            extra tools on the Manage listings page.
          </p>
        </header>

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
              placeholder="you@email.com"
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
          After <code>npm run seed</code>: visitor emails like <code>visitor1@connectbc.demo</code>{' '}
          or any seeded org email — password <code>password123</code>. Your account type is stored
          on the server; no need to pick it when signing in. Seeding clears all user-created accounts.
        </p>
      </div>
    </div>
  );
}
