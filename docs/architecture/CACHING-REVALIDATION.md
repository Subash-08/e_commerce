# Rendering and cache contract

Target Next.js 16 stable with Cache Components, conditional on the exact version's verified APIs. Use one model: public cache functions with use cache/cacheTag/cacheLife; dynamic request boundaries for personalization/searchParams. Do not import old unstable_cache recipes interchangeably. [Route matrix](../storefront/ROUTES.md) is authoritative for route strategy.

| Tag | Data/readers | Mutation triggers |
| --- | --- | --- |
| product:{id} | Detail/public product projection/metadata | Product, variant, relevant attribute/media change |
| catalog | Listings, facets, search cache, related products | Any eligibility/price/content/stock/taxonomy change |
| category:{id}, brand:{id} | Taxonomy landing/breadcrumbs | Taxonomy edit, product reassignment (old and new) |
| home | Approved home composition/public merchandising | Referenced product/taxonomy/config publish |
| navigation | Published menu/breadcrumb taxonomy | Menu/category change |
| settings:public | Public store/SEO policy subset | Relevant store setting publish |
| sitemap | Discoverable URL set | Publish/archive/slug/indexability changes |
| page:{slug} | Published policy/content | Page publish/slug change |

Initial proposal: catalog content max-age ceiling 5 minutes, taxonomy/content 1 hour; events invalidate sooner. These are design defaults to measure, not a reason to cache checkout. Cart/wishlist, account, admin, order access, invoices, checkout/payment and auth use private/no-store responses and uncached authoritative services.

A mutation transaction records source changes, revision/projection updates and deduplicated invalidation work. After commit, invalidate affected tags/paths promptly; worker retries failures. Choose exact updateTag/revalidateTag behavior after checking the installed Next release: read-your-writes admin paths need immediate freshness, not default stale-while-revalidate. Never invoke network/Next invalidation inside a retrying Mongo transaction.

Server filtered listings normalize allowlisted query fields and sort/pagination. Filter combinations are normally noindex; unfiltered taxonomy/product pages have shared cached content. Per-request searchParams is resolved outside cached functions and only normalized public values may become bounded cache keys. Avoid caching an unbounded query space; default filtered queries to uncached DB reads initially.

A coarse catalog tag is intentional for hundreds of products. Public DTO excludes draft/private/cost/customer fields. Metadata, visible price/availability and JSON-LD derive from that DTO; do not maintain a separate SEO price cache.

VPS: start with a single application replica per client and persistent Next cache across appropriate restarts; build/deploy cache version must prevent old schema artifacts. Multi-replica hosting requires a verified shared cache/invalidation strategy before scaling; no Redis baseline. Vercel uses its supported cache adapter. Neither CDN nor Nginx may cache Set-Cookie/private/payment/API responses. Cache correctness tests run on both deployment profiles before production.

Client shopping state refreshes after mutation, focus and server validation responses. An unavailable product is excluded from payable totals but remains explainable/removable in cart.
