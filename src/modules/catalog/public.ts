import "server-only";
import { unstable_cache } from "next/cache";
import { getDatabase } from "../../server/db/connection";
import { catalogRepository } from "./repository";
import type { AttributeRecord } from "../attributes/repository";
import { ObjectId } from "mongodb";
import type { DatabaseHandle } from "../../server/db/connection";
import { priceBreakdown } from "./pricing";

export async function readPublicProduct(
  slug: string,
  preview = false,
  databaseOverride?: DatabaseHandle,
) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100)
    return null;
  const database = databaseOverride ?? (await getDatabase());
  const repo = catalogRepository(database);
  const product = await repo.products.findOne(
    { slug, ...(preview ? {} : { status: "ACTIVE" as const }) },
    {
      projection: {
        name: 1,
        slug: 1,
        brandId: 1,
        categoryIds: 1,
        primaryCategoryId: 1,
        summary: 1,
        description: 1,
        modelNumber: 1,
        warranty: 1,
        media: 1,
        thumbnail: 1,
        hoverImage: 1,
        manufacturerContent: 1,
        videos: 1,
        attributes: 1,
        specifications: 1,
        features: 1,
        linkedProductIds: 1,
        defaultVariantId: 1,
        seo: 1,
      },
    },
  );
  if (!product) return null;
  const [brand, category, variants] = await Promise.all([
    database.db
      .collection("brands")
      .findOne(
        {
          _id: product.brandId,
          ...(preview ? {} : { active: true, archivedAt: null }),
        },
        { projection: { name: 1, slug: 1 } },
      ),
    database.db
      .collection("categories")
      .findOne(
        {
          _id: product.primaryCategoryId,
          ...(preview ? {} : { active: true, archivedAt: null }),
        },
        { projection: { name: 1, slug: 1 } },
      ),
    repo.variants
      .find(
        { productId: product._id, active: true, archived: false },
        {
          projection: {
            sku: 1,
            barcode: 1,
            title: 1,
            options: 1,
            mrpPaise: 1,
            salePaise: 1,
            priceMode: 1,
            gstRateBps: 1,
            trackQuantity: 1,
            onHand: 1,
            reserved: 1,
            stockStatus: 1,
            media: 1,
            specifications: 1,
          },
        },
      )
      .sort({ _id: 1 })
      .limit(200)
      .toArray(),
  ]);
  if ((!brand || !category) && !preview) return null;
  const imageIds = [
    ...new Set(
      [
        ...product.media,
        ...(product.thumbnail ? [product.thumbnail] : []),
        ...(product.hoverImage ? [product.hoverImage] : []),
        ...(product.manufacturerContent ?? []).flatMap((s) => s.images),
        ...variants.flatMap((v) => v.media),
      ].flatMap((m) => (m.assetId ? [m.assetId] : [])),
    ),
  ];
  const videoIds = product.videos.flatMap((v) =>
    v.source === "CLOUDINARY" ? [v.assetId] : [],
  );
  const attributeIds = [
    ...new Set([
      ...product.attributes.map((a) => a.attributeId),
      ...variants.flatMap((v) => v.options.map((o) => o.attributeId)),
    ]),
  ];
  const [media, definitions] = await Promise.all([
    database.db
      .collection("mediaAssets")
      .find(
        {
          _id: { $in: [...imageIds, ...videoIds].map((x) => new ObjectId(x)) },
        },
        { projection: { secureUrl: 1, posterUrl: 1, resourceType: 1 } },
      )
      .toArray(),
    database.db
      .collection<AttributeRecord>("attributes")
      .find(
        { _id: { $in: attributeIds.map((x) => new ObjectId(x)) } },
        { projection: { name: 1, unit: 1, visible: 1, type: 1, options: 1 } },
      )
      .toArray(),
  ]);
  const images = (refs: typeof product.media) =>
    refs.flatMap((ref) => {
      if (ref.url) return [{ url: ref.url, alt: ref.alt }];
      const asset = media.find(
        (a) => a._id.toString() === ref.assetId && a.resourceType === "image",
      );
      return asset ? [{ url: String(asset.secureUrl), alt: ref.alt }] : [];
    });
  return {
    id: product._id.toString(),
    name: product.name,
    slug: product.slug,
    summary: product.summary,
    description: product.description,
    modelNumber: product.modelNumber,
    warranty: product.warranty,
    seo: product.seo,
    brand: brand
      ? { name: String(brand.name), slug: String(brand.slug) }
      : null,
    category: category
      ? { name: String(category.name), slug: String(category.slug) }
      : null,
    images: images([
      ...(product.thumbnail ? [product.thumbnail] : []),
      ...(product.hoverImage ? [product.hoverImage] : []),
      ...product.media,
    ]).filter(
      (image, i, all) => all.findIndex((x) => x.url === image.url) === i,
    ),
    hoverImage: product.hoverImage
      ? (images([product.hoverImage])[0] ?? null)
      : null,
    manufacturerContent: (product.manufacturerContent ?? []).map((section) => ({
      heading: section.heading,
      body: section.body,
      images: images(section.images),
    })),
    defaultVariantId: product.defaultVariantId.toString(),
    features: product.features,
    specifications: product.specifications,
    attributes: product.attributes.flatMap((assignment) => {
      const a = definitions.find(
        (d) => d._id.toString() === assignment.attributeId && d.visible,
      );
      if (!a) return [];
      const raw = assignment.value;
      const display = ["SINGLE_SELECT", "MULTI_SELECT", "COLOUR"].includes(
        a.type,
      )
        ? (Array.isArray(raw) ? raw : [raw])
            .map((id) => a.options.find((o) => o.id === id)?.label ?? "")
            .filter(Boolean)
            .join(", ")
        : typeof raw === "boolean"
          ? raw
            ? "Yes"
            : "No"
          : String(raw);
      return [{ name: a.name, value: display + (a.unit ? " " + a.unit : "") }];
    }),
    axes: definitions
      .filter((a) =>
        variants.some((v) =>
          v.options.some((o) => o.attributeId === a._id.toString()),
        ),
      )
      .map((a) => ({
        id: a._id.toString(),
        name: a.name,
        type: a.type,
        options: a.options
          .filter((o) =>
            variants.some((v) => v.options.some((x) => x.optionId === o.id)),
          )
          .map((o) => ({ id: o.id, label: o.label, colour: o.colour })),
      })),
    variants: variants.map((v) => ({
      id: v._id.toString(),
      sku: v.sku,
      barcode: v.barcode,
      title: v.title,
      options: v.options,
      pricePaise: priceBreakdown(v.salePaise, v.priceMode, v.gstRateBps)
        .payablePaise,
      mrpPaise: priceBreakdown(v.mrpPaise, v.priceMode, v.gstRateBps)
        .payablePaise,
      available: v.trackQuantity
        ? (v.onHand ?? 0) > (v.reserved ?? 0)
        : v.stockStatus === "IN_STOCK",
      images: images(v.media),
      specifications: v.specifications,
    })),
    videos: product.videos.flatMap<{
      source: "YOUTUBE" | "CLOUDINARY";
      title: string;
      url: string;
      poster: string;
    }>((video) => {
      if (video.source === "YOUTUBE")
        return [
          {
            source: "YOUTUBE" as const,
            title: video.title,
            url: "https://www.youtube-nocookie.com/embed/" + video.videoId,
            poster:
              "https://i.ytimg.com/vi/" + video.videoId + "/hqdefault.jpg",
          },
        ];
      const asset = media.find(
        (a) => a._id.toString() === video.assetId && a.resourceType === "video",
      );
      return asset
        ? [
            {
              source: "CLOUDINARY" as const,
              title: video.title,
              url: String(asset.secureUrl),
              poster: String(asset.posterUrl ?? ""),
            },
          ]
        : [];
    }),
  };
}
export const publicProduct = unstable_cache(
  (slug: string) => readPublicProduct(slug),
  ["product-detail-v1"],
  { tags: ["catalog"], revalidate: 60 },
);
export type PublicProduct = NonNullable<
  Awaited<ReturnType<typeof readPublicProduct>>
>;
