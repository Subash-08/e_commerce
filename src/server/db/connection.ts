import "server-only";
import mongoose from "mongoose";
import { MongoClient, type Db } from "mongodb";
import { readDatabaseConfig, type DatabaseConfig } from "./config.ts";
import { DatabaseError, normalizeDatabaseError } from "./errors.ts";
import { observeDatabase, type DatabaseObserver } from "./observability.ts";
export interface DatabaseHandle {
  readonly client: MongoClient;
  readonly db: Db;
  readonly mongoose: mongoose.Connection;
}
interface ConnectionCache {
  promise?: Promise<DatabaseHandle>;
  closing?: Promise<void>;
  stopped?: boolean;
}
const productionCache: ConnectionCache = {};
const developmentGlobal = globalThis as typeof globalThis & {
  __commerceDbPromiseCacheV1?: ConnectionCache;
};
function applicationCache() {
  if (process.env.NODE_ENV === "development")
    return (developmentGlobal.__commerceDbPromiseCacheV1 ??= {});
  return productionCache;
}
export async function assertTransactionTopology(db: Db): Promise<void> {
  const hello = await db.admin().command({ hello: 1 }, { timeoutMS: 2000 });
  if (typeof hello.setName !== "string" && hello.msg !== "isdbgrid")
    throw new DatabaseError("DB_TOPOLOGY_REQUIRED");
  if (hello.logicalSessionTimeoutMinutes == null)
    throw new DatabaseError("DB_TOPOLOGY_REQUIRED");
}
export async function openDatabase(
  config: DatabaseConfig,
  observe: DatabaseObserver = observeDatabase,
): Promise<DatabaseHandle> {
  if (mongoose.mongo.MongoClient !== MongoClient)
    throw new DatabaseError("DB_CONFIG_INVALID");
  let client: MongoClient | undefined;
  let connection: mongoose.Connection | undefined;
  try {
    client = new MongoClient(config.uri, {
      maxPoolSize: config.maxPoolSize,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 1500,
      connectTimeoutMS: 1500,
      waitQueueTimeoutMS: 1500,
      timeoutMS: 2000,
      retryWrites: true,
    });
    await client.connect();
    const db = client.db(config.databaseName);
    await assertTransactionTopology(db);
    const instance = new mongoose.Mongoose({
      autoIndex: false,
      autoCreate: false,
      bufferCommands: false,
    });
    connection = instance.createConnection().setClient(client);
    connection.on("error", () =>
      observe("db.unavailable", { code: "DB_UNAVAILABLE" }),
    );
    observe("db.connected");
    return { client, db, mongoose: connection };
  } catch (error) {
    if (connection) await connection.destroy().catch(() => undefined);
    else await client?.close().catch(() => undefined);
    const safe = normalizeDatabaseError(error);
    observe("db.unavailable", { code: safe.code });
    throw safe;
  }
}
/** Isolated owner factory for dedicated tools/suites; application code uses the singleton below. */
export function createDatabaseOwner(
  config: () => DatabaseConfig = readDatabaseConfig,
  cache: ConnectionCache = {},
  observe: DatabaseObserver = observeDatabase,
) {
  function get(): Promise<DatabaseHandle> {
    if (cache.stopped || cache.closing)
      return Promise.reject(new DatabaseError("DB_CLOSING"));
    if (!cache.promise) {
      const pending = Promise.resolve().then(() =>
        openDatabase(config(), observe),
      );
      cache.promise = pending;
      void pending.catch(() => {
        if (cache.promise === pending) cache.promise = undefined;
      });
    }
    return cache.promise;
  }
  async function close(): Promise<void> {
    if (cache.closing) return cache.closing;
    cache.stopped = true;
    const pending = cache.promise;
    const closing = (async () => {
      let handle: DatabaseHandle | undefined;
      try {
        handle = await pending;
      } catch {
        /* Failed opens already clean their client. */
      }
      if (handle) await handle.mongoose.destroy();
      observe("db.closed");
    })();
    cache.closing = closing;
    try {
      await closing;
    } finally {
      if (cache.promise === pending) cache.promise = undefined;
    }
  }
  return { get, close };
}
export function getDatabase() {
  return createDatabaseOwner(readDatabaseConfig, applicationCache()).get();
}
export function closeDatabase() {
  return createDatabaseOwner(readDatabaseConfig, applicationCache()).close();
}
