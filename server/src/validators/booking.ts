import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Enter a valid phone number')
  .max(32, 'Enter a valid phone number')
  .regex(/^\+?[0-9][0-9\s()-]*$/, 'Enter a valid phone number');

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const vehicleSizeSchema = z.enum(['HATCHBACK', 'SEDAN', 'SUV', 'BAKKIE', 'VAN']);

export const availabilityQuerySchema = z.object({
  packageId: z.string().trim().min(1),
  vehicleSize: vehicleSizeSchema,
  date: dateSchema,
});

export const createBookingSchema = z.object({
  packageId: z.string().trim().min(1),
  vehicleSize: vehicleSizeSchema,
  registration: z
    .string()
    .trim()
    .min(2, 'Enter the registration')
    .max(32, 'Enter the registration')
    .transform((value) => value.toUpperCase()),
  make: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().trim().min(1).max(80).optional(),
  ),
  color: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().trim().min(1).max(40).optional(),
  ),
  startsAt: z.iso.datetime(),
  customerName: z.string().trim().min(2).max(191),
  customerPhone: phoneSchema,
  customerEmail: z.email().transform((email) => email.toLowerCase()),
  note: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().trim().max(2000).optional(),
  ),
});

export const myBookingsQuerySchema = z.object({
  when: z.preprocess(emptyToUndefined, z.enum(['upcoming', 'past']).default('upcoming')),
});

export const ownerBookingsQuerySchema = z.object({
  status: z.preprocess(
    emptyToUndefined,
    z.enum(['CONFIRMED', 'ARRIVED', 'WASHING', 'READY', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  ),
  date: z.preprocess(emptyToUndefined, dateSchema.optional()),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type MyBookingsQuery = z.infer<typeof myBookingsQuerySchema>;
export type OwnerBookingsQuery = z.infer<typeof ownerBookingsQuerySchema>;
