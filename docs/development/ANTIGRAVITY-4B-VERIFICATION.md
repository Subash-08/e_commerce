# Antigravity: Stage 4B verification

Copy this entire document as the next task prompt. Work in D:\AI\e-commerce on the existing codex/stage-4b-database branch. Stage 4A was verified at fd63cf2; preserve its 161 tests. Stage 4B implementation is a checkpoint, not accepted.

## Authorization and boundaries

Implement the test harness, tests and routine verification below. Fix routine type/lint/format/test configuration defects. If evidence identifies a transaction, ownership or index algorithm defect, record a minimal reproduction and return it to Codex for complex repair; do not silently weaken assertions. Update docs with actual evidence, commit the verification work, then stop.

Read AGENTS.md, docs/PROGRESS.md, docs/architecture/ARCHITECTURE-DECISIONS.md, ADRs 0003 and 0009, docs/database/AUTH-COMPATIBILITY-REPORT.md, and src/server/db/*.ts. Do not read any .env file except .env.example, print connection strings or environment values, or install more dependencies. No Docker. No credentials needed. No auth installation, commerce models/CRUD, payments, UI or external provider calls. Do not use skips, only, passWithNoTests, fake DB replacements, swallowed errors, or fake timers for real integration tests.

Use .tools/node-v24.21.0-win-x64/node.exe and that directory's npm.cmd; prepend it to PATH without printing environment values. Do not kill unrelated processes or force Git operations.

## Harness and commands

1. Use installed mongodb-memory-server 11.3.0 with MongoDB binary 8.2.6, WiredTiger, count 1, loopback. A first binary download is expected; an unavailable download/startup must fail, not skip. Assert hello.setName and logicalSessionTimeoutMinutes before running transaction tests. No Docker fallback.
2. Keep synthetic data/builders/repository harnesses in tests/fixtures. Generate per-suite collection names and a random database name ending _test. Use parseDatabaseConfig with NODE_ENV=test and APP_ENV=test, isolated createDatabaseOwner instances, and a URI from this freshly created replica set only. Never consume an ambient database URI or import development data.
3. Guard cleanup at the destructive operation: both test environment values, generated _test name, and collection membership in the suite-owned allowlist must match. Drop only owned collections. Negative guard tests must prove development/production/wrong name targets cannot reach a drop call.
4. Explicitly create collections and indexes before transactions. Teardown closes each owner and stops the replica even on failure. Keep real-time tests deterministic with barriers; every barrier has a finite timeout and teardown release.
5. Add separate Vitest integration configuration and scripts test:unit and test:integration; npm test runs both, sequentially. Existing unit inclusion remains isolated. server-only may be aliased to a fixture stub in test configuration only; keep production server boundaries intact.
6. Add a runner/reporter gate that rejects any skipped/todo/pending test or suite and zero integration tests. A successful Vitest exit alone is not sufficient. Preserve failure exit codes; do not parse brittle terminal text if structured results are available. Exercise the guard with a temporary fixture outside production test discovery, then remove it.
7. npm run verify must include both test suites once, lint, typecheck, build, docs, secrets, enums, diagrams, routes, and format:check. Existing verify needs format:check added. Do not leave new tests outside this gate.

## Required real database evidence

Connection ownership:
- Fifty concurrent first get calls share the same promise, returned handle and native client; instrument actual MongoClient.connect calls and prove only one application initialization.
- Mongoose getClient is the same native client, app driver identity is shared, and autoIndex/autoCreate/buffering are disabled.
- A rejected connection attempt releases partial resources and clears the promise. The same owner can then succeed against the real replica with a corrected config reader.
- Close is idempotent; only the owner closes the client. Closing while initialization is pending does not leak a client; new get after close is rejected.
- Report npm ls mongodb --all accurately: application/Mongoose use 7.7.0; the dev-only launcher uses 7.5.0. No forced override and no claim that there is literally one installed copy.

Transactions:
- Real committed writes persist. Throwing after a write rolls it back and preserves a deliberate DomainError.
- Two-collection success commits both; failure after the second write rolls both back.
- Concurrent conditional revision updates produce exactly one winner and a REVISION_CONFLICT loser, with one resulting ledger/event write.
- Force a real server write conflict: the first callback reads, an independent writer changes that document, then the transaction attempts its write. Coordinate only the first attempt so replay cannot deadlock. Prove the native driver reruns the callback and the durable side effect occurs once. A fabricated error label alone does not satisfy this test.
- Verify three-callback limit and bounded transaction retry behavior; narrow fault injection is acceptable for the cap in addition to the real conflict test. No handwritten retry loop.
- Spy on real session cleanup to prove endSession on success and failure. Verify nested transaction/index-apply rejection.
- Deliberate missing-session diagnostic: a fixture write with session rolls back, a separate write without session persists after abort. This negative example must be clearly confined to tests and proves why repository sessions are mandatory.
- Use explicit session in every positive transactional repository operation and await operations sequentially. No external effects in callbacks.

Indexes and errors:
- Use fixture manifests, not the empty application manifest, to prove missing/unchanged/unexpected/same-name drift, ordered compound keys, unique/sparse/partial filter/collation/TTL/hidden comparison.
- Dry run performs no writes. Approved apply creates missing indexes. Same-name mismatch refuses creation before any other planned mutation. Unexpected indexes survive; nothing is dropped or syncIndexes called.
- A duplicate-key write and collection validation failure normalize to safe codes. Serialized errors/public responses/log events contain no original URI, credentials, raw driver messages or document data. Original cause is accessible only via explicit diagnostic accessor.
- The empty application manifest reports no approved indexes; it must not claim all database indexes are valid.

Health, config and host lifecycle:
- Liveness works without DB config and does not initialize a client.
- Readiness is ok for a live replica; unavailable/missing/invalid config is degraded within its two-second response budget, allowing measured scheduler tolerance. Body contains only status; assert no topology/config disclosure.
- Serverless registration adds no signal handlers; long-running registration adds each only once. Test signal behavior in an isolated child, not by terminating the runner.
- Smoke-test npm run db:dev separately: real replica ready, app reachable, Ctrl+C cleanup including child processes. Do not use production credentials or an existing app's port; stop only processes started by this test.
- Validate APP_ENV/NODE_ENV consistency, _test guard, pool bounds and invalid input redaction.

## Routine regression and acceptance

Update scripts/check-routes.mjs: health and ready are implemented, so their former 501 placeholder expectations are obsolete. Assert health 200, ready 503 when no DB is configured (200 only when intentionally running with the isolated replica), exact minimal bodies, and no-store. Keep placeholder assertions for all other documented API methods and 57 UI pages; report actual discovered counts, not assumed ones.

Run npm ci --no-fund under the pinned runtime; server download is disabled at install, occurs on launcher start. Run formatting and full verify, npm ls --depth=0, npm ls mongodb --all, npm audit --omit=dev, full npm audit, git diff --check. Report actual audit results; previous nine dev findings are historical, not a current clean bill. Run all eleven diagrams through the real parser.

Update docs/PROGRESS.md with exact versions, distinct unit/integration test counts, all commands/results, retry/rollback/index/connection evidence, and any failure or limitation. Add report links, not raw environment values. Do not mark Stage 4B accepted while a required test/check is pending or skipped. Auth result remains REOPEN ADR 0003; passing database tests does not approve auth.

Commit the completed verification on the current branch (or commit an honest failure report if blocked). Do not start Stage 4C. Return the commit, test counts, audit findings, and unresolved defects.

