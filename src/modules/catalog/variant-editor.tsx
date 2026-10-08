"use client";
import { useState } from "react";
import type { AttributeInput } from "../attributes/validation";
import type { VariantInput } from "./validation";
import { previewVariants } from "./variant-builder";
import { PriceEditor } from "./price-editor";
import { SpecificationEntries } from "./specification-editor";

export function VariantEditor({
  variants,
  attributes,
  defaultId,
  reserved,
  onChange,
}: {
  variants: VariantInput[];
  attributes: AttributeInput[];
  defaultId: string;
  reserved: Record<string, number>;
  onChange: (variants: VariantInput[], defaultId: string) => void;
}) {
  const [axes, setAxes] = useState<
    { attributeId: string; optionIds: string[] }[]
  >(() =>
    [
      ...new Set(variants.flatMap((v) => v.options.map((o) => o.attributeId))),
    ].map((attributeId) => ({
      attributeId,
      optionIds: [
        ...new Set(
          variants.flatMap((v) =>
            v.options
              .filter((o) => o.attributeId === attributeId)
              .map((o) => o.optionId),
          ),
        ),
      ],
    })),
  );
  const [preview, setPreview] = useState<ReturnType<
    typeof previewVariants
  > | null>(null);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(variants[0]?.id);
  const current = variants.find((v) => v.id === selected) ?? variants[0];
  const label = (v: VariantInput) =>
    v.options
      .map(
        (o) =>
          attributes
            .find((a) => a.id === o.attributeId)
            ?.options.find((x) => x.id === o.optionId)?.label ??
          "Retired option",
      )
      .join(" / ") || "Default variant";
  const update = (v: VariantInput) =>
    onChange(
      variants.map((x) => (x.id === v.id ? v : x)),
      defaultId,
    );
  return (
    <>
      <section className="admin-form-card">
        <header>
          <h2>Variant options</h2>
          <p>
            Add only options that change the sellable item. Specifications
            belong in Details.
          </p>
        </header>
        <div className="catalog-section-body">
          {axes.map((axis, index) => {
            const attribute = attributes.find((a) => a.id === axis.attributeId);
            return (
              <div className="catalog-axis" key={axis.attributeId}>
                <strong>{attribute?.name}</strong>
                <button
                  type="button"
                  className="admin-button secondary"
                  onClick={() => {
                    setAxes(axes.filter((_, i) => i !== index));
                    setPreview(null);
                  }}
                >
                  Remove axis
                </button>
                <div className="catalog-chips">
                  {attribute?.options.map((option) => (
                    <label className="catalog-check" key={option.id}>
                      <input
                        type="checkbox"
                        disabled={
                          !option.active && !axis.optionIds.includes(option.id)
                        }
                        checked={axis.optionIds.includes(option.id)}
                        onChange={(e) => {
                          setAxes(
                            axes.map((a, i) =>
                              i === index
                                ? {
                                    ...a,
                                    optionIds: e.target.checked
                                      ? [...a.optionIds, option.id]
                                      : a.optionIds.filter(
                                          (id) => id !== option.id,
                                        ),
                                  }
                                : a,
                            ),
                          );
                          setPreview(null);
                        }}
                      />
                      {option.label}
                      {!option.active && " (retired)"}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          <label>
            Add a variant axis
            <select
              value=""
              onChange={(e) => {
                if (e.target.value)
                  setAxes([
                    ...axes,
                    { attributeId: e.target.value, optionIds: [] },
                  ]);
              }}
            >
              <option value="">Choose an attribute…</option>
              {attributes
                .filter(
                  (a) =>
                    a.active &&
                    a.variantAxisAllowed &&
                    !axes.some((x) => x.attributeId === a.id),
                )
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            className="admin-button secondary"
            onClick={() => {
              try {
                setPreview(previewVariants(axes, variants));
                setMessage("");
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Invalid options");
              }
            }}
          >
            Preview combinations
          </button>
          {message && <p role="alert">{message}</p>}
          {preview && (
            <div className="admin-notice warning">
              <div>
                <strong>
                  {preview.retained.length} retained · {preview.added.length}{" "}
                  new · {preview.removed.length} to archive
                </strong>
                <p>{preview.added.map(label).join(", ")}</p>
                {preview.removed.length > 0 && (
                  <p>
                    Archive: {preview.removed.map(label).join(", ")}. Existing
                    IDs and history are retained.
                  </p>
                )}
              </div>
              <button
                type="button"
                className="admin-button secondary"
                onClick={() => {
                  if (
                    preview.removed.length &&
                    !window.confirm(
                      "Archive these variants? Existing references remain in history.",
                    )
                  )
                    return;
                  const next = [...preview.retained, ...preview.added];
                  onChange(
                    next,
                    next.some((v) => v.id === defaultId)
                      ? defaultId
                      : next[0].id,
                  );
                  setSelected(next[0].id);
                  setPreview(null);
                }}
              >
                Apply reviewed changes
              </button>
            </div>
          )}
        </div>
      </section>
      <section className="admin-form-card">
        <header>
          <h2>Variants & pricing</h2>
          <p>
            Select a row to edit price, stock and shipping. Price changes are
            saved with the product.
          </p>
        </header>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Variant</th>
                <th>SKU</th>
                <th>Availability</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id}>
                  <td>
                    <button
                      type="button"
                      className="admin-text-link"
                      onClick={() => setSelected(v.id)}
                    >
                      {label(v)}
                    </button>
                  </td>
                  <td>{v.sku || "SKU required"}</td>
                  <td>
                    {v.active
                      ? v.trackQuantity
                        ? `${Math.max(0, (v.onHand ?? 0) - (reserved[v.id] ?? 0))} available`
                        : v.stockStatus.replaceAll("_", " ")
                      : "Inactive"}
                  </td>
                  <td>
                    <input
                      type="radio"
                      aria-label={"Default " + label(v)}
                      name="default-variant"
                      checked={v.id === defaultId}
                      onChange={() => onChange(variants, v.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {current && (
          <div className="catalog-variant-detail">
            <h3>{label(current)}</h3>
            <div className="admin-form-grid">
              <label>
                SKU *
                <input
                  value={current.sku}
                  maxLength={80}
                  onChange={(e) => update({ ...current, sku: e.target.value })}
                />
              </label>
              <label>
                Barcode
                <input
                  value={current.barcode}
                  maxLength={32}
                  onChange={(e) =>
                    update({ ...current, barcode: e.target.value })
                  }
                />
              </label>
              <label>
                Display title override
                <input
                  value={current.title}
                  onChange={(e) =>
                    update({ ...current, title: e.target.value })
                  }
                />
              </label>
              <label className="catalog-check">
                <input
                  type="checkbox"
                  checked={current.active}
                  onChange={(e) =>
                    update({ ...current, active: e.target.checked })
                  }
                />
                Variant active
              </label>
            </div>
            <PriceEditor key={current.id} value={current} onChange={update} />
            <div className="admin-form-grid">
              <label className="catalog-check">
                <input
                  type="checkbox"
                  checked={current.trackQuantity}
                  onChange={(e) =>
                    update({
                      ...current,
                      trackQuantity: e.target.checked,
                      onHand: e.target.checked ? (current.onHand ?? 0) : null,
                    })
                  }
                />
                Track quantity
              </label>
              {current.trackQuantity ? (
                <label>
                  On hand (reserved: {reserved[current.id] ?? 0})
                  <input
                    type="number"
                    min={reserved[current.id] ?? 0}
                    value={current.onHand ?? 0}
                    onChange={(e) =>
                      update({ ...current, onHand: Number(e.target.value) })
                    }
                  />
                </label>
              ) : (
                <label>
                  Availability
                  <select
                    value={current.stockStatus}
                    onChange={(e) =>
                      update({
                        ...current,
                        stockStatus: e.target
                          .value as VariantInput["stockStatus"],
                      })
                    }
                  >
                    <option value="OUT_OF_STOCK">Out of stock</option>
                    <option value="IN_STOCK">In stock</option>
                  </select>
                </label>
              )}
              {(
                [
                  ["weightGrams", "Shipping weight (g)"],
                  ["lengthMm", "Length (mm)"],
                  ["widthMm", "Width (mm)"],
                  ["heightMm", "Height (mm)"],
                ] as const
              ).map(([key, title]) => (
                <label key={key}>
                  {title}
                  <input
                    type="number"
                    min={0}
                    value={current[key] ?? ""}
                    onChange={(e) =>
                      update({
                        ...current,
                        [key]:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <h3>Variant specifications</h3>
            <SpecificationEntries
              value={current.specifications}
              onChange={(specifications) =>
                update({ ...current, specifications })
              }
            />
          </div>
        )}
      </section>
    </>
  );
}
