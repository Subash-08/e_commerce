import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";

import { MongoClient, type Db, type IndexDescription } from "mongodb";
import {
  parseDatabaseConfig,
  assertTestDatabase,
  type DatabaseConfig,
} from "../../src/server/db/config";
import {
  createDatabaseOwner,
  assertTransactionTopology,
} from "../../src/server/db/connection";
import { DatabaseError } from "../../src/server/db/errors";
import { type DatabaseObserver } from "../../src/server/db/observability";

export async function cleanupAll(
  steps: readonly (() => Promise<unknown>)[],
  original?: unknown,
): Promise<void> {
  const errors: unknown[] = original === undefined ? [] : [original];
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length)
    throw new AggregateError(errors, "Test resource cleanup failed");
}

// No hosted process: probe only the configured Atlas deployment.
export async function getSharedTestReplicaSet() {
  nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const uri = process.env.MONGODB_URI;
  parseDatabaseConfig({
    NODE_ENV: "test",
    APP_ENV: "test",
    MONGODB_URI: uri,
    MONGODB_DB_NAME: "ecommerce_test",
  });
  const client = new MongoClient(uri!, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    await assertTransactionTopology(client.db("ecommerce_test"));
  } catch (error) {
    await cleanupAll([() => client.close()], error);
    throw error;
  }
  await client.close();
  return { getUri: () => uri! };
}
export async function stopSharedTestReplicaSet(): Promise<void> {
  /* Atlas is externally managed. */
}

export class TestBarrier {
  private count: number;
  private readonly total: number;
  private readonly timeoutMs: number;
  private resolveWaiters: (() => void)[] = [];
  private rejectWaiters: ((err: Error) => void)[] = [];
  private timer?: NodeJS.Timeout;
  private released = false;

  constructor(total: number, timeoutMs = 5000) {
    this.total = total;
    this.count = total;
    this.timeoutMs = timeoutMs;
  }

  async wait(): Promise<void> {
    if (this.released) return;
    this.count--;
    if (this.count <= 0) {
      if (this.timer) clearTimeout(this.timer);
      const waiters = this.resolveWaiters;
      this.resolveWaiters = [];
      this.rejectWaiters = [];
      waiters.forEach((r) => r());
      return;
    }
    return new Promise<void>((resolve, reject) => {
      this.resolveWaiters.push(resolve);
      this.rejectWaiters.push(reject);
      if (!this.timer) {
        this.timer = setTimeout(() => {
          this.release(
            new Error(`TestBarrier timed out after ${this.timeoutMs}ms`),
          );
        }, this.timeoutMs);
        this.timer.unref();
      }
    });
  }

  release(err?: Error) {
    this.released = true;
    if (this.timer) clearTimeout(this.timer);
    const rejectWaiters = this.rejectWaiters;
    const resolveWaiters = this.resolveWaiters;
    this.resolveWaiters = [];
    this.rejectWaiters = [];
    if (err) rejectWaiters.forEach((rej) => rej(err));
    else resolveWaiters.forEach((res) => res());
  }
}

export interface TestDatabaseContext {
  readonly databaseName: string;
  readonly config: DatabaseConfig;
  readonly ownedCollections: ReadonlySet<string>;
  createCollection(
    name: string,
    indexes?: IndexDescription[],
  ): Promise<ReturnType<Db["collection"]>>;
  guardedDrop(name: string): Promise<void>;
  guardedCleanup(): Promise<void>;
  createOwner(
    configOverrides?: Partial<DatabaseConfig>,
    observer?: DatabaseObserver,
  ): ReturnType<typeof createDatabaseOwner>;
  createBarrier(parties: number, timeoutMs?: number): TestBarrier;
  teardown(): Promise<void>;
}

export async function createTestDatabaseContext(
  suitePrefix = "test",
): Promise<TestDatabaseContext> {
  const repl = await getSharedTestReplicaSet();

  // Enforce test environment flags
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  process.env.APP_ENV = "test";

  const randomSuffix = randomUUID().replaceAll("-", "").slice(0, 16);
  const sanitizedPrefix = suitePrefix
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .slice(0, 5);
  const databaseName = `ec_${sanitizedPrefix}_${randomSuffix}_test`;
  assertTestDatabase(databaseName);

  const uri = repl.getUri();
  const config = parseDatabaseConfig({
    NODE_ENV: "test",
    APP_ENV: "test",
    MONGODB_URI: uri,
    MONGODB_DB_NAME: databaseName,
    MONGODB_MAX_POOL_SIZE: 5,
    APP_RUNTIME: "long-running",
  });

  const ownedCollections = new Set<string>();
  const activeOwners: ReturnType<typeof createDatabaseOwner>[] = [];
  const activeBarriers: TestBarrier[] = [];

  // Dedicated admin client for collection setup and guarded drops
  const contextClient = new MongoClient(config.uri, {
    serverSelectionTimeoutMS: 10000,
  });
  const db = contextClient.db(config.databaseName);
  try {
    await contextClient.connect();
    await assertTransactionTopology(db);
  } catch (error) {
    await cleanupAll([() => contextClient.close()], error);
    throw error;
  }

  async function createCollection(name: string, indexes?: IndexDescription[]) {
    const coll = await db.createCollection(name);
    ownedCollections.add(name);
    if (indexes && indexes.length > 0) {
      await coll.createIndexes(indexes);
    }
    return coll;
  }

  async function guardedDrop(name: string) {
    // 1. Assert test environment
    if (process.env.NODE_ENV !== "test" || process.env.APP_ENV !== "test") {
      throw new DatabaseError("DB_UNSAFE_TARGET");
    }
    // 2. Assert database ends in _test
    assertTestDatabase(config.databaseName);
    // 3. Assert collection is in suite-owned allowlist
    if (!ownedCollections.has(name)) {
      throw new DatabaseError("DB_UNSAFE_TARGET");
    }
    await db.collection(name).drop();
    ownedCollections.delete(name);
  }

  async function guardedCleanup() {
    const list = Array.from(ownedCollections);
    for (const name of list) {
      try {
        await guardedDrop(name);
      } catch (err) {
        // If collection was already dropped or does not exist, ignore
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: number }).code === 26
        ) {
          ownedCollections.delete(name);
        } else {
          throw err;
        }
      }
    }
  }

  function createOwner(
    configOverrides?: Partial<DatabaseConfig>,
    observer?: DatabaseObserver,
  ) {
    const effectiveConfig = configOverrides
      ? { ...config, ...configOverrides }
      : config;
    const owner = createDatabaseOwner(
      () => effectiveConfig,
      {},
      observer ?? (() => {}),
    );
    activeOwners.push(owner);
    return owner;
  }

  function createBarrier(parties: number, timeoutMs = 5000) {
    const barrier = new TestBarrier(parties, timeoutMs);
    activeBarriers.push(barrier);
    return barrier;
  }

  async function teardown() {
    for (const barrier of activeBarriers) barrier.release();
    await cleanupAll([
      ...activeOwners.map((owner) => () => owner.close()),
      () => guardedCleanup(),
      () => contextClient.close(),
    ]);
  }
  return {
    databaseName,
    config,
    ownedCollections,
    createCollection,
    guardedDrop,
    guardedCleanup,
    createOwner,
    createBarrier,
    teardown,
  };
}
