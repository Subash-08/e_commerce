import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { type ClientSession } from "mongodb";
import { DomainError } from "../../shared/domain/errors.ts";
import { getDatabase, type DatabaseHandle } from "./connection.ts";
import {
  DatabaseError,
  isDatabaseFailure,
  normalizeDatabaseError,
} from "./errors.ts";
import { observeDatabase } from "./observability.ts";
const transactionScope = new AsyncLocalStorage<boolean>();
export function assertOutsideTransaction() {
  if (transactionScope.getStore())
    throw new DatabaseError("DB_TRANSACTION_FAILED");
}
export const TRANSACTION_TIMEOUT_MS = 10000;
export const MAX_CALLBACK_ATTEMPTS = 3;
/** Await every DB call sequentially with this session. No network side effects or manual commit/abort. */
export async function transaction<T>(
  callback: (session: ClientSession, database: DatabaseHandle) => Promise<T>,
  database?: DatabaseHandle,
): Promise<T> {
  assertOutsideTransaction();
  const handle = database ?? (await getDatabase());
  const session = handle.client.startSession();
  let attempts = 0;
  let failed = false;
  try {
    return await session.withTransaction(
      async () => {
        if (++attempts > MAX_CALLBACK_ATTEMPTS)
          throw new DatabaseError("DB_RETRY_LIMIT");
        return transactionScope.run(true, () => callback(session, handle));
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        readPreference: "primary",
        timeoutMS: TRANSACTION_TIMEOUT_MS,
        maxCommitTimeMS: 2000,
      },
    );
  } catch (error) {
    failed = true;
    // Preserve deliberate domain/application errors; normalize driver internals only.
    const safe =
      error instanceof DomainError ||
      error instanceof DatabaseError ||
      !isDatabaseFailure(error)
        ? error
        : normalizeDatabaseError(error, "DB_TRANSACTION_FAILED");
    observeDatabase(
      safe instanceof DatabaseError && safe.code === "DB_DUPLICATE_KEY"
        ? "db.duplicate_key"
        : "db.transaction_failed",
      {
        code:
          safe instanceof DomainError || safe instanceof DatabaseError
            ? safe.code
            : "APPLICATION_ERROR",
      },
    );
    throw safe;
  } finally {
    try {
      await session.endSession();
    } catch (error) {
      observeDatabase("db.session_cleanup_failed", {
        code: "DB_TRANSACTION_FAILED",
      });
      if (!failed) throw new DatabaseError("DB_TRANSACTION_FAILED", error);
    }
  }
}
