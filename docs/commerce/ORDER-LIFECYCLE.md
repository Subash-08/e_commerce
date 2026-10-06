# Order lifecycle and inventory

Use the [state registry](STATE-MACHINES.md) for values/transitions. Orders preserve accepted customer/address/item/tax/shipping/coupon snapshots. Product/User edits only affect new purchases.

Order creation validates cart server-side, calculates a fresh quote, scopes idempotency to authenticated owner or opaque guest session, and atomically persists order plus claims, tracked reservations and necessary jobs. An identical replay returns the same order; same key/different fingerprint is a conflict. Never generate a fake user for a guest.

## Two availability modes

| Variant mode | Order preparation | Payment/expiry effects |
| --- | --- | --- |
| trackQuantity=false | Validate active product/variant and IN_STOCK, no quantities or reservation documents | Capture records payment/order only; expiry does not invent release operations |
| trackQuantity=true | Conditional available >= requested; increment reserved and create ACTIVE reservation in same transaction | Capture consumes exactly once (onHand and reserved reduced); cancellation/expiry releases reserved once |

Mixed carts are supported: reserve only tracked lines, but commit all order facts/claims atomically. Fail any unavailable line before creating payable order. Status changes on existing accepted orders create an explicit fulfillment exception if fulfillment becomes impossible; they do not silently reprice or erase payments.

Online reservation default is 15 minutes. Job trigger runs every 1–5 minutes; eligibility at payment/checkout uses timestamps, not delayed TTL cleanup. Worker queries expired candidates, then transactionally rechecks payment/reservation/order state before release. Locks/revision guards serialize competing expiry/capture transactions.

Late capture: record money first through the verified service. If expired and all lines remain eligible, acquire required stock atomically and consume for this capture; restore order only via the registry's exceptional transition. If any tracked line is gone or untracked line is unavailable, keep fulfillment blocked and create refund-required work. No negative stock, partial order fulfillment or silent charge increase. Cancelled orders do not auto-revive.

COD is optional/off by default. It creates a placed but unpaid order. Tracked units remain reserved until shipment or cancellation; a client fulfillment deadline drives reminders. Shipment consumes tracked inventory once; collected COD is recorded as a separate audited receipt. Do not reuse online timeout for COD.

Admin transitions require expected revision, allowed role/action, reason when exceptional and history append. Tracking URL is allowlisted/validated. Shipping labels reveal PII only to authorized operators. Reports use snapshots and successful payment/refund records.

Orders may be archived for interface performance but retain legal/operational history. Account deletion does not cascade into order deletion; privacy retention exceptions are reviewed per client.
