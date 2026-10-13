import { prisma } from './prisma.js';

async function main() {
  await prisma.$queryRaw`SELECT 1`;

  const [users, businesses, services, prices, workingHours] = await Promise.all([
    prisma.user.count(),
    prisma.business.count(),
    prisma.service.count(),
    prisma.servicePrice.count(),
    prisma.businessWorkingHour.count(),
  ]);

  console.log(
    JSON.stringify({
      connected: true,
      users,
      businesses,
      services,
      prices,
      workingHours,
    }),
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Database check failed';
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
