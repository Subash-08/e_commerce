export default function Loading() {
  return (
    <div
      className="sf-catalog-container sf-skeleton-pulse"
      role="status"
      aria-label="Loading page content"
    >
      <div
        className="sf-skeleton-line"
        style={{ width: "160px", height: "16px", marginBottom: "1.5rem" }}
      />
      <div
        className="sf-skeleton-box"
        style={{
          width: "100%",
          height: "240px",
          borderRadius: "16px",
          marginBottom: "1.5rem",
        }}
      />
      <div
        className="sf-skeleton-line"
        style={{ width: "35%", height: "28px", marginBottom: "1rem" }}
      />
      <div
        className="sf-skeleton-line"
        style={{ width: "70%", height: "16px", marginBottom: "0.5rem" }}
      />
      <div
        className="sf-skeleton-line"
        style={{ width: "50%", height: "16px" }}
      />
    </div>
  );
}
