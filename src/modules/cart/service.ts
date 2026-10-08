import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getDatabase } from "../../server/db/connection";
import { transaction } from "../../server/db/transaction";
import { getIdentity } from "../identity/runtime";
import { cartLine, cartLines, mergeLines, type CartLine } from "./contracts";
import { cartRepository } from "./repository";
import { resolveCart } from "./resolver";
import { issueTicket, privateOwner, rateLimit, verifyTicket } from "./security";

const requestInput = z
  .object({
    action: z.enum(["resolve", "add", "set", "remove", "clear", "merge"]),
    lines: cartLines.default([]),
    line: cartLine.optional(),
    revision: z.number().int().min(0).default(0),
    ticket: z.string().max(300).optional(),
    coupon: z
      .string()
      .trim()
      .toUpperCase()
      .max(20)
      .regex(/^[A-Z0-9_-]*$/)
      .default(""),
  })
  .strict();

export async function cartRequest(
  headers: Headers,
  guestKey: string,
  raw: unknown,
) {
  const input = requestInput.parse(raw);
  const database = await getDatabase();
  const identity = await getIdentity();
  const auth = await identity.auth.api.getSession({ headers });
  const actor = auth
    ? await identity.requireAccess(headers, "profile.own", auth.user.id)
    : null;
  const owner = actor?.authUserId ?? null;
  const requestOwner = owner ?? "guest:" + guestKey;
  await rateLimit(database.db, "cart:" + requestOwner);
  const repo = cartRepository(database.db);
  let remaining: CartLine[] = [];
  if (input.action !== "resolve") {
    if (!owner || !actor) throw new Error("AUTH_REQUIRED");
    if (!input.ticket) throw new Error("REQUEST_EXPIRED");
    const expiresAt = verifyTicket(input.ticket, requestOwner);
    const receiptId = createHash("sha256").update(input.ticket).digest("hex");
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    remaining = await transaction(async (session) => {
      const profile = await database.db.collection("profiles").findOne(
        {
          authUserId: owner,
          status: "ACTIVE",
          authVersion: actor.authVersion,
        },
        { session, projection: { _id: 1 } },
      );
      if (!profile) throw new Error("AUTH_REQUIRED");
      const receipts = database.db.collection<{
        _id: string;
        fingerprint: string;
        remaining: CartLine[];
        expiresAt: Date;
      }>("cartReceipts");
      const receipt = await receipts.findOne({ _id: receiptId }, { session });
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          throw new Error("TOKEN_REUSED");
        return receipt.remaining;
      }
      const current = await repo.read(owner, session);
      if ((current?.revision ?? 0) !== input.revision)
        throw new Error("REVISION_CONFLICT");
      let items = current?.items.map((line) => ({ ...line })) ?? [];
      let leftovers: CartLine[] = [];
      if (input.action === "clear") items = [];
      else if (input.action === "merge") {
        const resolved = await resolveCart(
          database.db,
          input.lines,
          owner,
          0,
          "",
          session,
        );
        const merged = mergeLines(
          items,
          input.lines,
          new Map(
            resolved.items.map((line) => [
              line.variantId,
              line.maximumQuantity,
            ]),
          ),
        );
        items = merged.items;
        leftovers = merged.remaining;
      } else {
        if (!input.line) throw new Error("INVALID_INPUT");
        const line = input.line;
        const existing = items.find(
          (item) => item.variantId === line.variantId,
        );
        if (existing && existing.productId !== line.productId)
          throw new Error("INVALID_INPUT");
        if (input.action === "remove")
          items = items.filter((item) => item.variantId !== line.variantId);
        else {
          const quantity =
            input.action === "add"
              ? (existing?.quantity ?? 0) + line.quantity
              : line.quantity;
          if (quantity > 99 || (!existing && items.length >= 50))
            throw new Error("CART_LIMIT");
          const resolved = await resolveCart(
            database.db,
            [{ ...line, quantity }],
            owner,
            0,
            "",
            session,
          );
          if (resolved.items[0].issue) throw new Error("ITEM_UNAVAILABLE");
          if (existing) existing.quantity = quantity;
          else items.push({ ...line, quantity });
        }
      }
      await repo.write(owner, current, items, session);
      await receipts.insertOne(
        { _id: receiptId, fingerprint, remaining: leftovers, expiresAt },
        { session },
      );
      return leftovers;
    }, database);
  }
  const stored = owner ? await repo.read(owner) : null;
  const view = await resolveCart(
    database.db,
    owner ? (stored?.items ?? []) : input.lines,
    owner,
    stored?.revision ?? 0,
    input.coupon,
  );
  return {
    view: { ...view, owner: owner ? privateOwner(owner) : null },
    ticket: issueTicket(requestOwner),
    remaining,
  };
}
