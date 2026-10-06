import "server-only";
import { MongoError } from "mongodb";
import { DomainError } from "../../shared/domain/errors.ts";
export type DatabaseErrorCode =
  | "DB_CONFIG_INVALID"
  | "DB_UNAVAILABLE"
  | "DB_DUPLICATE_KEY"
  | "DB_VALIDATION"
  | "DB_TRANSACTION_FAILED"
  | "DB_RETRY_LIMIT"
  | "DB_CLOSING"
  | "DB_TOPOLOGY_REQUIRED"
  | "DB_INDEX_DRIFT"
  | "DB_UNSAFE_TARGET";
const originals = new WeakMap<DatabaseError, unknown>();
export class DatabaseError extends Error {
  readonly code: DatabaseErrorCode;
  constructor(code: DatabaseErrorCode, original?: unknown) {
    super(code);
    this.name = "DatabaseError";
    this.code = code;
    // Never attach the raw driver cause to serializable/loggable error properties.
    originals.set(this, original);
  }
}
export function diagnosticCause(error: DatabaseError): unknown {
  return originals.get(error);
}
export function normalizeDatabaseError(
  error: unknown,
  fallback: DatabaseErrorCode = "DB_UNAVAILABLE",
): DatabaseError {
  if (error instanceof DatabaseError) return error;
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  const name = error instanceof Error ? error.name : "";
  if (code === 11000) return new DatabaseError("DB_DUPLICATE_KEY", error);
  if (code === 121 || name === "ValidationError" || name === "CastError")
    return new DatabaseError("DB_VALIDATION", error);
  if (/Network|ServerSelection|PoolCleared|NotConnected|Timeout/.test(name))
    return new DatabaseError("DB_UNAVAILABLE", error);
  return new DatabaseError(fallback, error);
}
export function isDatabaseFailure(error: unknown): boolean {
  return (
    error instanceof MongoError ||
    (error instanceof Error &&
      ["ValidationError", "CastError"].includes(error.name))
  );
}
export function publicDatabaseError(error: unknown) {
  return {
    code:
      error instanceof DomainError
        ? error.code
        : normalizeDatabaseError(error).code,
  };
}
