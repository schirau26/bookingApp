import type { BookingStatus, Prisma, VehicleSize } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';
import {
  buildSlots,
  isCalendarDate,
  weekdayInWindhoek,
  windhoekDate,
  windhoekDayBounds,
  type TimeRange,
} from './availability.js';
import { createNotification, formatVisitTime } from './notificationService.js';
import { requireWash } from './washService.js';
import type { CreateBookingInput, MyBookingsQuery, OwnerBookingsQuery } from '../validators/booking.js';

const blockingStatuses: BookingStatus[] = ['CONFIRMED', 'ARRIVED', 'WASHING'];
const upcomingStatuses: BookingStatus[] = ['CONFIRMED', 'ARRIVED', 'WASHING', 'READY'];
const pastStatuses: BookingStatus[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

const bookingInclude = {
  business: { select: { id: true, name: true, ownerId: true, bayCount: true } },
  service: { select: { id: true, name: true } },
  review: { select: { id: true } },
  invoice: { select: { id: true, number: true, status: true, total: true } },
} satisfies Prisma.BookingInclude;

type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;
type BookingDb = Prisma.TransactionClient | typeof prisma;

function money(value: { toFixed(digits: number): string }) {
  return value.toFixed(2);
}

function toInvoiceSummary(invoice: BookingWithRelations['invoice']) {
  if (!invoice) return null;
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    total: money(invoice.total),
  };
}

function toBooking(booking: BookingWithRelations) {
  return {
    id: booking.id,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    customerEmail: booking.customerEmail,
    note: booking.note,
    vehicleSize: booking.vehicleSize,
    registration: booking.registration,
    make: booking.make,
    color: booking.color,
    price: money(booking.price),
    durationMinutes: booking.durationMinutes,
    status: booking.status,
    business: { id: booking.business.id, name: booking.business.name },
    service: { id: booking.service.id, name: booking.service.name },
    review: booking.review ? { id: booking.review.id } : null,
    invoice: toInvoiceSummary(booking.invoice),
  };
}

function toInvoice(invoice: {
  id: string;
  number: string;
  issuedAt: Date;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  registration: string;
  vehicleSize: VehicleSize;
  packageName: string;
  subtotal: { toFixed(digits: number): string };
  tax: { toFixed(digits: number): string };
  total: { toFixed(digits: number): string };
  status: 'UNPAID' | 'PAID';
  booking: { id: string; startsAt: Date };
}) {
  return {
    id: invoice.id,
    number: invoice.number,
    issuedAt: invoice.issuedAt.toISOString(),
    customerName: invoice.customerName,
    customerPhone: invoice.customerPhone,
    customerEmail: invoice.customerEmail,
    registration: invoice.registration,
    vehicleSize: invoice.vehicleSize,
    packageName: invoice.packageName,
    line: `${invoice.packageName} · ${invoice.vehicleSize}`,
    subtotal: money(invoice.subtotal),
    tax: money(invoice.tax),
    total: money(invoice.total),
    status: invoice.status,
    bookingId: invoice.booking.id,
    startsAt: invoice.booking.startsAt.toISOString(),
  };
}

async function blockingRanges(businessId: string, bounds: { start: Date; end: Date }, db: BookingDb = prisma) {
  const rows = await db.booking.findMany({
    where: {
      businessId,
      status: { in: blockingStatuses },
      startsAt: { lt: bounds.end },
      endsAt: { gt: bounds.start },
    },
    select: { startsAt: true, endsAt: true },
  });
  return rows satisfies TimeRange[];
}

async function slotsFor(packageId: string, vehicleSize: VehicleSize, date: string, now: Date, db: BookingDb = prisma) {
  if (!isCalendarDate(date)) {
    throw new HttpError(422, 'Use a real calendar date');
  }

  const business = await requireWash(db);
  const service = await db.service.findFirst({
    where: { id: packageId, businessId: business.id, isActive: true },
    include: { prices: { where: { vehicleSize } } },
  });
  if (!service || service.prices.length === 0) throw new HttpError(404, 'Package not found');

  const hours = await db.businessWorkingHour.findMany({ where: { businessId: business.id } });
  const day = hours.find((item) => item.dayOfWeek === weekdayInWindhoek(date));
  const price = service.prices[0];
  const bounds = windhoekDayBounds(date);
  const blocking = await blockingRanges(business.id, bounds, db);
  return {
    business,
    service,
    price,
    slots: buildSlots({
      date,
      openTime: day?.openTime ?? null,
      closeTime: day?.closeTime ?? null,
      isClosed: day?.isClosed ?? true,
      durationMinutes: price.durationMinutes,
      now,
      blocking,
      bayCount: business.bayCount,
    }),
  };
}

export async function listAvailability(packageId: string, vehicleSize: VehicleSize, date: string, now = new Date()) {
  const { slots } = await slotsFor(packageId, vehicleSize, date, now);
  return {
    date,
    slots: slots.map((slot) => ({
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
    })),
  };
}

export async function createBooking(customerId: string, input: CreateBookingInput, now = new Date()) {
  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    throw new HttpError(422, 'Use a valid start time');
  }

  const wash = await requireWash();
  const booking = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM Business WHERE id = ${wash.id} FOR UPDATE
    `;
    if (locked.length === 0) throw new HttpError(404, 'Wash not found');

    const date = windhoekDate(startsAt);
    if (!isCalendarDate(date)) throw new HttpError(409, 'This time is not available');

    const { business, service, price, slots } = await slotsFor(input.packageId, input.vehicleSize, date, now, tx);
    const slot = slots.find((item) => item.startsAt.getTime() === startsAt.getTime());
    if (!slot) throw new HttpError(409, 'This time is not available');

    return tx.booking.create({
      data: {
        customerId,
        businessId: business.id,
        serviceId: service.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        note: input.note ?? null,
        vehicleSize: input.vehicleSize,
        registration: input.registration,
        make: input.make ?? null,
        color: input.color ?? null,
        price: price.price,
        durationMinutes: price.durationMinutes,
        status: 'CONFIRMED',
      },
      include: bookingInclude,
    });
  });

  await createNotification({
    userId: customerId,
    type: 'BOOKING_CONFIRMATION',
    title: 'Booking confirmed',
    message: `${booking.business.name} confirmed ${booking.service.name} for ${formatVisitTime(booking.startsAt)}.`,
    bookingId: booking.id,
  });

  return { booking: toBooking(booking) };
}

export async function listMyBookings(customerId: string, query: MyBookingsQuery) {
  const upcoming = query.when === 'upcoming';
  const bookings = await prisma.booking.findMany({
    where: {
      customerId,
      status: { in: upcoming ? upcomingStatuses : pastStatuses },
    },
    include: bookingInclude,
    orderBy: { startsAt: upcoming ? 'asc' : 'desc' },
  });
  return { bookings: bookings.map(toBooking) };
}

async function visibleBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingInclude,
  });
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (booking.customerId !== userId && booking.business.ownerId !== userId) {
    throw new HttpError(403, 'You cannot view this booking');
  }
  return booking;
}

export async function getBooking(bookingId: string, userId: string) {
  return { booking: toBooking(await visibleBooking(bookingId, userId)) };
}

async function ownedBooking(bookingId: string, ownerId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingInclude,
  });
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (booking.business.ownerId !== ownerId) {
    throw new HttpError(403, 'You cannot manage this booking');
  }
  return booking;
}

async function nextInvoiceNumber(db: BookingDb, issuedAt: Date) {
  const year = windhoekDate(issuedAt).slice(0, 4);
  const prefix = `UG-${year}-`;
  const latest = await db.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const sequence = latest ? Number(latest.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

async function issueInvoice(db: BookingDb, booking: BookingWithRelations) {
  const existing = await db.invoice.findUnique({ where: { bookingId: booking.id } });
  if (existing) return existing;
  const issuedAt = new Date();
  return db.invoice.create({
    data: {
      bookingId: booking.id,
      number: await nextInvoiceNumber(db, issuedAt),
      issuedAt,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      customerEmail: booking.customerEmail,
      registration: booking.registration,
      vehicleSize: booking.vehicleSize,
      packageName: booking.service.name,
      subtotal: booking.price,
      tax: '0.00',
      total: booking.price,
      status: 'UNPAID',
    },
  });
}

async function changeStatus(bookingId: string, ownerId: string, from: BookingStatus[], to: BookingStatus) {
  const booking = await ownedBooking(bookingId, ownerId);
  if (!from.includes(booking.status)) {
    throw new HttpError(409, 'This booking cannot be updated');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.booking.update({
      where: { id: bookingId },
      data: { status: to },
      include: bookingInclude,
    });
    if (to === 'READY') {
      await issueInvoice(tx, saved);
      await createNotification(
        {
          userId: saved.customerId,
          type: 'CAR_READY',
          title: 'Your car is ready',
          message: `${saved.registration} is ready for collection at ${saved.business.name}.`,
          bookingId: saved.id,
        },
        tx,
      );
    }
    return tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: bookingInclude });
  });

  return { booking: toBooking(updated) };
}

export async function cancelBooking(bookingId: string, userId: string) {
  const booking = await visibleBooking(bookingId, userId);
  if (booking.status !== 'CONFIRMED') {
    throw new HttpError(409, 'This booking cannot be cancelled');
  }
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'CANCELLED' },
    include: bookingInclude,
  });
  const when = formatVisitTime(updated.startsAt);
  const cancelledByCustomer = userId === updated.customerId;
  await createNotification({
    userId: cancelledByCustomer ? updated.business.ownerId : updated.customerId,
    type: 'BOOKING_CANCELLATION',
    title: 'Booking cancelled',
    message: cancelledByCustomer
      ? `${updated.customerName} cancelled ${updated.service.name} on ${when}.`
      : `${updated.business.name} cancelled ${updated.service.name} on ${when}.`,
    bookingId: updated.id,
  });
  return { booking: toBooking(updated) };
}

export function markArrived(bookingId: string, ownerId: string) {
  return changeStatus(bookingId, ownerId, ['CONFIRMED'], 'ARRIVED');
}

export function markWashing(bookingId: string, ownerId: string) {
  return changeStatus(bookingId, ownerId, ['ARRIVED'], 'WASHING');
}

export function markReady(bookingId: string, ownerId: string) {
  return changeStatus(bookingId, ownerId, ['WASHING'], 'READY');
}

export function completeBooking(bookingId: string, ownerId: string) {
  return changeStatus(bookingId, ownerId, ['READY'], 'COMPLETED');
}

export function markNoShow(bookingId: string, ownerId: string) {
  return changeStatus(bookingId, ownerId, ['CONFIRMED'], 'NO_SHOW');
}

const invoiceInclude = {
  booking: { select: { id: true, startsAt: true, customerId: true, business: { select: { ownerId: true } } } },
} satisfies Prisma.InvoiceInclude;

export async function getInvoice(bookingId: string, userId: string) {
  const booking = await visibleBooking(bookingId, userId);
  const invoice = await prisma.invoice.findUnique({
    where: { bookingId: booking.id },
    include: invoiceInclude,
  });
  if (!invoice) throw new HttpError(404, 'Invoice not found');
  return { invoice: toInvoice(invoice) };
}

export async function markInvoicePaid(bookingId: string, ownerId: string) {
  const booking = await ownedBooking(bookingId, ownerId);
  const invoice = await prisma.invoice.findUnique({ where: { bookingId: booking.id }, include: invoiceInclude });
  if (!invoice) throw new HttpError(404, 'Invoice not found');
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: 'PAID' },
    include: invoiceInclude,
  });
  return { invoice: toInvoice(updated) };
}

export async function listOwnerBookings(ownerId: string, businessId: string, query: OwnerBookingsQuery) {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { ownerId: true } });
  if (!business) throw new HttpError(404, 'Wash not found');
  if (business.ownerId !== ownerId) throw new HttpError(403, 'You cannot manage this wash');

  const bounds = query.date && isCalendarDate(query.date) ? windhoekDayBounds(query.date) : null;
  if (query.date && !bounds) throw new HttpError(422, 'Use a real calendar date');

  const bookings = await prisma.booking.findMany({
    where: {
      businessId,
      ...(query.status ? { status: query.status } : {}),
      ...(bounds ? { startsAt: { gte: bounds.start, lt: bounds.end } } : {}),
    },
    include: bookingInclude,
    orderBy: { startsAt: 'asc' },
    take: 200,
  });
  return { bookings: bookings.map(toBooking) };
}
