import "@/shared/styles/base.css";
export const metadata = {
  title: { default: "Store placeholder", template: "%s | Store" },
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
        <header className="border-b p-4">Store · Foundation placeholder</header>
        {children}
      </body>
    </html>
  );
}
