"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function AdminNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration">
      {[
        { href: "/admin/users", title: "Customers & users", icon: "◎" },
        { href: "/admin/logs", title: "Audit trail", icon: "▤" },
        { href: "/account", title: "My account", icon: "⚙" },
      ].map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={
            "admin-nav-item " + (pathname === item.href ? "selected" : "")
          }
          aria-current={pathname === item.href ? "page" : undefined}
        >
          <span aria-hidden="true">{item.icon}</span>
          {item.title}
        </Link>
      ))}
    </nav>
  );
}
