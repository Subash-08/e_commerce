# Module boundaries and proposed filesystem

This is a proposal for Stage 3, not directories already scaffolded.

```text
src/
  app/
    (store)/layout.tsx
    (store)/...public-and-account-routes
    (admin)/layout.tsx
    (admin)/admin/...admin-routes
    api/...explicit-http-boundaries
  modules/
    identity/ catalog/ shopping/ pricing/ checkout/
    orders/ payments/ invoices/ content/ operations/
  config/ app.ts branding.ts commerce.ts features.ts navigation.ts seo.ts env.ts
  client/ branding.ts components/ policies.ts
  server/ db/ auth/ jobs/ observability/
  shared/ ui/ contracts/
scripts/                # environment/docs/diagram checks; seeds only when implemented
tests/ fixtures/ unit/ integration/ e2e/
docs/
public/
```

Each meaningful module gets a README initially; add services/repositories/validation/contracts/components only when needed. No empty file forest. Shared UI cannot import server repositories. Domain services cannot import App Router or client components. Cache adapter is called after commit and via durable retry; it does not belong in pure pricing.

| Owner | Owns writes | Public service responsibility |
| --- | --- | --- |
| Identity | Auth-owned records through library; application profiles/role guard | Session, ownership, profile, roles, access grants |
| Catalog | Products/variants/attributes/categories/brands | Public projection, variant matching, availability |
| Shopping | Carts/wishlists/merge receipts | Resolve references, deterministic merge |
| Pricing | No database writes | Deterministic quote from validated facts |
| Checkout | Checkout attempt, pending order and claims | Idempotent orchestration and fresh quote |
| Orders | Lifecycle/history, fulfillment exception | Guard transitions, customer/admin views |
| Payments | Payment attempts/refunds/webhook processing | Verified financial state and reconciliation |
| Invoices | Issued snapshots/counter/credit notes | Issue once, render private document |
| Content | Policies/navigation/homepage config | Publish versioned public content |
| Operations | Jobs/import records/audit/report reads | Leases/retries/import orchestration; no competing payment rules |

Cross-module operations use explicit services; one transaction may coordinate repositories through a shared session. Repositories do not trigger emails or provider calls. Status values live in [state registry](../commerce/STATE-MACHINES.md).

Config precedence and override permissions live in [template reuse](../development/TEMPLATE-REUSE.md).
