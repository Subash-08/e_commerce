# ADR 0014: COD order acceptance and bounded job execution

Status: APPROVED, 2026-10-10.

## Decision

Phase 2A enables cash-on-delivery acceptance only. Online payment remains unavailable until provider binding, webhook verification, expiry, reconciliation and late-capture recovery are complete. The initial deployment target is a VPS. An authenticated one-minute scheduler calls the same bounded HTTP job runner that remains portable to Vercel Cron or another external scheduler. No in-process timer owns durable work.

`POST /api/checkout` accepts a quote ID, a buyer-scoped idempotency key and the complete normalized checkout input. The server ignores browser totals. It verifies quote ownership, expiry, input fingerprint, cart identity, shipping-policy revision, COD eligibility, product publication, variant revisions, fresh stock and coupon capacity. One MongoDB Atlas transaction assigns the order number, writes immutable order snapshots, reserves only quantity-tracked variants, consumes an effective COD coupon claim, writes the idempotency receipt, clears an account cart and creates the notification outbox job.

The same buyer plus idempotency key and identical payload returns the original order. Reusing the key with different data fails. A guest receives a short-lived HttpOnly order-specific grant. The public order number alone gives no access and matching email never transfers ownership.

COD financial state begins PENDING. Tracked reservations remain ACTIVE until shipment or cancellation. The configured COD deadline creates an Admin follow-up point; it never automatically releases stock. Cancellation before shipment releases ACTIVE reservations and reverses a COD coupon claim exactly once in the same transaction. This is the narrow exception to the usual terminal meaning of CONSUMED: the COD claim represents accepted capacity and remains reversibly linked to the unfulfilled order until cancellation is no longer allowed. Shipment handling will close that reversal window in the fulfillment phase.

`SEND_NOTIFICATION` uses the existing jobs collection. The runner atomically leases only supported notification jobs, works within configured batch/time limits, performs provider calls outside transactions, and records success, bounded retry or DEAD. Provider acknowledgements are validated. Job payloads contain an order reference rather than duplicated customer PII.

## Consequences

Order snapshots preserve accepted contact, address, item, tax, coupon, delivery, COD and legal-consent facts. Customer and Admin reads use snapshots rather than mutable catalog data. Additive indexes protect order numbers, checkout idempotency, reservation identity, coupon claim identity and account coupon usage. Razorpay objects, payment callbacks, invoice issue and fulfillment transitions remain later gates.
