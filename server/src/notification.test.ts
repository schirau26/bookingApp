import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { addCalendarDays, windhoekDate, windhoekDateTime } from './services/availability.js';
import { hashPassword } from './utils/password.js';

const app = createApp();
const createdEmails: string[] = [];
const businessIds: string[] = [];
let categoryId = '';
let adminToken = '';

const weekdays = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

function email() {
  const value = `phase7-${randomUUID()}@example.com`;
  createdEmails.push(value);
  return value;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function register(role: 'CUSTOMER' | 'BUSINESS_OWNER', fullName: string) {
  const response = await request(app).post('/api/auth/register').send({
    fullName,
    email: email(),
    password: 'Password1!',
    phone: '+264811234567',
    role,
  });
  expect(response.status).toBe(201);
  return response.body as {
    accessToken: string;
    user: { id: string; fullName: string; email: string };
  };
}

beforeAll(async () => {
  const category = await prisma.category.create({
    data: {
      name: `Phase 7 ${randomUUID()}`,
      slug: `phase7-${randomUUID()}`,
      description: 'Temporary category for notification tests.',
    },
  });
  categoryId = category.id;
  const adminEmail = email();
  await prisma.user.create({
    data: {
      email: adminEmail,
      fullName: 'Phase 7 Admin',
      passwordHash: await hashPassword('Password1!'),
      role: 'ADMIN',
    },
  });
  const login = await request(app).post('/api/auth/login').send({
    email: adminEmail,
    password: 'Password1!',
  });
  adminToken = login.body.accessToken as string;
});

afterAll(async () => {
  await prisma.review.deleteMany({ where: { businessId: { in: businessIds } } });
  await prisma.booking.deleteMany({ where: { businessId: { in: businessIds } } });
  await prisma.businessWorkingHour.deleteMany({ where: { businessId: { in: businessIds } } });
  await prisma.service.deleteMany({ where: { businessId: { in: businessIds } } });
  if (businessIds.length > 0) {
    await prisma.business.deleteMany({ where: { id: { in: businessIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
  await prisma.$disconnect();
});

describe('notifications', () => {
  it('notifies the other party and creates one reminder inside the next day', async () => {
    const owner = await register('BUSINESS_OWNER', 'Notice Owner');
    const customer = await register('CUSTOMER', 'Notice Customer');
    const stranger = await register('CUSTOMER', 'Notice Stranger');

    const created = await request(app)
      .post('/api/businesses')
      .set(auth(owner.accessToken))
      .send({
        name: `Notices ${randomUUID()}`,
        description: 'A business used to test notifications.',
        address: '7 Notice Street, Windhoek',
        phone: '+264811234567',
        email: 'notices@example.com',
        categoryId,
      });
    const businessId = created.body.business.id as string;
    businessIds.push(businessId);
    await request(app)
      .put(`/api/businesses/${businessId}/hours`)
      .set(auth(owner.accessToken))
      .send({
        hours: weekdays.map((dayOfWeek) => ({
          dayOfWeek,
          isClosed: false,
          openTime: '09:00',
          closeTime: '17:00',
        })),
      });
    const service = await request(app)
      .post(`/api/businesses/${businessId}/services`)
      .set(auth(owner.accessToken))
      .send({
        name: 'Notice session',
        description: 'Sixty minutes.',
        price: '80.00',
        durationMinutes: 60,
      });
    await request(app).post(`/api/admin/businesses/${businessId}/approve`).set(auth(adminToken));
    const serviceId = service.body.service.id as string;
    const date = addCalendarDays(windhoekDate(new Date()), 3);

    async function book(time: string) {
      const response = await request(app)
        .post('/api/bookings')
        .set(auth(customer.accessToken))
        .send({
          businessId,
          serviceId,
          startsAt: windhoekDateTime(date, time).toISOString(),
          customerName: customer.user.fullName,
          customerPhone: '+264811234567',
          customerEmail: customer.user.email,
        });
      expect(response.status).toBe(201);
      return response.body.booking.id as string;
    }

    const farId = await book('09:00');
    const confirmed = await request(app)
      .post(`/api/bookings/${farId}/confirm`)
      .set(auth(owner.accessToken));
    expect(confirmed.status).toBe(200);
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
    expect(customerCancels).toHaveLength(1);
    expect(customerCancels[0]?.userId).toBe(owner.user.id);

    const ownerCancelledId = await book('11:00');
    const ownerCancel = await request(app)
      .post(`/api/bookings/${ownerCancelledId}/cancel`)
      .set(auth(owner.accessToken));
    expect(ownerCancel.status).toBe(200);
    const ownerCancels = await prisma.notification.findMany({
      where: { bookingId: ownerCancelledId, type: 'BOOKING_CANCELLATION' },
    });
    expect(ownerCancels).toHaveLength(1);
    expect(ownerCancels[0]?.userId).toBe(customer.user.id);

    const reviewedId = await book('12:00');
    await request(app).post(`/api/bookings/${reviewedId}/confirm`).set(auth(owner.accessToken));
    await request(app).post(`/api/bookings/${reviewedId}/complete`).set(auth(owner.accessToken));
    const review = await request(app)
      .post('/api/reviews')
      .set(auth(customer.accessToken))
      .send({ bookingId: reviewedId, rating: 5, body: 'Clear and on time.' });
    expect(review.status).toBe(201);
    const reviewId = review.body.review.id as string;
    await request(app)
      .patch(`/api/reviews/${reviewId}`)
      .set(auth(customer.accessToken))
      .send({ body: 'Clear, on time, and friendly.' });
    const newReviews = await prisma.notification.findMany({
      where: { reviewId, type: 'NEW_REVIEW' },
    });
    expect(newReviews).toHaveLength(1);
    expect(newReviews[0]?.userId).toBe(owner.user.id);

    const reply = await request(app)
      .put(`/api/reviews/${reviewId}/reply`)
      .set(auth(owner.accessToken))
      .send({ body: 'Glad you came in.' });
    expect(reply.status).toBe(200);
    const replies = await prisma.notification.findMany({
      where: { reviewId, type: 'REVIEW_REPLY' },
    });
    expect(replies).toHaveLength(1);
    expect(replies[0]?.userId).toBe(customer.user.id);

    const nearId = await book('13:00');
    await request(app).post(`/api/bookings/${nearId}/confirm`).set(auth(owner.accessToken));
    const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await prisma.booking.update({
      where: { id: nearId },
      data: { startsAt, endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000) },
    });

    const firstInbox = await request(app).get('/api/notifications').set(auth(customer.accessToken));
    const secondInbox = await request(app).get('/api/notifications').set(auth(customer.accessToken));
    expect(firstInbox.status).toBe(200);
    const nearReminders = (firstInbox.body.notifications as Array<{ type: string; booking: { id: string } | null }>).filter(
      (item) => item.type === 'BOOKING_REMINDER' && item.booking?.id === nearId,
    );
    const farReminders = (firstInbox.body.notifications as Array<{ type: string; booking: { id: string } | null }>).filter(
      (item) => item.type === 'BOOKING_REMINDER' && item.booking?.id === farId,
    );
    const nearRemindersAgain = (secondInbox.body.notifications as Array<{ type: string; booking: { id: string } | null }>).filter(
      (item) => item.type === 'BOOKING_REMINDER' && item.booking?.id === nearId,
    );
    expect(nearReminders).toHaveLength(1);
    expect(farReminders).toHaveLength(0);
    expect(nearRemindersAgain).toHaveLength(1);

    const ownerInbox = await request(app).get('/api/notifications').set(auth(owner.accessToken));
    const ownerReminders = (ownerInbox.body.notifications as Array<{ type: string; booking: { id: string } | null }>).filter(
      (item) => item.type === 'BOOKING_REMINDER' && item.booking?.id === nearId,
    );
    expect(ownerReminders).toHaveLength(1);
    expect(ownerInbox.body.notifications.some((item: { type: string }) => item.type === 'BOOKING_CONFIRMATION')).toBe(false);

    const sample = firstInbox.body.notifications[0] as { id: string; isRead: boolean };
    const denied = await request(app)
      .patch(`/api/notifications/${sample.id}`)
      .set(auth(stranger.accessToken))
      .send({ isRead: true });
    const markedRead = await request(app)
      .patch(`/api/notifications/${sample.id}`)
      .set(auth(customer.accessToken))
      .send({ isRead: true });
    const markedUnread = await request(app)
      .patch(`/api/notifications/${sample.id}`)
      .set(auth(customer.accessToken))
      .send({ isRead: false });
    expect(denied.status).toBe(404);
    expect(markedRead.body.notification.isRead).toBe(true);
    expect(markedUnread.body.notification.isRead).toBe(false);
    expect(firstInbox.body.unreadCount).toBeGreaterThan(0);
  });
});
