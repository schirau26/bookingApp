import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const authRateLimit: RequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skip: () => env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        message: 'Too many attempts. Try again later.',
      },
    });
  },
});
