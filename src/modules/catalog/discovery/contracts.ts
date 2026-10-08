export const PAGE_SIZE = 12;
export type CatalogScope =
  { kind: "all" | "search" } | { kind: "brand" | "category"; slug: string };
export type CatalogSort =
  "price-asc" | "price-desc" | "newest" | "name" | "relevance";
export type Taxon = {
  id: string;
  slug: string;
  name: string;
  parentId?: string | null;
};
export type FacetDefinition = {
  id: string;
  code: string;
  name: string;
  type: string;
  unit: string;
  options: { id: string; label: string; colour: string; active: boolean }[];
};
export type CatalogMetadata = {
  brands: Taxon[];
  categories: Taxon[];
  attributes: FacetDefinition[];
};
export type AttributeFilter = {
  code: string;
  values: string[];
  min?: number;
  max?: number;
};
export type CatalogQuery = {
  scope: CatalogScope;
  q: string;
  terms: string[];
  sort: CatalogSort;
  page: number;
  brandIds: string[];
  categoryIds: string[];
  availability: string[];
  minPrice?: number;
  maxPrice?: number;
  attributes: AttributeFilter[];
  normalizedQuery: string;
};
export class CatalogQueryError extends Error {
  constructor(
    public readonly code:
      "INVALID_QUERY" | "SCOPE_NOT_FOUND" | "PAGE_NOT_FOUND" | "FACET_LIMIT",
  ) {
    super(code);
  }
}
export type ProductCard = {
  id: string;
  name: string;
  slug: string;
  summary: string;
  brand: { name: string; slug: string };
  variantId: string;
  variantKey: string;
  variantTitle: string;
  url: string;
  pricePaise: number;
  mrpPaise: number;
  discountPercent: number;
  available: boolean;
  image: { url: string; alt: string } | null;
  hoverImage: { url: string; alt: string } | null;
  hasPriceRange: boolean;
  matchingVariantCount: number;
};
export type FacetValue = {
  value: string;
  label: string;
  count: number;
  selected: boolean;
  colour?: string;
};
export type CatalogFacet = {
  key: string;
  label: string;
  type: string;
  unit?: string;
  values: FacetValue[];
  min?: number;
  max?: number;
  selectedMin?: number;
  selectedMax?: number;
  truncated?: boolean;
};
export type CatalogResult = {
  query: CatalogQuery;
  items: ProductCard[];
  total: number;
  page: number;
  pageSize: 12;
  pages: number;
  facets: CatalogFacet[];
  price: {
    min: number | null;
    max: number | null;
    selectedMin?: number;
    selectedMax?: number;
  };
};
