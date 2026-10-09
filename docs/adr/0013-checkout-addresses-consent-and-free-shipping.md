# ADR 0013: Checkout addresses, legal consent and free-delivery coupons

Status: accepted and implemented for Phase 1B, 2026-10-09.

## Decision

Registered customers may keep at most ten India-only addresses inside their canonical private profile. Each address has a stable UUID, its own revision, label, normalized postal fields and independent default-delivery/default-billing flags. Services enforce ownership and active-account authority; browser IDs never grant access. Writes use the shared Atlas transaction boundary, compare the address revision and containing profile revision, preserve exactly one default of each kind when addresses exist, and audit create/update/delete. Orders will copy address values rather than retain mutable references. Guests continue with form-only addresses and never acquire profiles from matching contact data.

Checkout legal acceptance carries immutable terms and privacy version IDs validated by the server. Both IDs and required acceptance are included in the quote fingerprint and source revisions, so a policy-version change requires a fresh quote. Optional marketing consent remains separate from pricing and quote identity; Phase 2A records it independently with the accepted order and must not infer it from legal acceptance.

FREE_SHIPPING is added to the canonical CouponKind registry and pricing version 2. It uses existing catalog scope, exclusion, audience, schedule, capacity and eligible-minimum rules. Its merchandise value is zero. An optional integer-paise cap limits the customer delivery saving; the pure pricing helper recalculates inclusive or exclusive delivery tax after the waiver without exceeding that cap. Automatic free delivery wins first. A coupon with zero effect because delivery is already free remains visible in the quote but must not acquire a claim in Phase 2A. COD surcharges are never waived.

Cart remains a preview: it can establish item eligibility but cannot know the destination delivery charge. Authoritative checkout resolves fresh goods first, resolves the reviewed shipping policy next, and applies the free-delivery waiver once. The quote exposes merchandise discount and delivery waiver separately while the displayed total includes both.

## Consequences and boundaries

No order, stock reservation, coupon claim, payment attempt or provider call is created in Phase 1B. Saved-address selection copies fields into the quote request; later edits cannot mutate a quote or order. Address data and checkout quotes are private and uncached. No new database index or dependency is required because addresses are bounded profile subdocuments and are never queried across customers.

Phase 2A must skip coupon acquisition when the accepted free-delivery effect is zero, and must revalidate address, legal-version, catalog, coupon and shipping facts before any write. Pricing version 1 snapshots remain historical; new quotes use version 2.
