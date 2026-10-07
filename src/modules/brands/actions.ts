"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getBrands } from "./runtime";
import { drainBrandInvalidations } from "./cache";
import { uploadImage } from "../media/upload";

const messages: Record<string, string> = {
  BRAND_ARCHIVED: "Archived brands cannot be restored in this version.",
  BRAND_IN_USE:
    "Reassign this brand's products before deactivating or archiving it.",
  BRAND_NOT_FOUND: "That brand no longer exists.",
  SLUG_RESERVED: "This URL is reserved by another brand's redirect history.",
  DB_DUPLICATE_KEY: "This brand URL already exists. Choose another slug.",
  REVISION_CONFLICT:
    "Another administrator changed this brand. Refresh before saving.",
  AUTH_REQUIRED: "Sign in again before saving.",
  FORBIDDEN: "Your account cannot manage brands.",
  MEDIA_CONFIG_REQUIRED: "Cloudinary is not configured on the server.",
  MEDIA_UPLOAD_FAILED: "The image could not be uploaded. Please try again.",
  IMAGE_INVALID: "Choose a JPEG, PNG or WebP image smaller than 900 KB.",
};

function failure(error: unknown) {
  return error instanceof ZodError
    ? error.issues
        .map((issue) => issue.path.join(".") + ": " + issue.message)
        .join("; ")
    : (messages[error instanceof Error ? error.message : ""] ??
        "The request could not be completed. Please try again.");
}

export async function saveBrand(input: unknown) {
  try {
    const result = await (
      await getBrands()
    ).save(new Headers(await headers()), input);
    try {
      await drainBrandInvalidations();
    } catch {
      // The transaction has committed; the durable job remains retryable.
    }
    revalidatePath("/admin/brands");
    return { ok: true as const, message: "Brand saved.", id: result.id };
  } catch (error) {
    return { ok: false as const, message: failure(error) };
  }
}

export async function uploadBrandLogo(form: FormData) {
  try {
    const asset = await uploadImage(
      new Headers(await headers()),
      form.get("file") as File,
      String(form.get("alt") ?? ""),
    );
    return { ok: true as const, asset };
  } catch (error) {
    return { ok: false as const, message: failure(error) };
  }
}
