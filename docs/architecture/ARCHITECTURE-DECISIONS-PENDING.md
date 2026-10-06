# Architecture decisions pending approval

Status: PROPOSED, not approved. Review date: 2026-10-06.

Purpose: settle choices that would be expensive to reverse before generating the foundation. No feature code has been created. Sources and their limitations are recorded in [research](../research/COMMERCE-REFERENCES.md); this document's recommendations are engineering judgments, not vendor requirements.

## Approval requested

Approve or amend these six bundles. The remaining defaults below do not need individual answers.

| Gate | Recommendation | Main consequence |
| --- | --- | --- |
| A: Build and tenancy | Custom single-tenant Next.js modular monolith, MongoDB/Mongoose; one deployment/database per client | Own the commerce correctness and maintenance; no separate Express service |
| B: Catalog storage | Separate sellable variants collection, including one default variant for simple products; stable IDs | Slightly more query/transaction work, much stronger SKU and stock constraints |
| C: Authentication | Better Auth with database sessions and official MongoDB adapter; application-owned server authorization | Auth adapter uses native MongoDB; commerce uses Mongoose; no duplicate password implementation |
| D: Transaction correctness | Integer paise pricing, transactional stock reservations, durable jobs/outbox, payment reconciliation and minimal refund records | Replica-set database and reliable scheduled execution are required from the first payment slice |
| E: Hosting baseline | Vercel paid deployment + managed MongoDB with verified backups for the first production client; retain VPS portability | Recurring service costs; no promise of free production operation |
| F: V1 boundary | Domestic India/INR physical goods first; work management last/off by default; homepage CMS layout remains undecided | Generic catalog supports different industries, but regulated/weight-priced goods need client extensions |

Approval is for architecture and the subsequent documentation/scaffolding stages, not permission to purchase services, connect production accounts, or start commerce implementation.

## 01. Build versus adopt (A)

**Problem:** a reusable platform includes financial correctness, operational UI and years of maintenance, not just a storefront.

**Options:** custom Next.js/MongoDB; Medusa-based application; CMS commerce template such as Payload. Saleor is another replacement platform, not an extra package to mix into this design.

**Trade-offs:** custom fits the selected stack and client override model but costs more engineering/testing. Medusa supplies commerce infrastructure but changes the backend/data model and deployment. A CMS template speeds content/admin work but still needs payment, tax and lifecycle validation for this scope.

**Recommendation:** custom only because reusable ownership, MongoDB and a single application are explicit objectives. If fastest launch is the primary objective, reconsider adoption before Stage 2. Do not copy Shopify assumptions from Vercel Commerce.

**Complexity/scaling/change cost:** medium-high total build responsibility; modular domains scale to the anticipated catalog without microservices. Switching platforms after storing orders is expensive.

## 02. Application boundaries and tenancy (A)

**Problem:** client reuse must not spread business rules across route files.

**Options:** one modular Next.js app; separate API service; multi-tenant SaaS.

**Recommendation:** App Router composes `src/modules/*`; server services own business rules; repositories own database access. Server Components call services directly rather than calling our own HTTP APIs. Route Handlers serve real integration/browser boundaries. One client per deployment/database/provider account. No Redis, Kafka, Kubernetes or generic plugin engine.

Store and admin have separate root layouts under route groups, each with html/body and its own UI imports; cross-root navigation may reload the document. API handlers live outside UI groups. Use Node runtime for database/payments/PDF.

**Trade-offs/change cost:** simplest operational shape, strong isolation but repeated deployments. Later extraction is possible at service boundaries; true multi-tenancy is an expensive new product decision.

## 03. Product and variant storage (B)

**Problem:** mutable arrays complicate globally unique SKUs, stock contention and stable cart references.

**Options:** embedded variants; separate variants; embedded variants plus separate SKU registry/inventory.

**Recommendation:** `products` stores shared merchandising data; `variants` stores every sellable unit, including one default variant for a simple product. Unique normalized SKU index and unique `(productId, combinationKey)` index. Parent product code is a grouping identifier, not a competing sellable SKU. Cart lines always refer to a stable variant ID and product ID.

Variant generator compares stable attribute/option IDs, preserves existing combinations and their IDs, previews additions/removals and archives removed variants. Never recreate all IDs. Renaming an option does not change identity. Bound the generated Cartesian product in UI and server validation.

**Trade-offs:** embedded variants are easier for one product read; separate variants require batching and aggregate projections, but avoid a second SKU registry. MongoDB unique multikey indexes do not solve duplicate values within one document. Stable IDs and normalized variants make a future warehouse extension easier without implementing it now.

**Complexity/change cost:** moderate; migration later is high because carts, stock, imports and payments depend on variant identity.

## 04. Attributes, facets and search

**Problem:** one base serves multiple industries without arbitrary unvalidated JSON or hardcoded laptop filters.

**Options:** arbitrary product fields; typed attribute definitions with product values; separate search infrastructure.

**Recommendation:** shared `attributes` with stable option IDs, typed values, units, visibility/filterability/variant-axis flags and display order. Inline creation in product editor remains possible. Embed values on products/variants; use `$elemMatch` for paired facet predicates. Variant filters must match the same sellable variant, avoiding false combinations from flattened parent values.

Store derived `minPrice`, `maxPrice`, `inStock`, and clearly defined `discountPercent` (maximum active-variant discount, displayed as "up to" where applicable), with a bounded flat facet representation. Recompute from authoritative variants after mutation, transactionally where feasible; repair job detects drift. Search name/SKU/brand/category/model/keywords with bounded indexed queries and normalized search fields; add indexes from query evidence. Never accept raw query operators from the browser.

**Trade-offs/change cost:** projections add write complexity but simplify listing reads. Search service is unnecessary for hundreds of products; later migration is moderate behind the search service. No unbounded regex scans or index on every attribute.

## 05. Money, pricing and GST (D/F)

**Problem:** browser prices and floating-point arithmetic cannot be financial authority.

**Options:** scattered arithmetic; one pure pricing engine; external tax/pricing service.

**Recommendation:** INR integer paise, validated safe-integer ranges, integer tax/percentage basis points, explicit rational intermediates and deterministic rounding. One pure server pricing engine handles catalog discounts, one non-stacking coupon initially, shipping, taxable bases and totals. Allocate order discounts proportionally across eligible lines, with deterministic remainder allocation; refunds refer to these allocations, not current prices.

Support inclusive/exclusive tax modes with an inclusive B2C default proposed per client. Resolve place of supply from validated seller/transaction/address facts; select CGST/SGST or IGST as applicable. Treat shipping tax, GST registration, HSN, rounding and special supply cases as explicit client tax configuration reviewed by a CA. Reject unsupported transactions rather than silently applying a guessed tax rate. Version pricing/tax policy in snapshots.

**Trade-offs/change cost:** pure engine is modest code but extensive edge-case testing. Domestic goods scope avoids pretending to support exports, services or precious-metal weight pricing. Changing historical arithmetic is prohibited; changing future policy is moderate.

## 06. Inventory reservation and expiry (D)

**Problem:** two buyers can pay for the last unit; unpaid orders can hold stock indefinitely.

**Options:** decrement only after capture; reserve during checkout; reserve when adding to cart.

**Recommendation:** reserve only when the server creates a priced order. Conditional availability update plus reservation/order/coupon reservation in a short MongoDB transaction. Track on-hand and reserved quantities; available = on-hand minus reserved. Capture consumes the reservation, reducing both on-hand and reserved exactly once; expiry/cancellation releases reserved only. Quantity-untracked items still require active/in-stock validation. Disable backorders by default.

Propose a 15-minute configurable reservation window, bounded retries and per-customer/IP controls to deter stock hoarding. A scheduled worker releases expired reservations transactionally. TTL indexes are cleanup aids, never business schedulers. No external network calls inside retryable database transactions.

Late captured payment after stock release must attempt safe re-reservation; if unavailable, hold fulfillment and create a refund-required exception for reconciliation. Never mark a paid order fulfilled with no stock. Changing product data after the order is priced does not rewrite its snapshot; expired quotes require a fresh order and customer review.

**Trade-offs/change cost:** more state than decrement-on-payment but prevents routine overselling. Replica set is mandatory even in integration tests. High change cost after launch.

## 07. Order, payment and refund lifecycles (D)

**Problem:** fulfillment, payment attempts and refunds are different timelines.

**Options:** single status string; separate bounded state machines; event-sourced system.

**Recommendation:** separate machines, append-only status history with actor/reason/time/correlation IDs, optimistic version checks, explicit transition functions. Proposal for orders: PENDING_PAYMENT, PLACED, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, EXPIRED. Payment attempts distinguish PENDING, AUTHORIZED, CAPTURED, FAILED; an order financial summary derives PENDING, PAID, PARTIALLY_REFUNDED, REFUNDED. Refund records preserve provider ID, amount, reason and PENDING/SUCCEEDED/FAILED state. Final enums will be defined once in Stage 2 and referenced elsewhere.

Failed attempts never downgrade a captured payment. COD acceptance does not mean payment received. Minimal refunds include recording/reconciling full or partial refunds and outstanding refund work; advanced returns/RMA remain outside V1. Refund total must not exceed captured funds. No automatic restocking just because a refund occurred.

**Trade-offs/change cost:** explicit machines are testable without event-sourcing infrastructure. High migration cost; define before CRUD.

## 08. Webhooks, checkout idempotency and recovery (D)

**Problem:** callbacks/webhooks can duplicate, arrive out of order or fail between provider and database writes.

**Options:** trust redirect; webhook only; callback plus durable webhook and reconciliation.

**Recommendation:** client idempotency key is scoped to customer/guest session and request fingerprint. Persist order/payment attempt first; call Razorpay outside DB transaction; record provider order binding. An ambiguous provider response enters reconciliation, not blind creation retry. Verify callback HMAC using stored provider order ID and verify payment amount/currency/order/capture state from trusted provider data.

Verify webhook signature against raw bytes before accepting. `webhookEvents` requires unique `(provider,eventId)`, payload hash, processing status, attempts and timestamps; conflicting duplicate payloads are flagged. Persist verified event before acknowledgement, then process via retryable job. Business-level uniqueness on provider payment ID prevents different events applying the same payment twice. One transition service handles callbacks, webhooks and polling.

**Trade-offs/change cost:** durable ingestion adds collections but avoids lost payment state. Medium-high implementation complexity; high change cost. Notification failures never roll back successful payment recording.

## 09. Invoices and numbering (D/F)

**Problem:** invoice numbers and legal snapshots cannot change when a product or order changes.

**Options:** number at checkout; allocate at invoice issue transaction; use external accounting.

**Recommendation:** allocate via `counters` scoped to seller/financial year/series inside the same transaction that inserts an immutable issued invoice. Unique invoice-number scope and idempotent issue operation. PDF rendering occurs afterward and can retry against the same document. Preserve voided numbers and reasons; never delete/recycle or renumber issued invoices to hide gaps. Credit/debit-note path references the original invoice.

Replace the blanket "gapless numbering" promise with a consecutive, auditable issue ledger. The CBIC reference supports consecutive numbering unique within a financial year; the exact issue timing, permitted series, amendments and e-invoice obligations need CA approval per client. Payment capture alone must not hardcode invoice timing for every business.

**Trade-offs/change cost:** external accounting could reduce legal-format work but adds a vendor dependency. Transactional issue ledger is moderate complexity, high historical change cost.

## 10. Background work without Redis (D/E)

**Problem:** expiry, reconciliation, imports and notifications must survive process shutdown.

**Options:** in-process timers; MongoDB jobs/outbox; external queue.

**Recommendation:** MongoDB durable jobs with unique business key, dueAt, attempts, lease owner/token, lease expiry and dead-letter status; atomic claim and fenced completion; bounded work batches. Commit outbox events alongside authoritative state changes. At-least-once execution, idempotent handlers and provider deduplication where supported; do not promise exactly-once email delivery.

Authenticated scheduled trigger runs expiry/payment recovery/outbox/import batches. VPS can invoke the same runner from a supervised process; serverless runs bounded scheduled invocations. Vercel plan must support the selected frequency and execution limits. Alert on oldest pending job and missed scheduler heartbeat. n8n consumes signed, minimized events asynchronously and never controls payment/stock correctness.

**Trade-offs/change cost:** modest database load and worker code; simpler operations than Redis for this scope. Queue replacement is moderate behind job contracts.

## 11. Guest and registered shopping state

**Problem:** persistence must not freeze mutable price/product details or create guest accounts.

**Options:** local IDs; cookie containing cart; server-side guest cart.

**Recommendation:** guest cart/wishlist stores only references, quantities and timestamps in local storage; registered state persists in MongoDB. Server resolves current public product data on display and always reprices checkout. A signed opaque guest checkout session scopes idempotency/order access, not trusted totals. Do not put PII in local storage.

Merge cart deterministically by variant ID, sum and bound quantities, report unavailable lines, revalidate coupon; wishlist is a union. Merge operation has a consumed token/revision so retries do not double quantities. Clear local state only after confirmed merge. Guest order lookup requires verified email link/OTP before detailed data or invoice access, with expiry, hashed tokens, throttling and neutral responses. Matching an account email does not silently attach an order.

**Trade-offs/change cost:** local storage loses cross-device guest continuity but avoids guest session storage complexity. Server guest carts can be added later with moderate cost.

## 12. Authentication (C)

**Problem:** registration, reset, sessions and admin security should not become bespoke cryptography.

**Options:** Better Auth; Auth.js; managed auth service.

**Recommendation:** Better Auth database sessions, official MongoDB adapter, email/password and verified recovery flows. Use native MongoDB collections managed by the adapter and Mongoose for commerce; avoid two independent user/password models. App profile/role links to the canonical auth user ID. Decide connection ownership and bounded pools explicitly during foundation implementation.

Auth.js remains a real alternative; its site identifies Better Auth Inc. ownership. Do not infer its exact release maturity from the historical beta claim in the attachment. Before installation, verify stable releases/advisories, adapter compatibility, reset/session revocation and indexes in a dependency plan. If that review fails, reopen C rather than silently changing libraries.

**Trade-offs/change cost:** self-hosted auth avoids per-user service dependence but retains security responsibility. Library replacement is expensive after users/sessions exist.

## 13. Authorization and last-admin safety

**Problem:** a valid session or hidden admin menu is not authorization.

**Options:** proxy-only; token role claims; data-access/service enforcement.

**Recommendation:** service/DAL checks on every protected read and mutation; database-verified active user role for sensitive operations. Proxy is an optional early redirect, never authority. CUSTOMER/STAFF/ADMIN with a small explicit action matrix; STAFF cannot edit roles, credentials or financial settings. Require ownership for customer data.

Role/deactivation changes revoke or invalidate sessions; no shared cache for permissions. Serialize administrator membership changes through a transaction touching a shared guard/counter so simultaneous demotions cannot remove both final admins. Audit actor and target. Guard bootstrap separately; no default credentials. Rate limits must work across instances, not just in-memory maps.

**Trade-offs/change cost:** extra DB checks buy immediate revocation. Moderate complexity; role-to-permission expansion can be gradual.

## 14. Rendering, filters and cache consistency

**Problem:** SEO needs public HTML while search/filter state is request-dependent.

**Options:** full client catalog; classic ISR with client filter endpoint; cached public functions plus dynamic server-filtered results.

**Recommendation:** Next.js 16 supported stable release, one Cache Components model using `use cache`, `cacheTag`, `cacheLife` and explicit invalidation. Keep request cookies/session out of shared cached functions. Public unfiltered product/category/brand content is cacheable; server-rendered filtered results use normalized validated searchParams and Suspense as required, normally noindex. Do not label every filtered route static ISR. Curated SEO landing pages are separately managed/indexable. Cart/checkout/account/admin/payment remain private and uncached.

Proposed tag contract: `product:{id}`, `catalog`, `category:{id}`, `brand:{id}`, `navigation`, `home`, `settings:public`, `sitemap`. All listing/search/related cached queries depend on `catalog` initially: coarse but auditable at this size. Mutations invalidate product + catalog + old/new category/brand + affected home/sitemap; slug changes persist redirects. Category/brand changes invalidate dependent public data. Cache projections exclude cost price, draft fields and PII.

Use immediate invalidation/read-your-writes where required; stale-while-revalidate only for acceptable public content. Invalidation after DB commit must be retryable through outbox if process fails. Client cart/wishlist re-resolve on focus and relevant mutations; checkout bypasses cache. Archived products must not remain purchasable due to public cache. Metadata and structured data consume the same public projection.

**Trade-offs/change cost:** dynamic filters cost server reads but preserve URL/share/accessibility semantics. Cache Components requires version-specific verification; moderate change cost. Exact pinned version and build behavior are Stage 3 checks.

## 15. PDF, media and rich content

**Problem:** invoices need predictable multi-page output on VPS/serverless; product content needs safe flexibility.

**Options for PDF:** pdf-lib (low-level control, manual pagination), pdfmake (declarative tables), @react-pdf/renderer (React document layout).

**Recommendation:** @react-pdf/renderer when invoice module begins, separate from browser UI; embed licensed fonts including rupee glyph; test long addresses, large line tables and page breaks. Store/reproduce issued snapshot and template version; private durable PDF storage and authorized downloads. Never rely on serverless local disk or publicly exposed invoice media. No Chromium in the application PDF path.

Cloudinary holds public catalog media with explicit roles, public IDs and bounded upload policy. Authenticated server signs upload parameters; deferred deletion respects references. Structured validated rich-content blocks instead of arbitrary HTML. Homepage configuration schema remains intentionally open until design approval. Static blog first.

**Trade-offs/change cost:** PDF library adds runtime weight; layout is easier than manual coordinates. Renderer replacement is moderate if invoice snapshots remain independent. Media provider replacement requires asset migration but not commerce rewrites.

## 16. Runtime and package manager

**Problem:** reproducible builds need one supported runtime and lockfile.

**Options:** npm already present; pnpm; mixed package managers.

**Recommendation:** npm for this single package, exact packageManager/runtime pins and package-lock with `npm ci`; no extra package manager required. Target Node 24 LTS, subject to host/library compatibility, instead of the observed Node 20 runtime. Next.js docs showed 16.3.8; Mongoose docs showed 9.11.0; Better Auth docs showed 1.7.7. These are research observations, not installed/approved lockfile versions. Recheck supported stable versions, advisories and peer dependencies before Stage 3.

Install minimum scaffold dependencies only. Add forms, auth/database, provider SDKs, PDF and CSV tooling when justified by scope. Vitest for pure rules, replica-set integration tests, Playwright for purchase/authorization. No broad unpinned `npx` skill install.

**Trade-offs/change cost:** npm is sufficient; pnpm would also be sound but adds setup. Low switch cost before dependencies, moderate later.

## 17. Hosting, backups and evolution (E)

**Problem:** cheap hosting is not useful if paid orders cannot be recovered.

**Options:** Vercel + managed MongoDB; managed VPS + managed MongoDB; self-managed app and database.

**Recommendation:** Vercel paid + managed transaction-capable MongoDB with selected backup capability for first production deployment. Vercel reduces app-host operations; VPS offers predictable worker execution/cost but needs patching, supervision and cache management. Preserve Node portability; do not self-host the production database initially. Validate scheduler cadence, function duration, DB connections and data region before purchasing a plan. No prices/budgets assumed.

Separate dev/staging/production databases, provider keys, media namespaces and email recipients. Staging noindex plus access control; no live checkout. Backups require documented retention, restore drills and a client-approved RPO/RTO; propose RPO <= 1 hour and RTO <= 4 hours, verify affordability before committing. Monitor app health, provider errors, reconciliation exceptions, job lag and uptime. A free development tier is not an accepted production recovery plan.

Version critical documents and migration scripts; expand/backfill/contract, resumable checkpoints, dry-run counts and rollback/restore strategy. MongoDB flexibility does not eliminate migrations. Auth-owned collection upgrades follow its adapter requirements.

**Trade-offs/change cost:** higher managed-service fees but less operational burden. VPS migration is moderate; shifting database/region and recovery guarantees is higher.

## 18. India compliance and scope (F)

**Problem:** reusable technical models cannot certify every client's legal/tax obligations.

**Options:** hardcode assumed compliance; client-reviewed policy/configuration; external tax/compliance service.

**Recommendation:** India domestic INR goods for initial checkout, with recorded terms/policy version acceptance, separate optional marketing consent, clear seller/contact/grievance information, returns/refunds/shipping disclosures, and privacy/retention controls. Plan verified access/deletion requests, with lawful retention exceptions for financial records and minimum necessary PII. Never erase invoices automatically when deleting an account.

Client legal/CA review must establish current E-Commerce Rules/amendments, DPDP commencement/applicability, consent/notices, GST/place-of-supply, invoice/credit-note format, e-invoicing applicability and retention. Official legal sources are linked in research; no blanket assertion of legal compliance or rollout dates. Regulated goods, variable-weight pricing, exports and international taxation are extensions, not silently supported by flexible attributes.

**Trade-offs/change cost:** client onboarding work avoids unsafe universal assumptions. Policy/content changes are low cost; new currencies/tax regimes are high.

## 19. Reuse, configuration and scope defaults

**Problem:** editing .env alone cannot customize a whole store safely.

**Options:** scattered conditionals; a narrow client override layer; general plugin architecture.

**Recommendation:** secrets/infrastructure in env; mutable business settings in database; static branding/design defaults and typed integration overrides in `src/client/`/config. Database-managed navigation can override static defaults. Overrides may select branding/components/rules through validated contracts, never bypass pricing or authorization. Template release tags and client upstream remotes require reviewed merges and migrations, not automatic updates.

Required collection families include auth-owned records, products, variants, attributes, categories, brands, carts, wishlists, orders, payments/refunds, reservations, invoices/credit notes, counters, coupons/redemptions, webhookEvents, jobs/outbox, settings, auditLogs, redirects, importJobs, pages, navigation, homepageConfig, contactSubmissions, and optional newsletterSubscribers/workTasks. This is a design inventory, not permission to generate empty schema files.

Minimum HTTP surface planned: auth catch-all, checkout creation/payment verification, Razorpay webhook, signed media upload, protected jobs trigger, health/readiness, guest order verification/access and authorized invoice download. Exact methods/access/rate limits belong in Stage 2. Use Server Actions for suitable first-party admin mutations.

Work management is postponed to the end/off by default, not silently removed. Reviews, marketplace, ERP, loyalty, dynamic blog CMS and complex returns remain excluded. Homepage CMS section design needs later explicit design approval.

**Trade-offs/change cost:** typed overrides require a few deliberate boundaries but avoid a speculative framework. Adding client branding is low cost; modifying core transactional invariants requires a new ADR.

## Approval record

No approval recorded yet. Record accepted gates, amendments, date and any unresolved hosting budget here before Stage 2.
