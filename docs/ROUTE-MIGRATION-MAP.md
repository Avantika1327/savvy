# Source route inventory and migration map

Derived from `routes/web.php` and `routes/api.php` in the supplied Laravel archive.

## Web/admin surface → `/api/web/v1`

- Overview: pending orders and yesterday-pending-order data
- Plants
- Routes and route assignment
- Drivers and driver assignment
- Customers, shipping addresses, route assignment, contracts and expiry
- Orders and order actions
- Raw materials stock, distribution and purchase distribution
- Products
- Lab reports
- Dispensary
- Request orders and status updates
- Maintenance and status updates
- Vendors
- Distributors
- Reasons/settings
- Reports/export
- Digital-card ZIP/download support
- Scheduled order generation and auto-accept additional contracts must become protected background jobs/CLI jobs, not public GET endpoints.

## Mobile/app surface → `/api/app/v1`

- Authentication: send OTP, verify OTP, login, verify account, reset password, app versions, logout, password update, delete account
- Common app data: plants, routes by plant, drivers by route, shipping address, reasons, digital card, order requests, raw stock, stock list, labels, jar maintenance
- Stock actions: accept stock, deduct jar quantity, production, scrap jar
- Driver: profile, order update, maintenance, jar transportation lists/details
- Customer: orders, products, shipping addresses, additional orders, in-progress requests, accept/cancel/additional-order actions
- Distributor: order summary, accept, plant-wise summary, order CRUD, production/dispatch/action workflows

## Shared domain modules

Plants, Customers, Orders, Stock, Production, Maintenance, Distributors, Drivers, Vendors, Contracts. Sharing domain services does not mean sharing web/app routes or authorization.

## Porting sequence

1. Freeze source behavior and document roles/permissions.
2. Inspect each controller/model/migration and list validations, status transitions, side effects and calculations.
3. Implement schema/repository/service/controller for one workflow.
4. Port web and app adapters independently.
5. Add parity tests against representative old-system cases.
6. Verify transactions, scheduled jobs, exports, PDFs, notifications and soft deletes.
7. Run UAT before switching production traffic.

## Known work not yet migrated

The supplied archive contains Laravel-specific Eloquent models, auth guards/Sanctum, Blade templates, exports, PDF generation, scheduler commands, and many domain controllers. This starter does not silently replace these with fake CRUD endpoints; each requires an explicit port and parity tests.

## PostgreSQL target

PostgreSQL is the chosen target database and Prisma is the API ORM. The starter currently models only `plants` and `users` as an initial slice. Port all other migrations, relationships, indexes, enum/status semantics, soft deletes and transaction behavior before considering the database migration complete. Existing MySQL/MariaDB SQL must be reviewed for PostgreSQL compatibility.
