# Payments

[ADR 0015](../../../docs/adr/0015-online-order-provider-binding.md) defines the test-only Razorpay payment boundary. The code permits only active ADMIN accounts with `APP_ENV=development`, `test`, or `staging`, `RAZORPAY_MODE=test`, and `rzp_test_` keys. Live mode and `APP_ENV=production` are rejected in code.

- `access.ts`: configuration and fresh Admin authority gate.
- `provider.ts`: bounded native Razorpay HTTP adapter; fixed safe error codes.
- `repository.ts` / `binding.ts`: leased provider-order creation and conservative recovery.
- `checkout.ts`: server-issued Test Mode checkout options and callback verification.
- `proof.ts`: timing-safe checkout and raw-webhook HMAC verification.
- `webhook.ts`: signed-delivery persistence, deduplication and durable processing.
- `capture.ts`: trusted provider-observation transition; browser amounts/status are ignored.
- `admin.ts`: Admin payment queue projection.

`POST /api/payments/verify` accepts only same-origin Admin Test Mode requests. `action=start` returns the public Razorpay key ID plus a server-bound provider order ID. `action=verify` validates the callback HMAC against the stored provider order before fetching fresh provider evidence.

`POST /api/webhooks/razorpay` intentionally has no same-origin requirement. It accepts up to 128 KiB, verifies the raw body with `RAZORPAY_WEBHOOK_SECRET`, accepts only `payment.authorized`, `payment.captured`, and `payment.failed`, deduplicates the delivery, then writes a `PROCESS_WEBHOOK` job in the same Atlas transaction. A worker later fetches current provider evidence; webhook payloads never decide payment state. Invalid signatures and malformed bodies return 4xx; unavailable configuration/storage returns 5xx so Razorpay can retry.

Once checkout details are issued, the narrow 2B.1 unpaid-test cleanup path refuses the order. Capture after the recorded payment deadline is stored as money evidence but marked for review; automatic late-capture recovery is Phase 2C. Normal customers cannot use online payment yet.

No Razorpay SDK dependency is installed. Do not enable live mode, subscribe webhooks, or claim successful staging payment until the deployed endpoint and scheduled job runner have been manually verified.
