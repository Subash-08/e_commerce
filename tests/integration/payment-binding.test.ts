import { randomInt } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import type { DatabaseHandle } from "../../src/server/db/connection";
import {
  createTestDatabaseContext,
  type TestDatabaseContext,
} from "../fixtures/db-harness";
import { applyIndexes } from "../../src/server/db/indexes";
import { checkoutIndexes } from "../../src/modules/checkout/indexes";
import { couponIndexes } from "../../src/modules/coupons/indexes";
import { orderIndexes } from "../../src/modules/orders/indexes";

const state = vi.hoisted(() => ({
  database: undefined as DatabaseHandle | undefined,
  realProvider: false,
  creates: 0,
  failCreate: false,
  remote: undefined as
    import("../../src/modules/payments/provider").ProviderOrder | undefined,
}));
vi.mock("../../src/server/db/connection", async (original) => ({
  ...(await original<typeof import("../../src/server/db/connection")>()),
  getDatabase: async () => state.database!,
}));
vi.mock("../../src/modules/identity/runtime", () => ({
  getIdentity: async () => ({
    auth: {
      api: { getSession: async () => ({ user: { id: "payment-test-admin" } }) },
    },
    requireAccess: async () => ({
      authUserId: "payment-test-admin",
      authVersion: 1,
    }),
  }),
}));

vi.mock("../../src/modules/payments/provider", async (original) => {
  const actual =
    await original<typeof import("../../src/modules/payments/provider")>();
  return {
    ...actual,
    razorpayOrders: () =>
      state.realProvider
        ? actual.razorpayOrders()
        : {
            create: async (input: {
              receipt: string;
              amountPaise: number;
              operationId: string;
              orderId: string;
            }) => {
              state.creates++;
              state.remote = {
                id: "order_" + input.orderId,
                receipt: input.receipt,
                amount: input.amountPaise,
                amount_paid: 0,
                amount_due: input.amountPaise,
                currency: "INR",
                attempts: 0,
                status: "created",
                notes: {
                  commerceOperation: input.operationId,
                  commerceOrder: input.orderId,
                },
              };
              if (state.failCreate)
                throw new Error("provider timed out with private details");
              return state.remote;
            },
            lookup: async () => (state.remote ? [state.remote] : []),
            fetch: async () => state.remote!,
          },
  };
});
import { bindTestOrder } from "../../src/modules/payments/binding";
import { cleanupTestOrder } from "../../src/modules/payments/cleanup";
import { paymentBindingIndexes } from "../../src/modules/payments/indexes";
import { bindingRepository } from "../../src/modules/payments/repository";
import { checkoutQuoteInput } from "../../src/modules/checkout/contracts";
import { legalPolicyVersions } from "../../src/modules/checkout/legal";
import { checkoutFingerprint } from "../../src/modules/checkout/service";
import { privateOwner } from "../../src/modules/cart/security";
import { placeOnlineTestOrder } from "../../src/modules/orders/service";

describe("Online binding Atlas invariants", () => {
  let context: TestDatabaseContext;
  let product: ObjectId;
  let variant: ObjectId;
  let coupon: ObjectId;
  const guestLine = () => ({
    productId: String(product),
    variantId: String(variant),
    quantity: 1,
  });
  const checkout = () =>
    checkoutQuoteInput.parse({
      contact: {
        name: "Order Buyer",
        email: "buyer@example.com",
        mobile: "9876543210",
      },
      shippingAddress: {
        name: "Order Buyer",
        mobile: "9876543210",
        line1: "10 Test Street",
        line2: "",
        landmark: "",
        city: "Chennai",
        district: "Chennai",
        stateCode: "TN",
        postalCode: "600001",
        countryCode: "IN",
      },
      billingSameAsShipping: true,
      billingAddress: null,
      business: { legalName: "", gstin: "" },
      deliveryNote: "",
      payment: "ONLINE",
      coupon: "BINDINGTEST",
      legal: {
        termsVersion: legalPolicyVersions.terms,
        privacyVersion: legalPolicyVersions.privacy,
        accepted: true,
      },
      marketingConsent: false,
      guestLines: [guestLine()],
      cartRevision: 0,
    });

  async function quote() {
    const db = state.database!.db;
    const input = checkout();
    const row = await db.collection("variants").findOne({ _id: variant });
    const quoteId = crypto.randomUUID();
    const now = new Date();
    await db.collection("checkoutQuotes").insertOne({
      quoteId,
      ownerKeyHash: privateOwner("account:payment-test-admin"),
      requestFingerprint: checkoutFingerprint({
        ...input,
        marketingConsent: undefined,
      }),
      cartRevision: 0,
      guestLinesHash: checkoutFingerprint(input.guestLines),
      sourceRevisions: {
        variants: [{ id: String(variant), revision: row!.revision }],
        coupon: { id: String(coupon), revision: 0 },
        shippingPolicy: 1,
        legalPolicyVersions: {
          terms: input.legal.termsVersion,
          privacy: input.legal.privacyVersion,
        },
        taxPolicyKeys: ["tax-fixture"],
      },
      publicQuote: {
        quoteId,
        expiresAt: new Date(now.getTime() + 600000).toISOString(),
        currency: "INR",
        cartRevision: 0,
        items: [
          {
            ...guestLine(),
            name: "Fixture product",
            title: "Fixture variant",
            unitPaise: 11800,
            payablePaise: 11800,
            url: "/product/fixture/one",
            image: null,
          },
        ],
        coupon: { code: "BINDINGTEST", discountPaise: 100, message: null },
        shipping: {
          chargePaise: 0,
          taxPaise: 0,
          waiverPaise: 0,
          couponWaiverPaise: 0,
          automaticFree: true,
          remainingPaise: null,
        },
        cod: { eligible: true, chargePaise: 0, taxPaise: 0 },
        totals: {
          goodsPaise: 11800,
          discountPaise: 100,
          goodsTaxPaise: 1800,
          deliveryPaise: 0,
          grandTotalPaise: 11700,
        },
        paymentMethods: ["ONLINE", "COD"],
        notices: [],
      },
      expiresAt: new Date(now.getTime() + 600000),
      createdAt: now,
      schemaVersion: 1,
    });
    return { quoteId, checkout: input };
  }

  beforeAll(async () => {
    context = await createTestDatabaseContext("paymentbindings");
    for (const name of [
      "paymentBindings",
      "profiles",
      "orders",
      "checkoutAttempts",
      "reservations",
      "couponClaims",
      "couponAccountUsage",
      "coupons",
      "counters",
      "jobs",
      "auditLogs",
      "checkoutQuotes",
      "commerceRateLimits",
      "settings",
      "products",
      "variants",
      "carts",
    ])
      await context.createCollection(name);
    state.database = await context.createOwner().get();
    await applyIndexes(
      state.database.db,
      [
        ...checkoutIndexes,
        ...couponIndexes,
        ...orderIndexes,
        ...paymentBindingIndexes,
      ],
      { dryRun: false },
    );
    await state.database.db.collection("profiles").insertOne({
      authUserId: "payment-test-admin",
      role: "ADMIN",
      status: "ACTIVE",
      authVersion: 1,
    });
    await state.database.db.collection("carts").insertOne({
      authUserId: "payment-test-admin",
      revision: 0,
      items: [{ marker: "preserve" }],
    });
    coupon = new ObjectId();
    await state.database.db.collection("coupons").insertOne({
      _id: coupon,
      code: "BINDINGTEST",
      revision: 0,
      active: true,
      archived: false,
      startsAt: "2020-01-01T00:00:00Z",
      expiresAt: "2099-01-01T00:00:00Z",
      usageLimit: 10,
      perAccountLimit: 10,
      claimedCount: 0,
    });
    await state.database.db
      .collection<{ _id: string; value: number }>("counters")
      .insertOne({
        _id: "order:" + new Date().getUTCFullYear(),
        value: randomInt(200000, 900000),
      });
    product = new ObjectId();
    variant = new ObjectId();
    await state.database.db.collection("settings").insertOne({
      key: "shipping",
      revision: 1,
      cod: { enabled: true, reservationDeadlineHours: 48 },
      onlinePaymentDeadlineSeconds: 900,
    });
    await state.database.db
      .collection("products")
      .insertOne({ _id: product, status: "ACTIVE", name: "Fixture product" });
    await state.database.db.collection("variants").insertOne({
      _id: variant,
      productId: product,
      title: "Fixture variant",
      active: true,
      archived: false,
      trackQuantity: true,
      onHand: 1,
      reserved: 0,
      revision: 0,
      stockStatus: "IN_STOCK",
      salePaise: 10000,
      mrpPaise: 10000,
      priceMode: "EXCLUSIVE",
      gstRateBps: 1800,
      taxPolicyKey: "tax-fixture",
    });
  });
  afterAll(async () => {
    await context?.teardown();
  });

  it("acceptance replay precedes expiry, quote reuse conflicts, carts survive, and cleanup releases holds", async () => {
    const accepted = await quote();
    const command = { ...accepted, idempotencyKey: crypto.randomUUID() };
    const results = await Promise.all([
      placeOnlineTestOrder(new Headers(), "test", command),
      placeOnlineTestOrder(new Headers(), "test", command),
    ]);
    expect(results[0].orderId).toBe(results[1].orderId);
    const id = results[0].orderId;
    expect(
      (await state
        .database!.db.collection("couponClaims")
        .findOne({ orderId: new ObjectId(id) }))!.state,
    ).toBe("HELD");
    const db = state.database!.db;
    expect(await db.collection("orders").countDocuments()).toBe(1);
    expect(
      (await db.collection("variants").findOne({ _id: variant }))!.reserved,
    ).toBe(1);
    expect(
      (await db
        .collection("carts")
        .findOne({ authUserId: "payment-test-admin" }))!.revision,
    ).toBe(0);
    await expect(
      placeOnlineTestOrder(new Headers(), "test", {
        ...command,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow("QUOTE_ALREADY_ACCEPTED");
    await expect(
      placeOnlineTestOrder(new Headers(), "test", {
        ...command,
        checkout: { ...command.checkout, deliveryNote: "changed" },
      }),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await db
      .collection("checkoutQuotes")
      .updateOne(
        { quoteId: command.quoteId },
        { $set: { expiresAt: new Date(0) } },
      );
    expect(
      (await placeOnlineTestOrder(new Headers(), "test", command)).replay,
    ).toBe(true);
    const bindings = await Promise.all([
      bindTestOrder(new Headers(), id),
      bindTestOrder(new Headers(), id),
    ]);
    expect(bindings.some((v) => v.state === "BOUND")).toBe(true);
    expect(state.creates).toBe(1);
    expect((await bindTestOrder(new Headers(), id)).state).toBe("BOUND");
    expect(state.creates).toBe(1);
    await cleanupTestOrder(new Headers(), id);
    expect(
      (await db
        .collection("couponClaims")
        .findOne({ orderId: new ObjectId(id) }))!.state,
    ).toBe("RELEASED");
    expect(
      (await db.collection("coupons").findOne({ _id: coupon }))!.claimedCount,
    ).toBe(0);
    expect(
      (await db.collection("variants").findOne({ _id: variant }))!.reserved,
    ).toBe(0);
    expect(
      (await db
        .collection("carts")
        .findOne({ authUserId: "payment-test-admin" }))!.items,
    ).toEqual([{ marker: "preserve" }]);
  });

  it("timeout retains holds; zero lookup cannot create again; one exact match recovers", async () => {
    const accepted = await placeOnlineTestOrder(new Headers(), "test", {
      ...(await quote()),
      idempotencyKey: crypto.randomUUID(),
    });
    state.failCreate = true;
    const first = await bindTestOrder(new Headers(), accepted.orderId);
    expect(first.state).toBe("UNKNOWN");
    await expect(
      cleanupTestOrder(new Headers(), accepted.orderId),
    ).rejects.toThrow("PAYMENT_CLEANUP_REQUIRES_REVIEW");
    const saved = state.remote;
    state.remote = undefined;
    await state
      .database!.db.collection("paymentBindings")
      .updateOne(
        { orderId: new ObjectId(accepted.orderId) },
        { $set: { nextCheckAt: new Date(0) } },
      );
    expect((await bindTestOrder(new Headers(), accepted.orderId)).code).toBe(
      "PAYMENT_NO_MATCH_YET",
    );
    const creates = state.creates;
    state.remote = saved;
    state.failCreate = false;
    await state
      .database!.db.collection("paymentBindings")
      .updateOne(
        { orderId: new ObjectId(accepted.orderId) },
        { $set: { nextCheckAt: new Date(0) } },
      );
    expect((await bindTestOrder(new Headers(), accepted.orderId)).state).toBe(
      "BOUND",
    );
    expect(state.creates).toBe(creates);
    await cleanupTestOrder(new Headers(), accepted.orderId);
  });

  it("binds a real Razorpay test order and safely cleans an unattempted hold", async () => {
    state.realProvider = true;
    const accepted = await placeOnlineTestOrder(new Headers(), "test", {
      ...(await quote()),
      idempotencyKey: crypto.randomUUID(),
    });
    const result = await bindTestOrder(new Headers(), accepted.orderId);
    expect(result.state).toBe("BOUND");
    expect(result.paymentEnabled).toBe(false);
    const row = await state
      .database!.db.collection("paymentBindings")
      .findOne({ orderId: new ObjectId(accepted.orderId) });
    expect(row!.providerOrderId).toMatch(/^order_/);
    await cleanupTestOrder(new Headers(), accepted.orderId);
    expect(
      (await state
        .database!.db.collection("variants")
        .findOne({ _id: variant }))!.reserved,
    ).toBe(0);
    state.realProvider = false;
  });
  it("an expired lease fences the old completion and never returns to NOT_STARTED", async () => {
    const accepted = await placeOnlineTestOrder(new Headers(), "test", {
      ...(await quote()),
      idempotencyKey: crypto.randomUUID(),
    });
    const repo = bindingRepository(state.database!.db);
    const row = (await repo.read(new ObjectId(accepted.orderId)))!;
    const claimed = (await repo.claim(row, "old-worker", new Date(), false))!;
    await repo.expireLease(row._id, new Date(Date.now() + 31000));
    expect(
      (
        await repo.finish(claimed, "old-worker", "BOUND", {
          providerOrderId: "order_stale",
        })
      ).modifiedCount,
    ).toBe(0);
    expect((await repo.read(row.orderId))!.state).toBe("UNKNOWN");
  });
});
