# ADR 0010: Catalog price entry and public variant identity

Status: implemented under the user's product/variant authorization, 2026-10-08.

Products require one brand, at least one category and an explicitly selected primary category. Variants remain separate sellable records with immutable IDs and option combinations. Product revisions cover the complete editor save. Removing a variant archives it; SKU, barcode and combination identity remain reserved. Nothing hard-deletes historical variants. Inventory mutations added later must participate in the product revision contract.

## Price entry

Each variant stores integer-paise MRP and selling price in its selected tax mode, with GST in basis points. Enter the selected inclusive or exclusive rate; the other rate is derived by the existing deterministic pricing engine. Mode changes convert both MRP and selling price using the same half-up rounding rules. A percent or fixed discount edits the selling price; discount is not charged again. Public prices always show the computed inclusive amount. Private cost never enters public data.

Immutable tax policy records are keyed by mode, rate and policy version in `taxPolicies`. These replace the earlier proposal to embed every policy in mutable settings. Catalog saves create the corresponding versioned record transactionally. Checkout must resolve the key, choose jurisdiction-specific tax components and snapshot the policy; this catalog feature does not implement checkout or establish a client's applicable tax rate. No automatic 18% default is assumed.

## URLs and caching

The base URL is `/product/[slug]`; a selected variant uses `?variant=<immutable ID>`. The canonical and Open Graph metadata stay product-level. Query variants are not separate sitemap entries and do not receive a query-only noindex directive. Drafts and archived products return public 404; authorized draft previews are dynamic and noindex. Missing, archived or another product's variant ID falls back with a visible notice.

This project pins Next 16.3.8 without Cache Components. Reading search parameters makes the response dynamic, while `unstable_cache` retains the public database projection keyed by slug. Initial selection and structured data are server-rendered; browser history updates switch variants without fetching the projection again. ProductGroup includes active visible variants and truthful InStock/OutOfStock offers. Rich Results validation remains a manual release check.

## Media

Thumbnail, optional hover image, gallery, variant images and ordered manufacturer A+ sections have separate roles. References contain exactly one managed asset ID or public HTTPS URL, plus alternative text. Existing first-gallery-image covers are read compatibly as thumbnails. Uploaded image IDs are checked transactionally. External URLs are rendered unoptimized by the browser and are never imported or fetched by the server. Uploads happen before saving references, outside transactions. Shared assets are retained when unassigned; automated orphan cleanup is not yet delivered and must check every catalog reference before deleting any provider asset.

Product images and YouTube/Cloudinary videos share one storefront gallery. YouTube uses a click-to-load privacy-enhanced embed with a narrow frame CSP. Manufacturer images preserve their aspect ratio below the product details. Video uploads are bounded to 3 MB; images to 900 KB.

## Concurrency and recovery

Category and attribute guards serialize reference changes. A published product's primary category cannot be deactivated or archived until reassigned; secondary category removal does not break product identity. Brand writes serialize against brand availability changes. Stock cannot go below reservations, and reserved variants cannot be removed or made unavailable. No provider calls occur inside the transaction.

The pinned MongoDB 7.7 bulk-write helper resolves inherited operation timeouts twice and rejects a timed transaction. The catalog repository uses ordered update commands on a lightweight Db handle sharing the same MongoClient, with no inherited operation timeout; the existing 10-second transaction deadline still applies. No new client, dependency override, driver patch or unbounded transaction is introduced.

Catalog mutations persist cache invalidation jobs. Immediate bounded retries use lease tokens and retain failures. The public projection additionally expires after 60 seconds. A deployed scheduler and reviewed dead-job replay remain operational gates; this is not a claim of unattended recovery.

## Sources

- [Next caching without Cache Components](https://nextjs.org/docs/app/guides/caching-without-cache-components)
- [Google product variants](https://developers.google.com/search/docs/appearance/structured-data/product-variants)
- [Shopify variant links](https://shopify.dev/docs/storefronts/themes/product-merchandising/variants)

Schema and limits live in the catalog validation module; status definitions remain in [the central registry](../commerce/STATE-MACHINES.md).
