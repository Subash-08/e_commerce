import "server-only";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { getDatabase } from "../db/connection";
import { sendOrderConfirmation } from "../../modules/notifications/order-email";

const delays = [60, 300, 1800, 7200, 21600, 86400];
function bounded(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max
    ? number
    : fallback;
}

export async function runDueJobs() {
  const database = await getDatabase();
  const limit = bounded(process.env.JOBS_BATCH_LIMIT, 25, 1, 100);
  const budget = bounded(process.env.JOBS_TIME_BUDGET_MS, 20000, 1000, 50000);
  const started = Date.now();
  let succeeded = 0,
    retried = 0,
    dead = 0;
  for (let index = 0; index < limit && Date.now() - started < budget; index++) {
    const now = new Date();
    const leaseToken = randomUUID();
    const job = await database.db.collection("jobs").findOneAndUpdate(
      {
        kind: "SEND_NOTIFICATION",
        $or: [
          { state: { $in: ["PENDING", "RETRY"] }, dueAt: { $lte: now } },
          { state: "RUNNING", leaseUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          state: "RUNNING",
          leaseToken,
          leaseUntil: new Date(now.getTime() + 30000),
          updatedAt: now,
        },
        $inc: { attempts: 1 },
      },
      { sort: { dueAt: 1, _id: 1 }, returnDocument: "after" },
    );
    if (!job) break;
    try {
      if (
        job.payload?.notification !== "ORDER_CONFIRMATION" ||
        !(job.payload.orderId instanceof ObjectId)
      )
        throw new Error("UNSUPPORTED_NOTIFICATION");
      const order = await database.db.collection("orders").findOne(
        { _id: job.payload.orderId },
        {
          projection: {
            orderNumber: 1,
            "snapshots.contact.email": 1,
            "snapshots.totals.grandTotalPaise": 1,
          },
        },
      );
      const email = order?.snapshots?.contact?.email;
      const totalPaise = order?.snapshots?.totals?.grandTotalPaise;
      if (
        !order ||
        typeof email !== "string" ||
        !Number.isSafeInteger(totalPaise)
      )
        throw new Error("ORDER_NOTIFICATION_INVALID");
      await sendOrderConfirmation({
        email,
        orderNumber: String(order.orderNumber),
        totalPaise,
      });
      const changed = await database.db.collection("jobs").updateOne(
        { _id: job._id, state: "RUNNING", leaseToken },
        {
          $set: {
            state: "SUCCEEDED",
            completedAt: new Date(),
            updatedAt: new Date(),
          },
          $unset: { leaseToken: "", leaseUntil: "", lastErrorCode: "" },
        },
      );
      if (changed.modifiedCount) succeeded++;
    } catch (error) {
      const attempts = Number(job.attempts ?? 1);
      const terminal = attempts >= 10;
      const code =
        error instanceof Error &&
        [
          "EMAIL_CONFIG_INVALID",
          "EMAIL_MESSAGE_INVALID",
          "EMAIL_DELIVERY_FAILED",
          "UNSUPPORTED_NOTIFICATION",
          "ORDER_NOTIFICATION_INVALID",
        ].includes(error.message)
          ? error.message
          : "NOTIFICATION_FAILED";
      const changed = await database.db.collection("jobs").updateOne(
        { _id: job._id, state: "RUNNING", leaseToken },
        {
          $set: {
            state: terminal ? "DEAD" : "RETRY",
            dueAt: new Date(
              Date.now() +
                delays[Math.min(attempts - 1, delays.length - 1)] * 1000,
            ),
            lastErrorCode: code,
            updatedAt: new Date(),
          },
          $unset: { leaseToken: "", leaseUntil: "" },
        },
      );
      if (changed.modifiedCount) {
        if (terminal) dead++;
        else retried++;
      }
    }
  }
  return { succeeded, retried, dead, elapsedMs: Date.now() - started };
}
