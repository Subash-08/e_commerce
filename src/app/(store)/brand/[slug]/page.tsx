import { cache } from "react";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { publicBrand } from "@/modules/brands/public";
import { Breadcrumbs } from "@/shared/ui/storefront/Breadcrumbs";

export const dynamic = "force-dynamic";
const read = cache(publicBrand);
const appOrigin = () => process.env.APP_URL ?? "http://localhost:3300";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const row = await read((await params).slug);
  if (!row || row.kind === "redirect")
    return { robots: { index: false, follow: false } };
  const title = row.seo.title || row.name;
  const description = row.seo.description || row.description.slice(0, 170);
  const canonical = new URL(
    row.seo.canonicalPath || "/brand/" + row.slug,
    appOrigin(),
  ).toString();
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: row.seo.robotsIndex, follow: row.seo.robotsFollow },
    openGraph: {
      title,
      description,
      url: canonical,
      images: row.logo ? [{ url: row.logo.url, alt: row.logo.alt }] : [],
    },
  };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const row = await read((await params).slug);
  if (!row) notFound();
  if (row.kind === "redirect") permanentRedirect(row.destination);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Brand",
    name: row.name,
    description: row.description,
    url: new URL("/brand/" + row.slug, appOrigin()).toString(),
    ...(row.logo ? { logo: row.logo.url } : {}),
  };

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: row.name },
  ];

  return (
    <div className="sf-catalog-container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <Breadcrumbs items={breadcrumbItems} />

      <section className="sf-brand-hero">
        {row.logo ? (
          <div className="sf-brand-logo-wrap">
            <Image
              unoptimized
              src={row.logo.url}
              alt={row.logo.alt}
              width={180}
              height={100}
              className="sf-brand-logo-img"
            />
          </div>
        ) : (
          <div className="sf-brand-logo-fallback" aria-hidden="true">
            {row.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="sf-brand-header-info">
          <span className="sf-brand-badge">Brand</span>
          <h1 className="sf-brand-title">{row.name}</h1>
          {row.description && (
            <p className="sf-brand-desc">{row.description}</p>
          )}
        </div>
      </section>

      <div className="sf-catalog-notice">
        <p>
          Products from <strong>{row.name}</strong> will appear here once the
          catalog discovery grid launches.
        </p>
      </div>
    </div>
  );
}
