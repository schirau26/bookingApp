import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import {
  addCalendarDays,
  weekdayInWindhoek,
  windhoekDate,
  windhoekDateTime,
} from './services/availability.js';
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
  const value = `phase5-${randomUUID()}@example.com`;
  createdEmails.push(value);
  return value;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function localTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Windhoek',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

function nextOpenDate() {
  const today = windhoekDate(new Date());
  for (let offset = 2; offset <= 20; offset += 1) {
    const date = addCalendarDays(today, offset);
    if (weekdayInWindhoek(date) !== 'WEDNESDAY') return date;
  }
  throw new Error('No open test date');
}

function nextWednesday() {
  const today = windhoekDate(new Date());
  for (let offset = 2; offset <= 20; offset += 1) {
    const date = addCalendarDays(today, offset);
    if (weekdayInWindhoek(date) === 'WEDNESDAY') return date;
  }
  throw new Error('No Wednesday');
}

async function register(role: 'CUSTOMER' | 'BUSINESS_OWNER' = 'CUSTOMER', fullName = 'Phase Five') {
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
    user: { id: string; fullName: string; email: string; phone: string };
  };
}

async function createApprovedBusiness(ownerToken: string, closedDay: (typeof weekdays)[number] | null = 'WEDNESDAY') {
  const created = await request(app)
    .post('/api/businesses')
    .set(auth(ownerToken))
    .send({
      name: `Bookings ${randomUUID()}`,
      description: 'A business used to test reservations.',
      address: '1 Test Street, Windhoek',
      phone: '+264811234567',
      email: 'shop@example.com',
      categoryId,
    });
  expect(created.status).toBe(201);
  const businessId = created.body.business.id as string;
  businessIds.push(businessId);

  const hours = await request(app)
    .put(`/api/businesses/${businessId}/hours`)
    .set(auth(ownerToken))
    .send({
      hours: weekdays.map((dayOfWeek) =>
        dayOfWeek === closedDay
          ? { dayOfWeek, isClosed: true, openTime: null, closeTime: null }
          : { dayOfWeek, isClosed: false, openTime: '09:00', closeTime: '17:00' },
      ),
    });
  expect(hours.status).toBe(200);

  const service = await request(app)
    .post(`/api/businesses/${businessId}/services`)
    .set(auth(ownerToken))
    .send({
      name: 'Hour session',
      description: 'Sixty minutes.',
      price: '150.00',
      durationMinutes: 60,
    });
  expect(service.status).toBe(201);

  const approved = await request(app)
    .post(`/api/admin/businesses/${businessId}/approve`)
    .set(auth(adminToken));
  expect(approved.status).toBe(200);

  return { businessId, serviceId: service.body.service.id as string };
}

function bookingBody(
  businessId: string,
  serviceId: string,
  startsAt: string,
  customer: { fullName: string; email: string; phone: string | null },
) {
  return {
    businessId,
    serviceId,
    startsAt,
    customerName: customer.fullName,
    customerPhone: customer.phone ?? '+264811234567',
    customerEmail: customer.email,
    note: 'Please confirm.',
  };
}

beforeAll(async () => {
  const category = await prisma.category.create({
    data: {
      name: `Phase 5 ${randomUUID()}`,
      slug: `phase5-${randomUUID()}`,
      description: 'Temporary category for booking tests.',
    },
  });
  categoryId = category.id;

  const adminEmail = email();
  await prisma.user.create({
    data: {
      email: adminEmail,
      fullName: 'Phase 5 Admin',
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

describe('bookings', () => {
  it('offers duration-sized slots inside working hours and hides closed days', async () => {
    const owner = await register('BUSINESS_OWNER');
    const { businessId, serviceId } = await createApprovedBusiness(owner.accessToken);
    const openDate = nextOpenDate();
    const closedDate = nextWednesday();

    const open = await request(app).get(
      `/api/businesses/${businessId}/services/${serviceId}/availability?date=${openDate}`,
    );
    const closed = await request(app).get(
      `/api/businesses/${businessId}/services/${serviceId}/availability?date=${closedDate}`,
    );

    expect(open.status).toBe(200);
    expect(open.body.slots.map((slot: { startsAt: string }) => localTime(slot.startsAt))).toEqual([
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
    ]);
    expect(closed.status).toBe(200);
    expect(closed.body.slots).toEqual([]);
  });

  it('rejects unapproved businesses, inactive services, and times outside the schedule', async () => {
    const owner = await register('BUSINESS_OWNER');
    const customer = await register('CUSTOMER');
    const pending = await request(app)
      .post('/api/businesses')
      .set(auth(owner.accessToken))
      .send({
        name: `Pending ${randomUUID()}`,
        description: 'Not public yet.',
        address: '2 Test Street, Windhoek',
        phone: '+264811234567',
        email: 'pending@example.com',
        categoryId,
      });
    const pendingId = pending.body.business.id as string;
    businessIds.push(pendingId);
    const pendingService = await request(app)
      .post(`/api/businesses/${pendingId}/services`)
      .set(auth(owner.accessToken))
      .send({
        name: 'Hidden',
        description: 'Not bookable yet.',
        price: '80.00',
        durationMinutes: 30,
      });

    const { businessId, serviceId } = await createApprovedBusiness(owner.accessToken, null);
    const inactive = await request(app)
      .post(`/api/businesses/${businessId}/services`)
      .set(auth(owner.accessToken))
      .send({
        name: 'Paused',
        description: 'Not bookable.',
        price: '90.00',
        durationMinutes: 30,
        isActive: false,
      });
    const openDate = nextOpenDate();
    const outside = windhoekDateTime(openDate, '08:00').toISOString();

    const pendingAvailability = await request(app).get(
      `/api/businesses/${pendingId}/services/${pendingService.body.service.id}/availability?date=${openDate}`,
    );
    const inactiveAvailability = await request(app).get(
      `/api/businesses/${businessId}/services/${inactive.body.service.id}/availability?date=${openDate}`,
    );
    const outsideBooking = await request(app)
      .post('/api/bookings')
      .set(auth(customer.accessToken))
      .send(bookingBody(businessId, serviceId, outside, customer.user));

    expect(pendingAvailability.status).toBe(404);
    expect(inactiveAvailability.status).toBe(404);
    expect(outsideBooking.status).toBe(409);
  });

  it('blocks an overlapping pending booking and frees the time after cancellation', async () => {
    const owner = await register('BUSINESS_OWNER');
    const customer = await register('CUSTOMER');
    const other = await register('CUSTOMER');
    const { businessId, serviceId } = await createApprovedBusiness(owner.accessToken);
    const short = await request(app)
      .post(`/api/businesses/${businessId}/services`)
      .set(auth(owner.accessToken))
      .send({
        name: 'Half hour',
        description: 'Thirty minutes.',
        price: '75.00',
        durationMinutes: 30,
      });
    const openDate = nextOpenDate();
    const slots = await request(app).get(
      `/api/businesses/${businessId}/services/${serviceId}/availability?date=${openDate}`,
    );
    const nine = slots.body.slots[0] as { startsAt: string };

    const created = await request(app)
      .post('/api/bookings')
      .set(auth(customer.accessToken))
      .send(bookingBody(businessId, serviceId, nine.startsAt, customer.user));
    const shortSlots = await request(app).get(
      `/api/businesses/${businessId}/services/${short.body.service.id}/availability?date=${openDate}`,
    );
    const takenAgain = await request(app)
      .post('/api/bookings')
      .set(auth(other.accessToken))
      .send(bookingBody(businessId, serviceId, nine.startsAt, other.user));

    expect(created.status).toBe(201);
    expect(created.body.booking.status).toBe('PENDING');
    expect(created.body.booking.price).toBe('150.00');
    expect(created.body.booking.durationMinutes).toBe(60);
    expect(
      shortSlots.body.slots.map((slot: { startsAt: string }) => localTime(slot.startsAt)),
    ).not.toContain('09:00');
    expect(
      shortSlots.body.slots.map((slot: { startsAt: string }) => localTime(slot.startsAt)),
    ).not.toContain('09:30');
    expect(takenAgain.status).toBe(409);

    const otherCancel = await request(app)
      .post(`/api/bookings/${created.body.booking.id}/cancel`)
      .set(auth(other.accessToken));
    const cancelled = await request(app)
      .post(`/api/bookings/${created.body.booking.id}/cancel`)
      .set(auth(customer.accessToken));
    const freed = await request(app).get(
      `/api/businesses/${businessId}/services/${serviceId}/availability?date=${openDate}`,
    );
    const rebooked = await request(app)
      .post('/api/bookings')
      .set(auth(other.accessToken))
      .send(bookingBody(businessId, serviceId, nine.startsAt, other.user));

    expect(otherCancel.status).toBe(403);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.booking.status).toBe('CANCELLED');
    expect(freed.body.slots.map((slot: { startsAt: string }) => localTime(slot.startsAt))).toContain(
      '09:00',
    );
    expect(rebooked.status).toBe(201);

    const mine = await request(app)
      .get('/api/bookings/mine?when=upcoming')
      .set(auth(other.accessToken));
    const past = await request(app)
      .get('/api/bookings/mine?when=past')
      .set(auth(customer.accessToken));
    expect(mine.body.bookings.map((booking: { id: string }) => booking.id)).toContain(
      rebooked.body.booking.id,
    );
    expect(past.body.bookings.map((booking: { id: string }) => booking.id)).toContain(
      created.body.booking.id,
    );
  });

  it('lets only one of two simultaneous requests take the same time', async () => {
    const owner = await register('BUSINESS_OWNER');
    const first = await register('CUSTOMER', 'First Customer');
    const second = await register('CUSTOMER', 'Second Customer');
    const { businessId, serviceId } = await createApprovedBusiness(owner.accessToken);
    const openDate = nextOpenDate();
    const startsAt = windhoekDateTime(openDate, '14:00').toISOString();

    const [left, right] = await Promise.all([
      request(app)
        .post('/api/bookings')
        .set(auth(first.accessToken))
        .send(bookingBody(businessId, serviceId, startsAt, first.user)),
      request(app)
        .post('/api/bookings')
        .set(auth(second.accessToken))
        .send(bookingBody(businessId, serviceId, startsAt, second.user)),
    ]);

    const statuses = [left.status, right.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it('lets the owner confirm only their own business and follows the status lifecycle', async () => {
    const owner = await register('BUSINESS_OWNER');
    const otherOwner = await register('BUSINESS_OWNER');
    const customer = await register('CUSTOMER');
    const { businessId, serviceId } = await createApprovedBusiness(owner.accessToken);
    const openDate = nextOpenDate();
    const firstStart = windhoekDateTime(openDate, '11:00').toISOString();
    const secondStart = windhoekDateTime(openDate, '12:00').toISOString();

    const pending = await request(app)
      .post('/api/bookings')
      .set(auth(customer.accessToken))
      .send(bookingBody(businessId, serviceId, firstStart, customer.user));
    const second = await request(app)
      .post('/api/bookings')
      .set(auth(customer.accessToken))
      .send(bookingBody(businessId, serviceId, secondStart, customer.user));

    const stranger = await request(app)
      .post(`/api/bookings/${pending.body.booking.id}/confirm`)
      .set(auth(otherOwner.accessToken));
    const customerConfirm = await request(app)
      .post(`/api/bookings/${pending.body.booking.id}/confirm`)
      .set(auth(customer.accessToken));
    const confirmed = await request(app)
      .post(`/api/bookings/${pending.body.booking.id}/confirm`)
      .set(auth(owner.accessToken));
    const completed = await request(app)
      .post(`/api/bookings/${pending.body.booking.id}/complete`)
      .set(auth(owner.accessToken));
    const noShow = await request(app)
      .post(`/api/bookings/${second.body.booking.id}/confirm`)
      .set(auth(owner.accessToken));
    const marked = await request(app)
      .post(`/api/bookings/${second.body.booking.id}/no-show`)
      .set(auth(owner.accessToken));
    const cancelCompleted = await request(app)
      .post(`/api/bookings/${pending.body.booking.id}/cancel`)
      .set(auth(customer.accessToken));

    const ownerList = await request(app)
      .get(`/api/businesses/${businessId}/bookings`)
      .query({ status: 'COMPLETED', date: openDate })
      .set(auth(owner.accessToken));

    expect(stranger.status).toBe(403);
    expect(customerConfirm.status).toBe(403);
    expect(confirmed.body.booking.status).toBe('CONFIRMED');
    expect(completed.body.booking.status).toBe('COMPLETED');
    expect(noShow.status).toBe(200);
    expect(marked.body.booking.status).toBe('NO_SHOW');
    expect(cancelCompleted.status).toBe(409);
    expect(ownerList.body.bookings.map((booking: { id: string }) => booking.id)).toEqual([
      pending.body.booking.id,
    ]);
  });
});
