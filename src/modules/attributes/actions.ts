"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { drainCatalogInvalidations } from "../catalog/cache";
import { ZodError } from "zod";
import { getDatabase } from "../../server/db/connection";
import { getIdentity } from "../identity/runtime";
import { attributeService } from "./service";

export async function saveAttribute(input: unknown) {
  try {
    const identity = await getIdentity();
    const result = await attributeService(await getDatabase(), (h) =>
      identity.requireAccess(h, "catalog.manage"),
    ).save(new Headers(await headers()), input);
    try {
      await drainCatalogInvalidations();
      revalidatePath("/admin/attributes");
    } catch {
      /* Committed; invalidation retries later. */
    }
    return { ok: true as const, id: result.id };
  } catch (error) {
    const messages: Record<string, string> = {
      DB_DUPLICATE_KEY: "That attribute code already exists.",
      REVISION_CONFLICT: "This attribute changed. Reload before saving.",
      ATTRIBUTE_TYPE_IN_USE:
        "Type and unit cannot change while products use this attribute.",
      ATTRIBUTE_AXIS_IN_USE:
        "Existing variants use this axis. Retire it to stop new use.",
      RETIRE_OPTIONS_INSTEAD_OF_DELETING:
        "Retire existing options instead of deleting them.",
      ATTRIBUTE_CODE_IMMUTABLE: "The stable attribute code cannot be changed.",
    };
    return {
      ok: false as const,
      message:
        error instanceof ZodError
          ? error.issues.map((i) => i.message).join(" ")
          : (messages[error instanceof Error ? error.message : ""] ??
            "Unable to save. Check your access and try again."),
    };
  }
}
