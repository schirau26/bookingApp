import { Prisma, type UserStatus } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { AdminBookingQuery, AdminUserQuery, CategoryBody } from '../validators/admin.js';

function slugify(name: string) {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (!slug) throw new HttpError(422, 'Enter a category name that can become a slug');
  return slug;
}

function money(value: { toFixed(digits: number): string }) {
  return value.toFixed(2);
}

function countOf<T extends string>(rows: { key: T; count: number }[], key: T) {
  return rows.find((row) => row.key === key)?.count ?? 0;
}

export async function adminStats() {
  const [roles, suspended, businesses, bookings, reviews, openReports, categories, recentBookings, recentReviews] =
    await Promise.all([
      prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      prisma.user.count({ where: { status: 'SUSPENDED' } }),
      prisma.business.groupBy({ by: ['approvalStatus'], _count: { _all: true } }),
      prisma.booking.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.review.count(),
      prisma.reviewReport.count({ where: { status: 'OPEN' } }),
      prisma.category.count(),
      prisma.booking.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          business: { select: { id: true, name: true } },
          service: { select: { name: true } },
        },
      }),
      prisma.review.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: { select: { fullName: true } },
          business: { select: { name: true } },
        },
      }),
    ]);

  const roleRows = roles.map((row) => ({ key: row.role, count: row._count._all }));
  const businessRows = businesses.map((row) => ({ key: row.approvalStatus, count: row._count._all }));
  const bookingRows = bookings.map((row) => ({ key: row.status, count: row._count._all }));

  return {
    users: {
      total: roleRows.reduce((sum, row) => sum + row.count, 0),
      customers: countOf(roleRows, 'CUSTOMER'),
      owners: countOf(roleRows, 'BUSINESS_OWNER'),
      admins: countOf(roleRows, 'ADMIN'),
      suspended,
    },
    businesses: {
      pending: countOf(businessRows, 'PENDING'),
      approved: countOf(businessRows, 'APPROVED'),
      rejected: countOf(businessRows, 'REJECTED'),
      suspended: countOf(businessRows, 'SUSPENDED'),
    },
    bookings: {
      pending: countOf(bookingRows, 'PENDING'),
      confirmed: countOf(bookingRows, 'CONFIRMED'),
      completed: countOf(bookingRows, 'COMPLETED'),
      cancelled: countOf(bookingRows, 'CANCELLED'),
      noShow: countOf(bookingRows, 'NO_SHOW'),
    },
    reviews,
    openReports,
    categories,
    recentBookings: recentBookings.map((booking) => ({
      id: booking.id,
      startsAt: booking.startsAt.toISOString(),
      status: booking.status,
      customerName: booking.customerName,
      business: booking.business,
      serviceName: booking.service.name,
    })),
    recentReviews: recentReviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      authorName: review.user.fullName,
      businessName: review.business.name,
      createdAt: review.createdAt.toISOString(),
    })),
  };
}

export async function listAdminUsers(query: AdminUserQuery) {
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [{ fullName: { contains: query.q } }, { email: { contains: query.q } }],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);
  return {
    users: rows.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() })),
    page: query.page,
    limit: query.limit,
    total,
  };
}

async function setUserStatus(actorId: string, userId: string, status: UserStatus) {
  if (actorId === userId && status === 'SUSPENDED') {
    throw new HttpError(403, 'You cannot suspend your own account');
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
  if (!user) throw new HttpError(404, 'User not found');
  if (user.status === status) {
    throw new HttpError(409, status === 'SUSPENDED' ? 'This account is already suspended' : 'This account is already active');
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status },
    select: { id: true, fullName: true, email: true, role: true, status: true },
  });
  return { user: updated };
}

export function suspendUser(actorId: string, userId: string) {
  return setUserStatus(actorId, userId, 'SUSPENDED');
}

export function activateUser(actorId: string, userId: string) {
  return setUserStatus(actorId, userId, 'ACTIVE');
}

export async function listAdminBookings(query: AdminBookingQuery) {
  const where: Prisma.BookingWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { customerName: { contains: query.q } },
            { customerEmail: { contains: query.q } },
            { business: { name: { contains: query.q } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: {
        business: { select: { id: true, name: true } },
        service: { select: { name: true } },
      },
      orderBy: { startsAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);
  return {
    bookings: rows.map((booking) => ({
      id: booking.id,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      status: booking.status,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      price: money(booking.price),
      business: booking.business,
      serviceName: booking.service.name,
    })),
    page: query.page,
    limit: query.limit,
    total,
  };
}

function toCategory(category: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  _count: { businesses: number };
}) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    businessCount: category._count.businesses,
  };
}

export async function listAdminCategories() {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { businesses: true } } },
  });
  return { categories: categories.map(toCategory) };
}

export async function createCategory(input: CategoryBody) {
  try {
    const category = await prisma.category.create({
      data: {
        name: input.name,
        slug: slugify(input.name),
        description: input.description ?? null,
      },
      include: { _count: { select: { businesses: true } } },
    });
    return { category: toCategory(category) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'A category with this name already exists');
    }
    throw error;
  }
}

export async function updateCategory(categoryId: string, input: CategoryBody) {
  const existing = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!existing) throw new HttpError(404, 'Category not found');
  try {
    const category = await prisma.category.update({
      where: { id: categoryId },
      data: {
        name: input.name,
        slug: slugify(input.name),
        description: input.description ?? null,
      },
      include: { _count: { select: { businesses: true } } },
    });
    return { category: toCategory(category) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'A category with this name already exists');
    }
    throw error;
  }
}

export async function deleteCategory(categoryId: string) {
  const existing = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { businesses: true } } },
  });
  if (!existing) throw new HttpError(404, 'Category not found');
  if (existing._count.businesses > 0) {
    throw new HttpError(409, 'This category is still used by a business');
  }
  await prisma.category.delete({ where: { id: categoryId } });
}
