export function ProductDetailSkeleton() {
  return (
    <div
      className="product-hero sf-skeleton-pulse"
      aria-busy="true"
      aria-label="Loading product details"
    >
      <div className="product-gallery">
        <div
          className="product-main-image sf-skeleton-box"
          style={{ height: "460px" }}
        />
        <div className="product-thumbnails">
          <div
            className="sf-skeleton-box"
            style={{ width: "72px", height: "72px", borderRadius: "8px" }}
          />
          <div
            className="sf-skeleton-box"
            style={{ width: "72px", height: "72px", borderRadius: "8px" }}
          />
        </div>
      </div>
      <div className="product-buy-panel">
        <div
          className="sf-skeleton-line"
          style={{ width: "25%", height: "14px" }}
        />
        <div
          className="sf-skeleton-line"
          style={{ width: "75%", height: "32px", marginTop: "12px" }}
        />
        <div
          className="sf-skeleton-line"
          style={{ width: "90%", height: "20px", marginTop: "12px" }}
        />
        <div
          className="sf-skeleton-line"
          style={{ width: "40%", height: "36px", marginTop: "24px" }}
        />
        <div
          className="sf-skeleton-box"
          style={{
            width: "100%",
            height: "70px",
            marginTop: "24px",
            borderRadius: "8px",
          }}
        />
        <div
          className="sf-skeleton-box"
          style={{
            width: "100%",
            height: "44px",
            marginTop: "16px",
            borderRadius: "8px",
          }}
        />
      </div>
    </div>
  );
}
