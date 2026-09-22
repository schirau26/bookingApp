# Booking platform

Customers discover businesses, reserve services, and leave reviews. Business owners manage their listing and bookings. Administrators use a separate web dashboard.

Phase 1 sets up the three applications and proves they run. Database, authentication, and product features come in later phases.

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

MySQL is not required yet.

## Setup

```bash
npm install
cp server/.env.example server/.env
cp admin/.env.example admin/.env
```

`server/.env` and `admin/.env` stay local. Only the example files are committed.

### API environment

| Variable       | Purpose                                                 | Default                 |
| -------------- | ------------------------------------------------------- | ----------------------- |
| `PORT`         | HTTP port                                               | `4000`                  |
| `NODE_ENV`     | `development`, `test`, or `production`                  | `development`           |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API | `http://localhost:5173` |

The admin app reads `VITE_API_URL` (default `http://localhost:4000`).

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
- Phase 2 — database: not started
- Authentication, businesses, bookings, reviews, notifications, and the admin dashboard UI: not started

The API does not connect to MySQL yet. `GET /api/health` is the only route.
