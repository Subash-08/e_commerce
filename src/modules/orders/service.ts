import "server-only";
import { randomUUID } from "node:crypto";
import { requirePaymentTestAdmin, paymentTestConfig } from "../payments/access";
import { ObjectId, type ClientSession, type Document } from "mongodb";
import { getDatabase } from "../../server/db/connection";
import { transaction } from "../../server/db/transaction";
import { getIdentity } from "../identity/runtime";
import { privateOwner, rateLimit } from "../cart/security";
import { checkoutFingerprint } from "../checkout/service";
import type { CheckoutQuoteDto } from "../checkout/contracts";
import type { AddressFields } from "../addresses/contracts";
import {
  placeOrderInput,
  cancelOrderInput,
  type OrderSummaryDto,
} from "./contracts";

const activeCancellationStates = ["PLACED", "CONFIRMED", "PROCESSING"];

type Attempt = {
  ownerKeyHash: string;
  idempotencyKey: string;
  payloadFingerprint: string;
  orderId: ObjectId;
  orderNumber: string;
  createdAt: Date;
};

type OrderRecord = Document & {
  _id: ObjectId;
  orderNumber: string;
  authUserId: string | null;
  ownerKeyHash: string;
  customerType: "GUEST" | "ACCOUNT";
  state: string;
  financialState: string;
  paymentMethod: "COD" | "ONLINE";
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  snapshots: {
    contact: unknown;
    shippingAddress: AddressFields;
    billingAddress: AddressFields | null;
    business: unknown;
    deliveryNote: string;
    consent: unknown;
    items: Array<{
      variantId: string;
      quantity: number;
      name: string;
      title: string;
      unitPaise: number;
      payablePaise: number;
    }>;
    coupon: CheckoutQuoteDto["coupon"];
    shipping: CheckoutQuoteDto["shipping"];
    cod: CheckoutQuoteDto["cod"];
    totals: CheckoutQuoteDto["totals"];
  };
};

function summary(order: OrderRecord): OrderSummaryDto {
  return {
    orderNumber: order.orderNumber,
    state: order.state,
    financialState: order.financialState,
    paymentMethod: order.paymentMethod,
    totalPaise: order.snapshots.totals.grandTotalPaise,
    currency: "INR",
    itemCount: order.snapshots.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    ),
    createdAt: order.createdAt.toISOString(),
    revision: order.revision,
  };
}

async function identity(headers: Headers, guestKey: string) {
  const service = await getIdentity();
  const session = await service.auth.api.getSession({ headers });
  const actor = session
    ? await service.requireAccess(headers, "profile.own", session.user.id)
    : null;
  const authUserId = actor?.authUserId ?? null;
  return {
    authUserId,
    ownerKeyHash: privateOwner(
      authUserId ? "account:" + authUserId : "guest:" + guestKey,
    ),
  };
}

async function readReplay(
  db: import("mongodb").Db,
  ownerKeyHash: string,
  idempotencyKey: string,
  payloadFingerprint: string,
) {
  const prior = await db
    .collection<Attempt>("checkoutAttempts")
    .findOne({ ownerKeyHash, idempotencyKey });
  if (!prior) return null;
  if (prior.payloadFingerprint !== payloadFingerprint)
    throw new Error("IDEMPOTENCY_CONFLICT");
  const order = await db
    .collection<OrderRecord>("orders")
    .findOne({ _id: prior.orderId });
  if (!order) throw new Error("ORDER_RECOVERY_REQUIRED");
  return { orderId: String(order._id), order: summary(order), replay: true };
}

export async function placeCodOrder(
  headers: Headers,
  guestKey: string,
  raw: unknown,
) {
  if (placeOrderInput.parse(raw).checkout.payment !== "COD")
    throw new Error("ONLINE_PAYMENT_NOT_AVAILABLE");
  return acceptOrder(headers, guestKey, raw, false);
}

export async function placeOnlineTestOrder(
  headers: Headers,
  guestKey: string,
  raw: unknown,
) {
  paymentTestConfig();
  await requirePaymentTestAdmin(headers);
  if (placeOrderInput.parse(raw).checkout.payment !== "ONLINE")
    throw new Error("INVALID_PAYMENT_METHOD");
  return acceptOrder(headers, guestKey, raw, true);
}

async function acceptOrder(
  headers: Headers,
  guestKey: string,
  raw: unknown,
  online: boolean,
) {
  const input = placeOrderInput.parse(raw);
  const paymentConfig = online ? paymentTestConfig() : null;
  const testActor = online ? await requirePaymentTestAdmin(headers) : null;
  const database = await getDatabase();
  const buyer = await identity(headers, guestKey);
  await rateLimit(database.db, "place-order:" + buyer.ownerKeyHash, 10);
  const boundCheckout = { ...input.checkout, marketingConsent: undefined };
  const requestFingerprint = checkoutFingerprint(boundCheckout);
  const payloadFingerprint = checkoutFingerprint({
    quoteId: input.quoteId,
    checkout: boundCheckout,
  });
  const replay = await readReplay(
    database.db,
    buyer.ownerKeyHash,
    input.idempotencyKey,
    payloadFingerprint,
  );
  if (replay) return replay;

  try {
    return await transaction(async (session, handle) => {
      const existing = await handle.db
        .collection<Attempt>("checkoutAttempts")
        .findOne(
          {
            ownerKeyHash: buyer.ownerKeyHash,
            idempotencyKey: input.idempotencyKey,
          },
          { session },
        );
      if (existing) {
        if (existing.payloadFingerprint !== payloadFingerprint)
          throw new Error("IDEMPOTENCY_CONFLICT");
        const order = await handle.db
          .collection<OrderRecord>("orders")
          .findOne({ _id: existing.orderId }, { session });
        if (!order) throw new Error("ORDER_RECOVERY_REQUIRED");
        return {
          orderId: String(order._id),
          order: summary(order),
          replay: true,
        };
      }
      if (
        testActor &&
        !(await handle.db.collection("profiles").findOne(
          {
            authUserId: testActor.authUserId,
            role: "ADMIN",
            status: "ACTIVE",
            authVersion: testActor.authVersion,
          },
          { session, projection: { _id: 1 } },
        ))
      )
        throw new Error("FORBIDDEN");
      const now = new Date();
      const quote = await handle.db
        .collection("checkoutQuotes")
        .findOne(
          { quoteId: input.quoteId, ownerKeyHash: buyer.ownerKeyHash },
          { session },
        );
      if (!quote) throw new Error("QUOTE_NOT_FOUND");
      if (quote.acceptedOrderId) throw new Error("QUOTE_ALREADY_ACCEPTED");
      if (!(quote.expiresAt instanceof Date) || quote.expiresAt <= now)
        throw new Error("QUOTE_EXPIRED");
      if (quote.requestFingerprint !== requestFingerprint)
        throw new Error("QUOTE_CHANGED");
      const publicQuote = quote.publicQuote as CheckoutQuoteDto;
      if (
        !online &&
        (!publicQuote.cod.eligible ||
          !publicQuote.paymentMethods.includes("COD"))
      )
        throw new Error("COD_UNAVAILABLE");
      if (online && !publicQuote.paymentMethods.includes("ONLINE"))
        throw new Error("ONLINE_PAYMENT_NOT_AVAILABLE");
      if (
        !Number.isSafeInteger(publicQuote.totals.grandTotalPaise) ||
        publicQuote.totals.grandTotalPaise < (online ? 100 : 1)
      )
        throw new Error("INVALID_CHECKOUT_TOTAL");

      if (buyer.authUserId) {
        const cart = await handle.db
          .collection("carts")
          .findOne({ authUserId: buyer.authUserId }, { session });
        if (
          !cart ||
          cart.revision !== quote.cartRevision ||
          cart.revision !== input.checkout.cartRevision
        )
          throw new Error("CART_CHANGED");
      } else if (
        quote.guestLinesHash !== checkoutFingerprint(input.checkout.guestLines)
      ) {
        throw new Error("CART_CHANGED");
      }

      const policy = await handle.db
        .collection("settings")
        .findOne({ key: "shipping" }, { session });
      if (
        !policy ||
        policy.revision !== quote.sourceRevisions.shippingPolicy ||
        (!online && !policy.cod?.enabled)
      )
        throw new Error("QUOTE_CHANGED");
      const deadlineHours = Number(policy.cod?.reservationDeadlineHours);
      const deadlineSeconds = Number(policy.onlinePaymentDeadlineSeconds);
      if (
        online
          ? !Number.isInteger(deadlineSeconds) ||
            deadlineSeconds < 900 ||
            deadlineSeconds > 1800
          : !Number.isInteger(deadlineHours) ||
            deadlineHours < 1 ||
            deadlineHours > 168
      )
        throw new Error("SHIPPING_CONFIGURATION_REQUIRED");

      const deadlineAt = new Date(
        now.getTime() +
          (online ? deadlineSeconds * 1000 : deadlineHours * 3600000),
      );
      const sourceVariants = new Map<string, number>(
        (
          quote.sourceRevisions.variants as Array<{
            id: string;
            revision: number;
          }>
        ).map((v) => [v.id, v.revision]),
      );
      const lineIds = publicQuote.items.map(
        (item) => new ObjectId(item.variantId),
      );
      const variants = await handle.db
        .collection("variants")
        .find(
          { _id: { $in: lineIds }, active: true, archived: false },
          {
            session,
            projection: {
              productId: 1,
              title: 1,
              sku: 1,
              salePaise: 1,
              mrpPaise: 1,
              priceMode: 1,
              gstRateBps: 1,
              taxPolicyKey: 1,
              trackQuantity: 1,
              stockStatus: 1,
              onHand: 1,
              reserved: 1,
              revision: 1,
            },
          },
        )
        .toArray();
      if (variants.length !== publicQuote.items.length)
        throw new Error("QUOTE_CHANGED");
      const products = await handle.db
        .collection("products")
        .countDocuments(
          { _id: { $in: variants.map((v) => v.productId) }, status: "ACTIVE" },
          { session },
        );
      if (products !== new Set(variants.map((v) => String(v.productId))).size)
        throw new Error("QUOTE_CHANGED");

      const orderId = new ObjectId();
      const reservationRows: Document[] = [];
      for (const item of publicQuote.items) {
        const variant = variants.find((v) => String(v._id) === item.variantId);
        const expectedRevision = sourceVariants.get(item.variantId);
        if (!variant || variant.revision !== expectedRevision)
          throw new Error("QUOTE_CHANGED");
        if (variant.trackQuantity) {
          const reserved = await handle.db.collection("variants").updateOne(
            {
              _id: variant._id,
              revision: expectedRevision,
              active: true,
              archived: false,
              trackQuantity: true,
              $expr: {
                $gte: [
                  { $subtract: ["$onHand", { $ifNull: ["$reserved", 0] }] },
                  item.quantity,
                ],
              },
            },
            {
              $inc: { reserved: item.quantity, revision: 1 },
              $set: { updatedAt: now },
            },
            { session },
          );
          if (!reserved.modifiedCount) throw new Error("STOCK_CHANGED");
          reservationRows.push({
            _id: new ObjectId(),
            orderId,
            variantId: variant._id,
            quantity: item.quantity,
            generation: 0,
            state: "ACTIVE",
            autoExpire: online,
            deadlineAt,
            createdAt: now,
            updatedAt: now,
            revision: 0,
            schemaVersion: 1,
          });
        } else if (variant.stockStatus !== "IN_STOCK")
          throw new Error("STOCK_CHANGED");
      }

      let couponClaim: Document | null = null;
      const couponSource = quote.sourceRevisions.coupon as {
        id: string;
        revision: number;
      } | null;
      if (publicQuote.coupon.code && publicQuote.coupon.discountPaise > 0) {
        if (!couponSource) throw new Error("QUOTE_CHANGED");
        const couponId = new ObjectId(couponSource.id);
        const coupon = await handle.db
          .collection("coupons")
          .findOne({ _id: couponId }, { session });
        if (
          !coupon ||
          coupon.revision !== couponSource.revision ||
          !coupon.active ||
          coupon.archived ||
          Date.parse(coupon.startsAt) > now.getTime() ||
          Date.parse(coupon.expiresAt) <= now.getTime()
        )
          throw new Error("COUPON_UNAVAILABLE");
        const capacity = await handle.db.collection("coupons").updateOne(
          {
            _id: couponId,
            revision: couponSource.revision,
            $or: [
              { usageLimit: null },
              { usageLimit: { $exists: false } },
              {
                $expr: {
                  $lt: [{ $ifNull: ["$claimedCount", 0] }, "$usageLimit"],
                },
              },
            ],
          },
          { $inc: { claimedCount: 1 } },
          { session },
        );
        if (!capacity.modifiedCount) throw new Error("COUPON_UNAVAILABLE");
        if (coupon.perAccountLimit != null) {
          if (!buyer.authUserId) throw new Error("COUPON_UNAVAILABLE");
          const usage = await handle.db
            .collection("couponAccountUsage")
            .findOne({ couponId, authUserId: buyer.authUserId }, { session });
          if ((usage?.count ?? 0) >= coupon.perAccountLimit)
            throw new Error("COUPON_UNAVAILABLE");
          await handle.db.collection("couponAccountUsage").updateOne(
            {
              couponId,
              authUserId: buyer.authUserId,
              count: usage?.count ?? 0,
            },
            {
              $setOnInsert: { _id: new ObjectId(), createdAt: now },
              $set: { updatedAt: now },
              $inc: { count: 1 },
            },
            { session, upsert: true },
          );
        }
        couponClaim = {
          _id: new ObjectId(),
          orderId,
          couponId,
          authUserId: buyer.authUserId,
          code: coupon.code,
          discountPaise: publicQuote.coupon.discountPaise,
          generation: 0,
          state: online ? "HELD" : "CONSUMED",
          createdAt: now,
          updatedAt: now,
          revision: 0,
          schemaVersion: 1,
        };
      }

      const year = now.getUTCFullYear();
      const counter = await handle.db
        .collection<{ _id: string; value: number }>("counters")
        .findOneAndUpdate(
          { _id: "order:" + year },
          {
            $inc: { value: 1 },
            $setOnInsert: { schemaVersion: 1, createdAt: now },
            $set: { updatedAt: now },
          },
          { session, upsert: true, returnDocument: "after" },
        );
      if (
        !counter ||
        !Number.isSafeInteger(counter.value) ||
        counter.value < 1 ||
        counter.value > 999999
      )
        throw new Error("ORDER_NUMBER_EXHAUSTED");
      const orderNumber = `ORD-${year}-${String(counter.value).padStart(6, "0")}`;
      const order: OrderRecord = {
        _id: orderId,
        orderNumber,
        authUserId: buyer.authUserId,
        ownerKeyHash: buyer.ownerKeyHash,
        customerType: buyer.authUserId ? "ACCOUNT" : "GUEST",
        state: online ? "PENDING_PAYMENT" : "PLACED",
        financialState: "PENDING",
        fulfillmentException: "NONE",
        paymentMethod: online ? "ONLINE" : "COD",
        quoteId: input.quoteId,
        ...(online
          ? {
              paymentDeadlineAt: deadlineAt,
              testOnly: true,
              acceptedCartRevision: quote.cartRevision,
              acceptedGuestLinesHash: quote.guestLinesHash,
            }
          : { codReviewAt: deadlineAt }),
        snapshots: {
          contact: input.checkout.contact,
          shippingAddress: input.checkout.shippingAddress,
          billingAddress: input.checkout.billingSameAsShipping
            ? input.checkout.shippingAddress
            : input.checkout.billingAddress,
          business: input.checkout.business,
          deliveryNote: input.checkout.deliveryNote,
          consent: {
            ...input.checkout.legal,
            acceptedAt: now,
            marketing: input.checkout.marketingConsent,
          },
          items: publicQuote.items.map((item) => ({
            variantId: item.variantId,
            trackQuantity: variants.find(v => String(v._id) === item.variantId)?.trackQuantity === true,
            quantity: item.quantity,
            name: item.name,
            title: item.title,
            unitPaise: item.unitPaise,
            payablePaise: item.payablePaise,
          })),
          coupon: publicQuote.coupon,
          shipping: publicQuote.shipping,
          cod: publicQuote.cod,
          totals: publicQuote.totals,
        },
        statusHistory: [
          {
            from: null,
            to: online ? "PENDING_PAYMENT" : "PLACED",
            reason: online
              ? "Online test order accepted"
              : "COD order accepted",
            actorType: "CUSTOMER",
            actorId: buyer.authUserId,
            at: now,
          },
        ],
        revision: 0,
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      };
      // Serialize quote consumption even when different idempotency keys race.
      const consumed = await handle.db
        .collection("checkoutQuotes")
        .updateOne(
          { _id: quote._id, acceptedOrderId: { $exists: false } },
          { $set: { acceptedOrderId: orderId, acceptedAt: now } },
          { session },
        );
      if (!consumed.modifiedCount) throw new Error("QUOTE_ALREADY_ACCEPTED");
      await handle.db
        .collection<OrderRecord>("orders")
        .insertOne(order, { session });
      if (online && paymentConfig)
        await handle.db.collection("paymentBindings").insertOne(
          {
            orderId,
            orderNumber,
            provider: "RAZORPAY",
            mode: "test",
            accountKeyHash: paymentConfig.accountKeyHash,
            operationId: randomUUID(),
            generation: 0,
            active: true,
            receipt: orderNumber,
            amountPaise: publicQuote.totals.grandTotalPaise,
            currency: "INR",
            state: "NOT_STARTED",
            attempts: 0,
            recoveryAttempts: 0,
            revision: 0,
            deadlineAt,
            createdAt: now,
            updatedAt: now,
            schemaVersion: 1,
          },
          { session },
        );
      for (const reservation of reservationRows)
        await handle.db
          .collection("reservations")
          .insertOne(reservation, { session });
      if (couponClaim)
        await handle.db
          .collection("couponClaims")
          .insertOne(couponClaim, { session });
      await handle.db.collection<Attempt>("checkoutAttempts").insertOne(
        {
          ownerKeyHash: buyer.ownerKeyHash,
          idempotencyKey: input.idempotencyKey,
          payloadFingerprint,
          orderId,
          orderNumber,
          createdAt: now,
        },
        { session },
      );
      if (!online)
        await handle.db.collection("jobs").insertOne(
          {
            _id: new ObjectId(),
            kind: "SEND_NOTIFICATION",
            businessKey: "order-confirmed:" + orderId,
            state: "PENDING",
            dueAt: now,
            attempts: 0,
            payload: { notification: "ORDER_CONFIRMATION", orderId },
            createdAt: now,
            updatedAt: now,
            schemaVersion: 1,
          },
          { session },
        );
      await handle.db.collection("auditLogs").insertOne(
        {
          actorType: buyer.authUserId ? "ACCOUNT" : "GUEST",
          actorId: buyer.authUserId,
          action: online ? "ONLINE_ORDER_ACCEPTED" : "ORDER_PLACED",
          entityType: "order",
          entityId: String(orderId),
          before: null,
          after: {
            orderNumber,
            state: order.state,
            paymentMethod: order.paymentMethod,
            totalPaise: publicQuote.totals.grandTotalPaise,
          },
          occurredAt: now,
          createdAt: now,
          schemaVersion: 1,
        },
        { session },
      );
      if (buyer.authUserId && !online) {
        const cleared = await handle.db
          .collection("carts")
          .updateOne(
            { authUserId: buyer.authUserId, revision: quote.cartRevision },
            { $set: { items: [], updatedAt: now }, $inc: { revision: 1 } },
            { session },
          );
        if (!cleared.modifiedCount) throw new Error("CART_CHANGED");
      }
      return { orderId: String(orderId), order: summary(order), replay: false };
    }, database);
  } catch (error) {
    const recovered = await readReplay(
      database.db,
      buyer.ownerKeyHash,
      input.idempotencyKey,
      payloadFingerprint,
    );
    if (recovered) return recovered;
    throw error;
  }
}

export async function listAccountOrders(headers: Headers) {
  const service = await getIdentity();
  const session = await service.auth.api.getSession({ headers });
  if (!session) throw new Error("AUTH_REQUIRED");
  const actor = await service.requireAccess(
    headers,
    "profile.own",
    session.user.id,
  );
  const database = await getDatabase();
  const rows = await database.db
    .collection<OrderRecord>("orders")
    .find(
      { authUserId: actor.authUserId },
      {
        sort: { createdAt: -1 },
        limit: 50,
        projection: {
          snapshots: 1,
          orderNumber: 1,
          state: 1,
          financialState: 1,
          paymentMethod: 1,
          createdAt: 1,
          revision: 1,
        },
      },
    )
    .toArray();
  return rows.map(summary);
}

export async function readOwnedOrder(
  headers: Headers,
  orderNumber: string,
  guestGrant?: string,
) {
  const database = await getDatabase();
  const order = await database.db
    .collection<OrderRecord>("orders")
    .findOne({ orderNumber });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  const service = await getIdentity();
  const session = await service.auth.api.getSession({ headers });
  if (session) {
    const actor = await service.requireAccess(
      headers,
      "profile.own",
      session.user.id,
    );
    if (order.authUserId !== actor.authUserId)
      throw new Error("ORDER_NOT_FOUND");
  } else {
    const { verifyTicket } = await import("../cart/security");
    if (!guestGrant) throw new Error("ORDER_NOT_FOUND");
    verifyTicket(guestGrant, "guest-order:" + order._id);
  }
  return { ...summary(order), snapshots: order.snapshots };
}

export async function cancelOwnedOrder(
  headers: Headers,
  guestGrant: string | undefined,
  raw: unknown,
) {
  const input = cancelOrderInput.parse(raw);
  const database = await getDatabase();
  const order = await database.db
    .collection<OrderRecord>("orders")
    .findOne({ orderNumber: input.orderNumber });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  const service = await getIdentity();
  const authSession = await service.auth.api.getSession({ headers });
  let actorId: string | null = null;
  if (authSession) {
    const actor = await service.requireAccess(
      headers,
      "profile.own",
      authSession.user.id,
    );
    actorId = actor.authUserId;
    if (order.authUserId !== actorId) throw new Error("ORDER_NOT_FOUND");
  } else {
    const { verifyTicket } = await import("../cart/security");
    if (!guestGrant) throw new Error("ORDER_NOT_FOUND");
    verifyTicket(guestGrant, "guest-order:" + order._id);
  }
  await rateLimit(database.db, "cancel-order:" + order.ownerKeyHash, 10);
  return transaction(
    async (session) =>
      cancelInTransaction(
        database.db,
        session,
        order._id,
        input.expectedRevision,
        input.reason,
        actorId,
      ),
    database,
  );
}

export async function cancelInTransaction(
  db: import("mongodb").Db,
  session: ClientSession,
  orderId: ObjectId,
  expectedRevision: number,
  reason: string,
  actorId: string | null,
  testCleanup = false,
) {
  const allowedStates = testCleanup
    ? ["PENDING_PAYMENT"]
    : activeCancellationStates;
  const current = await db
    .collection<OrderRecord>("orders")
    .findOne({ _id: orderId }, { session });
  if (!current) throw new Error("ORDER_NOT_FOUND");
  if (current.revision !== expectedRevision)
    throw new Error("REVISION_CONFLICT");
  if (!testCleanup && current.paymentMethod !== "COD")
    throw new Error("ORDER_CANNOT_CANCEL");
  if (testCleanup && (!current.testOnly || current.paymentMethod !== "ONLINE"))
    throw new Error("PAYMENT_TEST_ONLY");
  if (!allowedStates.includes(current.state))
    throw new Error("ORDER_CANNOT_CANCEL");
  const now = new Date();
  const reservations = await db
    .collection("reservations")
    .find({ orderId, state: "ACTIVE" }, { session })
    .toArray();
  for (const reservation of reservations) {
    const released = await db.collection("variants").updateOne(
      {
        _id: reservation.variantId,
        reserved: { $gte: reservation.quantity },
      },
      {
        $inc: { reserved: -reservation.quantity, revision: 1 },
        $set: { updatedAt: now },
      },
      { session },
    );
    if (!released.modifiedCount) throw new Error("RESERVATION_INCONSISTENT");
    await db.collection("reservations").updateOne(
      { _id: reservation._id, state: "ACTIVE" },
      {
        $set: { state: "RELEASED", updatedAt: now, releaseReason: reason },
        $inc: { revision: 1 },
      },
      { session },
    );
  }
  const claim = await db
    .collection("couponClaims")
    .findOne(
      { orderId, state: testCleanup ? "HELD" : "CONSUMED" },
      { session },
    );
  if (claim) {
    const changed = await db.collection("couponClaims").updateOne(
      { _id: claim._id, state: claim.state },
      {
        $set: { state: "RELEASED", updatedAt: now, releaseReason: reason },
        $inc: { revision: 1 },
      },
      { session },
    );
    if (changed.modifiedCount) {
      await db
        .collection("coupons")
        .updateOne(
          { _id: claim.couponId, claimedCount: { $gte: 1 } },
          { $inc: { claimedCount: -1 } },
          { session },
        );
      if (claim.authUserId)
        await db.collection("couponAccountUsage").updateOne(
          {
            couponId: claim.couponId,
            authUserId: claim.authUserId,
            count: { $gte: 1 },
          },
          { $inc: { count: -1 }, $set: { updatedAt: now } },
          { session },
        );
    }
  }
  const changed = await db.collection("orders").updateOne(
    {
      _id: orderId,
      revision: expectedRevision,
      state: { $in: allowedStates },
    },
    {
      $set: {
        state: "CANCELLED",
        updatedAt: now,
        statusHistory: [
          ...current.statusHistory,
          {
            from: current.state,
            to: "CANCELLED",
            reason,
            actorType: actorId ? "ACCOUNT" : "GUEST",
            actorId,
            at: now,
          },
        ],
      },
      $inc: { revision: 1 },
    },
    { session },
  );
  if (!changed.modifiedCount) throw new Error("REVISION_CONFLICT");
  await db.collection("auditLogs").insertOne(
    {
      actorType: actorId ? "ACCOUNT" : "GUEST",
      actorId,
      action: "ORDER_CANCELLED",
      entityType: "order",
      entityId: String(orderId),
      before: { state: current.state, revision: current.revision },
      after: { state: "CANCELLED", revision: current.revision + 1, reason },
      occurredAt: now,
      createdAt: now,
      schemaVersion: 1,
    },
    { session },
  );
  return {
    orderNumber: current.orderNumber,
    state: "CANCELLED",
    revision: current.revision + 1,
  };
}

export async function listAdminOrders(headers: Headers, state?: string) {
  const actor = await (
    await getIdentity()
  ).requireAccess(headers, "settings.manage");
  const database = await getDatabase();
  const profile = await database.db.collection("profiles").findOne({
    authUserId: actor.authUserId,
    role: "ADMIN",
    status: "ACTIVE",
    authVersion: actor.authVersion,
  });
  if (!profile) throw new Error("FORBIDDEN");
  const allowed = [
    "PENDING_PAYMENT",
    "EXPIRED",
    "PLACED",
    "CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
  ];
  const filter: Document =
    state === "OVERDUE"
      ? {
          paymentMethod: "COD",
          state: { $in: activeCancellationStates },
          codReviewAt: { $lte: new Date() },
        }
      : state && allowed.includes(state)
        ? { state }
        : {};
  const rows = await database.db
    .collection<OrderRecord>("orders")
    .find(filter, { sort: { createdAt: -1 }, limit: 100 })
    .toArray();
  return rows.map((order) => ({
    ...summary(order),
    customerType: order.customerType,
    customerName: String(
      (order.snapshots.contact as { name?: unknown })?.name ?? "Customer",
    ),
    customerEmail: String(
      (order.snapshots.contact as { email?: unknown })?.email ?? "",
    ),
    codReviewAt:
      order.codReviewAt instanceof Date
        ? order.codReviewAt.toISOString()
        : null,
  }));
}

export async function readAdminOrder(headers: Headers, orderNumber: string) {
  const actor = await (
    await getIdentity()
  ).requireAccess(headers, "settings.manage");
  const database = await getDatabase();
  const profile = await database.db.collection("profiles").findOne({
    authUserId: actor.authUserId,
    role: "ADMIN",
    status: "ACTIVE",
    authVersion: actor.authVersion,
  });
  if (!profile) throw new Error("FORBIDDEN");
  const order = await database.db
    .collection<OrderRecord>("orders")
    .findOne({ orderNumber });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  return {
    ...summary(order),
    snapshots: order.snapshots,
    customerType: order.customerType,
    codReviewAt:
      order.codReviewAt instanceof Date
        ? order.codReviewAt.toISOString()
        : null,
  };
}

export async function cancelAdminOrder(headers: Headers, raw: unknown) {
  const input = cancelOrderInput.parse(raw);
  const actor = await (
    await getIdentity()
  ).requireAccess(headers, "settings.manage");
  const database = await getDatabase();
  await rateLimit(database.db, "admin-cancel-order:" + actor.authUserId, 30);
  return transaction(async (session) => {
    const profile = await database.db.collection("profiles").findOne(
      {
        authUserId: actor.authUserId,
        role: "ADMIN",
        status: "ACTIVE",
        authVersion: actor.authVersion,
      },
      { session },
    );
    if (!profile) throw new Error("FORBIDDEN");
    const order = await database.db
      .collection<OrderRecord>("orders")
      .findOne({ orderNumber: input.orderNumber }, { session });
    if (!order) throw new Error("ORDER_NOT_FOUND");
    return cancelInTransaction(
      database.db,
      session,
      order._id,
      input.expectedRevision,
      input.reason,
      actor.authUserId,
    );
  }, database);
}
