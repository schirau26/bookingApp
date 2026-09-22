import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';
import { deleteStoredImage, saveImage } from '../storage/files.js';
import type {
  AdminReviewQuery,
  CreateReviewInput,
  ReportQuery,
  UpdateReviewInput,
} from '../validators/review.js';
import { createNotification } from './notificationService.js';

const MAX_PHOTOS = 4;

const reviewInclude = {
  user: { select: { id: true, fullName: true, email: true } },
  photos: { orderBy: { createdAt: 'asc' as const } },
  business: { select: { id: true, name: true, ownerId: true, approvalStatus: true } },
} satisfies Prisma.ReviewInclude;

type ReviewRecord = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

function toReview(review: ReviewRecord, extras?: { reportedByMe?: boolean }) {
  return {
    id: review.id,
    rating: review.rating,
    body: review.body,
    replyBody: review.replyBody,
    repliedAt: review.repliedAt?.toISOString() ?? null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    authorName: review.user.fullName,
    photos: review.photos.map((photo) => ({ id: photo.id, url: photo.url })),
    ...(extras?.reportedByMe === undefined ? {} : { reportedByMe: extras.reportedByMe }),
  };
}

async function refreshBusinessRating(businessId: string, db: Prisma.TransactionClient | typeof prisma) {
  const aggregate = await db.review.aggregate({
    where: { businessId },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const count = aggregate._count._all;
  const average = count === 0 || aggregate._avg.rating == null ? '0.00' : aggregate._avg.rating.toFixed(2);
  await db.business.update({
    where: { id: businessId },
    data: { reviewCount: count, averageRating: average },
  });
}

async function loadReview(reviewId: string) {
  const review = await prisma.review.findUnique({ where: { id: reviewId }, include: reviewInclude });
  if (!review) throw new HttpError(404, 'Review not found');
  return review;
}

export async function listBusinessReviews(businessId: string, viewerId?: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, approvalStatus: true },
  });
  if (!business) throw new HttpError(404, 'Business not found');
  const isOwner = viewerId === business.ownerId;
  if (business.approvalStatus !== 'APPROVED' && !isOwner) {
    throw new HttpError(404, 'Business not found');
  }

  const reviews = await prisma.review.findMany({
    where: { businessId },
    include: reviewInclude,
    orderBy: { createdAt: 'desc' },
  });
  const reported = isOwner
    ? new Set(
        (
          await prisma.reviewReport.findMany({
            where: { reporterId: viewerId, reviewId: { in: reviews.map((review) => review.id) } },
            select: { reviewId: true },
          })
        ).map((report) => report.reviewId),
      )
    : null;

  return {
    reviews: reviews.map((review) =>
      toReview(review, reported ? { reportedByMe: reported.has(review.id) } : undefined),
    ),
  };
}

export async function createReview(userId: string, input: CreateReviewInput) {
  const booking = await prisma.booking.findUnique({ where: { id: input.bookingId } });
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (booking.customerId !== userId) throw new HttpError(403, 'You cannot review this booking');
  if (booking.status !== 'COMPLETED') {
    throw new HttpError(409, 'You can review this business after the booking is completed');
  }

  const existing = await prisma.review.findUnique({
    where: { userId_businessId: { userId, businessId: booking.businessId } },
    select: { id: true },
  });
  if (existing) throw new HttpError(409, 'You have already reviewed this business');

  try {
    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          userId,
          businessId: booking.businessId,
          bookingId: booking.id,
          rating: input.rating,
          body: input.body,
        },
        include: reviewInclude,
      });
      await refreshBusinessRating(booking.businessId, tx);
      await createNotification(
        {
          userId: created.business.ownerId,
          type: 'NEW_REVIEW',
          title: 'New review',
          message: `${created.user.fullName} left a ${created.rating}/5 review for ${created.business.name}.`,
          reviewId: created.id,
        },
        tx,
      );
      return created;
    });
    return { review: toReview(review) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'You have already reviewed this business');
    }
    throw error;
  }
}

export async function updateReview(userId: string, reviewId: string, input: UpdateReviewInput) {
  const review = await loadReview(reviewId);
  if (review.userId !== userId) throw new HttpError(403, 'You cannot edit this review');

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.review.update({
      where: { id: reviewId },
      data: input,
      include: reviewInclude,
    });
    await refreshBusinessRating(review.businessId, tx);
    return saved;
  });
  return { review: toReview(updated) };
}

export async function deleteReview(userId: string, reviewId: string) {
  const review = await loadReview(reviewId);
  if (review.userId !== userId) throw new HttpError(403, 'You cannot delete this review');
  await removeReviewRecord(review);
}

async function removeReviewRecord(review: ReviewRecord) {
  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id: review.id } });
    await refreshBusinessRating(review.businessId, tx);
  });
  await Promise.all(review.photos.map((photo) => deleteStoredImage(photo.url)));
}

export async function addReviewPhoto(
  userId: string,
  reviewId: string,
  file: { buffer: Buffer; mimetype: string },
) {
  const review = await loadReview(reviewId);
  if (review.userId !== userId) throw new HttpError(403, 'You cannot edit this review');
  if (review.photos.length >= MAX_PHOTOS) {
    throw new HttpError(422, 'A review can have at most 4 photos');
  }
  const saved = await saveImage(file.buffer, file.mimetype, 'reviews');
  const photo = await prisma.reviewPhoto.create({
    data: { reviewId, url: saved.url },
  });
  return { photo: { id: photo.id, url: photo.url } };
}

export async function removeReviewPhoto(userId: string, reviewId: string, photoId: string) {
  const review = await loadReview(reviewId);
  if (review.userId !== userId) throw new HttpError(403, 'You cannot edit this review');
  const photo = review.photos.find((item) => item.id === photoId);
  if (!photo) throw new HttpError(404, 'Photo not found');
  await prisma.reviewPhoto.delete({ where: { id: photoId } });
  await deleteStoredImage(photo.url);
}

export async function replyToReview(ownerId: string, reviewId: string, body: string) {
  const review = await loadReview(reviewId);
  if (review.business.ownerId !== ownerId) throw new HttpError(403, 'You cannot reply to this review');
  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: { replyBody: body, repliedAt: new Date() },
    include: reviewInclude,
  });
  if (updated.userId !== ownerId) {
    await createNotification({
      userId: updated.userId,
      type: 'REVIEW_REPLY',
      title: 'Review reply',
      message: `${updated.business.name} replied to your review.`,
      reviewId: updated.id,
    });
  }
  return { review: toReview(updated) };
}

export async function reportReview(ownerId: string, reviewId: string, reason: string) {
  const review = await loadReview(reviewId);
  if (review.business.ownerId !== ownerId) throw new HttpError(403, 'You cannot report this review');
  try {
    const report = await prisma.reviewReport.create({
      data: { reviewId, reporterId: ownerId, reason },
    });
    return {
      report: {
        id: report.id,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'You have already reported this review');
    }
    throw error;
  }
}

export async function listAdminReviews(query: AdminReviewQuery) {
  const where: Prisma.ReviewWhereInput = query.q
    ? {
        OR: [
          { body: { contains: query.q } },
          { business: { name: { contains: query.q } } },
          { user: { fullName: { contains: query.q } } },
        ],
      }
    : {};
  const [total, rows] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      include: { ...reviewInclude, _count: { select: { reports: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);
  return {
    reviews: rows.map((review) => ({
      ...toReview(review),
      business: { id: review.business.id, name: review.business.name },
      author: { id: review.user.id, fullName: review.user.fullName, email: review.user.email },
      reportCount: review._count.reports,
    })),
    page: query.page,
    limit: query.limit,
    total,
  };
}

export async function deleteReviewAsAdmin(reviewId: string) {
  const review = await loadReview(reviewId);
  await removeReviewRecord(review);
}

export async function listReviewReports(query: ReportQuery) {
  const where = query.status ? { status: query.status } : {};
  const [total, rows] = await Promise.all([
    prisma.reviewReport.count({ where }),
    prisma.reviewReport.findMany({
      where,
      include: {
        review: { select: { id: true, body: true, rating: true, business: { select: { name: true } } } },
        reporter: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);
  return {
    reports: rows.map((report) => ({
      id: report.id,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
      review: {
        id: report.review.id,
        body: report.review.body,
        rating: report.review.rating,
        businessName: report.review.business.name,
      },
      reporter: report.reporter,
    })),
    page: query.page,
    limit: query.limit,
    total,
  };
}

async function setReportStatus(reportId: string, status: 'DISMISSED' | 'RESOLVED') {
  const existing = await prisma.reviewReport.findUnique({ where: { id: reportId }, select: { id: true } });
  if (!existing) throw new HttpError(404, 'Report not found');
  const report = await prisma.reviewReport.update({
    where: { id: reportId },
    data: { status },
    select: { id: true, status: true },
  });
  return { report };
}

export function dismissReport(reportId: string) {
  return setReportStatus(reportId, 'DISMISSED');
}

export function resolveReport(reportId: string) {
  return setReportStatus(reportId, 'RESOLVED');
}
