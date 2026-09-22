import { useEffect, useState } from 'react';
import './App.css';
import { BusinessesPanel } from './Businesses';
import { ReviewsPanel } from './Reviews';
import {
  ApiError,
  apiRequest,
  apiUrl,
  clearSession,
  readSession,
  saveSession,
  type PublicUser,
} from './api';

type HealthState = { status: 'loading' } | { status: 'ok' } | { status: 'error'; message: string };

type SessionResponse = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

function validateLogin(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return 'Enter a valid email address.';
  }
  if (!password) {
    return 'Enter your password.';
  }
  return null;
}

export default function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(() => !readSession().accessToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });

  useEffect(() => {
    const stored = readSession();
    if (!stored.accessToken) {
      return;
    }

    let cancelled = false;
    apiRequest<{ user: PublicUser }>('/api/admin/me', { accessToken: stored.accessToken })
      .then((body) => {
        if (!cancelled) setUser(body.user);
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();
    fetch(`${apiUrl}/api/health`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`API responded with ${response.status}`);
        const body = (await response.json()) as { status?: string };
        if (body.status !== 'ok') throw new Error('API health check did not return ok');
        setHealth({ status: 'ok' });
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setHealth({
          status: 'error',
          message: caught instanceof Error ? caught.message : 'Unable to reach the API',
        });
      });

    return () => controller.abort();
  }, [user]);

  async function submit() {
    const validationError = validateLogin(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    let session: SessionResponse | null = null;
    try {
      session = await apiRequest<SessionResponse>('/api/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      });
      const admin = await apiRequest<{ user: PublicUser }>('/api/admin/me', {
        accessToken: session.accessToken,
      });
      saveSession(session.accessToken, session.refreshToken);
      setUser(admin.user);
      setPassword('');
    } catch (caught) {
      if (session && caught instanceof ApiError && caught.status === 403) {
        setError('This account cannot open the admin dashboard.');
        await apiRequest('/api/auth/logout', {
          method: 'POST',
          body: { refreshToken: session.refreshToken },
        }).catch(() => undefined);
      } else {
        setError(caught instanceof ApiError ? caught.message : 'Unable to sign in.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    const stored = readSession();
    if (stored.refreshToken) {
      try {
        await apiRequest('/api/auth/logout', {
          method: 'POST',
          body: { refreshToken: stored.refreshToken },
          accessToken: stored.accessToken,
        });
      } catch {
        // Clearing the browser session is enough if the API is unreachable.
      }
    }
    clearSession();
    setUser(null);
    setHealth({ status: 'loading' });
  }

  if (!ready) {
    return (
      <main className="shell">
        <p>Checking your session…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="shell">
        <p className="eyebrow">Booking platform</p>
        <h1>Admin sign in</h1>
        <p className="intro">Administrators use the same API as the mobile app.</p>
        <form
          className="card form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="shell wide">
      <p className="eyebrow">Booking platform</p>
      <h1>Admin</h1>
      <p className="intro">
        Signed in as {user.fullName} ({user.email}).
      </p>
      <BusinessesPanel />
      <ReviewsPanel />
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
      <button className="logout" type="button" onClick={() => void logout()}>
        Log out
      </button>
    </main>
  );
}
