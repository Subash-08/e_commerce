import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  createTestDatabaseContext,
  stopSharedTestReplicaSet,
  type TestDatabaseContext,
} from "../fixtures/db-harness";
import {
  checkIndexes,
  applyIndexes,
  type CollectionIndexes,
} from "../../src/server/db/indexes";
import { approvedIndexes } from "../../src/server/db/approved-indexes";
import {
  DatabaseError,
  diagnosticCause,
  publicDatabaseError,
  normalizeDatabaseError,
} from "../../src/server/db/errors";

describe("Database index lifecycle, drift detection, and error sanitization", () => {
  let context: TestDatabaseContext;

  beforeAll(async () => {
    context = await createTestDatabaseContext("idx");
  });

  afterAll(async () => {
    try {
      await context?.teardown();
    } finally {
      await stopSharedTestReplicaSet();
    }
  });

  it("detects missing, unchanged, unexpected, and different indexes with compound keys and options", async () => {
    const owner = context.createOwner();
    const handle = await owner.get();
    const collName = "idx_manifest_test";
    const coll = await context.createCollection(collName);

    // Initial state: create one existing index and one unexpected index
    await coll.createIndexes([
      { key: { sku: 1, active: -1 }, name: "sku_1_active_-1" },
      { key: { legacy: 1 }, name: "legacy_unexpected_idx" },
    ]);

    const fixtureManifest: readonly CollectionIndexes[] = [
      {
        collection: collName,
        indexes: [
          // Unchanged index
          { name: "sku_1_active_-1", key: { sku: 1, active: -1 } },
          // Missing compound unique index
          {
            name: "email_unique",
            key: { email: 1 },
            unique: true,
            sparse: true,
          },
          // Missing partial filter index
          {
            name: "partial_idx",
            key: { orderId: 1 },
            partialFilterExpression: { status: "ACTIVE" },
          },
          // Missing TTL index
          {
            name: "ttl_idx",
            key: { createdAt: 1 },
            expireAfterSeconds: 3600,
          },
        ],
      },
    ];

    const diffs = await checkIndexes(handle.db, fixtureManifest);

    const missing = diffs.filter((d) => d.kind === "missing");
    const unexpected = diffs.filter((d) => d.kind === "unexpected");
    const different = diffs.filter((d) => d.kind === "different");

    expect(missing.map((m) => m.name).sort()).toEqual([
      "email_unique",
      "partial_idx",
      "ttl_idx",
    ]);
    expect(unexpected.map((u) => u.name)).toEqual(["legacy_unexpected_idx"]);
    expect(different).toHaveLength(0);

    await owner.close();
  });

  it("dry run performs no writes; apply creates approved missing indexes without dropping unexpected ones", async () => {
    const owner = context.createOwner();
    const handle = await owner.get();
    const collName = "idx_apply_test";
    const coll = await context.createCollection(collName);

    // Pre-existing unexpected index
    await coll.createIndex({ surprise: 1 }, { name: "surprise_idx" });

    const manifest: readonly CollectionIndexes[] = [
      {
        collection: collName,
        indexes: [
          { name: "name_1", key: { name: 1 } },
          { name: "code_1", key: { code: 1 }, unique: true },
        ],
      },
    ];

    // Dry run: reports plan but writes nothing
    const dryResult = await applyIndexes(handle.db, manifest, {
      dryRun: true,
    });
    expect(dryResult.created).toHaveLength(0);
    expect(dryResult.planned.map((p) => p.name).sort()).toEqual([
      "code_1",
      "name_1",
    ]);
    expect(dryResult.unexpected.map((u) => u.name)).toEqual(["surprise_idx"]);

    const indexesAfterDry = await coll.listIndexes().toArray();
    expect(indexesAfterDry.map((i) => i.name).sort()).toEqual([
      "_id_",
      "surprise_idx",
    ]);

    // Real apply: creates missing indexes, preserves surprise_idx
    const applyResult = await applyIndexes(handle.db, manifest, {
      dryRun: false,
    });
    expect(applyResult.created.sort()).toEqual([
      `${collName}.code_1`,
      `${collName}.name_1`,
    ]);

    const indexesAfterApply = await coll.listIndexes().toArray();
    expect(indexesAfterApply.map((i) => i.name).sort()).toEqual([
      "_id_",
      "code_1",
      "name_1",
      "surprise_idx",
    ]);

    // Re-check shows zero missing indexes, surprise_idx still unexpected but untouched
    const afterDiffs = await checkIndexes(handle.db, manifest);
    expect(afterDiffs.filter((d) => d.kind === "missing")).toHaveLength(0);
    expect(
      afterDiffs.filter((d) => d.kind === "unexpected").map((u) => u.name),
    ).toEqual(["surprise_idx"]);

    await owner.close();
  });

  it("same-name mismatch refuses creation before any other planned mutation", async () => {
    const owner = context.createOwner();
    const handle = await owner.get();
    const collName = "idx_mismatch_test";
    const coll = await context.createCollection(collName);

    // Existing index named "conflict_idx" with key { a: 1 }
    await coll.createIndex({ a: 1 }, { name: "conflict_idx" });

    // Manifest expects "conflict_idx" to have key { b: 1 }, and also has a missing "valid_idx"
    const manifest: readonly CollectionIndexes[] = [
      {
        collection: collName,
        indexes: [
          { name: "conflict_idx", key: { b: 1 } }, // Mismatched definition!
          { name: "valid_idx", key: { c: 1 } }, // Should NOT be created!
        ],
      },
    ];

    await expect(
      applyIndexes(handle.db, manifest, { dryRun: false }),
    ).rejects.toMatchObject({
      code: "DB_INDEX_DRIFT",
    });

    // Verify valid_idx was NOT created because the mismatch aborted creation beforehand
    const indexes = await coll.listIndexes().toArray();
    expect(indexes.some((i) => i.name === "valid_idx")).toBe(false);

    await owner.close();
  });

  it("normalizes duplicate key and validation errors to safe codes, redacting credentials and raw driver messages", async () => {
    const owner = context.createOwner();
    const handle = await owner.get();
    const collName = "idx_error_redaction";

    // Setup collection with JSON schema validation and unique index
    const coll = await handle.db.createCollection(collName, {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["secretCode"],
          properties: {
            secretCode: { bsonType: "string" },
          },
        },
      },
    });
    (context.ownedCollections as Set<string>).add(collName);

    await coll.createIndex({ secretCode: 1 }, { unique: true });

    // 1. Validation failure
    let valError: unknown;
    try {
      await coll.insertOne({ wrongField: 123 });
    } catch (err) {
      valError = normalizeDatabaseError(err);
    }
    expect(valError).toBeInstanceOf(DatabaseError);
    const dbValErr = valError as DatabaseError;
    expect(dbValErr.code).toBe("DB_VALIDATION");
    // Public/serialized error contains ONLY safe code, no raw documents or schema
    expect(publicDatabaseError(dbValErr)).toEqual({ code: "DB_VALIDATION" });
    expect(JSON.stringify(dbValErr)).not.toContain("wrongField");
    expect(diagnosticCause(dbValErr)).toBeDefined();

    // 2. Duplicate key failure
    await coll.insertOne({ secretCode: "PASS_1234" });
    let dupError: unknown;
    try {
      await coll.insertOne({ secretCode: "PASS_1234" });
    } catch (err) {
      dupError = normalizeDatabaseError(err);
    }
    expect(dupError).toBeInstanceOf(DatabaseError);
    const dbDupErr = dupError as DatabaseError;
    expect(dbDupErr.code).toBe("DB_DUPLICATE_KEY");
    expect(publicDatabaseError(dbDupErr)).toEqual({
      code: "DB_DUPLICATE_KEY",
    });
    // Serialized output must not contain "PASS_1234" or connection strings
    expect(JSON.stringify(dbDupErr)).not.toContain("PASS_1234");
    expect(JSON.stringify(dbDupErr)).not.toContain("mongodb://");
    expect(diagnosticCause(dbDupErr)).toBeDefined();

    await owner.close();
  });

  it("the empty application manifest reports no approved indexes and does not claim database is valid", async () => {
    const owner = context.createOwner();
    const handle = await owner.get();

    expect(approvedIndexes).toHaveLength(0);

    const result = await checkIndexes(handle.db, approvedIndexes);
    expect(result).toHaveLength(0);

    await owner.close();
  });
});
