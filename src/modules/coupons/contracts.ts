import { z } from "zod";
import { stateValues } from "../../shared/domain/states.generated";
const ids = z
  .array(z.string().regex(/^[a-f0-9]{24}$/))
  .max(100)
  .refine(
    (value) => new Set(value).size === value.length,
    "Remove duplicate selections.",
  );
const money = z.number().int().min(0).max(10000000000);
export const couponInput = z
  .object({
    id: z
      .string()
      .regex(/^[a-f0-9]{24}$/)
      .optional(),
    revision: z.number().int().min(0).default(0),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{2,19}$/),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).default(""),
    kind: z.enum(stateValues.CouponKind),
    value: z.number().int().min(0).max(10000000000),
    maxDiscountPaise: money.nullable().default(null),
    minEligiblePaise: money.default(0),
    startsAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    active: z.boolean(),
    archived: z.boolean().default(false),
    scope: z.enum(["ALL", "PRODUCT", "VARIANT", "CATEGORY", "BRAND"]),
    targetIds: ids,
    excludedProductIds: ids,
    includeDescendants: z.boolean().default(true),
    excludeSaleItems: z.boolean().default(false),
    audience: z.enum(["EVERYONE", "ACCOUNT", "SPECIFIC"]),
    allowedUserIds: z.array(z.string().trim().min(1).max(128)).max(100),
    usageLimit: z.number().int().positive().max(10000000).nullable(),
    perAccountLimit: z.number().int().positive().max(100000).nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (value.kind === "PERCENTAGE" && value.value > 10000)
      fail("value", "Percentage cannot exceed 100%.");
    if (value.kind === "FREE_SHIPPING" && value.value !== 0)
      fail("value", "Free-shipping coupons do not use a merchandise value.");
    if (value.kind !== "FREE_SHIPPING" && value.value === 0)
      fail("value", "Enter a positive merchandise discount.");
    if (value.kind === "FIXED" && value.maxDiscountPaise !== null)
      fail("maxDiscountPaise", "A fixed coupon already has a fixed maximum.");
    if (value.maxDiscountPaise === 0)
      fail("maxDiscountPaise", "Maximum discount must be positive.");
    if (Date.parse(value.expiresAt) <= Date.parse(value.startsAt))
      fail("expiresAt", "End must be after start.");
    if ((value.scope === "ALL") !== (value.targetIds.length === 0))
      fail("targetIds", "Select targets only for a restricted scope.");
    if ((value.audience === "SPECIFIC") !== value.allowedUserIds.length > 0)
      fail(
        "allowedUserIds",
        "Choose accounts only for a specific-account coupon.",
      );
    if (value.perAccountLimit && value.audience === "EVERYONE")
      fail("audience", "Per-account limits require sign in.");
  });
export type CouponInput = z.infer<typeof couponInput>;
export type CouponItemFacts = {
  key: string;
  productId: string;
  variantId: string;
  brandId: string;
  categoryIds: string[];
  sale: boolean;
};
export function eligibleKeys(
  coupon: Pick<
    CouponInput,
    "scope" | "targetIds" | "excludedProductIds" | "excludeSaleItems"
  >,
  items: CouponItemFacts[],
) {
  const targets = new Set(coupon.targetIds);
  return items
    .filter(
      (item) =>
        !coupon.excludedProductIds.includes(item.productId) &&
        !(coupon.excludeSaleItems && item.sale) &&
        (coupon.scope === "ALL" ||
          (coupon.scope === "PRODUCT" && targets.has(item.productId)) ||
          (coupon.scope === "VARIANT" && targets.has(item.variantId)) ||
          (coupon.scope === "BRAND" && targets.has(item.brandId)) ||
          (coupon.scope === "CATEGORY" &&
            item.categoryIds.some((id) => targets.has(id)))),
    )
    .map((item) => item.key);
}
