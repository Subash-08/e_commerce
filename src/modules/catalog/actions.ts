"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { drainCatalogInvalidations } from "./cache";
import { ZodError } from "zod";
import { getCatalog } from "./runtime";
import { uploadImage } from "../media/upload";
export async function saveProduct(input: unknown) {
  try {
    const result = await (
      await getCatalog()
    ).save(new Headers(await headers()), input);
    try {
      await drainCatalogInvalidations();
      revalidatePath("/admin/products");
    } catch {
      /* Committed save; durable invalidation retries later. */
    }
    return { ok: true as const, id: result.id };
  } catch (error) {
    const messages: Record<string, string> = {
      REVISION_CONFLICT:
        "Someone saved a newer version. Reload and review their changes before saving again.",
      DB_DUPLICATE_KEY:
        "A SKU, barcode, product URL or variant combination is already in use. Archived records retain their identities.",
      CATEGORY_UNAVAILABLE:
        "Choose active categories, including the primary category.",
      BRAND_UNAVAILABLE: "Choose an active brand.",
      STOCK_BELOW_RESERVED: "Stock cannot be lower than the reserved quantity.",
      RESERVATIONS_EXIST:
        "Resolve active reservations before removing a variant or changing stock mode.",
      RETIRED_OPTION: "A retired option cannot be assigned to a new variant.",
      VARIANT_IDENTITY_IMMUTABLE:
        "Existing variant options cannot be changed in place. Generate and review the replacement combination.",
      COMBINATION_RESERVED:
        "This combination belongs to an existing or archived variant. Keep its original identity.",
      INCONSISTENT_VARIANT_AXES: "All variants must use the same option axes.",
      MEDIA_NOT_FOUND:
        "An assigned media asset is unavailable. Upload it again.",
      DUPLICATE_VARIANT: "Variant SKUs and option combinations must be unique.",
      PRODUCT_ARCHIVED: "This product is archived and cannot be edited.",
      INVALID_VARIANT_OPTION:
        "A variant references an invalid attribute or option.",
      ATTRIBUTE_VALUE_INVALID: "Check the type of each specification value.",
    };
    return {
      ok: false as const,
      message:
        error instanceof ZodError
          ? error.issues
              .map((i) => i.path.join(".") + ": " + i.message)
              .join("; ")
          : (messages[error instanceof Error ? error.message : ""] ??
            "The product could not be saved. Check your access and inputs."),
    };
  }
}
export async function uploadProductImage(form: FormData) {
  try {
    return {
      ok: true as const,
      asset: await uploadImage(
        new Headers(await headers()),
        form.get("file") as File,
        String(form.get("alt") ?? ""),
      ),
    };
  } catch {
    return {
      ok: false as const,
      message: "Choose a JPEG, PNG or WebP image up to 900 KB and try again.",
    };
  }
}

export async function findRelatedProducts(search: string, exclude?: string) {
  try {
    return {
      ok: true as const,
      rows: await (
        await getCatalog()
      ).findRelated(new Headers(await headers()), search, exclude),
    };
  } catch {
    return { ok: false as const, rows: [] };
  }
}
