# Payments

Pure financial transitions remain in state.ts. Phase 2B.1 adds Admin-only, non-production Razorpay test order binding. See [ADR 0015](../../../docs/adr/0015-online-order-provider-binding.md).

- access.ts: environment/configuration gate and fresh Admin authority.
- provider.ts: bounded server HTTP calls and sanitized provider contracts.
- repository.ts: leased, fenced binding persistence.
- binding.ts: provider-order creation and exact-match recovery.
- cleanup.ts: narrowly guarded unpaid test cleanup.
- indexes.ts: additive uniqueness constraints.

POST /api/admin/payments/test-orders uses same-origin requests and the signed checkout cookie. Actions:

- accept: command contains the existing checkout quoteId, idempotencyKey and complete checkout input with payment ONLINE. Returns internal order ID/summary. Cart remains intact.
- bind: orderId from acceptance. Returns binding state and review code, never provider checkout options. Repeat uses the existing binding; UNKNOWN only performs lookup after the cooldown.
- cleanup: orderId. Refuses uncertain or attempted payments, preserves all order/binding history and releases only the test order's own holds.

The authenticated Admin can obtain an ONLINE quote via the existing quote endpoint. This API is a development verification surface, not the customer payment UI. No Admin toggle enables live mode. Do not manually edit stock to clear a stuck hold.

Still deferred: payment ledger persistence, callback/HMAC and webhook handlers, capture, scheduled expiry/reconciliation, public checkout and refunds. No SDK dependency installed.
