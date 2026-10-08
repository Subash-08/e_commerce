# Identity implementation

Better Auth owns users, passwords, accounts, sessions and reset tokens. The application profile owns role, status, authVersion, revision and timestamps. Services enforce fresh authority; repositories own persistence. Admin layouts do not replace service checks.

Implemented: registration/login/logout, password recovery, private account page, audited first-admin bootstrap, user list/search/role and status filters/pagination, role and activation changes, transaction-serialized last-admin protection, audit trail and durable session-revocation retry. Development accepts the configured loopback port on localhost and 127.0.0.1; production retains the exact configured origin.

Atlas is the only database runtime. Configuration is loaded through the environment layer. Indexes are explicit; startup does not create or synchronize indexes. No local MongoDB launcher or memory-server dependency remains.

Operator commands:

- npm run auth:bootstrap -- --approve --user-id ID: only an existing active registered account, only before any administrator/guard exists. Records the initial admin event and invalidates old authority.
- npm run auth:repair -- --approve --user-id ID: repairs only a missing customer profile for a registered ID, audits it, preserves valid profiles and advances beyond existing session versions. Production additionally requires --production. No credential changes or browser repair endpoint.

Session deletion uses the supported server-only Better Auth endpoint. Failed cleanup remains durable; fresh authVersion checks deny stale cookies immediately. Startup, authority mutations and the admin retry button drain bounded batches. Scheduled draining and host-specific trusted-proxy rate limits remain deployment gates.

The development mailbox is available only in development at /api/auth/dev-mail. Resend and n8n remain selectable; external delivery requires the chosen provider's locally configured credentials and live verification. Email change, account deletion and social sign-in are deliberately not exposed. Customer addresses and commerce data belong to separate modules.
