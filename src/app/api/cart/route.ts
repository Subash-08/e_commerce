import { NextResponse } from "next/server";

import { cookies } from "next/headers";
import { cartRequest } from "@/modules/cart/service";
import { getDatabase } from "@/server/db/connection";
import { rateLimit, issueTicket, verifyTicket } from "@/modules/cart/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  AUTH_REQUIRED:
    "Your session changed. Sign in again or continue with a guest cart.",
  REVISION_CONFLICT:
    "Your cart changed in another tab. Review the refreshed cart and try again.",
  REQUEST_EXPIRED:
    "This request expired. Refresh your cart before trying again.",
  TOKEN_REUSED: "This request was already used. Refresh your cart.",
  CART_LIMIT: "A cart supports 50 different items and up to 99 units per item.",
  ITEM_UNAVAILABLE:
    "This quantity is no longer available. Review the updated cart.",
  RATE_LIMITED: "Too many requests. Please wait a minute and try again.",
};
async function handle(request: Request, input: unknown) {
  try {
    const jar = await cookies();
    let guest = jar.get("commerce-guest")?.value;
    let validGuest = false;
    try {
      if (guest) {
        verifyTicket(guest, "guest-cookie");
        validGuest = true;
      }
    } catch {
      /* Issue a bounded signed identity below. */
    }
    if (!validGuest) {
      await rateLimit((await getDatabase()).db, "cart-cookie-issue", 1200);
      guest = issueTicket("guest-cookie", 30 * 86400000);
      jar.set("commerce-guest", guest, {
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(request.url).protocol === "https:",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return NextResponse.json(
      await cartRequest(request.headers, guest!, input),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const validation = error instanceof Error && error.name === "ZodError";
    const status =
      code === "AUTH_REQUIRED"
        ? 401
        : code === "RATE_LIMITED"
          ? 429
          : code === "REVISION_CONFLICT"
            ? 409
            : messages[code] || validation
              ? 400
              : 503;
    return NextResponse.json(
      {
        code: messages[code]
          ? code
          : validation
            ? "INVALID_INPUT"
            : "UNAVAILABLE",
        message:
          messages[code] ??
          (validation
            ? "Check the cart request and try again."
            : "Cart services are temporarily unavailable. Your saved selections have not been removed."),
      },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
export async function GET(request: Request) {
  return handle(request, { action: "resolve" });
}
export async function POST(request: Request) {
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return new Response(null, { status: 403 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    length += next.value.length;
    if (length > 24000) {
      await reader.cancel();
      return new Response(null, { status: 413 });
    }
    chunks.push(next.value);
  }
  let input: unknown;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return new Response(null, { status: 400 });
  }
  return handle(request, input);
}
