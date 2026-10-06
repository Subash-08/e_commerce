# Checkout

reservations.ts contains pure tracked-stock reserve/consume/release proposals. Status-only inventory produces no reservation. Complete one-variant snapshots support unit conservation checks; actual collections stay separate and bounded production queries must be designed in the database slice.

Contracts: [order lifecycle](../../../docs/commerce/ORDER-LIFECYCLE.md), [ADR 0008](../../../docs/adr/0008-pure-domain-foundation.md). No checkout service, database transaction, provider call or durable expiry runner is implemented.
