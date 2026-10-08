"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { saveCoupon } from "./service";
export async function saveCouponAction(input: unknown) {
  try {
    const id = await saveCoupon(new Headers(await headers()), input);
    revalidatePath("/admin/coupons");
    return {
      ok: true as const,
      id,
      message: "Coupon saved. Cart previews use these rules immediately.",
    };
  } catch (error) {
    const messages: Record<string, string> = {
      REVISION_CONFLICT:
        "Another administrator changed this coupon. Reload before saving.",
      COUPON_CODE_IMMUTABLE:
        "An existing coupon code cannot change. Create a new coupon instead.",
      COUPON_ARCHIVED:
        "Archived coupons cannot be edited. Create a new coupon instead.",
      COUPON_TARGET_INVALID: "Some selected catalog entries no longer exist.",
      COUPON_ACCOUNT_INVALID:
        "Every selected account must exist and be active.",
      DB_DUPLICATE_KEY:
        "This code is already used, including by an archived coupon.",
      AUTH_REQUIRED: "Sign in again before saving.",
      FORBIDDEN: "Only administrators can manage coupons.",
      RATE_LIMITED: "Please wait a minute before saving again.",
    };
    return {
      ok: false as const,
      message:
        error instanceof ZodError
          ? error.issues
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; ")
          : (messages[error instanceof Error ? error.message : ""] ??
            "Coupon could not be saved. Please try again."),
    };
  }
}
