export const dynamic = "force-dynamic";
import { requireAccountPage } from "@/modules/identity/page-guard";
import "@/shared/styles/base.css";
export const metadata = {
  title: "Admin placeholder",
  robots: { index: false, follow: false },
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAccountPage(true);
  return (
    <html lang="en">
      <body data-shell="admin">
        <header className="border-b p-4">
          Admin · Protected scaffold · No commerce data or actions
        </header>
        {children}
      </body>
    </html>
  );
}
