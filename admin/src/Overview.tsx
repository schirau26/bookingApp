import { useEffect, useState } from 'react';
import { ApiError, apiRequest, readSession } from './api';

type Stats = {
  users: { total: number; customers: number; owners: number; admins: number; suspended: number };
  businesses: { pending: number; approved: number; rejected: number; suspended: number };
  bookings: { pending: number; confirmed: number; completed: number; cancelled: number; noShow: number };
  reviews: number;
  openReports: number;
  categories: number;
  recentBookings: Array<{
    id: string;
    startsAt: string;
    status: string;
    customerName: string;
    business: { name: string };
    serviceName: string;
  }>;
  recentReviews: Array<{
    id: string;
    rating: number;
    authorName: string;
    businessName: string;
  }>;
};

export function OverviewPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const session = readSession();
    apiRequest<Stats>('/api/admin/stats', { accessToken: session.accessToken })
      .then((body) => {
        if (!controller.signal.aborted) {
          setStats(body);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof ApiError ? caught.message : 'Unable to load the dashboard.');
      });
    return () => controller.abort();
  }, []);

  if (error) return <p className="form-error">{error}</p>;
  if (!stats) return <p>Loading the dashboard…</p>;

  const figures: Array<[string, number]> = [
    ['Users', stats.users.total],
    ['Customers', stats.users.customers],
    ['Owners', stats.users.owners],
    ['Suspended users', stats.users.suspended],
    ['Pending businesses', stats.businesses.pending],
    ['Approved businesses', stats.businesses.approved],
    ['Rejected businesses', stats.businesses.rejected],
    ['Suspended businesses', stats.businesses.suspended],
    ['Pending bookings', stats.bookings.pending],
    ['Confirmed bookings', stats.bookings.confirmed],
    ['Completed bookings', stats.bookings.completed],
    ['Reviews', stats.reviews],
    ['Open reports', stats.openReports],
    ['Categories', stats.categories],
  ];

  return (
    <section className="card businesses">
      <h2>Overview</h2>
      <div className="stats">
        {figures.map(([label, value]) => (
          <p className="stat" key={label}>
            <strong>{value}</strong>
            {label}
          </p>
        ))}
      </div>
      <h2>Recent bookings</h2>
      {stats.recentBookings.length === 0 ? <p>No bookings yet.</p> : null}
      {stats.recentBookings.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Business</th>
                <th>Service</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentBookings.map((booking) => (
                <tr key={booking.id}>
                  <td>{booking.customerName}</td>
                  <td>{booking.business.name}</td>
                  <td>{booking.serviceName}</td>
                  <td>{booking.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <h2>Recent reviews</h2>
      {stats.recentReviews.length === 0 ? <p>No reviews yet.</p> : null}
      {stats.recentReviews.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Author</th>
                <th>Business</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentReviews.map((review) => (
                <tr key={review.id}>
                  <td>{review.authorName}</td>
                  <td>{review.businessName}</td>
                  <td>{review.rating}/5</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
