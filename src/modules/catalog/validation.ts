import { z } from "zod";
import { isPublicImageUrl } from "./image-url";
import { objectId } from "../attributes/validation";
import { stateValues } from "../../shared/domain/states.generated";

const text = (max: number) => z.string().trim().max(max);
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const optionRef = z
  .object({ attributeId: objectId, optionId: objectId })
  .strict();
export const mediaRef = z
  .object({
    assetId: objectId.optional(),
    url: text(2048)
      .refine(isPublicImageUrl, "Use a public HTTPS image URL.")
      .optional(),
    alt: text(200).min(1),
  })
  .strict()
  .refine(
    (v) => Boolean(v.assetId) !== Boolean(v.url),
    "Choose an upload or an image URL.",
  );
export const variantInput = z
  .object({
    id: objectId,
    sku: text(80).min(1),
    barcode: text(32),
    title: text(160),
    options: z.array(optionRef).max(6),
    active: z.boolean(),
    archived: z.boolean(),
    mrpPaise: integer.max(999999999999),
    salePaise: integer.max(999999999999),
    costPaise: integer.max(999999999999).nullable(),
    priceMode: z.enum(["INCLUSIVE", "EXCLUSIVE"]),
    gstRateBps: z.number().int().min(0).max(10000),
    trackQuantity: z.boolean(),
    stockStatus: z.enum(stateValues.StockStatus),
    onHand: integer.nullable(),
    media: z.array(mediaRef).max(20),
    weightGrams: integer.nullable(),
    lengthMm: integer.nullable(),
    widthMm: integer.nullable(),
    heightMm: integer.nullable(),
    specifications: z
      .array(
        z.object({ label: text(100).min(1), value: text(500).min(1) }).strict(),
      )
      .max(50),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.salePaise > v.mrpPaise)
      ctx.addIssue({
        code: "custom",
        path: ["salePaise"],
        message: "Selling price cannot exceed MRP.",
      });
    if (v.trackQuantity && v.onHand === null)
      ctx.addIssue({
        code: "custom",
        path: ["onHand"],
        message: "Enter an opening stock quantity.",
      });
    if (new Set(v.options.map((o) => o.attributeId)).size !== v.options.length)
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Use each variant axis once.",
      });
  });
export type VariantInput = z.infer<typeof variantInput>;
export const productInput = z
  .object({
    id: objectId.optional(),
    revision: integer.optional(),
    name: text(200).min(1),
    slug: text(100)
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    brandId: objectId,
    categoryIds: z.array(objectId).min(1).max(20),
    primaryCategoryId: objectId,
    status: z.enum(stateValues.CatalogState),
    summary: text(500),
    description: text(20000),
    modelNumber: text(100),
    hsn: text(8).regex(/^([0-9]{4}|[0-9]{6}|[0-9]{8})?$/),
    tags: z.array(text(50).min(1)).max(30),
    warranty: text(1000),
    notes: text(3000),
    thumbnail: mediaRef.nullable().default(null),
    hoverImage: mediaRef.nullable().default(null),
    manufacturerContent: z
      .array(
        z
          .object({
            heading: text(160),
            body: text(3000),
            images: z.array(mediaRef).max(10),
          })
          .strict(),
      )
      .max(10)
      .default([]),
    media: z.array(mediaRef).max(50),
    videos: z
      .array(
        z.discriminatedUnion("source", [
          z
            .object({
              source: z.literal("YOUTUBE"),
              videoId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/),
              title: text(160).min(1),
            })
            .strict(),
          z
            .object({
              source: z.literal("CLOUDINARY"),
              assetId: objectId,
              title: text(160).min(1),
            })
            .strict(),
        ]),
      )
      .max(10),
    attributes: z
      .array(
        z
          .object({
            attributeId: objectId,
            value: z.union([
              text(1000),
              z.number().finite(),
              z.boolean(),
              z.array(objectId).max(100),
            ]),
          })
          .strict(),
      )
      .max(50),
    specifications: z
      .array(
        z
          .object({
            heading: text(100),
            entries: z
              .array(
                z
                  .object({ label: text(100).min(1), value: text(1000).min(1) })
                  .strict(),
              )
              .max(50),
          })
          .strict(),
      )
      .max(20),
    features: z
      .array(
        z.object({ title: text(160).min(1), description: text(1000) }).strict(),
      )
      .max(30),
    linkedProductIds: z.array(objectId).max(20),
    defaultVariantId: objectId,
    variants: z.array(variantInput).min(1).max(200),
    seo: z
      .object({
        title: text(70),
        description: text(170),
        robotsIndex: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (v.id && v.revision === undefined)
      issue("revision", "Reload before saving.");
    if (!v.categoryIds.includes(v.primaryCategoryId))
      issue("primaryCategoryId", "Primary category must be selected.");
    if (new Set(v.categoryIds).size !== v.categoryIds.length)
      issue("categoryIds", "Do not duplicate categories.");
    if (new Set(v.variants.map((x) => x.id)).size !== v.variants.length)
      issue("variants", "Duplicate variant identity.");
    if (
      new Set(v.attributes.map((x) => x.attributeId)).size !==
      v.attributes.length
    )
      issue("attributes", "Use each descriptive attribute once.");
    const active = v.variants.filter((x) => x.active && !x.archived);
    if (!active.length) issue("variants", "Keep at least one active variant.");
    if (!active.some((x) => x.id === v.defaultVariantId))
      issue("defaultVariantId", "Choose an active default variant.");
    if (v.status === "ACTIVE" && (!v.description || !v.thumbnail))
      issue(
        "status",
        "Publishing requires a description and a thumbnail image.",
      );
  });
export type ProductInput = z.infer<typeof productInput>;
export function combinationKey(options: z.infer<typeof optionRef>[]) {
  return (
    options
      .map((o) => o.attributeId + ":" + o.optionId)
      .sort()
      .join("|") || "default"
  );
}
export function normalizeSku(sku: string) {
  return sku.normalize("NFKC").trim().toUpperCase();
}
export function youtubeId(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return null;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.slice(1);
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host))
      id =
        url.pathname === "/watch"
          ? url.searchParams.get("v")
          : (/^(?:\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})$/.exec(
              url.pathname,
            )?.[1] ?? null);
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
