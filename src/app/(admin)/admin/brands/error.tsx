"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="admin-panel admin-empty">
      <h1>Brands are unavailable</h1>
      <p>Check your connection and try again.</p>
      <button className="admin-button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
