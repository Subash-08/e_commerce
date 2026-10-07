import { cache } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { publicBrand } from "@/modules/brands/public";

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
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <Link href="/">Home</Link> / {row.name}
      </nav>
      <section className="flex flex-col items-start gap-6 rounded-xl border p-8 sm:flex-row sm:items-center">
        {row.logo && (
          <Image
            unoptimized
            src={row.logo.url}
            alt={row.logo.alt}
            width={180}
            height={100}
            className="max-h-24 object-contain"
          />
        )}
        <div>
          <h1 className="text-3xl font-semibold">{row.name}</h1>
          <p className="mt-3 whitespace-pre-wrap text-slate-600">
            {row.description}
          </p>
        </div>
      </section>
    </main>
  );
}
