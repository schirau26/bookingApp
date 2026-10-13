import { Router } from 'express';
import { listAvailability } from '../services/bookingService.js';
import { getPublicWash } from '../services/businessService.js';
import { listBusinessReviews } from '../services/reviewService.js';
import { requireWash } from '../services/washService.js';
import { availabilityQuerySchema } from '../validators/booking.js';

export const washRouter = Router();

washRouter.get('/', async (_req, res, next) => {
  try {
    const wash = await requireWash();
    res.json(await getPublicWash(wash.id));
  } catch (error) {
    next(error);
  }
});

washRouter.get('/availability', async (req, res, next) => {
  try {
    const query = availabilityQuerySchema.parse(req.query);
    res.json(await listAvailability(query.packageId, query.vehicleSize, query.date));
  } catch (error) {
    next(error);
  }
});

washRouter.get('/reviews', async (_req, res, next) => {
  try {
    const wash = await requireWash();
    res.json(await listBusinessReviews(wash.id));
  } catch (error) {
    next(error);
  }
});
