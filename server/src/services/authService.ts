import { Prisma, type Role } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { AuthUser } from '../types/express.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import type { RegisterInput } from '../validators/auth.js';
import {
  createRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
} from './tokens.js';

const INVALID_LOGIN = 'Invalid email or password';
const INVALID_REFRESH = 'Invalid or expired refresh token';

const dummyPasswordHash = hashPassword('not-a-real-password');

type Session = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

function toAuthUser(user: {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  profileImageUrl: string | null;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: Date;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    profileImageUrl: user.profileImageUrl,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

async function issueSession(user: AuthUser): Promise<Session> {
  const { token, tokenHash } = createRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: refreshTokenExpiry(),
    },
  });

  return {
    user,
    accessToken: await signAccessToken({ userId: user.id, role: user.role }),
    refreshToken: token,
  };
}

export async function register(input: RegisterInput): Promise<Session> {
  try {
    const user = await prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        phone: input.phone ?? null,
        role: input.role,
      },
    });
    return issueSession(toAuthUser(user));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'An account with this email already exists');
    }
    throw error;
  }
}

export async function login(email: string, password: string): Promise<Session> {
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordHash = user?.passwordHash ?? (await dummyPasswordHash);
  const passwordMatches = await verifyPassword(password, passwordHash);

  if (!user || !passwordMatches) {
    throw new HttpError(401, INVALID_LOGIN);
  }
  if (user.status === 'SUSPENDED') {
    throw new HttpError(403, 'This account is suspended');
  }

  return issueSession(toAuthUser(user));
}

export async function refreshSession(refreshToken: string): Promise<Session> {
  const tokenHash = hashRefreshToken(refreshToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existing || existing.revokedAt || existing.expiresAt <= new Date()) {
    throw new HttpError(401, INVALID_REFRESH);
  }
  if (existing.user.status === 'SUSPENDED') {
    throw new HttpError(403, 'This account is suspended');
  }

  const next = createRefreshToken();
  const rotated = await prisma.refreshToken.updateMany({
    where: { id: existing.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (rotated.count !== 1) {
    throw new HttpError(401, INVALID_REFRESH);
  }

  await prisma.refreshToken.create({
    data: {
      userId: existing.userId,
      tokenHash: next.tokenHash,
      expiresAt: refreshTokenExpiry(),
    },
  });

  return {
    user: toAuthUser(existing.user),
    accessToken: await signAccessToken({
      userId: existing.user.id,
      role: existing.user.role,
    }),
    refreshToken: next.token,
  };
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getAuthUser(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? toAuthUser(user) : null;
}
