import Link from "next/link";
import { headers } from "next/headers";
import { listAdminProducts } from "@/modules/catalog/admin-list";
import { AdminPageHeader, StatusBadge } from "@/shared/ui/admin";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const str = (k: string) =>
    typeof raw[k] === "string" ? (raw[k] as string) : "";
  const query = {
    search: str("search").slice(0, 100),
    status: str("status"),
    brand: str("brand"),
    category: str("category"),
    page: Math.max(1, Math.min(10000, Math.floor(Number(str("page")) || 1))),
  };
  const result = await listAdminProducts(new Headers(await headers()), query);
  const href = (page: number) =>
    "/admin/products?" + new URLSearchParams({ ...query, page: String(page) });
  return (
    <section>
      <AdminPageHeader
        eyebrow="Catalog"
        title="Products"
        description="Manage product content, sellable variants and availability."
        action={
          <Link className="admin-button" href="/admin/products/new">
            Add product
          </Link>
        }
      />
      <section className="admin-panel">
        <form className="admin-toolbar admin-filters" method="get">
          <label className="admin-search">
            <span className="sr-only">Search products</span>
            <input
              name="search"
              placeholder="Search product name…"
              defaultValue={query.search}
            />
          </label>
          <select
            aria-label="Product status"
            name="status"
            defaultValue={query.status}
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <select aria-label="Brand" name="brand" defaultValue={query.brand}>
            <option value="">All brands</option>
            {result.brands.map((b) => (
              <option key={b._id.toString()} value={b._id.toString()}>
                {String(b.name)}
              </option>
            ))}
          </select>
          <select
            aria-label="Category"
            name="category"
            defaultValue={query.category}
          >
            <option value="">All categories</option>
            {result.categories.map((c) => (
              <option key={c._id.toString()} value={c._id.toString()}>
                {String(c.name)}
              </option>
            ))}
          </select>
          <button className="admin-button secondary">Apply filters</button>
          <Link href="/admin/products">Clear</Link>
        </form>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Status</th>
                <th>Variants</th>
                <th>Price incl. GST</th>
                <th>Availability</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((p) => (
                <tr key={p._id.toString()}>
                  <td>
                    <strong>{p.name}</strong>
                    <small> /product/{p.slug}</small>
                  </td>
                  <td>
                    <StatusBadge
                      tone={p.status === "ACTIVE" ? "success" : "neutral"}
                    >
                      {p.status}
                    </StatusBadge>
                  </td>
                  <td>{p.listing.activeVariantCount}</td>
                  <td>
                    {p.listing.minPricePaise === null
                      ? "—"
                      : new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                        }).format(p.listing.minPricePaise / 100)}
                  </td>
                  <td>{p.listing.inStock ? "In stock" : "Unavailable"}</td>
                  <td>
                    <Link
                      className="admin-button secondary"
                      href={"/admin/products/" + p._id + "/edit"}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.rows.length && (
            <div className="admin-empty">
              <h2>No products found</h2>
              <p>Create a product or adjust your filters.</p>
            </div>
          )}
        </div>
        <footer className="admin-pagination">
          <span>
            {result.total} products · Page {result.page} of {result.pages}
          </span>
          <div>
            {result.page > 1 && (
              <Link href={href(result.page - 1)}>Previous</Link>
            )}
            {result.page < result.pages && (
              <Link href={href(result.page + 1)}>Next</Link>
            )}
          </div>
        </footer>
      </section>
    </section>
  );
}
