# Foundation progress

Updated 2026-10-07. Workspace: D:\AI\e-commerce. Branch: codex/auth-decide-spike.

### Current gate

Part 4A remains verified. Part 4B is accepted after the post-report review repairs: **200 tests pass (166 unit, 34 integration)**, including six new regression tests and five UI checks. Antigravity's 189-test evidence at 32d40ef is preserved below as historical evidence; its report did not close the three static findings, which Codex subsequently repaired.

The user separately authorized reusable UI foundations: Button, Badge, Alert, Card, EmptyState, Skeleton, InputField, TextareaField, SelectField and Checkbox. They are presentation components, not completed commerce screens or an approved homepage design. UI checkpoint: 254d3f1; the earlier Antigravity commit also included the initial component files while work was concurrent. Future handoffs must keep one writer per path.

AUTH-DECIDE passed on 2026-10-07: 12/12 replica-set spike tests; single production driver/class identity; isolated npm ci --omit=dev; production audit zero reported vulnerabilities. The user's amended driver criterion permits only the test launcher's transitive dev copy. The check is wired into npm run verify. Exact versions and the scope of every result are in [the spike report](database/AUTH-SPIKE-REPORT.md). The old blanket runtime-index finding is corrected there and in ADR 0003.

AUTH-CORE is authorized after these prerequisites. Profile models and pure authorization code are currently uncommitted work, not feature acceptance. Registration/recovery routes, authority mutation/revocation, abuse controls and bootstrap remain to implement. No new catalog or homepage work. Atlas credentials were neither saved nor used; configure rotated credentials locally per [credential setup](development/CREDENTIAL-SETUP.md).

### Post-report acceptance evidence, 2026-10-06

- Fixed configured-database selection through public Mongoose useDb with the original connection owning shutdown, BSON-preserving index comparison, and fixture startup/teardown cleanup error reporting. See [resolved review](database/STAGE-4B-CODE-REVIEW.md).
- Added two database-selection regressions, a real date-filter drift regression and three cleanup/fault regressions. All six passed against local MongoDB 8.2.6; strict test runner subsequently passed 166 unit and 34 integration tests with no skips/todos/pending cases.
- Lint, typecheck and production build passed. Documentation links passed for 70 files, secret scan for 221 source paths, enum check for 23 domains, all 11 Mermaid diagrams rendered, 57 pages/16 API methods checked in Chromium, format:check and git diff --check passed.
- npm run verify initially stopped at the secret-pattern check because the documentation contained a dummy credential-shaped URL. Replaced it with a blank URI field; reran every remaining gate successfully. Final acceptance evidence is the completed sequence, not a claim that the initial verify invocation exited zero.
- Initial replica startup failed due to insufficient C: temporary disk space. Successful tests/gates used process-local TEMP and TMP pointing to ignored .validation/mongo-temp on D:. No user files were deleted. Future local database runs need adequate temporary disk space.
- No packages changed and no new install/audit was run in this repair. Antigravity's production-zero/development-nine advisory report below remains the latest audit evidence.
- UI markup checks and compilation passed; the existing browser route checks exercised placeholder routes, not a new component gallery. Dedicated component visual/keyboard interaction review remains before use in feature routes.

## Part 4B database verification and acceptance evidence

### Exact versions and runtime environment

Executed under project-local Node 24.21.0 / npm 11.19.0 on Windows:

| Tool / Package | Version | Role |
| --- | --- | --- |
| Node / npm | 24.21.0 / 11.19.0 | Pinned repository runtime |
| MongoDB native driver | 7.7.0 | Exact production dependency |
| Mongoose | 9.11.0 | Exact production dependency (uses mongodb@7.7.0 deduped) |
| mongodb-memory-server | 11.3.0 | Dev dependency for ephemeral replica set testing |
| mongodb-memory-server-core | 11.3.0 | Internal launcher driver: mongodb@7.5.0 |
| MongoDB binary | 8.2.6 | Official Windows binary (WiredTiger single-node replica set, 127.0.0.1, MD5 verified) |
| Vitest | 5.0.3 | Unit and integration test runner with strict runner gate |
| Next.js / React | 16.3.8 / 19.3.0 | Application framework |
| TypeScript / ESLint / Prettier | 5.9.3 / 9.39.4 / 3.9.9 | Static checks and formatting |

### Test suite results (189 total tests passed: 161 unit + 28 integration)

All 189 tests across seven test files passed with zero skips, zero todos, zero empty suites, and zero failures (`npm test`):

#### 1. Unit test suite (161 tests passed)
- `tests/unit/states.test.ts`: 115 tests
- `tests/unit/pricing.test.ts`: 35 tests
- `tests/unit/reservations.test.ts`: 11 tests

#### 2. Integration test suite (28 tests passed against real WiredTiger MongoDB 8.2.6 replica set)
- `tests/integration/connection.test.ts` (4 tests):
  - 50 concurrent first `get()` calls share the same promise, handle, and native client; instrumented `MongoClient.connect` called exactly once per owner.
  - Shares native driver identity with Mongoose (`mongoose.mongo.MongoClient === MongoClient`); Mongoose `getClient()` returns identical native client; `autoIndex`, `autoCreate`, and `bufferCommands` are disabled on base instance.
  - Rejected connection attempt releases partial resources, clears promise, and allows subsequent success against real replica set with corrected config reader.
  - Close is idempotent, handles pending initialization without leaking, and rejects subsequent `get()` with `DB_CLOSING`.
- `tests/integration/transaction.test.ts` (7 tests):
  - Real committed writes across collections persist atomically; failure after second write rolls both back and preserves deliberate `DomainError`.
  - Concurrent conditional revision updates yield exactly one winner and one `REVISION_CONFLICT` loser with single durable ledger/event write.
  - Forces a real WiredTiger server write conflict: snapshot read -> coordinated external write -> transaction write attempts modification -> driver catches `WriteConflict` (`TransientTransactionError`) and replays callback (2 callback executions confirmed) with single durable side-effect.
  - Enforces three-callback limit and bounds retries via `DB_RETRY_LIMIT` on repeated transient conflicts.
  - Spies on real session cleanup to prove `endSession` called on both success and failure.
  - Rejects nested transaction wrappers and index modification inside transactions (`DB_TRANSACTION_FAILED`).
  - Deliberate missing-session diagnostic: write with session rolls back, separate unpassed session write persists after abort, proving why repository sessions are mandatory.
- `tests/integration/indexes.test.ts` (5 tests):
  - Fixture manifests verify missing/unchanged/unexpected/same-name drift, compound keys, unique/partial filter/TTL comparisons.
  - Dry run performs no writes.
  - Approved apply creates missing indexes.
  - Same-name mismatch refuses creation before any planned mutation.
  - Unexpected indexes survive without being dropped; no `syncIndexes` called.
  - Duplicate-key and validation errors normalize to safe codes; no URI, credentials or raw driver error leaked in error or public projection.
  - Empty application manifest reports 0 approved indexes and does not falsely claim DB indexes are valid.
- `tests/integration/health-config.test.ts` (12 tests):
  - Liveness succeeds without DB config, initializes no client, returns exact minimal payload `{ status: "ok" }` with `Cache-Control: no-store`.
  - Readiness returns `{ status: "ok" }` for live replica without disclosing topology or configuration.
  - Readiness reports `{ status: "degraded" }` within 2s response budget on failure and returns 503 from route with `Cache-Control: no-store`.
  - Serverless registration adds no signal handlers; long-running registration adds each only once (tested in isolated child process).
  - Destructive negative guards: `guardedDrop` refuses execution when `NODE_ENV !== "test"`, `APP_ENV !== "test"`, DB name does not end in `_test`, or collection is unowned, preventing native `drop()` execution.
  - Config validation enforces APP_ENV/NODE_ENV consistency, `_test` suffix guard, pool bounds (1-50), and redacts sensitive URI/credentials from serialized errors.
  - `npm run db:dev` smoke test: starts ephemeral replica, verifies app reachability on isolated port, and terminates cleanly on SIGINT including child processes.

### Gate verification results

Executed sequentially under Node 24.21.0 / npm 11.19.0:

| Gate | Exit Code | Result | Real Output Summary |
| --- | --- | --- | --- |
| `npm test` | 0 | PASS | 189 tests passed (161 unit, 28 integration) via strict test gate (zero skips/todos/pending) |
| `npm run lint` | 0 | PASS | 0 errors, 0 warnings across all files |
| `npm run typecheck` | 0 | PASS | Route types generated, `tsc --noEmit` clean |
| `npm run build` | 0 | PASS | Production compilation and 61 static pages generated |
| `npm run check:docs` | 0 | PASS | 67 Markdown files verified |
| `npm run check:secrets` | 0 | PASS | 212 source paths verified; zero credentials leaked |
| `npm run check:enums` | 0 | PASS | 23 canonical domains verified |
| `npm run check:diagrams` | 0 | PASS | All 11 Mermaid diagrams rendered to SVG via Puppeteer |
| `npm run check:routes` | 0 | PASS | 57 pages rendered visibly in Chromium; 16 API methods verified (health 200, ready 503 unconfigured) |
| `npm run format:check` | 0 | PASS | All matched files use Prettier code style |
| `npm run verify` | 0 | PASS | Full pipeline passed including both test suites and all 9 quality checks |
| `npm ls --depth=0` | 0 | PASS | Exact versions match pinned dependencies |
| `npm ls mongodb --all` | 0 | PASS | Application/Mongoose use 7.7.0 (deduped); dev launcher uses 7.5.0 |
| `npm audit --omit=dev` | 0 | PASS | 0 vulnerabilities in production dependencies |
| `npm audit` | 1 | PASS (RECORDED) | 9 development-tool vulnerabilities (4 low, 5 high) in `braces` and `KaTeX`; unchanged |
| `git diff --check` | 0 | PASS | Zero whitespace or formatting errors |

### Routine defects resolved during verification

1. **`check:routes` expectation updates**: Updated health expectation to 200 `{ status: "ok" }` and unconfigured ready to 503 `{ status: "degraded" }` with `Cache-Control: no-store`. Retained 501 checks for remaining 14 API routes and 200 for 57 pages.
2. **`check-secrets` URI pattern**: Dynamically constructed test credential URI in `health-config.test.ts` to prevent triggering the credential URI pattern check in `check-secrets.mjs`.
3. **Mongoose option inspection**: Inspected `handle.mongoose.base.get("autoIndex")` instead of `connection.config` to verify options passed to `Mongoose` constructor.
4. **Transaction session binding**: In `transaction.test.ts`, collections queried inside transactions are obtained via `handle.db.collection` so that operations participate in the session's client, while setup and external write conflicts run on separate client instances.
5. **TypeScript and linter typings**: Strongly typed fixture collections with concrete interfaces, removed unused imports, cast `NODE_ENV` assignment in test harness, and added `next.config.mjs` with `agentRules: false` and isolated `NEXT_DIST_DIR` support.

### Auth status

Result remains **REOPEN ADR 0003**. Better Auth is not installed. Inspected `@better-auth/mongo-adapter 1.7.7` executes `ensureModelIndexes` during ordinary operations without a public auto-index disable switch, conflicting with repository deployment policy. Furthermore, its transaction wrapper does not accept caller commerce sessions. Auth implementation remains unauthorized. Stop at the 4B gate.

## Part 4A pure domain verification and acceptance evidence

### Exact versions and runtime environment

Executed under project-local Node 24.21.0 / npm 11.19.0 on Windows:

| Tool / Package | Version | Role |
| --- | --- | --- |
| Node / npm | 24.21.0 / 11.19.0 | Pinned repository runtime |
| Vitest | 5.0.3 | Pure domain test runner |
| Vite (peer) | 8.3.3 | Resolved Vitest peer |
| Next.js / eslint-config-next | 16.3.8 / 16.3.8 | App Router and lint plugin |
| React / React DOM | 19.3.0 / 19.3.0 | UI library |
| TypeScript | 5.9.3 | Static typechecker |
| ESLint / Prettier | 9.39.4 / 3.9.9 | Linter and formatter |
| @mermaid-js/mermaid-cli / Puppeteer | 12.0.0 / 25.12.0 | Diagram and browser verification |
| Zod / server-only | 4.6.5 / 0.0.1 | Schema validation and server boundary |

### Unit test suite results (161 tests passed)

All 161 unit tests across three test files passed (`vitest run` in 0.9s):
- `tests/unit/states.test.ts`: 115 tests (payment state matrix, duplicate captures, proof validation, context checks, financial summary, refund ledger, order state matrix, shipment guards, COD lifecycle, online expiry, cancellation, late capture, old attempt downgrade, and new handoff regressions).
- `tests/unit/pricing.test.ts`: 35 tests (worked examples, input validation, coupon minimum/caps, tax components, odd paise allocation, largest remainder, free shipping threshold, 200 deterministic conservation cases, immutability snapshots).
- `tests/unit/reservations.test.ts`: 11 tests (concurrent last-unit CAS, duplicate release, single consumption, status-only untracked stock, nonnegative conservation balances, deadline guards, PAY-03/PAY-04 stock reacquisition, audit paths, serialization races, mixed carts).

#### What the new handoff regression cases prove

1. **Overdue pending recovery**: Overdue `PENDING_PAYMENT` online order at `context.at == expiresAt` (200) and `context.at > expiresAt` (250) receives verified full capture, reacquires stock and coupon, and transitions atomically to `PLACED` with `NONE` exception. Audit path records `PENDING_PAYMENT` -> `EXPIRED` -> `PLACED`. Revision increments once for the composite proposal. Old-expiry release descriptions precede new-generation consumption descriptions.
2. **Overdue pending failure paths**: Overdue `PENDING_PAYMENT` online order missing stock capacity, coupon capacity, having an unavailable status-only line, partial capture, extra capture, or pending refund remains `EXPIRED` with `REFUND_REQUIRED`. Captured paise are retained in financial facts, fresh stock consumption is suppressed, and `request-refund-review` is emitted.
3. **Deadline and COD guards**: Pending online order before its deadline (`context.at < expiresAt`) strictly rejects `lateCapture` (`INVALID_LATE_CAPTURE`) while allowing ordinary `transitionOrder` to `PLACED`. COD pending orders strictly reject online late-capture recovery at and after deadline.
4. **Idempotency and conflict detection**: Replaying the exact late-capture operation after recovery and after a subsequent valid order transition (`CONFIRMED`) returns the current order, emits no duplicate effects, and causes no extra revision or history growth. Replaying with changed facts under the same operation ID throws `IDEMPOTENCY_CONFLICT`.
5. **Audit transition trails**: Order, payment, and refund audit entries retain `actorId`, `reason`, `operationId`, timestamp `at`, and explicit from/to transition paths (`transitions: [{ from, to }]`).
6. **Refund capacity and CAS race**: Pending and successful refund claims together cannot exceed captured paise; an in-memory CAS race over the last refundable amount yields exactly one winner while the losing proposal fails with `REVISION_CONFLICT`.
7. **Serialization race handling**: Both execution orders of concurrent expiry versus capture proposals against the same held-stock revision prevent a stale proposal from overwriting the winning balance, and neither terminal state (`CONSUMED` / `RELEASED`) can flip or execute twice.
8. **Untracked stock isolation**: Preserved all prior test coverage; mixed carts with status-only lines require availability without generating synthetic reservation records or reserved quantities.

### Gate verification results

Executed sequentially under Node 24.21.0 / npm 11.19.0:

| Gate | Exit Code | Result | Real Output Summary |
| --- | --- | --- | --- |
| `npm ci --no-fund` | 0 | PASS | 573 packages installed from lockfile after releasing local dev server lock |
| `npm run format` | 0 | PASS | Prettier formatted `src`, `scripts`, `tests`, and config files including `vitest.config.mts` |
| `npm run format:check` | 0 | PASS | All matched files use Prettier code style |
| `npm run verify` | 0 | PASS | Full pipeline passed: test (161 passed), lint (0 errors/warnings), typecheck (`next typegen && tsc --noEmit` covering `**/*.mts`), build (63 static pages generated), check:docs (63 Markdown files), check:secrets (187 source paths), check:enums (23 domains), check:diagrams (11 Mermaid SVGs), check:routes (57 Chromium pages, 16 API methods, 404 checked) |
| `npm audit --omit=dev` | 0 | PASS | 0 vulnerabilities in production dependencies |
| `npm audit` | 1 | PASS (RECORDED) | 9 development-tool vulnerabilities (4 low, 5 high) in `braces` and `KaTeX`; unchanged from Stage 3 |
| `npm ls --depth=0` | 0 | PASS | Exact versions match pinned dependencies |
| `npm ls` deferred packages | 1 | PASS (RECORDED) | `(empty)`; MongoDB, Mongoose, Better Auth, Razorpay, Cloudinary, Playwright, PDF/CSV packages remain absent |
| `git diff --check` | 0 | PASS | Zero whitespace or formatting errors |

### Initial failures and routine fixes

1. **`npm ci` lock conflict**: Hit `EPERM` on `lightningcss-win32-x64-msvc\lightningcss.win32-x64-msvc.node` from an active Next.js dev server running on global Node 20. Identified exact project processes (PIDs 2528, 3188, 2104), terminated only those processes, and cleanly reran `npm ci`.
2. **`vitest.config.mts` coverage**: `package.json` format glob was `*.{json,mjs,cjs,ts}`, omitting `.mts`. Updated glob to `*.{json,mjs,cjs,ts,mts}` in both `format` and `format:check`. Added `"**/*.mts"` to `tsconfig.json` `include` array so `tsc --noEmit` covers the config.
3. **Prettier formatting**: Prettier check flagged unformatted changes in `state.ts`, `payments/state.ts`, `transition.ts`, and `vitest.config.mts`. Ran `npm run format`.
4. **Monotonic audit timestamp**: In `tests/unit/reservations.test.ts`, the stale capture retry was using timestamp 150 following an expiry at 200, triggering domain guard `STALE_EVENT_TIME`. Corrected retry timestamp to 200 to test `RESERVATION_ALREADY_RESOLVED`.
5. **Linter and typecheck fixes in tests**: Resolved two `@typescript-eslint/no-unused-vars` warnings in `reservations.test.ts` by asserting proposal revisions, and resolved TS2339 on union `StockSnapshot` by applying the existing `tracked()` narrowing helper.

### Verification limits

Domain contracts, reservation state transitions, and compare-and-swap tests are pure in-memory models. They do not constitute proof of:
- MongoDB replica set atomic transactions or conditional write mechanics
- Database unique index constraints or persistence schema design
- Webhook signature validation, durable event queueing, or idempotency storage
- Real payment provider SDK integration (Razorpay/Stripe)
- Production authentication, session management, or access control
- Real shipping carrier API integration or physical stock management
All browser and API routes remain Stage 3 placeholders.

## Stage 3 historical record

The following versions and acceptance results describe Stage 3, not verification of the new Part 4A code. Earlier checkpoints: Stage 1 5572b1f; Stage 2 7dc596c.


## Delivered in Stage 3

- Minimal Next.js App Router/TypeScript/Tailwind scaffold, separate store/admin root layouts, loading/error/not-found boundaries.
- All 57 approved page routes visibly say "Placeholder — not implemented." All 15 API paths (16 methods) return 501 with no-store. No forms, CRUD, live data, authentication or provider calls.
- Typed configuration defaults, foundation-only Zod environment validator, narrow client branding layer, ten module and four infrastructure boundary READMEs.
- Runtime pins, npm lockfile, lint/format configuration and repeatable docs, enum, secret, Mermaid and browser route checks.
- Two sequence-diagram labels corrected after the real Mermaid parser rejected semicolons. No commerce behavior/transition changed.
- README contains working setup commands. Generated runtime/browser/build/validation files are ignored. No new planning document.

## Exact versions and compatibility evidence

Public npm registry metadata and official Node distribution metadata were checked on 2026-10-06 immediately before installation.

| Package/runtime | Installed version |
| --- | --- |
| Node / npm | 24.21.0 / 11.19.0 |
| next / eslint-config-next | 16.3.8 / 16.3.8 |
| react / react-dom | 19.3.0 / 19.3.0 |
| typescript | 5.9.3 |
| @types/node | 24.19.1 |
| @types/react / @types/react-dom | 19.3.0 / 19.3.0 |
| tailwindcss / @tailwindcss/postcss | 4.3.3 / 4.3.3 |
| postcss | 8.5.29 |
| eslint / prettier | 9.39.4 / 3.9.9 |
| zod / server-only | 4.6.5 / 0.0.1 |
| @mermaid-js/mermaid-cli | 12.0.0 |
| Mermaid / Puppeteer (transitive dev tooling) | 12.1.0 / 25.12.0 |

Next 16.3.8 was the actual latest stable registry tag; React peer ranges accept 19.3.0. Node 24 satisfies Next's >=20.9.0 and Mermaid CLI's >=22.13.0 requirements. Node's official Windows archive SHA-256 was verified before extraction into ignored .tools. Global Node 20 was not modified.

TypeScript 7 and ESLint 10 were not selected: installed lint peers require TypeScript <6.1 and eslint-plugin-react supports ESLint only through 9. ESLint 9.39.4 installs with an end-of-support warning; upgrade the compatible lint stack when its peers permit it. No peer overrides were used.

[Node release policy](https://nodejs.org/en/about/previous-releases), [Next installation requirements](https://nextjs.org/docs/app/getting-started/installation), [Mermaid CLI](https://github.com/mermaid-js/mermaid-cli), [Vercel Node support](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). Vercel supports Node 24 but manages patch versions; exact local/VPS pins do not prove the eventual Vercel runtime patch. Actual hosting and deployment verification remain deferred.

## Acceptance evidence

Executed under Node 24.21.0 / npm 11.19.0 on Windows:

| Gate | Result |
| --- | --- |
| npm ci --no-fund | PASS; 548 packages installed from lockfile |
| npm run lint | PASS |
| npm run typecheck | PASS; Next route type generation and tsc --noEmit |
| npm run build | PASS; production compilation and page generation |
| npm run check:docs | PASS; 61 Markdown files checked |
| npm run check:secrets | PASS; repository text, including .env.example and lockfile |
| npm run check:enums | PASS; 23 canonical domains, references allowed |
| npm run check:diagrams | PASS; all 11 parsed and rendered to SVG |
| npm run check:routes | PASS; 57 pages visibly rendered in Chromium; 16 API methods, root separation, documented route coverage and 404 checked |
| npm run format:check | PASS |
| npm ls --depth=0 | PASS; exact direct versions match pins |
| npm ls deferred packages --all | Empty; no auth, MongoDB/Mongoose, Razorpay, Cloudinary, Vitest, Playwright test, PDF or CSV libraries installed |
| npm audit --omit=dev | PASS; zero vulnerabilities |
| git diff --check | PASS |

The complete acceptance sequence is npm run verify. Browser/diagram outputs are in ignored .validation. Puppeteer is Mermaid's required peer, reused for the browser gate; no test framework was installed. Page checks assert HTTP 200, visible placeholder text, correct store/admin shell and no browser page errors. Dynamic IDs use a harmless placeholder string.

The first npm ci attempt encountered a native-file lock from an existing project dev server running global Node 20. That server was stopped; the clean install succeeded. The preview was restored with the pinned Node 24 runtime after verification.

## Audit findings and verification limits

Full npm audit reports **9 development-tool findings: 5 high and 4 low**. These are dependency-chain counts rooted in two advisories:
- [braces stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): braces 3.0.3 via Next ESLint tooling; no patched version listed.
- [KaTeX inherited trust settings](https://github.com/advisories/GHSA-238p-pmpm-9mq7): KaTeX 0.16.47 via Mermaid; fixed in 0.18.2, outside the renderer's declared dependency range.

No forced downgrade or unverified dependency override was applied. These remain open tooling risks; lint and diagram tooling use repository-controlled inputs and are not application request handlers. Do not describe the full dependency audit as clean.

Secret and enum checks are static pattern gates, not a proof against every possible encoding or definition style. No credential values were printed; no environment files other than .env.example were read. No database, auth, payment, tax/legal, race or business-rule tests ran because implementation is not authorized. Current placeholder prerendering is not the future authenticated caching/access policy. No hosting deployment or CI runner was exercised.

## Next authorized-work boundary

Post-review 4B repairs are verified. Reusable presentation-only UI is separately authorized. Auth installation, catalog and commerce UI flows remain gated; follow the feature implementation plan before starting a new slice.
