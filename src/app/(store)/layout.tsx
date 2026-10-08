import "@/shared/styles/auth.css";
import "@/shared/styles/base.css";
import "@/shared/styles/storefront.css";
import { StorefrontHeader } from "@/shared/ui/storefront/StorefrontHeader.tsx";
import { StorefrontFooter } from "@/shared/ui/storefront/StorefrontFooter.tsx";

export const metadata = {
  title: { default: "Commerce", template: "%s | Commerce" },
  description:
    "A reusable commerce template. Replace this description with your brand copy.",
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
        <a href="#sf-main-content" className="sf-skip-link">
          Skip to main content
        </a>
        <div className="sf-layout">
          <StorefrontHeader />
          <main id="sf-main-content" className="sf-main" tabIndex={-1}>
            {children}
          </main>
          <StorefrontFooter />
        </div>
      </body>
    </html>
  );
}
