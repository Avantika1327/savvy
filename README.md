# Savvy — React + Node.js SaaS tenancy foundation

This package contains a React/TypeScript web starter, an Express/TypeScript API, PostgreSQL/Prisma schema, and an initial parent-admin control plane for selling Savvy to multiple businesses.

## Read this first

The directly uploaded `savvy(2).zip` is a Laravel/PHP project (routes, Eloquent models, Blade UI and Laravel migrations). It is not the complete React/Node/PostgreSQL source repository described in the requirement. This package continues the React/Node starter created earlier; it does **not** claim that every original Laravel business module was migrated. See `docs/REPOSITORY-AUDIT.md` and `docs/ROUTE-MIGRATION-MAP.md`.

## Current stack

- React + TypeScript + Vite for the web UI
- Node.js + Express + TypeScript for the API
- PostgreSQL + Prisma
- BCrypt password hashing, JWT auth claims, HTTP-only platform/web cookie, login rate limiting, Helmet/CORS and request validation

## Current routes

- Platform UI: `/platform/login`; API login: `POST /api/web/v1/platform-auth/login`
- Tenant web login: `POST /api/web/v1/auth/login` with `tenantSlug`, `email`, `password`
- Mobile login adapter: `POST /api/app/v1/auth/login` (must be replaced/adapted to the original OTP flow before production)
- Platform tenant CRUD/lifecycle, subscription settings, payment history/confirmation, and audit log under `/api/web/v1/platform/tenants/*`
- Tenant-isolated example module: `GET/POST /api/web/v1/plants`
- Health: `/health` and `/health/db`

## Install

1. Create a PostgreSQL database named `savvy`.
2. In `apps/api`, copy `.env.example` to `.env` and set strong unique secrets.
3. Install API dependencies, run `npm run db:generate`, run `npm run db:validate`, and review/apply `npm run db:migrate` against a backup or disposable database.
4. Configure `SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` in `.env`; run `npm run db:seed` to seed the first platform admin. Never keep sample passwords.
5. Install web dependencies in `apps/web`, copy `.env.example` to `.env`, and set `VITE_API_URL` if API isn't on `http://localhost:4000`.
6. Run API `npm run dev` and web `npm run dev` in separate terminals.

## Payment/access behavior

- A tenant with `trialDays > 0` gets a time-limited trial; set `trialDays=0` to require payment before access.
- A recorded payment is always `PENDING`. A platform super admin must independently verify receipt and add a verification note to confirm it.
- Confirmation renews the subscription by its monthly/annual cycle and activates the tenant within a transaction.
- Every protected tenant request re-checks membership, tenant state and subscription expiry; suspending a tenant takes effect immediately.
- Plan assignment alone does not activate access.

## Tests and limitation

`npm test` in `apps/api` runs central status policy tests. A full install/build and database migration were not executable in this environment. Before production, run `npm run db:validate`, `npm run db:generate`, `npm run typecheck`, `npm test`, and the migrations against a disposable PostgreSQL instance.

## Before production cutover

The current RLS/query scoping sample only covers `plants`. All tenant-owned order, contract, vendor, distributor, driver, raw stock, production, maintenance, report, shipping, export and scheduled-job flows require schema backfill, tenant-aware relations and tests. Do not direct production traffic to this starter until those modules are migrated and parity-tested.
