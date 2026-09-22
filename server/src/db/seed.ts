import {
  BusinessApprovalStatus,
  DayOfWeek,
  Role,
  type DayOfWeek as DayOfWeekValue,
} from '../generated/prisma/client.js';
import { hashPassword } from '../utils/password.js';
import { prisma } from './prisma.js';

/** Local seed password only. Not a production credential. */
const SEED_PASSWORD = 'Password1!';

type OpenDay = { isClosed: false; openTime: string; closeTime: string };
type ClosedDay = { isClosed: true };
type DayHours = OpenDay | ClosedDay;

const categories = [
  {
    id: 'seed_category_beauty',
    name: 'Beauty & Wellness',
    slug: 'beauty-wellness',
    description: 'Salons, spas, and personal care.',
  },
  {
    id: 'seed_category_restaurants',
    name: 'Restaurants',
    slug: 'restaurants',
    description: 'Dining reservations and table bookings.',
  },
  {
    id: 'seed_category_automotive',
    name: 'Automotive',
    slug: 'automotive',
    description: 'Workshops, washes, and vehicle services.',
  },
  {
    id: 'seed_category_professional',
    name: 'Professional Services',
    slug: 'professional-services',
    description: 'Consultations and office appointments.',
  },
  {
    id: 'seed_category_fitness',
    name: 'Fitness',
    slug: 'fitness',
    description: 'Training sessions and studio classes.',
  },
  {
    id: 'seed_category_education',
    name: 'Education',
    slug: 'education',
    description: 'Lessons, tutoring, and courses.',
  },
  {
    id: 'seed_category_photography',
    name: 'Photography',
    slug: 'photography',
    description: 'Photo sessions and studio bookings.',
  },
  {
    id: 'seed_category_home',
    name: 'Home Services',
    slug: 'home-services',
    description: 'Repairs and home visits.',
  },
  {
    id: 'seed_category_healthcare',
    name: 'Healthcare',
    slug: 'healthcare',
    description: 'Clinics and wellness appointments.',
  },
] as const;

function closed(): ClosedDay {
  return { isClosed: true };
}

function open(openTime: string, closeTime: string): OpenDay {
  return { isClosed: false, openTime, closeTime };
}

const salonHours: Record<DayOfWeekValue, DayHours> = {
  MONDAY: open('08:00', '17:00'),
  TUESDAY: open('08:00', '17:00'),
  WEDNESDAY: closed(),
  THURSDAY: open('08:00', '17:00'),
  FRIDAY: open('08:00', '17:00'),
  SATURDAY: open('09:00', '14:00'),
  SUNDAY: closed(),
};

const workshopHours: Record<DayOfWeekValue, DayHours> = {
  MONDAY: open('08:00', '17:00'),
  TUESDAY: open('08:00', '17:00'),
  WEDNESDAY: open('08:00', '17:00'),
  THURSDAY: open('08:00', '17:00'),
  FRIDAY: open('08:00', '17:00'),
  SATURDAY: open('08:00', '12:00'),
  SUNDAY: closed(),
};

const studioHours: Record<DayOfWeekValue, DayHours> = {
  MONDAY: closed(),
  TUESDAY: open('09:00', '16:00'),
  WEDNESDAY: open('09:00', '16:00'),
  THURSDAY: open('09:00', '16:00'),
  FRIDAY: open('09:00', '16:00'),
  SATURDAY: open('09:00', '16:00'),
  SUNDAY: closed(),
};

const gymHours: Record<DayOfWeekValue, DayHours> = {
  MONDAY: open('06:00', '20:00'),
  TUESDAY: open('06:00', '20:00'),
  WEDNESDAY: open('06:00', '20:00'),
  THURSDAY: open('06:00', '20:00'),
  FRIDAY: open('06:00', '20:00'),
  SATURDAY: open('07:00', '12:00'),
  SUNDAY: closed(),
};

async function upsertHours(businessId: string, schedule: Record<DayOfWeekValue, DayHours>) {
  for (const dayOfWeek of Object.values(DayOfWeek)) {
    const day = schedule[dayOfWeek];
    const times = day.isClosed
      ? { openTime: null, closeTime: null }
      : { openTime: day.openTime, closeTime: day.closeTime };

    await prisma.businessWorkingHour.upsert({
      where: {
        businessId_dayOfWeek: { businessId, dayOfWeek },
      },
      update: { isClosed: day.isClosed, ...times },
      create: {
        businessId,
        dayOfWeek,
        isClosed: day.isClosed,
        ...times,
      },
    });
  }
}

async function main() {
  const passwordHash = await hashPassword(SEED_PASSWORD);

  const users = [
    {
      id: 'seed_user_admin',
      email: 'admin@example.com',
      fullName: 'Amara Shikongo',
      phone: '+264811100001',
      role: Role.ADMIN,
    },
    {
      id: 'seed_user_selma',
      email: 'selma@example.com',
      fullName: 'Selma Iipinge',
      phone: '+264811100002',
      role: Role.BUSINESS_OWNER,
    },
    {
      id: 'seed_user_petrus',
      email: 'petrus@example.com',
      fullName: 'Petrus Nghidinwa',
      phone: '+264811100003',
      role: Role.BUSINESS_OWNER,
    },
    {
      id: 'seed_user_aya',
      email: 'aya@example.com',
      fullName: 'Aya Nakale',
      phone: '+264811100004',
      role: Role.CUSTOMER,
    },
    {
      id: 'seed_user_jonas',
      email: 'jonas@example.com',
      fullName: 'Jonas Haufiku',
      phone: '+264811100005',
      role: Role.CUSTOMER,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { ...user, passwordHash },
      create: { ...user, passwordHash },
    });
  }

  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: category,
      create: category,
    });
  }

  const businesses = [
    {
      id: 'seed_business_abc_salon',
      ownerId: 'seed_user_selma',
      categoryId: 'seed_category_beauty',
      name: 'ABC Salon',
      description: 'A Windhoek salon for cuts, color, and braiding.',
      address: '12 Independence Avenue, Windhoek',
      phone: '+264612000101',
      email: 'hello@abcsalon.example',
      approvalStatus: BusinessApprovalStatus.APPROVED,
      rejectionReason: null,
      hours: salonHours,
      services: [
        {
          id: 'seed_service_haircut',
          name: 'Haircut',
          description: 'Cut and finish.',
          price: '100.00',
          durationMinutes: 30,
          isActive: true,
        },
        {
          id: 'seed_service_color',
          name: 'Hair Coloring',
          description: 'Full color application.',
          price: '350.00',
          durationMinutes: 90,
          isActive: true,
        },
        {
          id: 'seed_service_braiding',
          name: 'Braiding',
          description: 'Braided style.',
          price: '250.00',
          durationMinutes: 120,
          isActive: true,
        },
        {
          id: 'seed_service_fringe',
          name: 'Fringe trim',
          description: 'Short trim. Not currently bookable.',
          price: '80.00',
          durationMinutes: 20,
          isActive: false,
        },
      ],
    },
    {
      id: 'seed_business_auto_care',
      ownerId: 'seed_user_petrus',
      categoryId: 'seed_category_automotive',
      name: 'Windhoek Auto Care',
      description: 'Workshop appointments for servicing and inspections.',
      address: '48 Mandume Ndemufayo Avenue, Windhoek',
      phone: '+264612000202',
      email: 'bookings@autocare.example',
      approvalStatus: BusinessApprovalStatus.PENDING,
      rejectionReason: null,
      hours: workshopHours,
      services: [
        {
          id: 'seed_service_oil',
          name: 'Oil change',
          description: 'Engine oil and filter replacement.',
          price: '450.00',
          durationMinutes: 45,
          isActive: true,
        },
        {
          id: 'seed_service_brakes',
          name: 'Brake inspection',
          description: 'Inspection of pads, discs, and fluid.',
          price: '300.00',
          durationMinutes: 60,
          isActive: true,
        },
      ],
    },
    {
      id: 'seed_business_desert_frame',
      ownerId: 'seed_user_petrus',
      categoryId: 'seed_category_photography',
      name: 'Desert Frame Photography',
      description: 'Portrait sessions booked by the hour.',
      address: '5 Sam Nujoma Drive, Windhoek',
      phone: '+264812000303',
      email: 'studio@desertframe.example',
      approvalStatus: BusinessApprovalStatus.REJECTED,
      rejectionReason: 'Add a phone number customers can call during business hours.',
      hours: studioHours,
      services: [
        {
          id: 'seed_service_portrait',
          name: 'Portrait session',
          description: 'One-hour studio portrait session.',
          price: '800.00',
          durationMinutes: 60,
          isActive: true,
        },
      ],
    },
    {
      id: 'seed_business_khomas_fitness',
      ownerId: 'seed_user_selma',
      categoryId: 'seed_category_fitness',
      name: 'Khomas Fitness',
      description: 'Personal training by appointment.',
      address: '90 Robert Mugabe Avenue, Windhoek',
      phone: '+264612000404',
      email: 'hello@khomasfitness.example',
      approvalStatus: BusinessApprovalStatus.SUSPENDED,
      rejectionReason: null,
      hours: gymHours,
      services: [
        {
          id: 'seed_service_training',
          name: 'Personal training',
          description: 'One-on-one training session.',
          price: '250.00',
          durationMinutes: 60,
          isActive: true,
        },
      ],
    },
  ];

  for (const business of businesses) {
    const { hours, services, ...data } = business;

    await prisma.business.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });

    for (const service of services) {
      await prisma.service.upsert({
        where: { id: service.id },
        update: { ...service, businessId: data.id },
        create: { ...service, businessId: data.id },
      });
    }

    await upsertHours(data.id, hours);
  }
}

main()
  .then(() => {
    console.log('Seed complete. Local password for every seed account: Password1!');
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Seed failed';
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
