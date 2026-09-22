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

| Variable                 | Purpose                                                    | Default                                          |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------------------ |
| `PORT`                   | HTTP port                                                  | `4000`                                           |
| `NODE_ENV`               | `development`, `test`, or `production`                     | `development`                                    |
| `CORS_ORIGINS`           | Comma-separated browser origins allowed to call the API    | `http://localhost:5173`                          |
| `DATABASE_URL`           | MySQL connection string                                    | `mysql://booking:booking@127.0.0.1:3306/booking` |
| `JWT_ACCESS_SECRET`      | Secret used to sign access tokens. At least 32 characters. | none                                             |
| `JWT_ACCESS_TTL_SECONDS` | Access token lifetime in seconds                           | `900`                                            |

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

## Authentication

Email and password only. Customers and business owners can register. Administrator accounts are created in the database, not through registration. The seeded admin is `admin@example.com`.

Login returns a short-lived access token and a refresh token. The refresh token is stored as a SHA-256 hash. Logout revokes it. `GET /api/auth/me` requires a signed-in user. `GET /api/admin/me` requires an administrator. A suspended account cannot sign in, and an existing access token is rejected after the account is suspended.

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
GET  /api/admin/me
```

Passwords must be 8 to 72 characters and include a letter and a number. The mobile app stores tokens in the device secure store. The admin app keeps them in `sessionStorage` for the browser tab.

## Businesses

Customers can search approved businesses by name or active service name, and filter by category, address text, minimum rating, maximum price, and a weekday the business is open. Choosing a bookable time is part of booking, not this search.

Business owners create and edit their own listings, services, prices, durations, weekly hours, logo, and gallery. A new business stays pending. Editing an approved business does not send it back for review. Inactive services are hidden from customers.

Administrators approve, reject (with a reason), or suspend a business from the admin site. Pending, rejected, and suspended businesses are not public. An owner can still open their own listing.

Images are stored on the API machine under `server/uploads/`, which is not committed. The database stores the public path, such as `/uploads/logos/...`. JPEG, PNG, and WebP files up to 5 MB are accepted.

## Bookings

All businesses use Africa/Windhoek time. Available times start at opening and step forward by the service duration. A slot must finish by closing time, and any booking that is not cancelled blocks overlapping times.

Creating a booking locks the business row and checks the slot again, so two customers cannot reserve the same time. The booking stores the price and duration from that moment and starts as pending. The customer can cancel a pending or confirmed booking. The owner can confirm it, complete it, mark it as a no-show, or cancel it.

```text
GET  /api/businesses/:businessId/services/:serviceId/availability?date=YYYY-MM-DD
POST /api/bookings
GET  /api/bookings/mine?when=upcoming|past
POST /api/bookings/:id/cancel
POST /api/bookings/:id/confirm
POST /api/bookings/:id/complete
POST /api/bookings/:id/no-show
GET  /api/businesses/:id/bookings
```

## Reviews

A customer can review a business after one of their bookings there is completed. Each customer has one review per business. Editing replaces that review, and deleting it allows a later booking to be reviewed. The written review is required, the rating is 1 to 5, and up to four photos can be attached. Creating, editing, or deleting a review recalculates that business’s average rating and review count.

The business owner can reply once (a new reply replaces the old one) and can report a review. A report stays open until an administrator dismisses it or marks it resolved. Reporting does not hide the review. An administrator can also delete a review, which updates the cached rating.

```text
POST   /api/reviews
PATCH  /api/reviews/:id
DELETE /api/reviews/:id
POST   /api/reviews/:id/photos
DELETE /api/reviews/:id/photos/:photoId
GET    /api/businesses/:id/reviews
PUT    /api/reviews/:id/reply
POST   /api/reviews/:id/reports
GET    /api/admin/reviews
DELETE /api/admin/reviews/:id
GET    /api/admin/review-reports?status=
POST   /api/admin/review-reports/:id/dismiss
POST   /api/admin/review-reports/:id/resolve
```

```text
GET  /api/categories
GET  /api/businesses
GET  /api/businesses/:id
GET  /api/businesses/:id/services
GET  /api/businesses/mine
POST /api/businesses
PUT  /api/businesses/:id/hours
GET  /api/admin/businesses
POST /api/admin/businesses/:id/approve
POST /api/admin/businesses/:id/reject
POST /api/admin/businesses/:id/suspend
```

## Run

Use three terminals:

```bash
npm run dev:server
npm run dev:admin
npm run dev:mobile
```

- API: http://localhost:4000/api/health returns `{ "status": "ok" }`
- Admin: http://localhost:5173 shows that health status
- Mobile: Expo prints a QR code and simulator shortcuts. Customers browse approved businesses. Owners manage their own.

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
- Phase 3 — authentication: complete
- Phase 4 — business management: complete
- Phase 5 — booking system: complete
- Phase 6 — reviews: complete
- Notifications and the rest of the admin dashboard: not started

`GET /api/health` does not query MySQL. Use `npm run db:check` to confirm the database connection.
