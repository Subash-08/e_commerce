import { identifier, integer, requireFact } from "../../shared/domain/errors.ts";
import type { StateValue } from "../../shared/domain/states.generated.ts";
import {
  allocatePaise,
  basisPoints,
  currency,
  fromBigInt,
  multiplyPaise,
  paise,
  percentage,
  roundHalfUp,
  subtractPaise,
  sumPaise,
} from "./money.ts";

export interface TaxFacts {
  readonly mode: "INCLUSIVE" | "EXCLUSIVE" | "EXEMPT";
  readonly rateBps: number;
  readonly components: readonly {
    readonly key: string;
    readonly rateBps: number;
  }[];
  readonly exemptionReason?: string;
}
export interface PriceLine {
  readonly key: string;
  readonly productActive: boolean;
  readonly variantActive: boolean;
  readonly available: boolean;
  readonly revision: string;
  readonly expectedRevision: string;
  readonly quantity: number;
  readonly mrpPaise: number;
  readonly unitPricePaise: number;
  readonly tax: TaxFacts;
}
export interface CouponFacts {
  readonly code: string;
  readonly revision: string;
  readonly kind: StateValue<"CouponKind">;
  readonly value: number;
  readonly active: boolean;
  readonly capacityAvailable: boolean;
  readonly startsAt: number;
  readonly expiresAt: number;
  readonly eligibleLineKeys: readonly string[];
  readonly minEligiblePaise: number;
  readonly maxDiscountPaise?: number;
}
export interface PricingInput {
  readonly currency: string;
  readonly country: string;
  readonly now: number;
  readonly policyVersion: string;
  readonly lines: readonly PriceLine[];
  readonly coupon?: CouponFacts;
  readonly shipping: {
    readonly chargePaise: number;
    readonly freeAtGoodsPayablePaise?: number;
    readonly tax: TaxFacts;
  };
}
export function calculateTax(amount: number, facts: TaxFacts) {
  paise(amount);
  basisPoints(facts.rateBps);
  requireFact(
    ["INCLUSIVE", "EXCLUSIVE", "EXEMPT"].includes(facts.mode),
    "INVALID_TAX_MODE",
  );
  requireFact(facts.components.length <= 10, "INVALID_TAX_COMPONENTS");
  for (const c of facts.components) {
    identifier(c.key);
    basisPoints(c.rateBps);
  }
  requireFact(
    new Set(facts.components.map((c) => c.key)).size ===
      facts.components.length,
    "DUPLICATE_TAX_COMPONENT",
  );
  if (facts.mode === "EXEMPT") {
    requireFact(
      facts.rateBps === 0 &&
        facts.components.length === 0 &&
        !!facts.exemptionReason?.trim(),
      "INVALID_EXEMPTION",
    );
  } else {
    requireFact(
      facts.components.length > 0 &&
        facts.components.reduce((sum, c) => sum + c.rateBps, 0) ===
          facts.rateBps,
      "INVALID_TAX_COMPONENTS",
    );
  }
  const basePaise =
    facts.mode === "INCLUSIVE"
      ? fromBigInt(
          roundHalfUp(
            BigInt(amount) * BigInt(10000),
            BigInt(10000 + facts.rateBps),
          ),
        )
      : paise(amount);
  const taxPaise =
    facts.mode === "INCLUSIVE"
      ? subtractPaise(amount, basePaise)
      : percentage(basePaise, facts.rateBps);
  const components = allocatePaise(
    taxPaise,
    facts.components.map((c) => ({ key: c.key, weight: c.rateBps })),
  );
  return {
    basePaise,
    taxPaise,
    payablePaise: sumPaise([basePaise, taxPaise]),
    components: facts.components.map((c) => ({
      ...c,
      amountPaise: components.get(c.key)!,
    })),
  };
}
export function priceQuote(input: PricingInput) {
  const currencyCode = currency(input.currency);
  requireFact(input.country === "IN", "UNSUPPORTED_COUNTRY");
  integer(input.now);
  identifier(input.policyVersion);
  requireFact(
    input.lines.length > 0 && input.lines.length <= 100,
    "INVALID_LINE_COUNT",
  );
  requireFact(
    new Set(input.lines.map((l) => l.key)).size === input.lines.length,
    "DUPLICATE_LINE",
  );
  const prepared = input.lines.map((line) => {
    identifier(line.key);
    identifier(line.revision);
    identifier(line.expectedRevision);
    requireFact(
      line.productActive === true &&
        line.variantActive === true &&
        line.available === true,
      "UNAVAILABLE_LINE",
    );
    requireFact(line.revision === line.expectedRevision, "PRICE_CHANGED");
    integer(line.quantity, 1, 99);
    paise(line.mrpPaise);
    paise(line.unitPricePaise);
    requireFact(line.unitPricePaise <= line.mrpPaise, "SALE_EXCEEDS_MRP");
    return {
      line,
      salePaise: multiplyPaise(line.unitPricePaise, line.quantity),
      listPaise: multiplyPaise(line.mrpPaise, line.quantity),
    };
  });
  const saleSubtotalPaise = sumPaise(prepared.map((l) => l.salePaise));
  const listSubtotalPaise = sumPaise(prepared.map((l) => l.listPaise));
  let couponDiscountPaise = paise(0);
  let allocations: ReadonlyMap<string, number> = new Map();
  if (input.coupon) {
    const coupon = input.coupon;
    identifier(coupon.code);
    identifier(coupon.revision);
    integer(coupon.startsAt);
    integer(coupon.expiresAt);
    requireFact(
      coupon.startsAt < coupon.expiresAt &&
        coupon.active === true &&
        coupon.capacityAvailable === true &&
        input.now >= coupon.startsAt &&
        input.now < coupon.expiresAt,
      "COUPON_UNAVAILABLE",
    );
    requireFact(
      coupon.eligibleLineKeys.length > 0 &&
        new Set(coupon.eligibleLineKeys).size ===
          coupon.eligibleLineKeys.length &&
        coupon.eligibleLineKeys.every((key) =>
          prepared.some((l) => l.line.key === key),
        ),
      "INVALID_COUPON_ELIGIBILITY",
    );
    const eligible = prepared.filter((l) =>
      coupon.eligibleLineKeys.includes(l.line.key),
    );
    const eligiblePaise = sumPaise(eligible.map((l) => l.salePaise));
    requireFact(
      eligiblePaise >= paise(coupon.minEligiblePaise),
      "COUPON_MINIMUM",
    );
    requireFact(
      coupon.kind === "FIXED" || coupon.kind === "PERCENTAGE",
      "INVALID_COUPON_KIND",
    );
    const requested =
      coupon.kind === "FIXED"
        ? paise(coupon.value)
        : percentage(eligiblePaise, coupon.value);
    couponDiscountPaise = paise(
      Math.min(
        requested,
        eligiblePaise,
        coupon.maxDiscountPaise === undefined
          ? eligiblePaise
          : paise(coupon.maxDiscountPaise),
      ),
    );
    allocations = allocatePaise(
      couponDiscountPaise,
      eligible.map((l) => ({ key: l.line.key, weight: l.salePaise })),
    );
  }
  const lines = prepared.map(({ line, salePaise, listPaise }) => {
    const couponAllocationPaise = paise(allocations.get(line.key) ?? 0);
    return {
      key: line.key,
      quantity: line.quantity,
      unitPricePaise: paise(line.unitPricePaise),
      listPaise,
      salePaise,
      itemDiscountPaise: subtractPaise(listPaise, salePaise),
      couponAllocationPaise,
      ...calculateTax(
        subtractPaise(salePaise, couponAllocationPaise),
        line.tax,
      ),
    };
  });
  const goodsPayablePaise = sumPaise(lines.map((l) => l.payablePaise));
  paise(input.shipping.chargePaise);
  const free =
    input.shipping.freeAtGoodsPayablePaise !== undefined &&
    goodsPayablePaise >= paise(input.shipping.freeAtGoodsPayablePaise);
  const shipping = calculateTax(
    free ? 0 : input.shipping.chargePaise,
    input.shipping.tax,
  );
  return {
    currency: currencyCode,
    pricingVersion: "1",
    policyVersion: input.policyVersion,
    inputs: structuredClone(input),
    lines,
    shipping,
    totals: {
      listSubtotalPaise,
      saleSubtotalPaise,
      itemDiscountPaise: subtractPaise(listSubtotalPaise, saleSubtotalPaise),
      couponDiscountPaise,
      taxableSubtotalPaise: sumPaise(lines.map((l) => l.basePaise)),
      taxPaise: sumPaise(lines.map((l) => l.taxPaise)),
      goodsPayablePaise,
      shippingBasePaise: shipping.basePaise,
      shippingTaxPaise: shipping.taxPaise,
      roundingPaise: paise(0),
      grandTotalPaise: sumPaise([goodsPayablePaise, shipping.payablePaise]),
    },
  };
}
