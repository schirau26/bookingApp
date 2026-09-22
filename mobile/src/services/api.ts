export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export type PublicUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  profileImageUrl: string | null;
  role: 'CUSTOMER' | 'BUSINESS_OWNER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
};

export type Session = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

type ErrorBody = {
  error?: {
    message?: string;
    details?: { path: string; message: string }[];
  };
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    accessToken?: string | null;
  } = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json().catch(() => ({}))) as T & ErrorBody;
  if (!response.ok) {
    throw new ApiError(
      data.error?.message ?? 'Something went wrong. Try again.',
      response.status,
      data.error?.details ?? [],
    );
  }

  return data;
}

export async function authorizedRequest<T>(
  path: string,
  options: { method?: string; body?: unknown },
  tokens: { accessToken: string | null; refreshToken: string | null },
  persist: (session: Session) => Promise<void>,
): Promise<T> {
  try {
    return await apiRequest<T>(path, { ...options, accessToken: tokens.accessToken });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !tokens.refreshToken) {
      throw error;
    }

    const session = await apiRequest<Session>('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken: tokens.refreshToken },
    });
    await persist(session);
    return apiRequest<T>(path, { ...options, accessToken: session.accessToken });
  }
}
