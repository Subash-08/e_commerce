# ADR 0001: Owned single-tenant modular monolith

Status: APPROVED, 2026-10-06.

Context: reuse/ownership and Next.js/MongoDB are explicit priorities. Hosted/adopted commerce may launch faster but changes backend/data/deployment assumptions.

Decision: custom Next.js App Router with services/repositories/pure rules, one application deployment and managed database per client. No Express, microservices, Redis/Kafka/Kubernetes baseline. Separate store/admin roots; routes compose, do not own commerce rules.

Alternatives: Medusa/PostgreSQL supplies commerce infrastructure but changes the stack; CMS commerce templates accelerate admin/content but still require policy/payment validation. Both remain future reconsiderations only under a new explicit decision.

Consequences: we own security, financial tests and maintenance. Hundreds of products do not justify distributed architecture. Boundary design permits future extraction, not premature service scaffolding.

Change cost: platform/data replacement after transactions is high. Migrations must preserve financial IDs/snapshots. Client code cannot replace core financial invariants.
