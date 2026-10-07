import Link from "next/link";
import "@/shared/styles/auth.css";
import "@/shared/styles/base.css";
export const metadata = {
  title: { default: "Commerce", template: "%s | Store" },
  robots: { index: false, follow: false },
};
export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body data-shell="store">
        <header className="store-header">
          <Link href="/login">
            Commerce<span>YOUR ACCOUNT</span>
          </Link>
        </header>
        {children}
      </body>
    </html>
  );
}
