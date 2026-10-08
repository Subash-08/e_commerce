import type { CollectionIndexes } from "../../server/db/indexes.ts";
export const attributeIndexes: readonly CollectionIndexes[] = [
  {
    collection: "attributes",
    indexes: [
      { name: "attributes_code_unique", key: { code: 1 }, unique: true },
      {
        name: "attributes_active_order",
        key: { active: 1, displayOrder: 1, _id: 1 },
      },
    ],
  },
];
