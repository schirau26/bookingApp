import type { NotificationType, Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';
import { BUSINESS_TIME_ZONE } from './availability.js';

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

type NotificationDb = Prisma.TransactionClient | typeof prisma;

const notificationInclude = {
  booking: { select: { id: true, businessId: true } },
  review: { select: { id: true, businessId: true } },
} satisfies Prisma.NotificationInclude;

type NotificationRecord = Prisma.NotificationGetPayload<{ include: typeof notificationInclude }>;

export async function createNotification(
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    bookingId?: string;
    reviewId?: string;
  },
  db: NotificationDb = prisma,
) {
  return db.notification.create({ data: input });
}

export function formatVisitTime(instant: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
}

function toNotification(notification: NotificationRecord) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
    booking: notification.booking,
    review: notification.review,
  };
}

async function ensureReminders(userId: string, now: Date) {
  const until = new Date(now.getTime() + REMINDER_WINDOW_MS);
  const bookings = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      startsAt: { gt: now, lte: until },
      OR: [{ customerId: userId }, { business: { ownerId: userId } }],
    },
    include: {
      business: { select: { name: true } },
      service: { select: { name: true } },
    },
  });

  for (const booking of bookings) {
    const existing = await prisma.notification.findFirst({
      where: { userId, bookingId: booking.id, type: 'BOOKING_REMINDER' },
      select: { id: true },
    });
    if (existing) continue;
    const forCustomer = booking.customerId === userId;
    await createNotification({
      userId,
      type: 'BOOKING_REMINDER',
      title: 'Upcoming booking',
      message: forCustomer
        ? `${booking.service.name} at ${booking.business.name} is on ${formatVisitTime(booking.startsAt)}.`
        : `${booking.customerName} is booked for ${booking.service.name} on ${formatVisitTime(booking.startsAt)}.`,
      bookingId: booking.id,
    });
  }
}

export async function listNotifications(userId: string, now = new Date()) {
  await ensureReminders(userId, now);
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      include: notificationInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return {
    notifications: notifications.map(toNotification),
    unreadCount,
  };
}

export async function setNotificationRead(userId: string, notificationId: string, isRead: boolean) {
  const existing = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { userId: true },
  });
  if (!existing || existing.userId !== userId) throw new HttpError(404, 'Notification not found');
  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead },
    include: notificationInclude,
  });
  return { notification: toNotification(updated) };
}
