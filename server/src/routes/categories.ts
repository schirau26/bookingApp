import { Router } from 'express';
import { listCategories } from '../services/businessService.js';

export const categoryRouter = Router();

categoryRouter.get('/', async (_req, res, next) => {
  try {
    res.json(await listCategories());
  } catch (error) {
    next(error);
  }
});
