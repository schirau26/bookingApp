import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from './db/prisma.js';
import { useTestWash } from './services/washService.js';
import { hashPassword } from './utils/password.js';

export const weekdays = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export const vehicleSizes = ['HATCHBACK', 'SEDAN', 'SUV', 'BAKKIE', 'VAN'] as const;

export function priceRows(
  rows: Partial<Record<(typeof vehicleSizes)[number], { price: string; durationMinutes: number }>> = {},
) {
  return vehicleSizes.map((vehicleSize) => ({
    vehicleSize,
    price: rows[vehicleSize]?.price ?? '100.00',
    durationMinutes: rows[vehicleSize]?.durationMinutes ?? 60,
  }));
}

export function testEmail(prefix: string, created: string[]) {
  const value = `${prefix}-${randomUUID()}@example.com`;
  created.push(value);
  return value;
}

export async function registerCustomer(app: Express, created: string[], fullName = 'Test Customer') {
  const response = await request(app).post('/api/auth/register').send({
    fullName,
    email: testEmail('customer', created),
    password: 'Password1!',
    phone: '0810000001',
  });
  if (response.status !== 201) {
    throw new Error(`Register failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body as {
    accessToken: string;
    user: { id: string; fullName: string; email: string; phone: string | null };
  };
}

export async function createOwner(app: Express, created: string[], fullName = 'Joe') {
  const email = testEmail('owner', created);
  await prisma.user.create({
    data: {
      email,
      fullName,
      phone: '0817310735',
      passwordHash: await hashPassword('Password1!'),
      role: 'BUSINESS_OWNER',
    },
  });
  const login = await request(app).post('/api/auth/login').send({
    email,
    password: 'Password1!',
  });
  if (login.status !== 200) {
    throw new Error(`Owner login failed: ${login.status}`);
  }
  return {
    accessToken: login.body.accessToken as string,
    user: login.body.user as { id: string; fullName: string; email: string },
  };
}

export async function createWash(
  ownerId: string,
  businessIds: string[],
  options?: {
    bayCount?: number;
    closedDay?: (typeof weekdays)[number] | null;
    prices?: ReturnType<typeof priceRows>;
    serviceName?: string;
  },
) {
  const closedDay = options?.closedDay === undefined ? 'WEDNESDAY' : options.closedDay;
  const business = await prisma.business.create({
    data: {
      ownerId,
      name: `Urban Glow ${randomUUID().slice(0, 8)}`,
      description: 'A wash used by tests.',
      address: 'Windhoek',
      phone: '0817310735',
      phoneContactName: 'Joe',
      secondaryContactName: 'Shake',
      secondaryPhone: '0811285713',
      email: 'hello@urbanglow.example',
      bayCount: options?.bayCount ?? 1,
      workingHours: {
        create: weekdays.map((dayOfWeek) =>
          dayOfWeek === closedDay
            ? { dayOfWeek, isClosed: true, openTime: null, closeTime: null }
            : { dayOfWeek, isClosed: false, openTime: '09:00', closeTime: '17:00' },
        ),
      },
      services: {
        create: {
          name: options?.serviceName ?? 'Exterior Wash',
          description: 'Soap and rinse.',
          icon: 'car-sport-outline',
          prices: { create: options?.prices ?? priceRows({ SEDAN: { price: '150.00', durationMinutes: 60 } }) },
        },
      },
    },
    include: { services: true },
  });
  businessIds.push(business.id);
  useTestWash(business.id);
  return { businessId: business.id, packageId: business.services[0]?.id ?? '' };
}

export async function removeWashes(businessIds: string[]) {
  useTestWash(null);
  if (businessIds.length === 0) return;
  await prisma.review.deleteMany({ where: { businessId: { in: businessIds } } });
  await prisma.invoice.deleteMany({ where: { booking: { businessId: { in: businessIds } } } });
  await prisma.notification.deleteMany({ where: { booking: { businessId: { in: businessIds } } } });
  await prisma.booking.deleteMany({ where: { businessId: { in: businessIds } } });
  await prisma.service.deleteMany({ where: { businessId: { in: businessIds } } });
  await prisma.businessPhoto.deleteMany({ where: { businessId: { in: businessIds } } });
  await prisma.businessWorkingHour.deleteMany({ where: { businessId: { in: businessIds } } });
  await prisma.business.deleteMany({ where: { id: { in: businessIds } } });
}
