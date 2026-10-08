import Link from "next/link";
import type { Metadata } from "next";
import { catalogNavigation } from "@/modules/catalog/navigation";
import { discoverCatalog } from "@/modules/catalog/discovery/service";
import { CatalogProductCard } from "@/modules/catalog/discovery/CatalogListing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Commerce",
  description:
    "Browse demo products across computing, accessories, audio, networking and storage.",
  robots: { index: false, follow: true },
};

export default async function HomePage() {
  const navigation = await catalogNavigation();
  const catalog = await discoverCatalog(
    { kind: "all" },
    new URLSearchParams("sort=newest"),
  );
  const products = catalog.items.slice(0, 8);

  return (
    <div className="sf-home">
      <section className="sf-home-hero">
        <div className="sf-home-hero-copy">
          <span className="sf-home-kicker">Reusable commerce storefront</span>
          <h1>Find the right product without the clutter.</h1>
          <p>
            Browse a connected demo catalog with real brand, category, price,
            availability and variant filtering.
          </p>
          <div className="sf-home-actions">
            <Link href="/products" className="sf-home-primary">
              Shop all products
            </Link>
            <Link href="/search?q=demo" className="sf-home-secondary">
              Search the demo catalog
            </Link>
          </div>
        </div>
        <div className="sf-home-hero-panel" aria-label="Store benefits">
          <div>
            <strong>{catalog.total}</strong>
            <span>demo products</span>
          </div>
          <div>
            <strong>{navigation.brands.length}</strong>
            <span>active brands</span>
          </div>
          <div>
            <strong>{navigation.featuredCategories.length}</strong>
            <span>featured categories</span>
          </div>
        </div>
      </section>

      <section className="sf-home-section" aria-labelledby="home-categories">
        <div className="sf-home-section-head">
          <div>
            <span className="sf-home-kicker">Shop by collection</span>
            <h2 id="home-categories">Featured categories</h2>
          </div>
          <Link href="/products">View all products →</Link>
        </div>
        <div className="sf-home-category-grid">
          {navigation.featuredCategories.map((category, index) => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className="sf-home-category-card"
            >
              <span aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <strong>{category.name}</strong>
              <small>Browse collection</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="sf-home-section" aria-labelledby="home-products">
        <div className="sf-home-section-head">
          <div>
            <span className="sf-home-kicker">Recently published</span>
            <h2 id="home-products">Explore the catalog</h2>
          </div>
          <Link href="/products?sort=newest">See every product →</Link>
        </div>
        {products.length ? (
          <div className="sf-home-product-grid">
            {products.map((product) => (
              <CatalogProductCard key={product.id} item={product} />
            ))}
          </div>
        ) : (
          <div className="sf-catalog-notice">
            <p>No active products are available yet.</p>
          </div>
        )}
      </section>

      <section
        className="sf-home-section sf-home-brands"
        aria-labelledby="home-brands"
      >
        <div className="sf-home-section-head">
          <div>
            <span className="sf-home-kicker">Browse makers</span>
            <h2 id="home-brands">Featured brands</h2>
          </div>
        </div>
        <div className="sf-home-brand-list">
          {navigation.brands.map((brand) => (
            <Link key={brand.slug} href={`/brand/${brand.slug}`}>
              <span aria-hidden="true">
                {brand.name.slice(0, 2).toUpperCase()}
              </span>
              <strong>{brand.name}</strong>
              <small>View products →</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="sf-home-confidence" aria-label="Shopping information">
        <div>
          <strong>Current pricing</strong>
          <span>
            Prices and availability come from the public catalog projection.
          </span>
        </div>
        <div>
          <strong>Variant-aware links</strong>
          <span>Shared product links open the exact selected option.</span>
        </div>
        <div>
          <strong>Clear discovery</strong>
          <span>
            Filters show only choices available in the current result set.
          </span>
        </div>
      </section>
    </div>
  );
}
