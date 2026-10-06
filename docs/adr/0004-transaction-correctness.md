# ADR 0004: Minimal durable transaction correctness

Status: APPROVED WITH SIMPLIFICATION, 2026-10-06.

Decision: one pure integer-paise pricing engine, immutable accepted order/issued invoice snapshots, guarded separate lifecycle states, unique financial identities and reconciliation. Reserve only quantity-tracked variant lines during order creation; status-only lines never enter a reservation workflow. Atomically reserve/claim and persist order facts in transaction-capable MongoDB.

A small closed jobs collection doubles as outbox for verified webhooks, financial recovery, expiry, large imports and critical retries. No Redis or generic workflow framework. External calls happen outside retryable transactions. n8n cannot own correctness.

Use an auditable consecutive invoice issue ledger with transactional counter/issue uniqueness and linked corrections; no gap-concealing renumbering. Minimal refund records and concurrent refund balance guards are required, not advanced returns.

Alternatives: decrement only at capture risks last-unit oversell; in-process timers lose work; full inventory/job frameworks exceed scope.

Consequences: replica set remains required even when a client disables quantity tracking because multi-record financial/idempotency operations still use transactions. Late capture after expiry is explicitly tested for recovery and refund-required outcomes. At-least-once delivery is acknowledged; business effects are idempotent.

Change cost: high; any invariant alteration requires a base-template ADR and migration/reconciliation plan.
