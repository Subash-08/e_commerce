# Approved architecture decisions

Approval recorded: **2026-10-06**, from the user's two attached Stage 1 reviews. Status: approved with amendments; authentication remains conditional. This supersedes the Stage 1 pending proposal. Stage 1 history is preserved in Git commit 5572b1f.

## Approval record

| Gate | Recorded decision | Controlling ADR |
| --- | --- | --- |
| A | APPROVED: owned custom single-tenant Next.js modular monolith, Mongoose commerce, one deployment/database per client; no separate Express/unnecessary infrastructure | [0001](../adr/0001-custom-single-tenant-monolith.md) |
| B | APPROVED: separate stable sellable variants, unique SKU, default variant for simple products, inline editor | [0002](../adr/0002-catalog-identity.md) |
| C | REOPENED in 4B: supported runtime index policy unresolved; compatibility report blocks auth installation; no second credential implementation | [0003](../adr/0003-auth-and-connections.md) |
| D | APPROVED WITH SIMPLIFICATION: integer paise/snapshots/idempotency/reconciliation; reservations ONLY for trackQuantity=true; small closed durable jobs/outbox | [0004](../adr/0004-transaction-correctness.md) |
| E | AMENDED: provider-neutral; cost-focused VPS preferred, paid Vercel supported; managed Atlas, no self-hosted production DB | [0005](../adr/0005-provider-neutral-operations.md) |
| F | APPROVED: India/INR physical goods, guest/account checkout; optional Work last, static blog, homepage schema after design | [0006](../adr/0006-scope-and-client-reuse.md) |

Both reviews request Stage 2 only, followed by a stop/report before Stage 3. Where the second says approve E as originally recommended, the first's explicit detailed hosting replacement controls; its scheduler/auth/Node/invariant/testing amendments also apply. Ownership/reuse is the approved reason for custom build; no further speed-versus-ownership approval is needed.

## Additional binding amendments

- One process-local shared MongoClient reused by Mongoose and auth adapter; no hidden second pool. Exact driver compatibility is an installation gate.
- Scheduler must support 1–5 minute ticks; verify current limits before any purchase and document external authenticated fallback.
- Node 24 target only if host/dependencies support it; Node 22 supported LTS fallback. All prior version numbers are observations, not pins.
- Transactional invariant changes require a new base-template ADR; never client-fork-only changes.
- Late capture after expiry has explicit test cases with stock available/unavailable.
- No purchases, production accounts, package installations or feature implementation authorized by Stage 2.
- Guest orders never auto-create/attach accounts. Cart/wishlist resolve current facts; orders/invoices retain snapshots.
- Slug redirects, all related public cache effects, unified public SEO projection, stable variant identity, inline attribute creation and backward-compatible migrations remain required.

## Defaults carried forward

Native Next Node runtime, npm single lockfile, dynamic server filtered results with cached public projections, cache tags from [cache contract](CACHING-REVALIDATION.md), structured rich content, initial MongoDB search, @react-pdf/renderer later, simple role action matrix and verified guest lookup. These are documented defaults, not installed features.

## Remaining gates

Authentication exact-version compatibility/security; hosting budget/plan/cadence and recovery targets; client legal/CA tax/invoice/privacy configuration; homepage design; selected private artifact storage. See [Stage 3 contract](../development/STAGE-3-SCAFFOLD.md). These do not require rebuilding the architecture, but none may be assumed resolved at deployment.
