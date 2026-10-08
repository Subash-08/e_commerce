# Change-impact matrix

Shipping policy edits: validate the entire document, enforce ADMIN and expected revision, atomically preserve before/after audit snapshots, refresh the Admin page. No policy cache exists. Subsequent previews/resolution re-read policy and immutable tax references. Future order acceptance must revalidate revision; historical orders keep their snapshot. Restoring audit history creates a new revision and cannot grant tax approval. See [ADR 0012](../adr/0012-shipping-policy-and-calculation.md).

Rule: mutable catalog/profile/settings changes never rewrite existing order pricing/customer/address snapshots or issued invoices. Unpaid orders also preserve their accepted snapshot; expired or edited purchases require a new quote/order. Public cache is not a transaction authority.

| Change | Immediate authoritative writes | Live dependents | Invalidation/recovery | Historical behavior / tests |
| --- | --- | --- | --- | --- |
| Product name/description | Product revision | Detail/list/search/cart/wishlist/metadata | product, catalog, home, taxonomy | Order/invoice names unchanged; SHOP-01 |
| Variant price/MRP/tax | Variant revision + parent projection | Listing/offers/cart/wishlist/new quote | product, catalog, taxonomy, home | Existing quote snapshots unchanged; MONEY-01 |
| Media replace/reorder | Product/variant references | Cards/detail/cart/wishlist/OG | Same public tags; deferred orphan cleanup | Preserve retained historical asset or display neutral fallback; MED-01 |
| Product slug | Product + redirect atomically | Links/canonical/sitemap/breadcrumb | Old/new route paths + sitemap + catalog | Historical IDs unchanged; CAT-03 |
| Category/brand rename/reparent | Taxonomy revision, reject cycles | Breadcrumb/filter/nav/product metadata | Broad catalog, taxonomy, navigation, home, sitemap | Snapshot text unchanged; CAT-03 |
| Product taxonomy reassignment | Product + old/new memberships | Listings/counts/facets/related | Both old/new taxonomy tags + catalog | Historical classification snapshot remains; REP-01 |
| Attribute option rename | Attribute/value display + derived projection | Editor/spec/filter/variant label | All affected product/catalog tags, batched | Option/variant IDs stable; CAT-01 |
| Axis combination removed | Archive selected variant; never reuse identity | Cart unavailable, selector/filter | Product/catalog/taxonomy/home | Pending reservation honored or explicit cancellation/refund policy; CAT-02 |
| Archive/out of stock | Catalog eligibility | Listings/cart/new checkout blocked | Immediate invalidation + durable retry | Paid orders remain fulfillable/exception handled; STOCK-02 |
| Quantity/reservation change | Conditional variant balances + reservation | Availability displays/current checkout | product/catalog; invalidate after commit | Exactly-once consume/release; STOCK-01 |
| Toggle trackQuantity | Guarded admin migration; no active reservations | New checkout mode | product/catalog | Never discard active reservation balances; STOCK-03 |
| Coupon change/expiry | Coupon version | Fresh cart/quote; new claims | No shared checkout cache | Existing valid pending claim follows stored deadline; MONEY-02 |
| Shipping/tax settings | Versioned business settings | New quotes/public policy summary | settings:public + relevant content | Historical totals/policies unchanged; SET-01 |
| Customer profile/address edit | Profile/address only | Future checkout/account | Private refresh | Existing orders/invoices unchanged; SHOP-03 |
| Role/deactivation | Profile authVersion + audit/guard; revoke sessions | Next protected request | No cached permissions; retry revocation | Financial records retained; SEC-01/02 |
| Order transition/tracking | Guarded order revision/history | Account/guest/admin/email/job | Private re-fetch/outbox | No financial snapshot rewrite; ORD-01 |
| Verified capture | Payment/ledger/order; conditional consume | Fulfillment eligibility/report/notification | Same transaction + durable work | Duplicates cannot apply twice; PAY-01/02 |
| Late capture after expiry | Verified financial record + exception | Admin/customer refund or recovery | Reconciliation job; recheck availability | Never lose real money or restore stale stock; PAY-03/04 |
| Refund | Refund ledger and financial aggregate | Reports/admin/customer/credit note | Durable reconciliation/notification | Invoice stays issued; correction linked; PAY-05 |
| Invoice issued/void/corrected | Ledger/counter or append audit/correction | Download/admin/account | Retry render same invoice ID | No recycled numbers/repricing; DOC-01 |
| Page/policy publish | Immutable content version + publish pointer | Storefront/checkout consent | page, sitemap, settings where needed | Accepted version retained; CMS-01 |
| Navigation/home config | Validated published config | Header/footer/home | navigation/home | No order effect; CMS-01 |
| CSV row mutation | Same service as editor, revision guard | All normal catalog dependents | Batch/coalesce same tags; retries | No silent product deletions; IMP-01/02 |
| Template schema upgrade | Versioned migration/backfill | Old/new readers during rollout | Rebuild derived fields/tag invalidate | Immutable snapshots not retroactively recalculated; MIG-01 |

Cache invalidation must carry old and new memberships, not just the final document. Persist invalidation work with catalog writes; attempt immediate invalidation after commit and mark work complete. A failure stays retryable. Revalidate checkout independently even if every public view is stale.

Two admins editing the same revision receive a conflict instead of last-write-wins. Conflicts include stale CSV preview. Derived field repairs use the same projection definitions and record source versions; no second pricing formula.
