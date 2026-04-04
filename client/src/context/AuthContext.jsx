import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password, role) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      let msg = 'Login failed.';
      if (data.error === 'invalid_credentials') {
        msg = 'Invalid email or password.';
      } else if (data.error === 'wrong_role') {
        msg =
          data.actualRole === 'organizer'
            ? 'That account is an organizer. Switch to “Organizer” above.'
            : 'That account is a visitor. Switch to “Visitor” above.';
      } else if (data.error === 'invalid_role') {
        msg = 'Choose whether you are signing in as a visitor or an organizer.';
      }
      throw new Error(msg);
    }
    setUser(data.user);
  }, []);

  const register = useCallback(async (email, password, role) => {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      let msg = 'Could not create account.';
      if (data.error === 'email_taken') {
        msg = 'An account with this email already exists. Sign in instead.';
      } else if (data.error === 'weak_password') {
        msg = `Use at least 8 characters for your password.`;
      } else if (data.error === 'invalid_email') {
        msg = 'Enter a valid email address.';
      } else if (data.error === 'invalid_role') {
        msg = 'Choose visitor or organizer.';
      }
      throw new Error(msg);
    }
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
