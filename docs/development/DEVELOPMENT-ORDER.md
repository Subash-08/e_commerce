# Development order

Current authorization: Part 4B database foundation, following verified Part 4A. Database verification is in progress; use mongodb-memory-server, no Docker. Review [outstanding static findings](../database/STAGE-4B-CODE-REVIEW.md) alongside the Antigravity report. Stop after 4B; auth installation, catalog and UI remain separately gated.

| Part | Deliverable | Exit evidence |
| --- | --- | --- |
| 4A | Vitest, pure integer-paise pricing, order/payment/refund/reservation functions | Worked examples, conservation, state guards, in-memory race tests, build and documentation checks; stop |
| 4B | Shared Mongo connection, transaction-capable replica-set test DB, reviewed index check/apply scripts; written auth compatibility report only | Real connection/rollback/concurrency tests, ownership and exact driver compatibility; stop; no Better Auth install |
| Auth slice | Install/integrate auth only after written compatibility gate passes and separate authorization | Recovery, revocation, role/deactivation and shared-client integration tests |
| 4C | Category, Brand, Attribute, Product, Variant; media/read contracts, repairable projections, fixtures and query review | Model/index/unique-race tests, measured explain/p95 report; stop |
| 4D | Purchase-support orders/payments/refunds/reservations/webhookEvents/jobs/counters/settings/redirects and indexes | Durable identities, expiry queries, transactions and slug redirect integration; stop |
| Purchase slice | Real product/default Variant, cart, guest checkout, server repricing, order snapshot, Razorpay test capture/webhook/reconciliation | Real PAY-03/04 and expiry/capture races; tracked-only inventory effects |
| Catalog/admin | Product editor, stable option/variant generation, media, CSV and bulk operations | Reuse catalog services and constraints |
| Storefront/operations | Listings/search/filter/detail/shopping/account, then approved homepage and invoices/labels/reports/notifications | Public projections, security/SEO, snapshot and operational correctness |
| Launch | Legal/CA, security, accessibility, performance, backup/restore and deployment review | Evidence on actual host, no unresolved critical correctness gate |

## Carry-forward requirements from the Stage 4 review

- Every index names its filter, sort, range, selectivity, existing-prefix coverage and write/storage cost. No automatic production syncIndexes or index drops.
- Catalog fixtures remain under tests/fixtures, guarded against production, with 5,000 products and at least 20,000 variants.
- Record plans for documented hot queries: no COLLSCAN or in-memory sort, explain examined/returned ratios near one where realistic, and measured p95 targets/baselines on the recorded machine. Do not present fixture timings as guarantees.
- Primary category must belong to categoryIds; validate and test. schemaVersion applies where evolution/migrations need it.
- Facet tokens use stable attributeId:optionId pairs. Product-level token unions support candidate filtering; variant predicates must match the same Variant. Include the Black/8GB vs Silver/16GB regression by name.
- Decide the SKU search path in 4C: Variant lookup first or validated active-SKU projection; document one approach.
- Product summary is derived from authoritative Variant facts and has a repair path. No per-listing aggregation of every Variant or N+1 hydration.
- Create cache-tag helpers in 4C; real use-cache pages wait for storefront work.
- Category rename/archive/hierarchy policies precede UI. Slug-change integration depends on 4D redirects; do not claim those integration tests complete in 4C alone.
- Provider IDs use appropriately scoped partial unique indexes for present valid IDs; preserve the approved provider/payment and provider/event identities rather than accepting unsafe null uniqueness.
- Settings, jobs, reservations and financial models precede purchase orchestration. Real last-unit/expiry races require the replica-set gate, regardless of passing pure tests.
- Host/scheduler choice precedes jobs; homepage design precedes homepage work; CA/legal review precedes production tax/invoicing.

Update documentation alongside the code that changes a contract. Never let later UI work bypass an unresolved data/transaction gate.
