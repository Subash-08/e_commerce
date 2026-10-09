import type { CollectionIndexes } from "../../server/db/indexes";

export const orderIndexes: readonly CollectionIndexes[] = [
  {
    collection: "orders",
    indexes: [
      { name: "orders_number_unique", key: { orderNumber: 1 }, unique: true },
      { name: "orders_account_created", key: { authUserId: 1, createdAt: -1 } },
      {
        name: "orders_cod_overdue",
        key: { paymentMethod: 1, state: 1, codReviewAt: 1 },
      },
    ],
  },
  {
    collection: "checkoutAttempts",
    indexes: [
      {
        name: "checkout_attempt_owner_key_unique",
        key: { ownerKeyHash: 1, idempotencyKey: 1 },
        unique: true,
      },
      { name: "checkout_attempt_order", key: { orderId: 1 } },
    ],
  },
  {
    collection: "reservations",
    indexes: [
      {
        name: "reservation_order_variant_generation_unique",
        key: { orderId: 1, variantId: 1, generation: 1 },
        unique: true,
      },
      { name: "reservation_variant_state", key: { variantId: 1, state: 1 } },
    ],
  },
  {
    collection: "couponAccountUsage",
    indexes: [
      {
        name: "coupon_account_usage_unique",
        key: { couponId: 1, authUserId: 1 },
        unique: true,
      },
    ],
  },
];
