import "server-only";
import { ObjectId, type Db, type Document } from "mongodb";
import {
  CatalogQueryError,
  PAGE_SIZE,
  type CatalogMetadata,
  type CatalogQuery,
  type FacetDefinition,
} from "./contracts";
import { categoryDescendants } from "./query";

const ids = (values: string[]) => values.map((v) => new ObjectId(v));
const literal = (value: unknown) => ({ $literal: value });

/** Decimal arithmetic mirrors integer-paise half-up GST, not binary floating point. */
function payable(field: string) {
  return {
    $cond: [
      { $eq: ["$priceMode", "INCLUSIVE"] },
      field,
      {
        $toLong: {
          $floor: {
            $add: [
              {
                $divide: [
                  {
                    $multiply: [
                      { $toDecimal: field },
                      { $add: [10000, "$gstRateBps"] },
                    ],
                  },
                  10000,
                ],
              },
              0.5,
            ],
          },
        },
      },
    ],
  };
}
function attributeValues(def: FacetDefinition) {
  return {
    $let: {
      vars: {
        optionRefs: {
          $filter: {
            input: { $ifNull: ["$v.options", []] },
            as: "o",
            cond: { $eq: ["$$o.attributeId", def.id] },
          },
        },
        assignment: {
          $arrayElemAt: [
            {
              $filter: {
                input: { $ifNull: ["$attributes", []] },
                as: "a",
                cond: { $eq: ["$$a.attributeId", def.id] },
              },
            },
            0,
          ],
        },
      },
      in: {
        $cond: [
          { $gt: [{ $size: "$$optionRefs" }, 0] },
          { $map: { input: "$$optionRefs", as: "o", in: "$$o.optionId" } },
          {
            $cond: [
              { $eq: [{ $type: "$$assignment.value" }, "missing"] },
              [],
              {
                $cond: [
                  { $isArray: "$$assignment.value" },
                  "$$assignment.value",
                  ["$$assignment.value"],
                ],
              },
            ],
          },
        ],
      },
    },
  };
}

export function catalogPipeline(
  query: CatalogQuery,
  meta: CatalogMetadata,
): Document[] {
  const categoryIds = (selected: string[]) =>
    ids([...new Set(selected.flatMap((id) => categoryDescendants(id, meta)))]);
  const scope: Document = {
    status: "ACTIVE",
    brandId: { $in: ids(meta.brands.map((b) => b.id)) },
    primaryCategoryId: { $in: ids(meta.categories.map((c) => c.id)) },
  };
  if (query.scope.kind === "brand") {
    const slug = query.scope.slug;
    const brand = meta.brands.find((b) => b.slug === slug);
    if (!brand) throw new CatalogQueryError("SCOPE_NOT_FOUND");
    scope.brandId = new ObjectId(brand.id);
  }
  if (query.scope.kind === "category") {
    const slug = query.scope.slug;
    const category = meta.categories.find((c) => c.slug === slug);
    if (!category) throw new CatalogQueryError("SCOPE_NOT_FOUND");
    scope.categoryIds = { $in: categoryIds([category.id]) };
  }
  const conditions = (excluded?: string): Document[] => {
    const clauses: Document[] = [];
    if (excluded !== "brand" && query.brandIds.length)
      clauses.push({ brandId: { $in: ids(query.brandIds) } });
    if (excluded !== "category" && query.categoryIds.length)
      clauses.push({ categoryIds: { $in: categoryIds(query.categoryIds) } });
    if (excluded !== "availability" && query.availability.length === 1)
      clauses.push({ "v.available": query.availability[0] === "in-stock" });
    if (
      excluded !== "price" &&
      (query.minPrice !== undefined || query.maxPrice !== undefined)
    )
      clauses.push({
        "v.pricePaise": {
          ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
          ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
        },
      });
    for (const filter of query.attributes) {
      if (excluded === "f." + filter.code) continue;
      const index = meta.attributes.findIndex((a) => a.code === filter.code);
      const def = meta.attributes[index];
      if (!def) continue;
      if (def.type === "NUMBER")
        clauses.push({
          ["facetAttributes.a" + index]: {
            $elemMatch: {
              $type: "number",
              ...(filter.min !== undefined ? { $gte: filter.min } : {}),
              ...(filter.max !== undefined ? { $lte: filter.max } : {}),
            },
          },
        });
      else
        clauses.push({
          ["facetAttributes.a" + index]: {
            $in:
              def.type === "BOOLEAN"
                ? filter.values.map((v) => v === "true")
                : filter.values,
          },
        });
    }
    return clauses.length ? [{ $match: { $and: clauses } }] : [];
  };
  const uniqueProducts = [{ $group: { _id: "$_id" } }, { $count: "count" }];
  const valueFacet = (key: string, values: unknown): Document[] => [
    ...conditions(key),
    { $project: { values } },
    { $unwind: "$values" },
    { $group: { _id: { product: "$_id", value: "$values" } } },
    { $group: { _id: "$_id.value", count: { $sum: 1 } } },
    {
      $set: {
        selected: {
          $in: [
            { $toString: "$_id" },
            literal(
              key.startsWith("f.")
                ? (query.attributes.find((a) => "f." + a.code === key)
                    ?.values ?? [])
                : [],
            ),
          ],
        },
      },
    },
    { $sort: { selected: -1, _id: 1 } },
    { $limit: key === "brand" || key === "category" ? 1001 : 101 },
  ];
  const sort: Document =
    query.sort === "price-asc"
      ? { "v.pricePaise": 1, _id: 1 }
      : query.sort === "price-desc"
        ? { "v.pricePaise": -1, _id: 1 }
        : query.sort === "name"
          ? { nameNormalized: 1, _id: 1 }
          : query.sort === "relevance"
            ? { score: -1, _id: 1 }
            : { publishedAt: -1, _id: -1 };
  const facets: Document = {
    items: [
      ...conditions(),
      { $sort: { "v.pricePaise": 1, "v._id": 1 } },
      {
        $group: {
          _id: "$_id",
          row: { $first: "$$ROOT" },
          matchingVariantCount: { $sum: 1 },
          maxPrice: { $max: "$v.pricePaise" },
          score: { $max: "$score" },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$row",
              {
                matchingVariantCount: "$matchingVariantCount",
                maxPrice: "$maxPrice",
                score: "$score",
              },
            ],
          },
        },
      },
      { $sort: sort },
      { $skip: (query.page - 1) * PAGE_SIZE },
      { $limit: PAGE_SIZE },
      {
        $project: {
          _id: 1,
          name: 1,
          slug: 1,
          summary: 1,
          brandId: 1,
          thumbnail: 1,
          hoverImage: 1,
          "v._id": 1,
          "v.urlKey": 1,
          "v.title": 1,
          "v.pricePaise": 1,
          "v.mrpPaise": 1,
          "v.available": 1,
          "v.media": 1,
          matchingVariantCount: 1,
          maxPrice: 1,
        },
      },
    ],
    total: [...conditions(), ...uniqueProducts],
    price: [
      ...conditions("price"),
      {
        $group: {
          _id: null,
          min: { $min: "$v.pricePaise" },
          max: { $max: "$v.pricePaise" },
        },
      },
    ],
    brand: valueFacet("brand", ["$brandId"]),
    category: valueFacet("category", "$facetCategories"),
    availability: valueFacet("availability", ["$v.available"]),
  };
  meta.attributes.forEach((def, index) => {
    const field = "$facetAttributes.a" + index;
    facets["a" + index] =
      def.type === "NUMBER"
        ? [
            ...conditions("f." + def.code),
            { $unwind: field },
            { $match: { [field.slice(1)]: { $type: "number" } } },
            {
              $group: { _id: null, min: { $min: field }, max: { $max: field } },
            },
          ]
        : valueFacet("f." + def.code, field);
  });
  const searchText = {
    $toLower: {
      $concat: [
        "$name",
        " ",
        { $ifNull: ["$modelNumber", ""] },
        " ",
        {
          $reduce: {
            input: { $ifNull: ["$tags", []] },
            initialValue: "",
            in: { $concat: ["$$value", " ", "$$this"] },
          },
        },
        " ",
        "$v.sku",
      ],
    },
  };
  const searchStages: Document[] = query.terms.length
    ? [
        {
          $match: {
            $expr: {
              $and: query.terms.map((term) => ({
                $gte: [{ $indexOfCP: [searchText, literal(term)] }, 0],
              })),
            },
          },
        },
        {
          $set: {
            score: {
              $switch: {
                branches: [
                  {
                    case: {
                      $eq: [
                        { $toLower: "$v.sku" },
                        literal(query.q.toLowerCase()),
                      ],
                    },
                    then: 200,
                  },
                  {
                    case: {
                      $eq: ["$nameNormalized", literal(query.q.toLowerCase())],
                    },
                    then: 100,
                  },
                  {
                    case: {
                      $eq: [
                        {
                          $indexOfCP: [
                            "$nameNormalized",
                            literal(query.q.toLowerCase()),
                          ],
                        },
                        0,
                      ],
                    },
                    then: 50,
                  },
                ],
                default: 10,
              },
            },
          },
        },
      ]
    : [{ $set: { score: 0 } }];
  return [
    { $match: scope },
    {
      $project: {
        name: 1,
        slug: 1,
        summary: 1,
        nameNormalized: 1,
        modelNumber: 1,
        tags: 1,
        brandId: 1,
        categoryIds: 1,
        primaryCategoryId: 1,
        attributes: 1,
        thumbnail: 1,
        hoverImage: 1,
        createdAt: 1,
        publishedAt: 1,
      },
    },
    {
      $lookup: {
        from: "variants",
        localField: "_id",
        foreignField: "productId",
        pipeline: [
          {
            $match: {
              active: true,
              archived: false,
              urlKey: { $type: "string" },
            },
          },
          {
            $project: {
              sku: 1,
              title: 1,
              urlKey: 1,
              options: 1,
              media: 1,
              salePaise: 1,
              mrpPaise: 1,
              priceMode: 1,
              gstRateBps: 1,
              trackQuantity: 1,
              stockStatus: 1,
              onHand: 1,
              reserved: 1,
            },
          },
          {
            $set: {
              pricePaise: payable("$salePaise"),
              mrpPaise: payable("$mrpPaise"),
              available: {
                $cond: [
                  "$trackQuantity",
                  {
                    $gt: [
                      { $ifNull: ["$onHand", 0] },
                      { $ifNull: ["$reserved", 0] },
                    ],
                  },
                  { $eq: ["$stockStatus", "IN_STOCK"] },
                ],
              },
            },
          },
        ],
        as: "v",
      },
    },
    { $unwind: "$v" },
    ...searchStages,
    {
      $set: {
        publishedAt: { $ifNull: ["$publishedAt", "$createdAt"] },
        facetAttributes: Object.fromEntries(
          meta.attributes.map((def, i) => ["a" + i, attributeValues(def)]),
        ),
        facetCategories: {
          $reduce: {
            input: meta.categories.map((c) => ({
              $cond: [
                {
                  $gt: [
                    {
                      $size: {
                        $setIntersection: [
                          { $ifNull: ["$categoryIds", []] },
                          categoryIds([c.id]),
                        ],
                      },
                    },
                    0,
                  ],
                },
                [c.id],
                [],
              ],
            })),
            initialValue: [],
            in: { $setUnion: ["$$value", "$$this"] },
          },
        },
      },
    },
    { $facet: facets },
  ];
}

export async function readCatalogMetadata(db: Db): Promise<CatalogMetadata> {
  const opts = { maxTimeMS: 1500 };
  // Keep metadata reads sequential. With the intentionally small Atlas pool,
  // three parallel checkouts per render can starve a second concurrent render
  // before either request reaches the main aggregation.
  const brands = await db
    .collection("brands")
    .find(
      { active: true, archivedAt: null },
      { ...opts, projection: { name: 1, slug: 1 } },
    )
    .limit(1001)
    .toArray();
  const categories = await db
    .collection("categories")
    .find(
      { active: true, archivedAt: null },
      { ...opts, projection: { name: 1, slug: 1, parentId: 1 } },
    )
    .limit(1001)
    .toArray();
  const attributes = await db
    .collection("attributes")
    .find(
      { active: true, visible: true, filterable: true },
      {
        ...opts,
        projection: {
          code: 1,
          name: 1,
          type: 1,
          unit: 1,
          options: 1,
          displayOrder: 1,
        },
      },
    )
    .sort({ displayOrder: 1, _id: 1 })
    .limit(41)
    .toArray();
  if (
    brands.length > 1000 ||
    categories.length > 1000 ||
    attributes.length > 40
  )
    throw new CatalogQueryError("FACET_LIMIT");
  const live = new Set(categories.map((c) => String(c._id)));
  const validCategories = categories.filter((c) => {
    const seen = new Set<string>();
    let current = c;
    for (let depth = 0; depth < 4; depth++) {
      const id = String(current._id);
      if (seen.has(id)) return false;
      seen.add(id);
      if (!current.parentId) return true;
      if (!live.has(String(current.parentId))) return false;
      current = categories.find(
        (x) => String(x._id) === String(current.parentId),
      )!;
    }
    return false;
  });
  return {
    brands: brands.map((b) => ({
      id: String(b._id),
      slug: String(b.slug),
      name: String(b.name),
    })),
    categories: validCategories.map((c) => ({
      id: String(c._id),
      slug: String(c.slug),
      name: String(c.name),
      parentId: c.parentId ? String(c.parentId) : null,
    })),
    attributes: attributes.map((a) => ({
      id: String(a._id),
      code: String(a.code),
      name: String(a.name),
      type: String(a.type),
      unit: String(a.unit ?? ""),
      options: a.options ?? [],
    })),
  };
}

export async function runCatalogQuery(
  db: Db,
  query: CatalogQuery,
  metadata: CatalogMetadata,
) {
  return db
    .collection("products")
    .aggregate(catalogPipeline(query, metadata), {
      maxTimeMS: 1800,
      allowDiskUse: false,
    })
    .next();
}
