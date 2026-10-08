"use client";

import { useRef } from "react";
import type { CatalogSort } from "./contracts";

export function CatalogSortControl({
  action,
  queryString,
  value,
  hasSearch,
}: {
  action: string;
  queryString: string;
  value: CatalogSort;
  hasSearch: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const preserved = new URLSearchParams(queryString);
  preserved.delete("sort");
  preserved.delete("page");
  return (
    <form ref={formRef} action={action} className="sf-catalog-sort">
      {[...preserved].map(([key, item], index) => (
        <input
          key={`${key}-${item}-${index}`}
          type="hidden"
          name={key}
          value={item}
        />
      ))}
      <label htmlFor="catalog-sort">Sort by</label>
      <select
        id="catalog-sort"
        name="sort"
        value={value}
        onChange={() => formRef.current?.requestSubmit()}
      >
        {hasSearch && <option value="relevance">Most relevant</option>}
        <option value="newest">Newest arrivals</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
        <option value="name">Name: A to Z</option>
      </select>
      <noscript>
        <button type="submit">Apply</button>
      </noscript>
    </form>
  );
}
