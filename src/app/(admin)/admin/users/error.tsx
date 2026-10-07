"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="admin-panel admin-empty">
      <h2>We could not load users</h2>
      <p>No account changes were made by this page.</p>
      <button className="admin-button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
