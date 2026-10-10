# ADR 0015: Online test acceptance and Razorpay order binding

Status: Phase 2B.1 implementation; verification evidence is in [PROGRESS](../PROGRESS.md).

## Scope and authority

Extend the [COD acceptance boundary](0014-cod-order-acceptance-and-jobs.md). Only active ADMIN accounts with fresh authVersion in APP_ENV development/test/staging and RAZORPAY_MODE test may use this slice. The public checkout endpoint still rejects online acceptance. Provider checkout options are not exposed. Live keys and production environments are rejected by code, independently of Admin settings. No capture, webhook, refund or online customer UI is implemented in 2B.1.

## Acceptance

An existing buyer/key receipt is resolved before rechecking quote expiry or mutable catalog facts. Different input with the same key conflicts. Quote consumption is a conditional transactional write, preventing two keys from consuming one quote. Online acceptance creates PENDING_PAYMENT, immutable snapshots, tracked reservations, an effective HELD coupon claim, the idempotency receipt, and an initial provider binding in one Atlas transaction. COD still consumes its claim at acceptance. Status-only variants create no reservations. Online acceptance preserves the cart and records acceptedCartRevision and acceptedGuestLinesHash for later cleanup. Account cleanup at capture must preserve a changed cart; guest cleanup occurs only on the confirmation page against the accepted browser snapshot, never in a webhook.

Online amounts must meet the provider minimum of 100 paise. Deadline bounds remain 900-1800 seconds. No provider/email call runs inside a retryable transaction.

## Binding identity and bounded operation

paymentBindings stores internal order ID/number, provider, test mode, key-ID fingerprint, receipt, operation UUID, generation, active marker, amountPaise, INR, canonical BindingState, revision, attempts, recoveryAttempts, deadline and timestamps. The key-ID fingerprint separates account/key changes conservatively; it is not a secret or a claim that two rotated keys identify different merchant accounts. Changed keys require reviewed migration/recovery.

Generation starts at zero. Indexes allow historical generations but enforce one active binding per internal order. This slice does not create replacement generations. Individual payment attempts belong in the documented payments collection in 2B.2, not in binding arrays.

Create has one attempt maximum, a 10-second HTTP deadline, a 30-second DB lease and a random fencing token. Creation is refused with less than 60 seconds remaining. Any ambiguous HTTP/parse/database outcome becomes UNKNOWN, or remains REQUESTING until its lease expires and is converted to UNKNOWN. An expired token cannot bind or clear the operation. No expired lease is recycled into a new create. Recovery allows five explicit lookup attempts spaced at least 60 seconds apart; exhaustion stays visible as unresolved financial work, not a failed payment or released hold.

Use the internal order number as receipt, and include internal order ID and operation UUID in non-PII provider notes. Razorpay documents receipt filtering as a contains match: enforce exact equality locally and validate amount, INR, operation and internal order. A full 100-row response is inconclusive. One exact validated match binds; multiple matches require review. Zero matches remains UNKNOWN. The official API documents no read-after-write guarantee sufficient to conclude that a timed-out creation did not succeed, so zero matches never authorizes automatic recreation.

Official contracts checked 2026-10-10: [create order](https://razorpay.com/docs/api/orders/create/) and [fetch orders](https://razorpay.com/docs/api/orders/fetch-all/). Use native server fetch, not a new SDK dependency. Errors are fixed application codes, never provider bodies, secrets or causes. The HTTP adapter asserts it runs outside transactions.

## Test cleanup

The protected cleanup action accepts only this slice's testOnly online pending orders. NOT_STARTED with zero creation attempts can be cancelled under a fence. BOUND requires a fresh provider fetch proving the exact binding has status created, zero attempts, zero paid and full amount due. Provider IDs/checkout options have never been exposed by this slice. A cleanup lease fences concurrent binding, then one Atlas transaction closes the active binding, cancels the order, releases tracked reservations and HELD coupon capacity, and audits the action. It preserves cart contents and all history. It does not delete the provider order. UNKNOWN, in-flight, attempted or paid bindings cannot be cleaned. They need successful association/review first. This test-only procedure must be disabled/replaced before exposing checkout options in 2B.2; it is not a production cancellation algorithm.

## Later gates

2B.2 records deadline-passed captured money and a visible fulfillment exception, never fulfills it before 2C recovery exists. Provider events arriving before binding are retained for association. Webhook ingestion bypasses same-origin checks but requires raw-body HMAC and bounded bytes; malformed/oversized requests can return 400/413 as well as invalid-signature rejection; transient persistence failure returns 5xx. No untrusted provider error enters responses/logs. Customer polling stops after 60 seconds and provides explicit refresh and a still-confirming message. Email promises require a configured working provider.

2C must recheck both binding and payment evidence before release; UNKNOWN is not unpaid. Late capture checks the deadline even if the expiry worker is delayed. All observations converge on one transition service. Refund-required remains a fulfillment exception under the [canonical registry](../commerce/STATE-MACHINES.md), not an order status. Production checkout remains code-gated until recovery and refund readiness.

The user selected Vercel staging on 2026-10-10 instead of a local tunnel: https://e-commerce-gules-iota-16.vercel.app. Use APP_ENV=staging with the normal production-mode Next build; APP_ENV=test is reserved for the integration-test runtime. Staging still requires test-mode Razorpay keys and active ADMIN authority. Production APP_ENV and live credentials remain rejected. See the [staging setup](../operations/VERCEL-STAGING.md). The hostname is reachable, but that is not evidence of completed webhook/capture verification.
