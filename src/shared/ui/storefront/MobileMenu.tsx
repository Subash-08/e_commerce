"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface CatalogGroup {
  label: string;
  items: Array<{ href: string; label: string }>;
}

interface Props {
  navItems: NavItem[];
  accountItems: NavItem[];
  catalogGroups: CatalogGroup[];
}

export function MobileMenu({ navItems, accountItems, catalogGroups }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on route change (useLayoutEffect is the linter-approved escape hatch
  // for synchronous state sync driven by derived state, not an external system)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: closing a modal on navigation is a standard pattern, not a cascading render risk
    setOpen(false);
  }, [pathname]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Trap focus inside drawer
  useEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    if (!drawer) return;

    // Find first focusable and move focus in
    const focusable = drawer.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable[0]?.focus();

    function onFocusOut(e: FocusEvent) {
      if (drawer && !drawer.contains(e.relatedTarget as Node | null)) {
        focusable[0]?.focus();
      }
    }
    drawer.addEventListener("focusout", onFocusOut);
    return () => drawer.removeEventListener("focusout", onFocusOut);
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Hamburger trigger */}
      <button
        ref={triggerRef}
        id="mobile-menu-trigger"
        className="sf-icon-btn sf-menu-btn"
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-controls="mobile-drawer"
        onClick={() => setOpen(true)}
        type="button"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Overlay + Drawer */}
      {open && (
        <>
          <div
            className="sf-drawer-overlay"
            aria-hidden="true"
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
          />
          <div
            ref={drawerRef}
            id="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="sf-drawer"
          >
            {/* Drawer header */}
            <div className="sf-drawer-header">
              <Link href="/" className="sf-logo" onClick={() => setOpen(false)}>
                <span className="sf-logo-mark" aria-hidden="true">
                  C
                </span>
                <span className="sf-logo-text">Commerce</span>
              </Link>
              <button
                className="sf-drawer-close"
                aria-label="Close navigation menu"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                type="button"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  width="20"
                  height="20"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Inline search */}
            <div className="sf-drawer-search">
              <form
                action="/search"
                method="get"
                role="search"
                aria-label="Product search"
              >
                <div className="sf-search">
                  <input
                    id="mobile-search-input"
                    className="sf-search-input"
                    type="search"
                    name="q"
                    placeholder="Search products…"
                    autoComplete="off"
                    aria-label="Search products"
                  />
                  <button
                    type="submit"
                    className="sf-search-btn"
                    aria-label="Search"
                    onClick={() => setOpen(false)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      width="18"
                      height="18"
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>

            {/* Nav links */}
            <nav aria-label="Mobile navigation" className="sf-drawer-nav">
              <p className="sf-drawer-section-label">Shop</p>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="sf-drawer-nav-link"
                  aria-current={pathname === item.href ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
              {catalogGroups.map((group) => (
                <div key={group.label} className="sf-drawer-catalog-group">
                  <p className="sf-drawer-section-label">{group.label}</p>
                  <div className="sf-drawer-catalog-links">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={
                          pathname === item.href ? "page" : undefined
                        }
                        onClick={() => setOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <div className="sf-drawer-divider" aria-hidden="true" />
              <p className="sf-drawer-section-label">Account &amp; Support</p>
              {accountItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="sf-drawer-nav-link"
                  aria-current={pathname === item.href ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="sf-drawer-footer">
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--sf-text-xs)",
                  color: "var(--sf-text-3)",
                }}
              >
                © {new Date().getFullYear()} Commerce Store
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
