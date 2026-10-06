# Auth compatibility report

Reviewed 2026-10-06. Result: **REOPEN ADR 0003**. No auth package is installed and auth implementation is not authorized.

## Version and source evidence

Public registry metadata and published package source were inspected, not executed as an auth application.

| Component | Exact version | Finding |
| --- | --- | --- |
| Node / Next / React | 24.21.0 / 16.3.8 / 19.3.0 | Existing pins; published Better Auth peers accept Next 16 and React 19 |
| Mongoose / application MongoDB driver | 9.11.0 / 7.7.0 | Mongoose requires ~7.7; installed application driver is deduplicated |
| Better Auth / Mongo adapter | 1.7.7 / 1.7.7 | Registry stable releases observed; not installed |
| Mongo adapter driver peer | ^6.0.0 or ^7.0.0 | Accepts application driver 7.7.0 |
| mongodb-memory-server | 11.3.0 | Dev-only core uses its own driver 7.5.0; never passed to application or auth |

The application will share an existing native client through Mongoose's public setClient API and the adapter's public db/client arguments. Sharing a client does not make auth operations participate in a commerce transaction.

## Blocking index-policy finding

Published @better-auth/mongo-adapter 1.7.7 dist/index.mjs contains ensureModelIndexes, invoked during ordinary adapter operations, which calls collection.createIndex. Its public config type exposes client, transaction, usePlural and debugLogs, but no public auto-index-disable switch. An internal schema disableMigrations check exists; it is not evidence of a supported configuration that disables creation across every auth model.

The approved deployment policy requires reviewed index scripts, with no runtime index creation. Compatibility is therefore not approved. Resolve this with a documented, supported configuration and runtime proof, or reopen the auth selection before installation. Do not patch private adapter internals, add an independent password implementation, or open a second application pool to work around it.

## Transactions, recovery and authority

The adapter accepts the existing client and transaction mode. Its inspected transaction wrapper starts its own session, explicitly starts/commits/aborts, and ends the session. It does not accept a caller's commerce session or use the commerce withTransaction retry wrapper. Do not promise cross-library atomicity or identical retry semantics.

The published password reset route checks revokeSessionsOnPasswordReset and deletes user sessions. Public documentation also exposes user-session revocation through the admin API. These are source/API findings, not runtime acceptance.

Still required in the separately authorized auth slice:
- Supported session creation hook stamps profile authVersion; old cookies fail after role change/deactivation, with cookie authority caching disabled.
- Fresh ownership, role and active-profile checks at service boundaries.
- Password reset invalidates existing sessions.
- Post-commit revocation retries without putting provider/auth API calls in a commerce transaction.
- Deny unused admin plugin endpoints; prove direct requests cannot bypass guarded last-admin/role services.
- Prove shared client identity, supported index policy and actual MongoDB transaction behavior.

## Advisory review

The official advisory list and linked advisories were reviewed on 2026-10-06. GHSA-965c-763c-88jm lists 1.7.7 as patched and concerns certain OAuth/Magic Link combinations. OAuth, Magic Link login, SSO, impersonation and other optional plugins are outside the initial email/password scope. This does not establish that every advisory is irrelevant or that the package is universally safe. The OAuth Proxy advisory and the complete selected-plugin advisory set must be rechecked immediately before auth installation.

No auth runtime, reset, hook, role-revocation or endpoint-bypass tests ran. Release maturity, a supported index-off configuration, and runtime behavior remain open; do not turn the peer-range result into auth approval.

## Sources

- [Mongoose connection API](https://mongoosejs.com/docs/api/connection.html)
- [Better Auth Mongo adapter](https://better-auth.com/docs/adapters/mongo)
- [Session management](https://better-auth.com/docs/concepts/session-management)
- [Email/password recovery](https://better-auth.com/docs/authentication/email-password)
- [Database concepts](https://better-auth.com/docs/concepts/database)
- [Official security advisories](https://github.com/better-auth/better-auth/security/advisories)
- [OAuth/Magic Link advisory](https://github.com/better-auth/better-auth/security/advisories/GHSA-965c-763c-88jm)
- [OAuth Proxy advisory](https://github.com/better-auth/better-auth/security/advisories/GHSA-r4xp-prcw-77qf)

Exact package metadata: public npm registry for mongoose, mongodb, mongodb-memory-server, better-auth and @better-auth/mongo-adapter. Published tarball source was extracted under ignored .tools/auth-research for inspection; it is not an application dependency.

## Follow-up decision review: 2026-10-06

This is a source/documentation review while Antigravity runs 4B verification. No auth packages or runtime configuration changed.

The [public plugin schema documentation](https://better-auth.com/docs/concepts/plugins) exposes disableMigration for plugin tables. However, [the 1.7.7 core table builder](https://raw.githubusercontent.com/better-auth/better-auth/v1.7.7/packages/core/src/db/get-tables.ts) copies that flag into plugin schema metadata but reconstructs user, session, account and verification tables without forwarding it. Therefore a plugin that merely sets this flag on those core tables is not an established solution. Do not weaken unique field definitions to prevent index creation.

[Auth.js credentials documentation](https://authjs.dev/getting-started/authentication/credentials) states that credential persistence and password/reset logic are application responsibilities. Our assessment: Auth.js credentials is not a drop-in replacement for the approved library-owned credential lifecycle. An external identity provider could own those responsibilities, but would introduce a separate architecture and service decision; none is selected here.

| Option | Assessment under current requirements |
| --- | --- |
| Better Auth with a supported switch covering every selected table | Preferred resolution if a compatible released API and runtime evidence become available; not established for inspected 1.7.7 |
| Better Auth with an exception allowing its index commands | Requires an explicit ADR policy amendment; not approved by this report |
| Auth.js credentials with application-owned password/reset code | Does not satisfy current credential ownership requirements; not recommended as an automatic fallback |
| External managed identity provider | Requires service, cost, portability and authority review; not selected |
| Private adapter patch, intercepted createIndex, or removal of uniqueness metadata | Reject: obscures library behavior or weakens the contract |

Precreating indexes alone does not disable the adapter's createIndex calls. Do not assume that identical existing indexes, a warmed process cache, or restricted database privileges will make all fresh-process auth flows succeed. Any proposed index-policy exception needs command-monitoring evidence on signup, signin, session refresh, password reset and revocation; an exact reviewed manifest; cold-start/concurrent-instance tests; and deliberate missing/mismatched-index failure behavior. This is proposed acceptance evidence, not authorization to run an auth slice.

Recommendation: retain REOPEN ADR 0003 and finish database acceptance independently. Do not switch libraries or relax index/credential rules solely to unblock installation. After the 4B test review, resolve this narrow architecture choice before auth implementation. Catalog and all later slices still require their own authorization.

