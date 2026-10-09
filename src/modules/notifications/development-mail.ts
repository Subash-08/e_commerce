import "server-only";
import type { RecoveryEmail } from "./recovery-email";
type Letter = RecoveryEmail & {
  subject?: string;
  kind?: "recovery" | "order";
  expiresAt: number;
};
const storage = globalThis as typeof globalThis & {
  __commerceDevelopmentMail?: Letter[];
};
function enabled() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.APP_ENV === "development" &&
    process.env.EMAIL_PROVIDER === "development"
  );
}
export async function deliverDevelopmentMail(
  message: RecoveryEmail & { subject?: string; kind?: "recovery" | "order" },
) {
  if (!enabled()) throw new Error("DEV_MAIL_DISABLED");
  const letters = (storage.__commerceDevelopmentMail ??= []);
  letters.unshift({ ...message, expiresAt: Date.now() + 15 * 60 * 1000 });
  letters.splice(20);
}
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export function developmentMailbox(request: Request) {
  if (
    !enabled() ||
    !["127.0.0.1", "localhost", "[::1]"].includes(new URL(request.url).hostname)
  )
    return Response.json(
      { error: "NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  const letters = (storage.__commerceDevelopmentMail ?? []).filter(
    (letter) => letter.expiresAt > Date.now(),
  );
  const items = letters
    .map(
      (letter) =>
        "<article><strong>" +
        escape(letter.email) +
        '</strong><p>" + escape(letter.subject ?? "Password recovery · expires within 15 minutes") + "</p><a href="' +
        escape(letter.url) +
        '">Open message</a></article>',
    )
    .join("");
  return new Response(
    '<!doctype html><html lang="en"><head><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex"><title>Local recovery inbox</title><style>body{font:16px system-ui;max-width:680px;margin:60px auto;padding:24px;background:#f4f7f6;color:#173b32}article{padding:24px;background:white;border:1px solid #dce6e1;border-radius:12px;margin:20px 0}a{color:#176248}p{color:#5b7168}</style></head><body><h1>Local recovery inbox</h1><p>Development only. Nothing is sent to an external provider.</p><a href="/api/auth/dev-mail">Refresh inbox</a> · <a href="/login">Sign in</a>' +
      (items ||
        "<article>No messages yet. Request a password reset to receive a link here.</article>") +
      "</body></html>",
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      },
    },
  );
}
