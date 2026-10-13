import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { addCalendarDays, windhoekDate, windhoekDateTime } from './services/availability.js';
import { createOwner, createWash, registerCustomer, removeWashes } from './testWash.js';

const app = createApp();
const createdEmails: string[] = [];
const businessIds: string[] = [];

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

afterAll(async () => {
  await removeWashes(businessIds);
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe('notifications', () => {
  it('notifies the other party, sends a ready message, and reminds once inside the next day', async () => {
    const owner = await createOwner(app, createdEmails, 'Notice Owner');
    const customer = await registerCustomer(app, createdEmails, 'Notice Customer');
    const stranger = await registerCustomer(app, createdEmails, 'Notice Stranger');
    const { packageId } = await createWash(owner.user.id, businessIds, { bayCount: 3, closedDay: null });
    const date = addCalendarDays(windhoekDate(new Date()), 3);

    async function book(time: string) {
      const response = await request(app)
        .post('/api/bookings')
        .set(auth(customer.accessToken))
        .send({
          packageId,
          vehicleSize: 'SEDAN',
          registration: 'N12345W',
          startsAt: windhoekDateTime(date, time).toISOString(),
          customerName: customer.user.fullName,
          customerPhone: '0810000001',
          customerEmail: customer.user.email,
        });
      expect(response.status).toBe(201);
      return response.body.booking.id as string;
    }

    const farId = await book('09:00');
    const confirmations = await prisma.notification.findMany({
      where: { bookingId: farId, type: 'BOOKING_CONFIRMATION' },
    });
    expect(confirmations).toHaveLength(1);
    expect(confirmations[0]?.userId).toBe(customer.user.id);

    const customerCancelledId = await book('10:00');
    const customerCancel = await request(app)
      .post(`/api/bookings/${customerCancelledId}/cancel`)
      .set(auth(customer.accessToken));
    expect(customerCancel.status).toBe(200);
    const customerCancels = await prisma.notification.findMany({
      where: { bookingId: customerCancelledId, type: 'BOOKING_CANCELLATION' },
    });
    expect(customerCancels[0]?.userId).toBe(owner.user.id);

    const ownerCancelledId = await book('11:00');
    await request(app).post(`/api/bookings/${ownerCancelledId}/cancel`).set(auth(owner.accessToken));
    const ownerCancels = await prisma.notification.findMany({
      where: { bookingId: ownerCancelledId, type: 'BOOKING_CANCELLATION' },
    });
    expect(ownerCancels[0]?.userId).toBe(customer.user.id);

    const reviewedId = await book('12:00');
    for (const step of ['arrive', 'wash', 'ready', 'complete'] as const) {
      const stepResponse = await request(app)
        .post(`/api/bookings/${reviewedId}/${step}`)
        .set(auth(owner.accessToken));
      expect(stepResponse.status).toBe(200);
    }
    const readyNotes = await prisma.notification.findMany({
      where: { bookingId: reviewedId, type: 'CAR_READY' },
    });
    expect(readyNotes).toHaveLength(1);
    expect(readyNotes[0]?.title).toBe('Your car is ready');

    const review = await request(app)
      .post('/api/reviews')
      .set(auth(customer.accessToken))
      .send({ bookingId: reviewedId, rating: 5, body: 'Clear and on time.' });
    const reviewId = review.body.review.id as string;
    const newReviews = await prisma.notification.findMany({ where: { reviewId, type: 'NEW_REVIEW' } });
    expect(newReviews[0]?.userId).toBe(owner.user.id);
    await request(app)
      .put(`/api/reviews/${reviewId}/reply`)
      .set(auth(owner.accessToken))
      .send({ body: 'Glad you came in.' });
    const replies = await prisma.notification.findMany({ where: { reviewId, type: 'REVIEW_REPLY' } });
    expect(replies[0]?.userId).toBe(customer.user.id);

    const nearId = await book('13:00');
    const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await prisma.booking.update({
      where: { id: nearId },
      data: { startsAt, endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000) },
    });

    const firstInbox = await request(app).get('/api/notifications').set(auth(customer.accessToken));
    const secondInbox = await request(app).get('/api/notifications').set(auth(customer.accessToken));
    const nearReminders = (
      firstInbox.body.notifications as Array<{ type: string; booking: { id: string } | null }>
    ).filter((item) => item.type === 'BOOKING_REMINDER' && item.booking?.id === nearId);
    const farReminders = (
      firstInbox.body.notifications as Array<{ type: string; booking: { id: string } | null }>
    ).filter((item) => item.type === 'BOOKING_REMINDER' && item.booking?.id === farId);
    const nearRemindersAgain = (
      secondInbox.body.notifications as Array<{ type: string; booking: { id: string } | null }>
    ).filter((item) => item.type === 'BOOKING_REMINDER' && item.booking?.id === nearId);
    expect(nearReminders).toHaveLength(1);
    expect(farReminders).toHaveLength(0);
    expect(nearRemindersAgain).toHaveLength(1);

    const sample = firstInbox.body.notifications[0] as { id: string };
    const denied = await request(app)
      .patch(`/api/notifications/${sample.id}`)
      .set(auth(stranger.accessToken))
      .send({ isRead: true });
    const markedRead = await request(app)
      .patch(`/api/notifications/${sample.id}`)
      .set(auth(customer.accessToken))
      .send({ isRead: true });
    expect(denied.status).toBe(404);
    expect(markedRead.body.notification.isRead).toBe(true);
  });
});
