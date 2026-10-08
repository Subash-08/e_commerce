"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ProductImages } from "./image-editor";
import { useRouter, useSearchParams } from "next/navigation";
import type { catalogService } from "./service";
import { productInput, youtubeId, type ProductInput } from "./validation";
import { blankVariant } from "./variant-builder";
import { VariantEditor } from "./variant-editor";
import { SearchSelect, CategoryPicker } from "./selectors";
import { saveProduct } from "./actions";
import { AttributeEditor } from "../attributes/editor";
import { SpecificationGroups } from "./specification-editor";
import { RelatedProducts } from "./related-editor";

type EditorData = Awaited<
  ReturnType<ReturnType<typeof catalogService>["editor"]>
>;
const tabs = ["details", "variants", "media", "specifications", "seo"] as const;
function emptyProduct(): ProductInput {
  const variant = blankVariant();
  return {
    name: "",
    slug: "",
    brandId: "",
    categoryIds: [],
    primaryCategoryId: "",
    status: "DRAFT",
    summary: "",
    description: "",
    modelNumber: "",
    hsn: "",
    tags: [],
    warranty: "",
    notes: "",
    thumbnail: null,
    hoverImage: null,
    manufacturerContent: [],
    media: [],
    videos: [],
    attributes: [],
    specifications: [],
    features: [],
    linkedProductIds: [],
    defaultVariantId: variant.id,
    variants: [variant],
    seo: { title: "", description: "", robotsIndex: true },
  };
}
export function ProductEditor({ data }: { data: EditorData }) {
  const [value, setValue] = useState<ProductInput>(
    () => data.value ?? emptyProduct(),
  );
  const [assets, setAssets] = useState(data.assets);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [manualSlug, setManualSlug] = useState(!!data.value);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [showAttribute, setShowAttribute] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get("tab");
  const tab = tabs.find((t) => t === requested) ?? "details";
  function update(next: ProductInput) {
    setValue(next);
    setDirty(true);
    setMessage("");
  }
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    const click = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a");
      if (
        dirty &&
        link &&
        link.target !== "_blank" &&
        !window.confirm("Discard unsaved product changes?")
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
  function selectTab(next: string) {
    const query = new URLSearchParams(params.toString());
    query.set("tab", next);
    router.replace("?" + query.toString(), { scroll: false });
  }
  async function uploadVideo(file?: File) {
    if (!file) return;
    if (!value.name.trim()) {
      setMessage("Enter a product name first.");
      return;
    }
    if (file.size > 3000000 || value.videos.length >= 10) {
      setMessage(
        "Use a video under 3 MB, with at most ten videos per product.",
      );
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("title", value.name + " demonstration");
      const response = await fetch("/api/media/video", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok || !result.asset?.id) {
        setMessage("Video upload failed. Check the file and try again.");
        return;
      }
      update({
        ...value,
        videos: [
          ...value.videos,
          {
            source: "CLOUDINARY",
            assetId: result.asset.id,
            title: value.name + " demonstration",
          },
        ],
      });
    } catch {
      setMessage("Video upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }
  function save() {
    const invalid = document.querySelector<HTMLInputElement>(
      ".catalog-editor input:invalid",
    );
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    const parsed = productInput.safeParse(value);
    if (!parsed.success) {
      setErrors(
        parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message),
      );
      setMessage("Review the fields listed below.");
      return;
    }
    setErrors([]);
    if (
      value.status === "ARCHIVED" &&
      !window.confirm(
        "Archive this product? Public access will stop; its records and variants remain in history.",
      )
    )
      return;
    start(async () => {
      const result = await saveProduct(parsed.data);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setDirty(false);
      router.push("/admin/products/" + result.id + "/edit?saved=1");
      router.refresh();
    });
  }
  return (
    <section>
      <nav className="admin-breadcrumb">
        <Link href="/admin/products">Products</Link>
        <span>/</span>
        <span>{value.id ? value.name : "New product"}</span>
      </nav>
      <div className="admin-page-heading">
        <div>
          <h1>{value.id ? "Edit product" : "Create product"}</h1>
          <p>
            Build the product once. Give each sellable variant its own price,
            media and stock.
          </p>
        </div>
        {value.id && (
          <Link
            target="_blank"
            className="admin-button secondary"
            href={"/admin/products/" + value.id + "/preview"}
          >
            Preview saved product
          </Link>
        )}
      </div>
      {message && (
        <div role="alert" className="admin-notice danger">
          {message}
          {errors.length > 0 && (
            <ul>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {params.get("saved") === "1" && !dirty && (
        <div role="status" className="admin-notice success">
          Product saved.
        </div>
      )}
      <div className="admin-form-tabs" aria-label="Product sections">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? "selected" : ""}
            onClick={() => selectTab(t)}
          >
            {t === "variants"
              ? "Variants & pricing"
              : t === "seo"
                ? "SEO & visibility"
                : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <fieldset
        className="admin-form-fieldset catalog-editor"
        disabled={pending || uploading || data.value?.status === "ARCHIVED"}
      >
        {tab === "details" && (
          <section className="admin-form-card">
            <header>
              <h2>Product identity</h2>
              <p>
                Brand and categories are required. Choose one primary category
                for breadcrumbs.
              </p>
            </header>
            <div className="admin-form-grid">
              <label>
                Product name *
                <input
                  value={value.name}
                  maxLength={200}
                  onChange={(e) =>
                    update({
                      ...value,
                      name: e.target.value,
                      slug: manualSlug
                        ? value.slug
                        : e.target.value
                            .normalize("NFKD")
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-|-$/g, "")
                            .slice(0, 100),
                    })
                  }
                />
              </label>
              <label>
                URL slug *
                <input
                  value={value.slug}
                  onChange={(e) => {
                    setManualSlug(true);
                    update({ ...value, slug: e.target.value });
                  }}
                />
                <small>Old URLs redirect after a rename.</small>
              </label>
              <SearchSelect
                label="Brand *"
                value={value.brandId}
                options={data.brands}
                onChange={(brandId) => update({ ...value, brandId })}
              />
              <label>
                Model number
                <input
                  value={value.modelNumber}
                  onChange={(e) =>
                    update({ ...value, modelNumber: e.target.value })
                  }
                />
              </label>
              <CategoryPicker
                options={data.categories}
                selected={value.categoryIds}
                primary={value.primaryCategoryId}
                onChange={(categoryIds, primaryCategoryId) =>
                  update({ ...value, categoryIds, primaryCategoryId })
                }
              />
              <label className="category-wide">
                Short summary
                <textarea
                  rows={2}
                  maxLength={500}
                  value={value.summary}
                  onChange={(e) =>
                    update({ ...value, summary: e.target.value })
                  }
                />
              </label>
              <label className="category-wide">
                Description
                <textarea
                  rows={6}
                  maxLength={20000}
                  value={value.description}
                  onChange={(e) =>
                    update({ ...value, description: e.target.value })
                  }
                />
              </label>
              <label>
                HSN code
                <input
                  inputMode="numeric"
                  maxLength={8}
                  value={value.hsn}
                  onChange={(e) => update({ ...value, hsn: e.target.value })}
                />
              </label>
              <label>
                Warranty
                <input
                  value={value.warranty}
                  onChange={(e) =>
                    update({ ...value, warranty: e.target.value })
                  }
                />
              </label>
              <label>
                Tags, separated by commas
                <input
                  value={value.tags.join(", ")}
                  onChange={(e) =>
                    update({
                      ...value,
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <label>
                Private admin notes
                <textarea
                  rows={2}
                  value={value.notes}
                  onChange={(e) => update({ ...value, notes: e.target.value })}
                />
              </label>
            </div>
          </section>
        )}
        {tab === "variants" && (
          <>
            <button
              type="button"
              className="admin-button secondary"
              onClick={() => setShowAttribute(!showAttribute)}
            >
              Create reusable attribute
            </button>
            {showAttribute && (
              <AttributeEditor
                onSaved={() => {
                  setShowAttribute(false);
                  router.refresh();
                }}
              />
            )}
            <VariantEditor
              variants={value.variants}
              attributes={data.attributes}
              defaultId={value.defaultVariantId}
              reserved={data.reserved}
              onChange={(variants, defaultVariantId) =>
                update({ ...value, variants, defaultVariantId })
              }
            />
          </>
        )}
        {tab === "media" && (
          <>
            <ProductImages
              value={value}
              assets={assets}
              onChange={update}
              onAsset={(asset) => setAssets((current) => [...current, asset])}
              onBusy={setUploading}
            />
            <section className="admin-form-card">
              <header>
                <h2>Videos</h2>
                <p>YouTube is recommended for hosted product demonstrations.</p>
              </header>
              <div className="catalog-section-body">
                <label>
                  YouTube URL
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="admin-button secondary"
                  onClick={() => {
                    const id = youtubeId(videoUrl);
                    if (!id) {
                      setMessage(
                        "Enter a supported YouTube watch, short or share URL.",
                      );
                      return;
                    }
                    update({
                      ...value,
                      videos: [
                        ...value.videos,
                        {
                          source: "YOUTUBE",
                          videoId: id,
                          title: value.name + " demonstration",
                        },
                      ],
                    });
                    setVideoUrl("");
                  }}
                >
                  Add YouTube video
                </button>
                <label>
                  Or upload a short video
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    onChange={(e) => uploadVideo(e.target.files?.[0])}
                  />
                  <small>
                    MP4/WebM up to 3 MB. Use YouTube for longer videos;
                    Cloudinary storage and bandwidth apply.
                  </small>
                </label>
                {value.videos.map((video, i) => (
                  <div className="catalog-option-row" key={i}>
                    <label>
                      Video title
                      <input
                        value={video.title}
                        onChange={(e) =>
                          update({
                            ...value,
                            videos: value.videos.map((v, n) =>
                              n === i ? { ...v, title: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="admin-button secondary"
                      disabled={!i}
                      onClick={() => {
                        const next = [...value.videos];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        update({ ...value, videos: next });
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="admin-text-link"
                      onClick={() =>
                        update({
                          ...value,
                          videos: value.videos.filter((_, n) => n !== i),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
        {tab === "specifications" && (
          <>
            <RelatedProducts
              productId={value.id}
              selected={value.linkedProductIds}
              initial={data.linked}
              onChange={(linkedProductIds) =>
                update({ ...value, linkedProductIds })
              }
            />
            <SpecificationGroups
              value={value.specifications}
              onChange={(specifications) =>
                update({ ...value, specifications })
              }
            />
            <section className="admin-form-card">
              <header>
                <h2>Typed specifications</h2>
                <p>Descriptive attributes do not create variants.</p>
              </header>
              <div className="admin-form-grid">
                {data.attributes
                  .filter(
                    (a) =>
                      a.visible &&
                      (a.active ||
                        value.attributes.some((v) => v.attributeId === a.id)),
                  )
                  .map((a) => {
                    const assignment = value.attributes.find(
                      (v) => v.attributeId === a.id,
                    );
                    const change = (
                      next: string | number | boolean | string[] | undefined,
                    ) =>
                      update({
                        ...value,
                        attributes: [
                          ...value.attributes.filter(
                            (v) => v.attributeId !== a.id,
                          ),
                          ...(next === undefined
                            ? []
                            : [{ attributeId: a.id!, value: next }]),
                        ],
                      });
                    return (
                      <label key={a.id}>
                        {a.name}
                        {a.unit ? " (" + a.unit + ")" : ""}
                        {a.type === "BOOLEAN" ? (
                          <select
                            value={
                              assignment === undefined
                                ? ""
                                : String(assignment.value)
                            }
                            onChange={(e) =>
                              change(
                                e.target.value === ""
                                  ? undefined
                                  : e.target.value === "true",
                              )
                            }
                          >
                            <option value="">Not specified</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        ) : ["SINGLE_SELECT", "COLOUR"].includes(a.type) ? (
                          <select
                            value={String(assignment?.value ?? "")}
                            onChange={(e) =>
                              change(e.target.value || undefined)
                            }
                          >
                            <option value="">Not specified</option>
                            {a.options.map((o) => (
                              <option
                                key={o.id}
                                value={o.id}
                                disabled={
                                  !o.active && assignment?.value !== o.id
                                }
                              >
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : a.type === "MULTI_SELECT" ? (
                          <div className="catalog-options">
                            {a.options.map((o) => (
                              <label className="catalog-check" key={o.id}>
                                <input
                                  type="checkbox"
                                  checked={
                                    Array.isArray(assignment?.value) &&
                                    assignment.value.includes(o.id)
                                  }
                                  onChange={(e) => {
                                    const old = Array.isArray(assignment?.value)
                                      ? assignment.value
                                      : [];
                                    change(
                                      e.target.checked
                                        ? [...old, o.id]
                                        : old.filter((x) => x !== o.id),
                                    );
                                  }}
                                />
                                {o.label}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <input
                            type={a.type === "NUMBER" ? "number" : "text"}
                            value={
                              typeof assignment?.value === "string" ||
                              typeof assignment?.value === "number"
                                ? assignment.value
                                : ""
                            }
                            onChange={(e) =>
                              change(
                                e.target.value === ""
                                  ? undefined
                                  : a.type === "NUMBER"
                                    ? Number(e.target.value)
                                    : e.target.value,
                              )
                            }
                          />
                        )}
                      </label>
                    );
                  })}
              </div>
            </section>
            <section className="admin-form-card">
              <header>
                <h2>Highlights</h2>
                <p>Short benefits displayed on the product page.</p>
              </header>
              <div className="catalog-section-body">
                {value.features.map((f, i) => (
                  <div className="catalog-option-row" key={i}>
                    <label>
                      Title
                      <input
                        value={f.title}
                        onChange={(e) =>
                          update({
                            ...value,
                            features: value.features.map((x, n) =>
                              n === i ? { ...x, title: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Description
                      <input
                        value={f.description}
                        onChange={(e) =>
                          update({
                            ...value,
                            features: value.features.map((x, n) =>
                              n === i
                                ? { ...x, description: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="admin-text-link"
                      onClick={() =>
                        update({
                          ...value,
                          features: value.features.filter((_, n) => n !== i),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="admin-button secondary"
                  onClick={() =>
                    update({
                      ...value,
                      features: [
                        ...value.features,
                        { title: "", description: "" },
                      ],
                    })
                  }
                >
                  Add highlight
                </button>
              </div>
            </section>
          </>
        )}
        {tab === "seo" && (
          <section className="admin-form-card">
            <header>
              <h2>Publication & search</h2>
              <p>
                Drafts and archived products are hidden. Variant links
                canonicalize to this product.
              </p>
            </header>
            <div className="admin-form-grid">
              <label>
                Status
                <select
                  value={value.status}
                  onChange={(e) =>
                    update({
                      ...value,
                      status: e.target.value as ProductInput["status"],
                    })
                  }
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Published</option>
                  {value.id && <option value="ARCHIVED">Archive</option>}
                </select>
              </label>
              <label>
                SEO title
                <input
                  maxLength={70}
                  value={value.seo.title}
                  onChange={(e) =>
                    update({
                      ...value,
                      seo: { ...value.seo, title: e.target.value },
                    })
                  }
                />
              </label>
              <label className="category-wide">
                Meta description
                <textarea
                  maxLength={170}
                  rows={3}
                  value={value.seo.description}
                  onChange={(e) =>
                    update({
                      ...value,
                      seo: { ...value.seo, description: e.target.value },
                    })
                  }
                />
              </label>
              <label className="catalog-check">
                <input
                  type="checkbox"
                  checked={value.seo.robotsIndex}
                  onChange={(e) =>
                    update({
                      ...value,
                      seo: { ...value.seo, robotsIndex: e.target.checked },
                    })
                  }
                />
                Allow indexing when published
              </label>
            </div>
          </section>
        )}
      </fieldset>
      <div className="admin-sticky-actions">
        <span>
          {dirty
            ? "Unsaved changes"
            : value.status === "ARCHIVED"
              ? "Archived — read only"
              : "All changes saved"}
        </span>
        <div>
          <Link className="admin-button secondary" href="/admin/products">
            Cancel
          </Link>
          <button
            type="button"
            className="admin-button"
            disabled={pending || uploading || data.value?.status === "ARCHIVED"}
            onClick={save}
          >
            {pending ? "Saving…" : uploading ? "Uploading…" : "Save product"}
          </button>
        </div>
      </div>
    </section>
  );
}
