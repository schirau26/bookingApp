import type { RequestHandler } from 'express';
import type { Role } from '../generated/prisma/client.js';
import { getAuthUser } from '../services/authService.js';
import { verifyAccessToken } from '../services/tokens.js';
import { HttpError } from './errorHandler.js';

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  if (!req.header('authorization')) {
    next();
    return;
  }
  return requireAuth(req, _res, next);
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.header('authorization');
  if (!header) {
    next(new HttpError(401, 'Authentication required'));
    return;
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    next(new HttpError(401, 'Authentication required'));
    return;
  }

  try {
    const claims = await verifyAccessToken(token);
    const user = await getAuthUser(claims.userId);
    if (!user) {
      next(new HttpError(401, 'Invalid or expired token'));
      return;
    }
    if (user.status === 'SUSPENDED') {
      next(new HttpError(403, 'This account is suspended'));
      return;
    }

    req.authUser = user;
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, 'Invalid or expired token'));
  }
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.authUser) {
      next(new HttpError(401, 'Authentication required'));
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      next(new HttpError(403, 'You do not have access to this resource'));
      return;
    }
    next();
  };
}
