import type { CollectionIndexes } from "../../server/db/indexes.ts";
export const couponIndexes: readonly CollectionIndexes[] = [
  {
    collection: "couponClaims",
    indexes: [
      {
        name: "coupon_claims_capacity",
        key: { couponId: 1, state: 1, authUserId: 1 },
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
