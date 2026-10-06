import { beforeAll, afterAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import {
  createTestDatabaseContext,
  cleanupAll,
  stopSharedTestReplicaSet,
  type TestDatabaseContext,
} from "../fixtures/db-harness";
import {
  checkIndexes,
  type CollectionIndexes,
} from "../../src/server/db/indexes";

describe("4B review regressions", () => {
  let context: TestDatabaseContext;
  beforeAll(async () => {
    context = await createTestDatabaseContext("review");
  });
  afterAll(async () => {
    await cleanupAll([
      () => context?.teardown(),
      () => stopSharedTestReplicaSet(),
    ]);
  });

  it.each(["different_test", ""])(
    "selects the configured database independently of URI path %s",
    async (uriDatabase) => {
      const uri = new URL(context.config.uri);
      uri.pathname = uriDatabase ? "/" + uriDatabase : "/";
      const collection = uriDatabase ? "mongoose_different" : "mongoose_absent";
      const native = await context.createCollection(collection);
      const owner = context.createOwner({ uri: uri.toString() });
      const handle = await owner.get();
      try {
        expect(handle.db.databaseName).toBe(context.databaseName);
        expect(handle.mongoose.name).toBe(context.databaseName);
        expect(handle.mongoose.getClient()).toBe(handle.client);
        const model = handle.mongoose.model(
          "ReviewWrite",
          new mongoose.Schema(
            { marker: String },
            { autoCreate: false, autoIndex: false },
          ),
          collection,
        );
        await model.create({ marker: "same_database" });
        expect(await native.countDocuments({ marker: "same_database" })).toBe(
          1,
        );
        expect(
          await handle.client
            .db(uriDatabase || "test")
            .listCollections({ name: collection })
            .hasNext(),
        ).toBe(false);
      } finally {
        await owner.close();
      }
    },
  );

  it("preserves date values when comparing partial filters", async () => {
    const collection = "date_filter_review";
    const coll = await context.createCollection(collection);
    const cutoff = new Date("2026-01-01T00:00:00Z");
    await coll.createIndex(
      { createdAt: 1 },
      {
        name: "cutoff",
        partialFilterExpression: { createdAt: { $gte: cutoff } },
      },
    );
    const owner = context.createOwner();
    const handle = await owner.get();
    const manifest = (date: Date): readonly CollectionIndexes[] => [
      {
        collection,
        indexes: [
          {
            name: "cutoff",
            key: { createdAt: 1 },
            partialFilterExpression: { createdAt: { $gte: date } },
          },
        ],
      },
    ];
    expect(await checkIndexes(handle.db, manifest(new Date(cutoff)))).toEqual(
      [],
    );
    expect(
      await checkIndexes(handle.db, manifest(new Date("2026-02-01T00:00:00Z"))),
    ).toEqual([expect.objectContaining({ kind: "different", name: "cutoff" })]);
  });
});
