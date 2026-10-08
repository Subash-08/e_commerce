import type { VariantInput } from "./validation";
import { combinationKey } from "./validation";
export function newCatalogId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function blankVariant(): VariantInput {
  return {
    id: newCatalogId(),
    sku: "",
    barcode: "",
    title: "",
    options: [],
    active: true,
    archived: false,
    mrpPaise: 0,
    salePaise: 0,
    costPaise: null,
    priceMode: "INCLUSIVE",
    gstRateBps: 0,
    trackQuantity: false,
    stockStatus: "OUT_OF_STOCK",
    onHand: null,
    media: [],
    weightGrams: null,
    lengthMm: null,
    widthMm: null,
    heightMm: null,
    specifications: [],
  };
}
export function previewVariants(
  axes: { attributeId: string; optionIds: string[] }[],
  existing: VariantInput[],
) {
  if (
    axes.length > 6 ||
    axes.some((a) => !a.optionIds.length) ||
    axes.reduce((n, a) => n * a.optionIds.length, 1) > 200
  )
    throw new Error(
      "Choose values for each axis, up to 200 combinations and six axes.",
    );
  let combinations: VariantInput["options"][] = [[]];
  for (const axis of axes)
    combinations = combinations.flatMap((c) =>
      axis.optionIds.map((optionId) => [
        ...c,
        { attributeId: axis.attributeId, optionId },
      ]),
    );
  const keys = new Set(combinations.map(combinationKey));
  const retained = existing.filter((v) => keys.has(combinationKey(v.options)));
  const removed = existing.filter((v) => !keys.has(combinationKey(v.options)));
  const added = combinations
    .filter(
      (c) =>
        !existing.some((v) => combinationKey(v.options) === combinationKey(c)),
    )
    .map((options) => ({ ...blankVariant(), options }));
  return { retained, removed, added };
}
