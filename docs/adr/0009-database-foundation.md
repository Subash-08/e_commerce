# ADR 0009: Database ownership and bounded transactions

Status: IMPLEMENTED, VERIFICATION PENDING, 2026-10-06. Stage 4B only.

## Decision

One application owner creates a native MongoClient and attaches a private Mongoose instance with createConnection().setClient(client). Cache the initialization promise globally for development hot reload, otherwise at module scope. Failed initialization clears that promise and closes partial resources. Closing an owner is terminal; request code never closes it. Separate owner factories exist for isolated tools/tests.

Use a default pool of five with explicit selection, connection and operation deadlines. Disable Mongoose autoIndex, autoCreate and buffering. Do not create commerce models in this stage. Use long-running-host-only, once-registered signal handlers; serverless hosts own their lifecycle.

Transactions use the native driver's withTransaction and explicit sessions, snapshot reads, majority writes and primary reads. The ten-second driver timeout bounds database operations and retries; at most three application callback executions are allowed. It does not cancel arbitrary JavaScript or external promises. Callbacks must await sequential database operations, pass the session to every operation, be replay-safe and perform no external effects. No manual retry loop or nested wrapper transaction.

Index manifests are explicit and initially empty. Check compares ordered keys and semantic options. Apply supports dry run, refuses same-name mismatches before creation, creates missing approved indexes only, reports unexpected indexes and never drops anything. Index application cannot run inside the transaction wrapper. A concurrent DDL race can still cause a driver error or partial creation; rerun check and review, never silently replace.

Normalize database errors to safe codes, retain original causes privately, and emit only bounded codes/events. Liveness has no database dependency; readiness returns only ok/degraded and has a two-second response deadline. Closing/draining the HTTP server remains the host's responsibility.

## No-Docker development and verification

The user's latest instruction excludes Docker. Use mongodb-memory-server 11.3.0 to launch real MongoDB 8.2.6 with a WiredTiger single-node replica set on loopback. This is ephemeral local infrastructure, not an in-memory database mock or a production database. Startup may download the server binary. No credentials are needed.

Application Mongoose/native driver identity is 7.7.0. The dev-only replica launcher internally uses 7.5.0. This is an explicit tooling exception to a literal single-installed-copy requirement: no incompatible override, and the launcher client never enters application code. The application still owns exactly one shared driver/client pool. Production installs omit the launcher.

Tests must use generated _test database names with both NODE_ENV=test and APP_ENV=test, assert hello reports the replica set, and clean only owned fixture collections. Transaction fixtures and indexes are created before transactions. Missing infrastructure, skipped tests and absent tests fail acceptance. Detailed work is delegated to [Antigravity](../development/ANTIGRAVITY-4B-VERIFICATION.md).

## Open gates

Real rollback, retry, connection concurrency, index drift and shutdown evidence are pending. Auth is separately blocked by the [compatibility report](../database/AUTH-COMPATIBILITY-REPORT.md), reopening [ADR 0003](0003-auth-and-connections.md). No auth, catalog, checkout, payments or UI implementation is approved here.

## Post-review implementation clarification

When the configured database differs from the URI default, use Mongoose's public useDb on the shared client; keep the original connection as the shutdown owner. Do not rewrite the URI or implicitly change authentication database semantics. Index comparison preserves BSON scalar values through canonical Extended JSON before key sorting. Fixture teardown exposes cleanup errors and releases partially initialized resources. These implement the existing ownership/index contract without changing commerce invariants.
