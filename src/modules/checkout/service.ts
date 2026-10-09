import "server-only";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { z } from "zod";
import { getDatabase } from "../../server/db/connection";
import { getIdentity } from "../identity/runtime";
import { cartRepository } from "../cart/repository";
import { resolveCart } from "../cart/resolver";
import { privateOwner, rateLimit } from "../cart/security";
import { resolveShipping } from "../shipping/service";
import { checkoutQuoteInput, type CheckoutQuoteDto } from "./contracts";

function fingerprint(value: unknown) {
  return privateOwner("checkout-input:" + JSON.stringify(value));
}
export async function readOwnedCheckoutQuote(
  db: Db,
  quoteId: unknown,
  ownerKeyHash: unknown,
  now = new Date(),
) {
  const id = z.uuid().parse(quoteId);
  const owner = z.string().min(20).max(200).parse(ownerKeyHash);
  const row = await db
    .collection("checkoutQuotes")
    .findOne({ quoteId: id, ownerKeyHash: owner });
  if (!row) throw new Error("QUOTE_NOT_FOUND");
  if (
    !(row.expiresAt instanceof Date) ||
    row.expiresAt.getTime() <= now.getTime()
  )
    throw new Error("QUOTE_EXPIRED");
  return row;
}
export async function createCheckoutQuote(
  headers: Headers,
  guestKey: string,
  raw: unknown,
): Promise<CheckoutQuoteDto> {
  const input = checkoutQuoteInput.parse(raw);
  const quoteBoundInput = { ...input, marketingConsent: undefined };
  const database = await getDatabase();
  const identity = await getIdentity();
  const session = await identity.auth.api.getSession({ headers });
  const actor = session
    ? await identity.requireAccess(headers, "profile.own", session.user.id)
    : null;
  const owner = actor?.authUserId ?? null;
  const ownerKeyHash = privateOwner(
    owner ? "account:" + owner : "guest:" + guestKey,
  );
  await rateLimit(database.db, "checkout-quote:" + ownerKeyHash, 30);
  const cart = owner ? await cartRepository(database.db).read(owner) : null;
  const lines = owner ? (cart?.items ?? []) : input.guestLines;
  if (owner && input.cartRevision !== (cart?.revision ?? 0))
    throw new Error("CART_CHANGED");
  if (!lines.length) throw new Error("CART_EMPTY");
  const view = await resolveCart(
    database.db,
    lines,
    owner,
    cart?.revision ?? 0,
    input.coupon,
  );
  if (!view.ready) throw new Error("CART_UNAVAILABLE");
  if (input.coupon && !view.couponEffect) throw new Error("COUPON_UNAVAILABLE");
  const freeShippingCoupon =
    view.couponEffect?.kind === "FREE_SHIPPING" ? view.couponEffect : null;
  const shipping = await resolveShipping(
    database,
    {
      merchandisePaise: view.totalPaise,
      state: input.shippingAddress.stateCode,
      pin: input.shippingAddress.postalCode,
      payment: input.payment,
    },
    freeShippingCoupon?.maxDiscountPaise,
  );
  if (!shipping.ok) throw new Error(shipping.issue);
  const grandTotalPaise = view.totalPaise + shipping.payablePaise;
  if (!Number.isSafeInteger(grandTotalPaise) || grandTotalPaise <= 0)
    throw new Error("INVALID_CHECKOUT_TOTAL");
  const policy = await database.db.collection("settings").findOne(
    { key: "shipping" },
    {
      projection: {
        quoteTtlSeconds: 1,
        shippingTaxPolicyKey: 1,
        "cod.surchargeTaxPolicyKey": 1,
      },
    },
  );
  const ttl = Number(policy?.quoteTtlSeconds);
  if (!Number.isInteger(ttl) || ttl < 600 || ttl > 900)
    throw new Error("SHIPPING_CONFIGURATION_REQUIRED");
  const now = new Date(),
    expiresAt = new Date(now.getTime() + ttl * 1000),
    quoteId = randomUUID();
  const variants = await database.db
    .collection("variants")
    .find(
      { _id: { $in: lines.map((line) => new ObjectId(line.variantId)) } },
      { projection: { revision: 1, taxPolicyKey: 1 } },
    )
    .toArray();
  const coupon = input.coupon
    ? await database.db
        .collection("coupons")
        .findOne({ code: input.coupon }, { projection: { revision: 1 } })
    : null;
  const dto: CheckoutQuoteDto = {
    quoteId,
    expiresAt: expiresAt.toISOString(),
    currency: "INR",
    cartRevision: owner ? (cart?.revision ?? 0) : null,
    items: view.items.map(
      ({
        variantId,
        name,
        title,
        quantity,
        unitPaise,
        payablePaise,
        url,
        image,
      }) => ({
        variantId,
        name,
        title,
        quantity,
        unitPaise,
        payablePaise,
        url,
        image,
      }),
    ),
    coupon: {
      code: input.coupon,
      discountPaise: view.discountPaise + shipping.couponWaiverPaise,
      message:
        freeShippingCoupon && !shipping.couponEffective
          ? "Delivery is already free. This coupon has no additional saving and must not be claimed."
          : view.couponMessage,
    },
    shipping: {
      chargePaise: shipping.shipping.payablePaise,
      taxPaise: shipping.shipping.taxPaise,
      waiverPaise: shipping.automaticWaiverPaise,
      couponWaiverPaise: shipping.couponWaiverPaise,
      automaticFree: shipping.automaticFree,
      remainingPaise: shipping.remainingPaise,
    },
    cod: {
      eligible: shipping.codEligible,
      chargePaise: shipping.cod.payablePaise,
      taxPaise: shipping.cod.taxPaise,
    },
    totals: {
      goodsPaise: view.totalPaise,
      discountPaise: view.discountPaise + shipping.couponWaiverPaise,
      goodsTaxPaise: view.taxPaise,
      deliveryPaise: shipping.payablePaise,
      grandTotalPaise,
    },
    paymentMethods: shipping.codEligible ? ["ONLINE", "COD"] : ["ONLINE"],
    notices: [
      "Prices, availability and policy were checked live. This quote does not reserve stock or claim a coupon.",
      ...(freeShippingCoupon && !shipping.couponEffective
        ? [
            "The free-delivery coupon has no effect because delivery is already free.",
          ]
        : []),
    ],
  };
  await database.db.collection("checkoutQuotes").insertOne({
    quoteId,
    ownerKeyHash,
    requestFingerprint: fingerprint(quoteBoundInput),
    cartRevision: owner ? (cart?.revision ?? 0) : null,
    guestLinesHash: owner ? null : fingerprint(lines),
    sourceRevisions: {
      variants: variants.map((v) => ({
        id: String(v._id),
        revision: Number(v.revision),
      })),
      coupon: coupon
        ? { id: String(coupon._id), revision: Number(coupon.revision) }
        : null,
      shippingPolicy: shipping.revision,
      legalPolicyVersions: {
        terms: input.legal.termsVersion,
        privacy: input.legal.privacyVersion,
      },
      taxPolicyKeys: [
        ...new Set(
          [
            ...variants.map((v) => String(v.taxPolicyKey)).filter(Boolean),
            String(policy?.shippingTaxPolicyKey ?? ""),
            String(policy?.cod?.surchargeTaxPolicyKey ?? ""),
          ].filter(Boolean),
        ),
      ],
    },
    publicQuote: dto,
    expiresAt,
    createdAt: now,
    schemaVersion: 1,
  });
  return dto;
}
