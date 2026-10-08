import "server-only";
import { ObjectId, MongoServerError, type ClientSession } from "mongodb";
import type { DatabaseHandle } from "../../server/db/connection";
import type { ProductInput, VariantInput } from "./validation";
export type VariantRecord = Omit<VariantInput, "id" | "barcode" | "onHand"> & {
  _id: ObjectId;
  productId: ObjectId;
  urlKey?: string;
  normalizedSku: string;
  combinationKey: string;
  barcode?: string;
  onHand?: number;
  reserved?: number;
  revision: number;
  taxPolicyKey: string;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
};
export type ProductRecord = Omit<
  ProductInput,
  | "id"
  | "revision"
  | "variants"
  | "brandId"
  | "categoryIds"
  | "primaryCategoryId"
  | "linkedProductIds"
  | "defaultVariantId"
> & {
  _id: ObjectId;
  brandId: ObjectId;
  categoryIds: ObjectId[];
  primaryCategoryId: ObjectId;
  linkedProductIds: ObjectId[];
  defaultVariantId: ObjectId;
  revision: number;
  nameNormalized: string;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  publishedAt?: Date;
  listing: {
    minPricePaise: number | null;
    maxPricePaise: number | null;
    activeVariantCount: number;
    inStock: boolean;
    sourceRevision: number;
  };
};
export function catalogRepository(db: DatabaseHandle) {
  return {
    products: db.db.collection<ProductRecord>("products"),
    variants: db.db.collection<VariantRecord>("variants"),
    async replaceVariants(records: VariantRecord[], session: ClientSession) {
      // Driver 7.7 collection.bulkWrite resolves inherited timeoutMS twice inside withTransaction.
      // A single ordered update command preserves the transaction timeout and explicit session.
      const transactionDb = db.client.db(db.db.databaseName, {
        timeoutMS: undefined,
      });
      const policies = [
        ...new Map(
          records.map((v) => [
            v.taxPolicyKey,
            {
              key: v.taxPolicyKey,
              mode: v.priceMode,
              rateBps: v.gstRateBps,
              version: 1,
              schemaVersion: 1,
            },
          ]),
        ).values(),
      ];
      const policyResult = await transactionDb.command(
        {
          update: "taxPolicies",
          ordered: true,
          updates: policies.map((policy) => ({
            q: {
              key: policy.key,
              mode: policy.mode,
              rateBps: policy.rateBps,
              version: 1,
            },
            u: { $setOnInsert: policy },
            upsert: true,
            multi: false,
          })),
        },
        { session },
      );
      if (policyResult.writeErrors?.length)
        throw new MongoServerError(policyResult.writeErrors[0]);
      if (policyResult.writeConcernError)
        throw new MongoServerError(policyResult.writeConcernError);
      const result = await transactionDb.command(
        {
          update: "variants",
          ordered: true,
          updates: records.map((v) => ({
            q: { _id: v._id, productId: v.productId },
            u: v,
            upsert: true,
            multi: false,
          })),
        },
        { session },
      );
      if (result.writeErrors?.length)
        throw new MongoServerError(result.writeErrors[0]);
      if (result.writeConcernError)
        throw new MongoServerError(result.writeConcernError);
    },
  };
}
