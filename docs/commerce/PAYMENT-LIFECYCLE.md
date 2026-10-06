# Payment lifecycle and durable work

The [state registry](STATE-MACHINES.md) is canonical. Browser success is only a signal. Razorpay is external payment truth; internal durable records are the application ledger.

## Provider binding

Persist accepted order/attempt first. Claim its binding operation, call provider outside a DB transaction, persist returned provider order ID. If request times out after provider may have created it, mark UNKNOWN and reconcile using recorded operation/receipt evidence. Do not assume provider receipt is an idempotency guarantee or blindly issue a second order. Expose pending/retry-safe UI. Unique local provider order binding prevents cross-order reuse.

The callback sends IDs/signature only. Verify HMAC using the stored provider order ID, then trusted provider order/payment details, amount, currency, capture and internal owner/order binding. Authorized-only payment is not fulfillment approval. Automatic capture configuration must be verified in test/live provider accounts before launch.

## Webhook sequence

1. Bound request size; read raw bytes; verify signature using webhook secret and rotation policy.
2. Extract provider event ID/hash. Transactionally insert verified event and PROCESS_WEBHOOK job; duplicate exact event returns success after confirming durable presence. Same ID/different hash is an alert.
3. Return acknowledgement after durable ingestion. If DB fails, return retryable failure; do not acknowledge and lose the event.
4. Worker invokes the same payment transition service used by callback/reconciliation. Unique provider payment ID plus atomic state guards protect against different event IDs for the same capture.
5. Transition transaction records financial effect, tracked stock consume/recovery, coupon consumption, order status/history and outbox notification. External email/render/provider calls occur after commit.

## Failure and refund handling

Provider-success/DB-failure is retried by provider and reconciliation; customer sees pending until verified persistence. A failed old attempt cannot downgrade a later captured one. Detect duplicate/extra capture, block fulfillment if totals are inconsistent, and record refund-required exception.

Refund operation claims remaining refundable amount including pending refund claims, preventing concurrent over-refund. Submit outside transaction. Unknown response stays pending for provider lookup; reuse operation identity only under verified provider semantics. Persist successful provider refunds, original line/tax allocations, linked credit-note work. No automatic physical restock.

## Small jobs/outbox contract

One jobs collection serves as durable outbox; closed JobKind list in the registry. Minimal fields: businessKey, kind, typed payload, dueAt, attempts, state, lease token/deadline and redacted error. Atomic claim; token-fenced completion; expired leases retried; at-least-once delivery. Proposed exponential delays 1/2/5/15 minutes, cap automatic attempts at 10 with DEAD alert and explicit replay. Financial records remain unresolved until reconciled, not deleted on retry exhaustion.

Use only for verified webhooks, payment reconciliation, tracked reservation/order expiry, large CSV chunks, critical notifications, cache-invalidation recovery and session-revocation recovery. No DAG builder, dynamic handler upload, generic scheduling UI or workflow language. Multiple workers may race safely but start with one scheduled runner/client.

Protected scheduler endpoint accepts a server secret and bounded batch/time budget; no GET side effects. Native host scheduler or external scheduler invokes every 1–5 minutes. If a host only supports authenticated GET cron, use a narrowly authenticated GET trigger adapter delegating to the same runner, document anti-cache behavior and do not expose unrestricted jobs. Never use n8n as the only financial scheduler.

Notifications minimize data, use business deduplication keys and may deliver at least once; never promise exactly-once email. Dead-letter financial work and missed scheduler heartbeat are production alerts.
