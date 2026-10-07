# ADR 0003: Conditional Better Auth and shared MongoDB client

Status: AUTH-DECIDE accepted for the pinned minimal Better Auth 1.7.7 configuration, 2026-10-07. The user authorized AUTH-CORE after the amended driver checks pass. See [runtime evidence](../database/AUTH-SPIKE-REPORT.md). This supersedes the initial overbroad index-policy finding; production feature acceptance is still required.

## Amended driver criterion

Exactly one mongodb copy in the production dependency tree; dev-only tooling may carry its own, enforced by a script.

The user approved this wording on 2026-10-07. npm run verify starts with check:production-driver, which checks the npm production tree and shared driver resolution/class identity. An isolated npm ci --omit=dev passed with one driver. Historical evidence included an extra development copy through the memory-server launcher. The Atlas-only migration removes that launcher and its driver; the production identity gate remains required. No overrides, driver casts or aliases are allowed to force compatibility.

The exact minimal email/password configuration emits no runtime index commands after reviewed indexes are precreated. New plugins or schema index declarations require the runtime command check again; this is not a general auto-index-disable guarantee.

## Decision

The server DB connection module owns one native MongoClient and one connection promise per process/isolate. Mongoose uses createConnection().setClient(client); Better Auth's official MongoDB adapter receives the same client's db and client for supported transaction mode. Do not call a second mongoose.connect or open clients per request. Development hot-reload reuses the promise; rejected initialization resets safely. Only the lifecycle owner closes connections at process/test teardown, never after a request.

Use one compatible MongoDB driver dependency identity; verify Mongoose's actual driver and adapter peer ranges before pinning. Do not force incompatible driver majors using overrides or type casts. Bounded pool size is multiplied by process/instance count; set it against Atlas limits. Same client does not imply automatic session sharing or atomic cross-library operations.

Better Auth owns credentials, auth users/accounts/sessions/tokens. Profiles link canonical authUserId and own role/status/authVersion; no second password implementation. Library database-session validation and fresh profile checks run server-side. Cookie session caching is disabled for authority.

## Revocation contract

On role/deactivation change, update profile authVersion/status and guarded admin membership transactionally with audit/revocation job. Supported session-creation hook stamps the current authVersion; mismatches fail closed. Revoke stored auth sessions through a supported server boundary after commit with retry. No need to place a library HTTP/API revocation call inside the commerce transaction. Last-admin checks serialize through one shared guard.

Official admin plugin documents user-session revocation, but enabling it also exposes powerful operations. Prefer the narrow supported server boundary; if plugin is necessary, deny unused role/ban/impersonation/password endpoints and prove no route bypasses our guarded role service. Do not maintain independent plugin-role authority. This adapter integration is a required compatibility test, not an assumption that the default plugin is safe.

Password reset uses library flow with revokeSessionsOnPasswordReset enabled. Re-authentication and reset links never appear in logs. Email/password is initial scope; OAuth, Magic Link login, SSO and impersonation are not enabled. A guest order access link is a separately purpose-scoped order grant, not an auth login plugin.

## Supporting documentation

- [Mongoose setClient](https://mongoosejs.com/docs/api/connection.html#Connection.prototype.setClient()) supports reuse of native client.
- [Better Auth MongoDB adapter](https://better-auth.com/docs/adapters/mongo) documents client-based transactions on replica set/sharded deployment.
- [Session management](https://better-auth.com/docs/concepts/session-management) documents revocation and cookie-cache staleness.
- [Email/password](https://better-auth.com/docs/authentication/email-password) documents recovery and explicit reset-session revocation.
- [Next integration](https://better-auth.com/docs/integrations/next) documents App Router integration.
- [Admin session operations](https://better-auth.com/docs/plugins/admin) document server user-session revocation; broader endpoints need exclusion.

## Before version changes / production acceptance

Recheck current stable release, all selected adapter/plugin versions, exact driver peer compatibility, Node/Next support and advisories. Published [GHSA-965c-763c-88jm](https://github.com/better-auth/better-auth/security/advisories/GHSA-965c-763c-88jm) affects certain OAuth+Magic Link configurations before 1.7.7 and lists 1.7.7 patched; [OAuth Proxy advisory](https://github.com/better-auth/better-auth/security/advisories/GHSA-r4xp-prcw-77qf) and other advisories must also be checked against enabled code. This is not a blanket clean bill for any version and these observations must not be copied into pins.

Static release/source checks happen before installing auth. Runtime proof (when implementation is authorized) must include replica-set rollback, shared-client identity, password reset invalidation, demotion/deactivation with old cookies, authVersion hook and direct endpoint bypass. If supported hooks/revocation or driver compatibility fail, reopen C and compare Auth.js; do not silently use two pools or invent password/session cryptography.

Alternatives: two independently bounded clients are workable but not the approved default; managed auth adds service dependency; Auth.js remains fallback. Migration cost is high after real users/sessions exist.
