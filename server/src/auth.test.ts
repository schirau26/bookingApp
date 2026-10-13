import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { createApp } from './app.js';

const app = createApp();
const createdEmails: string[] = [];

function email() {
  const value = `phase3-${randomUUID()}@example.com`;
  createdEmails.push(value);
  return value;
}

async function register() {
  const response = await request(app).post('/api/auth/register').send({
    fullName: 'Test User',
    email: email(),
    password: 'Password1!',
    phone: '+264811234567',
  });
  return response;
}

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: createdEmails } },
  });
  await prisma.$disconnect();
});

describe('authentication', () => {
  it('registers a customer and ignores an owner role on the form', async () => {
    const customer = await register();
    const ownerAttempt = await request(app).post('/api/auth/register').send({
      fullName: 'Owner Hopeful',
      email: email(),
      password: 'Password1!',
      role: 'BUSINESS_OWNER',
    });

    expect(customer.status).toBe(201);
    expect(customer.body.user.role).toBe('CUSTOMER');
    expect(customer.body.user.passwordHash).toBeUndefined();
    expect(customer.body.accessToken).toEqual(expect.any(String));
    expect(customer.body.refreshToken).toEqual(expect.any(String));
    expect(ownerAttempt.status).toBe(201);
    expect(ownerAttempt.body.user.role).toBe('CUSTOMER');
  });

  it('creates a customer even if a role is sent, and rejects a duplicate email or a weak password', async () => {
    const admin = await request(app).post('/api/auth/register').send({
      fullName: 'Admin Hopeful',
      email: email(),
      password: 'Password1!',
      role: 'ADMIN',
    });
    expect(admin.status).toBe(201);
    expect(admin.body.user.role).toBe('CUSTOMER');

    const first = await register();
    const duplicate = await request(app).post('/api/auth/register').send({
      fullName: 'Duplicate',
      email: first.body.user.email,
      password: 'Password1!',
      role: 'CUSTOMER',
    });
    expect(duplicate.status).toBe(409);

    const weak = await request(app).post('/api/auth/register').send({
      fullName: 'Weak Password',
      email: email(),
      password: 'password',
      role: 'CUSTOMER',
    });
    expect(weak.status).toBe(422);
    expect(weak.body.error.message).toBe('Validation failed');
    expect(weak.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'password' })]),
    );
  });

  it('logs in with the right password and rejects the wrong one', async () => {
    const registered = await register();
    const success = await request(app).post('/api/auth/login').send({
      email: registered.body.user.email,
      password: 'Password1!',
    });
    const failure = await request(app).post('/api/auth/login').send({
      email: registered.body.user.email,
      password: 'Wrongpass1',
    });
    const unknown = await request(app).post('/api/auth/login').send({
      email: email(),
      password: 'Password1!',
    });

    expect(success.status).toBe(200);
    expect(success.body.accessToken).toEqual(expect.any(String));
    expect(failure.status).toBe(401);
    expect(failure.body.error.message).toBe('Invalid email or password');
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe(failure.body.error.message);
  });

  it('rejects a suspended user', async () => {
    const registered = await register();
    await prisma.user.update({
      where: { email: registered.body.user.email },
      data: { status: 'SUSPENDED' },
    });

    const loginResponse = await request(app).post('/api/auth/login').send({
      email: registered.body.user.email,
      password: 'Password1!',
    });
    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registered.body.accessToken}`);

    expect(loginResponse.status).toBe(403);
    expect(meResponse.status).toBe(403);
  });

  it('requires a token for the current user', async () => {
    const missing = await request(app).get('/api/auth/me');
    expect(missing.status).toBe(401);

    const customer = await register();
    const customerMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${customer.body.accessToken}`);
    const missingAdmin = await request(app)
      .get('/api/admin/me')
      .set('Authorization', `Bearer ${customer.body.accessToken}`);

    expect(customerMe.status).toBe(200);
    expect(customerMe.body.user.email).toBe(customer.body.user.email);
    expect(missingAdmin.status).toBe(404);

    const garbage = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-token');
    const expiredToken = await new SignJWT({ role: 'CUSTOMER' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(customer.body.user.id)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(env.JWT_ACCESS_SECRET));
    const expired = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expiredToken}`);
    expect(garbage.status).toBe(401);
    expect(expired.status).toBe(401);
  });

  it('revokes a refresh token on logout and rotates it on refresh', async () => {
    const registered = await register();
    const refreshed = await request(app).post('/api/auth/refresh').send({
      refreshToken: registered.body.refreshToken,
    });
    const reused = await request(app).post('/api/auth/refresh').send({
      refreshToken: registered.body.refreshToken,
    });

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refreshToken).not.toBe(registered.body.refreshToken);
    expect(reused.status).toBe(401);

    const logoutResponse = await request(app).post('/api/auth/logout').send({
      refreshToken: refreshed.body.refreshToken,
    });
    const afterLogout = await request(app).post('/api/auth/refresh').send({
      refreshToken: refreshed.body.refreshToken,
    });

    expect(logoutResponse.status).toBe(204);
    expect(afterLogout.status).toBe(401);
  });
});
