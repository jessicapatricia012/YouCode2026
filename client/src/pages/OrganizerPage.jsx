import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './OrganizerPage.css';

export default function OrganizerPage() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="organizer-page organizer-page--loading">
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'organizer') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="organizer-page">
      <header className="organizer-page__header">
        <div>
          <p className="organizer-page__eyebrow">ConnectBC</p>
          <h1 className="organizer-page__title">Organizer</h1>
          <p className="organizer-page__org">{user.name}</p>
        </div>
        <div className="organizer-page__actions">
          <Link to="/" className="organizer-page__link organizer-page__link--primary">
            Browse map
          </Link>
          <button type="button" className="organizer-page__logout" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="organizer-page__main">
        <p className="organizer-page__lead">
          This space is for posting and managing your nonprofit&apos;s opportunities. The map and
          filters stay the same for everyone — your <strong>role</strong> unlocks organizer tools
          here as we build them.
        </p>
        <div className="organizer-page__placeholder">
          <h2>Coming soon</h2>
          <ul>
            <li>Create and edit events</li>
            <li>View signups for your listings</li>
            <li>Update org profile and branding</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
