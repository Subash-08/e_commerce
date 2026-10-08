import Link from "next/link";
import { DesktopNav } from "./DesktopNav.tsx";
import { MobileMenu } from "./MobileMenu.tsx";

// ── SVG icon helpers (inline, no package) ─────────────────────────────────

function IconSearch() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconHeart() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function IconCart() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function IconHelpCircle() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// ── Navigation data ────────────────────────────────────────────────────────

const mainNavItems = [
  { href: "/products", label: "Products" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/faq", label: "FAQ" },
];

const mobileNavItems = [
  { href: "/products", label: "Products", icon: <IconGrid /> },
  { href: "/about", label: "About", icon: <IconInfo /> },
  { href: "/contact", label: "Contact", icon: <IconMail /> },
  { href: "/faq", label: "FAQ", icon: <IconHelpCircle /> },
];

const mobileAccountItems = [
  { href: "/account", label: "My Account", icon: <IconUser /> },
  { href: "/wishlist", label: "Wishlist", icon: <IconHeart /> },
  { href: "/cart", label: "Cart", icon: <IconCart /> },
];

// ── Component ──────────────────────────────────────────────────────────────

export function StorefrontHeader() {
  return (
    <header className="sf-header" role="banner">
      <div className="sf-header-inner">
        {/* Logo */}
        <Link href="/" className="sf-logo" aria-label="Commerce — Home">
          <span className="sf-logo-mark" aria-hidden="true">
            C
          </span>
          <span className="sf-logo-text">Commerce</span>
        </Link>

        {/* Desktop navigation */}
        <nav aria-label="Primary navigation" className="sf-nav">
          <DesktopNav items={mainNavItems} />

          {/* Desktop search — inside nav so it is reachable by keyboard near nav */}
          <form
            action="/search"
            method="get"
            role="search"
            aria-label="Product search"
            style={{ marginLeft: "0.5rem" }}
          >
            <div className="sf-search">
              <label htmlFor="desktop-search-input" className="sr-only">
                Search products
              </label>
              <input
                id="desktop-search-input"
                className="sf-search-input"
                type="search"
                name="q"
                placeholder="Search products…"
                autoComplete="off"
              />
              <button
                type="submit"
                className="sf-search-btn"
                aria-label="Search"
              >
                <IconSearch />
              </button>
            </div>
          </form>
        </nav>

        {/* Desktop icon actions */}
        <div className="sf-header-actions">
          <Link href="/account" className="sf-icon-btn" aria-label="My account">
            <IconUser />
          </Link>
          <Link href="/wishlist" className="sf-icon-btn" aria-label="Wishlist">
            <IconHeart />
          </Link>
          <Link href="/cart" className="sf-icon-btn" aria-label="Cart">
            <IconCart />
          </Link>

          {/* Mobile menu trigger + drawer (client island) */}
          <MobileMenu
            navItems={mobileNavItems}
            accountItems={mobileAccountItems}
          />
        </div>
      </div>
    </header>
  );
}
