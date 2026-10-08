"use client";
export default function ShippingError({ reset }: { reset: () => void }) {
  return (
    <section className="admin-panel" role="alert">
      <h1>Shipping settings unavailable</h1>
      <p>
        Only active administrators can manage this policy. If you are an
        administrator, retry; no default policy will be substituted.
      </p>
      <button className="admin-button" onClick={reset}>
        Retry
      </button>
    </section>
  );
}
