export const VARIANT_KEY_MAX = 80;
const reserved = new Set([
  "new",
  "edit",
  "preview",
  "admin",
  "api",
  "v",
  "unavailable",
]);

export function validVariantKey(key: string) {
  return (
    key.length <= VARIANT_KEY_MAX &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) &&
    !reserved.has(key)
  );
}

/** Server-owned, allocated once. Occupied keys include archived variants. */
export function allocateVariantKey(label: string, occupied: Set<string>) {
  let base =
    label
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, VARIANT_KEY_MAX)
      .replace(/-$/, "") || "variant";
  if (reserved.has(base)) base = "variant-" + base;
  let key = base;
  for (let suffix = 2; occupied.has(key); suffix++) {
    const tail = "-" + suffix;
    key = base.slice(0, VARIANT_KEY_MAX - tail.length).replace(/-$/, "") + tail;
  }
  occupied.add(key);
  return key;
}

export function variantPath(slug: string, key: string) {
  return "/product/" + encodeURIComponent(slug) + "/" + encodeURIComponent(key);
}

type KeySource = {
  id: string;
  urlKey?: string;
  title: string;
  sku: string;
  options: { attributeId: string; optionId: string }[];
};
export function assignVariantKeys(
  variants: KeySource[],
  attributes: { id: string; options: { id: string; label: string }[] }[],
) {
  const occupied = new Set<string>();
  for (const v of variants) {
    if (!v.urlKey) continue;
    if (!validVariantKey(v.urlKey) || occupied.has(v.urlKey))
      throw new Error("VARIANT_KEY_CONFLICT");
    occupied.add(v.urlKey);
  }
  return new Map(
    [...variants]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((v) => {
        const labels = v.options
          .map(
            (o) =>
              attributes
                .find((a) => a.id === o.attributeId)
                ?.options.find((x) => x.id === o.optionId)?.label,
          )
          .filter(Boolean)
          .join("-");
        return [
          v.id,
          v.urlKey ||
            allocateVariantKey(
              labels || v.title || v.sku || "default",
              occupied,
            ),
        ];
      }),
  );
}
