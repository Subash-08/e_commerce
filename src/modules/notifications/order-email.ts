import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { assertOutsideTransaction } from "../../server/db/transaction";
import { deliverDevelopmentMail } from "./development-mail";
import { readRecoveryEmailConfig } from "./recovery-email";

export async function sendOrderConfirmation(message: {
  email: string;
  orderNumber: string;
  totalPaise: number;
}) {
  assertOutsideTransaction();
  if (
    !z.email().safeParse(message.email).success ||
    !/^ORD-[0-9]{4}-[0-9]{6}$/.test(message.orderNumber) ||
    !Number.isSafeInteger(message.totalPaise) ||
    message.totalPaise <= 0
  )
    throw new Error("EMAIL_MESSAGE_INVALID");
  const config = readRecoveryEmailConfig();
  const url = new URL(`/order/${message.orderNumber}`, config.appUrl).href;
  const subject = `Order ${message.orderNumber} confirmed`;
  const text = `Your cash-on-delivery order ${message.orderNumber} has been confirmed. Total: INR ${(message.totalPaise / 100).toFixed(2)}.\n\nView the order: ${url}`;
  if (config.provider === "development") {
    await deliverDevelopmentMail({
      email: message.email,
      url,
      subject,
      kind: "order",
    });
    return;
  }
  const requestId =
    "order-" + createHash("sha256").update(message.orderNumber).digest("hex");
  const mail = { from: config.from, to: [message.email], subject, text };
  const endpoint =
    config.provider === "resend"
      ? "https://api.resend.com/emails"
      : config.webhookUrl;
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "Idempotency-Key": requestId,
  };
  if (config.provider === "resend")
    requestHeaders.Authorization = `Bearer ${config.apiKey}`;
  else requestHeaders["X-Commerce-Webhook-Secret"] = config.webhookSecret;
  const body =
    config.provider === "resend"
      ? mail
      : {
          schemaVersion: 1,
          event: "commerce.order.confirmed",
          requestId,
          orderNumber: message.orderNumber,
          message: mail,
        };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("EMAIL_DELIVERY_FAILED");
  const acknowledgement: unknown = await response.json();
  const valid =
    config.provider === "resend"
      ? z.object({ id: z.string().min(1).max(200) }).safeParse(acknowledgement)
          .success
      : z
          .object({
            accepted: z.literal(true),
            requestId: z.literal(requestId),
          })
          .safeParse(acknowledgement).success;
  if (!valid) throw new Error("EMAIL_DELIVERY_FAILED");
}
