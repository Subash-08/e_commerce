import { afterEach, describe, expect, it, vi } from "vitest";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import {
  cleanupAll,
  createTestDatabaseContext,
  getSharedTestReplicaSet,
  stopSharedTestReplicaSet,
} from "../fixtures/db-harness";

describe("Fixture failure cleanup", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await stopSharedTestReplicaSet();
  });

  it("stops a partially started replica and permits retry after probe failure", async () => {
    const failure = new Error("injected_probe_failure");
    const connect = vi
      .spyOn(MongoClient.prototype, "connect")
      .mockRejectedValueOnce(failure);
    const stop = vi.spyOn(MongoMemoryReplSet.prototype, "stop");
    await expect(getSharedTestReplicaSet()).rejects.toMatchObject({
      errors: [failure],
    });
    expect(stop).toHaveBeenCalled();
    connect.mockRestore();
    expect(await getSharedTestReplicaSet()).toBeInstanceOf(MongoMemoryReplSet);
  });

  it("continues cleanup and preserves original and cleanup errors", async () => {
    const initial = new Error("initial");
    const closing = new Error("closing");
    const last = vi.fn(async () => {});
    await expect(
      cleanupAll(
        [
          async () => {
            throw closing;
          },
          last,
        ],
        initial,
      ),
    ).rejects.toMatchObject({ errors: [initial, closing] });
    expect(last).toHaveBeenCalledOnce();
  });

  it("surfaces owner-close failure after still dropping owned data and closing resources", async () => {
    const context = await createTestDatabaseContext("cleanup");
    await context.createCollection("owned");
    const owner = context.createOwner();
    await owner.get();
    const original = owner.close.bind(owner);
    const failure = new Error("injected_close_failure");
    vi.spyOn(owner, "close").mockImplementationOnce(async () => {
      await original();
      throw failure;
    });
    await expect(context.teardown()).rejects.toMatchObject({
      errors: [failure],
    });
    expect(context.ownedCollections.size).toBe(0);
  });
});
