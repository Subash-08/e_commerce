"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { saveCategory, uploadCategoryImage } from "./actions";
import { categoryInput, slugFromName, type CategoryInput } from "./validation";

type Asset = { id: string; secureUrl: string; alt: string };
type Option = {
  id: string;
  name: string;
  active: boolean;
  parentId: string | null;
};
type Tab = "details" | "media" | "seo";

export const emptyCategory: CategoryInput = {
  name: "",
  slug: "",
  parentId: null,
  description: "",
  active: true,
  featured: false,
  archived: false,
  deactivationReason: "",
  displayOrder: 0,
  thumbnailId: null,
  bannerId: null,
  seo: {
    title: "",
    description: "",
    canonicalPath: "",
    robotsIndex: true,
    robotsFollow: true,
  },
};

export function CategoryForm({
  initial,
  initialMedia,
  options,
}: {
  initial: CategoryInput;
  initialMedia: { thumbnail: Asset | null; banner: Asset | null };
  options: Option[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab: Tab =
    requestedTab === "media" || requestedTab === "seo"
      ? requestedTab
      : "details";
  const [value, setValue] = useState(initial);
  const [media, setMedia] = useState(initialMedia);
  const [manualSlug, setManualSlug] = useState(Boolean(initial.id));
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const archived = Boolean(initial.archived);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const descendants = useMemo(() => {
    if (!initial.id) return new Set<string>();
    const found = new Set<string>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const option of options) {
        if (
          !found.has(option.id) &&
          (option.parentId === initial.id ||
            (option.parentId && found.has(option.parentId)))
        ) {
          found.add(option.id);
          changed = true;
        }
      }
    }
    return found;
  }, [initial.id, options]);

  function update(next: CategoryInput) {
    setValue(next);
    setDirty(true);
    setMessage(null);
  }

  function selectTab(next: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "details") params.delete("tab");
    else params.set("tab", next);
    router.replace("?" + params.toString(), { scroll: false });
  }

  function cancel() {
    if (dirty && !window.confirm("Discard your unsaved category changes?"))
      return;
    router.push("/admin/categories");
  }

  async function upload(kind: "thumbnail" | "banner", file?: File) {
    if (!file) return;
    if (!value.name.trim()) {
      setMessage({
        ok: false,
        text: "Enter the category name before uploading images.",
      });
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("alt", value.name.trim());
      const result = await uploadCategoryImage(data);
      if (!result.ok) {
        setMessage({ ok: false, text: result.message });
        return;
      }
      setMedia((current) => ({ ...current, [kind]: result.asset }));
      update({
        ...value,
        [kind === "thumbnail" ? "thumbnailId" : "bannerId"]: result.asset.id,
      });
    } catch {
      setMessage({
        ok: false,
        text: "Upload failed. Check the image and try again.",
      });
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    const result = categoryInput.safeParse(value);
    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of result.error.issues)
        nextErrors[issue.path.join(".")] ??= issue.message;
      setErrors(nextErrors);
      setMessage({
        ok: false,
        text: "Review the highlighted fields before saving.",
      });
      selectTab(
        Object.keys(nextErrors).some((key) => key.startsWith("seo"))
          ? "seo"
          : "details",
      );
      return;
    }
    setErrors({});
    if (
      initial.id &&
      ((!result.data.active && initial.active) ||
        (result.data.archived && !initial.archived)) &&
      !window.confirm(
        "This category will no longer be available publicly. Continue?",
      )
    )
      return;
    startTransition(async () => {
      const saved = await saveCategory(result.data);
      setMessage({ ok: saved.ok, text: saved.message });
      if (saved.ok) {
        setDirty(false);
        router.push("/admin/categories");
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {message && (
        <div
          role={message.ok ? "status" : "alert"}
          className={"admin-notice " + (message.ok ? "success" : "danger")}
        >
          {message.text}
        </div>
      )}
      <div
        className="admin-form-tabs"
        role="tablist"
        aria-label="Category form sections"
      >
        {(
          [
            ["details", "Details"],
            ["media", "Images"],
            ["seo", "Search appearance"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "selected" : ""}
            onClick={() => selectTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <fieldset
        disabled={pending || uploading || archived}
        className="category-fields"
      >
        {tab === "details" && (
          <section className="admin-form-card category-wide">
            <header>
              <h2>Category details</h2>
              <p>Name, hierarchy, visibility and storefront placement.</p>
            </header>
            <div className="admin-form-grid">
              <label>
                Name
                <input
                  required
                  maxLength={120}
                  aria-invalid={Boolean(errors.name)}
                  value={value.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    update({
                      ...value,
                      name,
                      slug: manualSlug ? value.slug : slugFromName(name),
                    });
                  }}
                />
                {errors.name && (
                  <small className="field-error">{errors.name}</small>
                )}
              </label>
              <label>
                URL slug
                <input
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxLength={100}
                  aria-invalid={Boolean(errors.slug)}
                  value={value.slug}
                  onChange={(event) => {
                    setManualSlug(true);
                    update({
                      ...value,
                      slug: event.target.value.toLowerCase(),
                    });
                  }}
                />
                <small>Old URLs redirect automatically after a change.</small>
                {errors.slug && (
                  <small className="field-error">{errors.slug}</small>
                )}
              </label>
              <label>
                Parent category
                <select
                  value={value.parentId ?? ""}
                  onChange={(event) =>
                    update({ ...value, parentId: event.target.value || null })
                  }
                >
                  <option value="">Top-level category</option>
                  {options
                    .filter(
                      (option) =>
                        option.id !== initial.id && !descendants.has(option.id),
                    )
                    .map((option) => (
                      <option value={option.id} key={option.id}>
                        {option.name}
                        {option.active ? "" : " (inactive)"}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Display order
                <input
                  type="number"
                  min={0}
                  max={100000}
                  value={value.displayOrder}
                  onChange={(event) =>
                    update({
                      ...value,
                      displayOrder: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="category-wide">
                Description
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={value.description}
                  onChange={(event) =>
                    update({ ...value, description: event.target.value })
                  }
                />
              </label>
              <label>
                Status
                <select
                  value={
                    value.archived
                      ? "archived"
                      : value.active
                        ? "active"
                        : "inactive"
                  }
                  onChange={(event) =>
                    update({
                      ...value,
                      active: event.target.value === "active",
                      archived: event.target.value === "archived",
                    })
                  }
                >
                  <option value="inactive">Inactive</option>
                  <option value="active">Active</option>
                  {initial.id && <option value="archived">Archived</option>}
                </select>
              </label>
              <label className="category-check">
                <input
                  type="checkbox"
                  checked={value.featured}
                  onChange={(event) =>
                    update({ ...value, featured: event.target.checked })
                  }
                />
                Feature this category
              </label>
              {!value.active && (
                <label className="category-wide">
                  Deactivation reason
                  <textarea
                    required
                    rows={2}
                    maxLength={300}
                    aria-invalid={Boolean(errors.deactivationReason)}
                    value={value.deactivationReason}
                    onChange={(event) =>
                      update({
                        ...value,
                        deactivationReason: event.target.value,
                      })
                    }
                  />
                  {errors.deactivationReason && (
                    <small className="field-error">
                      {errors.deactivationReason}
                    </small>
                  )}
                </label>
              )}
            </div>
          </section>
        )}

        {tab === "media" && (
          <section className="admin-form-card category-wide">
            <header>
              <h2>Category images</h2>
              <p>
                Use a square thumbnail for cards and a wide banner for the
                category page.
              </p>
            </header>
            <div className="category-media">
              {(["thumbnail", "banner"] as const).map((kind) => (
                <div key={kind}>
                  <label>
                    {kind === "thumbnail" ? "Thumbnail" : "Banner"}
                    <input
                      aria-label={kind + " image"}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) =>
                        upload(kind, event.target.files?.[0])
                      }
                    />
                  </label>
                  <small>JPEG, PNG or WebP · up to 900 KB</small>
                  {media[kind] && (
                    <>
                      <Image
                        unoptimized
                        width={360}
                        height={180}
                        src={media[kind].secureUrl}
                        alt={media[kind].alt || value.name}
                      />
                      <button
                        type="button"
                        className="admin-text-link"
                        onClick={() => {
                          setMedia({ ...media, [kind]: null });
                          update({
                            ...value,
                            [kind === "thumbnail" ? "thumbnailId" : "bannerId"]:
                              null,
                          });
                        }}
                      >
                        Remove from category
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "seo" && (
          <section className="admin-form-card category-wide">
            <header>
              <h2>Search appearance</h2>
              <p>
                Leave optional text blank to use the category name and
                description.
              </p>
            </header>
            <div className="admin-form-grid">
              <label>
                SEO title
                <input
                  maxLength={70}
                  value={value.seo.title}
                  onChange={(event) =>
                    update({
                      ...value,
                      seo: { ...value.seo, title: event.target.value },
                    })
                  }
                />
                <small>{value.seo.title.length}/70</small>
              </label>
              <label>
                Canonical category path
                <input
                  placeholder="/category/example"
                  aria-invalid={Boolean(errors["seo.canonicalPath"])}
                  value={value.seo.canonicalPath}
                  onChange={(event) =>
                    update({
                      ...value,
                      seo: { ...value.seo, canonicalPath: event.target.value },
                    })
                  }
                />
                {errors["seo.canonicalPath"] && (
                  <small className="field-error">
                    {errors["seo.canonicalPath"]}
                  </small>
                )}
              </label>
              <label className="category-wide">
                Meta description
                <textarea
                  maxLength={170}
                  rows={3}
                  value={value.seo.description}
                  onChange={(event) =>
                    update({
                      ...value,
                      seo: { ...value.seo, description: event.target.value },
                    })
                  }
                />
                <small>{value.seo.description.length}/170</small>
              </label>
              <label className="category-check">
                <input
                  type="checkbox"
                  checked={value.seo.robotsIndex}
                  onChange={(event) =>
                    update({
                      ...value,
                      seo: { ...value.seo, robotsIndex: event.target.checked },
                    })
                  }
                />
                Allow search indexing
              </label>
              <label className="category-check">
                <input
                  type="checkbox"
                  checked={value.seo.robotsFollow}
                  onChange={(event) =>
                    update({
                      ...value,
                      seo: { ...value.seo, robotsFollow: event.target.checked },
                    })
                  }
                />
                Allow search engines to follow links
              </label>
            </div>
          </section>
        )}
      </fieldset>

      {archived && (
        <div className="admin-notice warning">
          This category is archived and retained for URL and audit history.
        </div>
      )}
      <div className="admin-sticky-actions">
        <span>
          {dirty
            ? "Unsaved changes"
            : initial.id
              ? "No unsaved changes"
              : "Ready to create"}
        </span>
        <div>
          <button
            type="button"
            className="admin-button secondary"
            onClick={cancel}
          >
            Cancel
          </button>
          <button
            className="admin-button"
            type="submit"
            disabled={pending || uploading || archived}
          >
            {pending
              ? "Saving…"
              : uploading
                ? "Uploading…"
                : initial.id
                  ? "Save changes"
                  : "Create category"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function CategoryFormCancelLink() {
  return (
    <Link href="/admin/categories" className="admin-button secondary">
      Back to categories
    </Link>
  );
}
