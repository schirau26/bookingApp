import { Prisma, type DayOfWeek, type PrismaClient } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';
import { deleteStoredImage, saveImage } from '../storage/files.js';
import type {
  AdminBusinessQuery,
  BusinessQuery,
  CreateBusinessInput,
  CreateServiceInput,
  HoursInput,
  UpdateBusinessInput,
  UpdateServiceInput,
} from '../validators/business.js';

const dayOrder: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const categorySelect = { id: true, name: true, slug: true } as const;
const MAX_PHOTOS = 8;

type Db = PrismaClient | Prisma.TransactionClient;

function money(value: { toFixed(digits: number): string } | null | undefined) {
  if (value == null) return null;
  return value.toFixed(2);
}

function sortHours<T extends { dayOfWeek: DayOfWeek }>(hours: T[]) {
  return [...hours].sort(
    (left, right) => dayOrder.indexOf(left.dayOfWeek) - dayOrder.indexOf(right.dayOfWeek),
  );
}

function toCategory(category: { id: string; name: string; slug: string }) {
  return category;
}

function toPublicCard(business: {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  averageRating: { toFixed(digits: number): string };
  reviewCount: number;
  category: { id: string; name: string; slug: string };
  services: { price: { toFixed(digits: number): string } }[];
}) {
  return {
    id: business.id,
    name: business.name,
    description: business.description,
    address: business.address,
    phone: business.phone,
    email: business.email,
    logoUrl: business.logoUrl,
    averageRating: business.averageRating.toFixed(2),
    reviewCount: business.reviewCount,
    startingPrice: money(business.services[0]?.price),
    category: toCategory(business.category),
  };
}

const listInclude = {
  category: { select: categorySelect },
  services: {
    where: { isActive: true },
    orderBy: { price: 'asc' as const },
    take: 1,
    select: { price: true },
  },
} satisfies Prisma.BusinessInclude;

function publicWhere(query: BusinessQuery): Prisma.BusinessWhereInput {
  return {
    approvalStatus: 'APPROVED',
    ...(query.category ? { category: { slug: query.category } } : {}),
    ...(query.location ? { address: { contains: query.location } } : {}),
    ...(query.minRating !== undefined ? { averageRating: { gte: query.minRating } } : {}),
    ...(query.openOn
      ? { workingHours: { some: { dayOfWeek: query.openOn, isClosed: false } } }
      : {}),
    ...(query.maxPrice !== undefined
      ? { services: { some: { isActive: true, price: { lte: query.maxPrice } } } }
      : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q } },
            { services: { some: { isActive: true, name: { contains: query.q } } } },
          ],
        }
      : {}),
  };
}

function listOrder(sort: BusinessQuery['sort']): Prisma.BusinessOrderByWithRelationInput[] {
  if (sort === 'reviews') return [{ reviewCount: 'desc' }, { averageRating: 'desc' }];
  if (sort === 'name') return [{ name: 'asc' }];
  return [{ averageRating: 'desc' }, { reviewCount: 'desc' }, { name: 'asc' }];
}

async function requireCategory(categoryId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    throw new HttpError(422, 'Choose a category');
  }
}

async function ownedBusiness(businessId: string, ownerId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new HttpError(404, 'Business not found');
  if (business.ownerId !== ownerId) {
    throw new HttpError(403, 'You cannot manage this business');
  }
  return business;
}

function toService(
  service: {
    id: string;
    name: string;
    description: string;
    price: { toFixed(digits: number): string };
    durationMinutes: number;
    imageUrl: string | null;
    isActive: boolean;
  },
  includeInactive: boolean,
) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    price: service.price.toFixed(2),
    durationMinutes: service.durationMinutes,
    imageUrl: service.imageUrl,
    ...(includeInactive ? { isActive: service.isActive } : {}),
  };
}

async function loadOwnerDetail(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      category: { select: categorySelect },
      photos: { orderBy: { sortOrder: 'asc' } },
      workingHours: true,
      services: { orderBy: { name: 'asc' } },
    },
  });
  if (!business) throw new HttpError(404, 'Business not found');

  return {
    id: business.id,
    name: business.name,
    description: business.description,
    address: business.address,
    phone: business.phone,
    email: business.email,
    logoUrl: business.logoUrl,
    approvalStatus: business.approvalStatus,
    rejectionReason: business.rejectionReason,
    averageRating: business.averageRating.toFixed(2),
    reviewCount: business.reviewCount,
    category: toCategory(business.category),
    photos: business.photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      sortOrder: photo.sortOrder,
    })),
    workingHours: sortHours(business.workingHours).map((day) => ({
      dayOfWeek: day.dayOfWeek,
      isClosed: day.isClosed,
      openTime: day.openTime,
      closeTime: day.closeTime,
    })),
    services: business.services.map((service) => toService(service, true)),
  };
}

export async function listCategories() {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true, description: true },
  });
  return { categories };
}

export async function listPublicBusinesses(query: BusinessQuery) {
  const where = publicWhere(query);
  const total = await prisma.business.count({ where });

  if (query.sort === 'price') {
    const matches = await prisma.business.findMany({ where, select: { id: true } });
    const grouped =
      matches.length === 0
        ? []
        : await prisma.service.groupBy({
            by: ['businessId'],
            where: { businessId: { in: matches.map((match) => match.id) }, isActive: true },
            _min: { price: true },
          });
    const minById = new Map(
      grouped.map((row) => [row.businessId, row._min.price ? Number(row._min.price) : null]),
    );
    const orderedIds = matches
      .map((match) => match.id)
      .sort((left, right) => {
        const leftPrice = minById.get(left);
        const rightPrice = minById.get(right);
        if (leftPrice == null && rightPrice == null) return left.localeCompare(right);
        if (leftPrice == null) return 1;
        if (rightPrice == null) return -1;
        return leftPrice - rightPrice || left.localeCompare(right);
      });
    const pageIds = orderedIds.slice((query.page - 1) * query.limit, query.page * query.limit);
    const rows =
      pageIds.length === 0
        ? []
        : await prisma.business.findMany({
            where: { id: { in: pageIds } },
            include: listInclude,
          });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return {
      businesses: pageIds.flatMap((id) => {
        const row = byId.get(id);
        return row ? [toPublicCard(row)] : [];
      }),
      page: query.page,
      limit: query.limit,
      total,
    };
  }

  const rows = await prisma.business.findMany({
    where,
    include: listInclude,
    orderBy: listOrder(query.sort),
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  });

  return {
    businesses: rows.map(toPublicCard),
    page: query.page,
    limit: query.limit,
    total,
  };
}

export async function getPublicBusiness(id: string) {
  const business = await prisma.business.findFirst({
    where: { id, approvalStatus: 'APPROVED' },
    include: {
      category: { select: categorySelect },
      photos: { orderBy: { sortOrder: 'asc' } },
      workingHours: true,
    },
  });
  if (!business) throw new HttpError(404, 'Business not found');

  return {
    business: {
      id: business.id,
      name: business.name,
      description: business.description,
      address: business.address,
      phone: business.phone,
      email: business.email,
      logoUrl: business.logoUrl,
      averageRating: business.averageRating.toFixed(2),
      reviewCount: business.reviewCount,
      category: toCategory(business.category),
      photos: business.photos.map((photo) => ({
        id: photo.id,
        url: photo.url,
        sortOrder: photo.sortOrder,
      })),
      workingHours: sortHours(business.workingHours).map((day) => ({
        dayOfWeek: day.dayOfWeek,
        isClosed: day.isClosed,
        openTime: day.openTime,
        closeTime: day.closeTime,
      })),
    },
  };
}

export async function listPublicServices(businessId: string) {
  const business = await prisma.business.findFirst({
    where: { id: businessId, approvalStatus: 'APPROVED' },
    select: { id: true },
  });
  if (!business) throw new HttpError(404, 'Business not found');

  const services = await prisma.service.findMany({
    where: { businessId, isActive: true },
    orderBy: { name: 'asc' },
  });
  return { services: services.map((service) => toService(service, false)) };
}

export async function createBusiness(ownerId: string, input: CreateBusinessInput) {
  await requireCategory(input.categoryId);
  const business = await prisma.business.create({
    data: {
      ownerId,
      ...input,
      approvalStatus: 'PENDING',
    },
  });
  return { business: await loadOwnerDetail(business.id) };
}

export async function listMyBusinesses(ownerId: string) {
  const businesses = await prisma.business.findMany({
    where: { ownerId },
    include: { category: { select: categorySelect } },
    orderBy: { name: 'asc' },
  });
  return {
    businesses: businesses.map((business) => ({
      id: business.id,
      name: business.name,
      address: business.address,
      approvalStatus: business.approvalStatus,
      rejectionReason: business.rejectionReason,
      category: toCategory(business.category),
    })),
  };
}

export async function getMyBusiness(ownerId: string, businessId: string) {
  await ownedBusiness(businessId, ownerId);
  return { business: await loadOwnerDetail(businessId) };
}

export async function updateBusiness(
  ownerId: string,
  businessId: string,
  input: UpdateBusinessInput,
) {
  await ownedBusiness(businessId, ownerId);
  if (input.categoryId) await requireCategory(input.categoryId);
  await prisma.business.update({ where: { id: businessId }, data: input });
  return { business: await loadOwnerDetail(businessId) };
}

export async function replaceLogo(
  ownerId: string,
  businessId: string,
  file: { buffer: Buffer; mimetype: string },
) {
  const business = await ownedBusiness(businessId, ownerId);
  const saved = await saveImage(file.buffer, file.mimetype, 'logos');
  await prisma.business.update({
    where: { id: businessId },
    data: { logoUrl: saved.url },
  });
  await deleteStoredImage(business.logoUrl);
  return { logoUrl: saved.url };
}

export async function addPhoto(
  ownerId: string,
  businessId: string,
  file: { buffer: Buffer; mimetype: string },
) {
  await ownedBusiness(businessId, ownerId);
  const count = await prisma.businessPhoto.count({ where: { businessId } });
  if (count >= MAX_PHOTOS) {
    throw new HttpError(422, 'A business can have at most 8 photos');
  }
  const saved = await saveImage(file.buffer, file.mimetype, 'businesses');
  const photo = await prisma.businessPhoto.create({
    data: { businessId, url: saved.url, sortOrder: count },
  });
  return { photo: { id: photo.id, url: photo.url, sortOrder: photo.sortOrder } };
}

export async function removePhoto(ownerId: string, businessId: string, photoId: string) {
  await ownedBusiness(businessId, ownerId);
  const photo = await prisma.businessPhoto.findFirst({ where: { id: photoId, businessId } });
  if (!photo) throw new HttpError(404, 'Photo not found');
  await prisma.businessPhoto.delete({ where: { id: photoId } });
  await deleteStoredImage(photo.url);
}

export async function replaceHours(ownerId: string, businessId: string, input: HoursInput) {
  await ownedBusiness(businessId, ownerId);
  await prisma.$transaction(async (tx: Db) => {
    for (const day of input.hours) {
      const times = day.isClosed
        ? { openTime: null, closeTime: null }
        : { openTime: day.openTime, closeTime: day.closeTime };
      await tx.businessWorkingHour.upsert({
        where: { businessId_dayOfWeek: { businessId, dayOfWeek: day.dayOfWeek } },
        update: { isClosed: day.isClosed, ...times },
        create: { businessId, dayOfWeek: day.dayOfWeek, isClosed: day.isClosed, ...times },
      });
    }
  });
  return getMyBusiness(ownerId, businessId);
}

async function ownedService(ownerId: string, businessId: string, serviceId: string) {
  await ownedBusiness(businessId, ownerId);
  const service = await prisma.service.findFirst({ where: { id: serviceId, businessId } });
  if (!service) throw new HttpError(404, 'Service not found');
  return service;
}

export async function createService(
  ownerId: string,
  businessId: string,
  input: CreateServiceInput,
) {
  await ownedBusiness(businessId, ownerId);
  const service = await prisma.service.create({
    data: {
      businessId,
      name: input.name,
      description: input.description,
      price: input.price,
      durationMinutes: input.durationMinutes,
      isActive: input.isActive ?? true,
    },
  });
  return { service: toService(service, true) };
}

export async function updateService(
  ownerId: string,
  businessId: string,
  serviceId: string,
  input: UpdateServiceInput,
) {
  await ownedService(ownerId, businessId, serviceId);
  const service = await prisma.service.update({
    where: { id: serviceId },
    data: input,
  });
  return { service: toService(service, true) };
}

export async function deleteService(ownerId: string, businessId: string, serviceId: string) {
  await ownedService(ownerId, businessId, serviceId);
  try {
    await prisma.service.delete({ where: { id: serviceId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new HttpError(409, 'This service has bookings. Deactivate it instead.');
    }
    throw error;
  }
}

export async function replaceServiceImage(
  ownerId: string,
  businessId: string,
  serviceId: string,
  file: { buffer: Buffer; mimetype: string },
) {
  const service = await ownedService(ownerId, businessId, serviceId);
  const saved = await saveImage(file.buffer, file.mimetype, 'services');
  await prisma.service.update({ where: { id: serviceId }, data: { imageUrl: saved.url } });
  await deleteStoredImage(service.imageUrl);
  return { imageUrl: saved.url };
}

function adminWhere(query: AdminBusinessQuery): Prisma.BusinessWhereInput {
  return {
    ...(query.status ? { approvalStatus: query.status } : {}),
    ...(query.q ? { name: { contains: query.q } } : {}),
  };
}

export async function listAdminBusinesses(query: AdminBusinessQuery) {
  const where = adminWhere(query);
  const [total, rows] = await Promise.all([
    prisma.business.count({ where }),
    prisma.business.findMany({
      where,
      include: {
        category: { select: categorySelect },
        owner: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    businesses: rows.map((business) => ({
      id: business.id,
      name: business.name,
      address: business.address,
      phone: business.phone,
      email: business.email,
      approvalStatus: business.approvalStatus,
      rejectionReason: business.rejectionReason,
      createdAt: business.createdAt.toISOString(),
      category: toCategory(business.category),
      owner: business.owner,
    })),
    page: query.page,
    limit: query.limit,
    total,
  };
}

async function setStatus(
  id: string,
  data: Prisma.BusinessUpdateInput,
) {
  const existing = await prisma.business.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError(404, 'Business not found');
  const business = await prisma.business.update({
    where: { id },
    data,
    select: { id: true, approvalStatus: true, rejectionReason: true },
  });
  return { business };
}

export function approveBusiness(id: string) {
  return setStatus(id, { approvalStatus: 'APPROVED', rejectionReason: null });
}

export function rejectBusiness(id: string, reason: string) {
  return setStatus(id, { approvalStatus: 'REJECTED', rejectionReason: reason });
}

export function suspendBusiness(id: string) {
  return setStatus(id, { approvalStatus: 'SUSPENDED' });
}
