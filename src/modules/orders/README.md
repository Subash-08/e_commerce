# Orders module

Phase 2A implements the COD acceptance boundary. Routes call the service; the service owns quote/stock/coupon/order rules; MongoDB operations are explicit and participate in one Atlas transaction. Orders keep immutable accepted snapshots and separate order, financial and fulfillment-exception state.

Implemented:

- buyer-scoped idempotent COD acceptance;
- tracked-stock reservations and status-only availability checks;
- effective coupon capacity consumption;
- consecutive yearly order numbering;
- account and signed guest ownership;
- account/Admin lists and private detail;
- pre-shipment cancellation with atomic stock/coupon recovery;
- notification outbox creation.

Online payments, provider observations, shipment consumption, invoices and late-capture recovery remain later gates. See ADR 0014 and the canonical state registry.
