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
}));
vi.mock("../../src/server/db/connection", async (original) => ({
  ...(await original<typeof import("../../src/server/db/connection")>()),
  getDatabase: async () => state.database!,
}));
vi.mock("../../src/modules/identity/runtime", () => ({
  getIdentity: async () => ({
    auth: { api: { getSession: async () => null } },
    requireAccess: async () => {
      throw new Error("AUTH_REQUIRED");
    },
  }),
}));

import { checkoutQuoteInput } from "../../src/modules/checkout/contracts";
import { legalPolicyVersions } from "../../src/modules/checkout/legal";
import { checkoutFingerprint } from "../../src/modules/checkout/service";
import { privateOwner, issueTicket } from "../../src/modules/cart/security";
import {
  cancelOwnedOrder,
  placeCodOrder,
} from "../../src/modules/orders/service";

describe("COD order Atlas invariants", () => {
  let context: TestDatabaseContext;
  let product: ObjectId;
  let variant: ObjectId;
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
      payment: "COD",
      coupon: "",
      legal: {
        termsVersion: legalPolicyVersions.terms,
        privacyVersion: legalPolicyVersions.privacy,
        accepted: true,
      },
      marketingConsent: false,
      guestLines: [guestLine()],
      cartRevision: 0,
    });

  async function quote(guestKey: string) {
    const db = state.database!.db;
    const input = checkout();
    const row = await db.collection("variants").findOne({ _id: variant });
    const quoteId = crypto.randomUUID();
    const now = new Date();
    await db.collection("checkoutQuotes").insertOne({
      quoteId,
      ownerKeyHash: privateOwner("guest:" + guestKey),
      requestFingerprint: checkoutFingerprint({
        ...input,
        marketingConsent: undefined,
      }),
      cartRevision: null,
      guestLinesHash: checkoutFingerprint(input.guestLines),
      sourceRevisions: {
        variants: [{ id: String(variant), revision: row!.revision }],
        coupon: null,
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
        cartRevision: null,
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
        coupon: { code: "", discountPaise: 0, message: null },
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
          discountPaise: 0,
          goodsTaxPaise: 1800,
          deliveryPaise: 0,
          grandTotalPaise: 11800,
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
    context = await createTestDatabaseContext("orders");
    for (const name of [
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
      [...checkoutIndexes, ...couponIndexes, ...orderIndexes],
      { dryRun: false },
    );
    product = new ObjectId();
    variant = new ObjectId();
    await state.database.db.collection("settings").insertOne({
      key: "shipping",
      revision: 1,
      cod: { enabled: true, reservationDeadlineHours: 48 },
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

  it("replays one accepted order and cancellation releases its stock exactly once", async () => {
    const guestKey = "guest-order-a";
    const accepted = await quote(guestKey);
    const command = { ...accepted, idempotencyKey: crypto.randomUUID() };
    const [first, replay] = await Promise.all([
      placeCodOrder(new Headers(), guestKey, command),
      placeCodOrder(new Headers(), guestKey, command),
    ]);
    expect(replay.replay).toBe(true);
    expect(replay.order.orderNumber).toBe(first.order.orderNumber);
    expect(await state.database!.db.collection("orders").countDocuments()).toBe(
      1,
    );
    expect(
      (await state
        .database!.db.collection("variants")
        .findOne({ _id: variant }))!.reserved,
    ).toBe(1);
    const cancelled = await cancelOwnedOrder(
      new Headers(),
      issueTicket("guest-order:" + first.orderId),
      {
        orderNumber: first.order.orderNumber,
        expectedRevision: 0,
        reason: "Customer changed their mind",
      },
    );
    expect(cancelled.state).toBe("CANCELLED");
    expect(
      (await state
        .database!.db.collection("variants")
        .findOne({ _id: variant }))!.reserved,
    ).toBe(0);
    await expect(
      cancelOwnedOrder(
        new Headers(),
        issueTicket("guest-order:" + first.orderId),
        {
          orderNumber: first.order.orderNumber,
          expectedRevision: 1,
          reason: "Try twice",
        },
      ),
    ).rejects.toThrow("ORDER_CANNOT_CANCEL");
  });

  it("allows only one buyer to reserve the final tracked unit", async () => {
    const a = await quote("guest-order-b");
    const b = await quote("guest-order-c");
    const results = await Promise.allSettled([
      placeCodOrder(new Headers(), "guest-order-b", {
        ...a,
        idempotencyKey: crypto.randomUUID(),
      }),
      placeCodOrder(new Headers(), "guest-order-c", {
        ...b,
        idempotencyKey: crypto.randomUUID(),
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      (await state
        .database!.db.collection("variants")
        .findOne({ _id: variant }))!.reserved,
    ).toBe(1);
  });
});
