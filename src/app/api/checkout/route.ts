import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { issueTicket, verifyTicket } from "@/modules/cart/security";
import { placeCodOrder } from "@/modules/orders/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  QUOTE_NOT_FOUND: "Create a new quote before placing the order.",
  QUOTE_EXPIRED: "Your quote expired. Review a new live quote.",
  QUOTE_CHANGED:
    "Price, availability, or store policy changed. Review a new quote.",
  CART_CHANGED: "Your cart changed. Review it again before placing the order.",
  STOCK_CHANGED:
    "Stock changed while placing the order. Review your cart again.",
  COUPON_UNAVAILABLE: "The coupon is no longer available. Review a new quote.",
  COD_UNAVAILABLE: "Cash on delivery is not available for this order.",
  ONLINE_PAYMENT_NOT_AVAILABLE:
    "Online payment is not enabled yet. Choose cash on delivery.",
  IDEMPOTENCY_CONFLICT:
    "This submission key was already used for different order details.",
  RATE_LIMITED: "Too many order attempts. Wait a minute and try again.",
};

export async function POST(request: Request) {
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return new Response(null, { status: 403 });
  const raw = await request.text();
  if (raw.length > 35000) return new Response(null, { status: 413 });
  try {
    const jar = await cookies();
    const key = jar.get("commerce-checkout")?.value;
    try {
      if (!key) throw new Error();
      verifyTicket(key, "checkout-cookie");
    } catch {
      throw new Error("QUOTE_NOT_FOUND");
    }
    const result = await placeCodOrder(request.headers, key, JSON.parse(raw));
    jar.set(
      "commerce-order-" + result.order.orderNumber,
      issueTicket("guest-order:" + result.orderId, 24 * 60 * 60 * 1000),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(request.url).protocol === "https:",
        path: "/order/" + result.order.orderNumber,
        maxAge: 24 * 60 * 60,
      },
    );
    return NextResponse.json(result, {
      status: result.replay ? 200 : 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const invalid =
      error instanceof SyntaxError ||
      (error instanceof Error && error.name === "ZodError");
    const status =
      code === "QUOTE_CHANGED" ||
      code === "CART_CHANGED" ||
      code === "STOCK_CHANGED" ||
      code === "IDEMPOTENCY_CONFLICT"
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
            ? "Check the order details and try again."
            : "The order could not be placed. No stock or coupon was committed."),
      },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
