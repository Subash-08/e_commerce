import "server-only";
import { createHash } from "node:crypto";
import type { Db, ClientSession } from "mongodb";
import { getIdentity } from "../identity/runtime";
import { getDatabase } from "../../server/db/connection";

// No Admin setting can bypass this pre-launch gate.
export function paymentTestConfig() {
  if (!["development", "test"].includes(process.env.APP_ENV ?? ""))
    throw new Error("PAYMENT_TEST_ONLY");
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (
    process.env.RAZORPAY_MODE !== "test" ||
    !/^rzp_test_[A-Za-z0-9]+$/.test(keyId) ||
    keySecret.length < 8
  )
    throw new Error("PAYMENT_CONFIG_INVALID");
  return {
    keyId,
    keySecret,
    accountKeyHash: createHash("sha256").update(keyId).digest("hex"),
  };
}

export async function requirePaymentTestAdmin(
  headers: Headers,
  db?: Db,
  session?: ClientSession,
) {
  paymentTestConfig();
  const actor = await (
    await getIdentity()
  ).requireAccess(headers, "settings.manage");
  const database = db ?? (await getDatabase()).db;
  const profile = await database.collection("profiles").findOne(
    {
      authUserId: actor.authUserId,
      role: "ADMIN",
      status: "ACTIVE",
      authVersion: actor.authVersion,
    },
    { session, projection: { _id: 1 } },
  );
  if (!profile) throw new Error("FORBIDDEN");
  return actor;
}
