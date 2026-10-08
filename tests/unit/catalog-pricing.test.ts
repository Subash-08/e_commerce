import { describe, expect, it } from "vitest";
import {
  discountedPrice,
  parsePaise,
  priceBreakdown,
} from "../../src/modules/catalog/pricing";
import { mediaRef } from "../../src/modules/catalog/validation";
describe("catalog price and image input boundaries", () => {
  it("uses integer paise for inclusive/exclusive conversion and percentage discounts", () => {
    expect(priceBreakdown(11800, "INCLUSIVE", 1800)).toMatchObject({
      basePaise: 10000,
      taxPaise: 1800,
      payablePaise: 11800,
    });
    expect(priceBreakdown(10000, "EXCLUSIVE", 1800)).toMatchObject({
      basePaise: 10000,
      taxPaise: 1800,
      payablePaise: 11800,
    });
    expect(discountedPrice(19999, 1250)).toBe(17499);
    expect(parsePaise("19.99")).toBe(1999);
    expect(parsePaise("1.999")).toBeNull();
  });
  it("requires one image source, public HTTPS and alternative text", () => {
    expect(
      mediaRef.safeParse({
        url: "https://example.com/image.webp",
        alt: "Product",
      }).success,
    ).toBe(true);
    expect(
      mediaRef.safeParse({ url: "http://localhost/image", alt: "Product" })
        .success,
    ).toBe(false);
    expect(
      mediaRef.safeParse({
        assetId: "a".repeat(24),
        url: "https://example.com/image.webp",
        alt: "Product",
      }).success,
    ).toBe(false);
    expect(
      mediaRef.safeParse({ url: "https://example.com/image.webp", alt: "" })
        .success,
    ).toBe(false);
  });
});
