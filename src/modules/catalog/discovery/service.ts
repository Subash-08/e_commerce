import "server-only";
import { ObjectId, type Db } from "mongodb";
import { cache } from "react";
import { getDatabase } from "../../../server/db/connection";
import { variantPath } from "../urls";
import { readCatalogMetadata, runCatalogQuery } from "./repository";
import { normalizeCatalogQuery, categoryDescendants } from "./query";
import {
  CatalogQueryError,
  PAGE_SIZE,
  type CatalogScope,
  type CatalogMetadata,
  type CatalogResult,
  type CatalogFacet,
  type ProductCard,
  type FacetValue,
} from "./contracts";

const requestMetadata = cache(async () =>
  readCatalogMetadata((await getDatabase()).db),
);
type ImageRef = { assetId?: string; url?: string; alt: string };
type Row = {
  _id: ObjectId;
  name: string;
  slug: string;
  summary: string;
  brandId: ObjectId;
  thumbnail?: ImageRef;
  hoverImage?: ImageRef;
  matchingVariantCount: number;
  maxPrice: number;
  v: {
    _id: ObjectId;
    urlKey: string;
    title: string;
    pricePaise: number;
    mrpPaise: number;
    available: boolean;
    media: ImageRef[];
  };
};
type Count = { _id: unknown; count: number };
function choices(
  counts: Count[],
  selected: string[],
  definitions?: { value: string; label: string; colour?: string }[],
): FacetValue[] {
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  const options =
    definitions ??
    [...new Set([...countMap.keys(), ...selected])].map((value) => ({
      value,
      label: value,
    }));
  return options
    .filter((o) => countMap.has(o.value) || selected.includes(o.value))
    .map((o) => ({
      ...o,
      count: countMap.get(o.value) ?? 0,
      selected: selected.includes(o.value),
    }));
}

/** Server-only API shared by all four listing routes. No filtered-result cache. */
export async function discoverCatalog(
  scope: CatalogScope,
  params: URLSearchParams,
  database?: Db,
  suppliedMetadata?: CatalogMetadata,
): Promise<CatalogResult> {
  const db = database ?? (await getDatabase()).db;
  const meta =
    suppliedMetadata ??
    (database ? await readCatalogMetadata(db) : await requestMetadata());
  const query = normalizeCatalogQuery(scope, params, meta);
  const result = await runCatalogQuery(db, query, meta);
  const total = Number(result?.total?.[0]?.count ?? 0);
  const pages = Math.ceil(total / PAGE_SIZE);
  if (query.page > Math.max(1, pages))
    throw new CatalogQueryError("PAGE_NOT_FOUND");
  const rows: Row[] = result?.items ?? [];
  const imageIds = [
    ...new Set(
      rows.flatMap((r) =>
        [r.v.media?.[0], r.thumbnail, r.hoverImage].flatMap((ref) =>
          ref?.assetId ? [ref.assetId] : [],
        ),
      ),
    ),
  ];
  const assets = imageIds.length
    ? await db
        .collection("mediaAssets")
        .find(
          {
            _id: { $in: imageIds.map((id) => new ObjectId(id)) },
            resourceType: "image",
          },
          { maxTimeMS: 1500, projection: { secureUrl: 1 } },
        )
        .toArray()
    : [];
  const image = (ref?: ImageRef): ProductCard["image"] => {
    if (!ref) return null;
    const url =
      ref.url ?? assets.find((a) => String(a._id) === ref.assetId)?.secureUrl;
    return typeof url === "string" ? { url, alt: ref.alt } : null;
  };
  const items: ProductCard[] = rows.map((r) => {
    const brand = meta.brands.find((b) => b.id === String(r.brandId))!;
    const hasVariantImage = Boolean(r.v.media?.length);
    return {
      id: String(r._id),
      name: r.name,
      slug: r.slug,
      summary: r.summary,
      brand: { name: brand.name, slug: brand.slug },
      variantId: String(r.v._id),
      variantKey: r.v.urlKey,
      variantTitle: r.v.title,
      url: variantPath(r.slug, r.v.urlKey),
      pricePaise: Number(r.v.pricePaise),
      mrpPaise: Number(r.v.mrpPaise),
      discountPercent:
        r.v.mrpPaise > r.v.pricePaise
          ? Math.floor(((r.v.mrpPaise - r.v.pricePaise) * 100) / r.v.mrpPaise)
          : 0,
      available: r.v.available,
      image: image(r.v.media?.[0]) ?? image(r.thumbnail),
      hoverImage: hasVariantImage ? null : image(r.hoverImage),
      hasPriceRange: r.maxPrice > r.v.pricePaise,
      matchingVariantCount: r.matchingVariantCount,
    };
  });
  const facets: CatalogFacet[] = [];
  if (scope.kind !== "brand")
    facets.push({
      key: "brand",
      label: "Brand",
      type: "MULTI_SELECT",
      values: choices(
        result?.brand ?? [],
        query.brandIds,
        meta.brands.map((b) => ({ value: b.id, label: b.name })),
      ).map((v) => ({
        ...v,
        value: meta.brands.find((b) => b.id === v.value)!.slug,
      })),
    });
  let categoryOptions = meta.categories;
  if (scope.kind === "category") {
    const current = meta.categories.find((c) => c.slug === scope.slug)!;
    const children = new Set(categoryDescendants(current.id, meta));
    categoryOptions = categoryOptions.filter(
      (c) =>
        c.id !== current.id &&
        (children.has(c.id) || query.categoryIds.includes(c.id)),
    );
  }
  facets.push({
    key: "category",
    label: "Category",
    type: "MULTI_SELECT",
    values: choices(
      result?.category ?? [],
      query.categoryIds,
      categoryOptions.map((c) => ({ value: c.id, label: c.name })),
    ).map((v) => ({
      ...v,
      value: meta.categories.find((c) => c.id === v.value)!.slug,
    })),
  });
  facets.push({
    key: "availability",
    label: "Availability",
    type: "MULTI_SELECT",
    values: choices(
      (result?.availability ?? []).map((c: Count) => ({
        ...c,
        _id: c._id ? "in-stock" : "out-of-stock",
      })),
      query.availability,
      [
        { value: "in-stock", label: "In stock" },
        { value: "out-of-stock", label: "Out of stock" },
      ],
    ),
  });
  meta.attributes.forEach((def, index) => {
    const data = result?.["a" + index] ?? [];
    const selection = query.attributes.find((a) => a.code === def.code);
    if (def.type === "NUMBER") {
      if (data.length || selection)
        facets.push({
          key: "f." + def.code,
          label: def.name,
          type: def.type,
          unit: def.unit,
          values: [],
          min: data[0]?.min,
          max: data[0]?.max,
          selectedMin: selection?.min,
          selectedMax: selection?.max,
        });
    } else {
      const definitions = ["SINGLE_SELECT", "MULTI_SELECT", "COLOUR"].includes(
        def.type,
      )
        ? def.options.map((o) => ({
            value: o.id,
            label: o.label,
            colour: o.colour || undefined,
          }))
        : def.type === "BOOLEAN"
          ? [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ]
          : undefined;
      const values = choices(
        data.slice(0, 100),
        selection?.values ?? [],
        definitions,
      );
      if (values.length)
        facets.push({
          key: "f." + def.code,
          label: def.name,
          type: def.type,
          unit: def.unit,
          values,
          truncated: data.length > 100,
        });
    }
  });
  return {
    query,
    items,
    total,
    page: query.page,
    pageSize: PAGE_SIZE,
    pages,
    facets: facets.filter((f) => f.values.length || f.type === "NUMBER"),
    price: {
      min: result?.price?.[0]?.min ?? null,
      max: result?.price?.[0]?.max ?? null,
      selectedMin: query.minPrice,
      selectedMax: query.maxPrice,
    },
  };
}
