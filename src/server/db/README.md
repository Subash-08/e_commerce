# Database foundation

Stage 4B implementation; verification pending. See [ADR 0009](../../../docs/adr/0009-database-foundation.md) and the [verification handoff](../../../docs/development/ANTIGRAVITY-4B-VERIFICATION.md).

Use the pinned Node 24.21.0 runtime and run npm run db:dev for a local ephemeral replica set and Next development app. Docker and credentials are not required. First startup downloads MongoDB 8.2.6 into ignored .cache/mongodb-binaries. Stop with Ctrl+C; data is removed. This launcher is not persistent storage or a production deployment. Do not run it alongside another app on the same port.

The launcher supplies the connection privately to the child process. Never log a URI or inspect real environment files. Other hosts inject MONGODB_URI, MONGODB_DB_NAME and APP_ENV at runtime. APP_RUNTIME defaults to serverless; long-running enables shutdown registration. Pool size defaults to five and must be budgeted across host processes. Config validation is lazy, so build/liveness do not require a database.

Use getDatabase for application access; only lifecycle code calls closeDatabase. Transactions receive a ClientSession explicitly; pass it to every repository operation. No provider calls, parallel operations, index creation or manual commit/abort in callbacks. Driver retries may replay callbacks. Driver timeouts cannot cancel arbitrary application promises.

npm run db:indexes:check compares the approved manifest. npm run db:indexes:apply -- --dry-run previews missing indexes; --approve permits creation of missing approved entries. The current empty manifest means no commerce indexes are approved, not that an arbitrary database has passed index review. Same-name mismatches fail, unexpected indexes are reported, and nothing is dropped.

GET /api/health is liveness only. GET /api/ready returns 200 with status ok or 503 with status degraded; neither includes database configuration or topology. Connection and transaction logs contain event names and safe codes only. Never log diagnosticCause; it exists for restricted debugging.

Production code has no test fixtures. Test infrastructure belongs under tests/fixtures and must refuse destructive cleanup unless both test environments, generated _test name and owned collection names are verified.
