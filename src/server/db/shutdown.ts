import "server-only";
import { closeDatabase } from "./connection.ts";
import { observeDatabase } from "./observability.ts";
const lifecycle = globalThis as typeof globalThis & { __commerceDbShutdownRegistered?: boolean };
export function registerDatabaseShutdown() {
 if (process.env.APP_RUNTIME !== "long-running" || lifecycle.__commerceDbShutdownRegistered) return;
 lifecycle.__commerceDbShutdownRegistered = true;
 const shutdown = () => { void closeDatabase().catch(() => observeDatabase("db.unavailable", {code:"DB_CLOSING"})); };
 process.once("SIGINT", shutdown);
 process.once("SIGTERM", shutdown);
 // Host supervisor/Next owns server draining and final process exit, not this DB hook.
}
