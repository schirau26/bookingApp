import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { listNotifications, setNotificationRead } from '../services/notificationService.js';
import { updateNotificationSchema } from '../validators/notification.js';

export const notificationRouter = Router();

function idParam(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

notificationRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    res.json(await listNotifications(req.authUser!.id));
  } catch (error) {
    next(error);
  }
});

notificationRouter.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const body = updateNotificationSchema.parse(req.body);
    res.json(await setNotificationRead(req.authUser!.id, idParam(req.params.id), body.isRead));
  } catch (error) {
    next(error);
  }
});
