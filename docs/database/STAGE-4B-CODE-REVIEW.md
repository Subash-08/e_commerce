# Stage 4B pre-acceptance code review

Reviewed 2026-10-06 against the in-progress working tree while Antigravity verification was running. These are static findings, not runtime reproductions or a verdict on the forthcoming report. No implementation/test files were edited by this review. Resolve or disprove each finding against the final submitted revision before accepting 4B.

## 1. High: native and Mongoose database selection can diverge

In src/server/db/connection.ts, native access uses client.db(config.databaseName), but Mongoose attaches through setClient(client) without selecting that same configured database. The working tree removed the MongoClient dbName option from the checkpoint.

Installed Mongoose source, node_modules/mongoose/lib/drivers/node-mongodb-native/connection.js, shows setClient obtains the client's default database name. Therefore a URI with no database, or one naming a different database, can give native and Mongoose different databases despite identical client identity. Existing shared-client identity assertions do not prove shared database identity.

Required resolution: select the configured database through supported driver/Mongoose APIs while retaining one client and correct shutdown ownership. Add a real regression with URI database A and configured database B (both generated test-only databases), assert both handles select B, and prove a Mongoose write is visible through the native B collection. Also cover a URI without a database component. Do not fix this by requiring the URI path and independent configuration to match silently.

## 2. Medium: partial-filter normalization loses BSON values

src/server/db/indexes.ts sorted() recursively treats every object as a plain enumerable-key object. Two distinct Date values both become empty objects. Thus partialFilterExpression containing a date cutoff can compare equal even when the cutoff changed; other BSON scalar types need explicit handling too.

Required resolution: BSON-aware canonicalization preserving scalar type/value and ordered compound index keys, or explicit fail-closed validation restricting manifest values to the actually supported subset. No JSON round trip that erases BSON types. Add a regression using distinct date cutoffs in otherwise identical partial filters; unchanged values must compare equal and changed values must report drift.

The current approved application manifest is empty, so this has not changed an existing commerce index. It remains a correctness issue in the reusable checker.

## 3. Medium: fixture teardown hides failures and partial startup can leak

tests/fixtures/db-harness.ts teardown catches and discards owner-close, guardedCleanup and context-client close failures. This can report success despite failed cleanup. getSharedTestReplicaSet assigns the shared replica only after the topology probe; if connection/probing fails beforehand, stopSharedTestReplicaSet cannot find the already-started replica to stop it. Context initialization similarly needs cleanup if failure occurs before returning the context.

Required resolution: best-effort cleanup of all acquired resources in finally blocks, with aggregated cleanup errors surfaced to the runner. Reset rejected startup promises and stop partial replicas. Preserve the original test error as well as cleanup evidence. Fault-injection tests may exercise teardown failure without touching non-test databases.

## Acceptance handling

These findings may overlap work Antigravity is already doing. Reconcile against its final diff/report rather than overwriting concurrent changes. Passing existing tests does not dismiss a missing regression. Retain the no-Docker requirement and the separate auth gate. Once the final review is provided, Codex can implement complex corrections and run focused checks, with remaining broad verification delegated as needed.

## Resolution after verification report 32d40ef

All three findings remained in that revision and were repaired by Codex:

- Mongoose now selects the configured database with public useDb while the original connection remains the lifecycle owner. Two real regressions cover a different URI database and an omitted URI database; Mongoose writes are visible through the native configured database.
- Index normalization serializes BSON through canonical Extended JSON before sorting object keys. A real date-cutoff index test proves unchanged values match and changed values report drift.
- Fixture initialization closes partial clients/replicas and resets failed startup promises. Teardown attempts owner closure, collection cleanup and client closure while surfacing aggregated errors; suite teardown stops replicas even when context cleanup throws. Regressions cover probe failure/retry, preserved original plus cleanup errors, and a surfaced owner-close failure after owned collections are removed.

Six new regressions pass against real MongoDB 8.2.6. The full test run now passes 166 unit and 34 integration tests with no skips. Initial attempts failed because C: had insufficient space for WiredTiger journals; successful runs used process-local TEMP/TMP under ignored .validation/mongo-temp on D:. No Atlas URI was used. See PROGRESS.md for the final acceptance-gate record.
