# Identity implementation

Implemented: private profile/security-guard schemas, default-customer provisioning, Better Auth session hooks, fresh ownership/role guards, bounded HTTP operation allowlist, registration/sign-in/sign-out/recovery/reset routes and account forms. The auth library owns passwords, auth users, accounts, sessions and reset tokens; profiles contain no credential fields. Index creation remains explicit through the reviewed manifest and db:indexes scripts.

Two [recovery email adapters](../../../docs/development/RECOVERY-EMAIL.md) are selectable. Configuration is lazy; missing provider/database configuration fails closed. Public forms do not expose driver or provider errors. Email change, deletion, social login, account linking, broad admin operations and impersonation are not exposed.

The database-backed limiter is shared across instances. Until the deployment's trusted proxy policy is approved, it uses a shared per-path bucket rather than trusting caller-provided IP headers. This protects the boundary but may throttle unrelated users; host-specific trusted IP configuration and abuse acceptance are required before launch.

Account/admin layouts are guarded, but layouts never replace service-level authorization. Future data services must call requireAccess with the persisted resource owner's auth ID; never accept ownership or authority from the browser.

Provisioning uses an idempotent customer-only upsert after library user creation. This operation does not share the library transaction; an interrupted signup can leave an orphan profile. It grants no access without a valid library session, and missing/inactive profiles fail closed. An audited repair procedure is still required before production operation.

Outstanding AUTH-CORE/GUARDS: owner bootstrap, transactional role/deactivation changes with last-admin serialization, audit/revocation job and supported session-deletion retry, auth audit coverage, host-specific IP policy, failure/recovery acceptance, live mailbox delivery. The security-guard schema alone is not an implemented last-admin service. No catalog authorization follows this checkpoint.
