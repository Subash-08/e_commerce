# Repository instructions

## Read before working
- Read docs/PROGRESS.md for the current gate and outstanding work.
- Read docs/architecture/ARCHITECTURE-DECISIONS.md and relevant ADRs.
- Parts 4A/4B are accepted. AUTH-DECIDE passed; the user authorized AUTH-CORE on 2026-10-07 with the production-driver criterion in ADR 0003. Read docs/database/AUTH-SPIKE-REPORT.md. Use MongoDB Atlas only; no local MongoDB, Docker or memory-server. Complete auth before catalog; no homepage or unrelated UI work.
- Codex handles complex implementation; Antigravity handles delegated tests/checks. Do not claim 4B complete before real replica-set evidence and all handoff gates pass.
- Preserve existing work. Work on a stage branch, commit each completed stage, never force-push or use destructive Git.
- Never read .env* files except .env.example; never print environment values.
- Do not install dependencies, skills or MCP servers without the applicable approved plan.

## Architecture
- Custom single-tenant Next.js modular monolith; MongoDB/Mongoose commerce.
- Routes compose modules; services own rules; repositories own persistence.
- No separate Express backend, microservices, Redis, Kafka or warehouse/ERP scope.
- Keep both VPS and Vercel portable deployment paths.
- Use server components by default and client islands for interactions.
- Auth is conditionally Better Auth. Follow docs/adr/0003-auth-and-connections.md.
- One shared MongoClient per process/isolate; no per-request connection creation.
- Do not maintain a second password/auth-user implementation.
- Enforce roles, ownership and active-user checks at service/data boundaries.
- Never trust browser role, price, stock or total values.

## Commerce invariants
- All money is integer paise; one deterministic pricing engine.
- Products/variants are mutable; orders and issued invoices preserve historical snapshots.
- Cart/wishlist resolve current public product/variant data.
- Checkout performs fresh server validation and pricing.
- Preserve stable variant and option IDs across edits/regeneration.
- Reserve stock only where trackQuantity is true.
- Untracked stock uses availability status; no synthetic reservations.
- Separate order, payment, refund and fulfillment-exception states.
- Verify, persist and deduplicate webhooks; share one payment transition service.
- No external provider call inside retryable database transactions. Every repository operation in a transaction must receive its explicit ClientSession; callbacks are replay-safe, sequential and bounded.
- Jobs are a small closed set for required durability; no generic workflow framework.
- n8n/email/analytics do not control transaction correctness.
- Guests never acquire accounts or order ownership just because an email matches.
- Changes to pricing, stock, order/payment state machines or invoice numbering require a new ADR and must land in the base template, never only a client fork.

## Changes and quality
- Use docs/commerce/STATE-MACHINES.md as the sole enum/transition registry.
- Use docs/architecture/CHANGE-IMPACT-MATRIX.md for linked effects.
- Invalidate public caches after catalog mutations; retry failed invalidations.
- Keep metadata/structured data consistent with the public projection; no fake reviews.
- Keep all cost prices, customer data and unpublished content out of public projections.
- Use optimistic concurrency, DB constraints and transaction tests for critical races.
- Never silently substitute mock products/orders/payments on infrastructure failure.
- Put fixtures in tests/fixtures only.
- Add fields compatibly; use reviewed migrations/backfills and schema versions.
- Tests must include late payment after reservation expiry with and without remaining stock.
- Run applicable link/diagram checks for docs and lint/typecheck/build/tests once code exists.
- Report checks actually run and limitations. Update docs/PROGRESS.md each stage.
- Stop at the authorized gate; do not mark planned business features implemented.
