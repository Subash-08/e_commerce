# Durable jobs

The jobs collection is a small closed outbox/recovery set. Phase 2A implements bounded leased processing for `SEND_NOTIFICATION` order-confirmation jobs. The authenticated `/api/jobs/run` endpoint is called by a one-minute VPS scheduler initially and remains portable to an external/Vercel scheduler.

Handlers are idempotent, leases are conditional, retries are bounded, and external delivery happens outside database transactions. Unsupported kinds are never claimed by this runner. Payment reconciliation, expiry and cache/session handlers retain their module-specific gates until consolidated deliberately.
