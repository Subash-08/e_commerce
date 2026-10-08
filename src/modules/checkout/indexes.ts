import type { CollectionIndexes } from "../../server/db/indexes";
export const checkoutIndexes: readonly CollectionIndexes[] = [
  {
    collection: "checkoutQuotes",
    indexes: [
      { name: "checkout_quote_id_unique", key: { quoteId: 1 }, unique: true },
      {
        name: "checkout_quote_owner_expiry",
        key: { ownerKeyHash: 1, expiresAt: -1 },
      },
      {
        name: "checkout_quote_ttl",
        key: { expiresAt: 1 },
        expireAfterSeconds: 0,
      },
    ],
  },
];
