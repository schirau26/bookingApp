# Booking platform

Customers discover businesses, reserve services, and leave reviews. Business owners manage their listing and bookings. Administrators use a separate web dashboard.

Phase 1 sets up the three applications. Phase 2 adds the MySQL schema. Authentication and product features come in later phases.

## Applications

| App    | Path      | Stack                                            |
| ------ | --------- | ------------------------------------------------ |
| Mobile | `mobile/` | React Native, Expo, TypeScript, React Navigation |
| API    | `server/` | Node.js, Express, TypeScript                     |
| Admin  | `admin/`  | React, Vite, TypeScript                          |

```text
bookingApp/
├── mobile/     Customer and business-owner app
├── server/     REST API
├── admin/      Admin dashboard
└── package.json
```

npm workspaces link the three packages: `@booking/mobile`, `@booking/server`, and `@booking/admin`.

## Prerequisites

- Node.js 24
- npm 11
- MySQL 8 running locally

## Setup

```bash
npm install
cp server/.env.example server/.env
cp admin/.env.example admin/.env
```

`server/.env` and `admin/.env` stay local. Only the example files are committed.

### API environment

| Variable       | Purpose                                                 | Default                                          |
| -------------- | ------------------------------------------------------- | ------------------------------------------------ |
| `PORT`         | HTTP port                                               | `4000`                                           |
| `NODE_ENV`     | `development`, `test`, or `production`                  | `development`                                    |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API | `http://localhost:5173`                          |
| `DATABASE_URL` | MySQL connection string                                 | `mysql://booking:booking@127.0.0.1:3306/booking` |

The admin app reads `VITE_API_URL` (default `http://localhost:4000`).

The example database user is for local development. Do not reuse that password in production.

Create the local database once, as a MySQL administrator:

```sql
CREATE DATABASE IF NOT EXISTS booking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'booking'@'localhost' IDENTIFIED BY 'booking';
GRANT ALL PRIVILEGES ON booking.* TO 'booking'@'localhost';
FLUSH PRIVILEGES;
```

Then apply the schema and seed data:

```bash
npm run db:generate
npm run db:deploy
npm run db:seed
npm run db:check
```

`db:deploy` applies the migrations already in `server/prisma/migrations`. Use `npm run db:migrate` later, while changing the schema. That command needs permission to create a shadow database.

## Database

Prisma 7 talks to MySQL through the MariaDB driver adapter. The schema lives in [server/prisma/schema.prisma](server/prisma/schema.prisma). Money is stored as `DECIMAL`, not floating point. Addresses are plain text. There are no coordinates.

Roles are an enum on `User` (`CUSTOMER`, `BUSINESS_OWNER`, `ADMIN`). They are fixed in V1, so there is no separate role table. A business has one shared weekly calendar. Staff tables are not part of this schema.

```text
User
 ├── owns Businesses
 ├── creates Bookings
 ├── writes Reviews
 ├── files ReviewReports
 └── receives Notifications

Category
 └── has Businesses

Business
 ├── belongs to Category
 ├── belongs to User (owner)
 ├── has Services, WorkingHours, Photos, Bookings, Reviews

Service
 ├── belongs to Business
 └── has Bookings

Booking
 ├── belongs to User, Business, and Service
 └── may have one Review

Review
 ├── belongs to User, Business, and Booking
 ├── has ReviewPhotos
 ├── has ReviewReports
 └── may have one owner reply (replyBody, repliedAt)
```

Important constraints:

- `User.email` is unique.
- `Category.name` and `Category.slug` are unique. Owners pick an existing category.
- One working-hours row per business per weekday (`businessId`, `dayOfWeek`).
- One review per customer per business (`userId`, `businessId`). `bookingId` is also unique, so a booking is reviewed at most once.
- One report per user per review (`reviewId`, `reporterId`). Reporting a review does not delete it.
- Prices use `DECIMAL(10, 2)`. Ratings cached on a business use `DECIMAL(3, 2)`.
- Deleting a user, business, service, or booking is restricted when other rows still reference it. Photos and working hours are removed with their business. Notifications are removed with their user.

MySQL cannot add an exclusion constraint for overlapping booking times. Bookings are indexed by `(businessId, startsAt)` and `(customerId, startsAt)`. Phase 5 must lock the business row and recheck overlaps inside a transaction before inserting.

Indexes used for later queries include approval status plus category, service active flag, review date, notification inbox (`userId`, `isRead`, `createdAt`), and user role and status.

Seed data creates the nine categories, five example.com users, and four Windhoek businesses (approved, pending, rejected, and suspended) with services and weekly hours. Every seed account uses the local password `Password1!`. Bookings and reviews are not seeded.

## Run

Use three terminals:

```bash
npm run dev:server
npm run dev:admin
npm run dev:mobile
```

- API: http://localhost:4000/api/health returns `{ "status": "ok" }`
- Admin: http://localhost:5173 shows that health status
- Mobile: Expo prints a QR code and simulator shortcuts. The first screen is a welcome placeholder.

## Checks

```bash
npm run lint
npm run typecheck
npm test
```

Linting uses ESLint for the API and the Expo app, and Oxlint for the admin app (the current Vite React TypeScript template).

## Phase status

- Phase 1 — project setup: complete
- Phase 2 — database: complete
- Authentication, businesses, bookings, reviews, notifications, and the admin dashboard UI: not started

`GET /api/health` does not query MySQL. Use `npm run db:check` to confirm the database connection.
