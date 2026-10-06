# Antigravity prompt — Part 4A verification only

Copy the prompt below into Antigravity.

---

Work in D:\AI\e-commerce on the existing branch codex/stage-4a-domain. Continue the existing working tree and checkpoint; do not create a fresh project, reset changes, or switch back to Stage 3.

The user has assigned complex business logic to Codex and routine verification/testing to you. Implemented scope is Part 4A only: integer-paise pricing, canonical-state generation, order/payment/refund/reservation functions. Stage 3 base commit is 6421b7d. Do not implement 4B/4C/4D, database/auth integration, provider calls, homepage, product cards or admin UI.

## Read first

- AGENTS.md and docs/PROGRESS.md
- docs/adr/0008-pure-domain-foundation.md
- docs/commerce/PRICING-RULES.md and STATE-MACHINES.md
- docs/commerce/ORDER-LIFECYCLE.md and PAYMENT-LIFECYCLE.md
- docs/quality/TESTING-STRATEGY.md and EDGE-CASES.md
- docs/development/DEVELOPMENT-ORDER.md
- src/modules/pricing/{money,price}.ts
- src/modules/orders/state.ts
- src/modules/payments/state.ts
- src/modules/checkout/reservations.ts
- src/shared/domain/{errors,transition,states.generated}.ts
- scripts/generate-states.mjs, scripts/check-enums.mjs
- tests/fixtures/domain.ts, tests/unit/*.test.ts, vitest.config.mts

## Known starting evidence

Vitest 5.0.3 is installed; its resolved Vite peer is 8.3.3. No additional test library is needed.
146 unit tests passed before the user's delegation instruction. An earlier typecheck and generated-enum check passed. Those results do NOT cover the final late-capture deadline/audit changes.

The newest complex fix handles verified capture after a pending online order's deadline but before the expiry worker runs. It proposes an audited PENDING_PAYMENT -> EXPIRED -> PLACED path when all recovery facts pass, or PENDING_PAYMENT -> EXPIRED with REFUND_REQUIRED when they do not. It uses one revision-guarded proposal and describes release of old holds before consuming fresh generations. Nothing is actually persisted or sent to a provider.

No final lint/build/docs/diagram/browser check has run for this checkpoint. Do not call Part 4A verified until you run the gates below.

## Boundaries

- Never read .env* except .env.example. Never print environment values or credentials.
- Do not install MongoDB, Mongoose, Better Auth, Razorpay, PDF/CSV libraries, Playwright, coverage packages or other tools.
- npm ci is authorized only for the existing lockfile. Do not run npm audit fix --force, silently upgrade packages, or add peer overrides.
- Synthetic fixtures go in tests/fixtures only. No runtime fixtures, seed scripts, production database, provider traffic or real user data.
- Do not change money formulas, canonical state membership, transition guards, stock rules, tax policy or auth architecture merely to make tests pass. Report any such issue back for Codex review, with a minimal failing regression and expected behavior from the contract.
- You may fix formatting, obvious import/config/type plumbing and validation script mechanics that do not change business behavior.
- Do not delete assertions, mark tests skipped/todo, weaken expected values, or bypass failing checks.
- No dependency-wide cleanup, unrelated refactoring or UI work.
- Preserve user changes. No destructive Git or force push.

## Runtime and command setup

Use Node 24.21.0 and npm 11.19.0, pinned in .nvmrc/package.json.
The existing project-local Windows runtime is:
D:\AI\e-commerce\.tools\node-v24.21.0-win-x64\node.exe

For PowerShell, prepend that directory to PATH for your process, without printing PATH/environment values. Do not use global Node 20. Verify node --version and npm --version.

Use command-scoped git -c safe.directory=D:/AI/e-commerce only if ownership requires it; do not set a global wildcard safe directory.

A project dev preview may be running on localhost:3000. If npm ci hits EPERM on a native dependency, identify the exact D:\AI\e-commerce Next dev process and its children. Stop only those project processes to release the lock, then retry. Never kill all Node processes. Restore the project preview with the pinned runtime after checks if you stopped it. Launch any background process hidden and keep logs in ignored .validation.

## Regression work before acceptance

Keep the existing 146 cases and add focused tests for the final logic, using injected timestamps and trusted synthetic facts:

1. Overdue PENDING_PAYMENT online order, with context.at exactly expiresAt and also later, receives verified full capture:
   - all lines eligible, stock reacquired and coupon reacquired -> PLACED/NONE;
   - audit path is PENDING_PAYMENT -> EXPIRED -> PLACED;
   - revision increments once for the composite proposal;
   - old-expiry release descriptions precede new-generation consumption descriptions.
2. Same overdue pending case without stock or coupon capacity, with an unavailable status-only line, partial/extra capture, or pending refund:
   - remains EXPIRED with REFUND_REQUIRED;
   - recorded capture is not erased;
   - no new stock-consumption description is emitted;
   - refund-review work is requested.
3. A pending online order BEFORE its deadline must reject lateCapture; the ordinary verified full-capture transition still works. COD pending orders must not use online expiry recovery.
4. Replay the exact late-capture operation after successful recovery, and after a later valid order transition:
   - return the current order, no second effects, no extra revision/history;
   - changed facts with the same operation ID must conflict.
5. Assert normal order, payment and resolved-reservation audit entries include from/to paths. Actor/reason/operation/time are retained.
6. Pending and successful refund claims together cannot exceed capture. Add an explicitly in-memory CAS race for the last refundable amount; exactly one commit can win.
7. Exercise both serializations of expiry versus capture proposals against the same held-stock revision. A stale proposal cannot overwrite the winning balance; terminal consumption/release cannot flip or happen twice.
8. Preserve the existing last-unit race, exactly-once expiry, PAY-03/PAY-04, failed-old-attempt, coupon remainder, shipping-tax and safe-integer tests. Verify mixed/status-only inputs create no synthetic reservation.

Important: these tests are pure/in-memory contract tests. They are NOT proof of MongoDB atomicity, unique indexes, transaction rollback, webhook durability, real provider verification or production auth. Do not add a database to simulate completion of those later gates.

## Run and fix the routine gates

Run commands sequentially; record exit status and real output summaries:

1. npm ci --no-fund
2. npm run format
   - Ensure vitest.config.mts is covered by formatting/type checking.
   - Keep the generated state file reproducible. If stale, run npm run generate:states; never hand-edit it.
3. npm run format:check
4. npm run verify
   - This includes test, lint, typecheck, build, docs links, secret patterns, enum generation/duplicates, real Mermaid rendering and browser route checks.
   - All eleven Mermaid diagrams must render.
   - All 57 placeholder pages and 16 API method placeholders must still pass; no domain logic belongs in those routes yet.
   - Browser checks start their own production server on 127.0.0.1:3217 and must shut it down afterward.
5. npm audit --omit=dev and npm audit
   - Previous full audit had nine development-tool findings (five high/four low), rooted in braces and KaTeX; production audit had zero.
   - Record current findings, including any change. Do not pretend the full audit is clean or force unrelated upgrades.
6. npm ls --depth=0 and a check that deferred provider/database/auth libraries remain absent.
7. git diff --check; inspect the final diff for accidental route changes, secrets, generated build/cache output and weakened tests.

If a command fails due to Windows process spawning/browser support or environment restrictions, report the exact command/error and that it remains unverified. Do not count a structural diagram check as rendering. Do not copy earlier test/build success as current evidence.

## Deliver and stop

Update docs/PROGRESS.md with:
- exact runtime/testing versions;
- final test count and what the new cases prove;
- actual command results;
- initial failures and routine fixes;
- unchanged/open audit findings;
- explicit lack of real DB/provider/transaction/auth validation.

If all gates pass, mark Part 4A complete and commit only the Part 4A verification changes on the existing branch. If business logic needs correction, keep the gate pending, retain the failing regression and report back without altering the business rule. Do not commit unrelated user edits.

Return a concise report with commit hash (if created), changed files, test/build/check results, failures requiring Codex reasoning, and any environment blocker. Stop. Do not start 4B, auth installation, catalog models or UI.

---
