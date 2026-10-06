import { describe, expect, it } from "vitest";
import { priceQuote, calculateTax } from "../../src/modules/pricing/price";
import {
  allocatePaise,
  MAX_MONEY_PAISE,
  paise,
  percentage,
  roundHalfUp,
} from "../../src/modules/pricing/money";
import {
  coupon,
  exempt,
  exclusive,
  inclusive,
  line,
  quote,
} from "../fixtures/domain";
describe("PRICING-RULES worked examples", () => {
  it("exclusive 10000 plus 18 percent is 11800", () => {
    expect(
      priceQuote(quote({ lines: [line({ tax: exclusive })] })).totals,
    ).toMatchObject({ taxPaise: 1800, grandTotalPaise: 11800 });
  });
  it("inclusive 11800 extracts base 10000 and tax 1800", () => {
    expect(calculateTax(11800, inclusive)).toMatchObject({
      basePaise: 10000,
      taxPaise: 1800,
      payablePaise: 11800,
    });
  });
  it("allocates 1000 as 667 / 333 to 10000 / 5000", () => {
    const result = priceQuote(
      quote({
        lines: [
          line(),
          line({ key: "b", mrpPaise: 5000, unitPricePaise: 5000 }),
        ],
        coupon: coupon({ eligibleLineKeys: ["a", "b"] }),
      }),
    );
    expect(result.lines.map((l) => l.couponAllocationPaise)).toEqual([
      667, 333,
    ]);
    expect(result.lines.map((l) => l.payablePaise)).toEqual([9333, 4667]);
  });
  it("awards odd paise to stable lowest key, independently of input order", () => {
    const result = priceQuote(
      quote({
        lines: ["c", "b", "a"].map((key) => line({ key })),
        coupon: coupon({ value: 1, eligibleLineKeys: ["c", "b", "a"] }),
      }),
    );
    expect(result.lines.map((l) => [l.key, l.couponAllocationPaise])).toEqual([
      ["c", 0],
      ["b", 0],
      ["a", 1],
    ]);
  });
  it("MRP discount is informational, never subtracted twice", () => {
    const result = priceQuote(
      quote({
        lines: [line({ mrpPaise: 6000, unitPricePaise: 5000, quantity: 2 })],
        coupon: coupon(),
      }),
    );
    expect(result.totals).toMatchObject({
      saleSubtotalPaise: 10000,
      itemDiscountPaise: 2000,
      couponDiscountPaise: 1000,
      grandTotalPaise: 9000,
    });
  });
});
describe("pricing input and coupon gates", () => {
  it.each([0, -1, 1.5, 100, NaN, Infinity])(
    "rejects quantity %s",
    (quantity) => {
      expect(() => priceQuote(quote({ lines: [line({ quantity })] }))).toThrow(
        "INVALID_INTEGER",
      );
    },
  );
  it.each([-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER])(
    "rejects invalid paise %s",
    (value) => {
      expect(() => paise(value)).toThrow();
    },
  );
  it("rejects a sale above MRP, stale revisions, unsupported country/currency and unavailable lines", () => {
    for (const patch of [
      { unitPricePaise: 10001 },
      { expectedRevision: "2" },
      { available: false },
      { productActive: false },
      { variantActive: false },
    ])
      expect(() => priceQuote(quote({ lines: [line(patch)] }))).toThrow();
    expect(() => priceQuote(quote({ country: "US" }))).toThrow(
      "UNSUPPORTED_COUNTRY",
    );
    expect(() => priceQuote(quote({ currency: "USD" }))).toThrow(
      "UNSUPPORTED_CURRENCY",
    );
    expect(() => priceQuote(quote({ lines: [] }))).toThrow(
      "INVALID_LINE_COUNT",
    );
    expect(() => priceQuote(quote({ lines: [line(), line()] }))).toThrow(
      "DUPLICATE_LINE",
    );
  });
  it.each([
    { active: false },
    { capacityAvailable: false },
    { startsAt: 101 },
    { expiresAt: 100 },
    { minEligiblePaise: 10001 },
    { value: -1 },
    { maxDiscountPaise: -1 },
    { eligibleLineKeys: ["missing"] },
    { eligibleLineKeys: ["a", "a"] },
  ])("rejects invalid coupon %j", (patch) => {
    expect(() => priceQuote(quote({ coupon: coupon(patch) }))).toThrow();
  });
  it("includes the start boundary and excludes the expiry boundary", () => {
    expect(
      priceQuote(quote({ coupon: coupon({ startsAt: 100 }) })).totals
        .couponDiscountPaise,
    ).toBe(1000);
    expect(() =>
      priceQuote(quote({ coupon: coupon({ expiresAt: 100 }) })),
    ).toThrow("COUPON_UNAVAILABLE");
  });
  it("caps percentage coupons and enforces the eligible minimum only", () => {
    expect(
      priceQuote(
        quote({
          coupon: coupon({
            kind: "PERCENTAGE",
            value: 5000,
            maxDiscountPaise: 1000,
          }),
        }),
      ).totals.couponDiscountPaise,
    ).toBe(1000);
    expect(
      priceQuote(quote({ coupon: coupon({ value: 99999 }) })).totals
        .grandTotalPaise,
    ).toBe(0);
    expect(() =>
      priceQuote(
        quote({ coupon: coupon({ kind: "PERCENTAGE", value: 10001 }) }),
      ),
    ).toThrow();
    expect(() =>
      priceQuote(
        quote({
          lines: [line(), line({ key: "b" })],
          coupon: coupon({ minEligiblePaise: 10001 }),
        }),
      ),
    ).toThrow("COUPON_MINIMUM");
  });
  it("handles zero-priced eligible lines and zero discounts", () => {
    expect(
      priceQuote(quote({ coupon: coupon({ value: 0 }) })).totals
        .grandTotalPaise,
    ).toBe(10000);
    expect(
      priceQuote(
        quote({
          lines: [line({ mrpPaise: 0, unitPricePaise: 0 })],
          coupon: coupon(),
        }),
      ).totals.grandTotalPaise,
    ).toBe(0);
  });
});
describe("rounding, shipping and conservation", () => {
  it("rounds half up using rational intermediates", () => {
    expect(roundHalfUp(BigInt(1), BigInt(2))).toBe(BigInt(1));
    expect(roundHalfUp(BigInt(49), BigInt(100))).toBe(BigInt(0));
    expect(percentage(1, 5000)).toBe(1);
    expect(() => roundHalfUp(BigInt(1), BigInt(0))).toThrow("INVALID_RATIO");
  });
  it("splits odd tax paise deterministically without changing total", () => {
    const result = calculateTax(1, {
      mode: "EXCLUSIVE",
      rateBps: 10000,
      components: [
        { key: "SGST", rateBps: 5000 },
        { key: "CGST", rateBps: 5000 },
      ],
    });
    expect(result.components.map((c) => [c.key, c.amountPaise])).toEqual([
      ["SGST", 0],
      ["CGST", 1],
    ]);
    expect(() => calculateTax(100, { ...exclusive, components: [] })).toThrow();
    expect(() =>
      calculateTax(100, { ...exempt, exemptionReason: "" }),
    ).toThrow();
  });
  it("shipping threshold uses discounted tax-inclusive goods, and shipping has its own tax", () => {
    const input = quote({
      lines: [line({ tax: exclusive })],
      coupon: coupon(),
      shipping: {
        chargePaise: 100,
        freeAtGoodsPayablePaise: 11000,
        tax: exclusive,
      },
    });
    expect(priceQuote(input).totals).toMatchObject({
      goodsPayablePaise: 10620,
      shippingBasePaise: 100,
      shippingTaxPaise: 18,
      grandTotalPaise: 10738,
    });
    expect(
      priceQuote({
        ...input,
        shipping: { ...input.shipping, freeAtGoodsPayablePaise: 10620 },
      }).totals.shippingBasePaise,
    ).toBe(0);
    expect(
      priceQuote(quote({ shipping: { chargePaise: 118, tax: inclusive } }))
        .totals,
    ).toMatchObject({ shippingBasePaise: 100, shippingTaxPaise: 18 });
  });
  it("uses safe integer outputs even when intermediate multiplication exceeds safe Number range", () => {
    expect(
      priceQuote(
        quote({
          lines: [
            line({
              mrpPaise: MAX_MONEY_PAISE,
              unitPricePaise: MAX_MONEY_PAISE,
            }),
          ],
        }),
      ).totals.grandTotalPaise,
    ).toBe(MAX_MONEY_PAISE);
    expect(percentage(MAX_MONEY_PAISE, 5000)).toBe(MAX_MONEY_PAISE / 2);
    expect(() =>
      priceQuote(
        quote({
          lines: [
            line({
              mrpPaise: MAX_MONEY_PAISE,
              unitPricePaise: MAX_MONEY_PAISE,
              quantity: 2,
            }),
          ],
        }),
      ),
    ).toThrow("MONEY_OVERFLOW");
    expect(() =>
      priceQuote(
        quote({
          lines: [
            line({
              mrpPaise: MAX_MONEY_PAISE,
              unitPricePaise: MAX_MONEY_PAISE,
              tax: exclusive,
            }),
          ],
        }),
      ),
    ).toThrow("MONEY_OVERFLOW");
  });
  it("conserves discount, tax and totals across 200 deterministic varied cases", () => {
    for (let n = 1; n <= 200; n++) {
      const lines = ["a", "b", "c"].map((key, i) =>
        line({
          key,
          mrpPaise: n * 31 + i * 19,
          unitPricePaise: n * 23 + i * 11,
          quantity: (n % 5) + 1,
          tax: i % 2 ? inclusive : exclusive,
        }),
      );
      const result = priceQuote(
        quote({
          lines,
          coupon: coupon({ value: n * 7, eligibleLineKeys: ["a", "b", "c"] }),
          shipping: { chargePaise: n, tax: exclusive },
        }),
      );
      expect(
        result.lines.reduce((s, l) => s + l.couponAllocationPaise, 0),
      ).toBe(result.totals.couponDiscountPaise);
      for (const l of result.lines)
        expect(l.basePaise + l.taxPaise).toBe(l.payablePaise);
      expect(result.totals.grandTotalPaise).toBe(
        result.lines.reduce((s, l) => s + l.payablePaise, 0) +
          result.shipping.payablePaise,
      );
      const reverse = priceQuote(
        quote({
          lines: [...lines].reverse(),
          coupon: coupon({ value: n * 7, eligibleLineKeys: ["c", "b", "a"] }),
          shipping: { chargePaise: n, tax: exclusive },
        }),
      );
      expect(reverse.totals).toEqual(result.totals);
      expect(
        allocatePaise(n, [
          { key: "a", weight: 0 },
          { key: "b", weight: 1 },
        ]).get("a"),
      ).toBe(0);
    }
  });
  it("does not mutate inputs and detaches quote snapshots", () => {
    const input = quote();
    const before = structuredClone(input);
    const result = priceQuote(input);
    expect(input).toEqual(before);
    expect(result.inputs).toEqual(input);
    expect(result.inputs).not.toBe(input);
  });
});
