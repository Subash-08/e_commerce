# Orders

Pure order lifecycle and lateCapture guards are implemented in state.ts. They return audited next-state proposals and effect descriptions; they do not create durable orders, execute jobs or mutate stock. Trusted services must establish authorization and fresh verified facts and commit all effects atomically.

Contracts: [canonical states](../../../docs/commerce/STATE-MACHINES.md), [ADR 0008](../../../docs/adr/0008-pure-domain-foundation.md). Creation/snapshot persistence and operator/customer UI remain later work.
