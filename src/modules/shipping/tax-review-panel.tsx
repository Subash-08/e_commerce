"use client";
import { useState, useTransition } from "react";
import { recordTaxReviewAction } from "./actions";

type Choice = {
  key: string;
  label: string;
  approved: boolean;
  codApproved: boolean;
};
export function TaxReviewPanel({
  choices,
  today,
}: {
  choices: Choice[];
  today: string;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <section className="admin-form-card shipping-tax-review">
      <header>
        <h2>Record professional tax review</h2>
        <p>
          Use this only after a CA or tax adviser has reviewed the exact
          immutable policy. This action is separate from ordinary Shipping
          Settings saves.
        </p>
      </header>
      <form
        className="admin-form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setMessage("");
          start(async () => {
            const result = await recordTaxReviewAction({
              key: String(form.get("review.key") ?? ""),
              reference: String(form.get("review.reference") ?? ""),
              reviewedAt:
                String(form.get("review.date") ?? "") + "T00:00:00.000Z",
              purposes: [
                ...(form.has("review.shipping") ? ["SHIPPING"] : []),
                ...(form.has("review.cod") ? ["COD"] : []),
              ],
              confirmed: form.has("review.confirmed"),
            });
            setMessage(result.message);
          });
        }}
      >
        <label className="shipping-field">
          Immutable tax policy
          <select name="review.key" required defaultValue="">
            <option value="" disabled>
              Select policy
            </option>
            {choices.map((choice) => (
              <option key={choice.key} value={choice.key}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
        <label className="shipping-field">
          Review reference
          <input
            name="review.reference"
            required
            minLength={3}
            maxLength={200}
            placeholder="CA memo, engagement or approval reference"
          />
        </label>
        <label className="shipping-field">
          Review date
          <input name="review.date" type="date" required max={today} />
        </label>
        <div className="shipping-field">
          Approved purposes
          <label className="shipping-check">
            <input type="checkbox" name="review.shipping" /> Shipping fee
          </label>
          <label className="shipping-check">
            <input type="checkbox" name="review.cod" /> COD surcharge
          </label>
        </div>
        <label className="shipping-check wide">
          <input type="checkbox" name="review.confirmed" required /> I confirm
          this reference records an actual professional review of the displayed
          tax mode and rate.
        </label>
        <div className="wide shipping-review-action">
          <span role="status">{message}</span>
          <button className="admin-button" disabled={pending}>
            {pending ? "Recording…" : "Record review evidence"}
          </button>
        </div>
      </form>
    </section>
  );
}
