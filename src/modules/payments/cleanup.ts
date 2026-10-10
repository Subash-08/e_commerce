import "server-only";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { getDatabase } from "../../server/db/connection";
import { transaction } from "../../server/db/transaction";
import { cancelInTransaction } from "../orders/service";
import { rateLimit } from "../cart/security";
import { requirePaymentTestAdmin, paymentTestConfig } from "./access";
import { bindingRepository, BINDING_LEASE_MS } from "./repository";
import { razorpayOrders } from "./provider";

// Only for this slice's test orders, whose provider checkout data is never exposed.
export async function cleanupTestOrder(headers: Headers, id: string) {
  if (!/^[a-f0-9]{24}$/.test(id)) throw new Error("ORDER_NOT_FOUND");
  const actor = await requirePaymentTestAdmin(headers);
  const database = await getDatabase();
  await rateLimit(database.db, "payment-cleanup:" + actor.authUserId, 10);
  const repo = bindingRepository(database.db);
  const orderId = new ObjectId(id);
  const row = await repo.read(orderId);
  if (
    !row ||
    row.mode !== "test" ||
    row.accountKeyHash !== paymentTestConfig().accountKeyHash
  )
    throw new Error("PAYMENT_BINDING_INVALID");
  if (
    row.state !== "BOUND" &&
    !(row.state === "NOT_STARTED" && row.attempts === 0)
  )
    throw new Error("PAYMENT_CLEANUP_REQUIRES_REVIEW");
  const now = new Date();
  const token = randomUUID();
  const lease = await repo.rows.findOneAndUpdate(
    { _id: row._id, active: true, revision: row.revision, state: row.state },
    {
      $set: {
        state: "REQUESTING",
        leaseToken: token,
        leaseUntil: new Date(now.getTime() + BINDING_LEASE_MS),
        updatedAt: now,
      },
      $inc: { revision: 1 },
    },
    { returnDocument: "after" },
  );
  if (!lease) throw new Error("REVISION_CONFLICT");
  try {
    if (row.state === "BOUND") {
      if (!row.providerOrderId) throw new Error("PAYMENT_BINDING_INVALID");
      const remote = await razorpayOrders().fetch(row.providerOrderId);
      if (
        remote.id !== row.providerOrderId ||
        remote.receipt !== row.receipt ||
        remote.amount !== row.amountPaise ||
        remote.currency !== "INR" ||
        remote.notes.commerceOperation !== row.operationId ||
        remote.notes.commerceOrder !== id ||
        remote.status !== "created" ||
        remote.attempts !== 0 ||
        remote.amount_paid !== 0 ||
        remote.amount_due !== row.amountPaise
      )
        throw new Error("PAYMENT_CLEANUP_REQUIRES_REVIEW");
    }
    return await transaction(async (session) => {
      if (
        !(await database.db.collection("profiles").findOne(
          {
            authUserId: actor.authUserId,
            role: "ADMIN",
            status: "ACTIVE",
            authVersion: actor.authVersion,
          },
          { session },
        ))
      )
        throw new Error("FORBIDDEN");
      const order = await database.db.collection("orders").findOne(
        {
          _id: orderId,
          testOnly: true,
          paymentMethod: "ONLINE",
          state: "PENDING_PAYMENT",
        },
        { session },
      );
      if (!order) throw new Error("ORDER_NOT_FOUND");
      const fenced = await repo.rows.updateOne(
        {
          _id: row._id,
          revision: lease.revision,
          state: "REQUESTING",
          leaseToken: token,
          leaseUntil: { $gt: new Date() },
        },
        {
          $set: {
            active: false,
            state: row.state,
            updatedAt: new Date(),
            lastErrorCode: "TEST_ORDER_CLEANED",
          },
          $unset: { leaseToken: "", leaseUntil: "" },
          $inc: { revision: 1 },
        },
        { session },
      );
      if (!fenced.modifiedCount) throw new Error("REVISION_CONFLICT");
      return cancelInTransaction(
        database.db,
        session,
        orderId,
        order.revision,
        "Admin cleanup of unpaid pre-launch test order",
        actor.authUserId,
        true,
      );
    }, database);
  } catch {
    await repo.finish(lease, token, "UNKNOWN", {
      lastErrorCode: "PAYMENT_CLEANUP_REQUIRES_REVIEW",
    });
    throw new Error("PAYMENT_CLEANUP_REQUIRES_REVIEW");
  }
}
