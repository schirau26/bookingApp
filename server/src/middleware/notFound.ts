import type { RequestHandler } from 'express';
import { HttpError } from './errorHandler.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, 'Not found'));
};
