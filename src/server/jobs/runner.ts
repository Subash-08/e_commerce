import "server-only";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { getDatabase } from "../db/connection";
import { sendOrderConfirmation } from "../../modules/notifications/order-email";
import { processWebhookEvent } from "../../modules/payments/webhook";

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

async function notify(
  job: Record<string, unknown>,
  database: Awaited<ReturnType<typeof getDatabase>>,
) {
  const payload = job.payload as { notification?: unknown; orderId?: unknown };
  if (
    payload.notification !== "ORDER_CONFIRMATION" ||
    !(payload.orderId instanceof ObjectId)
  )
    throw new Error("UNSUPPORTED_NOTIFICATION");
  const order = await database.db.collection("orders").findOne(
    { _id: payload.orderId },
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
  if (!order || typeof email !== "string" || !Number.isSafeInteger(totalPaise))
    throw new Error("ORDER_NOTIFICATION_INVALID");
  await sendOrderConfirmation({
    email,
    orderNumber: String(order.orderNumber),
    totalPaise,
  });
}

function safeFailureCode(error: unknown, kind: unknown) {
  const code = error instanceof Error ? error.message : "";
  const known =
    kind === "PROCESS_WEBHOOK"
      ? [
          "WEBHOOK_EVENT_INVALID",
          "PAYMENT_BINDING_PENDING",
          "PAYMENT_PROVIDER_UNAVAILABLE",
          "PAYMENT_PROVIDER_INVALID_RESPONSE",
          "PAYMENT_PROOF_MISMATCH",
          "PAYMENT_BINDING_MISMATCH",
          "REVISION_CONFLICT",
        ]
      : [
          "EMAIL_CONFIG_INVALID",
          "EMAIL_MESSAGE_INVALID",
          "EMAIL_DELIVERY_FAILED",
          "UNSUPPORTED_NOTIFICATION",
          "ORDER_NOTIFICATION_INVALID",
        ];
  return known.includes(code)
    ? code
    : kind === "PROCESS_WEBHOOK"
      ? "WEBHOOK_PROCESSING_FAILED"
      : "NOTIFICATION_FAILED";
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
        kind: { $in: ["SEND_NOTIFICATION", "PROCESS_WEBHOOK"] },
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
      if (job.kind === "SEND_NOTIFICATION") await notify(job, database);
      else if (job.kind === "PROCESS_WEBHOOK")
        await processWebhookEvent(job.payload?.webhookEventId);
      else throw new Error("UNSUPPORTED_JOB");
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
      const changed = await database.db.collection("jobs").updateOne(
        { _id: job._id, state: "RUNNING", leaseToken },
        {
          $set: {
            state: terminal ? "DEAD" : "RETRY",
            dueAt: new Date(
              Date.now() +
                delays[Math.min(attempts - 1, delays.length - 1)] * 1000,
            ),
            lastErrorCode: safeFailureCode(error, job.kind),
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
