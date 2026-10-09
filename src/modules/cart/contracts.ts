import { z } from "zod";

export const MAX_LINES = 50;
export const MAX_QUANTITY = 99;
export const cartLine = z
  .object({
    productId: z.string().regex(/^[a-f0-9]{24}$/),
    variantId: z.string().regex(/^[a-f0-9]{24}$/),
    quantity: z.number().int().min(1).max(MAX_QUANTITY),
  })
  .strict();
export const cartLines = z
  .array(cartLine)
  .max(MAX_LINES)
  .refine(
    (lines) =>
      new Set(lines.map((line) => line.variantId)).size === lines.length,
    "Each variant may appear only once.",
  );
export type CartLine = z.infer<typeof cartLine>;
export type ResolvedLine = CartLine & {
  name: string;
  title: string;
  url: string | null;
  image: { url: string; alt: string } | null;
  unitPaise: number;
  payablePaise: number;
  maximumQuantity: number;
  issue: string | null;
  priceChanged?: boolean;
};
export type CartView = {
  owner: string | null;
  revision: number;
  items: ResolvedLine[];
  count: number;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  coupon: string;
  couponMessage: string | null;
  couponEffect: {
    kind: "FIXED" | "PERCENTAGE" | "FREE_SHIPPING";
    revision: string;
    maxDiscountPaise: number | null;
  } | null;
  ready: boolean;
};

/** Pure bounded merge: rejected quantities remain with the guest. */
export function mergeLines(
  current: CartLine[],
  incoming: CartLine[],
  limits: Map<string, number>,
) {
  const items = current.map((line) => ({ ...line }));
  const remaining: CartLine[] = [];
  for (const line of incoming) {
    const existing = items.find((item) => item.variantId === line.variantId);
    const capacity =
      existing && existing.productId !== line.productId
        ? 0
        : !existing && items.length >= MAX_LINES
          ? 0
          : Math.max(
              0,
              Math.min(MAX_QUANTITY, limits.get(line.variantId) ?? 0) -
                (existing?.quantity ?? 0),
            );
    const accepted = Math.min(capacity, line.quantity);
    if (accepted) {
      if (existing) existing.quantity += accepted;
      else items.push({ ...line, quantity: accepted });
    }
    if (accepted < line.quantity)
      remaining.push({ ...line, quantity: line.quantity - accepted });
  }
  return { items, remaining };
}
