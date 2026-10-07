import "server-only";
import { categoryIndexes } from "../../modules/categories/indexes.ts";
import type { CollectionIndexes } from "./indexes.ts";
import { identityIndexes } from "../../modules/identity/indexes.ts";
export const approvedIndexes: readonly CollectionIndexes[] = [
  ...identityIndexes,
  ...categoryIndexes,
];
