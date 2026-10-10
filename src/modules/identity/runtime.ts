import "server-only";
import { getDatabase } from "../../server/db/connection";
import {
  createRecoverySender,
  readRecoveryEmailConfig,
} from "../notifications/recovery-email";
import { createIdentity } from "./service";

let pending: ReturnType<typeof createIdentity> | undefined;
export function getIdentity() {
  if (!pending)
    pending = (async () => {
      const database = await getDatabase();
      const identity = await createIdentity(database, {
        // Authentication itself must not depend on a password-recovery provider.
        // The selected provider is validated only when a reset is requested.
        baseURL: process.env.APP_URL ?? "",
        secret: process.env.BETTER_AUTH_SECRET ?? "",
        sendRecovery: async (message) => {
          const email = readRecoveryEmailConfig();
          return createRecoverySender(email)(message);
        },
        onDeliveryFailure: () => console.error("auth.email_delivery_failed"),
      });
      try {
        await identity.administration.retryRevocations();
      } catch {
        /* Durable cleanup remains queued; guards still deny stale sessions. */
      }
      return identity;
    })().catch((error: unknown) => {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : error instanceof Error
            ? error.message
            : "";
      console.error(
        "auth.initialization_failed",
        [
          "AUTH_CONFIG_INVALID",
          "AUTH_INDEX_DRIFT",
          "DB_CONFIG_INVALID",
          "DB_UNSAFE_TARGET",
          "DB_UNAVAILABLE",
        ].includes(code)
          ? code
          : "INITIALIZATION_FAILED",
      );
      pending = undefined;
      throw error;
    });
  return pending;
}
