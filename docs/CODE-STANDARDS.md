# Standards

- TypeScript strict mode; validate all external input with Zod.
- Use centralized error handling and stable `{ data }` / `{ error }` API envelopes.
- Keep web and app URL namespaces, auth adapters, permission checks and DTOs separate.
- Use database transactions for order/stock/production/dispatch transitions.
- Never trust a user/plant/vendor/distributor ID from the client without authorization and tenant/plant-scope checks.
- Add pagination and filtering server-side; never load unbounded lists.
- Use structured logs; redact OTPs, tokens, passwords and customer-sensitive fields.
- Put scheduled work in a queue/cron/worker, not unauthenticated HTTP routes.
- Add unit tests for domain services and integration tests for web/app API contracts.
- Keep secrets in environment variables and rotate credentials before production.
