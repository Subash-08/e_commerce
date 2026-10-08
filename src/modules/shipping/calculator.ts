import { calculateTax, type TaxFacts } from "../pricing/price.ts";
import { sumPaise } from "../pricing/money.ts";
import {
  previewInput,
  shippingInput,
  type ShippingInput,
  type ShippingDestination,
} from "./contracts.ts";

export type ShippingTaxes = {
  shipping: { facts: TaxFacts; approved: boolean } | null;
  cod: { facts: TaxFacts; approved: boolean } | null;
};
export function calculateShipping(
  policy: ShippingInput | null,
  destination: ShippingDestination,
  taxes: ShippingTaxes,
  options: { estimate?: boolean } = {},
) {
  const normalized = shippingInput.safeParse(policy);
  if (!normalized.success)
    return { ok: false as const, issue: "SHIPPING_CONFIGURATION_REQUIRED" };
  policy = normalized.data;
  const parsed = previewInput.safeParse(destination);
  if (!parsed.success)
    return { ok: false as const, issue: "INVALID_DESTINATION_OR_AMOUNT" };
  const { state, pin, merchandisePaise, payment } = parsed.data;
  if (!policy.enabled)
    return { ok: false as const, issue: "SHIPPING_DISABLED" };
  const matches = (states: readonly string[], prefixes: readonly string[]) =>
    states.includes(state) || prefixes.some((p) => pin.startsWith(p));
  const match = matches(
    policy.coverage.stateCodes,
    policy.coverage.pinPrefixes,
  );
  if (
    (policy.coverage.mode === "ALLOW_LIST" && !match) ||
    (policy.coverage.mode === "BLOCK_LIST" && match)
  )
    return { ok: false as const, issue: "DESTINATION_UNSUPPORTED" };
  const codEligible =
    policy.cod.enabled &&
    !matches(policy.cod.blockedStateCodes, policy.cod.blockedPinPrefixes);
  if (payment === "COD" && !codEligible)
    return { ok: false as const, issue: "COD_UNAVAILABLE" };
  const automaticFree =
    policy.automaticFreeShipping.enabled &&
    merchandisePaise >= policy.automaticFreeShipping.thresholdPaise!;
  const remainingPaise = policy.automaticFreeShipping.enabled
    ? Math.max(
        0,
        policy.automaticFreeShipping.thresholdPaise! - merchandisePaise,
      )
    : null;
  const shippingChargePaise = automaticFree ? 0 : policy.standardChargePaise;
  const codChargePaise = payment === "COD" ? policy.cod.surchargePaise : 0;
  const base = {
    serviceable: true as const,
    codEligible,
    automaticFree,
    remainingPaise,
    standardChargePaise: policy.standardChargePaise,
    shippingChargePaise,
    codChargePaise,
    automaticWaiverPaise: policy.standardChargePaise - shippingChargePaise,
  };
  if (!taxes.shipping || (codChargePaise > 0 && !taxes.cod))
    return {
      ok: false as const,
      issue: "SHIPPING_TAX_CONFIGURATION_REQUIRED",
      ...base,
    };
  const approved =
    taxes.shipping.approved &&
    (codChargePaise === 0 || taxes.cod?.approved === true);
  if (!approved && !options.estimate)
    return {
      ok: false as const,
      issue: "SHIPPING_TAX_REVIEW_REQUIRED",
      ...base,
    };
  try {
    const shipping = calculateTax(shippingChargePaise, taxes.shipping.facts);
    const cod =
      codChargePaise > 0
        ? calculateTax(codChargePaise, taxes.cod!.facts)
        : { basePaise: 0, taxPaise: 0, payablePaise: 0, components: [] };
    return {
      ok: true as const,
      ...base,
      estimate: !approved,
      shipping,
      cod,
      payablePaise: sumPaise([shipping.payablePaise, cod.payablePaise]),
    };
  } catch {
    return {
      ok: false as const,
      issue: "SHIPPING_TAX_CONFIGURATION_REQUIRED",
      ...base,
    };
  }
}
