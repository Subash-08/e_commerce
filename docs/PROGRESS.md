# Foundation progress

Updated 2026-10-06. Workspace: D:\AI\e-commerce. Branch: codex/stage-4b-database.

## Current gate

Part 4A is verified at fd63cf2 (161 unit tests). Part 4B database implementation is authorized and implemented as a checkpoint; **verification pending**, not stage complete. The latest user instruction excludes Docker. Codex handles complex implementation; Antigravity owns tests and routine acceptance checks.

Use [the Stage 4B verification prompt](development/ANTIGRAVITY-4B-VERIFICATION.md) next. No credentials are required for the local real replica set. No auth installation, catalog, checkout, payments or UI work is authorized.

## Part 4B implementation checkpoint

Implemented shared native/Mongoose connection ownership, promise reuse/reset, bounded pool/timeouts, replica-set topology check, lazy redacted configuration, bounded native transaction retries with explicit sessions, owner shutdown, minimal liveness/readiness, reviewed index check/apply, and a no-Docker ephemeral MongoDB launcher. No commerce models or fixtures were added to production. DomainError received a constructor-syntax-only change for Node's native TypeScript stripping; domain behavior is unchanged.

See [ADR 0009](adr/0009-database-foundation.md) and [database usage](../src/server/db/README.md).

| Version | Observed installation |
| --- | --- |
| Node / npm | Existing pins 24.21.0 / 11.19.0 |
| Next / React | Existing pins 16.3.8 / 19.3.0 |
| Mongoose | 9.11.0, exact production dependency |
| MongoDB native driver | 7.7.0, exact production dependency; Mongoose deduplicated |
| mongodb-memory-server | 11.3.0, exact dev dependency |
| MongoDB server binary | 8.2.6 selected in launcher; NOT downloaded/launched here |
| Launcher internal driver | 7.5.0, dev-only separate copy; no override |
| Better Auth / Mongo adapter | 1.7.7 reviewed from registry/source; NOT installed |

Commands actually executed in 4B: public registry/source inspection; npm install --save-exact mongoose@9.11.0 mongodb@7.7.0 --no-fund; npm install --save-dev --save-exact mongodb-memory-server@11.3.0 --no-fund with postinstall server download disabled; npm ls mongodb --all. Installs succeeded and reported nine dev audit findings; fresh full audit and production audit are delegated. No credentials or real environment files were read.

**Not run in 4B:** npm ci, unit/integration tests, formatting, lint, typecheck, build, route checks, docs/secret/enum/diagram gates, real MongoDB startup/rollback/retry/shutdown checks. Prior 4A/Stage 3 passes below are historical and do not verify these changes. Integration harness/tests, split test scripts, no-skip enforcement and route-check updates are explicitly delegated in the handoff.

Auth result: **REOPEN ADR 0003**. The inspected adapter creates indexes during ordinary operations; a supported index-policy-compatible configuration has not been established. Read the [compatibility report](database/AUTH-COMPATIBILITY-REPORT.md). Driver peer compatibility alone is not auth approval.

Stage 3 base: 6421b7d. Stage 4A checkpoint: 5164732; verified handoff: fd63cf2. Commit this 4B checkpoint before handing off; record verification in a subsequent commit and stop at the 4B gate.

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

Complete the delegated Part 4B verification, report actual evidence, then stop. Auth installation and all later feature slices remain separately gated. Historical acceptance evidence above is not evidence for the 4B checkpoint.
