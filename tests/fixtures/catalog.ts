import { ObjectId } from "mongodb";
import { blankVariant } from "../../src/modules/catalog/variant-builder";
import type { ProductInput } from "../../src/modules/catalog/validation";
export function catalogFixture(
  brandId: string,
  categoryId: string,
  mediaId: string,
  suffix: string,
): ProductInput {
  const variant = {
    ...blankVariant(),
    id: new ObjectId().toString(),
    sku: "SKU-" + suffix,
    mrpPaise: 15000,
    salePaise: 11800,
    costPaise: 4000,
    gstRateBps: 1800,
    trackQuantity: true,
    onHand: 10,
  };
  return {
    name: "Catalog fixture " + suffix,
    slug: "catalog-" + suffix,
    brandId,
    categoryIds: [categoryId],
    primaryCategoryId: categoryId,
    status: "ACTIVE",
    summary: "Catalog fixture",
    description: "Fixture description",
    modelNumber: "",
    hsn: "",
    tags: [],
    warranty: "",
    notes: "PRIVATE-NOTE",
    thumbnail: { assetId: mediaId, alt: "Fixture thumbnail" },
    hoverImage: null,
    manufacturerContent: [],
    media: [{ assetId: mediaId, alt: "Fixture image" }],
    videos: [],
    attributes: [],
    specifications: [],
    features: [],
    linkedProductIds: [],
    defaultVariantId: variant.id,
    variants: [variant],
    seo: { title: "", description: "", robotsIndex: true },
  };
}
