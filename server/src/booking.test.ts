import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import {
  addCalendarDays,
  weekdayInWindhoek,
  windhoekDate,
  windhoekDateTime,
} from './services/availability.js';
import { createOwner, createWash, priceRows, registerCustomer, removeWashes } from './testWash.js';

const app = createApp();
const createdEmails: string[] = [];
const businessIds: string[] = [];

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

function bookingBody(
  packageId: string,
  startsAt: string,
  customer: { fullName: string; email: string; phone: string | null },
  vehicleSize = 'SEDAN',
) {
  return {
    packageId,
    vehicleSize,
    registration: 'N12345W',
    make: 'Toyota',
    color: 'Black',
    startsAt,
    customerName: customer.fullName,
    customerPhone: customer.phone ?? '0810000001',
    customerEmail: customer.email,
  };
}

afterAll(async () => {
  await removeWashes(businessIds);
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe('bookings', () => {
  it('offers slots from the vehicle size duration and confirms the booking', async () => {
    const owner = await createOwner(app, createdEmails);
    const { packageId } = await createWash(owner.user.id, businessIds, {
      prices: priceRows({
        HATCHBACK: { price: '80.00', durationMinutes: 30 },
        SEDAN: { price: '150.00', durationMinutes: 60 },
      }),
    });
    const openDate = nextOpenDate();
    const closedDate = nextWednesday();

    const sedan = await request(app).get('/api/wash/availability').query({
      packageId,
      vehicleSize: 'SEDAN',
      date: openDate,
    });
    const hatch = await request(app).get('/api/wash/availability').query({
      packageId,
      vehicleSize: 'HATCHBACK',
      date: openDate,
    });
    const closed = await request(app).get('/api/wash/availability').query({
      packageId,
      vehicleSize: 'SEDAN',
      date: closedDate,
    });

    expect(sedan.body.slots.map((slot: { startsAt: string }) => localTime(slot.startsAt))).toEqual([
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
    ]);
    expect(hatch.body.slots.map((slot: { startsAt: string }) => localTime(slot.startsAt))).toContain('09:30');
    expect(closed.body.slots).toEqual([]);

    const customer = await registerCustomer(app, createdEmails);
    const booked = await request(app)
      .post('/api/bookings')
      .set(auth(customer.accessToken))
      .send(bookingBody(packageId, sedan.body.slots[0].startsAt, customer.user));
    expect(booked.status).toBe(201);
    expect(booked.body.booking.status).toBe('CONFIRMED');
    expect(booked.body.booking.price).toBe('150.00');
    expect(booked.body.booking.durationMinutes).toBe(60);
    expect(booked.body.booking.registration).toBe('N12345W');

    const closedBooking = await request(app)
      .post('/api/bookings')
      .set(auth(customer.accessToken))
      .send(bookingBody(packageId, windhoekDateTime(closedDate, '09:00').toISOString(), customer.user));
    expect(closedBooking.status).toBe(409);
  });

  it('hides an inactive package and rejects a time outside opening hours', async () => {
    const owner = await createOwner(app, createdEmails);
    const customer = await registerCustomer(app, createdEmails);
    const { businessId, packageId } = await createWash(owner.user.id, businessIds, { closedDay: null });
    const inactive = await request(app)
      .post(`/api/businesses/${businessId}/services`)
      .set(auth(owner.accessToken))
      .send({
        name: 'Paused',
        description: 'Not bookable.',
        isActive: false,
        prices: priceRows(),
      });
    const openDate = nextOpenDate();
    const hidden = await request(app).get('/api/wash/availability').query({
      packageId: inactive.body.service.id,
      vehicleSize: 'SEDAN',
      date: openDate,
    });
    const outside = await request(app)
      .post('/api/bookings')
      .set(auth(customer.accessToken))
      .send(bookingBody(packageId, windhoekDateTime(openDate, '08:00').toISOString(), customer.user));
    expect(hidden.status).toBe(404);
    expect(outside.status).toBe(409);
  });

  it('fills every bay before a time is taken, then frees it when the wash is cancelled', async () => {
    const owner = await createOwner(app, createdEmails);
    const first = await registerCustomer(app, createdEmails, 'First Customer');
    const second = await registerCustomer(app, createdEmails, 'Second Customer');
    const third = await registerCustomer(app, createdEmails, 'Third Customer');
    const { packageId } = await createWash(owner.user.id, businessIds, { bayCount: 2 });
    const openDate = nextOpenDate();
    const startsAt = windhoekDateTime(openDate, '09:00').toISOString();

    const left = await request(app)
      .post('/api/bookings')
      .set(auth(first.accessToken))
      .send(bookingBody(packageId, startsAt, first.user));
    const right = await request(app)
      .post('/api/bookings')
      .set(auth(second.accessToken))
      .send(bookingBody(packageId, startsAt, second.user));
    const blocked = await request(app)
      .post('/api/bookings')
      .set(auth(third.accessToken))
      .send(bookingBody(packageId, startsAt, third.user));

    expect(left.status).toBe(201);
    expect(right.status).toBe(201);
    expect(blocked.status).toBe(409);

    const stranger = await request(app)
      .post(`/api/bookings/${left.body.booking.id}/cancel`)
      .set(auth(third.accessToken));
    const cancelled = await request(app)
      .post(`/api/bookings/${left.body.booking.id}/cancel`)
      .set(auth(first.accessToken));
    const opened = await request(app)
      .post('/api/bookings')
      .set(auth(third.accessToken))
      .send(bookingBody(packageId, startsAt, third.user));
    expect(stranger.status).toBe(403);
    expect(cancelled.body.booking.status).toBe('CANCELLED');
    expect(opened.status).toBe(201);
  });

  it('lets only one of two simultaneous requests take the last bay', async () => {
    const owner = await createOwner(app, createdEmails);
    const first = await registerCustomer(app, createdEmails, 'First Customer');
    const second = await registerCustomer(app, createdEmails, 'Second Customer');
    const { packageId } = await createWash(owner.user.id, businessIds, { bayCount: 1 });
    const startsAt = windhoekDateTime(nextOpenDate(), '14:00').toISOString();
    const [left, right] = await Promise.all([
      request(app).post('/api/bookings').set(auth(first.accessToken)).send(bookingBody(packageId, startsAt, first.user)),
      request(app)
        .post('/api/bookings')
        .set(auth(second.accessToken))
        .send(bookingBody(packageId, startsAt, second.user)),
    ]);
    expect([left.status, right.status].sort()).toEqual([201, 409]);
  });

  it('moves a wash through the queue and issues one invoice when it is ready', async () => {
    const owner = await createOwner(app, createdEmails);
    const other = await createOwner(app, createdEmails, 'Other Owner');
    const customer = await registerCustomer(app, createdEmails);
    const { businessId, packageId } = await createWash(owner.user.id, businessIds, { bayCount: 2 });
    const openDate = nextOpenDate();
    const created = await request(app)
      .post('/api/bookings')
      .set(auth(customer.accessToken))
      .send(bookingBody(packageId, windhoekDateTime(openDate, '11:00').toISOString(), customer.user));
    const skipped = await request(app)
      .post('/api/bookings')
      .set(auth(customer.accessToken))
      .send(bookingBody(packageId, windhoekDateTime(openDate, '12:00').toISOString(), customer.user));
    const id = created.body.booking.id as string;

    const stranger = await request(app).post(`/api/bookings/${id}/arrive`).set(auth(other.accessToken));
    const customerArrive = await request(app).post(`/api/bookings/${id}/arrive`).set(auth(customer.accessToken));
    const arrived = await request(app).post(`/api/bookings/${id}/arrive`).set(auth(owner.accessToken));
    const washing = await request(app).post(`/api/bookings/${id}/wash`).set(auth(owner.accessToken));
    const ready = await request(app).post(`/api/bookings/${id}/ready`).set(auth(owner.accessToken));
    const readyAgain = await request(app).post(`/api/bookings/${id}/ready`).set(auth(owner.accessToken));
    const invoice = await request(app).get(`/api/bookings/${id}/invoice`).set(auth(customer.accessToken));
    const customerPay = await request(app).post(`/api/bookings/${id}/invoice/pay`).set(auth(customer.accessToken));
    const paid = await request(app).post(`/api/bookings/${id}/invoice/pay`).set(auth(owner.accessToken));
    const completed = await request(app).post(`/api/bookings/${id}/complete`).set(auth(owner.accessToken));
    const noShow = await request(app)
      .post(`/api/bookings/${skipped.body.booking.id}/no-show`)
      .set(auth(owner.accessToken));
    const cancelDone = await request(app).post(`/api/bookings/${id}/cancel`).set(auth(customer.accessToken));
    const skippedInvoice = await request(app)
      .get(`/api/bookings/${skipped.body.booking.id}/invoice`)
      .set(auth(owner.accessToken));
    const invoices = await prisma.invoice.count({ where: { bookingId: id } });
    const readyNote = await prisma.notification.findFirst({
      where: { bookingId: id, type: 'CAR_READY' },
    });

    expect(stranger.status).toBe(403);
    expect(customerArrive.status).toBe(403);
    expect(arrived.body.booking.status).toBe('ARRIVED');
    expect(washing.body.booking.status).toBe('WASHING');
    expect(ready.body.booking.status).toBe('READY');
    expect(ready.body.booking.invoice.status).toBe('UNPAID');
    expect(ready.body.booking.invoice.number).toMatch(/^UG-\d{4}-\d{4}$/);
    expect(readyAgain.status).toBe(409);
    expect(invoices).toBe(1);
    expect(invoice.body.invoice.status).toBe('UNPAID');
    expect(invoice.body.invoice.total).toBe('150.00');
    expect(invoice.body.invoice.registration).toBe('N12345W');
    expect(customerPay.status).toBe(403);
    expect(paid.body.invoice.status).toBe('PAID');
    expect(completed.body.booking.status).toBe('COMPLETED');
    expect(noShow.body.booking.status).toBe('NO_SHOW');
    expect(cancelDone.status).toBe(409);
    expect(skippedInvoice.status).toBe(404);
    expect(readyNote?.userId).toBe(customer.user.id);

    const ownerList = await request(app)
      .get(`/api/businesses/${businessId}/bookings`)
      .query({ status: 'COMPLETED', date: openDate })
      .set(auth(owner.accessToken));
    expect(ownerList.body.bookings.map((booking: { id: string }) => booking.id)).toEqual([id]);
  });
});
