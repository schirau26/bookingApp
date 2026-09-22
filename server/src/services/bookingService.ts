import type { BookingStatus, Prisma } from '../generated/prisma/client.js';
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
import type { CreateBookingInput, MyBookingsQuery, OwnerBookingsQuery } from '../validators/booking.js';

const blockingStatuses: BookingStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'];

const bookingInclude = {
  business: { select: { id: true, name: true, ownerId: true } },
  service: { select: { id: true, name: true } },
  review: { select: { id: true } },
} satisfies Prisma.BookingInclude;

type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

function money(value: { toFixed(digits: number): string }) {
  return value.toFixed(2);
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
    price: money(booking.price),
    durationMinutes: booking.durationMinutes,
    status: booking.status,
    business: { id: booking.business.id, name: booking.business.name },
    service: { id: booking.service.id, name: booking.service.name },
    review: booking.review ? { id: booking.review.id } : null,
  };
}

async function blockingRanges(businessId: string, bounds: { start: Date; end: Date }, db: Prisma.TransactionClient | typeof prisma = prisma) {
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

async function slotsFor(businessId: string, serviceId: string, date: string, now: Date) {
  if (!isCalendarDate(date)) {
    throw new HttpError(422, 'Use a real calendar date');
  }

  const business = await prisma.business.findFirst({
    where: { id: businessId, approvalStatus: 'APPROVED' },
    include: { workingHours: true },
  });
  if (!business) throw new HttpError(404, 'Business not found');

  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId, isActive: true },
  });
  if (!service) throw new HttpError(404, 'Service not found');

  const hours = business.workingHours.find((day) => day.dayOfWeek === weekdayInWindhoek(date));
  const bounds = windhoekDayBounds(date);
  const blocking = await blockingRanges(businessId, bounds);
  return buildSlots({
    date,
    openTime: hours?.openTime ?? null,
    closeTime: hours?.closeTime ?? null,
    isClosed: hours?.isClosed ?? true,
    durationMinutes: service.durationMinutes,
    now,
    blocking,
  });
}

export async function listAvailability(businessId: string, serviceId: string, date: string, now = new Date()) {
  const slots = await slotsFor(businessId, serviceId, date, now);
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

  const booking = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM Business WHERE id = ${input.businessId} FOR UPDATE
    `;
    if (locked.length === 0) throw new HttpError(404, 'Business not found');

    const business = await tx.business.findFirst({
      where: { id: input.businessId, approvalStatus: 'APPROVED' },
      include: { workingHours: true },
    });
    if (!business) throw new HttpError(404, 'Business not found');

    const service = await tx.service.findFirst({
      where: { id: input.serviceId, businessId: input.businessId, isActive: true },
    });
    if (!service) throw new HttpError(404, 'Service not found');

    const date = windhoekDate(startsAt);
    if (!isCalendarDate(date)) throw new HttpError(409, 'This time is not available');

    const hours = business.workingHours.find((day) => day.dayOfWeek === weekdayInWindhoek(date));
    const bounds = windhoekDayBounds(date);
    const blocking = await blockingRanges(input.businessId, bounds, tx);
    const slots = buildSlots({
      date,
      openTime: hours?.openTime ?? null,
      closeTime: hours?.closeTime ?? null,
      isClosed: hours?.isClosed ?? true,
      durationMinutes: service.durationMinutes,
      now,
      blocking,
    });
    const slot = slots.find((item) => item.startsAt.getTime() === startsAt.getTime());
    if (!slot) throw new HttpError(409, 'This time is not available');

    return tx.booking.create({
      data: {
        customerId,
        businessId: input.businessId,
        serviceId: input.serviceId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        note: input.note ?? null,
        price: service.price,
        durationMinutes: service.durationMinutes,
        status: 'PENDING',
      },
      include: bookingInclude,
    });
  });

  return { booking: toBooking(booking) };
}

export async function listMyBookings(customerId: string, query: MyBookingsQuery) {
  const upcoming = query.when === 'upcoming';
  const bookings = await prisma.booking.findMany({
    where: {
      customerId,
      status: { in: upcoming ? ['PENDING', 'CONFIRMED'] : ['COMPLETED', 'CANCELLED', 'NO_SHOW'] },
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

async function changeStatus(bookingId: string, ownerId: string, from: BookingStatus[], to: BookingStatus) {
  const booking = await ownedBooking(bookingId, ownerId);
  if (!from.includes(booking.status)) {
    throw new HttpError(409, 'This booking cannot be updated');
  }
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: to },
    include: bookingInclude,
  });
  return { booking: toBooking(updated) };
}

export async function cancelBooking(bookingId: string, userId: string) {
  const booking = await visibleBooking(bookingId, userId);
  if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
    throw new HttpError(409, 'This booking cannot be cancelled');
  }
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'CANCELLED' },
    include: bookingInclude,
  });
  return { booking: toBooking(updated) };
}

export function confirmBooking(bookingId: string, ownerId: string) {
  return changeStatus(bookingId, ownerId, ['PENDING'], 'CONFIRMED');
}

export function completeBooking(bookingId: string, ownerId: string) {
  return changeStatus(bookingId, ownerId, ['CONFIRMED'], 'COMPLETED');
}

export function markNoShow(bookingId: string, ownerId: string) {
  return changeStatus(bookingId, ownerId, ['CONFIRMED'], 'NO_SHOW');
}

export async function listOwnerBookings(ownerId: string, businessId: string, query: OwnerBookingsQuery) {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { ownerId: true } });
  if (!business) throw new HttpError(404, 'Business not found');
  if (business.ownerId !== ownerId) throw new HttpError(403, 'You cannot manage this business');

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
