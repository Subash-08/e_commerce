# Environments, hosting and recovery

Application architecture is provider-neutral. No hosting budget, account purchase or production access is approved.

| Concern | Cost-focused preferred: Hostinger VPS or equivalent | Managed convenience: paid Vercel |
| --- | --- | --- |
| App | Supported Node process behind Nginx/TLS; Docker optional, supervised restart | Supported Node runtime/build output; check region and limits |
| DB/media | Managed Atlas per-client DB, Cloudinary isolated namespace/account | Same |
| Scheduled jobs | systemd timer/cron invoking protected runner or equivalent supervised bounded worker | Native supported cadence or external authenticated scheduler |
| State | Do not depend on local disk for financial truth; persistent cache managed | Ephemeral process/disk; durable state external |
| Operations | OS updates, process supervision, TLS, disk/log rotation, backup alerts | Function/runtime/connection/cost limits and monitoring |
| Scaling | One replica/client initially; verify cache coordination before multi-replica | Bound per-instance DB pool and total instance connections |

Hard pre-purchase checklist: confirm 1–5 minute scheduler cadence, scheduler jitter/retries, function/job duration and overlap, max batch budget, database region/connection cap, disk/storage privacy, Node support, backup/restore capability and total costs. Default proposed tick=1 minute, maximum=5. Fifteen-minute reservation is not a promise of exact-to-second release; freshness checks use server deadlines and worker lag is monitored.

External fallback: trusted scheduler POSTs /api/jobs/run with bearer secret; no secrets in URLs. Bounded runner claims leased jobs, returns counts/correlation only; overlapping requests safe. Alert if no successful tick for 10 minutes. Host-native GET-only cron uses an explicitly documented authenticated no-store adapter, not a public work endpoint.

Dev/staging/prod: separate databases/credentials/media prefixes/provider mode/notification recipients. Per client isolate secrets and payment credentials. Staging access-controlled/noindex with payment test mode and email allowlist. No production MongoDB self-hosting without new approval.

Backups: choose Atlas plan with verified snapshot/PITR capabilities, encrypted private artifact backup and restore procedure. Client approves budget, retention, RPO/RTO; proposed RPO <=1 hour and RTO <=4 hours are not accepted service guarantees. Store recovery metadata outside app host. Test restore before launch and periodically (proposed quarterly), including indexes, invoice artifacts, secret reconfiguration and payment reconciliation since restore point.

After restore, pause fulfillment/money actions, reconcile provider captures/refunds and pending work, then reopen. Blindly replaying all restored outbox jobs can duplicate external messages/actions; idempotency and recorded provider IDs remain required. Backups do not replace immutable records or migration scripts.

Monitoring: uptime, checkout errors, paid-unfulfilled/refund-required orders, pending event age, scheduler heartbeat, pool exhaustion, storage usage and backup success. Redact PII. Runbook owners and notification destinations are client configuration before launch.

Official version-sensitive references: [Next self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing). Recheck exact selected plan; no current price assumptions.
