import "server-only";
import { unstable_cache } from "next/cache";
import { getDatabase } from "@/server/db/connection";

export type CatalogNavigationLink = {
  name: string;
  slug: string;
};

export type CatalogNavigationCategory = CatalogNavigationLink & {
  children: CatalogNavigationLink[];
};

export type CatalogNavigation = {
  brands: CatalogNavigationLink[];
  categories: CatalogNavigationCategory[];
  featuredCategories: CatalogNavigationLink[];
};

async function readCatalogNavigation(): Promise<CatalogNavigation> {
  const db = (await getDatabase()).db;
  const brands = await db
    .collection("brands")
    .find(
      { active: true, archivedAt: null },
      {
        projection: { name: 1, slug: 1, featured: 1, displayOrder: 1 },
        maxTimeMS: 1500,
      },
    )
    .sort({ featured: -1, displayOrder: 1, name: 1, _id: 1 })
    .limit(24)
    .toArray();
  const categories = await db
    .collection("categories")
    .find(
      { active: true, archivedAt: null },
      {
        projection: {
          name: 1,
          slug: 1,
          parentId: 1,
          featured: 1,
          displayOrder: 1,
        },
        maxTimeMS: 1500,
      },
    )
    .sort({ displayOrder: 1, name: 1, _id: 1 })
    .limit(100)
    .toArray();

  const categoryIds = new Set(categories.map((row) => String(row._id)));
  const roots = categories.filter(
    (row) => !row.parentId || !categoryIds.has(String(row.parentId)),
  );
  return {
    brands: brands.map((row) => ({
      name: String(row.name),
      slug: String(row.slug),
    })),
    categories: roots.map((root) => ({
      name: String(root.name),
      slug: String(root.slug),
      children: categories
        .filter((row) => String(row.parentId ?? "") === String(root._id))
        .map((row) => ({
          name: String(row.name),
          slug: String(row.slug),
        })),
    })),
    featuredCategories: categories
      .filter((row) => row.featured)
      .slice(0, 8)
      .map((row) => ({
        name: String(row.name),
        slug: String(row.slug),
      })),
  };
}

export const catalogNavigation = unstable_cache(
  readCatalogNavigation,
  ["storefront-catalog-navigation-v1"],
  { revalidate: 300, tags: ["catalog", "navigation", "home"] },
);
