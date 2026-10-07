import "server-only";
import { ObjectId } from "mongodb";
import { getDatabase } from "../../server/db/connection";
import { categoryRepository } from "./repository";

type PublicCategory = {
  kind: "category";
  name: string;
  slug: string;
  description: string;
  seo: {
    title: string;
    description: string;
    canonicalPath: string;
    robotsIndex: boolean;
    robotsFollow: boolean;
  };
  image: { url: string; alt: string } | null;
  crumbs: Array<{ name: string; slug: string }>;
  children: Array<{ name: string; slug: string }>;
};

type PublicCategoryResult =
  PublicCategory | { kind: "redirect"; destination: string } | null;

/** Deliberately uncached until the deployment cache adapter is verified. One public projection feeds metadata and content. */
export async function publicCategory(
  slug: string,
): Promise<PublicCategoryResult> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100)
    return null;
  const database = await getDatabase();
  const repo = categoryRepository(database);
  const row = await repo.bySlug(slug);

  if (!row) {
    const redirect = await database.db
      .collection("redirects")
      .findOne({ fromPath: "/category/" + slug });
    if (!redirect || !String(redirect.toPath).startsWith("/category/"))
      return null;
    const target = await repo.bySlug(
      String(redirect.toPath).split("/").at(-1)!,
    );
    return target
      ? { kind: "redirect", destination: String(redirect.toPath) }
      : null;
  }

  const crumbs = [{ name: row.name, slug: row.slug }];
  let parentId = row.parentId;
  const seen = new Set([row._id.toString()]);
  while (parentId) {
    if (seen.has(parentId.toString()) || crumbs.length >= 4) return null;
    seen.add(parentId.toString());
    const parent = await repo.model
      .findOne({ _id: parentId, active: true, archivedAt: null })
      .select("name slug parentId")
      .lean();
    if (!parent) return null;
    crumbs.unshift({ name: parent.name, slug: parent.slug });
    parentId = parent.parentId;
  }

  const mediaIds = [row.thumbnailId, row.bannerId].filter(
    (id): id is NonNullable<typeof id> => !!id,
  );
  const media = await database.db
    .collection("mediaAssets")
    .find(
      { _id: { $in: mediaIds.map((id) => new ObjectId(id.toString())) } },
      { projection: { secureUrl: 1, alt: 1 } },
    )
    .toArray();
  const children = await repo.model
    .find({ parentId: row._id, active: true, archivedAt: null })
    .select("name slug")
    .sort({ displayOrder: 1, _id: 1 })
    .limit(100)
    .lean();
  const image = media.find(
    (item) =>
      item._id.toString() === (row.bannerId ?? row.thumbnailId)?.toString(),
  );

  return {
    kind: "category",
    name: row.name,
    slug: row.slug,
    description: row.description,
    seo: row.seo,
    image: image
      ? { url: String(image.secureUrl), alt: String(image.alt || row.name) }
      : null,
    crumbs,
    children: children.map((child) => ({ name: child.name, slug: child.slug })),
  };
}
