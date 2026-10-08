import type { ShippingInput } from "../../src/modules/shipping/contracts";
import type { ShippingTaxes } from "../../src/modules/shipping/calculator";
export const shippingFixture: ShippingInput = {
  enabled: true,
  country: "IN",
  currency: "INR",
  standardChargePaise: 8000,
  automaticFreeShipping: { enabled: true, thresholdPaise: 199900 },
  coverage: { mode: "ALL_INDIA", stateCodes: [], pinPrefixes: [] },
  shippingTaxPolicyKey: "fixture-shipping",
  cod: {
    enabled: true,
    surchargePaise: 2000,
    surchargeTaxPolicyKey: "fixture-shipping",
    blockedStateCodes: [],
    blockedPinPrefixes: [],
    reservationDeadlineHours: 24,
  },
  quoteTtlSeconds: 600,
  onlinePaymentDeadlineSeconds: 900,
};
export const destination = {
  merchandisePaise: 199899,
  state: "TN" as const,
  pin: "600001",
  payment: "ONLINE" as const,
};
export const shippingTaxes: ShippingTaxes = {
  shipping: {
    approved: true,
    facts: {
      mode: "INCLUSIVE",
      rateBps: 1800,
      components: [{ key: "GST", rateBps: 1800 }],
    },
  },
  cod: {
    approved: true,
    facts: {
      mode: "EXCLUSIVE",
      rateBps: 1800,
      components: [{ key: "GST", rateBps: 1800 }],
    },
  },
};
