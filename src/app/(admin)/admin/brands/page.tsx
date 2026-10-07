import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { getBrands } from "@/modules/brands/runtime";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  StatusBadge,
} from "@/shared/ui/admin";

const statuses = ["current", "active", "inactive", "archived", "all"] as const;
const sorts = ["order", "name", "updated"] as const;

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const search = typeof raw.search === "string" ? raw.search.slice(0, 100) : "";
  const status =
    typeof raw.status === "string" &&
    statuses.includes(raw.status as (typeof statuses)[number])
      ? (raw.status as (typeof statuses)[number])
      : "current";
  const featured =
    raw.featured === "featured" || raw.featured === "standard"
      ? raw.featured
      : undefined;
  const sort =
    typeof raw.sort === "string" &&
    sorts.includes(raw.sort as (typeof sorts)[number])
      ? (raw.sort as (typeof sorts)[number])
      : "order";
  const page = Math.max(1, Math.min(10000, Math.floor(Number(raw.page) || 1)));
  const result = await (
    await getBrands()
  ).list(new Headers(await headers()), {
    search,
    status,
    featured,
    sort,
    page,
  });
  const pageHref = (next: number) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "current") params.set("status", status);
    if (featured) params.set("featured", featured);
    if (sort !== "order") params.set("sort", sort);
    params.set("page", String(next));
    return "/admin/brands?" + params.toString();
  };

  return (
    <section data-feature="brands">
      <AdminPageHeader
        eyebrow="Catalog identity"
        title="Brands"
        description="Manage brand identity, storefront visibility and stable public URLs."
        action={
          <Link className="admin-button" href="/admin/brands/new">
            ＋ Add brand
          </Link>
        }
      />
      <AdminPanel>
        <div className="admin-toolbar">
          <form method="get" className="admin-filters">
            <label className="admin-search">
              <span className="sr-only">Search brand name or slug</span>
              <input
                name="search"
                type="search"
                defaultValue={search}
                maxLength={100}
                placeholder="Search name or slug…"
              />
            </label>
            <label>
              <span className="sr-only">Brand status</span>
              <select name="status" defaultValue={status}>
                <option value="current">Current</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
                <option value="all">All statuses</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Featured filter</span>
              <select name="featured" defaultValue={featured ?? ""}>
                <option value="">All placements</option>
                <option value="featured">Featured</option>
                <option value="standard">Standard</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Sort brands</span>
              <select name="sort" defaultValue={sort}>
                <option value="order">Display order</option>
                <option value="name">Name</option>
                <option value="updated">Recently updated</option>
              </select>
            </label>
            <button className="admin-button secondary" type="submit">
              Apply filters
            </button>
            {(search ||
              status !== "current" ||
              featured ||
              sort !== "order") && (
              <Link href="/admin/brands" className="admin-text-link">
                Clear
              </Link>
            )}
          </form>
        </div>
        {!result.rows.length ? (
          <AdminEmptyState
            title="No brands found"
            description="Adjust the filters or create a brand for your catalog."
            action={
              <Link className="admin-button" href="/admin/brands/new">
                Create brand
              </Link>
            }
          />
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Status</th>
                  <th>Featured</th>
                  <th>Order</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="admin-person">
                        {row.logo ? (
                          <Image
                            unoptimized
                            width={38}
                            height={38}
                            src={row.logo.secureUrl}
                            alt={row.logo.alt || row.name + " logo"}
                          />
                        ) : (
                          <span className="admin-avatar" aria-hidden="true">
                            B
                          </span>
                        )}
                        <div>
                          <strong>{row.name}</strong>
                          <small>/brand/{row.slug}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {row.archived ? (
                        <StatusBadge tone="neutral">Archived</StatusBadge>
                      ) : row.active ? (
                        <StatusBadge tone="success">Active</StatusBadge>
                      ) : (
                        <StatusBadge tone="warning">Inactive</StatusBadge>
                      )}
                    </td>
                    <td>{row.featured ? "Yes" : "No"}</td>
                    <td>{row.displayOrder}</td>
                    <td>
                      {new Date(row.updatedAt).toLocaleDateString("en-GB", {
                        timeZone: "UTC",
                      })}
                    </td>
                    <td className="admin-row-actions">
                      <Link
                        className="admin-button secondary"
                        href={"/admin/brands/" + row.id + "/edit"}
                      >
                        Edit
                      </Link>
                      {row.active && !row.archived && (
                        <Link
                          className="admin-text-link"
                          href={"/brand/" + row.slug}
                          target="_blank"
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="admin-pagination">
          <span>
            {result.total} brands · Page {result.page} of {result.pages}
          </span>
          <div>
            {result.page > 1 && (
              <Link
                className="admin-button secondary"
                href={pageHref(result.page - 1)}
              >
                Previous
              </Link>
            )}
            {result.page < result.pages && (
              <Link
                className="admin-button secondary"
                href={pageHref(result.page + 1)}
              >
                Next
              </Link>
            )}
          </div>
        </footer>
      </AdminPanel>
    </section>
  );
}
