import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import MapPage from './pages/MapPage.jsx';
import OrgDashboard from './pages/OrgDashboard.jsx';
import PostEventPage from './pages/PostEventPage.jsx';
import EditEventPage from './pages/EditEventPage.jsx';
import VisitorPage from './pages/VisitorPage.jsx';
import VolunteerSignupsPage from './pages/VolunteerSignupsPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-boot">
        <p>Checking session…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate to="/login" replace state={{ from: location }} />
    );
  }

  return children;
}

function OrganizerOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="auth-boot">
        <p>Checking session…</p>
      </div>
    );
  }
  if (user?.role !== 'organizer') {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AdminOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="auth-boot">
        <p>Checking session…</p>
      </div>
    );
  }
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MapPage />
          </ProtectedRoute>
        }
      />
      <Route path="/organize" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <OrganizerOnly>
              <OrgDashboard />
            </OrganizerOnly>
          </ProtectedRoute>
        }
      />
      <Route
        path="/post"
        element={
          <ProtectedRoute>
            <OrganizerOnly>
              <PostEventPage />
            </OrganizerOnly>
          </ProtectedRoute>
        }
      />
      <Route
        path="/edit/:id"
        element={
          <ProtectedRoute>
            <OrganizerOnly>
              <EditEventPage />
            </OrganizerOnly>
          </ProtectedRoute>
        }
      />
      <Route
        path="/visitor"
        element={
          <ProtectedRoute>
            <VisitorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-signups"
        element={
          <ProtectedRoute>
            <VolunteerSignupsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminOnly>
              <AdminPage />
            </AdminOnly>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
