# ADR 0006: V1 scope and protected client reuse

Status: APPROVED, 2026-10-06.

Decision: India/INR physical goods first; guest and registered checkout, static blog, optional Work Management last/off by default. No reviews/comments, marketplace, multi-warehouse, ERP, loyalty, subscriptions, multi-currency or advanced returns. Homepage supports future configuration but section schema waits for storefront design approval.

Env holds secrets/infrastructure. Database holds mutable business settings. Config/src/client holds design/static defaults and typed supported policy choices. One deployment/database/credential set per client.

Transactional invariant changes (pricing, stock, order/payment transitions, invoice numbering) require a new ADR and land in the base template, never only a client fork. Selecting an already-supported tax/shipping setting is configuration, not an invariant rewrite.

Alternatives: scatter client checks across modules (easy initially, costly merges); general plugin engine (unnecessary). Template tags/upstream merges plus compatibility migrations provide deliberate reuse.

Consequences: custom client features can add fields/modules compatibly, but cannot bypass authoritative services. Production compliance is reviewed per client; flexible attributes do not imply regulated/weight-priced product support.
