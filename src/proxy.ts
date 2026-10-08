import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "./server/db/connection";
import { productRedirect } from "./modules/catalog/url-resolution";

export async function proxy(request: NextRequest) {
  const match = /^\/product\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/.exec(
    request.nextUrl.pathname,
  );
  if (!match) return NextResponse.next();
  const legacy = request.nextUrl.searchParams.has("variant")
    ? request.nextUrl.searchParams.get("variant")
    : undefined;
  try {
    const target = await productRedirect(
      (await getDatabase()).db,
      match[1],
      match[2],
      legacy,
    );
    if (
      target &&
      (target !== request.nextUrl.pathname || legacy !== undefined)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = target;
      url.searchParams.delete("variant");
      return NextResponse.redirect(url, 301);
    }
    return NextResponse.next();
  } catch {
    return new NextResponse(
      "Product services are temporarily unavailable. Please try again.",
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
export const config = { matcher: ["/product/:path*"] };
