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
import {
  activateUser,
  adminStats,
  createCategory,
  deleteCategory,
  listAdminBookings,
  listAdminCategories,
  listAdminUsers,
  suspendUser,
  updateCategory,
} from '../services/adminService.js';
import { adminBookingQuerySchema, adminUserQuerySchema, categoryBodySchema } from '../validators/admin.js';
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

adminRouter.get('/stats', ...adminOnly, async (_req, res, next) => {
  try {
    res.json(await adminStats());
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/users', ...adminOnly, async (req, res, next) => {
  try {
    res.json(await listAdminUsers(adminUserQuerySchema.parse(req.query)));
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/users/:id/suspend', ...adminOnly, async (req, res, next) => {
  try {
    res.json(await suspendUser(req.authUser!.id, idParam(req.params.id)));
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/users/:id/activate', ...adminOnly, async (req, res, next) => {
  try {
    res.json(await activateUser(req.authUser!.id, idParam(req.params.id)));
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/bookings', ...adminOnly, async (req, res, next) => {
  try {
    res.json(await listAdminBookings(adminBookingQuerySchema.parse(req.query)));
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/categories', ...adminOnly, async (_req, res, next) => {
  try {
    res.json(await listAdminCategories());
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/categories', ...adminOnly, async (req, res, next) => {
  try {
    res.status(201).json(await createCategory(categoryBodySchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/categories/:id', ...adminOnly, async (req, res, next) => {
  try {
    res.json(await updateCategory(idParam(req.params.id), categoryBodySchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/categories/:id', ...adminOnly, async (req, res, next) => {
  try {
    await deleteCategory(idParam(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
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
