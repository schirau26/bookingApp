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
const categoryIds: string[] = [];
let adminToken = '';
let adminId = '';

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
  const value = `phase8-${randomUUID()}@example.com`;
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
  const adminEmail = email();
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      fullName: 'Phase 8 Admin',
      passwordHash: await hashPassword('Password1!'),
      role: 'ADMIN',
    },
  });
  adminId = admin.id;
  const login = await request(app).post('/api/auth/login').send({
    email: adminEmail,
    password: 'Password1!',
  });
  adminToken = login.body.accessToken as string;
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { businessId: { in: businessIds } } });
  await prisma.businessWorkingHour.deleteMany({ where: { businessId: { in: businessIds } } });
  await prisma.service.deleteMany({ where: { businessId: { in: businessIds } } });
  if (businessIds.length > 0) {
    await prisma.business.deleteMany({ where: { id: { in: businessIds } } });
  }
  if (categoryIds.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe('admin dashboard', () => {
  it('keeps admin lists behind the admin role and can suspend, list, and protect categories', async () => {
    const customer = await register('CUSTOMER', `Ada ${randomUUID()}`);
    const owner = await register('BUSINESS_OWNER', 'Admin Owner');
    const denied = await request(app).get('/api/admin/stats').set(auth(customer.accessToken));
    expect(denied.status).toBe(403);

    const selfSuspend = await request(app)
      .post(`/api/admin/users/${adminId}/suspend`)
      .set(auth(adminToken));
    expect(selfSuspend.status).toBe(403);

    const suspended = await request(app)
      .post(`/api/admin/users/${customer.user.id}/suspend`)
      .set(auth(adminToken));
    const again = await request(app)
      .post(`/api/admin/users/${customer.user.id}/suspend`)
      .set(auth(adminToken));
    const blockedLogin = await request(app).post('/api/auth/login').send({
      email: customer.user.email,
      password: 'Password1!',
    });
    expect(suspended.body.user.status).toBe('SUSPENDED');
    expect(again.status).toBe(409);
    expect(blockedLogin.status).toBe(403);

    const activated = await request(app)
      .post(`/api/admin/users/${customer.user.id}/activate`)
      .set(auth(adminToken));
    const restoredLogin = await request(app).post('/api/auth/login').send({
      email: customer.user.email,
      password: 'Password1!',
    });
    expect(activated.body.user.status).toBe('ACTIVE');
    expect(restoredLogin.status).toBe(200);

    const categoryName = `Phase Eight ${randomUUID()}`;
    const createdCategory = await request(app)
      .post('/api/admin/categories')
      .set(auth(adminToken))
      .send({ name: categoryName, description: 'Temporary category.' });
    expect(createdCategory.status).toBe(201);
    const categoryId = createdCategory.body.category.id as string;
    categoryIds.push(categoryId);
    expect(createdCategory.body.category.slug).toBe(
      categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    );

    const duplicate = await request(app)
      .post('/api/admin/categories')
      .set(auth(adminToken))
      .send({ name: categoryName });
    expect(duplicate.status).toBe(409);

    const renamed = await request(app)
      .patch(`/api/admin/categories/${categoryId}`)
      .set(auth(adminToken))
      .send({ name: `${categoryName} Renamed`, description: 'Updated.' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.category.slug.endsWith('-renamed')).toBe(true);

    const business = await request(app)
      .post('/api/businesses')
      .set(auth(owner.accessToken))
      .send({
        name: `Admin Desk ${randomUUID()}`,
        description: 'A business used to test the admin dashboard.',
        address: '8 Admin Street, Windhoek',
        phone: '+264811234567',
        email: 'admin-desk@example.com',
        categoryId,
      });
    const businessId = business.body.business.id as string;
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
        name: 'Admin session',
        description: 'Sixty minutes.',
        price: '90.00',
        durationMinutes: 60,
      });
    await request(app).post(`/api/admin/businesses/${businessId}/approve`).set(auth(adminToken));

    const blockedDelete = await request(app)
      .delete(`/api/admin/categories/${categoryId}`)
      .set(auth(adminToken));
    expect(blockedDelete.status).toBe(409);

    const date = addCalendarDays(windhoekDate(new Date()), 4);
    const booking = await request(app)
      .post('/api/bookings')
      .set(auth(customer.accessToken))
      .send({
        businessId,
        serviceId: service.body.service.id,
        startsAt: windhoekDateTime(date, '09:00').toISOString(),
        customerName: customer.user.fullName,
        customerPhone: '+264811234567',
        customerEmail: customer.user.email,
      });
    expect(booking.status).toBe(201);

    const listed = await request(app)
      .get(`/api/admin/bookings?status=PENDING&q=${encodeURIComponent(customer.user.fullName)}`)
      .set(auth(adminToken));
    expect(listed.status).toBe(200);
    expect(listed.body.bookings.some((item: { id: string }) => item.id === booking.body.booking.id)).toBe(true);

    const stats = await request(app).get('/api/admin/stats').set(auth(adminToken));
    expect(stats.status).toBe(200);
    expect(stats.body.users.customers).toBeGreaterThanOrEqual(1);
    expect(stats.body.businesses.approved).toBeGreaterThanOrEqual(1);
    expect(stats.body.bookings.pending).toBeGreaterThanOrEqual(1);
    expect(stats.body.categories).toBeGreaterThanOrEqual(1);
    expect(stats.body.recentBookings.length).toBeLessThanOrEqual(5);
    expect(stats.body.recentReviews.length).toBeLessThanOrEqual(5);
  });
});
