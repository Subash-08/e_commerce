import { describe, expect, it } from "vitest";
import {
  allocateVariantKey,
  assignVariantKeys,
  validVariantKey,
} from "../../src/modules/catalog/urls";

describe("variant URL identity", () => {
  it("bounds and suffixes collisions including reserved, Unicode and archived keys", () => {
    const occupied = new Set(["24-inch", "24-inch-2"]);
    expect(allocateVariantKey("24 inch", occupied)).toBe("24-inch-3");
    for (const label of [
      "preview",
      "新しい",
      "Écrán 27",
      "x".repeat(200),
      "x".repeat(200),
    ]) {
      expect(validVariantKey(allocateVariantKey(label, occupied))).toBe(true);
    }
  });
  it("keeps persisted keys despite renames and deterministic allocation order", () => {
    const rows = [
      { id: "b", title: "24 inch", sku: "B", options: [] },
      {
        id: "a",
        title: "Renamed display",
        sku: "A",
        urlKey: "24-inch",
        options: [],
      },
    ];
    expect(assignVariantKeys(rows, []).get("a")).toBe("24-inch");
    expect(assignVariantKeys(rows, []).get("b")).toBe("24-inch-2");
    expect(assignVariantKeys([...rows].reverse(), [])).toEqual(
      assignVariantKeys(rows, []),
    );
    expect(() =>
      assignVariantKeys(
        rows.map((v) => ({ ...v, urlKey: "same" })),
        [],
      ),
    ).toThrow("VARIANT_KEY_CONFLICT");
  });
});
