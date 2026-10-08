"use client";
import { useState } from "react";
import type { VariantInput } from "./validation";
import { priceBreakdown, parsePaise, discountedPrice } from "./pricing";
function Amount({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: number;
  onChange?: (n: number) => void;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label>
      {label}
      <input
        inputMode="decimal"
        readOnly={readOnly}
        value={draft ?? (value / 100).toFixed(2)}
        onFocus={() => {
          if (!readOnly) setDraft((value / 100).toFixed(2));
        }}
        onBlur={(e) => {
          if (e.target.validity.valid) setDraft(null);
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const parsed = parsePaise(e.target.value);
          e.target.setCustomValidity(
            parsed === null
              ? "Enter a non-negative amount with at most two decimal places."
              : "",
          );
          if (parsed !== null) onChange?.(parsed);
        }}
      />
    </label>
  );
}
export function PriceEditor({
  value,
  onChange,
}: {
  value: VariantInput;
  onChange: (v: VariantInput) => void;
}) {
  const price = priceBreakdown(
    value.salePaise,
    value.priceMode,
    value.gstRateBps,
  );
  const [discountMode, setDiscountMode] = useState("percent");
  const discount = Math.max(0, value.mrpPaise - value.salePaise);
  return (
    <div className="admin-form-grid catalog-price-grid">
      <label>
        Price mode
        <select
          value={value.priceMode}
          onChange={(e) =>
            onChange({
              ...value,
              priceMode: e.target.value as VariantInput["priceMode"],
              salePaise:
                e.target.value === "INCLUSIVE"
                  ? price.payablePaise
                  : price.basePaise,
              mrpPaise:
                e.target.value === "INCLUSIVE"
                  ? priceBreakdown(
                      value.mrpPaise,
                      value.priceMode,
                      value.gstRateBps,
                    ).payablePaise
                  : priceBreakdown(
                      value.mrpPaise,
                      value.priceMode,
                      value.gstRateBps,
                    ).basePaise,
            })
          }
        >
          <option value="INCLUSIVE">GST inclusive</option>
          <option value="EXCLUSIVE">GST exclusive</option>
        </select>
      </label>
      <label>
        GST %
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={value.gstRateBps / 100}
          onChange={(e) => {
            const n = parsePaise(e.target.value);
            if (n !== null && n <= 10000) onChange({ ...value, gstRateBps: n });
          }}
        />
      </label>
      <Amount
        label={
          "MRP (" +
          (value.priceMode === "INCLUSIVE" ? "incl." : "excl.") +
          " GST) ₹"
        }
        value={value.mrpPaise}
        onChange={(mrpPaise) => onChange({ ...value, mrpPaise })}
      />
      <Amount
        label="Rate incl. GST ₹"
        value={price.payablePaise}
        readOnly={value.priceMode !== "INCLUSIVE"}
        onChange={(salePaise) => onChange({ ...value, salePaise })}
      />
      <Amount
        label="Rate excl. GST ₹"
        value={price.basePaise}
        readOnly={value.priceMode !== "EXCLUSIVE"}
        onChange={(salePaise) => onChange({ ...value, salePaise })}
      />
      <label>
        Discount type
        <select
          value={discountMode}
          onChange={(e) => setDiscountMode(e.target.value)}
        >
          <option value="percent">Percentage</option>
          <option value="amount">Amount in selected price mode</option>
        </select>
      </label>
      {discountMode === "amount" ? (
        <Amount
          label="Discount ₹"
          value={discount}
          onChange={(amount) =>
            onChange({
              ...value,
              salePaise: Math.max(0, value.mrpPaise - amount),
            })
          }
        />
      ) : (
        <label>
          Discount %
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={
              value.mrpPaise
                ? ((discount * 100) / value.mrpPaise).toFixed(2)
                : "0"
            }
            onChange={(e) => {
              const bps = parsePaise(e.target.value);
              if (bps !== null && bps <= 10000)
                onChange({
                  ...value,
                  salePaise: discountedPrice(value.mrpPaise, bps),
                });
            }}
          />
        </label>
      )}
      <Amount
        label="Private cost ₹ (optional)"
        value={value.costPaise ?? 0}
        onChange={(costPaise) => onChange({ ...value, costPaise })}
      />
      <p className="category-wide admin-muted">
        GST ₹{(price.taxPaise / 100).toFixed(2)} · Customer price ₹
        {(price.payablePaise / 100).toFixed(2)}. Discount is already included in
        this price.
      </p>
    </div>
  );
}
