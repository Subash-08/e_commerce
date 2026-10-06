# Stage 2 review report

The user's amendments are recorded in [approved architecture](architecture/ARCHITECTURE-DECISIONS.md). Stage 3 has not begun.

## Architecture summary

Custom owned Next.js modular monolith, one deployment/managed MongoDB database per client. Separate stable variants and typed attributes; current cart/wishlist resolution; immutable order/invoice snapshots; integer-paise pure pricing; guarded payment/recovery. Stock reservations apply only to quantity-tracked variants. One small MongoDB jobs/outbox collection. VPS preferred for cost-focused hosting, paid Vercel supported, external scheduler fallback. Better Auth remains conditional with one shared client design.

## Deliverables

[Documentation index](README.md) links all product/architecture/database/commerce/storefront/admin/security/SEO/quality/operations/development contracts. Seven ADRs explain alternatives, consequences and conditional checks. Root AGENTS.md is intentionally short; .env.example contains only blank secrets and nonsecret local defaults.

[Eleven diagrams](diagrams/CORE-FLOWS.md): system trust boundaries, feature dependency, ER model, checkout, callback/webhook convergence, order state, payment state, product update impact, live shopping resolution, CSV import and provider-neutral deployment.

Proposed tree: src/app store/admin route groups + explicit api; src/modules domain modules; src/server shared DB/auth/jobs; src/config; src/client; shared UI/contracts; scripts and tests. See [module tree](architecture/MODULE-BOUNDARIES.md).

[Conceptual collections](database/COLLECTIONS.md) cover catalog/variants/attributes/taxonomy; library-owned auth/profiles/shopping/grants; orders/attempts/payments/refunds/tracked reservations/coupon claims/invoices/corrections/counters; webhookEvents/jobs/imports/audit; redirects/settings/pages/navigation/homepage; optional newsletter/work. No collections were created.

[Dependencies](development/DEPENDENCY-PLAN.md): Stage 3 minimum Next/React/TypeScript/Tailwind/ESLint/Prettier/Zod/boundary marker; business/database/auth/forms/provider/PDF/CSV/test SDKs deferred to their phases. Exact versions and advisories rechecked before installation.

## Resolved review points

- Stock modes and mixed carts have explicit tests; no reservation for status-only items.
- Late capture after expiry has with-stock/without-stock scenarios, duplicate/race checks and refund-required outcome.
- Reacquisition uses a new reservation generation so released records remain auditable without violating uniqueness.
- Shared MongoDB client ownership is documented, with driver/hook/revocation checks still conditional.
- All transaction invariant changes require base-template ADRs; client forks cannot replace them.
- Development order puts pure pricing/state tests before the minimal payment slice; broad storefront follows catalog models.
- No hosting purchase or production account authorization inferred.

## Unresolved decisions and risks before scaffolding

Auth exact stable release/driver/hook compatibility and advisory clearance; supported Node choice; actual host scheduler/budget/restore targets; email/private artifact backend; client CA/legal rules; homepage layout. Most can remain deferred during heading-only scaffolding, but cannot be treated as production readiness.

Mermaid CLI is absent. Eleven diagrams received source/structural review; full parser/render validation is pending and must pass the approved Stage 3 tooling gate. No dependencies were installed to bypass the stage boundary.

## Exact next stage

See [Stage 3 contract](development/STAGE-3-SCAFFOLD.md): verify/pin minimal tooling, add route/layout/config placeholders and module READMEs, validation scripts, compile every placeholder, run install/lint/typecheck/build/docs/diagram checks, commit and stop. Do not implement CRUD, cart, checkout, payments, order workflows or import logic.

User approval of Stage 2 is required before those actions. This report does not request provider credentials or authorize deployment.

## Executed verification

- 46 Markdown files in repository: 42 new and four updated from Stage 1; one new .env.example.
- AGENTS.md: 53 lines (under 150).
- Eleven Mermaid blocks: structural block/fence and canonical state-reference checks passed; CLI parser/render not run.
- Relative documentation links, route coverage samples, secret-example checks and no-application-scaffold boundary passed.
- Pricing worked-example arithmetic checked; no implemented pricing tests claimed.
- Git whitespace check performed before stage commit. No npm install/build/lint/typecheck or database/provider tests run because no application exists.
