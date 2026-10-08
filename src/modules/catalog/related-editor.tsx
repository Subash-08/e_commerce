"use client";
import { useRef, useState } from "react";
import { findRelatedProducts } from "./actions";
type Option = { id: string; name: string };
export function RelatedProducts({
  productId,
  selected,
  initial,
  onChange,
}: {
  productId?: string;
  selected: string[];
  initial: Option[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState(initial);
  const [message, setMessage] = useState("");
  const request = useRef(0);
  async function find() {
    const current = ++request.current;
    setMessage("Searching…");
    const result = await findRelatedProducts(search, productId);
    if (current !== request.current) return;
    setMessage(
      result.ok
        ? result.rows.length
          ? ""
          : "No matching products."
        : "Search failed. Try again.",
    );
    if (result.ok)
      setOptions((old) => [
        ...old.filter((o) => selected.includes(o.id)),
        ...result.rows.filter((o) => !selected.includes(o.id)),
      ]);
  }
  return (
    <section className="admin-form-card">
      <header>
        <h2>Related products</h2>
        <p>
          Choose up to 20 complementary products. Only published products appear
          publicly.
        </p>
      </header>
      <div className="catalog-section-body">
        <div className="catalog-option-row">
          <label>
            Find by name prefix
            <input
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void find();
                }
              }}
            />
          </label>
          <button
            className="admin-button secondary"
            type="button"
            onClick={find}
          >
            Search
          </button>
        </div>
        <p role="status">{message}</p>
        <div className="catalog-chips">
          {selected.map((id) => (
            <button
              type="button"
              key={id}
              onClick={() => onChange(selected.filter((x) => x !== id))}
            >
              {options.find((o) => o.id === id)?.name ?? "Unavailable product"}{" "}
              ×
            </button>
          ))}
        </div>
        <div className="catalog-options">
          {options
            .filter((o) => !selected.includes(o.id))
            .map((o) => (
              <button
                type="button"
                className="admin-button secondary"
                disabled={selected.length >= 20}
                key={o.id}
                onClick={() => onChange([...selected, o.id])}
              >
                + {o.name}
              </button>
            ))}
        </div>
      </div>
    </section>
  );
}
