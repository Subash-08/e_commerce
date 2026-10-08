"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="admin-panel" role="alert">
      <h1>Products could not be loaded</h1>
      <p>Please retry. Unsaved changes are not stored.</p>
      <button type="button" className="admin-button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
