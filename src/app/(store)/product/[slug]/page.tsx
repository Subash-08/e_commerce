import { Suspense, cache } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { publicProduct } from "@/modules/catalog/public";
import { ProductDetail } from "@/modules/catalog/detail";
import { selectVariant } from "@/modules/catalog/selection";
import { getDatabase } from "@/server/db/connection";
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
  params: Promise<{ slug: string }>;
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
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const p = await read(slug);
  if (!p) {
    const redirect = await (
      await getDatabase()
    ).db
      .collection("redirects")
      .findOne({ fromPath: "/product/" + slug });
    if (
      redirect &&
      typeof redirect.toPath === "string" &&
      /^\/product\/[a-z0-9-]+$/.test(redirect.toPath)
    ) {
      const target = await read(redirect.toPath.slice(9));
      if (target) {
        const q = await searchParams;
        permanentRedirect(
          redirect.toPath +
            (typeof q.variant === "string"
              ? "?variant=" + encodeURIComponent(q.variant)
              : ""),
        );
      }
    }
    notFound();
  }
  const q = await searchParams;
  const requested = typeof q.variant === "string" ? q.variant : undefined;
  const selected = selectVariant(p, requested).variant;
  const canonical = new URL("/product/" + p.slug, origin()).toString();
  const variants = p.variants.map((v) => ({
    "@type": "Product",
    "@id": canonical + "?variant=" + v.id,
    name: p.name + (v.title ? " — " + v.title : ""),
    sku: v.sku,
    image: (v.images.length ? v.images : p.images).map((i) => i.url),
    url: canonical + "?variant=" + v.id,
    offers: {
      "@type": "Offer",
      price: (v.pricePaise / 100).toFixed(2),
      priceCurrency: "INR",
      availability:
        "https://schema.org/" + (v.available ? "InStock" : "OutOfStock"),
      url: canonical + "?variant=" + v.id,
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
  return (
    <main className="product-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
      <nav className="product-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        {p.category && (
          <Link href={"/category/" + p.category.slug}>{p.category.name}</Link>
        )}
        <span>{p.name}</span>
      </nav>
      <Suspense fallback={<p>Loading product options…</p>}>
        <ProductDetail product={p} initialVariant={requested} />
      </Suspense>
    </main>
  );
}
