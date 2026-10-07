import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { DomainError } from "../../shared/domain/errors";
import { assertOutsideTransaction } from "../../server/db/transaction";

const common = {
  from: z.email().max(254),
  appUrl: z.url(),
};
const configSchema = z.discriminatedUnion("provider", [
  z.object({
    ...common,
    provider: z.literal("resend"),
    apiKey: z.string().trim().min(16),
  }),
  z.object({
    ...common,
    provider: z.literal("n8n"),
    webhookUrl: z.url(),
    webhookSecret: z.string().trim().min(32),
  }),
]);
export type RecoveryEmailConfig = z.infer<typeof configSchema>;
export interface RecoveryEmail {
  readonly email: string;
  readonly url: string;
}
export type RecoverySender = (message: RecoveryEmail) => Promise<void>;

function safeUrl(value: string, localAllowed: boolean): URL {
  try {
    const url = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      url.hash ||
      (url.protocol !== "https:" &&
        !(localAllowed && loopback && url.protocol === "http:"))
    )
      throw new Error();
    return url;
  } catch {
    throw new DomainError("EMAIL_CONFIG_INVALID");
  }
}

/** Validates only the selected provider. Never returns validation errors containing secrets. */
export function readRecoveryEmailConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): RecoveryEmailConfig {
  const result = configSchema.safeParse({
    provider: environment.EMAIL_PROVIDER,
    from: environment.EMAIL_FROM,
    appUrl: environment.APP_URL,
    apiKey: environment.RESEND_API_KEY,
    webhookUrl: environment.N8N_WEBHOOK_URL,
    webhookSecret: environment.N8N_WEBHOOK_SECRET,
  });
  if (!result.success) throw new DomainError("EMAIL_CONFIG_INVALID");
  const localAllowed =
    environment.APP_ENV === "development" || environment.APP_ENV === "test";
  const app = safeUrl(result.data.appUrl, localAllowed);
  if (app.pathname !== "/" || app.search)
    throw new DomainError("EMAIL_CONFIG_INVALID");
  if (result.data.provider === "n8n") {
    const webhook = safeUrl(result.data.webhookUrl, localAllowed);
    if (
      webhook.search ||
      (!localAllowed && webhook.pathname.includes("/webhook-test/"))
    )
      throw new DomainError("EMAIL_CONFIG_INVALID");
  }
  return result.data;
}

/** Single selected delivery provider; no retries, logs or cross-provider fallback. */
export function createRecoverySender(
  config: RecoveryEmailConfig,
  request: typeof fetch = fetch,
): RecoverySender {
  // Revalidate injected configuration as well as environment-loaded values.
  const parsed = configSchema.safeParse(config);
  if (!parsed.success) throw new DomainError("EMAIL_CONFIG_INVALID");
  const settings = parsed.data;
  const appOrigin = safeUrl(settings.appUrl, true).origin;
  if (settings.provider === "n8n") safeUrl(settings.webhookUrl, true);
  return async ({ email, url }) => {
    assertOutsideTransaction();
    let reset: URL;
    try {
      reset = new URL(url);
      if (
        reset.origin !== appOrigin ||
        reset.username ||
        reset.password ||
        reset.hash ||
        !reset.pathname.startsWith("/api/auth/reset-password/") ||
        !z.email().safeParse(email).success
      )
        throw new Error();
    } catch {
      throw new DomainError("EMAIL_MESSAGE_INVALID");
    }
    const requestId =
      "recovery-" +
      createHash("sha256").update(email).update("\0").update(url).digest("hex");
    const message = {
      from: settings.from,
      to: [email],
      subject: "Reset your password",
      text: `Use this link to reset your password:\n\n${reset.href}\n\nIf you did not request this, you can ignore this email.`,
    };
    const endpoint =
      settings.provider === "resend"
        ? "https://api.resend.com/emails"
        : settings.webhookUrl;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Idempotency-Key": requestId,
    };
    if (settings.provider === "resend")
      headers.Authorization = `Bearer ${settings.apiKey}`;
    else headers["X-Commerce-Webhook-Secret"] = settings.webhookSecret;
    const body =
      settings.provider === "resend"
        ? message
        : {
            schemaVersion: 1,
            event: "auth.password-reset.email",
            requestId,
            message,
          };
    try {
      const response = await request(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      const acknowledgement: unknown = await response.json();
      const valid =
        settings.provider === "resend"
          ? z
              .object({ id: z.string().min(1).max(200) })
              .safeParse(acknowledgement).success
          : z
              .object({
                accepted: z.literal(true),
                requestId: z.literal(requestId),
              })
              .safeParse(acknowledgement).success;
      if (!valid) throw new Error();
    } catch {
      // Do not retain the provider response/cause: it may contain recipient, token or credentials.
      throw new DomainError("EMAIL_DELIVERY_FAILED");
    }
  };
}
