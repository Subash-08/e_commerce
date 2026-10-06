# Security and privacy model

Server trust boundary: request payload/cookies/URL/provider callback are untrusted until validated. Public DTOs exclude cost price, private notes, drafts, PII and secrets. No roles/prices/totals from browser are authoritative.

## Authorization

| Action | Customer | Staff | Admin |
| --- | --- | --- | --- |
| Profile/address/order/invoice | Own records only | Own account; operational access as below | Operational access audited |
| Catalog/taxonomy/media/content | Read published | Create/edit/publish/archive | Same |
| Fulfillment/customer support | View own order | Guarded operational actions, minimal PII | Same plus exception review |
| Payment/refund/issue corrections | View own summary | Read needed summary; no refund | Guarded financial actions |
| Coupons/reports/settings/users/audit | No | No except assigned operational views | Yes with fresh role verification |
| Role/deactivation | No | No | Last-admin guard + audit + revoke |
| Optional work management | No | Assigned/team policy | Manage |

Authentication library owns credentials/sessions. Application profile owns canonical role/status/authVersion. No second password/user credential model. Disable session cookie caching for authoritative checks; read current profile each protected request. On role/deactivation: transaction updates profile/authVersion/audit/last-admin guard and enqueues revocation; deny stale session authorization immediately, then revoke actual auth sessions. Session creation captures authVersion through a supported server hook; missing/mismatch fails closed. Sharing a MongoClient does not make arbitrary auth library calls part of a commerce transaction.

Library admin plugin's broad role/ban/impersonation endpoints must not become bypasses. Select a supported server-side revocation boundary during compatibility check; if plugin is used, deny unused endpoints and route all role mutations through the guarded service. Do not ship impersonation or password-setting admin shortcuts. Verify direct endpoint bypass tests before auth acceptance.

## Web, data and integrations

- Schema-validate body/query/form/CSV/media data; reject Mongo operators and excess fields/lengths. Bounded pagination/IDs/uploads.
- Secure HttpOnly SameSite cookies, HTTPS in production, trusted origin/CSRF checks on browser mutations. Webhook HMAC is a separate boundary.
- Distributed rate limits on login/recovery/guest lookup/checkout/contact and expensive search; a simple Mongo-backed or host control suffices, no mandatory Redis.
- Password hashing/recovery through library; neutral enumeration responses, short-lived one-use tokens, password reset revokes sessions.
- Rich content is typed/escaped; safe JSON-LD serialization escapes less-than and script-breaking sequences. No arbitrary stored script/HTML.
- Cloudinary signatures restrict resource type/folder/size and authorized editor. Reject arbitrary remote-fetch URLs or apply explicit SSRF-safe allowlist. Private invoices/imports never use public media URLs.
- Webhook secret distinct from payment API secret; compare signatures safely against raw bytes; minimize stored payload/retention.
- Scheduler secret separate from auth; no query-string secrets. Rotate and audit without printing values.
- Secret env is server-only; .env.example contains blanks only. No credentials in database business settings.
- Logs redact PII/tokens/payment payload; correlation IDs enable incident diagnosis without copying sensitive data.

## Privacy and operational controls

Guest order number/email does not grant detail access; verified scoped proof does. Matching account email never attaches orders. Consent for newsletter/analytics is independent of purchase and client law/policy. Record terms/policy version and time without unnecessary fingerprinting. Legal/CA review sets retention, disclosure, erasure exceptions, grievance process and incident obligations; no compliance certification is implied.

Staging isolates keys/database/assets/email recipients and blocks search indexing plus public access. Backups are encrypted/access-controlled and restore-tested. Dependency advisories and tested security patches precede production.

Critical tests include two admins concurrently demoting, role change under active session, forged role/price, cross-account invoice access, replayed guest token, duplicate HMAC-valid webhook, invalid signature, upload SSRF, and direct auth endpoint bypass.
