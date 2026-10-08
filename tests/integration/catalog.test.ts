import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import {
  cleanupAll,
  createTestDatabaseContext,
  stopSharedTestReplicaSet,
  type TestDatabaseContext,
} from "../fixtures/db-harness";
import { catalogFixture } from "../fixtures/catalog";
import type { DatabaseHandle } from "../../src/server/db/connection";
import { catalogService } from "../../src/modules/catalog/service";
import { readPublicProduct } from "../../src/modules/catalog/public";
import { selectVariant } from "../../src/modules/catalog/selection";
import { catalogIndexes } from "../../src/modules/catalog/indexes";
import { categoryIndexes } from "../../src/modules/categories/indexes";
import { applyIndexes } from "../../src/server/db/indexes";

describe("catalog transactional boundaries", () => {
  let context: TestDatabaseContext;
  let database: DatabaseHandle;
  let service: ReturnType<typeof catalogService>;
  const brand = new ObjectId(),
    category = new ObjectId(),
    media = new ObjectId();
  const input = (suffix: string) =>
    catalogFixture(
      brand.toString(),
      category.toString(),
      media.toString(),
      suffix,
    );
  beforeAll(async () => {
    context = await createTestDatabaseContext("catalog");
    for (const name of new Set(
      [...catalogIndexes, ...categoryIndexes]
        .map((i) => i.collection)
        .concat(["profiles", "brands", "attributes", "auditLogs", "jobs"]),
    ))
      await context.createCollection(name);
    database = await context.createOwner().get();
    await applyIndexes(database.db, [...catalogIndexes, ...categoryIndexes], {
      dryRun: false,
    });
    await database.db.collection("profiles").insertOne({
      authUserId: "catalog-admin",
      role: "ADMIN",
      status: "ACTIVE",
    });
    await database.db.collection("brands").insertOne({
      _id: brand,
      name: "Fixture",
      slug: "fixture",
      active: true,
      archivedAt: null,
    });
    await database.db.collection("categories").insertOne({
      _id: category,
      name: "Fixture",
      slug: "fixture",
      active: true,
      archivedAt: null,
    });
    await database.db.collection("mediaAssets").insertOne({
      _id: media,
      secureUrl: "https://example.com/fixture.webp",
      resourceType: "image",
    });
    service = catalogService(database, async () => ({
      authUserId: "catalog-admin",
    }));
  });
  afterAll(async () => {
    await cleanupAll([
      () => context?.teardown(),
      () => stopSharedTestReplicaSet(),
    ]);
  });

  it("rolls back duplicate SKU and wrong-product variant writes, including concurrent creation", async () => {
    const first = input("unique-a"),
      second = input("unique-b");
    second.variants[0].sku = first.variants[0].sku;
    const results = await Promise.allSettled([
      service.save(new Headers(), first),
      service.save(new Headers(), second),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await database.db
        .collection("products")
        .countDocuments({ slug: { $in: [first.slug, second.slug] } }),
    ).toBe(1);
    const winner = results[0].status === "fulfilled" ? first : second;
    const wrong = input("wrong-owner");
    wrong.variants[0].id = winner.variants[0].id;
    wrong.defaultVariantId = winner.defaultVariantId;
    await expect(service.save(new Headers(), wrong)).rejects.toMatchObject({
      code: "DB_DUPLICATE_KEY",
    });
    expect(
      await database.db
        .collection("products")
        .countDocuments({ slug: wrong.slug }),
    ).toBe(0);
  });

  it("rejects stale revisions and stock below reservations while keeping public data private", async () => {
    const value = input("revision");
    const created = await service.save(new Headers(), value);
    const edit = { ...value, id: created.id, revision: 0 };
    await service.save(new Headers(), { ...edit, name: "New name" });
    await expect(service.save(new Headers(), edit)).rejects.toMatchObject({
      message: "REVISION_CONFLICT",
    });
    await database.db
      .collection("variants")
      .updateOne(
        { _id: new ObjectId(value.defaultVariantId) },
        { $set: { reserved: 5 } },
      );
    await expect(
      service.save(new Headers(), {
        ...edit,
        revision: 1,
        variants: [{ ...value.variants[0], onHand: 4 }],
      }),
    ).rejects.toMatchObject({ message: "STOCK_BELOW_RESERVED" });
    const publicData = await readPublicProduct(value.slug, false, database);
    expect(publicData?.variants[0].pricePaise).toBe(11800);
    const json = JSON.stringify(publicData);
    for (const privateField of [
      "PRIVATE-NOTE",
      "costPaise",
      "reserved",
      "onHand",
      "authUserId",
    ])
      expect(json).not.toContain(privateField);
    expect(selectVariant(publicData!, new ObjectId().toString())).toMatchObject(
      { unavailable: true, variant: { id: value.defaultVariantId } },
    );
  });

  it("hides draft and archived products and retains archived variant history", async () => {
    const value = input("history");
    value.status = "DRAFT";
    const created = await service.save(new Headers(), value);
    expect(await readPublicProduct(value.slug, false, database)).toBeNull();
    expect(await readPublicProduct(value.slug, true, database)).not.toBeNull();
    await service.save(new Headers(), {
      ...value,
      id: created.id,
      revision: 0,
      status: "ARCHIVED",
    });
    expect(await readPublicProduct(value.slug, false, database)).toBeNull();
    expect(
      await database.db
        .collection("variants")
        .countDocuments({ productId: new ObjectId(created.id) }),
    ).toBe(1);
  });
});
