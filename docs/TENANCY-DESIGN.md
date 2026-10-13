# Savvy SaaS tenancy and authorization design

## Auth surfaces

- Platform owner signs in at `/api/web/v1/platform-auth/login` and receives a `surface=platform` token/cookie. Platform tenant/payment routes require that surface plus `platformRole=SUPER_ADMIN`.
- Tenant web users sign in at `/api/web/v1/auth/login` with `tenantSlug`, email and password. Tenant role comes from active `TenantMembership`.
- Mobile app auth stays under `/api/app/v1/auth/*`; its DTOs and OTP/version/login requirements are kept separate. The starter's password adapter is transitional and is not a completed port of the uploaded Laravel OTP flow.

## Status policy

- `TRIAL`: tenant and subscription must both be trial and `trialEndsAt` must be in the future.
- `ACTIVE`: tenant and subscription must both be active and `currentPeriodEndsAt` must be in the future.
- `PAYMENT_PENDING`, `EXPIRED`, `INACTIVE`, `SUSPENDED`, `PAST_DUE`, `CANCELLED`: no tenant access.
- A tenant created with `trialDays=0` starts as payment pending. A successful manual verification requires a verification note and creates a timestamped, attributed audit record.
- Assigning a plan does not activate access. A pending payment doesn't activate access. Payment confirmation updates payment, subscription period, tenant state and audit trail in one database transaction.

## Tenant isolation contract

1. Tenant ID comes from signed auth claims and a fresh database membership, not request body/query/path fields.
2. Every tenant-owned row must have non-null `tenant_id`, indexes, and tenant-aware foreign keys/composite constraints.
3. Reads, writes, exports, reports, background jobs and raw SQL must be scoped to the same tenant.
4. The sample `plants` routes use explicit `tenantId` filters plus transaction-local `app.tenant_id` and PostgreSQL RLS.
5. Use a PostgreSQL application role with no superuser or `BYPASSRLS`. RLS supplements—not replaces—service/repository filters.
6. Platform tables (tenants, plans/subscriptions, payment control plane and platform audit) are not exposed to tenant API routers.

## Platform endpoints

- `POST /api/web/v1/platform-auth/login`
- `GET /api/web/v1/platform/tenants`
- `POST /api/web/v1/platform/tenants`
- `PATCH /api/web/v1/platform/tenants/:tenantId/status` (suspend/inactivate or reactivate only when a valid subscription/trial exists)
- `PATCH /api/web/v1/platform/tenants/:tenantId/subscription`
- `GET /api/web/v1/platform/tenants/:tenantId/payments`
- `POST /api/web/v1/platform/tenants/:tenantId/payments` (creates pending record)
- `PATCH /api/web/v1/platform/tenants/:tenantId/payments/:paymentId/confirm` (explicit verified confirmation)
- `GET /api/web/v1/platform/tenants/:tenantId/audit-logs`

The current web/app route files are adapter boundaries. Remaining Laravel modules are not yet ported and must be migrated one module at a time with behavior-parity and cross-tenant tests.
