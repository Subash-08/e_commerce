"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavLinkItem {
  href: string;
  label: string;
  matchPrefix?: string;
  children?: readonly { href: string; label: string; group?: string }[];
}

export function DesktopNav({ items }: { items: readonly NavLinkItem[] }) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const isActive = item.matchPrefix
          ? pathname.startsWith(item.matchPrefix)
          : item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href + "/");

        if (item.children?.length)
          return (
            <details
              key={item.label}
              name="catalog-navigation"
              className="sf-nav-menu"
            >
              <summary
                className="sf-nav-link"
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
                <span aria-hidden="true">⌄</span>
              </summary>
              <div className="sf-nav-dropdown">
                <Link
                  href={item.href}
                  className="sf-nav-dropdown-all"
                  onClick={(event) =>
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open")
                  }
                >
                  View all {item.label.toLowerCase()}
                </Link>
                <div className="sf-nav-dropdown-list">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={(event) =>
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open")
                      }
                    >
                      <span>{child.label}</span>
                      {child.group && <small>{child.group}</small>}
                    </Link>
                  ))}
                </div>
              </div>
            </details>
          );

        return (
          <Link
            key={item.href}
            href={item.href}
            className="sf-nav-link"
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
