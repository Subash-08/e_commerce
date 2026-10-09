# Checkout, orders and payment implementation plan

Status: Phase 1B implemented, 2026-10-09. Shipping policy and authoritative guest/account quotes are operational; saved addresses, versioned legal acceptance and free-delivery coupon pricing are included. No order, reservation, coupon claim, provider payment, invoice or fulfillment behavior is implemented.

## Delivery gates

Finish, verify, report and stop after each gate:

1. **1A — Shipping policy and calculator.** Versioned Admin settings and one pure shipping service.
2. **1B — Checkout and authoritative quotes.** Guest/account contact, addresses, coupon/shipping preview and short-lived server quotes. No order, reservation or claim.
3. **2A — Order acceptance.** Atomic snapshots, tracked-stock reservations, coupon claims and COD; no provider calls. Report and stop.
4. **2B — Razorpay binding.** Provider order binding, verified callback and webhook. Record exact SDK compatibility/version; report and stop.
5. **2C — Recovery.** Expiry, reconciliation and late capture with/without stock. Report and stop. Online purchasing must remain disabled until this recovery gate passes.
6. **3 — Purchase operations.** Customer/admin orders, guest tracking, notifications, invoices, shipping and refunds.

Wishlist is independent and may follow 1B or phase 3. Browser prices, totals, stock, roles, coverage and payment results are untrusted hints. The server reads fresh Atlas facts and invokes the existing integer-paise pricing engine. React only renders returned facts.

## 1A — Shipping policy and calculator

Replace the `/admin/settings` placeholder with an overview and add `/admin/settings/shipping`. Only `ADMIN` may read or mutate shipping/payment policy. Reuse the admin shell, form cards, inline errors, sticky save bar and optimistic revisions.

Store one `settings` document with `key: "shipping"`, a unique key index, `revision`, `schemaVersion`, timestamps and canonical `updatedBy`. Do not silently invent settings: until Admin saves a valid policy, checkout reports `SHIPPING_CONFIGURATION_REQUIRED`.

```ts
type ShippingPolicy = {
  key: "shipping";
  enabled: boolean;
  country: "IN";
  currency: "INR";
  standardChargePaise: number;
  automaticFreeShipping: {
    enabled: boolean;
    thresholdPaise: number | null;
  };
  coverage: {
    mode: "ALL_INDIA" | "ALLOW_LIST" | "BLOCK_LIST";
    stateCodes: string[];
    pinPrefixes: string[];
  };
  shippingTaxPolicyKey: string | null;
  taxReview: {
    approved: boolean; // Derived from independently reviewed immutable tax facts, not Admin input.
    reviewedAt: Date | null;
    reviewReference: string | null;
  };
  cod: {
    enabled: boolean;
    surchargePaise: number;
    surchargeTaxPolicyKey: string | null;
    blockedStateCodes: string[];
    blockedPinPrefixes: string[];
    reservationDeadlineHours: number;
  };
  quoteTtlSeconds: number;
  onlinePaymentDeadlineSeconds: number;
  revision: number;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
};
```

Money is integer paise. The form may accept rupee strings only through the existing paise parser. Sample ₹80/₹1,999 values are not defaults. `quoteTtlSeconds` is bounded to 600–900 seconds.

Shipping tax never follows a guessed or dominant item rate. `shippingTaxPolicyKey` references an immutable reviewed `INCLUSIVE`, `EXCLUSIVE` or `EXEMPT` tax policy. Checkout remains visibly non-production-ready while CA review is pending. The same applies to a taxable COD surcharge.

India V1 accepts an application allowlisted state/UT code and six-digit PIN matching `^[1-9][0-9]{5}$`. PIN prefixes contain 1–6 digits; lists are deduplicated and bounded. `ALLOW_LIST` requires at least one state or PIN entry and allows any match. `BLOCK_LIST` rejects any match. There is no state/PIN precedence. COD is evaluated only after serviceability and cannot widen coverage. These rules express merchant policy, not courier-confirmed availability.

The pure shipping service receives destination, merchandise payable after discounts, payment choice, policy and tax facts. It returns serviceability, standard/waived/surcharge amounts, waiver reason (`NONE`, `THRESHOLD`, `FREE_SHIPPING_COUPON`), COD eligibility and public issue codes.

Automatic free-shipping basis is GST-inclusive merchandise payable after item/order discounts, excluding shipping and COD fees. Comparison is `>=` in paise: ₹1,999.00 qualifies at ₹1,999; ₹1,998.99 does not. A discount that drops merchandise below the threshold restores shipping. A coupon cannot make an unsupported destination serviceable.

Every save validates the full document and uses revision compare-and-swap inside an Atlas transaction with fresh ADMIN authority. Audit retains complete previous/new policy snapshots, including monetary values, and canonical auth actor IDs; it stores no unrelated personal data. Settings contain business policy, never provider credentials. Missing/invalid/future-version settings fail closed. See [ADR 0012](../adr/0012-shipping-policy-and-calculation.md) for the implemented contract.

Quote TTL is 600–900 seconds; online payment deadline is 900–1800 seconds. Future provider sessions must fit the remaining deadline with at least a 60-second margin, alongside mandatory late-capture recovery. COD reservationDeadlineHours is a 1–168-hour alert only; no automatic release. Normal Admin Save cannot approve tax. Reviewed tax facts are provisioned separately; draft settings and clearly labelled estimates remain usable.

Later gate clarifications: guest ownership uses a signed httpOnly checkout-session cookie, rotated for each new checkout session. Clearing it requires a new quote and never transfers order ownership by email. placeOrder receives normalized full inputs again and compares their fingerprint with the stored quote; hashes cannot reconstruct addresses. FREE_SHIPPING lands with pricing, registry, coupon admin/preview and focused tests in one commit. Record host, scheduler and durable rate-limit strategy before 2A. Select an HTTPS tunnel or deployed staging webhook URL before 2B; no tunnel or provider is installed in 1A. Consent versions initially come from typed settings with a later pages-collection migration.

### 1A acceptance

- Admin creates/revises shipping policy; stale writes conflict.
- STAFF/CUSTOMER fail at the service and endpoint boundary.
- Calculator covers threshold boundaries, restored shipping, coverage, COD eligibility, tax modes and safe money bounds.
- Reviewed indexes are applied through the existing command.
- Pricing rules, collections, change matrix and progress update in the same commit.
- Typecheck, lint, build and focused authority/revision/calculator checks pass. Stop and report.

## 1B — Checkout and authoritative quotes

Replace `/checkout` with a private/no-store single page. Server components load session/account choices directly through services; client islands handle form and quote refresh.

Support guest checkout without registration, account checkout with owned saved addresses, contact name/email/mobile, shipping and billing addresses, optional business legal name/GSTIN, bounded delivery note, one coupon, online payment, setting-controlled COD, required terms acceptance and separate optional marketing consent. Validate GSTIN format without claiming government verification. Guest email never establishes account identity.

Saved addresses contain canonical auth ID, normalized structured fields, label/default flags, revision and timestamps. They are private, bounded and ownership checked. Editing one never changes an order snapshot.

Use labeled inputs, inline announced errors and relevant autocomplete attributes. Use mobile keypads for phone/PIN. Summary is sticky on desktop and collapsible on mobile. An `aria-live` region announces total changes.

`POST /api/checkout/quote` accepts bounded contact/address data, payment choice, coupon and authenticated cart revision or guest lines. Same-origin/rate limits apply. It never accepts authoritative prices, tax, stock, shipping, discounts, totals or roles.

The service:

1. Resolves the cart from fresh catalog authority.
2. Rejects blocking availability/quantity issues.
3. Resolves immutable tax policies and revisions.
4. Validates coupon eligibility without a claim.
5. Runs the pure pricing engine.
6. Resolves coverage and automatic threshold.
7. Applies free-shipping coupon only when shipping remains payable.
8. Applies reviewed shipping/COD tax.
9. Blocks non-positive grand totals in V1.
10. Returns one safe authoritative quote.

Add `FREE_SHIPPING` to the canonical state registry and pure pricing contract through an ADR amendment in this phase. It waives at most current eligible shipping. If the threshold already made shipping zero, the coupon has no effect and must not later consume a redemption. Percentage/fixed discounts may restore shipping by lowering merchandise below the threshold. One coupon per quote/order remains V1.

`checkoutQuotes` is evidence, not an order:

```ts
type CheckoutQuote = {
  _id: string; // cryptographically random
  ownerKeyHash: string;
  requestFingerprint: string;
  cartRevision: number | null;
  guestLinesHash: string | null;
  sourceRevisions: {
    variants: Array<{ id: string; revision: number }>;
    coupon: { id: string; revision: number } | null;
    shippingPolicy: number;
    taxPolicyKeys: string[];
  };
  publicQuote: CheckoutQuoteDto;
  expiresAt: Date;
  createdAt: Date;
  schemaVersion: number;
};
```

Store only a normalized hash of contact/address inputs, not another raw PII copy. The DTO contains safe item pricing, coupon allocation, shipping/waiver, COD fee, tax components, total, issues, payment methods, policy versions and expiry. TTL cleans old quotes, while reads always enforce expiry because TTL cleanup is asynchronous.

A quote does not reserve stock, claim coupons, create provider orders or create internal orders. It is owner/fingerprint-bound. At phase-2 order acceptance, recompute from fresh facts. A mismatch returns `QUOTE_CHANGED` with a replacement quote and structured old/new total; the customer must explicitly confirm the new quote.

Until editable Pages exists, terms/privacy version IDs come from typed Admin checkout-policy settings and correspond to the published static revision. Order creation later records accepted version/time. Marketing consent remains separate.

### 1B acceptance

- Guest/account use the same quote contract.
- Saved addresses enforce ownership/revision at direct endpoints.
- Cart/price/stock/settings changes show accessible repricing.
- Quote replay by another owner and expired quotes fail.
- No order, reservation, claim or provider call exists.
- Manual browser checks cover 360 px, desktop, keyboard errors, summary collapse, announced totals, loading/retry and DB outage preservation.
- Focused tests cover manipulated totals, private fields, threshold/coupon interaction, stale facts, owner/expiry and unsupported PIN. Stop and report.

Implementation record: [ADR 0013](../adr/0013-checkout-addresses-consent-and-free-shipping.md). The quote remains evidence only. Phase 2A is blocked until the deployment host, scheduler and durable jobs/outbox execution strategy are recorded.

## 2 — Order acceptance, claims, stock and Razorpay test payments

### Hard prerequisites

- Record the host and scheduler. Due jobs run every 1–5 minutes through the protected runner with bounded budget/leases and missed-run alerts.
- Configure Razorpay **test** Key ID, Key Secret and a separate webhook secret locally.
- Provide a public HTTPS webhook origin; localhost needs a tunnel or deployed test environment.
- Enable and record test-account auto-capture.
- Re-check current Razorpay SDK/Node support. Keep calls behind a typed adapter; use the official SDK if compatible, otherwise a small typed HTTPS adapter.

Razorpay requires server-created provider orders, server-side signature verification and captured-state verification. Webhooks are asynchronous and may describe an earlier snapshot. Webhooks drive automation; trusted API fetch may supplement the customer return path. HMAC uses the provider order ID stored by our server, never a browser-supplied authority.

### Atomic order acceptance

One `placeOrder` service handles guest/account and online/COD. Request includes quote ID, normalized checkout inputs, accepted quote hash and idempotency key, never totals.

Inside one Atlas transaction, sequentially:

1. Validate account session or signed guest identity and idempotency fingerprint.
2. Recompute fresh quote; return `QUOTE_CHANGED` without writes if different.
3. Allocate internal order number through reviewed sequence policy.
4. Store immutable customer/address/item/coupon/shipping/tax/consent/total snapshots.
5. Conditionally reserve tracked stock only; status-only variants have no reservation.
6. Create coupon `HELD` only for non-zero item discount or shipping waiver, enforcing capacity. Guests use global limits only; per-account/first-order needs verified account identity.
7. Persist checkout receipt and minimal durable jobs.
8. Online starts `PENDING_PAYMENT`; COD starts `PLACED`, consumes its coupon claim at acceptance, keeps tracked reservation to shipment and financial state `PENDING`.

COD is disabled until Admin enables it. It never appears for blocked destinations. Surcharge is server-priced and snapshotted. COD is not paid until an audited collection receipt. It uses an Admin fulfillment deadline, not online expiry.

No Razorpay/email/n8n call occurs inside the transaction.

### Provider binding and verified payment

After the online transaction commits, create the Razorpay order from immutable internal amount/currency/receipt. Open Checkout.js only when binding is `BOUND`. Timeout remains `UNKNOWN` and must reconcile before another customer-visible binding. Razorpay documentation does not guarantee generic create-order idempotency, so the design does not assume it. Only a safely persisted provider order is exposed.

Browser receives only Key ID, provider order ID, display data and immutable amount. Secrets remain server-only.

`/api/payments/verify` loads the stored provider order, constant-time verifies callback HMAC, fetches trusted status/amount when required, and records a verified observation. The internal order becomes paid only for full matching `captured` funds.

`/api/webhooks/razorpay` reads bounded raw bytes, verifies `X-Razorpay-Signature` before parsing, persists a unique provider event/stable identity and processes idempotently. Duplicate/out-of-order authorized/captured/failed observations converge through one transition service. Current trusted provider truth wins over arrival order.

Unique constraints and conditional revisions ensure duplicate evidence cannot consume stock/claims twice, create another order/invoice, count another sale or send duplicate confirmation. Partial/extra/wrong-currency capture sets review and blocks fulfillment. Payment retry creates a new attempt against the immutable unpaid order and never reprices it.

### Expiry/recovery

`EXPIRE_ORDER`, `RECONCILE_PAYMENT` and notification jobs use the existing lease contract. Expiry checks local verified evidence and fetches provider truth when ambiguous. Confirmed unpaid expiry releases active reservations/claims once. Late capture uses the approved state machine: release/expire, then atomically reacquire all tracked stock and coupon capacity. Success places; failure records money and marks refund/review without overselling.

Zero-payable checkout is blocked in V1. A future free-order path needs a separate decision rather than calling Razorpay with ₹0.

### Persistence/indexes

Implement documented `orders`, `checkoutAttempts`, `payments`, `reservations`, `couponClaims`, `webhookEvents`, `jobs` and counters. Query-backed indexes include unique order number; owner/idempotency receipt; partial unique provider order/payment/event IDs; due reconciliation; unique order/variant/reservation generation and order/coupon/claim generation; active reservation/held claim lookup; account history and future guest-grant lookups.

TTL never deletes unresolved financial/reservation/claim/webhook/order state.

### Phase 2 acceptance

- One real Razorpay test purchase reaches verified captured order.
- Callback-only, webhook-first/callback-first, duplicate and out-of-order evidence converge.
- Last-unit and last-coupon-use races permit one winner.
- Binding timeout, payment timeout/failure/retry and DB outage remain recoverable.
- Expiry releases once; late capture passes with capacity and becomes refund-required without it.
- Manipulated amount/order/payment IDs and signatures fail without leaks.
- COD enablement, coverage, surcharge, stock hold and unpaid financial state work without Razorpay.
- Admin payments show safe identifiers, amount, status, history and review flags.
- Stop before operations/invoice work.

## 3 — Purchase operations

Build from immutable snapshots: account order list/detail and cancellation eligibility; guest tracking through one-time email grants; admin orders/payments/review; durable Resend/n8n notifications; CA-reviewed invoice counter/issuance; shipping/tracking, COD collection, cancellation/refund; refund adapter and snapshot-based allocations.

Returns/RMA, carrier-rate APIs, warehouses, partial fulfillment, multi-currency and advanced promotion stacking remain outside V1.

## Credentials and human decisions

No credential is needed for 1A/1B. Before phase 2 configure in `.env.local`:

```text
RAZORPAY_KEY_ID=<test key ID>
RAZORPAY_KEY_SECRET=<test key secret>
RAZORPAY_WEBHOOK_SECRET=<separate random webhook secret>
RAZORPAY_MODE=test
JOBS_TRIGGER_SECRET=<random scheduler secret>
```

Also set `APP_URL` to the public HTTPS test origin and configure the Dashboard webhook. Never paste Key Secret, webhook secret or scheduler secret into chat. Live keys wait for test verification, policy/legal/CA review, monitoring and backup gates.

Human decisions: shipping charge/threshold/coverage; reviewed shipping/COD tax; COD enablement/coverage/surcharge/deadline; terms/privacy versions; host/scheduler before phase 2; Razorpay test auto-capture/webhook setup.

## Verified provider sources

- [Razorpay server integration](https://razorpay.com/docs/server-integration/python/test-app/)
- [Razorpay payment and webhook behavior](https://razorpay.com/docs/payments/payments/dashboard/)
- [Razorpay security checklist](https://razorpay.com/security/checklist/)
