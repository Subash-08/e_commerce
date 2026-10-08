# ADR 0010: Catalog price entry and public variant identity

Status: implemented under the user's product/variant authorization, 2026-10-08.

Products require one brand, at least one category and an explicitly selected primary category. Variants remain separate sellable records with immutable IDs and option combinations. Product revisions cover the complete editor save. Removing a variant archives it; SKU, barcode and combination identity remain reserved. Nothing hard-deletes historical variants. Inventory mutations added later must participate in the product revision contract.

## Price entry

Each variant stores integer-paise MRP and selling price in its selected tax mode, with GST in basis points. Enter the selected inclusive or exclusive rate; the other rate is derived by the existing deterministic pricing engine. Mode changes convert both MRP and selling price using the same half-up rounding rules. A percent or fixed discount edits the selling price; discount is not charged again. Public prices always show the computed inclusive amount. Private cost never enters public data.

Immutable tax policy records are keyed by mode, rate and policy version in `taxPolicies`. These replace the earlier proposal to embed every policy in mutable settings. Catalog saves create the corresponding versioned record transactionally. Checkout must resolve the key, choose jurisdiction-specific tax components and snapshot the policy; this catalog feature does not implement checkout or establish a client's applicable tax rate. No automatic 18% default is assumed.

## URLs and caching

Decision amended 2026-10-08 under explicit user approval: public variant selection moves from `?variant=<immutable ID>` to `/product/[slug]/[variantKey]`. The base product stays canonical with product-level Open Graph metadata; variant paths receive no variant-only noindex. Demo products retain their independent noindex setting. Only base product URLs belong in the future sitemap (the sitemap endpoint is not implemented yet).

Keys are server-owned, immutable after allocation, unique per product including archived variants, ASCII lowercase/hyphenated, and at most 80 characters. Initial option labels (then title/SKU fallback) supply the readable stem. Collisions receive bounded -2, -3 suffixes. Reserved keys include new, edit, preview, admin, api, v and unavailable. Non-Latin-only labels safely fall back to variant. Browser input cannot set keys. A partial unique index supports additive migration of existing records; all newly saved variants receive keys. The original immutable variant ID remains the reference for carts, wishlists and orders.

Keep the approved direct path shape rather than adding /v/: reserved keys avoid foreseeable route collisions without another public URL change. The shared Next proxy emits actual HTTP 301 responses (Next permanentRedirect would emit 308). Legacy ID links and old product slugs resolve by entity ID directly to the latest product slug and persisted key. Explicit path selection wins over a conflicting query selector. Archived keys stay reserved and render the default selection with a notice; unknown or wrong-product ID links normalize to the reserved unavailable path. Draft/archived products and unavailable brand/primary category remain hidden. Product slug history is flattened by the existing transactional save.

This project pins Next 16.3.8 without Cache Components. Request-specific initial selection and structured data remain server-rendered; the safe public projection is cached by product slug with the catalog tag and 60-second expiry. Variant links are crawlable anchors, with normal Next navigation and Back/Forward support. Authenticated admin preview keeps its query-based selector. ProductGroup URLs point at readable variants with truthful InStock/OutOfStock offers. Rich Results validation remains a manual release check.

Migration: `npm run catalog:urls:check`, then `npm run catalog:urls:apply`. It validates existing keys, allocates missing keys deterministically, serializes each product transaction against editor saves by advancing the product revision, updates only missing variant keys/revisions, records an operator audit and cache job, and creates only the reviewed unique key index. Re-running is a no-op for populated keys. The public reader refuses to cache variants with missing keys; authenticated previews can still read legacy records. Deployment must run the migration before exposing readable URLs. No content, price, quantity or reservation reset occurs.

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

## Approved discovery follow-up (not implemented in the URL stage)

The deployment target is at most about 1,000 product and variant records combined. Reject the suggested 5,000/20,000 synthetic benchmark, mandatory filter-token duplication, and blanket ban on every COLLSCAN or in-memory sort. Inspect representative Atlas explain plans and bounded operation counts at the actual ceiling; a small metadata scan or bounded post-group sort can be reasonable. Do not build a cache entry per arbitrary filter combination.

Use one normalized scope/filter/sort/page contract, same-variant price/availability/option matching, distinct product counts, and facets excluding their own filter. Scope product candidates before variant work when selective; the physical pipeline need not always start from all variants. Stored minPricePaise is usable only without variant filters and with a current source revision. Deterministic representative: lowest matching payable price, then stable variant ID; no new sort-order field is needed just to break ties. Card price, MRP, discount, image, URL and availability come from that representative.

Resolve category descendants from one bounded cached category-tree read, traversed with cycle/depth guards; avoid per-product recursion and ancestor backfills. Initial search will use bounded normalized terms over product name/model/tags plus SKU candidates from variants. Define actual scoring before exposing Relevance; never label arbitrary database order relevance. Search/facet implementation and query-plan measurements are the next stage, followed by another stop before listing UI.

Normalize and cap all query inputs; resolve public attribute codes/option identifiers through reviewed definitions, never labels or browser Mongo operators. Selected zero-count values remain removable. Price bounds exclude the price filter. All listing routes share 12 products per page, stable tie-breakers and page reset on filter/sort changes. Out-of-range numeric pages return not-found. Clean pagination self-canonicalizes; filtered/search pages are noindex and crawlable. Cache base projections/taxonomy only initially; filtered/search results stay dynamic.


## Discovery implementation refinement, 2026-10-08

The query-engine stage is implemented with a bounded Atlas aggregation over the existing product/variant relations; no filter-token or extra index duplication. All facets operate on same-variant candidates before grouping and exclude their own filter. The representative is lowest inclusive payable price then variant ID. First-publication time is added compatibly and retained on edits; historical active records fall back to createdAt.

Taxonomy is fresh per request and React-request memoized rather than persistently cached: at 1,000 combined records, measured query work is bounded and this avoids stale lifecycle state. Price is derived in the aggregation with decimal half-up arithmetic; no stale listing summary is used. Search is a bounded term match with documented exact-SKU/name scoring. Stable attribute codes and immutable option IDs form filter URLs. See [query-engine evidence](../database/CATALOG-DISCOVERY-VERIFICATION.md) for contracts, plans, latency limits and the explicit pre-UI stop.
