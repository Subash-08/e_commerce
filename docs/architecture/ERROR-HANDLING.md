# Errors and observability

| Error | Public behavior | Server behavior |
| --- | --- | --- |
| Invalid input | Field-level accessible errors; preserve safe input | 400/422, validation code, no raw DB details |
| Unauthenticated / forbidden | Login or generic denied; no data leak | 401/403; owner-check failure may use 404 |
| Missing/archived product | Unavailable/404; cart retains unavailable reference | Exclude from totals; no fallback fake product |
| Stale revision/price | Review changed facts; retry after confirmation | 409, current safe projection; no silent overwrite |
| Duplicate idempotency key | Return original result if fingerprint matches | Unique constraint; changed fingerprint -> 409 |
| Provider timeout | Pending/retry-safe explanation | Persist ambiguous status; reconcile before new attempt |
| Database unavailable | Retry UI, payment remains pending | 503, bounded retries; no confirmed order without durable write |
| Unexpected failure | Correlation ID and general error UI | Redacted structured event; alert critical paths |

Log operation, correlationId, internal order/attempt IDs, transition, duration and error code. Exclude secrets, reset/guest tokens, full webhook bodies, addresses, email/mobile and card data from routine logs. Security/audit records use minimal actor IDs and before/after field names, not copied credentials.

Each page family gets loading/error/empty/not-found states. Error boundaries are UI containment, not transaction recovery. Retry only known transient database operations and idempotent jobs; never blindly repeat external money-changing calls.

Alerts: scheduler silence >10 minutes (proposed), oldest due financial job >5 minutes, dead-letter financial event, unresolved capture/order binding, backup failure and increased checkout 5xx. Thresholds are deployment-tuned; no SLA promised until measured.
