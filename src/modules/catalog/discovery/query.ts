import { parsePaise } from "../pricing";
import {
  CatalogQueryError,
  type CatalogMetadata,
  type CatalogQuery,
  type CatalogScope,
  type CatalogSort,
} from "./contracts";

export function normalizeCatalogQuery(
  scope: CatalogScope,
  params: URLSearchParams,
  meta: CatalogMetadata,
): CatalogQuery {
  if (params.toString().length > 4096 || [...params].length > 100)
    throw new CatalogQueryError("INVALID_QUERY");
  const normalized = new URLSearchParams();
  const list = (key: string, allowed?: Set<string>) => {
    const raw = params.getAll(key).flatMap((v) => v.split(","));
    if (raw.length > 20 || raw.some((v) => v.length > 100))
      throw new CatalogQueryError("INVALID_QUERY");
    const values = [
      ...new Set(raw.filter((v) => v && (!allowed || allowed.has(v)))),
    ].sort();
    for (const v of values) normalized.append(key, v);
    return values;
  };
  const range = (key: string, money = false) => {
    const raw = params.get(key);
    if (raw === null || raw === "") return undefined;
    const value = money
      ? parsePaise(raw)
      : /^-?\d{1,12}(?:\.\d{1,6})?$/.test(raw)
        ? Number(raw)
        : null;
    if (
      value === null ||
      !Number.isFinite(value) ||
      (money && value > 999999999999)
    )
      throw new CatalogQueryError("INVALID_QUERY");
    normalized.set(key, money ? (value / 100).toFixed(2) : String(value));
    return value;
  };
  const q = (params.get("q") ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
  if (q.length > 120) throw new CatalogQueryError("INVALID_QUERY");
  const terms = [...new Set(q.toLowerCase().split(" ").filter(Boolean))];
  if (terms.length > 8) throw new CatalogQueryError("INVALID_QUERY");
  if (q) normalized.set("q", q);
  const sorts = new Set([
    "price-asc",
    "price-desc",
    "newest",
    "name",
    ...(q ? ["relevance"] : []),
  ]);
  const defaultSort = q ? "relevance" : "newest";
  const sort = (
    sorts.has(params.get("sort") ?? "") ? params.get("sort") : defaultSort
  ) as CatalogSort;
  if (sort !== defaultSort) normalized.set("sort", sort);
  const rawPage = params.get("page") ?? "1";
  const page = /^[1-9]\d{0,5}$/.test(rawPage) ? Number(rawPage) : 1;
  if (page > 1) normalized.set("page", String(page));
  const brands = list("brand", new Set(meta.brands.map((b) => b.slug)));
  const categories = list(
    "category",
    new Set(meta.categories.map((c) => c.slug)),
  );
  const availability = list(
    "availability",
    new Set(["in-stock", "out-of-stock"]),
  );
  const minPrice = range("min", true),
    maxPrice = range("max", true);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
    throw new CatalogQueryError("INVALID_QUERY");
  const attributes: CatalogQuery["attributes"] = [];
  for (const definition of meta.attributes) {
    const key = "f." + definition.code;
    if (definition.type === "NUMBER") {
      const min = range(key + ".min"),
        max = range(key + ".max");
      if (min !== undefined && max !== undefined && min > max)
        throw new CatalogQueryError("INVALID_QUERY");
      if (min !== undefined || max !== undefined)
        attributes.push({ code: definition.code, values: [], min, max });
    } else {
      const allowed =
        definition.type === "BOOLEAN"
          ? new Set(["true", "false"])
          : definition.type === "TEXT"
            ? undefined
            : new Set(definition.options.map((o) => o.id));
      const values = list(key, allowed);
      if (values.length) attributes.push({ code: definition.code, values });
    }
  }
  if (attributes.length > 12) throw new CatalogQueryError("INVALID_QUERY");
  return {
    scope,
    q,
    terms,
    page,
    sort,
    brandIds: meta.brands
      .filter((b) => brands.includes(b.slug))
      .map((b) => b.id),
    categoryIds: meta.categories
      .filter((c) => categories.includes(c.slug))
      .map((c) => c.id),
    availability,
    minPrice,
    maxPrice,
    attributes,
    normalizedQuery: normalized.toString(),
  };
}

/** Bounded traversal, shared once per request, never a DB call per node/product. */
export function categoryDescendants(id: string, metadata: CatalogMetadata) {
  const found = new Set<string>();
  let level = [id];
  for (let depth = 0; level.length && depth < 5; depth++) {
    const next: string[] = [];
    for (const current of level) {
      if (found.has(current)) throw new CatalogQueryError("INVALID_QUERY");
      found.add(current);
      next.push(
        ...metadata.categories
          .filter((c) => c.parentId === current)
          .map((c) => c.id),
      );
    }
    level = next;
  }
  if (level.length) throw new CatalogQueryError("INVALID_QUERY");
  return [...found];
}
