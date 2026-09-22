import { useEffect, useState } from 'react';
import './App.css';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

type HealthState = { status: 'loading' } | { status: 'ok' } | { status: 'error'; message: string };

export default function App() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    async function loadHealth() {
      try {
        const response = await fetch(`${apiUrl}/api/health`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API responded with ${response.status}`);
        }

        const body = (await response.json()) as { status?: string };
        if (body.status !== 'ok') {
          throw new Error('API health check did not return ok');
        }

        setHealth({ status: 'ok' });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setHealth({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to reach the API',
        });
      }
    }

    void loadHealth();

    return () => controller.abort();
  }, []);

  return (
    <main className="shell">
      <p className="eyebrow">Booking platform</p>
      <h1>Admin</h1>
      <p className="intro">
        This dashboard shell checks that the API is reachable. Management screens arrive in a later
        phase.
      </p>
      <section className="card" aria-live="polite">
        <h2>API status</h2>
        {health.status === 'loading' ? <p>Checking the API…</p> : null}
        {health.status === 'ok' ? (
          <p>
            <span className="badge ok">Online</span>
            <span className="endpoint">{apiUrl}/api/health</span>
          </p>
        ) : null}
        {health.status === 'error' ? (
          <p>
            <span className="badge error">Unavailable</span>
            <span className="endpoint">{health.message}</span>
          </p>
        ) : null}
      </section>
    </main>
  );
}
