# Payments

Pure attempt transitions, financial aggregation and pending/successful refund-capacity guards are implemented in state.ts. Attempt identities are provider scoped. No credentials, provider SDK, signature verification, webhook route or persistent ledger is implemented.

Contracts: [payment lifecycle](../../../docs/commerce/PAYMENT-LIFECYCLE.md), [ADR 0008](../../../docs/adr/0008-pure-domain-foundation.md). Verified facts must come from the future trusted provider boundary, never browser flags.
