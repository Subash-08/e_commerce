import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { cancelOwnedOrder, readOwnedOrder } from "@/modules/orders/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await context.params;
  try {
    const jar = await cookies();
    const order = await readOwnedOrder(
      await headers(),
      orderNumber,
      jar.get("commerce-order-" + orderNumber)?.value,
    );
    return NextResponse.json(
      { order },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { code: "ORDER_NOT_FOUND", message: "Order not found." },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await context.params;
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return new Response(null, { status: 403 });
  try {
    const raw = await request.json();
    const jar = await cookies();
    const result = await cancelOwnedOrder(
      request.headers,
      jar.get("commerce-order-" + orderNumber)?.value,
      { ...raw, orderNumber },
    );
    return NextResponse.json(
      { order: result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status =
      code === "REVISION_CONFLICT"
        ? 409
        : code === "ORDER_NOT_FOUND"
          ? 404
          : code === "RATE_LIMITED"
            ? 429
            : 400;
    return NextResponse.json(
      {
        code: code || "ORDER_CANCEL_FAILED",
        message:
          code === "REVISION_CONFLICT"
            ? "This order changed. Reload before cancelling."
            : code === "ORDER_CANNOT_CANCEL"
              ? "This order can no longer be cancelled online."
              : "The order could not be cancelled.",
      },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
