import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { addCalendarDays, windhoekDate, windhoekDateTime } from './services/availability.js';
import { deleteStoredImage } from './storage/files.js';
import { hashPassword } from './utils/password.js';

const app = createApp();
const createdEmails: string[] = [];
const businessIds: string[] = [];
const uploadedUrls: string[] = [];
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

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function email() {
  const value = `phase6-${randomUUID()}@example.com`;
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
    user: { id: string; fullName: string; email: string; phone: string | null };
  };
}

beforeAll(async () => {
  const category = await prisma.category.create({
    data: {
      name: `Phase 6 ${randomUUID()}`,
      slug: `phase6-${randomUUID()}`,
      description: 'Temporary category for review tests.',
    },
  });
  categoryId = category.id;
  const adminEmail = email();
  await prisma.user.create({
    data: {
      email: adminEmail,
      fullName: 'Phase 6 Admin',
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
  await Promise.all(uploadedUrls.map((url) => deleteStoredImage(url)));
  await prisma.$disconnect();
});

describe('reviews', () => {
  it('allows one review after a completed booking and keeps the cached rating in step', async () => {
    const owner = await register('BUSINESS_OWNER', 'Review Owner');
    const customer = await register('CUSTOMER', 'Review Customer');
    const other = await register('CUSTOMER', 'Other Customer');

    const created = await request(app)
      .post('/api/businesses')
      .set(auth(owner.accessToken))
      .send({
        name: `Reviews ${randomUUID()}`,
        description: 'A business used to test reviews.',
        address: '3 Review Street, Windhoek',
        phone: '+264811234567',
        email: 'reviews@example.com',
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
        name: 'Review session',
        description: 'Sixty minutes.',
        price: '120.00',
        durationMinutes: 60,
      });
    await request(app).post(`/api/admin/businesses/${businessId}/approve`).set(auth(adminToken));

    const date = addCalendarDays(windhoekDate(new Date()), 3);
    const serviceId = service.body.service.id as string;
    async function bookAndComplete(token: string, time: string, person: typeof customer) {
      const booking = await request(app)
        .post('/api/bookings')
        .set(auth(token))
        .send({
          businessId,
          serviceId,
          startsAt: windhoekDateTime(date, time).toISOString(),
          customerName: person.user.fullName,
          customerPhone: '+264811234567',
          customerEmail: person.user.email,
        });
      expect(booking.status).toBe(201);
      const confirmed = await request(app)
        .post(`/api/bookings/${booking.body.booking.id}/confirm`)
        .set(auth(owner.accessToken));
      const completed = await request(app)
        .post(`/api/bookings/${booking.body.booking.id}/complete`)
        .set(auth(owner.accessToken));
      expect(confirmed.status).toBe(200);
      expect(completed.status).toBe(200);
      return booking.body.booking.id as string;
    }

    const early = await request(app)
      .post('/api/bookings')
      .set(auth(customer.accessToken))
      .send({
        businessId,
        serviceId,
        startsAt: windhoekDateTime(date, '09:00').toISOString(),
        customerName: customer.user.fullName,
        customerPhone: '+264811234567',
        customerEmail: customer.user.email,
      });
    const tooSoon = await request(app)
      .post('/api/reviews')
      .set(auth(customer.accessToken))
      .send({ bookingId: early.body.booking.id, rating: 5, body: 'Too early.' });
    expect(tooSoon.status).toBe(409);

    await request(app)
      .post(`/api/bookings/${early.body.booking.id}/confirm`)
      .set(auth(owner.accessToken));
    await request(app)
      .post(`/api/bookings/${early.body.booking.id}/complete`)
      .set(auth(owner.accessToken));
    const firstBookingId = early.body.booking.id as string;
    const secondBookingId = await bookAndComplete(customer.accessToken, '10:00', customer);

    const stranger = await request(app)
      .post('/api/reviews')
      .set(auth(other.accessToken))
      .send({ bookingId: firstBookingId, rating: 1, body: 'Not my visit.' });
    const review = await request(app)
      .post('/api/reviews')
      .set(auth(customer.accessToken))
      .send({ bookingId: firstBookingId, rating: 5, body: 'Excellent visit.' });
    const duplicate = await request(app)
      .post('/api/reviews')
      .set(auth(customer.accessToken))
      .send({ bookingId: secondBookingId, rating: 4, body: 'Another visit.' });

    expect(stranger.status).toBe(403);
    expect(review.status).toBe(201);
    expect(duplicate.status).toBe(409);

    const photo = await request(app)
      .post(`/api/reviews/${review.body.review.id}/photos`)
      .set(auth(customer.accessToken))
      .attach('image', png, { filename: 'dot.png', contentType: 'image/png' });
    expect(photo.status).toBe(201);
    uploadedUrls.push(photo.body.photo.url as string);

    const edited = await request(app)
      .patch(`/api/reviews/${review.body.review.id}`)
      .set(auth(customer.accessToken))
      .send({ rating: 3 });
    const afterEdit = await request(app).get(`/api/businesses/${businessId}`);
    expect(edited.body.review.rating).toBe(3);
    expect(afterEdit.body.business.averageRating).toBe('3.00');
    expect(afterEdit.body.business.reviewCount).toBe(1);

    const reply = await request(app)
      .put(`/api/reviews/${review.body.review.id}/reply`)
      .set(auth(owner.accessToken))
      .send({ body: 'Thank you for visiting.' });
    const firstReport = await request(app)
      .post(`/api/reviews/${review.body.review.id}/reports`)
      .set(auth(owner.accessToken))
      .send({ reason: 'Contains a private phone number.' });
    const secondReport = await request(app)
      .post(`/api/reviews/${review.body.review.id}/reports`)
      .set(auth(owner.accessToken))
      .send({ reason: 'Reporting again.' });
    const stillThere = await request(app).get(`/api/businesses/${businessId}/reviews`);

    expect(reply.body.review.replyBody).toBe('Thank you for visiting.');
    expect(firstReport.status).toBe(201);
    expect(secondReport.status).toBe(409);
    expect(stillThere.body.reviews).toHaveLength(1);
    expect(stillThere.body.reviews[0].photos).toHaveLength(1);

    const dismissed = await request(app)
      .post(`/api/admin/review-reports/${firstReport.body.report.id}/dismiss`)
      .set(auth(adminToken));
    const removed = await request(app)
      .delete(`/api/admin/reviews/${review.body.review.id}`)
      .set(auth(adminToken));
    const afterDelete = await request(app).get(`/api/businesses/${businessId}`);

    expect(dismissed.body.report.status).toBe('DISMISSED');
    expect(removed.status).toBe(204);
    expect(afterDelete.body.business.averageRating).toBe('0.00');
    expect(afterDelete.body.business.reviewCount).toBe(0);
  });
});
