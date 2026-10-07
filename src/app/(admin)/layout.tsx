import { AdminNavigation } from "@/modules/identity/admin-navigation";
import Link from "next/link";
import { requireAccountPage } from "@/modules/identity/page-guard";
import { SignOutButton } from "@/modules/identity/sign-out-button";
import "@/shared/styles/base.css";
import "@/shared/styles/admin.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Commerce Admin",
  robots: { index: false, follow: false },
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await requireAccountPage(true);
  return (
    <html lang="en">
      <body data-shell="admin">
        <div className="admin-shell">
          <aside className="admin-sidebar">
            <Link className="admin-brand" href="/admin/users">
              <span aria-hidden="true">C</span>
              <span>
                Commerce<small>Store management</small>
              </span>
            </Link>
            <div className="admin-nav-label">WORKSPACE</div>
            <AdminNavigation />
            <div className="admin-sidebar-bottom">
              <span className="admin-security-dot" /> Secure workspace
              <p>Access is verified on every request.</p>
            </div>
          </aside>
          <div className="admin-main">
            <header className="admin-topbar">
              <form className="admin-global-search" action="/admin/users">
                <span aria-hidden="true">⌕</span>
                <input
                  name="search"
                  aria-label="Search users"
                  placeholder="Search users…"
                />
              </form>
              <div className="admin-account-summary">
                <span className="admin-avatar">
                  {account.name.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{account.name}</strong>
                  <small>{account.role}</small>
                </span>
                <SignOutButton />
              </div>
            </header>
            <main className="admin-content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
