import { describe, expect, it } from "vitest";
import { cartLines, mergeLines } from "../../src/modules/cart/contracts";
import { couponInput, eligibleKeys } from "../../src/modules/coupons/contracts";
const a = "675000000000000000000001",
  b = "675000000000000000000002";
describe("bounded cart and coupon contracts", () => {
  it("rejects manipulated prices, fractional quantities, duplicate variants and oversized carts", () => {
    const line = { productId: a, variantId: b, quantity: 1 };
    for (const value of [
      [{ ...line, price: 1 }],
      [{ ...line, quantity: 1.5 }],
      [{ ...line, quantity: 100 }],
      [line, line],
      Array(51).fill(line),
    ])
      expect(cartLines.safeParse(value).success).toBe(false);
  });
  it("preserves unit overflow and wrong-product selections instead of dropping them", () => {
    const line = { productId: a, variantId: b, quantity: 95 };
    const result = mergeLines(
      [line],
      [{ ...line, quantity: 10 }],
      new Map([[b, 99]]),
    );
    expect(result.items[0].quantity).toBe(99);
    expect(result.remaining[0].quantity).toBe(6);
    expect(
      mergeLines(
        [line],
        [{ ...line, productId: b, quantity: 2 }],
        new Map([[b, 99]]),
      ).remaining[0].quantity,
    ).toBe(2);
  });
  it("preserves all incoming lines when the cart is full", () => {
    const current = Array.from({ length: 50 }, (_, n) => ({
      productId: a,
      variantId: n.toString(16).padStart(24, "0"),
      quantity: 1,
    }));
    expect(
      mergeLines(
        current,
        [{ productId: a, variantId: b, quantity: 2 }],
        new Map([[b, 99]]),
      ).remaining,
    ).toHaveLength(1);
  });
  it("makes product exclusions override scope and sale eligibility", () => {
    const facts = [
      {
        key: b,
        productId: a,
        variantId: b,
        brandId: a,
        categoryIds: [a],
        sale: true,
      },
    ];
    expect(
      eligibleKeys(
        {
          scope: "BRAND",
          targetIds: [a],
          excludedProductIds: [a],
          excludeSaleItems: false,
        },
        facts,
      ),
    ).toEqual([]);
    expect(
      eligibleKeys(
        {
          scope: "VARIANT",
          targetIds: [b],
          excludedProductIds: [],
          excludeSaleItems: false,
        },
        facts,
      ),
    ).toEqual([b]);
    expect(
      eligibleKeys(
        {
          scope: "ALL",
          targetIds: [],
          excludedProductIds: [],
          excludeSaleItems: true,
        },
        facts,
      ),
    ).toEqual([]);
  });
  it("rejects ambiguous guest per-account limits and invalid percentages", () => {
    const value = {
      code: "test10",
      name: "Test",
      kind: "PERCENTAGE",
      value: 1000,
      startsAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z",
      active: true,
      scope: "ALL",
      targetIds: [],
      excludedProductIds: [],
      audience: "EVERYONE",
      allowedUserIds: [],
      usageLimit: null,
      perAccountLimit: null,
    };
    expect(couponInput.parse(value).code).toBe("TEST10");
    expect(
      couponInput.safeParse({ ...value, perAccountLimit: 1 }).success,
    ).toBe(false);
    expect(couponInput.safeParse({ ...value, value: 10001 }).success).toBe(
      false,
    );
  });
});
