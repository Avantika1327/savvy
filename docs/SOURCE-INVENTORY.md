# Source inventory

The input archive is a Laravel 10 application with:

- `routes/web.php` and `routes/api.php`
- Web controllers for plants, products, customers, drivers, orders, routes, maintenance, request orders, dispensaries, vendors, reasons, raw materials stock, reports, lab reports and distributors
- API controllers for auth, orders, driver, customer, stock/production and distributor flows
- Eloquent models and database migrations, including raw stock, plant production, jar transportation/maintenance, distributor orders/production/dispatch/inventory, lab reports and contract/order workflows
- Blade UI, email/PDF views, Excel exports, scheduled commands

The React UI included here is a refreshed dashboard shell with responsive navigation, metrics, plant status, recent orders and search. Dashboard figures are illustrative UI placeholders and must be connected to real API data before use.

## PostgreSQL configuration status

The API uses Prisma configured for PostgreSQL via `DATABASE_URL`. The starter maps `plants` and `users` as the first schema slice and exposes `/health/db` for a connection check. All remaining Laravel entities and relationships still need a deliberate schema migration and parity validation; do not point an initial Prisma migration at an existing production database.
