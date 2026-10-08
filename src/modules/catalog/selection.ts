import type { PublicProduct } from "./public";
export function selectVariant(
  product: Pick<PublicProduct, "variants" | "defaultVariantId">,
  requested?: string | null,
) {
  const exact = requested
    ? product.variants.find((v) => v.id === requested)
    : undefined;
  return {
    variant:
      exact ??
      product.variants.find((v) => v.id === product.defaultVariantId) ??
      product.variants.find((v) => v.available) ??
      product.variants[0],
    unavailable: Boolean(requested && !exact),
  };
}
