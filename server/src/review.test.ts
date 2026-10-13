import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { addCalendarDays, windhoekDate, windhoekDateTime } from './services/availability.js';
import { deleteStoredImage } from './storage/files.js';
import { createOwner, createWash, registerCustomer, removeWashes } from './testWash.js';

const app = createApp();
const createdEmails: string[] = [];
const businessIds: string[] = [];
const uploadedUrls: string[] = [];

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function finish(ownerToken: string, bookingId: string) {
  for (const step of ['arrive', 'wash', 'ready', 'complete'] as const) {
    const response = await request(app).post(`/api/bookings/${bookingId}/${step}`).set(auth(ownerToken));
    expect(response.status).toBe(200);
  }
}

afterAll(async () => {
  await removeWashes(businessIds);
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await Promise.all(uploadedUrls.map((url) => deleteStoredImage(url)));
  await prisma.$disconnect();
});

describe('reviews', () => {
  it('lets a customer review each completed wash', async () => {
    const owner = await createOwner(app, createdEmails, 'Review Owner');
    const customer = await registerCustomer(app, createdEmails, 'Review Customer');
    const other = await registerCustomer(app, createdEmails, 'Other Customer');
    const { packageId } = await createWash(owner.user.id, businessIds, { bayCount: 2 });
    const date = addCalendarDays(windhoekDate(new Date()), 3);

    async function book(token: string, time: string, person: typeof customer) {
      const booking = await request(app)
        .post('/api/bookings')
        .set(auth(token))
        .send({
          packageId,
          vehicleSize: 'SEDAN',
          registration: 'N99999W',
          startsAt: windhoekDateTime(date, time).toISOString(),
          customerName: person.user.fullName,
          customerPhone: '0810000001',
          customerEmail: person.user.email,
        });
      expect(booking.status).toBe(201);
      return booking.body.booking.id as string;
    }

    const firstBookingId = await book(customer.accessToken, '09:00', customer);
    const tooSoon = await request(app)
      .post('/api/reviews')
      .set(auth(customer.accessToken))
      .send({ bookingId: firstBookingId, rating: 5, body: 'Too early.' });
    expect(tooSoon.status).toBe(409);

    await finish(owner.accessToken, firstBookingId);
    const secondBookingId = await book(customer.accessToken, '11:00', customer);
    await finish(owner.accessToken, secondBookingId);

    const stranger = await request(app)
      .post('/api/reviews')
      .set(auth(other.accessToken))
      .send({ bookingId: firstBookingId, rating: 1, body: 'Not my visit.' });
    const first = await request(app)
      .post('/api/reviews')
      .set(auth(customer.accessToken))
      .send({ bookingId: firstBookingId, rating: 5, body: 'Excellent wash.' });
    const second = await request(app)
      .post('/api/reviews')
      .set(auth(customer.accessToken))
      .send({ bookingId: secondBookingId, rating: 4, body: 'Another wash.' });
    const sameBooking = await request(app)
      .post('/api/reviews')
      .set(auth(customer.accessToken))
      .send({ bookingId: firstBookingId, rating: 3, body: 'Again.' });

    expect(stranger.status).toBe(403);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(sameBooking.status).toBe(409);

    const photo = await request(app)
      .post(`/api/reviews/${first.body.review.id}/photos`)
      .set(auth(customer.accessToken))
      .attach('image', png, { filename: 'dot.png', contentType: 'image/png' });
    expect(photo.status).toBe(201);
    uploadedUrls.push(photo.body.photo.url as string);

    const reply = await request(app)
      .put(`/api/reviews/${first.body.review.id}/reply`)
      .set(auth(owner.accessToken))
      .send({ body: 'Thank you for visiting.' });
    const report = await request(app)
      .post(`/api/reviews/${first.body.review.id}/reports`)
      .set(auth(owner.accessToken))
      .send({ reason: 'Contains a private phone number.' });
    const listed = await request(app).get('/api/wash/reviews');
    expect(reply.body.review.replyBody).toBe('Thank you for visiting.');
    expect(report.status).toBe(201);
    expect(listed.body.reviews).toHaveLength(2);

    await request(app).delete(`/api/reviews/${second.body.review.id}`).set(auth(customer.accessToken));
    const wash = await request(app).get('/api/wash');
    expect(wash.body.wash.reviewCount).toBe(1);
    expect(wash.body.wash.averageRating).toBe('5.00');
  });
});
