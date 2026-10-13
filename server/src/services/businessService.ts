import { Prisma, type VehicleSize } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';
import { deleteStoredImage, saveImage } from '../storage/files.js';
import type {
  CreateServiceInput,
  HoursInput,
  UpdateBusinessInput,
  UpdateServiceInput,
} from '../validators/business.js';

const MAX_PHOTOS = 8;

const sizeOrder: VehicleSize[] = ['HATCHBACK', 'SEDAN', 'SUV', 'BAKKIE', 'VAN'];

type Db = Prisma.TransactionClient | typeof prisma;

function money(value: { toFixed(digits: number): string } | null | undefined) {
  return value ? value.toFixed(2) : null;
}

const serviceInclude = {
  prices: true,
} satisfies Prisma.ServiceInclude;

type ServiceRecord = Prisma.ServiceGetPayload<{ include: typeof serviceInclude }>;

function toPrices(service: ServiceRecord) {
  return [...service.prices]
    .sort((left, right) => sizeOrder.indexOf(left.vehicleSize) - sizeOrder.indexOf(right.vehicleSize))
    .map((row) => ({
      vehicleSize: row.vehicleSize,
      price: money(row.price) ?? '0.00',
      durationMinutes: row.durationMinutes,
    }));
}

function toPackage(service: ServiceRecord, includeInactive: boolean) {
  const prices = toPrices(service);
  const starting = prices.reduce<string | null>((lowest, row) => {
    if (!lowest || Number(row.price) < Number(lowest)) return row.price;
    return lowest;
  }, null);
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    imageUrl: service.imageUrl,
    icon: service.icon,
    startingPrice: starting,
    prices,
    ...(includeInactive ? { isActive: service.isActive } : {}),
  };
}

const detailInclude = {
  photos: { orderBy: { sortOrder: 'asc' as const } },
  workingHours: true,
  services: { include: serviceInclude, orderBy: { name: 'asc' as const } },
  owner: { select: { fullName: true, profileImageUrl: true } },
} satisfies Prisma.BusinessInclude;

type WashRecord = Prisma.BusinessGetPayload<{ include: typeof detailInclude }>;

function toWash(business: WashRecord, includeInactive: boolean) {
  const services = includeInactive ? business.services : business.services.filter((service) => service.isActive);
  return {
    id: business.id,
    name: business.name,
    description: business.description,
    address: business.address,
    phone: business.phone,
    phoneContactName: business.phoneContactName,
    secondaryContactName: business.secondaryContactName,
    secondaryPhone: business.secondaryPhone,
    email: business.email,
    logoUrl: business.logoUrl,
    bayCount: business.bayCount,
    averageRating: money(business.averageRating) ?? '0.00',
    reviewCount: business.reviewCount,
    photos: business.photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      sortOrder: photo.sortOrder,
    })),
    workingHours: business.workingHours.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      isClosed: day.isClosed,
      openTime: day.openTime,
      closeTime: day.closeTime,
    })),
    packages: services.map((service) => toPackage(service, includeInactive)),
    owner: business.owner,
  };
}

async function loadWash(id: string) {
  const business = await prisma.business.findUnique({ where: { id }, include: detailInclude });
  if (!business) throw new HttpError(404, 'Wash not found');
  return business;
}

async function ownedBusiness(businessId: string, ownerId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new HttpError(404, 'Wash not found');
  if (business.ownerId !== ownerId) throw new HttpError(403, 'You cannot manage this wash');
  return business;
}

export async function getPublicWash(businessId: string) {
  return { wash: toWash(await loadWash(businessId), false) };
}

export async function listMyBusinesses(ownerId: string) {
  const rows = await prisma.business.findMany({
    where: { ownerId },
    include: detailInclude,
    orderBy: { createdAt: 'asc' },
  });
  return { businesses: rows.map((business) => toWash(business, true)) };
}

export async function getMyBusiness(ownerId: string, businessId: string) {
  await ownedBusiness(businessId, ownerId);
  return { business: toWash(await loadWash(businessId), true) };
}

export async function updateBusiness(ownerId: string, businessId: string, input: UpdateBusinessInput) {
  await ownedBusiness(businessId, ownerId);
  await prisma.business.update({ where: { id: businessId }, data: input });
  return { business: toWash(await loadWash(businessId), true) };
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
    throw new HttpError(422, 'A wash can have at most 8 photos');
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
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId },
    include: serviceInclude,
  });
  if (!service) throw new HttpError(404, 'Package not found');
  return service;
}

async function replacePrices(db: Db, serviceId: string, prices: CreateServiceInput['prices']) {
  await db.servicePrice.deleteMany({ where: { serviceId } });
  await db.servicePrice.createMany({
    data: prices.map((row) => ({
      serviceId,
      vehicleSize: row.vehicleSize,
      price: row.price,
      durationMinutes: row.durationMinutes,
    })),
  });
}

export async function createService(ownerId: string, businessId: string, input: CreateServiceInput) {
  await ownedBusiness(businessId, ownerId);
  const service = await prisma.$transaction(async (tx) => {
    const created = await tx.service.create({
      data: {
        businessId,
        name: input.name,
        description: input.description,
        isActive: input.isActive ?? true,
        icon: input.icon ?? 'car-sport-outline',
      },
    });
    await replacePrices(tx, created.id, input.prices);
    return tx.service.findUniqueOrThrow({ where: { id: created.id }, include: serviceInclude });
  });
  return { service: toPackage(service, true) };
}

export async function updateService(
  ownerId: string,
  businessId: string,
  serviceId: string,
  input: UpdateServiceInput,
) {
  await ownedService(ownerId, businessId, serviceId);
  const service = await prisma.$transaction(async (tx) => {
    await tx.service.update({
      where: { id: serviceId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        ...(input.icon === undefined ? {} : { icon: input.icon }),
      },
    });
    if (input.prices) await replacePrices(tx, serviceId, input.prices);
    return tx.service.findUniqueOrThrow({ where: { id: serviceId }, include: serviceInclude });
  });
  return { service: toPackage(service, true) };
}

export async function deleteService(ownerId: string, businessId: string, serviceId: string) {
  await ownedService(ownerId, businessId, serviceId);
  try {
    await prisma.service.delete({ where: { id: serviceId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new HttpError(409, 'This package has bookings. Deactivate it instead.');
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
