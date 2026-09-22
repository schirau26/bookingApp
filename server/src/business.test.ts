import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { deleteStoredImage } from './storage/files.js';
import { hashPassword } from './utils/password.js';

const app = createApp();
const createdEmails: string[] = [];
const businessIds: string[] = [];
const uploadedUrls: string[] = [];
let categoryId = '';
let categorySlug = '';
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
  const value = `phase4-${randomUUID()}@example.com`;
  createdEmails.push(value);
  return value;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function register(role: 'CUSTOMER' | 'BUSINESS_OWNER' = 'CUSTOMER') {
  const response = await request(app).post('/api/auth/register').send({
    fullName: 'Phase Four',
    email: email(),
    password: 'Password1!',
    phone: '+264811234567',
    role,
  });
  expect(response.status).toBe(201);
  return response.body as { accessToken: string; user: { id: string } };
}

function businessBody(name: string, address = '1 Test Street, Windhoek') {
  return {
    name,
    description: 'A bookable service business used by the Phase 4 tests.',
    address,
    phone: '+264811234567',
    email: 'shop@example.com',
    categoryId,
  };
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

async function createOwnedBusiness(token: string, name: string, address?: string) {
  const response = await request(app)
    .post('/api/businesses')
    .set(auth(token))
    .send(businessBody(name, address));
  expect(response.status).toBe(201);
  businessIds.push(response.body.business.id as string);
  return response.body.business as { id: string; approvalStatus: string };
}

beforeAll(async () => {
  categorySlug = `phase4-${randomUUID()}`;
  const category = await prisma.category.create({
    data: {
      name: `Phase 4 ${categorySlug}`,
      slug: categorySlug,
      description: 'Temporary category for business tests.',
    },
  });
  categoryId = category.id;

  const adminEmail = email();
  await prisma.user.create({
    data: {
      email: adminEmail,
      fullName: 'Phase 4 Admin',
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
  await prisma.businessPhoto.deleteMany({ where: { businessId: { in: businessIds } } });
  await prisma.businessWorkingHour.deleteMany({ where: { businessId: { in: businessIds } } });
  await prisma.service.deleteMany({ where: { businessId: { in: businessIds } } });
  if (businessIds.length > 0) {
    await prisma.business.deleteMany({ where: { id: { in: businessIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  if (categoryId) {
    await prisma.category.delete({ where: { id: categoryId } });
  }
  await Promise.all(uploadedUrls.map((url) => deleteStoredImage(url)));
  await prisma.$disconnect();
});

describe('business management', () => {
  it('hides unapproved businesses and still lets the owner open a pending one', async () => {
    const owner = await register('BUSINESS_OWNER');
    const created = await createOwnedBusiness(owner.accessToken, `Pending ${randomUUID()}`);

    const hiddenList = await request(app).get('/api/businesses').query({ q: created.id });
    const hiddenDetail = await request(app).get(`/api/businesses/${created.id}`);
    const mine = await request(app)
      .get(`/api/businesses/mine/${created.id}`)
      .set(auth(owner.accessToken));

    expect(hiddenList.status).toBe(200);
    expect(hiddenList.body.businesses.map((business: { id: string }) => business.id)).not.toContain(
      created.id,
    );
    expect(hiddenDetail.status).toBe(404);
    expect(mine.status).toBe(200);
    expect(mine.body.business.approvalStatus).toBe('PENDING');

    const approved = await request(app)
      .post(`/api/admin/businesses/${created.id}/approve`)
      .set(auth(adminToken));
    const visible = await request(app).get(`/api/businesses/${created.id}`);
    expect(approved.status).toBe(200);
    expect(visible.status).toBe(200);

    const suspended = await request(app)
      .post(`/api/admin/businesses/${created.id}/suspend`)
      .set(auth(adminToken));
    const afterSuspend = await request(app).get(`/api/businesses/${created.id}`);
    expect(suspended.body.business.approvalStatus).toBe('SUSPENDED');
    expect(afterSuspend.status).toBe(404);

    const rejected = await request(app)
      .post(`/api/admin/businesses/${created.id}/reject`)
      .set(auth(adminToken))
      .send({ reason: 'Add a reachable phone number.' });
    const afterReject = await request(app)
      .get(`/api/businesses/mine/${created.id}`)
      .set(auth(owner.accessToken));
    expect(rejected.status).toBe(200);
    expect(afterReject.body.business.approvalStatus).toBe('REJECTED');
    expect(afterReject.body.business.rejectionReason).toBe('Add a reachable phone number.');
  });

  it('blocks customers, other owners, and owners acting as admins', async () => {
    const owner = await register('BUSINESS_OWNER');
    const other = await register('BUSINESS_OWNER');
    const customer = await register('CUSTOMER');
    const created = await createOwnedBusiness(owner.accessToken, `Owned ${randomUUID()}`);

    const customerCreate = await request(app)
      .post('/api/businesses')
      .set(auth(customer.accessToken))
      .send(businessBody(`Customer shop ${randomUUID()}`));
    const otherEdit = await request(app)
      .patch(`/api/businesses/${created.id}`)
      .set(auth(other.accessToken))
      .send({ name: 'Taken over' });
    const ownerApprove = await request(app)
      .post(`/api/admin/businesses/${created.id}/approve`)
      .set(auth(owner.accessToken));
    const missingReason = await request(app)
      .post(`/api/admin/businesses/${created.id}/reject`)
      .set(auth(adminToken))
      .send({ reason: '   ' });

    expect(customerCreate.status).toBe(403);
    expect(otherEdit.status).toBe(403);
    expect(ownerApprove.status).toBe(403);
    expect(missingReason.status).toBe(422);
  });

  it('omits inactive services from the public service list', async () => {
    const owner = await register('BUSINESS_OWNER');
    const created = await createOwnedBusiness(owner.accessToken, `Services ${randomUUID()}`);
    await request(app)
      .post(`/api/admin/businesses/${created.id}/approve`)
      .set(auth(adminToken));

    const active = await request(app)
      .post(`/api/businesses/${created.id}/services`)
      .set(auth(owner.accessToken))
      .send({
        name: 'Active cut',
        description: 'Available to customers.',
        price: '120.00',
        durationMinutes: 30,
      });
    const inactive = await request(app)
      .post(`/api/businesses/${created.id}/services`)
      .set(auth(owner.accessToken))
      .send({
        name: 'Hidden trim',
        description: 'Not bookable.',
        price: '40.50',
        durationMinutes: 15,
        isActive: false,
      });

    const publicServices = await request(app).get(`/api/businesses/${created.id}/services`);
    const ownerView = await request(app)
      .get(`/api/businesses/mine/${created.id}`)
      .set(auth(owner.accessToken));

    expect(active.status).toBe(201);
    expect(inactive.status).toBe(201);
    expect(publicServices.body.services.map((service: { name: string }) => service.name)).toEqual([
      'Active cut',
    ]);
    expect(publicServices.body.services[0].price).toBe('120.00');
    expect(publicServices.body.services[0].isActive).toBeUndefined();
    expect(ownerView.body.business.services).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Hidden trim', isActive: false })]),
    );
  });

  it('rejects a closed day that still has opening hours', async () => {
    const owner = await register('BUSINESS_OWNER');
    const created = await createOwnedBusiness(owner.accessToken, `Hours ${randomUUID()}`);

    const invalid = await request(app)
      .put(`/api/businesses/${created.id}/hours`)
      .set(auth(owner.accessToken))
      .send(hours('SUNDAY', true));
    const valid = await request(app)
      .put(`/api/businesses/${created.id}/hours`)
      .set(auth(owner.accessToken))
      .send(hours('SUNDAY'));

    expect(invalid.status).toBe(422);
    expect(valid.status).toBe(200);
    expect(valid.body.business.workingHours).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dayOfWeek: 'SUNDAY',
          isClosed: true,
          openTime: null,
          closeTime: null,
        }),
      ]),
    );
  });

  it('filters approved businesses by search, category, location, price, and open day', async () => {
    const owner = await register('BUSINESS_OWNER');
    const marker = randomUUID().slice(0, 8);
    const cheap = await createOwnedBusiness(
      owner.accessToken,
      `North Studio ${randomUUID()}`,
      `${marker} Lane, Windhoek`,
    );
    const expensive = await createOwnedBusiness(
      owner.accessToken,
      `South Workshop ${randomUUID()}`,
      'Other Road, Windhoek',
    );
    await request(app).post(`/api/admin/businesses/${cheap.id}/approve`).set(auth(adminToken));
    await request(app).post(`/api/admin/businesses/${expensive.id}/approve`).set(auth(adminToken));

    await request(app)
      .post(`/api/businesses/${cheap.id}/services`)
      .set(auth(owner.accessToken))
      .send({
        name: `Braid ${marker}`,
        description: 'A short braid appointment.',
        price: '80.00',
        durationMinutes: 45,
      });
    await request(app)
      .post(`/api/businesses/${expensive.id}/services`)
      .set(auth(owner.accessToken))
      .send({
        name: 'Panel repair',
        description: 'A longer workshop job.',
        price: '500.00',
        durationMinutes: 90,
      });
    await request(app)
      .put(`/api/businesses/${cheap.id}/hours`)
      .set(auth(owner.accessToken))
      .send(hours('SUNDAY'));
    await request(app)
      .put(`/api/businesses/${expensive.id}/hours`)
      .set(auth(owner.accessToken))
      .send(hours('WEDNESDAY'));

    const byService = await request(app).get('/api/businesses').query({ q: marker });
    const byCategory = await request(app).get('/api/businesses').query({ category: categorySlug });
    const byLocation = await request(app).get('/api/businesses').query({ location: marker });
    const byPrice = await request(app).get('/api/businesses').query({ maxPrice: 90, q: marker });
    const byDay = await request(app).get('/api/businesses').query({ openOn: 'WEDNESDAY', category: categorySlug });
    const byRating = await request(app).get('/api/businesses').query({ minRating: 4, category: categorySlug });

    const ids = (response: { body: { businesses: { id: string }[] } }) =>
      response.body.businesses.map((business) => business.id);

    expect(ids(byService)).toEqual([cheap.id]);
    expect(ids(byCategory)).toEqual(expect.arrayContaining([cheap.id, expensive.id]));
    expect(ids(byLocation)).toEqual([cheap.id]);
    expect(ids(byPrice)).toEqual([cheap.id]);
    expect(byPrice.body.businesses[0].startingPrice).toBe('80.00');
    expect(ids(byDay)).toEqual([cheap.id]);
    expect(ids(byRating)).toEqual([]);
  });

  it('stores a logo on disk and rejects a file that is not an image', async () => {
    const owner = await register('BUSINESS_OWNER');
    const created = await createOwnedBusiness(owner.accessToken, `Photos ${randomUUID()}`);

    const logo = await request(app)
      .post(`/api/businesses/${created.id}/logo`)
      .set(auth(owner.accessToken))
      .attach('image', png, { filename: 'dot.png', contentType: 'image/png' });
    const gif = await request(app)
      .post(`/api/businesses/${created.id}/logo`)
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
