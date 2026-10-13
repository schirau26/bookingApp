import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/[0-9]/, 'Password must include a number');

const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Enter a valid phone number')
  .max(32, 'Enter a valid phone number')
  .regex(/^\+?[0-9][0-9\s()-]*$/, 'Enter a valid phone number');

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(191),
  email: z.email().transform((email) => email.toLowerCase()),
  password: passwordSchema,
  phone: z.preprocess((value) => (value === '' ? undefined : value), phoneSchema.optional()),
});

export const loginSchema = z.object({
  email: z.email().transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
