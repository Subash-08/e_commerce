import "server-only";
import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDatabase } from "../../server/db/connection";
import { transaction } from "../../server/db/transaction";
import { paymentTestConfig } from "./access";
import { observePayment } from "./capture";

const eventSchema = z
  .object({
    event: z.enum(["payment.authorized", "payment.captured", "payment.failed"]),
    payload: z.object({
      payment: z.object({
        entity: z.object({
          id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
          order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
        }),
      }),
    }),
  })
  .passthrough();

export type RazorpayWebhookInput = z.infer<typeof eventSchema>;

export async function persistWebhook(
  raw: Buffer,
  deliveryHeader: string | null,
) {
  const parsed = eventSchema.safeParse(JSON.parse(raw.toString("utf8")));
  if (!parsed.success) throw new Error("INVALID_WEBHOOK");
  const config = paymentTestConfig();
  const rawHash = createHash("sha256").update(raw).digest("hex");
  const deliveryKey =
    deliveryHeader && /^[A-Za-z0-9._-]{1,200}$/.test(deliveryHeader)
      ? deliveryHeader
      : rawHash;
  const event = parsed.data;
  const database = await getDatabase();
  return transaction(async (session, handle) => {
    const events = handle.db.collection("webhookEvents");
    const identity = {
      provider: "RAZORPAY",
      mode: "test",
      accountKeyHash: config.accountKeyHash,
      deliveryKey,
    };
    const existing = await events.findOne(identity, { session });
    if (existing) {
      if (existing.rawHash !== rawHash)
        throw new Error("WEBHOOK_DELIVERY_CONFLICT");
      return { duplicate: true };
    }
    const now = new Date();
    const inserted = await events.insertOne(
      {
        ...identity,
        rawHash,
        event: event.event,
        paymentId: event.payload.payment.entity.id,
        providerOrderId: event.payload.payment.entity.order_id,
        state: "PENDING",
        receivedAt: now,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      },
      { session },
    );
    await handle.db.collection("jobs").insertOne(
      {
        kind: "PROCESS_WEBHOOK",
        businessKey: "razorpay-webhook:" + String(inserted.insertedId),
        payload: { webhookEventId: inserted.insertedId },
        state: "PENDING",
        dueAt: now,
        attempts: 0,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      },
      { session },
    );
    return { duplicate: false };
  }, database);
}

export async function processWebhookEvent(value: unknown) {
  const id =
    value instanceof ObjectId
      ? value
      : typeof value === "string" && ObjectId.isValid(value)
        ? new ObjectId(value)
        : null;
  if (!id) throw new Error("WEBHOOK_EVENT_INVALID");
  const database = await getDatabase();
  const event = await database.db
    .collection("webhookEvents")
    .findOne({ _id: id });
  if (!event) throw new Error("WEBHOOK_EVENT_INVALID");
  if (event.state === "PROCESSED") return;
  if (
    event.provider !== "RAZORPAY" ||
    event.mode !== "test" ||
    typeof event.paymentId !== "string" ||
    typeof event.providerOrderId !== "string"
  )
    throw new Error("WEBHOOK_EVENT_INVALID");
  const result = await observePayment(event.paymentId, event.providerOrderId);
  await database.db.collection("webhookEvents").updateOne(
    { _id: id, state: { $ne: "PROCESSED" } },
    {
      $set: {
        state: "PROCESSED",
        processedAt: new Date(),
        updatedAt: new Date(),
        orderNumber: result.orderNumber,
      },
      $unset: { lastErrorCode: "" },
    },
  );
}
