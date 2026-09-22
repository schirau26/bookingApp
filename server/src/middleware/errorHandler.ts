import type { ErrorRequestHandler } from 'express';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const statusCode = err instanceof HttpError ? err.statusCode : 500;
  const message = err instanceof HttpError ? err.message : 'Internal server error';

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    error: {
      message,
    },
  });
};
