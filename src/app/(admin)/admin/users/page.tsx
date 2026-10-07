import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getIdentity } from "@/modules/identity/runtime";
import { UsersTable } from "@/modules/identity/users-table";
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search =
    typeof params.search === "string" ? params.search.slice(0, 100) : "";
  const role =
    typeof params.role === "string" &&
    ["ADMIN", "STAFF", "CUSTOMER"].includes(params.role)
      ? params.role
      : undefined;
  const status =
    typeof params.status === "string" &&
    ["ACTIVE", "DISABLED"].includes(params.status)
      ? params.status
      : undefined;
  const page = Math.max(
    1,
    Math.min(10000, Math.floor(Number(params.page) || 1)),
  );
  let result;
  try {
    result = await (
      await getIdentity()
    ).administration.list(new Headers(await headers()), {
      search,
      role,
      status,
      page,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      ["AUTH_REQUIRED", "FORBIDDEN"].includes(error.message)
    )
      redirect("/login");
    return (
      <section className="admin-panel admin-empty">
        <h1>Users are temporarily unavailable</h1>
        <p>Your data has not been replaced. Refresh to try again.</p>
        <Link className="admin-button" href="/admin/users">
          Try again
        </Link>
      </section>
    );
  }
  const href = (next: number) =>
    "/admin/users?" +
    new URLSearchParams({
      search,
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
      page: String(next),
    });
  return (
    <section data-feature="users">
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">People & permissions</span>
          <h1>User management</h1>
          <p>Give your team the right access. Keep every account protected.</p>
        </div>
        <span className="admin-total">
          {result.total} {result.total === 1 ? "user" : "users"}
        </span>
      </div>
      <div className="admin-panel">
        <div className="admin-toolbar">
          <form method="get" className="admin-filters">
            <label className="admin-search">
              <span className="sr-only">Search users by name</span>
              <input
                name="search"
                type="search"
                defaultValue={search}
                maxLength={100}
                placeholder="Search users by name…"
              />
            </label>
            <label>
              <span className="sr-only">Filter by role</span>
              <select name="role" defaultValue={role ?? ""}>
                <option value="">All roles</option>
                <option value="ADMIN">Administrators</option>
                <option value="STAFF">Staff</option>
                <option value="CUSTOMER">Customers</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by status</span>
              <select name="status" defaultValue={status ?? ""}>
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </label>
            <button className="admin-button secondary" type="submit">
              Apply filters
            </button>
            {(search || role || status) && (
              <Link href="/admin/users" className="admin-text-link">
                Clear
              </Link>
            )}
          </form>
        </div>
        <UsersTable
          rows={result.rows}
          pendingRevocations={result.pendingRevocations}
        />
        <footer className="admin-pagination">
          <span>
            Page {result.page} of {result.pages} · 20 per page
          </span>
          <div>
            {result.page > 1 && (
              <Link
                className="admin-button secondary"
                href={href(result.page - 1)}
              >
                Previous
              </Link>
            )}
            {result.page < result.pages && (
              <Link
                className="admin-button secondary"
                href={href(result.page + 1)}
              >
                Next
              </Link>
            )}
          </div>
        </footer>
      </div>
      <p className="admin-footnote">
        All access changes are recorded. Customers cannot change their own
        permissions.
      </p>
    </section>
  );
}
