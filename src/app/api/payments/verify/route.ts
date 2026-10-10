import { NextResponse } from "next/server";
import { z } from "zod";
import { readPaymentBody } from "@/modules/payments/proof";
import {
  prepareTestCheckout,
  verifyTestCheckoutCallback,
} from "@/modules/payments/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const start = z
  .object({ action: z.literal("start"), orderNumber: z.string() })
  .strict();
const verify = z
  .object({
    action: z.literal("verify"),
    orderNumber: z.string(),
    paymentId: z.string(),
    signature: z.string(),
  })
  .strict();
const body = z.discriminatedUnion("action", [start, verify]);

function reply(value: object, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return reply({ code: "FORBIDDEN" }, 403);
  try {
    const input = body.parse(
      JSON.parse((await readPaymentBody(request, 4096)).toString("utf8")),
    );
    if (input.action === "start")
      return reply({
        checkout: await prepareTestCheckout(request.headers, input.orderNumber),
      });
    return reply({
      payment: await verifyTestCheckoutCallback(request.headers, input),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const validation = error instanceof z.ZodError || code === "INVALID_INPUT";
    const safe = [
      "FORBIDDEN",
      "AUTH_REQUIRED",
      "RATE_LIMITED",
      "ORDER_NOT_FOUND",
      "PAYMENT_NOT_READY",
      "PAYMENT_BINDING_PENDING",
      "PAYMENT_SIGNATURE_INVALID",
      "PAYMENT_ACTIVITY_REVIEW_REQUIRED",
      "PAYMENT_TEST_ONLY",
      "PAYMENT_CONFIG_INVALID",
    ].includes(code)
      ? code
      : validation
        ? "INVALID_INPUT"
        : "PAYMENT_UNAVAILABLE";
    const status =
      safe === "RATE_LIMITED"
        ? 429
        : ["FORBIDDEN", "AUTH_REQUIRED", "PAYMENT_TEST_ONLY"].includes(safe)
          ? 403
          : safe === "ORDER_NOT_FOUND"
            ? 404
            : safe === "PAYMENT_SIGNATURE_INVALID"
              ? 400
              : safe === "PAYMENT_UNAVAILABLE"
                ? 503
                : 409;
    return reply(
      {
        code: safe,
        message:
          safe === "PAYMENT_SIGNATURE_INVALID"
            ? "The payment callback could not be verified. Refresh the order before retrying."
            : "Payment status is still being confirmed. Refresh the order before trying again.",
      },
      status,
    );
  }
}
