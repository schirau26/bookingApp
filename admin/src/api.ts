const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export type PublicUser = {
  id: string;
  email: string;
  fullName: string;
  role: 'CUSTOMER' | 'BUSINESS_OWNER' | 'ADMIN';
};

type ErrorBody = {
  error?: { message?: string };
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const accessKey = 'booking.accessToken';
const refreshKey = 'booking.refreshToken';

export function readSession() {
  return {
    accessToken: sessionStorage.getItem(accessKey),
    refreshToken: sessionStorage.getItem(refreshKey),
  };
}

export function saveSession(accessToken: string, refreshToken: string) {
  sessionStorage.setItem(accessKey, accessToken);
  sessionStorage.setItem(refreshKey, refreshToken);
}

export function clearSession() {
  sessionStorage.removeItem(accessKey);
  sessionStorage.removeItem(refreshKey);
}

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; accessToken?: string | null } = {},
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
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
    throw new ApiError(data.error?.message ?? 'Something went wrong. Try again.', response.status);
  }
  return data;
}

export { apiUrl };
