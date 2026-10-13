# SaaS tenancy release test plan

## Control-plane authentication

- Platform super-admin can sign in through `/platform/login` and `/api/web/v1/platform-auth/login`.
- A tenant user cannot sign in to the platform surface. A platform super-admin cannot sign in to tenant web/app surfaces even if an old membership row exists.
- Tenant APIs reject a platform-surface cookie/token; platform APIs reject tenant-surface tokens.
- Wrong passwords, malformed slugs, repeated login attempts, expired JWTs and inactive memberships are rejected.

## Tenant lifecycle and payment

- `trialDays > 0` permits access only before `trialEndsAt`; `trialDays=0` must create `PAYMENT_PENDING` and deny login/API access.
- Assigning a plan/price must not activate a tenant.
- Recording a payment creates `PENDING` only. Pending payments do not mark a payment as received.
- Confirming a pending payment requires a verification note and valid amount; confirmation updates payment, tenant and subscription dates atomically and adds audit history.
- A non-pending payment cannot be confirmed twice. An underpaid payment cannot activate the tenant when a price is configured.
- Paid access stops at `currentPeriodEndsAt`; trials stop at `trialEndsAt`; `SUSPENDED`, `INACTIVE`, `EXPIRED` and `PAYMENT_PENDING` access is rejected even when a JWT remains unexpired.
- Suspending a tenant invalidates access on the next protected request. Reactivation is rejected if trial/subscription is no longer valid.

## Tenant isolation (repeat for every module when it is ported)

- Create tenant A and tenant B with similarly named plants, customers and orders.
- Authenticate as A and attempt to list, read by guessed ID, update, delete, export, link to a B record, and create a relationship to B's parent record. Every attempt must return not found/forbidden and must not change B's records. Repeat in reverse.
- Omit or forge tenant IDs in request body, query string, path, headers and nested relationship IDs. The server must always derive scope from the verified membership.
- Test raw SQL reports, CSV/XLS exports, background jobs, scheduled order generation, notifications and mobile route handlers.
- Verify RLS with the actual least-privileged app database role (not superuser, not `BYPASSRLS`) and two concurrent pooled connections to ensure `set_config(..., true)` remains transaction-local.

## Database migration

- Run all migrations against a disposable PostgreSQL database cloned from the actual target schema.
- Count source and destination rows before/after tenant backfill for every tenant-owned table. Verify that every row has a valid tenant and foreign keys never cross tenant boundaries.
- Check indexes/query plans for tenant-scoped lookups. Validate rollback/restore from backup before cutover.

The current package only has automated unit tests for the shared access policy and a tenant-isolated `plants` example. The rest of this matrix is a required release gate, not a claim of completed tests.
