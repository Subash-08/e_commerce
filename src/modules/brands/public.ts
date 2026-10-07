import "server-only";
import { getDatabase } from "../../server/db/connection";
import { brandRepository } from "./repository";

type PublicBrandResult =
  | {
      kind: "brand";
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
      logo: { url: string; alt: string } | null;
    }
  | { kind: "redirect"; destination: string }
  | null;

export async function publicBrand(slug: string): Promise<PublicBrandResult> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100)
    return null;
  const database = await getDatabase();
  const repo = brandRepository(database);
  const row = await repo.bySlug(slug);
  if (!row) {
    const redirect = await database.db
      .collection("redirects")
      .findOne({ fromPath: "/brand/" + slug });
    if (!redirect || !String(redirect.toPath).startsWith("/brand/"))
      return null;
    const target = await repo.bySlug(
      String(redirect.toPath).split("/").at(-1)!,
    );
    return target
      ? { kind: "redirect", destination: String(redirect.toPath) }
      : null;
  }
  const asset = row.logoId
    ? await database.db
        .collection("mediaAssets")
        .findOne({ _id: row.logoId }, { projection: { secureUrl: 1, alt: 1 } })
    : null;
  return {
    kind: "brand",
    name: row.name,
    slug: row.slug,
    description: row.description,
    seo: row.seo,
    logo: asset
      ? {
          url: String(asset.secureUrl),
          alt: String(asset.alt || row.name + " logo"),
        }
      : null,
  };
}
