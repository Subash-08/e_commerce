"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCategories } from "./runtime";
import { drainCategoryInvalidations } from "./cache";
import { uploadImage } from "../media/upload";
const messages: Record<string, string> = {
  CATEGORY_CYCLE: "A category cannot be its own ancestor.",
  CATEGORY_DEPTH: "Keep the category tree within four levels.",
  CATEGORY_PARENT_UNAVAILABLE:
    "Choose an active parent for active categories. Move or deactivate children before changing their parent’s availability.",
  CATEGORY_ARCHIVED: "Archived categories cannot be restored in this version.",
  CATEGORY_IN_USE:
    "Reassign this category’s products before deactivating or archiving it.",
  CATEGORY_LIMIT: "The 1,000-category limit has been reached.",
  SLUG_RESERVED: "This URL is reserved by another category’s redirect history.",
  DB_DUPLICATE_KEY: "This category URL already exists. Choose another slug.",
  REVISION_CONFLICT:
    "Another administrator changed this category. Refresh before saving.",
  AUTH_REQUIRED: "Sign in again before saving.",
  FORBIDDEN: "Your account cannot manage categories.",
  MEDIA_CONFIG_REQUIRED: "Cloudinary is not configured on the server.",
  MEDIA_UPLOAD_FAILED: "The image could not be uploaded. Please try again.",
  CATEGORY_NOT_FOUND: "That category no longer exists.",
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
export async function saveCategory(input: unknown) {
  try {
    const result = await (
      await getCategories()
    ).save(new Headers(await headers()), input);
    try {
      await drainCategoryInvalidations();
    } catch {
      /* Transaction has committed; durable job retries later. */
    }
    revalidatePath("/admin/categories");
    return { ok: true as const, message: "Category saved.", id: result.id };
  } catch (error) {
    return { ok: false as const, message: failure(error) };
  }
}
export async function uploadCategoryImage(form: FormData) {
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
