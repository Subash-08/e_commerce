export default function Loading() {
  return (
    <div
      className="sf-catalog-container"
      role="status"
      aria-label="Loading products"
    >
      <div className="sf-listing-skeleton sf-skeleton-pulse">
        <div className="sf-skeleton-heading">
          <span className="sf-skeleton-line" />
          <span className="sf-skeleton-line" />
        </div>
        <div className="sf-skeleton-layout">
          <div className="sf-skeleton-filter sf-skeleton-box" />
          <div className="sf-skeleton-grid">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="sf-skeleton-card">
                <span className="sf-skeleton-box" />
                <span className="sf-skeleton-line" />
                <span className="sf-skeleton-line" />
                <span className="sf-skeleton-line" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="sf-sr-only">Loading the latest catalog results…</span>
    </div>
  );
}
