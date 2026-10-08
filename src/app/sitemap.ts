import type { MetadataRoute } from "next";
import { getDatabase } from "@/server/db/connection";

export const dynamic = "force-dynamic";

const origin = () => process.env.APP_URL ?? "http://localhost:3300";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { db } = await getDatabase();
  const [products, categories, brands] = await Promise.all([
    db
      .collection("products")
      .find(
        { status: "ACTIVE", "seo.robotsIndex": { $ne: false } },
        {
          projection: { slug: 1, updatedAt: 1 },
          sort: { _id: 1 },
          limit: 1000,
        },
      )
      .toArray(),
    db
      .collection("categories")
      .find(
        { active: true, archivedAt: null, "seo.robotsIndex": { $ne: false } },
        {
          projection: { slug: 1, updatedAt: 1 },
          sort: { _id: 1 },
          limit: 1000,
        },
      )
      .toArray(),
    db
      .collection("brands")
      .find(
        { active: true, archivedAt: null, "seo.robotsIndex": { $ne: false } },
        {
          projection: { slug: 1, updatedAt: 1 },
          sort: { _id: 1 },
          limit: 1000,
        },
      )
      .toArray(),
  ]);
  const absolute = (path: string) => new URL(path, origin()).toString();
  const dynamicEntries: MetadataRoute.Sitemap = [
    ...products.map((row) => ({
      url: absolute("/product/" + String(row.slug)),
      lastModified: row.updatedAt instanceof Date ? row.updatedAt : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...categories.map((row) => ({
      url: absolute("/category/" + String(row.slug)),
      lastModified: row.updatedAt instanceof Date ? row.updatedAt : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...brands.map((row) => ({
      url: absolute("/brand/" + String(row.slug)),
      lastModified: row.updatedAt instanceof Date ? row.updatedAt : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
  return [
    { url: absolute("/"), changeFrequency: "weekly", priority: 1 },
    { url: absolute("/products"), changeFrequency: "daily", priority: 0.9 },
    ...dynamicEntries,
  ];
}
