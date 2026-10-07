"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { saveBrand, uploadBrandLogo } from "./actions";
import { brandInput, brandSlug, type BrandInput } from "./validation";

type Asset = { id: string; secureUrl: string; alt: string };
type Tab = "details" | "media" | "seo";

export function BrandForm({
  initial,
  initialLogo,
}: {
  initial: BrandInput;
  initialLogo: Asset | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  const tab: Tab =
    requested === "media" || requested === "seo" ? requested : "details";
  const [value, setValue] = useState(initial);
  const [logo, setLogo] = useState(initialLogo);
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
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(next: BrandInput) {
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
    if (dirty && !window.confirm("Discard your unsaved brand changes?")) return;
    router.push("/admin/brands");
  }

  async function upload(file?: File) {
    if (!file) return;
    if (!value.name.trim()) {
      setMessage({
        ok: false,
        text: "Enter the brand name before uploading a logo.",
      });
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("alt", value.name.trim() + " logo");
      const result = await uploadBrandLogo(data);
      if (!result.ok) {
        setMessage({ ok: false, text: result.message });
        return;
      }
      setLogo(result.asset);
      update({ ...value, logoId: result.asset.id });
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
    const result = brandInput.safeParse(value);
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
        "This brand will no longer be available publicly. Continue?",
      )
    )
      return;
    startTransition(async () => {
      const saved = await saveBrand(result.data);
      setMessage({ ok: saved.ok, text: saved.message });
      if (saved.ok) {
        setDirty(false);
        router.push("/admin/brands");
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
        aria-label="Brand form sections"
      >
        {(
          [
            ["details", "Details"],
            ["media", "Logo"],
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
        className="admin-form-fieldset"
      >
        {tab === "details" && (
          <section className="admin-form-card">
            <header>
              <h2>Brand details</h2>
              <p>Public identity, visibility and storefront placement.</p>
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
                      slug: manualSlug ? value.slug : brandSlug(name),
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
                  maxLength={100}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
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
                <small>Old URLs redirect automatically.</small>
                {errors.slug && (
                  <small className="field-error">{errors.slug}</small>
                )}
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
              <label className="category-check">
                <input
                  type="checkbox"
                  checked={value.featured}
                  onChange={(event) =>
                    update({ ...value, featured: event.target.checked })
                  }
                />
                Feature this brand
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
          <section className="admin-form-card">
            <header>
              <h2>Brand logo</h2>
              <p>
                Use a clean square or horizontal logo with transparent padding.
              </p>
            </header>
            <div className="admin-media-grid">
              <div>
                <label>
                  Logo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => upload(event.target.files?.[0])}
                  />
                </label>
                <small>JPEG, PNG or WebP · up to 900 KB</small>
                {logo && (
                  <>
                    <Image
                      unoptimized
                      width={320}
                      height={160}
                      src={logo.secureUrl}
                      alt={logo.alt || value.name + " logo"}
                    />
                    <button
                      type="button"
                      className="admin-text-link"
                      onClick={() => {
                        setLogo(null);
                        update({ ...value, logoId: null });
                      }}
                    >
                      Remove from brand
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {tab === "seo" && (
          <section className="admin-form-card">
            <header>
              <h2>Search appearance</h2>
              <p>Leave optional text blank to use the brand content.</p>
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
                Canonical brand path
                <input
                  placeholder="/brand/example"
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
                  rows={3}
                  maxLength={170}
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
          This brand is archived and retained for URL and audit history.
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
            type="submit"
            className="admin-button"
            disabled={pending || uploading || archived}
          >
            {pending
              ? "Saving…"
              : uploading
                ? "Uploading…"
                : initial.id
                  ? "Save changes"
                  : "Create brand"}
          </button>
        </div>
      </div>
    </form>
  );
}
