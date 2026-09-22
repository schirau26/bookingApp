import { Router } from 'express';
import { authRateLimit } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { login, logout, refreshSession, register } from '../services/authService.js';
import { loginSchema, refreshTokenSchema, registerSchema } from '../validators/auth.js';

export const authRouter = Router();

authRouter.post('/register', authRateLimit, async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const session = await register(body);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', authRateLimit, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const session = await login(body.email, body.password);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const body = refreshTokenSchema.parse(req.body);
    const session = await refreshSession(body.refreshToken);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const body = refreshTokenSchema.parse(req.body);
    await logout(body.refreshToken);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.authUser });
});
