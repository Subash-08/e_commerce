"use server";
import { headers } from "next/headers";
import { ZodError } from "zod";
import { deleteSavedAddress, saveSavedAddress } from "./service";

function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    AUTH_REQUIRED: "Sign in again to manage addresses.",
    FORBIDDEN: "Your account cannot manage saved addresses.",
    ADDRESS_NOT_FOUND: "This address no longer exists. Reload and try again.",
    ADDRESS_CHANGED: "This address changed in another tab. Reload it first.",
    ADDRESS_LIMIT: "You can save up to 10 addresses.",
    REVISION_CONFLICT: "Your address book changed. Reload and try again.",
    RATE_LIMITED: "Too many changes. Wait a minute and try again.",
  };
  return {
    ok: false as const,
    message:
      error instanceof ZodError
        ? (error.issues[0]?.message ?? "Check the address.")
        : (messages[code] ?? "The address could not be saved."),
  };
}
export async function saveAddressAction(input: unknown) {
  try {
    return {
      ok: true as const,
      message: "Address saved.",
      addresses: await saveSavedAddress(new Headers(await headers()), input),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function deleteAddressAction(input: unknown) {
  try {
    return {
      ok: true as const,
      message: "Address removed.",
      addresses: await deleteSavedAddress(new Headers(await headers()), input),
    };
  } catch (error) {
    return failure(error);
  }
}
