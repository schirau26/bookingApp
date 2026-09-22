import { Router } from 'express';
import { Role } from '../generated/prisma/client.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import {
  approveBusiness,
  listAdminBusinesses,
  rejectBusiness,
  suspendBusiness,
} from '../services/businessService.js';
import {
  deleteReviewAsAdmin,
  dismissReport,
  listAdminReviews,
  listReviewReports,
  resolveReport,
} from '../services/reviewService.js';
import { adminBusinessQuerySchema, rejectBusinessSchema } from '../validators/business.js';
import { adminReviewQuerySchema, reportQuerySchema } from '../validators/review.js';

export const adminRouter = Router();

const adminOnly = [requireAuth, requireRole(Role.ADMIN)] as const;

function idParam(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

adminRouter.get('/me', ...adminOnly, (req, res) => {
  res.json({ user: req.authUser });
});

adminRouter.get('/businesses', ...adminOnly, async (req, res, next) => {
  try {
    const query = adminBusinessQuerySchema.parse(req.query);
    res.json(await listAdminBusinesses(query));
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/businesses/:id/approve', ...adminOnly, async (req, res, next) => {
  try {
    res.json(await approveBusiness(idParam(req.params.id)));
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/businesses/:id/reject', ...adminOnly, async (req, res, next) => {
  try {
    const body = rejectBusinessSchema.parse(req.body);
    res.json(await rejectBusiness(idParam(req.params.id), body.reason));
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/businesses/:id/suspend', ...adminOnly, async (req, res, next) => {
  try {
    res.json(await suspendBusiness(idParam(req.params.id)));
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/reviews', ...adminOnly, async (req, res, next) => {
  try {
    res.json(await listAdminReviews(adminReviewQuerySchema.parse(req.query)));
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/reviews/:id', ...adminOnly, async (req, res, next) => {
  try {
    await deleteReviewAsAdmin(idParam(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/review-reports', ...adminOnly, async (req, res, next) => {
  try {
    res.json(await listReviewReports(reportQuerySchema.parse(req.query)));
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/review-reports/:id/dismiss', ...adminOnly, async (req, res, next) => {
  try {
    res.json(await dismissReport(idParam(req.params.id)));
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/review-reports/:id/resolve', ...adminOnly, async (req, res, next) => {
  try {
    res.json(await resolveReport(idParam(req.params.id)));
  } catch (error) {
    next(error);
  }
});
