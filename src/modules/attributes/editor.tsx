"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { stateValues } from "../../shared/domain/states.generated";
import { saveAttribute } from "./actions";
import type { AttributeInput } from "./validation";

const empty: AttributeInput = {
  code: "",
  name: "",
  type: "SINGLE_SELECT",
  unit: "",
  visible: true,
  filterable: false,
  variantAxisAllowed: true,
  active: true,
  displayOrder: 0,
  options: [],
};
const newId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export function AttributeEditor({
  initial,
  onSaved,
}: {
  initial?: AttributeInput;
  onSaved?: () => void;
}) {
  const [value, setValue] = useState<AttributeInput>(initial ?? empty);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const selectable = ["SINGLE_SELECT", "MULTI_SELECT", "COLOUR"].includes(
    value.type,
  );
  function save() {
    start(async () => {
      const result = await saveAttribute(value);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage("Attribute saved.");
      router.refresh();
      onSaved?.();
    });
  }
  return (
    <section className="admin-form-card">
      <header>
        <h2>{initial ? "Edit attribute" : "Create attribute"}</h2>
        <p>
          Options keep their identity when renamed. Retired options remain
          readable on existing variants.
        </p>
      </header>
      {message && (
        <p role="status" className="admin-notice">
          {message}
        </p>
      )}
      <fieldset disabled={pending} className="admin-form-fieldset">
        <div className="admin-form-grid">
          <label>
            Name
            <input
              value={value.name}
              maxLength={100}
              onChange={(e) => setValue({ ...value, name: e.target.value })}
            />
          </label>
          <label>
            Stable code
            <input
              disabled={!!initial?.id}
              placeholder="storage_capacity"
              value={value.code}
              onChange={(e) =>
                setValue({ ...value, code: e.target.value.toLowerCase() })
              }
            />
          </label>
          <label>
            Type
            <select
              value={value.type}
              onChange={(e) => {
                const type = e.target.value as AttributeInput["type"];
                setValue({
                  ...value,
                  type,
                  variantAxisAllowed:
                    ["SINGLE_SELECT", "COLOUR"].includes(type) &&
                    value.variantAxisAllowed,
                });
              }}
            >
              {stateValues.AttributeType.map((t) => (
                <option key={t} value={t}>
                  {t.replaceAll("_", " ").toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Unit
            <input
              placeholder="GB, cm, grams…"
              value={value.unit}
              onChange={(e) => setValue({ ...value, unit: e.target.value })}
            />
          </label>
          <label>
            Display order
            <input
              type="number"
              min={0}
              value={value.displayOrder}
              onChange={(e) =>
                setValue({ ...value, displayOrder: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Status
            <select
              value={String(value.active)}
              onChange={(e) =>
                setValue({ ...value, active: e.target.value === "true" })
              }
            >
              <option value="true">Active</option>
              <option value="false">Retired — no new assignments</option>
            </select>
          </label>
          {(["visible", "filterable", "variantAxisAllowed"] as const).map(
            (key) => (
              <label className="catalog-check" key={key}>
                <input
                  type="checkbox"
                  checked={value[key]}
                  onChange={(e) =>
                    setValue({ ...value, [key]: e.target.checked })
                  }
                />
                {key === "visible"
                  ? "Show in specifications"
                  : key === "filterable"
                    ? "Use in catalog filters"
                    : "Allow as a variant option"}
              </label>
            ),
          )}
          {selectable && (
            <div className="category-wide">
              <div className="admin-section-title">
                <h3>Options</h3>
                <button
                  type="button"
                  className="admin-button secondary"
                  disabled={value.options.length >= 100}
                  onClick={() =>
                    setValue({
                      ...value,
                      options: [
                        ...value.options,
                        {
                          id: newId(),
                          label: "",
                          colour: value.type === "COLOUR" ? "#555555" : "",
                          active: true,
                        },
                      ],
                    })
                  }
                >
                  Add option
                </button>
              </div>
              {value.options.map((option, index) => (
                <div className="catalog-option-row" key={option.id}>
                  <label className="sr-only" htmlFor={option.id}>
                    Option {index + 1}
                  </label>
                  <input
                    id={option.id}
                    value={option.label}
                    placeholder="Option label"
                    onChange={(e) =>
                      setValue({
                        ...value,
                        options: value.options.map((o) =>
                          o.id === option.id
                            ? { ...o, label: e.target.value }
                            : o,
                        ),
                      })
                    }
                  />
                  {value.type === "COLOUR" && (
                    <input
                      aria-label={option.label + " swatch"}
                      type="color"
                      value={option.colour || "#555555"}
                      onChange={(e) =>
                        setValue({
                          ...value,
                          options: value.options.map((o) =>
                            o.id === option.id
                              ? { ...o, colour: e.target.value }
                              : o,
                          ),
                        })
                      }
                    />
                  )}
                  <select
                    aria-label={option.label + " status"}
                    value={String(option.active)}
                    onChange={(e) =>
                      setValue({
                        ...value,
                        options: value.options.map((o) =>
                          o.id === option.id
                            ? { ...o, active: e.target.value === "true" }
                            : o,
                        ),
                      })
                    }
                  >
                    <option value="true">Active</option>
                    <option value="false">Retired</option>
                  </select>
                  <button
                    type="button"
                    className="admin-button secondary"
                    disabled={!index}
                    aria-label={"Move " + option.label + " up"}
                    onClick={() => {
                      const options = [...value.options];
                      [options[index - 1], options[index]] = [
                        options[index],
                        options[index - 1],
                      ];
                      setValue({ ...value, options });
                    }}
                  >
                    ↑
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="admin-toolbar">
          <button type="button" className="admin-button" onClick={save}>
            {pending ? "Saving…" : "Save attribute"}
          </button>
        </div>
      </fieldset>
    </section>
  );
}
export function AttributeWorkspace({ rows }: { rows: AttributeInput[] }) {
  const [editing, setEditing] = useState<AttributeInput | null | undefined>(
    undefined,
  );
  const [search, setSearch] = useState("");
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Attributes</h1>
          <p>Reusable specifications and variant options.</p>
        </div>
        <button className="admin-button" onClick={() => setEditing(null)}>
          Add attribute
        </button>
      </div>
      {editing !== undefined && (
        <div className="catalog-editor-block">
          <button
            className="admin-button secondary"
            onClick={() => setEditing(undefined)}
          >
            Close editor
          </button>
          <AttributeEditor
            key={editing?.id ?? "new"}
            initial={editing ?? undefined}
            onSaved={() => setEditing(undefined)}
          />
        </div>
      )}
      <section className="admin-panel">
        <div className="admin-toolbar">
          <label>
            Search attributes
            <input
              className="catalog-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Attribute</th>
                <th>Type</th>
                <th>Options</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) =>
                  (r.name + r.code)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <small> {row.code}</small>
                    </td>
                    <td>{row.type}</td>
                    <td>{row.options.length}</td>
                    <td>{row.active ? "Active" : "Retired"}</td>
                    <td>
                      <button
                        className="admin-button secondary"
                        onClick={() => setEditing(row)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!rows.length && (
            <div className="admin-empty">
              Add an attribute such as colour, storage or material.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
