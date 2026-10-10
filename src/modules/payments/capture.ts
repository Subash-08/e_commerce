import "server-only";
import { ObjectId } from "mongodb";
import { getDatabase } from "../../server/db/connection";
import { transaction } from "../../server/db/transaction";
import { paymentTestConfig } from "./access";
import { fetchProviderPayment } from "./provider";
import { transitionPayment, financialSummary } from "./state";
import type { PaymentAttempt } from "./state";

// Called only with provider evidence fetched here; browser amounts never enter the transition.
export async function observePayment(paymentId: string, expectedProviderOrderId?: string) {
  const config = paymentTestConfig();
  const payment = await fetchProviderPayment(paymentId);
  if (expectedProviderOrderId && payment.order_id !== expectedProviderOrderId) throw new Error("PAYMENT_BINDING_MISMATCH");
  const database = await getDatabase();
  return transaction(async (session, handle) => {
    const db = handle.db;
    const binding = await db.collection("paymentBindings").findOne({ provider: "RAZORPAY", mode: "test", accountKeyHash: config.accountKeyHash, providerOrderId: payment.order_id }, { session });
    if (!binding) throw new Error("PAYMENT_BINDING_PENDING");
    const order = await db.collection("orders").findOne({ _id: binding.orderId, paymentMethod: "ONLINE", testOnly: true }, { session });
    if (!order) throw new Error("ORDER_NOT_FOUND");
    const now = new Date();
    // All observations, including different payment IDs, serialize on the same order.
    const locked = await db.collection("orders").updateOne({ _id: order._id, revision: order.revision }, { $inc: { revision: 1 }, $set: { updatedAt: now } }, { session });
    if (!locked.modifiedCount) throw new Error("REVISION_CONFLICT");
    const identity = { provider: "RAZORPAY", mode: "test", accountKeyHash: config.accountKeyHash, providerPaymentId: payment.id };
    const prior = await db.collection("payments").findOne(identity, { session });
    if (prior && (!prior.orderId.equals(order._id) || prior.amountPaise !== payment.amount || prior.currency !== payment.currency)) throw new Error("PAYMENT_PROOF_MISMATCH");
    const captured = payment.captured && ["captured", "refunded"].includes(payment.status);
    const state = captured ? "CAPTURED" : payment.status === "authorized" ? "AUTHORIZED" : payment.status === "failed" ? "FAILED" : "PENDING";
    const priorState = prior?.state ?? "PENDING";
    const advance = priorState !== "CAPTURED" && (state === "CAPTURED" || priorState === "PENDING" || (priorState === "AUTHORIZED" && state === "FAILED"));
    let version = { revision: prior?.revision ?? 0, history: prior?.history ?? [] };
    if (advance && state !== priorState && payment.currency === "INR") {
      const result = transitionPayment({ ...version, provider: "RAZORPAY", providerPaymentId: payment.id,
        amountPaise: payment.amount, currency: "INR", state: priorState } as PaymentAttempt,
        { provider: "RAZORPAY", providerPaymentId: payment.id, amountPaise: payment.amount, currency: payment.currency, state, verified: true },
        { operationId: payment.id + ":" + state, expectedRevision: version.revision, actorId: "razorpay", reason: "Verified provider observation", at: now.getTime(), authorized: true });
      version = { revision: result.attempt.revision, history: [...result.attempt.history] };
    }
    const finalState = advance ? state : priorState;
    await db.collection("payments").updateOne(identity, { $setOnInsert: { _id: new ObjectId(), orderId: order._id, createdAt: now, schemaVersion: 1 },
      $set: { ...version, providerOrderId: payment.order_id, amountPaise: payment.amount, currency: payment.currency,
        state: finalState, method: payment.method, verifiedAt: now, updatedAt: now,
        refundedEvidencePaise: Math.max(prior?.refundedEvidencePaise ?? 0, payment.amount_refunded),
        ...(finalState === "CAPTURED" ? { capturedAt: prior?.capturedAt ?? now } : {}) } }, { session, upsert: true });
    const totals = await db.collection("payments").aggregate([
      { $match: { orderId: order._id, state: "CAPTURED" } },
      { $group: { _id: null, capturedPaise: { $sum: { $cond: [{ $eq: ["$currency", "INR"] }, "$amountPaise", 0] } },
        invalidCurrency: { $max: { $cond: [{ $eq: ["$currency", "INR"] }, 0, 1] } },
        refundEvidence: { $sum: "$refundedEvidencePaise" } } },
    ], { session }).toArray();
    const total = totals[0]?.capturedPaise ?? 0;
    const financial = financialSummary(order.snapshots.totals.grandTotalPaise, total, 0);
    let exception = order.fulfillmentException ?? "NONE";
    const mismatch = payment.currency !== "INR" || payment.amount !== binding.amountPaise || binding.amountPaise !== order.snapshots.totals.grandTotalPaise;
    if (mismatch || financial.exception !== "NONE" || totals[0]?.invalidCurrency || totals[0]?.refundEvidence) exception = "REVIEW_REQUIRED";
    const newCapture = finalState === "CAPTURED" && priorState !== "CAPTURED";
    const overdue = !(order.paymentDeadlineAt instanceof Date) || order.paymentDeadlineAt <= now;
    if (newCapture && (overdue || ["CANCELLED", "EXPIRED"].includes(order.state))) exception = "REFUND_REQUIRED";
    let placed = false;
    let cartPreserved = order.cartPreserved ?? false;
    if (newCapture && financial.fulfillmentEligible && exception === "NONE" && order.state === "PENDING_PAYMENT" && binding.active) {
      const holds = await db.collection("reservations").find({ orderId: order._id, state: "ACTIVE" }, { session }).toArray();
      const expected = order.snapshots.items.filter((line: { trackQuantity?: boolean }) => line.trackQuantity === true);
      const variants = await db.collection("variants").find({ _id: { $in: order.snapshots.items.map((line: { variantId: string }) => new ObjectId(line.variantId)) } }, { session, projection: { trackQuantity: 1, onHand: 1, reserved: 1, active: 1, archived: 1, stockStatus: 1 } }).toArray();
      const stocksValid = variants.length === order.snapshots.items.length && holds.length === expected.length && order.snapshots.items.every((line: { variantId: string; quantity: number; trackQuantity?: boolean }) => {
        const variant = variants.find(v => String(v._id) === line.variantId);
        if (!variant || !variant.active || variant.archived) return false;
        if (line.trackQuantity !== true) return line.trackQuantity === false && !variant.trackQuantity && variant.stockStatus === "IN_STOCK";
        const hold = holds.find(h => String(h.variantId) === line.variantId);
        return !!hold && hold.quantity === line.quantity && hold.deadlineAt > now && variant.trackQuantity && variant.onHand >= line.quantity && variant.reserved >= line.quantity;
      });
      const claim = await db.collection("couponClaims").findOne({ orderId: order._id, state: "HELD" }, { session });
      if (!stocksValid || (order.snapshots.coupon.discountPaise > 0 && !claim)) exception = "REVIEW_REQUIRED";
      else {
        for (const hold of holds) {
          const changed = await db.collection("variants").updateOne({ _id: hold.variantId, onHand: { $gte: hold.quantity }, reserved: { $gte: hold.quantity } }, { $inc: { onHand: -hold.quantity, reserved: -hold.quantity, revision: 1 }, $set: { updatedAt: now } }, { session });
          if (!changed.modifiedCount) throw new Error("RESERVATION_INCONSISTENT");
          await db.collection("reservations").updateOne({ _id: hold._id, state: "ACTIVE" }, { $set: { state: "CONSUMED", updatedAt: now }, $inc: { revision: 1 } }, { session });
        }
        if (claim) await db.collection("couponClaims").updateOne({ _id: claim._id, state: "HELD" }, { $set: { state: "CONSUMED", updatedAt: now }, $inc: { revision: 1 } }, { session });
        placed = true;
        if (order.authUserId) {
          const cleared = await db.collection("carts").updateOne({ authUserId: order.authUserId, revision: order.acceptedCartRevision }, { $set: { items: [], updatedAt: now }, $inc: { revision: 1 } }, { session });
          cartPreserved = cleared.modifiedCount !== 1;
        }
        for (const job of [
          { kind: "SEND_NOTIFICATION", businessKey: "order-confirmed:" + order._id, payload: { notification: "ORDER_CONFIRMATION", orderId: order._id } },
          { kind: "INVALIDATE_PUBLIC_CACHE", businessKey: "product:payment:" + order._id, payload: { tags: ["catalog"], paths: [] } },
        ]) await db.collection("jobs").insertOne({ ...job, state: "PENDING", dueAt: now, attempts: 0, createdAt: now, updatedAt: now, schemaVersion: 1 }, { session });
      }
    }
    await db.collection("orders").updateOne({ _id: order._id, revision: order.revision + 1 }, { $set: {
      financialState: financial.state, fulfillmentException: exception, capturedPaise: total, cartPreserved,
      ...(placed ? { state: "PLACED" } : {}),
    }, ...(placed ? { $push: { statusHistory: { from: order.state, to: "PLACED", reason: "Verified payment capture", actorType: "PROVIDER", actorId: "razorpay", at: now } } } : {}) }, { session });
    if (!prior || priorState !== finalState || exception !== order.fulfillmentException)
      await db.collection("auditLogs").insertOne({ action: "PAYMENT_OBSERVED", entityType: "order", entityId: String(order._id), actorType: "PROVIDER", actorId: "razorpay", before: { financialState: order.financialState, state: order.state }, after: { state: placed ? "PLACED" : order.state, financialState: financial.state, exception }, occurredAt: now, createdAt: now, schemaVersion: 1 }, { session });
    return { orderNumber: order.orderNumber, state: placed ? "PLACED" : order.state, financialState: financial.state, exception, cartPreserved };
  }, database);
}
