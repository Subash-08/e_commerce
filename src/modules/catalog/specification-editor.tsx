"use client";

type Entry = { label: string; value: string };
export function SpecificationEntries({
  value,
  onChange,
}: {
  value: Entry[];
  onChange: (value: Entry[]) => void;
}) {
  return (
    <div className="catalog-section-body">
      {value.map((entry, index) => (
        <div className="catalog-option-row" key={index}>
          <label>
            Specification
            <input
              maxLength={100}
              value={entry.label}
              onChange={(e) =>
                onChange(
                  value.map((v, i) =>
                    i === index ? { ...v, label: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          <label>
            Value
            <input
              maxLength={500}
              value={entry.value}
              onChange={(e) =>
                onChange(
                  value.map((v, i) =>
                    i === index ? { ...v, value: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            className="admin-text-link"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="admin-button secondary"
        disabled={value.length >= 50}
        onClick={() => onChange([...value, { label: "", value: "" }])}
      >
        Add specification
      </button>
    </div>
  );
}

export function SpecificationGroups({
  value,
  onChange,
}: {
  value: { heading: string; entries: Entry[] }[];
  onChange: (value: { heading: string; entries: Entry[] }[]) => void;
}) {
  return (
    <section className="admin-form-card">
      <header>
        <h2>Grouped specifications</h2>
        <p>
          Use sections such as Display, Connectivity and Included accessories.
        </p>
      </header>
      <div className="catalog-section-body">
        {value.map((group, index) => (
          <section key={index}>
            <label>
              Section heading
              <input
                maxLength={100}
                value={group.heading}
                onChange={(e) =>
                  onChange(
                    value.map((g, i) =>
                      i === index ? { ...g, heading: e.target.value } : g,
                    ),
                  )
                }
              />
            </label>
            <SpecificationEntries
              value={group.entries}
              onChange={(entries) =>
                onChange(
                  value.map((g, i) => (i === index ? { ...g, entries } : g)),
                )
              }
            />
            <button
              type="button"
              className="admin-text-link"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              Remove section
            </button>
          </section>
        ))}
        <button
          type="button"
          className="admin-button secondary"
          disabled={value.length >= 20}
          onClick={() =>
            onChange([
              ...value,
              { heading: "", entries: [{ label: "", value: "" }] },
            ])
          }
        >
          Add specification section
        </button>
      </div>
    </section>
  );
}
