import "server-only";
import { ObjectId, type ClientSession, type Db } from "mongodb";
import { priceQuote, calculateTax, type PriceLine } from "../pricing/price";
import { couponPreview } from "../coupons/service";
import type { CartLine, CartView, ResolvedLine } from "./contracts";
import type { CouponFacts } from "../pricing/price";

/** Fresh, batched, allowlisted projection. Never resolve checkout authority from a public cache. */
export async function resolveCart(
  db: Db,
  lines: CartLine[],
  owner: string | null,
  revision = 0,
  coupon = "",
  session?: ClientSession,
): Promise<CartView> {
  const variants = await db
    .collection("variants")
    .aggregate(
      [
        {
          $match: {
            _id: { $in: lines.map((line) => new ObjectId(line.variantId)) },
            active: true,
            archived: false,
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        { $match: { "product.status": "ACTIVE" } },
        {
          $lookup: {
            from: "brands",
            localField: "product.brandId",
            foreignField: "_id",
            as: "brand",
          },
        },
        { $unwind: "$brand" },
        {
          $lookup: {
            from: "categories",
            localField: "product.primaryCategoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        {
          $match: {
            "brand.active": true,
            "brand.archivedAt": null,
            "category.active": true,
            "category.archivedAt": null,
          },
        },
        {
          $project: {
            productId: 1,
            title: 1,
            urlKey: 1,
            salePaise: 1,
            mrpPaise: 1,
            priceMode: 1,
            gstRateBps: 1,
            trackQuantity: 1,
            stockStatus: 1,
            onHand: 1,
            reserved: 1,
            revision: 1,
            "product.name": 1,
            "product.slug": 1,
            "product.thumbnail": 1,
            "product.brandId": 1,
            "product.categoryIds": 1,
          },
        },
      ],
      { session, maxTimeMS: 1800 },
    )
    .toArray();
  const assetIds = variants.flatMap((v) =>
    v.product.thumbnail?.assetId
      ? [new ObjectId(v.product.thumbnail.assetId)]
      : [],
  );
  const assets = assetIds.length
    ? await db
        .collection("mediaAssets")
        .find(
          { _id: { $in: assetIds } },
          { session, projection: { secureUrl: 1 } },
        )
        .toArray()
    : [];
  const priceLines: PriceLine[] = [];
  const facts: {
    key: string;
    productId: string;
    variantId: string;
    brandId: string;
    categoryIds: string[];
    sale: boolean;
  }[] = [];
  const items: ResolvedLine[] = lines.map((line) => {
    const v = variants.find(
      (row) =>
        String(row._id) === line.variantId &&
        String(row.productId) === line.productId,
    );
    if (!v)
      return {
        ...line,
        name: "Unavailable item",
        title: "Remove this item to continue",
        url: null,
        image: null,
        unitPaise: 0,
        payablePaise: 0,
        maximumQuantity: 0,
        issue: "This product or variant is no longer available.",
      };
    const maximumQuantity = v.trackQuantity
      ? Math.max(0, Math.min(99, (v.onHand ?? 0) - (v.reserved ?? 0)))
      : v.stockStatus === "IN_STOCK"
        ? 99
        : 0;
    const tax = {
      mode: v.priceMode as "INCLUSIVE" | "EXCLUSIVE",
      rateBps: Number(v.gstRateBps),
      components: [{ key: "GST", rateBps: Number(v.gstRateBps) }],
    };
    const issue = !maximumQuantity
      ? "Currently out of stock."
      : line.quantity > maximumQuantity
        ? `Only ${maximumQuantity} available. Reduce the quantity to continue.`
        : null;
    if (!issue) {
      priceLines.push({
        key: line.variantId,
        productActive: true,
        variantActive: true,
        available: true,
        revision: String(v.revision),
        expectedRevision: String(v.revision),
        quantity: line.quantity,
        mrpPaise: v.mrpPaise,
        unitPricePaise: v.salePaise,
        tax,
      });
      facts.push({
        key: line.variantId,
        variantId: line.variantId,
        productId: line.productId,
        brandId: String(v.product.brandId),
        categoryIds: v.product.categoryIds.map(String),
        sale: v.salePaise < v.mrpPaise,
      });
    }
    const thumbnail = v.product.thumbnail;
    const imageUrl =
      thumbnail?.url ||
      assets.find((asset) => String(asset._id) === String(thumbnail?.assetId))
        ?.secureUrl;
    return {
      ...line,
      name: String(v.product.name),
      title: String(v.title),
      url: `/product/${v.product.slug}/${v.urlKey}`,
      image: imageUrl
        ? {
            url: String(imageUrl),
            alt: String(thumbnail?.alt ?? v.product.name),
          }
        : null,
      unitPaise: calculateTax(v.salePaise, tax).payablePaise,
      payablePaise: 0,
      maximumQuantity,
      issue,
    };
  });
  let couponMessage: string | null = null;
  let appliedCoupon: CouponFacts | null = null;
  const input = {
    currency: "INR",
    country: "IN",
    now: Date.now(),
    policyVersion: "cart-preview-v1",
    lines: priceLines,
    shipping: {
      chargePaise: 0,
      tax: {
        mode: "EXEMPT" as const,
        rateBps: 0,
        components: [],
        exemptionReason: "Shipping is not quoted in cart",
      },
    },
  };
  let quote = priceLines.length ? priceQuote(input) : null;
  const beforeCoupon = quote?.totals.goodsPayablePaise ?? 0;
  if (coupon && quote) {
    try {
      const result = await couponPreview(db, coupon, owner, facts, session);
      appliedCoupon = result;
      quote = priceQuote({ ...input, coupon: result });
      couponMessage =
        result.kind === "FREE_SHIPPING"
          ? "Free-delivery coupon is eligible. Delivery savings are calculated at checkout."
          : "Coupon preview applied. Eligibility and availability are checked again at checkout.";
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.startsWith("COUPON_") ||
          error.message === "INVALID_COUPON_ELIGIBILITY")
      )
        couponMessage =
          "This coupon is not eligible for the current items, account, or minimum spend.";
      else throw error;
    }
  } else if (coupon)
    couponMessage = "Add available items before applying a coupon.";
  for (const item of items)
    item.payablePaise =
      quote?.lines.find((line) => line.key === item.variantId)?.payablePaise ??
      0;
  return {
    owner,
    revision,
    items,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalPaise: beforeCoupon,
    discountPaise: beforeCoupon - (quote?.totals.goodsPayablePaise ?? 0),
    taxPaise: quote?.totals.taxPaise ?? 0,
    totalPaise: quote?.totals.goodsPayablePaise ?? 0,
    coupon,
    couponMessage,
    couponEffect: appliedCoupon
      ? {
          kind: appliedCoupon.kind,
          revision: appliedCoupon.revision,
          maxDiscountPaise: appliedCoupon.maxDiscountPaise ?? null,
        }
      : null,
    ready: Boolean(items.length) && items.every((item) => !item.issue),
  };
}
