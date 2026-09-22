import { useEffect, useState } from 'react';
import { ApiError, apiRequest, readSession } from './api';

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

type AdminBooking = {
  id: string;
  startsAt: string;
  status: BookingStatus;
  customerName: string;
  customerEmail: string;
  price: string;
  business: { name: string };
  serviceName: string;
};

type BookingList = {
  bookings: AdminBooking[];
  page: number;
  limit: number;
  total: number;
};

const statuses: Array<BookingStatus | ''> = ['', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

export function BookingsPanel() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<BookingStatus | ''>('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<BookingList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (query.trim()) params.set('q', query.trim());
    if (status) params.set('status', status);
    const session = readSession();

    apiRequest<BookingList>(`/api/admin/bookings?${params.toString()}`, {
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
        setError(caught instanceof ApiError ? caught.message : 'Unable to load bookings.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, query, status]);

  const pageCount = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

  return (
    <section className="card businesses">
      <h2>Bookings</h2>
      <form
        className="toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          setPage(1);
          setQuery((event.currentTarget.elements.namedItem('q') as HTMLInputElement).value);
        }}
      >
        <input name="q" placeholder="Search customer or business" defaultValue={query} />
        <select
          aria-label="Booking status"
          value={status}
          onChange={(event) => {
            setLoading(true);
            setStatus(event.target.value as BookingStatus | '');
            setPage(1);
          }}
        >
          {statuses.map((value) => (
            <option key={value || 'all'} value={value}>
              {value || 'All statuses'}
            </option>
          ))}
        </select>
        <button type="submit">Search</button>
      </form>
      {loading ? <p>Loading bookings…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {result && result.bookings.length === 0 ? <p>No bookings match this search.</p> : null}
      {result && result.bookings.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Business</th>
                <th>Service</th>
                <th>Status</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {result.bookings.map((booking) => (
                <tr key={booking.id}>
                  <td>
                    {booking.customerName}
                    <span>{booking.customerEmail}</span>
                  </td>
                  <td>{booking.business.name}</td>
                  <td>{booking.serviceName}</td>
                  <td>{booking.status}</td>
                  <td>N${booking.price}</td>
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
    </section>
  );
}
