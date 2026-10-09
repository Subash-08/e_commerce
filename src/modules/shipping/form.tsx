"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { parsePaise } from "../catalog/pricing";
import { saveShippingAction, previewShippingAction } from "./actions";
import { stateCodes, type ShippingInput } from "./contracts";
import type { loadShippingAdmin } from "./service";
import { StatusBadge } from "../../shared/ui/admin";
import { TaxReviewPanel } from "./tax-review-panel";
import "./shipping.css";

type Data = Awaited<ReturnType<typeof loadShippingAdmin>>;
const ErrorContext = createContext<Record<string, string>>({});
function Field({
  name,
  label,
  children,
  hint,
}: {
  name: string;
  label: string;
  children?: ReactNode;
  hint?: string;
}) {
  const errors = useContext(ErrorContext);
  return (
    <label className="shipping-field">
      {label}
      {children ?? <input name={name} />} {hint && <small>{hint}</small>}
      {errors[name] && (
        <span className="shipping-field-error" role="alert">
          {errors[name]}
        </span>
      )}
    </label>
  );
}
const blank: ShippingInput = {
  enabled: false,
  country: "IN",
  currency: "INR",
  standardChargePaise: -1,
  automaticFreeShipping: { enabled: false, thresholdPaise: null },
  coverage: { mode: "ALL_INDIA", stateCodes: [], pinPrefixes: [] },
  shippingTaxPolicyKey: null,
  cod: {
    enabled: false,
    surchargePaise: 0,
    surchargeTaxPolicyKey: null,
    blockedStateCodes: [],
    blockedPinPrefixes: [],
    reservationDeadlineHours: 24,
  },
  quoteTtlSeconds: 600,
  onlinePaymentDeadlineSeconds: 900,
};
const rupees = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    value / 100,
  );
function decimal(value: number | null) {
  return value === null || value < 0 ? "" : (value / 100).toFixed(2);
}
export function ShippingForm({ data }: { data: Data }) {
  const stored = data.value ?? blank;
  const reviewedShipping = data.choices.filter((choice) => choice.approved);
  const suggestedPolicyKey =
    stored.enabled &&
    !stored.shippingTaxPolicyKey &&
    reviewedShipping.length === 1
      ? reviewedShipping[0]!.key
      : null;
  const [source, setSource] = useState({
    value: suggestedPolicyKey
      ? { ...stored, shippingTaxPolicyKey: suggestedPolicyKey }
      : stored,
    key: 0,
    restored: false,
    suggested: !!suggestedPolicyKey,
  });
  return (
    <>
      <ShippingEditor
        key={source.key}
        data={data}
        initial={source.value}
        restored={source.restored}
        suggested={source.suggested}
        restore={(value) =>
          setSource((s) => ({
            value,
            key: s.key + 1,
            restored: true,
            suggested: false,
          }))
        }
      />
      <TaxReviewPanel choices={data.choices} today={data.today} />
    </>
  );
}
function ShippingEditor({
  data,
  initial,
  restored,
  suggested,
  restore,
}: {
  data: Data;
  initial: ShippingInput;
  restored: boolean;
  suggested: boolean;
  restore: (v: ShippingInput) => void;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const dirtyRef = useRef(restored || suggested);
  const [dirty, setDirty] = useState(restored || suggested),
    [suggestionPending, setSuggestionPending] = useState(suggested),
    [revision, setRevision] = useState(data.revision),
    [pending, start] = useTransition();
  const [free, setFree] = useState(initial.automaticFreeShipping.enabled),
    [coverage, setCoverage] = useState(initial.coverage.mode),
    [cod, setCod] = useState(initial.cod.enabled);
  const [message, setMessage] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof previewShippingAction>
  > | null>(null);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  function input() {
    const f = new FormData(form.current!);
    const text = (key: string) => String(f.get(key) ?? "").trim();
    const amount = (key: string) => parsePaise(text(key)) ?? -1;
    const list = (key: string) =>
      text(key)
        .split(/[\s,]+/)
        .filter(Boolean);
    return {
      enabled: f.has("enabled"),
      country: "IN",
      currency: "INR",
      standardChargePaise: amount("standardChargePaise"),
      automaticFreeShipping: {
        enabled: free,
        thresholdPaise: free
          ? amount("automaticFreeShipping.thresholdPaise")
          : null,
      },
      coverage: {
        mode: coverage,
        stateCodes: coverage === "ALL_INDIA" ? [] : list("coverage.stateCodes"),
        pinPrefixes:
          coverage === "ALL_INDIA" ? [] : list("coverage.pinPrefixes"),
      },
      shippingTaxPolicyKey: text("shippingTaxPolicyKey") || null,
      cod: {
        enabled: cod,
        surchargePaise: amount("cod.surchargePaise"),
        surchargeTaxPolicyKey: text("cod.surchargeTaxPolicyKey") || null,
        blockedStateCodes: list("cod.blockedStateCodes"),
        blockedPinPrefixes: list("cod.blockedPinPrefixes"),
        reservationDeadlineHours: Number(text("cod.reservationDeadlineHours")),
      },
      quoteTtlSeconds: Number(text("quoteTtlSeconds")),
      onlinePaymentDeadlineSeconds: Number(
        text("onlinePaymentDeadlineSeconds"),
      ),
    };
  }
  const taxSelect = (name: string, value: string | null) => (
    <select name={name} defaultValue={value ?? ""}>
      <option value="">Not configured — review required</option>
      {data.choices.map((c) => (
        <option key={c.key} value={c.key}>
          {c.label}
          {(name.startsWith("cod.") ? c.codApproved : c.approved)
            ? " · reviewed"
            : " · estimate only"}
        </option>
      ))}
    </select>
  );
  function previewNow() {
    setMessage("");
    start(async () => {
      const f = new FormData(form.current!);
      const result = await previewShippingAction(input(), {
        merchandisePaise: parsePaise(String(f.get("preview.amount"))) ?? -1,
        state: f.get("preview.state"),
        pin: f.get("preview.pin"),
        payment: f.get("preview.payment"),
      });
      setPreview(result);
      if (!result.ok) {
        setErrors(result.fields);
        setMessage(result.message);
      } else setErrors({});
    });
  }
  return (
    <ErrorContext value={errors}>
      <form
        ref={form}
        className="shipping-settings"
        onChange={(event) => {
          if (!event.target.getAttribute("name")?.startsWith("preview.")) {
            dirtyRef.current = true;
            setDirty(true);
          }
          setPreview(null);
        }}
        onSubmit={(e) => {
          e.preventDefault();
          setMessage("");
          start(async () => {
            const result = await saveShippingAction(input(), revision);
            if (result.ok) {
              dirtyRef.current = false;
              setRevision(result.revision);
              setDirty(false);
              setSuggestionPending(false);
              setErrors({});
              setMessage(
                "Shipping settings saved. Tax approval is managed separately.",
              );
              router.refresh();
            } else {
              setErrors(result.fields);
              setMessage(result.message);
            }
          });
        }}
      >
        <div className="shipping-notice">
          <StatusBadge tone={data.taxApproved ? "success" : "warning"}>
            {data.taxApproved
              ? "Reviewed tax reference"
              : "Tax review required"}
          </StatusBadge>
          <span>
            India · INR only (₹) ·{" "}
            {revision < 0 ? "Not configured" : `Revision ${revision}`}. Saving
            does not approve tax or enable checkout.
          </span>
          {data.taxReviewReference && (
            <span>
              Review: {data.taxReviewReference}
              {data.taxReviewedAt
                ? ` · ${new Date(data.taxReviewedAt).toLocaleDateString()}`
                : ""}
            </span>
          )}
          {suggestionPending && (
            <span>
              The only reviewed shipping policy is selected below. Save settings
              to use it and enable checkout quotes.
            </span>
          )}
        </div>
        <fieldset disabled={pending} className="admin-form-fieldset">
          <section className="admin-form-card">
            <header>
              <h2>Delivery charges</h2>
              <p>
                Choose the fee your store charges. No carrier serviceability
                check is performed.
              </p>
            </header>
            <div className="admin-form-grid">
              <label className="shipping-check">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={initial.enabled}
                />{" "}
                Enable shipping
              </label>
              <Field
                name="standardChargePaise"
                label="Standard delivery charge (₹)"
                hint="Zero is allowed only when you explicitly offer free delivery."
              >
                <input
                  name="standardChargePaise"
                  inputMode="decimal"
                  defaultValue={decimal(initial.standardChargePaise)}
                  placeholder="Enter amount"
                />
              </Field>
              <label className="shipping-check">
                <input
                  type="checkbox"
                  checked={free}
                  onChange={(e) => setFree(e.target.checked)}
                />{" "}
                Free shipping above a threshold
              </label>
              <Field
                name="automaticFreeShipping.thresholdPaise"
                label="Free delivery from (₹)"
                hint="Discounted merchandise total, including GST; excludes delivery and COD fees."
              >
                <input
                  name="automaticFreeShipping.thresholdPaise"
                  inputMode="decimal"
                  disabled={!free}
                  defaultValue={decimal(
                    initial.automaticFreeShipping.thresholdPaise,
                  )}
                />
              </Field>
            </div>
          </section>
          <section className="admin-form-card">
            <header>
              <h2>Delivery area</h2>
              <p>
                Any matching state OR PIN prefix counts. A PIN prefix never
                overrides a state rule.
              </p>
            </header>
            <div className="admin-form-grid">
              <Field name="coverage" label="Coverage">
                <select
                  value={coverage}
                  onChange={(e) =>
                    setCoverage(
                      e.target.value as ShippingInput["coverage"]["mode"],
                    )
                  }
                >
                  <option value="ALL_INDIA">All India</option>
                  <option value="ALLOW_LIST">Only matching locations</option>
                  <option value="BLOCK_LIST">Exclude matching locations</option>
                </select>
              </Field>
              <Field
                name="coverage.stateCodes"
                label="State / UT codes"
                hint={`Comma-separated: ${stateCodes.join(", ")}`}
              >
                <input
                  name="coverage.stateCodes"
                  disabled={coverage === "ALL_INDIA"}
                  defaultValue={initial.coverage.stateCodes.join(", ")}
                  placeholder="TN, KA"
                />
              </Field>
              <Field
                name="coverage.pinPrefixes"
                label="PIN prefixes"
                hint="Comma-separated, 1–6 digits. Example: 60, 641."
              >
                <input
                  name="coverage.pinPrefixes"
                  disabled={coverage === "ALL_INDIA"}
                  defaultValue={initial.coverage.pinPrefixes.join(", ")}
                />
              </Field>
            </div>
          </section>
          <section className="admin-form-card">
            <header>
              <h2>Cash on delivery</h2>
              <p>
                COD cannot extend the delivery area. This sets policy; the
                checkout payment option comes later.
              </p>
            </header>
            <div className="admin-form-grid">
              <label className="shipping-check">
                <input
                  type="checkbox"
                  checked={cod}
                  onChange={(e) => setCod(e.target.checked)}
                />{" "}
                Enable COD policy
              </label>
              <Field
                name="cod.surchargePaise"
                label="Additional COD fee (₹)"
                hint="Free shipping does not waive this fee."
              >
                <input
                  name="cod.surchargePaise"
                  inputMode="decimal"
                  defaultValue={decimal(initial.cod.surchargePaise)}
                />
              </Field>
              <Field
                name="cod.blockedStateCodes"
                label="COD excluded state codes"
              >
                <input
                  name="cod.blockedStateCodes"
                  defaultValue={initial.cod.blockedStateCodes.join(", ")}
                />
              </Field>
              <Field
                name="cod.blockedPinPrefixes"
                label="COD excluded PIN prefixes"
              >
                <input
                  name="cod.blockedPinPrefixes"
                  defaultValue={initial.cod.blockedPinPrefixes.join(", ")}
                />
              </Field>
              <Field
                name="cod.reservationDeadlineHours"
                label="Fulfillment alert after (hours)"
                hint="1–168 hours. Future COD holds remain until shipment or explicit cancellation; this is an alert, not automatic stock release."
              >
                <input
                  name="cod.reservationDeadlineHours"
                  type="number"
                  min="1"
                  max="168"
                  defaultValue={initial.cod.reservationDeadlineHours}
                />
              </Field>
            </div>
          </section>
          <section className="admin-form-card">
            <header>
              <h2>Tax references</h2>
              <p>
                Select immutable tax policies. Product tax rates are not
                automatically approved for shipping. A formal delivery review
                must be recorded separately before order acceptance.
              </p>
            </header>
            <div className="admin-form-grid">
              <Field name="shippingTaxPolicyKey" label="Shipping tax policy">
                {taxSelect(
                  "shippingTaxPolicyKey",
                  initial.shippingTaxPolicyKey,
                )}
              </Field>
              <Field
                name="cod.surchargeTaxPolicyKey"
                label="COD fee tax policy"
              >
                {taxSelect(
                  "cod.surchargeTaxPolicyKey",
                  initial.cod.surchargeTaxPolicyKey,
                )}
              </Field>
            </div>
          </section>
          <details className="admin-form-card">
            <summary>Quote and payment timing</summary>
            <div className="admin-form-grid">
              <Field
                name="quoteTtlSeconds"
                label="Quote validity (seconds)"
                hint="600–900 seconds. Quotes never reserve stock."
              >
                <input
                  name="quoteTtlSeconds"
                  type="number"
                  min="600"
                  max="900"
                  defaultValue={initial.quoteTtlSeconds}
                />
              </Field>
              <Field
                name="onlinePaymentDeadlineSeconds"
                label="Online payment deadline (seconds)"
                hint="900–1800 seconds. Future payment sessions must end before this hold; late captures still require recovery."
              >
                <input
                  name="onlinePaymentDeadlineSeconds"
                  type="number"
                  min="900"
                  max="1800"
                  defaultValue={initial.onlinePaymentDeadlineSeconds}
                />
              </Field>
            </div>
          </details>
          <section className="admin-form-card">
            <header>
              <h2>Try your delivery rules</h2>
              <p>
                Server-calculated preview of the form above, including unsaved
                changes. No cart, order or stock is modified.
              </p>
            </header>
            <div className="admin-form-grid">
              <Field
                name="merchandisePaise"
                label="Example merchandise total (₹)"
              >
                <input
                  name="preview.amount"
                  inputMode="decimal"
                  placeholder="After discounts, including GST"
                />
              </Field>
              <Field name="state" label="Delivery state">
                <select name="preview.state" defaultValue="TN">
                  {stateCodes.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field name="pin" label="Delivery PIN">
                <input
                  name="preview.pin"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Six digits"
                />
              </Field>
              <Field name="payment" label="Payment method">
                <select name="preview.payment">
                  <option value="ONLINE">Online payment</option>
                  <option value="COD">Cash on delivery</option>
                </select>
              </Field>
              <button
                className="admin-button secondary"
                type="button"
                onClick={previewNow}
              >
                {pending ? "Calculating…" : "Calculate estimate"}
              </button>
            </div>
            {preview?.ok && (
              <div className="shipping-preview" role="status">
                {"serviceable" in preview.result && (
                  <>
                    <p>Destination is within your delivery area.</p>
                    <p>
                      Standard charge:{" "}
                      {rupees(preview.result.standardChargePaise)} · Shipping
                      waiver: {rupees(preview.result.automaticWaiverPaise)}
                    </p>
                    {preview.result.remainingPaise !== null && (
                      <p>
                        {preview.result.automaticFree
                          ? "Automatic free shipping applies."
                          : `${rupees(preview.result.remainingPaise)} more for free shipping.`}
                      </p>
                    )}
                    <p>
                      Shipping charge:{" "}
                      {rupees(preview.result.shippingChargePaise)} · COD fee:{" "}
                      {rupees(preview.result.codChargePaise)}
                    </p>
                  </>
                )}
                {preview.result.ok ? (
                  <>
                    <p>
                      Shipping tax: {rupees(preview.result.shipping.taxPaise)} ·
                      COD tax: {rupees(preview.result.cod.taxPaise)}
                    </p>
                    <strong>
                      Delivery total: {rupees(preview.result.payablePaise)}
                    </strong>
                    <p>
                      {preview.result.estimate
                        ? "Estimate only — tax review pending. Checkout would be blocked."
                        : "Reviewed tax reference used. Final checkout will revalidate all inputs."}
                    </p>
                  </>
                ) : (
                  <p>
                    {(
                      {
                        SHIPPING_DISABLED:
                          "Shipping is disabled. Delivery is unavailable.",
                        DESTINATION_UNSUPPORTED:
                          "This destination is outside the supported delivery area.",
                        COD_UNAVAILABLE:
                          "COD is unavailable for this destination.",
                        SHIPPING_TAX_CONFIGURATION_REQUIRED:
                          "Tax is not configured. Charges above are before tax treatment; no final total can be quoted.",
                        SHIPPING_CONFIGURATION_REQUIRED:
                          "Complete the shipping policy first.",
                      } as Record<string, string>
                    )[preview.result.issue] ?? preview.result.issue}
                  </p>
                )}
              </div>
            )}
          </section>
        </fieldset>
        {data.history.length > 0 && (
          <details className="admin-form-card">
            <summary>Previous saved policies</summary>
            <p>
              Restore loads a snapshot into this form. Review it, then save as a
              new revision.
            </p>
            {data.history.map((h) => (
              <div key={h.revision} className="shipping-history">
                <span>
                  Revision {h.revision} ·{" "}
                  {h.updatedAt.replace("T", " ").slice(0, 19)} UTC
                </span>
                <button
                  type="button"
                  className="admin-button secondary"
                  disabled={pending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Load this policy into the form? Unsaved changes will be replaced.",
                      )
                    )
                      restore(h.value);
                  }}
                >
                  Load snapshot
                </button>
              </div>
            ))}
          </details>
        )}
        <div className="shipping-save-bar">
          <span role="status">
            {message || (dirty ? "Unsaved changes" : "Settings are up to date")}
          </span>
          <div>
            <button
              className="admin-button secondary"
              type="button"
              disabled={pending}
              onClick={() => {
                if (
                  !dirty ||
                  window.confirm("Discard unsaved changes and reload?")
                )
                  window.location.reload();
              }}
            >
              Reload / cancel
            </button>
            <button
              className="admin-button primary"
              disabled={pending}
              type="submit"
            >
              {pending ? "Working…" : "Save settings"}
            </button>
          </div>
        </div>
      </form>
    </ErrorContext>
  );
}
