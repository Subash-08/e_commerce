"use client";

export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return (
    <div className="sf-catalog-container" role="alert">
      <div className="sf-catalog-notice" style={{ padding: "3rem 2rem" }}>
        <div
          style={{ fontSize: "2.5rem", marginBottom: "1rem" }}
          aria-hidden="true"
        >
          ⚠️
        </div>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--sf-brand, #1a3d2f)",
            marginBottom: "0.5rem",
          }}
        >
          Something went wrong
        </h1>
        <p
          style={{
            color: "var(--sf-text-2, #4a5c55)",
            fontSize: "var(--sf-text-base, 0.9375rem)",
            marginBottom: "1.5rem",
          }}
        >
          We were unable to load this page. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.625rem 1.25rem",
            background: "var(--sf-brand, #1a3d2f)",
            color: "#ffffff",
            borderRadius: "var(--sf-radius-sm, 6px)",
            border: 0,
            fontFamily: "var(--sf-font, inherit)",
            fontSize: "var(--sf-text-sm, 0.8125rem)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
