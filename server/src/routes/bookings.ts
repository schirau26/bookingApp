import { Router } from 'express';
import { Role } from '../generated/prisma/client.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import {
  cancelBooking,
  completeBooking,
  createBooking,
  getBooking,
  getInvoice,
  listMyBookings,
  markArrived,
  markInvoicePaid,
  markNoShow,
  markReady,
  markWashing,
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

bookingRouter.get('/:id/invoice', requireAuth, async (req, res, next) => {
  try {
    res.json(await getInvoice(idParam(req.params.id), req.authUser!.id));
  } catch (error) {
    next(error);
  }
});

bookingRouter.post('/:id/invoice/pay', requireAuth, requireRole(Role.BUSINESS_OWNER), async (req, res, next) => {
  try {
    res.json(await markInvoicePaid(idParam(req.params.id), req.authUser!.id));
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

bookingRouter.post('/:id/arrive', requireAuth, requireRole(Role.BUSINESS_OWNER), async (req, res, next) => {
  try {
    res.json(await markArrived(idParam(req.params.id), req.authUser!.id));
  } catch (error) {
    next(error);
  }
});

bookingRouter.post('/:id/wash', requireAuth, requireRole(Role.BUSINESS_OWNER), async (req, res, next) => {
  try {
    res.json(await markWashing(idParam(req.params.id), req.authUser!.id));
  } catch (error) {
    next(error);
  }
});

bookingRouter.post('/:id/ready', requireAuth, requireRole(Role.BUSINESS_OWNER), async (req, res, next) => {
  try {
    res.json(await markReady(idParam(req.params.id), req.authUser!.id));
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
