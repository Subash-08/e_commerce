import "server-only";
import { ObjectId, type Db } from "mongodb";
import { variantPath } from "./urls.ts";

/** Redirect history is flattened on product rename; resolve by entity ID as an extra chain safeguard. */
export async function productRedirect(
  db: Db,
  slug: string,
  key?: string,
  legacyId?: string | null,
) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100)
    return null;
  const alias = await db
    .collection("redirects")
    .findOne(
      { fromPath: "/product/" + slug, entityType: "product" },
      { projection: { entityId: 1 } },
    );
  if (!alias && legacyId === undefined) return null;
  const product = await db
    .collection("products")
    .findOne(
      { ...(alias ? { _id: alias.entityId } : { slug }), status: "ACTIVE" },
      { projection: { slug: 1, brandId: 1, primaryCategoryId: 1 } },
    );
  if (!product) return null;
  const [brand, category] = await Promise.all([
    db
      .collection("brands")
      .findOne(
        { _id: product.brandId, active: true, archivedAt: null },
        { projection: { _id: 1 } },
      ),
    db
      .collection("categories")
      .findOne(
        { _id: product.primaryCategoryId, active: true, archivedAt: null },
        { projection: { _id: 1 } },
      ),
  ]);
  if (!brand || !category) return null;
  let resolvedKey = key;
  // An explicit path wins over a conflicting legacy selector.
  if (!key && legacyId !== undefined) {
    const variant =
      legacyId && /^[a-f0-9]{24}$/.test(legacyId)
        ? await db
            .collection("variants")
            .findOne(
              { _id: new ObjectId(legacyId), productId: product._id },
              { projection: { urlKey: 1 } },
            )
        : null;
    resolvedKey =
      typeof variant?.urlKey === "string" ? variant.urlKey : "unavailable";
  }
  return resolvedKey
    ? variantPath(String(product.slug), resolvedKey)
    : "/product/" + product.slug;
}
