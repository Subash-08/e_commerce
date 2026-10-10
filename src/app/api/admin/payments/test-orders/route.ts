import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyTicket } from "@/modules/cart/security";
import { placeOnlineTestOrder } from "@/modules/orders/service";
import { bindTestOrder } from "@/modules/payments/binding";
import { cleanupTestOrder } from "@/modules/payments/cleanup";
import { requirePaymentTestAdmin } from "@/modules/payments/access";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), command: z.unknown() }).strict(),
  z
    .object({
      action: z.literal("bind"),
      orderId: z.string().regex(/^[a-f0-9]{24}$/),
    })
    .strict(),
  z
    .object({
      action: z.literal("cleanup"),
      orderId: z.string().regex(/^[a-f0-9]{24}$/),
    })
    .strict(),
]);
const reply = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return reply({ code: "FORBIDDEN" }, 403);
  try {
    await requirePaymentTestAdmin(request.headers);
    const reader = request.body?.getReader();
    if (!reader) return reply({ code: "INVALID_INPUT" }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 35000) {
          await reader.cancel();
          return reply({ code: "BODY_TOO_LARGE" }, 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const command = input.parse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    if (command.action === "bind")
      return reply(await bindTestOrder(request.headers, command.orderId));
    if (command.action === "cleanup")
      return reply(await cleanupTestOrder(request.headers, command.orderId));
    const key = (await cookies()).get("commerce-checkout")?.value;
    if (!key) return reply({ code: "QUOTE_NOT_FOUND" }, 400);
    verifyTicket(key, "checkout-cookie");
    const result = await placeOnlineTestOrder(
      request.headers,
      key,
      command.command,
    );
    // Binding is a separate retry-safe action. No provider checkout options in 2B.1.
    return reply(result, result.replay ? 200 : 201);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const known = [
      "PAYMENT_TEST_ONLY",
      "PAYMENT_CONFIG_INVALID",
      "FORBIDDEN",
      "AUTH_REQUIRED",
      "ORDER_NOT_FOUND",
      "QUOTE_NOT_FOUND",
      "QUOTE_EXPIRED",
      "QUOTE_CHANGED",
      "QUOTE_ALREADY_ACCEPTED",
      "CART_CHANGED",
      "STOCK_CHANGED",
      "COUPON_UNAVAILABLE",
      "IDEMPOTENCY_CONFLICT",
      "REVISION_CONFLICT",
      "RATE_LIMITED",
      "PAYMENT_CLEANUP_REQUIRES_REVIEW",
      "PAYMENT_ACCOUNT_CHANGED",
    ];
    const safe = known.includes(code)
      ? code
      : error instanceof z.ZodError || error instanceof SyntaxError
        ? "INVALID_INPUT"
        : "PAYMENT_UNAVAILABLE";
    const status =
      safe === "RATE_LIMITED"
        ? 429
        : ["FORBIDDEN", "AUTH_REQUIRED", "PAYMENT_TEST_ONLY"].includes(safe)
          ? 403
          : safe === "PAYMENT_UNAVAILABLE"
            ? 503
            : safe === "INVALID_INPUT"
              ? 400
              : 409;
    return reply(
      {
        code: safe,
        message:
          "The operation was not completed. Reload the order status before retrying.",
      },
      status,
    );
  }
}
