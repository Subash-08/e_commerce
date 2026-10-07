"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getIdentity } from "./runtime";
const messages: Record<string, string> = {
  LAST_ADMIN_REQUIRED:
    "Keep at least one active administrator. Promote another user before making this change.",
  REVISION_CONFLICT:
    "This user changed since you opened the page. Refresh and try again.",
  AUTH_REQUIRED: "Your session has changed. Sign in again.",
  FORBIDDEN: "Only administrators can manage users.",
  ADMIN_BOOTSTRAP_REQUIRED:
    "Complete the owner bootstrap before changing access.",
};
function failure(error: unknown) {
  return {
    ok: false,
    message:
      messages[error instanceof Error ? error.message : ""] ??
      "The change could not be saved. Check your connection and try again.",
  };
}
export async function changeUserAuthority(input: unknown) {
  try {
    const identity = await getIdentity();
    await identity.administration.changeAuthority(
      new Headers(await headers()),
      input,
    );
    revalidatePath("/admin/users");
    return {
      ok: true,
      message: "Access updated. Previous sessions no longer grant access.",
    };
  } catch (error) {
    return failure(error);
  }
}
export async function retryUserRevocations() {
  try {
    const identity = await getIdentity();
    await identity.administration.retryFromAdmin(new Headers(await headers()));
    revalidatePath("/admin/users");
    return { ok: true, message: "Pending session cleanup checked." };
  } catch (error) {
    return failure(error);
  }
}
