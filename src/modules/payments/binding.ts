import "server-only";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { getDatabase } from "../../server/db/connection";
import { requirePaymentTestAdmin, paymentTestConfig } from "./access";
import {
  bindingRepository,
  type Binding,
  MAX_RECOVERY_ATTEMPTS,
} from "./repository";
import { razorpayOrders, type ProviderOrder } from "./provider";
import { rateLimit } from "../cart/security";

function assertMatch(row: Binding, provider: ProviderOrder) {
  if (
    provider.receipt !== row.receipt ||
    provider.currency !== "INR" ||
    provider.amount !== row.amountPaise ||
    provider.notes.commerceOperation !== row.operationId ||
    provider.notes.commerceOrder !== String(row.orderId)
  )
    throw new Error("PAYMENT_BINDING_MISMATCH");
}
export function bindingView(row: Binding) {
  return {
    state: row.state,
    orderNumber: row.orderNumber,
    generation: row.generation,
    reviewRequired:
      row.state === "UNKNOWN" ||
      row.lastErrorCode === "PAYMENT_ACTIVITY_REVIEW_REQUIRED",
    code: row.lastErrorCode ?? null,
    nextCheckAt: row.nextCheckAt?.toISOString() ?? null,
    paymentEnabled: false,
  };
}
export async function bindTestOrder(headers: Headers, id: string) {
  if (!/^[a-f0-9]{24}$/.test(id)) throw new Error("ORDER_NOT_FOUND");
  const actor = await requirePaymentTestAdmin(headers);
  const database = await getDatabase();
  await rateLimit(database.db, "payment-binding:" + actor.authUserId, 10);
  const orderId = new ObjectId(id);
  const order = await database.db.collection("orders").findOne({
    _id: orderId,
    testOnly: true,
    paymentMethod: "ONLINE",
    state: "PENDING_PAYMENT",
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  const repo = bindingRepository(database.db);
  let row = await repo.read(orderId);
  if (!row) throw new Error("PAYMENT_BINDING_MISSING");
  const config = paymentTestConfig();
  if (row.mode !== "test" || row.accountKeyHash !== config.accountKeyHash)
    throw new Error("PAYMENT_ACCOUNT_CHANGED");
  await repo.expireLease(row._id, new Date());
  row = (await repo.read(orderId))!;
  if (
    row.state === "BOUND" ||
    row.state === "REQUESTING" ||
    row.state === "FAILED"
  )
    return bindingView(row);
  const recovery = row.state === "UNKNOWN";
  if (recovery && row.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS)
    return bindingView(row);
  const token = randomUUID();
  const claimed = await repo.claim(row, token, new Date(), recovery);
  if (!claimed) return bindingView((await repo.read(orderId))!);
  const provider = razorpayOrders();
  try {
    let remote: ProviderOrder;
    if (recovery) {
      const matches = await provider.lookup(row.receipt);
      if (matches.length !== 1)
        throw new Error(
          matches.length ? "PAYMENT_MULTIPLE_MATCHES" : "PAYMENT_NO_MATCH_YET",
        );
      remote = matches[0];
    } else {
      remote = await provider.create({
        receipt: row.receipt,
        amountPaise: row.amountPaise,
        operationId: row.operationId,
        orderId: String(orderId),
      });
    }
    assertMatch(row, remote);
    await repo.finish(claimed, token, "BOUND", {
      providerOrderId: remote.id,
      lastErrorCode:
        remote.amount_paid > 0 || remote.attempts > 0
          ? "PAYMENT_ACTIVITY_REVIEW_REQUIRED"
          : undefined,
    });
  } catch (error) {
    const safeCodes = [
      "PAYMENT_BINDING_MISMATCH",
      "PAYMENT_MULTIPLE_MATCHES",
      "PAYMENT_NO_MATCH_YET",
    ];
    const code =
      error instanceof Error && safeCodes.includes(error.message)
        ? error.message
        : "PAYMENT_BINDING_UNCERTAIN";
    await repo.finish(claimed, token, "UNKNOWN", { lastErrorCode: code });
  }
  // A provider result arriving after the lease cannot overwrite another worker.
  await repo.expireLease(row._id, new Date());
  return bindingView((await repo.read(orderId))!);
}
