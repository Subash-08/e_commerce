# ADR 0008: Executable pure pricing and lifecycle contracts

Status: IMPLEMENTATION CHECKPOINT — VERIFICATION PENDING, 2026-10-06. Authorized by the user's two Stage 4 attachments; the second limits this run to pure rules and tests. Builds on [ADR 0004](0004-transaction-correctness.md).

## Decision

Implement the existing pricing and lifecycle contracts as pure TypeScript functions. No request/session, database, provider, process environment or clock access occurs in domain calculations. Callers supply a processing timestamp, verified facts and permission decisions. Public routes remain placeholders.

Money is branded integer paise, bounded to 9,007,199,254,740,990 (Number.MAX_SAFE_INTEGER minus one). BigInt intermediates prevent multiplication overflow and half-paise errors; every numeric money output is range checked. Basis points are integers from 0 through 10,000. V1 accepts INR/India, 1–99 units per line and 1–100 unique lines. Unsupported amounts, taxes, currency/country, inactive/unavailable lines and stale price revisions fail explicitly.

Coupon minimum applies to eligible pre-coupon sale value, after catalog discount. One coupon is capped at eligible value and optional maximum. Dates use start-inclusive/end-exclusive processing times. Allocation uses largest remainder and code-unit key order, independent of input order or locale. MRP savings are informational. Tax mode and component rates are explicit; components must sum to the selected rate. Odd component paise use the same largest-remainder algorithm. Exemption requires a reason. Shipping free-threshold comparison includes discounted goods tax; shipping has a separate explicit tax treatment. Final rupee rounding remains disabled. Inputs and policy/engine versions are copied into the quote.

The Markdown registry remains the sole manually maintained enum membership source. A deterministic generator produces checked-in readonly TypeScript values/types; the enum gate verifies the generated file byte-for-byte after line-ending normalization before allowing its exception from duplicate-definition checks. Transition guards remain executable code tested over every order/payment state pair.

Every changing command carries actor, reason, processing time, operation identity and expected revision. Identical operation replay emits no second effect; changed command reuse conflicts. Revisions are proposals for a future atomic conditional write, not database locks.

Financial status is computed from unique captured attempt identities and successful refunds, independent of failed old attempts. Extra capture can still be PAID but has REVIEW_REQUIRED and cannot fulfill; partial capture remains PENDING with REVIEW_REQUIRED. Pending refund claims reserve capacity and block fulfillment. Refund failure must be externally resolved before retry/releasing capacity. Successful claims cannot downgrade. Zero-due quotes contain no implied payment receipt.

Online pending orders cannot consume an expired hold. At/after the deadline they must be rechecked, expired/released, then use the explicit late-capture recovery path with fresh eligibility, all tracked stock and coupon capacity. Recovery creates a new reservation generation; released records never revive. Cancelled orders never auto-revive. COD holds are not subject to online expiry and consume at shipment. Cancellation releases only active holds, never restores consumed inventory.

## Scope and consequences

Reservation functions take a complete, immutable one-variant balance/reservation snapshot for pure conservation checks. This is a domain test/input contract, not a proposal to embed reservations in a Variant document or fetch every historical reservation per production request. The database slice must adapt bounded reads/conditional updates while preserving the same invariants and separate collections.

State effects are returned as descriptions for later transactional orchestration; they do not execute jobs, stock writes or provider calls. All effects, balances, operation receipts and history must eventually commit atomically with expected-revision guards. No browser-supplied "verified" or "authorized" flag is trusted at service boundaries.

Tests use an explicitly in-memory compare-and-swap harness for last-unit and expiry races. This proves pure proposals and guarded application behavior only. Replica-set rollback, unique indexes, transaction retries, durable event deduplication and mixed-cart atomicity remain integration gates. There is no auth installation or auth compatibility report in 4A; the report belongs to 4B, with installation separately gated.

Rejected alternatives: floating-point authoritative totals, independent handwritten enum lists, returning fake successful persistence, treating Promise-based tests as MongoDB transaction proof. No stored schema or historical financial data is migrated by this part. Client CA/legal approval remains required before production tax/invoice use.

Final deadline clarification: a late capture may find an overdue online order still pending. Its atomic proposal records pending-to-expired and, only after successful fresh acquisition, expired-to-placed. A failed recovery records the expired status plus refund-required work. It never waits for the scheduler as a correctness prerequisite. All audit edges are retained. These final changes await the delegated regression run.
