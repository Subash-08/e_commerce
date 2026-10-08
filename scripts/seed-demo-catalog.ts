import "./load-environment.mjs";
import { ObjectId, type Collection, type Document } from "mongodb";
import { closeDatabase, getDatabase } from "../src/server/db/connection.ts";
import { transaction } from "../src/server/db/transaction.ts";
import {
  combinationKey,
  normalizeSku,
} from "../src/modules/catalog/validation.ts";
import { priceBreakdown } from "../src/modules/catalog/pricing.ts";
import {
  DEMO_SEED_ACTOR,
  DEMO_SEED_MARKER,
  demoAttributes,
  demoBrands,
  demoCategories,
  demoProducts,
} from "./fixtures/demo-catalog.ts";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const approved = args.has("--approve");

async function assertIdentity(
  collection: Collection<Document>,
  id: ObjectId,
  identity: Document,
) {
  const [byId, byIdentity] = await Promise.all([
    collection.findOne({ _id: id }, { projection: { demoSeed: 1 } }),
    collection.findOne(identity, { projection: { _id: 1 } }),
  ]);
  if (byId && byId.demoSeed !== DEMO_SEED_MARKER)
    throw new Error("SEED_ID_CONFLICT");
  if (byIdentity && !byIdentity._id.equals(id))
    throw new Error("SEED_IDENTITY_CONFLICT");
}

async function inspect() {
  const { db } = await getDatabase();
  for (const brand of demoBrands)
    await assertIdentity(db.collection("brands"), new ObjectId(brand.id), {
      slug: brand.slug,
    });
  for (const category of demoCategories)
    await assertIdentity(
      db.collection("categories"),
      new ObjectId(category.id),
      { slug: category.slug },
    );
  for (const attribute of demoAttributes)
    await assertIdentity(
      db.collection("attributes"),
      new ObjectId(attribute.id),
      { code: attribute.code },
    );
  for (const product of demoProducts) {
    await assertIdentity(db.collection("products"), new ObjectId(product.id), {
      slug: product.input.slug,
    });
    for (const variant of product.input.variants)
      await assertIdentity(
        db.collection("variants"),
        new ObjectId(variant.id),
        { normalizedSku: normalizeSku(variant.sku) },
      );
  }
}

const seo = (name: string, description: string) => ({
  title: name,
  description,
  canonicalPath: "",
  robotsIndex: false,
  robotsFollow: true,
});

async function seed() {
  const handle = await getDatabase();
  await transaction(async (session) => {
    const now = new Date();
    for (const brand of demoBrands) {
      const { id, ...fields } = brand;
      await handle.db.collection("brands").updateOne(
        { _id: new ObjectId(id), demoSeed: DEMO_SEED_MARKER },
        {
          $set: {
            ...fields,
            nameNormalized: fields.name.normalize("NFKC").toLowerCase(),
            active: true,
            archivedAt: null,
            deactivationReason: "",
            logoId: null,
            seo: seo(fields.name, fields.description),
            updatedBy: DEMO_SEED_ACTOR,
            updatedAt: now,
            schemaVersion: 1,
          },
          $setOnInsert: {
            createdBy: DEMO_SEED_ACTOR,
            createdAt: now,
            revision: 0,
            demoSeed: DEMO_SEED_MARKER,
          },
        },
        { upsert: true, session },
      );
    }
    for (const category of demoCategories) {
      const { id, parentId, ...fields } = category;
      await handle.db.collection("categories").updateOne(
        { _id: new ObjectId(id), demoSeed: DEMO_SEED_MARKER },
        {
          $set: {
            ...fields,
            parentId: parentId ? new ObjectId(parentId) : null,
            nameNormalized: fields.name.normalize("NFKC").toLowerCase(),
            active: true,
            archivedAt: null,
            deactivationReason: "",
            thumbnailId: null,
            bannerId: null,
            seo: seo(fields.name, fields.description),
            updatedBy: DEMO_SEED_ACTOR,
            updatedAt: now,
            schemaVersion: 1,
          },
          $setOnInsert: {
            createdBy: DEMO_SEED_ACTOR,
            createdAt: now,
            revision: 0,
            demoSeed: DEMO_SEED_MARKER,
          },
        },
        { upsert: true, session },
      );
    }
    for (const attribute of demoAttributes) {
      const { id, ...fields } = attribute;
      await handle.db.collection("attributes").updateOne(
        { _id: new ObjectId(id), demoSeed: DEMO_SEED_MARKER },
        {
          $set: {
            ...fields,
            active: true,
            updatedBy: DEMO_SEED_ACTOR,
            updatedAt: now,
            schemaVersion: 1,
          },
          $setOnInsert: {
            createdBy: DEMO_SEED_ACTOR,
            createdAt: now,
            revision: 0,
            demoSeed: DEMO_SEED_MARKER,
          },
        },
        { upsert: true, session },
      );
    }
    for (const fixture of demoProducts) {
      const productId = new ObjectId(fixture.id);
      const {
        variants,
        brandId,
        categoryIds,
        primaryCategoryId,
        linkedProductIds,
        defaultVariantId,
        ...fields
      } = fixture.input;
      const prices = variants.map(
        (variant) =>
          priceBreakdown(
            variant.salePaise,
            variant.priceMode,
            variant.gstRateBps,
          ).payablePaise,
      );
      await handle.db.collection("products").updateOne(
        { _id: productId, demoSeed: DEMO_SEED_MARKER },
        {
          $set: {
            ...fields,
            brandId: new ObjectId(brandId),
            categoryIds: categoryIds.map((id) => new ObjectId(id)),
            primaryCategoryId: new ObjectId(primaryCategoryId),
            linkedProductIds: linkedProductIds.map((id) => new ObjectId(id)),
            defaultVariantId: new ObjectId(defaultVariantId),
            nameNormalized: fields.name.normalize("NFKC").toLowerCase(),
            listing: {
              minPricePaise: Math.min(...prices),
              maxPricePaise: Math.max(...prices),
              activeVariantCount: variants.length,
              inStock: variants.some((variant) =>
                variant.trackQuantity
                  ? (variant.onHand ?? 0) > 0
                  : variant.stockStatus === "IN_STOCK",
              ),
              sourceRevision: 0,
            },
            updatedBy: DEMO_SEED_ACTOR,
            updatedAt: now,
            schemaVersion: 1,
          },
          $setOnInsert: {
            createdBy: DEMO_SEED_ACTOR,
            createdAt: now,
            revision: 0,
            demoSeed: DEMO_SEED_MARKER,
          },
        },
        { upsert: true, session },
      );
      for (const variant of variants) {
        const { id, barcode, onHand, ...variantFields } = variant;
        const taxPolicyKey = `gst-v1-${variant.priceMode.toLowerCase()}-${variant.gstRateBps}`;
        await handle.db.collection("taxPolicies").updateOne(
          {
            key: taxPolicyKey,
            mode: variant.priceMode,
            rateBps: variant.gstRateBps,
            version: 1,
          },
          {
            $setOnInsert: {
              key: taxPolicyKey,
              mode: variant.priceMode,
              rateBps: variant.gstRateBps,
              version: 1,
              schemaVersion: 1,
            },
          },
          { upsert: true, session },
        );
        await handle.db.collection("variants").updateOne(
          { _id: new ObjectId(id), demoSeed: DEMO_SEED_MARKER },
          {
            $set: {
              ...variantFields,
              productId,
              normalizedSku: normalizeSku(variant.sku),
              combinationKey: combinationKey(variant.options),
              ...(barcode ? { barcode } : {}),
              ...(variant.trackQuantity
                ? { onHand: onHand ?? 0, reserved: 0 }
                : {}),
              taxPolicyKey,
              updatedAt: now,
              schemaVersion: 1,
            },
            $unset: {
              ...(barcode ? {} : { barcode: "" }),
              ...(variant.trackQuantity ? {} : { onHand: "", reserved: "" }),
            },
            $setOnInsert: {
              createdAt: now,
              revision: 0,
              demoSeed: DEMO_SEED_MARKER,
            },
          },
          { upsert: true, session },
        );
      }
    }
    await handle.db.collection("auditLogs").updateOne(
      {
        _id: new ObjectId("676000000000000000000001"),
        demoSeed: DEMO_SEED_MARKER,
      },
      {
        $set: {
          actorType: "OPERATOR",
          actorId: DEMO_SEED_ACTOR,
          action: "DEMO_CATALOG_SEEDED",
          entityType: "catalog",
          entityId: DEMO_SEED_MARKER,
          after: {
            brands: demoBrands.length,
            categories: demoCategories.length,
            attributes: demoAttributes.length,
            products: demoProducts.length,
          },
          occurredAt: now,
          updatedAt: now,
          schemaVersion: 1,
        },
        $setOnInsert: { createdAt: now, demoSeed: DEMO_SEED_MARKER },
      },
      { upsert: true, session },
    );
  }, handle);
}

try {
  if (
    [...args].some((arg) => !["--dry-run", "--approve"].includes(arg)) ||
    dryRun === approved
  )
    throw new Error("USE_DRY_RUN_OR_APPROVE");
  if (
    process.env.APP_ENV === "production" ||
    process.env.NODE_ENV === "production"
  )
    throw new Error("PRODUCTION_SEED_REFUSED");
  await inspect();
  if (!dryRun) await seed();
  console.info(
    JSON.stringify({
      status: dryRun ? "ready" : "seeded",
      marker: DEMO_SEED_MARKER,
      brands: demoBrands.length,
      categories: demoCategories.length,
      attributes: demoAttributes.length,
      products: demoProducts.length,
      variants: demoProducts.reduce(
        (count, product) => count + product.input.variants.length,
        0,
      ),
    }),
  );
} catch (error) {
  const safe =
    error instanceof Error &&
    [
      "USE_DRY_RUN_OR_APPROVE",
      "PRODUCTION_SEED_REFUSED",
      "SEED_ID_CONFLICT",
      "SEED_IDENTITY_CONFLICT",
    ].includes(error.message)
      ? error.message
      : "DEMO_SEED_FAILED";
  console.error(safe);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
