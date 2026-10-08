import type { CollectionIndexes } from "../../server/db/indexes.ts";
export const shippingIndexes: readonly CollectionIndexes[] = [
  {
    collection: "settings",
    indexes: [{ name: "settings_key_unique", key: { key: 1 }, unique: true }],
  },
];
