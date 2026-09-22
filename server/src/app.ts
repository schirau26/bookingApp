import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { corsOrigins } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFound.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { bookingRouter } from './routes/bookings.js';
import { businessRouter } from './routes/businesses.js';
import { categoryRouter } from './routes/categories.js';
import { healthRouter } from './routes/health.js';
import { reviewRouter } from './routes/reviews.js';
import { uploadsDirectory, uploadsPublicPath } from './storage/files.js';

export function createApp() {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(uploadsPublicPath, express.static(uploadsDirectory));

  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/categories', categoryRouter);
  app.use('/api/businesses', businessRouter);
  app.use('/api/bookings', bookingRouter);
  app.use('/api/reviews', reviewRouter);
  app.use('/api/admin', adminRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
