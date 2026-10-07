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
      const email = readRecoveryEmailConfig();
      const database = await getDatabase();
      return createIdentity(database, {
        baseURL: email.appUrl,
        secret: process.env.BETTER_AUTH_SECRET ?? "",
        sendRecovery: createRecoverySender(email),
        onDeliveryFailure: () => console.error("auth.email_delivery_failed"),
      });
    })().catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
  return pending;
}
