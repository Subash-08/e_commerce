import { NextResponse } from "next/server";
import { readPaymentBody, verifyPaymentHmac } from "@/modules/payments/proof";
import { persistWebhook } from "@/modules/payments/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let raw: Buffer;
  try {
    raw = await readPaymentBody(request, 128 * 1024);
  } catch (error) {
    return NextResponse.json(
      {
        code:
          error instanceof Error && error.message === "BODY_TOO_LARGE"
            ? "BODY_TOO_LARGE"
            : "INVALID_INPUT",
      },
      {
        status:
          error instanceof Error && error.message === "BODY_TOO_LARGE"
            ? 413
            : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (secret.length < 32)
    return NextResponse.json(
      { code: "WEBHOOK_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  try {
    verifyPaymentHmac(
      raw,
      request.headers.get("x-razorpay-signature") ?? "",
      secret,
    );
  } catch {
    return NextResponse.json(
      { code: "PAYMENT_SIGNATURE_INVALID" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const result = await persistWebhook(
      raw,
      request.headers.get("x-razorpay-event-id"),
    );
    return NextResponse.json(
      { accepted: true, duplicate: result.duplicate },
      {
        status: result.duplicate ? 200 : 202,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_WEBHOOK")
      return NextResponse.json(
        { code },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    if (code === "WEBHOOK_DELIVERY_CONFLICT")
      return NextResponse.json(
        { code },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    return NextResponse.json(
      { code: "WEBHOOK_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
