export default function Loading() {
  return (
    <section aria-busy="true" aria-label="Loading products">
      <div className="admin-page-heading">
        <h1>Products</h1>
      </div>
      <div className="admin-panel" role="status">
        Loading catalog…
      </div>
    </section>
  );
}
