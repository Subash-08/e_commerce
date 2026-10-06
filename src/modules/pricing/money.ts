import { integer, requireFact } from "../../shared/domain/errors";
declare const moneyBrand: unique symbol;
declare const bpsBrand: unique symbol;
export type MoneyPaise = number & { readonly [moneyBrand]: true };
export type BasisPoints = number & { readonly [bpsBrand]: true };
export type CurrencyCode = "INR";
export const MAX_MONEY_PAISE = Number.MAX_SAFE_INTEGER - 1;
export function paise(value: number): MoneyPaise {
  return integer(value, 0, MAX_MONEY_PAISE) as MoneyPaise;
}
export function basisPoints(value: number): BasisPoints {
  return integer(value, 0, 10000) as BasisPoints;
}
export function currency(value: string): CurrencyCode {
  requireFact(value === "INR", "UNSUPPORTED_CURRENCY");
  return value;
}
export function fromBigInt(value: bigint): MoneyPaise {
  requireFact(
    value >= BigInt(0) && value <= BigInt(MAX_MONEY_PAISE),
    "MONEY_OVERFLOW",
  );
  return paise(Number(value));
}
export function sumPaise(values: readonly number[]): MoneyPaise {
  return fromBigInt(
    values.reduce((sum, value) => sum + BigInt(paise(value)), BigInt(0)),
  );
}
export function multiplyPaise(value: number, count: number): MoneyPaise {
  return fromBigInt(BigInt(paise(value)) * BigInt(integer(count)));
}
export function subtractPaise(a: number, b: number): MoneyPaise {
  return fromBigInt(BigInt(paise(a)) - BigInt(paise(b)));
}
export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  requireFact(
    numerator >= BigInt(0) && denominator > BigInt(0),
    "INVALID_RATIO",
  );
  return (numerator * BigInt(2) + denominator) / (denominator * BigInt(2));
}
export function percentage(value: number, rate: number): MoneyPaise {
  return fromBigInt(
    roundHalfUp(
      BigInt(paise(value)) * BigInt(basisPoints(rate)),
      BigInt(10000),
    ),
  );
}
/** Largest remainders, then code-unit key order: independent of locale and input order. */
export function allocatePaise(
  total: number,
  weights: readonly { key: string; weight: number }[],
): ReadonlyMap<string, MoneyPaise> {
  paise(total);
  requireFact(
    new Set(weights.map((w) => w.key)).size === weights.length,
    "DUPLICATE_ALLOCATION_KEY",
  );
  const denominator = weights.reduce(
    (sum, w) => sum + BigInt(paise(w.weight)),
    BigInt(0),
  );
  requireFact(denominator > BigInt(0) || total === 0, "EMPTY_ALLOCATION");
  const rows = weights.map((w) => {
    const numerator = BigInt(total) * BigInt(w.weight);
    return {
      key: w.key,
      value: denominator ? numerator / denominator : BigInt(0),
      remainder: denominator ? numerator % denominator : BigInt(0),
    };
  });
  let remaining =
    BigInt(total) - rows.reduce((sum, row) => sum + row.value, BigInt(0));
  rows.sort((a, b) =>
    a.remainder === b.remainder
      ? a.key < b.key
        ? -1
        : a.key > b.key
          ? 1
          : 0
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (const row of rows) {
    if (remaining === BigInt(0)) break;
    row.value++;
    remaining--;
  }
  requireFact(remaining === BigInt(0), "ALLOCATION_FAILURE");
  return new Map(rows.map((row) => [row.key, fromBigInt(row.value)]));
}
