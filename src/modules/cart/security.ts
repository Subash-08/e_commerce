import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Db } from "mongodb";

function mac(value: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_CONFIG_INVALID");
  return createHmac("sha256", secret)
    .update("commerce-cart-v1:" + value)
    .digest("hex");
}
export function privateOwner(owner: string) {
  return mac("owner:" + owner);
}
export function issueTicket(owner: string, duration = 86400000) {
  const body = [randomUUID(), Date.now() + duration, privateOwner(owner)].join(
    ".",
  );
  return body + "." + mac(body);
}
export function verifyTicket(ticket: string, owner: string) {
  const parts = ticket.split(".");
  if (parts.length !== 4 || !/^[a-f0-9]{64}$/.test(parts[3]))
    throw new Error("REQUEST_EXPIRED");
  const expected = Buffer.from(mac(parts.slice(0, 3).join(".")), "hex");
  if (
    !timingSafeEqual(expected, Buffer.from(parts[3], "hex")) ||
    parts[2] !== privateOwner(owner) ||
    !Number.isSafeInteger(Number(parts[1])) ||
    Number(parts[1]) <= Date.now()
  )
    throw new Error("REQUEST_EXPIRED");
  return new Date(Number(parts[1]) + 86400000);
}
export async function rateLimit(db: Db, key: string, maximum = 100) {
  const bucket = Math.floor(Date.now() / 60000);
  const row = await db
    .collection<{ _id: string; count: number; expiresAt: Date }>(
      "commerceRateLimits",
    )
    .findOneAndUpdate(
      { _id: privateOwner(key) + ":" + bucket },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date((bucket + 2) * 60000) },
      },
      { upsert: true, returnDocument: "after" },
    );
  if (!row || row.count > maximum) throw new Error("RATE_LIMITED");
}
