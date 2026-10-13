import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../middleware/errorHandler.js';

type WashDb = Prisma.TransactionClient | typeof prisma;

let testWashId: string | null = null;

/** Tests point booking at the wash they created. Production uses the only wash row. */
export function useTestWash(id: string | null) {
  testWashId = id;
}

export async function requireWash(db: WashDb = prisma) {
  if (testWashId) {
    const wash = await db.business.findUnique({ where: { id: testWashId } });
    if (!wash) throw new HttpError(404, 'Wash not found');
    return wash;
  }

  const rows = await db.business.findMany({
    orderBy: { createdAt: 'asc' },
    take: 2,
  });
  if (rows.length !== 1) throw new HttpError(404, 'Wash not found');
  return rows[0];
}
