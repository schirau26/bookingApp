import { useEffect, useState } from 'react';
import { ApiError, apiRequest, readSession } from './api';

type AdminReview = {
  id: string;
  rating: number;
  body: string;
  authorName: string;
  reportCount: number;
  business: { id: string; name: string };
  author: { fullName: string; email: string };
};

type ReviewList = {
  reviews: AdminReview[];
  page: number;
  limit: number;
  total: number;
};

type ReportStatus = 'OPEN' | 'DISMISSED' | 'RESOLVED';

type ReviewReport = {
  id: string;
  reason: string;
  status: ReportStatus;
  review: { id: string; body: string; rating: number; businessName: string };
  reporter: { fullName: string; email: string };
};

type ReportList = {
  reports: ReviewReport[];
  page: number;
  limit: number;
  total: number;
};

const reportStatuses: Array<ReportStatus | ''> = ['', 'OPEN', 'DISMISSED', 'RESOLVED'];

export function ReviewsPanel() {
  const [reviews, setReviews] = useState<ReviewList | null>(null);
  const [reports, setReports] = useState<ReportList | null>(null);
  const [status, setStatus] = useState<ReportStatus | ''>('OPEN');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<AdminReview | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const session = readSession();
    const reportParams = new URLSearchParams({ limit: '20' });
    if (status) reportParams.set('status', status);

    Promise.all([
      apiRequest<ReviewList>('/api/admin/reviews?limit=20', { accessToken: session.accessToken }),
      apiRequest<ReportList>(`/api/admin/review-reports?${reportParams.toString()}`, {
        accessToken: session.accessToken,
      }),
    ])
      .then(([reviewBody, reportBody]) => {
        if (controller.signal.aborted) return;
        setReviews(reviewBody);
        setReports(reportBody);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof ApiError ? caught.message : 'Unable to load reviews.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [revision, status]);

  async function removeReview() {
    if (!pendingDelete) return;
    const session = readSession();
    setError(null);
    try {
      await apiRequest(`/api/admin/reviews/${pendingDelete.id}`, {
        method: 'DELETE',
        accessToken: session.accessToken,
      });
      setPendingDelete(null);
      setLoading(true);
      setRevision((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to delete this review.');
    }
  }

  async function decide(reportId: string, action: 'dismiss' | 'resolve') {
    const session = readSession();
    setError(null);
    try {
      await apiRequest(`/api/admin/review-reports/${reportId}/${action}`, {
        method: 'POST',
        accessToken: session.accessToken,
      });
      setLoading(true);
      setRevision((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update this report.');
    }
  }

  return (
    <section className="card businesses">
      <h2>Reviews</h2>
      {loading ? <p>Loading reviews…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Business</th>
              <th>Review</th>
              <th>Reports</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reviews?.reviews.map((review) => (
              <tr key={review.id}>
                <td>{review.business.name}</td>
                <td>
                  {review.author.fullName} · {review.rating}/5
                  <br />
                  {review.body}
                </td>
                <td>{review.reportCount}</td>
                <td className="actions">
                  <button type="button" onClick={() => setPendingDelete(review)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {reviews && reviews.reviews.length === 0 ? <p>No reviews yet.</p> : null}
      {pendingDelete ? (
        <div className="confirm">
          <p>Delete the review from {pendingDelete.author.fullName}?</p>
          <button type="button" onClick={() => setPendingDelete(null)}>
            Keep it
          </button>
          <button type="button" onClick={() => void removeReview()}>
            Delete review
          </button>
        </div>
      ) : null}

      <h2>Reports</h2>
      <div className="toolbar">
        <select
          aria-label="Report status"
          value={status}
          onChange={(event) => {
            setLoading(true);
            setStatus(event.target.value as ReportStatus | '');
          }}
        >
          {reportStatuses.map((value) => (
            <option key={value || 'all'} value={value}>
              {value || 'All reports'}
            </option>
          ))}
        </select>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Review</th>
              <th>Reason</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reports?.reports.map((report) => (
              <tr key={report.id}>
                <td>
                  {report.review.businessName} · {report.review.rating}/5
                  <br />
                  {report.review.body}
                </td>
                <td>
                  {report.reporter.fullName}: {report.reason}
                </td>
                <td>{report.status}</td>
                <td className="actions">
                  {report.status === 'OPEN' ? (
                    <>
                      <button type="button" onClick={() => void decide(report.id, 'dismiss')}>
                        Dismiss
                      </button>
                      <button type="button" onClick={() => void decide(report.id, 'resolve')}>
                        Resolve
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {reports && reports.reports.length === 0 ? <p>No reports in this list.</p> : null}
    </section>
  );
}
