import { DayOfWeek, Role, VehicleSize } from '../generated/prisma/client.js';
import { hashPassword } from '../utils/password.js';
import { prisma } from './prisma.js';

/** Local seed password only. Not a production credential. */
const SEED_PASSWORD = 'Password1!';

const WASH_ID = 'seed_wash_urban_glow';
const OWNER_ID = 'seed_user_owner';
const CUSTOMER_ID = 'seed_user_customer';

const weekdays: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const sizes: VehicleSize[] = ['HATCHBACK', 'SEDAN', 'SUV', 'BAKKIE', 'VAN'];

type PackageSeed = {
  id: string;
  name: string;
  description: string;
  icon: string;
  prices: Record<VehicleSize, { price: string; durationMinutes: number }>;
};

const packages: PackageSeed[] = [
  {
    id: 'seed_package_exterior',
    name: 'Exterior Wash',
    description: 'A rinse, soap, and dry of the outside of the car.',
    icon: 'car-sport-outline',
    prices: {
      HATCHBACK: { price: '80.00', durationMinutes: 30 },
      SEDAN: { price: '100.00', durationMinutes: 30 },
      SUV: { price: '140.00', durationMinutes: 40 },
      BAKKIE: { price: '150.00', durationMinutes: 45 },
      VAN: { price: '180.00', durationMinutes: 50 },
    },
  },
  {
    id: 'seed_package_interior',
    name: 'Interior Cleaning',
    description: 'Vacuum, wipe-down, and a clean of the cabin.',
    icon: 'sparkles-outline',
    prices: {
      HATCHBACK: { price: '90.00', durationMinutes: 40 },
      SEDAN: { price: '110.00', durationMinutes: 40 },
      SUV: { price: '150.00', durationMinutes: 50 },
      BAKKIE: { price: '140.00', durationMinutes: 45 },
      VAN: { price: '190.00', durationMinutes: 60 },
    },
  },
  {
    id: 'seed_package_polish',
    name: 'Polish & Wax',
    description: 'Polish the paint and finish with a protective wax.',
    icon: 'color-wand-outline',
    prices: {
      HATCHBACK: { price: '180.00', durationMinutes: 60 },
      SEDAN: { price: '220.00', durationMinutes: 70 },
      SUV: { price: '280.00', durationMinutes: 90 },
      BAKKIE: { price: '260.00', durationMinutes: 80 },
      VAN: { price: '320.00', durationMinutes: 100 },
    },
  },
  {
    id: 'seed_package_wheels',
    name: 'Wheel & Tyre Cleaning',
    description: 'Clean the wheels, arches, and tyres.',
    icon: 'ellipse-outline',
    prices: {
      HATCHBACK: { price: '50.00', durationMinutes: 20 },
      SEDAN: { price: '60.00', durationMinutes: 20 },
      SUV: { price: '80.00', durationMinutes: 25 },
      BAKKIE: { price: '80.00', durationMinutes: 25 },
      VAN: { price: '90.00', durationMinutes: 30 },
    },
  },
  {
    id: 'seed_package_protect',
    name: 'Protect & Maintain',
    description: 'A protective finish to keep the wash lasting longer.',
    icon: 'shield-checkmark-outline',
    prices: {
      HATCHBACK: { price: '120.00', durationMinutes: 40 },
      SEDAN: { price: '140.00', durationMinutes: 45 },
      SUV: { price: '180.00', durationMinutes: 55 },
      BAKKIE: { price: '170.00', durationMinutes: 50 },
      VAN: { price: '210.00', durationMinutes: 60 },
    },
  },
];

async function main() {
  const passwordHash = await hashPassword(SEED_PASSWORD);

  await prisma.user.upsert({
    where: { id: OWNER_ID },
    update: {
      email: 'joe@urbanglow.example',
      fullName: 'Joe',
      phone: '0817310735',
      role: Role.BUSINESS_OWNER,
      passwordHash,
    },
    create: {
      id: OWNER_ID,
      email: 'joe@urbanglow.example',
      fullName: 'Joe',
      phone: '0817310735',
      role: Role.BUSINESS_OWNER,
      passwordHash,
    },
  });

  await prisma.user.upsert({
    where: { id: CUSTOMER_ID },
    update: {
      email: 'customer@example.com',
      fullName: 'Aina Customer',
      phone: '0810000000',
      role: Role.CUSTOMER,
      passwordHash,
    },
    create: {
      id: CUSTOMER_ID,
      email: 'customer@example.com',
      fullName: 'Aina Customer',
      phone: '0810000000',
      role: Role.CUSTOMER,
      passwordHash,
    },
  });

  const others = await prisma.business.findMany({
    where: { id: { not: WASH_ID } },
    select: { id: true },
  });
  if (others.length > 0) {
    const ids = others.map((business) => business.id);
    await prisma.review.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.invoice.deleteMany({ where: { booking: { businessId: { in: ids } } } });
    await prisma.notification.deleteMany({ where: { booking: { businessId: { in: ids } } } });
    await prisma.booking.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.service.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.businessPhoto.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.businessWorkingHour.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.business.deleteMany({ where: { id: { in: ids } } });
  }

  await prisma.business.upsert({
    where: { id: WASH_ID },
    update: {
      ownerId: OWNER_ID,
      name: 'Urban Glow Car Wash',
      description: 'Clean car. Great impression. We clean, you shine.',
      address: 'Windhoek',
      phone: '0817310735',
      phoneContactName: 'Joe',
      secondaryContactName: 'Shake',
      secondaryPhone: '0811285713',
      email: 'hello@urbanglow.example',
      bayCount: 3,
    },
    create: {
      id: WASH_ID,
      ownerId: OWNER_ID,
      name: 'Urban Glow Car Wash',
      description: 'Clean car. Great impression. We clean, you shine.',
      address: 'Windhoek',
      phone: '0817310735',
      phoneContactName: 'Joe',
      secondaryContactName: 'Shake',
      secondaryPhone: '0811285713',
      email: 'hello@urbanglow.example',
      bayCount: 3,
    },
  });

  for (const dayOfWeek of weekdays) {
    const closed = dayOfWeek === 'SUNDAY';
    await prisma.businessWorkingHour.upsert({
      where: { businessId_dayOfWeek: { businessId: WASH_ID, dayOfWeek } },
      update: {
        isClosed: closed,
        openTime: closed ? null : '08:00',
        closeTime: closed ? null : '18:00',
      },
      create: {
        businessId: WASH_ID,
        dayOfWeek,
        isClosed: closed,
        openTime: closed ? null : '08:00',
        closeTime: closed ? null : '18:00',
      },
    });
  }

  for (const item of packages) {
    await prisma.service.upsert({
      where: { id: item.id },
      update: {
        businessId: WASH_ID,
        name: item.name,
        description: item.description,
        icon: item.icon,
        isActive: true,
      },
      create: {
        id: item.id,
        businessId: WASH_ID,
        name: item.name,
        description: item.description,
        icon: item.icon,
        isActive: true,
      },
    });
    for (const vehicleSize of sizes) {
      const price = item.prices[vehicleSize];
      await prisma.servicePrice.upsert({
        where: { serviceId_vehicleSize: { serviceId: item.id, vehicleSize } },
        update: price,
        create: { serviceId: item.id, vehicleSize, ...price },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
