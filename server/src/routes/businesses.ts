import { Router, type RequestHandler } from 'express';
import { Role } from '../generated/prisma/client.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { imageUpload } from '../middleware/upload.js';
import { listAvailability, listOwnerBookings } from '../services/bookingService.js';
import {
  addPhoto,
  createBusiness,
  createService,
  deleteService,
  getMyBusiness,
  getPublicBusiness,
  listMyBusinesses,
  listPublicBusinesses,
  listPublicServices,
  removePhoto,
  replaceHours,
  replaceLogo,
  replaceServiceImage,
  updateBusiness,
  updateService,
} from '../services/businessService.js';
import { availabilityQuerySchema, ownerBookingsQuerySchema } from '../validators/booking.js';
import {
  businessQuerySchema,
  createBusinessSchema,
  createServiceSchema,
  hoursSchema,
  updateBusinessSchema,
  updateServiceSchema,
} from '../validators/business.js';

export const businessRouter = Router();

const owner: RequestHandler[] = [requireAuth, requireRole(Role.BUSINESS_OWNER)];

function idParam(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

businessRouter.get('/', async (req, res, next) => {
  try {
    const query = businessQuerySchema.parse(req.query);
    res.json(await listPublicBusinesses(query));
  } catch (error) {
    next(error);
  }
});

businessRouter.get('/mine', ...owner, async (req, res, next) => {
  try {
    res.json(await listMyBusinesses(req.authUser!.id));
  } catch (error) {
    next(error);
  }
});

businessRouter.get('/mine/:id', ...owner, async (req, res, next) => {
  try {
    res.json(await getMyBusiness(req.authUser!.id, idParam(req.params.id)));
  } catch (error) {
    next(error);
  }
});

businessRouter.post('/', ...owner, async (req, res, next) => {
  try {
    const body = createBusinessSchema.parse(req.body);
    const result = await createBusiness(req.authUser!.id, body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

businessRouter.get('/:id/services/:serviceId/availability', async (req, res, next) => {
  try {
    const query = availabilityQuerySchema.parse(req.query);
    res.json(
      await listAvailability(idParam(req.params.id), idParam(req.params.serviceId), query.date),
    );
  } catch (error) {
    next(error);
  }
});

businessRouter.get('/:id/bookings', ...owner, async (req, res, next) => {
  try {
    const query = ownerBookingsQuerySchema.parse(req.query);
    res.json(await listOwnerBookings(req.authUser!.id, idParam(req.params.id), query));
  } catch (error) {
    next(error);
  }
});

businessRouter.get('/:id/services', async (req, res, next) => {
  try {
    res.json(await listPublicServices(idParam(req.params.id)));
  } catch (error) {
    next(error);
  }
});

businessRouter.post('/:id/services', ...owner, async (req, res, next) => {
  try {
    const body = createServiceSchema.parse(req.body);
    const result = await createService(req.authUser!.id, idParam(req.params.id), body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

businessRouter.patch('/:id/services/:serviceId', ...owner, async (req, res, next) => {
  try {
    const body = updateServiceSchema.parse(req.body);
    res.json(
      await updateService(
        req.authUser!.id,
        idParam(req.params.id),
        idParam(req.params.serviceId),
        body,
      ),
    );
  } catch (error) {
    next(error);
  }
});

businessRouter.delete('/:id/services/:serviceId', ...owner, async (req, res, next) => {
  try {
    await deleteService(req.authUser!.id, idParam(req.params.id), idParam(req.params.serviceId));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

businessRouter.post(
  '/:id/services/:serviceId/image',
  ...owner,
  imageUpload('image'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(422).json({ error: { message: 'Choose an image' } });
        return;
      }
      res.json(
        await replaceServiceImage(
          req.authUser!.id,
          idParam(req.params.id),
          idParam(req.params.serviceId),
          req.file,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

businessRouter.put('/:id/hours', ...owner, async (req, res, next) => {
  try {
    const body = hoursSchema.parse(req.body);
    res.json(await replaceHours(req.authUser!.id, idParam(req.params.id), body));
  } catch (error) {
    next(error);
  }
});

businessRouter.post('/:id/logo', ...owner, imageUpload('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(422).json({ error: { message: 'Choose an image' } });
      return;
    }
    res.json(await replaceLogo(req.authUser!.id, idParam(req.params.id), req.file));
  } catch (error) {
    next(error);
  }
});

businessRouter.post('/:id/photos', ...owner, imageUpload('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(422).json({ error: { message: 'Choose an image' } });
      return;
    }
    const result = await addPhoto(req.authUser!.id, idParam(req.params.id), req.file);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

businessRouter.delete('/:id/photos/:photoId', ...owner, async (req, res, next) => {
  try {
    await removePhoto(req.authUser!.id, idParam(req.params.id), idParam(req.params.photoId));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

businessRouter.get('/:id', async (req, res, next) => {
  try {
    res.json(await getPublicBusiness(idParam(req.params.id)));
  } catch (error) {
    next(error);
  }
});

businessRouter.patch('/:id', ...owner, async (req, res, next) => {
  try {
    const body = updateBusinessSchema.parse(req.body);
    res.json(await updateBusiness(req.authUser!.id, idParam(req.params.id), body));
  } catch (error) {
    next(error);
  }
});
