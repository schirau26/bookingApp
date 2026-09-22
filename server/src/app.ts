import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { corsOrigins } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFound.js';
import { healthRouter } from './routes/health.js';

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

  app.use('/api', healthRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
