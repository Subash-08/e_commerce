import { describe, it, expect } from "vitest";
import { calculateShipping } from "../../src/modules/shipping/calculator";
import { shippingInput } from "../../src/modules/shipping/contracts";
import {
  shippingFixture as policy,
  destination,
  shippingTaxes as taxes,
} from "../fixtures/shipping";
describe("shipping policy and pricing", () => {
  it("rejects non-INR policies", () => {
    expect(
      shippingInput.safeParse({ ...policy, currency: "USD" }).success,
    ).toBe(false);
  });
  it.each([
    ["ALLOW_LIST", "TN", true],
    ["ALLOW_LIST", "KA", true],
    ["ALLOW_LIST", "MH", false],
    ["BLOCK_LIST", "TN", false],
    ["BLOCK_LIST", "KA", false],
    ["BLOCK_LIST", "MH", true],
  ] as const)("%s any-match coverage for %s", (mode, state, ok) => {
    const result = calculateShipping(
      {
        ...policy,
        coverage: { mode, stateCodes: ["TN"], pinPrefixes: ["56", "560"] },
      },
      { ...destination, state, pin: state === "KA" ? "560001" : "600001" },
      taxes,
    );
    expect(result.ok).toBe(ok);
  });
  it("uses exact discounted inclusive threshold, restores shipping below it, and retains COD fee", () => {
    expect(calculateShipping(policy, destination, taxes)).toMatchObject({
      ok: true,
      remainingPaise: 1,
      payablePaise: 8000,
      shipping: { basePaise: 6780, taxPaise: 1220 },
    });
    expect(
      calculateShipping(
        policy,
        { ...destination, merchandisePaise: 199900, payment: "COD" },
        taxes,
      ),
    ).toMatchObject({
      ok: true,
      automaticFree: true,
      shippingChargePaise: 0,
      codChargePaise: 2000,
      payablePaise: 2360,
    });
    expect(
      calculateShipping(
        {
          ...policy,
          automaticFreeShipping: { enabled: false, thresholdPaise: null },
        },
        { ...destination, merchandisePaise: 500000 },
        taxes,
      ),
    ).toMatchObject({ ok: true, payablePaise: 8000 });
  });
  it("fails closed on missing/disabled policy, tax and review; only admin estimates permit unreviewed tax", () => {
    expect(calculateShipping(null, destination, taxes)).toMatchObject({
      ok: false,
      issue: "SHIPPING_CONFIGURATION_REQUIRED",
    });
    expect(
      calculateShipping({ ...policy, enabled: false }, destination, taxes),
    ).toMatchObject({ ok: false, issue: "SHIPPING_DISABLED" });
    expect(
      calculateShipping(policy, destination, { shipping: null, cod: null }),
    ).toMatchObject({
      ok: false,
      issue: "SHIPPING_TAX_CONFIGURATION_REQUIRED",
    });
    const pending = {
      ...taxes,
      shipping: { ...taxes.shipping!, approved: false },
    };
    expect(calculateShipping(policy, destination, pending)).toMatchObject({
      ok: false,
      issue: "SHIPPING_TAX_REVIEW_REQUIRED",
    });
    expect(
      calculateShipping(policy, destination, pending, { estimate: true }),
    ).toMatchObject({ ok: true, estimate: true });
  });
  it("COD restrictions never widen coverage and apply after serviceability", () => {
    expect(
      calculateShipping(
        {
          ...policy,
          coverage: { mode: "BLOCK_LIST", stateCodes: ["TN"], pinPrefixes: [] },
        },
        { ...destination, payment: "COD" },
        taxes,
      ),
    ).toMatchObject({ ok: false, issue: "DESTINATION_UNSUPPORTED" });
    expect(
      calculateShipping(
        { ...policy, cod: { ...policy.cod, blockedPinPrefixes: ["60"] } },
        { ...destination, payment: "COD" },
        taxes,
      ),
    ).toMatchObject({ ok: false, issue: "COD_UNAVAILABLE" });
    expect(
      calculateShipping(
        { ...policy, cod: { ...policy.cod, enabled: false } },
        { ...destination, payment: "COD" },
        taxes,
      ),
    ).toMatchObject({ ok: false, issue: "COD_UNAVAILABLE" });
  });
  it("rejects unsafe money, empty allowlists, hidden rules and unbounded deadlines", () => {
    for (const change of [
      { standardChargePaise: -1 },
      { standardChargePaise: Number.MAX_SAFE_INTEGER },
      { onlinePaymentDeadlineSeconds: 899 },
      { onlinePaymentDeadlineSeconds: 1801 },
      { quoteTtlSeconds: 901 },
      { coverage: { mode: "ALLOW_LIST", stateCodes: [], pinPrefixes: [] } },
      { coverage: { mode: "ALL_INDIA", stateCodes: ["TN"], pinPrefixes: [] } },
    ])
      expect(shippingInput.safeParse({ ...policy, ...change }).success).toBe(
        false,
      );
    expect(
      shippingInput.parse({ ...policy, standardChargePaise: 0 })
        .standardChargePaise,
    ).toBe(0);
    expect(
      shippingInput.parse({
        ...policy,
        coverage: {
          mode: "ALLOW_LIST",
          stateCodes: [" tn ", "TN"],
          pinPrefixes: ["60", "60"],
        },
      }).coverage,
    ).toEqual({ mode: "ALLOW_LIST", stateCodes: ["TN"], pinPrefixes: ["60"] });
    expect(
      calculateShipping(policy, { ...destination, pin: "000000" }, taxes).ok,
    ).toBe(false);
  });
});
