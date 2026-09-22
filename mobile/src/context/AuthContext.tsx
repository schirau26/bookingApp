import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiRequest, authorizedRequest, type PublicUser, type Session } from '../services/api';
import { clearTokens, readTokens, saveTokens } from '../services/tokenStorage';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type RegisterInput = {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  role: 'CUSTOMER' | 'BUSINESS_OWNER';
};

type AuthContextValue = {
  status: AuthStatus;
  user: PublicUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<PublicUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  async function applySession(session: Session) {
    await saveTokens(session.accessToken, session.refreshToken);
    setAccessToken(session.accessToken);
    setRefreshToken(session.refreshToken);
    setUser(session.user);
    setStatus('signedIn');
  }

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const stored = await readTokens();
      if (!stored.accessToken || !stored.refreshToken) {
        if (!cancelled) setStatus('signedOut');
        return;
      }

      try {
        let refreshed = false;
        const current = await authorizedRequest<{ user: PublicUser }>(
          '/api/auth/me',
          {},
          stored,
          async (session) => {
            refreshed = true;
            if (!cancelled) {
              await applySession(session);
            }
          },
        );
        if (cancelled || refreshed) return;
        setAccessToken(stored.accessToken);
        setRefreshToken(stored.refreshToken);
        setUser(current.user);
        setStatus('signedIn');
      } catch {
        await clearTokens();
        if (!cancelled) setStatus('signedOut');
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      async login(email, password) {
        const session = await apiRequest<Session>('/api/auth/login', {
          method: 'POST',
          body: { email, password },
        });
        await applySession(session);
      },
      async register(input) {
        const session = await apiRequest<Session>('/api/auth/register', {
          method: 'POST',
          body: input,
        });
        await applySession(session);
      },
      async logout() {
        if (refreshToken) {
          try {
            await apiRequest('/api/auth/logout', {
              method: 'POST',
              body: { refreshToken },
              accessToken,
            });
          } catch {
            // Local sign-out still proceeds if the network call fails.
          }
        }
        await clearTokens();
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
        setStatus('signedOut');
      },
    }),
    [accessToken, refreshToken, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
