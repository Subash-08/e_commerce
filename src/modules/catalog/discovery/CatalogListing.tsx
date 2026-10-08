import { AddToCart } from "../../cart/client";
import Image from "next/image";
import Link from "next/link";
import type {
  CatalogFacet,
  CatalogResult,
  ProductCard as ProductCardData,
} from "./contracts";
import { CatalogFilterDrawer } from "./CatalogFilterDrawer";
import { CatalogSortControl } from "./CatalogSortControl";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
const rupees = (paise: number) => (paise / 100).toFixed(2);

function hrefWith(
  basePath: string,
  queryString: string,
  change: (params: URLSearchParams) => void,
) {
  const params = new URLSearchParams(queryString);
  change(params);
  const value = params.toString();
  return value ? `${basePath}?${value}` : basePath;
}

function removeValue(params: URLSearchParams, key: string, value: string) {
  const remaining = params.getAll(key).filter((item) => item !== value);
  params.delete(key);
  remaining.forEach((item) => params.append(key, item));
  params.delete("page");
}

export function CatalogProductCard({ item }: { item: ProductCardData }) {
  return (
    <article className="sf-product-card">
      <Link
        href={item.url}
        className="sf-product-card-media"
        aria-label={`View ${item.name}`}
      >
        {item.image ? (
          <>
            <Image
              unoptimized
              fill
              src={item.image.url}
              alt={item.image.alt}
              sizes="(max-width: 520px) 50vw, (max-width: 900px) 33vw, 22vw"
              className="sf-product-card-image sf-product-card-image-primary"
            />
            {item.hoverImage && (
              <Image
                unoptimized
                fill
                src={item.hoverImage.url}
                alt=""
                sizes="(max-width: 520px) 50vw, (max-width: 900px) 33vw, 22vw"
                className="sf-product-card-image sf-product-card-image-hover"
              />
            )}
          </>
        ) : (
          <span className="sf-product-card-image-empty" aria-hidden="true">
            Product image
          </span>
        )}
        {item.discountPercent > 0 && (
          <span className="sf-product-card-discount">
            {item.discountPercent}% off
          </span>
        )}
      </Link>
      <div className="sf-product-card-body">
        <Link
          href={`/brand/${item.brand.slug}`}
          className="sf-product-card-brand"
        >
          {item.brand.name}
        </Link>
        <h3>
          <Link href={item.url}>{item.name}</Link>
        </h3>
        <p className="sf-product-card-variant">{item.variantTitle}</p>
        <div className="sf-product-card-price">
          <strong>
            {item.hasPriceRange && <span>From </span>}
            {money.format(item.pricePaise / 100)}
          </strong>
          {item.mrpPaise > item.pricePaise && (
            <del>{money.format(item.mrpPaise / 100)}</del>
          )}
        </div>
        <p className={item.available ? "sf-stock-in" : "sf-stock-out"}>
          {item.available ? "In stock" : "Currently unavailable"}
        </p>
        {item.matchingVariantCount === 1 ? (
          <AddToCart
            productId={item.id}
            variantId={item.variantId}
            available={item.available}
            label="Add this option"
          />
        ) : (
          <Link href={item.url} className="sf-product-card-action">
            Choose options
          </Link>
        )}
      </div>
    </article>
  );
}

function FilterGroup({
  facet,
  prefix,
}: {
  facet: CatalogFacet;
  prefix: string;
}) {
  if (facet.type === "NUMBER") {
    return (
      <fieldset className="sf-filter-group">
        <legend>{facet.label}</legend>
        <div className="sf-filter-range">
          <label htmlFor={`${prefix}-${facet.key}-min`}>
            Minimum{facet.unit ? ` (${facet.unit})` : ""}
          </label>
          <input
            id={`${prefix}-${facet.key}-min`}
            name={`${facet.key}.min`}
            type="number"
            step="any"
            min={facet.min}
            max={facet.max}
            defaultValue={facet.selectedMin}
            placeholder={facet.min?.toString()}
          />
          <label htmlFor={`${prefix}-${facet.key}-max`}>
            Maximum{facet.unit ? ` (${facet.unit})` : ""}
          </label>
          <input
            id={`${prefix}-${facet.key}-max`}
            name={`${facet.key}.max`}
            type="number"
            step="any"
            min={facet.min}
            max={facet.max}
            defaultValue={facet.selectedMax}
            placeholder={facet.max?.toString()}
          />
        </div>
      </fieldset>
    );
  }
  return (
    <fieldset className="sf-filter-group">
      <legend>{facet.label}</legend>
      <div className="sf-filter-options">
        {facet.values.map((value) => (
          <label key={value.value} className="sf-filter-option">
            <input
              type="checkbox"
              name={facet.key}
              value={value.value}
              defaultChecked={value.selected}
              disabled={!value.selected && value.count === 0}
            />
            {value.colour && (
              <span
                className="sf-filter-swatch"
                style={{ background: value.colour }}
                aria-hidden="true"
              />
            )}
            <span>{value.label}</span>
            <small>{value.count}</small>
          </label>
        ))}
      </div>
      {facet.truncated && (
        <p className="sf-filter-note">
          Refine the current filters to see more options.
        </p>
      )}
    </fieldset>
  );
}

function FilterPanel({
  result,
  basePath,
  prefix,
}: {
  result: CatalogResult;
  basePath: string;
  prefix: string;
}) {
  const preserved = new URLSearchParams(result.query.normalizedQuery);
  const q = preserved.get("q");
  const sort = preserved.get("sort");
  const clear = new URLSearchParams();
  if (q) clear.set("q", q);
  if (sort) clear.set("sort", sort);
  return (
    <form action={basePath} className="sf-filter-panel">
      <div className="sf-filter-panel-title">
        <strong>Filters</strong>
        <Link href={clear.toString() ? `${basePath}?${clear}` : basePath}>
          Clear all
        </Link>
      </div>
      {q && <input type="hidden" name="q" value={q} />}
      {sort && <input type="hidden" name="sort" value={sort} />}
      {(result.price.min !== null ||
        result.price.selectedMin !== undefined ||
        result.price.selectedMax !== undefined) && (
        <fieldset className="sf-filter-group">
          <legend>Price range</legend>
          <p className="sf-filter-bounds">
            Available{" "}
            {result.price.min === null
              ? "—"
              : money.format(result.price.min / 100)}{" "}
            to{" "}
            {result.price.max === null
              ? "—"
              : money.format(result.price.max / 100)}
          </p>
          <div className="sf-price-inputs">
            <label htmlFor={`${prefix}-price-min`}>Minimum price</label>
            <div>
              <span>₹</span>
              <input
                id={`${prefix}-price-min`}
                name="min"
                inputMode="decimal"
                defaultValue={
                  result.price.selectedMin === undefined
                    ? ""
                    : rupees(result.price.selectedMin)
                }
                placeholder={
                  result.price.min === null ? "Min" : rupees(result.price.min)
                }
              />
            </div>
            <label htmlFor={`${prefix}-price-max`}>Maximum price</label>
            <div>
              <span>₹</span>
              <input
                id={`${prefix}-price-max`}
                name="max"
                inputMode="decimal"
                defaultValue={
                  result.price.selectedMax === undefined
                    ? ""
                    : rupees(result.price.selectedMax)
                }
                placeholder={
                  result.price.max === null ? "Max" : rupees(result.price.max)
                }
              />
            </div>
          </div>
        </fieldset>
      )}
      {result.facets.map((facet) => (
        <FilterGroup key={facet.key} facet={facet} prefix={prefix} />
      ))}
      <button type="submit" className="sf-filter-apply">
        Apply filters
      </button>
    </form>
  );
}

function ActiveFilters({
  result,
  basePath,
}: {
  result: CatalogResult;
  basePath: string;
}) {
  const chips = result.facets.flatMap((facet) =>
    facet.values
      .filter((v) => v.selected)
      .map((value) => ({
        key: facet.key,
        value: value.value,
        label: `${facet.label}: ${value.label}`,
      })),
  );
  if (result.price.selectedMin !== undefined)
    chips.push({
      key: "min",
      value: String(result.price.selectedMin),
      label: `From ${money.format(result.price.selectedMin / 100)}`,
    });
  if (result.price.selectedMax !== undefined)
    chips.push({
      key: "max",
      value: String(result.price.selectedMax),
      label: `Up to ${money.format(result.price.selectedMax / 100)}`,
    });
  if (!chips.length) return null;
  return (
    <div className="sf-active-filters" aria-label="Active filters">
      {chips.map((chip) => (
        <Link
          key={`${chip.key}-${chip.value}`}
          href={hrefWith(basePath, result.query.normalizedQuery, (p) =>
            removeValue(p, chip.key, chip.value),
          )}
        >
          {chip.label}
          <span aria-hidden="true">×</span>
        </Link>
      ))}
    </div>
  );
}

function Pagination({
  result,
  basePath,
}: {
  result: CatalogResult;
  basePath: string;
}) {
  if (result.pages <= 1) return null;
  const start = Math.max(1, result.page - 2),
    end = Math.min(result.pages, result.page + 2);
  const pageHref = (page: number) =>
    hrefWith(basePath, result.query.normalizedQuery, (p) => {
      if (page === 1) p.delete("page");
      else p.set("page", String(page));
    });
  return (
    <nav className="sf-pagination" aria-label="Product pages">
      {result.page > 1 && (
        <Link href={pageHref(result.page - 1)} rel="prev">
          ← Previous
        </Link>
      )}
      <div>
        {Array.from(
          { length: end - start + 1 },
          (_, index) => start + index,
        ).map((page) =>
          page === result.page ? (
            <span key={page} aria-current="page">
              {page}
            </span>
          ) : (
            <Link key={page} href={pageHref(page)}>
              {page}
            </Link>
          ),
        )}
      </div>
      {result.page < result.pages && (
        <Link href={pageHref(result.page + 1)} rel="next">
          Next →
        </Link>
      )}
    </nav>
  );
}

export function CatalogListing({
  result,
  basePath,
  title,
  eyebrow,
  description,
  headingLevel = 1,
}: {
  result: CatalogResult;
  basePath: string;
  title: string;
  eyebrow?: string;
  description?: string;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const first = result.total ? (result.page - 1) * result.pageSize + 1 : 0;
  const last = Math.min(result.page * result.pageSize, result.total);
  return (
    <section className="sf-discovery" aria-labelledby="catalog-heading">
      <header className="sf-discovery-head">
        <div>
          {eyebrow && <span className="sf-discovery-eyebrow">{eyebrow}</span>}
          <Heading id="catalog-heading">{title}</Heading>
          {description && <p>{description}</p>}
          <small>
            {result.total === 0
              ? "No products found"
              : `Showing ${first}–${last} of ${result.total} products`}
          </small>
        </div>
        <div className="sf-discovery-controls">
          <CatalogFilterDrawer>
            <FilterPanel result={result} basePath={basePath} prefix="mobile" />
          </CatalogFilterDrawer>
          <CatalogSortControl
            action={basePath}
            queryString={result.query.normalizedQuery}
            value={result.query.sort}
            hasSearch={Boolean(result.query.q)}
          />
        </div>
      </header>
      <ActiveFilters result={result} basePath={basePath} />
      <div className="sf-discovery-layout">
        <aside className="sf-filter-sidebar" aria-label="Product filters">
          <FilterPanel result={result} basePath={basePath} prefix="desktop" />
        </aside>
        <div className="sf-product-results">
          {result.items.length ? (
            <div className="sf-product-grid">
              {result.items.map((item) => (
                <CatalogProductCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="sf-catalog-empty">
              <span aria-hidden="true">⌕</span>
              <h3>No matching products</h3>
              <p>Try removing a filter or using a broader search.</p>
              <Link href={basePath}>Clear filters</Link>
            </div>
          )}
          <Pagination result={result} basePath={basePath} />
        </div>
      </div>
    </section>
  );
}

export function InvalidCatalogQuery({ basePath }: { basePath: string }) {
  return (
    <div className="sf-catalog-notice" role="alert">
      <h2>These filters could not be applied</h2>
      <p>
        One or more values are outside the supported range. Clear the filters
        and try again.
      </p>
      <Link href={basePath} className="sf-product-card-action">
        Clear filters
      </Link>
    </div>
  );
}
