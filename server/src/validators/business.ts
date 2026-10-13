import { z } from 'zod';
import { vehicleSizeSchema } from './booking.js';

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

const priceRowSchema = z.object({
  vehicleSize: vehicleSizeSchema,
  price: priceSchema,
  durationMinutes: z.coerce.number().int().min(5).max(480),
});

function uniqueSizes(prices: { vehicleSize: string }[], ctx: z.RefinementCtx) {
  if (new Set(prices.map((row) => row.vehicleSize)).size !== prices.length) {
    ctx.addIssue({
      code: 'custom',
      message: 'Include each vehicle size once',
      path: ['prices'],
    });
  }
}

const businessFields = {
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(5000),
  address: z.string().trim().min(1).max(255),
  phone: phoneSchema,
  phoneContactName: z.string().trim().min(2).max(80),
  secondaryContactName: z.string().trim().min(2).max(80),
  secondaryPhone: phoneSchema,
  email: z.email().transform((email) => email.toLowerCase()),
  bayCount: z.coerce.number().int().min(1).max(20),
};

export const updateBusinessSchema = z
  .object({
    name: businessFields.name.optional(),
    description: businessFields.description.optional(),
    address: businessFields.address.optional(),
    phone: businessFields.phone.optional(),
    phoneContactName: businessFields.phoneContactName.optional(),
    secondaryContactName: businessFields.secondaryContactName.optional(),
    secondaryPhone: businessFields.secondaryPhone.optional(),
    email: businessFields.email.optional(),
    bayCount: businessFields.bayCount.optional(),
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

export const serviceIconSchema = z.enum([
  'car-sport-outline',
  'sparkles-outline',
  'color-wand-outline',
  'ellipse-outline',
  'shield-checkmark-outline',
  'water-outline',
  'brush-outline',
]);

const pricesSchema = z.array(priceRowSchema).length(5).superRefine(uniqueSizes);

export const createServiceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(5000),
  isActive: z.boolean().optional(),
  icon: serviceIconSchema.optional(),
  prices: pricesSchema,
});

export const updateServiceSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().min(1).max(5000).optional(),
    isActive: z.boolean().optional(),
    icon: serviceIconSchema.optional(),
    prices: pricesSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide a field to update',
  });

export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type HoursInput = z.infer<typeof hoursSchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
