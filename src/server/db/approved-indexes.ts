import { shippingIndexes } from "../../modules/shipping/indexes.ts";
import { checkoutIndexes } from "../../modules/checkout/indexes.ts";
import { cartIndexes } from "../../modules/cart/indexes.ts";
import { couponIndexes } from "../../modules/coupons/indexes.ts";
import { attributeIndexes } from "../../modules/attributes/indexes.ts";
import { catalogIndexes } from "../../modules/catalog/indexes.ts";
import "server-only";
import { categoryIndexes } from "../../modules/categories/indexes.ts";
import { brandIndexes } from "../../modules/brands/indexes.ts";
import type { CollectionIndexes } from "./indexes.ts";
import { identityIndexes } from "../../modules/identity/indexes.ts";
export const approvedIndexes: readonly CollectionIndexes[] = [
  ...identityIndexes,
  ...categoryIndexes,
  ...brandIndexes,
  ...attributeIndexes,
  ...catalogIndexes,
  ...cartIndexes,
  ...couponIndexes,
  ...shippingIndexes,
  ...checkoutIndexes,
];
