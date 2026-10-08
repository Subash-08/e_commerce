# Catalog discovery query-engine evidence

Stage: implemented, listing UI deliberately not started. Fixture: isolated Atlas database with 250 products and 750 variants, 1,000 records combined. Two products are draft/archived. Test cleanup touches only the fixture-owned database/collections. No development catalog is rewritten.

## Contract

The server-only entry point is discoverCatalog(scope, URLSearchParams). All-products, category/descendants, brand and search share contracts, query normalization, repository aggregation and safe card mapping under src/modules/catalog/discovery. No public route is wired in this stage.

Repeated brand/category/availability and f.<attribute-code> parameters are OR within a dimension, AND across dimensions. Selectable attribute values use immutable option IDs; labels can change without breaking links. Attribute codes are already immutable in the attribute service. Numeric attributes use f.<code>.min/max. Price min/max accept decimal rupees and normalize to integer paise. Unknown parameters/options are ignored, duplicate selections deduplicate, invalid ranges fail explicitly. Caps: 4,096 encoded URL characters, 100 pairs, 20 values per dimension, 12 selected attribute dimensions, 120 search characters/eight terms, and 40 configured visible/filterable attributes.

The aggregation starts with public product scope, joins active/non-archived variants with populated URL keys, applies all variant conditions to each individual variant, then groups distinct products. Category ancestor counts deduplicate multiple category assignments. Inactive/missing parent chains and category cycles are excluded by bounded in-memory traversal of one taxonomy read. Every facet removes only its own condition. Selected zero-count values remain removable; high-cardinality text options expose truncation while preserving selected counts. Bounds exclude their own price/numeric range.

Representative variant: lowest matching GST-inclusive selling price, then immutable variant ID. Both price sort directions use that representative. Card MRP, discount, availability, media and readable URL come from the same variant; product image is the fallback. Cost, raw quantities/reservations, notes and provider asset IDs are never returned. All matching prices are calculated in Atlas with decimal half-up arithmetic consistent with the existing integer-paise engine; no duplicate price projection or filter-token schema was introduced.

Sorts: price-asc, price-desc, newest, name; relevance only when there is a query. Search requires all normalized terms across product name/model/tags and the SAME variant SKU. Ranking: exact SKU 200, exact product name 100, name phrase prefix 50, other term matches 10, then immutable product ID. This is bounded substring search over the scoped catalog, not Atlas Search or typo-tolerant search. No search-index service or package is installed.

New arrivals use first-publication time, preserved on later saves. Existing active products fall back to creation time where historical publication is unavailable. Pagination is 12 products with stable tie-breakers; page 1 permits empty results, valid numeric out-of-range pages raise PAGE_NOT_FOUND. Malformed page values normalize to page 1. UI filter/sort changes must reset page to 1.

## Scale and measured work

Five measured requests per case, each including fresh taxonomy reads. Reported empirical p95 is the largest of these five observations; it is a small diagnostic sample, not a production latency SLA or concurrency load test. Network latency to Atlas is included. Database operations are measured through the driver's supported monitorCommands constructor option on an isolated test client.

| Case | Observed p95 ms | Product docs examined | Product keys examined | DB operations |
| --- | ---: | ---: | ---: | ---: |
| All products | 354 | 248 | 248 | 4 |
| Category + descendants | 683 | 248 | 248 | 4 |
| Brand + price descending | 280 | 124 | 124 | 4 |
| Same-variant colour/memory + price | 354 | 248 | 248 | 4 |
| SKU search | 329 | 248 | 248 | 4 |
| Page 20 + price ascending | 345 | 248 | 248 | 4 |

All six cases used product IXSCAN plans. Unscoped/category/search cases used products_status_updated; selective brand used products_brand_status. Variant lookup used variants_product_active with zero foreign collection scans. Root documents examined were bounded by the 248 visible products (124 for the brand scope). Facet grouping and post-group sorting deliberately run in memory over this bounded catalog; allowDiskUse is false, the aggregation has a 1.8-second server limit and the existing shared connection has its own timeout.

Exactly three metadata finds plus one aggregation were measured per request, independent of products, selected values and facet count. Managed images add at most one batched lookup for the twelve returned cards; the benchmark used external URLs. No per-card, per-category-node or per-option queries. Existing indexes suffice: no new production index is added in this stage.

Taxonomy is memoized within a React server request, not cached across requests. At this scale, fresh lifecycle state and these measured timings favor this simpler approach over a persistent category-tree cache with another invalidation surface. Filter/search result combinations are never cached. This refines the earlier cache proposal explicitly; reconsider cross-request caching only if real usage warrants it.

Reproduce with the pinned Node runtime, importing scripts/load-environment.mjs, and Vitest's integration config targeting tests/integration/discovery.test.ts. The test emits full plans, individual samples and command names to ignored .validation/catalog-discovery-performance.json.

## Verification and limits

Four focused Atlas tests pass: mixed-variant false matches, GST price boundaries and self-excluding facets; duplicate category counts/pagination/private fields/draft-archive exclusion; deterministic representatives/sorting/SKU search/brand scope; realistic-scale measurement. Existing unit suite passes 184 checks including bounded query parsing. Typecheck/lint/production build pass.

The initial explain call failed because the driver's inherited timeout cannot be combined with maxTimeMS for explain. The probe now uses the existing timeout alone. One subsequent fixture insert hit a 2-second socket timeout; fixture-only insert timeout is now 10 seconds. Production query timeouts were not raised. Full-repository lint initially included generated .build-check output; that generated directory is now explicitly ignored by ESLint, matching .next and the Git exclusion. Command monitoring is enabled using a supported constructor option, not an internal property or cast.

Limits: no listing UI, route metadata, sitemap or public search endpoint was added. SEO/noindex behavior and filter URL navigation belong to the next UI stage. The measurement uses three attribute definitions; a forty-facet storefront or concurrent production traffic needs separate measurement. Infrastructure failures propagate; no sample products are substituted.
