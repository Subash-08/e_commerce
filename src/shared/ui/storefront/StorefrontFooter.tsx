import Link from "next/link";

// ── Footer navigation data ────────────────────────────────────────────────
// Uses only real existing routes. No invented addresses, phones,
// social profiles, certifications or payment processor claims.

const shopLinks = [
  { href: "/products", label: "All Products" },
  { href: "/search", label: "Search" },
];

const supportLinks = [
  { href: "/contact", label: "Contact Us" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
  { href: "/track-order", label: "Track Order" },
];

const policyLinks = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/shipping-policy", label: "Shipping Policy" },
  { href: "/return-refund-policy", label: "Return & Refund" },
  { href: "/cancellation-policy", label: "Cancellation" },
  { href: "/warranty-policy", label: "Warranty" },
];

const bottomPolicyLinks = [
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/shipping-policy", label: "Shipping" },
  { href: "/return-refund-policy", label: "Returns" },
];

// ── Component ─────────────────────────────────────────────────────────────

export function StorefrontFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="sf-footer" role="contentinfo">
      <div className="sf-footer-main">
        {/* Brand column */}
        <div className="sf-footer-brand">
          <Link href="/" className="sf-footer-logo" aria-label="Commerce — Home">
            <span className="sf-logo-mark" aria-hidden="true">
              C
            </span>
            Commerce
          </Link>
          <p className="sf-footer-tagline">
            A reusable commerce template. Replace this tagline with your brand
            message.
          </p>
        </div>

        {/* Shop column */}
        <div className="sf-footer-group">
          <p className="sf-footer-group-title">Shop</p>
          <ul className="sf-footer-links">
            {shopLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Support column */}
        <div className="sf-footer-group">
          <p className="sf-footer-group-title">Support</p>
          <ul className="sf-footer-links">
            {supportLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Policies column */}
        <div className="sf-footer-group">
          <p className="sf-footer-group-title">Legal</p>
          <ul className="sf-footer-links">
            {policyLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="sf-footer-bottom">
        <p style={{ margin: 0 }}>
          © {year} Commerce Store. Reusable template — not a real business.
        </p>
        <nav
          aria-label="Policy links"
          className="sf-footer-bottom-links"
        >
          {bottomPolicyLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
