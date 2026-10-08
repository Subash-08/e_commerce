import type { CollectionIndexes } from "../../server/db/indexes.ts";
export const catalogIndexes: readonly CollectionIndexes[] = [
  {
    collection: "taxPolicies",
    indexes: [{ name: "tax_policy_key_unique", key: { key: 1 }, unique: true }],
  },
  {
    collection: "products",
    indexes: [
      { name: "products_slug_unique", key: { slug: 1 }, unique: true },
      { name: "products_updated", key: { updatedAt: -1, _id: -1 } },
      { name: "products_name", key: { nameNormalized: 1, _id: 1 } },
      {
        name: "products_status_updated",
        key: { status: 1, updatedAt: -1, _id: -1 },
      },
      {
        name: "products_status_name",
        key: { status: 1, nameNormalized: 1, _id: 1 },
      },
      {
        name: "products_category_status",
        key: { categoryIds: 1, status: 1, _id: 1 },
      },
      {
        name: "products_primary_status",
        key: { primaryCategoryId: 1, status: 1, _id: 1 },
      },
      { name: "products_brand_status", key: { brandId: 1, status: 1, _id: 1 } },
      { name: "products_attribute", key: { "attributes.attributeId": 1 } },
    ],
  },
  {
    collection: "variants",
    indexes: [
      { name: "variants_sku_unique", key: { normalizedSku: 1 }, unique: true },
      {
        name: "variants_combination_unique",
        key: { productId: 1, combinationKey: 1 },
        unique: true,
      },
      {
        name: "variants_barcode_unique",
        key: { barcode: 1 },
        unique: true,
        partialFilterExpression: { barcode: { $type: "string" } },
      },
      {
        name: "variants_product_active",
        key: { productId: 1, archived: 1, active: 1, _id: 1 },
      },
      { name: "variants_attributes", key: { "options.attributeId": 1 } },
    ],
  },
];
