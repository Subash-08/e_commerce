import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import type { DatabaseHandle } from "../../src/server/db/connection";
import {
  createTestDatabaseContext,
  type TestDatabaseContext,
} from "../fixtures/db-harness";
import { applyIndexes } from "../../src/server/db/indexes";
import { cartIndexes } from "../../src/modules/cart/indexes";
import { couponIndexes } from "../../src/modules/coupons/indexes";
const state = vi.hoisted(() => ({
  database: undefined as DatabaseHandle | undefined,
  user: "cart-owner-a" as string | null,
}));
vi.mock("../../src/server/db/connection", async (original) => ({
  ...(await original<typeof import("../../src/server/db/connection")>()),
  getDatabase: async () => state.database!,
}));
vi.mock("../../src/modules/identity/runtime", () => ({
  getIdentity: async () => ({
    auth: {
      api: {
        getSession: async () =>
          state.user ? { user: { id: state.user } } : null,
      },
    },
    requireAccess: async () => ({
      authUserId: state.user,
      authVersion: 1,
      role: "CUSTOMER",
    }),
  }),
}));
import { cartRequest } from "../../src/modules/cart/service";
import { resolveCart } from "../../src/modules/cart/resolver";
import { saveCoupon } from "../../src/modules/coupons/service";
import { issueTicket, verifyTicket } from "../../src/modules/cart/security";
describe("cart and coupon Atlas invariants", () => {
  let context: TestDatabaseContext;
  const product = new ObjectId(),
    variant = new ObjectId(),
    brand = new ObjectId(),
    category = new ObjectId();
  const line = {
    productId: String(product),
    variantId: String(variant),
    quantity: 1,
  };
  const request = (input: unknown) =>
    cartRequest(new Headers(), "fixture", input);
  beforeAll(async () => {
    context = await createTestDatabaseContext("cart-coupons");
    for (const name of [
      "carts",
      "cartReceipts",
      "commerceRateLimits",
      "coupons",
      "couponClaims",
      "products",
      "variants",
      "brands",
      "categories",
      "profiles",
      "mediaAssets",
      "auditLogs",
    ])
      await context.createCollection(name);
    state.database = await context.createOwner().get();
    const db = state.database.db;
    await applyIndexes(db, [...cartIndexes, ...couponIndexes], {
      dryRun: false,
    });
    await db.collection("profiles").insertMany(
      ["cart-owner-a", "cart-owner-b"].map((authUserId) => ({
        authUserId,
        status: "ACTIVE",
        authVersion: 1,
      })),
    );
    await db
      .collection("brands")
      .insertOne({ _id: brand, active: true, archivedAt: null });
    await db
      .collection("categories")
      .insertOne({ _id: category, active: true, archivedAt: null });
    await db.collection("products").insertOne({
      _id: product,
      name: "Cart fixture",
      slug: "cart-fixture",
      status: "ACTIVE",
      brandId: brand,
      primaryCategoryId: category,
      categoryIds: [category],
      privateNotes: "must-not-leak",
    });
    await db.collection("variants").insertOne({
      _id: variant,
      productId: product,
      title: "One",
      urlKey: "one",
      active: true,
      archived: false,
      priceMode: "EXCLUSIVE",
      salePaise: 10000,
      mrpPaise: 12000,
      gstRateBps: 1800,
      trackQuantity: true,
      onHand: 20,
      reserved: 2,
      revision: 0,
      costPaise: 1234,
    });
  });
  afterAll(async () => {
    await context?.teardown();
  });
  it("resolves fresh safe fields and rejects wrong-product references", async () => {
    const view = await resolveCart(state.database!.db, [line], null);
    expect(view.totalPaise).toBe(11800);
    expect(view.items[0].maximumQuantity).toBe(18);
    expect(JSON.stringify(view)).not.toMatch(
      /costPaise|privateNotes|onHand|reserved/,
    );
    expect(
      (
        await resolveCart(
          state.database!.db,
          [{ ...line, productId: String(new ObjectId()) }],
          null,
        )
      ).ready,
    ).toBe(false);
  });
  it("replays the same addition once, rejects changed payload, and isolates owners", async () => {
    state.user = "cart-owner-a";
    const start = await request({ action: "resolve" });
    const body = {
      action: "add",
      line,
      revision: start.view.revision,
      ticket: start.ticket,
    };
    const first = await request(body),
      replay = await request(body);
    expect(first.view.count).toBe(1);
    expect(replay.view.count).toBe(1);
    await expect(
      request({ ...body, line: { ...line, quantity: 2 } }),
    ).rejects.toThrow("TOKEN_REUSED");
    state.user = "cart-owner-b";
    expect((await request({ action: "resolve" })).view.count).toBe(0);
    await expect(request(body)).rejects.toThrow("REQUEST_EXPIRED");
    state.user = "cart-owner-a";
  });
  it("allows only one concurrent revision and makes double-tab merges idempotent", async () => {
    const start = await request({ action: "resolve" });
    const results = await Promise.allSettled(
      [2, 3].map((quantity) =>
        request({
          action: "set",
          line: { ...line, quantity },
          revision: start.view.revision,
          ticket: issueTicket("cart-owner-a"),
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const current = await request({ action: "resolve" });
    const merge = {
      action: "merge",
      lines: [{ ...line, quantity: 99 }],
      revision: current.view.revision,
      ticket: current.ticket,
    };
    const merged = await Promise.all([request(merge), request(merge)]);
    expect(merged[0].view.count).toBe(18);
    expect(merged[1].view.count).toBe(18);
    expect(merged[0].remaining).toEqual(merged[1].remaining);
    expect(merged[0].remaining[0].quantity).toBeGreaterThan(0);
  });
  it("fails closed after deactivation, rejects expired tickets and keeps unavailable items visible", async () => {
    const db = state.database!.db;
    await db
      .collection("profiles")
      .updateOne(
        { authUserId: "cart-owner-a" },
        { $set: { status: "INACTIVE" } },
      );
    await expect(
      request({
        action: "clear",
        revision: 0,
        ticket: issueTicket("cart-owner-a"),
      }),
    ).rejects.toThrow("AUTH_REQUIRED");
    expect(() =>
      verifyTicket(issueTicket("cart-owner-a", -1), "cart-owner-a"),
    ).toThrow("REQUEST_EXPIRED");
    await db
      .collection("products")
      .updateOne({ _id: product }, { $set: { status: "ARCHIVED" } });
    const view = await resolveCart(db, [line], null);
    expect(view.items).toHaveLength(1);
    expect(view.totalPaise).toBe(0);
    expect(view.ready).toBe(false);
    await db
      .collection("products")
      .updateOne({ _id: product }, { $set: { status: "ACTIVE" } });
  });
  it("previews eligible-only coupon savings, including tax changes, without claims", async () => {
    const db = state.database!.db;
    const couponId = new ObjectId();
    await db.collection("coupons").insertOne({
      _id: couponId,
      code: "CARTTEST",
      active: true,
      archived: false,
      revision: 0,
      kind: "PERCENTAGE",
      value: 1000,
      startsAt: new Date(Date.now() - 10000).toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      scope: "PRODUCT",
      targetIds: [String(product)],
      excludedProductIds: [],
      excludeSaleItems: false,
      audience: "EVERYONE",
      allowedUserIds: [],
      minEligiblePaise: 0,
      maxDiscountPaise: null,
      usageLimit: 1,
      perAccountLimit: null,
    });
    const view = await resolveCart(db, [line], null, 0, "CARTTEST");
    expect(view.subtotalPaise).toBe(11800);
    expect(view.totalPaise).toBe(10620);
    expect(view.discountPaise).toBe(1180);
    expect(await db.collection("couponClaims").countDocuments({})).toBe(0);
    await db
      .collection("couponClaims")
      .insertOne({ couponId, state: "CONSUMED" });
    expect(
      (await resolveCart(db, [line], null, 0, "CARTTEST")).totalPaise,
    ).toBe(11800);
  });
  it("requires fresh admin authority and serializes coupon edits", async () => {
    state.user = "cart-owner-b";
    const input = {
      code: "MANAGED10",
      name: "Managed fixture",
      kind: "PERCENTAGE",
      value: 1000,
      startsAt: new Date(Date.now() - 1000).toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      active: true,
      scope: "ALL",
      targetIds: [],
      excludedProductIds: [],
      audience: "EVERYONE",
      allowedUserIds: [],
      usageLimit: null,
      perAccountLimit: null,
    };
    await expect(saveCoupon(new Headers(), input)).rejects.toThrow("FORBIDDEN");
    await state
      .database!.db.collection("profiles")
      .updateOne({ authUserId: state.user }, { $set: { role: "ADMIN" } });
    const id = await saveCoupon(new Headers(), input);
    const results = await Promise.allSettled(
      ["One", "Two"].map((name) =>
        saveCoupon(new Headers(), { ...input, id, revision: 0, name }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await state
        .database!.db.collection("auditLogs")
        .countDocuments({ entityId: id }),
    ).toBe(2);
  });
});
