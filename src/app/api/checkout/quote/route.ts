import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createCheckoutQuote } from "@/modules/checkout/service";
import { issueTicket, verifyTicket } from "@/modules/cart/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const messages: Record<string, string> = {
  CART_EMPTY: "Your cart is empty.",
  CART_CHANGED: "Your cart changed. Refresh and review it before continuing.",
  CART_UNAVAILABLE: "Resolve unavailable items in your cart first.",
  COUPON_UNAVAILABLE: "This coupon is not eligible for this checkout.",
  DESTINATION_UNSUPPORTED: "Delivery is not available for this destination.",
  SHIPPING_DISABLED: "Delivery is currently disabled.",
  COD_UNAVAILABLE: "Cash on delivery is not available for this destination.",
  SHIPPING_CONFIGURATION_REQUIRED:
    "Delivery settings are incomplete. Please contact the store.",
  SHIPPING_TAX_CONFIGURATION_REQUIRED:
    "Delivery tax settings are incomplete. Checkout is temporarily unavailable.",
  SHIPPING_TAX_REVIEW_REQUIRED:
    "Delivery tax review is pending. Checkout is temporarily unavailable.",
  INVALID_CHECKOUT_TOTAL: "This checkout total cannot be processed.",
  RATE_LIMITED: "Too many quote requests. Wait a minute and try again.",
  AUTH_REQUIRED: "Your session expired. Sign in again or continue as a guest.",
};
export async function POST(request: Request) {
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return new Response(null, { status: 403 });
  const raw = await request.text();
  if (raw.length > 30000) return new Response(null, { status: 413 });
  try {
    const jar = await cookies();
    let key = jar.get("commerce-checkout")?.value;
    try {
      if (!key) throw new Error();
      verifyTicket(key, "checkout-cookie");
    } catch {
      key = issueTicket("checkout-cookie", 60 * 60 * 1000);
      jar.set("commerce-checkout", key, {
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(request.url).protocol === "https:",
        path: "/",
        maxAge: 3600,
      });
    }
    const quote = await createCheckoutQuote(
      request.headers,
      key!,
      JSON.parse(raw),
    );
    return NextResponse.json(
      { quote },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const invalid =
      error instanceof SyntaxError ||
      (error instanceof Error && error.name === "ZodError");
    const status =
      code === "CART_CHANGED"
        ? 409
        : code === "RATE_LIMITED"
          ? 429
          : messages[code] || invalid
            ? 400
            : 503;
    return NextResponse.json(
      {
        code: messages[code] ? code : invalid ? "INVALID_INPUT" : "UNAVAILABLE",
        message:
          messages[code] ??
          (invalid
            ? "Check the highlighted checkout details."
            : "Checkout is temporarily unavailable. Your cart has not been changed."),
      },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
