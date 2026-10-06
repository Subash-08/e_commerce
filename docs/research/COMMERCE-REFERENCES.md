# Official research and commerce references

Reviewed 2026-10-06. Purpose: distinguish verified vendor behavior from architecture recommendations. No application version existed to detect. Research targets the current Next.js 16 documentation; exact install versions require a later compatibility/security check. Sources are mutable unless linked to a commit.

## Reference repositories

Public GitHub metadata was inspected through its API. Both repositories were not archived; maintenance evidence is the latest commit below, not a guarantee of future support. Review was bounded to README/manifests and selected source, not a security audit or successful local build.

| Repository / revision | Studied | Adopt as a pattern | Reject / reason |
| --- | --- | --- | --- |
| [Vercel Commerce](https://github.com/vercel/commerce/tree/3761e52e60df9c6a316e067dbfd7032e494d3634), commit 2026-06-10 | README, package.json, product page metadata, gallery/Suspense composition, product JSON-LD | Server-rendered catalog with interactive islands; colocated metadata and public product retrieval | Shopify-specific data layer; dependency manifest pins Next 15.6.0-canary.60, unsuitable as our stable version baseline. Its test script checks formatting, not financial correctness. Do not copy JSON-LD injection without safe serialization |
| [Medusa DTC starter](https://github.com/medusajs/dtc-starter/tree/15ef93da7d155ad990d8cc6db0296446fecbdfe6), commit 2026-10-02 | README, monorepo/package scripts and runtime requirements | Explicit separation of storefront interaction from commerce operations; coherent variant/cart/checkout/account journey | Separate Medusa/PostgreSQL backend, multi-region defaults, provider-specific payment setup and Turborepo are not needed for this selected stack |

Medusa's root package requires Node >=22.22.0 while its README says v20+: manifests and compatibility checks take priority over a copied setup snippet. These are reference applications, not approved upstream application dependencies. Build-versus-adopt remains gate A.

## Framework and runtime

- [Next.js caching](https://nextjs.org/docs/app/getting-started/caching) and [revalidation](https://nextjs.org/docs/app/getting-started/revalidating): public data caching and explicit invalidation. Proposed single Cache Components model; do not mix guides for old `unstable_cache` patterns without version context.
- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16): verify async request APIs, runtime requirements and proxy terminology against the installed version.
- [useSearchParams](https://nextjs.org/docs/app/api-reference/functions/use-search-params): request-dependent filters require deliberate dynamic/server or client-boundary choices. Proposed dynamic filtered results, cached shared public catalog data.
- [Metadata](https://nextjs.org/docs/app/getting-started/metadata-and-og-images): metadata is part of the server-rendered content contract. No fabricated ratings.
- [Authentication guide](https://nextjs.org/docs/app/guides/authentication): application authorization must be enforced near protected data/actions; a navigation/proxy check is insufficient.
- Official docs header observed Next.js 16.3.8, not a local installed version.
- [Node release schedule](https://github.com/nodejs/Release) and [EOL list](https://nodejs.org/en/about/eol): Node 20 is EOL; select and pin a supported LTS (proposed Node 24). Do not silently upgrade the user's global runtime.

## Database

- [Mongoose transactions](https://mongoosejs.com/docs/transactions.html), observed docs version 9.11.0: use transaction/session-aware operations and retry semantics; do not run parallel transaction operations with Promise.all. External provider calls do not belong inside a retryable transaction.
- [MongoDB transaction considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/): deploy transaction-capable replica set/sharded topology; test the actual topology, not standalone-only mocks.
- [Unique indexes](https://www.mongodb.com/docs/manual/core/index-unique/): multikey uniqueness is across documents, not repeated values inside one document. This supports the recommendation to give sellable variants their own indexed records, though embedding remains a viable alternative with additional safeguards.

## Authentication

- [Better Auth MongoDB adapter](https://better-auth.com/docs/adapters/mongo): official native MongoClient adapter, transaction configuration and standalone limitations; docs header observed 1.7.7. It is not a Mongoose adapter.
- [Better Auth installation](https://better-auth.com/docs/installation): follow exact selected release and adapter setup during implementation.
- [Auth.js](https://authjs.dev/): site identifies Better Auth Inc.; ownership is verified, but that alone does not prove release stability/deprecation. The attachment's historical v5-beta claim is not carried forward as fact. A registry/advisory check remains mandatory before installing either library.

Recommendation is Better Auth for the new credential/session workflow, subject to dependency verification. No auth library is installed.

## Payments and media

- [Razorpay Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/): create/bind provider order server-side, verify callback signature and trusted payment state. Application pricing/authorization is not delegated to the browser.
- [Razorpay webhook validation](https://razorpay.com/docs/webhooks/validate-test/): validate raw-body signature, identify duplicate deliveries by event ID, tolerate out-of-order events. Durable ingestion and business idempotency are application design requirements, not features magically supplied by an SDK.
- [Cloudinary Next.js integration](https://cloudinary.com/documentation/nextjs_integration): rendering/delivery integration guidance; keep management credentials server-side and distinguish Next.js presentation helpers from server media management.
- Cloudinary/Razorpay agent tooling is reviewed separately in [AGENT-TOOLS](../tooling/AGENT-TOOLS.md). It is optional for application integration.

## Invoice rendering comparison

| Official reference | Useful capability | Main cost | Proposed decision |
| --- | --- | --- | --- |
| [pdf-lib](https://pdf-lib.js.org/) | Low-level PDF creation/editing | More manual table/page layout | Alternative for fixed small labels |
| [React PDF renderer](https://react-pdf.org/) | React document layout on server | Additional dependency and font/layout testing | Prefer for invoice module; not installed now |
| [pdfmake](https://pdfmake.github.io/docs/0.3/) | Declarative document/table model | Another document DSL | Valid fallback; choose one renderer |

No Chromium required by the recommendation. Serverless suitability still requires bundle/runtime/memory testing with realistic multi-page invoices; it is not established by documentation alone.

## Operations and legal review

- [Vercel cron usage](https://vercel.com/docs/cron-jobs/usage-and-pricing): cadence and execution limits are plan-sensitive; select a paid plan that supports the proposed scheduler rather than assuming the free tier can expire reservations promptly. No purchase or pricing estimate made.
- [CBIC invoice rules](https://cbic-gst.gov.in/gst-invoice-rules.html): consecutive numbering with financial-year uniqueness supports an auditable issued-document ledger; do not promise that every failure can be hidden by renumbering. This page is a reference, not a complete consolidated current tax opinion.
- [Consumer Affairs official legislation index](https://consumeraffairs.gov.in/pages/consumer-protection-acts): client review must cover the E-Commerce Rules and current amendments, not only the original 2020 document.
- [MeitY DPDP Rules landing page](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa): the page returned no readable body in this research environment. Therefore exact commencement dates and client applicability remain explicitly unverified. Do not substitute draft explanatory notes for final law.

Legal/CA review per client must resolve GST/place of supply, invoice issue timing/credit notes/e-invoicing, retention, consumer disclosures and DPDP applicability. Architecture plans the hooks and records; it does not claim legal certification.

## Evidence boundaries

No benchmark, full source audit, production backup test, deployment, database migration or end-to-end payment test occurred in Stage 1. Current-version documentation can change; Stage 3 must verify exact package releases and record the lockfile. The runtime error in local execution and the Git ownership mismatch are environment issues, not an application build failure.
