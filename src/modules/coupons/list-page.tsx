import Link from "next/link";
import { headers } from "next/headers";
import { listCoupons } from "./admin";
import {
  AdminPageHeader,
  AdminPanel,
  AdminEmptyState,
  StatusBadge,
} from "@/shared/ui/admin";
export async function CouponListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const search =
    typeof query.search === "string" ? query.search.slice(0, 20) : "";
  const archived = query.status === "archived";
  const page = Math.max(
    1,
    Math.min(10000, Math.floor(Number(query.page) || 1)),
  );
  const data = await listCoupons(
    new Headers(await headers()),
    search,
    archived,
    page,
  );
  const href = (p: number) =>
    `/admin/coupons?${new URLSearchParams({ search, status: archived ? "archived" : "current", page: String(p) })}`;
  return (
    <section>
      <AdminPageHeader
        eyebrow="Promotions"
        title="Coupons"
        description="Targeted discounts with live cart previews. Checkout redemption is a separate feature."
        action={
          <Link href="/admin/coupons/new" className="admin-button">
            ＋ Create coupon
          </Link>
        }
      />
      <AdminPanel>
        <div className="admin-toolbar">
          <form method="get" className="admin-filters">
            <label>
              Search code
              <input
                name="search"
                defaultValue={search}
                maxLength={20}
                placeholder="Starts with…"
              />
            </label>
            <label>
              Records
              <select
                name="status"
                defaultValue={archived ? "archived" : "current"}
              >
                <option value="current">Current coupons</option>
                <option value="archived">Archived coupons</option>
              </select>
            </label>
            <button className="admin-button" type="submit">
              Filter
            </button>
          </form>
        </div>
        {!data.rows.length ? (
          <AdminEmptyState
            title="No coupons found"
            description="Create an offer or change your filters."
            action={<Link href="/admin/coupons/new">Create coupon</Link>}
          />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code / name</th>
                  <th>Discount</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.code}</strong>
                      <br />
                      {row.name}
                    </td>
                    <td>
                      {row.kind === "PERCENTAGE"
                        ? `${row.value / 100}%`
                        : `₹${(row.value / 100).toFixed(2)}`}
                    </td>
                    <td>{row.scope.toLowerCase()}</td>
                    <td>
                      <StatusBadge
                        tone={row.status === "Active" ? "success" : "neutral"}
                      >
                        {row.status}
                      </StatusBadge>
                    </td>
                    <td>
                      <Link href={`/admin/coupons/${row.id}/edit`}>Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <nav aria-label="Coupon pages" className="admin-toolbar">
          {data.page > 1 && <Link href={href(data.page - 1)}>Previous</Link>}
          <span>
            {data.total} coupons · Page {data.page} of {data.pages}
          </span>
          {data.page < data.pages && (
            <Link href={href(data.page + 1)}>Next</Link>
          )}
        </nav>
      </AdminPanel>
    </section>
  );
}
