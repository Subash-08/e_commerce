import { calculateTax } from "../pricing/price.ts";
import { fromBigInt, roundHalfUp } from "../pricing/money.ts";
export function priceBreakdown(
  amount: number,
  mode: "INCLUSIVE" | "EXCLUSIVE",
  rateBps: number,
) {
  return calculateTax(amount, {
    mode,
    rateBps,
    components: [{ key: "GST", rateBps }],
  });
}
export function parsePaise(text: string): number | null {
  if (!/^\d{1,10}(?:\.\d{0,2})?$/.test(text)) return null;
  const [whole, decimals = ""] = text.split(".");
  return Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
}
export function discountedPrice(mrp: number, discountBps: number) {
  return (
    mrp -
    fromBigInt(roundHalfUp(BigInt(mrp) * BigInt(discountBps), BigInt(10000)))
  );
}
