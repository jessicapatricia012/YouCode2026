import { useEffect, useState } from 'react';

export default function App() {
  const [ping, setPing] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/ping')
      .then((r) => r.json())
      .then(setPing)
      .catch(() => setError('Could not reach API. Is the server running on port 3001?'));
  }, []);

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>BC Nonprofit Events</h1>
      <p>Monorepo scaffold: Vite client + Express API.</p>
      <section>
        <h2>GET /api/ping</h2>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        {ping && (
          <pre style={{ background: '#f4f4f5', padding: '1rem', borderRadius: 8 }}>
            {JSON.stringify(ping, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}
