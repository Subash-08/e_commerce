# Definition of Done

For documentation: every topic has an owner/purpose and correct links; decisions/status are consistent; enums defined once; diagrams match flows; no claim of unrun tests. Track renderer/compatibility limitations explicitly.

For scaffold: approved exact runtime/packages, minimal routes/layouts/config, .env.example, concise AGENTS, no business handlers/fake data, clean install/lint/typecheck/build, all placeholders compile, docs/diagram checks and recorded commands. Dependency checks are not proof of production commerce.

For each implemented feature:
- Approved contract and scenario IDs; validation, authorization/ownership and concurrency handled.
- Happy/loading/empty/unavailable/error/retry/mobile/keyboard states.
- DB indexes/constraints, snapshot/privacy/migration implications reviewed.
- Related feature/cache/SEO effects from change-impact matrix verified.
- Deterministic unit/integration tests appropriate to risk; critical purchase/browser scenarios when affected.
- Provider failures/replays/ambiguous responses and observability assessed.
- No real data in fixtures, fake production fallback, leaked private DTO fields or unguarded API.
- Documentation/ADR/roadmap updated; review describes behavior, evidence and limitations.

For release: staging and both chosen-profile operational checks, scheduler/recovery/restore and client compliance sign-off, no unresolved critical transaction/security issue, exact versions/advisories and rollback plan recorded. An attractive UI alone is never completion.
