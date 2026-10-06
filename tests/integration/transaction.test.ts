import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { ClientSession, MongoError } from "mongodb";
import {
  createTestDatabaseContext,
  stopSharedTestReplicaSet,
  type TestDatabaseContext,
} from "../fixtures/db-harness";
import { transaction } from "../../src/server/db/transaction";
import { applyIndexes } from "../../src/server/db/indexes";
import { DomainError } from "../../src/shared/domain/errors";

interface CollDoc {
  _id: string;
  val?: string;
}

interface ItemDoc {
  _id: string;
  revision: number;
  stock: number;
}

interface EventDoc {
  _id: string;
  itemId: string;
  winner: string;
}

interface ConflictDoc {
  _id: string;
  count: number;
  external?: number;
}

interface DiagDoc {
  _id: string;
  safe?: boolean;
  leaked?: boolean;
}

describe("Database transactions and retry mechanics", () => {
  let context: TestDatabaseContext;

  beforeAll(async () => {
    context = await createTestDatabaseContext("tx");
  });

  afterAll(async () => {
    try {
      await context?.teardown();
    } finally {
      await stopSharedTestReplicaSet();
    }
  });

  it("persists real committed writes across collections and rolls back both on failure preserving DomainError", async () => {
    const owner = context.createOwner();
    const handle = await owner.get();

    await context.createCollection("tx_coll_a");
    await context.createCollection("tx_coll_b");
    const collA = handle.db.collection<CollDoc>("tx_coll_a");
    const collB = handle.db.collection<CollDoc>("tx_coll_b");

    // Positive case: two collections written in one transaction commit atomically
    await transaction(async (session) => {
      await collA.insertOne({ _id: "doc1", val: "a1" }, { session });
      await collB.insertOne({ _id: "doc1", val: "b1" }, { session });
    }, handle);

    expect(await collA.findOne({ _id: "doc1" })).toMatchObject({ val: "a1" });
    expect(await collB.findOne({ _id: "doc1" })).toMatchObject({ val: "b1" });

    // Negative case: failure after second write rolls back both and preserves DomainError
    await expect(
      transaction(async (session) => {
        await collA.insertOne({ _id: "doc2", val: "a2" }, { session });
        await collB.insertOne({ _id: "doc2", val: "b2" }, { session });
        throw new DomainError("INSUFFICIENT_STOCK");
      }, handle),
    ).rejects.toMatchObject({
      name: "DomainError",
      code: "INSUFFICIENT_STOCK",
    });

    expect(await collA.findOne({ _id: "doc2" })).toBeNull();
    expect(await collB.findOne({ _id: "doc2" })).toBeNull();

    await owner.close();
  });

  it("concurrent conditional revision updates yield exactly one winner and one REVISION_CONFLICT loser", async () => {
    const owner = context.createOwner();
    const handle = await owner.get();

    await context.createCollection("tx_items");
    await context.createCollection("tx_events");
    const items = handle.db.collection<ItemDoc>("tx_items");
    const events = handle.db.collection<EventDoc>("tx_events");

    await items.insertOne({ _id: "item-1", revision: 0, stock: 10 });

    const barrier = context.createBarrier(2);
    let attemptsA = 0;
    let attemptsB = 0;

    const updateAttempt = async (clientId: string) => {
      return transaction(async (session) => {
        if (clientId === "client-A") {
          attemptsA++;
          if (attemptsA === 1) await barrier.wait();
        } else {
          attemptsB++;
          if (attemptsB === 1) await barrier.wait();
        }
        const res = await items.updateOne(
          { _id: "item-1", revision: 0 },
          { $set: { revision: 1 }, $inc: { stock: -1 } },
          { session },
        );
        if (res.matchedCount === 0 || res.modifiedCount === 0) {
          throw new DomainError("REVISION_CONFLICT");
        }
        await events.insertOne(
          { _id: `event-${clientId}`, itemId: "item-1", winner: clientId },
          { session },
        );
        return clientId;
      }, handle);
    };

    const results = await Promise.allSettled([
      updateAttempt("client-A"),
      updateAttempt("client-B"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejectedError = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectedError).toMatchObject({
      name: "DomainError",
      code: "REVISION_CONFLICT",
    });

    const finalItem = await items.findOne({ _id: "item-1" });
    expect(finalItem?.revision).toBe(1);
    expect(finalItem?.stock).toBe(9);

    const eventDocs = await events.find({}).toArray();
    expect(eventDocs).toHaveLength(1);

    await owner.close();
  });

  it("forces a real server write conflict, verifies native driver retry, and achieves single durable side-effect", async () => {
    const owner = context.createOwner();
    const handle = await owner.get();

    await context.createCollection("tx_write_conflicts");
    const conflictColl =
      handle.db.collection<ConflictDoc>("tx_write_conflicts");
    await conflictColl.insertOne({ _id: "doc-conflict", count: 0 });

    let attempts = 0;
    let signalExternalReady!: () => void;
    const pExternalReady = new Promise<void>((r) => {
      signalExternalReady = r;
    });
    let signalExternalDone!: () => void;
    const pExternalDone = new Promise<void>((r) => {
      signalExternalDone = r;
    });

    // Background external writer modifies the document after attempt 1 reads it
    (async () => {
      await pExternalReady;
      // Perform write without session (acting as an independent concurrent transaction/writer)
      await conflictColl.updateOne(
        { _id: "doc-conflict" },
        { $set: { external: 1 } },
      );
      signalExternalDone();
    })();

    await transaction(async (session) => {
      attempts++;
      // Read document in transaction snapshot
      const doc = await conflictColl.findOne(
        { _id: "doc-conflict" },
        { session },
      );
      expect(doc).not.toBeNull();

      if (attempts === 1) {
        signalExternalReady();
        await pExternalDone;
      }

      // Write to the document that was modified externally
      await conflictColl.updateOne(
        { _id: "doc-conflict" },
        { $inc: { count: 1 } },
        { session },
      );
    }, handle);

    // WiredTiger detected write conflict on attempt 1; driver retried and succeeded on attempt 2
    expect(attempts).toBe(2);

    const finalDoc = await conflictColl.findOne({ _id: "doc-conflict" });
    expect(finalDoc).toMatchObject({ count: 1, external: 1 });

    await owner.close();
  });

  it("enforces three-callback limit and bounds retries via DB_RETRY_LIMIT", async () => {
    const owner = context.createOwner();
    const handle = await owner.get();

    let attempts = 0;
    const transientErr = new MongoError("simulated transient write conflict");
    transientErr.addErrorLabel("TransientTransactionError");

    await expect(
      transaction(async () => {
        attempts++;
        throw transientErr;
      }, handle),
    ).rejects.toMatchObject({
      code: "DB_RETRY_LIMIT",
    });

    // Callback ran 3 times, hit attempt 4 guard which threw DB_RETRY_LIMIT
    expect(attempts).toBe(3);

    await owner.close();
  });

  it("spies on real session cleanup to prove endSession on success and failure", async () => {
    const owner = context.createOwner();
    const handle = await owner.get();

    const endSessionSpy = vi.spyOn(ClientSession.prototype, "endSession");

    // Success calls endSession
    await transaction(async () => {}, handle);
    expect(endSessionSpy).toHaveBeenCalledTimes(1);

    // Failure calls endSession
    await expect(
      transaction(async () => {
        throw new Error("fail");
      }, handle),
    ).rejects.toThrow();

    expect(endSessionSpy).toHaveBeenCalledTimes(2);

    endSessionSpy.mockRestore();
    await owner.close();
  });

  it("rejects nested transaction wrappers and index modification inside transactions", async () => {
    const owner = context.createOwner();
    const handle = await owner.get();

    await expect(
      transaction(async (_session, h) => {
        // Attempt nested transaction
        await transaction(async () => {}, h);
      }, handle),
    ).rejects.toMatchObject({
      code: "DB_TRANSACTION_FAILED",
    });

    await expect(
      transaction(async (_session, h) => {
        // Attempt index apply inside transaction
        await applyIndexes(h.db, [], { dryRun: true });
      }, handle),
    ).rejects.toMatchObject({
      code: "DB_TRANSACTION_FAILED",
    });

    await owner.close();
  });

  it("demonstrates why sessions are mandatory: unpassed session writes escape rollback", async () => {
    const owner = context.createOwner();
    const handle = await owner.get();

    await context.createCollection("tx_diagnostic_session");
    const diagColl = handle.db.collection<DiagDoc>("tx_diagnostic_session");

    // Negative diagnostic: omitting session allows uncommitted escape
    await expect(
      transaction(async (session) => {
        // Correct write with explicit session
        await diagColl.insertOne(
          { _id: "with-session", safe: true },
          { session },
        );
        // Faulty write without session
        await diagColl.insertOne({ _id: "without-session", leaked: true });
        // Abort the transaction
        throw new DomainError("INSUFFICIENT_STOCK");
      }, handle),
    ).rejects.toMatchObject({
      name: "DomainError",
      code: "INSUFFICIENT_STOCK",
    });

    // The write with session rolled back
    expect(await diagColl.findOne({ _id: "with-session" })).toBeNull();
    // The write without session leaked into the database!
    expect(await diagColl.findOne({ _id: "without-session" })).toMatchObject({
      leaked: true,
    });

    await owner.close();
  });
});
