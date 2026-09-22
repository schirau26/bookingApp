import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Enter a valid phone number')
  .max(32, 'Enter a valid phone number')
  .regex(/^\+?[0-9][0-9\s()-]*$/, 'Enter a valid phone number');

export const dayOfWeekSchema = z.enum([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');

const priceSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine(
    (value) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0 && Number(value) <= 99999999.99,
    'Enter a price greater than 0 with at most two decimal places',
  )
  .transform((value) => Number(value).toFixed(2));

const businessFields = {
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(5000),
  address: z.string().trim().min(1).max(255),
  phone: phoneSchema,
  email: z.email().transform((email) => email.toLowerCase()),
  categoryId: z.string().trim().min(1),
};

export const createBusinessSchema = z.object(businessFields);

export const updateBusinessSchema = z
  .object({
    name: businessFields.name.optional(),
    description: businessFields.description.optional(),
    address: businessFields.address.optional(),
    phone: businessFields.phone.optional(),
    email: businessFields.email.optional(),
    categoryId: businessFields.categoryId.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide a field to update',
  });

const dayHoursSchema = z
  .object({
    dayOfWeek: dayOfWeekSchema,
    isClosed: z.boolean(),
    openTime: z.string().nullable(),
    closeTime: z.string().nullable(),
  })
  .superRefine((day, ctx) => {
    if (day.isClosed) {
      if (day.openTime !== null || day.closeTime !== null) {
        ctx.addIssue({
          code: 'custom',
          message: 'A closed day cannot have opening hours',
          path: ['openTime'],
        });
      }
      return;
    }

    const open = timeSchema.safeParse(day.openTime);
    const close = timeSchema.safeParse(day.closeTime);
    if (!open.success) {
      ctx.addIssue({ code: 'custom', message: 'Use HH:mm', path: ['openTime'] });
    }
    if (!close.success) {
      ctx.addIssue({ code: 'custom', message: 'Use HH:mm', path: ['closeTime'] });
    }
    if (open.success && close.success && open.data >= close.data) {
      ctx.addIssue({
        code: 'custom',
        message: 'Close time must be after open time',
        path: ['closeTime'],
      });
    }
  });

export const hoursSchema = z
  .object({
    hours: z.array(dayHoursSchema).length(7),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.hours.map((day) => day.dayOfWeek)).size !== 7) {
      ctx.addIssue({
        code: 'custom',
        message: 'Include each weekday once',
        path: ['hours'],
      });
    }
  });

export const createServiceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(5000),
  price: priceSchema,
  durationMinutes: z.coerce.number().int().min(5).max(480),
  isActive: z.boolean().optional(),
});

export const updateServiceSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().min(1).max(5000).optional(),
    price: priceSchema.optional(),
    durationMinutes: z.coerce.number().int().min(5).max(480).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide a field to update',
  });

const pageSchema = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive().default(1),
);
const limitSchema = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(1).max(50).default(20),
);

export const businessQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  category: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  location: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  minRating: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(5).optional()),
  maxPrice: z.preprocess(emptyToUndefined, z.coerce.number().positive().max(99999999.99).optional()),
  openOn: z.preprocess(emptyToUndefined, dayOfWeekSchema.optional()),
  sort: z.preprocess(
    emptyToUndefined,
    z.enum(['rating', 'reviews', 'price', 'name']).default('rating'),
  ),
  page: pageSchema,
  limit: limitSchema,
});

export const adminBusinessQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  status: z.preprocess(
    emptyToUndefined,
    z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(),
  ),
  page: pageSchema,
  limit: limitSchema,
});

export const rejectBusinessSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type HoursInput = z.infer<typeof hoursSchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type BusinessQuery = z.infer<typeof businessQuerySchema>;
export type AdminBusinessQuery = z.infer<typeof adminBusinessQuerySchema>;
