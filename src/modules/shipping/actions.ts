"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { saveShipping, previewShipping, recordTaxReview } from "./service";
function failure(error: unknown) {
  const messages: Record<string, string> = {
    TAX_REVIEW_DATE_INVALID: "Review date cannot be in the future.",
    REVISION_CONFLICT:
      "Another administrator saved changes. Reload and review the current revision before saving.",
    DB_DUPLICATE_KEY:
      "Shipping was configured by another administrator. Reload before saving.",
    FORBIDDEN: "Only active administrators can manage shipping.",
    AUTH_REQUIRED: "Sign in again to continue.",
    RATE_LIMITED: "Please wait a minute and try again.",
    SHIPPING_CONFIGURATION_REQUIRED:
      "Stored shipping configuration is invalid or from an unsupported version. Restore a reviewed policy before proceeding.",
    SHIPPING_TAX_CONFIGURATION_REQUIRED:
      "Choose an existing valid tax policy, or leave it unconfigured while awaiting review.",
    SHIPPING_TAX_POLICY_REQUIRED:
      "Enabled shipping requires a selected shipping tax policy. Select the reviewed policy and save again.",
    COD_TAX_POLICY_REQUIRED:
      "A positive COD surcharge requires a selected COD tax policy.",
  };
  return {
    ok: false as const,
    message:
      error instanceof ZodError
        ? "Please correct the highlighted fields."
        : (messages[error instanceof Error ? error.message : ""] ??
          "Shipping settings are temporarily unavailable. Your changes have not been confirmed. Retry or reload to check the current revision."),
    fields:
      error instanceof ZodError
        ? Object.fromEntries(
            error.issues.map((i) => [i.path.join("."), i.message]),
          )
        : {},
  };
}
export async function recordTaxReviewAction(input: unknown) {
  try {
    await recordTaxReview(new Headers(await headers()), input);
    return {
      ok: true as const,
      message:
        "Reviewed tax evidence recorded. Now select this policy in Tax references and save Shipping Settings.",
    };
  } catch (error) {
    return failure(error);
  }
}
export async function saveShippingAction(input: unknown, revision: unknown) {
  try {
    const result = await saveShipping(
      new Headers(await headers()),
      input,
      revision,
    );
    revalidatePath("/admin/settings/shipping");
    return { ok: true as const, ...result };
  } catch (error) {
    return failure(error);
  }
}
export async function previewShippingAction(
  input: unknown,
  destination: unknown,
) {
  try {
    return {
      ok: true as const,
      result: await previewShipping(
        new Headers(await headers()),
        input,
        destination,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
