import { useEffect, useState } from 'react';
import { ApiError, apiRequest, readSession } from './api';

type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

type AdminBusiness = {
  id: string;
  name: string;
  address: string;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  category: { name: string };
  owner: { fullName: string; email: string };
};

type ListResponse = {
  businesses: AdminBusiness[];
  page: number;
  limit: number;
  total: number;
};

const statuses: Array<ApprovalStatus | ''> = ['', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];

const statusLabels: Record<ApprovalStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
};

type PendingAction =
  | { type: 'approve' | 'suspend'; business: AdminBusiness }
  | { type: 'reject'; business: AdminBusiness; reason: string }
  | null;

export function BusinessesPanel() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ApprovalStatus | ''>('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingAction>(null);
  const [working, setWorking] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (query.trim()) params.set('q', query.trim());
    if (status) params.set('status', status);
    const session = readSession();

    apiRequest<ListResponse>(`/api/admin/businesses?${params.toString()}`, {
      accessToken: session.accessToken,
    })
      .then((body) => {
        if (!controller.signal.aborted) {
          setResult(body);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof ApiError ? caught.message : 'Unable to load businesses.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, query, revision, status]);

  const pageCount = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

  async function confirm() {
    if (!pending) return;
    setWorking(true);
    setError(null);
    const session = readSession();
    try {
      if (pending.type === 'reject' && !pending.reason.trim()) {
        setError('Enter a reason before rejecting this business.');
        return;
      }
      const path =
        pending.type === 'approve'
          ? `/api/admin/businesses/${pending.business.id}/approve`
          : pending.type === 'suspend'
            ? `/api/admin/businesses/${pending.business.id}/suspend`
            : `/api/admin/businesses/${pending.business.id}/reject`;
      await apiRequest(path, {
        method: 'POST',
        accessToken: session.accessToken,
        body: pending.type === 'reject' ? { reason: pending.reason.trim() } : {},
      });
      setPending(null);
      setLoading(true);
      setRevision((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update this business.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="card businesses">
      <h2>Businesses</h2>
      <form
        className="toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          setPage(1);
          setQuery((event.currentTarget.elements.namedItem('q') as HTMLInputElement).value);
        }}
      >
        <input name="q" placeholder="Search by name" defaultValue={query} />
        <select
          aria-label="Approval status"
          value={status}
          onChange={(event) => {
            setLoading(true);
            setStatus(event.target.value as ApprovalStatus | '');
            setPage(1);
          }}
        >
          {statuses.map((value) => (
            <option key={value || 'all'} value={value}>
              {value ? statusLabels[value] : 'All statuses'}
            </option>
          ))}
        </select>
        <button type="submit">Search</button>
      </form>
      {loading ? <p>Loading businesses…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {result && result.businesses.length === 0 ? <p>No businesses match this search.</p> : null}
      {result && result.businesses.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Owner</th>
                <th>Category</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.businesses.map((business) => (
                <tr key={business.id}>
                  <td>
                    <strong>{business.name}</strong>
                    <span>{business.address}</span>
                    {business.rejectionReason ? <span>{business.rejectionReason}</span> : null}
                  </td>
                  <td>
                    {business.owner.fullName}
                    <span>{business.owner.email}</span>
                  </td>
                  <td>{business.category.name}</td>
                  <td>{statusLabels[business.approvalStatus]}</td>
                  <td className="actions">
                    <button type="button" onClick={() => setPending({ type: 'approve', business })}>
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setPending({ type: 'reject', business, reason: '' })}
                    >
                      Reject
                    </button>
                    <button type="button" onClick={() => setPending({ type: 'suspend', business })}>
                      Suspend
                    </button>
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
        <form
          className="confirm"
          onSubmit={(event) => {
            event.preventDefault();
            void confirm();
          }}
        >
          <p>
            {pending.type === 'approve'
              ? `Approve ${pending.business.name}?`
              : pending.type === 'suspend'
                ? `Suspend ${pending.business.name}?`
                : `Reject ${pending.business.name}?`}
          </p>
          {pending.type === 'reject' ? (
            <label>
              Reason
              <textarea
                value={pending.reason}
                onChange={(event) =>
                  setPending({ ...pending, reason: event.target.value })
                }
              />
            </label>
          ) : null}
          <div className="actions">
            <button type="submit" disabled={working}>
              {working ? 'Saving…' : 'Confirm'}
            </button>
            <button type="button" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
