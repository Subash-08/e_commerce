"use client";
import { ProductGallery } from "./gallery";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import type { PublicProduct } from "./public";
import { selectVariant } from "./selection";
const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    amount / 100,
  );
export function ProductDetail({
  product,
  initialVariant,
}: {
  product: PublicProduct;
  initialVariant?: string;
}) {
  const query = useSearchParams();
  const requested = query ? query.get("variant") : initialVariant;
  const { variant, unavailable } = selectVariant(product, requested);

  const gallery = variant?.images.length ? variant.images : product.images;
  function choose(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", id);
    window.history.pushState(null, "", url);
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
          <p className="product-brand">{product.brand?.name}</p>
          <h1>{product.name}</h1>
          <p className="product-summary">{product.summary}</p>
          {unavailable && (
            <p role="status" className="product-warning">
              The requested variant is no longer available. Showing an available
              selection.
            </p>
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
                    return (
                      <button
                        type="button"
                        key={option.id}
                        disabled={!target}
                        aria-pressed={selected}
                        onClick={() => target && choose(target.id)}
                      >
                        {axis.type === "COLOUR" && (
                          <span
                            className="product-swatch"
                            style={{ backgroundColor: option.colour }}
                          />
                        )}
                        {option.label}
                        {target && !target.available ? " · sold out" : ""}
                      </button>
                    );
                  })}
                </fieldset>
              ))}
              {product.variants.length > 1 && (
                <label className="product-variant-select">
                  All combinations
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
              <p
                className={
                  variant.available ? "product-in-stock" : "product-out-stock"
                }
              >
                {variant.available ? "In stock" : "Currently out of stock"}
              </p>
              <p className="product-sku">SKU: {variant.sku}</p>
              <p className="product-checkout-note">
                Online ordering will be available when checkout launches.
              </p>
            </>
          ) : (
            <p>No available variants.</p>
          )}
          {product.warranty && <p>Warranty: {product.warranty}</p>}
        </div>
      </section>
      {product.features.length > 0 && (
        <section className="product-section product-features">
          {product.features.map((f, i) => (
            <div key={i}>
              <h3>{f.title}</h3>
              <p>{f.description}</p>
            </div>
          ))}
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
          <div key={i}>
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
            <section key={index}>
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
            </section>
          ))}
        </section>
      )}
    </>
  );
}
