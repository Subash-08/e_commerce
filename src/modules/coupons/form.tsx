"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CouponInput } from "./contracts";
import type { CouponChoices } from "./admin";
import { couponInput } from "./contracts";
import { saveCouponAction } from "./actions";

function Selection({
  label,
  choices,
  selected,
  onChange,
}: {
  label: string;
  choices: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const matches = choices.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <fieldset className="coupon-selection">
      <legend>
        {label} ({selected.length} selected)
      </legend>
      <label>
        Find items
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
        />
      </label>
      <div>
        {matches.map((item) => (
          <label key={item.id}>
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              disabled={!selected.includes(item.id) && selected.length >= 100}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, item.id]
                    : selected.filter((id) => id !== item.id),
                )
              }
            />
            {item.name}
          </label>
        ))}
        {!matches.length && <p>No matching items.</p>}
      </div>
    </fieldset>
  );
}
const toLocal = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export function CouponForm({
  initial,
  choices,
}: {
  initial: CouponInput | null;
  choices: CouponChoices;
}) {
  const router = useRouter();
  const [value, setValue] = useState<CouponInput>(
    () =>
      initial ?? {
        revision: 0,
        code: "",
        name: "",
        description: "",
        kind: "PERCENTAGE",
        value: 1000,
        maxDiscountPaise: null,
        minEligiblePaise: 0,
        startsAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        active: true,
        archived: false,
        scope: "ALL",
        targetIds: [],
        excludedProductIds: [],
        includeDescendants: true,
        excludeSaleItems: false,
        audience: "EVERYONE",
        allowedUserIds: [],
        usageLimit: null,
        perAccountLimit: null,
      },
  );
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function update(change: Partial<CouponInput>) {
    setValue((v) => ({ ...v, ...change }));
    setDirty(true);
  }
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = couponInput.safeParse(value);
        if (!parsed.success) {
          setMessage(
            parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; "),
          );
          return;
        }
        if (
          value.archived &&
          !initial?.archived &&
          !window.confirm(
            "Archive this coupon? Existing order history is preserved, but this code cannot be reused.",
          )
        )
          return;
        startTransition(async () => {
          const result = await saveCouponAction(parsed.data);
          setMessage(result.message);
          if (result.ok) {
            setDirty(false);
            router.push("/admin/coupons");
            router.refresh();
          }
        });
      }}
    >
      {message && (
        <p className="admin-notice" role="alert">
          {message}
        </p>
      )}
      <fieldset
        className="admin-form-fieldset"
        disabled={pending || Boolean(initial?.archived)}
      >
        <section className="admin-form-card">
          <header>
            <h2>Offer details</h2>
            <p>
              One coupon per cart. Discounts apply only to eligible items, after
              catalog discounts.
            </p>
          </header>
          <div className="admin-form-grid">
            <label>
              Coupon code
              <input
                required
                minLength={3}
                maxLength={20}
                readOnly={Boolean(initial)}
                value={value.code}
                onChange={(e) => update({ code: e.target.value.toUpperCase() })}
                placeholder="WELCOME10"
              />
              <small>
                3–20 letters, numbers, underscores or hyphens. Codes cannot
                change after creation.
              </small>
            </label>
            <label>
              Internal name
              <input
                required
                maxLength={100}
                value={value.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </label>
            <label>
              Discount type
              <select
                value={value.kind}
                onChange={(e) =>
                  update({
                    kind: e.target.value as CouponInput["kind"],
                    value:
                      e.target.value === "FREE_SHIPPING"
                        ? 0
                        : e.target.value === "PERCENTAGE"
                          ? 1000
                          : 10000,
                    maxDiscountPaise: null,
                  })
                }
              >
                <option value="PERCENTAGE">Percentage off</option>
                <option value="FIXED">Fixed amount off</option>
                <option value="FREE_SHIPPING">Free delivery</option>
              </select>
            </label>
            {value.kind !== "FREE_SHIPPING" && (
              <label>
                {value.kind === "PERCENTAGE" ? "Discount (%)" : "Discount (₹)"}
                <input
                  type="number"
                  min="0.01"
                  max={value.kind === "PERCENTAGE" ? "100" : undefined}
                  step="0.01"
                  required
                  value={value.value / 100}
                  onChange={(e) =>
                    update({ value: Math.round(Number(e.target.value) * 100) })
                  }
                />
              </label>
            )}
            <label>
              Minimum eligible spend (₹)
              <input
                type="number"
                min="0"
                step="0.01"
                value={value.minEligiblePaise / 100}
                onChange={(e) =>
                  update({
                    minEligiblePaise: Math.round(Number(e.target.value) * 100),
                  })
                }
              />
              <small>
                Only eligible items count; follows their configured
                inclusive/exclusive price basis.
              </small>
            </label>
            {(value.kind === "PERCENTAGE" ||
              value.kind === "FREE_SHIPPING") && (
              <label>
                {value.kind === "FREE_SHIPPING"
                  ? "Maximum delivery saving (₹, optional)"
                  : "Maximum discount (₹, optional)"}
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={
                    value.maxDiscountPaise === null
                      ? ""
                      : value.maxDiscountPaise / 100
                  }
                  onChange={(e) =>
                    update({
                      maxDiscountPaise: e.target.value
                        ? Math.round(Number(e.target.value) * 100)
                        : null,
                    })
                  }
                />
                {value.kind === "FREE_SHIPPING" && (
                  <small>
                    Leave empty to waive the full delivery charge. COD fees are
                    never waived.
                  </small>
                )}
              </label>
            )}
            <label>
              Starts (your local time)
              <input
                type="datetime-local"
                required
                value={toLocal(value.startsAt)}
                onChange={(e) => {
                  if (e.target.value)
                    update({
                      startsAt: new Date(e.target.value).toISOString(),
                    });
                }}
              />
            </label>
            <label>
              Ends (your local time)
              <input
                type="datetime-local"
                required
                value={toLocal(value.expiresAt)}
                onChange={(e) => {
                  if (e.target.value)
                    update({
                      expiresAt: new Date(e.target.value).toISOString(),
                    });
                }}
              />
              <small>Not valid at or after this time. Stored in UTC.</small>
            </label>
          </div>
        </section>
        <section className="admin-form-card">
          <header>
            <h2>Eligible catalog</h2>
            <p>
              Exclusions always win. A fixed discount applies once across the
              eligible items. Free delivery uses the same item eligibility and
              minimum-spend rules.
            </p>
          </header>
          <div className="admin-form-grid">
            <label>
              Apply to
              <select
                value={value.scope}
                onChange={(e) =>
                  update({
                    scope: e.target.value as CouponInput["scope"],
                    targetIds: [],
                  })
                }
              >
                <option value="ALL">All products</option>
                <option value="PRODUCT">Selected products</option>
                <option value="VARIANT">Selected variants</option>
                <option value="CATEGORY">Selected categories</option>
                <option value="BRAND">Selected brands</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={value.excludeSaleItems}
                onChange={(e) => update({ excludeSaleItems: e.target.checked })}
              />{" "}
              Exclude items already on sale
            </label>
            {value.scope === "CATEGORY" && (
              <label>
                <input
                  type="checkbox"
                  checked={value.includeDescendants}
                  onChange={(e) =>
                    update({ includeDescendants: e.target.checked })
                  }
                />{" "}
                Include subcategories
              </label>
            )}
          </div>
          {value.scope !== "ALL" && (
            <Selection
              label="Eligible items"
              choices={choices[value.scope]}
              selected={value.targetIds}
              onChange={(targetIds) => update({ targetIds })}
            />
          )}
          <details>
            <summary>Excluded products (optional)</summary>
            <Selection
              label="Never discount these products"
              choices={choices.PRODUCT}
              selected={value.excludedProductIds}
              onChange={(excludedProductIds) => update({ excludedProductIds })}
            />
          </details>
        </section>
        <section className="admin-form-card">
          <header>
            <h2>Customers and limits</h2>
            <p>
              Cart is a preview. Checkout must claim usage atomically before any
              redemption is guaranteed.
            </p>
          </header>
          <div className="admin-form-grid">
            <label>
              Who can use it?
              <select
                value={value.audience}
                onChange={(e) =>
                  update({
                    audience: e.target.value as CouponInput["audience"],
                    allowedUserIds: [],
                    ...(e.target.value === "EVERYONE"
                      ? { perAccountLimit: null }
                      : {}),
                  })
                }
              >
                <option value="EVERYONE">Everyone, including guests</option>
                <option value="ACCOUNT">Signed-in customers</option>
                <option value="SPECIFIC">Specific registered accounts</option>
              </select>
            </label>
            {value.audience === "SPECIFIC" && (
              <label>
                Canonical account IDs, separated by commas
                <textarea
                  value={value.allowedUserIds.join(",")}
                  onChange={(e) =>
                    update({
                      allowedUserIds: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <small>
                  Use registered account IDs from Users. Never use an unverified
                  guest email.
                </small>
              </label>
            )}
            <label>
              Total redemption limit (optional)
              <input
                type="number"
                min="1"
                step="1"
                value={value.usageLimit ?? ""}
                onChange={(e) =>
                  update({
                    usageLimit: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </label>
            {value.audience !== "EVERYONE" && (
              <label>
                Per-account limit (optional)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={value.perAccountLimit ?? ""}
                  onChange={(e) =>
                    update({
                      perAccountLimit: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </label>
            )}
            <label>
              <input
                type="checkbox"
                checked={value.active}
                onChange={(e) => update({ active: e.target.checked })}
              />{" "}
              Enabled
            </label>
            {initial && (
              <label>
                <input
                  type="checkbox"
                  checked={value.archived}
                  onChange={(e) =>
                    update({
                      archived: e.target.checked,
                      ...(e.target.checked ? { active: false } : {}),
                    })
                  }
                />{" "}
                Archive permanently
              </label>
            )}
            <label>
              Internal description
              <textarea
                maxLength={500}
                value={value.description}
                onChange={(e) => update({ description: e.target.value })}
              />
            </label>
          </div>
        </section>
      </fieldset>
      <div className="coupon-save-bar">
        <span>
          {dirty
            ? "Unsaved changes"
            : initial?.archived
              ? "Archived coupon — read only"
              : "Ready to save"}
        </span>
        <Link
          href="/admin/coupons"
          onClick={(e) => {
            if (dirty && !window.confirm("Discard unsaved changes?"))
              e.preventDefault();
          }}
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="admin-button"
          disabled={pending || Boolean(initial?.archived)}
        >
          {pending ? "Saving…" : "Save coupon"}
        </button>
      </div>
    </form>
  );
}
