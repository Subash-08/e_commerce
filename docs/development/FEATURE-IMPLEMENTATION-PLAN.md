# Feature implementation and orchestration plan

Updated 2026-10-07 after evaluating the user's catalog review. This replaces the old schema-first work sequence. Follow [progress](../PROGRESS.md) for actual completion; a planned row is not an implemented feature.

## Decisions applied

- Atlas only. No Docker, local MongoDB, embedded database or application fallback. Normal runtime uses the configured database. Automated integration fixtures use uniquely named Atlas test databases and remove only collections they created; never run their cleanup against the shared application database.
- Finish Auth before catalog mutations. Each subsequent feature includes model, reviewed indexes, validation, repository, service, authorized actions, working UI and critical verification.
- Basic stock belongs to Variant: status-only or quantity-tracked. Reservations belong to checkout. Suppliers, purchases and warehouses remain outside V1.
- Bring the shared Cloudinary media integration forward to Category, which already needs thumbnail/banner uploads. Reuse it for Brand and Product. Product video/rich media comes later. Cloudinary keys are configured locally; never committed or printed.
- Bring redirect persistence forward to the first category slug edit. Never postpone redirects until order records.
- Use existing canonical state/field contracts rather than copying suggested enums and fields from a prompt. Category currently has active plus archival semantics; Product uses the canonical catalog lifecycle.
- Metadata, canonical validation, hierarchy safety, private/public projections and cache invalidation belong to each public feature. Avoid arbitrary canonical URLs and speculative index lists.
- Coupon, shipping and tax quote rules plus immutable order/payment records precede checkout/payment execution. Full operations screens may follow later.

## Delivery order

| Step | Deliverable | Completion boundary |
| --- | --- | --- |
| 1 | Close Auth | Audited missing-profile repair; real Atlas role/session/last-admin/reset checks; usable Users UI; static/build/security checks; progress and commit |
| 2 | Category + shared media + redirects | List/create/edit, bounded hierarchy and cycle prevention, active/archive policy, stable slug/manual edits, redirect history, Cloudinary upload/assignment, SEO fields, public projection and durable cache invalidation |
| 3 | Brand | Real list/editor, logo/banner through shared media, status/archive, slug redirects, SEO/public projection and invalidation |
| 4 | Attributes | Typed definitions and stable option IDs, create/edit/retire/reorder, filter/visibility/variant-axis settings |
| 5 | Product + Variant with usable editor | Stable SKU/combination identity, default variant, integer paise pricing, optional quantity stock, media, typed attributes and repairable derived listing summary; private costs excluded from public DTOs |
| 6 | Catalog reads and performance | Product/category/brand/search/filter UI and metadata; same-variant filtering; bounded projections; measured explain plans with isolated representative fixtures |
| 7 | Thin purchase foundations | Order/payment/refund snapshots, reservation persistence, tax/shipping/coupon rules, deduplicated webhooks and required durable jobs; settle host/scheduler before job runner |
| 8 | Cart, wishlist and guest purchase | Current server reads, fresh quote, idempotent checkout, Razorpay test payment/webhook, expiry/late-capture recovery; prove one real end-to-end purchase |
| 9 | Operations | Orders, fulfillment/cancellations/refunds, coupon configuration, notifications and useful reports |
| 10 | Invoices | Legal/CA-approved rules, immutable issuance, numbering, private PDFs and downloads |
| 11 | Content and launch | Approved homepage design/CMS, bulk/import tools where needed, backup/restore, monitoring, production email/payment verification; optional Work last |

Build one feature at a time and commit a verified slice. Category comes before Brand; do not mark either complete with placeholder screens or unavailable media disguised as working uploads. No catalog feature was implemented by this plan update.

## Verification and responsibilities

Codex handles invariants, concurrency, backend design and useful full-stack changes. Antigravity can execute routine checks at a stable commit when the user requests a handoff; never run competing writers in the same checkout. Keep checks proportional: authorization, uniqueness, hierarchy/slug races, private data and financial/recovery behavior matter more than repeated form-rendering tests.

Run focused checks while implementing and the required lint/typecheck/build/security checks at closure. Preserve existing tests and report actual failures. Do not replace tested behavior with mocks to declare an Atlas gate passed. Update only relevant docs with code changes.

## Inputs needed at their point of use

| Feature | Required configuration or decision |
| --- | --- |
| Category uploads | CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET locally; signed controlled uploads and media ownership |
| External auth recovery email | Select Resend or n8n, verified sender and credentials; development mailbox remains for local verification |
| Durable purchase jobs | VPS/Vercel choice, authenticated scheduler cadence and connection budget |
| Payments | Razorpay test credentials and webhook secret |
| Invoice issuance / launch | CA/legal rules, production provider activation, storage and backup/restore acceptance |

See [collection contracts](../database/COLLECTIONS.md), [cache contract](../architecture/CACHING-REVALIDATION.md), [change impact](../architecture/CHANGE-IMPACT-MATRIX.md) and [route contracts](../storefront/ROUTES.md).
