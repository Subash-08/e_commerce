import type { Metadata } from "next";
import {
  CatalogListing,
  InvalidCatalogQuery,
} from "@/modules/catalog/discovery/CatalogListing";
import {
  listingSeo,
  loadCatalogListing,
  type RouteSearchParams,
} from "@/modules/catalog/discovery/loader";
import { Breadcrumbs } from "@/shared/ui/storefront/Breadcrumbs";

const origin = () => process.env.APP_URL ?? "http://localhost:3300";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}): Promise<Metadata> {
  const seo = listingSeo(await searchParams, "/products");
  return {
    title: "All products",
    description:
      "Browse our current product collection and narrow it by brand, category, price, availability and product attributes.",
    alternates: { canonical: new URL(seo.canonical, origin()).toString() },
    robots: { index: seo.index, follow: true },
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  const listing = await loadCatalogListing({ kind: "all" }, await searchParams);
  return (
    <div className="sf-catalog-container">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Products" }]}
      />
      {listing.kind === "invalid" ? (
        <InvalidCatalogQuery basePath="/products" />
      ) : (
        <CatalogListing
          result={listing.result}
          basePath="/products"
          eyebrow="Catalog"
          title="All products"
          description="Browse the collection and use the filters to find the right option."
        />
      )}
    </div>
  );
}
