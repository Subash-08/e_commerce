import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { getCategories } from "@/modules/categories/runtime";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  StatusBadge,
} from "@/shared/ui/admin";

const statuses = ["current", "active", "inactive", "archived", "all"] as const;
const sorts = ["order", "name", "updated"] as const;

export default async function CategoriesPage({
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
  const parentId =
    typeof raw.parent === "string" &&
    (raw.parent === "root" || /^[a-f0-9]{24}$/.test(raw.parent))
      ? raw.parent
      : undefined;
  const sort =
    typeof raw.sort === "string" &&
    sorts.includes(raw.sort as (typeof sorts)[number])
      ? (raw.sort as (typeof sorts)[number])
      : "order";
  const page = Math.max(1, Math.min(10_000, Math.floor(Number(raw.page) || 1)));
  const result = await (
    await getCategories()
  ).list(new Headers(await headers()), {
    search,
    status,
    parentId,
    sort,
    page,
  });
  const names = new Map(
    result.options.map((option) => [option.id, option.name]),
  );
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "current") params.set("status", status);
    if (parentId) params.set("parent", parentId);
    if (sort !== "order") params.set("sort", sort);
    params.set("page", String(nextPage));
    return "/admin/categories?" + params.toString();
  };

  return (
    <section data-feature="categories">
      <AdminPageHeader
        eyebrow="Catalog organization"
        title="Categories"
        description="Organize navigation, control public visibility, and keep category URLs stable."
        action={
          <Link className="admin-button" href="/admin/categories/new">
            ＋ Add category
          </Link>
        }
      />
      <AdminPanel>
        <div className="admin-toolbar">
          <form method="get" className="admin-filters">
            <label className="admin-search">
              <span className="sr-only">Search category name or slug</span>
              <input
                name="search"
                type="search"
                defaultValue={search}
                maxLength={100}
                placeholder="Search name or slug…"
              />
            </label>
            <label>
              <span className="sr-only">Category status</span>
              <select name="status" defaultValue={status}>
                <option value="current">Current</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
                <option value="all">All statuses</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Parent category</span>
              <select name="parent" defaultValue={parentId ?? ""}>
                <option value="">All parents</option>
                <option value="root">Top-level only</option>
                {result.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Sort categories</span>
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
              parentId ||
              sort !== "order") && (
              <Link href="/admin/categories" className="admin-text-link">
                Clear
              </Link>
            )}
          </form>
        </div>
        {!result.rows.length ? (
          <AdminEmptyState
            title="No categories found"
            description={
              search || status !== "current" || parentId
                ? "Adjust the filters or create a new category."
                : "Create the first category to organize the storefront."
            }
            action={
              <Link className="admin-button" href="/admin/categories/new">
                Create category
              </Link>
            }
          />
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Parent</th>
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
                        {row.thumbnail ? (
                          <Image
                            unoptimized
                            width={38}
                            height={38}
                            src={row.thumbnail.secureUrl}
                            alt={row.thumbnail.alt || row.name}
                          />
                        ) : (
                          <span className="admin-avatar" aria-hidden="true">
                            ▦
                          </span>
                        )}
                        <div>
                          <strong>{row.name}</strong>
                          <small>/category/{row.slug}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {row.parentId
                        ? (names.get(row.parentId) ?? "Unavailable")
                        : "Top-level"}
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
                        href={"/admin/categories/" + row.id + "/edit"}
                      >
                        Edit
                      </Link>
                      {row.active && !row.archived && (
                        <Link
                          className="admin-text-link"
                          href={"/category/" + row.slug}
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
            {result.total} categories · Page {result.page} of {result.pages}
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
