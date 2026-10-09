import type { CollectionIndexes } from "../../server/db/indexes.ts";
export const couponIndexes: readonly CollectionIndexes[] = [
  {
    collection: "couponClaims",
    indexes: [
      {
        name: "coupon_claims_capacity",
        key: { couponId: 1, state: 1, authUserId: 1 },
      },
      {
        name: "coupon_claim_order_generation_unique",
        key: { orderId: 1, couponId: 1, generation: 1 },
        unique: true,
      },
    ],
  },
  {
    collection: "coupons",
    indexes: [
      { name: "coupons_code_unique", key: { code: 1 }, unique: true },
      {
        name: "coupons_admin_updated",
        key: { archived: 1, updatedAt: -1, _id: -1 },
      },
    ],
  },
];
