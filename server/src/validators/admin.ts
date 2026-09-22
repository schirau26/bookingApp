import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const pageSchema = z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(1));
const limitSchema = z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(50).default(20));

export const adminUserQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  role: z.preprocess(emptyToUndefined, z.enum(['CUSTOMER', 'BUSINESS_OWNER', 'ADMIN']).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(['ACTIVE', 'SUSPENDED']).optional()),
  page: pageSchema,
  limit: limitSchema,
});

export const adminBookingQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  status: z.preprocess(
    emptyToUndefined,
    z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  ),
  page: pageSchema,
  limit: limitSchema,
});

const descriptionSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().max(500).optional(),
);

export const categoryBodySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: descriptionSchema,
});

export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;
export type AdminBookingQuery = z.infer<typeof adminBookingQuerySchema>;
export type CategoryBody = z.infer<typeof categoryBodySchema>;
