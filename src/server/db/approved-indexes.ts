import "server-only";
import type { CollectionIndexes } from "./indexes.ts";
import { identityIndexes } from "../../modules/identity/indexes.ts";
export const approvedIndexes: readonly CollectionIndexes[] = [
  ...identityIndexes,
];
