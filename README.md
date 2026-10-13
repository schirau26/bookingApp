# Urban Glow Car Wash

Customers book a wash at one shop. The owner runs the bay queue and marks the invoice paid when the customer pays at the shop. The API is the source of truth for bay capacity, queue status, and invoices.

Bookings use Africa/Windhoek. A customer can review each completed wash once. Notifications stay in the app. There is no card payment and no PDF invoice.

## Applications

| App    | Path      | Stack                                            |
| ------ | --------- | ------------------------------------------------ |
| Mobile | `mobile/` | React Native, Expo, TypeScript, React Navigation |
| API    | `server/` | Node.js, Express, TypeScript                     |

```text
bookingApp/
├── mobile/     Customer and wash-owner app
├── server/     REST API
└── package.json
```

npm workspaces link `@booking/mobile` and `@booking/server`.

## Prerequisites

- Node.js 24
- npm 11
- MySQL 8 running locally

## Setup

```bash
npm install
cp server/.env.example server/.env
```

`server/.env` stays local. Only the example file is committed.

### API environment

| Variable                 | Purpose                                                    | Default                                          |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------------------ |
| `PORT`                   | HTTP port                                                  | `4000`                                           |
| `NODE_ENV`               | `development`, `test`, or `production`                     | `development`                                    |
| `CORS_ORIGINS`           | Comma-separated browser origins allowed to call the API    | `http://localhost:5173`                          |
| `DATABASE_URL`           | MySQL connection string                                    | `mysql://booking:booking@127.0.0.1:3306/booking` |
| `JWT_ACCESS_SECRET`      | Secret used to sign access tokens. At least 32 characters. | none                                             |
| `JWT_ACCESS_TTL_SECONDS` | Access token lifetime in seconds                           | `900`                                            |

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

The seed creates one owner (`joe@urbanglow.example`), one customer (`customer@example.com`), and Urban Glow Car Wash with five packages. The local password is `Password1!`.

## Database

Prisma 7 talks to MySQL through the MariaDB driver adapter. The schema lives in [server/prisma/schema.prisma](server/prisma/schema.prisma). Money is stored as `DECIMAL`, not floating point. Addresses are plain text.

Roles are `CUSTOMER` and `BUSINESS_OWNER`. Registration always creates a customer. The owner account comes from the seed.

```text
User
 ├── owns the wash (Business)
 ├── creates Bookings
 ├── writes Reviews
 └── receives Notifications

Business (one wash)
 ├── bayCount
 ├── has Services, ServicePrices, WorkingHours, Photos, Bookings, Reviews

Service (a wash package)
 └── has one ServicePrice per vehicle size

Booking
 ├── belongs to User, Business, and Service
 ├── stores vehicle size, registration, and a price snapshot
 └── may have one Review and one Invoice
```

Vehicle sizes are `HATCHBACK`, `SEDAN`, `SUV`, `BAKKIE`, and `VAN`. A booking status is `CONFIRMED`, `ARRIVED`, `WASHING`, `READY`, `COMPLETED`, `CANCELLED`, or `NO_SHOW`. A bay stays occupied for confirmed, arrived, and washing. Ready frees the bay.

Important constraints:

- `User.email` is unique.
- One working-hours row per wash per weekday.
- One price row per package and vehicle size.
- One review per booking. A later completed wash can be reviewed again.
- One invoice per booking. The number looks like `UG-2026-0042`.
- Prices use `DECIMAL(10, 2)`. Tax on an invoice is stored as `0.00`.

## Authentication

Email and password only. Anyone who registers becomes a customer. Login returns a short-lived access token and a refresh token. The refresh token is stored as a SHA-256 hash. Logout revokes it.

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

Passwords must be 8 to 72 characters and include a letter and a number. The mobile app stores tokens in the device secure store.

## The wash

`GET /api/wash` returns the shop, hours, contacts, and packages with a price and duration for each vehicle size. The owner edits hours, bay count, packages, size prices, the logo, and photos. Customers do not search a directory.

Images are stored on the API machine under `server/uploads/`, which is not committed. JPEG, PNG, and WebP files up to 5 MB are accepted.

## Bookings

Available times start at opening and step forward by the duration for the chosen package and vehicle size. A slot is closed only when the overlapping occupied bookings already equal `bayCount`. Creating a booking locks the wash row, checks the slot again, and starts as `CONFIRMED`. The booking stores the price and duration from that moment.

The customer can cancel only while the wash is confirmed. The owner moves a car from confirmed to arrived, washing, ready, and completed. Confirmed can also be cancelled or marked as a no-show.

```text
GET  /api/wash
GET  /api/wash/availability?packageId=&vehicleSize=&date=YYYY-MM-DD
POST /api/bookings
GET  /api/bookings/mine?when=upcoming|past
POST /api/bookings/:id/cancel
POST /api/bookings/:id/arrive
POST /api/bookings/:id/wash
POST /api/bookings/:id/ready
POST /api/bookings/:id/complete
POST /api/bookings/:id/no-show
GET  /api/businesses/:id/bookings
```

Upcoming washes are confirmed, arrived, washing, and ready. Past washes are completed, cancelled, and no-show.

## Invoices

Marking a wash ready creates one unpaid invoice in the same transaction and tells the customer the car is ready. The amount is copied from the booking, so a later price change does not rewrite it. A cancelled or no-show wash has no invoice. The owner marks it paid after the customer pays at the shop.

```text
GET  /api/bookings/:id/invoice
POST /api/bookings/:id/invoice/pay
```

## Reviews

A customer reviews a wash after that booking is completed. Each booking can be reviewed once. The written review is required, the rating is 1 to 5, and up to four photos can be attached. The owner can reply and can report a review. A report does not hide the review.

```text
POST   /api/reviews
PATCH  /api/reviews/:id
DELETE /api/reviews/:id
POST   /api/reviews/:id/photos
DELETE /api/reviews/:id/photos/:photoId
GET    /api/wash/reviews
GET    /api/businesses/:id/reviews
PUT    /api/reviews/:id/reply
POST   /api/reviews/:id/reports
```

## Notifications

Notifications stay in the app. Creating a booking tells the customer it is confirmed. Cancelling tells the other person. Marking the car ready tells the customer. A new review tells the owner, and a reply tells the customer. Opening the inbox adds one reminder for a confirmed booking that starts within 24 hours. Push and SMS are not sent.

```text
GET   /api/notifications
PATCH /api/notifications/:id
```

## Run

Use two terminals:

```bash
npm run dev:server
npm run dev:mobile
```

- API: http://localhost:4000/api/health returns `{ "status": "ok" }`
- Mobile: Expo prints a QR code and simulator shortcuts. Sign in as the seeded customer or as Joe, the wash owner.

## Checks

```bash
npm run lint
npm run typecheck
npm test
```

`GET /api/health` does not query MySQL. Use `npm run db:check` to confirm the database connection.
