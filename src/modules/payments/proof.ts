import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
export function verifyPaymentHmac(body: string | Uint8Array, signature: string, secret: string) {
  if (!secret || !/^[a-fA-F0-9]{64}$/.test(signature)) throw new Error("PAYMENT_SIGNATURE_INVALID");
  const expected = createHmac("sha256", secret).update(body).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw new Error("PAYMENT_SIGNATURE_INVALID");
}
export async function readPaymentBody(request: Request, cap: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_INPUT");
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > cap) { await reader.cancel(); throw new Error("BODY_TOO_LARGE"); }
    chunks.push(value);
  } } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
