import { Router, type RequestHandler } from 'express';
import { Role } from '../generated/prisma/client.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { imageUpload } from '../middleware/upload.js';
import {
  addReviewPhoto,
  createReview,
  deleteReview,
  removeReviewPhoto,
  replyToReview,
  reportReview,
  updateReview,
} from '../services/reviewService.js';
import {
  createReviewSchema,
  replySchema,
  reportSchema,
  updateReviewSchema,
} from '../validators/review.js';

export const reviewRouter = Router();

const customer: RequestHandler[] = [requireAuth, requireRole(Role.CUSTOMER)];
const owner: RequestHandler[] = [requireAuth, requireRole(Role.BUSINESS_OWNER)];

function idParam(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

reviewRouter.post('/', ...customer, async (req, res, next) => {
  try {
    const body = createReviewSchema.parse(req.body);
    const result = await createReview(req.authUser!.id, body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

reviewRouter.patch('/:id', ...customer, async (req, res, next) => {
  try {
    const body = updateReviewSchema.parse(req.body);
    res.json(await updateReview(req.authUser!.id, idParam(req.params.id), body));
  } catch (error) {
    next(error);
  }
});

reviewRouter.delete('/:id', ...customer, async (req, res, next) => {
  try {
    await deleteReview(req.authUser!.id, idParam(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

reviewRouter.post('/:id/photos', ...customer, imageUpload('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(422).json({ error: { message: 'Choose an image' } });
      return;
    }
    const result = await addReviewPhoto(req.authUser!.id, idParam(req.params.id), req.file);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

reviewRouter.delete('/:id/photos/:photoId', ...customer, async (req, res, next) => {
  try {
    await removeReviewPhoto(req.authUser!.id, idParam(req.params.id), idParam(req.params.photoId));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

reviewRouter.put('/:id/reply', ...owner, async (req, res, next) => {
  try {
    const body = replySchema.parse(req.body);
    res.json(await replyToReview(req.authUser!.id, idParam(req.params.id), body.body));
  } catch (error) {
    next(error);
  }
});

reviewRouter.post('/:id/reports', ...owner, async (req, res, next) => {
  try {
    const body = reportSchema.parse(req.body);
    const result = await reportReview(req.authUser!.id, idParam(req.params.id), body.reason);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});
