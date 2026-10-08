import type { CollectionIndexes } from "../../server/db/indexes.ts";
export const cartIndexes: readonly CollectionIndexes[] = [
  {
    collection: "carts",
    indexes: [
      { name: "carts_owner_unique", key: { authUserId: 1 }, unique: true },
    ],
  },
  {
    collection: "cartReceipts",
    indexes: [
      {
        name: "cart_receipts_expiry",
        key: { expiresAt: 1 },
        expireAfterSeconds: 0,
      },
    ],
  },
  {
    collection: "commerceRateLimits",
    indexes: [
      {
        name: "commerce_rate_expiry",
        key: { expiresAt: 1 },
        expireAfterSeconds: 0,
      },
    ],
  },
];
