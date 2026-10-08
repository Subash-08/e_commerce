import { expect, it } from "vitest";
import {
  normalizeCatalogQuery,
  categoryDescendants,
} from "../../src/modules/catalog/discovery/query";
import type { CatalogMetadata } from "../../src/modules/catalog/discovery/contracts";
const meta: CatalogMetadata = {
  brands: [{ id: "b", slug: "brand", name: "Brand" }],
  categories: [
    { id: "p", slug: "parent", name: "Parent" },
    { id: "c", slug: "child", name: "Child", parentId: "p" },
  ],
  attributes: [
    {
      id: "a",
      code: "colour",
      name: "Colour",
      type: "COLOUR",
      unit: "",
      options: [
        {
          id: "red-id",
          label: "Renamable red",
          colour: "#ff0000",
          active: true,
        },
      ],
    },
  ],
};
it("normalizes allowlisted filters and page bounds while rejecting unsafe ranges and oversized input", () => {
  const parse = (s: string) =>
    normalizeCatalogQuery({ kind: "all" }, new URLSearchParams(s), meta);
  const q = parse(
    "brand=brand&brand=brand&brand=unknown&f.colour=red-id&f.colour=bad&unknown=x&min=1.01&sort=bad&page=-1",
  );
  expect(q).toMatchObject({
    brandIds: ["b"],
    minPrice: 101,
    page: 1,
    sort: "newest",
    attributes: [{ code: "colour", values: ["red-id"] }],
  });
  expect(q.normalizedQuery).not.toContain("unknown");
  expect(parse(q.normalizedQuery)).toEqual(q);
  for (const input of [
    "min=10&max=9",
    "min=NaN",
    "min=1.001",
    "q=" + "a".repeat(121),
    "unused=" + "x".repeat(4097),
  ]) {
    expect(() => parse(input)).toThrow("INVALID_QUERY");
  }
  expect(categoryDescendants("p", meta)).toEqual(["p", "c"]);
  expect(() =>
    categoryDescendants("p", {
      ...meta,
      categories: [
        { ...meta.categories[0], parentId: "c" },
        meta.categories[1],
      ],
    }),
  ).toThrow();
});
