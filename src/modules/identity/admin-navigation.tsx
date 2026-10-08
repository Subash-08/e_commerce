"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const items = [
  { href: "/admin/coupons", title: "Coupons", icon: "%" },
  { href: "/admin/products", title: "Products", icon: "□" },
  { href: "/admin/attributes", title: "Attributes", icon: "≡" },
  { href: "/admin/categories", title: "Categories", icon: "▦" },
  { href: "/admin/brands", title: "Brands", icon: "◆" },
  { href: "/admin/users", title: "Customers & users", icon: "◎" },
  { href: "/admin/logs", title: "Audit trail", icon: "▤" },
  { href: "/account", title: "My account", icon: "⚙" },
];

export function AdminNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="admin-menu-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="admin-navigation"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">☰</span> Menu
      </button>
      <nav
        id="admin-navigation"
        aria-label="Administration"
        className={open ? "open" : ""}
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={
              "admin-nav-item " +
              (pathname.startsWith(item.href) ? "selected" : "")
            }
            aria-current={pathname.startsWith(item.href) ? "page" : undefined}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.title}
          </Link>
        ))}
      </nav>
    </>
  );
}
