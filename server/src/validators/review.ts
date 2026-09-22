import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const pageSchema = z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(1));
const limitSchema = z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(50).default(20));

export const createReviewSchema = z.object({
  bookingId: z.string().trim().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(1).max(2000),
});

export const updateReviewSchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5).optional(),
    body: z.string().trim().min(1).max(2000).optional(),
  })
  .refine((value) => value.rating !== undefined || value.body !== undefined, {
    message: 'Provide a field to update',
  });

export const replySchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const reportSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export const adminReviewQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  page: pageSchema,
  limit: limitSchema,
});

export const reportQuerySchema = z.object({
  status: z.preprocess(emptyToUndefined, z.enum(['OPEN', 'DISMISSED', 'RESOLVED']).optional()),
  page: pageSchema,
  limit: limitSchema,
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type AdminReviewQuery = z.infer<typeof adminReviewQuerySchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
