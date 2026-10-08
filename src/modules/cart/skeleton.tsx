export function CartSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={compact ? "sf-cart-skeleton compact" : "sf-cart-skeleton"}
      role="status"
      aria-label="Loading your cart"
    >
      <span className="sr-only">Loading your cart…</span>
      <div className="sf-cart-grid" aria-hidden="true">
        <div className="sf-cart-lines">
          {[1, 2, 3].map((key) => (
            <div className="sf-cart-line" key={key}>
              <div className="sf-skeleton-block sf-cart-skeleton-image" />
              <div className="sf-cart-line-details">
                <div className="sf-skeleton-block sf-cart-skeleton-title" />
                <div className="sf-skeleton-block sf-cart-skeleton-description" />
                <div className="sf-skeleton-block sf-cart-skeleton-price" />
                <div className="sf-skeleton-block sf-cart-skeleton-controls" />
              </div>
            </div>
          ))}
        </div>
        <div className="sf-cart-summary">
          <div className="sf-skeleton-block sf-cart-skeleton-title" />
          {[1, 2, 3, 4].map((key) => (
            <div
              key={key}
              className="sf-skeleton-block sf-cart-skeleton-summary-row"
            />
          ))}
          <div className="sf-skeleton-block sf-cart-skeleton-controls" />
        </div>
      </div>
    </div>
  );
}
