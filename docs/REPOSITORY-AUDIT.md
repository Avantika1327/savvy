# Repository audit and minimum-safe tenancy plan

## Important source-repository finding

The directly uploaded `savvy(2).zip` is a Laravel/PHP application, not the React.js/Node.js/PostgreSQL repository described in the requirement. Evidence in the archive includes `artisan`, `composer.json`, Laravel `routes/web.php`, `routes/api.php`, Eloquent models, Blade templates, and PHP migrations. The PHP migrations include legacy Laravel/database conventions and cannot safely be treated as an already-running PostgreSQL/Prisma schema.

The React/Node/PostgreSQL tree in this deliverable is the migration starter created in the preceding turn. It does **not** contain a complete port of the Laravel business modules. The changes below harden the SaaS control plane and the current example `plants` module; they do not claim every existing module is already tenant-scoped.

## Existing feature inventory found in uploaded Laravel source

- Web roles and routes cover dashboard, plants, routes, drivers, customers, orders, raw materials, products, lab reports, dispensaries, request orders, maintenance, vendors, distributors, reasons and reports.
- Mobile/API surfaces include shared login and OTP flows, customer orders/products/shipping addresses, driver profile/order/maintenance and jar transportation, vendor stock/shipping actions, and distributor order/production/dispatch flows.
- Background commands generate contract orders and accept additional contracts. Public web routes currently invoke scheduler/dev operations; these must be secured/removed in a production deployment independently of the tenancy migration.
- Schema has tenant-owned business entities across many relationships: orders and contracts, plant/route/driver/customer, raw stock transactions/distributions, production, jar transportation/maintenance, distributors and their orders/inventory, lab reports and shipping records.

## Minimum architecture

1. A separate platform login and route namespace, with `platformRole=SUPER_ADMIN`; the platform identity is never treated as a tenant owner.
2. Tenant/workspace identity and membership relation separate from legacy role fields.
3. Tenant subscription lifecycle evaluated server-side on login and each protected API request.
4. Explicit payment records with a pending-first state. Only a super-admin payment-confirmation action (with a verification note) activates/renews paid access.
5. Audit entries for tenant creation, status changes, plan changes, payment creation and payment confirmation.
6. Tenant context comes from a signed principal plus an active database membership, never an arbitrary request field. Add query filters and tenant-aware relationships as each business module is migrated.
7. Database migrations are additive; backfill existing business data into a named legacy tenant before making `tenant_id` non-null.

## What is implemented in this Node starter

- Separate platform vs tenant login surfaces and API prefixes.
- Platform-only tenant creation and state management.
- Contact fields, plan and billing cycle assignment.
- One-time tenant owner creation and membership.
- Trial expiry enforcement and active subscription-period enforcement at login/API middleware.
- Payment records, pending-to-confirmed workflow, period renewal, and audit records.
- Tenant scoping plus PostgreSQL RLS on the `plants` example only.
- Unit tests for central tenant access policy.

## What remains before production cutover

- The actual React/Node repository and its database schema are required to port the existing business modules without replacing their logic. The only uploaded source archive is Laravel.
- Add `tenant_id` to all tenant-owned tables, backfill and verify ownership, add tenant-aware foreign keys/composite constraints and indexes, and apply RLS/query scopes for each table and raw query.
- Port and parity-test existing auth/OTP/Sanctum equivalents, customer/driver/distributor API contracts, order state transitions, stock transactions and all jobs/exports/PDFs. Do not turn on tenant enforcement until data backfill is validated.
- Configure the PostgreSQL application role without superuser or `BYPASSRLS`, protect the platform seed credentials, use HTTPS, test CSRF/cookie strategy in deployment, add backups/restore, and integrate a payment gateway only with verified signed callbacks.
- Add integration tests for all module-level cross-tenant read/write attempts, not only the `plants` example.

## Status definitions

- `TRIAL`: access permitted only while `trialEndsAt` is in the future and subscription status is `TRIAL`.
- `ACTIVE`: access permitted only while subscription status is `ACTIVE` and `currentPeriodEndsAt` is in the future.
- `PAYMENT_PENDING`: denied until a pending payment is explicitly verified and confirmed.
- `EXPIRED`: denied when trial/paid period expires.
- `SUSPENDED` / `INACTIVE`: denied by platform choice regardless of token lifetime.
- Payment status is independent and auditable: `PENDING`, `CONFIRMED`, `FAILED`, `REFUNDED`.
