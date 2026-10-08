"use client";
import { useState } from "react";
import Image from "next/image";
import type { ProductInput } from "./validation";
import { isPublicImageUrl } from "./image-url";
import { uploadProductImage } from "./actions";
type Ref = ProductInput["media"][number];
type Asset = { id: string; url: string };

function ImageCollection({
  title,
  hint,
  value,
  limit,
  name,
  assets,
  onChange,
  onAsset,
  onBusy,
}: {
  title: string;
  hint: string;
  value: Ref[];
  limit: number;
  name: string;
  assets: Asset[];
  onChange: (value: Ref[]) => void;
  onAsset: (asset: Asset) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function upload(file?: File) {
    if (!file || busy) return;
    if (!name.trim()) {
      setError("Enter the product name first.");
      return;
    }
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("alt", name);
      const result = await uploadProductImage(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onAsset({ id: result.asset.id, url: result.asset.secureUrl });
      onChange([...value, { assetId: result.asset.id, alt: name }]);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section className="catalog-image-section">
      <h3>{title}</h3>
      <p className="admin-muted">{hint}</p>
      <div className="catalog-media-cards">
        {value.map((item, index) => {
          const source =
            item.url || assets.find((a) => a.id === item.assetId)?.url;
          return (
            <div key={item.assetId || item.url || index}>
              {source && (
                <Image
                  unoptimized
                  referrerPolicy="no-referrer"
                  src={source}
                  alt={item.alt}
                  width={240}
                  height={160}
                />
              )}
              <label>
                Alternative text
                <input
                  maxLength={200}
                  value={item.alt}
                  onChange={(e) =>
                    onChange(
                      value.map((v, i) =>
                        i === index ? { ...v, alt: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
              <div className="catalog-option-row">
                {limit > 1 && (
                  <button
                    type="button"
                    className="admin-button secondary"
                    disabled={index === 0}
                    onClick={() => {
                      const next = [...value];
                      [next[index - 1], next[index]] = [
                        next[index],
                        next[index - 1],
                      ];
                      onChange(next);
                    }}
                  >
                    Move earlier
                  </button>
                )}
                <button
                  type="button"
                  className="admin-text-link"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {value.length < limit && (
        <div className="catalog-option-row">
          <label>
            Upload file
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <small>JPEG, PNG or WebP, up to 900 KB.</small>
          </label>
          <label>
            Or image URL
            <input
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="admin-button secondary"
            disabled={busy || !url.trim()}
            onClick={() => {
              const source = url.trim();
              if (!isPublicImageUrl(source)) {
                setError("Use a public HTTPS image URL without credentials.");
                return;
              }
              if (!name.trim()) {
                setError("Enter the product name first.");
                return;
              }
              if (value.some((v) => v.url === source)) {
                setError("This image is already assigned.");
                return;
              }
              onChange([...value, { url: source, alt: name }]);
              setUrl("");
              setError("");
            }}
          >
            Add URL
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="admin-notice danger">
          {error}
        </p>
      )}
    </section>
  );
}

export function ProductImages({
  value,
  assets,
  onChange,
  onAsset,
  onBusy,
}: {
  value: ProductInput;
  assets: Asset[];
  onChange: (value: ProductInput) => void;
  onAsset: (asset: Asset) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [variantId, setVariantId] = useState(value.variants[0]?.id ?? "");
  const variant =
    value.variants.find((v) => v.id === variantId) ?? value.variants[0];
  const shared = { name: value.name, assets, onAsset, onBusy };
  return (
    <>
      <section className="admin-form-card">
        <header>
          <h2>Product images</h2>
          <p>
            Set a clear cover, an optional alternate view, then supporting
            gallery images.
          </p>
        </header>
        <div className="catalog-section-body">
          <div className="catalog-cover-grid">
            <ImageCollection
              {...shared}
              title="Thumbnail image"
              hint="Required for publishing. Used as the cover and shared-link image."
              value={value.thumbnail ? [value.thumbnail] : []}
              limit={1}
              onChange={(refs) =>
                onChange({ ...value, thumbnail: refs[0] ?? null })
              }
            />
            <ImageCollection
              {...shared}
              title="Hover image (optional)"
              hint="Alternate view on hover or keyboard focus; also available in the product gallery."
              value={value.hoverImage ? [value.hoverImage] : []}
              limit={1}
              onChange={(refs) =>
                onChange({ ...value, hoverImage: refs[0] ?? null })
              }
            />
          </div>
          <ImageCollection
            {...shared}
            title="Gallery images (optional)"
            hint="Supporting angles and close-ups. Videos appear alongside these images on the product page."
            value={value.media}
            limit={50}
            onChange={(media) => onChange({ ...value, media })}
          />
          <small>
            URL images stay on their original host. Use permanent links that
            allow public embedding.
          </small>
        </div>
      </section>
      <section className="admin-form-card">
        <header>
          <h2>Variant images (optional)</h2>
          <p>
            Override the image gallery for a particular variant. Product videos
            remain available.
          </p>
        </header>
        <div className="catalog-section-body">
          <label>
            Variant
            <select
              value={variant?.id ?? ""}
              onChange={(e) => setVariantId(e.target.value)}
            >
              {value.variants.map((v, i) => (
                <option key={v.id} value={v.id}>
                  {v.title || v.sku || "Variant " + (i + 1)}
                </option>
              ))}
            </select>
          </label>
          {variant && (
            <ImageCollection
              key={variant.id}
              {...shared}
              title="Selected variant gallery"
              hint="Leave empty to use product images."
              value={variant.media}
              limit={20}
              onChange={(media) =>
                onChange({
                  ...value,
                  variants: value.variants.map((v) =>
                    v.id === variant.id ? { ...v, media } : v,
                  ),
                })
              }
            />
          )}
        </div>
      </section>
      <section className="admin-form-card">
        <header>
          <h2>Manufacturer images & A+ content (optional)</h2>
          <p>
            Build ordered sections with manufacturer artwork and useful product
            information.
          </p>
        </header>
        <div className="catalog-section-body">
          {value.manufacturerContent.map((section, index) => (
            <section className="catalog-manufacturer-section" key={index}>
              <label>
                Section heading
                <input
                  maxLength={160}
                  value={section.heading}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      manufacturerContent: value.manufacturerContent.map(
                        (s, i) =>
                          i === index ? { ...s, heading: e.target.value } : s,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Section content
                <textarea
                  rows={3}
                  maxLength={3000}
                  value={section.body}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      manufacturerContent: value.manufacturerContent.map(
                        (s, i) =>
                          i === index ? { ...s, body: e.target.value } : s,
                      ),
                    })
                  }
                />
              </label>
              <ImageCollection
                {...shared}
                title="Manufacturer images"
                hint="Upload artwork or add image URLs. Images keep their original aspect ratio."
                value={section.images}
                limit={10}
                onChange={(images) =>
                  onChange({
                    ...value,
                    manufacturerContent: value.manufacturerContent.map(
                      (s, i) => (i === index ? { ...s, images } : s),
                    ),
                  })
                }
              />
              <button
                type="button"
                className="admin-button secondary"
                disabled={!index}
                onClick={() => {
                  const next = [...value.manufacturerContent];
                  [next[index - 1], next[index]] = [
                    next[index],
                    next[index - 1],
                  ];
                  onChange({ ...value, manufacturerContent: next });
                }}
              >
                Move section earlier
              </button>
              <button
                type="button"
                className="admin-text-link"
                onClick={() =>
                  onChange({
                    ...value,
                    manufacturerContent: value.manufacturerContent.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
              >
                Remove section
              </button>
            </section>
          ))}
          <button
            type="button"
            className="admin-button secondary"
            disabled={value.manufacturerContent.length >= 10}
            onClick={() =>
              onChange({
                ...value,
                manufacturerContent: [
                  ...value.manufacturerContent,
                  { heading: "", body: "", images: [] },
                ],
              })
            }
          >
            Add manufacturer section
          </button>
        </div>
      </section>
    </>
  );
}
