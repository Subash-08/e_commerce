import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { CatalogQueryError, type CatalogScope } from "./contracts";
import { discoverCatalog } from "./service";

export type RouteSearchParams = Record<string, string | string[] | undefined>;

export function serializeSearchParams(input: RouteSearchParams) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  }
  return params.toString();
}

const read = cache(
  async (kind: CatalogScope["kind"], slug: string, queryString: string) => {
    const scope: CatalogScope =
      kind === "brand" || kind === "category" ? { kind, slug } : { kind };
    return discoverCatalog(scope, new URLSearchParams(queryString));
  },
);

export async function loadCatalogListing(
  scope: CatalogScope,
  input: RouteSearchParams,
) {
  try {
    return {
      kind: "result" as const,
      result: await read(
        scope.kind,
        "slug" in scope ? scope.slug : "",
        serializeSearchParams(input),
      ),
    };
  } catch (error) {
    if (
      error instanceof CatalogQueryError &&
      (error.code === "PAGE_NOT_FOUND" || error.code === "SCOPE_NOT_FOUND")
    )
      notFound();
    if (error instanceof CatalogQueryError) return { kind: "invalid" as const };
    throw error;
  }
}

export function listingSeo(input: RouteSearchParams, pathname: string) {
  const keys = Object.keys(input);
  const onlyCleanPage = keys.every((key) => key === "page");
  const rawPage = Array.isArray(input.page) ? input.page[0] : input.page;
  const page = rawPage && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1;
  const canonical =
    onlyCleanPage && page > 1 ? `${pathname}?page=${page}` : pathname;
  return { canonical, index: onlyCleanPage };
}
