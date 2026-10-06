import { describe, expect, it, afterAll, beforeAll, vi } from "vitest";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import {
  createTestDatabaseContext,
  stopSharedTestReplicaSet,
  type TestDatabaseContext,
} from "../fixtures/db-harness";
import { createDatabaseOwner } from "../../src/server/db/connection";
import { DatabaseError } from "../../src/server/db/errors";
import { parseDatabaseConfig } from "../../src/server/db/config";

describe("Database connection ownership and lifecycle", () => {
  let context: TestDatabaseContext;

  beforeAll(async () => {
    context = await createTestDatabaseContext("conn");
  });

  afterAll(async () => {
    try {
      await context?.teardown();
    } finally {
      await stopSharedTestReplicaSet();
    }
  });

  it("50 concurrent first get calls share the same promise, handle, native client and connect exactly once", async () => {
    const connectSpy = vi.spyOn(MongoClient.prototype, "connect");
    const owner = context.createOwner();

    const initialConnectCount = connectSpy.mock.calls.length;

    // Launch 50 concurrent first get() calls
    const handles = await Promise.all(
      Array.from({ length: 50 }, () => owner.get()),
    );

    // Assert connect was called exactly once for this owner
    expect(connectSpy.mock.calls.length - initialConnectCount).toBe(1);

    const firstHandle = handles[0];
    for (let i = 1; i < handles.length; i++) {
      expect(handles[i]).toBe(firstHandle);
      expect(handles[i].client).toBe(firstHandle.client);
      expect(handles[i].db).toBe(firstHandle.db);
      expect(handles[i].mongoose).toBe(firstHandle.mongoose);
    }

    await owner.close();
    connectSpy.mockRestore();
  });

  it("shares native driver identity with Mongoose and disables autoIndex, autoCreate and buffering", async () => {
    const owner = context.createOwner();
    const handle = await owner.get();

    // App driver identity is shared
    expect(mongoose.mongo.MongoClient).toBe(MongoClient);

    // Mongoose getClient() is the identical native client instance
    expect(handle.mongoose.getClient()).toBe(handle.client);

    // Auto-indexing, auto-creation, and buffering are disabled
    expect(handle.mongoose.base.get("autoIndex")).toBe(false);
    expect(handle.mongoose.base.get("autoCreate")).toBe(false);
    expect(handle.mongoose.base.get("bufferCommands")).toBe(false);

    await owner.close();
  });

  it("a rejected connection attempt releases partial resources, clears promise, and allows subsequent success", async () => {
    let returnGoodConfig = false;
    const badConfig = parseDatabaseConfig({
      NODE_ENV: "test",
      APP_ENV: "test",
      MONGODB_URI: "mongodb://127.0.0.1:27099", // port where nothing is listening
      MONGODB_DB_NAME: "rejected_conn_test",
      MONGODB_MAX_POOL_SIZE: 5,
    });

    const configFn = () => (returnGoodConfig ? context.config : badConfig);
    const owner = createDatabaseOwner(configFn);

    // First attempt rejects due to connection failure
    await expect(owner.get()).rejects.toThrow(DatabaseError);

    // Correct the config; same owner must clear its failed promise and succeed
    returnGoodConfig = true;
    const handle = await owner.get();
    expect(handle.client).toBeInstanceOf(MongoClient);

    // Ping works on the recovered handle
    const ping = await handle.db.command({ ping: 1 });
    expect(ping.ok).toBe(1);

    await owner.close();
  });

  it("close is idempotent, handles pending initialization without leaking, and rejects new gets", async () => {
    const owner = context.createOwner();

    // Trigger get and close concurrently while initialization is pending
    const getPromise = owner.get();
    const closePromise1 = owner.close();
    const closePromise2 = owner.close();

    // Closing while initialization is pending does not leak a client; both close calls resolve cleanly
    await Promise.all([
      getPromise.catch(() => {}),
      closePromise1,
      closePromise2,
    ]);

    // Subsequent close is also safe and idempotent
    await expect(owner.close()).resolves.toBeUndefined();

    // New get calls after close are rejected with DB_CLOSING
    await expect(owner.get()).rejects.toMatchObject({
      code: "DB_CLOSING",
    });
  });
});
