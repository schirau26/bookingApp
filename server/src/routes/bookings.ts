import { Router } from 'express';
import { Role } from '../generated/prisma/client.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import {
  cancelBooking,
  completeBooking,
  confirmBooking,
  createBooking,
  getBooking,
  listMyBookings,
  markNoShow,
} from '../services/bookingService.js';
import { createBookingSchema, myBookingsQuerySchema } from '../validators/booking.js';

export const bookingRouter = Router();

function idParam(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

bookingRouter.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const query = myBookingsQuerySchema.parse(req.query);
    res.json(await listMyBookings(req.authUser!.id, query));
  } catch (error) {
    next(error);
  }
});

bookingRouter.post('/', requireAuth, requireRole(Role.CUSTOMER), async (req, res, next) => {
  try {
    const body = createBookingSchema.parse(req.body);
    const result = await createBooking(req.authUser!.id, body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

bookingRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    res.json(await getBooking(idParam(req.params.id), req.authUser!.id));
  } catch (error) {
    next(error);
  }
});

bookingRouter.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    res.json(await cancelBooking(idParam(req.params.id), req.authUser!.id));
  } catch (error) {
    next(error);
  }
});

bookingRouter.post('/:id/confirm', requireAuth, requireRole(Role.BUSINESS_OWNER), async (req, res, next) => {
  try {
    res.json(await confirmBooking(idParam(req.params.id), req.authUser!.id));
  } catch (error) {
    next(error);
  }
});

bookingRouter.post('/:id/complete', requireAuth, requireRole(Role.BUSINESS_OWNER), async (req, res, next) => {
  try {
    res.json(await completeBooking(idParam(req.params.id), req.authUser!.id));
  } catch (error) {
    next(error);
  }
});

bookingRouter.post('/:id/no-show', requireAuth, requireRole(Role.BUSINESS_OWNER), async (req, res, next) => {
  try {
    res.json(await markNoShow(idParam(req.params.id), req.authUser!.id));
  } catch (error) {
    next(error);
  }
});
