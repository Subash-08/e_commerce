import type { CollectionIndexes } from "../../server/db/indexes.ts";
export const categoryIndexes: readonly CollectionIndexes[] = [
  {
    collection: "categories",
    indexes: [
      { name: "categories_slug_unique", key: { slug: 1 }, unique: true },
      {
        name: "categories_navigation",
        key: { parentId: 1, archivedAt: 1, active: 1, displayOrder: 1, _id: 1 },
      },
      { name: "categories_name", key: { nameNormalized: 1, _id: 1 } },
      {
        name: "categories_admin_name",
        key: { archivedAt: 1, nameNormalized: 1, _id: 1 },
      },
      {
        name: "categories_admin_updated",
        key: { archivedAt: 1, updatedAt: -1, _id: -1 },
      },
      {
        name: "categories_admin_order",
        key: { archivedAt: 1, displayOrder: 1, _id: 1 },
      },
    ],
  },
  {
    collection: "taxonomyGuards",
    indexes: [{ name: "taxonomy_guard_key", key: { key: 1 }, unique: true }],
  },
  {
    collection: "redirects",
    indexes: [
      { name: "redirects_path_unique", key: { fromPath: 1 }, unique: true },
      { name: "redirects_entity", key: { entityId: 1 } },
    ],
  },
  {
    collection: "mediaAssets",
    indexes: [
      { name: "media_public_id_unique", key: { publicId: 1 }, unique: true },
    ],
  },
];
