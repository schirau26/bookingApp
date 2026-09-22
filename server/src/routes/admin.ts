import { Router } from 'express';
import { Role } from '../generated/prisma/client.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';

export const adminRouter = Router();

adminRouter.get('/me', requireAuth, requireRole(Role.ADMIN), (req, res) => {
  res.json({ user: req.authUser });
});
