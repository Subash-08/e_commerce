# SEO, structured data and discovery

Server-render product/category/brand and valuable content. Metadata, visible offer and structured data use the same authoritative public projection and invalidation tags. Do not claim special AI ranking tags or guaranteed answer-engine placement.

Index active public catalog/content and deliberate curated landing pages. Search/filter combinations, account/cart/wishlist/checkout/auth/admin/payment routes are noindex and absent from sitemap. Do not block crawling in robots when crawlers need to observe noindex. Canonicalize tracking/sort variants to meaningful base content; filters use explicit noindex and a suitable canonical policy, not a misleading universal canonical for unrelated results. Pagination has stable URLs and crawlable navigation; distinguish meaningful page content.

Slugs are normalized unique URLs. Changes write permanent redirect mapping, reject loops/external targets, update internal links/canonical/sitemap, invalidate old/new paths. Archived products return appropriate unavailable content or 404 according to merchandising policy; no redirect every missing product to homepage.

Structured data: Product and Offers with actual variant prices/availability/currency and identifiers, BreadcrumbList, Organization/WebSite, Article for real static posts; FAQ only for visible authored questions and when appropriate. No Review/AggregateRating, fabricated GTIN, stock or offers. Validate multi-variant representation against current official Google/schema guidance during implementation. Use safe JSON serialization.

Content: explicit specifications, variant differences, warranty/delivery/returns, accurate seller contacts and concise FAQs; no hidden keyword blocks or bulk low-value AI text. Semantic heading hierarchy, keyboard navigation, descriptive alt and crawlable links support both users and discovery.

Performance targets to measure on representative mobile pages: LCP <=2.5s, INP <=200ms, CLS <=0.1 at field p75 where enough traffic exists; these are targets, not current results. Optimize responsive images, dimensions, font loading and interactive JS; use production build measurements. Homepage design/CMS sections remain pending.

Checks: route metadata/canonical/noindex, sitemap excludes private/draft, structured data equals visible projection, category/brand rename propagates, slug redirect consistency, no fake ratings and public HTML contains meaningful primary content. See SEO-01 in [edge cases](../quality/EDGE-CASES.md).
