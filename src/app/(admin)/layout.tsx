import "@/shared/styles/base.css";
export const metadata = {
  title: "Admin placeholder",
  robots: { index: false, follow: false },
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body data-shell="admin">
        <header className="border-b p-4">
          Admin · Unprotected scaffold · No data or actions
        </header>
        {children}
      </body>
    </html>
  );
}
