# App Router route and rendering matrix

Implementation note (2026-10-07): the four account entry/recovery pages and the allowlisted auth API are implemented; account/admin layouts are guarded. The other feature routes remain visibly marked placeholders. The matrix below is the full target contract, not a claim that all features exist. Route groups do not change URLs. Store root: src/app/(store)/layout.tsx; admin root: src/app/(admin)/layout.tsx around admin URLs. No shared root importing storefront UI. API handlers sit at src/app/api. Both roots own html/body. Cross-root navigation can reload the document.

Legend: PUBLIC = cached public Server Component content; DYNAMIC = per-request server content with client interaction islands; PRIVATE = dynamic/no-store with identity checks. Cache tags are from [cache contract](../architecture/CACHING-REVALIDATION.md). Public cached data never includes cookies/session/PII.

| URL / page.tsx relative to group | Strategy/cache | Revalidation | Indexability | Access |
| --- | --- | --- | --- | --- |
| / | PUBLIC + optional personal islands | home/catalog/navigation/settings | index | Public |
| /about, /contact, /faq | PUBLIC content + form island | page:{slug}/settings | index | Public; rate-limit forms |
| /terms, /privacy-policy, /shipping-policy, /cancellation-policy, /return-refund-policy, /warranty-policy | PUBLIC versioned policy | page:{slug}/sitemap | index | Public |
| /products | PUBLIC unfiltered; DYNAMIC filtered | catalog | index unfiltered; filters noindex | Public |
| /product/[slug] | PUBLIC detail/metadata; client variant/gallery | product/catalog/taxonomy | index active | Public projection |
| /category/[slug], /brand/[slug] | PUBLIC landing; DYNAMIC filters | taxonomy/catalog | index base; filters noindex | Public |
| /search | DYNAMIC normalized query; no shared query cache initially | fresh query | noindex | Public, rate-limited |
| /cart, /wishlist | PRIVATE or guest reference resolution | fresh data | noindex | Guest/account |
| /checkout | PRIVATE authoritative quote | uncached | noindex | Guest/account |
| /payment/success, /payment/failed, /payment/pending | PRIVATE verified state; URL not truth | uncached | noindex | Owner or guest grant |
| /login, /register, /forgot-password, /reset-password | DYNAMIC forms | uncached | noindex | Public, throttled |
| /account, /account/profile, /account/addresses, /account/orders | PRIVATE | uncached | noindex | Account owner |
| /account/orders/[orderNumber] | PRIVATE snapshots | uncached | noindex | Owner check |
| /track-order | DYNAMIC challenge; PRIVATE result | uncached | noindex | Verified guest grant |
| /blog, /blog/[slug] | Static local content initially | deployment/content publish | index published articles | Public |
| /admin | PRIVATE dashboard | uncached | noindex | Staff/admin |
| /admin/products, /admin/products/new, /admin/products/[id]/edit | PRIVATE | fresh admin reads | noindex | Staff/admin |
| /admin/categories, /admin/brands | PRIVATE | uncached | noindex | Staff/admin |
| /admin/customers, /admin/customers/[id] | PRIVATE | uncached | noindex | Staff/admin, minimized PII |
| /admin/orders, /admin/orders/[orderNumber] | PRIVATE | uncached | noindex | Guard each operation |
| /admin/payments, /admin/invoices | PRIVATE | uncached | noindex | Staff read; admin money actions |
| /admin/coupons, /admin/reports | PRIVATE | uncached | noindex | Admin |
| /admin/import, /admin/export | PRIVATE | uncached | noindex | Staff/admin catalog only |
| /admin/homepage, /admin/pages, /admin/navigation | PRIVATE | uncached | noindex | Staff/admin; homepage placeholder only |
| /admin/users, /admin/settings, /admin/settings/shipping, /admin/logs | PRIVATE | uncached | noindex | Admin |
| /admin/enquiries | PRIVATE | uncached | noindex | Staff/admin |
| /admin/work | PRIVATE; optional/off | uncached | noindex | Staff/admin when enabled |

No separate attribute route is required for normal editing; inline editor calls catalog services. No review/blog-admin route. Optional route absence/disabled behavior is explicit, not a misleading working page.

## HTTP surface proposal

| Endpoint | Method | Auth / boundary / result |
| --- | --- | --- |
| /api/auth/[...all] | GET/POST per library | Allowlisted auth operations, library CSRF/origin rules, throttles |
| /api/catalog/resolve | POST | Public bounded IDs only; excludes private fields; fresh shopping resolution |
| /api/search/suggestions | GET | Public normalized bounded query; throttle |
| /api/checkout | POST | Session or opaque guest, CSRF/origin, idempotency key/fingerprint; creates accepted order |
| /api/payments/verify | POST | Owner/grant plus provider proof; never trust price |
| /api/webhooks/razorpay | POST | Raw-body HMAC; bounded input; no browser-session dependency |
| /api/orders/lookup/request | POST | Neutral response; rate-limit order/email/IP |
| /api/orders/lookup/verify | POST | Single-use scoped proof -> secure grant |
| /api/orders/[orderNumber] | GET | Owner/verified grant; private no-store |
| /api/invoices/[id]/download | GET | Owner/admin/scoped grant; private attachment |
| /api/media/sign | POST | Staff/admin; allowlisted upload parameters |
| /api/imports | POST | Staff/admin private upload/confirm intent; CSRF; background when large |
| /api/jobs/run | POST | Scheduler secret, bounded work/time, no-store; optional authenticated GET host adapter only if needed |
| /api/health | GET | Implemented liveness: 200, status ok only; no DB dependency; no-store |
| /api/ready | GET | Implemented minimal readiness: 200 ok or 503 degraded, status only; two-second deadline; no-store; no topology |

Server Actions handle first-party profile/address/catalog/content/admin mutations; each validates authorization and input anew. HTTP list is not permission to implement handlers in Stage 3. Unimplemented placeholder APIs return explicit 501/no-store, never fake success or echo secrets.

404/not-found for missing published identity; error/loading UI per root and async page family; unavailable cart/product variants and pending/error payment states documented explicitly. Metadata sitemap/robots files are planned with dev/staging noindex; private routes never enter sitemap.
