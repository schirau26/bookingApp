import type { Role, UserStatus } from '../generated/prisma/client.js';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  profileImageUrl: string | null;
  role: Role;
  status: UserStatus;
  createdAt: Date;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}
