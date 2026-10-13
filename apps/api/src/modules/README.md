# Domain module convention

Each module should contain:

- `*.routes.ts` — HTTP route definitions only
- `*.schema.ts` — Zod request validation
- `*.controller.ts` — HTTP/request-response mapping
- `*.service.ts` — business rules and transactions
- `*.repository.ts` — Prisma/database access
- `*.types.ts` — domain types where needed

Never place business logic directly in route handlers. Shared domain services may be called by both web and app controllers only when the underlying business rule is truly identical. Keep surface-specific authorization and response DTOs separate.
