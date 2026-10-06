# Documentation index

Stage 2 documentation is prepared for review. No application scaffolding or commerce implementation exists. Begin with [approval record](architecture/ARCHITECTURE-DECISIONS.md) and [progress](PROGRESS.md).

## Review first

1. [Pricing rules](commerce/PRICING-RULES.md)
2. [Canonical states](commerce/STATE-MACHINES.md), [orders](commerce/ORDER-LIFECYCLE.md) and [payments](commerce/PAYMENT-LIFECYCLE.md)
3. [Collections and conceptual shapes](database/COLLECTIONS.md)
4. [Change-impact matrix](architecture/CHANGE-IMPACT-MATRIX.md)
5. [Routes and rendering/API matrix](storefront/ROUTES.md)
6. [Stage 3 actions and risks](development/STAGE-3-SCAFFOLD.md)

## Complete topic map

| Topic | Document |
| --- | --- |
| V1 in/out and journeys | [Feature scope](product/FEATURE-SCOPE.md) |
| System boundaries | [System architecture](architecture/SYSTEM-ARCHITECTURE.md) |
| Modules/folder tree | [Module boundaries](architecture/MODULE-BOUNDARIES.md) |
| Feature read/write/dependency map | [Feature matrix](architecture/FEATURE-DEPENDENCY.md) |
| Cache/tag/invalidation contract | [Caching](architecture/CACHING-REVALIDATION.md) |
| Error UI/log/recovery | [Error handling](architecture/ERROR-HANDLING.md) |
| Schema constraints/migrations | [Indexes and evolution](database/INDEXING-MODEL-EVOLUTION.md) |
| Invoice/credit-note/label rules | [Invoices](commerce/INVOICE-RULES.md) |
| Cart/wishlist/guest/account checkout | [Shopping](storefront/SHOPPING-AND-GUEST-CHECKOUT.md) |
| Inline editor/admin/CSV architecture | [Admin and product creation](admin/ADMIN-AND-PRODUCT-CREATION.md) |
| Roles/identity/privacy/secrets | [Security model](security/SECURITY-MODEL.md) |
| Metadata/structured data/indexing/AEO | [SEO strategy](seo/SEO-STRATEGY.md) |
| Scenario acceptance catalogue | [Edge cases](quality/EDGE-CASES.md) |
| Test layers/recovery/races | [Testing strategy](quality/TESTING-STRATEGY.md) |
| VPS/Vercel/scheduler/backups | [Environments and recovery](operations/ENVIRONMENTS-BACKUPS.md) |
| Package groups/version gates | [Dependency plan](development/DEPENDENCY-PLAN.md) |
| Client override/config/upgrade | [Template reuse](development/TEMPLATE-REUSE.md) |
| Feature implementation sequence | [Development order](development/DEVELOPMENT-ORDER.md) |
| Completion evidence | [Definition of Done](development/DEFINITION-OF-DONE.md) |
| Eleven Mermaid diagrams | [Core flows](diagrams/CORE-FLOWS.md) |
| Official-source research | [References](research/COMMERCE-REFERENCES.md) |
| Agent skills/plugins/MCP plan | [Tooling](tooling/AGENT-TOOLS.md) |
| Stage 2 delivery and open gates | [Review report](STAGE-2-REPORT.md) |

## ADRs

- [0001: custom single tenancy](adr/0001-custom-single-tenant-monolith.md)
- [0002: catalog identity](adr/0002-catalog-identity.md)
- [0003: auth/shared connections](adr/0003-auth-and-connections.md)
- [0004: transaction correctness](adr/0004-transaction-correctness.md)
- [0005: provider-neutral operations](adr/0005-provider-neutral-operations.md)
- [0006: scope/reuse](adr/0006-scope-and-client-reuse.md)
- [0007: rendering/content/documents](adr/0007-rendering-content-and-documents.md)
- [0008: pure domain foundation](adr/0008-pure-domain-foundation.md)

Related root contracts: [AGENTS](../AGENTS.md), [CONTRIBUTING](../CONTRIBUTING.md), [SECURITY](../SECURITY.md), [.env.example](../.env.example).

Documents are consolidated deliberately: product/variant/order/payment shapes are sections of COLLECTIONS; cart/wishlist/guest flows share one document; SEO and structured data share one policy; diagrams share one source. Module-specific implementation manuals will be written when that module begins, without competing state enums.
