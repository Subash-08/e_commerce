import "server-only";
import { z } from "zod";
import type { createIdentity } from "./service";

type Identity = Awaited<ReturnType<typeof createIdentity>>;
const password = z.string().min(12).max(128);
const bodies = {
  "/sign-up/email": z
    .object({
      name: z.string().trim().min(1).max(200),
      email: z.email().max(254),
      password,
    })
    .strict(),
  "/sign-in/email": z
    .object({ email: z.email().max(254), password: z.string().min(1).max(128) })
    .strict(),
  "/sign-out": z.object({}).strict(),
  "/request-password-reset": z.object({ email: z.email().max(254) }).strict(),
  "/reset-password": z
    .object({ token: z.string().min(1).max(256), newPassword: password })
    .strict(),
};
function json(body: object, status = 200, source?: Response) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  for (const cookie of source?.headers.getSetCookie() ?? [])
    headers.append("Set-Cookie", cookie);
  const retry = source?.headers.get("x-retry-after");
  if (retry) headers.set("Retry-After", retry);
  return Response.json(body, { status, headers });
}
async function boundedBody(request: Request): Promise<unknown> {
  if (!request.body) return {};
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 8192) {
        await reader.cancel();
        throw new Error();
      }
      parts.push(part.value);
    }
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } finally {
    reader.releaseLock();
  }
}
/** Every publicly reachable auth operation is listed here; no broad admin API surface. */
export async function handleIdentityRequest(
  request: Request,
  resolve: () => Promise<Identity>,
) {
  const pathname = new URL(request.url).pathname;
  const path = pathname.startsWith("/api/auth/")
    ? pathname.slice("/api/auth".length)
    : "";
  const resetCallback = /^\/reset-password\/[a-zA-Z0-9_-]{1,256}$/.test(path);
  if (
    (request.method === "GET" && path !== "/get-session" && !resetCallback) ||
    (request.method === "POST" && !Object.hasOwn(bodies, path)) ||
    !["GET", "POST"].includes(request.method)
  )
    return json({ error: "NOT_FOUND" }, 404);
  let body: unknown;
  if (request.method === "POST") {
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return json({ error: "INVALID_REQUEST" }, 415);
    try {
      const schema = bodies[path as keyof typeof bodies];
      const parsed = schema.safeParse(await boundedBody(request));
      if (!parsed.success) return json({ error: "INVALID_REQUEST" }, 400);
      body = parsed.data;
    } catch {
      return json({ error: "INVALID_REQUEST" }, 400);
    }
  }
  try {
    const identity = await resolve();
    if (request.method === "GET" && path === "/get-session") {
      const limited = await identity.auth.handler(request);
      if (limited.status === 429)
        return json({ error: "RATE_LIMITED" }, 429, limited);
      if (!limited.ok) return json({ error: "AUTH_UNAVAILABLE" }, 503);
      const session = await identity.auth.api.getSession({
        headers: request.headers,
      });
      if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
      await identity.requireAccess(
        request.headers,
        "profile.own",
        session.user.id,
      );
      return json(
        { user: { id: session.user.id, name: session.user.name } },
        200,
        limited,
      );
    }
    const base = identity.baseURL;
    if (request.method === "POST" && request.headers.get("origin") !== base)
      return json({ error: "FORBIDDEN" }, 403);
    if (path === "/request-password-reset")
      body = { ...(body as object), redirectTo: base + "/reset-password" };
    const forwarded =
      request.method === "POST"
        ? new Request(request.url, {
            method: "POST",
            headers: request.headers,
            body: JSON.stringify(body),
          })
        : request;
    const response = await identity.auth.handler(forwarded);
    if (resetCallback) {
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store");
      headers.set("Referrer-Policy", "no-referrer");
      return new Response(response.body, { status: response.status, headers });
    }
    if (response.status === 429)
      return json({ error: "RATE_LIMITED" }, 429, response);
    if (!response.ok)
      return json(
        {
          error:
            response.status >= 500 ? "AUTH_UNAVAILABLE" : "AUTH_REQUEST_FAILED",
        },
        response.status >= 500 ? 503 : 400,
      );
    if (path === "/sign-up/email")
      return json(
        {
          message:
            "You can now try signing in. If you already have an account, use your existing password or reset it.",
        },
        200,
        response,
      );
    if (path === "/request-password-reset")
      return json(
        {
          message:
            "If an account matches, a password reset email will be sent.",
        },
        200,
        response,
      );
    return json({ ok: true }, 200, response);
  } catch (error) {
    if (
      error instanceof Error &&
      ["AUTH_REQUIRED", "FORBIDDEN"].includes(error.message)
    )
      return json({ error: "AUTH_REQUIRED" }, 401);
    return json({ error: "AUTH_UNAVAILABLE" }, 503);
  }
}
