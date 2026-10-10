import "server-only";
import { getDatabase } from "../../server/db/connection";
import { paymentTestConfig, requirePaymentTestAdmin } from "./access";
import { bindingRepository } from "./repository";
import { razorpayOrders } from "./provider";
import { rateLimit } from "../cart/security";
import { verifyCheckoutSignature } from "./proof";
import { observePayment } from "./capture";

const orderNumberPattern = /^ORD-[0-9]{4}-[0-9]{6}$/;

export async function prepareTestCheckout(
  headers: Headers,
  orderNumber: string,
) {
  if (!orderNumberPattern.test(orderNumber)) throw new Error("ORDER_NOT_FOUND");
  const actor = await requirePaymentTestAdmin(headers);
  const database = await getDatabase();
  await rateLimit(database.db, "payment-checkout:" + actor.authUserId, 12);
  const order = await database.db.collection("orders").findOne({
    orderNumber,
    paymentMethod: "ONLINE",
    testOnly: true,
    state: "PENDING_PAYMENT",
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  const repo = bindingRepository(database.db);
  const binding = await repo.read(order._id);
  const config = paymentTestConfig();
  if (
    !binding ||
    binding.state !== "BOUND" ||
    !binding.providerOrderId ||
    binding.mode !== "test" ||
    binding.accountKeyHash !== config.accountKeyHash ||
    binding.deadlineAt.getTime() - Date.now() < 60000
  )
    throw new Error("PAYMENT_NOT_READY");

  // Fetch before writing. Provider I/O never happens inside an Atlas transaction.
  const remote = await razorpayOrders().fetch(binding.providerOrderId);
  if (
    remote.id !== binding.providerOrderId ||
    remote.receipt !== binding.receipt ||
    remote.currency !== "INR" ||
    remote.amount !== binding.amountPaise ||
    remote.notes.commerceOperation !== binding.operationId ||
    remote.notes.commerceOrder !== String(order._id) ||
    remote.status === "paid"
  )
    throw new Error("PAYMENT_ACTIVITY_REVIEW_REQUIRED");

  // Once checkout details leave the server, the old 2B.1 test cleanup path is forbidden.
  const marked = await repo.rows.updateOne(
    {
      _id: binding._id,
      active: true,
      state: "BOUND",
      revision: binding.revision,
      providerOrderId: binding.providerOrderId,
    },
    {
      $set: { checkoutExposedAt: new Date(), updatedAt: new Date() },
      $inc: { revision: 1 },
    },
  );
  if (!marked.modifiedCount) {
    const current = await repo.read(order._id);
    if (
      !current?.checkoutExposedAt ||
      current.providerOrderId !== binding.providerOrderId
    )
      throw new Error("PAYMENT_NOT_READY");
  }
  return {
    keyId: config.keyId,
    providerOrderId: binding.providerOrderId,
    orderNumber: order.orderNumber,
    amountPaise: binding.amountPaise,
    currency: "INR" as const,
    expiresAt: binding.deadlineAt.toISOString(),
  };
}

export async function verifyTestCheckoutCallback(
  headers: Headers,
  input: { orderNumber: string; paymentId: string; signature: string },
) {
  if (!orderNumberPattern.test(input.orderNumber))
    throw new Error("ORDER_NOT_FOUND");
  const actor = await requirePaymentTestAdmin(headers);
  const database = await getDatabase();
  await rateLimit(database.db, "payment-callback:" + actor.authUserId, 20);
  const order = await database.db.collection("orders").findOne({
    orderNumber: input.orderNumber,
    paymentMethod: "ONLINE",
    testOnly: true,
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  const binding = await bindingRepository(database.db).read(order._id);
  if (
    !binding?.providerOrderId ||
    binding.mode !== "test" ||
    binding.accountKeyHash !== paymentTestConfig().accountKeyHash
  )
    throw new Error("PAYMENT_BINDING_PENDING");
  verifyCheckoutSignature(
    binding.providerOrderId,
    input.paymentId,
    input.signature,
    paymentTestConfig().keySecret,
  );
  return observePayment(input.paymentId, binding.providerOrderId);
}
