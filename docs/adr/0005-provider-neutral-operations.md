# ADR 0005: Provider-neutral hosting and scheduler

Status: APPROVED AMENDMENT, 2026-10-06. Supersedes Stage 1 paid-Vercel baseline.

Decision: support Node on Hostinger VPS or equivalent as preferred cost-focused option, and paid Vercel as managed convenience. Both use managed Atlas and Cloudinary; no self-hosted production MongoDB. Avoid provider-specific business logic or local-disk financial state.

Scheduler must execute every 1–5 minutes, with bounded job budget, leases and missed-tick alerts. Verify actual provider cadence/duration/connection limits before purchase. External authenticated scheduler to the protected runner is the fallback. Default online reservation remains a configurable 15 minutes; timestamp guards plus late-capture handling make scheduling delay safe.

Alternatives: Vercel-only reduces portability; unmanaged DB increases recovery responsibility; running all stores in one app violates approved single tenancy.

Consequences: VPS needs patching/supervision/TLS/cache management; Vercel needs runtime/cost/pool-limit validation. Multi-replica cache coordination is a later deployment gate, not a Redis prerequisite.

Node 24 only if supported by host and dependency matrix; supported Node 22 LTS fallback. No version from historical research is a pin. Budget/RPO/RTO/region and purchase remain unresolved, with no production accounts authorized.
