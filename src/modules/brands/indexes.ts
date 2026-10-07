import type { CollectionIndexes } from "../../server/db/indexes.ts";

export const brandIndexes: readonly CollectionIndexes[] = [
  {
    collection: "brands",
    indexes: [
      { name: "brands_slug_unique", key: { slug: 1 }, unique: true },
      { name: "brands_name", key: { nameNormalized: 1, _id: 1 } },
      {
        name: "brands_admin_order",
        key: { archivedAt: 1, displayOrder: 1, _id: 1 },
      },
      {
        name: "brands_admin_name",
        key: { archivedAt: 1, nameNormalized: 1, _id: 1 },
      },
      {
        name: "brands_admin_updated",
        key: { archivedAt: 1, updatedAt: -1, _id: -1 },
      },
    ],
  },
];
