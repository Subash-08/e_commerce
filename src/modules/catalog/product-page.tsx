import { Suspense, cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { publicProduct } from "@/modules/catalog/public";
import { ProductDetail } from "@/modules/catalog/detail";
import { selectVariant } from "@/modules/catalog/selection";
import { variantPath } from "./urls";
import { Breadcrumbs } from "@/shared/ui/storefront/Breadcrumbs";
import { ProductDetailSkeleton } from "@/shared/ui/storefront/ProductDetailSkeleton";
import "@/shared/styles/product.css";

const read = cache(publicProduct);

function origin() {
  const value = process.env.APP_URL;
  if (!value) throw new Error("APP_URL_REQUIRED");
  return value;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; variantKey?: string }>;
}): Promise<Metadata> {
  const p = await read((await params).slug);
  if (!p) return { robots: { index: false, follow: false } };
  const canonical = new URL("/product/" + p.slug, origin()).toString();
  return {
    title: p.seo.title || p.name,
    description: p.seo.description || p.summary,
    alternates: { canonical },
    robots: { index: p.seo.robotsIndex, follow: true },
    openGraph: {
      title: p.name,
      description: p.summary,
      url: canonical,
      images: p.images.slice(0, 1).map((i) => ({ url: i.url, alt: i.alt })),
    },
  };
}

export async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; variantKey?: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, variantKey } = await params;
  const p = await read(slug);
  if (!p) notFound();
  const q = await searchParams;
  const requested = variantKey
    ? (p.variants.find((v) => v.urlKey === variantKey)?.id ?? "unavailable")
    : typeof q.variant === "string"
      ? q.variant
      : undefined;
  const selected = selectVariant(p, requested).variant;
  const canonical = new URL("/product/" + p.slug, origin()).toString();
  const variants = p.variants.map((v) => ({
    "@type": "Product",
    "@id": new URL(variantPath(p.slug, v.urlKey), origin()).toString(),
    name: p.name + (v.title ? " — " + v.title : ""),
    sku: v.sku,
    image: (v.images.length ? v.images : p.images).map((i) => i.url),
    url: new URL(variantPath(p.slug, v.urlKey), origin()).toString(),
    offers: {
      "@type": "Offer",
      price: (v.pricePaise / 100).toFixed(2),
      priceCurrency: "INR",
      availability:
        "https://schema.org/" + (v.available ? "InStock" : "OutOfStock"),
      url: new URL(variantPath(p.slug, v.urlKey), origin()).toString(),
    },
  }));
  const schema = {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    "@id": canonical,
    productGroupID: p.id,
    name: p.name,
    description: p.summary,
    url: canonical,
    brand: p.brand ? { "@type": "Brand", name: p.brand.name } : undefined,
    variesBy: p.axes.map((a) => a.name),
    hasVariant: variants.sort(
      (a, b) =>
        Number(b.sku === selected?.sku) - Number(a.sku === selected?.sku),
    ),
  };

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    ...(p.category
      ? [{ label: p.category.name, href: "/category/" + p.category.slug }]
      : []),
    { label: p.name },
  ];

  return (
    <div className="sf-catalog-container product-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
      <Breadcrumbs items={breadcrumbItems} />
      <Suspense fallback={<ProductDetailSkeleton />}>
        <ProductDetail product={p} initialVariant={requested} />
      </Suspense>
    </div>
  );
}
