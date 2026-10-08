import type { Metadata } from "next";
import {
  CatalogListing,
  InvalidCatalogQuery,
} from "@/modules/catalog/discovery/CatalogListing";
import {
  loadCatalogListing,
  type RouteSearchParams,
} from "@/modules/catalog/discovery/loader";
import { Breadcrumbs } from "@/shared/ui/storefront/Breadcrumbs";

export const metadata: Metadata = {
  title: "Search products",
  description: "Search the product catalog.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  const listing = await loadCatalogListing(
    { kind: "search" },
    await searchParams,
  );
  return (
    <div className="sf-catalog-container">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Search" }]}
      />
      {listing.kind === "invalid" ? (
        <InvalidCatalogQuery basePath="/search" />
      ) : (
        <CatalogListing
          result={listing.result}
          basePath="/search"
          eyebrow="Search"
          title={
            listing.result.query.q
              ? `Results for “${listing.result.query.q}”`
              : "Search products"
          }
          description={
            listing.result.query.q
              ? "Filter or sort the matching products below."
              : "Enter a product, brand, model or SKU in the search box."
          }
        />
      )}
    </div>
  );
}
