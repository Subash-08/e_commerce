# Auth compatibility acceptance — 2026-10-07

Result: AUTH-DECIDE passes the amended driver criterion. AUTH-CORE is authorized by the user's 2026-10-07 reply; this report is not AUTH-CORE acceptance.

## Evidence

Pinned Node 24.21.0/npm 11.19.0; Better Auth, core and Mongo adapter 1.7.7; Mongoose 9.11.0; production mongodb 7.7.0. No dependency overrides, npm aliases or driver casts were introduced.

- `npm run test:auth-spike`: 12/12 passed, zero failures/skips/todos/unhandled errors, real local replica set, 2026-10-07. Fixture: tests/auth-spike/auth.test.ts. No Docker, Atlas or external delivery.
- `npm run check:production-driver`: passed. The script invokes `npm ls mongodb --omit=dev --all --parseable`, counts distinct real installation paths, resolves the driver from Mongoose, Better Auth and the official adapter, and compares their MongoClient class identity. It is the first step of `npm run verify`.
- An isolated copy of the current package.json/package-lock.json in ignored .validation/production-install ran `npm ci --omit=dev --no-fund --no-audit` successfully (100 packages). The same identity script passed there. `npm ls mongodb --omit=dev --all` showed only 7.7.0, deduplicated across all four production consumers.
- Full `npm ls mongodb --all`: the only additional copy is 7.5.0 under mongodb-memory-server-core, a transitive dependency of dev-only mongodb-memory-server 11.3.0. The core launcher is not a direct application dependency. The spike checks the lockfile's dev classification and exact extra path.
- `npm audit --omit=dev`: zero reported vulnerabilities after auth moved to production dependencies. This is a point-in-time registry result, not a security guarantee.

## Runtime results and scope

| Required result | Passed evidence | Limit |
| --- | --- | --- |
| Reset revokes sessions | A real sign-in cookie resolves before reset; getSession returns null after the library reset flow | Delivery captured in memory only; no real mailbox |
| Demotion/deactivation invalidates old cookies | Fresh profile checks reject the same old cookie through the service, direct custom API and HTTP endpoint (403) | Immediate authorization denial; deletion of stored sessions after role changes remains AUTH-CORE implementation |
| authVersion fails closed | Version mismatch denied; missing/inactive profile refuses session creation without increasing session count | Production services must use the same authority rule |
| No role-service bypass in selected configuration | Broad admin plugin is absent, setRole API absent, /admin/set-role returns 404; the only protected custom endpoint invokes the shared guard | Production role service, routes and last-admin race checks do not exist yet; they need their own acceptance evidence |
| Auth index list matches reviewed set | Explicit applyIndexes/checkIndexes and the reviewed five-index fixture pass; warm and cold adapter activity emits zero createIndexes commands | Applies only to this exact minimal configuration; plugin/schema changes require rechecking |
| Monitoring actually active | A deliberate pre-test createIndexes positive control was observed before clearing the log | See [recorded commands](AUTH-SPIKE-INDEX-COMMANDS.json) |

## Correction to initial source review

The initial report overgeneralized ensureModelIndexes. In adapter 1.7.7, that function resolves declared table-level indexes. The tested minimal core email/password tables have no table-level indexes; field-level index/unique metadata does not make this resolver create them. Consequently normal operations in the exact tested configuration emit no index creation. The five necessary indexes are precreated through our reviewed script. No private adapter patch or invented disable-index option is used. Keep the historical [initial review](AUTH-COMPATIBILITY-REPORT.md) as superseded evidence, not the current decision.

Source inspection: node_modules/@better-auth/mongo-adapter/dist/index.mjs and the installed @better-auth/core table/index resolver. Official [Mongo adapter](https://better-auth.com/docs/adapters/mongo), [session management](https://better-auth.com/docs/concepts/session-management), [email/password](https://better-auth.com/docs/authentication/email-password) and [security advisories](https://github.com/better-auth/better-auth/security/advisories) informed the spike. Optional OAuth, Magic Link, SSO, impersonation and broad admin plugins are disabled.

## Next implementation boundary

Keep the spike outside application imports. AUTH-CORE must implement real profile/session integration, fresh service guards, registration/login/logout/recovery, distributed abuse controls, neutral responses, safe delivery, audited authority changes, last-admin serialization, supported post-commit revocation and owner-only bootstrap. Email change and account deletion remain deferred. No catalog, homepage or purchase code is accepted by this report. Auth.js remains the named fallback if a required supported boundary fails; switching would need an explicit credential-lifecycle ownership decision, not a second concurrent password implementation.
