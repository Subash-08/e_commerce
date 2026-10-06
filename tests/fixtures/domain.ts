import type {
  PricingInput,
  PriceLine,
  TaxFacts,
  CouponFacts,
} from "../../src/modules/pricing/price";
import type {
  OrderFacts,
  OrderLifecycle,
} from "../../src/modules/orders/state";
import type { TransitionContext } from "../../src/shared/domain/transition";
import type {
  TrackedStock,
  ReservationRequest,
} from "../../src/modules/checkout/reservations";
export const exempt: TaxFacts = {
  mode: "EXEMPT",
  rateBps: 0,
  components: [],
  exemptionReason: "Explicit test exemption",
};
export const exclusive: TaxFacts = {
  mode: "EXCLUSIVE",
  rateBps: 1800,
  components: [{ key: "IGST", rateBps: 1800 }],
};
export const inclusive: TaxFacts = { ...exclusive, mode: "INCLUSIVE" };
export const line = (overrides: Partial<PriceLine> = {}): PriceLine => ({
  key: "a",
  productActive: true,
  variantActive: true,
  available: true,
  revision: "1",
  expectedRevision: "1",
  quantity: 1,
  mrpPaise: 10000,
  unitPricePaise: 10000,
  tax: exempt,
  ...overrides,
});
export const quote = (overrides: Partial<PricingInput> = {}): PricingInput => ({
  currency: "INR",
  country: "IN",
  now: 100,
  policyVersion: "test-policy-1",
  lines: [line()],
  shipping: { chargePaise: 0, tax: exempt },
  ...overrides,
});
export const coupon = (overrides: Partial<CouponFacts> = {}): CouponFacts => ({
  code: "TEST",
  revision: "1",
  kind: "FIXED",
  value: 1000,
  active: true,
  capacityAvailable: true,
  startsAt: 0,
  expiresAt: 200,
  eligibleLineKeys: ["a"],
  minEligiblePaise: 0,
  ...overrides,
});
export const context = (
  overrides: Partial<TransitionContext> = {},
): TransitionContext => ({
  operationId: "op-1",
  expectedRevision: 0,
  actorId: "system-test",
  reason: "verified test command",
  at: 100,
  authorized: true,
  ...overrides,
});
export const order = (
  overrides: Partial<OrderLifecycle> = {},
): OrderLifecycle => ({
  id: "order-1",
  state: "PENDING_PAYMENT",
  paymentMode: "ONLINE",
  expiresAt: 200,
  fulfillmentException: "NONE",
  revision: 0,
  history: [],
  ...overrides,
});
export const facts = (overrides: Partial<OrderFacts> = {}): OrderFacts => ({
  requiredPaise: 10000,
  capturedPaise: 10000,
  refundedPaise: 0,
  pendingRefundPaise: 0,
  verifiedPayment: true,
  codEligible: false,
  cancellationAllowed: true,
  trackingRecorded: true,
  deliveryConfirmed: true,
  allLinesEligible: true,
  stockReacquired: true,
  couponReacquired: true,
  ...overrides,
});
export const stock = (overrides: Partial<TrackedStock> = {}): TrackedStock => ({
  variantId: "variant-1",
  trackQuantity: true,
  onHand: 1,
  reserved: 0,
  reservations: [],
  revision: 0,
  history: [],
  ...overrides,
});
export const reservation = (
  overrides: Partial<ReservationRequest> = {},
): ReservationRequest => ({
  id: "hold-1",
  orderId: "order-1",
  quantity: 1,
  generation: 0,
  expiresAt: 200,
  autoExpire: true,
  ...overrides,
});
