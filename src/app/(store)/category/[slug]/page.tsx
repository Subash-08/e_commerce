import { cache } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { publicCategory } from "@/modules/categories/public";
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

export const dynamic = "force-dynamic";
const read = cache(publicCategory);
const appOrigin = () => process.env.APP_URL ?? "http://localhost:3300";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RouteSearchParams>;
}): Promise<Metadata> {
  const row = await read((await params).slug);
  if (!row || row.kind === "redirect")
    return { robots: { index: false, follow: false } };
  const title = row.seo.title || row.name;
  const description = row.seo.description || row.description.slice(0, 170);
  const basePath = row.seo.canonicalPath || "/category/" + row.slug;
  const seo = listingSeo(await searchParams, basePath);
  const canonical = new URL(seo.canonical, appOrigin()).toString();
  return {
    title,
    description,
    alternates: { canonical },
    robots: {
      index: row.seo.robotsIndex && seo.index,
      follow: row.seo.robotsFollow,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      images: row.image ? [{ url: row.image.url, alt: row.image.alt }] : [],
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RouteSearchParams>;
}) {
  const row = await read((await params).slug);
  if (!row) notFound();
  if (row.kind === "redirect") permanentRedirect(row.destination);

  const basePath = "/category/" + row.slug;
  const listing = await loadCatalogListing(
    { kind: "category", slug: row.slug },
    await searchParams,
  );
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: row.crumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL("/category/" + item.slug, appOrigin()).toString(),
    })),
  };
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    ...row.crumbs.map((crumb, index) => ({
      label: crumb.name,
      href:
        index === row.crumbs.length - 1 ? undefined : "/category/" + crumb.slug,
    })),
  ];

  return (
    <div className="sf-catalog-container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c"),
        }}
      />
      <Breadcrumbs items={breadcrumbItems} />
      <section className="sf-category-hero">
        {row.image && (
          <div className="sf-category-image-wrap">
            <Image
              unoptimized
              src={row.image.url}
              alt={row.image.alt}
              width={1200}
              height={360}
              className="sf-category-banner"
            />
          </div>
        )}
        <div className="sf-category-header">
          <span className="sf-category-badge">Category</span>
          <h1 className="sf-category-title">{row.name}</h1>
          {row.description && (
            <p className="sf-category-desc">{row.description}</p>
          )}
        </div>
      </section>
      {row.children.length > 0 && (
        <section className="sf-category-section">
          <h2 className="sf-category-section-title">Browse categories</h2>
          <div className="sf-child-category-grid">
            {row.children.map((child) => (
              <Link
                key={child.slug}
                href={"/category/" + child.slug}
                className="sf-child-category-card"
              >
                <div className="sf-child-category-content">
                  <span className="sf-child-category-name">{child.name}</span>
                  <span className="sf-child-category-sub">View category</span>
                </div>
                <span className="sf-child-category-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {listing.kind === "invalid" ? (
        <InvalidCatalogQuery basePath={basePath} />
      ) : (
        <CatalogListing
          result={listing.result}
          basePath={basePath}
          eyebrow="Collection"
          title={`Products in ${row.name}`}
          headingLevel={2}
        />
      )}
    </div>
  );
}
