"use client";
import { useState } from "react";
export function SearchSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  return (
    <label>
      {label}
      <input
        aria-label={"Search " + label}
        placeholder={"Search " + label.toLowerCase() + "…"}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select required value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose {label.toLowerCase()}</option>
        {options
          .filter(
            (o) =>
              o.id === value ||
              o.name.toLowerCase().includes(search.toLowerCase()),
          )
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
      </select>
    </label>
  );
}
export function CategoryPicker({
  options,
  selected,
  primary,
  onChange,
}: {
  options: { id: string; name: string }[];
  selected: string[];
  primary: string;
  onChange: (ids: string[], primary: string) => void;
}) {
  const [search, setSearch] = useState("");
  return (
    <div className="category-wide">
      <label>
        Categories *
        <input
          className="catalog-search"
          placeholder="Find a category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="catalog-chips">
        {selected.map((id) => (
          <button
            type="button"
            key={id}
            onClick={() =>
              onChange(
                selected.filter((x) => x !== id),
                primary === id ? "" : primary,
              )
            }
          >
            {options.find((o) => o.id === id)?.name ?? "Unavailable category"} ×
          </button>
        ))}
      </div>
      <div className="catalog-options">
        {options
          .filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
          .map((o) => (
            <label className="catalog-check" key={o.id}>
              <input
                type="checkbox"
                checked={selected.includes(o.id)}
                onChange={(e) => {
                  const ids = e.target.checked
                    ? [...selected, o.id]
                    : selected.filter((x) => x !== o.id);
                  onChange(
                    ids,
                    ids.length === 1
                      ? ids[0]
                      : ids.includes(primary)
                        ? primary
                        : "",
                  );
                }}
              />
              {o.name}
            </label>
          ))}
      </div>
      <label>
        Primary category *
        <select
          required
          value={primary}
          onChange={(e) => onChange(selected, e.target.value)}
        >
          <option value="">Choose the breadcrumb category</option>
          {options
            .filter((o) => selected.includes(o.id))
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}
