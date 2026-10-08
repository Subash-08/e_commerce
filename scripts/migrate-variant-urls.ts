import "./load-environment.mjs";
import { getDatabase, closeDatabase } from "../src/server/db/connection.ts";
import { transaction } from "../src/server/db/transaction.ts";
import { assignVariantKeys } from "../src/modules/catalog/urls.ts";
import { applyIndexes } from "../src/server/db/indexes.ts";
import { catalogIndexes } from "../src/modules/catalog/indexes.ts";
import type { ObjectId } from "mongodb";

type Row = {
  _id: ObjectId;
  productId: ObjectId;
  urlKey?: string;
  title: string;
  sku: string;
  options: { attributeId: string; optionId: string }[];
};
const flags = process.argv.slice(2);
const approved = flags.length === 1 && flags[0] === "--approve";
try {
  if (!approved && !(flags.length === 1 && flags[0] === "--dry-run"))
    throw new Error("USE_DRY_RUN_OR_APPROVE");
  const database = await getDatabase();
  const groups = await database.db
    .collection<Row>("variants")
    .distinct("productId");
  let changed = 0;
  for (const productId of groups) {
    await transaction(async (session) => {
      const rows = await database.db
        .collection<Row>("variants")
        .find({ productId }, { session })
        .sort({ _id: 1 })
        .toArray();
      const definitions = await database.db
        .collection<{
          _id: ObjectId;
          options: { id: string; label: string }[];
        }>("attributes")
        .find({}, { session, projection: { options: 1 } })
        .toArray();
      const keys = assignVariantKeys(
        rows.map((v) => ({ ...v, id: v._id.toString() })),
        definitions.map((a) => ({ id: a._id.toString(), options: a.options })),
      );
      const missing = rows.filter((v) => !v.urlKey);
      if (approved && missing.length) {
        // Serialize against editor saves without overwriting product content.
        const product = await database.db
          .collection("products")
          .findOne(
            { _id: productId },
            { session, projection: { revision: 1 } },
          );
        if (!product) throw new Error("ORPHAN_VARIANT");
        await database.db
          .collection("products")
          .updateOne(
            { _id: productId, revision: product.revision },
            { $inc: { revision: 1, "listing.sourceRevision": 1 } },
            { session },
          );
        for (const row of missing) {
          await database.db.collection<Row>("variants").updateOne(
            { _id: row._id, productId, urlKey: { $exists: false } },
            {
              $set: { urlKey: keys.get(row._id.toString()) },
              $inc: { revision: 1 },
            },
            { session },
          );
        }
        await database.db.collection("auditLogs").insertOne(
          {
            actorType: "OPERATOR",
            actorId: "operator:variant-url-migration",
            action: "VARIANT_URLS_BACKFILLED",
            entityType: "product",
            entityId: productId.toString(),
            after: { count: missing.length },
            occurredAt: new Date(),
            schemaVersion: 1,
          },
          { session },
        );
        await database.db.collection("jobs").insertOne(
          {
            kind: "INVALIDATE_PUBLIC_CACHE",
            businessKey: "variant-urls:" + productId,
            payload: { tags: ["catalog", "sitemap"], paths: [] },
            state: "PENDING",
            dueAt: new Date(),
            attempts: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            schemaVersion: 1,
            revision: 0,
          },
          { session },
        );
      }
      // Transaction retry must not accumulate reported counts.
      return missing.length;
    }, database).then((count) => {
      changed += count;
    });
  }
  const index = catalogIndexes
    .find((c) => c.collection === "variants")!
    .indexes.filter((i) => i.name === "variants_product_url_key_unique");
  const indexes = await applyIndexes(
    database.db,
    [{ collection: "variants", indexes: index }],
    { dryRun: !approved },
  );
  console.info(
    JSON.stringify({
      status: approved ? "applied" : "ready",
      products: groups.length,
      variants: changed,
      indexes,
    }),
  );
} catch {
  console.error("VARIANT_URL_MIGRATION_FAILED");
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
