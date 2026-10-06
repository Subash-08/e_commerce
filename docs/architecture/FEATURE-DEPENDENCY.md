# Feature dependency and connection matrix

Read/write names are conceptual collection families defined in [collections](../database/COLLECTIONS.md). Cache abbreviations resolve in [cache contract](CACHING-REVALIDATION.md). Tests refer to scenario IDs in [edge cases](../quality/EDGE-CASES.md).

| Feature | Depends on / used by | Reads / writes | Cache impact | Security / SEO / tests |
| --- | --- | --- | --- | --- |
| Auth/profile/roles | DB/email; all private actions | Auth/profile/guard/audit | Never shared-cache identity | DB role/owner, revocation; noindex; SEC-01/02 |
| Category/brand | Content; catalog/navigation | Categories/brands/redirects | catalog, taxonomy, home, navigation, sitemap | Staff edits, cycle/slug rules; breadcrumbs; CAT-03 |
| Attributes/variants | Taxonomy; editor/filter/cart | Attributes/products/variants | product, catalog, affected taxonomy | Stable IDs, unique SKU; accurate offers; CAT-01/02 |
| Media/content | Signed upload; editor/public pages | Media metadata/content/ref jobs | product/home/taxonomy | Asset ownership, XSS/SSRF limits; alt; MED-01 |
| Public listing/search | Public projection; shopping | Catalog/facets only | catalog + taxonomy | Never cost/draft data; index rules; SEO-01 |
| Cart/wishlist | Catalog/identity; checkout | IDs and current catalog / shopping, merge receipt | Fresh resolution, no private cache | Owner/signed guest; noindex; SHOP-01/02 |
| Pricing/coupons | Validated catalog/settings; checkout/refunds | Facts/coupon claims; pure calculator writes none | Checkout bypass | Ignore browser totals; MONEY-01/02 |
| Checkout | Identity, availability, pricing; orders/payments | Current facts / order, claims, reservation if tracked | Stock public invalidation | Idempotency and rate limiting; noindex; CHECK-01 |
| Reservations | Tracked variants; payment/expiry | Variants/reservations/orders | catalog/product | Conditional writes; STOCK-01/02 |
| Payment/webhooks | Order/provider; invoice/fulfillment | Payments/events/refunds / same + order | Private state only; stock impact via catalog | HMAC/trusted fetch/idempotency; PAY-01..05 |
| Guest tracking | Verified email token; customer support | Access grants/order snapshots | Private no-store | No account/email inference; SEC-03 |
| Invoices/labels | Order snapshots/issue policy; accounts/admin | Invoice/counter/credit notes | No public cache | Owner grants/immutable number; DOC-01 |
| Order admin | Verified payment/stock; fulfillment/report | Orders/audit/tracking | Private | Action matrix/guarded status; ORD-01 |
| CSV | Catalog validators/media; admin | Import job/input/errors / catalog batches | Same as normal catalog writes | Confirmation/version check/file limits; IMP-01/02 |
| Reports | Orders/payments/refunds snapshots | Ledger reads | Private bounded report cache only if role-scoped | No live catalog joins for money; REP-01 |
| Settings | Admin; pricing/content/ops | Versioned settings/audit | settings:public + dependents | No browser secrets; SET-01 |
| Jobs/outbox | Atomic domain writes; provider notifications | Small jobs/event families | Retried invalidation if needed | Protected trigger/leases; JOB-01 |
| Policies/navigation/CMS | Content/design; public/checkout | Pages/navigation/homepage config | page/navigation/home/sitemap | Publish validation/version consent; CMS-01 |
| Optional work/newsletter | Role/consent; staff/marketing | Optional workTasks/subscribers | None or public form only | Disabled by default, no checkout coupling |

Implement dependencies before broad UI, but test the purchase path early through a minimal fixture-backed test slice after pure pricing/state contracts. [Roadmap](../development/DEVELOPMENT-ORDER.md) resolves ordering.
