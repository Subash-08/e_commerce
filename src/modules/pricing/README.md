# Pricing

Pure integer-paise helpers and priceQuote live here. Inputs contain explicit validated catalog, coupon, shipping and tax facts; no I/O, session or ambient clock. Outputs preserve inputs, versions, line allocations and totals. One engine serves future cart/checkout/order/invoice consumers.

Contracts: [pricing rules](../../../docs/commerce/PRICING-RULES.md), [implementation ADR](../../../docs/adr/0008-pure-domain-foundation.md). Tests are in tests/unit/pricing.test.ts. Persistence, quote acceptance and original-snapshot partial refund allocation remain later work.
