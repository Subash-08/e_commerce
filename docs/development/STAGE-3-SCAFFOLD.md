# Stage 3 proposed actions and approval boundary

Status: NOT AUTHORIZED YET. Stage 2 stops for review.

## Exact proposed actions after approval

1. Verify clean branch/user changes; create Stage 3 branch. Re-read approval/ADRs/progress.
2. Recheck runtime support, exact stable package versions/advisories/peer ranges; record approved scaffold subset in dependency plan. Use Node 24 if compatible, supported Node 22 fallback. Do not change global runtime silently.
3. Add package.json/lockfile, TypeScript/Next/Tailwind/ESLint/Prettier/editor config, runtime/npm pins and scripts: dev/build/start/lint/typecheck/format-check/docs-check/diagrams-check.
4. Create src/app route placeholders for every approved route in ROUTES, store/admin root layouts, loading/error/not-found and metadata placeholders. Each page states its planned purpose/doc. No design-heavy UI or live customer data.
5. Add src/config contracts and environment validator using .env.example groups. Build must work without live services; require infrastructure values only when real service runtime is enabled. Production cannot silently bypass required configuration.
6. Create meaningful module READMEs matching MODULE-BOUNDARIES, src/client overrides/default placeholders, shared contracts only where useful. No Mongoose models or domain transition/pricing implementation.
7. Add docs/link and Mermaid validation scripts; validate/render all diagrams with pinned CLI if approved. Use dedicated doc tooling, not an invoice runtime dependency.
8. No operational seeding yet: document seed-settings/admin/init-client commands as future work; executable seed stubs, if created at all, must fail explicitly as unimplemented and never write fake success.
9. Install only scaffold subset. Run npm install/ci, lint, typecheck, build and docs/diagram checks; fix failures. Verify all placeholder routes and no fake-success payment/API handlers.
10. Commit stage, update README/progress with actual scripts/results/version pins; stop. Implementation needs separate authorization.

Auth/database/provider/PDF/CSV SDK installation and real module wiring can wait for implementation. If auth is installed in Stage 3 at the user's request, complete all static compatibility/security gates first; do not imply runtime revocation tests passed without implementation.

## Risks and unresolved facts

- Hosting budget/provider tier, scheduler actual guarantees and RPO/RTO not chosen; no purchases.
- Better Auth remains conditional pending exact source/driver/hooks/advisories check; architecture can scaffold without it.
- Private artifact backend and email provider need selection before dependent modules.
- Client tax/legal/privacy policies and invoice issue timing require client/CA review.
- Homepage design/section schema intentionally deferred.
- Existing machine's Node 20 needs a supported project runtime.
- Mermaid CLI is not currently available; full CLI rendering is a required Stage 3 validation gate unless supplied sooner.
- Windows sandbox helper is failing; approved file/verification operations currently use outside-sandbox shell with command-scoped safe.directory. No global Git safety override was set.

Approving Stage 3 does not authorize commerce business code, production connections, deployment purchases or publishing.
