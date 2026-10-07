import { cache } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { publicCategory } from "@/modules/categories/public";

export const dynamic = "force-dynamic";
const read = cache(publicCategory);
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
    row.seo.canonicalPath || "/category/" + row.slug,
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
      images: row.image ? [{ url: row.image.url, alt: row.image.alt }] : [],
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const row = await read((await params).slug);
  if (!row) notFound();
  if (row.kind === "redirect") permanentRedirect(row.destination);

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

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbs).replace(/</g, "\u003c"),
        }}
      />
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex flex-wrap gap-3 text-sm"
      >
        <Link href="/">Home</Link>
        {row.crumbs.map((item) => (
          <Link key={item.slug} href={"/category/" + item.slug}>
            / {item.name}
          </Link>
        ))}
      </nav>
      {row.image && (
        <Image
          unoptimized
          src={row.image.url}
          alt={row.image.alt}
          width={1200}
          height={360}
          className="mb-8 max-h-80 w-full rounded-xl object-cover"
        />
      )}
      <h1 className="text-3xl font-semibold">{row.name}</h1>
      <p className="my-5 whitespace-pre-wrap text-slate-600">
        {row.description}
      </p>
      {row.children.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Browse categories</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {row.children.map((child) => (
              <Link
                className="rounded-xl border p-5 hover:border-violet-500"
                key={child.slug}
                href={"/category/" + child.slug}
              >
                {child.name} →
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
