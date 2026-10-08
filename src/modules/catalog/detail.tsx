"use client";
import Link from "next/link";
import Image from "next/image";
import {
  useSearchParams,
  useParams,
  usePathname,
  useRouter,
} from "next/navigation";
import { variantPath } from "./urls";
import { ProductGallery } from "./gallery";
import type { PublicProduct } from "./public";
import { selectVariant } from "./selection";
import { AddToCart } from "../cart/client";

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount / 100);

export function ProductDetail({
  product,
  initialVariant,
}: {
  product: PublicProduct;
  initialVariant?: string;
}) {
  const query = useSearchParams();
  const params = useParams<{ variantKey?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const preview = pathname.startsWith("/admin/");
  const requested = params.variantKey
    ? (product.variants.find((v) => v.urlKey === params.variantKey)?.id ??
      "unavailable")
    : (query?.get("variant") ?? initialVariant);
  const { variant, unavailable } = selectVariant(product, requested);

  const gallery = variant?.images.length ? variant.images : product.images;

  function hrefFor(id: string) {
    const target = product.variants.find((v) => v.id === id)!;
    return preview
      ? pathname + "?variant=" + id
      : variantPath(product.slug, target.urlKey);
  }
  function choose(id: string) {
    router.push(hrefFor(id), { scroll: false });
  }

  return (
    <>
      <section className="product-hero">
        <ProductGallery
          key={variant?.id ?? product.id}
          images={gallery}
          videos={product.videos}
          hoverImage={variant?.images.length ? null : product.hoverImage}
        />
        <div className="product-buy-panel">
          {product.brand && (
            <Link
              href={"/brand/" + product.brand.slug}
              className="product-brand"
            >
              {product.brand.name}
            </Link>
          )}
          <h1>{product.name}</h1>
          <p className="product-summary">{product.summary}</p>

          {unavailable && (
            <div role="status" className="product-warning">
              <span className="product-warning-icon" aria-hidden="true">
                ⚠️
              </span>
              <span>
                The requested variant is no longer available. Showing the
                default selection.
              </span>
            </div>
          )}

          {variant ? (
            <>
              <div className="product-price">
                <strong>{money(variant.pricePaise)}</strong>
                {variant.mrpPaise > variant.pricePaise && (
                  <>
                    <del>{money(variant.mrpPaise)}</del>
                    <span>
                      {Math.floor(
                        ((variant.mrpPaise - variant.pricePaise) * 100) /
                          variant.mrpPaise,
                      )}
                      % off
                    </span>
                  </>
                )}
              </div>
              <p className="product-tax">Inclusive of applicable GST</p>

              {product.axes.map((axis) => (
                <fieldset className="product-axis" key={axis.id}>
                  <legend>{axis.name}</legend>
                  <div className="product-axis-options">
                    {axis.options.map((option) => {
                      const target = product.variants.find(
                        (v) =>
                          v.options.some(
                            (o) =>
                              o.attributeId === axis.id &&
                              o.optionId === option.id,
                          ) &&
                          variant.options
                            .filter((o) => o.attributeId !== axis.id)
                            .every((o) =>
                              v.options.some(
                                (x) =>
                                  x.attributeId === o.attributeId &&
                                  x.optionId === o.optionId,
                              ),
                            ),
                      );

                      const selected = variant.options.some(
                        (o) => o.optionId === option.id,
                      );

                      const content = (
                        <>
                          {axis.type === "COLOUR" && (
                            <span
                              className="product-swatch"
                              style={{ backgroundColor: option.colour }}
                              aria-hidden="true"
                            />
                          )}
                          <span>{option.label}</span>
                          {target && !target.available && (
                            <span className="product-axis-soldout">
                              {" "}
                              · sold out
                            </span>
                          )}
                        </>
                      );
                      return target ? (
                        <Link
                          key={option.id}
                          href={hrefFor(target.id)}
                          scroll={false}
                          prefetch={false}
                          aria-current={selected ? "true" : undefined}
                          className="product-axis-btn"
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          key={option.id}
                          disabled
                          className="product-axis-btn"
                        >
                          {content}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}

              {product.variants.length > 1 && (
                <label className="product-variant-select">
                  <span>All combinations</span>
                  <select
                    value={variant.id}
                    onChange={(e) => choose(e.target.value)}
                  >
                    {product.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title ||
                          v.options
                            .map(
                              (o) =>
                                product.axes
                                  .find((a) => a.id === o.attributeId)
                                  ?.options.find((x) => x.id === o.optionId)
                                  ?.label,
                            )
                            .filter(Boolean)
                            .join(" / ") ||
                          v.sku}
                        {v.available ? "" : " · sold out"}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="product-availability">
                <p
                  className={
                    variant.available ? "product-in-stock" : "product-out-stock"
                  }
                >
                  <span className="product-stock-dot" aria-hidden="true">
                    ●
                  </span>
                  {variant.available ? "In stock" : "Currently out of stock"}
                </p>
              </div>

              <div className="product-meta">
                <span className="product-sku">SKU: {variant.sku}</span>
                {product.modelNumber && (
                  <span className="product-model">
                    Model: {product.modelNumber}
                  </span>
                )}
              </div>

              {!preview && (
                <AddToCart
                  productId={product.id}
                  variantId={variant.id}
                  available={variant.available}
                />
              )}
              <div className="product-checkout-note">
                <span className="product-note-icon" aria-hidden="true">
                  ℹ️
                </span>
                <span>
                  Online ordering will be available when checkout launches.
                </span>
              </div>
            </>
          ) : (
            <p className="product-empty">No available variants.</p>
          )}

          {product.warranty && (
            <div className="product-warranty">
              <span className="product-warranty-icon" aria-hidden="true">
                🛡️
              </span>
              <span>Warranty: {product.warranty}</span>
            </div>
          )}
        </div>
      </section>

      {product.features.length > 0 && (
        <section className="product-section product-features-section">
          <h2>Key Features</h2>
          <div className="product-features">
            {product.features.map((f, i) => (
              <div key={i} className="product-feature-card">
                <h3>{f.title}</h3>
                <p>{f.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="product-section">
        <h2>About this product</h2>
        <p className="product-description">{product.description}</p>
      </section>

      <section className="product-section">
        <h2>Specifications</h2>
        <dl className="product-specs">
          {product.attributes.map((a) => (
            <div key={a.name}>
              <dt>{a.name}</dt>
              <dd>{a.value}</dd>
            </div>
          ))}
          {variant?.specifications.map((s, i) => (
            <div key={i}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
        {product.specifications.map((group, i) => (
          <div key={i} className="product-spec-group">
            <h3>{group.heading}</h3>
            <dl className="product-specs">
              {group.entries.map((s, j) => (
                <div key={j}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>

      {product.manufacturerContent.length > 0 && (
        <section className="product-section product-manufacturer">
          <h2>From the manufacturer</h2>
          {product.manufacturerContent.map((section, index) => (
            <div key={index} className="product-manufacturer-block">
              {section.heading && <h3>{section.heading}</h3>}
              {section.body && (
                <p className="product-description">{section.body}</p>
              )}
              {section.images.map((image, i) => (
                <Image
                  key={image.url + i}
                  unoptimized
                  referrerPolicy="no-referrer"
                  src={image.url}
                  alt={image.alt}
                  width={1200}
                  height={800}
                  className="product-manufacturer-image"
                />
              ))}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
