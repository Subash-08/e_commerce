# Admin workflows and product creation

Admin layout is separate from storefront, but server authorization remains mandatory. [Security](../security/SECURITY-MODEL.md) defines action permissions. Dashboard/report totals come from captured/refunded snapshots, not arbitrary chart data.

## Product editor

One workflow: basic identity/category/brand -> pricing/default variant -> media -> attributes -> variant builder -> details/SEO -> preview/publish. Attribute definitions/options may be created inline with server validation, stable IDs and reuse suggestions. Product-level copy remains on product; sale/cost/stock is variant-owned.

Variant generator previews combination diff: preserved, added, archived. Preserve IDs/SKUs/media/prices for unchanged option-ID combinations. Option label rename changes display only. Explicitly confirm archive operations; no re-generation that silently destroys references. Limit Cartesian explosion, unique SKU/conflict check, detect incompatible attribute type changes.

Simple product automatically has one default sellable variant. If adding axes, preview migration: archive/convert only with explicit identity mapping and no active reservation conflict. Default cannot silently be relabeled as an unrelated SKU. Switching quantity tracking requires zero active reservations and validated stock opening balance.

Quantity controls are conditional: status-only products show IN_STOCK/OUT_OF_STOCK; tracked products expose onHand and calculated reserved/available, with audited adjustments bounded below reserved. Staff cannot overwrite reserved. Media roles include thumbnail/cover/gallery/variant/video/detail blocks; signed uploads restricted by type/size/folder; reorder and alt text supported.

Publish validates sellable active variants, required copy/media/SEO facts and taxonomy; preview is authenticated/noindex. Save uses expected revision; conflict shows diff rather than overwriting. Slug changes create redirect and affected cache invalidation. Deletion defaults to archive.

## Other admin modules

| Module | Core actions / invariants |
| --- | --- |
| Taxonomy | Create/edit/archive categories/brands, hierarchy cycle prevention, SEO/media |
| Orders/customers | Guest label, snapshot detail, guarded confirm/process/ship/deliver/cancel, tracking, internal notes; no impersonation |
| Payments/refunds | View verified attempts/reconciliation exceptions; ADMIN refunds/corrections only |
| Invoices/labels | Issue under reviewed policy, private PDF/label, immutable historical data |
| Coupons/settings | Bounded discount rules, usage claims, versioned mutable business configuration |
| Reports | Paid/refunded/date/currency definitions; CSV escape spreadsheet formula injection |
| Users | ADMIN role/deactivation with last-admin guard and revocation; audit |
| Content/enquiries | Policies/navigation publish, spam-protected contact; homepage envelope only until design |
| Work | Optional tasks near end; linked entity references never change order authority |

## CSV architecture

Upload private immutable file -> validate header/encoding/size -> parse/normalize -> preview new/update/conflict rows -> explicit confirmation of inputHash/preview version/mode -> durable chunks -> counts/error artifact/history.

SKU identifies sellable variant; templateVersion specifies parent product grouping plus stable axis/option mapping. Preview detects duplicate SKU/combination, unknown taxonomy, invalid money/quantity, image URLs and stale revisions. Defaults do not erase omitted fields on update. No deletion from absent CSV rows. Arbitrary remote URL import is prohibited unless allowlisted/SSRF-safe.

Use catalog service validation for each row/aggregate, not raw bulk updates bypassing invariants. Each chunk/row has operation identity; a crash/retry cannot double-apply. Partial completion is explicit, error CSV downloadable privately, completed writes remain on cancellation. Preview revisions are rechecked at execution; conflict goes to error review rather than overwriting another admin.
