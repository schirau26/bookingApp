import { useEffect, useState } from 'react';
import { ApiError, apiRequest, readSession } from './api';

type UserRole = 'CUSTOMER' | 'BUSINESS_OWNER' | 'ADMIN';
type UserStatus = 'ACTIVE' | 'SUSPENDED';

type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
};

type UserList = {
  users: AdminUser[];
  page: number;
  limit: number;
  total: number;
};

const roles: Array<UserRole | ''> = ['', 'CUSTOMER', 'BUSINESS_OWNER', 'ADMIN'];
const statuses: Array<UserStatus | ''> = ['', 'ACTIVE', 'SUSPENDED'];

export function UsersPanel({ currentUserId }: { currentUserId: string }) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<UserList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState<AdminUser | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (query.trim()) params.set('q', query.trim());
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    const session = readSession();

    apiRequest<UserList>(`/api/admin/users?${params.toString()}`, { accessToken: session.accessToken })
      .then((body) => {
        if (!controller.signal.aborted) {
          setResult(body);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof ApiError ? caught.message : 'Unable to load users.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, query, revision, role, status]);

  const pageCount = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

  async function confirm() {
    if (!pending) return;
    const session = readSession();
    const action = pending.status === 'SUSPENDED' ? 'activate' : 'suspend';
    setError(null);
    try {
      await apiRequest(`/api/admin/users/${pending.id}/${action}`, {
        method: 'POST',
        accessToken: session.accessToken,
      });
      setPending(null);
      setLoading(true);
      setRevision((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update this user.');
    }
  }

  return (
    <section className="card businesses">
      <h2>Users</h2>
      <form
        className="toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          setPage(1);
          setQuery((event.currentTarget.elements.namedItem('q') as HTMLInputElement).value);
        }}
      >
        <input name="q" placeholder="Search by name or email" defaultValue={query} />
        <select
          aria-label="Role"
          value={role}
          onChange={(event) => {
            setLoading(true);
            setRole(event.target.value as UserRole | '');
            setPage(1);
          }}
        >
          {roles.map((value) => (
            <option key={value || 'all-roles'} value={value}>
              {value || 'All roles'}
            </option>
          ))}
        </select>
        <select
          aria-label="Account status"
          value={status}
          onChange={(event) => {
            setLoading(true);
            setStatus(event.target.value as UserStatus | '');
            setPage(1);
          }}
        >
          {statuses.map((value) => (
            <option key={value || 'all-statuses'} value={value}>
              {value || 'All statuses'}
            </option>
          ))}
        </select>
        <button type="submit">Search</button>
      </form>
      {loading ? <p>Loading users…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {result && result.users.length === 0 ? <p>No users match this search.</p> : null}
      {result && result.users.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {result.users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.fullName}</strong>
                    <span>{user.email}</span>
                  </td>
                  <td>{user.role}</td>
                  <td>{user.status}</td>
                  <td className="actions">
                    {user.id === currentUserId ? null : (
                      <button type="button" onClick={() => setPending(user)}>
                        {user.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="pager">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => {
            setLoading(true);
            setPage((current) => current - 1);
          }}
        >
          Previous
        </button>
        <span>
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => {
            setLoading(true);
            setPage((current) => current + 1);
          }}
        >
          Next
        </button>
      </div>
      {pending ? (
        <div className="confirm">
          <p>
            {pending.status === 'SUSPENDED'
              ? `Activate ${pending.fullName}?`
              : `Suspend ${pending.fullName}?`}
          </p>
          <button type="button" onClick={() => setPending(null)}>
            Cancel
          </button>
          <button type="button" onClick={() => void confirm()}>
            Confirm
          </button>
        </div>
      ) : null}
    </section>
  );
}
