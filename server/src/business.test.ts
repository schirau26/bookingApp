import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { deleteStoredImage } from './storage/files.js';
import { createOwner, createWash, priceRows, registerCustomer, removeWashes, weekdays } from './testWash.js';

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

function hours(closedDay: (typeof weekdays)[number] | null, invalidClosed = false) {
  return {
    hours: weekdays.map((dayOfWeek) => {
      if (dayOfWeek === closedDay) {
        return {
          dayOfWeek,
          isClosed: true,
          openTime: invalidClosed ? '09:00' : null,
          closeTime: invalidClosed ? '12:00' : null,
        };
      }
      return { dayOfWeek, isClosed: false, openTime: '09:00', closeTime: '17:00' };
    }),
  };
}

afterAll(async () => {
  await removeWashes(businessIds);
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await Promise.all(uploadedUrls.map((url) => deleteStoredImage(url)));
  await prisma.$disconnect();
});

describe('wash management', () => {
  it('shows the one wash and hides an inactive package', async () => {
    const owner = await createOwner(app, createdEmails);
    const customer = await registerCustomer(app, createdEmails);
    const { businessId } = await createWash(owner.user.id, businessIds);
    const hidden = await request(app)
      .post(`/api/businesses/${businessId}/services`)
      .set(auth(owner.accessToken))
      .send({
        name: 'Hidden trim',
        description: 'Not bookable.',
        isActive: false,
        prices: priceRows({ SEDAN: { price: '40.50', durationMinutes: 15 } }),
      });
    const wash = await request(app).get('/api/wash');
    const mine = await request(app).get(`/api/businesses/mine/${businessId}`).set(auth(owner.accessToken));
    const customerCreate = await request(app)
      .post('/api/businesses')
      .set(auth(customer.accessToken))
      .send({ name: `Customer shop ${randomUUID()}` });

    expect(hidden.status).toBe(201);
    expect(wash.body.wash.packages.map((item: { name: string }) => item.name)).toEqual(['Exterior Wash']);
    expect(wash.body.wash.packages[0].isActive).toBeUndefined();
    expect(wash.body.wash.packages[0].prices).toEqual(
      expect.arrayContaining([expect.objectContaining({ vehicleSize: 'SEDAN', price: '150.00' })]),
    );
    expect(mine.body.business.packages).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Hidden trim', isActive: false })]),
    );
    expect(customerCreate.status).toBe(404);
  });

  it('lets only the owner edit the wash', async () => {
    const owner = await createOwner(app, createdEmails);
    const other = await createOwner(app, createdEmails, 'Other');
    const { businessId } = await createWash(owner.user.id, businessIds);
    const otherEdit = await request(app)
      .patch(`/api/businesses/${businessId}`)
      .set(auth(other.accessToken))
      .send({ name: 'Taken over' });
    const renamed = await request(app)
      .patch(`/api/businesses/${businessId}`)
      .set(auth(owner.accessToken))
      .send({ bayCount: 4, phoneContactName: 'Joe' });
    expect(otherEdit.status).toBe(403);
    expect(renamed.body.business.bayCount).toBe(4);
  });

  it('rejects a closed day that still has opening hours', async () => {
    const owner = await createOwner(app, createdEmails);
    const { businessId } = await createWash(owner.user.id, businessIds);
    const invalid = await request(app)
      .put(`/api/businesses/${businessId}/hours`)
      .set(auth(owner.accessToken))
      .send(hours('SUNDAY', true));
    const valid = await request(app)
      .put(`/api/businesses/${businessId}/hours`)
      .set(auth(owner.accessToken))
      .send(hours('SUNDAY'));
    expect(invalid.status).toBe(422);
    expect(valid.body.business.workingHours).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dayOfWeek: 'SUNDAY', isClosed: true, openTime: null, closeTime: null }),
      ]),
    );
  });

  it('stores a logo on disk and rejects a file that is not an image', async () => {
    const owner = await createOwner(app, createdEmails);
    const { businessId } = await createWash(owner.user.id, businessIds);
    const logo = await request(app)
      .post(`/api/businesses/${businessId}/logo`)
      .set(auth(owner.accessToken))
      .attach('image', png, { filename: 'dot.png', contentType: 'image/png' });
    const gif = await request(app)
      .post(`/api/businesses/${businessId}/logo`)
      .set(auth(owner.accessToken))
      .attach('image', Buffer.from('GIF89a'), { filename: 'dot.gif', contentType: 'image/gif' });
    expect(logo.status).toBe(200);
    expect(logo.body.logoUrl).toMatch(/^\/uploads\/logos\//);
    uploadedUrls.push(logo.body.logoUrl as string);
    const file = await request(app).get(logo.body.logoUrl as string);
    expect(file.status).toBe(200);
    expect(gif.status).toBe(422);
  });
});
